// Query interpreter, not a per-endpoint canned response: unfiltered calls can
// see every account's rows, just as the server service role would.
function mockSupabase() {
  const tables = { posts: [], assets: [], infinity_messages: [], infinity_relay: [] }; const objects = new Map(); const calls = [];
  let nextError = null;
  const sequences = new Map();
  const nextSeq = table => { const value = (sequences.get(table) || 0) + 1; sequences.set(table, value); return value; };
  class Query {
    constructor(table) { this.table = table; tables[table] ||= []; this.filters = []; this.operation = 'select'; this.sorts = []; this.max = Infinity; this.single = false; }
    select() { return this; }
    eq(field, value) { this.filters.push(row => row[field] === value); calls.push({ table: this.table, field, value }); return this; }
    gt(field, value) { this.filters.push(row => row[field] > value); return this; }
    in(field, values) { this.filters.push(row => values.includes(row[field])); return this; }
    contains(field, values) { this.filters.push(row => values.every(v => row[field]?.includes(v))); return this; }
    or(value) {
      calls.push({ cursor: value });
      const match = /^created_at.lt.([^,]+),and\(created_at.eq.([^,]+),id.lt.([^,)]+)\)$/.exec(value);
      if (!match) throw new Error('Invalid cursor query');
      this.filters.push(row => row.created_at < match[1] || (row.created_at === match[2] && row.id < match[3])); return this;
    }
    order(field, { ascending }) { this.sorts.push({ field, ascending }); return this; }
    limit(value) { this.max = value; calls.push({ limit: value }); return this; }
    maybeSingle() { this.single = true; return this; }
    single() { this.single = true; return this; }
    delete() { this.operation = 'delete'; return this; }
    insert(row) { this.operation = 'insert'; this.row = row; return this; }
    update(patch) { this.operation = 'update'; this.patch = patch; return this; }
    upsert(row, options = {}) { this.operation = 'upsert'; this.row = row; this.conflict = options.onConflict; return this; }
    conflict(row) {
      if (row.client_id !== null && row.client_id !== undefined) {
        return tables[this.table].some(existing => existing.owner_oid === row.owner_oid && existing.client_id === row.client_id);
      }
      if (row.reply_to !== null && row.reply_to !== undefined) {
        return tables[this.table].some(existing => existing.reply_to === row.reply_to);
      }
      return false;
    }
    then(resolve, reject) {
      try {
        if (nextError) { const error = nextError; nextError = null; return Promise.resolve({ error }).then(resolve, reject); }
        if (this.operation === 'insert') {
          if (this.conflict(this.row)) return Promise.resolve({ data: null, error: { code: '23505' } }).then(resolve, reject);
          const saved = { seq: nextSeq(this.table), created_at: new Date().toISOString(), ...this.row };
          tables[this.table].push(saved);
          return Promise.resolve({ data: this.single ? saved : null, error: null }).then(resolve, reject);
        }
        let data = tables[this.table].filter(row => this.filters.every(f => f(row)));
        for (const { field, ascending } of [...this.sorts].reverse()) data.sort((a,b) => (a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0) * (ascending ? 1 : -1));
        data = data.slice(0, this.max);
        if (this.operation === 'delete') tables[this.table] = tables[this.table].filter(row => !data.includes(row));
        if (this.operation === 'update') { for (const row of data) Object.assign(row, this.patch); return Promise.resolve({ data: this.single ? data[0] || null : data, error: null }).then(resolve, reject); }
        if (this.operation === 'upsert') {
          const key = this.conflict;
          const existing = key ? tables[this.table].find(row => row[key] === this.row[key]) : undefined;
          if (existing) Object.assign(existing, this.row);
          else tables[this.table].push({ seq: nextSeq(this.table), created_at: new Date().toISOString(), ...this.row });
          return Promise.resolve({ data: null, error: null }).then(resolve, reject);
        }
        return Promise.resolve({ data: this.single ? data[0] || null : data, error: null }).then(resolve, reject);
      } catch (error) { return Promise.reject(error).then(resolve, reject); }
    }
  }
  const client = {
    from: table => new Query(table),
    async rpc(name, { p_post: post, p_expected: expected }) {
      calls.push({ rpc: name, post, expected });
      if (nextError) { const error = nextError; nextError = null; return { error }; }
      const same = row => row.id === post.id && row.namespace === post.namespace && row.kind === post.kind && (post.kind === 'blog' || (row.owner_tid === post.owner_tid && row.owner_oid === post.owner_oid));
      for (const id of post.asset_ids) if (!tables.assets.some(a => a.id === id && a.namespace === post.namespace && a.kind === post.kind && (post.kind === 'blog' || (a.owner_tid === post.owner_tid && a.owner_oid === post.owner_oid)))) return { error: { code: '22023' } };
      const existing = tables.posts.find(same);
      if (expected !== null && (!existing || existing.version !== expected)) return { error: { code: 'P0002' } };
      if (expected === null && tables.posts.some(p => p.id === post.id)) return { error: { code: '23505' } };
      const saved = { ...post, created_at: existing?.created_at || new Date().toISOString(), updated_at: new Date().toISOString(), version: (existing?.version || 0) + 1 };
      if (existing) Object.assign(existing, saved); else tables.posts.push(saved);
      return { data: saved };
    },
    storage: { from: bucket => ({
      async upload(path, bytes, options) { calls.push({ bucket, path, options }); objects.set(path, new Blob([bytes], { type: options.contentType })); return { error: null }; },
      async download(path) { calls.push({ download: path }); return { data: objects.get(path), error: objects.has(path) ? null : { message: 'SECRET SDK ERROR' } }; },
      async remove(paths) { paths.forEach(p => objects.delete(p)); return { error: null }; },
    }) },
  };
  return { client, tables, objects, calls, failNext: error => { nextError = error; } };
}
module.exports = { mockSupabase };

const { HttpError } = require('./auth');
function failure(error) {
  if (!error) return;
  if (error.code === 'P0002' || error.code === '23505') throw new HttpError(412, 'This entry changed. Reload the current version before saving.');
  if (error.code === '22023') throw new HttpError(400, 'An image reference is not available for this entry.');
  // Never expose upstream messages, URLs, headers, or credentials.
  throw new HttpError(503, 'Content storage is unavailable or its limit was reached. Please retry later.');
}
function createStore(client, bucket) {
  function owned(query, scope) {
    query = query.eq('namespace', scope.namespace).eq('kind', scope.kind);
    if (scope.kind === 'journal') query = query.eq('owner_tid', scope.tid).eq('owner_oid', scope.oid);
    return query;
  }
  return {
    async getPost(scope, id) {
      const { data, error } = await owned(client.from('posts').select('*'), scope).eq('id', id).maybeSingle();
      failure(error); return data;
    },
    async list(scope, { limit, cursor, publicOnly }) {
      let query = owned(client.from('posts').select('*'), scope);
      if (publicOnly) query = query.eq('status', 'published');
      if (cursor) query = query.or(`created_at.lt.${cursor.date},and(created_at.eq.${cursor.date},id.lt.${cursor.id})`);
      const { data, error } = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit + 1);
      failure(error); return data;
    },
    async save(scope, post, expected) {
      const { data, error } = await client.rpc('save_content_post', { p_post: { ...post, namespace: scope.namespace, kind: scope.kind, owner_tid: scope.tid, owner_oid: scope.oid }, p_expected: expected });
      failure(error); return data;
    },
    async remove(scope, id, expected) {
      const { data, error } = await owned(client.from('posts').delete(), scope).eq('id', id).eq('version', expected).select('id');
      failure(error); if (!data?.length) throw new HttpError(412, 'This entry changed. Reload the current version before deleting.');
    },
    async getAsset(scope, id) {
      const { data, error } = await owned(client.from('assets').select('*'), scope).eq('id', id).maybeSingle();
      failure(error); return data;
    },
    async publicReference(id) {
      const { data, error } = await client.from('posts').select('id').eq('namespace', 'blog').eq('kind', 'blog').eq('status', 'published').contains('asset_ids', [id]).limit(1);
      failure(error); return !!data?.length;
    },
    async upload(asset, bytes) {
      const storage = client.storage.from(bucket);
      const { error: uploadError } = await storage.upload(asset.storage_path, bytes, { contentType: asset.mime, upsert: false });
      failure(uploadError);
      const { error } = await client.from('assets').insert(asset);
      if (error) { await storage.remove([asset.storage_path]); failure(error); }
    },
    async download(asset) {
      const { data, error } = await client.storage.from(bucket).download(asset.storage_path);
      failure(error); return data;
    },
  };
}
module.exports = { createStore };

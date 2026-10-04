/* Shared strict document schema, also packaged verbatim in the standalone API. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_BODY = 200000;
function safeLink(value) {
  if (typeof value !== 'string' || value.length > 2048 || /\s/.test(value) || [...value].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) return false;
  try { const url = new URL(value); return ['https:', 'http:', 'mailto:'].includes(url.protocol); } catch { return false; }
}
function keys(object, allowed) {
  if (!object || typeof object !== 'object' || Array.isArray(object) || Object.keys(object).some(k => !allowed.includes(k))) throw new Error('Unsupported document field');
}
function validateDocument(doc) {
  if (JSON.stringify(doc)?.length > MAX_BODY) throw new Error('Document too large');
  let count = 0;
  const assets = new Set();
  function visit(node, depth, parent) {
    if (++count > 3000 || depth > 20) throw new Error('Document too complex');
    keys(node, ['type', 'attrs', 'content', 'text', 'marks']);
    const type = node.type;
    const children = node.content;
    const allowed = {
      doc: ['paragraph', 'heading', 'bulletList', 'orderedList'],
      paragraph: ['text', 'hardBreak', 'image'], heading: ['text', 'hardBreak', 'image'],
      bulletList: ['listItem'], orderedList: ['listItem'],
      listItem: ['paragraph', 'bulletList', 'orderedList'],
      text: [], hardBreak: [], image: [],
    };
    if (!Object.prototype.hasOwnProperty.call(allowed, type) || (parent && !allowed[parent].includes(type))) throw new Error('Unsupported node');
    if (type === 'doc' && parent) throw new Error('Nested document');
    if (type === 'text') {
      if (typeof node.text !== 'string' || !node.text.length || node.text.length > MAX_BODY) throw new Error('Invalid text');
    } else if (node.text !== undefined) throw new Error('Unexpected text');
    if (['text', 'hardBreak', 'image'].includes(type)) {
      if (children !== undefined) throw new Error('Unexpected children');
    } else {
      if ((children !== undefined && !Array.isArray(children)) || ((type === 'doc' || type === 'listItem' || type.endsWith('List')) && !children?.length)) throw new Error('Invalid children');
      if (type === 'listItem' && children?.[0]?.type !== 'paragraph') throw new Error('Invalid list');
      (children || []).forEach(child => visit(child, depth + 1, type));
    }
    if (type === 'heading') { keys(node.attrs, ['level']); if (![1, 2, 3].includes(node.attrs.level)) throw new Error('Invalid heading'); }
    else if (type === 'orderedList' && node.attrs !== undefined) { keys(node.attrs, ['start', 'type']); if (node.attrs.type != null || !Number.isInteger(node.attrs.start) || node.attrs.start < 1 || node.attrs.start > 10000) throw new Error('Invalid list start'); }
    else if (type === 'image') {
      keys(node.attrs, ['assetId', 'alt']);
      if (!UUID.test(node.attrs.assetId || '') || typeof node.attrs.alt !== 'string' || node.attrs.alt.length > 500) throw new Error('Invalid image');
      assets.add(node.attrs.assetId);
    } else if (node.attrs !== undefined) throw new Error('Unexpected attributes');
    if (node.marks !== undefined) {
      if (type !== 'text' || !Array.isArray(node.marks) || node.marks.length > 4) throw new Error('Invalid marks');
      const marks = new Set();
      for (const mark of node.marks) {
        keys(mark, ['type', 'attrs']);
        if (marks.has(mark.type)) throw new Error('Duplicate mark');
        marks.add(mark.type);
        if (mark.type === 'link') {
          keys(mark.attrs, ['href', 'target', 'rel', 'class']);
          if (!safeLink(mark.attrs.href) || (mark.attrs.target != null && mark.attrs.target !== '_blank') || (mark.attrs.rel != null && mark.attrs.rel !== 'noopener noreferrer nofollow') || mark.attrs.class != null) throw new Error('Unsafe link');
        } else if (!['bold', 'italic', 'underline'].includes(mark.type) || mark.attrs !== undefined) throw new Error('Unsupported mark');
      }
    }
  }
  if (doc?.type !== 'doc') throw new Error('Document required');
  visit(doc, 0, null);
  return [...assets];
}
function validatePost(input, kind) {
  keys(input, ['title', 'document', 'status']);
  if (typeof input.title !== 'string' || !input.title.trim() || input.title.length > 200) throw new Error('Title must be 1–200 characters');
  if (!(kind === 'blog' ? ['draft', 'published'] : ['private']).includes(input.status)) throw new Error('Invalid status');
  return { title: input.title.trim(), document: input.document, status: input.status, asset_ids: validateDocument(input.document) };
}
module.exports = { UUID, MAX_BODY, safeLink, validateDocument, validatePost };

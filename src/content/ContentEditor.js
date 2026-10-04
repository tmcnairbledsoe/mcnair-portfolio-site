import React, { useCallback, useRef, useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { useEditor, EditorContent, ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { AssetImage } from './DocumentView';
import DocumentView from './DocumentView';
import { safeLink, validatePost } from './schema';

export const emptyDocument = { type: 'doc', content: [{ type: 'paragraph', content: [] }] };
const Asset = Node.create({
  name: 'image', group: 'inline', inline: true, atom: true, marks: '', draggable: true,
  addAttributes() { return { assetId: { default: null }, alt: { default: '' } }; },
  // External/pasted HTML images are deliberately never converted into assets.
  parseHTML() { return []; },
  renderHTML({ HTMLAttributes }) { return ['span', mergeAttributes({ 'data-asset': true }, HTMLAttributes)]; },
  addNodeView() { return ReactNodeViewRenderer(({ node }) => <NodeViewWrapper as="span" style={{ whiteSpace: undefined }}><AssetImage {...node.attrs} /></NodeViewWrapper>); },
});
export function editorExtensions() {
  return [StarterKit.configure({ heading: { levels: [1, 2, 3] }, blockquote: false, codeBlock: false, horizontalRule: false, code: false, strike: false }), Underline,
    Link.configure({ openOnClick: false, autolink: false, linkOnPaste: false, protocols: ['http', 'https', 'mailto'], isAllowedUri: safeLink }), Asset];
}
export default function ContentEditor({ initial, kind, upload, save, cancel, busy, conflict, reload }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [document, setDocument] = useState(initial?.document || emptyDocument);
  const [preview, setPreview] = useState(false);
  const [alt, setAlt] = useState('');
  const [href, setHref] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const active = useRef(true);
  const uploadBusy = useRef(false);
  React.useLayoutEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const editor = useEditor({ injectCSS: false, extensions: editorExtensions(), content: initial?.document || emptyDocument,
    editorProps: { attributes: { 'aria-label': 'Entry body', role: 'textbox', 'aria-multiline': 'true' } },
    onUpdate: ({ editor }) => setDocument(editor.getJSON()),
  });
  const insertImages = useCallback(async files => {
    if (!editor || busy || uploadBusy.current) return;
    uploadBusy.current = true; setUploading(true); setError('');
    try {
      for (const file of files) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024 || !file.size) throw new Error('Choose JPEG, PNG, or WebP images up to 5 MB.');
        const { assetId } = await upload(file);
        if (!active.current || editor.isDestroyed) return;
        editor.chain().focus().insertContent({ type: 'image', attrs: { assetId, alt } }).run();
      }
    } catch (failure) { if (active.current) setError(failure.message); }
    finally { uploadBusy.current = false; if (active.current) setUploading(false); }
  }, [editor, upload, alt, busy]);
  function submit(status) {
    try {
      const post = { title, document: editor.getJSON(), status };
      validatePost(post, kind); setError(''); save(post);
    } catch (failure) { setError(failure.message); }
  }
  const disabled = busy || uploading;
  React.useEffect(() => { editor?.setEditable(!disabled); }, [editor, disabled]);
  if (!editor) return <p>Preparing editor…</p>;
  return <section className="content-editor" aria-label="Entry editor">
    <label>Title<input maxLength={200} value={title} onChange={e => setTitle(e.target.value)} disabled={disabled} /></label>
    <div className="editor-toolbar" role="toolbar" aria-label="Text formatting">
      {['bold', 'italic', 'underline'].map(mark => <button key={mark} disabled={disabled} aria-pressed={editor.isActive(mark)} onClick={() => editor.chain().focus()[`toggle${mark[0].toUpperCase()}${mark.slice(1)}`]().run()}>{mark[0].toUpperCase() + mark.slice(1)}</button>)}
      {[1, 2, 3].map(level => <button key={level} disabled={disabled} aria-pressed={editor.isActive('heading', { level })} onClick={() => editor.chain().focus().toggleHeading({ level }).run()}>Heading {level}</button>)}
      <button disabled={disabled} onClick={() => editor.chain().focus().toggleBulletList().run()}>Bullet list</button>
      <button disabled={disabled} onClick={() => editor.chain().focus().toggleOrderedList().run()}>Numbered list</button>
      <button disabled={disabled || !editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>Undo</button>
      <button disabled={disabled || !editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>Redo</button>
    </div>
    <div className="editor-toolbar">
      <label>Link URL<input value={href} onChange={e => setHref(e.target.value)} disabled={disabled} /></label>
      <button disabled={disabled} onClick={() => { if (!safeLink(href)) { setError('Use an http, https, or mailto link.'); return; } editor.chain().focus().extendMarkRange('link').setLink({ href }).run(); setError(''); }}>Apply link to selection</button>
      <button disabled={disabled} onClick={() => editor.chain().focus().unsetLink().run()}>Remove link</button>
    </div>
    <div className="editor-drop" onDragOver={e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }} onDrop={e => { if (e.dataTransfer.files.length) { e.preventDefault(); insertImages(Array.from(e.dataTransfer.files)); } }}>
      <EditorContent editor={editor} />
    </div>
    <label>Image alt text (blank for decorative images)<input maxLength={500} value={alt} onChange={e => setAlt(e.target.value)} disabled={disabled} /></label>
    <label>Insert images<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled} onChange={e => { insertImages(Array.from(e.target.files)); e.target.value = ''; }} /></label>
    {uploading && <p role="status">Uploading image…</p>}
    <p>Images can also be dropped into the editor. Select an image to replace its alt text.</p>
    <button disabled={disabled || !editor.isActive('image')} onClick={() => editor.chain().focus().updateAttributes('image', { alt }).run()}>Update selected image alt text</button>
    <div className="editor-toolbar">
      <button disabled={disabled} onClick={() => setPreview(!preview)}>{preview ? 'Hide preview' : 'Preview'}</button>
      {kind === 'blog' ? <><button disabled={disabled || conflict} onClick={() => submit('published')}>{initial?.status === 'published' ? 'Save published post' : 'Publish post'}</button><button disabled={disabled || conflict} onClick={() => submit('draft')}>{initial?.status === 'published' ? 'Unpublish and save draft' : 'Save private draft'}</button></> : <button disabled={disabled || conflict} onClick={() => submit('private')}>Save entry</button>}
      <button disabled={disabled} onClick={cancel}>Cancel</button>
    </div>
    {kind === 'blog' && <p>Publish post makes this visible to everyone, including signed-out visitors. Private drafts are visible only to you.</p>}
    {conflict && <button onClick={reload} disabled={disabled}>Reload current version (discard edits)</button>}
    {error && <p role="alert">{error}</p>}
    {preview && <section aria-label="Entry preview"><h2>{title}</h2><DocumentView document={document} /></section>}
  </section>;
}

import React from 'react';
import { Editor } from '@tiptap/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ContentEditor, { editorExtensions } from './ContentEditor';
import { validateDocument } from './schema';
import DocumentView from './DocumentView';

const assetId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const initial = { title: 'Hello', document: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }] }, status: 'draft' };
beforeEach(() => { global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 }); });
afterEach(() => { delete global.fetch; });
beforeAll(() => {
  if (!Range.prototype.getBoundingClientRect) Range.prototype.getBoundingClientRect = () => ({ top:0, bottom:0, left:0, right:0, width:0, height:0 });
  if (!Range.prototype.getClientRects) Range.prototype.getClientRects = () => [];
});
test('real Tiptap commands format text, headings, lists, links, undo/redo, images and schema-compatible JSON', () => {
  const editor = new Editor({ extensions: editorExtensions(), content: initial.document });
  editor.commands.selectAll(); editor.commands.toggleBold(); editor.commands.toggleItalic(); editor.commands.toggleUnderline();
  let text = editor.getJSON().content[0].content[0];
  expect(text.marks.map(m => m.type)).toEqual(expect.arrayContaining(['bold', 'italic', 'underline']));
  editor.commands.setLink({ href: 'https://example.com' });
  expect(validateDocument(editor.getJSON())).toEqual([]);
  editor.commands.toggleHeading({ level: 2 }); expect(editor.getJSON().content[0].type).toBe('heading');
  editor.commands.toggleHeading({ level: 2 }); editor.commands.toggleBulletList(); expect(editor.getJSON().content[0].type).toBe('bulletList');
  expect(validateDocument(editor.getJSON())).toEqual([]);
  editor.commands.toggleBulletList(); editor.commands.toggleOrderedList(); expect(editor.getJSON().content[0].type).toBe('orderedList');
  editor.commands.undo(); editor.commands.redo(); expect(validateDocument(editor.getJSON())).toEqual([]);
  editor.commands.setContent({ type:'doc',content:[{type:'paragraph'}] });
  editor.commands.insertContent({type:'image',attrs:{assetId,alt:'Portrait'}});
  expect(validateDocument(editor.getJSON())).toEqual([assetId]);
  expect(JSON.stringify(editor.getJSON())).not.toContain('blob:');
  editor.destroy();
});
test('real editor UI previews safely and saves distinct draft/published documents, cancel, invalid links', async () => {
  const save = jest.fn(), cancel = jest.fn();
  render(<ContentEditor initial={initial} kind="blog" save={save} cancel={cancel} upload={jest.fn()} />);
  expect(await screen.findByRole('textbox',{name:'Entry body'})).toHaveAttribute('contenteditable','true');
  fireEvent.click(screen.getByRole('button',{name:'Preview'})); expect(screen.getByRole('region',{name:'Entry preview'})).toHaveTextContent('Hello world');
  fireEvent.click(screen.getByRole('button',{name:'Save private draft'})); expect(save).toHaveBeenLastCalledWith(expect.objectContaining({status:'draft',title:'Hello'}));
  fireEvent.click(screen.getByRole('button',{name:'Publish post',exact:true})); expect(save).toHaveBeenLastCalledWith(expect.objectContaining({status:'published'}));
  expect(screen.getByText(/Private drafts are visible only to you/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Link URL'),{target:{value:'javascript:alert(1)'}});
  fireEvent.click(screen.getByRole('button',{name:'Apply link to selection'})); expect(screen.getByRole('alert')).toHaveTextContent(/http, https/);
  fireEvent.click(screen.getByRole('button',{name:'Cancel'})); expect(cancel).toHaveBeenCalled();
});
test('picker and drop insert only server-issued asset IDs with alt text; invalid image rejected, journal has no publishing controls', async () => {
  const upload = jest.fn().mockResolvedValue({assetId}), save = jest.fn();
  render(<ContentEditor initial={initial} kind="journal" upload={upload} save={save} cancel={jest.fn()} />);
  fireEvent.change(screen.getByLabelText(/Image alt text/),{target:{value:'Portrait'}});
  const file = new File(['raster'],'photo.png',{type:'image/png'});
  fireEvent.change(screen.getByLabelText('Insert images'),{target:{files:[file]}});
  await waitFor(() => expect(screen.queryByText('Uploading image…')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button',{name:'Save entry'}));
  let nodes = save.mock.calls[0][0].document.content[0].content;
  expect(nodes).toContainEqual({type:'image',attrs:{assetId,alt:'Portrait'}});
  fireEvent.drop(screen.getByRole('textbox',{name:'Entry body'}).parentElement,{dataTransfer:{files:[file],types:['Files']}});
  await waitFor(() => expect(upload).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByText('Uploading image…')).not.toBeInTheDocument());
  fireEvent.change(screen.getByLabelText('Insert images'),{target:{files:[new File(['<svg/>'],'bad.svg',{type:'image/svg+xml'})]}});
  expect(await screen.findByRole('alert')).toHaveTextContent(/JPEG, PNG, or WebP/);
  expect(screen.queryByRole('button',{name:'Publish'})).not.toBeInTheDocument();
});
test('safe React renderer escapes text and rejects arbitrary image source or unsafe protocol', () => {
  const document = {...initial.document,content:[{type:'paragraph',content:[{type:'text',text:'<script>alert(1)</script>'}]}]};
  const view=render(<DocumentView document={document} />);
  expect(view.container.querySelector('script')).toBeNull(); expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
  view.rerender(<DocumentView document={{type:'doc',content:[{type:'image',attrs:{assetId,alt:'x',src:'https://evil'}}]}} />);
  expect(screen.getByRole('alert')).toHaveTextContent('unsupported format'); expect(view.container.querySelector('img')).toBeNull();
});

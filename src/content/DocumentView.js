import React, { createContext, useContext, useLayoutEffect, useState } from 'react';
import { request } from './client';
import { validateDocument, safeLink } from './schema';

export const MediaContext = createContext({ kind: 'blog', token: null, signal: undefined });
export function AssetImage({ assetId, alt }) {
  const { kind, token, signal } = useContext(MediaContext);
  const [image, setImage] = useState(null);
  const [failed, setFailed] = useState(false);
  useLayoutEffect(() => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener('abort', abort);
    let url;
    setImage(null); setFailed(false);
    request(`media/${kind}/${assetId}`, { token, signal: controller.signal, binary: true }).then(blob => {
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(blob); setImage(url);
    }).catch(error => { if (error.name !== 'AbortError' && !controller.signal.aborted) setFailed(true); });
    return () => { controller.abort(); signal?.removeEventListener('abort', abort); if (url) URL.revokeObjectURL(url); };
  }, [assetId, kind, token, signal]);
  return image ? <img src={image} alt={alt} /> : <span role="img" aria-label={alt || 'Image'}>{failed ? 'Image unavailable. Reopen the entry to retry.' : 'Loading image…'}</span>;
}
export default function DocumentView({ document }) {
  try { validateDocument(document); } catch { return <p role="alert">This document uses an unsupported format.</p>; }
  function node(value, index) {
    const content = value.content?.map(node);
    if (value.type === 'text') {
      let text = value.text;
      for (const mark of value.marks || []) {
        if (mark.type === 'link' && safeLink(mark.attrs.href)) text = <a href={mark.attrs.href} target="_blank" rel="noopener noreferrer nofollow">{text}</a>;
        else if (mark.type === 'bold') text = <strong>{text}</strong>;
        else if (mark.type === 'italic') text = <em>{text}</em>;
        else if (mark.type === 'underline') text = <u>{text}</u>;
      }
      return <React.Fragment key={index}>{text}</React.Fragment>;
    }
    if (value.type === 'image') return <AssetImage key={index} {...value.attrs} />;
    if (value.type === 'hardBreak') return <br key={index} />;
    if (value.type === 'doc') return <React.Fragment key={index}>{content}</React.Fragment>;
    const tag = { paragraph: 'p', bulletList: 'ul', orderedList: 'ol', listItem: 'li', heading: `h${value.attrs?.level}` }[value.type];
    return React.createElement(tag, { key: index, ...(value.type === 'orderedList' ? { start: value.attrs?.start } : {}) }, content);
  }
  return <div className="content-document">{node(document, 0)}</div>;
}

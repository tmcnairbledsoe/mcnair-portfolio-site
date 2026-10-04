export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export async function request(path, { token, signal, body, version, method = 'GET', binary = false } = {}) {
  const headers = {};
  if (token) {
    const value = await token();
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    headers['X-Portfolio-Authorization'] = `Bearer ${value}`;
  }
  if (version !== undefined) headers['If-Match'] = `"${version}"`;
  if (body instanceof Blob) headers['Content-Type'] = body.type;
  else if (body !== undefined) headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetch(`/api/${path}`, { method, headers, signal, cache: 'no-store', credentials: 'same-origin', body: body instanceof Blob ? body : body === undefined ? undefined : JSON.stringify(body) });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Could not reach the content service. Please retry.');
  }
  if (!response.ok) {
    // Do not display arbitrary upstream content, HTML error pages, or SDK errors.
    const message = response.status === 401 ? 'Your API session needs sign-in again.'
      : response.status === 403 ? 'Only the owner can change blog posts.'
      : [409, 412].includes(response.status) ? 'This entry changed elsewhere. Your edits are still here. Reload the current version before trying again.'
      : response.status === 413 ? 'Choose an image under 5 MB or shorten the document.'
      : response.status === 400 ? 'Check the title, document, and image file type, then retry.'
      : response.status === 404 ? 'This entry or image is no longer available.'
      : 'Content storage is unavailable or its limit was reached. Please retry later.';
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) return null;
  return binary ? response.blob() : response.json();
}

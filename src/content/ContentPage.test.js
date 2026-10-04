import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ContentPage from './ContentPage';
import { useContentSession } from '../auth/ContentSession';
import { AssetImage, MediaContext } from './DocumentView';

jest.mock('../auth/ContentSession', () => ({ useContentSession: jest.fn() }));
let session;
const doc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Only account A'}]}]};
const post={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',title:'Private A',document:doc,status:'private',version:1,createdAt:'2026-01-01T00:00:00Z'};
function response(data,status=200){return {ok:status<400,status,json:async()=>data,blob:async()=>new Blob(['x'],{type:'image/png'})};}
function view(kind){return <MemoryRouter><ContentPage kind={kind} /></MemoryRouter>;}
beforeEach(()=>{
  session={account:null,accountKey:'public',ready:true,journalAllowed:true,signIn:jest.fn().mockResolvedValue(),token:jest.fn().mockResolvedValue('API_ACCESS_TOKEN')};
  useContentSession.mockImplementation(()=>session);
  global.fetch=jest.fn().mockResolvedValue(response({items:[],cursor:null,canWrite:false}));
  window.confirm=jest.fn().mockReturnValue(true);
});
afterEach(()=>{delete global.fetch;});

test('no-role accounts cannot open or fetch journals but can read published blog posts',async()=>{
  session={...session,account:{homeAccountId:'A'},accountKey:'A',journalAllowed:false};
  const page=render(view('journal'));
  expect(screen.getByText(/Journal access requires an Owner/)).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'New entry'})).not.toBeInTheDocument();
  fetch.mockResolvedValue(response({items:[{...post,title:'Public post',status:'published'}],canWrite:false,cursor:null}));
  page.rerender(view('blog'));
  expect(await screen.findByText('Public post')).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Edit'})).not.toBeInTheDocument();
});

test('losing the journal role clears existing private content for the same account',async()=>{
  session={...session,account:{homeAccountId:'A'},accountKey:'A',journalAllowed:true};
  fetch.mockResolvedValue(response({items:[post],canWrite:true,cursor:null}));
  const page=render(view('journal'));expect(await screen.findByText('Private A')).toBeInTheDocument();
  session={...session,journalAllowed:false};page.rerender(view('journal'));
  expect(screen.queryByText('Private A')).not.toBeInTheDocument();expect(screen.queryByText('Only account A')).not.toBeInTheDocument();
  expect(screen.getByText(/Journal access requires an Owner/)).toBeInTheDocument();
});
test('signed-out journal gates sign in and performs no private fetch; public blog fetches without bearer and no owner controls',async()=>{
  const page=render(view('journal'));
  expect(screen.getByText(/Sign in with Microsoft to open/)).toBeInTheDocument();expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Sign in with Microsoft'}));expect(session.signIn).toHaveBeenCalled();
  page.rerender(view('blog'));
  expect(await screen.findByText('No published posts yet.')).toBeInTheDocument();expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();expect(screen.queryByRole('button',{name:'New blog post'})).not.toBeInTheDocument();
});
test('role-bearing account has own journal editor without publish switch; owner controls derive from API capability',async()=>{
  session={...session,account:{homeAccountId:'A'},accountKey:'A'};
  fetch.mockResolvedValue(response({items:[],cursor:null,canWrite:true}));
  const page=render(view('journal'));
  fireEvent.click(await screen.findByRole('button',{name:'New entry'}));
  expect(await screen.findByRole('textbox',{name:'Title'})).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Publish'})).not.toBeInTheDocument();
  expect(fetch.mock.calls[0][1].headers['X-Portfolio-Authorization']).toBe('Bearer API_ACCESS_TOKEN');
  expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
  page.rerender(view('blog'));expect(await screen.findByRole('button',{name:'New blog post'})).toBeInTheDocument();
});
test('account switch synchronously removes previous entries/editor and aborts pending fetches; late response cannot leak',async()=>{
  session={...session,account:{homeAccountId:'A'},accountKey:'A'};
  fetch.mockResolvedValueOnce(response({items:[post],cursor:null,canWrite:true})).mockResolvedValueOnce(response(post));
  const page=render(view('journal'));expect(await screen.findByText('Private A')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Edit'}));expect(await screen.findByDisplayValue('Private A')).toBeInTheDocument();
  session={...session,account:{homeAccountId:'B'},accountKey:'B'};
  let resolve;fetch.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
  page.rerender(view('journal'));expect(screen.queryByDisplayValue('Private A')).not.toBeInTheDocument();expect(screen.queryByText('Only account A')).not.toBeInTheDocument();
  await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(3));const pending=fetch.mock.calls[2][1].signal;
  session={...session,account:null,accountKey:'public'};page.rerender(view('journal'));expect(pending.aborted).toBe(true);
  await act(async()=>resolve(response({items:[post],canWrite:true,cursor:null})));
  expect(screen.queryByText('Private A')).not.toBeInTheDocument();expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});
test('conflict keeps edits, disables overwrite, and reloads with confirmation; publish/unpublish save correct versions',async()=>{
  session={...session,account:{homeAccountId:'A'},accountKey:'A'};
  const draft={...post,status:'draft'};
  fetch.mockResolvedValueOnce(response({items:[draft],cursor:null,canWrite:true})).mockResolvedValueOnce(response(draft)).mockResolvedValueOnce(response({},412));
  render(view('blog'));fireEvent.click(await screen.findByRole('button',{name:'Edit'}));
  const title=await screen.findByDisplayValue('Private A');fireEvent.change(title,{target:{value:'My unsaved title'}});
  fireEvent.click(screen.getByRole('button',{name:'Publish post',exact:true}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Your edits are still here');expect(screen.getByDisplayValue('My unsaved title')).toBeInTheDocument();expect(screen.getByRole('button',{name:'Publish post',exact:true})).toBeDisabled();
  expect(fetch.mock.calls[2][1].headers['If-Match']).toBe('"1"');expect(JSON.parse(fetch.mock.calls[2][1].body).status).toBe('published');
  fetch.mockResolvedValueOnce(response({...draft,title:'Current',version:2,status:'published'}));
  fireEvent.click(screen.getByRole('button',{name:/Reload current version/}));expect(await screen.findByDisplayValue('Current')).toBeInTheDocument();expect(window.confirm).toHaveBeenCalled();
  fetch.mockResolvedValueOnce(response({...draft,version:3})).mockResolvedValueOnce(response({items:[],cursor:null,canWrite:true}));
  fireEvent.click(screen.getByRole('button',{name:'Unpublish and save draft'}));
  await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(6));expect(fetch.mock.calls[4][1].headers['If-Match']).toBe('"2"');expect(JSON.parse(fetch.mock.calls[4][1].body).status).toBe('draft');
});
test('API token interaction error gives explicit recovery without fetching or auto redirect, delete confirms',async()=>{
  session={...session,account:{homeAccountId:'A'},accountKey:'A',token:jest.fn().mockRejectedValue(new Error('Your API session needs sign-in again.'))};
  const page=render(view('journal'));expect(await screen.findByRole('alert')).toHaveTextContent('sign-in again');expect(fetch).not.toHaveBeenCalled();expect(session.signIn).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Sign in again'}));expect(session.signIn).toHaveBeenCalled();
  session={...session,token:jest.fn().mockResolvedValue('API_ACCESS_TOKEN')};fetch.mockResolvedValueOnce(response({items:[post],cursor:null,canWrite:true})).mockResolvedValueOnce(response(null,204));page.rerender(view('journal'));
  fireEvent.click(await screen.findByRole('button',{name:'Delete'}));await waitFor(()=>expect(screen.queryByText('Private A')).not.toBeInTheDocument());expect(window.confirm).toHaveBeenCalled();
});
test('private media uses bearer fetch and object URLs, aborts and revokes on unmount',async()=>{
  URL.createObjectURL=jest.fn().mockReturnValue('blob:private');URL.revokeObjectURL=jest.fn();
  const token=jest.fn().mockResolvedValue('PRIVATE_ACCESS_TOKEN');
  fetch.mockResolvedValue(response(null));
  const page=render(<MediaContext.Provider value={{kind:'journal',token}}><AssetImage assetId={post.id} alt="Private photo" /></MediaContext.Provider>);
  expect(await screen.findByRole('img',{name:'Private photo'})).toBeInTheDocument();await waitFor(()=>expect(URL.createObjectURL).toHaveBeenCalled());
  expect(screen.getByRole('img',{name:'Private photo'})).toHaveAttribute('src','blob:private');expect(fetch.mock.calls[0][1].headers['X-Portfolio-Authorization']).toBe('Bearer PRIVATE_ACCESS_TOKEN');
  const signal=fetch.mock.calls[0][1].signal;page.unmount();expect(signal.aborted).toBe(true);expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private');
});
test('creating an entry waits for database success, then refreshes persisted content; nonOwner blog hides writes',async()=>{
  session={...session,account:{homeAccountId:'A'},accountKey:'A'};
  fetch.mockResolvedValueOnce(response({items:[],cursor:null,canWrite:true}));
  const page=render(view('journal'));fireEvent.click(await screen.findByRole('button',{name:'New entry'}));
  fireEvent.change(await screen.findByRole('textbox',{name:'Title'}),{target:{value:'New persisted entry'}});
  let resolve;fetch.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
  fireEvent.click(screen.getByRole('button',{name:'Save entry'}));
  await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(2));expect(screen.getByDisplayValue('New persisted entry')).toBeInTheDocument();
  expect(fetch.mock.calls[1][1].method).toBe('POST');expect(JSON.parse(fetch.mock.calls[1][1].body).status).toBe('private');expect(fetch.mock.calls[1][1].headers['If-Match']).toBeUndefined();
  const saved={...post,title:'New persisted entry'};fetch.mockResolvedValueOnce(response({items:[saved],cursor:null,canWrite:true}));
  await act(async()=>resolve(response(saved,201)));expect(await screen.findByRole('heading',{name:'New persisted entry'})).toBeInTheDocument();expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  fetch.mockResolvedValueOnce(response({items:[{...post,status:'published'}],cursor:null,canWrite:false}));page.rerender(view('blog'));
  expect(await screen.findByText('Only account A')).toBeInTheDocument();expect(screen.queryByRole('button',{name:'New blog post'})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Edit'})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Delete'})).not.toBeInTheDocument();
});

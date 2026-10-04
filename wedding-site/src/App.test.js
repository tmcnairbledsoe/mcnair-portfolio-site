import {render, screen, fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';
beforeEach(() => { sessionStorage.clear(); jest.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());
function enter(role = 'guest', couple = false) {
  fireEvent.change(screen.getByLabelText('Username'), {target:{value:'Test guest'}});
  fireEvent.click(screen.getByRole('button', {name:/Log in/}));
  fireEvent.change(screen.getByLabelText('Your role'), {target:{value:role}});
  if (couple) fireEvent.click(screen.getByLabelText('We are attending as a couple'));
  fireEvent.click(screen.getByRole('button', {name:/View wedding website/}));
}
test('any nonempty username can log in and choose the guest layout', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', {name:/Log in/}));
  expect(screen.getByRole('alert')).toHaveTextContent('Please enter a username');
  enter();
  expect(screen.getByRole('heading', {name:'Welcome, Test guest'})).toBeInTheDocument();
  expect(screen.getByRole('region', {name:'Wedding schedule'})).toBeInTheDocument();
  expect(screen.queryByRole('region', {name:'Rehearsal schedule'})).not.toBeInTheDocument();
  expect(screen.queryByRole('region', {name:'Brunch schedule'})).not.toBeInTheDocument();
  expect(screen.queryByText(/Groomsmen meet at Top Golf/)).not.toBeInTheDocument();
});
test.each([
  ['party', true, true, true], ['rehearsal',true,false,false], ['brunch',false,true,false]
])('%s selects the corresponding schedule and map', (role, rehearsal, brunch, party) => {
  render(<App />); enter(role);
  expect(Boolean(screen.queryByRole('region', {name:'Rehearsal schedule'}))).toBe(rehearsal);
  expect(Boolean(screen.queryByRole('region', {name:'Brunch schedule'}))).toBe(brunch);
  expect(Boolean(screen.queryByText(/Groomsmen meet at Top Golf/))).toBe(party);
  expect(screen.getByRole('img', {name: rehearsal ? 'Wedding and rehearsal event map' : 'Wedding event map'})).toHaveAttribute('src',expect.stringContaining(rehearsal ? 'Rehearsal Dinner.jpg' : 'Wedding.jpg'));
});
test('role switching updates layout and survives reload; sign out restores login', () => {
  const view = render(<App />); enter('party');
  fireEvent.click(screen.getByRole('button',{name:'Change role'}));
  fireEvent.change(screen.getByLabelText('Your role'),{target:{value:'guest'}});
  fireEvent.click(screen.getByRole('button',{name:/View wedding website/}));
  expect(screen.queryByRole('region',{name:'Rehearsal schedule'})).not.toBeInTheDocument();
  view.unmount(); render(<App />);
  expect(screen.getByRole('heading',{name:'Welcome, Test guest'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Sign out'}));
  expect(screen.getByLabelText('Username')).toBeInTheDocument();
  expect(sessionStorage.getItem('wedding-user')).toBeNull();
});
test('couples have no plus-one field and RSVP saves locally', () => {
  const view = render(<App />); enter('guest',true);
  expect(screen.queryByLabelText('Are you bringing a plus-one?')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Any song requests?'),{target:{value:'Perfect Day'}});
  fireEvent.click(screen.getByRole('button',{name:'Save RSVP'}));
  expect(screen.getByRole('status')).toHaveTextContent('saved in this browser tab');
  view.unmount(); render(<App />);
  expect(screen.getByLabelText('Any song requests?')).toHaveValue('Perfect Day');
});
test('invitation checkboxes can combine rehearsal and brunch for a wedding guest', () => {
  render(<App />);
  fireEvent.change(screen.getByLabelText('Username'),{target:{value:'Another guest'}});
  fireEvent.click(screen.getByRole('button',{name:/Log in/}));
  fireEvent.click(screen.getByLabelText('Rehearsal dinner'));
  fireEvent.click(screen.getByLabelText('Sunday brunch'));
  fireEvent.click(screen.getByRole('button',{name:/View wedding website/}));
  expect(screen.getByRole('region',{name:'Rehearsal schedule'})).toBeInTheDocument();
  expect(screen.getByRole('region',{name:'Brunch schedule'})).toBeInTheDocument();
});
test('switching to a couple clears previously saved plus-one details', () => {
  render(<App />); enter();
  fireEvent.change(screen.getByLabelText('Are you bringing a plus-one?'),{target:{value:'true'}});
  fireEvent.change(screen.getByLabelText('Guest full name'),{target:{value:'Plus one'}});
  fireEvent.click(screen.getByRole('button',{name:'Save RSVP'}));
  fireEvent.click(screen.getByRole('button',{name:'Change role'}));
  fireEvent.click(screen.getByLabelText('We are attending as a couple'));
  fireEvent.click(screen.getByRole('button',{name:/View wedding website/}));
  fireEvent.click(screen.getByRole('button',{name:'Save RSVP'}));
  const saved = JSON.parse(sessionStorage.getItem('wedding-rsvp:Test guest'));
  expect(saved.plusOne).toBe(false);
  expect(saved.guestName).toBe('');
});

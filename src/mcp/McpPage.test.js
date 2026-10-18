import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConnectionGuide } from './McpPage';

const token = `test.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;
const session = { account: {}, journalAllowed: true, ready: true, token: jest.fn(async () => token), signIn: jest.fn(async () => {}) };
beforeEach(() => { jest.clearAllMocks(); session.token.mockResolvedValue(token); session.signIn.mockResolvedValue(undefined); global.fetch = jest.fn(); });
afterEach(() => { delete global.fetch; });
test('signed-out and ineligible visitors cannot obtain credentials or see configuration', () => {
  const { rerender } = render(<ConnectionGuide session={{ ...session, account: null }} />);
  expect(screen.queryByRole('button', { name: /get token/i })).not.toBeInTheDocument();
  rerender(<ConnectionGuide session={{ ...session, journalAllowed: false }} />);
  expect(screen.getByText(/does not have an eligible role/)).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});
test('verifies the complete connection before offering token; hides and clears it explicitly', async () => {
  fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ result: { protocolVersion: '2025-11-25' } }) })
    .mockResolvedValueOnce({ ok: true, status: 202 })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ result: { tools: [] } }) });
  render(<ConnectionGuide session={session} />);
  fireEvent.click(screen.getByRole('button', { name: /get token/i }));
  expect(await screen.findByText('Connected successfully. 0 tools available.')).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(screen.queryByDisplayValue(token)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reveal token' }));
  expect(screen.getByLabelText('Access token')).toHaveValue(token);
  fireEvent.click(screen.getByRole('button', { name: 'Clear from page' }));
  expect(screen.queryByDisplayValue(token)).not.toBeInTheDocument();
});
test('backend role denial never exposes token', async () => {
  fetch.mockResolvedValue({ ok: false, status: 403 });
  render(<ConnectionGuide session={session} />);
  fireEvent.click(screen.getByRole('button', { name: /get token/i }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Access requires an Owner, Wife, or Friend role');
  expect(screen.queryByRole('button', { name: 'Copy token' })).not.toBeInTheDocument();
});
test('unmount during token acquisition prevents a private request', async () => {
  let resolve;
  const { unmount } = render(<ConnectionGuide session={{ ...session, token: () => new Promise(r => { resolve = r; }) }} />);
  fireEvent.click(screen.getByRole('button', { name: /get token/i }));
  unmount(); resolve(token);
  await waitFor(() => expect(fetch).not.toHaveBeenCalled());
});

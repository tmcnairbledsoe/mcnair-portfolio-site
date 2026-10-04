import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';
test('the recovered wedding archive shows its original content with guest forms closed', () => {
  render(<App />);
  expect(screen.getByRole('heading', {name:'Charlotte & McNair'})).toBeInTheDocument();
  expect(screen.getByText(/RSVPs and guest sign-in are closed/)).toBeInTheDocument();
  expect(screen.getByRole('link', {name:'About Us'})).toHaveAttribute('href','#aboutUs');
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

import { render, screen } from '@testing-library/react';
import App from './App';

test('renders playing card classifier title', () => {
  render(<App />);
  const titleElement = screen.getByText(/Playing Card Classifier/i);
  expect(titleElement).toBeInTheDocument();
});

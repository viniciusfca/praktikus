import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders without crashing', () => {
    const { container } = render(<App />);
    expect(container.firstChild).not.toBeNull();
  });

  it('renders the landing page on root route', () => {
    render(<App />);
    expect(screen.getByText(/Practicus/i)).toBeInTheDocument();
  });
});

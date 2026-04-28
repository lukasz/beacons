import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '../test/utils';
import userEvent from '@testing-library/user-event';
import SignIn from './SignIn';

describe('<SignIn />', () => {
  it('renders the brand and the sign-in CTA', () => {
    renderWithProviders(<SignIn onSignIn={() => {}} />);
    expect(screen.getByRole('heading', { name: /beacons/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
  });

  it('calls onSignIn when the button is clicked', async () => {
    const onSignIn = vi.fn();
    renderWithProviders(<SignIn onSignIn={onSignIn} />);
    await userEvent.click(screen.getByRole('button', { name: /sign in with google/i }));
    expect(onSignIn).toHaveBeenCalledOnce();
  });
});

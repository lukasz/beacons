import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '../test/utils';
import userEvent from '@testing-library/user-event';
import TadaLanding from './TadaLanding';

describe('<TadaLanding />', () => {
  it('renders the hero and at least one feature row', () => {
    renderWithProviders(<TadaLanding isAuthed={false} onPrimary={() => {}} />);
    expect(screen.getByRole('heading', { name: /beacons/i, level: 1 })).toBeInTheDocument();
    // FeatureTour heading
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it("CTA reads 'Sign in to get started' when signed out", () => {
    renderWithProviders(<TadaLanding isAuthed={false} onPrimary={() => {}} />);
    const buttons = screen.getAllByRole('button', { name: /sign in to get started/i });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it("CTA reads 'Go to my boards' when signed in, and fires onPrimary", async () => {
    const onPrimary = vi.fn();
    renderWithProviders(<TadaLanding isAuthed onPrimary={onPrimary} />);
    const cta = screen.getAllByRole('button', { name: /go to my boards/i })[0];
    await userEvent.click(cta);
    expect(onPrimary).toHaveBeenCalledOnce();
  });
});

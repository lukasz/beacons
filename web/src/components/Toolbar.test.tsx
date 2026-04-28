import { describe, it, expect, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import Toolbar from './Toolbar';
import { renderWithBoard, screen } from '../test/utils';
import { storage } from '../lib/storage';
import { fixtureUser } from '../test/fixtures';

beforeEach(() => {
  storage.clear('cursors');
});

describe('<Toolbar />', () => {
  it('renders the brand and current room id', () => {
    renderWithBoard(<Toolbar />, {
      state: { id: 'abcd1234', users: { u1: fixtureUser({ id: 'u1' }) } },
    });
    expect(screen.getByText('Beacons')).toBeInTheDocument();
    expect(screen.getByText('abcd1234')).toBeInTheDocument();
  });

  it('cursors toggle persists to storage and round-trips on remount', async () => {
    const { unmount } = renderWithBoard(<Toolbar />);
    const cursorsLabel = screen.getByText('Cursors');
    const toggle = cursorsLabel.parentElement?.querySelector('.toggle') as HTMLElement;
    expect(toggle).toBeTruthy();

    // Default: cursors on (no value stored == 'on')
    expect(toggle.classList.contains('active')).toBe(true);

    // Click → off
    await userEvent.click(toggle);
    expect(toggle.classList.contains('active')).toBe(false);
    expect(storage.read('cursors')).toBe('off');

    // Remount: should pick up the persisted 'off' state
    unmount();
    renderWithBoard(<Toolbar />);
    const cursorsLabel2 = screen.getByText('Cursors');
    const toggle2 = cursorsLabel2.parentElement?.querySelector('.toggle') as HTMLElement;
    expect(toggle2.classList.contains('active')).toBe(false);
  });

  it('hides per-user controls in template mode', () => {
    renderWithBoard(<Toolbar />, { context: { templateMode: true } });
    expect(screen.getByText(/template/i)).toBeInTheDocument();
    expect(screen.queryByText('Cursors')).not.toBeInTheDocument();
  });
});

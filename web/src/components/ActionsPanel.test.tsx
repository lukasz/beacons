import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';

const { actionsMock } = vi.hoisted(() => ({
  actionsMock: {
    previousForTeam: vi.fn(),
    markDoneOnSourceBoard: vi.fn(),
    updateLinearLinkOnSourceBoard: vi.fn(),
  },
}));

vi.mock('../services/actions', () => ({ actions: actionsMock }));

import ActionsPanel from './ActionsPanel';
import { renderWithBoard, screen } from '../test/utils';
import { fixtureUser } from '../test/fixtures';

beforeEach(() => {
  actionsMock.previousForTeam.mockReset().mockResolvedValue([]);
  actionsMock.markDoneOnSourceBoard.mockReset().mockResolvedValue(undefined);
  actionsMock.updateLinearLinkOnSourceBoard.mockReset().mockResolvedValue(undefined);
});

describe('<ActionsPanel />', () => {
  it('renders the panel header', () => {
    renderWithBoard(<ActionsPanel />, {
      state: { id: 'b1', teamId: 't1', users: { u1: fixtureUser() } },
    });
    // The panel title sits in .actions-panel-title; assert specifically.
    const title = document.querySelector('.actions-panel-title');
    expect(title?.textContent?.toLowerCase()).toContain('actions');
  });

  it('queries previous actions for the current team on mount', async () => {
    renderWithBoard(<ActionsPanel />, {
      state: { id: 'b1', teamId: 't1', users: { u1: fixtureUser() } },
    });
    await waitFor(() =>
      expect(actionsMock.previousForTeam).toHaveBeenCalledWith('t1', 'b1'),
    );
  });

  it('does not query when the board has no team attached', () => {
    renderWithBoard(<ActionsPanel />, {
      state: { id: 'b1', teamId: undefined, users: { u1: fixtureUser() } },
    });
    expect(actionsMock.previousForTeam).not.toHaveBeenCalled();
  });
});

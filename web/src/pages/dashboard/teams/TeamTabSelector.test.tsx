import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import TeamTabSelector from './TeamTabSelector';
import { renderWithProviders, screen } from '../../../test/utils';
import type { Team } from '../../../types';

const teams: Team[] = [
  { id: 't1', name: 'Platform', linearTeamKey: 'PLAT', createdBy: 'u1' },
  { id: 't2', name: 'Design', createdBy: 'u1' },
];

describe('<TeamTabSelector />', () => {
  it('shows the "Select team..." placeholder when nothing is selected', () => {
    renderWithProviders(<TeamTabSelector teams={teams} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: /select team/i })).toBeInTheDocument();
  });

  it('shows the selected team name', () => {
    renderWithProviders(<TeamTabSelector teams={teams} selectedId="t1" onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: /platform/i })).toBeInTheDocument();
  });

  it('opens the dropdown and selects a team', async () => {
    const onSelect = vi.fn();
    renderWithProviders(<TeamTabSelector teams={teams} selectedId={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /select team/i }));
    await userEvent.click(screen.getByRole('button', { name: /design/i }));
    expect(onSelect).toHaveBeenCalledWith('t2');
  });
});

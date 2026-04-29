import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import TeamMultiSelect from './TeamMultiSelect';
import { renderWithProviders, screen } from '../../../test/utils';
import type { Team } from '../../../types';

const teams: Team[] = [
  { id: 't1', name: 'Platform', linearTeamKey: 'PLAT', createdBy: 'u1' },
  { id: 't2', name: 'Design', createdBy: 'u1' },
];

describe('<TeamMultiSelect />', () => {
  it('shows "All teams" when nothing is selected', () => {
    renderWithProviders(<TeamMultiSelect teams={teams} selected={[]} onChange={() => {}} onManage={() => {}} />);
    expect(screen.getByRole('button', { name: /all teams/i })).toBeInTheDocument();
  });

  it("shows the team name when a single team is selected", () => {
    renderWithProviders(<TeamMultiSelect teams={teams} selected={['t1']} onChange={() => {}} onManage={() => {}} />);
    expect(screen.getByRole('button', { name: /platform/i })).toBeInTheDocument();
  });

  it('shows a count when more than one team is selected', () => {
    renderWithProviders(<TeamMultiSelect teams={teams} selected={['t1', 't2']} onChange={() => {}} onManage={() => {}} />);
    expect(screen.getByRole('button', { name: /2 teams/i })).toBeInTheDocument();
  });

  it('toggles a team via onChange when its option is clicked', async () => {
    const onChange = vi.fn();
    renderWithProviders(<TeamMultiSelect teams={teams} selected={[]} onChange={onChange} onManage={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /all teams/i }));
    await userEvent.click(screen.getByText('Design'));
    expect(onChange).toHaveBeenCalledWith(['t2']);
  });

  it('"Manage teams..." closes the dropdown and calls onManage', async () => {
    const onManage = vi.fn();
    renderWithProviders(<TeamMultiSelect teams={teams} selected={[]} onChange={() => {}} onManage={onManage} />);
    await userEvent.click(screen.getByRole('button', { name: /all teams/i }));
    await userEvent.click(screen.getByRole('button', { name: /manage teams/i }));
    expect(onManage).toHaveBeenCalledOnce();
  });

  it('shows a "Clear filters" action only when something is selected', async () => {
    const onChange = vi.fn();
    renderWithProviders(<TeamMultiSelect teams={teams} selected={['t1']} onChange={onChange} onManage={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /platform/i }));
    await userEvent.click(screen.getByRole('button', { name: /clear filters/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '../test/utils';
import userEvent from '@testing-library/user-event';
import Landing from './Landing';
import type { AuthUser } from '../hooks/useAuth';

const fakeUser: AuthUser = { id: 'u1', name: 'Ana', avatarUrl: '' };

const baseProps = {
  user: fakeUser,
  defaultRoomId: null,
  onCreateRoom: vi.fn(),
  onJoinRoom: vi.fn(),
  onSignOut: vi.fn(),
};

describe('<Landing />', () => {
  it('shows both create-fresh and join-existing options', () => {
    renderWithProviders(<Landing {...baseProps} />);
    expect(screen.getByRole('button', { name: /create new board/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/board code/i)).toBeInTheDocument();
    expect(screen.getByText(fakeUser.name)).toBeInTheDocument();
  });

  it('calls onCreateRoom when "Create New Board" is clicked', async () => {
    const onCreateRoom = vi.fn();
    renderWithProviders(<Landing {...baseProps} onCreateRoom={onCreateRoom} />);
    await userEvent.click(screen.getByRole('button', { name: /create new board/i }));
    expect(onCreateRoom).toHaveBeenCalledOnce();
  });

  it('passes the typed code to onJoinRoom on Join click', async () => {
    const onJoinRoom = vi.fn();
    renderWithProviders(<Landing {...baseProps} onJoinRoom={onJoinRoom} />);
    await userEvent.type(screen.getByPlaceholderText(/board code/i), 'abcd1234');
    await userEvent.click(screen.getByRole('button', { name: /^join$/i }));
    expect(onJoinRoom).toHaveBeenCalledWith('abcd1234');
  });
});

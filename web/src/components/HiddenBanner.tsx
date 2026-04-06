import { useBoard } from '../hooks/useBoard';

export default function HiddenBanner() {
  const { state, send, userId } = useBoard();
  const user = state.users[userId];
  if (!user?.hideMode) return null;

  return (
    <div className="hidden-banner">
      <span className="hidden-banner-icon">🙈</span>
      <span className="hidden-banner-text">
        Your notes are hidden from everyone else right now.
      </span>
      <button
        className="hidden-banner-link"
        onClick={() => send('toggle_hide', { userId, hidden: false })}
      >
        Reveal your secrets
      </button>
    </div>
  );
}

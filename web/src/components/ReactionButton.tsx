import { useState } from 'react';
import { useBoard } from '../hooks/useBoard';

const EMOJIS = ['🧡', '🎉', '😎', '🚀', '🎯', '😂', '😭', '👍🏼', '👎🏼'];

export default function ReactionButton() {
  const { send } = useBoard();
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`reaction-bar ${open ? 'open' : ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {open ? (
        EMOJIS.map((emoji, i) => (
          <button
            key={emoji}
            className="reaction-emoji"
            style={{ animationDelay: `${i * 0.02}s` }}
            onClick={() => {
              send('reaction', { emoji });
              setOpen(false);
            }}
          >
            {emoji}
          </button>
        ))
      ) : (
        <span className="reaction-label">Make it rain!</span>
      )}
    </div>
  );
}

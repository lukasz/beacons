import { useTheme } from '../hooks/useTheme';
import FeatureTour from './FeatureTour';

interface Props {
  isAuthed: boolean;
  onPrimary: () => void; // sign in OR go to dashboard
  onSecondary?: () => void; // optional "Skip" / "Go to boards"
}

export default function TadaLanding({ isAuthed, onPrimary }: Props) {
  const { theme, toggleTheme } = useTheme();
  const isGeek = theme === 'dark';

  return (
    <div className="tada">
      <div className="tada-topbar">
        <div className="theme-toggle" onClick={toggleTheme}>
          <span className="theme-toggle-label">{isGeek ? 'Geek Mode' : 'Vanilla Mode'}</span>
          <div className={`theme-toggle-track ${isGeek ? 'geek' : ''}`}>
            <div className="theme-toggle-thumb">{isGeek ? '🌙' : '☀️'}</div>
          </div>
        </div>
      </div>

      <header className="tada-hero">
        <img src="/logo.png" alt="Beacons" className="tada-hero-logo" />
        <h1>Beacons</h1>
        <p className="tada-hero-tagline">Retro as it should be</p>
        <p className="tada-hero-sub">
          Whiteboarding that's fun. Voting that doesn't bias itself. A timer the whole
          room sees. Linear on the same canvas. Scroll to poke at each piece.
        </p>
        <div className="tada-hero-cta">
          <button className="btn btn-primary tada-cta-primary" onClick={onPrimary}>
            {isAuthed ? 'Go to my boards →' : 'Sign in to get started'}
          </button>
        </div>
      </header>

      <FeatureTour />

      <footer className="tada-footer">
        <button className="btn btn-primary tada-cta-primary" onClick={onPrimary}>
          {isAuthed ? 'Back to my boards →' : 'Sign in to get started'}
        </button>
        <div className="tada-footer-note">
          Built for teams that want retros to feel like progress, not paperwork.
        </div>
      </footer>
    </div>
  );
}

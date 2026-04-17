import { useEffect, useMemo, useRef, useState } from 'react';

type DemoKind = 'board' | 'timer' | 'vote' | 'hide' | 'ocd';

interface StaticShot {
  kind: 'image';
  src: string;
  alt: string;
}
interface DemoSlot {
  kind: 'demo';
  demo: DemoKind;
}

interface Feature {
  title: string;
  body: string;
  slot: StaticShot | DemoSlot;
}

const FEATURES: Feature[] = [
  {
    title: 'Stickies, sections, groups',
    body:
      "Drag stickies around. Cluster them with a group label. Everything that belongs to a section comes along when you move the section. The surface is a real whiteboard, not a form.",
    slot: { kind: 'demo', demo: 'board' },
  },
  {
    title: 'Private votes, public reveal',
    body:
      "While a vote is live, you only see the votes you've cast. The organiser closes it, and totals land on every card at once — rank badges on the winners. No peeking, no groupthink.",
    slot: { kind: 'demo', demo: 'vote' },
  },
  {
    title: 'A timer the whole room sees',
    body:
      "Start it once — everyone's on the same clock. Adjust mid-session, pause, reset; all of it syncs. When it hits zero, the board knows, not just you.",
    slot: { kind: 'demo', demo: 'timer' },
  },
  {
    title: 'Hide, then reveal',
    body:
      "Your stickies stay blurred to others until you choose to reveal. Whoever opened the board can hide or reveal everyone's at once, so nobody starts writing by mirroring a neighbour.",
    slot: { kind: 'demo', demo: 'hide' },
  },
  {
    title: 'Linear context on the board',
    body:
      "Connect a team, and cycle progress, scope, and assignees show up right next to the retro. Pull last sprint's numbers into the conversation without switching tabs.",
    slot: { kind: 'image', src: '/features/linear-sync.png', alt: 'Linear cycle stats panel on a board' },
  },
  {
    title: 'One button for clean-up',
    body:
      "Hit OCD and the board tidies itself. Sections resize to their content, stickies settle into square-ish grids, groups stay with their cards. Deep breath.",
    slot: { kind: 'demo', demo: 'ocd' },
  },
];

export default function FeatureTour() {
  return (
    <section className="feature-tour" aria-label="Feature tour">
      <header className="feature-tour-intro">
        <span className="feature-tour-eyebrow">What you get</span>
        <h2>A retro that doesn't get in the way.</h2>
      </header>

      {FEATURES.map((f, i) => (
        <article key={f.title} className={`feature-row ${i % 2 === 1 ? 'feature-row-reverse' : ''}`}>
          <div className="feature-slot">
            {f.slot.kind === 'image' ? (
              <img className="feature-img" src={f.slot.src} alt={f.slot.alt} loading="lazy" />
            ) : (
              <FeatureDemo kind={f.slot.demo} />
            )}
          </div>
          <div className="feature-text">
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </div>
        </article>
      ))}
    </section>
  );
}

function FeatureDemo({ kind }: { kind: DemoKind }) {
  switch (kind) {
    case 'board': return <DemoBoard />;
    case 'timer': return <DemoTimer />;
    case 'vote': return <DemoVote />;
    case 'hide': return <DemoHide />;
    case 'ocd': return <DemoOCD />;
  }
}

// ─────────────────────────────────────────────────────────────
// DemoTimer — working countdown
// ─────────────────────────────────────────────────────────────
function DemoTimer() {
  const [remaining, setRemaining] = useState(300);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const blink = running && remaining > 0 && remaining <= 30;

  return (
    <div className="demo-timer demo-shell">
      <div className="demo-shell-title">Timer</div>
      <div className="demo-timer-row">
        <button className="demo-timer-adjust" onClick={() => setRemaining((r) => Math.max(0, r - 30))} disabled={remaining <= 0}>−</button>
        <div className={`demo-timer-display ${blink ? 'blink' : ''}`}>
          <span>{mins}</span>
          <span className="demo-timer-colon">:</span>
          <span>{secs.toString().padStart(2, '0')}</span>
        </div>
        <button className="demo-timer-adjust" onClick={() => setRemaining((r) => r + 30)}>+</button>
      </div>
      <div className="demo-timer-controls">
        {running ? (
          <button className="demo-btn demo-btn-pause" onClick={() => setRunning(false)}>⏸ Pause</button>
        ) : (
          <button className="demo-btn demo-btn-start" onClick={() => setRunning(true)} disabled={remaining <= 0}>▶ Start</button>
        )}
        <button className="demo-btn demo-btn-reset" onClick={() => { setRunning(false); setRemaining(300); }}>↺ Reset</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DemoBoard — 4 draggable stickies arranged in 2 sections
// ─────────────────────────────────────────────────────────────
interface DemoStickyData {
  id: string;
  text: string;
  author: string;
  colorIdx: number;
  x: number;
  y: number;
}
const DEMO_POSTIT_COLORS = ['#FCA5A5', '#FDBA74', '#86EFAC', '#93C5FD'];
function DemoBoard() {
  const [stickies, setStickies] = useState<DemoStickyData[]>([
    { id: 'a', text: 'We shipped on Friday',    author: 'Ana',    colorIdx: 2, x: 20,  y: 50 },
    { id: 'b', text: 'Pairing kept us honest',  author: 'Ben',    colorIdx: 2, x: 130, y: 80 },
    { id: 'c', text: 'Standups ran long',       author: 'Chris',  colorIdx: 0, x: 280, y: 55 },
    { id: 'd', text: 'Blockers went unseen',    author: 'Dana',   colorIdx: 0, x: 390, y: 90 },
  ]);
  const dragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  return (
    <div className="demo-board demo-shell" ref={boardRef}>
      <div className="demo-board-sections">
        <div className="demo-board-section section-green">
          <div className="demo-board-section-title">What went well 🌱</div>
        </div>
        <div className="demo-board-section section-pink">
          <div className="demo-board-section-title">What to fix 🩹</div>
        </div>
      </div>
      {stickies.map((s) => (
        <div
          key={s.id}
          className="demo-sticky"
          style={{ transform: `translate(${s.x}px, ${s.y}px)`, background: DEMO_POSTIT_COLORS[s.colorIdx] }}
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            dragRef.current = { id: s.id, startX: e.clientX, startY: e.clientY, origX: s.x, origY: s.y };
          }}
          onPointerMove={(e) => {
            if (!dragRef.current || dragRef.current.id !== s.id) return;
            const dx = e.clientX - dragRef.current.startX;
            const dy = e.clientY - dragRef.current.startY;
            const nx = Math.max(4, Math.min(540 - 100, dragRef.current.origX + dx));
            const ny = Math.max(40, Math.min(300 - 80, dragRef.current.origY + dy));
            setStickies((prev) => prev.map((p) => (p.id === s.id ? { ...p, x: nx, y: ny } : p)));
          }}
          onPointerUp={() => { dragRef.current = null; }}
        >
          <div className="demo-sticky-text">{s.text}</div>
          <div className="demo-sticky-author">{s.author}</div>
        </div>
      ))}
      <div className="demo-hint">Drag them.</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DemoVote — reveal rank badges
// ─────────────────────────────────────────────────────────────
interface DemoVoteCard { id: string; text: string; votes: number; }
const RANK_MEDALS = ['', '🥇', '🥈', '🥉'];
function DemoVote() {
  const [revealed, setRevealed] = useState(false);
  const [myVotes, setMyVotes] = useState<Record<string, number>>({});
  const cards: DemoVoteCard[] = useMemo(() => [
    { id: 'a', text: 'Ship a broken-market manifesto', votes: 7 },
    { id: 'b', text: 'More pairing time',              votes: 4 },
    { id: 'c', text: 'Tighter feedback loops',         votes: 9 },
    { id: 'd', text: 'Kill the Friday deploy freeze',  votes: 2 },
  ], []);

  const ranks = useMemo(() => {
    const sorted = [...cards].sort((a, b) => b.votes - a.votes);
    const map: Record<string, number> = {};
    sorted.forEach((c, i) => { map[c.id] = i + 1; });
    return map;
  }, [cards]);

  const myTotal = Object.values(myVotes).reduce((a, b) => a + b, 0);
  const remaining = Math.max(0, 3 - myTotal);

  return (
    <div className="demo-vote demo-shell">
      <div className="demo-shell-title">{revealed ? 'Results' : 'Active vote'}</div>
      {!revealed && (
        <div className="demo-vote-remaining">{remaining} of 3 votes remaining</div>
      )}
      <div className="demo-vote-grid">
        {cards.map((c) => {
          const mine = myVotes[c.id] || 0;
          const rank = ranks[c.id];
          return (
            <div key={c.id} className={`demo-vote-card ${revealed ? 'revealed' : ''} ${rank === 1 ? 'winner' : ''}`}>
              {revealed ? (
                <>
                  <div className={`demo-rank-badge rank-${Math.min(rank, 4)}`}>
                    <span>{RANK_MEDALS[rank] || ''}</span>
                    <span>#{rank}</span>
                  </div>
                  <div className="demo-vote-count">{c.votes}</div>
                </>
              ) : (
                mine > 0 && <div className="demo-vote-mine" data-count={mine}>★{mine}</div>
              )}
              <div className="demo-vote-text">{c.text}</div>
              {!revealed && (
                <button
                  className="demo-vote-btn"
                  onClick={() => {
                    if (remaining === 0 && !myVotes[c.id]) return;
                    setMyVotes((v) => ({ ...v, [c.id]: (v[c.id] || 0) + 1 }));
                  }}
                  disabled={remaining === 0}
                >
                  Vote
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="demo-vote-actions">
        {revealed ? (
          <button className="demo-btn" onClick={() => { setRevealed(false); setMyVotes({}); }}>Run it again</button>
        ) : (
          <button className="demo-btn demo-btn-start" onClick={() => setRevealed(true)}>Close & reveal</button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DemoHide — blur toggle
// ─────────────────────────────────────────────────────────────
function DemoHide() {
  const [hidden, setHidden] = useState(true);
  const cards = [
    { id: 1, text: 'This only works when I hit Enter', author: 'Ana' },
    { id: 2, text: 'The new flow saved us 20 min',     author: 'Ben' },
    { id: 3, text: "We're still bad at estimates",     author: 'Chris' },
  ];
  return (
    <div className="demo-hide demo-shell">
      <div className="demo-shell-title">Board (as someone else sees it)</div>
      <div className="demo-hide-row">
        {cards.map((c) => (
          <div key={c.id} className={`demo-sticky demo-hide-card ${hidden ? 'blurred' : ''}`}>
            <div className="demo-sticky-text">{c.text}</div>
            <div className="demo-sticky-author">{c.author}</div>
          </div>
        ))}
      </div>
      <div className="demo-hide-controls">
        <label className="demo-toggle">
          <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
          <span>Hide cards</span>
        </label>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DemoOCD — messy scatter → tidy grid
// ─────────────────────────────────────────────────────────────
interface OcdSticky { id: string; colorIdx: number; messy: { x: number; y: number; rot: number }; }
const OCD_STICKIES: OcdSticky[] = [
  { id: '1', colorIdx: 0, messy: { x: 40,  y: 90,  rot: -8 } },
  { id: '2', colorIdx: 1, messy: { x: 250, y: 60,  rot: 6  } },
  { id: '3', colorIdx: 2, messy: { x: 140, y: 150, rot: -4 } },
  { id: '4', colorIdx: 3, messy: { x: 360, y: 120, rot: 10 } },
  { id: '5', colorIdx: 0, messy: { x: 60,  y: 190, rot: 3  } },
  { id: '6', colorIdx: 2, messy: { x: 300, y: 200, rot: -12 } },
];
function DemoOCD() {
  const [tidy, setTidy] = useState(false);
  const tidyPos = (i: number) => ({ x: 30 + (i % 3) * 150, y: 60 + Math.floor(i / 3) * 110 });
  return (
    <div className="demo-ocd demo-shell">
      <div className="demo-shell-title">Board</div>
      <div className="demo-ocd-section">
        {OCD_STICKIES.map((s, i) => {
          const p = tidy ? tidyPos(i) : s.messy;
          const rot = tidy ? 0 : s.messy.rot;
          return (
            <div
              key={s.id}
              className="demo-sticky demo-ocd-sticky"
              style={{
                transform: `translate(${p.x}px, ${p.y}px) rotate(${rot}deg)`,
                background: DEMO_POSTIT_COLORS[s.colorIdx],
              }}
            />
          );
        })}
      </div>
      <div className="demo-ocd-controls">
        <button className="demo-btn demo-btn-start" onClick={() => setTidy(true)} disabled={tidy}>🧹 OCD</button>
        <button className="demo-btn" onClick={() => setTidy(false)} disabled={!tidy}>Make it messy</button>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';

type DemoKind = 'board' | 'timer' | 'vote' | 'hide' | 'ocd' | 'linear' | 'actions' | 'markdown' | 'rain' | 'newboard';

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
    slot: { kind: 'demo', demo: 'linear' },
  },
  {
    title: 'One button for clean-up',
    body:
      "Hit OCD and the board tidies itself. Sections resize to their content, stickies settle into square-ish grids, groups stay with their cards. Deep breath.",
    slot: { kind: 'demo', demo: 'ocd' },
  },
  {
    title: 'Actions that carry across retros',
    body:
      "Captured actions live with the board. Unchecked items from previous retros surface on the next one, so nothing drops off the edge. One click pushes an action to Linear as a real issue, with the link saved back to the card.",
    slot: { kind: 'demo', demo: 'actions' },
  },
  {
    title: 'Walk away with a clean write-up',
    body:
      "The 📝 MD button copies the whole board — sessions, sections, stickies, actions, vote results — as Markdown. Paste it into Notion, Slack, or a PR description. Selective export works too: highlight what matters, copy just that.",
    slot: { kind: 'demo', demo: 'markdown' },
  },
  {
    title: 'Make it rain',
    body:
      "A little celebration goes a long way. Hit an emoji reaction and it rains across everyone's screen, not just yours. Good for 'we shipped', 'happy birthday', or 'we survived that release'.",
    slot: { kind: 'demo', demo: 'rain' },
  },
  {
    title: 'Start your board, your way',
    body:
      "Fire up a blank canvas for an open format, pick a saved template to standardise across the team, or pull a cycle or project straight from Linear so the retro opens with the numbers already on it.",
    slot: { kind: 'demo', demo: 'newboard' },
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
    case 'linear': return <DemoLinear />;
    case 'actions': return <DemoActions />;
    case 'markdown': return <DemoMarkdown />;
    case 'rain': return <DemoReactionRain />;
    case 'newboard': return <DemoNewBoard />;
  }
}

// ─────────────────────────────────────────────────────────────
// DemoLinear — a faithful mock of the Linear cycle-stats panel
// ─────────────────────────────────────────────────────────────
function DemoLinear() {
  const completed = 18;
  const total = 24;
  const pct = Math.round((completed / total) * 100);
  return (
    <div className="demo-linear demo-shell">
      <div className="demo-shell-title">Cycle 24 · Platform</div>
      <div className="demo-linear-meta">
        <span>Mon 14 Apr – Fri 25 Apr</span>
        <span className="demo-linear-health">On track</span>
      </div>
      <div className="demo-linear-progress">
        <div className="demo-linear-progress-bar">
          <div className="demo-linear-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="demo-linear-progress-label">{pct}%</span>
      </div>
      <div className="demo-linear-grid">
        <div className="demo-linear-cell">
          <span className="demo-linear-value">22</span>
          <span className="demo-linear-label">Starting</span>
        </div>
        <div className="demo-linear-cell">
          <span className="demo-linear-value">{total}</span>
          <span className="demo-linear-label">Final scope</span>
        </div>
        <div className="demo-linear-cell">
          <span className="demo-linear-value warn">+9%</span>
          <span className="demo-linear-label">Scope change</span>
        </div>
        <div className="demo-linear-cell">
          <span className="demo-linear-value done">{completed}</span>
          <span className="demo-linear-label">Completed</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DemoTimer — working countdown with GAME OVER overlay
// ─────────────────────────────────────────────────────────────
function DemoTimer() {
  const [remaining, setRemaining] = useState(10);
  const [running, setRunning] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          setShowGameOver(true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!showGameOver) return;
    const t = window.setTimeout(() => setShowGameOver(false), 3000);
    const dismiss = () => setShowGameOver(false);
    window.addEventListener('keydown', dismiss);
    window.addEventListener('pointerdown', dismiss);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', dismiss);
      window.removeEventListener('pointerdown', dismiss);
    };
  }, [showGameOver]);

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
        <button className="demo-btn demo-btn-reset" onClick={() => { setRunning(false); setRemaining(300); setShowGameOver(false); }}>↺ Reset</button>
      </div>
      {showGameOver && (
        <div className="game-over-overlay demo-game-over">
          <div className="game-over-content">
            <div className="game-over-text">GAME OVER</div>
            <div className="game-over-sub">PRESS ANY KEY TO CONTINUE</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DemoBoard — draggable stickies, sections, and a group
// ─────────────────────────────────────────────────────────────
interface DemoStickyData {
  id: string;
  text: string;
  author: string;
  colorIdx: number;
  groupId?: string;
  x: number;
  y: number;
}
interface DemoGroupData { id: string; label: string; x: number; y: number; }
const DEMO_POSTIT_COLORS = ['#FCA5A5', '#FDBA74', '#86EFAC', '#93C5FD'];
const STICKY_W = 130;
const STICKY_H = 78;

function DemoBoard() {
  const [stickies, setStickies] = useState<DemoStickyData[]>([
    // Grouped pair (QA team)
    { id: 'a', text: 'QA dev starts next week', author: 'Ana',   colorIdx: 2, groupId: 'g1', x: 30,  y: 76 },
    { id: 'b', text: 'New QA member joined',    author: 'Ben',   colorIdx: 2, groupId: 'g1', x: 150, y: 96 },
    // Loose stickies
    { id: 'c', text: 'Standups ran long',       author: 'Chris', colorIdx: 0, x: 320, y: 68 },
    { id: 'd', text: 'Blockers went unseen',    author: 'Dana',  colorIdx: 0, x: 400, y: 132 },
  ]);
  const [groups, setGroups] = useState<DemoGroupData[]>([
    { id: 'g1', label: 'QA team', x: 36, y: 46 },
  ]);

  const dragRef = useRef<null | (
    | { kind: 'sticky'; id: string; startX: number; startY: number; origX: number; origY: number }
    | { kind: 'group'; id: string; startX: number; startY: number; origX: number; origY: number; children: { id: string; x: number; y: number }[] }
  )>(null);

  // ── Compute the group outline (bounding box around label + grouped stickies) ──
  const outlines = useMemo(() => {
    return groups.map((g) => {
      const children = stickies.filter((s) => s.groupId === g.id);
      if (children.length === 0) return { id: g.id, x: 0, y: 0, w: 0, h: 0 };
      const pad = 10;
      const xs = [g.x, ...children.map((s) => s.x)];
      const ys = [g.y, ...children.map((s) => s.y)];
      const xMax = [g.x + 80, ...children.map((s) => s.x + STICKY_W)];
      const yMax = [g.y + 22, ...children.map((s) => s.y + STICKY_H)];
      const minX = Math.min(...xs) - pad;
      const minY = Math.min(...ys) - pad;
      const maxX = Math.max(...xMax) + pad;
      const maxY = Math.max(...yMax) + pad;
      return { id: g.id, x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    });
  }, [groups, stickies]);

  return (
    <div className="demo-board demo-shell">
      <div className="demo-board-sections">
        <div className="demo-board-section section-green">
          <div className="demo-board-section-title">What went well 🌱</div>
        </div>
        <div className="demo-board-section section-pink">
          <div className="demo-board-section-title">What to fix 🩹</div>
        </div>
      </div>

      {/* Group outlines behind the stickies */}
      {outlines.map((o) => (
        <div
          key={`outline-${o.id}`}
          className="demo-group-outline"
          style={{ transform: `translate(${o.x}px, ${o.y}px)`, width: o.w, height: o.h }}
        />
      ))}

      {/* Group labels — dragging one drags its stickies too */}
      {groups.map((g) => (
        <div
          key={g.id}
          className="demo-group-label"
          style={{ transform: `translate(${g.x}px, ${g.y}px)` }}
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            const children = stickies.filter((s) => s.groupId === g.id).map((s) => ({ id: s.id, x: s.x, y: s.y }));
            dragRef.current = { kind: 'group', id: g.id, startX: e.clientX, startY: e.clientY, origX: g.x, origY: g.y, children };
          }}
          onPointerMove={(e) => {
            const d = dragRef.current;
            if (!d || d.kind !== 'group' || d.id !== g.id) return;
            const dx = e.clientX - d.startX;
            const dy = e.clientY - d.startY;
            const nx = Math.max(4, Math.min(540 - 80, d.origX + dx));
            const ny = Math.max(4, Math.min(320 - 30, d.origY + dy));
            const actualDx = nx - d.origX;
            const actualDy = ny - d.origY;
            setGroups((prev) => prev.map((x) => (x.id === g.id ? { ...x, x: nx, y: ny } : x)));
            setStickies((prev) => prev.map((s) => {
              const orig = d.children.find((c) => c.id === s.id);
              if (!orig) return s;
              return { ...s, x: orig.x + actualDx, y: orig.y + actualDy };
            }));
          }}
          onPointerUp={() => { dragRef.current = null; }}
        >
          {g.label}
        </div>
      ))}

      {/* Stickies */}
      {stickies.map((s) => (
        <div
          key={s.id}
          className="demo-sticky"
          style={{ transform: `translate(${s.x}px, ${s.y}px)`, background: DEMO_POSTIT_COLORS[s.colorIdx] }}
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            dragRef.current = { kind: 'sticky', id: s.id, startX: e.clientX, startY: e.clientY, origX: s.x, origY: s.y };
          }}
          onPointerMove={(e) => {
            const d = dragRef.current;
            if (!d || d.kind !== 'sticky' || d.id !== s.id) return;
            const dx = e.clientX - d.startX;
            const dy = e.clientY - d.startY;
            const nx = Math.max(4, Math.min(540 - STICKY_W, d.origX + dx));
            const ny = Math.max(40, Math.min(320 - STICKY_H, d.origY + dy));
            setStickies((prev) => prev.map((p) => (p.id === s.id ? { ...p, x: nx, y: ny } : p)));
          }}
          onPointerUp={() => { dragRef.current = null; }}
        >
          <div className="demo-sticky-text">{s.text}</div>
          <div className="demo-sticky-author">{s.author}</div>
        </div>
      ))}

      <div className="demo-hint">Drag stickies · drag the group label to move the cluster.</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DemoVote — real-looking stickies + real rank badges on reveal
// ─────────────────────────────────────────────────────────────
interface DemoVoteCard { id: string; text: string; author: string; colorIdx: number; x: number; y: number; totalVotes: number; }
const RANK_MEDALS = ['', '\u{1F947}', '\u{1F948}', '\u{1F949}'];
function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function DemoVote() {
  const [revealed, setRevealed] = useState(false);
  const [myVotes, setMyVotes] = useState<Record<string, number>>({});
  const cards = useMemo<DemoVoteCard[]>(() => [
    { id: 'a', text: 'Pairing kept us honest',  author: 'Ana',   colorIdx: 2, x: 20,  y: 50,  totalVotes: 4 },
    { id: 'b', text: 'Tighter feedback loops',  author: 'Ben',   colorIdx: 1, x: 190, y: 60,  totalVotes: 9 },
    { id: 'c', text: 'Standups ran long',       author: 'Chris', colorIdx: 0, x: 20,  y: 170, totalVotes: 7 },
    { id: 'd', text: 'Kill the Friday freeze',  author: 'Dana',  colorIdx: 3, x: 190, y: 180, totalVotes: 2 },
  ], []);

  const ranks = useMemo(() => {
    const sorted = [...cards].sort((a, b) => b.totalVotes - a.totalVotes);
    const map: Record<string, number> = {};
    sorted.forEach((c, i) => { map[c.id] = i + 1; });
    return map;
  }, [cards]);

  const myTotal = Object.values(myVotes).reduce((a, b) => a + b, 0);
  const remaining = Math.max(0, 3 - myTotal);

  return (
    <div className="demo-vote demo-shell">
      <div className="demo-shell-title">
        {revealed ? 'Vote results' : 'Active vote'}
        {!revealed && <span className="demo-vote-remaining-inline"> · {remaining} vote{remaining === 1 ? '' : 's'} remaining</span>}
      </div>
      <div className="demo-vote-canvas">
        {cards.map((c) => {
          const mine = myVotes[c.id] || 0;
          const rank = ranks[c.id];
          const canCast = !revealed && (remaining > 0 || mine > 0);
          return (
            <div
              key={c.id}
              className={`demo-sticky demo-vote-sticky ${canCast ? 'votable' : ''}`}
              style={{ transform: `translate(${c.x}px, ${c.y}px)`, background: DEMO_POSTIT_COLORS[c.colorIdx] }}
              onClick={() => {
                if (revealed) return;
                if (remaining > 0) setMyVotes((v) => ({ ...v, [c.id]: (v[c.id] || 0) + 1 }));
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                if (revealed || !mine) return;
                setMyVotes((v) => { const n = { ...v }; if (n[c.id] > 1) n[c.id] -= 1; else delete n[c.id]; return n; });
              }}
            >
              {revealed && rank > 0 && (
                <div className={`rank-badge rank-${Math.min(rank, 4)}`}>
                  {RANK_MEDALS[rank] && <span className="rank-medal">{RANK_MEDALS[rank]}</span>}
                  <span className="rank-text">{ordinal(rank)}</span>
                </div>
              )}

              {revealed ? (
                <div className="vote-badge" data-count={c.totalVotes} />
              ) : (
                mine > 0 && <div className="vote-badge can-unvote" data-count={mine} />
              )}

              <div className="demo-sticky-text">{c.text}</div>
              <div className="demo-sticky-author">{c.author}</div>
            </div>
          );
        })}
      </div>
      <div className="demo-vote-actions">
        {revealed ? (
          <button className="demo-btn" onClick={() => { setRevealed(false); setMyVotes({}); }}>Run it again</button>
        ) : (
          <>
            <span className="demo-vote-hint">Click a sticky to vote · right-click to unvote</span>
            <button className="demo-btn demo-btn-start" onClick={() => setRevealed(true)}>Close &amp; reveal</button>
          </>
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

// ─────────────────────────────────────────────────────────────
// DemoActions — actions panel with previous-retro carry-over + Linear link
// ─────────────────────────────────────────────────────────────
interface DemoAction { id: string; text: string; author: string; done: boolean; linearKey?: string; }
interface PrevAction { id: string; text: string; author: string; sourceSession: string; }
function DemoActions() {
  const [current, setCurrent] = useState<DemoAction[]>([
    { id: 'a1', text: 'Ship daily cost breakdown to the portal', author: 'Ana',  done: false },
    { id: 'a2', text: 'Document the new pricing engine flow',    author: 'Ben',  done: true  },
    { id: 'a3', text: 'Pair with Chris on the invoice audit',    author: 'Dana', done: false },
  ]);
  const [showPrev, setShowPrev] = useState(true);
  const prev: PrevAction[] = [
    { id: 'p1', text: "Investigate why non-power charges aren't itemised", author: 'Ben', sourceSession: 'Cycle 23 retro' },
    { id: 'p2', text: 'Automate the weekly RED score rollup',              author: 'Ana', sourceSession: 'Cycle 23 retro' },
  ];

  const toggle = (id: string) =>
    setCurrent((p) => p.map((a) => (a.id === id ? { ...a, done: !a.done } : a)));
  const pushLinear = (id: string) =>
    setCurrent((p) => p.map((a) => (a.id === id ? { ...a, linearKey: 'ENG-' + (100 + Math.floor(Math.random() * 900)) } : a)));

  return (
    <div className="demo-actions demo-shell">
      <div className="demo-shell-title">Actions</div>

      <div className="demo-actions-section-label">This retro</div>
      {current.map((a) => (
        <div key={a.id} className={`demo-action ${a.done ? 'done' : ''}`}>
          <label className="demo-action-check">
            <input type="checkbox" checked={a.done} onChange={() => toggle(a.id)} />
            <span className="demo-action-text">{a.text}</span>
          </label>
          <div className="demo-action-meta">
            <span className="demo-action-author">{a.author}</span>
            {a.linearKey ? (
              <span className="demo-action-linear-badge">{a.linearKey}</span>
            ) : (
              !a.done && (
                <button className="demo-action-linear-btn" onClick={() => pushLinear(a.id)}>
                  + Linear
                </button>
              )
            )}
          </div>
        </div>
      ))}

      <div
        className="demo-actions-section-label demo-actions-section-toggle"
        onClick={() => setShowPrev((s) => !s)}
      >
        <span>From previous retros</span>
        <span className="demo-actions-section-chev">{showPrev ? '\u25BE' : '\u25B8'}</span>
      </div>
      {showPrev && prev.map((a) => (
        <div key={a.id} className="demo-action demo-action-prev">
          <label className="demo-action-check">
            <input type="checkbox" />
            <span className="demo-action-text">{a.text}</span>
          </label>
          <div className="demo-action-meta">
            <span className="demo-action-source">from {a.sourceSession}</span>
            <span className="demo-action-author">{'\u00b7'} {a.author}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DemoMarkdown — click MD → preview + "Copied!"
// ─────────────────────────────────────────────────────────────
const MD_SAMPLE = `# Cycle 24 retro — Platform

## What went well 🌱
- Pairing kept us honest (Ana)
- Tighter feedback loops (Ben)

## What to fix 🩹
- Standups ran long (Chris)
- Kill the Friday freeze (Dana)

## Actions
- [ ] Ship daily cost breakdown to the portal — Ana
- [x] Document the new pricing engine flow — Ben

## Voting Results
| Item | Votes |
|------|-------|
| Tighter feedback loops | 9 |
| Standups ran long | 7 |
| Pairing kept us honest | 4 |
`;
function DemoMarkdown() {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleCopy = () => {
    setShowPreview(true);
    setCopied(true);
    try {
      navigator.clipboard?.writeText(MD_SAMPLE);
    } catch { /* ignore clipboard permission errors */ }
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="demo-md demo-shell">
      <div className="demo-shell-title">Board export</div>
      <div className="demo-md-toolbar">
        <button className="demo-md-btn" onClick={handleCopy}>
          {copied ? '\u2713 Copied!' : '\uD83D\uDCDD MD'}
        </button>
        <span className="demo-md-hint">Copy the whole board as Markdown</span>
      </div>
      {showPreview ? (
        <pre className="demo-md-preview">{MD_SAMPLE}</pre>
      ) : (
        <div className="demo-md-empty">Click {'\uD83D\uDCDD'} MD to see what comes out</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DemoReactionRain — confetti-gun emoji inside the demo shell
// ─────────────────────────────────────────────────────────────
interface DemoParticle { id: number; emoji: string; angle: number; speed: number; size: number; delay: number; duration: number; }
let __demoParticleId = 0;
function DemoReactionRain() {
  const [particles, setParticles] = useState<DemoParticle[]>([]);
  const shellRef = useRef<HTMLDivElement>(null);
  const emojis = ['\uD83C\uDF89', '\u2728', '\uD83D\uDE80', '\uD83C\uDF8A', '\uD83C\uDF1F', '\uD83D\uDCA5', '\uD83D\uDD25'];

  const fire = (emoji: string) => {
    const rect = shellRef.current?.getBoundingClientRect();
    const w = rect?.width ?? 540;
    const h = rect?.height ?? 300;
    const diagonal = Math.sqrt(w * w + h * h);
    const count = 24 + Math.floor(Math.random() * 10);
    const baseSpeed = diagonal * 0.55;
    const speedRange = diagonal * 0.4;
    const fresh: DemoParticle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = 0.35 + Math.random() * 1.0;
      fresh.push({
        id: __demoParticleId++,
        emoji,
        angle,
        speed: baseSpeed + Math.random() * speedRange,
        size: 1.0 + Math.random() * 1.0,
        delay: Math.random() * 0.25,
        duration: 1.8 + Math.random() * 1.2,
      });
    }
    setParticles((p) => [...p, ...fresh]);
    window.setTimeout(() => {
      setParticles((prev) => prev.filter((x) => !fresh.find((f) => f.id === x.id)));
    }, 3500);
  };

  return (
    <div className="demo-rain demo-shell" ref={shellRef}>
      <div className="demo-shell-title">Reactions</div>
      <div className="demo-rain-buttons">
        {emojis.map((e) => (
          <button key={e} className="demo-rain-btn" onClick={() => fire(e)}>{e}</button>
        ))}
      </div>
      <div className="demo-rain-hint">Pick an emoji — everyone in the room sees it fly.</div>
      {particles.map((p) => {
        const endX = Math.cos(p.angle) * p.speed;
        const endY = -Math.sin(p.angle) * p.speed;
        return (
          <span
            key={p.id}
            className="demo-rain-particle"
            style={{
              fontSize: `${p.size}rem`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              ['--end-x' as never]: `${endX}px`,
              ['--end-y' as never]: `${endY}px`,
            } as React.CSSProperties}
          >
            {p.emoji}
          </span>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DemoNewBoard — mock of the New Board chooser dialog
// ─────────────────────────────────────────────────────────────
function DemoNewBoard() {
  const [picked, setPicked] = useState<string | null>(null);
  const copy: Record<string, string> = {
    linear: 'Opens the Linear picker — choose a cycle or project, Beacons drops the stats on the board.',
    template: 'Lists your saved templates. Pick one and the board opens with its sections in place.',
    free: 'A blank canvas. Drop sections, stickies, and groups however you like.',
  };
  return (
    <div className="demo-newboard demo-shell">
      <div className="demo-shell-title">New Board</div>
      <div className="demo-newboard-sub">Choose how to set up your board</div>
      <div className="demo-newboard-grid">
        <button
          className={`demo-newboard-card ${picked === 'linear' ? 'picked' : ''}`}
          onClick={() => setPicked('linear')}
        >
          <span className="demo-newboard-icon">
            <svg width="24" height="24" viewBox="0 0 100 100" fill="none">
              <path d="M2.4 60.7a50 50 0 0 0 36.9 36.9L2.4 60.7z" fill="currentColor"/>
              <path d="M.2 49.2a50 50 0 0 0 1.3 8.3L46.6 2.4A50 50 0 0 0 .2 49.2z" fill="currentColor"/>
              <path d="M97.6 39.3a50 50 0 0 0-36.9-36.9l36.9 36.9z" fill="currentColor"/>
              <path d="M99.8 50.8a50 50 0 0 0-1.3-8.3L53.4 97.6a50 50 0 0 0 46.4-46.8z" fill="currentColor"/>
            </svg>
          </span>
          <span className="demo-newboard-label">From Linear</span>
          <span className="demo-newboard-desc">A retro from a cycle or project</span>
        </button>
        <button
          className={`demo-newboard-card ${picked === 'template' ? 'picked' : ''}`}
          onClick={() => setPicked('template')}
        >
          <span className="demo-newboard-icon">{'\uD83D\uDCCB'}</span>
          <span className="demo-newboard-label">From Template</span>
          <span className="demo-newboard-desc">Pre-defined sections, ready to go</span>
        </button>
        <button
          className={`demo-newboard-card ${picked === 'free' ? 'picked' : ''}`}
          onClick={() => setPicked('free')}
        >
          <span className="demo-newboard-icon">{'\uD83D\uDC14'}</span>
          <span className="demo-newboard-label">Free Range</span>
          <span className="demo-newboard-desc">A completely empty canvas</span>
        </button>
      </div>
      <div className={`demo-newboard-callout ${picked ? 'visible' : ''}`}>
        {picked ? copy[picked] : '\u00a0'}
      </div>
    </div>
  );
}

import { useState, useMemo } from 'react';

interface RiceCalculatorProps {
  onBack: () => void;
}

const STEPS = ['Reach', 'Impact', 'Confidence', 'Effort', 'Result'];

const REACH_OPTIONS = [
  { value: 1, label: 'One team only', desc: 'A single squad benefits from this initiative' },
  { value: 2, label: 'Multiple teams', desc: 'More than one team, but not the whole engineering function' },
  { value: 4, label: 'Whole engineering function', desc: 'Every engineering team is meaningfully affected' },
  { value: 6, label: 'Across multiple functions', desc: 'Engineering + Ops, Product, or other business functions' },
];
const CONFIDENCE_OPTIONS = [
  { value: 1.0, label: 'Certain', emoji: '\u{1F512}', desc: 'There is no realistic way this won\u2019t work.' },
  { value: 0.75, label: 'High', emoji: '\u2705', desc: 'Highly probable; risk is marginal and backed by data.' },
  { value: 0.5, label: 'Medium', emoji: '\u{1F914}', desc: 'Looks promising but we can\u2019t be sure until we try.' },
  { value: 0.25, label: 'Low', emoji: '\u{1F3B2}', desc: 'A long shot \u2014 experimental or speculative. No risk, no fun.' },
];
const BASE_EFFORT_OPTIONS = [
  { value: 1, label: 'Under one Beat', desc: '' },
  { value: 2, label: 'One to two Beats', desc: '' },
  { value: 3, label: 'Over two Beats', desc: '' },
];
const SKILL_OPTIONS = [
  { value: 1, label: 'One sub-team', desc: 'e.g. DevEx only, or Foundations only' },
  { value: 2, label: 'Two sub-teams', desc: 'e.g. DevEx + QA' },
  { value: 3, label: 'All of Platform Service', desc: 'DevEx + Foundations + QA' },
];
const EXTERNAL_OPTIONS = [
  { value: 0, label: 'Platform ships it alone', desc: 'No other teams need to get involved' },
  { value: 1, label: 'One team needs to help', desc: 'One external team needs to contribute time' },
  { value: 2, label: 'All teams involved', desc: 'All engineering teams need to allocate time' },
];
const NOTICEABILITY = [
  { value: 1, label: 'Hard to notice', desc: 'Difficult to observe in data or feel in practice.', variant: 'muted' as const },
  { value: 2, label: 'Noticeable', desc: 'Clear, measurable improvement.', variant: 'info' as const },
  { value: 3, label: 'Strong improvement', desc: 'Materially changes how the team operates.', variant: 'accent' as const },
  { value: 4, label: 'Game-changer', desc: 'Transformational \u2014 redefines what\u2019s possible.', variant: 'primary' as const },
];
const DEFAULT_METRICS = ['Deployment Frequency', 'Lead Time for Changes', 'Change Failure Rate', 'MTTR'];

/* -- Step indicator -- */
function StepIndicator({ current }: { current: number }) {
  return (
    <div className="rice-steps">
      {STEPS.map((s, i) => (
        <div key={s} className="rice-step-item">
          <div className={`rice-step-dot ${i < current ? 'done' : ''} ${i === current ? 'active' : ''}`}>
            {i < current ? '\u2713' : i + 1}
          </div>
          {i < STEPS.length - 1 && <div className={`rice-step-line ${i < current ? 'done' : ''}`} />}
        </div>
      ))}
    </div>
  );
}

/* -- Calculator -- */
function Calculator() {
  const [step, setStep] = useState(0);
  const [reach, setReach] = useState<number | null>(null);
  const [metricEnabled, setMetricEnabled] = useState<Record<string, boolean>>(
    DEFAULT_METRICS.reduce((a, m) => ({ ...a, [m]: false }), {} as Record<string, boolean>),
  );
  const [metricScore, setMetricScore] = useState<Record<string, number | null>>(
    DEFAULT_METRICS.reduce((a, m) => ({ ...a, [m]: null }), {} as Record<string, number | null>),
  );
  const [customMetrics, setCustomMetrics] = useState<string[]>([]);
  const [newMetric, setNewMetric] = useState('');
  const [showMetricError, setShowMetricError] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [baseEffort, setBaseEffort] = useState<number | null>(null);
  const [skill, setSkill] = useState<number | null>(null);
  const [external, setExternal] = useState<number | null>(null);

  const allMetricNames = useMemo(() => [...DEFAULT_METRICS, ...customMetrics], [customMetrics]);
  const activeMetrics = useMemo(
    () => allMetricNames.filter((n) => metricEnabled[n] && metricScore[n] !== null).map((n) => [n, metricScore[n]!] as [string, number]),
    [allMetricNames, metricEnabled, metricScore],
  );
  const enabledWithoutScore = useMemo(() => allMetricNames.filter((n) => metricEnabled[n] && metricScore[n] === null), [allMetricNames, metricEnabled, metricScore]);
  const anyEnabled = allMetricNames.some((n) => metricEnabled[n]);

  const impact = useMemo(() => {
    if (!activeMetrics.length) return 0;
    const s = activeMetrics.map(([, v]) => v).sort((a, b) => b - a);
    return s[0] + s.slice(1).filter((x) => x >= 2).reduce((acc, v) => acc + 0.5 * v, 0);
  }, [activeMetrics]);
  const effort = useMemo(() => (!baseEffort || !skill || external === null ? null : baseEffort * skill + external), [baseEffort, skill, external]);
  const rice = useMemo(() => (!reach || !impact || !confidence || !effort ? null : (reach * impact * confidence) / effort), [reach, impact, confidence, effort]);

  function toggleMetricEnabled(name: string, val: boolean) {
    setMetricEnabled((p) => ({ ...p, [name]: val }));
    if (!val) setMetricScore((p) => ({ ...p, [name]: null }));
    setShowMetricError(false);
  }
  function setScore(name: string, val: number) {
    setMetricScore((p) => ({ ...p, [name]: p[name] === val ? null : val }));
    setShowMetricError(false);
  }
  function addCustomMetric() {
    const t = newMetric.trim();
    if (!t || customMetrics.includes(t) || DEFAULT_METRICS.includes(t)) return;
    setCustomMetrics((p) => [...p, t]);
    setMetricEnabled((p) => ({ ...p, [t]: false }));
    setMetricScore((p) => ({ ...p, [t]: null }));
    setNewMetric('');
  }

  const sortedActive = [...activeMetrics].sort((a, b) => b[1] - a[1]);
  const primaryM = sortedActive[0];
  const secondaryMs = sortedActive.slice(1).filter(([, v]) => v >= 2);
  const excludedMs = sortedActive.slice(1).filter(([, v]) => v < 2);
  const extraActive = activeMetrics.filter(([n]) => !DEFAULT_METRICS.includes(n));
  const baseOpt = BASE_EFFORT_OPTIONS.find((o) => o.value === baseEffort);
  const skillOpt = SKILL_OPTIONS.find((o) => o.value === skill);

  const reachSummary = (): string =>
    ({ 1: 'Scoped to a single team \u2014 minimal organisational footprint.', 2: 'Touches several teams but stays within engineering.', 4: 'Spans the whole engineering function \u2014 broad organisational reach.', 6: 'Crosses multiple functions, reaching beyond engineering into the wider business.' }[reach!] ?? '');
  const impactSummary = (): string => {
    if (!primaryM) return '';
    const pL = NOTICEABILITY.find((n) => n.value === primaryM[1])?.label;
    let s = `Primary driver is ${primaryM[0]} (${pL}).`;
    if (secondaryMs.length) s += ` Also meaningfully affects ${secondaryMs.map(([n, v]) => `${n} (${NOTICEABILITY.find((x) => x.value === v)?.label?.toLowerCase()})`).join(', ')}.`;
    if (excludedMs.length) s += ` ${excludedMs.map(([n]) => n).join(', ')} ${excludedMs.length === 1 ? 'is' : 'are'} touched but too marginally to count.`;
    if (extraActive.length) s += ` Bonus: also impacts ${extraActive.map(([n]) => n).join(', ')} outside of DORA.`;
    return s;
  };
  const confidenceSummary = (): string =>
    ({ 1.0: 'Fully validated \u2014 the outcome is as certain as it gets.', 0.75: 'Well-evidenced and highly likely to work.', 0.5: 'Promising but unproven \u2014 we won\u2019t know for sure until we try.', 0.25: 'A deliberate bet in the dark. High uncertainty; only worth it if Reach and Impact are compelling.' }[confidence!] ?? '');
  const effortSummary = (): string => {
    if (!baseOpt || !skillOpt) return '';
    let s = `Takes ${baseOpt.label.toLowerCase()}, involving ${skillOpt.label.toLowerCase()}.`;
    s += external === 0 ? ' Platform can ship this end-to-end.' : external === 1 ? ' One external team needs to contribute time.' : ' All engineering teams need to allocate time.';
    return s;
  };

  const riceInfo = rice === null ? { label: '\u2014', cls: '' } : rice >= 6 ? { label: 'Must do \u{1F680}', cls: 'must-do' } : rice >= 3 ? { label: 'High priority \u2705', cls: 'high' } : rice >= 1.5 ? { label: 'Worth considering \u{1F914}', cls: 'worth' } : { label: 'Low priority \u2B07\uFE0F', cls: 'low' };
  const [copied, setCopied] = useState(false);
  const markdown = `# RICE Score Summary\n\n**Score: ${rice?.toFixed(2)} \u2014 ${riceInfo.label}**\n\n\`(${reach} \u00d7 ${impact.toFixed(1)} \u00d7 ${confidence?.toFixed(2)}) / ${effort} = ${rice?.toFixed(2)}\`\n\n---\n\n## Reach \u2014 ${reach} pts\n${reachSummary()}\n\n## Impact \u2014 ${impact.toFixed(1)} pts\n${impactSummary()}\n\n## Confidence \u2014 \u00d7${confidence?.toFixed(2)}\n${confidenceSummary()}\n\n## Effort \u2014 ${effort} pts\n\`(${baseEffort} \u00d7 ${skill}) + ${external} = ${effort}\`\n${effortSummary()}\n\n---\n*Scored using the Platform Service RICE Framework*`;

  function copyMarkdown() {
    navigator.clipboard.writeText(markdown).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  }

  function reset() {
    setStep(0); setReach(null); setConfidence(null); setBaseEffort(null); setSkill(null); setExternal(null); setShowMetricError(false); setCustomMetrics([]);
    setMetricEnabled(DEFAULT_METRICS.reduce((a, m) => ({ ...a, [m]: false }), {} as Record<string, boolean>));
    setMetricScore(DEFAULT_METRICS.reduce((a, m) => ({ ...a, [m]: null }), {} as Record<string, number | null>));
  }

  function handleNext() {
    if (step === 1) { if (!anyEnabled || enabledWithoutScore.length > 0) { setShowMetricError(true); return; } setShowMetricError(false); setStep(2); return; }
    setStep((s) => s + 1);
  }
  const canNext = [reach !== null, true, confidence !== null, baseEffort !== null && skill !== null && external !== null, true][step];

  return (
    <>
      <StepIndicator current={step} />
      <div className="rice-card">
        {/* Step 0: Reach */}
        {step === 0 && (
          <>
            <div className="rice-section-header">
              <span className="rice-step-badge reach">Step 1 \u00b7 Reach</span>
              <h3>Who does this reach?</h3>
              <p className="rice-subtitle">Who actively experiences the change \u2014 not just who\u2019s touched indirectly.</p>
            </div>
            <div className="rice-options">
              {REACH_OPTIONS.map((o) => (
                <button key={o.value} className={`rice-option ${reach === o.value ? 'selected reach' : ''}`} onClick={() => setReach(o.value)}>
                  <div className="rice-option-radio"><div className={`rice-radio ${reach === o.value ? 'checked' : ''}`} /></div>
                  <div className="rice-option-content">
                    <div className="rice-option-label">{o.label}<span className="rice-pill">{o.value} pts</span></div>
                    <p className="rice-option-desc">{o.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 1: Impact */}
        {step === 1 && (
          <>
            <div className="rice-section-header">
              <span className="rice-step-badge impact">Step 2 \u00b7 Impact</span>
              <h3>What\u2019s the impact?</h3>
              <p className="rice-subtitle">Toggle on metrics this initiative influences, then rate noticeability.</p>
            </div>
            <div className="rice-notice-scale">
              <span className="rice-notice-label">Noticeability scale</span>
              <div className="rice-notice-items">
                {NOTICEABILITY.map((n) => (
                  <div key={n.value} className="rice-notice-item">
                    <span className={`rice-notice-badge ${n.variant}`}>{n.value} \u00b7 {n.label}</span>
                    <span className="rice-notice-desc">{n.desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rice-metrics">
              {allMetricNames.map((name) => {
                const on = metricEnabled[name]; const score = metricScore[name]; const needsScore = on && score === null;
                return (
                  <div key={name} className={`rice-metric ${on ? 'active' : ''} ${needsScore && showMetricError ? 'error' : ''}`}>
                    <div className="rice-metric-header">
                      <span className={`rice-metric-name ${on ? '' : 'muted'}`}>{name}</span>
                      <button className={`rice-toggle ${on ? 'on' : ''}`} onClick={() => toggleMetricEnabled(name, !on)}>
                        <div className="rice-toggle-thumb" />
                      </button>
                    </div>
                    {on && (
                      <div className="rice-metric-scores">
                        {NOTICEABILITY.map((n) => (
                          <button key={n.value} className={`rice-score-btn ${score === n.value ? `selected ${n.variant}` : ''}`} onClick={() => setScore(name, n.value)}>
                            {n.value} \u00b7 {n.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="rice-add-metric">
                <input value={newMetric} onChange={(e) => setNewMetric(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCustomMetric()} placeholder="Add non-DORA metric\u2026" className="rice-input" />
                <button className="btn btn-primary btn-small" onClick={addCustomMetric}>+ Add</button>
              </div>
              {showMetricError && <div className="rice-error">{!anyEnabled ? 'Toggle on at least one metric before continuing.' : `Please select a noticeability level for: ${enabledWithoutScore.join(', ')}.`}</div>}
              {activeMetrics.length > 0 && (() => {
                const s = [...activeMetrics].sort((a, b) => b[1] - a[1]); const [pn, ps] = s[0]; const secs = s.slice(1).filter(([, v]) => v >= 2);
                return (
                  <div className="rice-preview">
                    <span className="rice-preview-label">Impact preview</span>
                    <p>Primary: <strong>{pn}</strong> \u2192 {ps}</p>
                    {secs.length > 0 && <p>Secondaries: {secs.map(([n, v]) => `${n} (${v}\u00d70.5=${v * 0.5})`).join(', ')}</p>}
                    <p className="rice-preview-total">Impact = {impact.toFixed(1)}</p>
                  </div>
                );
              })()}
            </div>
          </>
        )}

        {/* Step 2: Confidence */}
        {step === 2 && (
          <>
            <div className="rice-section-header">
              <span className="rice-step-badge confidence">Step 3 \u00b7 Confidence</span>
              <h3>How confident are you?</h3>
              <p className="rice-subtitle">Reflects the strength of evidence. Don\u2019t game this upward.</p>
            </div>
            <div className="rice-options">
              {CONFIDENCE_OPTIONS.map((o) => (
                <button key={o.value} className={`rice-option ${confidence === o.value ? 'selected confidence' : ''}`} onClick={() => setConfidence(o.value)}>
                  <div className="rice-option-radio"><div className={`rice-radio ${confidence === o.value ? 'checked' : ''}`} /></div>
                  <div className="rice-option-content">
                    <div className="rice-option-label"><span>{o.emoji}</span> {o.label}<span className="rice-pill">\u00d7{o.value.toFixed(2)}</span></div>
                    <p className="rice-option-desc">{o.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 3: Effort */}
        {step === 3 && (
          <>
            <div className="rice-section-header">
              <span className="rice-step-badge effort">Step 4 \u00b7 Effort</span>
              <h3>How much effort is needed?</h3>
              <p className="rice-subtitle">Effort = (Base \u00d7 Skill) + External. Range: 1\u201311.</p>
            </div>
            {([
              { label: 'Base Effort', options: BASE_EFFORT_OPTIONS, val: baseEffort, set: setBaseEffort, badge: (v: number) => `${v}` },
              { label: 'Skill Multiplier', options: SKILL_OPTIONS, val: skill, set: setSkill, badge: (v: number) => `\u00d7${v}` },
              { label: 'External Dependency', options: EXTERNAL_OPTIONS, val: external, set: setExternal, badge: (v: number) => `+${v}` },
            ] as const).map((g) => (
              <div key={g.label} className="rice-effort-group">
                <span className="rice-effort-label">{g.label}</span>
                <div className="rice-options compact">
                  {g.options.map((o) => (
                    <button key={o.value} className={`rice-option ${g.val === o.value ? 'selected effort' : ''}`} onClick={() => g.set(o.value)}>
                      <div className="rice-option-radio"><div className={`rice-radio ${g.val === o.value ? 'checked' : ''}`} /></div>
                      <div className="rice-option-content">
                        <div className="rice-option-label">{o.label}<span className="rice-pill">{g.badge(o.value)}</span></div>
                        {o.desc && <p className="rice-option-desc">{o.desc}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {effort !== null && <div className="rice-preview">
              <span className="rice-preview-label">Effort preview</span>
              <p>({baseEffort} \u00d7 {skill}) + {external} = <strong>{effort}</strong></p>
            </div>}
          </>
        )}

        {/* Step 4: Result */}
        {step === 4 && (
          <>
            <div className="rice-section-header">
              <span className="rice-step-badge result">Result</span>
              <h3>Your RICE Score</h3>
            </div>
            <div className="rice-result-score">
              <div className={`rice-big-number ${riceInfo.cls}`}>{rice?.toFixed(2) ?? '\u2014'}</div>
              <div className={`rice-result-label ${riceInfo.cls}`}>{riceInfo.label}</div>
            </div>
            <div className="rice-result-breakdown">
              <div className="rice-result-block reach"><div className="rice-result-block-header"><span className="rice-result-dim">Reach</span><span className="rice-result-val">{reach} pts</span></div><p>{reachSummary()}</p></div>
              <div className="rice-result-block impact"><div className="rice-result-block-header"><span className="rice-result-dim">Impact</span><span className="rice-result-val">{impact.toFixed(1)} pts</span></div><p>{impactSummary()}</p></div>
              <div className="rice-result-block confidence"><div className="rice-result-block-header"><span className="rice-result-dim">Confidence</span><span className="rice-result-val">\u00d7{confidence?.toFixed(2)}</span></div><p>{confidenceSummary()}</p></div>
              <div className="rice-result-block effort"><div className="rice-result-block-header"><span className="rice-result-dim">Effort</span><span className="rice-result-val">{effort} pts</span></div><p>{effortSummary()}</p></div>
            </div>
            <div className="rice-formula-box">({reach} \u00d7 {impact.toFixed(1)} \u00d7 {confidence?.toFixed(2)}) / {effort} = <strong>{rice?.toFixed(2)}</strong></div>
            <div className="rice-score-guide">
              <span className="rice-guide-title">Score guide (relative)</span>
              <p className="must-do">{'\u{1F680} \u2265 6.0 \u2014 Must do'}</p>
              <p className="high">{'\u2705 3.0\u20135.9 \u2014 High priority'}</p>
              <p className="worth">{'\u{1F914} 1.5\u20132.9 \u2014 Worth considering'}</p>
              <p className="low">{'\u2B07\uFE0F < 1.5 \u2014 Low priority'}</p>
            </div>
            <button className={`btn ${copied ? 'btn-success' : ''} rice-copy-btn`} onClick={copyMarkdown}>{copied ? '\u2713 Copied to clipboard!' : 'Copy Markdown summary'}</button>
            <button className="btn btn-secondary rice-reset-btn" onClick={reset}>\u21A9 Score another initiative</button>
          </>
        )}
      </div>

      {step < 4 && (
        <div className="rice-nav-buttons">
          {step > 0 && <button className="btn btn-secondary" onClick={() => setStep((s) => s - 1)}>\u2190 Back</button>}
          <button className="btn btn-primary" onClick={handleNext} disabled={step !== 1 && !canNext}>{step === 3 ? 'See Results \u2192' : 'Next \u2192'}</button>
        </div>
      )}
    </>
  );
}

/* -- How it Works -- */
function HowItWorks() {
  return (
    <div className="rice-doc">
      <p>RICE is a prioritisation framework that helps Platform Service evaluate and rank initiatives in a consistent, data-informed way. A higher score indicates higher priority. Scores are <strong>relative</strong> \u2014 most useful when comparing initiatives within the same planning cycle.</p>
      <div className="rice-formula-box">RICE Score = (Reach \u00d7 Impact \u00d7 Confidence) / Effort<br />Effort = (Base Effort \u00d7 Skill Multiplier) + External Dependency</div>

      <h3 className="rice-doc-heading reach">1 \u00b7 Reach</h3>
      <p>Captures the organisational scope \u2014 not just who is touched indirectly, but who actively experiences the change.</p>
      <table className="rice-table"><thead><tr><th>Score</th><th>Definition</th></tr></thead><tbody>
        <tr><td><strong>1</strong></td><td>One team only</td></tr>
        <tr><td><strong>2</strong></td><td>Multiple teams (not the whole function)</td></tr>
        <tr><td><strong>4</strong></td><td>Whole engineering function</td></tr>
        <tr><td><strong>6</strong></td><td>Across multiple functions (e.g. Eng + Ops + Product)</td></tr>
      </tbody></table>

      <h3 className="rice-doc-heading impact">2 \u00b7 Impact</h3>
      <p>Grounded in <strong>DORA metrics</strong> (Deployment Frequency, Lead Time for Changes, Change Failure Rate, MTTR) as the primary measure of engineering health.</p>
      <div className="rice-formula-box">Impact = Primary metric score + (0.5 \u00d7 \u03a3 secondary metrics where score \u2265 2)</div>
      <div className="rice-tip">The highest-scoring metric counts fully. Additional metrics count at 50%, but only if they score \u2265 2.</div>

      <h3 className="rice-doc-heading confidence">3 \u00b7 Confidence</h3>
      <p>A multiplier that discounts the score when there is meaningful uncertainty.</p>
      <table className="rice-table"><thead><tr><th>Multiplier</th><th>Level</th><th>Description</th></tr></thead><tbody>
        <tr><td><strong>\u00d71.00</strong></td><td>Certain</td><td>No realistic way this won\u2019t work.</td></tr>
        <tr><td><strong>\u00d70.75</strong></td><td>High</td><td>Highly probable; risk is marginal and backed by data.</td></tr>
        <tr><td><strong>\u00d70.50</strong></td><td>Medium</td><td>Can\u2019t be sure until we try, but the approach looks promising.</td></tr>
        <tr><td><strong>\u00d70.25</strong></td><td>Low</td><td>A long shot \u2014 experimental or speculative.</td></tr>
      </tbody></table>
      <div className="rice-tip">Don\u2019t game Confidence upward to protect your score. Low-confidence bets can still score highly if their Reach and Impact are large enough.</div>

      <h3 className="rice-doc-heading effort">4 \u00b7 Effort</h3>
      <div className="rice-formula-box">Effort = (Base Effort \u00d7 Skill Multiplier) + External Dependency</div>
      <p>External Dependency is <strong>additive</strong> (not multiplicative) to avoid over-penalising ambitious cross-team initiatives. Total range: <strong>1\u201311</strong>.</p>
      <table className="rice-table"><thead><tr><th>Scenario</th><th>Calculation</th><th>Score</th></tr></thead><tbody>
        <tr><td>1-Beat, DevEx only, no external dep</td><td>(1\u00d71)+0</td><td><strong>1</strong></td></tr>
        <tr><td>2-Beat, DevEx+Foundations, one team</td><td>(2\u00d72)+1</td><td><strong>5</strong></td></tr>
        <tr><td>3-Beat, all of Platform, all teams</td><td>(3\u00d73)+2</td><td><strong>11</strong></td></tr>
      </tbody></table>

      <h3 className="rice-doc-heading">Worked Example</h3>
      <p><strong>Initiative:</strong> Unified test execution layer rolled out across all product teams</p>
      <table className="rice-table"><thead><tr><th>Dimension</th><th>Value</th><th>Rationale</th></tr></thead><tbody>
        <tr><td>Reach</td><td><strong>4</strong></td><td>Whole engineering function</td></tr>
        <tr><td>Impact</td><td><strong>4.0</strong></td><td>Strong DF (3, primary) + noticeable MTTR (2 \u2192 \u00d70.5)</td></tr>
        <tr><td>Confidence</td><td><strong>\u00d70.75</strong></td><td>Backed by DevEx Survey</td></tr>
        <tr><td>Effort</td><td><strong>5</strong></td><td>(2\u00d72)+1</td></tr>
        <tr><td>RICE Score</td><td><strong>2.4</strong></td><td>(4 \u00d7 4.0 \u00d7 0.75) / 5</td></tr>
      </tbody></table>
    </div>
  );
}

/* -- Main component -- */
export default function RiceCalculator({ onBack }: RiceCalculatorProps) {
  const [tab, setTab] = useState<'calculator' | 'how'>('calculator');
  return (
    <div className="rice-page">
      <div className="rice-header">
        <div className="rice-header-top">
          <button className="rice-back-btn" onClick={onBack}>\u2190 Back to Teams</button>
          <h2 className="dash-title">RICE Framework</h2>
          <span className="rice-badge">Platform Service</span>
        </div>
        <div className="rice-tabs">
          <button className={`rice-tab ${tab === 'calculator' ? 'active' : ''}`} onClick={() => setTab('calculator')}>Calculator</button>
          <button className={`rice-tab ${tab === 'how' ? 'active' : ''}`} onClick={() => setTab('how')}>How it Works</button>
        </div>
      </div>
      <div className="rice-body">
        {tab === 'calculator' ? <Calculator /> : <HowItWorks />}
      </div>
    </div>
  );
}

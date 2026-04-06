import { useState } from 'react';
import { useBoard } from '../hooks/useBoard';

export default function CycleStatsPanel() {
  const { state } = useBoard();
  const [collapsed, setCollapsed] = useState(false);
  const stats = state.cycleStats;

  if (!stats) return null;

  const pct = Math.round(stats.progress * 100);

  // Scope increase % = (current - start) / start
  const scopeIncrease =
    stats.scopeStart && stats.scopeCurrent && stats.scopeStart > 0
      ? Math.round(((stats.scopeCurrent - stats.scopeStart) / stats.scopeStart) * 100)
      : null;

  // Completion % of final scope
  const completionPct =
    stats.scopeCurrent && stats.scopeCurrent > 0 && stats.scopeCompleted != null
      ? Math.round((stats.scopeCompleted / stats.scopeCurrent) * 100)
      : null;

  // Increase severity: <10% normal, 10-25% yellow, >25% red
  const increaseClass =
    scopeIncrease === null || scopeIncrease <= 0
      ? ''
      : scopeIncrease < 10
        ? 'mild'
        : scopeIncrease <= 25
          ? 'warn'
          : 'danger';

  return (
    <div className={`cycle-stats-panel ${collapsed ? 'collapsed' : ''}`}>
      <div className="cycle-stats-header" onClick={() => setCollapsed(!collapsed)}>
        <span className="cycle-stats-icon">
          <svg width="14" height="14" viewBox="0 0 100 100" fill="none">
            <path d="M2.4 60.7a50 50 0 0 0 36.9 36.9L2.4 60.7z" fill="currentColor"/>
            <path d="M.2 49.2a50 50 0 0 0 1.3 8.3L46.6 2.4A50 50 0 0 0 .2 49.2z" fill="currentColor"/>
            <path d="M97.6 39.3a50 50 0 0 0-36.9-36.9l36.9 36.9z" fill="currentColor"/>
            <path d="M99.8 50.8a50 50 0 0 0-1.3-8.3L53.4 97.6a50 50 0 0 0 46.4-46.8z" fill="currentColor"/>
          </svg>
        </span>
        {stats.linearUrl ? (
          <a
            className="cycle-stats-title cycle-stats-link"
            href={stats.linearUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="Open in Linear"
          >
            {stats.cycleName}
          </a>
        ) : (
          <span className="cycle-stats-title">{stats.cycleName}</span>
        )}
        <span className="cycle-stats-toggle">{collapsed ? '›' : '‹'}</span>
      </div>

      {!collapsed && (
        <div className="cycle-stats-body">
          <div className="cycle-stats-date">
            {stats.dateRange}
            {stats.owner && <span className="cycle-stats-owner"> · {stats.owner}</span>}
          </div>

          {/* Health badge (projects) */}
          {stats.health && (
            <div className="cycle-stats-health">
              <span className={`linear-badge ${stats.health === 'onTrack' ? 'active' : stats.health === 'atRisk' ? 'warn' : 'danger'}`}>
                {stats.health === 'onTrack' ? 'On Track' : stats.health === 'atRisk' ? 'At Risk' : 'Off Track'}
              </span>
            </div>
          )}

          {/* Progress bar */}
          <div className="cycle-stats-progress">
            <div className="cycle-stats-progress-bar">
              <div className="cycle-stats-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="cycle-stats-progress-label">{pct}%</span>
          </div>

          {/* Scope stats */}
          <div className="cycle-stats-grid">
            {stats.scopeStart != null ? (
              <>
                <div className="cycle-stat-cell">
                  <span className="cycle-stat-value">{stats.scopeStart}</span>
                  <span className="cycle-stat-label">Starting</span>
                </div>
                {stats.scopeCurrent != null && (
                  <div className="cycle-stat-cell">
                    <span className="cycle-stat-value">{stats.scopeCurrent}</span>
                    <span className="cycle-stat-label">Final scope</span>
                  </div>
                )}
                {scopeIncrease !== null && (
                  <div className="cycle-stat-cell">
                    <span className={`cycle-stat-value ${increaseClass}`}>{scopeIncrease > 0 ? '+' : ''}{scopeIncrease}%</span>
                    <span className="cycle-stat-label">Scope change</span>
                  </div>
                )}
                {stats.scopeCompleted != null && (
                  <div className="cycle-stat-cell">
                    <span className="cycle-stat-value done">
                      {stats.scopeCompleted}
                      {completionPct != null && (
                        <span className="cycle-stat-sub"> · {completionPct}%</span>
                      )}
                    </span>
                    <span className="cycle-stat-label">Completed</span>
                  </div>
                )}
              </>
            ) : stats.totalPoints != null && stats.totalPoints > 0 ? (
              <>
                <div className="cycle-stat-cell">
                  <span className="cycle-stat-value">{stats.totalPoints}</span>
                  <span className="cycle-stat-label">Starting</span>
                </div>
                <div className="cycle-stat-cell">
                  <span className="cycle-stat-value">{stats.totalPoints}</span>
                  <span className="cycle-stat-label">Final scope</span>
                </div>
                <div className="cycle-stat-cell">
                  <span className="cycle-stat-value">0%</span>
                  <span className="cycle-stat-label">Scope change</span>
                </div>
                <div className="cycle-stat-cell">
                  <span className="cycle-stat-value done">
                    {stats.donePoints}
                    <span className="cycle-stat-sub"> · {Math.round((stats.donePoints / stats.totalPoints) * 100)}%</span>
                  </span>
                  <span className="cycle-stat-label">Completed</span>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

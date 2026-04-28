import { useState, useEffect, useCallback } from 'react';
import {
  fetchTeams, fetchCycles, fetchCycleIssues,
  fetchProjects, fetchProjectIssues,
  validateApiKey, fetchWorkspaceSlug,
  type LinearTeam, type LinearCycle, type LinearIssue, type LinearProject,
} from '../linearClient';
import { COLORS } from '../types';
import { storage } from '../lib/storage';

interface TemplateOption {
  id: string;
  name: string;
  sections: { title: string; colorIdx: number }[];
}

interface Props {
  onClose: () => void;
  onCreateBoard: (boardData: RetroTemplate) => void;
  templates?: TemplateOption[];
  defaultTemplateId?: string;
  linkedSourceIds?: Set<string>;
}

export interface CycleStatsData {
  cycleName: string;
  teamName: string;
  dateRange: string;
  progress: number;
  totalIssues: number;
  completedIssues: number;
  canceledIssues: number;
  inProgressIssues: number;
  notStartedIssues: number;
  totalPoints: number;
  donePoints: number;
  assignees: { name: string; completed: number; total: number }[];
  owner?: string;
  health?: string | null;
  source: 'cycle' | 'project';
  linearUrl?: string;
  linearSourceId?: string;
  scopeStart?: number;
  scopeCurrent?: number;
  scopeCompleted?: number;
  capacityPoints?: number;
}

export interface RetroTemplate {
  sessionName: string;
  teamName: string;
  beatGoal: string;
  sections: { title: string; colorIdx: number }[];
  cycleStats: CycleStatsData;
  linearTeamId?: string;
  linearTeamKey?: string;
  templateId?: string; // if set, clone this template instead of creating from sections
}

type Mode = 'cycle' | 'project';
type Step = 'connect' | 'choose' | 'team' | 'cycle' | 'project' | 'preview';

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateShort(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function buildStats(
  issues: LinearIssue[],
  name: string,
  teamName: string,
  dateRange: string,
  progress: number,
  source: 'cycle' | 'project',
  owner?: string,
  health?: string | null,
  linearUrl?: string,
  linearSourceId?: string,
  scopeHistory?: number[],
  completedScopeHistory?: number[],
): CycleStatsData {
  const completed = issues.filter((i) => i.state.type === 'completed');
  const canceled = issues.filter((i) => i.state.type === 'canceled');
  const inProgress = issues.filter((i) => i.state.type === 'started');
  const notStarted = issues.filter((i) =>
    i.state.type === 'unstarted' || i.state.type === 'backlog' || i.state.type === 'triage'
  );
  const totalPoints = issues.reduce((s, i) => s + (i.estimate || 0), 0);
  const donePoints = completed.reduce((s, i) => s + (i.estimate || 0), 0);

  const assigneeMap = new Map<string, { completed: number; total: number }>();
  for (const issue of issues) {
    const n = issue.assignee?.name || 'Unassigned';
    const entry = assigneeMap.get(n) || { completed: 0, total: 0 };
    entry.total++;
    if (issue.state.type === 'completed') entry.completed++;
    assigneeMap.set(n, entry);
  }
  const assignees = Array.from(assigneeMap.entries())
    .map(([n, s]) => ({ name: n, ...s }))
    .sort((a, b) => b.completed - a.completed);

  // Scope stats from Linear history arrays
  const scopeStart = scopeHistory && scopeHistory.length > 0 ? scopeHistory[0] : undefined;
  const scopeCurrent = scopeHistory && scopeHistory.length > 0 ? scopeHistory[scopeHistory.length - 1] : undefined;
  const scopeCompleted = completedScopeHistory && completedScopeHistory.length > 0
    ? completedScopeHistory[completedScopeHistory.length - 1]
    : undefined;

  // Capacity: sum of issue estimates at the start (use scopeStart as proxy, or totalPoints as fallback)
  const capacityPoints = scopeStart !== undefined ? scopeStart : totalPoints;

  return {
    cycleName: name,
    teamName,
    dateRange,
    progress,
    totalIssues: issues.length,
    completedIssues: completed.length,
    canceledIssues: canceled.length,
    inProgressIssues: inProgress.length,
    notStartedIssues: notStarted.length,
    totalPoints,
    donePoints,
    assignees,
    owner,
    health,
    source,
    linearUrl,
    linearSourceId,
    scopeStart,
    scopeCurrent,
    scopeCompleted,
    capacityPoints,
  };
}

const LINEAR_SVG = (
  <svg width="16" height="16" viewBox="0 0 100 100" fill="none">
    <path d="M2.4 60.7a50 50 0 0 0 36.9 36.9L2.4 60.7z" fill="currentColor"/>
    <path d="M.2 49.2a50 50 0 0 0 1.3 8.3L46.6 2.4A50 50 0 0 0 .2 49.2z" fill="currentColor"/>
    <path d="M97.6 39.3a50 50 0 0 0-36.9-36.9l36.9 36.9z" fill="currentColor"/>
    <path d="M99.8 50.8a50 50 0 0 0-1.3-8.3L53.4 97.6a50 50 0 0 0 46.4-46.8z" fill="currentColor"/>
  </svg>
);

const DEFAULT_SECTIONS = [
  { title: 'What went well', colorIdx: 3 },
  { title: 'What could be improved', colorIdx: 0 },
];

export default function LinearSync({ onClose, onCreateBoard, templates, defaultTemplateId, linkedSourceIds }: Props) {
  const [step, setStep] = useState<Step>(() =>
    storage.has('linearApiKey') ? 'choose' : 'connect'
  );
  const [mode, setMode] = useState<Mode>('cycle');
  const [apiKey, setApiKey] = useState(() => storage.read('linearApiKey') || '');
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState('');
  const [oauthEnabled, setOauthEnabled] = useState<boolean | null>(null);
  const [showApiKeyFallback, setShowApiKeyFallback] = useState(false);

  useEffect(() => {
    fetch('/api/linear/status').then((r) => r.json()).then((d) => setOauthEnabled(d.oauthEnabled)).catch(() => setOauthEnabled(false));
  }, []);

  const [teams, setTeams] = useState<LinearTeam[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<LinearTeam | null>(null);
  const [teamSearch, setTeamSearch] = useState('');

  const [cycles, setCycles] = useState<LinearCycle[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<LinearCycle | null>(null);

  const [projects, setProjects] = useState<LinearProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<LinearProject | null>(null);

  const [issues, setIssues] = useState<LinearIssue[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [template, setTemplate] = useState<RetroTemplate | null>(null);
  const [orgSlug, setOrgSlug] = useState('');
  const [projectTeamFilter, setProjectTeamFilter] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(defaultTemplateId || '');
  const [templateSearch, setTemplateSearch] = useState('');
  // templatePickerOpen removed — picker now on preview step

  const activeSections = selectedTemplateId
    ? (templates || []).find((t) => t.id === selectedTemplateId)?.sections || DEFAULT_SECTIONS
    : DEFAULT_SECTIONS;

  const key = storage.read('linearApiKey') || apiKey;

  // Fetch workspace slug once we have a key
  useEffect(() => {
    if (!key || step === 'connect') return;
    fetchWorkspaceSlug(key).then(setOrgSlug).catch(() => {});
  }, [key, step]);

  // Load teams when entering team step
  useEffect(() => {
    if (step !== 'team' || !key) return;
    setError('');
    fetchTeams(key).then(setTeams).catch((e) => {
      const msg = e.message || '';
      if (msg.includes('401') || msg.includes('AUTHENTICATION') || msg.includes('not authenticated')) {
        storage.clear('linearApiKey');
        setStep('connect');
        setError('Linear session expired. Please reconnect.');
      } else {
        setError(msg);
      }
    });
  }, [step, key]);

  // Load cycles when team selected
  useEffect(() => {
    if (step !== 'cycle' || !selectedTeam || !key) return;
    setError('');
    fetchCycles(key, selectedTeam.id).then(setCycles).catch((e) => setError(e.message));
  }, [step, selectedTeam, key]);

  // Load projects
  useEffect(() => {
    if (step !== 'project' || !key) return;
    setError('');
    fetchProjects(key).then(setProjects).catch((e) => setError(e.message));
  }, [step, key]);

  const handleConnect = useCallback(async () => {
    setValidating(true);
    setError('');
    const valid = await validateApiKey(apiKey.trim());
    setValidating(false);
    if (valid) {
      storage.write('linearApiKey', apiKey.trim());
      setStep('choose');
    } else {
      setError('Invalid API key. Check it in Linear Settings > Security & Access.');
    }
  }, [apiKey]);

  const handleDisconnect = useCallback(() => {
    storage.clear('linearApiKey');
    setApiKey('');
    setTeams([]);
    setCycles([]);
    setProjects([]);
    setSelectedTeam(null);
    setSelectedCycle(null);
    setSelectedProject(null);
    setStep('connect');
  }, []);

  const handleChooseMode = useCallback((m: Mode) => {
    setMode(m);
    setSelectedTeam(null);
    setSelectedCycle(null);
    setSelectedProject(null);
    setStep('team');
  }, []);

  const handleSelectTeam = useCallback((team: LinearTeam) => {
    setSelectedTeam(team);
    setSelectedCycle(null);
    setSelectedProject(null);
    setCycles([]);
    if (mode === 'cycle') setStep('cycle');
    else setStep('project');
  }, [mode]);

  const handleSelectCycle = useCallback(async (cycle: LinearCycle) => {
    setSelectedCycle(cycle);
    setLoadingIssues(true);
    setError('');
    try {
      const iss = await fetchCycleIssues(key, cycle.id);
      setIssues(iss);
      const cycleName = cycle.name || `Cycle ${cycle.number}`;
      const dateRange = `${formatDateShort(cycle.startsAt)} - ${formatDateShort(cycle.endsAt)}`;
      const cycleUrl = orgSlug && selectedTeam
        ? `https://linear.app/${orgSlug}/team/${selectedTeam.key}/cycle/${cycle.number}`
        : undefined;
      const stats = buildStats(iss, cycleName, selectedTeam!.name, dateRange, cycle.progress, 'cycle', undefined, undefined, cycleUrl, cycle.id, cycle.scopeHistory, cycle.completedScopeHistory);

      setTemplate({
        sessionName: cycleName,
        teamName: selectedTeam!.name,
        beatGoal: cycle.description || '',
        sections: activeSections,
        cycleStats: stats,
        linearTeamId: selectedTeam!.id,
        linearTeamKey: selectedTeam!.key,
        templateId: selectedTemplateId || undefined,
      });
      setStep('preview');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load issues');
    }
    setLoadingIssues(false);
  }, [key, selectedTeam, activeSections, selectedTemplateId]);

  const handleSelectProject = useCallback(async (project: LinearProject) => {
    setSelectedProject(project);
    setLoadingIssues(true);
    setError('');
    try {
      const iss = await fetchProjectIssues(key, project.id);
      setIssues(iss);

      const parts: string[] = [];
      if (project.startDate) parts.push(formatDate(project.startDate));
      if (project.targetDate) parts.push(formatDate(project.targetDate));
      const dateRange = parts.join(' - ') || 'No dates set';

      const owner = project.lead?.name;
      const projectUrl = orgSlug
        ? `https://linear.app/${orgSlug}/project/${project.slugId}`
        : undefined;
      const stats = buildStats(
        iss, project.name, owner || '', dateRange,
        project.progress, 'project', owner, project.health, projectUrl, project.id,
      );

      setTemplate({
        sessionName: project.name,
        teamName: owner || '',
        beatGoal: project.description || '',
        sections: activeSections,
        cycleStats: stats,
        linearTeamId: selectedTeam?.id || project.teams?.nodes?.[0]?.id,
        linearTeamKey: selectedTeam?.key || project.teams?.nodes?.[0]?.key,
        templateId: selectedTemplateId || undefined,
      });
      setStep('preview');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load issues');
    }
    setLoadingIssues(false);
  }, [key, activeSections, selectedTeam, selectedTemplateId]);

  const handleCreate = useCallback(() => {
    if (template) {
      onCreateBoard({
        ...template,
        sections: activeSections,
        templateId: selectedTemplateId || undefined,
      });
    }
  }, [template, onCreateBoard, activeSections, selectedTemplateId]);

  const resetToChoose = useCallback(() => {
    setStep('choose');
    setSelectedTeam(null);
    setSelectedCycle(null);
    setSelectedProject(null);
  }, []);

  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="linear-modal" onClick={(e) => e.stopPropagation()}>
        <button className="dash-modal-close" onClick={onClose}>✕</button>

        {/* Breadcrumb */}
        <div className="linear-breadcrumb">
          <span className="linear-breadcrumb-icon">{LINEAR_SVG}</span>
          <span className="linear-breadcrumb-link" onClick={step !== 'connect' && step !== 'choose' ? resetToChoose : undefined}>
            Linear
          </span>
          {step !== 'connect' && step !== 'choose' && (
            <>
              <span className="linear-breadcrumb-sep">/</span>
              <span className="linear-breadcrumb-link" onClick={resetToChoose}>
                {mode === 'cycle' ? 'Cycle Retro' : 'Project Retro'}
              </span>
            </>
          )}
          {selectedTeam && (
            <>
              <span className="linear-breadcrumb-sep">/</span>
              <span className="linear-breadcrumb-link" onClick={() => { setStep('team'); setSelectedTeam(null); setSelectedCycle(null); setSelectedProject(null); setTeamSearch(''); }}>
                {selectedTeam.name}
              </span>
            </>
          )}
          {(selectedCycle || selectedProject) && step === 'preview' && (
            <>
              <span className="linear-breadcrumb-sep">/</span>
              <span className="linear-breadcrumb-link" onClick={() => {
                if (mode === 'cycle') { setStep('cycle'); setSelectedCycle(null); }
                else { setStep('project'); setSelectedProject(null); }
              }}>
                {selectedCycle ? (selectedCycle.name || `Cycle ${selectedCycle.number}`) : selectedProject?.name}
              </span>
            </>
          )}
        </div>

        {error && <div className="linear-error">{error}</div>}

        {/* Step: Connect */}
        {step === 'connect' && (
          <div className="linear-step">
            <h3 className="linear-step-title">Connect Linear</h3>
            {oauthEnabled ? (
              <>
                <p className="linear-step-desc">
                  Sign in with your Linear account to import cycles and projects.
                </p>
                <button
                  className="btn btn-primary dash-modal-btn linear-oauth-btn"
                  onClick={() => {
                    const returnTo = window.location.pathname + window.location.search;
                    window.location.href = `/api/linear/auth?return_to=${encodeURIComponent(returnTo)}`;
                  }}
                >
                  {LINEAR_SVG} Connect with Linear
                </button>
                {!showApiKeyFallback && (
                  <button
                    className="linear-apikey-toggle"
                    onClick={() => setShowApiKeyFallback(true)}
                  >
                    Or use an API key instead
                  </button>
                )}
                {showApiKeyFallback && (
                  <div className="linear-apikey-fallback">
                    <p className="linear-step-desc">
                      Paste your personal API key from Linear Settings &gt; Security &amp; Access.
                    </p>
                    <input
                      className="dash-modal-input"
                      type="password"
                      placeholder="lin_api_..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && apiKey.trim() && handleConnect()}
                      autoFocus
                    />
                    <button
                      className="btn btn-primary dash-modal-btn"
                      disabled={!apiKey.trim() || validating}
                      onClick={handleConnect}
                    >
                      {validating ? 'Validating...' : 'Connect'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="linear-step-desc">
                  Enter your personal API key from Linear Settings &gt; Security &amp; Access.
                </p>
                <input
                  className="dash-modal-input"
                  type="password"
                  placeholder="lin_api_..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && apiKey.trim() && handleConnect()}
                  autoFocus
                />
                <button
                  className="btn btn-primary dash-modal-btn"
                  disabled={!apiKey.trim() || validating}
                  onClick={handleConnect}
                >
                  {validating ? 'Validating...' : 'Connect'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Step: Choose mode */}
        {step === 'choose' && (
          <div className="linear-step">
            <div className="linear-step-header">
              <h3 className="linear-step-title">Create Retro From</h3>
              <button className="linear-disconnect" onClick={handleDisconnect}>Disconnect</button>
            </div>
            <div className="linear-mode-cards">
              <div className="linear-mode-card" onClick={() => handleChooseMode('cycle')}>
                <span className="linear-mode-icon">&#x27F3;</span>
                <span className="linear-mode-label">Cycle</span>
                <span className="linear-mode-desc">Sprint retrospective from a team cycle</span>
              </div>
              <div className="linear-mode-card" onClick={() => handleChooseMode('project')}>
                <span className="linear-mode-icon">&#x25C7;</span>
                <span className="linear-mode-label">Project</span>
                <span className="linear-mode-desc">Project retrospective across teams</span>
              </div>
            </div>

          </div>
        )}

        {/* Step: Select Team (cycle mode) */}
        {step === 'team' && (
          <div className="linear-step">
            <h3 className="linear-step-title">Select Team</h3>
            {teams.length === 0 && !error ? (
              <div className="dash-loading">
                <div className="dash-loading-spinner" />
                Loading teams...
              </div>
            ) : (
              <>
                <input
                  className="linear-search-input"
                  placeholder="Search teams..."
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                  autoFocus
                />
                <div className="linear-list">
                  {teams
                    .filter((t) => mode === 'project' || t.cyclesEnabled)
                    .filter((t) => !teamSearch || t.name.toLowerCase().includes(teamSearch.toLowerCase()) || t.key.toLowerCase().includes(teamSearch.toLowerCase()))
                    .map((team) => (
                      <div key={team.id} className="linear-list-item" onClick={() => { handleSelectTeam(team); setTeamSearch(''); }}>
                        <span className="linear-team-key">{team.key}</span>
                        <span className="linear-team-name">{team.name}</span>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Step: Select Cycle */}
        {step === 'cycle' && (
          <div className="linear-step">
            <h3 className="linear-step-title">Select Cycle</h3>
            {cycles.length === 0 && !error ? (
              <div className="dash-loading">
                <div className="dash-loading-spinner" />
                Loading cycles...
              </div>
            ) : (
              <div className="linear-list">
                {cycles.filter((c) => !linkedSourceIds?.has(c.id) && (c.isActive || c.isPast || new Date(c.startsAt) <= new Date())).map((cycle) => (
                  <div
                    key={cycle.id}
                    className={`linear-list-item ${loadingIssues && selectedCycle?.id === cycle.id ? 'loading' : ''}`}
                    onClick={() => !loadingIssues && handleSelectCycle(cycle)}
                  >
                    <div className="linear-cycle-info">
                      <span className="linear-cycle-name">{cycle.name || `Cycle ${cycle.number}`}</span>
                      <span className="linear-cycle-dates">
                        {formatDateShort(cycle.startsAt)} - {formatDateShort(cycle.endsAt)}
                      </span>
                    </div>
                    <div className="linear-cycle-meta">
                      {cycle.isActive && <span className="linear-badge active">Active</span>}
                      {cycle.isPast && <span className="linear-badge past">Past</span>}
                      <span className="linear-cycle-progress">{Math.round(cycle.progress * 100)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step: Select Project */}
        {step === 'project' && (() => {
          const closedProjects = projects.filter((p) =>
            p.status?.type === 'completed' || p.status?.type === 'canceled' || p.completedAt
          );
          const unlinked = closedProjects.filter((p) => !linkedSourceIds?.has(p.id));
          const teamFiltered = selectedTeam
            ? unlinked.filter((p) => p.teams.nodes.some((t) => t.id === selectedTeam.id))
            : unlinked;
          const query = projectSearch.toLowerCase().trim();
          const filtered = teamFiltered
            .filter((p) => !query || p.name.toLowerCase().includes(query) || (p.lead?.name || '').toLowerCase().includes(query));

          return (
            <div className="linear-step">
              <h3 className="linear-step-title">Select Project</h3>
              {projects.length === 0 && !error ? (
                <div className="dash-loading">
                  <div className="dash-loading-spinner" />
                  Loading projects...
                </div>
              ) : (
                <>
                  <input
                    className="linear-search-input"
                    placeholder="Search projects..."
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    autoFocus
                  />
                  {filtered.length === 0 ? (
                    <div className="linear-empty">No closed projects found{selectedTeam ? ` for ${selectedTeam.name}` : ''}</div>
                  ) : (
                    <div className="linear-list">
                      {filtered.map((project) => (
                        <div
                          key={project.id}
                          className={`linear-list-item ${loadingIssues && selectedProject?.id === project.id ? 'loading' : ''}`}
                          onClick={() => !loadingIssues && handleSelectProject(project)}
                        >
                          <div className="linear-cycle-info">
                            <span className="linear-cycle-name">{project.name}</span>
                            <span className="linear-cycle-dates">
                              {project.lead?.name || 'No lead'}
                              {project.status ? ` · ${project.status.name}` : ''}
                            </span>
                          </div>
                          <div className="linear-cycle-meta">
                            <span className="linear-cycle-progress">{Math.round(project.progress * 100)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })()}

        {/* Step: Preview & Create */}
        {step === 'preview' && template && (
          <div className="linear-step">
            <h3 className="linear-step-title">Retro Board Preview</h3>
            <div className="linear-preview">
              <div className="linear-preview-header">
                <strong>{template.sessionName}</strong>
                {template.teamName && <span className="linear-preview-team">{template.teamName}</span>}
              </div>
              {template.beatGoal && (
                <div className="linear-preview-goal">Goal: {template.beatGoal}</div>
              )}
              {(() => {
                const cs = template.cycleStats;
                const startPts = cs.scopeStart ?? 0;
                const totalPts = cs.scopeCurrent ?? cs.totalPoints ?? 0;
                const donePts = cs.scopeCompleted ?? cs.donePoints ?? 0;
                const scopeChange = startPts > 0 ? Math.round(((totalPts - startPts) / startPts) * 100) : 0;
                const scopeChangeClass = scopeChange <= 0 ? '' : scopeChange < 10 ? 'mild' : scopeChange <= 25 ? 'warn' : 'danger';
                const completionPct = totalPts > 0 ? Math.round((donePts / totalPts) * 100) : 0;
                return totalPts > 0 ? (
                  <div className="team-tab-cycle-stats-grid" style={{ margin: '10px 0' }}>
                    <div className="team-tab-cycle-stat">
                      <span className="tt-stat-val">{startPts}</span>
                      <span className="tt-stat-lbl">Starting</span>
                    </div>
                    <div className="team-tab-cycle-stat">
                      <span className="tt-stat-val">{totalPts}</span>
                      <span className="tt-stat-lbl">Final scope</span>
                    </div>
                    <div className="team-tab-cycle-stat">
                      <span className={`tt-stat-val ${scopeChangeClass}`}>{scopeChange > 0 ? '+' : ''}{scopeChange}%</span>
                      <span className="tt-stat-lbl">Scope change</span>
                    </div>
                    <div className="team-tab-cycle-stat">
                      <span className="tt-stat-val tt-stat-done">{donePts} <span className="tt-stat-sub">· {completionPct}%</span></span>
                      <span className="tt-stat-lbl">Completed</span>
                    </div>
                  </div>
                ) : null;
              })()}
            </div>

            {(() => {
              const allTemplates = templates || [];
              const filtered = templateSearch
                ? allTemplates.filter((t) => t.name.toLowerCase().includes(templateSearch.toLowerCase()))
                : allTemplates;
              return (
                <div className="ttcm-template-section">
                  <div className="ttcm-template-header">
                    <label className="ttcm-label">Template</label>
                    <input
                      className="ttcm-search"
                      type="text"
                      placeholder="Search..."
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                    />
                  </div>
                  <div className="ttcm-template-list">
                    {!templateSearch && (
                      <div
                        className={`ttcm-template-option ${!selectedTemplateId ? 'active' : ''}`}
                        onClick={() => setSelectedTemplateId('')}
                      >
                        <span className="ttcm-tpl-name">Blank</span>
                        <span className="ttcm-tpl-sections">
                          <span className="linear-tpl-pill" style={{ background: '#4ADE8022', color: '#4ADE80' }}>What went well</span>
                          <span className="linear-tpl-pill" style={{ background: '#F8717122', color: '#F87171' }}>What could be improved</span>
                        </span>
                      </div>
                    )}
                    {filtered.map((t) => (
                      <div
                        key={t.id}
                        className={`ttcm-template-option ${selectedTemplateId === t.id ? 'active' : ''}`}
                        onClick={() => setSelectedTemplateId(t.id)}
                      >
                        <span className="ttcm-tpl-name">{t.name}</span>
                        <span className="ttcm-tpl-sections">
                          {t.sections.slice(0, 4).map((s, i) => (
                            <span key={i} className="linear-tpl-pill" style={{ background: COLORS[s.colorIdx % COLORS.length] + '22', color: COLORS[s.colorIdx % COLORS.length] }}>{s.title}</span>
                          ))}
                          {t.sections.length > 4 && <span className="linear-tpl-pill-more">+{t.sections.length - 4}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <button className="btn btn-primary dash-modal-btn" onClick={handleCreate}>
              Create Retro Board
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

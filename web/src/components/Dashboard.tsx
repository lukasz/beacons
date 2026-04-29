import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTheme } from '../hooks/useTheme';
import type { AuthUser } from '../hooks/useAuth';
import LinearSync, { type RetroTemplate, buildStats } from './LinearSync';
import { COLORS } from '../types';
import type { Team } from '../types';
import {
  fetchTeams as fetchLinearTeams, fetchTeamMembers, createIssue,
  fetchCycles, fetchProjects, fetchCycleIssues, fetchProjectIssues,
  type LinearTeam, type LinearMember, type LinearCycle, type LinearProject,
} from '../linearClient';
import { storage } from '../lib/storage';
import { timeAgo } from '../lib/time';
import {
  boards as boardsService,
  type BoardListItem,
  type TemplateBoardItem,
  type GlobalActionItem,
} from '../services/boards';
import { teams as teamsService } from '../services/teams';
import { actions as actionsService } from '../services/actions';
import TeamManager from '../pages/dashboard/teams/TeamManager';
import TeamTabCreateModal from '../pages/dashboard/teams/TeamTabCreateModal';
import TeamTabSelector from '../pages/dashboard/teams/TeamTabSelector';
import TeamMultiSelect from '../pages/dashboard/teams/TeamMultiSelect';
import NewBoardModal from '../pages/dashboard/modals/NewBoardModal';
import TemplatePickerModal from '../pages/dashboard/modals/TemplatePickerModal';

// Local aliases — keep callsites readable; types come from services/boards.
type BoardSummary = BoardListItem;
type TemplateBoardSummary = TemplateBoardItem;
type GlobalAction = GlobalActionItem;

// ---- Types ----

export interface TemplateSection {
  title: string;
  colorIdx: number;
}

export interface Template {
  id: string;
  name: string;
  sections: TemplateSection[];
  user_id: string;
  created_at: string;
  updated_at: string;
}

const RICE_ENABLED_TEAM = 'Platform';

interface Props {
  user: AuthUser;
  defaultRoomId: string | null;
  defaultTab?: string;
  onCreateRoom: () => void;
  onCreateFromTemplate: (sections: TemplateSection[], extra?: { sessionName?: string; teamName?: string; teamId?: string; cycleStats?: unknown }) => void;
  onCreateTemplate: () => void;
  onEditTemplate: (id: string) => void;
  onUseTemplate: (templateId: string) => void;
  onJoinRoom: (roomId: string) => void;
  onTabChange?: (tab: string) => void;
  onSignOut: () => void;
  onNavigateRice?: () => void;
}

type Tab = 'boards' | 'actions' | 'teams';

export default function Dashboard({ user, defaultRoomId, defaultTab, onCreateRoom, onCreateFromTemplate, onCreateTemplate, onEditTemplate, onUseTemplate, onJoinRoom, onTabChange, onSignOut, onNavigateRice }: Props) {
  const validTabs: Tab[] = ['boards', 'actions', 'teams'];
  const initialTab = (defaultTab && validTabs.includes(defaultTab as Tab)) ? defaultTab as Tab : 'boards';
  const [tab, setTabState] = useState<Tab>(initialTab);

  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    onTabChange?.(t);
  }, [onTabChange]);

  // Board state
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [roomCode, setRoomCode] = useState(defaultRoomId || '');
  const [joinOpen, setJoinOpen] = useState(!!defaultRoomId);
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [menuBoardId, setMenuBoardId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // New board modal
  const [newBoardOpen, setNewBoardOpen] = useState(false);
  const [linearOpen, setLinearOpen] = useState(false);
  const [templatePickOpen, setTemplatePickOpen] = useState(false);
  const [preSelectedTemplateId, setPreSelectedTemplateId] = useState<string | null>(null);
  const [teamTabCreatePending, setTeamTabCreatePending] = useState<{ type: 'cycle' | 'project'; item: LinearCycle | LinearProject } | null>(null);

  // Actions state
  const [globalActions, setGlobalActions] = useState<GlobalAction[]>([]);
  const [actionSessionFilter, setActionSessionFilter] = useState<Set<string>>(new Set());
  const [actionLinearFilter, setActionLinearFilter] = useState<'all' | 'with' | 'without'>('all');
  const [actionDoneFilter, setActionDoneFilter] = useState<'all' | 'done' | 'open'>('all');
  const [actionTeamFilter, setActionTeamFilter] = useState<Set<string>>(new Set());
  const [actionTeamDropdownOpen, setActionTeamDropdownOpen] = useState(false);
  const [actionSessionDropdownOpen, setActionSessionDropdownOpen] = useState(false);
  const [actionSessionSearch, setActionSessionSearch] = useState('');

  // Linear ticket creation from dashboard
  const [dLinearActionId, setDLinearActionId] = useState<string | null>(null);
  const [dLinearBoardId, setDLinearBoardId] = useState<string | null>(null);
  const [dLinearStep, setDLinearStep] = useState<'team' | 'assignee' | 'creating' | 'done'>('team');
  const [dLinearError, setDLinearError] = useState('');
  const [dLinearLoading, setDLinearLoading] = useState(false);
  const [dTeams, setDTeams] = useState<LinearTeam[]>([]);
  const [dMembers, setDMembers] = useState<LinearMember[]>([]);
  const [dSelectedTeamId, setDSelectedTeamId] = useState<string | null>(null);
  const [dSelectedMemberId, setDSelectedMemberId] = useState('');
  const [dMemberSearch, setDMemberSearch] = useState('');
  const [dCreatedTicket, setDCreatedTicket] = useState<{ url: string; key: string } | null>(null);

  // Team state
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamFilters, setSelectedTeamFilters] = useState<string[]>([]); // empty = all, team ids or 'free-range'
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamAssignBoardId, setTeamAssignBoardId] = useState<string | null>(null);

  // Team tab state
  const [teamTabSelectedId, setTeamTabSelectedId] = useState<string | null>(() =>
    storage.read('teamTabSelected') || null
  );
  const [teamTabCycles, setTeamTabCycles] = useState<LinearCycle[]>([]);
  const [teamTabProjects, setTeamTabProjects] = useState<LinearProject[]>([]);
  const [teamTabLoading, setTeamTabLoading] = useState(false);
  const [teamTabVelocity, setTeamTabVelocity] = useState<number[]>([]);
  const [teamTabProjectStatuses, setTeamTabProjectStatuses] = useState<string[]>(['Completed', 'Shipped']);
  const [teamTabProjectStatusOpen, setTeamTabProjectStatusOpen] = useState(false);
  const [teamTabProjectSearch, setTeamTabProjectSearch] = useState('');
  const [teamBoardSearch, setTeamBoardSearch] = useState('');
  const [teamBoardShowArchived, setTeamBoardShowArchived] = useState(false);
  const [teamActionSessionFilter, setTeamActionSessionFilter] = useState<string>('all');
  const [teamActionLinearFilter, setTeamActionLinearFilter] = useState<'all' | 'with' | 'without'>('all');
  const [teamActionDoneFilter, setTeamActionDoneFilter] = useState<'all' | 'done' | 'open'>('all');

  // Template boards state (templates are now real boards with is_template=true)
  const [templateBoards, setTemplateBoards] = useState<TemplateBoardSummary[]>([]);
  const [templateBoardsLoading, setTemplateBoardsLoading] = useState(true);
  const [templateConfirmDelete, setTemplateConfirmDelete] = useState<string | null>(null);

  const { theme, toggleTheme } = useTheme();
  const isGeek = theme === 'dark';
  const PAGE_SIZE = 12;

  // ---- Board fetching ----

  const fetchBoards = useCallback(async () => {
    setLoading(true);
    try {
      const list = await boardsService.list();
      setBoards(list);
    } catch (err) { console.error('Failed to fetch boards:', err); }
    setLoading(false);
  }, []);

  const fetchActions = useCallback(async () => {
    try {
      const list = await boardsService.listGlobalActions(user.id);
      setGlobalActions(list);
    } catch (err) { console.error('Failed to fetch actions:', err); }
  }, [user.id]);

  // ---- Team fetching ----

  const fetchTeamsData = useCallback(async () => {
    try {
      const teamRows = await teamsService.list();
      if (teamRows.length === 0) { setTeams([]); return; }
      // Auto-join: ensure current user is a member of every team.
      await teamsService.ensureMembershipsForAll(user.id, teamRows.map((t) => t.id));
      setTeams(teamRows);
    } catch (err) { console.error('Failed to fetch teams:', err); }
  }, [user.id]);

  // ---- Template boards fetching ----

  const fetchTemplates = useCallback(async () => {
    setTemplateBoardsLoading(true);
    try {
      const list = await boardsService.listTemplates();
      setTemplateBoards(list);
    } catch (err) { console.error('Failed to fetch template boards:', err); }
    setTemplateBoardsLoading(false);
  }, []);

  useEffect(() => { fetchBoards(); fetchTemplates(); fetchTeamsData(); }, [fetchBoards, fetchTemplates, fetchTeamsData]);

  // Lazy-load actions only when actions tab is selected
  const actionsFetched = useRef(false);
  useEffect(() => {
    if ((tab === 'actions' || tab === 'teams') && !actionsFetched.current) {
      actionsFetched.current = true;
      fetchActions();
    }
  }, [tab, fetchActions]);

  // ---- Team tab data loading ----

  useEffect(() => {
    if (tab !== 'teams' || !teamTabSelectedId) return;
    const apiKey = storage.read('linearApiKey');
    const team = teams.find((t) => t.id === teamTabSelectedId);
    if (!team?.linearTeamId || !apiKey) {
      setTeamTabCycles([]);
      setTeamTabProjects([]);
      setTeamTabVelocity([]);
      return;
    }
    setTeamTabLoading(true);
    const linearTeamId = team.linearTeamId;

    Promise.all([
      fetchCycles(apiKey, linearTeamId).catch((e) => {
        if (String(e).includes('401')) storage.clear('linearApiKey');
        return [] as LinearCycle[];
      }),
      fetchProjects(apiKey).then((all) =>
        all.filter((p) => p.teams.nodes.some((t) => t.id === linearTeamId))
      ).catch((e) => {
        if (String(e).includes('401')) storage.clear('linearApiKey');
        return [] as LinearProject[];
      }),
    ]).then(([cyc, proj]) => {
      setTeamTabCycles(cyc);
      setTeamTabProjects(proj);
      // Compute velocity from recent completed cycles (last 5, oldest to newest for chart)
      const completedCycles = [...cyc]
        .filter((c) => c.completedAt || c.isPast)
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
        .slice(-5);
      setTeamTabVelocity(completedCycles.map((c) => {
        const done = c.completedScopeHistory?.[c.completedScopeHistory.length - 1] || 0;
        return done;
      }));
      setTeamTabLoading(false);
    });
  }, [tab, teamTabSelectedId, teams]);

  // ---- Action helpers ----

  const toggleActionDone = useCallback(async (action: GlobalAction) => {
    const newDone = !action.done;
    // Optimistic update
    setGlobalActions((prev) =>
      prev.map((a) => (a.id === action.id && a.boardId === action.boardId) ? { ...a, done: newDone } : a),
    );
    try {
      // The service flips the action's `done` flag on the source board's
      // state. We always flip in the same direction here because the
      // service is idempotent.
      if (newDone) {
        await actionsService.markDoneOnSourceBoard(action.boardId, action.id);
      } else {
        // Reopen via direct state patch — read, flip back to false, write.
        const state = await boardsService.getState(action.boardId);
        if (state) {
          const stateActions = (state.actions ?? {}) as Record<string, Record<string, unknown>>;
          if (stateActions[action.id]) {
            stateActions[action.id] = { ...stateActions[action.id], done: false };
            await boardsService.updateState(action.boardId, { ...state, actions: stateActions });
          }
        }
      }
    } catch (e) {
      console.error('Failed to update action:', e);
      // Revert optimistic update
      setGlobalActions((prev) =>
        prev.map((a) => (a.id === action.id && a.boardId === action.boardId) ? { ...a, done: !newDone } : a),
      );
    }
  }, []);

  const handleDashLinearOpen = useCallback(async (action: GlobalAction) => {
    const apiKey = storage.read('linearApiKey');
    if (!apiKey) {
      setDLinearError('Connect Linear first from the dashboard (use "From Linear" when creating a board)');
      setDLinearActionId(action.id);
      setDLinearBoardId(action.boardId);
      setDLinearStep('team');
      return;
    }
    setDLinearActionId(action.id);
    setDLinearBoardId(action.boardId);
    setDLinearStep('team');
    setDLinearError('');
    setDLinearLoading(true);
    try {
      const t = await fetchLinearTeams(apiKey);
      setDTeams(t);
    } catch (e) {
      setDLinearError(e instanceof Error ? e.message : 'Failed to load teams');
    }
    setDLinearLoading(false);
  }, []);

  const handleDashTeamSelect = useCallback(async (teamId: string) => {
    const apiKey = storage.read('linearApiKey');
    if (!apiKey) return;
    setDSelectedTeamId(teamId);
    setDLinearLoading(true);
    setDLinearError('');
    try {
      const m = await fetchTeamMembers(apiKey, teamId);
      setDMembers(m);
      setDLinearStep('assignee');
    } catch (e) {
      setDLinearError(e instanceof Error ? e.message : 'Failed to load members');
    }
    setDLinearLoading(false);
  }, []);

  const handleDashCreateTicket = useCallback(async () => {
    const apiKey = storage.read('linearApiKey');
    if (!apiKey || !dSelectedTeamId || !dLinearActionId || !dLinearBoardId) return;
    const action = globalActions.find((a) => a.id === dLinearActionId && a.boardId === dLinearBoardId);
    if (!action) return;
    setDLinearStep('creating');
    setDLinearError('');
    try {
      const result = await createIssue(apiKey, dSelectedTeamId, action.text, dSelectedMemberId || undefined);
      // Update local state
      setGlobalActions((prev) =>
        prev.map((a) => (a.id === action.id && a.boardId === action.boardId)
          ? { ...a, linearUrl: result.url, linearKey: result.identifier }
          : a),
      );
      await actionsService.updateLinearLinkOnSourceBoard(
        action.boardId,
        action.id,
        { url: result.url, key: result.identifier },
      );
      setDCreatedTicket({ url: result.url, key: result.identifier });
      setDLinearStep('done');
    } catch (e) {
      setDLinearError(e instanceof Error ? e.message : 'Failed to create ticket');
      setDLinearStep('assignee');
    }
  }, [dSelectedTeamId, dSelectedMemberId, dLinearActionId, dLinearBoardId, globalActions]);

  const handleDashLinearClose = useCallback(() => {
    setDLinearActionId(null);
    setDLinearBoardId(null);
    setDLinearStep('team');
    setDLinearError('');
    setDSelectedTeamId(null);
    setDSelectedMemberId('');
    setDMemberSearch('');
    setDCreatedTicket(null);
  }, []);

  // ---- Team CRUD ----

  const handleCreateTeam = useCallback(async (name: string, linearTeamId?: string, linearTeamKey?: string) => {
    try {
      await teamsService.create({ name, linearTeamId, linearTeamKey, ownerUserId: user.id });
      fetchTeamsData();
    } catch (err) { console.error('Failed to create team:', err); }
  }, [user.id, fetchTeamsData]);

  const handleUpdateTeam = useCallback(async (team: Team) => {
    try {
      await teamsService.update({
        id: team.id,
        name: team.name,
        linearTeamId: team.linearTeamId,
        linearTeamKey: team.linearTeamKey,
      });
      fetchTeamsData();
    } catch (err) { console.error('Failed to update team:', err); }
  }, [fetchTeamsData]);

  const handleDeleteTeam = useCallback(async (teamId: string) => {
    try {
      await teamsService.remove(teamId);
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
      setSelectedTeamFilters((prev) => prev.filter((id) => id !== teamId));
    } catch (err) { console.error('Failed to delete team:', err); }
  }, []);

  const handleAssignBoardToTeam = useCallback(async (boardId: string, teamId: string | null) => {
    setTeamAssignBoardId(null);
    setMenuBoardId(null);
    // Optimistic update
    setBoards((prev) => prev.map((b) => b.id === boardId ? { ...b, teamId } : b));
    try {
      const team = teamId ? teams.find((t) => t.id === teamId) : null;
      await boardsService.attachToTeam(boardId, team ? { id: team.id, name: team.name } : null);
    } catch (err) {
      console.error('Failed to assign board to team:', err);
      fetchBoards();
    }
  }, [fetchBoards, teams]);

  // ---- Board actions ----

  const handleCodeChange = useCallback((val: string) => {
    setRoomCode(val.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16));
  }, []);

  const handleJoin = useCallback(() => {
    const code = roomCode.trim();
    if (code) onJoinRoom(code);
  }, [roomCode, onJoinRoom]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && roomCode.trim()) handleJoin();
  }, [roomCode, handleJoin]);

  const handleArchive = useCallback(async (boardId: string, archive: boolean) => {
    setMenuBoardId(null);
    setBoards((prev) => prev.map((b) => b.id === boardId ? { ...b, archived: archive } : b));
    try {
      await boardsService.setArchived(boardId, archive);
    } catch {
      setBoards((prev) => prev.map((b) => b.id === boardId ? { ...b, archived: !archive } : b));
    }
  }, []);

  const handleDeleteBoard = useCallback(async (boardId: string) => {
    setConfirmDelete(null); setMenuBoardId(null);
    setBoards((prev) => prev.filter((b) => b.id !== boardId));
    try {
      await boardsService.remove(boardId);
    } catch {
      fetchBoards();
    }
  }, [fetchBoards]);

  // ---- New board creation ----

  const handleLinearCreate = useCallback(async (template: RetroTemplate) => {
    setLinearOpen(false); setNewBoardOpen(false); setPreSelectedTemplateId(null);

    // Auto-match or auto-create a Beacons team from the Linear team
    let matchedTeamId: string | null = null;
    const linearTeamId = template.linearTeamId;
    const linearTeamKey = template.linearTeamKey;

    if (linearTeamId) {
      // Try to find existing Beacons team mapped to this Linear team
      const existing = teams.find((t) => t.linearTeamId === linearTeamId);
      if (existing) {
        matchedTeamId = existing.id;
      } else {
        // Auto-create a Beacons team mapped to this Linear team
        const teamName = template.cycleStats?.teamName || linearTeamKey || 'Team';
        try {
          matchedTeamId = await teamsService.create({
            name: teamName,
            linearTeamId,
            linearTeamKey,
            ownerUserId: user.id,
          });
          fetchTeamsData(); // refresh team list in background
        } catch (e) { console.error('Auto-create team failed:', e); }
      }
    }

    // For team boards, set teamName to the Beacons team name
    const matchedTeam = matchedTeamId
      ? teams.find((t) => t.id === matchedTeamId) || (linearTeamKey ? { name: template.cycleStats?.teamName || linearTeamKey } : null)
      : null;

    try {
      const teamName = matchedTeam?.name || template.teamName;
      const created = template.templateId
        ? await boardsService.cloneTemplate(template.templateId, {
            sessionName: template.sessionName,
            teamName,
            beatGoal: template.beatGoal,
            teamId: matchedTeamId || '',
            userId: user.id,
            userName: user.name,
            cycleStats: template.cycleStats,
          })
        : await boardsService.createFromTemplate({
            ...template,
            teamName,
            userId: user.id,
            userName: user.name,
            teamId: matchedTeamId || '',
          });
      // Also set team_id directly on the boards table column
      if (matchedTeamId) {
        await boardsService.attachToTeam(created.id, matchedTeam ? { id: matchedTeamId, name: matchedTeam.name } : null);
      }
      onJoinRoom(created.id);
    } catch (err) { console.error('Failed to create board from template:', err); }
  }, [user.id, user.name, onJoinRoom, teams, fetchTeamsData]);

  // Step 1: user clicks "Create Board" → show preview modal with template picker
  const handleTeamTabCreateBoard = useCallback((type: 'cycle' | 'project', item: LinearCycle | LinearProject) => {
    setTeamTabCreatePending({ type, item });
  }, []);

  // Step 2: user clicks "Create" in preview modal → actually create the board
  const handleTeamTabConfirmCreate = useCallback(async (templateId: string | null) => {
    const pending = teamTabCreatePending;
    setTeamTabCreatePending(null);
    if (!pending) return;

    const team = teams.find((t) => t.id === teamTabSelectedId);
    if (!team?.linearTeamId) return;
    const apiKey = storage.read('linearApiKey');
    if (!apiKey) return;

    const tpl = templateId ? templateBoards.find((t) => t.id === templateId) : null;
    const sections = tpl?.sections || [{ title: 'What went well', colorIdx: 3 }, { title: 'What could be improved', colorIdx: 0 }];

    try {
      if (pending.type === 'cycle') {
        const cycle = pending.item as LinearCycle;
        const iss = await fetchCycleIssues(apiKey, cycle.id);
        const cycleName = cycle.name || `Cycle ${cycle.number}`;
        const dateRange = `${new Date(cycle.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(cycle.endsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        const stats = buildStats(iss, cycleName, team.name, dateRange, cycle.progress, 'cycle', undefined, undefined, undefined, cycle.id, cycle.scopeHistory, cycle.completedScopeHistory);
        await handleLinearCreate({
          sessionName: cycleName,
          teamName: team.name,
          beatGoal: cycle.description || '',
          sections,
          cycleStats: stats,
          linearTeamId: team.linearTeamId,
          linearTeamKey: team.linearTeamKey,
          templateId: templateId || undefined,
        });
      } else {
        const project = pending.item as LinearProject;
        const iss = await fetchProjectIssues(apiKey, project.id);
        const dateRange = project.startDate
          ? `${new Date(project.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${project.targetDate ? ' - ' + new Date(project.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}`
          : '';
        const stats = buildStats(iss, project.name, team.name, dateRange, project.progress, 'project', project.lead?.name || undefined, project.health, project.url, project.id);
        await handleLinearCreate({
          sessionName: project.name,
          teamName: team.name,
          beatGoal: project.description || '',
          sections,
          cycleStats: stats,
          linearTeamId: team.linearTeamId,
          linearTeamKey: team.linearTeamKey,
          templateId: templateId || undefined,
        });
      }
    } catch (e) { console.error('Failed to create board from team tab:', e); }
  }, [teamTabCreatePending, teams, teamTabSelectedId, templateBoards, handleLinearCreate]);

  const handlePickTemplate = useCallback((tpl: TemplateBoardSummary) => {
    setTemplatePickOpen(false); setNewBoardOpen(false); setPreSelectedTemplateId(null);
    onUseTemplate(tpl.id);
  }, [onUseTemplate]);

  const handleUseTemplateFromList = useCallback((templateId: string) => {
    setPreSelectedTemplateId(templateId);
    setNewBoardOpen(true);
  }, []);

  const handleFreeRange = useCallback(() => {
    setNewBoardOpen(false); setPreSelectedTemplateId(null);
    onCreateRoom();
  }, [onCreateRoom]);

  const handleDeleteTemplate = useCallback(async (id: string) => {
    setTemplateConfirmDelete(null);
    setTemplateBoards((prev) => prev.filter((t) => t.id !== id));
    try {
      await boardsService.remove(id);
    } catch {
      fetchTemplates();
    }
  }, [fetchTemplates]);

  // ---- Board filtering ----

  const activeBoards = boards.filter((b) => !b.archived);
  const archivedBoards = boards.filter((b) => b.archived);
  const baseBoards = showArchived ? archivedBoards : activeBoards;

  // Team filtering (multiselect: empty = all)
  const teamFilteredBoards = selectedTeamFilters.length === 0
    ? baseBoards
    : baseBoards.filter((b) => {
        if (selectedTeamFilters.includes('free-range') && !b.teamId) return true;
        if (b.teamId && selectedTeamFilters.includes(b.teamId)) return true;
        return false;
      });

  const query = searchQuery.toLowerCase().trim();
  const filteredBoards = query
    ? teamFilteredBoards.filter((b) =>
        b.sessionName.toLowerCase().includes(query) ||
        b.teamName.toLowerCase().includes(query) ||
        b.id.toLowerCase().includes(query) ||
        b.participants.some((p) => p.name.toLowerCase().includes(query))
      )
    : teamFilteredBoards;
  const totalPages = Math.max(1, Math.ceil(filteredBoards.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const displayBoards = filteredBoards.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <div className="dashboard">
      {/* Top bar */}
      <div className="dash-topbar">
        <div className="dash-topbar-left">
          <div className="dash-brand">
            <img src="/logo.png" alt="Beacons" className="dash-logo" />
            <span className="dash-brand-name">Beacons</span>
          </div>
          <nav className="dash-nav">
            <button className={`dash-nav-item ${tab === 'boards' ? 'active' : ''}`} onClick={() => setTab('boards')}>
              Boards
            </button>
            <button className={`dash-nav-item ${tab === 'actions' ? 'active' : ''}`} onClick={() => setTab('actions')}>
              Actions
            </button>
            <button className={`dash-nav-item ${tab === 'teams' ? 'active' : ''}`} onClick={() => setTab('teams')}>
              Team
            </button>
          </nav>
        </div>
        <div className="dash-topbar-right">
          <div className="theme-toggle" onClick={toggleTheme}>
            <span className="theme-toggle-label">{isGeek ? 'Geek Mode' : 'Vanilla Mode'}</span>
            <div className={`theme-toggle-track ${isGeek ? 'geek' : ''}`}>
              <div className="theme-toggle-thumb">{isGeek ? '🌙' : '☀️'}</div>
            </div>
          </div>
          <div className="dash-user">
            {user.avatarUrl && <img src={user.avatarUrl} alt="" className="dash-user-avatar" referrerPolicy="no-referrer" />}
            <span className="dash-user-name">{user.name}</span>
            <button className="dash-sign-out" onClick={onSignOut}>Sign out</button>
          </div>
        </div>
      </div>

      {/* ============ BOARDS TAB ============ */}
      {tab === 'boards' && (
        <div className="dash-content">
          <div className="dash-header">
            <div className="dash-header-left">
              <h2 className="dash-title">Your Boards</h2>
              {archivedBoards.length > 0 && (
                <button
                  className={`dash-tab ${showArchived ? 'active' : ''}`}
                  onClick={() => { setShowArchived(!showArchived); setPage(0); }}
                >
                  Archived ({archivedBoards.length})
                </button>
              )}
              <TeamMultiSelect
                teams={teams}
                selected={selectedTeamFilters}
                onChange={(v) => { setSelectedTeamFilters(v); setPage(0); }}
                onManage={() => setTeamModalOpen(true)}
              />
              {(baseBoards.length > 0 || searchQuery) && (
                <div className="dash-search">
                  <input
                    className="dash-search-input"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                  />
                  {searchQuery && (
                    <button className="dash-search-clear" onClick={() => { setSearchQuery(''); setPage(0); }}>✕</button>
                  )}
                </div>
              )}
            </div>
            <div className="dash-actions">
              <button className="btn btn-primary" onClick={() => setNewBoardOpen(true)}>
                + New Board
              </button>
              <button
                className={`btn ${joinOpen ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setJoinOpen(!joinOpen)}
              >
                Join Board
              </button>
            </div>
          </div>

          {/* Board list */}
          {loading ? (
            <div className="dash-loading"><div className="dash-loading-spinner" />Loading boards...</div>
          ) : filteredBoards.length === 0 ? (
            <div className="dash-empty">
              <div className="dash-empty-icon">{searchQuery ? '🔍' : showArchived ? '🗄' : '🔥'}</div>
              <h3>{searchQuery ? 'No matching boards' : showArchived ? 'No archived boards' : 'No boards yet'}</h3>
              <p>{searchQuery ? 'Try a different search term.' : showArchived ? 'Boards you archive will appear here.' : 'Create a new board or join an existing one to get started.'}</p>
            </div>
          ) : (
            <div className="dash-board-grid">
              {displayBoards.map((board) => (
                <div
                  key={board.id}
                  className={`dash-board-card ${board.archived ? 'dash-card-archived' : ''}`}
                  onClick={() => onJoinRoom(board.id)}
                  onContextMenu={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    setMenuBoardId(board.id); setMenuPos({ x: e.clientX, y: e.clientY });
                  }}
                >
                  <div className="dash-card-header">
                    <span className="dash-card-name">{board.sessionName || 'Untitled Board'}</span>
                    {(() => {
                      const team = board.teamId ? teams.find((t) => t.id === board.teamId) : null;
                      const byName = team ? team.name : board.teamName;
                      return byName ? <span className="dash-card-team">by {byName}</span> : null;
                    })()}
                  </div>
                  <div className="dash-card-stats">
                    <span className="dash-card-stat">{board.actionCount} actions</span>
                    <span className="dash-card-stat-sep">·</span>
                    <span className="dash-card-stat">{board.stickyCount} stickies</span>
                  </div>
                  <div className="dash-card-footer">
                    <div className="dash-card-participants">
                      {board.participants.slice(0, 5).map((p) => (
                        <span key={p.id} className="dash-card-avatar" title={p.name}>{p.name.charAt(0).toUpperCase()}</span>
                      ))}
                      {board.participants.length > 5 && (
                        <span className="dash-card-avatar dash-card-avatar-more">+{board.participants.length - 5}</span>
                      )}
                    </div>
                    <span className="dash-card-time">{timeAgo(board.updatedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="dash-pagination">
              <button className="dash-page-btn" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>‹ Prev</button>
              <span className="dash-page-info">{safePage + 1} / {totalPages}</span>
              <button className="dash-page-btn" disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)}>Next ›</button>
            </div>
          )}

          {/* ---- Templates section ---- */}
          <div className="dash-templates-section">
            <div className="dash-section-header">
              <h3 className="dash-section-title">Templates</h3>
              <button className="btn btn-small btn-secondary" onClick={onCreateTemplate}>+ New Template</button>
            </div>
            {templateBoardsLoading ? (
              <div className="dash-loading" style={{ padding: '12px 0' }}><div className="dash-loading-spinner" />Loading...</div>
            ) : templateBoards.length === 0 ? (
              <p className="dash-templates-empty">No templates yet. Create one to quickly set up boards.</p>
            ) : (
              <div className="dash-board-grid">
                {templateBoards.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="dash-board-card dash-template-card"
                    onClick={() => onEditTemplate(tpl.id)}
                  >
                    <div className="dash-card-header">
                      <span className="dash-card-name">{tpl.sessionName || 'Untitled Template'}</span>
                    </div>
                    {tpl.sections.length > 0 && (
                      <div className="dash-template-sections">
                        {tpl.sections.map((sec, i) => (
                          <div key={i} className="dash-template-section-pill" style={{ background: COLORS[sec.colorIdx % COLORS.length] + '22', color: COLORS[sec.colorIdx % COLORS.length] }}>
                            <span className="dash-template-section-dot" style={{ background: COLORS[sec.colorIdx % COLORS.length] }} />
                            {sec.title || 'Untitled'}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="dash-card-stats">
                      <span className="dash-card-stat">{tpl.sectionCount} sections</span>
                      <span className="dash-card-stat-sep">·</span>
                      <span className="dash-card-stat">{tpl.stickyCount} stickies</span>
                    </div>
                    <div className="dash-card-footer">
                      <button
                        className="btn btn-small btn-primary"
                        onClick={(e) => { e.stopPropagation(); handleUseTemplateFromList(tpl.id); }}
                      >
                        Use Template
                      </button>
                      <button
                        className="btn btn-small btn-danger"
                        onClick={(e) => { e.stopPropagation(); setTemplateConfirmDelete(tpl.id); }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ============ ACTIONS TAB ============ */}
      {tab === 'actions' && (() => {
        // Unique sessions for filter dropdown
        const sessionOptions = Array.from(new Set(globalActions.map((a) => a.boardId)))
          .map((boardId) => {
            const a = globalActions.find((x) => x.boardId === boardId)!;
            return { boardId, label: a.sessionName || boardId, teamName: a.teamName || '' };
          });

        const filtered = globalActions.filter((a) => {
          if (actionSessionFilter.size > 0 && !actionSessionFilter.has(a.boardId)) return false;
          if (actionLinearFilter === 'with' && !a.linearUrl) return false;
          if (actionLinearFilter === 'without' && a.linearUrl) return false;
          if (actionDoneFilter === 'done' && !a.done) return false;
          if (actionDoneFilter === 'open' && a.done) return false;
          if (actionTeamFilter.size > 0) {
            if (actionTeamFilter.has('free-range') && !a.teamId) return true;
            if (a.teamId && actionTeamFilter.has(a.teamId)) return true;
            return false;
          }
          return true;
        });

        // Sort: open first, done at bottom; within each group, chronological (newest first)
        const sorted = [...filtered].sort((a, b) => {
          if (a.done !== b.done) return a.done ? 1 : -1;
          return b.createdAt - a.createdAt;
        });

        return (
          <div className="dash-content">
            <div className="dash-header">
              <div className="dash-header-left">
                <h2 className="dash-title">All Actions</h2>
                <div className="actions-stats">
                  <span className="actions-stat">{filtered.filter((a) => !a.done).length} Open</span>
                  <span className="actions-stat actions-stat-done">{filtered.filter((a) => a.done).length} Completed</span>
                  <span className="actions-stat actions-stat-linear">{filtered.filter((a) => !a.done && a.linearUrl).length} In Linear</span>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="actions-filters">
              {/* Team multiselect */}
              {teams.length > 0 && (
                <div className="af-group">
                  <label className="af-label">Team</label>
                  <div className="af-multi">
                    <button
                      className={`af-multi-btn ${actionTeamFilter.size > 0 ? 'has-value' : ''}`}
                      onClick={() => setActionTeamDropdownOpen(!actionTeamDropdownOpen)}
                    >
                      {actionTeamFilter.size === 0
                        ? 'All teams'
                        : actionTeamFilter.size === 1
                          ? (actionTeamFilter.has('free-range') ? 'Free range' : teams.find((t) => actionTeamFilter.has(t.id))?.name || 'Selected')
                          : `${actionTeamFilter.size} teams`}
                      <span className="af-multi-caret">▾</span>
                    </button>
                    {actionTeamDropdownOpen && (
                      <>
                        <div className="af-backdrop" onClick={() => setActionTeamDropdownOpen(false)} />
                        <div className="af-dropdown">
                          <div
                            className={`af-dropdown-item ${actionTeamFilter.size === 0 ? 'active' : ''}`}
                            onClick={() => { setActionTeamFilter(new Set()); setActionTeamDropdownOpen(false); }}
                          >
                            <span className="af-check">{actionTeamFilter.size === 0 ? '✓' : ''}</span>
                            All teams
                          </div>
                          {teams.map((t) => (
                            <div
                              key={t.id}
                              className={`af-dropdown-item ${actionTeamFilter.has(t.id) ? 'active' : ''}`}
                              onClick={() => {
                                const next = new Set(actionTeamFilter);
                                if (next.has(t.id)) next.delete(t.id); else next.add(t.id);
                                setActionTeamFilter(next);
                              }}
                            >
                              <span className="af-check">{actionTeamFilter.has(t.id) ? '✓' : ''}</span>
                              {t.name}
                            </div>
                          ))}
                          <div
                            className={`af-dropdown-item ${actionTeamFilter.has('free-range') ? 'active' : ''}`}
                            onClick={() => {
                              const next = new Set(actionTeamFilter);
                              if (next.has('free-range')) next.delete('free-range'); else next.add('free-range');
                              setActionTeamFilter(next);
                            }}
                          >
                            <span className="af-check">{actionTeamFilter.has('free-range') ? '✓' : ''}</span>
                            Free range
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Session multiselect with search */}
              {(() => {
                const q = actionSessionSearch.toLowerCase().trim();
                const recent = sessionOptions.slice(0, 5);
                const searchResults = q
                  ? sessionOptions.filter((s) => s.label.toLowerCase().includes(q) || s.teamName.toLowerCase().includes(q))
                  : [];
                return (
                  <div className="af-group">
                    <label className="af-label">Session</label>
                    <div className="af-multi">
                      <button
                        className={`af-multi-btn ${actionSessionFilter.size > 0 ? 'has-value' : ''}`}
                        onClick={() => { setActionSessionDropdownOpen(!actionSessionDropdownOpen); setActionSessionSearch(''); }}
                      >
                        {actionSessionFilter.size === 0
                          ? 'All sessions'
                          : actionSessionFilter.size === 1
                            ? (() => { const s = sessionOptions.find((s) => actionSessionFilter.has(s.boardId)); return s ? (s.teamName ? `${s.label} · ${s.teamName}` : s.label) : 'Selected'; })()
                            : `${actionSessionFilter.size} sessions`}
                        <span className="af-multi-caret">▾</span>
                      </button>
                      {actionSessionDropdownOpen && (
                        <>
                          <div className="af-backdrop" onClick={() => setActionSessionDropdownOpen(false)} />
                          <div className="af-dropdown af-dropdown-sessions">
                            <input
                              className="af-search"
                              placeholder="Search sessions..."
                              value={actionSessionSearch}
                              onChange={(e) => setActionSessionSearch(e.target.value)}
                              autoFocus
                            />
                            <div
                              className={`af-dropdown-item ${actionSessionFilter.size === 0 ? 'active' : ''}`}
                              onClick={() => { setActionSessionFilter(new Set()); setActionSessionDropdownOpen(false); }}
                            >
                              <span className="af-check">{actionSessionFilter.size === 0 ? '✓' : ''}</span>
                              All sessions
                            </div>
                            {!q && recent.length > 0 && (
                              <>
                                <div className="af-dropdown-divider">Recent</div>
                                {recent.map((s) => (
                                  <div
                                    key={s.boardId}
                                    className={`af-dropdown-item ${actionSessionFilter.has(s.boardId) ? 'active' : ''}`}
                                    onClick={() => {
                                      const next = new Set(actionSessionFilter);
                                      if (next.has(s.boardId)) next.delete(s.boardId); else next.add(s.boardId);
                                      setActionSessionFilter(next);
                                    }}
                                  >
                                    <span className="af-check">{actionSessionFilter.has(s.boardId) ? '✓' : ''}</span>
                                    <span className="af-session-label">{s.label}{s.teamName && <span className="af-session-team">by {s.teamName}</span>}</span>
                                  </div>
                                ))}
                                {sessionOptions.length > 5 && (
                                  <div className="af-dropdown-divider">All</div>
                                )}
                              </>
                            )}
                            {(q ? searchResults : sessionOptions.slice(5)).map((s) => (
                              <div
                                key={s.boardId}
                                className={`af-dropdown-item ${actionSessionFilter.has(s.boardId) ? 'active' : ''}`}
                                onClick={() => {
                                  const next = new Set(actionSessionFilter);
                                  if (next.has(s.boardId)) next.delete(s.boardId); else next.add(s.boardId);
                                  setActionSessionFilter(next);
                                }}
                              >
                                <span className="af-check">{actionSessionFilter.has(s.boardId) ? '✓' : ''}</span>
                                <span className="af-session-label">{s.label}{s.teamName && <span className="af-session-team">by {s.teamName}</span>}</span>
                              </div>
                            ))}
                            {q && searchResults.length === 0 && (
                              <div className="af-dropdown-empty">No matches</div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Linear toggle */}
              <div className="af-group">
                <label className="af-label">Linear</label>
                <div className="af-toggle">
                  {(['all', 'with', 'without'] as const).map((v) => (
                    <button
                      key={v}
                      className={`af-toggle-btn ${actionLinearFilter === v ? 'active' : ''}`}
                      onClick={() => setActionLinearFilter(v)}
                    >
                      {v === 'all' ? 'All' : v === 'with' ? 'Linked' : 'No ticket'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status toggle */}
              <div className="af-group">
                <label className="af-label">Status</label>
                <div className="af-toggle">
                  {(['all', 'open', 'done'] as const).map((v) => (
                    <button
                      key={v}
                      className={`af-toggle-btn ${actionDoneFilter === v ? 'active' : ''}`}
                      onClick={() => setActionDoneFilter(v)}
                    >
                      {v === 'all' ? 'All' : v === 'open' ? 'Open' : 'Done'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions grid */}
            {loading ? (
              <div className="dash-loading">Loading actions...</div>
            ) : sorted.length === 0 ? (
              <div className="dash-empty">No actions found</div>
            ) : (
              <div className="actions-grid">
                {sorted.map((a) => (
                  <div key={`${a.boardId}-${a.id}`} className={`action-card ${a.done ? 'done' : ''}`}>
                    <div className="action-card-top">
                      <button
                        className={`action-check ${a.done ? 'checked' : ''}`}
                        onClick={() => toggleActionDone(a)}
                        title={a.done ? 'Mark as open' : 'Mark as done'}
                      >
                        {a.done ? '✓' : ''}
                      </button>
                      <div className="action-card-text">{a.text}</div>
                    </div>
                    <div className="action-card-footer">
                      <button
                        className="action-session-link"
                        onClick={() => onJoinRoom(a.boardId)}
                        title="Open this board"
                      >
                        {a.sessionName || a.boardId}
                      </button>
                      {a.teamName && <span className="action-team">{a.teamName}</span>}
                      <span className="action-date">{new Date(a.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="action-card-actions">
                      {a.linearUrl ? (
                        <a
                          href={a.linearUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="action-linear-badge"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {a.linearKey || 'Linear'}
                        </a>
                      ) : (
                        <button
                          className="action-create-ticket-btn"
                          onClick={() => handleDashLinearOpen(a)}
                        >
                          + Linear ticket
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ============ TEAMS TAB ============ */}
      {tab === 'teams' && (() => {
        const selectedTeam = teamTabSelectedId ? teams.find((t) => t.id === teamTabSelectedId) : null;
        const teamBoards = selectedTeam ? boards.filter((b) => b.teamId === selectedTeam.id) : [];
        const findLinkedBoard = (sourceId: string) => teamBoards.find((b) => b.linearSourceId === sourceId);

        // Cycles: newest first
        const allCycles = [...teamTabCycles]
          .filter((c) => new Date(c.startsAt).getTime() <= Date.now())
          .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

        // Projects — build status counts using status name as key
        const statusCountsArr: { name: string; count: number }[] = [];
        const _seen = new Map<string, number>();
        for (const p of teamTabProjects) {
          const st = p.status?.name || 'Unknown';
          if (_seen.has(st)) {
            statusCountsArr[_seen.get(st)!].count++;
          } else {
            _seen.set(st, statusCountsArr.length);
            statusCountsArr.push({ name: st, count: 1 });
          }
        }
        // Filter: empty array = show all; otherwise match by status name
        const filteredProjects = teamTabProjects
          .filter((p) => {
            if (teamTabProjectStatuses.length > 0) {
              const st = p.status?.name || 'Unknown';
              if (!teamTabProjectStatuses.includes(st)) return false;
            }
            if (teamTabProjectSearch.trim()) {
              const q = teamTabProjectSearch.trim().toLowerCase();
              const name = p.name.toLowerCase();
              const lead = (p.lead?.name || '').toLowerCase();
              const labels = (p.projectLabels?.nodes || []).map((l) => l.name.toLowerCase()).join(' ');
              if (!name.includes(q) && !lead.includes(q) && !labels.includes(q)) return false;
            }
            return true;
          })
          .sort((a, b) => {
            const da = a.completedAt || a.targetDate || a.startDate || '';
            const db = b.completedAt || b.targetDate || b.startDate || '';
            return new Date(db).getTime() - new Date(da).getTime();
          });

        // Actions for this team
        // Actions for this team — with filters (session, linear, status) but team is hardcoded
        const teamActions = selectedTeam
          ? globalActions.filter((a) => a.teamId === selectedTeam.id)
          : [];
        const teamActionSessionOptions = Array.from(new Set(teamActions.map((a) => a.boardId)))
          .map((boardId) => {
            const a = teamActions.find((x) => x.boardId === boardId)!;
            return { boardId, label: a.sessionName || a.teamName || boardId };
          });
        const teamActionsFiltered = teamActions.filter((a) => {
          if (teamActionSessionFilter !== 'all' && a.boardId !== teamActionSessionFilter) return false;
          if (teamActionLinearFilter === 'with' && !a.linearUrl) return false;
          if (teamActionLinearFilter === 'without' && a.linearUrl) return false;
          if (teamActionDoneFilter === 'done' && !a.done) return false;
          if (teamActionDoneFilter === 'open' && a.done) return false;
          return true;
        });
        const teamActionsSorted = [...teamActionsFiltered].sort((a, b) => {
          if (a.done !== b.done) return a.done ? 1 : -1;
          return b.createdAt - a.createdAt;
        });

        // Boards — with search + archived toggle, team is hardcoded
        const baseTeamBoards = teamBoardShowArchived
          ? teamBoards.filter((b) => b.archived)
          : teamBoards.filter((b) => !b.archived);
        const archivedTeamBoards = teamBoards.filter((b) => b.archived);
        const filteredTeamBoards = teamBoardSearch
          ? baseTeamBoards.filter((b) =>
              (b.sessionName || '').toLowerCase().includes(teamBoardSearch.toLowerCase())
            )
          : baseTeamBoards;

        return (
          <div className="dash-content">
            <div className="dash-header">
              <div className="dash-header-left">
                <h2 className="dash-title">{selectedTeam ? selectedTeam.name : 'Teams'}</h2>
                {selectedTeam?.linearTeamKey && (
                  <span className="team-tab-header-key">{selectedTeam.linearTeamKey}</span>
                )}
                {selectedTeam?.name === RICE_ENABLED_TEAM && onNavigateRice && (
                  <button className="rice-link-btn" onClick={onNavigateRice}>RICE</button>
                )}
              </div>
              <div className="dash-actions">
                <TeamTabSelector
                  teams={teams}
                  selectedId={teamTabSelectedId}
                  onSelect={(id) => { setTeamTabSelectedId(id); setTeamTabProjectStatuses([]); setTeamTabProjectSearch(''); setTeamBoardSearch(''); setTeamBoardShowArchived(false); setTeamActionSessionFilter('all'); setTeamActionLinearFilter('all'); setTeamActionDoneFilter('all'); if (id) storage.write('teamTabSelected', id); else storage.clear('teamTabSelected'); }}
                />
                <button className="btn btn-primary" onClick={() => setTeamModalOpen(true)}>
                  + New Team
                </button>
              </div>
            </div>

            {teams.length === 0 ? (
              <div className="dash-empty">
                <div className="dash-empty-icon">👥</div>
                <h3>No teams yet</h3>
                <p>Create a team to organize your boards and track velocity.</p>
              </div>
            ) : !selectedTeam ? (
              <div className="dash-empty">
                <div className="dash-empty-icon">👥</div>
                <h3>Select a team</h3>
                <p>Choose a team from the dropdown to view its dashboard.</p>
              </div>
            ) : teamTabLoading ? (
              <div className="dash-loading"><div className="dash-loading-spinner" />Loading team data...</div>
            ) : (
              <div className="team-tab-dashboard">
                {/* Two-column: Cycles + Projects */}
                <div className="team-tab-two-col">
                  {/* Connect to Linear prompt when team is mapped but no API key */}
                  {selectedTeam.linearTeamId && !storage.read('linearApiKey') && (
                    <div className="team-tab-connect-linear">
                      <svg width="24" height="24" viewBox="0 0 100 100" fill="none" style={{ opacity: 0.6 }}>
                        <path d="M2.4 60.7a50 50 0 0 0 36.9 36.9L2.4 60.7z" fill="currentColor"/>
                        <path d="M.2 49.2a50 50 0 0 0 1.3 8.3L46.6 2.4A50 50 0 0 0 .2 49.2z" fill="currentColor"/>
                        <path d="M97.6 39.3a50 50 0 0 0-36.9-36.9l36.9 36.9z" fill="currentColor"/>
                        <path d="M99.8 50.8a50 50 0 0 0-1.3-8.3L53.4 97.6a50 50 0 0 0 46.4-46.8z" fill="currentColor"/>
                      </svg>
                      <p>Connect to Linear to see cycles, projects, and velocity for this team.</p>
                      <button
                        className="btn btn-primary linear-oauth-btn"
                        onClick={() => {
                          const returnTo = window.location.pathname + window.location.search;
                          window.location.href = `/api/linear/auth?return_to=${encodeURIComponent(returnTo)}`;
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 100 100" fill="none">
                          <path d="M2.4 60.7a50 50 0 0 0 36.9 36.9L2.4 60.7z" fill="currentColor"/>
                          <path d="M.2 49.2a50 50 0 0 0 1.3 8.3L46.6 2.4A50 50 0 0 0 .2 49.2z" fill="currentColor"/>
                          <path d="M97.6 39.3a50 50 0 0 0-36.9-36.9l36.9 36.9z" fill="currentColor"/>
                          <path d="M99.8 50.8a50 50 0 0 0-1.3-8.3L53.4 97.6a50 50 0 0 0 46.4-46.8z" fill="currentColor"/>
                        </svg>
                        {' '}Connect with Linear
                      </button>
                    </div>
                  )}
                  {/* ---- Cycles Box ---- */}
                  {selectedTeam.linearTeamId && (() => {
                    const activeCycle = allCycles.find((c) => c.isActive);
                    const pastCycles = allCycles.filter((c) => !c.isActive && (c.isPast || c.completedAt || new Date(c.startsAt) <= new Date()));

                    // Active cycle stats helpers
                    const acTotal = activeCycle ? (activeCycle.scopeHistory?.[activeCycle.scopeHistory.length - 1] || 0) : 0;
                    const acDone = activeCycle ? (activeCycle.completedScopeHistory?.[activeCycle.completedScopeHistory.length - 1] || 0) : 0;
                    const acStart = activeCycle ? (activeCycle.scopeHistory?.[0] || 0) : 0;
                    const acAdded = acTotal > acStart ? acTotal - acStart : 0;
                    const acOpen = acTotal - acDone;
                    const acLinked = activeCycle ? findLinkedBoard(activeCycle.id) : undefined;

                    // Working days calculation
                    const countWorkdays = (start: Date, end: Date) => {
                      let count = 0;
                      const d = new Date(start);
                      while (d <= end) {
                        const day = d.getDay();
                        if (day !== 0 && day !== 6) count++;
                        d.setDate(d.getDate() + 1);
                      }
                      return count;
                    };
                    const acTotalDays = activeCycle ? countWorkdays(new Date(activeCycle.startsAt), new Date(activeCycle.endsAt)) : 0;
                    const acElapsedDays = activeCycle ? countWorkdays(new Date(activeCycle.startsAt), new Date()) : 0;
                    const acRemainingDays = Math.max(0, acTotalDays - acElapsedDays);

                    return (
                      <div className="team-tab-box">
                        {/* Active cycle hero header */}
                        {activeCycle ? (
                          <div className="team-tab-cycle-hero">
                            <div className="team-tab-cycle-hero-top">
                              <div className="team-tab-cycle-hero-left">
                                <span className="team-tab-badge team-tab-badge-active">Active</span>
                                <span className="team-tab-cycle-hero-name">{activeCycle.name || `Cycle ${activeCycle.number}`}</span>
                              </div>
                              <div className="team-tab-cycle-hero-right">
                                <span className="team-tab-cycle-hero-pct">{Math.round(activeCycle.progress * 100)}%</span>
                                {acRemainingDays > 0 && (
                                  <span className="team-tab-cycle-hero-days-big">{acRemainingDays} days left</span>
                                )}
                              </div>
                            </div>
                            <div className="team-tab-cycle-hero-dates">
                              {new Date(activeCycle.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(activeCycle.endsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              <span className="team-tab-cycle-hero-days">
                                Day {acElapsedDays} of {acTotalDays}
                              </span>
                            </div>
                            <div className="team-tab-card-bar team-tab-hero-bar">
                              <div className="team-tab-card-bar-fill" style={{ width: `${Math.round(activeCycle.progress * 100)}%` }} />
                            </div>
                            {acTotal > 0 && (
                              <div className="team-tab-cycle-hero-stats">
                                <span className="team-tab-hero-stat"><span className="tt-hero-val tt-hero-done">{acDone}</span> delivered</span>
                                <span className="team-tab-hero-stat"><span className="tt-hero-val">{acOpen}</span> open</span>
                                <span className="team-tab-hero-stat"><span className="tt-hero-val">{acTotal}</span> total pts</span>
                                {acAdded > 0 && <span className="team-tab-hero-stat"><span className="tt-hero-val tt-hero-added">+{acAdded}</span> added</span>}
                              </div>
                            )}
                            <div className="team-tab-cycle-hero-action">
                              {acLinked ? (
                                <button className="btn btn-small btn-secondary" onClick={() => onJoinRoom(acLinked.id)}>Go to Board</button>
                              ) : (
                                <button className="btn btn-small btn-primary" onClick={() => handleTeamTabCreateBoard('cycle', activeCycle)}>Create Board</button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="team-tab-box-header">
                            <h3 className="team-tab-box-title">Cycles</h3>
                            <span className="team-tab-box-count">{pastCycles.length}</span>
                          </div>
                        )}

                        {/* Past cycles list */}
                        {pastCycles.length === 0 && !activeCycle ? (
                          <div className="team-tab-box-empty">No cycles found</div>
                        ) : pastCycles.length > 0 ? (() => {
                          // Compute average from last 3 completed cycles
                          const completedPast = pastCycles.filter((c) => c.completedAt || c.isPast);
                          const last3 = completedPast.slice(0, 3);
                          const avg = last3.length > 0 ? {
                            starting: Math.round(last3.reduce((s, c) => s + (c.scopeHistory?.[0] || 0), 0) / last3.length),
                            final: Math.round(last3.reduce((s, c) => s + (c.scopeHistory?.[c.scopeHistory.length - 1] || 0), 0) / last3.length),
                            completed: Math.round(last3.reduce((s, c) => s + (c.completedScopeHistory?.[c.completedScopeHistory.length - 1] || 0), 0) / last3.length),
                            scopeChange: (() => {
                              const avgStart = last3.reduce((s, c) => s + (c.scopeHistory?.[0] || 0), 0) / last3.length;
                              const avgFinal = last3.reduce((s, c) => s + (c.scopeHistory?.[c.scopeHistory.length - 1] || 0), 0) / last3.length;
                              return avgStart > 0 ? Math.round(((avgFinal - avgStart) / avgStart) * 100) : 0;
                            })(),
                          } : null;
                          const avgChangeClass = !avg || avg.scopeChange <= 0 ? '' : avg.scopeChange < 10 ? 'mild' : avg.scopeChange <= 25 ? 'warn' : 'danger';

                          return (
                            <>
                              {/* Average from last 3 completed */}
                              {avg && last3.length >= 2 && (
                                <div className="team-tab-cycle-avg">
                                  <div className="team-tab-cycle-avg-label">Avg last {last3.length} cycles</div>
                                  <div className="team-tab-cycle-stats-grid">
                                    <div className="team-tab-cycle-stat">
                                      <span className="tt-stat-val">{avg.starting}</span>
                                      <span className="tt-stat-lbl">Starting</span>
                                    </div>
                                    <div className="team-tab-cycle-stat">
                                      <span className="tt-stat-val">{avg.final}</span>
                                      <span className="tt-stat-lbl">Final scope</span>
                                    </div>
                                    <div className="team-tab-cycle-stat">
                                      <span className={`tt-stat-val ${avgChangeClass}`}>{avg.scopeChange > 0 ? '+' : ''}{avg.scopeChange}%</span>
                                      <span className="tt-stat-lbl">Scope change</span>
                                    </div>
                                    <div className="team-tab-cycle-stat">
                                      <span className="tt-stat-val tt-stat-done">{avg.completed}</span>
                                      <span className="tt-stat-lbl">Completed</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                              <div className="team-tab-box-scroll">
                                {pastCycles.map((cycle) => {
                                  const linked = findLinkedBoard(cycle.id);
                                  const totalPts = cycle.scopeHistory?.[cycle.scopeHistory.length - 1] || 0;
                                  const donePts = cycle.completedScopeHistory?.[cycle.completedScopeHistory.length - 1] || 0;
                                  const startPts = cycle.scopeHistory?.[0] || 0;
                                  const scopeChange = startPts > 0 ? Math.round(((totalPts - startPts) / startPts) * 100) : 0;
                                  const scopeChangeClass = scopeChange <= 0 ? '' : scopeChange < 10 ? 'mild' : scopeChange <= 25 ? 'warn' : 'danger';
                                  const completionPct = totalPts > 0 ? Math.round((donePts / totalPts) * 100) : 0;
                                  return (
                                    <div key={cycle.id} className="team-tab-cycle">
                                      <div className="team-tab-cycle-row1">
                                        <span className="team-tab-cycle-name">{cycle.name || `Cycle ${cycle.number}`}</span>
                                        <span style={{ flex: 1 }} />
                                        {linked ? (
                                          <button className="btn btn-small btn-secondary" onClick={() => onJoinRoom(linked.id)}>Go to Board</button>
                                        ) : (
                                          <button className="btn btn-small btn-secondary" onClick={() => handleTeamTabCreateBoard('cycle', cycle)}>Create Board</button>
                                        )}
                                      </div>
                                      <div className="team-tab-cycle-row2">
                                        <span className="team-tab-cycle-dates">
                                          {new Date(cycle.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(cycle.endsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </span>
                                      </div>
                                      {totalPts > 0 && (
                                        <div className="team-tab-cycle-stats-grid">
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
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          );
                        })() : null}
                      </div>
                    );
                  })()}

                  {/* ---- Projects Box ---- */}
                  {selectedTeam.linearTeamId && (
                    <div className="team-tab-box">
                      <div className="team-tab-box-header" style={{ justifyContent: 'center' }}>
                        <h3 className="team-tab-box-title">Projects</h3>
                      </div>
                      <div className="team-tab-project-filters">
                        <div className="team-tab-status-dropdown" style={{ position: 'relative' }}>
                          <button
                            className="team-tab-status-trigger"
                            onClick={() => setTeamTabProjectStatusOpen((v) => !v)}
                          >
                            {teamTabProjectStatuses.length === 0
                              ? 'All statuses'
                              : teamTabProjectStatuses.join(', ')}
                            <span className="team-tab-status-chevron">{teamTabProjectStatusOpen ? '▴' : '▾'}</span>
                          </button>
                          {teamTabProjectStatusOpen && (
                            <>
                            <div className="team-tab-status-backdrop" onClick={() => setTeamTabProjectStatusOpen(false)} />
                            <div className="team-tab-status-menu">
                              <button
                                className={`team-tab-status-menu-item ${teamTabProjectStatuses.length === 0 ? 'active' : ''}`}
                                onClick={() => { setTeamTabProjectStatuses([]); setTeamTabProjectStatusOpen(false); }}
                              >
                                All statuses
                              </button>
                              {statusCountsArr.map(({ name, count }) => {
                                const isActive = teamTabProjectStatuses.includes(name);
                                return (
                                  <button
                                    key={name}
                                    className={`team-tab-status-menu-item ${isActive ? 'active' : ''}`}
                                    onClick={() => {
                                      setTeamTabProjectStatuses((prev) =>
                                        prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]
                                      );
                                    }}
                                  >
                                    {name} <span className="team-tab-status-pill-count">{count}</span>
                                  </button>
                                );
                              })}
                            </div>
                            </>
                          )}
                        </div>
                        <input
                          type="text"
                          className="team-tab-project-search team-tab-project-search-short"
                          placeholder="Search…"
                          value={teamTabProjectSearch}
                          onChange={(e) => setTeamTabProjectSearch(e.target.value)}
                        />
                      </div>
                      {filteredProjects.length === 0 ? (
                        <div className="team-tab-box-empty">No projects matching this filter.</div>
                      ) : (
                        <div className="team-tab-box-scroll">
                          {filteredProjects.map((project) => {
                            const linked = findLinkedBoard(project.id);
                            const statusType = project.status?.type || '';
                            const statusColor = statusType === 'completed' ? '#5ED68A'
                              : statusType === 'started' ? '#5E6AD2'
                              : statusType === 'planned' ? '#F5A623'
                              : statusType === 'paused' ? '#EF4444'
                              : statusType === 'canceled' ? '#E03A00'
                              : 'var(--text-muted)';
                            const labels = project.projectLabels?.nodes || [];
                            return (
                              <div key={project.id} className="team-tab-project">
                                <div className="team-tab-project-row1">
                                  <span className="team-tab-project-name">{project.name}</span>
                                  {project.status && (
                                    <span className="team-tab-badge" style={{ color: statusColor, borderColor: statusColor }}>{project.status.name}</span>
                                  )}
                                  {project.health && (() => {
                                    const hc = project.health === 'onTrack' ? '#5ED68A' : project.health === 'atRisk' ? '#F5A623' : '#EF4444';
                                    const hl = project.health === 'onTrack' ? 'On Track' : project.health === 'atRisk' ? 'At Risk' : 'Off Track';
                                    return <span className="team-tab-badge" style={{ color: hc, borderColor: hc }}>{hl}</span>;
                                  })()}
                                  <a
                                    className="team-tab-linear-link"
                                    href={project.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Open in Linear"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 100 100" fill="none">
                                      <path d="M2.4 60.7a50 50 0 0 0 36.9 36.9L2.4 60.7z" fill="currentColor"/>
                                      <path d="M.2 49.2a50 50 0 0 0 1.3 8.3L46.6 2.4A50 50 0 0 0 .2 49.2z" fill="currentColor"/>
                                      <path d="M97.6 39.3a50 50 0 0 0-36.9-36.9l36.9 36.9z" fill="currentColor"/>
                                      <path d="M99.8 50.8a50 50 0 0 0-1.3-8.3L53.4 97.6a50 50 0 0 0 46.4-46.8z" fill="currentColor"/>
                                    </svg>
                                  </a>
                                  <span style={{ flex: 1 }} />
                                  {linked ? (
                                    <button className="btn btn-small btn-secondary" onClick={() => onJoinRoom(linked.id)}>Go to Board</button>
                                  ) : (
                                    <button className="btn btn-small btn-secondary" onClick={() => handleTeamTabCreateBoard('cycle', project as unknown as LinearCycle)}>Create Board</button>
                                  )}
                                </div>
                                <div className="team-tab-project-row2">
                                  <span className="team-tab-project-lead">{project.lead?.name || 'No lead'}</span>
                                  {project.startDate && (
                                    <span className="team-tab-cycle-dates">
                                      {new Date(project.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                      {project.targetDate && ` – ${new Date(project.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                                    </span>
                                  )}
                                </div>
                                {labels.length > 0 && (
                                  <div className="team-tab-project-labels">
                                    {labels.map((l, i) => (
                                      <span key={i} className="team-tab-label" style={{ background: l.color + '22', color: l.color }}>{l.name}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ---- Actions section ---- */}
                {teamActions.length > 0 && (
                  <div className="team-tab-section">
                    <div className="team-tab-section-header">
                      <h3 className="team-tab-section-title">Actions</h3>
                      <span className="team-tab-box-count">{teamActionsFiltered.length} action{teamActionsFiltered.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="actions-filters">
                      <div className="actions-filter-group">
                        <label className="actions-filter-label">Session</label>
                        <select
                          className="actions-filter-select"
                          value={teamActionSessionFilter}
                          onChange={(e) => setTeamActionSessionFilter(e.target.value)}
                        >
                          <option value="all">All sessions</option>
                          {teamActionSessionOptions.map((s) => (
                            <option key={s.boardId} value={s.boardId}>{s.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="actions-filter-group">
                        <label className="actions-filter-label">Linear</label>
                        <select
                          className="actions-filter-select"
                          value={teamActionLinearFilter}
                          onChange={(e) => setTeamActionLinearFilter(e.target.value as 'all' | 'with' | 'without')}
                        >
                          <option value="all">All</option>
                          <option value="with">With ticket</option>
                          <option value="without">Without ticket</option>
                        </select>
                      </div>
                      <div className="actions-filter-group">
                        <label className="actions-filter-label">Status</label>
                        <select
                          className="actions-filter-select"
                          value={teamActionDoneFilter}
                          onChange={(e) => setTeamActionDoneFilter(e.target.value as 'all' | 'done' | 'open')}
                        >
                          <option value="all">All</option>
                          <option value="open">Open</option>
                          <option value="done">Done</option>
                        </select>
                      </div>
                    </div>
                    {teamActionsSorted.length === 0 ? (
                      <div className="dash-empty" style={{ padding: '16px 0' }}>No actions found</div>
                    ) : (
                      <div className="actions-grid">
                        {teamActionsSorted.map((a) => (
                          <div key={`${a.boardId}-${a.id}`} className={`action-card ${a.done ? 'done' : ''}`}>
                            <div className="action-card-top">
                              <button
                                className={`action-check ${a.done ? 'checked' : ''}`}
                                onClick={() => toggleActionDone(a)}
                                title={a.done ? 'Mark as open' : 'Mark as done'}
                              >
                                {a.done ? '✓' : ''}
                              </button>
                              <div className="action-card-text">{a.text}</div>
                            </div>
                            <div className="action-card-footer">
                              <button className="action-session-link" onClick={() => onJoinRoom(a.boardId)} title="Open this board">
                                {a.sessionName || a.boardId}
                              </button>
                              <span className="action-date">{new Date(a.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div className="action-card-actions">
                              {a.linearUrl ? (
                                <a href={a.linearUrl} target="_blank" rel="noopener noreferrer" className="action-linear-badge" onClick={(e) => e.stopPropagation()}>
                                  {a.linearKey || 'Linear'}
                                </a>
                              ) : (
                                <button className="action-create-ticket-btn" onClick={() => handleDashLinearOpen(a)}>
                                  + Linear ticket
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ---- Boards (main board list style) ---- */}
                <div className="team-tab-section">
                  <div className="team-tab-section-header">
                    <h3 className="team-tab-section-title">Boards</h3>
                    {archivedTeamBoards.length > 0 && (
                      <button
                        className={`dash-tab ${teamBoardShowArchived ? 'active' : ''}`}
                        onClick={() => setTeamBoardShowArchived(!teamBoardShowArchived)}
                      >
                        Archived ({archivedTeamBoards.length})
                      </button>
                    )}
                    {(baseTeamBoards.length > 0 || teamBoardSearch) && (
                      <div className="dash-search">
                        <input
                          className="dash-search-input"
                          placeholder="Search..."
                          value={teamBoardSearch}
                          onChange={(e) => setTeamBoardSearch(e.target.value)}
                        />
                        {teamBoardSearch && (
                          <button className="dash-search-clear" onClick={() => setTeamBoardSearch('')}>✕</button>
                        )}
                      </div>
                    )}
                  </div>
                  {filteredTeamBoards.length === 0 ? (
                    <div className="dash-empty" style={{ padding: '16px 0' }}>
                      <p>{teamBoardSearch ? 'No matching boards' : teamBoardShowArchived ? 'No archived boards' : 'No boards assigned to this team yet.'}</p>
                    </div>
                  ) : (
                    <div className="dash-board-grid">
                      {filteredTeamBoards.map((board) => (
                        <div
                          key={board.id}
                          className="dash-board-card"
                          onClick={() => onJoinRoom(board.id)}
                          onContextMenu={(e) => {
                            e.preventDefault(); e.stopPropagation();
                            setMenuBoardId(board.id); setMenuPos({ x: e.clientX, y: e.clientY });
                          }}
                        >
                          <div className="dash-card-header">
                            <span className="dash-card-name">{board.sessionName || 'Untitled Board'}</span>
                          </div>
                          <div className="dash-card-stats">
                            <span className="dash-card-stat">{board.actionCount} actions</span>
                            <span className="dash-card-stat-sep">·</span>
                            <span className="dash-card-stat">{board.stickyCount} stickies</span>
                          </div>
                          <div className="dash-card-footer">
                            <div className="dash-card-participants">
                              {board.participants.slice(0, 5).map((p) => (
                                <span key={p.id} className="dash-card-avatar" title={p.name}>{p.name.charAt(0).toUpperCase()}</span>
                              ))}
                              {board.participants.length > 5 && (
                                <span className="dash-card-avatar dash-card-avatar-more">+{board.participants.length - 5}</span>
                              )}
                            </div>
                            <span className="dash-card-time">{timeAgo(board.updatedAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* No Linear mapping notice */}
                {!selectedTeam.linearTeamId && (
                  <div className="team-tab-notice">
                    This team is not mapped to a Linear team. Map it via{' '}
                    <button className="team-tab-notice-link" onClick={() => setTeamModalOpen(true)}>
                      Manage Teams
                    </button>{' '}
                    to see cycles, projects, and velocity.
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Linear ticket creation modal (dashboard) */}
      {dLinearActionId && (
        <div className="dash-modal-overlay" onClick={handleDashLinearClose}>
          <div className="dash-modal" onClick={(e) => e.stopPropagation()} style={{ minWidth: 380, maxWidth: 440 }}>
            <button className="dash-modal-close" onClick={handleDashLinearClose}>✕</button>
            <h3 className="dash-modal-title">Create Linear Ticket</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 12px' }}>
              {globalActions.find((a) => a.id === dLinearActionId && a.boardId === dLinearBoardId)?.text}
            </p>

            {dLinearError && <div className="linear-error">{dLinearError}</div>}

            {dLinearStep === 'team' && (
              <>
                <div className="linear-step-label">Select team</div>
                {dLinearLoading ? (
                  <div className="dash-loading" style={{ padding: 24 }}>Loading teams...</div>
                ) : (
                  <div className="linear-team-list">
                    {dTeams.map((t) => (
                      <button
                        key={t.id}
                        className="linear-team-btn"
                        onClick={() => handleDashTeamSelect(t.id)}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {dLinearStep === 'assignee' && (
              <>
                <div className="linear-step-label">Assign to (optional)</div>
                <input
                  className="dash-input"
                  placeholder="Search members..."
                  value={dMemberSearch}
                  onChange={(e) => setDMemberSearch(e.target.value)}
                  style={{ marginBottom: 8 }}
                />
                <div className="linear-member-list">
                  {dMembers
                    .filter((m) => !dMemberSearch || m.name.toLowerCase().includes(dMemberSearch.toLowerCase()))
                    .map((m) => (
                      <button
                        key={m.id}
                        className={`linear-member-btn ${dSelectedMemberId === m.id ? 'active' : ''}`}
                        onClick={() => setDSelectedMemberId(dSelectedMemberId === m.id ? '' : m.id)}
                      >
                        {m.name}
                      </button>
                    ))}
                </div>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: 12 }}
                  onClick={handleDashCreateTicket}
                >
                  {dSelectedMemberId ? 'Create & Assign' : 'Create Ticket'}
                </button>
              </>
            )}

            {dLinearStep === 'creating' && (
              <div className="dash-loading" style={{ padding: 24 }}>Creating ticket...</div>
            )}

            {dLinearStep === 'done' && dCreatedTicket && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>✅</div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{dCreatedTicket.key}</div>
                <a
                  href={dCreatedTicket.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="action-linear-badge"
                  style={{ display: 'inline-flex' }}
                >
                  Open in Linear
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ SHARED CONTEXT MENU ============ */}
      {menuBoardId && (() => {
        const board = boards.find((b) => b.id === menuBoardId);
        if (!board) return null;
        return (
          <div className="dash-ctx-backdrop" onClick={() => setMenuBoardId(null)} onContextMenu={(e) => { e.preventDefault(); setMenuBoardId(null); }}>
            <div className="dash-ctx-menu" ref={menuRef} style={{ top: menuPos.y, left: menuPos.x }} onClick={(e) => e.stopPropagation()}>
              <button className="dash-ctx-item" onClick={() => { navigator.clipboard.writeText(board.id); setCopiedId(board.id); setTimeout(() => setCopiedId(null), 1500); setMenuBoardId(null); }}>
                {copiedId === board.id ? 'Copied!' : 'Copy board code'}
              </button>
              {teams.length > 0 && (
                <button className="dash-ctx-item" onClick={() => { setTeamAssignBoardId(board.id); setMenuBoardId(null); }}>
                  {board.teamId ? 'Change team...' : 'Assign to team...'}
                </button>
              )}
              {board.teamId && (
                <button className="dash-ctx-item" onClick={() => handleAssignBoardToTeam(board.id, null)}>
                  Remove from team
                </button>
              )}
              {board.archived ? (
                <button className="dash-ctx-item" onClick={() => handleArchive(board.id, false)}>Restore</button>
              ) : (
                <button className="dash-ctx-item" onClick={() => handleArchive(board.id, true)}>Archive</button>
              )}
              <button className="dash-ctx-item dash-ctx-danger" onClick={() => { setMenuBoardId(null); setConfirmDelete(board.id); }}>Delete</button>
            </div>
          </div>
        );
      })()}

      {/* ============ TEAM MODALS ============ */}

      {/* Team assignment picker */}
      {teamAssignBoardId && (
        <div className="dash-modal-overlay" onClick={() => setTeamAssignBoardId(null)}>
          <div className="dash-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <button className="dash-modal-close" onClick={() => setTeamAssignBoardId(null)}>✕</button>
            <h3 className="dash-modal-title">Assign to Team</h3>
            <div className="team-assign-list">
              {teams.map((t) => {
                const board = boards.find((b) => b.id === teamAssignBoardId);
                const isActive = board?.teamId === t.id;
                return (
                  <button
                    key={t.id}
                    className={`team-assign-item ${isActive ? 'active' : ''}`}
                    onClick={() => handleAssignBoardToTeam(teamAssignBoardId, t.id)}
                  >
                    {t.linearTeamKey && <span className="team-assign-key">{t.linearTeamKey}</span>}
                    <span>{t.name}</span>
                    {isActive && <span className="team-assign-check">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Team management modal */}
      {teamModalOpen && (
        <TeamManager
          teams={teams}
          userId={user.id}
          onCreate={handleCreateTeam}
          onUpdate={handleUpdateTeam}
          onDelete={handleDeleteTeam}
          onClose={() => { setTeamModalOpen(false); setEditingTeam(null); }}
        />
      )}

      {/* ============ MODALS ============ */}

      {/* New Board chooser modal */}
      {newBoardOpen && !linearOpen && !templatePickOpen && (
        <NewBoardModal
          preTemplate={preSelectedTemplateId ? templateBoards.find((t) => t.id === preSelectedTemplateId) ?? null : null}
          onClose={() => { setNewBoardOpen(false); setPreSelectedTemplateId(null); }}
          onClearPreTemplate={() => setPreSelectedTemplateId(null)}
          onPickTemplate={handlePickTemplate}
          onPickFromTemplate={() => setTemplatePickOpen(true)}
          onPickFromLinear={() => setLinearOpen(true)}
          onFreeRange={handleFreeRange}
        />
      )}

      {/* Linear sync modal */}
      {linearOpen && (
        <LinearSync
          onClose={() => { setLinearOpen(false); }}
          onCreateBoard={handleLinearCreate}
          templates={templateBoards.map((tb) => ({
            id: tb.id,
            name: tb.sessionName || 'Untitled',
            sections: tb.sections,
          }))}
          defaultTemplateId={preSelectedTemplateId || undefined}
          linkedSourceIds={new Set(boards.map((b) => b.linearSourceId).filter(Boolean) as string[])}
        />
      )}

      {/* Template picker modal */}
      {templatePickOpen && (
        <TemplatePickerModal
          templates={templateBoards}
          onClose={() => setTemplatePickOpen(false)}
          onPick={handlePickTemplate}
        />
      )}

      {/* Team-tab create board preview modal */}
      {teamTabCreatePending && (() => {
        const pending = teamTabCreatePending;
        const isCycle = pending.type === 'cycle';
        const cycle = isCycle ? pending.item as LinearCycle : null;
        const project = !isCycle ? pending.item as LinearProject : null;
        const name = isCycle ? (cycle!.name || `Cycle ${cycle!.number}`) : project!.name;
        const dateRange = isCycle
          ? `${new Date(cycle!.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(cycle!.endsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
          : project!.startDate
            ? `${new Date(project!.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${project!.targetDate ? ' – ' + new Date(project!.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}`
            : '';

        // Scope stats (cycles have scopeHistory)
        const startPts = cycle?.scopeHistory?.[0] || 0;
        const totalPts = cycle?.scopeHistory?.[cycle.scopeHistory!.length - 1] || 0;
        const donePts = cycle?.completedScopeHistory?.[cycle.completedScopeHistory!.length - 1] || 0;
        const scopeChange = startPts > 0 ? Math.round(((totalPts - startPts) / startPts) * 100) : 0;
        const scopeChangeClass = scopeChange <= 0 ? '' : scopeChange < 10 ? 'mild' : scopeChange <= 25 ? 'warn' : 'danger';
        const completionPct = totalPts > 0 ? Math.round((donePts / totalPts) * 100) : 0;
        const hasScope = isCycle && totalPts > 0;

        return (
          <TeamTabCreateModal
            name={name}
            dateRange={dateRange}
            hasScope={hasScope}
            startPts={startPts}
            totalPts={totalPts}
            donePts={donePts}
            scopeChange={scopeChange}
            scopeChangeClass={scopeChangeClass}
            completionPct={completionPct}
            templates={templateBoards}
            onClose={() => setTeamTabCreatePending(null)}
            onCreate={handleTeamTabConfirmCreate}
          />
        );
      })()}

      {/* Join modal */}
      {joinOpen && (
        <div className="dash-modal-overlay" onClick={() => setJoinOpen(false)}>
          <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
            <button className="dash-modal-close" onClick={() => setJoinOpen(false)}>✕</button>
            <h3 className="dash-modal-title">Join a Board</h3>
            <p className="dash-modal-desc">Enter the board code shared by your team</p>
            <input className="dash-modal-input" placeholder="Board code..." value={roomCode} onChange={(e) => handleCodeChange(e.target.value)} onKeyDown={handleKeyDown} autoFocus maxLength={16} />
            <button className="btn btn-primary dash-modal-btn" disabled={!roomCode.trim()} onClick={handleJoin}>Join Board</button>
          </div>
        </div>
      )}

      {/* Delete board confirmation */}
      {confirmDelete && (
        <div className="dash-modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
            <button className="dash-modal-close" onClick={() => setConfirmDelete(null)}>✕</button>
            <h3 className="dash-modal-title">Delete Board</h3>
            <p className="dash-modal-desc">This will permanently delete the board and all its content. This action cannot be undone.</p>
            <div className="dash-modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDeleteBoard(confirmDelete)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete template confirmation */}
      {templateConfirmDelete && (
        <div className="dash-modal-overlay" onClick={() => setTemplateConfirmDelete(null)}>
          <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
            <button className="dash-modal-close" onClick={() => setTemplateConfirmDelete(null)}>✕</button>
            <h3 className="dash-modal-title">Delete Template</h3>
            <p className="dash-modal-desc">This will permanently delete this template and all its content.</p>
            <div className="dash-modal-actions">
              <button className="btn btn-secondary" onClick={() => setTemplateConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDeleteTemplate(templateConfirmDelete)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


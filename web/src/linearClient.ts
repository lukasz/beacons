const LINEAR_API = 'https://api.linear.app/graphql';

export interface LinearTeam {
  id: string;
  name: string;
  key: string;
  cyclesEnabled: boolean;
}

export interface LinearCycle {
  id: string;
  name: string | null;
  number: number;
  description: string | null;
  startsAt: string;
  endsAt: string;
  completedAt: string | null;
  isActive: boolean;
  isPast: boolean;
  progress: number;
  issueCountHistory: number[];
  completedIssueCountHistory: number[];
  scopeHistory: number[];
  completedScopeHistory: number[];
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  url: string;
  estimate: number | null;
  priority: number;
  priorityLabel: string;
  completedAt: string | null;
  canceledAt: string | null;
  state: {
    name: string;
    type: string;
    color: string;
  };
  labels: { nodes: { name: string; color: string }[] };
  assignee: { name: string } | null;
  project: { name: string } | null;
}

async function gql<T>(apiKey: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(LINEAR_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Linear API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`Linear GraphQL error: ${json.errors[0].message}`);
  }
  return json.data as T;
}

export async function fetchTeams(apiKey: string): Promise<LinearTeam[]> {
  const data = await gql<{ teams: { nodes: LinearTeam[] } }>(apiKey, `
    query {
      teams {
        nodes {
          id
          name
          key
          cyclesEnabled
        }
      }
    }
  `);
  return data.teams.nodes;
}

export async function fetchCycles(apiKey: string, teamId: string): Promise<LinearCycle[]> {
  const data = await gql<{ team: { cycles: { nodes: LinearCycle[] } } }>(apiKey, `
    query($teamId: String!) {
      team(id: $teamId) {
        cycles(first: 20, orderBy: createdAt) {
          nodes {
            id
            name
            number
            description
            startsAt
            endsAt
            completedAt
            isActive
            isPast
            progress
            issueCountHistory
            completedIssueCountHistory
            scopeHistory
            completedScopeHistory
          }
        }
      }
    }
  `, { teamId });
  return data.team.cycles.nodes;
}

interface CycleIssuesResponse {
  cycle: {
    issues: {
      nodes: LinearIssue[];
      pageInfo: { hasNextPage: boolean; endCursor: string };
    };
  };
}

export async function fetchCycleIssues(apiKey: string, cycleId: string): Promise<LinearIssue[]> {
  const allIssues: LinearIssue[] = [];
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const data: CycleIssuesResponse = await gql<CycleIssuesResponse>(apiKey, `
      query($cycleId: String!, $after: String) {
        cycle(id: $cycleId) {
          issues(first: 100, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              identifier
              title
              url
              estimate
              priority
              priorityLabel
              completedAt
              canceledAt
              state {
                name
                type
                color
              }
              labels {
                nodes {
                  name
                  color
                }
              }
              assignee {
                name
              }
              project {
                name
              }
            }
          }
        }
      }
    `, { cycleId, after: cursor });

    allIssues.push(...data.cycle.issues.nodes);
    hasMore = data.cycle.issues.pageInfo.hasNextPage;
    cursor = data.cycle.issues.pageInfo.endCursor;
  }

  return allIssues;
}

// ---- Projects ----

export interface LinearProject {
  id: string;
  name: string;
  slugId: string;
  description: string | null;
  progress: number;
  startDate: string | null;
  targetDate: string | null;
  completedAt: string | null;
  lead: { name: string } | null;
  status: { name: string; type: string } | null;
  health: string | null;
  teams: { nodes: { id: string; name: string; key: string }[] };
  projectLabels?: { nodes: { name: string; color: string }[] };
  url: string;
}

export async function fetchProjects(apiKey: string): Promise<LinearProject[]> {
  const data = await gql<{ projects: { nodes: LinearProject[] } }>(apiKey, `
    query {
      projects(first: 100, orderBy: updatedAt, includeArchived: true) {
        nodes {
          id
          name
          slugId
          url
          description
          progress
          startDate
          targetDate
          completedAt
          lead { name }
          status { name type }
          health
          teams(first: 20) {
            nodes { id name key }
          }
          projectLabels: labels(first: 20) {
            nodes { name color }
          }
        }
      }
    }
  `);
  return data.projects.nodes;
}

interface ProjectIssuesResponse {
  project: {
    issues: {
      nodes: LinearIssue[];
      pageInfo: { hasNextPage: boolean; endCursor: string };
    };
  };
}

export async function fetchProjectIssues(apiKey: string, projectId: string): Promise<LinearIssue[]> {
  const allIssues: LinearIssue[] = [];
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const data: ProjectIssuesResponse = await gql<ProjectIssuesResponse>(apiKey, `
      query($projectId: String!, $after: String) {
        project(id: $projectId) {
          issues(first: 100, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              identifier
              title
              url
              estimate
              priority
              priorityLabel
              completedAt
              canceledAt
              state {
                name
                type
                color
              }
              labels {
                nodes {
                  name
                  color
                }
              }
              assignee {
                name
              }
              project {
                name
              }
            }
          }
        }
      }
    `, { projectId, after: cursor });

    allIssues.push(...data.project.issues.nodes);
    hasMore = data.project.issues.pageInfo.hasNextPage;
    cursor = data.project.issues.pageInfo.endCursor;
  }

  return allIssues;
}

export async function fetchWorkspaceSlug(apiKey: string): Promise<string> {
  const data = await gql<{ organization: { urlKey: string } }>(apiKey, `
    query { organization { urlKey } }
  `);
  return data.organization.urlKey;
}

export interface LinearMember {
  id: string;
  name: string;
  displayName: string;
  email: string;
  active: boolean;
}

export async function fetchTeamMembers(apiKey: string, teamId: string): Promise<LinearMember[]> {
  const data = await gql<{ team: { members: { nodes: LinearMember[] } } }>(apiKey, `
    query($teamId: String!) {
      team(id: $teamId) {
        members(first: 100) {
          nodes {
            id
            name
            displayName
            email
            active
          }
        }
      }
    }
  `, { teamId });
  return data.team.members.nodes.filter((m) => m.active);
}

export interface CreateIssueResult {
  id: string;
  identifier: string;
  url: string;
}

export async function createIssue(
  apiKey: string,
  teamId: string,
  title: string,
  assigneeId?: string,
): Promise<CreateIssueResult> {
  const data = await gql<{ issueCreate: { success: boolean; issue: CreateIssueResult } }>(apiKey, `
    mutation($teamId: String!, $title: String!, $assigneeId: String) {
      issueCreate(input: { teamId: $teamId, title: $title, assigneeId: $assigneeId }) {
        success
        issue {
          id
          identifier
          url
        }
      }
    }
  `, { teamId, title, assigneeId: assigneeId || null });

  if (!data.issueCreate.success) {
    throw new Error('Failed to create Linear issue');
  }
  return data.issueCreate.issue;
}

export function validateApiKey(apiKey: string): Promise<boolean> {
  return gql(apiKey, `query { viewer { id } }`)
    .then(() => true)
    .catch(() => false);
}

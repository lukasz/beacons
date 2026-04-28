import { describe, it, expect } from 'vitest';
import { buildMarkdown } from './buildMarkdown';
import {
  fixtureBoardState,
  fixtureSection,
  fixturePostIt,
  fixtureGroup,
  fixtureVote,
} from '../test/fixtures';

describe('buildMarkdown', () => {
  it('returns just a newline for an empty board with no metadata', () => {
    const md = buildMarkdown(fixtureBoardState());
    expect(md).toBe('\n');
  });

  it('includes session name and beat goal in the header', () => {
    const md = buildMarkdown(
      fixtureBoardState({ sessionName: 'Cycle 24 retro', beatGoal: 'Ship by Friday' }),
    );
    expect(md).toContain('# Cycle 24 retro');
    expect(md).toContain('### Ship by Friday');
  });

  it('renders sections with their stickies under headings', () => {
    const sections = { s1: fixtureSection({ id: 's1', title: 'What went well' }) };
    const postIts = {
      p1: fixturePostIt({ id: 'p1', sectionId: 's1', text: 'Pairing kept us honest' }),
      p2: fixturePostIt({ id: 'p2', sectionId: 's1', text: 'Standups were tight' }),
    };
    const md = buildMarkdown(fixtureBoardState({ sections, postIts }));
    expect(md).toContain('## What went well');
    expect(md).toContain('- Pairing kept us honest');
    expect(md).toContain('- Standups were tight');
  });

  it('groups stickies under their group label, ungrouped under "Standalone"', () => {
    const sections = { s1: fixtureSection({ id: 's1', title: 'Wins' }) };
    const groups = { g1: fixtureGroup({ id: 'g1', label: 'QA team' }) };
    const postIts = {
      p1: fixturePostIt({ id: 'p1', sectionId: 's1', groupId: 'g1', text: 'A' }),
      p2: fixturePostIt({ id: 'p2', sectionId: 's1', groupId: 'g1', text: 'B' }),
      p3: fixturePostIt({ id: 'p3', sectionId: 's1', text: 'C' }),
    };
    const md = buildMarkdown(fixtureBoardState({ sections, groups, postIts }));
    expect(md).toContain('### QA team');
    expect(md).toContain('### Standalone');
    // QA team content comes before Standalone
    expect(md.indexOf('### QA team')).toBeLessThan(md.indexOf('### Standalone'));
  });

  it('renders open actions and previous-session actions under "## Actions"', () => {
    const md = buildMarkdown(
      fixtureBoardState({
        actions: {
          a1: { id: 'a1', text: 'Doc the new flow', done: false, authorId: 'u1', authorName: 'Ana', createdAt: 0 },
          a2: { id: 'a2', text: 'Old finished', done: true, authorId: 'u1', authorName: 'Ana', createdAt: 0 },
        },
      }),
      undefined,
      [{ text: 'From last cycle', sourceSessionName: 'Cycle 23 retro' }],
    );
    expect(md).toContain('## Actions');
    expect(md).toContain("### This session's actions");
    expect(md).toContain('- [ ] Doc the new flow');
    expect(md).not.toContain('Old finished'); // done items are skipped
    expect(md).toContain("### Previous sessions' actions");
    expect(md).toContain('- [ ] From last cycle _(Cycle 23 retro)_');
  });

  it('emits a vote-results table with vote counts when the last vote is closed', () => {
    const sections = { s1: fixtureSection({ id: 's1', title: 'Wins' }) };
    const postIts = {
      p1: fixturePostIt({ id: 'p1', sectionId: 's1', text: 'Alpha' }),
      p2: fixturePostIt({ id: 'p2', sectionId: 's1', text: 'Beta' }),
    };
    const closedVote = fixtureVote({
      closed: true,
      votes: { p1: ['u1', 'u2', 'u3'], p2: ['u1'] },
    });
    const md = buildMarkdown(
      fixtureBoardState({ sections, postIts, voteHistory: [closedVote] }),
    );
    expect(md).toContain('## Voting Results');
    expect(md).toMatch(/\| Alpha \| 3 \|/);
    expect(md).toMatch(/\| Beta \| 1 \|/);
    // Alpha (3 votes) ranks above Beta (1 vote)
    expect(md.indexOf('Alpha')).toBeLessThan(md.indexOf('Beta'));
  });

  it('honours selectedIds: only those stickies appear', () => {
    const sections = { s1: fixtureSection({ id: 's1', title: 'Wins' }) };
    const postIts = {
      p1: fixturePostIt({ id: 'p1', sectionId: 's1', text: 'kept' }),
      p2: fixturePostIt({ id: 'p2', sectionId: 's1', text: 'dropped' }),
    };
    const md = buildMarkdown(
      fixtureBoardState({ sections, postIts }),
      new Set(['p1']),
    );
    expect(md).toContain('kept');
    expect(md).not.toContain('dropped');
  });

  it('escapes pipes in vote-result text so the table stays valid', () => {
    const sections = { s1: fixtureSection({ id: 's1' }) };
    const postIts = { p1: fixturePostIt({ id: 'p1', sectionId: 's1', text: 'a | b' }) };
    const closed = fixtureVote({ closed: true, votes: { p1: ['u1'] } });
    const md = buildMarkdown(
      fixtureBoardState({ sections, postIts, voteHistory: [closed] }),
    );
    expect(md).toContain('a \\| b');
  });
});

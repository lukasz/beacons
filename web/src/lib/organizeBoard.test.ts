import { describe, it, expect } from 'vitest';
import { organizeBoard } from './organizeBoard';
import {
  fixtureBoardState,
  fixtureSection,
  fixturePostIt,
  fixtureGroup,
} from '../test/fixtures';

describe('organizeBoard', () => {
  it('returns no moves for an empty board', () => {
    expect(organizeBoard(fixtureBoardState())).toEqual([]);
  });

  it('emits one update_section per section, with new x/y/w/h', () => {
    const state = fixtureBoardState({
      sections: {
        s1: fixtureSection({ id: 's1', order: 0 }),
        s2: fixtureSection({ id: 's2', order: 1 }),
      },
    });
    const moves = organizeBoard(state);
    const updates = moves.filter((m) => m.msg === 'update_section');
    expect(updates).toHaveLength(2);
    for (const u of updates) {
      expect(u.data).toMatchObject({ x: expect.any(Number), y: expect.any(Number), w: expect.any(Number), h: expect.any(Number) });
    }
  });

  it('places post-its inside their parent section', () => {
    const state = fixtureBoardState({
      sections: { s1: fixtureSection({ id: 's1' }) },
      postIts: {
        p1: fixturePostIt({ id: 'p1', sectionId: 's1' }),
        p2: fixturePostIt({ id: 'p2', sectionId: 's1' }),
      },
    });
    const moves = organizeBoard(state);
    const sec = moves.find((m) => m.msg === 'update_section')!.data as { x: number; y: number; w: number; h: number };
    const postIts = moves.filter((m) => m.msg === 'move_postit').map((m) => m.data as { x: number; y: number });
    expect(postIts).toHaveLength(2);
    for (const p of postIts) {
      expect(p.x).toBeGreaterThanOrEqual(sec.x);
      expect(p.x).toBeLessThanOrEqual(sec.x + sec.w);
      expect(p.y).toBeGreaterThanOrEqual(sec.y);
      expect(p.y).toBeLessThanOrEqual(sec.y + sec.h);
    }
  });

  it('emits an update_group for each group used by section post-its', () => {
    const state = fixtureBoardState({
      sections: { s1: fixtureSection({ id: 's1' }) },
      groups: { g1: fixtureGroup({ id: 'g1' }) },
      postIts: {
        p1: fixturePostIt({ id: 'p1', sectionId: 's1', groupId: 'g1' }),
        p2: fixturePostIt({ id: 'p2', sectionId: 's1', groupId: 'g1' }),
      },
    });
    const moves = organizeBoard(state);
    const groupUpdates = moves.filter((m) => m.msg === 'update_group');
    expect(groupUpdates).toHaveLength(1);
    expect(groupUpdates[0].data).toMatchObject({ id: 'g1' });
  });

  it('places orphan (no-section) post-its below the section grid', () => {
    const state = fixtureBoardState({
      sections: { s1: fixtureSection({ id: 's1' }) },
      postIts: {
        p1: fixturePostIt({ id: 'p1', sectionId: 's1' }),
        orphan: fixturePostIt({ id: 'orphan', sectionId: '' }),
      },
    });
    const moves = organizeBoard(state);
    const sec = moves.find((m) => m.msg === 'update_section')!.data as { y: number; h: number };
    const orphan = moves
      .filter((m) => m.msg === 'move_postit')
      .map((m) => m.data as { id: string; y: number })
      .find((p) => p.id === 'orphan')!;
    expect(orphan.y).toBeGreaterThan(sec.y + sec.h);
  });

  it('repositions empty groups after the orphan post-its', () => {
    const state = fixtureBoardState({
      sections: { s1: fixtureSection({ id: 's1' }) },
      groups: { empty: fixtureGroup({ id: 'empty' }) },
    });
    const moves = organizeBoard(state);
    const groupUpdate = moves.find((m) => m.msg === 'update_group');
    expect(groupUpdate?.data).toMatchObject({ id: 'empty' });
  });

  it('does not emit moves for groups that no longer have any post-its in any section', () => {
    // A group used in a section is updated. A group with zero post-its
    // and not referenced by any section is treated as an empty group
    // and emitted at the end (handled by previous test).
    const state = fixtureBoardState({
      sections: { s1: fixtureSection({ id: 's1' }) },
      groups: {},
      postIts: { p1: fixturePostIt({ id: 'p1', sectionId: 's1' }) },
    });
    const moves = organizeBoard(state);
    expect(moves.filter((m) => m.msg === 'update_group')).toHaveLength(0);
  });
});

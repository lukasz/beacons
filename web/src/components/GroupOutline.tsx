import { useMemo } from 'react';
import type { PostIt, Group } from '../types';

interface Props {
  group: Group;
  postIts: PostIt[];
  canVote: boolean;
  onVote: (id: string) => void;
}

// Post-it dimensions (matches Board.tsx render size)
const PW = 160;
const PH = 100;
const PAD = 16;

export default function GroupOutline({ group, postIts, canVote, onVote }: Props) {
  const rect = useMemo(() => {
    const grouped = postIts.filter((p) => p.groupId === group.id);
    if (grouped.length === 0) return null;

    let minX = group.x;
    let minY = group.y;
    let maxX = group.x + group.w;
    let maxY = group.y + group.h;
    for (const p of grouped) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x + PW > maxX) maxX = p.x + PW;
      if (p.y + PH > maxY) maxY = p.y + PH;
    }
    return {
      x: minX - PAD,
      y: minY - PAD,
      w: (maxX - minX) + PAD * 2,
      h: (maxY - minY) + PAD * 2,
    };
  }, [postIts, group]);

  if (!rect) return null;

  return (
    <div
      className={`group-outline ${canVote ? 'votable' : ''}`}
      style={{ transform: `translate(${rect.x}px, ${rect.y}px)`, width: rect.w, height: rect.h }}
      onClick={canVote ? (e) => { e.stopPropagation(); onVote(group.id); } : undefined}
    />
  );
}

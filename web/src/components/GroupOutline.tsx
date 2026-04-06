import { useMemo } from 'react';
import type { PostIt, Group } from '../types';

interface Props {
  group: Group;
  postIts: PostIt[];
  canVote: boolean;
  onVote: (id: string) => void;
}

export default function GroupOutline({ group, postIts, canVote, onVote }: Props) {
  const grouped = useMemo(() => {
    return postIts.filter((p) => p.groupId === group.id);
  }, [postIts, group.id]);

  const path = useMemo(() => {
    if (grouped.length === 0) return '';

    const padding = 24;
    const pw = 160;
    const ph = 100;

    // Build bounding rectangles for each element, then sample perimeter points
    const rects: { cx: number; cy: number; hw: number; hh: number }[] = [];

    // Group label
    rects.push({
      cx: group.x + group.w / 2,
      cy: group.y + group.h / 2,
      hw: group.w / 2 + padding,
      hh: group.h / 2 + padding,
    });

    for (const p of grouped) {
      rects.push({
        cx: p.x + pw / 2,
        cy: p.y + ph / 2,
        hw: pw / 2 + padding,
        hh: ph / 2 + padding,
      });
    }

    // Sample points around each rect as an ellipse (8 points per element)
    const points: [number, number][] = [];
    const SAMPLES = 12;
    for (const r of rects) {
      for (let i = 0; i < SAMPLES; i++) {
        const a = (Math.PI * 2 * i) / SAMPLES;
        points.push([
          r.cx + r.hw * Math.cos(a),
          r.cy + r.hh * Math.sin(a),
        ]);
      }
    }

    let hull = convexHull(points);
    if (hull.length < 3) return '';

    // Simplify: remove nearly-collinear points (angle > threshold to keep)
    hull = simplifyHull(hull, 0.15); // ~8.5 degrees
    if (hull.length < 3) return '';

    return smoothClosedPath(hull);
  }, [grouped, group]);

  if (!path) return null;

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 4,
        overflow: 'visible',
      }}
      width="1"
      height="1"
    >
      {canVote && (
        <path
          d={path}
          className="group-outline-hitarea"
          onClick={(e) => {
            e.stopPropagation();
            onVote(group.id);
          }}
        />
      )}
      <path className="group-outline" d={path} style={{ pointerEvents: 'none' }} />
    </svg>
  );
}

/** Remove hull vertices where the turn angle is below threshold (nearly straight). */
function simplifyHull(hull: [number, number][], minAngle: number): [number, number][] {
  const n = hull.length;
  if (n <= 3) return hull;

  const keep: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const prev = hull[(i - 1 + n) % n];
    const curr = hull[i];
    const next = hull[(i + 1) % n];

    const ax = curr[0] - prev[0];
    const ay = curr[1] - prev[1];
    const bx = next[0] - curr[0];
    const by = next[1] - curr[1];

    const cross = ax * by - ay * bx;
    const dot = ax * bx + ay * by;
    const angle = Math.abs(Math.atan2(cross, dot));

    if (angle > minAngle) {
      keep.push(curr);
    }
  }

  return keep.length >= 3 ? keep : hull;
}

/** Closed smooth path using cubic Béziers with rounded corners. */
function smoothClosedPath(pts: [number, number][]): string {
  const n = pts.length;

  // For each corner, offset inward and draw a cubic curve around it
  const radius = 30; // corner rounding radius
  const segments: string[] = [];
  let first = true;

  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];

    // Vectors from current point to prev and next
    const toPrevX = prev[0] - curr[0];
    const toPrevY = prev[1] - curr[1];
    const toNextX = next[0] - curr[0];
    const toNextY = next[1] - curr[1];

    const dPrev = Math.sqrt(toPrevX * toPrevX + toPrevY * toPrevY);
    const dNext = Math.sqrt(toNextX * toNextX + toNextY * toNextY);

    // Clamp radius so we don't overshoot the edge
    const r = Math.min(radius, dPrev * 0.4, dNext * 0.4);

    // Points where the curve starts/ends (offset from corner toward prev/next)
    const startX = curr[0] + (toPrevX / dPrev) * r;
    const startY = curr[1] + (toPrevY / dPrev) * r;
    const endX = curr[0] + (toNextX / dNext) * r;
    const endY = curr[1] + (toNextY / dNext) * r;

    if (first) {
      segments.push(`M ${startX} ${startY}`);
      first = false;
    } else {
      // Straight line from previous curve end to this curve start
      segments.push(`L ${startX} ${startY}`);
    }

    // Cubic Bézier around the corner — control points at the corner itself
    segments.push(`C ${curr[0]} ${curr[1]}, ${curr[0]} ${curr[1]}, ${endX} ${endY}`);
  }

  // Close: line back to the very first point
  segments.push('Z');
  return segments.join(' ');
}

function convexHull(points: [number, number][]): [number, number][] {
  if (points.length <= 1) return points;

  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const cross = (O: [number, number], A: [number, number], B: [number, number]) =>
    (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);

  const lower: [number, number][] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: [number, number][] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

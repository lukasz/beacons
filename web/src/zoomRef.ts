// Shared mutable ref for the current canvas zoom level.
// Board.tsx writes it; draggable components read it to scale pointer deltas.
export const zoomRef = { current: 1 };

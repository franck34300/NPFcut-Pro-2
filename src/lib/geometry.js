// Geometry utility functions

export const distance = (p1, p2) =>
  Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);

export const distanceToSegment = (point, segStart, segEnd) => {
  const A = point.x - segStart.x;
  const B = point.y - segStart.y;
  const C = segEnd.x - segStart.x;
  const D = segEnd.y - segStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  if (lenSq !== 0) param = dot / lenSq;

  let xx, yy;
  if (param < 0) {
    xx = segStart.x;
    yy = segStart.y;
  } else if (param > 1) {
    xx = segEnd.x;
    yy = segEnd.y;
  } else {
    xx = segStart.x + param * C;
    yy = segStart.y + param * D;
  }

  const dx = point.x - xx;
  const dy = point.y - yy;
  return Math.sqrt(dx * dx + dy * dy);
};
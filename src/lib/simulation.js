import { recreateEntity } from './entities/recreateEntity';

// Generate ordered cut path data for simulation (same order as G-code export)
export function generateCutPathData(entities) {
  const pieces = [];

  entities.forEach((data, idx) => {
    const entity = recreateEntity(data);
    if (!entity) return;

    let startPoint = null;
    let pathPoints = [];

    if (entity.type === 'line') {
      startPoint = { ...entity.start };
      pathPoints = [{ ...entity.start }, { ...entity.end }];
    } else if (entity.type === 'circle') {
      startPoint = { x: entity.center.x + entity.radius, y: entity.center.y };
      const steps = 72;
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * 2 * Math.PI;
        pathPoints.push({
          x: entity.center.x + entity.radius * Math.cos(a),
          y: entity.center.y + entity.radius * Math.sin(a)
        });
      }
    } else if (entity.type === 'arc') {
      startPoint = {
        x: entity.center.x + entity.radius * Math.cos(entity.startAngle),
        y: entity.center.y + entity.radius * Math.sin(entity.startAngle)
      };
      const angleSpan = Math.abs(entity.endAngle - entity.startAngle);
      const steps = Math.max(8, Math.round(angleSpan * entity.radius / 3));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const a = entity.startAngle + (entity.endAngle - entity.startAngle) * t;
        pathPoints.push({
          x: entity.center.x + entity.radius * Math.cos(a),
          y: entity.center.y + entity.radius * Math.sin(a)
        });
      }
    } else if (entity.type === 'path') {
      startPoint = entity.points[0] ? { ...entity.points[0] } : null;
      pathPoints = entity.points.map(p => ({ ...p }));
      if (entity.closed && entity.points.length > 2) {
        pathPoints.push({ ...entity.points[0] });
      }
    } else if (entity.type === 'rectangle') {
      startPoint = { ...entity.topLeft };
      pathPoints = [
        { x: entity.topLeft.x, y: entity.topLeft.y },
        { x: entity.topLeft.x + entity.width, y: entity.topLeft.y },
        { x: entity.topLeft.x + entity.width, y: entity.topLeft.y + entity.height },
        { x: entity.topLeft.x, y: entity.topLeft.y + entity.height },
        { x: entity.topLeft.x, y: entity.topLeft.y }
      ];
    } else if (entity.type === 'contour') {
      const subEntities = entity.entities || [];
      const allPoints = [];
      subEntities.forEach(subData => {
        const sub = recreateEntity(subData);
        if (!sub) return;
        if (sub.type === 'line') {
          allPoints.push({ ...sub.start }, { ...sub.end });
        } else if (sub.type === 'arc') {
          const angleSpan = Math.abs(sub.endAngle - sub.startAngle);
          const steps = Math.max(8, Math.round(angleSpan * sub.radius / 3));
          for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const a = sub.startAngle + (sub.endAngle - sub.startAngle) * t;
            allPoints.push({
              x: sub.center.x + sub.radius * Math.cos(a),
              y: sub.center.y + sub.radius * Math.sin(a)
            });
          }
        } else if (sub.type === 'circle') {
          const steps = 72;
          for (let i = 0; i < steps; i++) {
            const a = (i / steps) * 2 * Math.PI;
            allPoints.push({
              x: sub.center.x + sub.radius * Math.cos(a),
              y: sub.center.y + sub.radius * Math.sin(a)
            });
          }
        } else if (sub.type === 'path') {
          allPoints.push(...sub.points.map(p => ({ ...p })));
        }
      });
      startPoint = allPoints[0] ? { ...allPoints[0] } : null;
      pathPoints = allPoints;
    }

    if (!startPoint || pathPoints.length < 2) return;

    // Build full path including lead-in/out
    let fullPoints = [];
    if (data.leadIn) {
      fullPoints.push({ ...data.leadIn });
      fullPoints.push({ ...startPoint });
    } else {
      fullPoints.push({ ...startPoint });
    }
    fullPoints.push(...pathPoints.slice(1));
    if (data.leadOut) {
      fullPoints.push({ ...data.leadOut });
    }

    pieces.push({
      index: idx + 1,
      points: fullPoints,
      color: data.color || '#2dd4bf',
      hasLeadIn: !!data.leadIn,
    });
  });

  return pieces;
}

// Compute total path length for a piece (for animation speed normalization)
export function pathLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}
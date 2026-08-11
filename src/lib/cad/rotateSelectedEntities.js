import { recreateEntity } from '../entities/recreateEntity';
import { PathEntity } from '../entities/PathEntity';

export function rotateSelectedEntities(ents, center, angleDelta) {
  const cos = Math.cos(angleDelta);
  const sin = Math.sin(angleDelta);

  const rotatePoint = (p) => ({
    x: center.x + (p.x - center.x) * cos - (p.y - center.y) * sin,
    y: center.y + (p.x - center.x) * sin + (p.y - center.y) * cos
  });

  return ents.map(data => {
    if (!data.selected) return data;
    const entity = recreateEntity(data);
    if (!entity) return data;

    if (entity.type === 'line') {
      entity.start = rotatePoint(entity.start);
      entity.end = rotatePoint(entity.end);
    } else if (entity.type === 'rectangle') {
      const corners = entity.getHandles();
      const rotatedCorners = corners.map(rotatePoint);
      const path = new PathEntity(rotatedCorners, true);
      path.color = entity.color;
      return JSON.parse(JSON.stringify(path));
    } else if (entity.type === 'circle') {
      entity.center = rotatePoint(entity.center);
    } else if (entity.type === 'arc') {
      entity.center = rotatePoint(entity.center);
      entity.startAngle += angleDelta;
      entity.endAngle += angleDelta;
    } else if (entity.type === 'path') {
      entity.points = entity.points.map(rotatePoint);
    } else if (entity.type === 'text' && entity.position) {
      entity.position = rotatePoint(entity.position);
    } else if (entity.type === 'freeform') {
      entity.controlPoints = entity.controlPoints.map(rotatePoint);
    }

    return JSON.parse(JSON.stringify(entity));
  });
}
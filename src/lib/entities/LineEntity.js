import { Entity } from './Entity';
import { distance } from '../geometry';

export class LineEntity extends Entity {
  constructor(start, end) {
    super('line');
    this.start = start;
    this.end = end;
  }

  getHandles() {
    return [this.start, this.end];
  }

  moveHandle(handleIndex, newPos) {
    if (handleIndex === 0) this.start = newPos;
    else this.end = newPos;
  }

  move(dx, dy) {
    this.start = { x: this.start.x + dx, y: this.start.y + dy };
    this.end = { x: this.end.x + dx, y: this.end.y + dy };
  }

  draw(ctx) {
    ctx.strokeStyle = this.selected ? '#fbbf24' : this.color;
    ctx.lineWidth = this.selected ? 0.8 : 0.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(this.start.x, this.start.y);
    ctx.lineTo(this.end.x, this.end.y);
    ctx.stroke();
  }

  contains(point, tolerance = 5) {
    const dx = this.end.x - this.start.x;
    const dy = this.end.y - this.start.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return distance(point, this.start) < tolerance;

    const t = Math.max(0, Math.min(1,
      ((point.x - this.start.x) * dx + (point.y - this.start.y) * dy) / lenSq
    ));

    const projX = this.start.x + t * dx;
    const projY = this.start.y + t * dy;

    const dist = Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
    return dist < tolerance;
  }

  getIntersections(other) {
    if (other.type === 'line') {
      return this.lineLineIntersection(other);
    } else if (other.type === 'circle') {
      return this.lineCircleIntersection(other);
    } else if (other.type === 'arc') {
      return this.lineArcIntersection(other);
    }
    return [];
  }

  lineLineIntersection(other) {
    const x1 = this.start.x, y1 = this.start.y;
    const x2 = this.end.x, y2 = this.end.y;
    const x3 = other.start.x, y3 = other.start.y;
    const x4 = other.end.x, y4 = other.end.y;

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 0.0001) return [];

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return [{
        x: x1 + t * (x2 - x1),
        y: y1 + t * (y2 - y1)
      }];
    }
    return [];
  }

  lineCircleIntersection(circle) {
    const dx = this.end.x - this.start.x;
    const dy = this.end.y - this.start.y;
    const fx = this.start.x - circle.center.x;
    const fy = this.start.y - circle.center.y;

    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - circle.radius * circle.radius;

    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return [];

    const t1 = (-b - Math.sqrt(discriminant)) / (2 * a);
    const t2 = (-b + Math.sqrt(discriminant)) / (2 * a);

    const intersections = [];
    if (t1 >= 0 && t1 <= 1) {
      intersections.push({
        x: this.start.x + t1 * dx,
        y: this.start.y + t1 * dy
      });
    }
    if (t2 >= 0 && t2 <= 1 && Math.abs(t2 - t1) > 0.0001) {
      intersections.push({
        x: this.start.x + t2 * dx,
        y: this.start.y + t2 * dy
      });
    }
    return intersections;
  }

  lineArcIntersection(arc) {
    const circleIntersections = this.lineCircleIntersection({
      center: arc.center,
      radius: arc.radius
    });

    return circleIntersections.filter(point => {
      const angle = Math.atan2(point.y - arc.center.y, point.x - arc.center.x);
      let normalizedAngle = angle < 0 ? angle + 2 * Math.PI : angle;
      let startAngle = arc.startAngle < 0 ? arc.startAngle + 2 * Math.PI : arc.startAngle;
      let endAngle = arc.endAngle < 0 ? arc.endAngle + 2 * Math.PI : arc.endAngle;

      if (startAngle > endAngle) {
        return normalizedAngle >= startAngle || normalizedAngle <= endAngle;
      } else {
        return normalizedAngle >= startAngle && normalizedAngle <= endAngle;
      }
    });
  }
}
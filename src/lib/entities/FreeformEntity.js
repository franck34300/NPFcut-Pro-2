import { Entity } from './Entity';
import { distanceToSegment } from '../geometry';

export class FreeformEntity extends Entity {
  constructor(controlPoints, closed = true) {
    super('freeform');
    this.controlPoints = controlPoints;
    this.closed = closed;
  }

  static createSquare(topLeft, size) {
    const points = [];
    const third = size / 3;

    points.push({ x: topLeft.x, y: topLeft.y });
    points.push({ x: topLeft.x + third, y: topLeft.y });
    points.push({ x: topLeft.x + 2 * third, y: topLeft.y });
    points.push({ x: topLeft.x + size, y: topLeft.y });

    points.push({ x: topLeft.x + size, y: topLeft.y + third });
    points.push({ x: topLeft.x + size, y: topLeft.y + 2 * third });
    points.push({ x: topLeft.x + size, y: topLeft.y + size });

    points.push({ x: topLeft.x + 2 * third, y: topLeft.y + size });
    points.push({ x: topLeft.x + third, y: topLeft.y + size });
    points.push({ x: topLeft.x, y: topLeft.y + size });

    points.push({ x: topLeft.x, y: topLeft.y + 2 * third });
    points.push({ x: topLeft.x, y: topLeft.y + third });

    return new FreeformEntity(points, true);
  }

  getCatmullRomPoint(t, p0, p1, p2, p3) {
    const t2 = t * t;
    const t3 = t2 * t;

    const x = 0.5 * (
      (2 * p1.x) +
      (-p0.x + p2.x) * t +
      (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
      (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
    );

    const y = 0.5 * (
      (2 * p1.y) +
      (-p0.y + p2.y) * t +
      (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
      (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
    );

    return { x, y };
  }

  getSmoothCurve(resolution = 20) {
    if (this.controlPoints.length < 2) return this.controlPoints;

    const points = [];
    const n = this.controlPoints.length;

    for (let i = 0; i < n; i++) {
      const p0 = this.controlPoints[this.closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
      const p1 = this.controlPoints[i];
      const p2 = this.controlPoints[this.closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
      const p3 = this.controlPoints[this.closed ? (i + 2) % n : Math.min(n - 1, i + 2)];

      for (let t = 0; t < 1; t += 1 / resolution) {
        points.push(this.getCatmullRomPoint(t, p0, p1, p2, p3));
      }
    }

    return points;
  }

  getHandles() {
    return this.controlPoints.map((p, i) => ({
      x: p.x,
      y: p.y,
      type: 'control',
      index: i
    }));
  }

  moveHandle(index, newPos) {
    this.controlPoints[index] = { x: newPos.x, y: newPos.y };
  }

  addPointAt(index) {
    const p1 = this.controlPoints[index];
    const p2 = this.controlPoints[(index + 1) % this.controlPoints.length];
    const mid = {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2
    };
    this.controlPoints.splice(index + 1, 0, mid);
  }

  removePointAt(index) {
    if (this.controlPoints.length > 3) {
      this.controlPoints.splice(index, 1);
    }
  }

  draw(ctx) {
    const smoothPoints = this.getSmoothCurve(20);
    const transformScale = ctx.getTransform().a;

    ctx.strokeStyle = this.selected ? '#22d3ee' : '#64748b';
    ctx.lineWidth = this.selected ? 0.8 / transformScale : 0.4 / transformScale;
    ctx.fillStyle = 'rgba(100, 116, 139, 0.05)';

    if (smoothPoints.length > 0) {
      ctx.beginPath();
      ctx.moveTo(smoothPoints[0].x, smoothPoints[0].y);

      for (let i = 1; i < smoothPoints.length; i++) {
        ctx.lineTo(smoothPoints[i].x, smoothPoints[i].y);
      }

      if (this.closed) {
        ctx.closePath();
      }

      ctx.stroke();
      if (this.closed) ctx.fill();
    }

    if (this.selected) {
      ctx.fillStyle = '#fbbf24';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1 / transformScale;

      this.controlPoints.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4 / transformScale, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      });
    }
  }

  move(dx, dy) {
    this.controlPoints = this.controlPoints.map(p => ({
      x: p.x + dx,
      y: p.y + dy
    }));
  }

  contains(pos, tolerance = 3) {
    const smoothPoints = this.getSmoothCurve(20);

    for (let i = 1; i < smoothPoints.length; i++) {
      const dist = distanceToSegment(pos, smoothPoints[i - 1], smoothPoints[i]);
      if (dist < tolerance) {
        return true;
      }
    }

    if (this.closed && smoothPoints.length > 0) {
      const dist = distanceToSegment(pos, smoothPoints[smoothPoints.length - 1], smoothPoints[0]);
      if (dist < tolerance) {
        return true;
      }
    }

    return false;
  }

  getIntersections(other) {
    return [];
  }
}
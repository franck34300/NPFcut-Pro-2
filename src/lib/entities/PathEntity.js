import { Entity } from './Entity';
import { LineEntity } from './LineEntity';
import { distance } from '../geometry';

export class PathEntity extends Entity {
  constructor(points, closed = false) {
    super('path');
    this.points = points;
    this.closed = closed;
  }

  getHandles() {
    return this.points;
  }

  moveHandle(handleIndex, newPos) {
    if (handleIndex >= 0 && handleIndex < this.points.length) {
      this.points[handleIndex] = newPos;
    }
  }

  move(dx, dy) {
    this.points = this.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
  }

  draw(ctx) {
    if (this.points.length < 2) return;

    ctx.strokeStyle = this.selected ? '#fbbf24' : this.color;
    ctx.lineWidth = this.selected ? 0.8 : 0.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);

    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }

    if (this.closed) {
      ctx.closePath();
    }

    ctx.stroke();
  }

  contains(point, tolerance = 5) {
    for (let i = 0; i < this.points.length - 1; i++) {
      const p1 = this.points[i];
      const p2 = this.points[i + 1];

      const d = distance(p1, p2);
      const d1 = distance(p1, point);
      const d2 = distance(point, p2);

      if (Math.abs(d - (d1 + d2)) < tolerance) {
        return true;
      }
    }

    if (this.closed && this.points.length > 2) {
      const p1 = this.points[this.points.length - 1];
      const p2 = this.points[0];

      const d = distance(p1, p2);
      const d1 = distance(p1, point);
      const d2 = distance(point, p2);

      if (Math.abs(d - (d1 + d2)) < tolerance) {
        return true;
      }
    }

    return false;
  }

  getIntersections(other) {
    const allIntersections = [];

    for (let i = 0; i < this.points.length - 1; i++) {
      const line = new LineEntity(this.points[i], this.points[i + 1]);
      const intersections = line.getIntersections(other);

      intersections.forEach(point => {
        if (!allIntersections.some(p => distance(p, point) < 0.01)) {
          allIntersections.push(point);
        }
      });
    }

    if (this.closed && this.points.length > 2) {
      const line = new LineEntity(
        this.points[this.points.length - 1],
        this.points[0]
      );

      const intersections = line.getIntersections(other);

      intersections.forEach(point => {
        if (!allIntersections.some(p => distance(p, point) < 0.01)) {
          allIntersections.push(point);
        }
      });
    }

    return allIntersections;
  }

  toLines() {
    const lines = [];

    for (let i = 0; i < this.points.length - 1; i++) {
      lines.push(new LineEntity(this.points[i], this.points[i + 1]));
    }

    if (this.closed && this.points.length > 2) {
      lines.push(
        new LineEntity(
          this.points[this.points.length - 1],
          this.points[0]
        )
      );
    }

    return lines;
  }
}
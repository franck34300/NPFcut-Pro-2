import { Entity } from './Entity';
import { LineEntity } from './LineEntity';
import { distance } from '../geometry';

export class RectangleEntity extends Entity {
  constructor(topLeft, width, height) {
    super('rectangle');
    this.topLeft = topLeft;
    this.width = width;
    this.height = height;
  }

  getHandles() {
    return [
      this.topLeft,
      { x: this.topLeft.x + this.width, y: this.topLeft.y },
      { x: this.topLeft.x + this.width, y: this.topLeft.y + this.height },
      { x: this.topLeft.x, y: this.topLeft.y + this.height }
    ];
  }

  moveHandle(handleIndex, newPos) {
    const handles = this.getHandles();
    const opposite = handles[(handleIndex + 2) % 4];

    this.topLeft = {
      x: Math.min(newPos.x, opposite.x),
      y: Math.min(newPos.y, opposite.y)
    };
    this.width = Math.abs(newPos.x - opposite.x);
    this.height = Math.abs(newPos.y - opposite.y);
  }

  move(dx, dy) {
    this.topLeft = { x: this.topLeft.x + dx, y: this.topLeft.y + dy };
  }

  draw(ctx) {
    ctx.strokeStyle = this.selected ? '#fbbf24' : this.color;
    ctx.lineWidth = this.selected ? 0.8 : 0.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeRect(this.topLeft.x, this.topLeft.y, this.width, this.height);
  }

  contains(point, tolerance = 5) {
    const inside = point.x >= this.topLeft.x - tolerance &&
                   point.x <= this.topLeft.x + this.width + tolerance &&
                   point.y >= this.topLeft.y - tolerance &&
                   point.y <= this.topLeft.y + this.height + tolerance;

    const outside = point.x > this.topLeft.x + tolerance &&
                    point.x < this.topLeft.x + this.width - tolerance &&
                    point.y > this.topLeft.y + tolerance &&
                    point.y < this.topLeft.y + this.height - tolerance;

    return inside && !outside;
  }

  toLines() {
    const corners = this.getHandles();
    return [
      new LineEntity(corners[0], corners[1]),
      new LineEntity(corners[1], corners[2]),
      new LineEntity(corners[2], corners[3]),
      new LineEntity(corners[3], corners[0])
    ];
  }

  getIntersections(other) {
    const lines = this.toLines();
    const allIntersections = [];
    lines.forEach(line => {
      const intersections = line.getIntersections(other);
      intersections.forEach(point => {
        if (!allIntersections.some(p => distance(p, point) < 0.01)) {
          allIntersections.push(point);
        }
      });
    });
    return allIntersections;
  }
}
import { Entity } from './Entity';
import { distance } from '../geometry';

export class CircleEntity extends Entity {
  constructor(center, radius) {
    super('circle');
    this.center = center;
    this.radius = radius;
  }

  getHandles() {
    return [
      this.center,
      { x: this.center.x + this.radius, y: this.center.y },
      { x: this.center.x, y: this.center.y + this.radius },
      { x: this.center.x - this.radius, y: this.center.y },
      { x: this.center.x, y: this.center.y - this.radius }
    ];
  }

  moveHandle(handleIndex, newPos) {
    if (handleIndex === 0) {
      this.center = newPos;
    } else {
      this.radius = distance(this.center, newPos);
    }
  }

  move(dx, dy) {
    this.center = { x: this.center.x + dx, y: this.center.y + dy };
  }

  draw(ctx) {
    ctx.strokeStyle = this.selected ? '#fbbf24' : this.color;
    ctx.lineWidth = this.selected ? 0.8 : 0.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(this.center.x, this.center.y, this.radius, 0, 2 * Math.PI);
    ctx.stroke();
  }

  contains(point, tolerance = 5) {
    const d = distance(this.center, point);
    return Math.abs(d - this.radius) < tolerance;
  }

  getIntersections(other) {
    if (other.type === 'line') {
      return other.lineCircleIntersection(this);
    } else if (other.type === 'circle') {
      return this.circleCircleIntersection(other);
    } else if (other.type === 'arc') {
      const circleIntersections = this.circleCircleIntersection({
        center: other.center,
        radius: other.radius
      });
      return circleIntersections.filter(point => {
        const angle = Math.atan2(point.y - other.center.y, point.x - other.center.x);
        let normalizedAngle = angle < 0 ? angle + 2 * Math.PI : angle;
        let startAngle = other.startAngle < 0 ? other.startAngle + 2 * Math.PI : other.startAngle;
        let endAngle = other.endAngle < 0 ? other.endAngle + 2 * Math.PI : other.endAngle;

        if (startAngle > endAngle) {
          return normalizedAngle >= startAngle || normalizedAngle <= endAngle;
        } else {
          return normalizedAngle >= startAngle && normalizedAngle <= endAngle;
        }
      });
    }
    return [];
  }

  circleCircleIntersection(other) {
    const d = distance(this.center, other.center);

    if (d > this.radius + other.radius || d < Math.abs(this.radius - other.radius) || d === 0) {
      return [];
    }

    const a = (this.radius * this.radius - other.radius * other.radius + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, this.radius * this.radius - a * a));

    const p = {
      x: this.center.x + a * (other.center.x - this.center.x) / d,
      y: this.center.y + a * (other.center.y - this.center.y) / d
    };

    const intersections = [
      {
        x: p.x + h * (other.center.y - this.center.y) / d,
        y: p.y - h * (other.center.x - this.center.x) / d
      },
      {
        x: p.x - h * (other.center.y - this.center.y) / d,
        y: p.y + h * (other.center.x - this.center.x) / d
      }
    ];

    return intersections.filter((p, i, arr) =>
      i === 0 || distance(p, arr[0]) > 0.0001
    );
  }
}
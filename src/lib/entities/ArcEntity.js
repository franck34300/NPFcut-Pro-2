import { Entity } from './Entity';
import { CircleEntity } from './CircleEntity';
import { distance } from '../geometry';

export class ArcEntity extends Entity {
  constructor(center, radius, startAngle, endAngle, clockwise = false) {
    super('arc');
    this.center = center;
    this.radius = radius;
    this.startAngle = startAngle;
    this.endAngle = endAngle;
    this.clockwise = clockwise;
  }

  static fromThreePoints(start, apex, end) {
    const ax = start.x, ay = start.y;
    const bx = apex.x, by = apex.y;
    const cx = end.x, cy = end.y;

    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(d) < 0.0001) return null;

    const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
    const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;

    const center = { x: ux, y: uy };
    const radius = distance(center, start);

    const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
    const apexAngle = Math.atan2(apex.y - center.y, apex.x - center.x);
    const endAngle = Math.atan2(end.y - center.y, end.x - center.x);

    let angle1 = endAngle - startAngle;
    let angle2 = startAngle - endAngle;

    while (angle1 < 0) angle1 += 2 * Math.PI;
    while (angle1 >= 2 * Math.PI) angle1 -= 2 * Math.PI;
    while (angle2 < 0) angle2 += 2 * Math.PI;
    while (angle2 >= 2 * Math.PI) angle2 -= 2 * Math.PI;

    let apexInSens1 = apexAngle - startAngle;
    while (apexInSens1 < 0) apexInSens1 += 2 * Math.PI;
    while (apexInSens1 >= 2 * Math.PI) apexInSens1 -= 2 * Math.PI;

    const apexIsInSens1 = apexInSens1 <= angle1;

    if (apexIsInSens1) {
      return new ArcEntity(center, radius, startAngle, endAngle);
    } else {
      return new ArcEntity(center, radius, endAngle, startAngle);
    }
  }

  getHandles() {
    const startPoint = {
      x: this.center.x + this.radius * Math.cos(this.startAngle),
      y: this.center.y + this.radius * Math.sin(this.startAngle)
    };
    const endPoint = {
      x: this.center.x + this.radius * Math.cos(this.endAngle),
      y: this.center.y + this.radius * Math.sin(this.endAngle)
    };
    const midAngle = (this.startAngle + this.endAngle) / 2;
    const midPoint = {
      x: this.center.x + this.radius * Math.cos(midAngle),
      y: this.center.y + this.radius * Math.sin(midAngle)
    };

    return [this.center, startPoint, midPoint, endPoint];
  }

  moveHandle(handleIndex, newPos) {
    if (handleIndex === 0) {
      this.center = newPos;
    } else {
      this.radius = distance(this.center, newPos);
      if (handleIndex === 1) {
        this.startAngle = Math.atan2(newPos.y - this.center.y, newPos.x - this.center.x);
      } else if (handleIndex === 3) {
        this.endAngle = Math.atan2(newPos.y - this.center.y, newPos.x - this.center.x);
      }
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
    ctx.arc(
      this.center.x,
      this.center.y,
      this.radius,
      this.startAngle,
      this.endAngle,
      this.clockwise
    );
    ctx.stroke();
  }

  contains(point, tolerance = 5) {
    const d = distance(this.center, point);
    if (Math.abs(d - this.radius) > tolerance) return false;

    const angle = Math.atan2(point.y - this.center.y, point.x - this.center.x);
    let normalizedAngle = angle < 0 ? angle + 2 * Math.PI : angle;
    let startAngle = this.startAngle < 0 ? this.startAngle + 2 * Math.PI : this.startAngle;
    let endAngle = this.endAngle < 0 ? this.endAngle + 2 * Math.PI : this.endAngle;

    if (startAngle > endAngle) {
      return normalizedAngle >= startAngle || normalizedAngle <= endAngle;
    } else {
      return normalizedAngle >= startAngle && normalizedAngle <= endAngle;
    }
  }

  getIntersections(other) {
    if (other.type === 'line') {
      return other.lineArcIntersection(this);
    } else if (other.type === 'circle') {
      return other.getIntersections(this);
    } else if (other.type === 'arc') {
      const circleIntersections = new CircleEntity(this.center, this.radius)
        .circleCircleIntersection({ center: other.center, radius: other.radius });

      return circleIntersections.filter(point => {
        const angle1 = Math.atan2(point.y - this.center.y, point.x - this.center.x);
        let norm1 = angle1 < 0 ? angle1 + 2 * Math.PI : angle1;
        let start1 = this.startAngle < 0 ? this.startAngle + 2 * Math.PI : this.startAngle;
        let end1 = this.endAngle < 0 ? this.endAngle + 2 * Math.PI : this.endAngle;

        let onArc1 = false;
        if (start1 > end1) {
          onArc1 = norm1 >= start1 || norm1 <= end1;
        } else {
          onArc1 = norm1 >= start1 && norm1 <= end1;
        }

        if (!onArc1) return false;

        const angle2 = Math.atan2(point.y - other.center.y, point.x - other.center.x);
        let norm2 = angle2 < 0 ? angle2 + 2 * Math.PI : angle2;
        let start2 = other.startAngle < 0 ? other.startAngle + 2 * Math.PI : other.startAngle;
        let end2 = other.endAngle < 0 ? other.endAngle + 2 * Math.PI : other.endAngle;

        if (start2 > end2) {
          return norm2 >= start2 || norm2 <= end2;
        } else {
          return norm2 >= start2 && norm2 <= end2;
        }
      });
    }
    return [];
  }
}
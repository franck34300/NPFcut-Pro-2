import { Entity } from './Entity';

export class TextEntity extends Entity {
  constructor(position, text, fontSize = 20, fontFamily = 'Arial', arcRadius = 0) {
    super('text');
    this.position = position;
    this.text = text;
    this.fontSize = fontSize;
    this.fontFamily = fontFamily;
    this.arcRadius = arcRadius;
  }

  getHandles() {
    return [this.position];
  }

  moveHandle(index, newPos) {
    this.position = newPos;
  }

  move(dx, dy) {
    this.position = { x: this.position.x + dx, y: this.position.y + dy };
  }

  contains(point, tolerance) {
    if (!this.text || !this.position) return false;

    const approxWidth = this.text.length * this.fontSize * 0.6;
    const approxHeight = this.fontSize;

    return point.x >= this.position.x - tolerance &&
           point.x <= this.position.x + approxWidth + tolerance &&
           point.y >= this.position.y - approxHeight - tolerance &&
           point.y <= this.position.y + tolerance;
  }

  draw(ctx) {
    if (!this.text || !this.position) return;

    ctx.fillStyle = this.selected ? '#fbbf24' : this.color;
    ctx.font = `${this.fontSize}px ${this.fontFamily}`;
    ctx.textBaseline = 'middle';

    if (!this.arcRadius || Math.abs(this.arcRadius) < 10) {
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(this.text, this.position.x, this.position.y);

      if (this.selected) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 0.4;
        ctx.setLineDash([2, 2]);
        const width = ctx.measureText(this.text).width;
        ctx.beginPath();
        ctx.moveTo(this.position.x, this.position.y);
        ctx.lineTo(this.position.x + width, this.position.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else {
      const radius = Math.abs(this.arcRadius);
      const totalWidth = ctx.measureText(this.text).width;
      const anglePerChar = totalWidth / radius;

      const centerX = this.position.x + totalWidth / 2;
      const centerY = this.arcRadius > 0
        ? this.position.y + radius
        : this.position.y - radius;

      let currentAngle = this.arcRadius > 0 ? Math.PI : 0;
      currentAngle -= anglePerChar / 2;

      ctx.save();
      for (let i = 0; i < this.text.length; i++) {
        const char = this.text[i];
        const charWidth = ctx.measureText(char).width;
        const charAngle = charWidth / radius;

        currentAngle += charAngle / 2;

        const x = centerX + radius * Math.cos(currentAngle);
        const y = centerY + radius * Math.sin(currentAngle);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(currentAngle + (this.arcRadius > 0 ? Math.PI / 2 : -Math.PI / 2));
        ctx.fillText(char, -charWidth / 2, 0);
        ctx.restore();

        currentAngle += charAngle / 2;
      }
      ctx.restore();

      if (this.selected) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 0.4;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        const startAngle = this.arcRadius > 0 ? Math.PI - anglePerChar / 2 : -anglePerChar / 2;
        const endAngle = startAngle + anglePerChar;
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  getIntersections(other) {
    return [];
  }
}
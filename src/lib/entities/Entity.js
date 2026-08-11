// Base entity class
export class Entity {
  constructor(type) {
    this.id = Math.random().toString(36).substr(2, 9);
    this.type = type;
    this.selected = false;
    this.color = '#2dd4bf';
  }

  getHandles() { return []; }
  moveHandle(handleIndex, newPos) {}
  move(dx, dy) {}
  draw(ctx) {}
  contains(point, tolerance = 5) { return false; }
  getIntersections(other) { return []; }
}
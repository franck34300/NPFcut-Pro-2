import { Entity } from './Entity';

// Late-binding to avoid circular dependency with recreateEntity.js
let recreateFn = null;
export function setRecreateFn(fn) { recreateFn = fn; }

export class ContourEntity extends Entity {
  constructor(entities = []) {
    super('contour');
    this.entities = entities;
  }

  draw(ctx) {
    this.entities.forEach(data => {
      const e = recreateFn(data);
      if (e) e.draw(ctx);
    });
  }

  move(dx, dy) {
    this.entities.forEach(data => {
      const e = recreateFn(data);
      if (!e) return;
      e.move(dx, dy);
      Object.assign(data, JSON.parse(JSON.stringify(e)));
    });
  }

  getHandles() {
    const handles = [];
    this.entities.forEach(data => {
      const e = recreateFn(data);
      if (!e) return;
      handles.push(...e.getHandles());
    });
    return handles;
  }

  contains(point, tolerance = 5) {
    for (const data of this.entities) {
      const e = recreateFn(data);
      if (e && e.contains(point, tolerance)) return true;
    }
    return false;
  }

  getIntersections(other) {
    let pts = [];
    this.entities.forEach(data => {
      const e = recreateFn(data);
      if (!e) return;
      pts.push(...e.getIntersections(other));
    });
    return pts;
  }
}
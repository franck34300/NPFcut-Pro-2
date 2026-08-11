import { LineEntity } from './LineEntity';
import { RectangleEntity } from './RectangleEntity';
import { CircleEntity } from './CircleEntity';
import { ArcEntity } from './ArcEntity';
import { PathEntity } from './PathEntity';
import { TextEntity } from './TextEntity';
import { FreeformEntity } from './FreeformEntity';
import { ContourEntity, setRecreateFn } from './ContourEntity';

export function recreateEntity(data) {
  let entity;
  switch (data.type) {
    case 'line':
      entity = new LineEntity(data.start, data.end);
      break;
    case 'rectangle':
      entity = new RectangleEntity(data.topLeft, data.width, data.height);
      break;
    case 'circle':
      entity = new CircleEntity(data.center, data.radius);
      break;
    case 'arc':
      entity = new ArcEntity(data.center, data.radius, data.startAngle, data.endAngle);
      break;
    case 'path':
      entity = new PathEntity(data.points, data.closed);
      break;
    case 'contour':
      entity = new ContourEntity(data.entities || []);
      break;
    case 'text':
      entity = new TextEntity(data.position, data.text, data.fontSize, data.fontFamily, data.arcRadius || 0);
      break;
    case 'freeform':
      entity = new FreeformEntity(data.controlPoints, data.closed);
      break;
    default:
      return null;
  }
  entity.id = data.id;
  entity.selected = data.selected;
  entity.color = data.color;
  return entity;
}

setRecreateFn(recreateEntity);
import { recreateEntity } from './entities/recreateEntity';

export function exportGCode(entities, kerfWidth = 0, isHoleFn = null) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  }).toUpperCase().replace(/ /g, '-');

  let gcode = `( PART DESSIN.TXT )\n`;
  gcode += `( CONTROL  7 ZHAOZHAN.CON )\n`;
  gcode += `( TYPE EDGE )\n`;
  gcode += `( DATE ${dateStr} )\n`;
  gcode += `%\n`;
  gcode += `G71\n`;
  gcode += `G91\n`;

  let currentX = 0;
  let currentY = 0;
  let firstMove = true;

  const addLine = (endX, endY) => {
    const deltaX = endX - currentX;
    const deltaY = -(endY - currentY);
    gcode += `G01X${deltaX.toFixed(2)}Y${deltaY.toFixed(2)}\n`;
    currentX = endX;
    currentY = endY;
  };

  const addArc = (endX, endY, centerX, centerY, clockwise) => {
    const deltaX = endX - currentX;
    const deltaY = -(endY - currentY);
    const I = centerX - currentX;
    const J = -(centerY - currentY);
    const gCommand = clockwise ? 'G02' : 'G03';
    gcode += `${gCommand}X${deltaX.toFixed(2)}Y${deltaY.toFixed(2)}I${I.toFixed(2)}J${J.toFixed(2)}\n`;
    currentX = endX;
    currentY = endY;
  };

  // Offset a closed polygon by a constant distance (mitered joins). offset>0 grows.
  const offsetClosedPath = (pts, offset) => {
    const n = pts.length;
    let area = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    }
    const res = [];
    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n];
      const curr = pts[i];
      const next = pts[(i + 1) % n];
      const e1x = curr.x - prev.x, e1y = curr.y - prev.y;
      const e2x = next.x - curr.x, e2y = next.y - curr.y;
      const l1 = Math.hypot(e1x, e1y) || 1e-9;
      const l2 = Math.hypot(e2x, e2y) || 1e-9;
      let n1x, n1y, n2x, n2y;
      if (area > 0) { n1x = e1y / l1; n1y = -e1x / l1; n2x = e2y / l2; n2y = -e2x / l2; }
      else { n1x = -e1y / l1; n1y = e1x / l1; n2x = -e2y / l2; n2y = e2x / l2; }
      let mx = n1x + n2x, my = n1y + n2y;
      const mlen = Math.hypot(mx, my);
      if (mlen < 1e-6) { mx = n1x; my = n1y; }
      else { mx /= mlen; my /= mlen; }
      const dot = n1x * mx + n1y * my;
      const miter = Math.abs(dot) < 1e-6 ? 1 : Math.min(1 / dot, 10);
      const k = offset * miter;
      res.push({ x: curr.x + mx * k, y: curr.y + my * k });
    }
    return res;
  };

  entities.forEach((data) => {
    const entity = recreateEntity(data);
    if (!entity) return;

    // Kerf compensation: outer contours offset outward, holes inward
    let compPoints = null;
    let leadIn = data.leadIn;
    let leadOut = data.leadOut;
    let circleR = entity.radius;
    if (kerfWidth > 0) {
      const isHole = isHoleFn ? isHoleFn(data, entities) : false;
      const off = isHole ? -kerfWidth / 2 : kerfWidth / 2;
      if (entity.type === 'circle') {
        circleR = entity.radius + off;
      } else if (entity.type === 'path' && entity.closed && entity.points.length >= 3) {
        compPoints = offsetClosedPath(entity.points, off);
        if (leadIn) {
          const dx = compPoints[0].x - entity.points[0].x;
          const dy = compPoints[0].y - entity.points[0].y;
          leadIn = { x: leadIn.x + dx, y: leadIn.y + dy };
        }
        if (leadOut) {
          const lp = compPoints[compPoints.length - 1];
          const dx = lp.x - entity.points[entity.points.length - 1].x;
          const dy = lp.y - entity.points[entity.points.length - 1].y;
          leadOut = { x: leadOut.x + dx, y: leadOut.y + dy };
        }
      }
    }

    let startPoint;
    if (entity.type === 'line') {
      startPoint = entity.start;
    } else if (entity.type === 'circle') {
      startPoint = { x: entity.center.x + circleR, y: entity.center.y };
    } else if (entity.type === 'arc') {
      startPoint = {
        x: entity.center.x + entity.radius * Math.cos(entity.startAngle),
        y: entity.center.y + entity.radius * Math.sin(entity.startAngle)
      };
    } else if (entity.type === 'path') {
      startPoint = compPoints ? compPoints[0] : entity.points[0];
    } else if (entity.type === 'rectangle') {
      startPoint = entity.topLeft;
    }

    if (!startPoint) return;

    const hasLeadIn = leadIn;
    const targetPoint = hasLeadIn ? leadIn : startPoint;

    if (firstMove) {
      const deltaX = targetPoint.x - currentX;
      const deltaY = -(targetPoint.y - currentY);
      if (Math.abs(deltaX) > 0.01 || Math.abs(deltaY) > 0.01) {
        gcode += `G00X${deltaX.toFixed(2)}Y${deltaY.toFixed(2)}\n`;
      }
      currentX = targetPoint.x;
      currentY = targetPoint.y;

      if (hasLeadIn) {
        gcode += `M07\n`;
        addLine(startPoint.x, startPoint.y);
      } else {
        gcode += `M07\n`;
      }
      firstMove = false;
    } else {
      gcode += `M08\n`;
      const deltaX = targetPoint.x - currentX;
      const deltaY = -(targetPoint.y - currentY);
      gcode += `G00X${deltaX.toFixed(2)}Y${deltaY.toFixed(2)}\n`;
      currentX = targetPoint.x;
      currentY = targetPoint.y;

      if (hasLeadIn) {
        gcode += `M07\n`;
        addLine(startPoint.x, startPoint.y);
      } else {
        gcode += `M07\n`;
      }
    }

    if (entity.type === 'line') {
      addLine(entity.end.x, entity.end.y);
    } else if (entity.type === 'circle') {
      const r = circleR;
      const cx = entity.center.x;
      const cy = entity.center.y;
      addArc(cx - r, cy, cx, cy, false);
      addArc(cx + r, cy, cx, cy, false);
    } else if (entity.type === 'arc') {
      const endX = entity.center.x + entity.radius * Math.cos(entity.endAngle);
      const endY = entity.center.y + entity.radius * Math.sin(entity.endAngle);
      let deltaAngle = entity.endAngle - entity.startAngle;
      if (deltaAngle < 0) deltaAngle += 2 * Math.PI;
      const clockwise = deltaAngle > Math.PI;
      addArc(endX, endY, entity.center.x, entity.center.y, clockwise);
    } else if (entity.type === 'rectangle') {
      const lines = entity.toLines();
      lines.forEach(line => {
        addLine(line.end.x, line.end.y);
      });
    } else if (entity.type === 'path') {
      const pts = compPoints || entity.points;
      for (let i = 1; i < pts.length; i++) {
        addLine(pts[i].x, pts[i].y);
      }
      if (entity.closed && pts.length > 2) {
        addLine(pts[0].x, pts[0].y);
      }
    }

    if (leadOut) {
      addLine(leadOut.x, leadOut.y);
    }
  });

  gcode += `M08\n`;
  gcode += `M02\n`;

  return gcode;
}
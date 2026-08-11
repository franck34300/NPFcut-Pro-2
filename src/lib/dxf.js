import { recreateEntity } from './entities/recreateEntity';

const genId = () => Math.random().toString(36).substr(2, 9);
const DEFAULT_COLOR = '#2dd4bf';

const colorMap = {
  '1': '#ff0000', '2': '#ffff00', '3': '#00ff00',
  '4': '#00ffff', '5': '#0000ff', '6': '#ff00ff',
  '7': '#ffffff', '8': '#808080', '9': '#c0c0c0',
  '10': '#ff0000', '11': '#ff8000', '12': '#ffff00',
  '13': '#80ff00', '14': '#00ff00', '15': '#00ff80',
  '250': '#c0c0c0', '251': '#ffffff'
};

const ignoreCodes = new Set(['100', '102', '330', '331', '360', '370', '9', '305', '410', '310', '311', '312']);

// Convert a bulge arc (LWPOLYLINE) to sampled points. Y is already flipped.
function bulgeToPoints(p1, p2, bulge) {
  if (Math.abs(bulge) < 0.0001) return [p1, p2];
  const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  if (d < 0.001) return [p1];
  const theta = 4 * Math.atan(Math.abs(bulge));
  const R = d / (2 * Math.sin(theta / 2));
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  const dx = (p2.x - p1.x) / d;
  const dy = (p2.y - p1.y) / d;
  const h = R * Math.cos(theta / 2);
  // bulge sign is in DXF space; after Y flip, direction reverses → negate
  const sign = bulge > 0 ? -1 : 1;
  const cx = mx + (-dy * sign) * h;
  const cy = my + (dx * sign) * h;
  const startAngle = Math.atan2(p1.y - cy, p1.x - cx);
  const endAngle = Math.atan2(p2.y - cy, p2.x - cx);
  let sweep = endAngle - startAngle;
  if (sign > 0 && sweep < 0) sweep += 2 * Math.PI;
  if (sign < 0 && sweep > 0) sweep -= 2 * Math.PI;
  const steps = Math.max(4, Math.round(Math.abs(sweep) * R / 2));
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = startAngle + (sweep * i / steps);
    pts.push({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) });
  }
  return pts;
}

// Catmull-Rom spline through points (for fit points) — produces smooth curve passing through each point.
function catmullRomPath(pts, segmentsPerSpan) {
  if (pts.length < 2) return pts;
  if (pts.length === 2) return [pts[0], pts[1]];
  const result = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || pts[i + 1];
    for (let t = 0; t < segmentsPerSpan; t++) {
      const s = t / segmentsPerSpan;
      const s2 = s * s, s3 = s2 * s;
      result.push({
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * s + (2*p0.x - 5*p1.x + 4*p2.x - p3.x) * s2 + (-p0.x + 3*p1.x - 3*p2.x + p3.x) * s3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * s + (2*p0.y - 5*p1.y + 4*p2.y - p3.y) * s2 + (-p0.y + 3*p1.y - 3*p2.y + p3.y) * s3)
      });
    }
  }
  result.push(pts[pts.length - 1]);
  return result;
}

// Evaluate a clamped B-spline using the de Boor algorithm.
function evalBSplinePath(controlPts, knots, degree, samples) {
  if (controlPts.length < 2) return controlPts;
  if (!knots || knots.length < controlPts.length + degree + 1) {
    // Fallback: treat control points as a Catmull-Rom path
    return catmullRomPath(controlPts, 16);
  }
  const n = controlPts.length - 1;
  const uMin = knots[degree];
  const uMax = knots[n + 1];
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    let u = uMin + (uMax - uMin) * i / samples;
    if (i === samples) u = uMax - 0.00001; // avoid endpoint singularity
    // Find span
    let span;
    if (u >= knots[n + 1]) span = n;
    else if (u <= knots[degree]) span = degree;
    else {
      let low = degree, high = n + 1, mid = Math.floor((low + high) / 2);
      while (u < knots[mid] || u >= knots[mid + 1]) {
        if (u < knots[mid]) high = mid; else low = mid;
        mid = Math.floor((low + high) / 2);
      }
      span = mid;
    }
    // de Boor basis functions
    const N = new Array(degree + 1).fill(0);
    const left = new Array(degree + 1).fill(0);
    const right = new Array(degree + 1).fill(0);
    N[0] = 1;
    for (let j = 1; j <= degree; j++) {
      left[j] = u - knots[span + 1 - j];
      right[j] = knots[span + j] - u;
      let saved = 0;
      for (let r = 0; r < j; r++) {
        const denom = right[r + 1] + left[j - r];
        const tmp = Math.abs(denom) < 1e-10 ? 0 : N[r] / denom;
        N[r] = saved + right[r + 1] * tmp;
        saved = left[j - r] * tmp;
      }
      N[j] = saved;
    }
    let x = 0, y = 0;
    for (let j = 0; j <= degree; j++) {
      const cp = controlPts[span - degree + j];
      x += cp.x * N[j];
      y += cp.y * N[j];
    }
    pts.push({ x, y });
  }
  return pts;
}

// Parse DXF pairs into (code, value) objects
function parsePairs(fileContent) {
  const rawLines = fileContent.split(/\r?\n/);
  const lines = [];
  for (let i = 0; i < rawLines.length; i++) {
    if (i % 2 === 0) {
      const code = rawLines[i].trim();
      const value = (rawLines[i + 1] || '').trim();
      lines.push({ code, value });
    }
  }
  return lines;
}

// Process a range of pairs and return plain entity data objects
function processPairs(pairs, start, end, blocks) {
  const entities = [];
  let current = null;
  let color = DEFAULT_COLOR;
  let inPoly = false, polyVerts = [], polyBulges = [], polyClosed = false;
  let inSpline = false;
  let splineControlPts = [], splineFitPts = [], splineKnots = [], splineDegree = 3;
  let lwpoly = null;

  const makeLine = (x1, y1, x2, y2) => ({
    id: genId(), type: 'line', selected: false, color,
    start: { x: x1, y: -y1 }, end: { x: x2, y: -y2 }
  });
  const makeCircle = (cx, cy, r) => ({
    id: genId(), type: 'circle', selected: false, color,
    center: { x: cx, y: -cy }, radius: r
  });
  // DXF angles are CCW in Y-up space. After Y-flip to canvas (Y-down), the visual
  // direction reverses; compensate by negating and swapping start/end.
  const makeArc = (cx, cy, r, sa, ea) => ({
    id: genId(), type: 'arc', selected: false, color,
    center: { x: cx, y: -cy }, radius: r, startAngle: -ea, endAngle: -sa
  });
  const makePath = (pts, closed) => ({
    id: genId(), type: 'path', selected: false, color,
    points: pts, closed: !!closed
  });

  const flushLwpoly = () => {
    if (!lwpoly || !lwpoly.vertices || lwpoly.vertices.length < 2) { lwpoly = null; return; }
    const pts = [];
    const n = lwpoly.vertices.length;
    for (let k = 0; k < n; k++) {
      const v = lwpoly.vertices[k];
      if (k === 0) pts.push({ x: v.x, y: -v.y });
      if (k < n - 1 || lwpoly.closed) {
        const next = lwpoly.vertices[(k + 1) % n];
        const p1 = { x: v.x, y: -v.y };
        const p2 = { x: next.x, y: -next.y };
        const bulge = v.bulge || 0;
        if (Math.abs(bulge) < 0.0001) {
          pts.push(p2);
        } else {
          const arcPts = bulgeToPoints(p1, p2, bulge);
          pts.push(...arcPts.slice(1));
        }
      }
    }
    entities.push(makePath(pts, lwpoly.closed));
    lwpoly = null;
  };

  const flushPolyline = () => {
    if (polyVerts.length >= 2) {
      const pts = [];
      for (let k = 0; k < polyVerts.length; k++) {
        if (k === 0) pts.push(polyVerts[k]);
        if (k < polyVerts.length - 1 || polyClosed) {
          const next = polyVerts[(k + 1) % polyVerts.length];
          const bulge = polyBulges[k] || 0;
          if (Math.abs(bulge) < 0.0001) {
            pts.push(next);
          } else {
            const arcPts = bulgeToPoints(polyVerts[k], next, bulge);
            pts.push(...arcPts.slice(1));
          }
        }
      }
      entities.push(makePath(pts, polyClosed));
    }
    inPoly = false; polyVerts = []; polyBulges = []; polyClosed = false;
  };

  const flushSpline = () => {
    if (splineControlPts.length >= 2 || splineFitPts.length >= 2) {
      let pts;
      if (splineFitPts.length >= 2) {
        // Fit points lie ON the curve → smooth Catmull-Rom through them.
        pts = catmullRomPath(splineFitPts, 12);
      } else {
        // Use control points + knots via de Boor B-spline evaluation.
        const samples = Math.max(32, splineControlPts.length * 12);
        pts = evalBSplinePath(splineControlPts, splineKnots, splineDegree, samples);
      }
      // Apply Y-flip to all points (they were stored in DXF Y-up space)
      pts = pts.map(p => ({ x: p.x, y: -p.y }));
      entities.push(makePath(pts, false));
    }
    inSpline = false;
    splineControlPts = []; splineFitPts = []; splineKnots = []; splineDegree = 3;
  };

  const flushCurrent = () => {
    flushLwpoly();
    flushPolyline();
    flushSpline();
    if (!current) return;
    if (current.type === 'LINE' && current.x1 !== undefined && current.y1 !== undefined &&
        current.x2 !== undefined && current.y2 !== undefined) {
      entities.push(makeLine(current.x1, current.y1, current.x2, current.y2));
    } else if (current.type === 'CIRCLE' && current.cx !== undefined && current.cy !== undefined && current.r !== undefined) {
      entities.push(makeCircle(current.cx, current.cy, current.r));
    } else if (current.type === 'ARC' && current.cx !== undefined && current.cy !== undefined && current.r !== undefined) {
      entities.push(makeArc(current.cx, current.cy, current.r, current.startAngle || 0, current.endAngle || Math.PI * 2));
    } else if (current.type === 'ELLIPSE' && current.cx !== undefined && current.mx !== undefined && current.ratio !== undefined) {
      // Ellipse: center (10,20), major axis endpoint (11,21), ratio (40), start (41), end (42)
      const majorLen = Math.hypot(current.mx - current.cx, current.my - current.cy);
      const minorLen = majorLen * Math.abs(current.ratio);
      const angle = Math.atan2(current.my - current.cy, current.mx - current.cx);
      const start = current.startParam || 0;
      const end = current.endParam || 2 * Math.PI;
      const steps = Math.max(24, Math.round(Math.abs(end - start) * majorLen / 3));
      const pts = [];
      for (let i = 0; i <= steps; i++) {
        const t = start + (end - start) * i / steps;
        const ex = majorLen * Math.cos(t);
        const ey = minorLen * Math.sin(t);
        const x = current.cx + ex * Math.cos(angle) - ey * Math.sin(angle);
        const y = current.cy + ex * Math.sin(angle) + ey * Math.cos(angle);
        pts.push({ x, y: -y });
      }
      entities.push(makePath(pts, Math.abs(end - start) >= 2 * Math.PI - 0.01));
    } else if (current.type === 'INSERT' && current.blockName && blocks && blocks[current.blockName]) {
      // Expand INSERT: transform from block (DXF) space to world (DXF) space
      const blockEntities = blocks[current.blockName];
      const ix = current.ix || 0, iy = current.iy || 0;
      const sx = current.sx || 1, sy = current.sy || 1;
      const rot = (current.rotation || 0) * Math.PI / 180;
      const cosR = Math.cos(rot), sinR = Math.sin(rot);
      // Transform in DXF coordinates (un-flipped)
      const transformDXF = (p, bx, by) => {
        const dx = (p.x - bx) * sx;
        const dy = (p.y - by) * sy;
        const rx = dx * cosR - dy * sinR;
        const ry = dx * sinR + dy * cosR;
        return { x: ix + rx, y: iy + ry };
      };
      blockEntities.forEach(be => {
        const bx = be._bx || 0, by = be._by || 0;
        if (be.type === 'line') {
          // be.start/end are flipped; un-flip to DXF, transform, makeLine re-flips
          const s = transformDXF({ x: be.start.x, y: -be.start.y }, bx, by);
          const e = transformDXF({ x: be.end.x, y: -be.end.y }, bx, by);
          entities.push(makeLine(s.x, s.y, e.x, e.y));
        } else if (be.type === 'circle') {
          const c = transformDXF({ x: be.center.x, y: -be.center.y }, bx, by);
          entities.push(makeCircle(c.x, c.y, be.radius * Math.abs(sx)));
        } else if (be.type === 'arc') {
          const c = transformDXF({ x: be.center.x, y: -be.center.y }, bx, by);
          // be stores canvas-space angles (negated DXF). Convert back to DXF, rotate, re-flip.
          const dxfStart = -be.endAngle + rot;
          const dxfEnd = -be.startAngle + rot;
          entities.push(makeArc(c.x, c.y, be.radius * Math.abs(sx), dxfStart, dxfEnd));
        } else if (be.type === 'path') {
          const pts = be.points.map(p => {
            const tp = transformDXF({ x: p.x, y: -p.y }, bx, by);
            return { x: tp.x, y: -tp.y };
          });
          entities.push(makePath(pts, be.closed));
        }
      });
    }
    current = null;
  };

  for (let i = start; i < end; i++) {
    const { code, value } = pairs[i];
    if (ignoreCodes.has(code)) continue;

    if (code === '0') {
      flushCurrent();
      const v = value.toUpperCase();
      if (v === 'LWPOLYLINE') { lwpoly = { vertices: [], closed: false }; }
      else if (v === 'POLYLINE') { inPoly = true; polyVerts = []; polyBulges = []; polyClosed = false; }
      else if (v === 'SPLINE') {
        inSpline = true;
        splineControlPts = []; splineFitPts = []; splineKnots = []; splineDegree = 3;
      }
      else if (v === 'VERTEX' && inPoly) { current = { type: 'VERTEX' }; }
      else if (v === 'SEQEND') { flushPolyline(); current = null; }
      else if (v === 'ENDBLK') { current = null; }
      else { current = { type: v }; }
    } else if (code === '62') {
      color = colorMap[value] || DEFAULT_COLOR;
    } else if (lwpoly) {
      if (code === '10') lwpoly.vertices.push({ x: parseFloat(value), y: 0, bulge: 0 });
      else if (code === '20' && lwpoly.vertices.length > 0) lwpoly.vertices[lwpoly.vertices.length - 1].y = parseFloat(value);
      else if (code === '42' && lwpoly.vertices.length > 0) lwpoly.vertices[lwpoly.vertices.length - 1].bulge = parseFloat(value);
      else if (code === '70') lwpoly.closed = (parseInt(value) & 1) === 1;
    } else if (inPoly && current && current.type === 'VERTEX') {
      if (code === '10') current.x = parseFloat(value);
      else if (code === '20') {
        current.y = parseFloat(value);
        if (!isNaN(current.x) && !isNaN(current.y)) {
          polyVerts.push({ x: current.x, y: -current.y });
          polyBulges.push(0);
        }
      } else if (code === '42' && polyBulges.length > 0) {
        polyBulges[polyBulges.length - 1] = parseFloat(value);
      }
    } else if (inPoly && code === '70') {
      polyClosed = (parseInt(value) & 1) === 1;
    } else if (inSpline) {
      if (code === '71') splineDegree = Math.max(1, parseInt(value) || 3);
      else if (code === '10') splineControlPts.push({ x: parseFloat(value), y: 0 });
      else if (code === '20' && splineControlPts.length > 0) splineControlPts[splineControlPts.length - 1].y = parseFloat(value);
      else if (code === '11') splineFitPts.push({ x: parseFloat(value), y: 0 });
      else if (code === '21' && splineFitPts.length > 0) splineFitPts[splineFitPts.length - 1].y = parseFloat(value);
      else if (code === '40') splineKnots.push(parseFloat(value));
    } else if (current) {
      const t = current.type;
      if (t === 'LINE') {
        if (code === '10') current.x1 = parseFloat(value);
        else if (code === '20') current.y1 = parseFloat(value);
        else if (code === '11') current.x2 = parseFloat(value);
        else if (code === '21') current.y2 = parseFloat(value);
      } else if (t === 'CIRCLE') {
        if (code === '10') current.cx = parseFloat(value);
        else if (code === '20') current.cy = parseFloat(value);
        else if (code === '40') current.r = parseFloat(value);
      } else if (t === 'ARC') {
        if (code === '10') current.cx = parseFloat(value);
        else if (code === '20') current.cy = parseFloat(value);
        else if (code === '40') current.r = parseFloat(value);
        else if (code === '50') current.startAngle = parseFloat(value) * Math.PI / 180;
        else if (code === '51') current.endAngle = parseFloat(value) * Math.PI / 180;
      } else if (t === 'ELLIPSE') {
        if (code === '10') current.cx = parseFloat(value);
        else if (code === '20') current.cy = parseFloat(value);
        else if (code === '11') current.mx = parseFloat(value);
        else if (code === '21') current.my = parseFloat(value);
        else if (code === '40') current.ratio = parseFloat(value);
        else if (code === '41') current.startParam = parseFloat(value);
        else if (code === '42') current.endParam = parseFloat(value);
      } else if (t === 'INSERT') {
        if (code === '2') current.blockName = value;
        else if (code === '10') current.ix = parseFloat(value);
        else if (code === '20') current.iy = parseFloat(value);
        else if (code === '41') current.sx = parseFloat(value);
        else if (code === '42') current.sy = parseFloat(value);
        else if (code === '50') current.rotation = parseFloat(value);
        else if (code === '44') current.bx = parseFloat(value);
        else if (code === '24') current.by = parseFloat(value);
      }
    }
  }

  flushCurrent();
  return entities;
}

export function importDXF(fileContent) {
  const pairs = parsePairs(fileContent);

  // Find BLOCKS and ENTITIES section boundaries
  let blocksStart = -1, blocksEnd = -1;
  let entitiesStart = -1, entitiesEnd = -1;
  let currentSection = null;

  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i].code === '0' && pairs[i].value === 'SECTION') {
      if (i + 1 < pairs.length && pairs[i + 1].code === '2') {
        currentSection = pairs[i + 1].value;
        if (currentSection === 'BLOCKS') blocksStart = i + 2;
        else if (currentSection === 'ENTITIES') entitiesStart = i + 2;
      }
    } else if (pairs[i].code === '0' && pairs[i].value === 'ENDSEC') {
      if (currentSection === 'BLOCKS') blocksEnd = i;
      else if (currentSection === 'ENTITIES') entitiesEnd = i;
      currentSection = null;
    }
  }

  // Parse BLOCKS section: collect block definitions with base points
  const blocks = {};
  if (blocksStart >= 0 && blocksEnd >= 0) {
    const blockRanges = [];
    let blockStart = -1, blockName = null;
    for (let j = blocksStart; j < blocksEnd; j++) {
      if (pairs[j].code === '0' && pairs[j].value === 'BLOCK') {
        blockStart = j;
        blockName = null;
      } else if (pairs[j].code === '2' && blockStart >= 0 && blockName === null) {
        blockName = pairs[j].value;
      } else if (pairs[j].code === '0' && pairs[j].value === 'ENDBLK') {
        if (blockStart >= 0) { blockRanges.push({ start: blockStart, end: j, name: blockName }); blockStart = -1; }
      }
    }
    for (const range of blockRanges) {
      let entityStart = range.start + 1;
      while (entityStart < range.end && pairs[entityStart].code !== '0') entityStart++;
      let bx = 0, by = 0;
      for (let j = range.start; j < entityStart; j++) {
        if (pairs[j].code === '10') bx = parseFloat(pairs[j].value);
        else if (pairs[j].code === '20') by = parseFloat(pairs[j].value);
      }
      const blockEntities = processPairs(pairs, entityStart, range.end, null);
      if (range.name) blocks[range.name] = blockEntities.map(e => ({ ...e, _bx: bx, _by: by }));
    }
  }

  // Parse ENTITIES section
  let newEntities = [];
  if (entitiesStart >= 0 && entitiesEnd >= 0) {
    newEntities = processPairs(pairs, entitiesStart, entitiesEnd, blocks);
  } else {
    // Fallback: process entire file (non-section-aware)
    newEntities = processPairs(pairs, 0, pairs.length, blocks);
  }

  // Filter out tiny entities
  const minSize = 0.1;
  const cleanedEntities = newEntities.filter(data => {
    if (data.type === 'line') {
      const len = Math.hypot(data.end.x - data.start.x, data.end.y - data.start.y);
      return len >= minSize;
    }
    if (data.type === 'circle') return data.radius >= minSize;
    if (data.type === 'arc') return data.radius >= minSize;
    if (data.type === 'path' && data.points) {
      if (data.points.length < 2) return false;
      let totalLen = 0;
      for (let j = 1; j < data.points.length; j++) {
        totalLen += Math.hypot(data.points[j].x - data.points[j - 1].x, data.points[j].y - data.points[j - 1].y);
      }
      return totalLen >= minSize;
    }
    return true;
  });

  const filteredCount = newEntities.length - cleanedEntities.length;
  let message = `✅ Import DXF réussi!\n${cleanedEntities.length} entités importées`;
  if (filteredCount > 0) message += `\n🧹 ${filteredCount} entités filtrées`;

  return { newEntities: cleanedEntities, message };
}

export function exportDXF(entities) {
  let dxf = '0\nSECTION\n2\nHEADER\n';
  dxf += '9\n$ACADVER\n1\nAC1015\n';
  dxf += '0\nENDSEC\n';

  dxf += '0\nSECTION\n2\nENTITIES\n';

  const colorToDXF = (color) => {
    const map = {
      '#ff0000': '1', '#ffff00': '2', '#00ff00': '3',
      '#00ffff': '4', '#0000ff': '5', '#ff00ff': '6',
      '#ffffff': '7', '#2dd4bf': '4', '#fbbf24': '2'
    };
    return map[(color || '').toLowerCase()] || '7';
  };

  entities.forEach(data => {
    const entity = recreateEntity(data);
    if (!entity) return;
    const colorCode = colorToDXF(entity.color);

    if (entity.type === 'line') {
      dxf += '0\nLINE\n';
      dxf += '8\n0\n';
      dxf += `62\n${colorCode}\n`;
      dxf += `10\n${entity.start.x}\n`;
      dxf += `20\n${-entity.start.y}\n`;
      dxf += `30\n0.0\n`;
      dxf += `11\n${entity.end.x}\n`;
      dxf += `21\n${-entity.end.y}\n`;
      dxf += `31\n0.0\n`;
    } else if (entity.type === 'circle') {
      dxf += '0\nCIRCLE\n';
      dxf += '8\n0\n';
      dxf += `62\n${colorCode}\n`;
      dxf += `10\n${entity.center.x}\n`;
      dxf += `20\n${-entity.center.y}\n`;
      dxf += `30\n0.0\n`;
      dxf += `40\n${entity.radius}\n`;
    } else if (entity.type === 'arc') {
      dxf += '0\nARC\n';
      dxf += '8\n0\n';
      dxf += `62\n${colorCode}\n`;
      dxf += `10\n${entity.center.x}\n`;
      dxf += `20\n${-entity.center.y}\n`;
      dxf += `30\n0.0\n`;
      dxf += `40\n${entity.radius}\n`;
      dxf += `50\n${-entity.endAngle * 180 / Math.PI}\n`;
      dxf += `51\n${-entity.startAngle * 180 / Math.PI}\n`;
    } else if (entity.type === 'rectangle') {
      const lines = entity.toLines();
      lines.forEach(line => {
        dxf += '0\nLINE\n';
        dxf += '8\n0\n';
        dxf += `62\n${colorCode}\n`;
        dxf += `10\n${line.start.x}\n`;
        dxf += `20\n${-line.start.y}\n`;
        dxf += `30\n0.0\n`;
        dxf += `11\n${line.end.x}\n`;
        dxf += `21\n${-line.end.y}\n`;
        dxf += `31\n0.0\n`;
      });
    } else if (entity.type === 'path') {
      dxf += '0\nLWPOLYLINE\n';
      dxf += '8\n0\n';
      dxf += `62\n${colorCode}\n`;
      dxf += `90\n${entity.points.length}\n`;
      dxf += `70\n${entity.closed ? '1' : '0'}\n`;
      entity.points.forEach(point => {
        dxf += `10\n${point.x}\n`;
        dxf += `20\n${-point.y}\n`;
      });
    }
  });

  dxf += '0\nENDSEC\n';
  dxf += '0\nEOF\n';

  return dxf;
}
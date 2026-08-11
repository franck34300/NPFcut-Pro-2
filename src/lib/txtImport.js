import { distance } from './geometry';

const genId = () => Math.random().toString(36).substr(2, 9);
const COLOR = '#2dd4bf';

function getEnds(entity) {
  switch (entity.type) {
    case 'line':
      return { start: entity.start, end: entity.end };
    case 'arc':
      return {
        start: {
          x: entity.center.x + entity.radius * Math.cos(entity.startAngle),
          y: entity.center.y + entity.radius * Math.sin(entity.startAngle)
        },
        end: {
          x: entity.center.x + entity.radius * Math.cos(entity.endAngle),
          y: entity.center.y + entity.radius * Math.sin(entity.endAngle)
        }
      };
    case 'circle':
      return null;
    default:
      return null;
  }
}

function buildContours(entities) {
  const tolerance = 0.05;
  const used = new Array(entities.length).fill(false);
  const contours = [];

  while (true) {
    const firstIndex = used.findIndex(v => !v);
    if (firstIndex === -1) break;

    used[firstIndex] = true;
    const contour = [entities[firstIndex]];

    const firstEnds = getEnds(entities[firstIndex]);
    if (!firstEnds) {
      contours.push(contour);
      continue;
    }

    let start = firstEnds.start;
    let end = firstEnds.end;
    let changed = true;

    while (changed) {
      changed = false;
      for (let i = 0; i < entities.length; i++) {
        if (used[i]) continue;
        const ends = getEnds(entities[i]);
        if (!ends) continue;

        if (distance(end, ends.start) < tolerance) {
          contour.push(entities[i]);
          used[i] = true;
          end = ends.end;
          changed = true;
          break;
        }
        if (distance(start, ends.end) < tolerance) {
          contour.unshift(entities[i]);
          used[i] = true;
          start = ends.start;
          changed = true;
          break;
        }
      }
    }
    contours.push(contour);
  }

  return contours;
}

export function parseMachineTXT(text) {
  const lines = text.split(/\r?\n/);

  let incremental = true;
  let currentPos = { x: 0, y: 0 };
  let cutting = false;

  const imported = [];

  const getValue = (line, letter) => {
    const m = line.match(new RegExp(letter + "(-?\\d*\\.?\\d+)"));
    return m ? parseFloat(m[1]) : null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line === "" || line.startsWith("(") || line.startsWith("%")) {
      continue;
    }

    if (line.startsWith("G90")) {
      incremental = false;
      continue;
    }
    if (line.startsWith("G91")) {
      incremental = true;
      continue;
    }
    if (line.startsWith("M07")) {
      cutting = true;
      continue;
    }
    if (line.startsWith("M08")) {
      cutting = false;
      continue;
    }

    if (!line.startsWith("G00") && !line.startsWith("G01") &&
        !line.startsWith("G02") && !line.startsWith("G03")) {
      continue;
    }

    const cmd = line.substring(0, 3);

    const x = getValue(line, "X");
    const y = getValue(line, "Y");
    const i = getValue(line, "I");
    const j = getValue(line, "J");

    let newPos = { ...currentPos };

    if (x !== null) {
      if (incremental) newPos.x += x;
      else newPos.x = x;
    }
    if (y !== null) {
      if (incremental) newPos.y -= y;
      else newPos.y = -y;
    }

    if (!cutting) {
      currentPos = newPos;
      continue;
    }

    if (cmd === "G00" || cmd === "G01") {
      imported.push({
        id: genId(),
        type: 'line',
        selected: false,
        color: COLOR,
        start: { ...currentPos },
        end: { ...newPos }
      });
    } else if (cmd === "G02" || cmd === "G03") {
      if (i !== null && j !== null) {
        const center = { x: currentPos.x + i, y: currentPos.y - j };
        const radius = distance(center, currentPos);

        const startAngle = Math.atan2(currentPos.y - center.y, currentPos.x - center.x);
        const endAngle = Math.atan2(newPos.y - center.y, newPos.x - center.x);

        if (distance(currentPos, newPos) < 0.001) {
          imported.push({
            id: genId(),
            type: 'circle',
            selected: false,
            color: COLOR,
            center,
            radius
          });
          currentPos = newPos;
          continue;
        }

        imported.push({
          id: genId(),
          type: 'arc',
          selected: false,
          color: COLOR,
          center,
          radius,
          startAngle,
          endAngle,
          startPoint: { ...currentPos },
          endPoint: { ...newPos }
        });
      }
    }

    currentPos = newPos;
  }

  const contours = buildContours(imported);

  const finalEntities = contours.map(contour => ({
    id: genId(),
    type: 'contour',
    selected: false,
    color: COLOR,
    entities: contour
  }));

  return { entities: finalEntities, count: contours.length };
}
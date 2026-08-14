import { LineEntity } from '@/lib/entities/LineEntity';
import { CircleEntity } from '@/lib/entities/CircleEntity';
import { ArcEntity } from '@/lib/entities/ArcEntity';
import { PathEntity } from '@/lib/entities/PathEntity';
import { TextEntity } from '@/lib/entities/TextEntity';
import { FreeformEntity } from '@/lib/entities/FreeformEntity';
import { ContourEntity } from '@/lib/entities/ContourEntity';
import { recreateEntity } from '@/lib/entities/recreateEntity';
import { distance } from '@/lib/geometry';
import { loadOpentypeScript } from '@/lib/loadOpentype';
import { FONT_URLS, DEFAULT_FONT_URL } from '@/lib/fonts';
import { importDXF as importDXFModule, exportDXF as exportDXFModule } from '@/lib/dxf';
import { exportGCode as exportGCodeModule } from '@/lib/gcode';
import { parseMachineTXT } from '@/lib/txtImport';
import { exportDrawingPDF } from '@/lib/exportPDF';
import { rotateSelectedEntities } from '@/lib/cad/rotateSelectedEntities';

export function useCADOperations(ctx) {
  const {
    entities, setEntities, addToHistory, showToast, getSelectionBBox,
    setDialogOpen, setDialogTitle, setDialogInputs, setDialogCallback, setDialogPosition, setDialogOptions,
    setManualFusionMode, setManualFusionPoints, setManualFusionEntities,
    manualFusionEntities,
    fontCache, setGcodePreview, setAddingTab, tabMode, setTabMode,
    kerfWidth, setBreakMode, camera,
    setScissorsMode, scissorsFirst, setScissorsFirst,
    setShowCuttingPath,
  } = ctx;

  const openDialog = (title, inputs, callback, options = null) => {
    setDialogTitle(title);
    setDialogInputs(inputs);
    setDialogPosition(null);
    setDialogOptions(options);
    setDialogCallback(() => callback);
    setDialogOpen(true);
  };

  // ════════════════════════════════════════════════════
  // GEOMETRY OPERATIONS
  // ════════════════════════════════════════════════════

  const createBisector = () => {
    const selectedLines = entities.filter(e => e.selected && e.type === 'line');
    if (selectedLines.length !== 2) {
      showToast('⚠️ Sélectionnez exactement 2 lignes', 'warning');
      return;
    }
    const line1 = recreateEntity(selectedLines[0]);
    const line2 = recreateEntity(selectedLines[1]);
    const dx1 = line1.end.x - line1.start.x, dy1 = line1.end.y - line1.start.y;
    const dx2 = line2.end.x - line2.start.x, dy2 = line2.end.y - line2.start.y;
    const det = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(det) < 0.001) { showToast('⚠️ Les lignes sont parallèles', 'warning'); return; }
    const dx = line2.start.x - line1.start.x, dy = line2.start.y - line1.start.y;
    const t1 = (dx * dy2 - dy * dx2) / det;
    const intersection = { x: line1.start.x + t1 * dx1, y: line1.start.y + t1 * dy1 };
    const len1 = Math.sqrt(dx1*dx1 + dy1*dy1), len2 = Math.sqrt(dx2*dx2 + dy2*dy2);
    const dir1 = { x: dx1/len1, y: dy1/len1 }, dir2 = { x: dx2/len2, y: dy2/len2 };
    const cross = dir1.x * dir2.y - dir1.y * dir2.x;
    let bisectorDir = { x: (dir1.x + dir2.x) / 2, y: (dir1.y + dir2.y) / 2 };
    let bisectorLen = Math.sqrt(bisectorDir.x**2 + bisectorDir.y**2);
    if (bisectorLen < 0.001) { bisectorDir = { x: -dir1.y, y: dir1.x }; bisectorLen = 1; }
    bisectorDir.x /= bisectorLen; bisectorDir.y /= bisectorLen;
    if (cross > 0) { bisectorDir.x = -bisectorDir.x; bisectorDir.y = -bisectorDir.y; }
    const inf = 10000;
    const b1 = new LineEntity(
      { x: intersection.x - bisectorDir.x * inf, y: intersection.y - bisectorDir.y * inf },
      { x: intersection.x + bisectorDir.x * inf, y: intersection.y + bisectorDir.y * inf }
    );
    b1.color = '#fbbf24';
    const b2 = new LineEntity(
      { x: intersection.x - bisectorDir.y * inf, y: intersection.y + bisectorDir.x * inf },
      { x: intersection.x + bisectorDir.y * inf, y: intersection.y - bisectorDir.x * inf }
    );
    b2.color = '#f59e0b';
    const newEntities = [...entities, JSON.parse(JSON.stringify(b1)), JSON.parse(JSON.stringify(b2))];
    setEntities(newEntities);
    addToHistory(newEntities);
    showToast('✅ 2 bissectrices créées', 'success');
  };

  const extendLines = () => {
    const selectedLines = entities.filter(e => e.selected && e.type === 'line');
    if (selectedLines.length === 0) { showToast('⚠️ Sélectionnez au moins une ligne', 'warning'); return; }
    openDialog('Prolonger lignes', { distance: 10 }, (values) => {
      const d = values.distance || 10;
      const updated = entities.map(data => {
        if (!data.selected || data.type !== 'line') return data;
        const line = recreateEntity(data);
        const dx = line.end.x - line.start.x, dy = line.end.y - line.start.y;
        const len = Math.sqrt(dx*dx + dy*dy);
        if (len < 0.001) return data;
        const dirX = dx / len, dirY = dy / len;
        const extended = new LineEntity(
          { x: line.start.x - dirX * d, y: line.start.y - dirY * d },
          { x: line.end.x + dirX * d, y: line.end.y + dirY * d }
        );
        extended.id = data.id; extended.selected = true; extended.color = data.color;
        return JSON.parse(JSON.stringify(extended));
      });
      setEntities(updated); addToHistory(updated); setDialogOpen(false);
      showToast(`✅ ${selectedLines.length} ligne(s) prolongée(s) de ${d}mm`, 'success');
    });
  };

  const reverseArc = () => {
    const selectedArcs = entities.filter(e => e.selected && e.type === 'arc');
    if (selectedArcs.length === 0) { showToast('⚠️ Sélectionnez au moins un arc', 'warning'); return; }
    const updated = entities.map(data => {
      if (!data.selected || data.type !== 'arc') return data;
      return { ...data, startAngle: data.endAngle, endAngle: data.startAngle };
    });
    setEntities(updated); addToHistory(updated);
    showToast(`✅ ${selectedArcs.length} arc(s) inversé(s) !`, 'success');
  };

  const breakAtIntersection = () => {
    let workingEntities = [];
    entities.forEach(data => {
      const entity = recreateEntity(data);
      if (!entity) return;
      if (entity.type === 'path' || entity.type === 'rectangle') {
        entity.toLines().forEach(line => {
          line.color = entity.color;
          workingEntities.push(JSON.parse(JSON.stringify(line)));
        });
      } else {
        workingEntities.push(data);
      }
    });

    let finalEntities = [];
    workingEntities.forEach((data, index) => {
      const entity = recreateEntity(data);
      if (!entity) return;
      const intersectionPoints = [];
      workingEntities.forEach((otherData, otherIndex) => {
        if (index === otherIndex) return;
        const otherEntity = recreateEntity(otherData);
        if (!otherEntity) return;
        entity.getIntersections(otherEntity).forEach(point => {
          if (!intersectionPoints.some(p => distance(p, point) < 0.01)) intersectionPoints.push(point);
        });
      });

      if (intersectionPoints.length === 0) { finalEntities.push(data); return; }

      if (entity.type === 'line') {
        const points = [entity.start, ...intersectionPoints, entity.end];
        points.sort((a, b) => distance(entity.start, a) - distance(entity.start, b));
        for (let i = 0; i < points.length - 1; i++) {
          if (distance(points[i], points[i + 1]) > 0.01) {
            const nl = new LineEntity(points[i], points[i + 1]);
            nl.color = entity.color;
            finalEntities.push(JSON.parse(JSON.stringify(nl)));
          }
        }
      } else if (entity.type === 'circle') {
        const angles = intersectionPoints.map(p => Math.atan2(p.y - entity.center.y, p.x - entity.center.x)).sort((a, b) => a - b);
        if (angles.length === 0) { finalEntities.push(data); }
        else {
          for (let i = 0; i < angles.length; i++) {
            const na = new ArcEntity(entity.center, entity.radius, angles[i], angles[(i + 1) % angles.length]);
            na.color = entity.color;
            finalEntities.push(JSON.parse(JSON.stringify(na)));
          }
        }
      } else if (entity.type === 'arc') {
        const pointsOnArc = intersectionPoints.filter(point => {
          const angle = Math.atan2(point.y - entity.center.y, point.x - entity.center.x);
          let na = angle < 0 ? angle + 2 * Math.PI : angle;
          let sa = entity.startAngle < 0 ? entity.startAngle + 2 * Math.PI : entity.startAngle;
          let ea = entity.endAngle < 0 ? entity.endAngle + 2 * Math.PI : entity.endAngle;
          return sa > ea ? (na >= sa || na <= ea) : (na >= sa && na <= ea);
        });
        if (pointsOnArc.length === 0) { finalEntities.push(data); }
        else {
          const angles = pointsOnArc.map(p => Math.atan2(p.y - entity.center.y, p.x - entity.center.x)).sort((a, b) => a - b);
          const allAngles = [entity.startAngle, ...angles, entity.endAngle];
          for (let i = 0; i < allAngles.length - 1; i++) {
            if (Math.abs(allAngles[i + 1] - allAngles[i]) > 0.01) {
              const na = new ArcEntity(entity.center, entity.radius, allAngles[i], allAngles[i + 1]);
              na.color = entity.color;
              finalEntities.push(JSON.parse(JSON.stringify(na)));
            }
          }
        }
      } else { finalEntities.push(data); }
    });

    const circlesWithIntersections = workingEntities.filter((data, index) => {
      if (data.type !== 'circle') return false;
      const entity = recreateEntity(data);
      let has = false;
      workingEntities.forEach((otherData, otherIndex) => {
        if (index === otherIndex) return;
        const otherEntity = recreateEntity(otherData);
        if (!otherEntity) return;
        if (entity.getIntersections(otherEntity).length > 0) has = true;
      });
      return has;
    }).length;

    setEntities(finalEntities);
    addToHistory(finalEntities);
    const totalBefore = workingEntities.length, totalAfter = finalEntities.length;
    if (circlesWithIntersections > 0) {
      showToast(`✅ ${circlesWithIntersections} cercle(s) converti(s) en arcs ! Total: ${totalBefore} → ${totalAfter}`, 'success');
    } else {
      showToast(`✅ Entités brisées: ${totalBefore} → ${totalAfter}`, 'success');
    }
  };

  // ════════════════════════════════════════════════════
  // TRANSFORM OPERATIONS
  // ════════════════════════════════════════════════════

  const mirrorHorizontal = () => {
    const selected = entities.filter(e => e.selected);
    if (selected.length === 0) { showToast('⚠️ Sélectionnez des entités', 'warning'); return; }
    const bbox = getSelectionBBox(entities);
    if (!bbox) return;
    const centerY = bbox.minY + bbox.h / 2;
    const mirrored = selected.map(data => {
      const copy = JSON.parse(JSON.stringify(data));
      copy.id = Math.random().toString(36).substr(2, 9);
      copy.selected = false;
      if (copy.type === 'line') { copy.start.y = 2*centerY - copy.start.y; copy.end.y = 2*centerY - copy.end.y; }
      else if (copy.type === 'rectangle') { copy.topLeft.y = 2*centerY - (copy.topLeft.y + copy.height); }
      else if (copy.type === 'circle') { copy.center.y = 2*centerY - copy.center.y; }
      else if (copy.type === 'arc') { copy.center.y = 2*centerY - copy.center.y; const t = -copy.endAngle; copy.endAngle = -copy.startAngle; copy.startAngle = t; }
      else if (copy.type === 'path') { copy.points = copy.points.map(p => ({ x: p.x, y: 2*centerY - p.y })); }
      else if (copy.type === 'text') { copy.position.y = 2*centerY - copy.position.y; }
      else if (copy.type === 'freeform') { copy.controlPoints = copy.controlPoints.map(p => ({ x: p.x, y: 2*centerY - p.y })); }
      return copy;
    });
    const newEntities = [...entities, ...mirrored];
    setEntities(newEntities); addToHistory(newEntities);
    showToast(`✅ ${mirrored.length} miroir ↕`, 'success');
  };

  const mirrorVertical = () => {
    const selected = entities.filter(e => e.selected);
    if (selected.length === 0) { showToast('⚠️ Sélectionnez des entités', 'warning'); return; }
    const bbox = getSelectionBBox(entities);
    if (!bbox) return;
    const centerX = bbox.minX + bbox.w / 2;
    const mirrored = selected.map(data => {
      const copy = JSON.parse(JSON.stringify(data));
      copy.id = Math.random().toString(36).substr(2, 9);
      copy.selected = false;
      if (copy.type === 'line') { copy.start.x = 2*centerX - copy.start.x; copy.end.x = 2*centerX - copy.end.x; }
      else if (copy.type === 'rectangle') { copy.topLeft.x = 2*centerX - (copy.topLeft.x + copy.width); }
      else if (copy.type === 'circle') { copy.center.x = 2*centerX - copy.center.x; }
      else if (copy.type === 'arc') { copy.center.x = 2*centerX - copy.center.x; copy.startAngle = Math.PI - copy.startAngle; copy.endAngle = Math.PI - copy.endAngle; [copy.startAngle, copy.endAngle] = [copy.endAngle, copy.startAngle]; }
      else if (copy.type === 'path') { copy.points = copy.points.map(p => ({ x: 2*centerX - p.x, y: p.y })); }
      else if (copy.type === 'text') { copy.position.x = 2*centerX - copy.position.x; }
      else if (copy.type === 'freeform') { copy.controlPoints = copy.controlPoints.map(p => ({ x: 2*centerX - p.x, y: p.y })); }
      return copy;
    });
    const newEntities = [...entities, ...mirrored];
    setEntities(newEntities); addToHistory(newEntities);
    showToast(`✅ ${mirrored.length} miroir ↔`, 'success');
  };

  const arrayRectangular = () => {
    const selected = entities.filter(e => e.selected);
    if (selected.length === 0) { showToast('⚠️ Sélectionnez des entités', 'warning'); return; }
    openDialog('Répétition rectangulaire', { rows: 3, cols: 3, spacingX: 50, spacingY: 50 }, (values) => {
      const copies = [];
      for (let row = 0; row < values.rows; row++) {
        for (let col = 0; col < values.cols; col++) {
          if (row === 0 && col === 0) continue;
          const ox = col * values.spacingX, oy = row * values.spacingY;
          selected.forEach(data => {
            const copy = JSON.parse(JSON.stringify(data));
            copy.id = Math.random().toString(36).substr(2, 9); copy.selected = false;
            if (copy.type === 'line') { copy.start.x += ox; copy.start.y += oy; copy.end.x += ox; copy.end.y += oy; }
            else if (copy.type === 'rectangle') { copy.topLeft.x += ox; copy.topLeft.y += oy; }
            else if (copy.type === 'circle' || copy.type === 'arc') { copy.center.x += ox; copy.center.y += oy; }
            else if (copy.type === 'path') { copy.points = copy.points.map(p => ({ x: p.x + ox, y: p.y + oy })); }
            else if (copy.type === 'text') { copy.position.x += ox; copy.position.y += oy; }
            else if (copy.type === 'freeform') { copy.controlPoints = copy.controlPoints.map(p => ({ x: p.x + ox, y: p.y + oy })); }
            copies.push(copy);
          });
        }
      }
      const newEntities = [...entities, ...copies];
      setEntities(newEntities); addToHistory(newEntities); setDialogOpen(false);
      showToast(`✅ ${copies.length} copies (${values.rows}×${values.cols})`, 'success');
    });
  };

  const arrayCircular = () => {
    const selected = entities.filter(e => e.selected);
    if (selected.length === 0) { showToast('⚠️ Sélectionnez des entités', 'warning'); return; }
    openDialog('Répétition circulaire', { count: 12, radius: 100, startAngle: 0 }, (values) => {
      const bbox = getSelectionBBox(entities);
      if (!bbox) return;
      const cx = bbox.minX + bbox.w / 2, cy = bbox.minY + bbox.h / 2;
      const copies = [];
      for (let i = 1; i < values.count; i++) {
        const angle = (values.startAngle + i * 360 / values.count) * Math.PI / 180;
        const cos = Math.cos(angle), sin = Math.sin(angle);
        selected.forEach(data => {
          const copy = JSON.parse(JSON.stringify(data));
          copy.id = Math.random().toString(36).substr(2, 9); copy.selected = false;
          const rotate = (x, y) => {
            const dx = x - cx, dy = y - cy;
            return { x: cx + dx*cos - dy*sin + values.radius*cos, y: cy + dx*sin + dy*cos + values.radius*sin };
          };
          if (copy.type === 'line') { const s = rotate(copy.start.x, copy.start.y); const e = rotate(copy.end.x, copy.end.y); copy.start = s; copy.end = e; }
          else if (copy.type === 'rectangle') { const tl = rotate(copy.topLeft.x, copy.topLeft.y); copy.topLeft = tl; }
          else if (copy.type === 'circle') { copy.center = rotate(copy.center.x, copy.center.y); }
          else if (copy.type === 'arc') { copy.center = rotate(copy.center.x, copy.center.y); copy.startAngle += angle; copy.endAngle += angle; }
          else if (copy.type === 'path') { copy.points = copy.points.map(p => rotate(p.x, p.y)); }
          else if (copy.type === 'text') { copy.position = rotate(copy.position.x, copy.position.y); }
          else if (copy.type === 'freeform') { copy.controlPoints = copy.controlPoints.map(p => rotate(p.x, p.y)); }
          copies.push(copy);
        });
      }
      const newEntities = [...entities, ...copies];
      setEntities(newEntities); addToHistory(newEntities); setDialogOpen(false);
      showToast(`✅ ${copies.length} copies circulaires`, 'success');
    });
  };

  // ════════════════════════════════════════════════════
  // CAM OPERATIONS (Tabs, Lead-in/out, Sort)
  // ════════════════════════════════════════════════════

  const addTabs = () => {
    const selected = entities.filter(e => e.selected && (e.type === 'circle' || e.type === 'rectangle' || (e.type === 'path' && e.closed)));
    if (selected.length === 0) { showToast('⚠️ Sélectionnez un contour fermé', 'warning'); return; }
    openDialog('Couper avec ponts', { count: 2, width: 5 }, (values) => {
      const newEntities = [];
      selected.forEach(data => {
        const entity = recreateEntity(data);
        let points = [];
        if (entity.type === 'circle') {
          const steps = 100;
          for (let i = 0; i < steps; i++) {
            const angle = (i / steps) * 2 * Math.PI;
            points.push({ x: entity.center.x + entity.radius * Math.cos(angle), y: entity.center.y + entity.radius * Math.sin(angle) });
          }
        } else if (entity.type === 'rectangle') {
          const tl = entity.topLeft;
          points = [{ x: tl.x, y: tl.y }, { x: tl.x + entity.width, y: tl.y }, { x: tl.x + entity.width, y: tl.y + entity.height }, { x: tl.x, y: tl.y + entity.height }];
        } else if (entity.type === 'path') { points = [...entity.points]; }

        let totalLen = 0;
        const lengths = [0];
        for (let i = 1; i < points.length; i++) { totalLen += distance(points[i-1], points[i]); lengths.push(totalLen); }
        if (entity.type === 'circle' || entity.closed) { totalLen += distance(points[points.length-1], points[0]); }

        const cutPoints = [];
        for (let i = 0; i < values.count; i++) {
          const cutPos = (i / values.count) * totalLen;
          cutPoints.push({ pos: cutPos, type: 'start' });
          cutPoints.push({ pos: cutPos + values.width, type: 'end' });
        }
        cutPoints.sort((a, b) => a.pos - b.pos);

        const cutCoords = cutPoints.map(cp => {
          for (let i = 1; i < lengths.length; i++) {
            if (cp.pos <= lengths[i]) {
              const segLen = lengths[i] - lengths[i-1];
              const t = (cp.pos - lengths[i-1]) / segLen;
              return { x: points[i-1].x + (points[i].x - points[i-1].x) * t, y: points[i-1].y + (points[i].y - points[i-1].y) * t, type: cp.type };
            }
          }
          return points[points.length - 1];
        });

        for (let i = 0; i < values.count; i++) {
          const startIdx = i * 2 + 1;
          const endIdx = ((i + 1) * 2) % cutCoords.length;
          const segPoints = [];
          segPoints.push(cutCoords[startIdx]);
          const startPos = cutPoints[startIdx].pos;
          const endPos = cutPoints[endIdx].pos;
          for (let j = 0; j < lengths.length; j++) {
            if (startPos < endPos) { if (lengths[j] > startPos && lengths[j] < endPos) segPoints.push(points[j]); }
            else { if (lengths[j] > startPos || lengths[j] < endPos) segPoints.push(points[j]); }
          }
          segPoints.push(cutCoords[endIdx]);
          segPoints.push(cutCoords[startIdx]);
          const cp = new PathEntity(segPoints, true);
          cp.color = data.color;
          newEntities.push(JSON.parse(JSON.stringify(cp)));
        }
      });
      const notSelected = entities.filter(e => !e.selected);
      const finalEntities = [...notSelected, ...newEntities];
      setEntities(finalEntities); addToHistory(finalEntities); setDialogOpen(false);
      showToast(`✅ ${newEntities.length} entités créées`, 'success');
    });
  };

  const addTab = () => {
    const selected = entities.filter(e => e.selected);
    if (selected.length !== 1) { showToast('⚠️ Sélectionnez UNE seule entité', 'warning'); return; }
    showToast('👉 Cliquez où vous voulez placer le pont', 'info');
    setTabMode(true);
  };

  const parallelOffset = () => {
    const selected = entities.find(e => e.selected);
    if (!selected) { showToast('⚠️ Sélectionnez une ligne ou un contour'); return; }
    const entity = recreateEntity(selected);
    if (entity.type !== 'line' && entity.type !== 'path') {
      showToast('⚠️ Fonctionne sur lignes et contours. Utilisez 💥 pour éclater d\'abord.'); return;
    }
    openDialog('Parallèle à distance', { distance: 10 }, (values, option) => {
      const offset = values.distance;
      let offsetX = 0, offsetY = 0;
      if (option === 'Droite') offsetX = offset;
      else if (option === 'Gauche') offsetX = -offset;
      else if (option === 'Haut') offsetY = -offset;
      else if (option === 'Bas') offsetY = offset;
      const newLines = [];
      if (entity.type === 'line') {
        const nl = new LineEntity({ x: entity.start.x + offsetX, y: entity.start.y + offsetY }, { x: entity.end.x + offsetX, y: entity.end.y + offsetY });
        nl.color = entity.color; newLines.push(nl);
      } else if (entity.type === 'path') {
        entity.toLines().forEach(line => {
          const nl = new LineEntity({ x: line.start.x + offsetX, y: line.start.y + offsetY }, { x: line.end.x + offsetX, y: line.end.y + offsetY });
          nl.color = entity.color; newLines.push(nl);
        });
      }
      const updated = [...entities, ...newLines.map(l => JSON.parse(JSON.stringify(l)))];
      setEntities(updated); addToHistory(updated); setDialogOpen(false);
    }, ['Gauche', 'Droite', 'Haut', 'Bas']);
  };

  const circlesAtIntersections = () => {
    openDialog('Cercles aux intersections', { diameter: 5 }, (values) => {
      const diameter = values.diameter;
      const allIntersections = [];
      for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          const e1 = recreateEntity(entities[i]);
          const e2 = recreateEntity(entities[j]);
          if (e1 && e2) {
            e1.getIntersections(e2).forEach(point => {
              const isEndpoint = (entity, pt) => {
                if (entity.type === 'line') return distance(entity.start, pt) < 0.1 || distance(entity.end, pt) < 0.1;
                if (entity.type === 'path') return entity.points.some(p => distance(p, pt) < 0.1);
                return false;
              };
              if (!isEndpoint(e1, point) && !isEndpoint(e2, point) && !allIntersections.some(p => distance(p, point) < 0.1)) {
                allIntersections.push(point);
              }
            });
          }
        }
      }
      const newCircles = allIntersections.map(p => JSON.parse(JSON.stringify(new CircleEntity(p, diameter / 2))));
      const updated = [...entities, ...newCircles];
      setEntities(updated); addToHistory(updated); setDialogOpen(false);
      showToast(`✅ ${newCircles.length} cercle(s) créé(s)`, 'success');
    });
  };

  const sortEntitiesInsideOut = () => {
    const entitiesWithSize = entities.map(data => {
      const entity = recreateEntity(data);
      if (!entity) return { data, area: 0 };
      let area = 0;
      if (entity.type === 'circle') area = Math.PI * entity.radius * entity.radius;
      else if (entity.type === 'rectangle') area = entity.width * entity.height;
      else if (entity.type === 'path' && entity.closed && entity.points.length >= 3) {
        let sum = 0;
        for (let i = 0; i < entity.points.length; i++) {
          const j = (i + 1) % entity.points.length;
          sum += entity.points[i].x * entity.points[j].y - entity.points[j].x * entity.points[i].y;
        }
        area = Math.abs(sum / 2);
      } else {
        const bbox = getSelectionBBox([data]);
        if (bbox) area = bbox.w * bbox.h;
      }
      return { data, area };
    });
    entitiesWithSize.sort((a, b) => a.area - b.area);
    const sorted = entitiesWithSize.map(item => item.data);
    setEntities(sorted); addToHistory(sorted);
    showToast('✅ Tri : intérieur → extérieur', 'success');
  };

  // Point de départ / fin approximatifs d'une entité (pour estimer les déplacements à vide)
  const getEntityStart = (entity) => {
    if (entity.type === 'line') return entity.start;
    if (entity.type === 'circle') return { x: entity.center.x + entity.radius, y: entity.center.y };
    if (entity.type === 'arc') return { x: entity.center.x + entity.radius * Math.cos(entity.startAngle), y: entity.center.y + entity.radius * Math.sin(entity.startAngle) };
    if (entity.type === 'path' && entity.points.length > 0) return entity.points[0];
    if (entity.type === 'rectangle') return entity.topLeft;
    return { x: 0, y: 0 };
  };
  const getEntityEnd = (entity) => {
    if (entity.type === 'line') return entity.end;
    if (entity.type === 'circle') return { x: entity.center.x + entity.radius, y: entity.center.y };
    if (entity.type === 'arc') return { x: entity.center.x + entity.radius * Math.cos(entity.endAngle), y: entity.center.y + entity.radius * Math.sin(entity.endAngle) };
    if (entity.type === 'path' && entity.points.length > 0) return entity.closed ? entity.points[0] : entity.points[entity.points.length - 1];
    if (entity.type === 'rectangle') return entity.topLeft;
    return { x: 0, y: 0 };
  };

  // Tri glouton (plus proche voisin) minimisant les déplacements à vide entre découpes,
  // tout en gardant les trous coupés avant leur contour extérieur (sécurité de découpe).
  const optimizeCuttingOrder = () => {
    if (entities.length < 2) { showToast('⚠️ Rien à optimiser', 'warning'); return; }

    // Distance totale de déplacement pour un ordre donné (pour mesurer le gain)
    const totalTravel = (list) => {
      let total = 0, pos = { x: 0, y: 0 };
      list.forEach(data => {
        const entity = recreateEntity(data);
        if (!entity) return;
        total += distance(pos, getEntityStart(entity));
        pos = getEntityEnd(entity);
      });
      return total;
    };
    const originalDistance = totalTravel(entities);

    const holes = entities.filter(data => isEntityInsideAnother(data, entities));
    const outers = entities.filter(data => !isEntityInsideAnother(data, entities));

    const nearestNeighborOrder = (list, startPos) => {
      const remaining = [...list];
      const ordered = [];
      let pos = startPos;
      while (remaining.length > 0) {
        let bestIdx = 0, bestDist = Infinity;
        remaining.forEach((data, idx) => {
          const entity = recreateEntity(data);
          if (!entity) return;
          const d = distance(pos, getEntityStart(entity));
          if (d < bestDist) { bestDist = d; bestIdx = idx; }
        });
        const [chosen] = remaining.splice(bestIdx, 1);
        ordered.push(chosen);
        const chosenEntity = recreateEntity(chosen);
        if (chosenEntity) pos = getEntityEnd(chosenEntity);
      }
      return { ordered, endPos: pos };
    };

    const holesResult = nearestNeighborOrder(holes, { x: 0, y: 0 });
    const outersResult = nearestNeighborOrder(outers, holesResult.endPos);
    const optimized = [...holesResult.ordered, ...outersResult.ordered];

    const newDistance = totalTravel(optimized);
    setEntities(optimized);
    addToHistory(optimized);
    if (typeof setShowCuttingPath === 'function') setShowCuttingPath(true);

    if (originalDistance > 0.01) {
      const reduction = Math.max(0, Math.round((1 - newDistance / originalDistance) * 100));
      showToast(`✅ Ordre optimisé : trajets à vide réduits de ${reduction}% (${Math.round(originalDistance)} → ${Math.round(newDistance)} mm)`, 'success');
    } else {
      showToast('✅ Ordre de découpe optimisé', 'success');
    }
  };

  // ════════════════════════════════════════════════════
  // LEAD-IN / LEAD-OUT
  // ════════════════════════════════════════════════════

  const isEntityInsideAnother = (entityData, allEntities) => {
    const entity = recreateEntity(entityData);
    if (!entity) return false;
    const getEntitySize = (ent) => {
      if (ent.type === 'rectangle') return ent.width * ent.height;
      if (ent.type === 'circle') return Math.PI * ent.radius * ent.radius;
      if (ent.type === 'path' && ent.points.length >= 3) {
        let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
        for (const p of ent.points) { minX=Math.min(minX,p.x); maxX=Math.max(maxX,p.x); minY=Math.min(minY,p.y); maxY=Math.max(maxY,p.y); }
        return (maxX-minX)*(maxY-minY);
      }
      return 0;
    };
    const mySize = getEntitySize(entity);
    let testPoint = null;
    if (entity.type === 'line') testPoint = { x: (entity.start.x+entity.end.x)/2, y: (entity.start.y+entity.end.y)/2 };
    else if (entity.type === 'path' && entity.points.length > 0) testPoint = entity.points[Math.floor(entity.points.length/2)];
    else if (entity.type === 'rectangle') testPoint = { x: entity.topLeft.x+entity.width/2, y: entity.topLeft.y+entity.height/2 };
    else if (entity.type === 'circle') testPoint = entity.center;
    else if (entity.type === 'arc') { const ma = (entity.startAngle+entity.endAngle)/2; testPoint = { x: entity.center.x+entity.radius*Math.cos(ma), y: entity.center.y+entity.radius*Math.sin(ma) }; }
    if (!testPoint) return false;
    for (const otherData of allEntities) {
      if (otherData.id === entityData.id) continue;
      const other = recreateEntity(otherData);
      if (!other) continue;
      const otherSize = getEntitySize(other);
      if (otherSize <= mySize * 1.2) continue;
      if (other.type === 'path' && other.points.length >= 3) {
        let inside = false;
        const pts = other.points;
        for (let i=0,j=pts.length-1; i<pts.length; j=i++) {
          if ((pts[i].y>testPoint.y)!=(pts[j].y>testPoint.y) && testPoint.x < (pts[j].x-pts[i].x)*(testPoint.y-pts[i].y)/(pts[j].y-pts[i].y)+pts[i].x) inside=!inside;
        }
        if (inside) return true;
      }
      if (other.type === 'rectangle' && testPoint.x>=other.topLeft.x && testPoint.x<=other.topLeft.x+other.width && testPoint.y>=other.topLeft.y && testPoint.y<=other.topLeft.y+other.height) return true;
      if (other.type === 'circle' && Math.sqrt((testPoint.x-other.center.x)**2+(testPoint.y-other.center.y)**2)<other.radius) return true;
    }
    return false;
  };

  const addLeadIns = () => {
    const selected = entities.filter(e => e.selected);
    if (selected.length === 0) { showToast('⚠️ Sélectionnez des entités', 'warning'); return; }
    openDialog('Ajouter entrées (Lead-In)', { distance: 5 }, (values) => {
      const d = values.distance || 5;
      const updated = entities.map(data => {
        if (!data.selected) return data;
        const entity = recreateEntity(data);
        if (!entity) return data;
        const isHole = isEntityInsideAnother(data, entities);
        let direction;
        direction = isHole ? 1 : -1;
        let leadInPoint = null;
        if (entity.type === 'line') {
          const dx = entity.end.x-entity.start.x, dy = entity.end.y-entity.start.y;
          const len = Math.sqrt(dx*dx+dy*dy);
          if (len > 0.1) { leadInPoint = { x: entity.start.x + (-dy/len)*direction*d, y: entity.start.y + (dx/len)*direction*d }; }
          else { leadInPoint = { x: entity.start.x - d*direction, y: entity.start.y }; }
        } else if (entity.type === 'path') {
          const p0 = entity.points[0];
          const p1 = entity.points[1] || entity.points[0];
          const dx = p1.x - p0.x, dy = p1.y - p0.y;
          const len = Math.hypot(dx, dy);
          if (len > 0.1) { leadInPoint = { x: p0.x + (-dy/len)*direction*d, y: p0.y + (dx/len)*direction*d }; }
          else { leadInPoint = { x: p0.x - d*direction, y: p0.y }; }
        } else if (entity.type === 'circle') {
          const r = isHole ? (entity.radius-d) : (entity.radius+d);
          leadInPoint = { x: entity.center.x + r, y: entity.center.y };
        } else if (entity.type === 'rectangle') {
          const off = isHole ? d : -d;
          leadInPoint = { x: entity.topLeft.x + off*0.7, y: entity.topLeft.y + off*0.7 };
        } else if (entity.type === 'arc') {
          const sx = entity.center.x+entity.radius*Math.cos(entity.startAngle);
          const sy = entity.center.y+entity.radius*Math.sin(entity.startAngle);
          const rd = isHole ? -1 : 1;
          leadInPoint = { x: sx + d*Math.cos(entity.startAngle)*rd, y: sy + d*Math.sin(entity.startAngle)*rd };
        }
        if (leadInPoint) return { ...data, leadIn: leadInPoint };
        return data;
      });
      setEntities(updated); addToHistory(updated); setDialogOpen(false);
      showToast(`✅ Entrées ajoutées (${d}mm)`, 'success');
    });
  };

  const removeLeadIns = () => {
    const selected = entities.filter(e => e.selected);
    if (selected.length === 0) { showToast('⚠️ Sélectionnez des entités', 'warning'); return; }
    const updated = entities.map(data => {
      if (data.selected && data.leadIn) { const { leadIn, ...rest } = data; return rest; }
      return data;
    });
    setEntities(updated); addToHistory(updated);
    showToast('✅ Entrées supprimées', 'success');
  };

  const addLeadOuts = () => {
    const selected = entities.filter(e => e.selected);
    if (selected.length === 0) { showToast('⚠️ Sélectionnez des entités', 'warning'); return; }
    let added = 0;
    const updated = entities.map(data => {
      if (!data.selected) return data;
      if (data.leadIn) {
        const entity = recreateEntity(data);
        if (!entity) return data;
        let startPoint = null;
        if (entity.type === 'line') startPoint = entity.start;
        else if (entity.type === 'path' && entity.points.length > 0) startPoint = entity.points[0];
        else if (entity.type === 'circle') startPoint = { x: entity.center.x+entity.radius, y: entity.center.y };
        else if (entity.type === 'rectangle') startPoint = entity.topLeft;
        else if (entity.type === 'arc') startPoint = { x: entity.center.x+entity.radius*Math.cos(entity.startAngle), y: entity.center.y+entity.radius*Math.sin(entity.startAngle) };
        if (startPoint) {
          const dx = data.leadIn.x - startPoint.x, dy = data.leadIn.y - startPoint.y;
          const len = Math.sqrt(dx*dx+dy*dy);
          if (len > 0.01) { added++; return { ...data, leadOut: { x: startPoint.x+(dx/len)*1.0, y: startPoint.y+(dy/len)*1.0 } }; }
          else { added++; return { ...data, leadOut: { x: data.leadIn.x, y: data.leadIn.y } }; }
        }
      }
      return data;
    });
    if (added === 0) { showToast('⚠️ Ajoutez d\'abord des entrées (↘️ IN)', 'warning'); }
    else { setEntities(updated); addToHistory(updated); showToast(`✅ ${added} sortie(s) ajoutée(s)`, 'success'); }
  };

  const removeLeadOuts = () => {
    const selected = entities.filter(e => e.selected);
    if (selected.length === 0) { showToast('⚠️ Sélectionnez des entités', 'warning'); return; }
    const updated = entities.map(data => {
      if (data.selected && data.leadOut) { const { leadOut, ...rest } = data; return rest; }
      return data;
    });
    setEntities(updated); addToHistory(updated);
    showToast('✅ Sorties supprimées', 'success');
  };

  // ════════════════════════════════════════════════════
  // FUSION & CONTOUR OPERATIONS
  // ════════════════════════════════════════════════════

  const extractOuterContour = () => {
    const selected = entities.filter(e => e.selected);
    if (selected.length === 0) { showToast('⚠️ Sélectionnez des entités', 'warning'); return; }
    const allPoints = [];
    selected.forEach(data => {
      const entity = recreateEntity(data);
      if (entity.type === 'path') allPoints.push(...entity.points);
      else if (entity.type === 'line') allPoints.push(entity.start, entity.end);
      else if (entity.type === 'arc') {
        const steps = Math.max(8, Math.round(Math.abs(entity.endAngle-entity.startAngle)*entity.radius/5));
        for (let i=0; i<=steps; i++) {
          const t=i/steps, a=entity.startAngle+(entity.endAngle-entity.startAngle)*t;
          allPoints.push({ x: entity.center.x+entity.radius*Math.cos(a), y: entity.center.y+entity.radius*Math.sin(a) });
        }
      } else if (entity.type === 'rectangle') {
        const tl=entity.topLeft;
        allPoints.push({x:tl.x,y:tl.y},{x:tl.x+entity.width,y:tl.y},{x:tl.x+entity.width,y:tl.y+entity.height},{x:tl.x,y:tl.y+entity.height});
      } else if (entity.type === 'circle') {
        const steps=72;
        for (let i=0;i<steps;i++) { const a=(i/steps)*2*Math.PI; allPoints.push({x:entity.center.x+entity.radius*Math.cos(a),y:entity.center.y+entity.radius*Math.sin(a)}); }
      }
    });
    if (allPoints.length < 3) { showToast('⚠️ Pas assez de points', 'warning'); return; }
    let startPoint = allPoints[0];
    for (const p of allPoints) { if (p.y < startPoint.y || (p.y === startPoint.y && p.x < startPoint.x)) startPoint = p; }
    const pwa = allPoints.map(p => ({ point: p, angle: Math.atan2(p.y-startPoint.y, p.x-startPoint.x), dist: Math.sqrt((p.x-startPoint.x)**2+(p.y-startPoint.y)**2) }));
    pwa.sort((a, b) => Math.abs(a.angle-b.angle) < 0.001 ? a.dist-b.dist : a.angle-b.angle);
    const hull = [pwa[0].point];
    const ccw = (p1,p2,p3) => (p2.x-p1.x)*(p3.y-p1.y)-(p2.y-p1.y)*(p3.x-p1.x);
    for (let i=1; i<pwa.length; i++) {
      const pt = pwa[i].point;
      while (hull.length > 1 && ccw(hull[hull.length-2], hull[hull.length-1], pt) <= 0) hull.pop();
      hull.push(pt);
    }
    if (hull.length < 3) { showToast('⚠️ Impossible de créer un contour', 'warning'); return; }
    const path = new PathEntity(hull, true);
    path.color = selected[0].color;
    const notSelected = entities.filter(e => !e.selected);
    const newEntities = [...notSelected, JSON.parse(JSON.stringify(path))];
    setEntities(newEntities); addToHistory(newEntities);
    showToast('✅ Contour externe créé (' + hull.length + ' points)', 'success');
  };

  const startManualFusion = () => {
    setManualFusionMode(true);
    setManualFusionPoints([]);
    setManualFusionEntities([]);
    showToast('🖱️ Cliquez sur les segments dans l\'ordre. ESC pour annuler, Entrée pour terminer.', 'info');
  };

  const finishManualFusion = () => {
    if (manualFusionEntities.length < 2) { showToast('⚠️ Sélectionnez au moins 2 segments', 'warning'); setManualFusionMode(false); return; }
    const allPoints = [];
    manualFusionEntities.forEach((entityData, idx) => {
      const e = recreateEntity(entityData);
      let segPoints = [];
      if (e.type === 'line') segPoints = [e.start, e.end];
      else if (e.type === 'arc') {
        let sa=e.startAngle, ea=e.endAngle;
        if (ea-sa < 0) ea += 2*Math.PI;
        const steps = Math.max(8, Math.round(Math.abs(ea-sa)*e.radius/5));
        for (let i=0; i<=steps; i++) { const t=i/steps, a=sa+(ea-sa)*t; segPoints.push({x:e.center.x+e.radius*Math.cos(a),y:e.center.y+e.radius*Math.sin(a)}); }
      } else if (e.type === 'circle') {
        const steps=72;
        for (let i=0;i<steps;i++) { const a=(i/steps)*2*Math.PI; segPoints.push({x:e.center.x+e.radius*Math.cos(a),y:e.center.y+e.radius*Math.sin(a)}); }
      } else if (e.type === 'path') segPoints = [...e.points];
      if (segPoints.length === 0) return;
      if (idx === 0) { allPoints.push(...segPoints); }
      else {
        const lastPoint = allPoints[allPoints.length-1];
        const segStart = segPoints[0], segEnd = segPoints[segPoints.length-1];
        const distToStart = distance(lastPoint, segStart), distToEnd = distance(lastPoint, segEnd);
        if (distToEnd < distToStart) segPoints.reverse();
        const gap = Math.min(distToStart, distToEnd);
        if (gap > 0.1 && gap < 1.0) segPoints[0] = { ...lastPoint };
        if (distance(lastPoint, segPoints[0]) < 0.1) allPoints.push(...segPoints.slice(1));
        else allPoints.push(...segPoints);
      }
    });
    if (allPoints.length < 2) { showToast('⚠️ Pas assez de points', 'warning'); setManualFusionMode(false); return; }
    const cleaned = [];
    allPoints.forEach((pt, i) => {
      if (i === 0) cleaned.push(pt);
      else { const prev = cleaned[cleaned.length-1]; if (distance(prev, pt) >= 0.1) cleaned.push(pt); }
    });
    if (cleaned.length < 2) { showToast('⚠️ Pas assez de points après nettoyage', 'warning'); setManualFusionMode(false); return; }
    const isClosed = cleaned.length > 2 && distance(cleaned[0], cleaned[cleaned.length-1]) < 1.0;
    let finalPoints = cleaned;
    if (isClosed) finalPoints = cleaned.slice(0, -1);
    const path = new PathEntity(finalPoints, isClosed);
    path.color = manualFusionEntities[0].color;
    const remaining = entities.filter(e => !manualFusionEntities.some(me => me.id === e.id));
    const newEntities = [...remaining, JSON.parse(JSON.stringify(path))];
    setEntities(newEntities); addToHistory(newEntities);
    setManualFusionMode(false); setManualFusionPoints([]); setManualFusionEntities([]);
    showToast('✅ Fusion manuelle terminée (' + finalPoints.length + ' points)', 'success');
  };

  const fusionLignes = () => {
    const selected = entities.filter(e => e.selected && e.type === 'line');
    if (selected.length === 0) { showToast('⚠️ Sélectionnez des lignes à fusionner', 'warning'); return; }
    if (selected.length === 1) { showToast('⚠️ Sélectionnez au moins 2 lignes', 'warning'); return; }
    const tolerance = 1.0;
    const used = new Set();
    const chains = [];
    while (used.size < selected.length) {
      let startLine = null;
      for (const line of selected) { if (!used.has(line.id)) { startLine = line; break; } }
      if (!startLine) break;
      const chain = [startLine];
      used.add(startLine.id);
      let currentEnd = recreateEntity(startLine).end;
      const initialStart = recreateEntity(startLine).start;
      let found = true, safety = 0;
      while (found && safety < selected.length * 2) {
        safety++; found = false;
        if (chain.length > 1 && distance(currentEnd, initialStart) < tolerance) break;
        for (const line of selected) {
          if (used.has(line.id)) continue;
          const entity = recreateEntity(line);
          if (distance(currentEnd, entity.start) < tolerance) { chain.push({ ...line, flipped: false }); used.add(line.id); currentEnd = entity.end; found = true; break; }
          else if (distance(currentEnd, entity.end) < tolerance) { chain.push({ ...line, flipped: true }); used.add(line.id); currentEnd = entity.start; found = true; break; }
        }
      }
      chains.push(chain);
    }
    const paths = chains.map(chain => {
      const points = [];
      chain.forEach((lineData, idx) => {
        const entity = recreateEntity(lineData);
        if (idx === 0) points.push(lineData.flipped ? entity.end : entity.start);
        points.push(lineData.flipped ? entity.start : entity.end);
      });
      const isClosed = points.length > 2 && distance(points[0], points[points.length-1]) < tolerance;
      const path = new PathEntity(points, isClosed);
      path.color = chain[0].color;
      return JSON.parse(JSON.stringify(path));
    });
    const notSelected = entities.filter(e => !e.selected);
    const newEntities = [...notSelected, ...paths];
    setEntities(newEntities); addToHistory(newEntities);
    showToast('✅ ' + paths.length + ' contour(s) créé(s) depuis ' + selected.length + ' lignes', 'success');
  };

  const groupLinesIntoPaths = () => {
    const selected = entities.filter(e => e.selected);
    if (selected.length === 0) { showToast('⚠️ Sélectionnez des entités', 'warning'); return; }
    const allPoints = [];
    selected.forEach(data => {
      const entity = recreateEntity(data);
      if (entity.type === 'path') allPoints.push(...entity.points);
      else if (entity.type === 'line') allPoints.push(entity.start, entity.end);
      else if (entity.type === 'arc') {
        const steps = Math.max(8, Math.round(Math.abs(entity.endAngle-entity.startAngle)*entity.radius/5));
        for (let i=0; i<=steps; i++) { const t=i/steps, a=entity.startAngle+(entity.endAngle-entity.startAngle)*t; allPoints.push({x:entity.center.x+entity.radius*Math.cos(a),y:entity.center.y+entity.radius*Math.sin(a)}); }
      } else if (entity.type === 'circle') {
        const steps=72;
        for (let i=0;i<steps;i++) { const a=(i/steps)*2*Math.PI; allPoints.push({x:entity.center.x+entity.radius*Math.cos(a),y:entity.center.y+entity.radius*Math.sin(a)}); }
      } else if (entity.type === 'rectangle') {
        const tl=entity.topLeft;
        allPoints.push({x:tl.x,y:tl.y},{x:tl.x+entity.width,y:tl.y},{x:tl.x+entity.width,y:tl.y+entity.height},{x:tl.x,y:tl.y+entity.height});
      }
    });
    if (allPoints.length < 2) { showToast('⚠️ Pas assez de points', 'warning'); return; }
    const isClosed = distance(allPoints[0], allPoints[allPoints.length-1]) < 1.0;
    const path = new PathEntity(allPoints, isClosed);
    path.color = selected[0].color;
    const notSelected = entities.filter(e => !e.selected);
    const newEntities = [...notSelected, JSON.parse(JSON.stringify(path))];
    setEntities(newEntities); addToHistory(newEntities);
    showToast(`✅ Fusionné : ${selected.length} entités → ${allPoints.length} points`, 'success');
  };

  // ── Lissage de forme (simplification du bruit + arrondi doux, sans forcer de symétrie) ──
  const perpendicularDistance = (point, lineStart, lineEnd) => {
    const dx = lineEnd.x - lineStart.x, dy = lineEnd.y - lineStart.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.0001) return distance(point, lineStart);
    const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (len * len);
    const proj = { x: lineStart.x + t * dx, y: lineStart.y + t * dy };
    return distance(point, proj);
  };

  // Douglas-Peucker : retire les points redondants/bruités tout en gardant la silhouette
  const simplifyPoints = (points, tolerance) => {
    if (points.length < 3) return points;
    let maxDist = 0, maxIdx = 0;
    for (let i = 1; i < points.length - 1; i++) {
      const d = perpendicularDistance(points[i], points[0], points[points.length - 1]);
      if (d > maxDist) { maxDist = d; maxIdx = i; }
    }
    if (maxDist > tolerance) {
      const left = simplifyPoints(points.slice(0, maxIdx + 1), tolerance);
      const right = simplifyPoints(points.slice(maxIdx), tolerance);
      return [...left.slice(0, -1), ...right];
    }
    return [points[0], points[points.length - 1]];
  };

  // Chaikin (corner-cutting) : arrondit progressivement une polyligne sans changer sa forme globale
  const chaikinSmooth = (points, closed, iterations) => {
    let pts = points;
    for (let iter = 0; iter < iterations; iter++) {
      const result = [];
      const n = pts.length;
      const segCount = closed ? n : n - 1;
      if (!closed) result.push(pts[0]);
      for (let i = 0; i < segCount; i++) {
        const p0 = pts[i];
        const p1 = pts[(i + 1) % n];
        result.push({ x: p0.x + (p1.x - p0.x) * 0.25, y: p0.y + (p1.y - p0.y) * 0.25 });
        result.push({ x: p0.x + (p1.x - p0.x) * 0.75, y: p0.y + (p1.y - p0.y) * 0.75 });
      }
      if (!closed) result.push(pts[pts.length - 1]);
      pts = result;
    }
    return pts;
  };

  const smoothSelectedShape = () => {
    const selected = entities.filter(e => e.selected && (e.type === 'path' || e.type === 'freeform'));
    if (selected.length === 0) { showToast('⚠️ Sélectionnez un contour ou une forme libre à lisser', 'warning'); return; }
    openDialog('〰️ Lisser la forme', { tolerance: 0.5, passes: 2 }, (values) => {
      const tolerance = Math.max(0, parseFloat(values.tolerance) || 0);
      const passes = Math.max(0, Math.min(5, Math.round(values.passes) || 0));
      setDialogOpen(false);
      const updated = entities.map(data => {
        if (!data.selected) return data;
        if (data.type === 'path') {
          const closed = !!data.closed;
          let pts = tolerance > 0 ? simplifyPoints(data.points, tolerance) : data.points;
          if (passes > 0) pts = chaikinSmooth(pts, closed, passes);
          return { ...data, points: pts };
        }
        if (data.type === 'freeform') {
          let pts = tolerance > 0 ? simplifyPoints(data.controlPoints, tolerance) : data.controlPoints;
          if (passes > 0) pts = chaikinSmooth(pts, data.closed !== false, passes);
          return { ...data, controlPoints: pts };
        }
        return data;
      });
      setEntities(updated); addToHistory(updated);
      showToast(`✅ ${selected.length} forme(s) lissée(s)`, 'success');
    });
  };

  const filletCorners = () => {
    const selected = entities.filter(e => e.selected && (e.type === 'path' || e.type === 'line' || e.type === 'rectangle'));
    if (selected.length === 0) { showToast('⚠️ Sélectionnez des entités à arrondir', 'warning'); return; }
    openDialog('🔵 Arrondir les angles', { radius: 10 }, (values) => {
      const r = Math.abs(parseFloat(values.radius));
      if (!r || r <= 0) { showToast('⚠️ Rayon invalide', 'warning'); return; }
      setDialogOpen(false);
      const filletCorner = (prev, corner, next, radius) => {
        const d1x=prev.x-corner.x, d1y=prev.y-corner.y, d2x=next.x-corner.x, d2y=next.y-corner.y;
        const len1=Math.sqrt(d1x*d1x+d1y*d1y), len2=Math.sqrt(d2x*d2x+d2y*d2y);
        if (len1<0.001 || len2<0.001) return [corner];
        const u1x=d1x/len1, u1y=d1y/len1, u2x=d2x/len2, u2y=d2y/len2;
        const dot=u1x*u2x+u1y*u2y;
        if (dot>0.9999) return [corner];
        const sinHalf=Math.sqrt(Math.max(0,(1-dot)/2)), cosHalf=Math.sqrt(Math.max(0,(1+dot)/2));
        if (sinHalf<0.001) return [corner];
        const tanDist=radius*cosHalf/sinHalf;
        if (tanDist>len1*0.99 || tanDist>len2*0.99) return [corner];
        const t1={x:corner.x+u1x*tanDist,y:corner.y+u1y*tanDist}, t2={x:corner.x+u2x*tanDist,y:corner.y+u2y*tanDist};
        const bx=u1x+u2x, by=u1y+u2y, blen=Math.sqrt(bx*bx+by*by);
        if (blen<0.001) return [corner];
        const cx=corner.x+(bx/blen)*(radius/sinHalf), cy=corner.y+(by/blen)*(radius/sinHalf);
        const sa=Math.atan2(t1.y-cy,t1.x-cx), ea=Math.atan2(t2.y-cy,t2.x-cx);
        let da=ea-sa;
        while (da>Math.PI) da-=2*Math.PI;
        while (da<-Math.PI) da+=2*Math.PI;
        const arcPts=[t1];
        const steps=Math.max(6, Math.round(Math.abs(da)*radius));
        for (let i=1; i<steps; i++) { const a=sa+da*(i/steps); arcPts.push({x:cx+radius*Math.cos(a),y:cy+radius*Math.sin(a)}); }
        arcPts.push(t2);
        return arcPts;
      };
      let totalRounded = 0;
      const newEntities = entities.map(data => {
        if (!data.selected) return data;
        let points = [], closed = false;
        if (data.type === 'rectangle') {
          const e = recreateEntity(data), tl = e.topLeft;
          points = [{x:tl.x,y:tl.y},{x:tl.x+e.width,y:tl.y},{x:tl.x+e.width,y:tl.y+e.height},{x:tl.x,y:tl.y+e.height}];
          closed = true;
        } else if (data.type === 'line') return data;
        else if (data.type === 'path') { const e = recreateEntity(data); points = [...e.points]; closed = e.closed; }
        else return data;
        if (points.length < 3) return data;
        const result = [];
        const n = points.length;
        for (let i=0; i<n; i++) {
          const prev=points[(i-1+n)%n], curr=points[i], next=points[(i+1)%n];
          if (!closed && (i===0 || i===n-1)) { result.push(curr); continue; }
          const arcPts = filletCorner(prev, curr, next, r);
          result.push(...arcPts);
          if (arcPts.length > 1) totalRounded++;
        }
        const entity = new PathEntity(result, closed);
        entity.color = data.color || '#2dd4bf';
        return JSON.parse(JSON.stringify(entity));
      });
      if (totalRounded === 0) { showToast('⚠️ Rayon trop grand pour les segments', 'warning'); return; }
      setEntities(newEntities); addToHistory(newEntities);
      showToast(`✅ ${totalRounded} angles arrondis (r=${r}mm)`, 'success');
    });
  };

  const mergeToSinglePath = () => {
    const selected = entities.filter(e => e.selected);
    if (selected.length < 2) { showToast('⚠️ Sélectionnez au moins 2 entités à fusionner', 'warning'); return; }
    const TOL = 1.0;
    const segments = [];
    selected.forEach(data => {
      const e = recreateEntity(data);
      if (!e) return;
      if (e.type === 'line') segments.push({ pts: [e.start, e.end] });
      else if (e.type === 'path') { if (e.points.length >= 2) { const pts = e.closed ? [...e.points, e.points[0]] : [...e.points]; segments.push({ pts }); } }
    });
    if (segments.length === 0) { showToast('⚠️ Aucun segment trouvé', 'warning'); return; }
    const ptClose = (a, b) => Math.abs(a.x-b.x) < TOL && Math.abs(a.y-b.y) < TOL;
    const used = new Array(segments.length).fill(false);
    const chain = [...segments[0].pts];
    used[0] = true;
    let added = true;
    while (added) {
      added = false;
      const cs = chain[0], ce = chain[chain.length-1];
      for (let i=0; i<segments.length; i++) {
        if (used[i]) continue;
        const seg = segments[i], ss = seg.pts[0], se = seg.pts[seg.pts.length-1];
        if (ptClose(ce, ss)) { chain.push(...seg.pts.slice(1)); used[i]=true; added=true; }
        else if (ptClose(ce, se)) { chain.push(...[...seg.pts].reverse().slice(1)); used[i]=true; added=true; }
        else if (ptClose(cs, se)) { chain.unshift(...seg.pts.slice(0,-1)); used[i]=true; added=true; }
        else if (ptClose(cs, ss)) { chain.unshift(...[...seg.pts].reverse().slice(0,-1)); used[i]=true; added=true; }
      }
    }
    const orphans = segments.filter((_, i) => !used[i]);
    if (orphans.length > 0) { orphans.forEach(seg => chain.push(...seg.pts)); showToast(`⚠️ ${orphans.length} segment(s) non connecté(s)`, 'warning'); }
    const isClosed = ptClose(chain[0], chain[chain.length-1]);
    const finalPts = isClosed ? chain.slice(0, -1) : chain;
    const merged = new PathEntity(finalPts, isClosed);
    merged.color = selected[0].color || '#2dd4bf';
    const nonSelected = entities.filter(e => !e.selected);
    const updated = [...nonSelected, JSON.parse(JSON.stringify(merged))];
    setEntities(updated); addToHistory(updated);
    showToast(`✅ Fusionné en 1 ${isClosed ? 'contour fermé ✅' : 'contour ouvert'} — ${finalPts.length} points`, 'success');
  };

  // ════════════════════════════════════════════════════
  // JOIN & BREAK (Inkscape-style)
  // ════════════════════════════════════════════════════

  const breakEntityAtPoint = (data, point) => {
    const entity = recreateEntity(data);
    if (!entity) return [data];
    if (entity.type === 'line') {
      const dx = entity.end.x - entity.start.x, dy = entity.end.y - entity.start.y;
      const len2 = dx*dx + dy*dy;
      if (len2 < 0.0001) return [data];
      let t = ((point.x - entity.start.x)*dx + (point.y - entity.start.y)*dy) / len2;
      t = Math.max(0.02, Math.min(0.98, t));
      const px = entity.start.x + t*dx, py = entity.start.y + t*dy;
      const l1 = new LineEntity(entity.start, { x: px, y: py }); l1.color = data.color;
      const l2 = new LineEntity({ x: px, y: py }, entity.end); l2.color = data.color;
      return [JSON.parse(JSON.stringify(l1)), JSON.parse(JSON.stringify(l2))];
    }
    if (entity.type === 'path' && entity.points.length >= 2) {
      const pts = entity.points;
      let bestI = -1, bestD = Infinity, bestP = null;
      const segCount = entity.closed ? pts.length : pts.length - 1;
      for (let i = 0; i < segCount; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        const dx = b.x - a.x, dy = b.y - a.y;
        const len2 = dx*dx + dy*dy;
        let t = len2 > 0 ? ((point.x - a.x)*dx + (point.y - a.y)*dy) / len2 : 0;
        t = Math.max(0, Math.min(1, t));
        const px = a.x + t*dx, py = a.y + t*dy;
        const d = (point.x - px)**2 + (point.y - py)**2;
        if (d < bestD) { bestD = d; bestI = i; bestP = { x: px, y: py }; }
      }
      if (bestI < 0) return [data];
      const P = bestP;
      if (entity.closed) {
        const after = pts.slice(bestI + 1);
        const before = pts.slice(0, bestI + 1);
        const openPts = [P, ...after, ...before, P];
        const path = new PathEntity(openPts, false);
        path.color = data.color;
        return [JSON.parse(JSON.stringify(path))];
      }
      const first = [...pts.slice(0, bestI + 1), P];
      const second = [P, ...pts.slice(bestI + 1)];
      const p1 = new PathEntity(first, false); p1.color = data.color;
      const p2 = new PathEntity(second, false); p2.color = data.color;
      return [JSON.parse(JSON.stringify(p1)), JSON.parse(JSON.stringify(p2))];
    }
    return [data];
  };

  const joinSelectedPaths = () => {
    const selected = entities.filter(e => e.selected);
    const openPaths = [];
    selected.forEach(data => {
      const e = recreateEntity(data);
      if (!e) return;
      if (e.type === 'line') openPaths.push({ data, pts: [e.start, e.end] });
      else if (e.type === 'path' && !e.closed && e.points.length >= 2) openPaths.push({ data, pts: [...e.points] });
    });
    if (openPaths.length < 2) { showToast('⚠️ Sélectionnez 2 contours ouverts (lignes ou chemins ouverts)', 'warning'); return; }
    const [a, b] = openPaths;
    const aS = a.pts[0], aE = a.pts[a.pts.length - 1];
    const bS = b.pts[0], bE = b.pts[b.pts.length - 1];
    const pairs = [
      { revA: false, revB: false, p1: aE, p2: bS },
      { revA: false, revB: true,  p1: aE, p2: bE },
      { revA: true,  revB: false, p1: aS, p2: bS },
      { revA: true,  revB: true,  p1: aS, p2: bE },
    ];
    pairs.forEach(p => p.d = distance(p.p1, p.p2));
    pairs.sort((x, y) => x.d - y.d);
    const best = pairs[0];
    const aPts = best.revA ? [...a.pts].reverse() : [...a.pts];
    const bPts = best.revB ? [...b.pts].reverse() : [...b.pts];
    const merged = [...aPts, ...bPts];
    const path = new PathEntity(merged, false);
    path.color = a.data.color;
    const remaining = entities.filter(e => e.id !== a.data.id && e.id !== b.data.id);
    const newEntities = [...remaining, JSON.parse(JSON.stringify(path))];
    setEntities(newEntities); addToHistory(newEntities);
    showToast(`✅ 2 contours joints (segment de ${best.d.toFixed(1)} mm)`, 'success');
  };

  const startBreakAtPoint = () => {
    setBreakMode(true);
    showToast('👉 Cliquez sur le contour à briser', 'info');
  };

  const breakAtPoint = (pos) => {
    const idx = entities.findIndex(en => { const ent = recreateEntity(en); return ent && ent.contains(pos, 5 / camera.zoom); });
    if (idx < 0) { showToast('⚠️ Cliquez sur un contour', 'warning'); return; }
    const broken = breakEntityAtPoint(entities[idx], pos);
    if (broken.length === 1 && broken[0].id === entities[idx].id) { setBreakMode(false); showToast('ℹ️ Impossible de briser ici (utilisez 💥 pour éclater d\'abord)', 'info'); return; }
    const updated = [...entities.slice(0, idx), ...broken, ...entities.slice(idx + 1)];
    setEntities(updated); addToHistory(updated);
    setBreakMode(false);
    showToast(`✅ Contour brisé en ${broken.length} parties`, 'success');
  };

  // ════════════════════════════════════════════════════
  // SCISSORS (Inkscape-style: cut between two points)
  // ════════════════════════════════════════════════════

  const locateOnEntity = (data, point) => {
    const entity = recreateEntity(data);
    if (!entity) return null;
    if (entity.type === 'line') {
      const dx = entity.end.x - entity.start.x, dy = entity.end.y - entity.start.y;
      const len2 = dx*dx + dy*dy;
      if (len2 < 0.0001) return null;
      let t = ((point.x - entity.start.x)*dx + (point.y - entity.start.y)*dy) / len2;
      t = Math.max(0, Math.min(1, t));
      return { seg: 0, t, point: { x: entity.start.x + t*dx, y: entity.start.y + t*dy } };
    }
    if (entity.type === 'path' && entity.points.length >= 2) {
      const pts = entity.points;
      let bestI = -1, bestD = Infinity, bestT = 0, bestP = null;
      const segCount = entity.closed ? pts.length : pts.length - 1;
      for (let i = 0; i < segCount; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        const dx = b.x - a.x, dy = b.y - a.y;
        const len2 = dx*dx + dy*dy;
        let t = len2 > 0 ? ((point.x - a.x)*dx + (point.y - a.y)*dy) / len2 : 0;
        t = Math.max(0, Math.min(1, t));
        const px = a.x + t*dx, py = a.y + t*dy;
        const d = (point.x - px)**2 + (point.y - py)**2;
        if (d < bestD) { bestD = d; bestI = i; bestT = t; bestP = { x: px, y: py }; }
      }
      if (bestI < 0) return null;
      return { seg: bestI, t: bestT, point: bestP };
    }
    return null;
  };

  const cutBetweenPoints = (data, locA, locB) => {
    const entity = recreateEntity(data);
    if (!entity) return [data];
    if (entity.type === 'line') {
      let tA = locA.t, tB = locB.t;
      if (tA > tB) [tA, tB] = [tB, tA];
      if (tB - tA < 0.02) return [data];
      const A = { x: entity.start.x + tA*(entity.end.x-entity.start.x), y: entity.start.y + tA*(entity.end.y-entity.start.y) };
      const B = { x: entity.start.x + tB*(entity.end.x-entity.start.x), y: entity.start.y + tB*(entity.end.y-entity.start.y) };
      const pieces = [];
      if (tA > 0.02) { const l1 = new LineEntity(entity.start, A); l1.color = data.color; pieces.push(JSON.parse(JSON.stringify(l1))); }
      if (tB < 0.98) { const l2 = new LineEntity(B, entity.end); l2.color = data.color; pieces.push(JSON.parse(JSON.stringify(l2))); }
      return pieces;
    }
    if (entity.type === 'path' && entity.points.length >= 2) {
      const pts = entity.points;
      let aFirst = locA, bSecond = locB;
      if (locB.seg < locA.seg || (locB.seg === locA.seg && locB.t < locA.t)) { aFirst = locB; bSecond = locA; }
      const A = aFirst.point, B = bSecond.point;
      if (entity.closed) {
        const n = pts.length;
        const ordered = [B];
        let i = (bSecond.seg + 1) % n;
        let safety = 0;
        while (i !== aFirst.seg && safety <= n) { ordered.push(pts[i]); i = (i + 1) % n; safety++; }
        ordered.push(pts[aFirst.seg]);
        ordered.push(A);
        const path = new PathEntity(ordered, false);
        path.color = data.color;
        return [JSON.parse(JSON.stringify(path))];
      }
      const pieces = [];
      const first = [...pts.slice(0, aFirst.seg + 1), A];
      const p1 = new PathEntity(first, false); p1.color = data.color;
      pieces.push(JSON.parse(JSON.stringify(p1)));
      const second = [B, ...pts.slice(bSecond.seg + 1)];
      const p2 = new PathEntity(second, false); p2.color = data.color;
      pieces.push(JSON.parse(JSON.stringify(p2)));
      return pieces;
    }
    return [data];
  };

  const startScissors = () => {
    setScissorsMode(true);
    setScissorsFirst(null);
    showToast('✂ Cliquez le 1er point de coupe sur le contour', 'info');
  };

  const scissorsClick = (pos) => {
    const idx = entities.findIndex(en => { const ent = recreateEntity(en); return ent && ent.contains(pos, 5 / camera.zoom); });
    if (idx < 0) { showToast('⚠️ Cliquez sur un contour', 'warning'); return; }
    const loc = locateOnEntity(entities[idx], pos);
    if (!loc) { showToast('⚠️ Impossible de couper ici', 'warning'); return; }
    if (!scissorsFirst) {
      setScissorsFirst({ entityIndex: idx, loc });
      showToast('👉 Cliquez le 2e point de coupe sur le MÊME contour', 'info');
      return;
    }
    if (scissorsFirst.entityIndex !== idx) { showToast('⚠️ Cliquez sur le MÊME contour (Échap pour annuler)', 'warning'); return; }
    const pieces = cutBetweenPoints(entities[idx], scissorsFirst.loc, loc);
    if (pieces.length === 1 && pieces[0].id === entities[idx].id) { setScissorsMode(false); setScissorsFirst(null); showToast('ℹ️ Points trop proches', 'info'); return; }
    const updated = [...entities.slice(0, idx), ...pieces, ...entities.slice(idx + 1)];
    setEntities(updated); addToHistory(updated);
    setScissorsMode(false); setScissorsFirst(null);
    showToast(`✂ Contour coupé en ${pieces.length} partie(s)`, 'success');
  };

  // ════════════════════════════════════════════════════
  // UTILITY OPERATIONS
  // ════════════════════════════════════════════════════

  const cleanIsolatedPoints = () => {
    const minSize = 0.1;
    const cleaned = entities.filter(data => {
      const entity = recreateEntity(data);
      if (!entity) return false;
      if (entity.type === 'line') { const dx=entity.end.x-entity.start.x, dy=entity.end.y-entity.start.y; return Math.sqrt(dx*dx+dy*dy) >= minSize; }
      if (entity.type === 'circle') return entity.radius >= minSize;
      if (entity.type === 'arc') return entity.radius >= minSize;
      if (entity.type === 'path') {
        if (entity.points.length < 2) return false;
        let totalLen = 0;
        for (let i=1; i<entity.points.length; i++) totalLen += Math.sqrt((entity.points[i].x-entity.points[i-1].x)**2 + (entity.points[i].y-entity.points[i-1].y)**2);
        return totalLen >= minSize;
      }
      return true;
    });
    const removed = entities.length - cleaned.length;
    if (removed === 0) { showToast('✅ Aucun point isolé trouvé', 'success'); }
    else { setEntities(cleaned); addToHistory(cleaned); showToast(`✅ ${removed} point(s) supprimé(s)`, 'success'); }
  };

  const normalizePosition = () => {
    if (entities.length === 0) { showToast('⚠️ Aucune entité à normaliser'); return; }
    let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
    entities.forEach(data => {
      const entity = recreateEntity(data);
      if (!entity) return;
      if (entity.type === 'line') { minX=Math.min(minX,entity.start.x,entity.end.x); minY=Math.min(minY,entity.start.y,entity.end.y); maxX=Math.max(maxX,entity.start.x,entity.end.x); maxY=Math.max(maxY,entity.start.y,entity.end.y); }
      else if (entity.type === 'rectangle') { minX=Math.min(minX,entity.topLeft.x); minY=Math.min(minY,entity.topLeft.y); maxX=Math.max(maxX,entity.topLeft.x+entity.width); maxY=Math.max(maxY,entity.topLeft.y+entity.height); }
      else if (entity.type === 'circle') { minX=Math.min(minX,entity.center.x-entity.radius); minY=Math.min(minY,entity.center.y-entity.radius); maxX=Math.max(maxX,entity.center.x+entity.radius); maxY=Math.max(maxY,entity.center.y+entity.radius); }
      else if (entity.type === 'arc') { minX=Math.min(minX,entity.center.x-entity.radius); minY=Math.min(minY,entity.center.y-entity.radius); maxX=Math.max(maxX,entity.center.x+entity.radius); maxY=Math.max(maxY,entity.center.y+entity.radius); }
      else if (entity.type === 'path') { entity.points.forEach(p => { minX=Math.min(minX,p.x); minY=Math.min(minY,p.y); maxX=Math.max(maxX,p.x); maxY=Math.max(maxY,p.y); }); }
      else if (entity.type === 'text' && entity.position) { minX=Math.min(minX,entity.position.x); minY=Math.min(minY,entity.position.y); maxX=Math.max(maxX,entity.position.x+100); maxY=Math.max(maxY,entity.position.y+50); }
      else if (entity.type === 'freeform') { entity.controlPoints.forEach(p => { minX=Math.min(minX,p.x); minY=Math.min(minY,p.y); maxX=Math.max(maxX,p.x); maxY=Math.max(maxY,p.y); }); }
    });
    if (!isFinite(minX) || !isFinite(minY)) { showToast('❌ Impossible de calculer le bounding box'); return; }
    const offsetX = -minX, offsetY = -minY;
    if (Math.abs(offsetX) < 0.01 && Math.abs(offsetY) < 0.01) { showToast('✅ Dessin déjà bien positionné'); return; }
    const newEntities = entities.map(data => {
      const entity = recreateEntity(data);
      if (!entity) return data;
      entity.move(offsetX, offsetY);
      return JSON.parse(JSON.stringify(entity));
    });
    setEntities(newEntities); addToHistory(newEntities);
    showToast(`✅ Dessin normalisé ! Dimensions : ${(maxX-minX).toFixed(1)} × ${(maxY-minY).toFixed(1)} mm`, 'success');
  };

  const fixJoints = () => {
    const selected = entities.filter(e => e.selected);
    if (selected.length === 0) { showToast('⚠️ Sélectionnez au moins 2 entités à joindre'); return; }
    const tolerance = 2;
    const endpoints = [];
    selected.forEach((data, entityIdx) => {
      const entity = recreateEntity(data);
      if (!entity) return;
      if (entity.type === 'line') { endpoints.push({ entityIdx: entityIdx, entity: data, point: entity.start, isStart: true }); endpoints.push({ entityIdx: entityIdx, entity: data, point: entity.end, isStart: false }); }
      else if (entity.type === 'path' && !entity.closed) { endpoints.push({ entityIdx: entityIdx, entity: data, point: entity.points[0], isStart: true }); endpoints.push({ entityIdx: entityIdx, entity: data, point: entity.points[entity.points.length-1], isStart: false }); }
    });
    if (endpoints.length < 2) { showToast('⚠️ Pas assez de points à joindre'); return; }
    const joined = new Set();
    let joinCount = 0;
    for (let i=0; i<endpoints.length; i++) {
      if (joined.has(i)) continue;
      for (let j=i+1; j<endpoints.length; j++) {
        if (joined.has(j)) continue;
        const ep1 = endpoints[i], ep2 = endpoints[j];
        if (ep1.entityIdx === ep2.entityIdx) continue;
        const dist = distance(ep1.point, ep2.point);
        if (dist < tolerance && dist > 0.001) {
          const midPoint = { x: (ep1.point.x+ep2.point.x)/2, y: (ep1.point.y+ep2.point.y)/2 };
          if (ep1.entity.type === 'line') { if (ep1.isStart) ep1.entity.start = midPoint; else ep1.entity.end = midPoint; }
          else if (ep1.entity.type === 'path') { if (ep1.isStart) ep1.entity.points[0] = midPoint; else ep1.entity.points[ep1.entity.points.length-1] = midPoint; }
          if (ep2.entity.type === 'line') { if (ep2.isStart) ep2.entity.start = midPoint; else ep2.entity.end = midPoint; }
          else if (ep2.entity.type === 'path') { if (ep2.isStart) ep2.entity.points[0] = midPoint; else ep2.entity.points[ep2.entity.points.length-1] = midPoint; }
          joined.add(i); joined.add(j); joinCount++; break;
        }
      }
    }
    if (joinCount > 0) { setEntities([...entities]); addToHistory(entities); showToast(`✅ ${joinCount} joint(s) fixé(s) !`); }
    else { showToast('⚠️ Aucun point assez proche (< 2mm)'); }
  };

  const explodePath = () => {
    const selected = entities.find(e => e.selected);
    if (!selected) { showToast('⚠️ Sélectionnez une entité à éclater'); return; }
    const entity = recreateEntity(selected);
    let newEntities = entities.filter(e => e.id !== selected.id);
    if (entity.type === 'path' || entity.type === 'rectangle') {
      const lines = entity.toLines();
      lines.forEach(line => { line.color = entity.color; newEntities.push(JSON.parse(JSON.stringify(line))); });
      setEntities(newEntities); addToHistory(newEntities);
      showToast(`✅ Éclaté en ${lines.length} lignes`);
    } else { showToast('ℹ️ Cette entité ne peut pas être éclatée'); }
  };

  const convertTextToPath = async () => {
    const selected = entities.find(e => e.selected);
    if (!selected || selected.type !== 'text') { showToast('⚠️ Sélectionnez un texte à convertir', 'warning'); return; }
    try {
      const opentype = await loadOpentypeScript();
      const textEntity = recreateEntity(selected);
      if (!textEntity || !textEntity.text || !textEntity.position) { showToast('❌ Texte invalide', 'error'); return; }
      const fontName = textEntity.fontFamily || 'Roboto';
      const fontUrl = FONT_URLS[fontName] || DEFAULT_FONT_URL;
      let font = fontCache.current[fontName];
      if (!font) {
        showToast(`⏳ Chargement ${fontName}...`, 'info');
        let lastError;
        for (let attempt=1; attempt<=3; attempt++) {
          try {
            const response = await fetch(fontUrl);
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const buffer = await response.arrayBuffer();
            font = opentype.parse(buffer);
            fontCache.current[fontName] = font;
            break;
          } catch (e) { lastError = e.message; if (attempt < 3) await new Promise(r => setTimeout(r, 500)); }
        }
        if (!font) throw new Error(`Échec chargement police: ${lastError}`);
      }
      const fontPath = font.getPath(textEntity.text, textEntity.position.x, textEntity.position.y, textEntity.fontSize);
      const newPaths = [];
      let currentPoints = [];
      fontPath.commands.forEach(cmd => {
        if (cmd.type === 'M') {
          if (currentPoints.length > 0) { newPaths.push(JSON.parse(JSON.stringify(new PathEntity([...currentPoints], false)))); currentPoints = []; }
          currentPoints.push({ x: cmd.x, y: cmd.y });
        } else if (cmd.type === 'L') { currentPoints.push({ x: cmd.x, y: cmd.y }); }
        else if (cmd.type === 'Q') {
          const p0 = currentPoints[currentPoints.length-1];
          for (let t=1; t<=10; t++) { const r=t/10; currentPoints.push({ x:(1-r)*(1-r)*p0.x+2*(1-r)*r*cmd.x1+r*r*cmd.x, y:(1-r)*(1-r)*p0.y+2*(1-r)*r*cmd.y1+r*r*cmd.y }); }
        } else if (cmd.type === 'C') {
          const p0 = currentPoints[currentPoints.length-1];
          for (let t=1; t<=15; t++) { const r=t/15; currentPoints.push({ x:Math.pow(1-r,3)*p0.x+3*Math.pow(1-r,2)*r*cmd.x1+3*(1-r)*r*r*cmd.x2+Math.pow(r,3)*cmd.x, y:Math.pow(1-r,3)*p0.y+3*Math.pow(1-r,2)*r*cmd.y1+3*(1-r)*r*r*cmd.y2+Math.pow(r,3)*cmd.y }); }
        } else if (cmd.type === 'Z') {
          if (currentPoints.length > 0) { newPaths.push(JSON.parse(JSON.stringify(new PathEntity([...currentPoints], true)))); currentPoints = []; }
        }
      });
      if (currentPoints.length > 0) newPaths.push(JSON.parse(JSON.stringify(new PathEntity([...currentPoints], false))));
      newPaths.forEach(p => p.color = textEntity.color);
      if (textEntity.arcRadius && Math.abs(textEntity.arcRadius) >= 10) {
        const radius = Math.abs(textEntity.arcRadius);
        const arcUp = textEntity.arcRadius > 0;
        const textWidth = textEntity.text.length * textEntity.fontSize * 0.6;
        const centerX = textEntity.position.x + textWidth / 2;
        const centerY = arcUp ? textEntity.position.y + radius : textEntity.position.y - radius;
        newPaths.forEach(path => {
          if (!path.points) return;
          path.points = path.points.map(pt => {
            const dx = pt.x - textEntity.position.x, dy = pt.y - textEntity.position.y;
            const angleOffset = dx / radius;
            const baseAngle = arcUp ? Math.PI : 0;
            const angle = baseAngle - angleOffset;
            const radialOffset = arcUp ? -dy : dy;
            const r = radius + radialOffset;
            return { x: centerX + r * Math.cos(angle), y: centerY + r * Math.sin(angle) };
          });
        });
      }
      const newEntities = entities.filter(e => e.id !== selected.id);
      newEntities.push(...newPaths);
      setEntities(newEntities); addToHistory(newEntities);
      showToast(`✅ "${textEntity.text}" → ${newPaths.length} contours !`, 'success');
    } catch (error) {
      showToast(`❌ ${error.message}`, 'error');
    }
  };

  // ════════════════════════════════════════════════════
  // IMPORT / EXPORT
  // ════════════════════════════════════════════════════

  const importDXF = (fileContent) => {
    try {
      const result = importDXFModule(fileContent);
      const updated = [...entities, ...result.newEntities];
      setEntities(updated); addToHistory(updated);
      if (typeof setShowCuttingPath === 'function') setShowCuttingPath(false);
      showToast(result.message, 'success');
    } catch (error) {
      showToast('❌ Erreur lors de l\'import DXF', 'error');
    }
  };

  const importTXT = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = parseMachineTXT(event.target.result);
        setEntities(result.entities); addToHistory(result.entities);
        if (typeof setShowCuttingPath === 'function') setShowCuttingPath(false);
        showToast(`✅ ${result.count} contours importés`, 'success');
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const downloadBlob = (content, filename, mime) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportDXF = () => {
    const dxf = exportDXFModule(entities);
    if (window.showSaveFilePicker) {
      (async () => {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: `dessin_${Date.now()}.dxf`,
            types: [{ description: 'DXF', accept: { 'application/dxf': ['.dxf'] } }]
          });
          const writable = await handle.createWritable();
          await writable.write(dxf);
          await writable.close();
          showToast('✅ DXF enregistré', 'success');
        } catch (err) {
          if (err.name === 'AbortError') return;
          // Fallback: classic download (showSaveFilePicker can fail in iframes)
          console.error('showSaveFilePicker failed, using fallback', err);
          downloadBlob(dxf, `dessin_${Date.now()}.dxf`, 'application/dxf');
          showToast('✅ DXF téléchargé', 'success');
        }
      })();
    } else {
      downloadBlob(dxf, `dessin_${Date.now()}.dxf`, 'application/dxf');
    }
  };

  // ═══ Validation avant export (détecte les soucis fréquents avant de découper) ═══
  const validateEntities = (ents) => {
    const warnings = [];
    const CLOSE_GAP_TOLERANCE = 0.5; // mm : écart jugé "presque fermé"
    const TINY_SIZE_TOLERANCE = 0.3; // mm : entité jugée "bruit"

    ents.forEach((data, idx) => {
      const entity = recreateEntity(data);
      if (!entity) return;
      const label = `Entité #${idx + 1} (${entity.type})`;

      // Chemins ouverts qui semblent en fait fermés (début et fin très proches)
      if (entity.type === 'path' && !entity.closed && entity.points.length >= 3) {
        const gap = distance(entity.points[0], entity.points[entity.points.length - 1]);
        if (gap > 0.001 && gap < CLOSE_GAP_TOLERANCE) {
          warnings.push(`${label} : presque fermé (écart de ${gap.toFixed(2)} mm) — la pièce risque de ne pas se détacher complètement.`);
        }
      }

      // Entités quasi nulles (probablement du bruit issu d'un import ou d'une manipulation)
      if (entity.type === 'line') {
        const len = distance(entity.start, entity.end);
        if (len < TINY_SIZE_TOLERANCE) warnings.push(`${label} : longueur quasi nulle (${len.toFixed(2)} mm), probablement du bruit.`);
      } else if (entity.type === 'circle' || entity.type === 'arc') {
        if (entity.radius < TINY_SIZE_TOLERANCE) warnings.push(`${label} : rayon quasi nul (${entity.radius.toFixed(2)} mm), probablement du bruit.`);
      }
    });

    // Doublons exacts (deux entités identiques au même endroit = double découpe au même endroit)
    for (let i = 0; i < ents.length; i++) {
      for (let j = i + 1; j < ents.length; j++) {
        const a = recreateEntity(ents[i]);
        const b = recreateEntity(ents[j]);
        if (!a || !b || a.type !== b.type) continue;
        let same = false;
        if (a.type === 'line') {
          same = distance(a.start, b.start) < 0.05 && distance(a.end, b.end) < 0.05;
        } else if (a.type === 'circle') {
          same = distance(a.center, b.center) < 0.05 && Math.abs(a.radius - b.radius) < 0.05;
        }
        if (same) warnings.push(`Entités #${i + 1} et #${j + 1} semblent identiques et superposées — risque de double passage de découpe.`);
      }
    }

    return warnings;
  };

  const exportGCode = () => {
    try {
      if (entities.length === 0) { showToast('⚠️ Aucune entité à exporter !'); return; }
      const warnings = validateEntities(entities);
      if (warnings.length > 0) {
        const message = `⚠️ ${warnings.length} point(s) à vérifier avant l'export :\n\n${warnings.slice(0, 8).join('\n')}${warnings.length > 8 ? `\n… et ${warnings.length - 8} de plus.` : ''}\n\nExporter quand même ?`;
        const proceed = window.confirm(message);
        if (!proceed) { showToast('Export annulé', 'info'); return; }
      }
      const gcode = exportGCodeModule(entities, kerfWidth || 0, isEntityInsideAnother);
      setGcodePreview(gcode);
    } catch (error) {
      showToast('❌ Erreur lors de l\'export G-code: ' + error.message, 'error');
    }
  };

  // ════════════════════════════════════════════════════
  // IMBRICATION (NESTING) — placement automatique sur une tôle
  // ════════════════════════════════════════════════════

  // Bounding box d'une entité (une pièce = une seule entité ; utiliser "Fusionner en 1 contour"
  // au préalable si une pièce est composée de plusieurs entités séparées)
  const getEntityDataBBox = (data) => {
    const entity = recreateEntity(data);
    if (!entity) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    if (entity.type === 'line') {
      minX = Math.min(entity.start.x, entity.end.x); maxX = Math.max(entity.start.x, entity.end.x);
      minY = Math.min(entity.start.y, entity.end.y); maxY = Math.max(entity.start.y, entity.end.y);
    } else if (entity.type === 'rectangle') {
      minX = entity.topLeft.x; minY = entity.topLeft.y;
      maxX = entity.topLeft.x + entity.width; maxY = entity.topLeft.y + entity.height;
    } else if (entity.type === 'circle' || entity.type === 'arc') {
      minX = entity.center.x - entity.radius; maxX = entity.center.x + entity.radius;
      minY = entity.center.y - entity.radius; maxY = entity.center.y + entity.radius;
    } else if (entity.type === 'path') {
      entity.points.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
    } else if (entity.type === 'freeform') {
      entity.controlPoints.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
    } else if (entity.type === 'contour') {
      (entity.entities || []).forEach(sub => {
        const b = getEntityDataBBox(sub);
        if (b) { minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY); maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY); }
      });
    }
    if (!isFinite(minX)) return null;
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
  };

  // Déplace une copie d'entité de (dx, dy) — mêmes conventions que les autres outils de copie du fichier
  const translateEntityCopy = (data, dx, dy) => {
    const copy = JSON.parse(JSON.stringify(data));
    if (copy.type === 'line') { copy.start.x += dx; copy.start.y += dy; copy.end.x += dx; copy.end.y += dy; }
    else if (copy.type === 'rectangle') { copy.topLeft.x += dx; copy.topLeft.y += dy; }
    else if (copy.type === 'circle' || copy.type === 'arc') { copy.center.x += dx; copy.center.y += dy; }
    else if (copy.type === 'path') { copy.points = copy.points.map(p => ({ x: p.x + dx, y: p.y + dy })); }
    else if (copy.type === 'text' && copy.position) { copy.position.x += dx; copy.position.y += dy; }
    else if (copy.type === 'freeform') { copy.controlPoints = copy.controlPoints.map(p => ({ x: p.x + dx, y: p.y + dy })); }
    else if (copy.type === 'contour') { copy.entities = (copy.entities || []).map(sub => translateEntityCopy(sub, dx, dy)); }
    if (copy.leadIn) copy.leadIn = { x: copy.leadIn.x + dx, y: copy.leadIn.y + dy };
    if (copy.leadOut) copy.leadOut = { x: copy.leadOut.x + dx, y: copy.leadOut.y + dy };
    if (copy.tabs) copy.tabs = copy.tabs.map(t => ({ x: t.x + dx, y: t.y + dy }));
    return copy;
  };

  const nestPieces = () => {
    const selected = entities.filter(e => e.selected);
    if (selected.length === 0) {
      showToast('⚠️ Sélectionnez la (ou les) pièce(s) à imbriquer', 'warning');
      return;
    }

    // Point représentatif d'une entité (pour tester si elle est "à l'intérieur" d'une autre)
    const getRepresentativePoint = (data) => {
      const entity = recreateEntity(data);
      if (!entity) return null;
      if (entity.type === 'circle' || entity.type === 'arc') return entity.center;
      if (entity.type === 'rectangle') return { x: entity.topLeft.x + entity.width / 2, y: entity.topLeft.y + entity.height / 2 };
      if (entity.type === 'line') return { x: (entity.start.x + entity.end.x) / 2, y: (entity.start.y + entity.end.y) / 2 };
      if (entity.type === 'path' && entity.points.length > 0) {
        let sx = 0, sy = 0; entity.points.forEach(p => { sx += p.x; sy += p.y; });
        return { x: sx / entity.points.length, y: sy / entity.points.length };
      }
      if (entity.type === 'freeform' && entity.controlPoints.length > 0) {
        let sx = 0, sy = 0; entity.controlPoints.forEach(p => { sx += p.x; sy += p.y; });
        return { x: sx / entity.controlPoints.length, y: sy / entity.controlPoints.length };
      }
      if (entity.type === 'contour') {
        const b = getEntityDataBBox(data);
        return b ? { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 } : null;
      }
      return null;
    };

    // Teste si un point est à l'intérieur d'une entité (cercle, rectangle, contour/chemin fermé)
    const pointInsideEntityData = (point, data) => {
      const entity = recreateEntity(data);
      if (!entity) return false;
      if (entity.type === 'circle') return distance(point, entity.center) < entity.radius;
      if (entity.type === 'rectangle') {
        return point.x >= entity.topLeft.x && point.x <= entity.topLeft.x + entity.width &&
               point.y >= entity.topLeft.y && point.y <= entity.topLeft.y + entity.height;
      }
      let pts = [];
      if (entity.type === 'path') pts = entity.points;
      else if (entity.type === 'contour') {
        (entity.entities || []).forEach(sub => {
          const subE = recreateEntity(sub);
          if (!subE) return;
          if (subE.type === 'line') pts.push(subE.start, subE.end);
          else if (subE.type === 'path') pts.push(...subE.points);
          else if (subE.type === 'arc') {
            const steps = 12;
            for (let i = 0; i <= steps; i++) {
              const a = subE.startAngle + (subE.endAngle - subE.startAngle) * i / steps;
              pts.push({ x: subE.center.x + subE.radius * Math.cos(a), y: subE.center.y + subE.radius * Math.sin(a) });
            }
          }
        });
      } else {
        return false;
      }
      if (pts.length < 3) return false;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        if ((pts[i].y > point.y) !== (pts[j].y > point.y) &&
            point.x < (pts[j].x - pts[i].x) * (point.y - pts[i].y) / (pts[j].y - pts[i].y) + pts[i].x) {
          inside = !inside;
        }
      }
      return inside;
    };

    // Regroupe les entités sélectionnées : une forme "extérieure" + tout ce qui est
    // géométriquement à l'intérieur d'elle (trous, motifs, etc.) = une seule pièce
    const groupSelectedIntoPieces = (list) => {
      const containerOf = new Map();
      list.forEach(data => {
        const point = getRepresentativePoint(data);
        if (!point) { containerOf.set(data.id, null); return; }
        let foundContainer = null, smallestArea = Infinity;
        list.forEach(other => {
          if (other.id === data.id) return;
          if (pointInsideEntityData(point, other)) {
            const b = getEntityDataBBox(other);
            const area = b ? b.w * b.h : Infinity;
            if (area < smallestArea) { smallestArea = area; foundContainer = other.id; }
          }
        });
        containerOf.set(data.id, foundContainer);
      });
      const outers = list.filter(d => !containerOf.get(d.id));
      const safeOuters = outers.length > 0 ? outers : [list[0]];
      const groups = safeOuters.map(outer => ({
        outerId: outer.id,
        members: list.filter(d => d.id === outer.id || containerOf.get(d.id) === outer.id),
      }));
      const covered = new Set(groups.flatMap(g => g.members.map(m => m.id)));
      list.forEach(d => { if (!covered.has(d.id)) groups[0].members.push(d); });
      return groups;
    };

    const getGroupBBox = (members) => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      members.forEach(data => {
        const b = getEntityDataBBox(data);
        if (!b) return;
        minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY);
        maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY);
      });
      if (!isFinite(minX)) return null;
      return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
    };

    const groups = groupSelectedIntoPieces(selected);
    if (groups.length === 0) { showToast('❌ Impossible de déterminer les pièces à imbriquer', 'error'); return; }

    const singlePieceMode = groups.length === 1;
    const baseInputs = { sheetWidth: 600, sheetHeight: 400, spacing: 5 };
    const inputs = singlePieceMode ? { ...baseInputs, quantity: 10 } : baseInputs;

    openDialog('📦 Imbrication sur la tôle', inputs, (values) => {
      const sheetW = Math.max(1, parseFloat(values.sheetWidth) || 0);
      const sheetH = Math.max(1, parseFloat(values.sheetHeight) || 0);
      const spacing = Math.max(0, parseFloat(values.spacing) || 0);
      setDialogOpen(false);

      const pieceGroups = singlePieceMode
        ? Array.from({ length: Math.max(1, Math.round(values.quantity) || 1) }, () => groups[0])
        : groups;

      const withBBox = pieceGroups.map((group, sourceIndex) => ({ group, sourceIndex, bbox: getGroupBBox(group.members) })).filter(it => it.bbox);
      if (withBBox.length === 0) { showToast('❌ Impossible de calculer les dimensions des pièces sélectionnées', 'error'); return; }

      withBBox.sort((a, b) => Math.max(b.bbox.w, b.bbox.h) - Math.max(a.bbox.w, a.bbox.h));

      const placements = [];
      const unplaced = [];
      let shelfY = 0, shelfHeight = 0, cursorX = 0;

      withBBox.forEach(item => {
        const { w, h } = item.bbox;
        const orientations = [{ w, h, rotated: false }, { w: h, h: w, rotated: true }]
          .filter(o => o.w <= sheetW + 0.001 && o.h <= sheetH + 0.001);
        if (orientations.length === 0) { unplaced.push(item); return; }

        let fitting = orientations.filter(o => cursorX + o.w <= sheetW + 0.001);
        let chosen = null;
        if (fitting.length > 0) {
          chosen = fitting.reduce((best, o) => (o.h < best.h ? o : best), fitting[0]);
        } else {
          const newShelfY = shelfY + shelfHeight + (shelfHeight > 0 ? spacing : 0);
          const fittingSheet = orientations.filter(o => newShelfY + o.h <= sheetH + 0.001);
          if (fittingSheet.length === 0) { unplaced.push(item); return; }
          chosen = fittingSheet.reduce((best, o) => (o.h < best.h ? o : best), fittingSheet[0]);
          shelfY = newShelfY; shelfHeight = 0; cursorX = 0;
        }

        placements.push({ ...item, x: cursorX, y: shelfY, rotated: chosen.rotated, w: chosen.w, h: chosen.h });
        cursorX += chosen.w + spacing;
        shelfHeight = Math.max(shelfHeight, chosen.h);
      });

      const genId = () => Math.random().toString(36).substr(2, 9);
      const placedEntities = [];

      placements.forEach(p => {
        let members = p.group.members.map(m => {
          const clone = JSON.parse(JSON.stringify(m));
          clone.id = genId();
          clone.selected = false;
          return clone;
        });

        if (p.rotated) {
          const center = { x: (p.bbox.minX + p.bbox.maxX) / 2, y: (p.bbox.minY + p.bbox.maxY) / 2 };
          members = rotateSelectedEntities(members.map(m => ({ ...m, selected: true })), center, Math.PI / 2)
            .map(m => ({ ...m, selected: false }));
        }

        const newBBox = getGroupBBox(members);
        if (!newBBox) return;
        const dx = p.x - newBBox.minX;
        const dy = p.y - newBBox.minY;
        members.forEach(m => placedEntities.push(translateEntityCopy(m, dx, dy)));
      });

      const idsToRemove = new Set(selected.map(s => s.id));
      const untouched = entities.filter(e => !idsToRemove.has(e.id));
      const newEntities = [...untouched, ...placedEntities];
      setEntities(newEntities);
      addToHistory(newEntities);

      let message = `✅ ${placements.length} pièce(s) placée(s) sur la tôle (${sheetW}×${sheetH} mm)`;
      if (unplaced.length > 0) message += `\n⚠️ ${unplaced.length} pièce(s) n'ont pas pu être placées (tôle trop petite).`;
      showToast(message, unplaced.length > 0 ? 'warning' : 'success');
    });
  };

  const exportPlanPDF = () => {
    try {
      if (entities.length === 0) { showToast('⚠️ Aucune entité à exporter !', 'warning'); return; }
      exportDrawingPDF(entities);
      showToast('✅ Plan PDF téléchargé !', 'success');
    } catch (error) {
      showToast('❌ Erreur lors de l\'export PDF: ' + error.message, 'error');
    }
  };

  return {
    createBisector, extendLines, reverseArc, breakAtIntersection,
    mirrorHorizontal, mirrorVertical, arrayRectangular, arrayCircular,
    addTabs, addTab, parallelOffset, circlesAtIntersections,
    extractOuterContour, startManualFusion, finishManualFusion,
    fusionLignes, groupLinesIntoPaths, filletCorners, mergeToSinglePath,
    addLeadIns, removeLeadIns, addLeadOuts, removeLeadOuts,
    sortEntitiesInsideOut, optimizeCuttingOrder, smoothSelectedShape, cleanIsolatedPoints, normalizePosition,
    fixJoints, explodePath, convertTextToPath,
    importDXF, importTXT, exportDXF, exportGCode, exportPlanPDF, nestPieces,
    setAddingTab, joinSelectedPaths, startBreakAtPoint, breakAtPoint,
    startScissors, scissorsClick,
  };
}

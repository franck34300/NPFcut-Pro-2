import { useState, useRef, useEffect } from 'react';
import { LineEntity } from '@/lib/entities/LineEntity';
import { CircleEntity } from '@/lib/entities/CircleEntity';
import { ArcEntity } from '@/lib/entities/ArcEntity';
import { RectangleEntity } from '@/lib/entities/RectangleEntity';
import { TextEntity } from '@/lib/entities/TextEntity';
import { FreeformEntity } from '@/lib/entities/FreeformEntity';
import { recreateEntity } from '@/lib/entities/recreateEntity';
import { distance, distanceToSegment } from '@/lib/geometry';
import { useHistory } from '@/hooks/useHistory';
import { useCADOperations } from '@/hooks/cad/useCADOperations';
import { rotateSelectedEntities } from '@/lib/cad/rotateSelectedEntities';
import Toolbar from '@/components/cad/Toolbar';
import Dialog from '@/components/cad/Dialog';
import GcodeModal from '@/components/cad/GcodeModal';
import SimulationModal from '@/components/cad/SimulationModal';
import Toast from '@/components/cad/Toast';

export default function CADStudio() {
  const canvasRef = useRef(null);
  const lastMousePos = useRef(null);
  const fontCache = useRef({});
  const spaceDown = useRef(false);
  const stateRef = useRef({});

  const [entities, setEntities] = useState([]);
  const [tool, setTool] = useState('select');
  const [tempPoints, setTempPoints] = useState([]);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [selectedHandle, setSelectedHandle] = useState(null);
  const [showGrid, setShowGrid] = useState(true);
  const [gridSnap, setGridSnap] = useState(true);
  const [gridSize] = useState(20);
  const [measurements, setMeasurements] = useState(null);
  const [selectionRect, setSelectionRect] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [gcodePreview, setGcodePreview] = useState(null);
  const [scaleHandle, setScaleHandle] = useState(null);
  const [rotationMode, setRotationMode] = useState(false);
  const [rotationHandle, setRotationHandle] = useState(null);
  const [leadInHandle, setLeadInHandle] = useState(null);
  const [leadOutHandle, setLeadOutHandle] = useState(null);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [showCuttingPath, setShowCuttingPath] = useState(false);
  const [toast, setToast] = useState(null);
  const [manualFusionMode, setManualFusionMode] = useState(false);
  const [manualFusionPoints, setManualFusionPoints] = useState([]);
  const [manualFusionEntities, setManualFusionEntities] = useState([]);
  const [tabHandle, setTabHandle] = useState(null);
  const [addingTab, setAddingTab] = useState(false);
  const [tabMode, setTabMode] = useState(false);
  const [simulationOpen, setSimulationOpen] = useState(false);
  const [kerfWidth, setKerfWidth] = useState(0);
  const [breakMode, setBreakMode] = useState(false);
  const [scissorsMode, setScissorsMode] = useState(false);
  const [scissorsFirst, setScissorsFirst] = useState(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogInputs, setDialogInputs] = useState({});
  const [dialogCallback, setDialogCallback] = useState(null);
  const [dialogPosition, setDialogPosition] = useState(null);
  const [dialogOptions, setDialogOptions] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const { history, historyIndex, addToHistory, undo, redo } = useHistory(setEntities);

  const getSelectionBBox = (ents) => {
    const selected = ents.filter(e => e.selected);
    if (selected.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selected.forEach(data => {
      const entity = recreateEntity(data);
      if (!entity) return;
      if (entity.type === 'line') {
        minX = Math.min(minX, entity.start.x, entity.end.x); minY = Math.min(minY, entity.start.y, entity.end.y);
        maxX = Math.max(maxX, entity.start.x, entity.end.x); maxY = Math.max(maxY, entity.start.y, entity.end.y);
      } else if (entity.type === 'rectangle') {
        minX = Math.min(minX, entity.topLeft.x); minY = Math.min(minY, entity.topLeft.y);
        maxX = Math.max(maxX, entity.topLeft.x + entity.width); maxY = Math.max(maxY, entity.topLeft.y + entity.height);
      } else if (entity.type === 'circle' || entity.type === 'arc') {
        minX = Math.min(minX, entity.center.x - entity.radius); minY = Math.min(minY, entity.center.y - entity.radius);
        maxX = Math.max(maxX, entity.center.x + entity.radius); maxY = Math.max(maxY, entity.center.y + entity.radius);
      } else if (entity.type === 'path') {
        entity.points.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
      } else if (entity.type === 'text' && entity.position) {
        minX = Math.min(minX, entity.position.x); minY = Math.min(minY, entity.position.y - entity.fontSize);
        maxX = Math.max(maxX, entity.position.x + entity.text.length * entity.fontSize * 0.6); maxY = Math.max(maxY, entity.position.y);
      } else if (entity.type === 'freeform') {
        entity.controlPoints.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
      }
    });
    if (!isFinite(minX)) return null;
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
  };

  const scaleSelectedEntities = (ents, bbox, corner, newPos) => {
    let originX, originY;
    if (corner === 'BR') { originX = bbox.minX; originY = bbox.minY; }
    else if (corner === 'BL') { originX = bbox.maxX; originY = bbox.minY; }
    else if (corner === 'TR') { originX = bbox.minX; originY = bbox.maxY; }
    else { originX = bbox.maxX; originY = bbox.maxY; }
    const newW = Math.abs(newPos.x - originX), newH = Math.abs(newPos.y - originY);
    if (bbox.w < 0.001 || bbox.h < 0.001) return ents;
    const scaleX = newW / bbox.w, scaleY = newH / bbox.h;
    if (scaleX < 0.001 || scaleY < 0.001) return ents;
    return ents.map(data => {
      if (!data.selected) return data;
      const entity = recreateEntity(data);
      if (!entity) return data;
      const scalePoint = (p) => ({ x: originX + (p.x - originX) * scaleX, y: originY + (p.y - originY) * scaleY });
      if (entity.type === 'line') { entity.start = scalePoint(entity.start); entity.end = scalePoint(entity.end); }
      else if (entity.type === 'rectangle') {
        const newTL = scalePoint(entity.topLeft);
        const newBR = scalePoint({ x: entity.topLeft.x + entity.width, y: entity.topLeft.y + entity.height });
        entity.topLeft = newTL; entity.width = newBR.x - newTL.x; entity.height = newBR.y - newTL.y;
      } else if (entity.type === 'circle' || entity.type === 'arc') {
        entity.center = scalePoint(entity.center); entity.radius = entity.radius * ((scaleX + scaleY) / 2);
      } else if (entity.type === 'path') { entity.points = entity.points.map(scalePoint); }
      else if (entity.type === 'text' && entity.position) { entity.position = scalePoint(entity.position); entity.fontSize = entity.fontSize * ((scaleX + scaleY) / 2); }
      else if (entity.type === 'freeform') { entity.controlPoints = entity.controlPoints.map(scalePoint); }
      return JSON.parse(JSON.stringify(entity));
    });
  };

  const screenToWorld = (screenX, screenY) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    let x = (screenX - rect.left - canvas.offsetWidth / 2 - camera.x) / camera.zoom;
    let y = (screenY - rect.top - canvas.offsetHeight / 2 - camera.y) / camera.zoom;
    if (gridSnap && tool !== 'select' && tool !== 'pan') {
      x = Math.round(x / gridSize) * gridSize;
      y = Math.round(y / gridSize) * gridSize;
    }
    return { x, y };
  };

  const worldToScreen = (worldX, worldY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    return { x: worldX * camera.zoom + canvas.offsetWidth / 2 + camera.x, y: worldY * camera.zoom + canvas.offsetHeight / 2 + camera.y };
  };

  const operations = useCADOperations({
    entities, setEntities, addToHistory, showToast, getSelectionBBox,
    setDialogOpen, setDialogTitle, setDialogInputs, setDialogCallback, setDialogPosition, setDialogOptions,
    setManualFusionMode, setManualFusionPoints, setManualFusionEntities, manualFusionEntities,
    fontCache, setGcodePreview, setAddingTab, tabMode, setTabMode,
    kerfWidth, setBreakMode, camera,
    setScissorsMode, scissorsFirst, setScissorsFirst,
  });

  // ═══ Drawing useEffect ═══
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.offsetWidth / 2 + camera.x, canvas.offsetHeight / 2 + camera.y);
    ctx.scale(camera.zoom, camera.zoom);

    // Grid
    if (showGrid) {
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 0.4 / camera.zoom;
      const startX = Math.floor((-canvas.offsetWidth / 2 - camera.x) / camera.zoom / gridSize) * gridSize;
      const endX = Math.ceil((canvas.offsetWidth / 2 - camera.x) / camera.zoom / gridSize) * gridSize;
      const startY = Math.floor((-canvas.offsetHeight / 2 - camera.y) / camera.zoom / gridSize) * gridSize;
      const endY = Math.ceil((canvas.offsetHeight / 2 - camera.y) / camera.zoom / gridSize) * gridSize;
      for (let x = startX; x <= endX; x += gridSize) { ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, endY); ctx.stroke(); }
      for (let y = startY; y <= endY; y += gridSize) { ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke(); }
    }

    // Axes
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 0.8 / camera.zoom;
    ctx.beginPath();
    ctx.moveTo(-10000, 0); ctx.lineTo(10000, 0); ctx.moveTo(0, -10000); ctx.lineTo(0, 10000);
    ctx.stroke();

    // Cross at origin
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.2 / camera.zoom;
    const crossSize = 20 / camera.zoom;
    ctx.beginPath();
    ctx.moveTo(-crossSize, 0); ctx.lineTo(crossSize, 0); ctx.moveTo(0, -crossSize); ctx.lineTo(0, crossSize);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, crossSize * 0.7, 0, 2 * Math.PI); ctx.stroke();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('DÉPART', canvas.offsetWidth / 2 + camera.x + 25, canvas.offsetHeight / 2 + camera.y - 10);
    ctx.restore();

    // Entities
    entities.forEach(data => { const entity = recreateEntity(data); if (entity) entity.draw(ctx); });

    // Manual fusion overlay
    if (manualFusionMode && manualFusionEntities.length > 0) {
      manualFusionEntities.forEach((data, idx) => {
        const entity = recreateEntity(data);
        if (!entity) return;
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3 / camera.zoom;
        ctx.setLineDash([5 / camera.zoom, 5 / camera.zoom]);
        if (entity.type === 'line') { ctx.beginPath(); ctx.moveTo(entity.start.x, entity.start.y); ctx.lineTo(entity.end.x, entity.end.y); ctx.stroke(); }
        else if (entity.type === 'arc') { ctx.beginPath(); ctx.arc(entity.center.x, entity.center.y, entity.radius, entity.startAngle, entity.endAngle); ctx.stroke(); }
        else if (entity.type === 'circle') { ctx.beginPath(); ctx.arc(entity.center.x, entity.center.y, entity.radius, 0, 2 * Math.PI); ctx.stroke(); }
        else if (entity.type === 'path') { ctx.beginPath(); ctx.moveTo(entity.points[0].x, entity.points[0].y); for (let i = 1; i < entity.points.length; i++) ctx.lineTo(entity.points[i].x, entity.points[i].y); ctx.stroke(); }
        ctx.setLineDash([]);
        let midPoint;
        if (entity.type === 'line') midPoint = { x: (entity.start.x + entity.end.x) / 2, y: (entity.start.y + entity.end.y) / 2 };
        else if (entity.type === 'arc') { const ma = (entity.startAngle + entity.endAngle) / 2; midPoint = { x: entity.center.x + entity.radius * Math.cos(ma), y: entity.center.y + entity.radius * Math.sin(ma) }; }
        else if (entity.type === 'circle') midPoint = { x: entity.center.x + entity.radius, y: entity.center.y };
        else midPoint = entity.points[Math.floor(entity.points.length / 2)];
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const sp = worldToScreen(midPoint.x, midPoint.y);
        ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
        ctx.fillText((idx + 1).toString(), sp.x, sp.y);
        ctx.restore();
      });
    }

    // Temp points
    if (tempPoints.length > 0) {
      ctx.fillStyle = '#fbbf24';
      tempPoints.forEach(point => { ctx.beginPath(); ctx.arc(point.x, point.y, 4 / camera.zoom, 0, 2 * Math.PI); ctx.fill(); });
      if (tool === 'freeform' && tempPoints.length === 2) {
        const start = tempPoints[0], end = tempPoints[1];
        const size = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y));
        const topLeft = { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y) };
        ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 0.8 / camera.zoom; ctx.setLineDash([5 / camera.zoom, 5 / camera.zoom]);
        ctx.strokeRect(topLeft.x, topLeft.y, size, size); ctx.setLineDash([]);
      }
    }

    // Lead-Ins
    entities.forEach(data => {
      if (!data.leadIn) return;
      const entity = recreateEntity(data);
      if (!entity) return;
      let startPoint = null;
      if (entity.type === 'line') startPoint = entity.start;
      else if (entity.type === 'path' && entity.points.length > 0) startPoint = entity.points[0];
      else if (entity.type === 'circle') startPoint = { x: entity.center.x + entity.radius, y: entity.center.y };
      else if (entity.type === 'rectangle') startPoint = entity.topLeft;
      if (!startPoint) return;
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 0.8 / camera.zoom; ctx.setLineDash([4 / camera.zoom, 4 / camera.zoom]);
      ctx.beginPath(); ctx.moveTo(data.leadIn.x, data.leadIn.y); ctx.lineTo(startPoint.x, startPoint.y); ctx.stroke(); ctx.setLineDash([]);
      if (data.selected) {
        ctx.fillStyle = '#ef4444'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.8 / camera.zoom;
        ctx.beginPath(); ctx.arc(data.leadIn.x, data.leadIn.y, 6 / camera.zoom, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
        const sx = data.leadIn.x * camera.zoom + canvas.offsetWidth / 2 + camera.x;
        const sy = data.leadIn.y * camera.zoom + canvas.offsetHeight / 2 + camera.y;
        ctx.fillStyle = '#ef4444'; ctx.font = 'bold 10px monospace';
        ctx.fillText('IN', sx - 10, sy - 8); ctx.restore();
      } else { ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(data.leadIn.x, data.leadIn.y, 3 / camera.zoom, 0, 2 * Math.PI); ctx.fill(); }
    });

    // Lead-Outs
    entities.forEach(data => {
      if (!data.leadOut) return;
      const entity = recreateEntity(data);
      if (!entity) return;
      let endPoint = null;
      if (entity.type === 'line') endPoint = entity.end;
      else if (entity.type === 'path' && entity.points.length > 0) endPoint = entity.points[entity.points.length - 1];
      else if (entity.type === 'circle') endPoint = { x: entity.center.x + entity.radius, y: entity.center.y };
      else if (entity.type === 'rectangle') endPoint = entity.topLeft;
      if (!endPoint) return;
      ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 0.8 / camera.zoom; ctx.setLineDash([4 / camera.zoom, 4 / camera.zoom]);
      ctx.beginPath(); ctx.moveTo(endPoint.x, endPoint.y); ctx.lineTo(data.leadOut.x, data.leadOut.y); ctx.stroke(); ctx.setLineDash([]);
      if (data.selected) {
        ctx.fillStyle = '#3b82f6'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.8 / camera.zoom;
        ctx.beginPath(); ctx.arc(data.leadOut.x, data.leadOut.y, 6 / camera.zoom, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
        const sx = data.leadOut.x * camera.zoom + canvas.offsetWidth / 2 + camera.x;
        const sy = data.leadOut.y * camera.zoom + canvas.offsetHeight / 2 + camera.y;
        ctx.fillStyle = '#3b82f6'; ctx.font = 'bold 10px monospace';
        ctx.fillText('OUT', sx - 12, sy - 8); ctx.restore();
      } else { ctx.fillStyle = '#3b82f6'; ctx.beginPath(); ctx.arc(data.leadOut.x, data.leadOut.y, 3 / camera.zoom, 0, 2 * Math.PI); ctx.fill(); }
    });

    // Cutting path preview
    if (showCuttingPath) {
      let lastPoint = null;
      entities.forEach((data, idx) => {
        const entity = recreateEntity(data);
        if (!entity) return;
        let startPoint = null;
        if (entity.type === 'line') startPoint = entity.start;
        else if (entity.type === 'circle') startPoint = { x: entity.center.x + entity.radius, y: entity.center.y };
        else if (entity.type === 'arc') startPoint = { x: entity.center.x + entity.radius * Math.cos(entity.startAngle), y: entity.center.y + entity.radius * Math.sin(entity.startAngle) };
        else if (entity.type === 'path' && entity.points.length > 0) startPoint = entity.points[0];
        else if (entity.type === 'rectangle') startPoint = entity.topLeft;
        if (!startPoint) return;
        const effectiveStart = data.leadIn || startPoint;
        if (lastPoint) {
          ctx.strokeStyle = '#06b6d4'; ctx.lineWidth = 0.8 / camera.zoom; ctx.setLineDash([6 / camera.zoom, 4 / camera.zoom]);
          ctx.beginPath(); ctx.moveTo(lastPoint.x, lastPoint.y); ctx.lineTo(effectiveStart.x, effectiveStart.y); ctx.stroke(); ctx.setLineDash([]);
          const midX = (lastPoint.x + effectiveStart.x) / 2, midY = (lastPoint.y + effectiveStart.y) / 2;
          const angle = Math.atan2(effectiveStart.y - lastPoint.y, effectiveStart.x - lastPoint.x);
          ctx.fillStyle = '#06b6d4'; ctx.save(); ctx.translate(midX, midY); ctx.rotate(angle);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-8 / camera.zoom, -4 / camera.zoom); ctx.lineTo(-8 / camera.zoom, 4 / camera.zoom); ctx.fill(); ctx.restore();
        }
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
        const sx = effectiveStart.x * camera.zoom + canvas.offsetWidth / 2 + camera.x;
        const sy = effectiveStart.y * camera.zoom + canvas.offsetHeight / 2 + camera.y;
        ctx.fillStyle = '#06b6d4'; ctx.beginPath(); ctx.arc(sx, sy, 14, 0, 2 * Math.PI); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.8; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText((idx + 1).toString(), sx, sy); ctx.restore();
        if (entity.type === 'line') lastPoint = entity.end;
        else if (entity.type === 'circle') lastPoint = startPoint;
        else if (entity.type === 'path' && entity.points.length > 0) lastPoint = entity.points[entity.points.length - 1];
        else if (entity.type === 'rectangle') lastPoint = entity.topLeft;
        else lastPoint = startPoint;
      });
    }

    // Handles for selected entities
    entities.forEach(data => {
      if (!data.selected) return;
      const entity = recreateEntity(data);
      if (!entity) return;
      const handles = entity.getHandles();
      ctx.fillStyle = '#3b82f6'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.8 / camera.zoom;
      handles.forEach(handle => { ctx.beginPath(); ctx.arc(handle.x, handle.y, 5 / camera.zoom, 0, 2 * Math.PI); ctx.fill(); ctx.stroke(); });
    });

    // Selection bbox with handles
    const bbox = getSelectionBBox(entities);
    if (bbox && entities.some(e => e.selected)) {
      const pad = 10 / camera.zoom;
      ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 0.5 / camera.zoom; ctx.setLineDash([4 / camera.zoom, 4 / camera.zoom]);
      ctx.strokeRect(bbox.minX - pad, bbox.minY - pad, bbox.w + pad * 2, bbox.h + pad * 2);
      ctx.setLineDash([]);
      if (!rotationMode) {
        const corners = [
          { x: bbox.minX - pad, y: bbox.minY - pad }, { x: bbox.maxX + pad, y: bbox.minY - pad },
          { x: bbox.minX - pad, y: bbox.maxY + pad }, { x: bbox.maxX + pad, y: bbox.maxY + pad },
        ];
        corners.forEach(c => {
          ctx.fillStyle = '#3b82f6'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.5 / camera.zoom;
          ctx.fillRect(c.x - 5 / camera.zoom, c.y - 5 / camera.zoom, 10 / camera.zoom, 10 / camera.zoom);
          ctx.strokeRect(c.x - 5 / camera.zoom, c.y - 5 / camera.zoom, 10 / camera.zoom, 10 / camera.zoom);
        });
      } else {
        const rotPad = 15 / camera.zoom;
        const corners = [
          { x: bbox.minX - rotPad, y: bbox.minY - rotPad }, { x: bbox.maxX + rotPad, y: bbox.minY - rotPad },
          { x: bbox.minX - rotPad, y: bbox.maxY + rotPad }, { x: bbox.maxX + rotPad, y: bbox.maxY + rotPad },
        ];
        corners.forEach(c => {
          ctx.fillStyle = '#22d3ee'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.5 / camera.zoom;
          ctx.beginPath(); ctx.arc(c.x, c.y, 6 / camera.zoom, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
        });
      }
    }

    // Selection rectangle
    if (selectionRect) {
      ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 0.5 / camera.zoom; ctx.setLineDash([4 / camera.zoom, 4 / camera.zoom]);
      ctx.strokeRect(
        Math.min(selectionRect.start.x, selectionRect.end.x),
        Math.min(selectionRect.start.y, selectionRect.end.y),
        Math.abs(selectionRect.end.x - selectionRect.start.x),
        Math.abs(selectionRect.end.y - selectionRect.start.y)
      );
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, [entities, camera, showGrid, gridSize, tool, tempPoints, manualFusionMode, manualFusionEntities, showCuttingPath, selectionRect, rotationMode]);

  // ═══ Mouse handlers ═══
  const handleMouseDown = (e) => {
    const pos = screenToWorld(e.clientX, e.clientY);

    // Break at point mode
    if (breakMode && e.button === 0) {
      operations.breakAtPoint(pos);
      return;
    }

    // Scissors mode (cut between two points)
    if (scissorsMode && e.button === 0) {
      operations.scissorsClick(pos);
      return;
    }

    // Tab adding mode
    if ((tabMode || addingTab) && e.button === 0) {
      const index = entities.findIndex(en => { const ent = recreateEntity(en); return ent && ent.contains(pos, 5 / camera.zoom); });
      if (index >= 0) {
        const updated = [...entities];
        if (!updated[index].tabs) updated[index].tabs = [];
        updated[index].tabs.push({ x: pos.x, y: pos.y });
        setEntities(updated); addToHistory(updated);
        setTabMode(false); setAddingTab(false);
        showToast('✅ Pont ajouté', 'success');
      }
      return;
    }

    // Manual fusion mode
    if (manualFusionMode && e.button === 0) {
      const clickTolerance = 5 / camera.zoom;
      let closestEntity = null, closestDist = Infinity;
      for (const entity of entities) {
        let dist = Infinity;
        const e_entity = recreateEntity(entity);
        if (entity.type === 'line') dist = distanceToSegment(pos, e_entity.start, e_entity.end);
        else if (entity.type === 'arc') {
          const angle = Math.atan2(pos.y - e_entity.center.y, pos.x - e_entity.center.x);
          let na = angle, sa = e_entity.startAngle, ea = e_entity.endAngle;
          while (na < 0) na += 2 * Math.PI; while (sa < 0) sa += 2 * Math.PI; while (ea < 0) ea += 2 * Math.PI;
          let inAngle = sa > ea ? (na >= sa || na <= ea) : (na >= sa && na <= ea);
          if (inAngle) dist = Math.abs(distance(pos, e_entity.center) - e_entity.radius);
        } else if (entity.type === 'circle') dist = Math.abs(distance(pos, e_entity.center) - e_entity.radius);
        else if (entity.type === 'path') {
          let minD = Infinity;
          for (let i = 1; i < e_entity.points.length; i++) { const d = distanceToSegment(pos, e_entity.points[i-1], e_entity.points[i]); if (d < minD) minD = d; }
          dist = minD;
        }
        if (dist < clickTolerance && dist < closestDist) { closestDist = dist; closestEntity = entity; }
      }
      if (closestEntity && closestEntity.type === 'circle') { showToast('❌ Cercle détecté ! Utilisez ✂ Briser d\'abord.', 'error'); return; }
      if (closestEntity && !manualFusionEntities.some(en => en.id === closestEntity.id)) {
        setManualFusionEntities([...manualFusionEntities, closestEntity]);
        showToast('✅ Segment ' + (manualFusionEntities.length + 1) + ' ajouté', 'info');
      } else if (closestEntity) { showToast('⚠️ Segment déjà sélectionné', 'warning'); }
      return;
    }

    // Pan
    if (e.button === 1 || (e.button === 0 && spaceDown.current)) {
      setIsPanning(true); setDragStart({ x: e.clientX, y: e.clientY }); return;
    }

    if (tool === 'select') {
      const bbox = getSelectionBBox(entities);
      if (bbox && entities.some(en => en.selected)) {
        const pad = 10 / camera.zoom, hSize = 10 / camera.zoom;
        if (!rotationMode) {
          const corners = [
            { x: bbox.minX - pad, y: bbox.minY - pad, id: 'TL' }, { x: bbox.maxX + pad, y: bbox.minY - pad, id: 'TR' },
            { x: bbox.minX - pad, y: bbox.maxY + pad, id: 'BL' }, { x: bbox.maxX + pad, y: bbox.maxY + pad, id: 'BR' },
          ];
          for (const corner of corners) {
            if (Math.abs(pos.x - corner.x) < hSize && Math.abs(pos.y - corner.y) < hSize) { setScaleHandle({ corner: corner.id, bbox }); return; }
          }
        } else {
          const rotPad = 15 / camera.zoom;
          const corners = [
            { x: bbox.minX - rotPad, y: bbox.minY - rotPad, id: 'TL' }, { x: bbox.maxX + rotPad, y: bbox.minY - rotPad, id: 'TR' },
            { x: bbox.minX - rotPad, y: bbox.maxY + rotPad, id: 'BL' }, { x: bbox.maxX + rotPad, y: bbox.maxY + rotPad, id: 'BR' },
          ];
          for (const corner of corners) {
            if (Math.abs(pos.x - corner.x) < hSize * 1.5 && Math.abs(pos.y - corner.y) < hSize * 1.5) {
              const cx = (bbox.minX + bbox.maxX) / 2, cy = (bbox.minY + bbox.maxY) / 2;
              setRotationHandle({ corner: corner.id, bbox, center: { x: cx, y: cy }, startAngle: Math.atan2(pos.y - cy, pos.x - cx) });
              return;
            }
          }
        }
        const now = Date.now();
        if (now - lastClickTime < 300) { setRotationMode(!rotationMode); setLastClickTime(0); return; }
        setLastClickTime(now);
      }

      let foundHandle = false;
      for (let i = 0; i < entities.length; i++) {
        if (entities[i].leadIn && distance(entities[i].leadIn, pos) < 15 / camera.zoom) {
          setLeadInHandle({ entityIndex: i }); foundHandle = true; break;
        }
      }
      if (!foundHandle) {
        for (let i = 0; i < entities.length; i++) {
          if (entities[i].selected && entities[i].tabs) {
            for (let j = 0; j < entities[i].tabs.length; j++) {
              if (distance(entities[i].tabs[j], pos) < 15 / camera.zoom) { setTabHandle({ entityIndex: i, tabIndex: j }); foundHandle = true; break; }
            }
            if (foundHandle) break;
          }
        }
      }
      if (!foundHandle) {
        for (let i = 0; i < entities.length; i++) {
          if (entities[i].leadOut && distance(entities[i].leadOut, pos) < 15 / camera.zoom) {
            setLeadOutHandle({ entityIndex: i }); foundHandle = true; break;
          }
        }
      }
      if (!foundHandle) {
        for (let i = 0; i < entities.length; i++) {
          if (entities[i].selected) {
            const entity = recreateEntity(entities[i]);
            const handles = entity.getHandles();
            for (let j = 0; j < handles.length; j++) {
              if (distance(handles[j], pos) < 10 / camera.zoom) { setSelectedHandle({ entityIndex: i, handleIndex: j }); foundHandle = true; break; }
            }
            if (foundHandle) break;
          }
        }
      }
      if (!foundHandle) {
        let found = false, clickedIdx = -1;
        for (let i = 0; i < entities.length; i++) {
          const entity = recreateEntity(entities[i]);
          if (entity && entity.contains(pos, 3 / camera.zoom)) { found = true; clickedIdx = i; break; }
        }
        if (found) {
          const clicked = entities[clickedIdx];
          if (clicked.selected && !e.shiftKey) {
            setIsDragging(true); setDragStart(pos);
          } else {
            const newEntities = entities.map((data, i) => {
              if (i === clickedIdx) return { ...data, selected: true };
              return e.shiftKey ? data : { ...data, selected: false };
            });
            setEntities(newEntities);
            setIsDragging(true); setDragStart(pos);
          }
        } else {
          if (!e.shiftKey) {
            setEntities(entities.map(data => ({ ...data, selected: false })));
            setRotationMode(false);
          }
          setSelectionRect({ start: pos, end: pos });
        }
      }
    } else if (tool === 'pan') {
      setIsPanning(true); setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e) => {
    lastMousePos.current = { clientX: e.clientX, clientY: e.clientY };
    const pos = screenToWorld(e.clientX, e.clientY);

    if (isPanning && dragStart) {
      const dx = e.clientX - dragStart.x, dy = e.clientY - dragStart.y;
      setCamera({ ...camera, x: camera.x + dx, y: camera.y + dy });
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (tabHandle) {
      const updated = [...entities];
      updated[tabHandle.entityIndex].tabs[tabHandle.tabIndex] = { x: pos.x, y: pos.y };
      setEntities(updated);
      return;
    }

    if (scaleHandle) {
      const newEntities = scaleSelectedEntities(entities, scaleHandle.bbox, scaleHandle.corner, pos);
      setEntities(newEntities);
      const newBbox = getSelectionBBox(newEntities);
      if (newBbox) setScaleHandle({ ...scaleHandle, bbox: newBbox });
      return;
    }

    if (rotationHandle) {
      const currentAngle = Math.atan2(pos.y - rotationHandle.center.y, pos.x - rotationHandle.center.x);
      const angleDelta = currentAngle - rotationHandle.startAngle;
      const newEntities = rotateSelectedEntities(entities, rotationHandle.center, angleDelta);
      setEntities(newEntities);
      setRotationHandle({ ...rotationHandle, startAngle: currentAngle });
      return;
    }

    if (selectedHandle !== null) {
      const newEntities = [...entities];
      const entity = recreateEntity(newEntities[selectedHandle.entityIndex]);
      entity.moveHandle(selectedHandle.handleIndex, pos);
      newEntities[selectedHandle.entityIndex] = JSON.parse(JSON.stringify(entity));
      setEntities(newEntities);
    } else if (leadInHandle !== null) {
      const newEntities = [...entities];
      newEntities[leadInHandle.entityIndex] = { ...newEntities[leadInHandle.entityIndex], leadIn: { x: pos.x, y: pos.y } };
      setEntities(newEntities);
    } else if (leadOutHandle !== null) {
      const newEntities = [...entities];
      newEntities[leadOutHandle.entityIndex] = { ...newEntities[leadOutHandle.entityIndex], leadOut: { x: pos.x, y: pos.y } };
      setEntities(newEntities);
    } else if (selectionRect) {
      setSelectionRect({ ...selectionRect, end: pos });
    } else if (isDragging && tool === 'select' && dragStart) {
      const dx = pos.x - dragStart.x, dy = pos.y - dragStart.y;
      const newEntities = entities.map(data => {
        if (!data.selected) return data;
        const entity = recreateEntity(data);
        if (!entity) return data;
        entity.move(dx, dy);
        return JSON.parse(JSON.stringify(entity));
      });
      setEntities(newEntities);
      setDragStart(pos);
    }

    if (tool === 'freeform' && tempPoints.length === 1 && isDragging) {
      setTempPoints([tempPoints[0], pos]);
    }
    if (tempPoints.length > 0 && tool === 'line') {
      setMeasurements(`Longueur: ${distance(tempPoints[0], pos).toFixed(2)} mm`);
    }
  };

  const handleMouseUp = () => {
    if (tabHandle) { addToHistory(entities); setTabHandle(null); }

    if (selectionRect) {
      const minX = Math.min(selectionRect.start.x, selectionRect.end.x);
      const maxX = Math.max(selectionRect.start.x, selectionRect.end.x);
      const minY = Math.min(selectionRect.start.y, selectionRect.end.y);
      const maxY = Math.max(selectionRect.start.y, selectionRect.end.y);
      const newEntities = entities.map(data => {
        const entity = recreateEntity(data);
        if (!entity) return data;
        let inRect = false;
        if (entity.type === 'line') inRect = (entity.start.x >= minX && entity.start.x <= maxX && entity.start.y >= minY && entity.start.y <= maxY) || (entity.end.x >= minX && entity.end.x <= maxX && entity.end.y >= minY && entity.end.y <= maxY);
        else if (entity.type === 'circle' || entity.type === 'arc') inRect = entity.center.x >= minX && entity.center.x <= maxX && entity.center.y >= minY && entity.center.y <= maxY;
        else if (entity.type === 'rectangle') inRect = entity.topLeft.x >= minX && entity.topLeft.x <= maxX && entity.topLeft.y >= minY && entity.topLeft.y <= maxY;
        else if (entity.type === 'path') inRect = entity.points.some(p => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY);
        return { ...data, selected: inRect || data.selected };
      });
      setEntities(newEntities);
      setSelectionRect(null);
    }

    if (scaleHandle) { addToHistory(entities); setScaleHandle(null); }
    else if (rotationHandle) { addToHistory(entities); setRotationHandle(null); }
    else if (leadInHandle !== null) { addToHistory(entities); setLeadInHandle(null); }
    else if (leadOutHandle !== null) { addToHistory(entities); setLeadOutHandle(null); }
    else if (selectedHandle !== null) { addToHistory(entities); setSelectedHandle(null); }
    else if (isDragging && tool === 'select' && dragStart) { addToHistory(entities); }

    if (tool === 'freeform' && tempPoints.length > 0 && isDragging && dragStart) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const endPos = screenToWorld(lastMousePos.current?.clientX || rect.left + rect.width / 2, lastMousePos.current?.clientY || rect.top + rect.height / 2);
      const start = tempPoints[0];
      const size = Math.max(Math.abs(endPos.x - start.x), Math.abs(endPos.y - start.y));
      if (size > 5) {
        const topLeft = { x: Math.min(start.x, endPos.x), y: Math.min(start.y, endPos.y) };
        const freeform = FreeformEntity.createSquare(topLeft, size);
        freeform.selected = true;
        const updated = [...entities.map(e => ({ ...e, selected: false })), JSON.parse(JSON.stringify(freeform))];
        setEntities(updated); addToHistory(updated);
      }
      setTempPoints([]);
    }

    setIsDragging(false); setIsPanning(false); setDragStart(null);
  };

  const handleClick = (e) => {
    if (isDragging || tool === 'select' || tool === 'pan') return;
    const pos = screenToWorld(e.clientX, e.clientY);

    if (tool === 'line') {
      if (tempPoints.length === 0) setTempPoints([pos]);
      else {
        const newLine = new LineEntity(tempPoints[0], pos);
        const updated = [...entities, JSON.parse(JSON.stringify(newLine))];
        setEntities(updated); addToHistory(updated); setTempPoints([]); setMeasurements(null);
      }
    } else if (tool === 'arc') {
      if (tempPoints.length === 0) setTempPoints([pos]);
      else if (tempPoints.length === 1) setTempPoints([...tempPoints, pos]);
      else if (tempPoints.length === 2) {
        const arc = ArcEntity.fromThreePoints(tempPoints[0], tempPoints[1], pos);
        if (arc) { const updated = [...entities, JSON.parse(JSON.stringify(arc))]; setEntities(updated); addToHistory(updated); }
        setTempPoints([]);
      }
    } else if (tool === 'rectangle') {
      setDialogTitle('Créer un rectangle'); setDialogInputs({ width: 100, height: 100 });
      setDialogPosition(pos); setDialogOptions(null);
      setDialogCallback(() => (values) => {
        const rect = new RectangleEntity(pos, values.width, values.height);
        const updated = [...entities, JSON.parse(JSON.stringify(rect))];
        setEntities(updated); addToHistory(updated); setDialogOpen(false);
      });
      setDialogOpen(true);
    } else if (tool === 'circle') {
      setDialogTitle('Créer un cercle'); setDialogInputs({ diameter: 100 });
      setDialogPosition(pos); setDialogOptions(null);
      setDialogCallback(() => (values) => {
        const circle = new CircleEntity(pos, values.diameter / 2);
        const updated = [...entities, JSON.parse(JSON.stringify(circle))];
        setEntities(updated); addToHistory(updated); setDialogOpen(false);
      });
      setDialogOpen(true);
    } else if (tool === 'text') {
      setDialogTitle('Ajouter du texte');
      setDialogInputs({ text: 'TEST', fontSize: 100, fontFamily: 'Roboto', arcRadius: 0 });
      setDialogPosition(pos); setDialogOptions(null);
      setDialogCallback(() => (values) => {
        const textEntity = new TextEntity(pos, values.text, values.fontSize, values.fontFamily, values.arcRadius);
        const updated = [...entities, JSON.parse(JSON.stringify(textEntity))];
        setEntities(updated); addToHistory(updated); setDialogOpen(false);
      });
      setDialogOpen(true);
    } else if (tool === 'freeform') {
      setTempPoints([pos]); setIsDragging(true); setDragStart(pos);
    }
  };

  // ═══ Zoom ═══
  const handleWheel = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - canvas.offsetWidth / 2 - camera.x) / camera.zoom;
    const mouseY = (e.clientY - rect.top - canvas.offsetHeight / 2 - camera.y) / camera.zoom;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.02, Math.min(100, camera.zoom * delta));
    setCamera({ x: camera.x - mouseX * (newZoom - camera.zoom), y: camera.y - mouseY * (newZoom - camera.zoom), zoom: newZoom });
  };

  const zoomIn = () => setCamera({ ...camera, zoom: Math.min(10, camera.zoom * 1.2) });
  const zoomOut = () => setCamera({ ...camera, zoom: Math.max(0.1, camera.zoom / 1.2) });
  const resetView = () => setCamera({ x: 0, y: 0, zoom: 1 });

  // ═══ Keyboard shortcuts ═══
  stateRef.current = {
    entities, dialogOpen, operations, historyIndex, history, tool,
    manualFusionMode, setManualFusionMode, setManualFusionPoints, setManualFusionEntities,
    setTempPoints, setTool, setDialogOpen, showToast, setEntities, addToHistory,
    setBreakMode, setScissorsMode, setScissorsFirst,
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const s = stateRef.current;
      const activeTag = document.activeElement?.tagName;
      const inInput = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT';

      if (!s.dialogOpen && !e.ctrlKey && !e.altKey && !e.metaKey && !inInput) {
        if (e.key === 's' || e.key === 'S') { e.preventDefault(); s.setTool('select'); }
        else if (e.key === 'l' || e.key === 'L') { e.preventDefault(); s.setTool('line'); }
        else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); s.setTool('rectangle'); }
        else if (e.key === 'c' || e.key === 'C') { e.preventDefault(); s.setTool('circle'); }
        else if (e.key === 't' || e.key === 'T') { e.preventDefault(); s.setTool('text'); }
        else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); s.setTool('freeform'); }
      }

      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
      else if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
      else if (e.key === 'Delete' && !inInput) {
        e.preventDefault();
        const newEntities = s.entities.filter(en => !en.selected);
        s.setEntities(newEntities); s.addToHistory(newEntities);
      } else if (e.ctrlKey && e.key === 'b') { e.preventDefault(); s.operations.breakAtIntersection(); }
      else if ((e.key === 'x' || e.key === 'X') && !e.ctrlKey && !s.dialogOpen && !inInput) {
        e.preventDefault(); s.operations.explodePath();
      } else if ((e.key === 'o' || e.key === 'O') && !e.ctrlKey && !s.dialogOpen && !inInput) {
        e.preventDefault(); s.operations.parallelOffset();
      } else if ((e.key === 'd' || e.key === 'D') && !inInput) {
        e.preventDefault();
        const selected = s.entities.filter(en => en.selected);
        if (selected.length > 0) {
          const duplicated = selected.map(ent => {
            const copy = JSON.parse(JSON.stringify(ent));
            copy.id = Math.random().toString(36).substr(2, 9); copy.selected = false;
            if (copy.type === 'line') { copy.start.x += 10; copy.start.y += 10; copy.end.x += 10; copy.end.y += 10; }
            else if (copy.type === 'rectangle') { copy.topLeft.x += 10; copy.topLeft.y += 10; }
            else if (copy.type === 'circle' || copy.type === 'arc') { copy.center.x += 10; copy.center.y += 10; }
            else if (copy.type === 'path') { copy.points = copy.points.map(p => ({ x: p.x + 10, y: p.y + 10 })); }
            else if (copy.type === 'text' && copy.position) { copy.position.x += 10; copy.position.y += 10; }
            else if (copy.type === 'freeform') { copy.controlPoints = copy.controlPoints.map(p => ({ x: p.x + 10, y: p.y + 10 })); }
            return copy;
          });
          const updated = [...s.entities.map(en => ({ ...en, selected: false })), ...duplicated];
          s.setEntities(updated); s.addToHistory(updated);
          s.showToast(`✅ ${selected.length} entité(s) dupliquée(s)`, 'success');
        }
      } else if (e.key === 'Escape') {
        if (s.manualFusionMode) {
          s.setManualFusionMode(false); s.setManualFusionPoints([]); s.setManualFusionEntities([]);
          s.showToast('❌ Fusion annulée', 'warning');
        } else {
          s.setTempPoints([]); s.setTool('select'); s.setDialogOpen(false); s.setBreakMode(false); s.setScissorsMode(false); s.setScissorsFirst(null);
        }
      } else if (e.key === 'Enter' && s.manualFusionMode) {
        e.preventDefault(); s.operations.finishManualFusion();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Space key tracking
  useEffect(() => {
    const onKeyDown = (e) => { if (e.code === 'Space' && !e.repeat) spaceDown.current = true; };
    const onKeyUp = (e) => { if (e.code === 'Space') spaceDown.current = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, []);

  const handleImportDXF = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => operations.importDXF(event.target.result);
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  return (
    <div className="w-full h-screen bg-zinc-950 flex flex-col overflow-hidden font-mono">
      <Toolbar
        tool={tool} setTool={setTool}
        camera={camera}
        showGrid={showGrid} setShowGrid={setShowGrid}
        gridSnap={gridSnap} setGridSnap={setGridSnap}
        showCuttingPath={showCuttingPath} setShowCuttingPath={setShowCuttingPath}
        historyIndex={historyIndex} historyLength={history.length}
        entityCount={entities.length}
        actions={{
          ...operations, undo, redo, zoomIn, zoomOut, resetView,
          setAddingTab,
        }}
        onImportDXF={handleImportDXF}
        onSimulation={() => setSimulationOpen(true)}
        kerfWidth={kerfWidth} setKerfWidth={setKerfWidth}
      />

      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleClick}
          onWheel={handleWheel}
        />

        <div className="absolute top-4 left-4 bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-lg p-3 text-xs text-zinc-300 font-mono">
          <div className="font-bold text-cyan-400 mb-2">NPFCut Pro</div>
          <div>Outil: <span className="text-yellow-400">{tool}</span></div>
          <div>Grille: {gridSize} mm</div>
          <div>Zoom: <span className="text-green-400">{Math.round(camera.zoom * 100)}%</span></div>
          {measurements && <div className="text-orange-400">{measurements}</div>}
          <div className="mt-2 pt-2 border-t border-zinc-700">
            <div className="text-red-400 font-bold">⊕ DÉPART (0,0)</div>
          </div>
          <div className="mt-2 pt-2 border-t border-zinc-700 text-zinc-500">
            <div>S - Sélection | L - Ligne | R - Rectangle</div>
            <div>C - Cercle | T - Texte | F - Forme libre</div>
            <div>X - Éclater | D - Dupliquer | Suppr - Effacer</div>
            <div>Ctrl+Z - Annuler | Ctrl+Y - Refaire</div>
            <div>Ctrl+B - Briser | Éspace+clic - Pan</div>
            <div className="text-cyan-400">Molette - Zoom</div>
          </div>
        </div>
      </div>

      {manualFusionMode && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-yellow-600 px-6 py-4 rounded-lg shadow-2xl text-white z-50">
          <div className="font-bold text-lg mb-2">Mode Fusion Manuelle</div>
          <div className="text-sm mb-3">
            Cliquez sur les segments dans l'ordre. {manualFusionEntities.length} segment(s) sélectionné(s).
          </div>
          <div className="flex gap-2">
            <button onClick={operations.finishManualFusion} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-bold text-sm">✓ Terminer</button>
            <button onClick={() => { setManualFusionMode(false); setManualFusionPoints([]); setManualFusionEntities([]); showToast('❌ Fusion annulée', 'warning'); }} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-bold text-sm">✕ Annuler</button>
          </div>
          <div className="text-xs mt-2 opacity-75">ESC = annuler | Entrée = terminer</div>
        </div>
      )}

      <Dialog
        dialogOpen={dialogOpen} dialogTitle={dialogTitle} dialogInputs={dialogInputs}
        dialogOptions={dialogOptions} dialogCallback={dialogCallback}
        setDialogOpen={setDialogOpen} setDialogInputs={setDialogInputs}
      />

      <GcodeModal
        gcode={gcodePreview}
        onClose={() => setGcodePreview(null)}
        showToast={showToast}
      />

      {simulationOpen && (
        <SimulationModal
          entities={entities}
          onClose={() => setSimulationOpen(false)}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}
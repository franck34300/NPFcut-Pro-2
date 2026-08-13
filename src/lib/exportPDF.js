import { jsPDF } from 'jspdf';
import { recreateEntity } from './entities/recreateEntity';
import { generateCutPathData } from './simulation';

// Génère un PDF du plan de découpe avec les cotes principales (dimensions hors-tout,
// diamètres des cercles, dimensions des rectangles, longueurs des lignes).
export function exportDrawingPDF(entities) {
  if (!entities || entities.length === 0) {
    throw new Error('Aucune entité à exporter');
  }

  const pieces = generateCutPathData(entities);
  if (pieces.length === 0) {
    throw new Error('Aucune forme valide à dessiner');
  }

  // Bounding box globale du dessin (en mm, unités du dessin)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  pieces.forEach(piece => {
    piece.points.forEach(p => {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    });
  });
  const drawingW = maxX - minX || 1;
  const drawingH = maxY - minY || 1;

  // Orientation de page selon le ratio du dessin
  const landscape = drawingW >= drawingH;
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: landscape ? 'landscape' : 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const marginTop = 70;
  const marginSide = 50;
  const marginBottom = 60;
  const areaW = pageW - marginSide * 2;
  const areaH = pageH - marginTop - marginBottom;

  // Échelle pour que le dessin (+ un peu de marge pour les cotes) tienne dans la zone dispo
  const scale = Math.min(areaW / (drawingW * 1.25), areaH / (drawingH * 1.25));
  const offsetX = marginSide + (areaW - drawingW * scale) / 2;
  const offsetY = marginTop + (areaH - drawingH * scale) / 2;

  const toPdf = (p) => ({
    x: offsetX + (p.x - minX) * scale,
    y: offsetY + (p.y - minY) * scale,
  });

  // ── En-tête ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(8, 145, 178);
  doc.text('NPFCut Pro — Plan de découpe', marginSide, 32);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  const dateStr = new Date().toLocaleDateString('fr-FR');
  doc.text(`Généré le ${dateStr}`, marginSide, 48);
  doc.text(`${entities.length} entité(s) — Dimensions hors-tout : ${drawingW.toFixed(1)} × ${drawingH.toFixed(1)} mm`, marginSide, 60);

  // ── Dessin des pièces ──
  doc.setDrawColor(8, 145, 178);
  doc.setLineWidth(1);
  pieces.forEach(piece => {
    const pts = piece.points.map(toPdf);
    for (let i = 1; i < pts.length; i++) {
      doc.line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
    }
  });

  // ── Cotes hors-tout (largeur en bas, hauteur à gauche) ──
  doc.setDrawColor(234, 88, 12);
  doc.setLineWidth(0.75);
  doc.setFontSize(9);
  doc.setTextColor(234, 88, 12);

  const dimOffsetBottom = offsetY + drawingH * scale + 22;
  doc.line(offsetX, dimOffsetBottom, offsetX + drawingW * scale, dimOffsetBottom);
  doc.line(offsetX, dimOffsetBottom - 4, offsetX, dimOffsetBottom + 4);
  doc.line(offsetX + drawingW * scale, dimOffsetBottom - 4, offsetX + drawingW * scale, dimOffsetBottom + 4);
  doc.text(`${drawingW.toFixed(1)} mm`, offsetX + (drawingW * scale) / 2, dimOffsetBottom + 14, { align: 'center' });

  const dimOffsetLeft = offsetX - 22;
  doc.line(dimOffsetLeft, offsetY, dimOffsetLeft, offsetY + drawingH * scale);
  doc.line(dimOffsetLeft - 4, offsetY, dimOffsetLeft + 4, offsetY);
  doc.line(dimOffsetLeft - 4, offsetY + drawingH * scale, dimOffsetLeft + 4, offsetY + drawingH * scale);
  doc.text(`${drawingH.toFixed(1)} mm`, dimOffsetLeft - 6, offsetY + (drawingH * scale) / 2, { align: 'center', angle: 90 });

  // ── Cotes par entité (cercles, rectangles, lignes) ──
  doc.setFontSize(7.5);
  doc.setTextColor(24, 24, 27);
  entities.forEach((data) => {
    const entity = recreateEntity(data);
    if (!entity) return;
    if (entity.type === 'circle') {
      const c = toPdf(entity.center);
      doc.text(`⌀${(entity.radius * 2).toFixed(1)}`, c.x, c.y, { align: 'center' });
    } else if (entity.type === 'rectangle') {
      const p = toPdf({ x: entity.topLeft.x + entity.width / 2, y: entity.topLeft.y + entity.height / 2 });
      doc.text(`${entity.width.toFixed(1)} × ${entity.height.toFixed(1)}`, p.x, p.y, { align: 'center' });
    } else if (entity.type === 'line') {
      const len = Math.hypot(entity.end.x - entity.start.x, entity.end.y - entity.start.y);
      if (len >= 5) {
        const mid = toPdf({ x: (entity.start.x + entity.end.x) / 2, y: (entity.start.y + entity.end.y) / 2 });
        doc.text(`${len.toFixed(1)}`, mid.x, mid.y - 3, { align: 'center' });
      }
    }
  });

  // ── Échelle indicative en pied de page ──
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Échelle approximative : 1:${(1 / scale * 2.8346).toFixed(1)} (à titre indicatif — se référer aux cotes)`, marginSide, pageH - 20);

  doc.save(`NPFCut_Pro_Plan_${Date.now()}.pdf`);
}

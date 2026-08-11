import { useState, useRef, useEffect, useCallback } from 'react';
import { generateCutPathData, pathLength } from '@/lib/simulation';
import { Play, Pause, SkipBack, SkipForward, X, Gauge } from 'lucide-react';

export default function SimulationModal({ entities, onClose }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const [pieces, setPieces] = useState([]);
  const [playing, setPlaying] = useState(false);
  const [currentPieceIdx, setCurrentPieceIdx] = useState(0);
  const [progress, setProgress] = useState(0); // 0..1 within current piece
  const [speed, setSpeed] = useState(1);
  const stateRef = useRef({ pieceIdx: 0, progress: 0, lastTime: 0 });

  // Initialize pieces
  useEffect(() => {
    if (entities && entities.length > 0) {
      setPieces(generateCutPathData(entities));
    }
  }, [entities]);

  // Auto-fit view
  const fitView = useCallback((pieces) => {
    if (pieces.length === 0) return { minX: 0, minY: 0, scale: 1, w: 100, h: 100 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pieces.forEach(p => {
      p.points.forEach(pt => {
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
      });
    });
    const w = maxX - minX || 1;
    const h = maxY - minY || 1;
    const canvas = canvasRef.current;
    const cw = canvas ? canvas.width - 80 : 800;
    const ch = canvas ? canvas.height - 80 : 600;
    const scale = Math.min(cw / w, ch / h);
    return { minX, minY, scale, w, h };
  }, []);

  // Draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    if (pieces.length === 0) return;

    const view = fitView(pieces);
    const ox = W / 2 - (view.minX + view.w / 2) * view.scale;
    const oy = H / 2 - (view.minY + view.h / 2) * view.scale;
    const toScreen = (p) => ({
      x: ox + p.x * view.scale,
      y: oy + p.y * view.scale
    });

    // Draw all pieces dimmed
    pieces.forEach((piece, idx) => {
      const isCurrent = idx === stateRef.current.pieceIdx;
      ctx.strokeStyle = isCurrent ? piece.color : '#333333';
      ctx.lineWidth = isCurrent ? 1.5 : 0.8;
      ctx.beginPath();
      piece.points.forEach((pt, k) => {
        const s = toScreen(pt);
        if (k === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      ctx.stroke();
    });

    // Draw direction arrows and piece numbers for current piece
    const currentPiece = pieces[stateRef.current.pieceIdx];
    if (currentPiece) {
      // Draw piece number at start point
      const startScreen = toScreen(currentPiece.points[0]);
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.beginPath();
      ctx.arc(startScreen.x, startScreen.y, 14, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(251, 191, 36, 0.9)';
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.fillText(String(currentPiece.index), startScreen.x, startScreen.y);

      // Draw direction arrows along the path
      const arrowSpacing = 5;
      ctx.strokeStyle = '#22d3ee';
      ctx.fillStyle = '#22d3ee';
      ctx.lineWidth = 1;
      for (let k = 0; k < currentPiece.points.length - 1; k += arrowSpacing) {
        const p1 = toScreen(currentPiece.points[k]);
        const p2 = toScreen(currentPiece.points[Math.min(k + 1, currentPiece.points.length - 1)]);
        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const size = 5;
        ctx.beginPath();
        ctx.moveTo(mid.x, mid.y);
        ctx.lineTo(
          mid.x - size * Math.cos(angle - Math.PI / 6),
          mid.y - size * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          mid.x - size * Math.cos(angle + Math.PI / 6),
          mid.y - size * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      }
    }

    // Draw the "already cut" path (all previous pieces + current progress)
    ctx.strokeStyle = '#2dd4bf';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let pi = 0; pi <= stateRef.current.pieceIdx; pi++) {
      const piece = pieces[pi];
      if (!piece) continue;
      const maxIdx = pi < stateRef.current.pieceIdx
        ? piece.points.length
        : Math.floor(stateRef.current.progress * (piece.points.length - 1)) + 1;
      for (let k = 0; k < maxIdx && k < piece.points.length; k++) {
        const s = toScreen(piece.points[k]);
        if (pi === 0 && k === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      }
    }
    ctx.stroke();

    // Draw tool indicator
    if (currentPiece && stateRef.current.progress > 0) {
      const pts = currentPiece.points;
      const totalSegments = pts.length - 1;
      const floatIdx = stateRef.current.progress * totalSegments;
      const segIdx = Math.min(Math.floor(floatIdx), totalSegments - 1);
      const t = floatIdx - segIdx;
      const p1 = pts[segIdx];
      const p2 = pts[segIdx + 1] || p1;
      const toolPos = {
        x: p1.x + (p2.x - p1.x) * t,
        y: p1.y + (p2.y - p1.y) * t
      };
      const ts = toScreen(toolPos);
      // Glow
      ctx.beginPath();
      ctx.arc(ts.x, ts.y, 10, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(45, 212, 191, 0.2)';
      ctx.fill();
      // Tool
      ctx.beginPath();
      ctx.arc(ts.x, ts.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = '#2dd4bf';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Draw piece numbers for all pieces (small)
    pieces.forEach((piece, idx) => {
      if (idx === stateRef.current.pieceIdx) return;
      const s = toScreen(piece.points[0]);
      ctx.beginPath();
      ctx.arc(s.x, s.y, 8, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(63, 63, 70, 0.8)';
      ctx.fill();
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.fillStyle = '#999';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(piece.index), s.x, s.y);
    });
  }, [pieces, fitView]);

  // Animation loop
  useEffect(() => {
    if (!playing || pieces.length === 0) return;
    stateRef.current.lastTime = performance.now();
    const animate = (now) => {
      const dt = (now - stateRef.current.lastTime) / 1000;
      stateRef.current.lastTime = now;
      const piece = pieces[stateRef.current.pieceIdx];
      if (!piece) { setPlaying(false); return; }
      const len = pathLength(piece.points);
      const speedPerSec = 50 * speed; // mm per second
      stateRef.current.progress += (speedPerSec * dt) / Math.max(len, 0.01);
      if (stateRef.current.progress >= 1) {
        stateRef.current.progress = 1;
        if (stateRef.current.pieceIdx < pieces.length - 1) {
          stateRef.current.pieceIdx++;
          stateRef.current.progress = 0;
          setCurrentPieceIdx(stateRef.current.pieceIdx);
          setProgress(0);
        } else {
          setPlaying(false);
        }
      } else {
        setProgress(stateRef.current.progress);
      }
      draw();
      if (playing) animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [playing, pieces, speed, draw]);

  // Redraw when not playing
  useEffect(() => { draw(); }, [draw, currentPieceIdx, progress]);

  const handlePlayPause = () => {
    if (stateRef.current.pieceIdx >= pieces.length - 1 && stateRef.current.progress >= 1) {
      stateRef.current.pieceIdx = 0;
      stateRef.current.progress = 0;
      setCurrentPieceIdx(0);
      setProgress(0);
    }
    setPlaying(p => !p);
  };

  const handleReset = () => {
    setPlaying(false);
    stateRef.current.pieceIdx = 0;
    stateRef.current.progress = 0;
    setCurrentPieceIdx(0);
    setProgress(0);
  };

  const handleNext = () => {
    setPlaying(false);
    stateRef.current.pieceIdx = Math.min(stateRef.current.pieceIdx + 1, pieces.length - 1);
    stateRef.current.progress = 0;
    setCurrentPieceIdx(stateRef.current.pieceIdx);
    setProgress(0);
  };

  const handlePrev = () => {
    setPlaying(false);
    stateRef.current.progress = 0;
    stateRef.current.pieceIdx = Math.max(stateRef.current.pieceIdx - 1, 0);
    setCurrentPieceIdx(stateRef.current.pieceIdx);
    setProgress(0);
  };

  // Resize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [draw]);

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-5xl h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 text-lg font-bold">🎬 Simulation Parcours de Découpe</span>
          </div>
          <button onClick={onClose} className="p-1.5 bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden">
          <canvas ref={canvasRef} className="w-full h-full" />
          {pieces.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-sm">
              Aucune entité à simuler. Importez un dessin d'abord.
            </div>
          )}
          {/* Info overlay */}
          {pieces.length > 0 && (
            <div className="absolute top-3 left-3 bg-zinc-900/90 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono">
              <div className="text-cyan-400 font-bold mb-1">Pièce {currentPieceIdx + 1} / {pieces.length}</div>
              <div>Progression: {(progress * 100).toFixed(0)}%</div>
              <div className="text-zinc-500 mt-1">🟢 = tool | 🔵 = sens | 🔢 = ordre</div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="px-4 py-3 border-t border-zinc-800 flex items-center gap-3">
          <button onClick={handlePrev} disabled={currentPieceIdx === 0} className="p-2 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 disabled:opacity-30 transition-colors">
            <SkipBack size={18} />
          </button>
          <button onClick={handlePlayPause} disabled={pieces.length === 0} className="p-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 disabled:opacity-30 transition-colors">
            {playing ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button onClick={handleNext} disabled={currentPieceIdx >= pieces.length - 1} className="p-2 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 disabled:opacity-30 transition-colors">
            <SkipForward size={18} />
          </button>
          <button onClick={handleReset} className="px-3 py-2 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 text-xs font-bold transition-colors">
            Reset
          </button>

          {/* Progress bar */}
          <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-500 transition-all"
              style={{ width: `${pieces.length > 0 ? ((currentPieceIdx + progress) / pieces.length) * 100 : 0}%` }}
            />
          </div>

          {/* Speed */}
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Gauge size={16} />
            <input
              type="range"
              min="0.25" max="5" step="0.25"
              value={speed}
              onChange={e => setSpeed(parseFloat(e.target.value))}
              className="w-20 accent-cyan-500"
            />
            <span className="text-cyan-400 font-mono w-8">{speed}x</span>
          </div>
        </div>
      </div>
    </div>
  );
}
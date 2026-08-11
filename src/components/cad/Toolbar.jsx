import {
  Move, Maximize2, Minus, Plus, Square, Circle as CircleIcon,
  Grid, Download, Upload, Save, Undo2, Redo2, Scissors, Play, BookOpen,
} from 'lucide-react';
import { generateManual } from '@/lib/generateManual';

export default function Toolbar({
  tool, setTool,
  camera,
  showGrid, setShowGrid,
  gridSnap, setGridSnap,
  showCuttingPath, setShowCuttingPath,
  historyIndex, historyLength, entityCount,
  actions,
  onImportDXF,
  onSimulation,
  kerfWidth, setKerfWidth,
}) {
  const btn = (active, extra) =>
    `p-2 rounded transition-colors ${active ? 'bg-cyan-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'} ${extra || ''}`;
  const btnSm = (color, hover) =>
    `px-2 py-2 ${color} ${hover} text-white rounded font-bold transition-colors text-xs`;

  return (
    <div className="bg-zinc-900 border-b border-zinc-800 p-2 flex items-center gap-2 flex-wrap">
      {/* Tools */}
      <div className="flex items-center gap-1 border-r border-zinc-700 pr-2">
        <button onClick={() => setTool('select')} className={btn(tool === 'select')} title="Sélection (S)"><Move size={18} /></button>
        <button onClick={() => setTool('pan')} className={btn(tool === 'pan')} title="Déplacer la vue"><Maximize2 size={18} /></button>
      </div>

      <div className="flex items-center gap-1 border-r border-zinc-700 pr-2">
        <button onClick={() => setTool('line')} className={btn(tool === 'line')} title="Ligne (L)"><Minus size={18} /></button>
        <button onClick={() => setTool('rectangle')} className={btn(tool === 'rectangle')} title="Rectangle (R)"><Square size={18} /></button>
        <button onClick={() => setTool('circle')} className={btn(tool === 'circle')} title="Cercle (C)"><CircleIcon size={18} /></button>
        <button onClick={() => setTool('arc')} className={`px-3 py-2 rounded font-bold transition-colors ${tool === 'arc' ? 'bg-cyan-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`} title="Arc 3 points">⌒</button>
        <button onClick={() => setTool('text')} className={`px-3 py-2 rounded font-bold transition-colors ${tool === 'text' ? 'bg-cyan-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`} title="Texte (T)">A</button>
        <button onClick={() => setTool('freeform')} className={`px-3 py-2 rounded font-bold transition-colors ${tool === 'freeform' ? 'bg-cyan-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`} title="Forme Libre (F)">📐</button>
      </div>

      {/* Modify */}
      <div className="flex items-center gap-1 border-r border-zinc-700 pr-2">
        <button onClick={actions.createBisector} className={btnSm('bg-yellow-600', 'hover:bg-yellow-700')} title="Bissectrice">∠ ÷2</button>
        <button onClick={actions.extendLines} className={btnSm('bg-green-600', 'hover:bg-green-700')} title="Prolonger lignes">⟿</button>
        <button onClick={actions.breakAtIntersection} className="px-3 py-2 bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700 transition-colors font-bold text-xs" title="Briser aux intersections (Ctrl+B)"><Scissors size={14} /></button>
        <button onClick={actions.groupLinesIntoPaths} className="px-3 py-2 bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700 transition-colors font-bold text-xs" title="Regrouper lignes en contours">🔗</button>
        <button onClick={actions.mirrorHorizontal} className={btnSm('bg-blue-600', 'hover:bg-blue-700')} title="Miroir ↕">↕</button>
        <button onClick={actions.mirrorVertical} className={btnSm('bg-blue-600', 'hover:bg-blue-700')} title="Miroir ↔">↔</button>
        <button onClick={actions.arrayRectangular} className={btnSm('bg-purple-600', 'hover:bg-purple-700')} title="Array grille">⊞</button>
        <button onClick={actions.arrayCircular} className={btnSm('bg-purple-600', 'hover:bg-purple-700')} title="Array circulaire">⭯</button>
        <button onClick={actions.addTabs} className={btnSm('bg-red-600', 'hover:bg-red-700')} title="Ponts">🔲</button>
        <button onClick={actions.fusionLignes} className={btnSm('bg-cyan-600', 'hover:bg-cyan-700')} title="Fusion Lignes">🔗 L</button>
        <button onClick={actions.startManualFusion} className={btnSm('bg-yellow-600', 'hover:bg-yellow-700')} title="Fusion Manuelle">🔗 M</button>
        <button onClick={actions.extractOuterContour} className={btnSm('bg-green-600', 'hover:bg-green-700')} title="Contour Externe">🔲 Ext</button>
        <button onClick={actions.mergeToSinglePath} className="px-3 py-2 bg-orange-700 text-white rounded hover:bg-orange-600 transition-colors font-bold text-xs" title="Fusionner en 1 contour">⛓️</button>
        <button onClick={actions.joinSelectedPaths} className={btnSm('bg-cyan-700', 'hover:bg-cyan-600')} title="Joindre 2 contours ouverts (ligne/chemin ouvert)">🔗 J</button>
        <button onClick={actions.startBreakAtPoint} className={btnSm('bg-orange-600', 'hover:bg-orange-700')} title="Briser au point (cliquer le contour)">✂ Briser</button>
        <button onClick={actions.startScissors} className={btnSm('bg-rose-600', 'hover:bg-rose-700')} title="Ciseaux: couper entre 2 points (cliquer 2x le contour)">✂️ Ciseaux</button>
        <button onClick={actions.addLeadIns} className={btnSm('bg-blue-600', 'hover:bg-blue-700')} title="Ajouter entrées (Lead-In)">↘️ IN</button>
        <button onClick={() => actions.setAddingTab(true)} className={btnSm('bg-green-600', 'hover:bg-green-700')} title="Ajouter un pont">➕ PONT</button>
        <button onClick={actions.removeLeadIns} className={btnSm('bg-red-600', 'hover:bg-red-700')} title="Supprimer entrées">✕ IN</button>
        <button onClick={actions.addLeadOuts} className={btnSm('bg-blue-600', 'hover:bg-blue-700')} title="Ajouter sorties (Lead-Out)">↗️ OUT</button>
        <button onClick={actions.removeLeadOuts} className={btnSm('bg-red-600', 'hover:bg-red-700')} title="Supprimer sorties">✕ OUT</button>
        <button onClick={actions.sortEntitiesInsideOut} className={btnSm('bg-purple-600', 'hover:bg-purple-700')} title="Trier intérieur → extérieur">🎯 Tri</button>
        <button onClick={() => setShowCuttingPath(!showCuttingPath)} className={`px-3 py-2 text-white rounded font-bold transition-colors text-xs ${showCuttingPath ? 'bg-cyan-600 hover:bg-cyan-700' : 'bg-zinc-700 hover:bg-zinc-600'}`} title="Prévisualiser parcours">🛤️ {showCuttingPath ? 'ON' : 'OFF'}</button>
        <button onClick={onSimulation} disabled={entityCount === 0} className="px-3 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-30 text-white rounded font-bold transition-colors text-xs flex items-center gap-1" title="Simulation parcours de découpe"><Play size={12} /> SIM</button>
        <button onClick={actions.cleanIsolatedPoints} className={btnSm('bg-red-600', 'hover:bg-red-700')} title="Nettoyer points isolés">🧹 Clean</button>
        <button onClick={actions.filletCorners} className={btnSm('bg-blue-700', 'hover:bg-blue-600')} title="Arrondir angles">⌒</button>
        <button onClick={actions.fixJoints} className="px-3 py-2 bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700 transition-colors font-bold text-xs" title="Fixer joints">🧲</button>
        <button onClick={actions.explodePath} className="px-3 py-2 bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700 transition-colors font-bold text-xs" title="Éclater (X)">💥</button>
        <button onClick={actions.convertTextToPath} className="px-3 py-2 bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700 transition-colors font-bold text-xs" title="Convertir texte en contours">A→</button>
        <button onClick={actions.parallelOffset} className="px-3 py-2 bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700 transition-colors text-xs" title="Parallèle">//</button>
        <button onClick={actions.circlesAtIntersections} className="p-2 bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700 transition-colors" title="Cercles aux intersections"><Plus size={18} /></button>
      </div>

      {/* Undo/Redo */}
      <div className="flex items-center gap-1 border-r border-zinc-700 pr-2">
        <button onClick={actions.undo} className="p-2 bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700 transition-colors disabled:opacity-30" disabled={historyIndex === 0} title="Annuler (Ctrl+Z)"><Undo2 size={18} /></button>
        <button onClick={actions.redo} className="p-2 bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700 transition-colors disabled:opacity-30" disabled={historyIndex === historyLength - 1} title="Refaire (Ctrl+Y)"><Redo2 size={18} /></button>
      </div>

      {/* Zoom */}
      <div className="flex items-center gap-1 border-r border-zinc-700 pr-2">
        <button onClick={actions.zoomOut} className="p-2 bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700 transition-colors" title="Zoom arrière"><Minus size={18} /></button>
        <button onClick={actions.resetView} className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700 transition-colors text-xs font-bold" title="Réinitialiser vue">{Math.round(camera.zoom * 100)}%</button>
        <button onClick={actions.zoomIn} className="p-2 bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700 transition-colors" title="Zoom avant"><Plus size={18} /></button>
      </div>

      {/* Grid */}
      <div className="flex items-center gap-1 border-r border-zinc-700 pr-2">
        <button onClick={() => setShowGrid(!showGrid)} className={btn(showGrid)} title="Afficher grille (G)"><Grid size={18} /></button>
        <button onClick={() => setGridSnap(!gridSnap)} className={`px-3 py-2 rounded transition-colors text-xs font-bold ${gridSnap ? 'bg-cyan-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`} title="Magnétisme grille">MAG</button>
      </div>

      {/* Import/Export */}
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-1 border-r border-zinc-700 pr-2 mr-1">
          <span className="text-xs text-zinc-400 font-mono font-bold">Kerf</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={kerfWidth}
            onChange={(e) => setKerfWidth(Math.max(0, parseFloat(e.target.value) || 0))}
            className="w-16 px-2 py-1 bg-zinc-800 text-zinc-200 rounded text-xs font-mono border border-zinc-700 focus:border-cyan-500 outline-none"
            title="Largeur de kerf (compensation de coupe) — les contours extérieurs sont décalés vers l'extérieur, les trous vers l'intérieur"
          />
          <span className="text-xs text-zinc-500">mm</span>
        </div>
        <label className="p-2 bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700 transition-colors cursor-pointer" title="Importer DXF">
          <Upload size={18} />
          <input type="file" accept=".dxf" className="hidden" onChange={onImportDXF} />
        </label>
        <button onClick={actions.importTXT} className={btnSm('bg-green-600', 'hover:bg-green-700')} title="Importer TXT">📄 TXT</button>
        <button onClick={actions.exportDXF} className="px-3 py-2 bg-green-700 hover:bg-green-600 text-white rounded font-bold transition-colors text-xs flex items-center gap-1" title="Enregistrer sous (DXF)"><Save size={14} /> Enregistrer sous</button>
        <button onClick={actions.normalizePosition} className={btnSm('bg-green-700', 'hover:bg-green-600')} title="Normaliser position">📍</button>
        <button onClick={actions.exportGCode} className="px-3 py-2 bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700 transition-colors font-bold text-xs" title="Exporter G-code">G</button>
        <button onClick={() => generateManual()} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold transition-colors text-xs flex items-center gap-1" title="Télécharger le manuel d'utilisation (PDF)"><BookOpen size={14} /> Manuel</button>
        <button onClick={() => window.open('https://ko-fi.com/npfcutpro', '_blank', 'noopener,noreferrer')} className="px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-zinc-900 rounded font-bold transition-colors text-xs shadow-lg" title="Soutenir NPFCut Pro">☕ Don</button>
      </div>

      <div className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
        <span>Zoom: {(camera.zoom * 100).toFixed(0)}%</span>
        <span>|</span>
        <span>Entités: {entityCount}</span>
      </div>
    </div>
  );
}
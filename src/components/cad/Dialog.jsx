import { FONT_GROUPS } from '@/lib/fonts';

const labelMap = {
  width: 'Largeur (mm)',
  height: 'Hauteur (mm)',
  diameter: 'Diamètre (mm)',
  radius: 'Rayon (mm)',
  distance: 'Distance (mm)',
  fontSize: 'Taille (px)',
  fontFamily: 'Police',
  text: 'Texte',
  threshold: 'Seuil',
  scale: 'Échelle (mm/pixel)',
  x: 'Point X (mm)',
  y: 'Point Y (mm)',
  arcRadius: 'Arc (0=droit, >0=↑, <0=↓)',
  count: 'Nombre',
  rows: 'Lignes',
  cols: 'Colonnes',
  spacingX: 'Espacement X (mm)',
  spacingY: 'Espacement Y (mm)',
  startAngle: 'Angle départ (°)',
};

export default function Dialog({
  dialogOpen, dialogTitle, dialogInputs, dialogOptions, dialogCallback,
  setDialogOpen, setDialogInputs,
}) {
  if (!dialogOpen) return null;

  const handleValidate = (option) => {
    if (!dialogCallback) return;
    const finalValues = {};
    Object.keys(dialogInputs).forEach(k => {
      if (k === 'text' || k === 'fontFamily') {
        finalValues[k] = dialogInputs[k];
      } else {
        finalValues[k] = dialogInputs[k] === '' ? 0 : parseFloat(dialogInputs[k]);
      }
    });
    if (option !== undefined) {
      dialogCallback(finalValues, option);
    } else {
      dialogCallback(finalValues);
    }
  };

  return (
    <div
      className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={() => setDialogOpen(false)}
    >
      <div
        className="bg-zinc-900 border border-cyan-500 rounded-lg p-6 w-auto max-w-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-cyan-400 mb-4">{dialogTitle}</h3>

        {dialogTitle === "Briser l'entité" && (
          <p className="text-sm text-zinc-400 mb-4">
            Entrez les coordonnées du point de rupture
          </p>
        )}

        <div className="space-y-4">
          {Object.keys(dialogInputs).map(key => (
            <div key={key}>
              <label className="block text-sm text-zinc-400 mb-1 capitalize">
                {key === 'threshold' ? `Seuil : ${dialogInputs[key]}` : (labelMap[key] || key)}
              </label>

              {key === 'text' ? (
                <input
                  type="text"
                  value={dialogInputs[key]}
                  onChange={(e) => setDialogInputs({ ...dialogInputs, [key]: e.target.value })}
                  onFocus={(e) => e.target.select()}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                  autoFocus
                />
              ) : key === 'threshold' ? (
                <div>
                  <input type="range" min="10" max="245" step="5"
                    value={dialogInputs[key]}
                    onChange={(e) => setDialogInputs({ ...dialogInputs, [key]: parseInt(e.target.value) })}
                    className="w-full accent-cyan-500"
                  />
                  <div className="flex justify-between text-xs text-zinc-500 mt-1"><span>Sombre</span><span>Clair</span></div>
                </div>
              ) : key === 'arcRadius' ? (
                <input
                  type="number"
                  step="10"
                  value={dialogInputs[key]}
                  onChange={(e) => setDialogInputs({ ...dialogInputs, [key]: parseFloat(e.target.value) || 0 })}
                  onFocus={(e) => e.target.select()}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                  placeholder="0=droit, >0=↑haut, <0=↓bas"
                />
              ) : key === 'fontFamily' ? (
                <select
                  value={dialogInputs[key]}
                  onChange={(e) => setDialogInputs({ ...dialogInputs, [key]: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                  size="4"
                >
                  {FONT_GROUPS.map(group => (
                    <optgroup key={group.label} label={group.label}>
                      {group.fonts.map(font => (
                        <option key={font} value={font}>{font}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  step="0.1"
                  value={dialogInputs[key]}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDialogInputs({ ...dialogInputs, [key]: val === '' ? '' : parseFloat(val) });
                  }}
                  onFocus={(e) => e.target.select()}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                  autoFocus={Object.keys(dialogInputs)[0] === key}
                />
              )}
            </div>
          ))}

          {dialogOptions && (
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Position</label>
              <div className="grid grid-cols-2 gap-2">
                {dialogOptions.map(option => (
                  <button
                    key={option}
                    onClick={() => handleValidate(option)}
                    className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded transition-colors"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-6">
          {!dialogOptions && (
            <button
              onClick={() => handleValidate()}
              className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded transition-colors"
            >
              Valider
            </button>
          )}
          <button
            onClick={() => setDialogOpen(false)}
            className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-2 px-4 rounded transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
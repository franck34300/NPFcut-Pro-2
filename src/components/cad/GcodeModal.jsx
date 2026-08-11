import { X, Download, Copy } from 'lucide-react';

export default function GcodeModal({ gcode, onClose, onCopy, showToast }) {
  if (!gcode) return null;

  const downloadGcode = () => {
    const blob = new Blob([gcode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gcode_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('✅ G-code téléchargé !', 'success');
  };

  return (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-cyan-400">G-code Export</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <textarea
          readOnly
          value={gcode}
          className="flex-1 bg-zinc-950 border border-zinc-700 rounded p-4 text-green-400 font-mono text-sm overflow-auto resize-none"
          style={{ minHeight: '400px' }}
        />

        <div className="flex gap-2 mt-4">
          <button
            onClick={downloadGcode}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
          >
            <Download size={16} /> Télécharger .txt
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(gcode);
              showToast('✅ G-code copié !', 'success');
            }}
            className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
          >
            <Copy size={16} /> Copier
          </button>
          <button
            onClick={onClose}
            className="px-4 bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-2 rounded transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
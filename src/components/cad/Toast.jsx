export default function Toast({ toast }) {
  if (!toast) return null;

  const bg = toast.type === 'success' ? 'bg-green-600'
    : toast.type === 'warning' ? 'bg-yellow-600'
    : toast.type === 'info' ? 'bg-blue-600'
    : 'bg-red-600';

  return (
    <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 px-5 py-3 rounded-lg shadow-2xl text-white font-bold text-sm z-50 transition-all whitespace-pre-line ${bg}`}>
      {toast.msg}
    </div>
  );
}

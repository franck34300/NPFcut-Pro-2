let opentypePromise = null;

export function loadOpentypeScript() {
  if (window.opentype) return Promise.resolve(window.opentype);
  if (opentypePromise) return opentypePromise;

  opentypePromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/opentype.js@1.3.4/dist/opentype.min.js';
    script.onload = () => resolve(window.opentype);
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return opentypePromise;
}
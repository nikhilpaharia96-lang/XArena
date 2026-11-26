// Server-safe (no "use client"): inlined in <head>. Chrome fires `beforeinstallprompt` once, early —
// possibly before React hydrates — so catch it here and let the app pick it up from window.__xarenaInstallEvent.
export const PWA_EARLY_SCRIPT = `(function(){window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__xarenaInstallEvent=e;window.dispatchEvent(new Event('xarena:installable'));});})();`;

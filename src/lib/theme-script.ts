// Server-safe (no "use client"): imported by the root layout to inline the pre-paint script.
export const THEME_STORAGE_KEY = "xarena-theme";

/**
 * Runs in <head> before first paint so the saved theme is applied before React hydrates
 * and the page never flashes the wrong colours. Default is dark (the app's original look).
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t!=='light')t='dark';var d=document.documentElement;d.dataset.theme=t;d.style.colorScheme=t;}catch(e){document.documentElement.dataset.theme='dark';}})();`;

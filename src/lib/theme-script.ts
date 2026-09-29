/**
 * Inline script run before first paint so a saved theme is applied without a
 * flash. Light is the default; dark only when the visitor chose it. Keep the
 * storage key in sync with THEME_KEY in preferences.ts.
 */
export const themeInitScript = `(function(){var t="light";try{if(localStorage.getItem("ui-theme")==="dark")t="dark"}catch(e){}document.documentElement.dataset.theme=t})();`;

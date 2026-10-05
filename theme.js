/* theme.js — apply saved / system theme as early as possible (prevents FOUC) */
(function () {
  try {
    var stored = null;
    try {
      stored = localStorage.getItem('theme');
    } catch (e) {}

    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored || (prefersDark ? 'dark' : 'light');

    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {
    // silent fail – script.js will handle theme later
  }
})();
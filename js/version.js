// js/version.js — build label shown on the start screen, sidebar and phone "More" sheet.
// The GitHub Pages deploy overwrites this file with the real version, commit and build time.
window.GROVE_VERSION = { version: 'dev', sha: 'local', built: '' };
document.addEventListener('DOMContentLoaded', () => {
  const v = window.GROVE_VERSION;
  const label = `v${v.version} · ${v.sha}${v.built ? ' · ' + v.built : ''}`;
  document.querySelectorAll('[data-version]').forEach(el => { el.textContent = label; });
});

(() => {
'use strict';
const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());

const root = document.documentElement;
const toggle = document.getElementById('themeToggle');

function applyTheme(theme) {
  root.dataset.theme = theme;
  try { localStorage.setItem('sizemint-theme', theme); } catch (e) {}
  if (!toggle) return;
  const dark = theme === 'dark';
  toggle.setAttribute('aria-pressed', String(dark));
  toggle.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  const icon = toggle.querySelector('.theme-icon');
  const label = toggle.querySelector('.theme-label');
  if (icon) icon.textContent = dark ? '☀' : '☾';
  if (label) label.textContent = dark ? 'Light' : 'Dark';
}

if (toggle) {
  const current = root.dataset.theme === 'dark' ? 'dark' : 'light';
  applyTheme(current);
  toggle.addEventListener('click', () => {
    applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
  });
}
})();
/**
 * Family Health — app bootstrap, router, global helpers
 */
import { openDB } from './db.js';
import { esc } from './utils.js';
import { renderHome } from './views/home.js';
import { renderPersonPage, renderPersonForm, renderPeopleSettings } from './views/person.js';
import { renderVisitForm } from './views/visit-form.js';
import { renderVisitDetail } from './views/visit-detail.js';
import { renderSettings } from './views/settings.js';

// ── Global helpers ────────────────────────────────────────────
export function navigate(hash) {
  location.hash = hash;
}

let _toastTimer = null;
/**
 * Show a transient toast notification.
 * @param {string} msg       Message text (plain, not HTML).
 * @param {number} [duration=2600]  Auto-dismiss delay in ms.
 * @param {{ label: string, fn: () => void } | null} [action=null]  Optional action button.
 */
export function showToast(msg, duration = 2600, action = null) {
  const el = document.getElementById('toast');
  if (!el) return;
  if (action) {
    el.innerHTML = `<span>${esc(msg)}</span><button class="toast-action">${esc(action.label)}</button>`;
    el.querySelector('.toast-action').addEventListener('click', action.fn);
  } else {
    el.textContent = msg;
  }
  el.hidden = false;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.hidden = true; }, duration);
}

export function confirm(message, confirmLabel = 'Confirm', cancelLabel = 'Cancel') {
  return new Promise(resolve => {
    const dlg = document.createElement('dialog');
    dlg.className = 'sheet';
    dlg.innerHTML = `
      <h2>Are you sure?</h2>
      <p>${esc(message)}</p>
      <div class="form-actions">
        <button class="btn" id="dlg-cancel">${esc(cancelLabel)}</button>
        <button class="btn btn-danger" id="dlg-confirm">${esc(confirmLabel)}</button>
      </div>
    `;
    document.body.appendChild(dlg);
    dlg.showModal();
    dlg.querySelector('#dlg-cancel').addEventListener('click', () => { dlg.close(); dlg.remove(); resolve(false); });
    dlg.querySelector('#dlg-confirm').addEventListener('click', () => { dlg.close(); dlg.remove(); resolve(true); });
    dlg.addEventListener('cancel', () => { dlg.remove(); resolve(false); });
  });
}

// ── Router ────────────────────────────────────────────────────
const view = document.getElementById('view');
const fab  = document.getElementById('fab');

async function route() {
  const hash = location.hash || '#/';
  const [path, qs] = hash.slice(1).split('?');
  const params = new URLSearchParams(qs || '');
  const segments = path.split('/').filter(Boolean);

  // Scroll to top
  view.scrollTo?.(0, 0);
  window.scrollTo(0, 0);

  // FAB visibility: hide on form pages
  const hideFab = /^\/(visit\/(new|.+\/edit)|person\/(new|.+\/edit)|settings|people)/.test(path);
  fab.hidden = hideFab;

  try {
    // Route matching
    if (path === '/' || path === '') {
      await renderHome(view);
    } else if (path === '/settings') {
      await renderSettings(view);
    } else if (path === '/people') {
      await renderPeopleSettings(view);
    } else if (path === '/person/new') {
      await renderPersonForm(view, 'new');
    } else if (segments[0] === 'person' && segments[2] === 'edit') {
      await renderPersonForm(view, segments[1]);
    } else if (segments[0] === 'person' && segments[1]) {
      await renderPersonPage(view, segments[1]);
    } else if (path === '/visit/new') {
      await renderVisitForm(view, 'new', params);
    } else if (segments[0] === 'visit' && segments[2] === 'edit') {
      await renderVisitForm(view, segments[1], params);
    } else if (segments[0] === 'visit' && segments[1]) {
      await renderVisitDetail(view, segments[1]);
    } else {
      await renderHome(view);
    }
  } catch (err) {
    console.error('Route error:', err);
    view.innerHTML = `
      <div class="empty">
        <span class="big">⚠️</span>
        <h2>Something went wrong</h2>
        <p>${esc(err.message)}</p>
        <a class="btn btn-primary" href="#/">Go home</a>
      </div>
    `;
  }

  // Focus management
  view.focus({ preventScroll: true });
}

// ── Boot ─────────────────────────────────────────────────────
async function boot() {
  await openDB();

  // Register service worker; show a toast when a new version is waiting.
  // IMPORTANT: bump CACHE in sw.js (e.g. fh-v1 → fh-v2) on each release to
  // trigger the updatefound event that activates this notification.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // A previous SW was in control; a newer version is now installed and waiting.
            showToast('App updated — reload to apply', 10000, {
              label: 'Reload',
              fn: () => location.reload(),
            });
          }
        });
      });
    }).catch(console.warn);
  }

  window.addEventListener('hashchange', route);
  await route();
}

boot().catch(err => {
  console.error('Boot failed:', err);
  document.getElementById('view').innerHTML = `
    <div class="empty">
      <span class="big">💔</span>
      <h2>Could not start app</h2>
      <p>${esc(err.message)}</p>
    </div>
  `;
});

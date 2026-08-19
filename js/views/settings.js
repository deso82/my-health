import { exportAll, importAll } from '../db.js';
import { navigate, showToast } from '../app.js';

export async function renderSettings(container) {
  let storageText = 'Calculating…';
  let persistText = '';

  container.innerHTML = `
    <h1 style="margin-bottom:20px">Settings</h1>

    <div class="section">
      <div class="section-head"><h2>Data</h2></div>
      <div class="card settings-list">
        <button class="settings-row" id="btn-manage-people">
          <span style="font-size:22px">👥</span>
          <div class="grow">
            <div style="font-weight:650">Manage family members</div>
            <div class="sub">Add, edit or remove people</div>
          </div>
          <svg class="chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
        <button class="settings-row" id="btn-export">
          <span style="font-size:22px">📤</span>
          <div class="grow">
            <div style="font-weight:650">Export backup</div>
            <div class="sub">Save all visits and photos as a JSON file</div>
          </div>
          <svg class="chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
        <label class="settings-row" id="label-import" style="cursor:pointer">
          <span style="font-size:22px">📥</span>
          <div class="grow">
            <div style="font-weight:650">Import backup</div>
            <div class="sub">Restore from a previously exported JSON file</div>
          </div>
          <svg class="chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
          <input type="file" id="file-import" accept="application/json" hidden>
        </label>
      </div>
    </div>

    <div class="section">
      <div class="section-head"><h2>Storage</h2></div>
      <div class="card" style="padding:16px;display:flex;flex-direction:column;gap:10px">
        <div class="kv">
          <div class="k">Device storage used</div>
          <div class="v" id="storage-text">Calculating…</div>
        </div>
        <div id="persist-row"></div>
        <p style="font-size:.82rem;color:var(--text-3)">
          All data is stored locally in this browser. Clearing site data or browser storage will erase everything — use <strong>Export backup</strong> regularly.
        </p>
      </div>
    </div>

    <div class="section">
      <div class="section-head"><h2>About</h2></div>
      <div class="card" style="padding:16px">
        <p style="font-weight:650;margin-bottom:4px">Family Health</p>
        <p style="color:var(--text-2);font-size:.9rem">A private, offline-first portal for recording medical visits. No server, no account, no tracking.</p>
      </div>
    </div>
  `;

  // Navigate to people list
  container.querySelector('#btn-manage-people').addEventListener('click', () => navigate('#/people'));

  // Export
  container.querySelector('#btn-export').addEventListener('click', async () => {
    const btn = container.querySelector('#btn-export');
    btn.style.opacity = '.5';
    try {
      const data = await exportAll();
      const json = JSON.stringify(data);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `family-health-backup-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      showToast('Backup saved');
    } catch (err) {
      console.error(err);
      showToast('Export failed');
    } finally {
      btn.style.opacity = '';
    }
  });

  // Import
  container.querySelector('#file-import').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const data = JSON.parse(ev.target.result);
        await importAll(data);
        showToast('Backup restored — reloading…');
        setTimeout(() => location.reload(), 1000);
      } catch (err) {
        console.error(err);
        showToast('Import failed: ' + err.message);
      }
    };
    reader.readAsText(file);
  });

  // Storage estimate
  if (navigator.storage?.estimate) {
    navigator.storage.estimate().then(({ usage, quota }) => {
      const used = (usage / 1024 / 1024).toFixed(1);
      const total = (quota / 1024 / 1024).toFixed(0);
      const el = container.querySelector('#storage-text');
      if (el) el.textContent = `${used} MB of ~${total} MB`;
    });
  } else {
    const el = container.querySelector('#storage-text');
    if (el) el.textContent = 'Not available in this browser';
  }

  // Persistent storage
  if (navigator.storage?.persisted) {
    navigator.storage.persisted().then(async isPersisted => {
      const row = container.querySelector('#persist-row');
      if (!row) return;
      if (isPersisted) {
        row.innerHTML = `<div style="color:var(--accent);font-size:.88rem;font-weight:600">✅ Storage is protected from automatic clearing</div>`;
      } else {
        row.innerHTML = `
          <div style="font-size:.88rem;color:var(--text-2);margin-bottom:6px">Storage is not protected — the browser may clear it. Request protection to keep your data safe.</div>
          <button class="btn btn-sm" id="btn-persist">Request persistent storage</button>
        `;
        row.querySelector('#btn-persist')?.addEventListener('click', async () => {
          const granted = await navigator.storage.persist();
          if (granted) {
            row.innerHTML = `<div style="color:var(--accent);font-size:.88rem;font-weight:600">✅ Storage is now protected</div>`;
          } else {
            showToast('Permission not granted — try from the installed app');
          }
        });
      }
    });
  }
}

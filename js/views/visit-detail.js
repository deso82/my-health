import { people, visits, photos } from '../db.js';
import { navigate, showToast, confirm } from '../app.js';
import { VISIT_TYPES, esc, formatDate } from '../utils.js';

export async function renderVisitDetail(container, visitId) {
  const visit = await visits.get(visitId);
  if (!visit) { navigate('#/'); return; }

  const [person, visitPhotos] = await Promise.all([
    people.get(visit.personId),
    photos.listByVisit(visitId),
  ]);

  const vt = VISIT_TYPES.find(t => t.id === visit.type) || { icon: '📋', label: visit.type };

  // Build photo blob URLs
  const photoUrls = visitPhotos.map(p => ({ ...p, url: URL.createObjectURL(p.blob) }));

  container.innerHTML = `
    <button class="back-link" onclick="history.back()">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>
      Back
    </button>
    <div class="card detail-card">
      <div class="detail-head">
        <div class="visit-icon" style="width:52px;height:52px;font-size:26px">${vt.icon}</div>
        <div style="flex:1;min-width:0">
          <h1>${esc(vt.label)}</h1>
          <div class="sub">${formatDate(visit.date)}</div>
          ${person ? `<div class="sub" style="margin-top:4px">
            <span style="background:${person.color}22;padding:2px 8px;border-radius:999px;font-size:.8rem;font-weight:600;">
              ${person.emoji} ${esc(person.name)}
            </span>
          </div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <a class="btn btn-sm" href="#/visit/${visitId}/edit">Edit</a>
          <button class="btn btn-sm btn-danger" id="btn-delete">Delete</button>
        </div>
      </div>

      ${visit.doctorName ? `
      <div class="kv">
        <div class="k">Doctor / Practitioner</div>
        <div class="v">👨‍⚕️ ${esc(visit.doctorName)}</div>
      </div>` : ''}

      ${visit.location ? `
      <div class="kv">
        <div class="k">Clinic / Hospital</div>
        <div class="v">🏥 ${esc(visit.location)}</div>
      </div>` : ''}

      ${visit.advice ? `
      <div class="advice-box">
        <div class="k">Doctor's advice</div>
        <div class="v" style="margin-top:6px">${esc(visit.advice)}</div>
      </div>` : ''}

      ${visit.notes ? `
      <div class="kv">
        <div class="k">Personal notes</div>
        <div class="v">${esc(visit.notes)}</div>
      </div>` : ''}

      ${photoUrls.length > 0 ? `
      <div>
        <div class="k" style="margin-bottom:10px">Photos &amp; documents (${photoUrls.length})</div>
        <div class="photo-grid" id="photo-grid">
          ${photoUrls.map((p, i) => `
            <button class="photo-thumb" type="button" data-idx="${i}" aria-label="View photo ${i+1}">
              <img src="${p.url}" alt="${esc(p.name ?? 'Photo')}">
              <span class="ph-kind">${p.kind === 'receipt' ? '🧾 Receipt' : '🔬 Exam'}</span>
            </button>
          `).join('')}
        </div>
      </div>` : ''}

      <div style="font-size:.78rem;color:var(--text-3);margin-top:4px">
        Recorded ${new Date(visit.createdAt).toLocaleString()}
      </div>
    </div>
  `;

  // Delete
  container.querySelector('#btn-delete').addEventListener('click', async () => {
    const ok = await confirm('Delete this visit and all its photos?', 'Delete', 'Cancel');
    if (!ok) return;
    await photos.deleteByVisit(visitId);
    await visits.delete(visitId);
    photoUrls.forEach(p => URL.revokeObjectURL(p.url));
    showToast('Visit deleted');
    navigate(person ? `#/person/${person.id}` : '#/');
  });

  // Lightbox
  const grid = container.querySelector('#photo-grid');
  if (grid) {
    grid.querySelectorAll('.photo-thumb').forEach(btn => {
      btn.addEventListener('click', () => openLightbox(photoUrls, parseInt(btn.dataset.idx)));
    });
  }
}

function openLightbox(photoUrls, startIdx) {
  let idx = startIdx;
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-label', 'Photo viewer');

  const render = () => {
    const p = photoUrls[idx];
    lb.innerHTML = `
      <div class="lb-bar">
        <button class="icon-btn" id="lb-close" aria-label="Close">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
        <span style="color:#ccc;font-size:.9rem">${p.kind === 'receipt' ? '🧾 Receipt' : '🔬 Exam'} — ${idx+1} / ${photoUrls.length}</span>
        <div style="display:flex;gap:6px">
          ${photoUrls.length > 1 ? `
            <button class="icon-btn" id="lb-prev" aria-label="Previous" ${idx === 0 ? 'disabled' : ''}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <button class="icon-btn" id="lb-next" aria-label="Next" ${idx === photoUrls.length-1 ? 'disabled' : ''}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          ` : ''}
        </div>
      </div>
      <img src="${p.url}" alt="${p.name ?? 'Photo'}">
    `;
    lb.querySelector('#lb-close').addEventListener('click', () => lb.remove());
    lb.querySelector('#lb-prev')?.addEventListener('click', () => { idx--; render(); });
    lb.querySelector('#lb-next')?.addEventListener('click', () => { idx++; render(); });
  };

  render();
  document.body.appendChild(lb);
  lb.querySelector('#lb-close')?.focus();

  // Close on backdrop click
  lb.addEventListener('click', e => { if (e.target === lb) lb.remove(); });
  // Close on Escape
  const onKey = e => { if (e.key === 'Escape') { lb.remove(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);
}

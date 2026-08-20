import { people, visits, photos, uid, compressImage } from '../db.js';
import { navigate, showToast } from '../app.js';
import { VISIT_TYPES, esc, todayISO, formatDate } from '../utils.js';

export async function renderVisitForm(container, visitId, searchParams) {
  const isEdit = visitId && visitId !== 'new';
  const [allPeople, existing] = await Promise.all([
    people.list(),
    isEdit ? visits.get(visitId) : Promise.resolve(null),
  ]);
  const existingPhotos = isEdit ? await photos.listByVisit(visitId) : [];

  // Preselect person from query string
  const preselectedPerson = searchParams?.get('person') ?? existing?.personId ?? (allPeople[0]?.id ?? null);

  let selectedPerson = preselectedPerson;
  let selectedType = existing?.type ?? 'gp';

  // Pending photo blobs (new session additions)
  let pendingPhotos = []; // { id, blob, url, kind, name }
  // Existing photos that are removed
  let removedExistingIds = new Set();

  const render = () => {
    container.innerHTML = `
      <button class="back-link" onclick="history.back()">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        Back
      </button>
      <h1 style="margin-bottom:20px">${isEdit ? 'Edit visit' : 'New visit'}</h1>
      <form class="form" id="visit-form" novalidate>

        ${allPeople.length > 0 ? `
        <div class="field">
          <label>Person *</label>
          <div class="person-select" id="person-select">
            ${allPeople.map(p => `
              <button type="button" class="person-option" data-pid="${p.id}" aria-pressed="${p.id === selectedPerson}">
                <div class="avatar" style="background:${p.color}22;font-size:17px;width:34px;height:34px">${p.emoji}</div>
                ${esc(p.name)}
              </button>
            `).join('')}
          </div>
        </div>` : `
        <div class="empty" style="margin-bottom:8px">
          <span class="big">👤</span>
          <h2>No family members yet</h2>
          <p><a href="#/person/new">Add a person</a> before recording a visit.</p>
        </div>`}

        <div class="field">
          <label>Visit type *</label>
          <div class="type-grid" id="type-grid">
            ${VISIT_TYPES.map(t => `
              <button type="button" class="type-option" data-type="${t.id}" aria-pressed="${t.id === selectedType}">
                <span class="t-icon">${t.icon}</span>
                <span>${t.label}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="field">
          <label for="v-date">Date *</label>
          <input class="input" id="v-date" name="date" type="date" required
            value="${existing?.date ?? todayISO()}" max="${todayISO()}">
        </div>

        <div class="field">
          <label for="v-doctor">Doctor / Practitioner name</label>
          <input class="input" id="v-doctor" name="doctorName" type="text"
            placeholder="e.g. Dr. Smith" maxlength="200" value="${esc(existing?.doctorName ?? '')}">
        </div>

        <div class="field">
          <label for="v-location">Clinic / Hospital</label>
          <input class="input" id="v-location" name="location" type="text"
            placeholder="e.g. City Medical Centre" maxlength="200" value="${esc(existing?.location ?? '')}">
        </div>

        <div class="field">
          <label for="v-advice">Doctor's advice &amp; notes *</label>
          <textarea class="textarea" id="v-advice" name="advice" style="min-height:140px"
            maxlength="5000"
            placeholder="Write the doctor's recommendations, diagnoses, prescriptions…">${esc(existing?.advice ?? '')}</textarea>
        </div>

        <div class="field">
          <label for="v-notes">Personal notes</label>
          <textarea class="textarea" id="v-notes" name="notes"
            maxlength="2000"
            placeholder="Your own observations, follow-up reminders…">${esc(existing?.notes ?? '')}</textarea>
        </div>

        <div class="field">
          <label>Photos &amp; documents</label>
          <div class="hint">Add exam results, prescriptions, e-receipts. Photos are stored on this device only.</div>
          <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap">
            <button type="button" class="btn btn-sm" id="btn-add-exam">
              🔬 Add exam / result
            </button>
            <button type="button" class="btn btn-sm" id="btn-add-receipt">
              🧾 Add e-receipt
            </button>
          </div>
          <input type="file" id="file-input-exam" accept="image/*" multiple hidden>
          <input type="file" id="file-input-receipt" accept="image/*" multiple hidden>
          <div class="photo-grid" id="photo-grid" style="margin-top:12px"></div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn" onclick="history.back()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="v-save" ${allPeople.length === 0 ? 'disabled' : ''}>
            ${isEdit ? 'Save changes' : 'Save visit'}
          </button>
        </div>
      </form>
    `;

    rebuildPhotoGrid();

    // Person selector
    container.querySelectorAll('#person-select .person-option').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedPerson = btn.dataset.pid;
        container.querySelectorAll('#person-select .person-option').forEach(b =>
          b.setAttribute('aria-pressed', b === btn)
        );
      });
    });

    // Type selector
    container.querySelectorAll('#type-grid .type-option').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedType = btn.dataset.type;
        container.querySelectorAll('#type-grid .type-option').forEach(b =>
          b.setAttribute('aria-pressed', b === btn)
        );
      });
    });

    // Photo file inputs
    container.querySelector('#btn-add-exam').addEventListener('click', () => {
      container.querySelector('#file-input-exam').click();
    });
    container.querySelector('#btn-add-receipt').addEventListener('click', () => {
      container.querySelector('#file-input-receipt').click();
    });

    container.querySelector('#file-input-exam').addEventListener('change', e => addFiles(e.target.files, 'exam'));
    container.querySelector('#file-input-receipt').addEventListener('change', e => addFiles(e.target.files, 'receipt'));

    // Form submit
    container.querySelector('#visit-form').addEventListener('submit', handleSubmit);
  };

  async function addFiles(fileList, kind) {
    for (const file of fileList) {
      const saveBtn = container.querySelector('#v-save');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Processing…';
      try {
        const blob = await compressImage(file);
        pendingPhotos.push({ id: uid(), blob, url: URL.createObjectURL(blob), kind, name: file.name });
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = isEdit ? 'Save changes' : 'Save visit';
      }
    }
    rebuildPhotoGrid();
  }

  function rebuildPhotoGrid() {
    const grid = container.querySelector('#photo-grid');
    if (!grid) return;
    const visible = [
      ...existingPhotos.filter(p => !removedExistingIds.has(p.id)).map(p => ({ ...p, isExisting: true })),
      ...pendingPhotos.map(p => ({ ...p, isExisting: false })),
    ];
    if (visible.length === 0) { grid.innerHTML = ''; return; }
    grid.innerHTML = visible.map(p => `
      <button type="button" class="photo-thumb" data-id="${p.id}" data-existing="${p.isExisting}">
        <img src="${p.isExisting ? '' : p.url}" alt="${esc(p.name ?? '')}" id="img-${p.id}">
        <span class="ph-kind">${p.kind === 'receipt' ? '🧾' : '🔬'}</span>
        <button type="button" class="ph-remove" data-id="${p.id}" data-existing="${p.isExisting}" aria-label="Remove photo">×</button>
      </button>
    `).join('');

    // Load existing photo blobs as object URLs
    existingPhotos.filter(p => !removedExistingIds.has(p.id)).forEach(async p => {
      const imgEl = grid.querySelector(`#img-${p.id}`);
      if (imgEl && !imgEl.src) imgEl.src = URL.createObjectURL(p.blob);
    });

    grid.querySelectorAll('.ph-remove').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (btn.dataset.existing === 'true') {
          removedExistingIds.add(id);
        } else {
          const idx = pendingPhotos.findIndex(p => p.id === id);
          if (idx !== -1) { URL.revokeObjectURL(pendingPhotos[idx].url); pendingPhotos.splice(idx, 1); }
        }
        rebuildPhotoGrid();
      });
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedPerson) { showToast('Please select a person'); return; }

    const fd = new FormData(e.target);

    // JS-side date validation — the HTML `max` attribute is bypassable via DevTools.
    const dateVal = fd.get('date');
    if (!dateVal) { showToast('Date is required'); return; }
    const visitDate = new Date(dateVal + 'T00:00:00'); // local-time parse to avoid UTC-offset issues
    const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
    if (visitDate > endOfToday) { showToast('Visit date cannot be in the future'); return; }

    const btn = container.querySelector('#v-save');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
      const visit = {
        id: existing?.id ?? uid(),
        personId: selectedPerson,
        type: selectedType,
        date: fd.get('date'),
        doctorName: fd.get('doctorName').trim() || null,
        location: fd.get('location').trim() || null,
        advice: fd.get('advice').trim(),
        notes: fd.get('notes').trim() || null,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      };
      await visits.put(visit);

      // Remove deleted existing photos
      await Promise.all([...removedExistingIds].map(id => photos.delete(id)));

      // Save new photos
      await Promise.all(pendingPhotos.map(p =>
        photos.put({ id: p.id, visitId: visit.id, blob: p.blob, kind: p.kind, name: p.name, addedAt: new Date().toISOString() })
      ));

      navigate(`#/visit/${visit.id}`);
    } catch (err) {
      console.error(err);
      showToast('Error saving — try again');
      btn.disabled = false;
      btn.textContent = isEdit ? 'Save changes' : 'Save visit';
    }
  }

  render();
}

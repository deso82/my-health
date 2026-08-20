import { people, visits, photos, uid } from '../db.js';
import { navigate, showToast, confirm } from '../app.js';
import { VISIT_TYPES, PERSON_COLORS, PERSON_EMOJIS, personStyle, formatDate, relativeDate, esc, todayISO } from '../utils.js';

/* ── Person list (Settings) ── */
export async function renderPeopleSettings(container) {
  const list = await people.list();
  container.innerHTML = `
    <button class="back-link" onclick="history.back()">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>
      Back
    </button>
    <h1 style="margin-bottom:18px">Family Members</h1>
    <div class="visit-list" id="person-list">
      ${list.map(personRow).join('')}
    </div>
    <div style="margin-top:16px">
      <a class="btn btn-primary btn-block" href="#/person/new">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
        Add person
      </a>
    </div>
  `;

  container.querySelectorAll('.btn-edit-person').forEach(btn => {
    btn.addEventListener('click', () => navigate(`#/person/${btn.dataset.id}/edit`));
  });
  container.querySelectorAll('.btn-del-person').forEach(btn => {
    btn.addEventListener('click', () => deletePerson(btn.dataset.id, btn.dataset.name, container));
  });
}

function personRow(p) {
  return `
    <div class="card visit-row">
      <div class="avatar" style="background:${p.color}22;font-size:22px">${p.emoji}</div>
      <div class="visit-main">
        <div class="visit-title">${esc(p.name)}</div>
        ${p.birthDate ? `<div class="visit-sub">Born ${formatDate(p.birthDate)}</div>` : '<div class="visit-sub"></div>'}
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-sm btn-ghost btn-edit-person" data-id="${p.id}">Edit</button>
        <button class="btn btn-sm btn-danger btn-del-person" data-id="${p.id}" data-name="${esc(p.name)}">Delete</button>
      </div>
    </div>
  `;
}

async function deletePerson(id, name, container) {
  const ok = await confirm(`Delete ${name} and all their visits and photos? This cannot be undone.`, 'Delete', 'Cancel');
  if (!ok) return;
  const theirVisits = await visits.listByPerson(id);
  await Promise.all(theirVisits.map(v => photos.deleteByVisit(v.id)));
  await Promise.all(theirVisits.map(v => visits.delete(v.id)));
  await people.delete(id);
  showToast(`${name} deleted`);
  renderPeopleSettings(container);
}

/* ── Person profile page ── */
export async function renderPersonPage(container, personId) {
  const person = await people.get(personId);
  if (!person) { navigate('#/'); return; }
  const allVisits = await visits.listByPerson(personId);

  // Filter state
  let filter = 'all';

  const render = (filtered) => {
    const rows = filtered.length === 0
      ? `<div class="empty"><span class="big">📅</span><h2>No visits yet</h2><p>Tap <strong>+ New visit</strong> to add one.</p></div>`
      : `<div class="visit-list">${filtered.map(v => visitRow(v)).join('')}</div>`;

    container.innerHTML = `
      <button class="back-link" onclick="history.back()">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        Home
      </button>
      <div class="page-head card" style="padding:16px;margin-bottom:4px">
        <div class="avatar" style="background:${person.color}22;font-size:30px;width:56px;height:56px">${person.emoji}</div>
        <div class="grow">
          <h1>${esc(person.name)}</h1>
          ${person.birthDate ? `<div class="sub">Born ${formatDate(person.birthDate)}</div>` : ''}
          ${person.notes ? `<div class="sub" style="margin-top:4px">${esc(person.notes)}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
          <a class="btn btn-sm" href="#/person/${personId}/edit">Edit</a>
          <a class="btn btn-sm btn-primary" href="#/visit/new?person=${personId}">+ Visit</a>
        </div>
      </div>
      <div class="section">
        <div class="chip-row" id="filter-chips">
          <button class="chip${filter === 'all' ? ' selected' : ''}" data-filter="all" aria-pressed="${filter === 'all'}">All (${allVisits.length})</button>
          ${VISIT_TYPES.filter(t => allVisits.some(v => v.type === t.id)).map(t =>
            `<button class="chip${filter === t.id ? ' selected' : ''}" data-filter="${t.id}" aria-pressed="${filter === t.id}">${t.icon} ${t.label}</button>`
          ).join('')}
        </div>
        <div id="visits-section">${rows}</div>
      </div>
    `;

    container.querySelectorAll('#filter-chips .chip').forEach(btn => {
      btn.addEventListener('click', () => {
        filter = btn.dataset.filter;
        const filtered2 = filter === 'all' ? allVisits : allVisits.filter(v => v.type === filter);
        // Update chips
        container.querySelectorAll('#filter-chips .chip').forEach(c => {
          const active = c.dataset.filter === filter;
          c.classList.toggle('selected', active);
          c.setAttribute('aria-pressed', active);
        });
        document.getElementById('visits-section').innerHTML =
          filtered2.length === 0
            ? `<div class="empty"><span class="big">📅</span><h2>No ${filter} visits</h2></div>`
            : `<div class="visit-list">${filtered2.map(v => visitRow(v)).join('')}</div>`;
      });
    });
  };

  render(allVisits);
}

function visitRow(v) {
  const vt = VISIT_TYPES.find(t => t.id === v.type) || { icon: '📋', label: v.type };
  return `
    <a href="#/visit/${v.id}" class="card visit-row">
      <div class="visit-icon">${vt.icon}</div>
      <div class="visit-main">
        <div class="visit-title">${esc(vt.label)}</div>
        <div class="visit-sub">${v.doctorName ? '👨‍⚕️ ' + esc(v.doctorName) : '&nbsp;'}</div>
      </div>
      <div class="visit-date">${formatDate(v.date)}</div>
    </a>
  `;
}

/* ── Add / Edit person form ── */
export async function renderPersonForm(container, personId) {
  const isEdit = personId && personId !== 'new';
  const existing = isEdit ? await people.get(personId) : null;

  let selectedEmoji = existing?.emoji ?? PERSON_EMOJIS[0];
  let selectedColor = existing?.color ?? PERSON_COLORS[0];

  const render = () => {
    container.innerHTML = `
      <button class="back-link" onclick="history.back()">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        Back
      </button>
      <h1 style="margin-bottom:20px">${isEdit ? 'Edit person' : 'Add family member'}</h1>
      <form class="form" id="person-form" novalidate>
        <div class="field">
          <label for="p-name">Name *</label>
          <input class="input" id="p-name" name="name" type="text" placeholder="e.g. Maria" required autocomplete="name" maxlength="200" value="${esc(existing?.name ?? '')}">
        </div>
        <div class="field">
          <label>Avatar emoji</label>
          <div class="swatch-row" id="emoji-row">
            ${PERSON_EMOJIS.map(e => `
              <button type="button" class="swatch" data-emoji="${e}" aria-pressed="${e === selectedEmoji}" aria-label="${e}">${e}</button>
            `).join('')}
          </div>
        </div>
        <div class="field">
          <label>Colour</label>
          <div class="swatch-row" id="color-row">
            ${PERSON_COLORS.map(c => `
              <button type="button" class="swatch color" data-color="${c}" style="--sc:${c}" aria-pressed="${c === selectedColor}" aria-label="${c}"></button>
            `).join('')}
          </div>
        </div>
        <div class="field">
          <label for="p-birth">Date of birth</label>
          <input class="input" id="p-birth" name="birthDate" type="date" value="${existing?.birthDate ?? ''}">
        </div>
        <div class="field">
          <label for="p-notes">Notes</label>
          <textarea class="textarea" id="p-notes" name="notes" maxlength="2000" placeholder="Allergies, blood type, chronic conditions…">${esc(existing?.notes ?? '')}</textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn" onclick="history.back()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="p-save">
            ${isEdit ? 'Save changes' : 'Add person'}
          </button>
        </div>
      </form>
    `;

    // Emoji picker
    container.querySelectorAll('#emoji-row .swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedEmoji = btn.dataset.emoji;
        container.querySelectorAll('#emoji-row .swatch').forEach(b => b.setAttribute('aria-pressed', b === btn));
      });
    });

    // Color picker
    container.querySelectorAll('#color-row .swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedColor = btn.dataset.color;
        container.querySelectorAll('#color-row .swatch').forEach(b => b.setAttribute('aria-pressed', b === btn));
      });
    });

    container.querySelector('#person-form').addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const name = fd.get('name').trim();
      if (!name) { document.getElementById('p-name').focus(); return; }
      const person = {
        id: existing?.id ?? uid(),
        name,
        emoji: selectedEmoji,
        color: selectedColor,
        birthDate: fd.get('birthDate') || null,
        notes: fd.get('notes').trim() || null,
      };
      const btn = container.querySelector('#p-save');
      btn.disabled = true;
      await people.put(person);
      navigate(isEdit ? `#/person/${person.id}` : '#/');
    });
  };

  render();
}

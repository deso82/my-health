import { people, visits } from '../db.js';
import { navigate } from '../app.js';
import { VISIT_TYPES, formatDate, relativeDate, esc, personStyle } from '../utils.js';

export async function renderHome(container) {
  const [allPeople, allVisits] = await Promise.all([people.list(), visits.list()]);

  // Map last-visit date per person
  const lastVisit = {};
  allVisits.forEach(v => {
    if (!lastVisit[v.personId] || v.date > lastVisit[v.personId]) lastVisit[v.personId] = v.date;
  });

  container.innerHTML = `
    <div class="section">
      <div class="section-head">
        <h2>Family members</h2>
      </div>
      <div class="people-grid">
        ${allPeople.map(p => `
          <a href="#/person/${p.id}" class="card person-card" style="${personStyle(p)}">
            <div class="avatar" style="background:${p.color}22;font-size:26px;">${p.emoji}</div>
            <div>
              <div class="p-name">${esc(p.name)}</div>
              <div class="p-meta">${lastVisit[p.id] ? `Last: ${relativeDate(lastVisit[p.id])}` : 'No visits yet'}</div>
            </div>
          </a>
        `).join('')}
        <button class="person-add" id="btn-add-person">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Add person
        </button>
      </div>
    </div>

    <div class="section">
      <div class="section-head">
        <h2>Recent visits</h2>
        ${allVisits.length > 0 ? `<a class="btn btn-ghost btn-sm" href="#/visit/new">+ New</a>` : ''}
      </div>
      ${allVisits.length === 0
        ? `<div class="empty">
            <span class="big">🩺</span>
            <h2>No visits recorded yet</h2>
            <p>Add a family member above, then tap <strong>+ New visit</strong> to record a checkup.</p>
          </div>`
        : `<div class="visit-list">
            ${allVisits.slice(0, 20).map(v => visitRow(v, allPeople)).join('')}
          </div>`
      }
    </div>
  `;

  container.querySelector('#btn-add-person')?.addEventListener('click', () => {
    navigate('#/person/new');
  });
}

function visitRow(v, allPeople) {
  const person = allPeople.find(p => p.id === v.personId);
  const vt = VISIT_TYPES.find(t => t.id === v.type) || { icon: '🔹', label: v.type };
  return `
    <a href="#/visit/${v.id}" class="card visit-row">
      <div class="visit-icon">${vt.icon}</div>
      <div class="visit-main">
        <div class="visit-title">
          ${esc(vt.label)}
          ${person ? `<span class="tag" style="background:${person.color}22;">${person.emoji} ${esc(person.name)}</span>` : ''}
        </div>
        <div class="visit-sub">${v.doctorName ? '👨‍⚕️ ' + esc(v.doctorName) : '&nbsp;'}</div>
      </div>
      <div class="visit-date">${formatDate(v.date)}</div>
    </a>
  `;
}


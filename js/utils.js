/** Shared constants and helpers */

export const VISIT_TYPES = [
  { id: 'gp',         icon: '🩺', label: 'GP / Family Doctor' },
  { id: 'specialist', icon: '👨‍⚕️', label: 'Specialist' },
  { id: 'emergency',  icon: '🚨', label: 'Emergency' },
  { id: 'dentist',    icon: '🦷', label: 'Dentist' },
  { id: 'hygiene',    icon: '✨', label: 'Dental Hygiene' },
  { id: 'vaccination',icon: '💉', label: 'Vaccination' },
  { id: 'blood',      icon: '🩸', label: 'Blood Test' },
  { id: 'imaging',    icon: '🔬', label: 'Imaging / X-Ray' },
  { id: 'physio',     icon: '🏋️', label: 'Physiotherapy' },
  { id: 'eye',        icon: '👁️', label: 'Eye / Optician' },
  { id: 'mental',     icon: '🧠', label: 'Mental Health' },
  { id: 'other',      icon: '📋', label: 'Other' },
];

export const PERSON_COLORS = [
  '#4f86e8', '#e86b4f', '#4fbe8a', '#c66dc6',
  '#e8a84f', '#4fc6e8', '#e84f7c', '#8abe4f',
];

export const PERSON_EMOJIS = ['👤','👩','👨','👧','👦','👶','🧓','👴','👵','🧑','👩‍🦱','👨‍🦲'];

export function personStyle(p) {
  return `--pc:${p.color}22;`;
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function relativeDate(iso) {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso + 'T00:00:00')) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff}d ago`;
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
  if (diff < 365) return `${Math.floor(diff / 30)}mo ago`;
  return `${Math.floor(diff / 365)}y ago`;
}

export function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

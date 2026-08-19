/**
 * IndexedDB wrapper for Family Health
 * Stores: people, visits, photos
 */

const DB_NAME = 'family-health';
const DB_VERSION = 1;

let _db = null;

/** @returns {Promise<IDBDatabase>} The open database instance. */
export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;

      // People
      if (!db.objectStoreNames.contains('people')) {
        const ps = db.createObjectStore('people', { keyPath: 'id' });
        ps.createIndex('name', 'name');
      }

      // Visits
      if (!db.objectStoreNames.contains('visits')) {
        const vs = db.createObjectStore('visits', { keyPath: 'id' });
        vs.createIndex('personId', 'personId');
        vs.createIndex('date', 'date');
        vs.createIndex('personDate', ['personId', 'date']);
      }

      // Photos (store as Blob)
      if (!db.objectStoreNames.contains('photos')) {
        const ph = db.createObjectStore('photos', { keyPath: 'id' });
        ph.createIndex('visitId', 'visitId');
      }
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror = e => reject(e.target.error);
  });
}

function tx(storeName, mode = 'readonly') {
  return _db.transaction(storeName, mode).objectStore(storeName);
}

function wrap(req) {
  return new Promise((res, rej) => {
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e.target.error);
  });
}

function getAll(storeName, indexName, query) {
  return new Promise((res, rej) => {
    const store = tx(storeName);
    const req = indexName ? store.index(indexName).getAll(query) : store.getAll();
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e.target.error);
  });
}

// ── People ──────────────────────────────────────────────────

export const people = {
  list: () => getAll('people'),
  get: id => wrap(tx('people').get(id)),
  put: person => wrap(tx('people', 'readwrite').put(person)),
  delete: id => wrap(tx('people', 'readwrite').delete(id)),
};

// ── Visits ──────────────────────────────────────────────────

export const visits = {
  list: () => getAll('visits').then(vs => vs.sort((a, b) => b.date.localeCompare(a.date))),
  listByPerson: personId => getAll('visits', 'personId', personId).then(vs => vs.sort((a, b) => b.date.localeCompare(a.date))),
  get: id => wrap(tx('visits').get(id)),
  put: visit => wrap(tx('visits', 'readwrite').put(visit)),
  delete: id => wrap(tx('visits', 'readwrite').delete(id)),
};

// ── Photos ──────────────────────────────────────────────────

export const photos = {
  listByVisit: visitId => getAll('photos', 'visitId', visitId),
  get: id => wrap(tx('photos').get(id)),
  put: photo => wrap(tx('photos', 'readwrite').put(photo)),
  delete: id => wrap(tx('photos', 'readwrite').delete(id)),
  deleteByVisit: visitId =>
    getAll('photos', 'visitId', visitId).then(list =>
      Promise.all(list.map(p => wrap(tx('photos', 'readwrite').delete(p.id))))
    ),
};

// ── Full export / import ─────────────────────────────────────

/** @returns {Promise<{version:number, people:object[], visits:object[], photos:object[]}>} */
export async function exportAll() {
  const [allPeople, allVisits, allPhotos] = await Promise.all([
    people.list(),
    visits.list(),
    getAll('photos'),
  ]);
  // Convert blobs to base64 for JSON transport
  const photosB64 = await Promise.all(
    allPhotos.map(async p => ({
      ...p,
      blob: await blobToBase64(p.blob),
      blobType: p.blob.type,
    }))
  );
  return { version: 1, people: allPeople, visits: allVisits, photos: photosB64 };
}

/**
 * Clear all stores and insert data from a backup object.
 * @param {{version:number, people:object[], visits:object[], photos:object[]}} data
 * @returns {Promise<void>}
 */
export async function importAll(data) {
  if (!data || data.version !== 1) throw new Error('Unrecognised backup format.');
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(['people', 'visits', 'photos'], 'readwrite');
    t.oncomplete = resolve;
    t.onerror = e => reject(e.target.error);
    const ps = t.objectStore('people');
    const vs = t.objectStore('visits');
    const ph = t.objectStore('photos');
    // Clear stores first
    ps.clear(); vs.clear(); ph.clear();
    (data.people || []).forEach(p => ps.put(p));
    (data.visits || []).forEach(v => vs.put(v));
    (data.photos || []).forEach(async p => {
      const blob = base64ToBlob(p.blob, p.blobType || 'image/jpeg');
      ph.put({ ...p, blob, blobType: undefined });
    });
  });
}

// ── Image compression ────────────────────────────────────────

/**
 * Compress an image file to JPEG via canvas, capping the longest edge at maxDim.
 * @param {File} file
 * @param {number} [maxDim=1600]
 * @param {number} [quality=0.82]
 * @returns {Promise<Blob>}
 */
export function compressImage(file, maxDim = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
        else { width = Math.round(width * maxDim / height); height = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Compression failed')), 'image/jpeg', quality);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── Helpers ──────────────────────────────────────────────────

function blobToBase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

function base64ToBlob(b64, type = 'image/jpeg') {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type });
}

/** @returns {string} A cryptographically random UUID v4 (available in all SW-capable browsers). */
export function uid() {
  return crypto.randomUUID();
}

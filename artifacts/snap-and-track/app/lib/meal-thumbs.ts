// Small meal photo thumbnails, kept in this browser only (IndexedDB), keyed by
// the meal_logs entry id. They are never uploaded or written to the database.
//
// Every function here swallows its own errors: storage that is full, blocked
// (private browsing) or missing must never break logging or the Log page.

const DB_NAME = 'munchsnapper-thumbs';
const STORE = 'thumbs';
const THUMB_MAX_SIDE_PX = 240;
const THUMB_QUALITY = 0.7;
// Meals are kept for 7 days, so their photos are too.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
// Hard cap on stored thumbnails (at roughly 10-25 KB each, about 5 MB at most).
const MAX_THUMBS = 200;

interface ThumbRecord {
  id: number;
  userId: string;
  blob: Blob;
  savedAt: number;
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => {
        db.close();
        resolve(req ? (req.result as T) : null);
      };
      tx.onerror = () => {
        db.close();
        resolve(null);
      };
      tx.onabort = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

/** Makes a small JPEG from an (already shrunk) photo. Returns null on any failure. */
export async function makeMealThumb(file: Blob): Promise<Blob | null> {
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > THUMB_MAX_SIDE_PX ? THUMB_MAX_SIDE_PX / longest : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', THUMB_QUALITY)
    );
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}

async function allRecords(): Promise<ThumbRecord[]> {
  const rows = await withStore<ThumbRecord[]>('readonly', (s) => s.getAll());
  return Array.isArray(rows) ? rows : [];
}

async function deleteIds(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await withStore('readwrite', (s) => {
    for (const id of ids) s.delete(id);
  });
}

export async function saveMealThumb(id: number, userId: string, blob: Blob): Promise<void> {
  try {
    const record: ThumbRecord = { id, userId, blob, savedAt: Date.now() };
    await withStore('readwrite', (s) => s.put(record));
    const rows = await allRecords();
    if (rows.length > MAX_THUMBS) {
      rows.sort((a, b) => a.savedAt - b.savedAt);
      await deleteIds(rows.slice(0, rows.length - MAX_THUMBS).map((r) => r.id));
    }
  } catch {
    // best-effort: the meal is already logged without its photo
  }
}

/** Thumbnails for the given entry ids that exist on this device. */
export async function loadMealThumbs(ids: number[]): Promise<Map<number, Blob>> {
  const found = new Map<number, Blob>();
  try {
    const wanted = new Set(ids);
    for (const r of await allRecords()) {
      if (wanted.has(r.id) && r.blob instanceof Blob) found.set(r.id, r.blob);
    }
  } catch {
    // best-effort
  }
  return found;
}

export async function deleteMealThumb(id: number): Promise<void> {
  try {
    await deleteIds([id]);
  } catch {
    // best-effort
  }
}

/**
 * Removes thumbnails older than 7 days, and this user's thumbnails whose
 * entries no longer exist. Call only with a successfully fetched entry list.
 */
export async function pruneMealThumbs(userId: string, liveIds: number[]): Promise<void> {
  try {
    const live = new Set(liveIds);
    const cutoff = Date.now() - MAX_AGE_MS;
    const stale = (await allRecords())
      .filter((r) => r.savedAt < cutoff || (r.userId === userId && !live.has(r.id)))
      .map((r) => r.id);
    await deleteIds(stale);
  } catch {
    // best-effort
  }
}

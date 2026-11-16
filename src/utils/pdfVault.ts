import { PdfDocumentMeta } from '../types/study';

const DB_NAME = 'cadence_pdf_vault_v1';
const DB_VERSION = 1;
const STORE_NAME = 'pdfs';

interface StoredPdfRecord extends PdfDocumentMeta {
  blob: Blob;
}

function openVaultDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open PDF storage.'));
  });
}

export async function listPdfMetas(): Promise<PdfDocumentMeta[]> {
  try {
    const db = await openVaultDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const records = (req.result || []) as StoredPdfRecord[];
        const metas: PdfDocumentMeta[] = records
          .map(({ id, name, sizeBytes, subjectId, topicId, addedAt }) => ({
            id,
            name,
            sizeBytes,
            subjectId,
            topicId,
            addedAt,
          }))
          .sort((a, b) => b.addedAt - a.addedAt);
        resolve(metas);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function savePdfFile(
  file: File,
  subjectId: string,
  topicId: string | null
): Promise<PdfDocumentMeta> {
  const db = await openVaultDB();
  const record: StoredPdfRecord = {
    id: `pdf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: file.name,
    sizeBytes: file.size,
    subjectId,
    topicId,
    addedAt: Date.now(),
    blob: file,
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('Could not save PDF.'));
  });

  const { blob: _blob, ...meta } = record;
  return meta;
}

export async function getPdfBlob(id: string): Promise<Blob | null> {
  try {
    const db = await openVaultDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        const rec = req.result as StoredPdfRecord | undefined;
        resolve(rec ? rec.blob : null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function deletePdfFile(id: string): Promise<void> {
  const db = await openVaultDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearAllPdfs(): Promise<void> {
  try {
    const db = await openVaultDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Ignore cleanup errors
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export interface QueuedRecordingChunk {
  key: string;
  sessionId: string;
  chunkNumber: number;
  elapsedSeconds: number;
  blob: Blob;
}

export interface RecordingQueueSession {
  sessionId: string;
  lastChunkNumber: number;
  lastElapsedSeconds: number;
  startedAt: number;
  finalizePending: boolean;
}

const DATABASE_NAME = "tgf-live-recording-queue";
const DATABASE_VERSION = 1;
const CHUNKS_STORE = "chunks";
const SESSIONS_STORE = "sessions";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      const chunks = database.createObjectStore(CHUNKS_STORE, { keyPath: "key" });
      chunks.createIndex("sessionId", "sessionId", { unique: false });
      database.createObjectStore(SESSIONS_STORE, { keyPath: "sessionId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("The recording queue could not be opened."));
    request.onblocked = () => reject(new Error("The recording queue is blocked by another browser tab."));
  });
}

function chunkKey(sessionId: string, chunkNumber: number): string {
  return `${sessionId}:${String(chunkNumber).padStart(10, "0")}`;
}

export async function ensureRecordingQueueSession(sessionId: string): Promise<RecordingQueueSession> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(SESSIONS_STORE, "readwrite");
      const store = transaction.objectStore(SESSIONS_STORE);
      let session: RecordingQueueSession | undefined;
      const request = store.get(sessionId);
      request.onsuccess = () => {
        session = request.result as RecordingQueueSession | undefined;
        if (!session) {
          session = {
            sessionId,
            lastChunkNumber: 0,
            lastElapsedSeconds: 0,
            startedAt: Date.now(),
            finalizePending: false,
          };
          store.put(session);
        }
      };
      transaction.oncomplete = () => {
        if (session) resolve(session);
        else reject(new Error("The recording queue session could not be initialized."));
      };
      transaction.onerror = () => reject(transaction.error || new Error("The recording queue session could not be initialized."));
      transaction.onabort = () => reject(transaction.error || new Error("The recording queue session was interrupted."));
    });
  } finally {
    database.close();
  }
}

export async function queueRecordingChunk(
  sessionId: string,
  chunkNumber: number,
  elapsedSeconds: number,
  blob: Blob,
): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction([CHUNKS_STORE, SESSIONS_STORE], "readwrite");
      const sessionStore = transaction.objectStore(SESSIONS_STORE);
      transaction.objectStore(CHUNKS_STORE).put({
        key: chunkKey(sessionId, chunkNumber),
        sessionId,
        chunkNumber,
        elapsedSeconds,
        blob,
      } satisfies QueuedRecordingChunk);
      const sessionRequest = sessionStore.get(sessionId);
      sessionRequest.onsuccess = () => {
        const session = sessionRequest.result as RecordingQueueSession | undefined;
        if (!session) {
          transaction.abort();
          return;
        }
        session.lastChunkNumber = Math.max(session.lastChunkNumber, chunkNumber);
        session.lastElapsedSeconds = Math.max(session.lastElapsedSeconds, elapsedSeconds);
        sessionStore.put(session);
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("The recording chunk could not be saved locally."));
      transaction.onabort = () => reject(transaction.error || new Error("The recording chunk could not be saved locally."));
    });
  } finally {
    database.close();
  }
}

export async function getQueuedRecordingChunks(sessionId: string): Promise<QueuedRecordingChunk[]> {
  const database = await openDatabase();
  try {
    const chunks = await new Promise<QueuedRecordingChunk[]>((resolve, reject) => {
      const transaction = database.transaction(CHUNKS_STORE, "readonly");
      const request = transaction.objectStore(CHUNKS_STORE).index("sessionId").getAll(sessionId);
      let result: QueuedRecordingChunk[] = [];
      request.onsuccess = () => {
        result = request.result as QueuedRecordingChunk[];
      };
      request.onerror = () => reject(request.error || new Error("The pending recording chunks could not be loaded."));
      transaction.oncomplete = () => resolve(result.sort((left, right) => left.chunkNumber - right.chunkNumber));
      transaction.onerror = () => reject(transaction.error || new Error("The pending recording chunks could not be loaded."));
      transaction.onabort = () => reject(transaction.error || new Error("The pending recording chunks could not be loaded."));
    });
    return chunks;
  } finally {
    database.close();
  }
}

export async function removeQueuedRecordingChunk(key: string): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(CHUNKS_STORE, "readwrite");
      transaction.objectStore(CHUNKS_STORE).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("The uploaded recording chunk could not be removed from the local queue."));
      transaction.onabort = () => reject(transaction.error || new Error("The uploaded recording chunk could not be removed from the local queue."));
    });
  } finally {
    database.close();
  }
}

export async function markRecordingQueueFinalizing(sessionId: string): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(SESSIONS_STORE, "readwrite");
      const store = transaction.objectStore(SESSIONS_STORE);
      const request = store.get(sessionId);
      request.onsuccess = () => {
        const session = request.result as RecordingQueueSession | undefined;
        if (!session) {
          transaction.abort();
          return;
        }
        session.finalizePending = true;
        store.put(session);
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("The recording could not be marked for final upload."));
      transaction.onabort = () => reject(transaction.error || new Error("The recording could not be marked for final upload."));
    });
  } finally {
    database.close();
  }
}

export async function getRecordingQueueSession(sessionId: string): Promise<RecordingQueueSession | null> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(SESSIONS_STORE, "readonly");
      const request = transaction.objectStore(SESSIONS_STORE).get(sessionId);
      request.onsuccess = () => resolve((request.result as RecordingQueueSession | undefined) || null);
      request.onerror = () => reject(request.error || new Error("The recording queue session could not be loaded."));
    });
  } finally {
    database.close();
  }
}

export async function clearRecordingQueueSession(sessionId: string): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction([CHUNKS_STORE, SESSIONS_STORE], "readwrite");
      const chunkStore = transaction.objectStore(CHUNKS_STORE);
      const cursorRequest = chunkStore.index("sessionId").openKeyCursor(sessionId);
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor) {
          chunkStore.delete(cursor.primaryKey);
          cursor.continue();
        }
      };
      transaction.objectStore(SESSIONS_STORE).delete(sessionId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("The completed recording queue could not be cleared."));
      transaction.onabort = () => reject(transaction.error || new Error("The completed recording queue could not be cleared."));
    });
  } finally {
    database.close();
  }
}

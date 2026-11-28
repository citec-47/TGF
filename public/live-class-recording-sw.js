const DATABASE_NAME = "tgf-live-recording-queue";
const DATABASE_VERSION = 2;
const CHUNKS_STORE = "chunks";
const SESSIONS_STORE = "sessions";
const SYNC_TAG = "tgf-live-recording-upload";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error || new Error("Recording storage is unavailable."));
    request.onsuccess = () => resolve(request.result);
  });
}

async function getSessions() {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(SESSIONS_STORE, "readonly")
        .objectStore(SESSIONS_STORE).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Pending recordings could not be loaded."));
    });
  } finally {
    database.close();
  }
}

async function getSession(sessionId) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(SESSIONS_STORE, "readonly")
        .objectStore(SESSIONS_STORE).get(sessionId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("The recording session could not be loaded."));
    });
  } finally {
    database.close();
  }
}

async function updateSession(sessionId, updates) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(SESSIONS_STORE, "readwrite");
      const store = transaction.objectStore(SESSIONS_STORE);
      let updated = null;
      const request = store.get(sessionId);
      request.onsuccess = () => {
        if (!request.result) {
          transaction.abort();
          return;
        }
        updated = { ...request.result, ...updates };
        store.put(updated);
      };
      transaction.oncomplete = () => resolve(updated);
      transaction.onerror = () => reject(transaction.error || new Error("Recording upload state could not be saved."));
      transaction.onabort = () => reject(transaction.error || new Error("Recording upload state could not be saved."));
    });
  } finally {
    database.close();
  }
}

async function claimSession(sessionId) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(SESSIONS_STORE, "readwrite");
      const store = transaction.objectStore(SESSIONS_STORE);
      let claimed = false;
      const request = store.get(sessionId);
      request.onsuccess = () => {
        const session = request.result;
        if (!session || (session.uploadLeaseUntil || 0) > Date.now()) return;
        session.uploadLeaseUntil = Date.now() + 120_000;
        store.put(session);
        claimed = true;
      };
      transaction.oncomplete = () => resolve(claimed);
      transaction.onerror = () => reject(transaction.error || new Error("Recording upload could not be claimed."));
      transaction.onabort = () => reject(transaction.error || new Error("Recording upload could not be claimed."));
    });
  } finally {
    database.close();
  }
}

async function getChunks(sessionId) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(CHUNKS_STORE, "readonly")
        .objectStore(CHUNKS_STORE).index("sessionId").getAll(sessionId);
      request.onsuccess = () => resolve(request.result.sort((left, right) => left.chunkNumber - right.chunkNumber));
      request.onerror = () => reject(request.error || new Error("Recording chunks could not be loaded."));
    });
  } finally {
    database.close();
  }
}

async function clearSession(sessionId) {
  const database = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction([CHUNKS_STORE, SESSIONS_STORE], "readwrite");
      const chunks = transaction.objectStore(CHUNKS_STORE);
      const cursorRequest = chunks.index("sessionId").openKeyCursor(sessionId);
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) return;
        chunks.delete(cursor.primaryKey);
        cursor.continue();
      };
      transaction.objectStore(SESSIONS_STORE).delete(sessionId);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("Uploaded recording could not be cleared."));
      transaction.onabort = () => reject(transaction.error || new Error("Uploaded recording could not be cleared."));
    });
  } finally {
    database.close();
  }
}

async function notifyClients(type, sessionId) {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of windows) client.postMessage({ type, sessionId });
}

async function requestJson(url, init = {}) {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
    ...init,
  });
  let result = {};
  try {
    result = await response.json();
  } catch {
    if (response.ok) throw new Error("The class service returned an invalid response.");
  }
  if (!response.ok) throw new Error(result.error || `The class request failed (${response.status}).`);
  return result;
}

async function uploadSession(sessionId) {
  if (!(await claimSession(sessionId))) return;
  try {
    let session = await getSession(sessionId);
    if (!session) return;
    if (!session.finalizePending) return;
    const chunks = await getChunks(sessionId);
    if (session.endClassPending) {
      if (chunks.length === 0) {
        await requestJson(`/api/collaboration/sessions/${encodeURIComponent(sessionId)}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recordingAvailable: false }),
        });
      }
      await requestJson(`/api/collaboration/sessions/${encodeURIComponent(sessionId)}/end`, { method: "POST" });
      session = await updateSession(sessionId, { endClassPending: false });
      await notifyClients("class-ended", sessionId);
    }
    if ((session.nextRetryAt || 0) > Date.now()) return;
    await notifyClients("recording-uploading", sessionId);
    if (chunks.length === 0) {
      await clearSession(sessionId);
      return;
    }
    const mimeType = session.mimeType || chunks.find((chunk) => chunk.blob.type)?.blob.type || "video/webm";
    const file = new Blob(chunks.map((chunk) => chunk.blob), { type: mimeType });
    const signature = await requestJson(
      `/api/collaboration/sessions/${encodeURIComponent(sessionId)}/recording-signature`,
      { method: "POST" },
    );
    const uploadId = session.uploadId || crypto.randomUUID();
    let uploadedBytes = Math.min(session.uploadedBytes || 0, file.size);
    let uploadResult = session.uploadConfirmed && uploadedBytes === file.size
      ? { public_id: signature.publicId, done: true }
      : null;
    await updateSession(sessionId, { uploadId, uploadedBytes, mimeType, uploadLeaseUntil: Date.now() + 120_000 });
    const chunkSize = 6 * 1024 * 1024;

    while (uploadedBytes < file.size) {
      const start = uploadedBytes;
      const end = Math.min(start + chunkSize, file.size);
      const form = new FormData();
      form.append("file", file.slice(start, end, mimeType), mimeType.includes("mp4") ? "recording.mp4" : "recording.webm");
      form.append("api_key", signature.apiKey);
      form.append("timestamp", signature.timestamp);
      form.append("public_id", signature.publicId);
      form.append("overwrite", signature.overwrite);
      form.append("type", signature.type);
      form.append("signature", signature.signature);
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(signature.cloudName)}/video/upload`,
        {
          method: "POST",
          headers: {
            "Content-Range": `bytes ${start}-${end - 1}/${file.size}`,
            "X-Unique-Upload-Id": uploadId,
          },
          body: form,
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || `Recording upload failed (${response.status}).`);
      uploadResult = result;
      uploadedBytes = end;
      await updateSession(sessionId, {
        uploadedBytes,
        uploadConfirmed: result.done === true && result.public_id === signature.publicId,
        uploadLeaseUntil: Date.now() + 120_000,
      });
    }

    if (!uploadResult?.done || uploadResult.public_id !== signature.publicId) {
      throw new Error("Recording storage did not confirm the completed upload.");
    }
    await requestJson(`/api/collaboration/sessions/${encodeURIComponent(sessionId)}/recording-complete`, {
      method: "POST",
    });
    await clearSession(sessionId);
    await notifyClients("recording-uploaded", sessionId);
  } catch (error) {
    const session = await getSession(sessionId).catch(() => null);
    if (session) {
      const retryCount = (session.retryCount || 0) + 1;
      const delay = Math.min(30_000 * (2 ** Math.min(retryCount - 1, 7)), 60 * 60 * 1000);
      await updateSession(sessionId, {
        retryCount,
        nextRetryAt: Date.now() + delay,
        uploadLeaseUntil: 0,
      }).catch(() => undefined);
    }
    throw error;
  } finally {
    await updateSession(sessionId, { uploadLeaseUntil: 0 }).catch(() => undefined);
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag !== SYNC_TAG) return;
  event.waitUntil((async () => {
    const sessions = await getSessions();
    let failed = false;
    for (const session of sessions) {
      if (!session.finalizePending) continue;
      try {
        await uploadSession(session.sessionId);
      } catch (error) {
        failed = true;
        console.warn("[live-class-recording] background upload will retry", session.sessionId, error);
      }
    }
    if (failed) throw new Error("One or more class recordings remain queued.");
  })());
});
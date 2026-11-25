import { v2 as cloudinary } from "cloudinary";

const EXPIRED_RECORDING_BATCH_SIZE = 50;

export async function moveRecordingToTrash(pool, sessionId, administratorId) {
  const result = await pool.query(
    `UPDATE tgf_live_sessions session
     SET recording_deleted_at = NOW(), recording_deleted_by = $2, updated_at = NOW()
     WHERE session.id = $1 AND session.recording_deleted_at IS NULL
       AND session.recording_status = 'ready'
       AND (
         COALESCE(session.recording_url, '') <> '' OR EXISTS (
           SELECT 1
           FROM tgf_live_recordings recording
           JOIN tgf_live_recording_parts part ON part.recording_id = recording.id
           WHERE recording.session_id = session.id
             AND recording.upload_status = 'ready'
             AND part.upload_status = 'ready'
             AND part.cloudinary_public_id <> ''
         )
       )
     RETURNING session.id`,
    [sessionId, administratorId],
  );
  return result.rows[0] || null;
}

export async function restoreRecordingFromTrash(pool, sessionId) {
  const result = await pool.query(
    `UPDATE tgf_live_sessions
     SET recording_deleted_at = NULL, recording_deleted_by = NULL, updated_at = NOW()
     WHERE id = $1 AND recording_deleted_at IS NOT NULL
       AND recording_purge_started_at IS NULL
       AND recording_deleted_at > NOW() - INTERVAL '30 days'
     RETURNING id`,
    [sessionId],
  );
  return result.rows[0] || null;
}

export async function deletePrivateRecordingAssets(
  publicIds,
  {
    client = cloudinary,
    cloudName = process.env.CLOUDINARY_CLOUD_NAME,
    apiKey = process.env.CLOUDINARY_API_KEY,
    apiSecret = process.env.CLOUDINARY_API_SECRET,
  } = {},
) {
  const uniquePublicIds = [...new Set(publicIds.filter((publicId) => typeof publicId === "string" && publicId))];
  if (!uniquePublicIds.length) return;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary is not configured for permanent recording deletion.");
  }

  client.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  for (const publicId of uniquePublicIds) {
    const result = await client.uploader.destroy(publicId, {
      resource_type: "video",
      type: "authenticated",
      invalidate: true,
    });
    if (result?.result !== "ok" && result?.result !== "not found") {
      throw new Error("Cloudinary could not permanently delete a recording video.");
    }
  }
}

export async function permanentlyDeleteRecordingFromTrash(
  pool,
  sessionId,
  deleteAssets = deletePrivateRecordingAssets,
) {
  const client = await pool.connect();
  let transactionOpen = false;
  let session;
  let publicIds;
  try {
    await client.query("BEGIN");
    transactionOpen = true;
    const sessionResult = await client.query(
      `SELECT session.id, session.recording_status, session.recording_url,
              session.cloudinary_public_id, session.recording_purge_started_at,
              programme.title || ' · ' || to_char(session.class_date, 'Mon DD, YYYY') AS title
       FROM tgf_live_sessions session
       JOIN tgf_programmes programme ON programme.id = session.programme_id
       WHERE session.id = $1 AND session.recording_deleted_at IS NOT NULL
       FOR UPDATE OF session`,
      [sessionId],
    );
    session = sessionResult.rows[0];
    if (!session) {
      await client.query("COMMIT");
      transactionOpen = false;
      return null;
    }

    const partsResult = await client.query(
      `SELECT part.cloudinary_public_id, part.secure_url
       FROM tgf_live_recordings recording
       JOIN tgf_live_recording_parts part ON part.recording_id = recording.id
       WHERE recording.session_id = $1`,
      [sessionId],
    );
    publicIds = [];
    if (session.recording_url && !session.cloudinary_public_id) {
      throw new Error("The legacy recording asset identifier is missing.");
    }
    if (session.cloudinary_public_id) publicIds.push(session.cloudinary_public_id);
    for (const part of partsResult.rows) {
      if (part.secure_url && !part.cloudinary_public_id) {
        throw new Error("A recording part asset identifier is missing.");
      }
      if (part.cloudinary_public_id) publicIds.push(part.cloudinary_public_id);
    }
    if (session.recording_status === "ready" && publicIds.length === 0) {
      throw new Error("The recording video assets could not be identified.");
    }

    await client.query(
      `UPDATE tgf_live_sessions
       SET recording_purge_started_at = COALESCE(recording_purge_started_at, NOW())
       WHERE id = $1`,
      [sessionId],
    );
    await client.query("COMMIT");
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await deleteAssets(publicIds);

  const finalizeClient = await pool.connect();
  transactionOpen = false;
  try {
    await finalizeClient.query("BEGIN");
    transactionOpen = true;
    const current = await finalizeClient.query(
      `SELECT session.id
       FROM tgf_live_sessions session
       WHERE session.id = $1 AND session.recording_deleted_at IS NOT NULL
         AND session.recording_purge_started_at IS NOT NULL
       FOR UPDATE OF session`,
      [sessionId],
    );
    if (!current.rows[0]) {
      await finalizeClient.query("COMMIT");
      transactionOpen = false;
      return null;
    }

    await finalizeClient.query("DELETE FROM tgf_live_recordings WHERE session_id = $1", [sessionId]);
    await finalizeClient.query(
      `UPDATE tgf_live_sessions
       SET recording_status = 'failed', recording_url = '', cloudinary_public_id = '',
           recording_error = '',
           recording_hidden_from_admin_at = COALESCE(recording_hidden_from_admin_at, NOW()),
           recording_hidden_from_teacher_at = COALESCE(recording_hidden_from_teacher_at, NOW()),
           recording_deleted_at = NULL, recording_deleted_by = NULL,
           recording_purge_started_at = NULL, updated_at = NOW()
       WHERE id = $1`,
      [sessionId],
    );
    await finalizeClient.query("COMMIT");
    transactionOpen = false;
    return { id: session.id, title: session.title };
  } catch (error) {
    if (transactionOpen) await finalizeClient.query("ROLLBACK");
    throw error;
  } finally {
    finalizeClient.release();
  }
}

export async function purgeExpiredRecordingTrash(pool) {
  const expired = await pool.query(
    `SELECT id
     FROM tgf_live_sessions
    WHERE recording_deleted_at IS NOT NULL
      AND (
        recording_purge_started_at IS NOT NULL
        OR recording_deleted_at <= NOW() - INTERVAL '30 days'
      )
     ORDER BY COALESCE(recording_purge_started_at, recording_deleted_at)
     LIMIT $1`,
    [EXPIRED_RECORDING_BATCH_SIZE],
  );
  let purged = 0;
  let failed = 0;
  for (const row of expired.rows) {
    try {
      if (await permanentlyDeleteRecordingFromTrash(pool, row.id)) purged += 1;
    } catch {
      failed += 1;
    }
  }
  return { purged, failed };
}

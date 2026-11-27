export async function markLiveSessionParticipantJoined(pool, sessionId, participantId) {
  const result = await pool.query(
    `INSERT INTO tgf_live_session_attendance
       (session_id, user_id, participant_role, first_joined_at, current_joined_at, last_left_at, total_seconds)
     SELECT session.id, learner.id, 'learner', NOW(), NOW(), NULL, 0
     FROM tgf_live_sessions session
     JOIN tgf_users learner ON learner.id = $2
       AND learner.role = 'learner' AND learner.account_status = 'active'
       AND learner.is_frozen = FALSE
     JOIN tgf_enrollments enrollment ON enrollment.user_id = learner.id
       AND enrollment.programme_id = session.programme_id
       AND enrollment.approval_status = 'approved'
     WHERE session.id = $1 AND session.ended_at IS NULL
     ON CONFLICT (session_id, user_id) DO UPDATE SET
       current_joined_at = COALESCE(tgf_live_session_attendance.current_joined_at, NOW()),
       last_left_at = NULL
     RETURNING user_id`,
    [sessionId, participantId],
  );
  if (result.rowCount !== 1) {
    throw new Error("Student attendance could not be recorded.");
  }
}

export async function markLiveSessionParticipantLeft(pool, sessionId, participantId) {
  await pool.query(
    `UPDATE tgf_live_session_attendance
     SET total_seconds = total_seconds +
           GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - current_joined_at)))::integer),
         current_joined_at = NULL, last_left_at = NOW()
     WHERE session_id = $1 AND user_id = $2 AND current_joined_at IS NOT NULL`,
    [sessionId, participantId],
  );
}

export async function listLiveSessionAttendees(pool, sessionId) {
  const result = await pool.query(
    `SELECT attendance.user_id, attendance.participant_role, attendance.microphone_allowed,
            learner.full_name,
            attendance.first_joined_at,
            (attendance.current_joined_at IS NOT NULL) AS is_present,
            attendance.total_seconds +
              CASE WHEN attendance.current_joined_at IS NOT NULL
                THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - attendance.current_joined_at)))::integer)
                ELSE 0
              END AS attendance_seconds
     FROM tgf_live_session_attendance attendance
     JOIN tgf_users learner ON learner.id = attendance.user_id
     WHERE attendance.session_id = $1
     ORDER BY attendance.first_joined_at, learner.full_name`,
    [sessionId],
  );
  return result.rows.map((row) => {
    const firstJoinedAt = new Date(row.first_joined_at);
    if (!Number.isFinite(firstJoinedAt.getTime())) {
      throw new Error("A live-class attendance record has an invalid join time.");
    }
    return {
      id: row.user_id,
      name: row.full_name,
      role: row.participant_role,
      microphoneAllowed: row.microphone_allowed,
      firstJoinedAt: firstJoinedAt.toISOString(),
      attendanceSeconds: Number(row.attendance_seconds),
      isPresent: row.is_present,
    };
  });
}

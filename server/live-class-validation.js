const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export function isLiveClassUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function authorizeLiveClassAccess({
  role,
  userId,
  teacherId,
  enrolled,
  invited,
  scheduled,
}) {
  if (role === "teacher") {
    return userId === teacherId
      ? { allowed: true, role: "teacher" }
      : { allowed: false, role: null };
  }
  if (role === "administrator") return { allowed: true, role: "administrator" };
  if (role === "learner" && enrolled) {
    return { allowed: true, role: "student" };
  }
  return { allowed: false, role: null };
}

export function getLiveClassConfig(env = process.env) {
  const minPort = Number(env.MEDIASOUP_MIN_PORT || 40000);
  const maxPort = Number(env.MEDIASOUP_MAX_PORT || 49999);
  const maxStudents = Number(env.LIVE_CLASS_MAX_STUDENTS || 16);
  const partMinutes = Number(env.RECORDING_PART_MINUTES || 15);
  if (!Number.isInteger(minPort) || !Number.isInteger(maxPort) ||
      minPort < 1 || maxPort > 65535 || minPort >= maxPort) {
    throw new Error("Set a valid MEDIASOUP_MIN_PORT and MEDIASOUP_MAX_PORT range.");
  }
  if (!Number.isInteger(maxStudents) || maxStudents < 1 || maxStudents > 16) {
    throw new Error("LIVE_CLASS_MAX_STUDENTS must be between 1 and 16 for this mediasoup server.");
  }
  if (!Number.isInteger(partMinutes) || partMinutes < 1 || partMinutes > 60) {
    throw new Error("RECORDING_PART_MINUTES must be between 1 and 60.");
  }
  return {
    listenIp: env.MEDIASOUP_LISTEN_IP || "0.0.0.0",
    announcedIp: env.MEDIASOUP_ANNOUNCED_IP || "",
    minPort,
    maxPort,
    maxStudents,
    partMinutes,
    iceServers: [
      ...(env.STUN_URL ? [{ urls: env.STUN_URL }] : []),
      ...(env.TURN_URL && env.TURN_USERNAME && env.TURN_CREDENTIAL
        ? [{ urls: env.TURN_URL, username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL }]
        : []),
    ],
  };
}

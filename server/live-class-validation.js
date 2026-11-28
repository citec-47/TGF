import { isIP } from "node:net";

const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export function isLiveClassUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function getLiveClassConfig(env = process.env) {
  const enabled = env.MEDIASOUP_ENABLED === "true";
  const minPort = Number(env.MEDIASOUP_MIN_PORT || 40000);
  const maxPort = Number(env.MEDIASOUP_MAX_PORT || 49999);
  const maxStudents = Number(env.LIVE_CLASS_MAX_STUDENTS || 16);
  const listenIp = env.MEDIASOUP_LISTEN_IP || "0.0.0.0";
  const announcedIp = env.MEDIASOUP_ANNOUNCED_IP || "";
  const hasTurnConfig = Boolean(env.TURN_URL || env.TURN_USERNAME || env.TURN_CREDENTIAL);

  if (!Number.isInteger(minPort) || !Number.isInteger(maxPort) ||
      minPort < 1 || maxPort > 65535 || minPort >= maxPort) {
    throw new Error("Set a valid MEDIASOUP_MIN_PORT and MEDIASOUP_MAX_PORT range.");
  }
  if (!Number.isInteger(maxStudents) || maxStudents < 1 || maxStudents > 16) {
    throw new Error("LIVE_CLASS_MAX_STUDENTS must be between 1 and 16.");
  }
  if (enabled && env.NODE_ENV === "production" && !announcedIp) {
    throw new Error("Set MEDIASOUP_ANNOUNCED_IP to the media server's public IP address.");
  }
  if (announcedIp && !isIP(announcedIp)) {
    throw new Error("MEDIASOUP_ANNOUNCED_IP must be an IPv4 or IPv6 address.");
  }
  if (hasTurnConfig && (!env.TURN_URL || !env.TURN_USERNAME || !env.TURN_CREDENTIAL)) {
    throw new Error("Set TURN_URL, TURN_USERNAME, and TURN_CREDENTIAL together.");
  }

  return {
    enabled,
    listenIp,
    announcedIp,
    minPort,
    maxPort,
    maxStudents,
    iceServers: [
      ...(env.STUN_URL ? [{ urls: env.STUN_URL }] : []),
      ...(hasTurnConfig
        ? [{ urls: env.TURN_URL, username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL }]
        : []),
    ],
  };
}

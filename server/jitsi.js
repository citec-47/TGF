import { createPrivateKey, createSign } from "node:crypto";

const TOKEN_TTL_SECONDS = 15 * 60;
const ROOM_NAME_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function requiredValue(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required.`);
  }
  return value.trim();
}

function getJitsiConfig(env) {
  const rawDomain = requiredValue(env.JITSI_DOMAIN || "8x8.vc", "JITSI_DOMAIN");
  let url;
  try {
    url = new URL(rawDomain.includes("://") ? rawDomain : `https://${rawDomain}`);
  } catch {
    throw new Error("JITSI_DOMAIN must be a valid HTTPS hostname.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" ||
      url.search || url.hash) {
    throw new Error("JITSI_DOMAIN must be an HTTPS hostname without a path or credentials.");
  }

  return {
    domain: url.host,
    appId: requiredValue(env.JITSI_APP_ID, "JITSI_APP_ID"),
    keyId: requiredValue(env.JITSI_KID, "JITSI_KID"),
    privateKey: createPrivateKey(
      requiredValue(env.JITSI_PRIVATE_KEY, "JITSI_PRIVATE_KEY").replace(/\\n/g, "\n"),
    ),
  };
}

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

export function createJitsiJoinConfig(
  { userId, name, email = "", role, roomName },
  env = process.env,
  now = Date.now(),
) {
  if (!["teacher", "learner"].includes(role)) {
    throw new Error("Only the assigned tutor or an enrolled student can join a JaaS room.");
  }
  if (typeof userId !== "string" || !userId.trim() ||
      typeof name !== "string" || !name.trim() ||
      typeof email !== "string" ||
      typeof roomName !== "string" || !ROOM_NAME_PATTERN.test(roomName)) {
    throw new Error("JaaS participant or room details are invalid.");
  }

  const config = getJitsiConfig(env);
  const issuedAt = Math.floor(now / 1000);
  const payload = {
    aud: "jitsi",
    context: {
      user: {
        id: userId,
        name: name.trim(),
        email,
        moderator: role === "teacher" ? "true" : "false",
      },
      features: {
        livestreaming: "false",
        recording: "false",
        transcription: "false",
        "outbound-call": "false",
      },
    },
    iss: "chat",
    room: roomName,
    sub: config.appId,
    exp: issuedAt + TOKEN_TTL_SECONDS,
    nbf: issuedAt - 10,
  };
  const header = {
    alg: "RS256",
    typ: "JWT",
    kid: config.keyId,
  };
  const unsignedToken = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  const token = `${unsignedToken}.${signer.sign(config.privateKey, "base64url")}`;

  return {
    domain: config.domain,
    appId: config.appId,
    roomName: `${config.appId}/${roomName}`,
    token,
  };
}

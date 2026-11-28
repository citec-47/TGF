const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const MAX_SIGNAL_BYTES = 16_000;

export function normalizePeerMediaSignal(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { type, payload } = value;
  if (!["offer", "answer", "candidate"].includes(type) ||
      !payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  if (type === "offer" || type === "answer") {
    if (payload.type !== type || typeof payload.sdp !== "string" ||
        payload.sdp.length === 0 || payload.sdp.length > 12000) {
      return null;
    }
  } else if (
    typeof payload.candidate !== "string" ||
    payload.candidate.length === 0 ||
    payload.candidate.length > 4096 ||
    (payload.sdpMid !== null && payload.sdpMid !== undefined && typeof payload.sdpMid !== "string") ||
    (payload.sdpMLineIndex !== null && payload.sdpMLineIndex !== undefined &&
      (!Number.isInteger(payload.sdpMLineIndex) || payload.sdpMLineIndex < 0))
  ) {
    return null;
  }
  let encoded;
  try {
    encoded = JSON.stringify(payload);
  } catch {
    return null;
  }
  if (Buffer.byteLength(encoded, "utf8") > MAX_SIGNAL_BYTES) return null;
  return { type, payload };
}

export function isPeerMediaUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

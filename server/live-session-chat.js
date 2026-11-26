export const LIVE_CLASS_CHAT_TOPIC = "tgf-live-class-chat";
export const LIVE_CLASS_CHAT_MAX_BODY_LENGTH = 2000;

export function isLiveClassChatMessageId(value) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
}

export function normalizeLiveClassChatBody(value) {
  if (typeof value !== "string") return null;
  const body = value.trim();
  return body.length > 0 && body.length <= LIVE_CLASS_CHAT_MAX_BODY_LENGTH ? body : null;
}

export function canShowLiveClassChatEmail({
  viewerId,
  viewerRole,
  senderId,
  showAllEmails = false,
}) {
  return showAllEmails || viewerRole === "administrator" || viewerRole === "teacher" ||
    viewerId === senderId;
}

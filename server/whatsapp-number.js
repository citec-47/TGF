export function normalizeWhatsAppNumber(value) {
  if (typeof value !== "string") {
    return { error: "Enter a WhatsApp number with its international country code." };
  }

  const trimmed = value.trim();
  const compact = trimmed.replace(/[\s().-]/g, "");
  const international = compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
  if (!/^\+[1-9]\d{7,14}$/.test(international)) {
    return { error: "Enter a valid WhatsApp number with its international country code, such as +237671234567." };
  }

  return { whatsappNumber: international };
}

const PRIVATE_FILE_TYPES = new Map([
  [".pdf", { contentType: "application/pdf", format: "pdf" }],
  [".jpg", { contentType: "image/jpeg", format: "jpg" }],
  [".jpeg", { contentType: "image/jpeg", format: "jpg" }],
  [".png", { contentType: "image/png", format: "png" }],
  [".doc", { contentType: "application/msword", format: "doc" }],
  [".docx", {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    format: "docx",
  }],
  [".webp", { contentType: "image/webp", format: "webp", media: true }],
  [".gif", { contentType: "image/gif", format: "gif", media: true }],
  [".mp4", { contentType: "video/mp4", format: "mp4", media: true }],
  [".mov", { contentType: "video/quicktime", format: "mov", media: true }],
  [".webm", { contentType: "video/webm", format: "webm", media: true }],
]);

export function getPrivateFileType(extension, contentType, header, allowMedia = false) {
  const expected = PRIVATE_FILE_TYPES.get(extension);
  if (!expected || (expected.media && !allowMedia) || expected.contentType !== contentType) {
    return null;
  }

  const startsWith = (...bytes) => bytes.every((byte, index) => header[index] === byte);
  const matchesAscii = (offset, text) =>
    text.split("").every((character, index) => header[offset + index] === character.charCodeAt(0));
  const signatureValid =
    (expected.format === "pdf" && matchesAscii(0, "%PDF-")) ||
    (expected.format === "jpg" && startsWith(0xff, 0xd8, 0xff)) ||
    (expected.format === "png" && startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) ||
    (expected.format === "doc" && startsWith(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)) ||
    (expected.format === "docx" && startsWith(0x50, 0x4b, 0x03, 0x04)) ||
    (expected.format === "webp" && matchesAscii(0, "RIFF") && matchesAscii(8, "WEBP")) ||
    (expected.format === "gif" && (matchesAscii(0, "GIF87a") || matchesAscii(0, "GIF89a"))) ||
    (["mp4", "mov"].includes(expected.format) && matchesAscii(4, "ftyp")) ||
    (expected.format === "webm" && startsWith(0x1a, 0x45, 0xdf, 0xa3));

  return signatureValid ? { contentType: expected.contentType, format: expected.format } : null;
}

export function getPrivateCloudinaryUploadMismatches(result, publicId, fileSize) {
  return [
    result.public_id !== publicId && "public_id",
    result.resource_type !== "raw" && "resource_type",
    result.type !== "authenticated" && "type",
    Number(result.bytes) !== fileSize && "bytes",
  ].filter(Boolean);
}

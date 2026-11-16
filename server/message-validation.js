export const DEFAULT_MESSAGE_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;
export const MAX_MESSAGE_ATTACHMENTS = 5;

const TYPES = new Map([
  [".pdf", { contentType: "application/pdf", format: "pdf" }],
  [".doc", { contentType: "application/msword", format: "doc" }],
  [".docx", {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    format: "docx",
  }],
  [".jpg", { contentType: "image/jpeg", format: "jpg" }],
  [".jpeg", { contentType: "image/jpeg", format: "jpg" }],
  [".png", { contentType: "image/png", format: "png" }],
  [".webp", { contentType: "image/webp", format: "webp" }],
  [".mp4", { contentType: "video/mp4", format: "mp4" }],
  [".mov", { contentType: "video/quicktime", format: "mov" }],
  [".webm", { contentType: "video/webm", mimeTypes: ["video/webm", "audio/webm"], format: "webm" }],
  [".mp3", { contentType: "audio/mpeg", format: "mp3" }],
  [".wav", { contentType: "audio/wav", mimeTypes: ["audio/wav", "audio/x-wav"], format: "wav" }],
  [".m4a", { contentType: "audio/mp4", format: "m4a" }],
  [".ogg", { contentType: "audio/ogg", format: "ogg" }],
]);

export function validateMessageAttachment({ fileName, mimeType, size, header, maxBytes }) {
  const cleanName = typeof fileName === "string"
    ? fileName
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .replace(/([\uD800-\uDBFF][\uDC00-\uDFFF])|[\uD800-\uDFFF]/g, (match, pair) => pair || "_")
      .replace(/\\/g, "/")
      .split("/")
      .pop()
      .slice(0, 200)
    : "";
  const expected = TYPES.get(cleanName ? `.${cleanName.split(".").pop().toLowerCase()}` : "");
  if (!expected || (mimeType &&
      !(expected.mimeTypes || [expected.contentType]).includes(mimeType))) {
    return { error: "Choose a PDF, Word, image, video or supported audio file." };
  }
  if (!Number.isSafeInteger(size) || size < 1 || size > maxBytes) {
    return { error: `Each attachment must be between 1 byte and ${Math.floor(maxBytes / (1024 * 1024))} MB.` };
  }

  const bytes = Buffer.from(header || []);
  const startsWith = (...values) => values.every((value, index) => bytes[index] === value);
  let signatureValid = false;
  switch (expected.format) {
    case "pdf":
      signatureValid = bytes.subarray(0, 5).toString("ascii") === "%PDF-";
      break;
    case "doc":
      signatureValid = startsWith(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
      break;
    case "docx": {
      if (startsWith(0x50, 0x4b, 0x03, 0x04) && bytes.length >= 30) {
        const nameLength = bytes.readUInt16LE(26);
        const entryName = bytes.subarray(30, 30 + nameLength).toString("utf8");
        signatureValid = entryName === "[Content_Types].xml" || entryName.startsWith("word/");
      }
      break;
    }
    case "jpg":
      signatureValid = startsWith(0xff, 0xd8, 0xff);
      break;
    case "png":
      signatureValid = startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
      break;
    case "webp":
      signatureValid =
        bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
        bytes.subarray(8, 12).toString("ascii") === "WEBP";
      break;
    case "mp4":
      signatureValid = bytes.subarray(4, 8).toString("ascii") === "ftyp";
      break;
    case "mov":
      signatureValid =
        bytes.subarray(4, 8).toString("ascii") === "ftyp" &&
        bytes.subarray(8, 12).toString("ascii") === "qt  ";
      break;
    case "webm":
      signatureValid =
        startsWith(0x1a, 0x45, 0xdf, 0xa3) &&
        bytes.subarray(0, 512).includes(Buffer.from("webm"));
      break;
    case "mp3":
      signatureValid = bytes.subarray(0, 3).toString("ascii") === "ID3" ||
        (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
      break;
    case "wav":
      signatureValid =
        bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
        bytes.subarray(8, 12).toString("ascii") === "WAVE";
      break;
    case "m4a":
      signatureValid =
        bytes.subarray(4, 8).toString("ascii") === "ftyp" &&
        ["M4A ", "isom", "mp42", "M4V "].includes(bytes.subarray(8, 12).toString("ascii"));
      break;
    case "ogg":
      signatureValid = bytes.subarray(0, 4).toString("ascii") === "OggS";
      break;
    default:
      break;
  }
  if (!signatureValid) return { error: "The file contents do not match the selected file type." };

  return {
    contentType: mimeType || expected.contentType,
    format: expected.format,
    filename: cleanName,
  };
}

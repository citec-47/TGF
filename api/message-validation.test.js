import assert from "node:assert/strict";
import test from "node:test";
import { validateMessageAttachment } from "./message-validation.js";

const maxBytes = 10 * 1024 * 1024;

function check(fileName, mimeType, signature, overrides = {}) {
  const header = Buffer.isBuffer(signature) ? signature : Buffer.from(signature);
  return validateMessageAttachment({
    fileName,
    mimeType,
    size: header.length || 100,
    header,
    maxBytes,
    ...overrides,
  });
}

test("accepts supported document, image and media signatures", () => {
  assert.equal(check("guide.pdf", "application/pdf", "%PDF-1.7").format, "pdf");
  assert.equal(check("lesson.doc", "application/msword", Buffer.from([
    0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
  ])).format, "doc");
  assert.equal(check("photo.jpg", "image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xd9])).format, "jpg");
  assert.equal(check("photo.png", "image/png", Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ])).format, "png");
  assert.equal(check("image.webp", "image/webp", "RIFF0000WEBP").format, "webp");
  assert.equal(check("clip.mp4", "video/mp4", "0000ftypisom").format, "mp4");
  assert.equal(check("clip.mov", "video/quicktime", "0000ftypqt  ").format, "mov");
  assert.equal(check("clip.webm", "video/webm", Buffer.concat([
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
    Buffer.from("webm"),
  ])).format, "webm");
  assert.equal(check("voice.mp3", "audio/mpeg", "ID3").format, "mp3");
  assert.equal(check("voice.wav", "audio/wav", "RIFF0000WAVE").format, "wav");
  assert.equal(check("voice.m4a", "audio/mp4", "0000ftypM4A ").format, "m4a");
  assert.equal(check("voice.ogg", "audio/ogg", "OggS").format, "ogg");
  assert.equal(check("voice.webm", "audio/webm", Buffer.concat([
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
    Buffer.from("webm"),
  ])).contentType, "audio/webm");
});

test("rejects mismatched, unsupported and oversized uploads", () => {
  assert.ok(check("invoice.pdf", "application/pdf", "not a pdf").error);
  assert.ok(check("renamed.pdf", "application/pdf", "RIFF0000WEBP").error);
  assert.ok(check("macro.xlsm", "application/vnd.ms-excel.sheet.macroEnabled.12", "PK\x03\x04").error);
  assert.ok(check("too-large.pdf", "application/pdf", "%PDF-", { size: maxBytes + 1 }).error);
});

test("accepts a DOCX only when the ZIP begins with a Word package entry", () => {
  const header = Buffer.alloc(60);
  header.set([0x50, 0x4b, 0x03, 0x04], 0);
  header.writeUInt16LE(19, 26);
  header.write("[Content_Types].xml", 30, "ascii");
  assert.equal(check("lesson.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", header).format, "docx");
  assert.ok(check("fake.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "PK\x03\x04").error);
});

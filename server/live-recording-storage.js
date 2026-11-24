import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export async function saveRecordingChunkFile(directory, chunkNumber, data) {
  if (!Number.isSafeInteger(chunkNumber) || chunkNumber < 1 || !Buffer.isBuffer(data) || data.length === 0) {
    throw new TypeError("Recording chunk storage details are invalid.");
  }
  const chunksDirectory = path.join(directory, "chunks");
  await mkdir(chunksDirectory, { recursive: true });
  const chunkPath = path.join(chunksDirectory, `chunk-${String(chunkNumber).padStart(10, "0")}.webm`);
  const temporaryChunkPath = `${chunkPath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryChunkPath, data, { flag: "wx" });
    await rename(temporaryChunkPath, chunkPath);
  } finally {
    await rm(temporaryChunkPath, { force: true });
  }
  return chunkPath;
}

export async function assembleRecordingPartFile(directory, partNumber, chunkNumbers) {
  if (!Number.isSafeInteger(partNumber) || partNumber < 1 ||
      !Array.isArray(chunkNumbers) ||
      chunkNumbers.some((number) => !Number.isSafeInteger(number) || number < 1)) {
    throw new TypeError("Recording part assembly details are invalid.");
  }
  const filePath = path.join(directory, `part-${partNumber}.webm`);
  await mkdir(directory, { recursive: true });
  await writeFile(filePath, Buffer.alloc(0));
  for (const chunkNumber of [...chunkNumbers].sort((left, right) => left - right)) {
    const chunkPath = path.join(
      directory,
      "chunks",
      `chunk-${String(chunkNumber).padStart(10, "0")}.webm`,
    );
    await appendFile(filePath, await readFile(chunkPath));
  }
  return filePath;
}

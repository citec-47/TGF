import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { assembleRecordingPartFile, saveRecordingChunkFile } from "./live-recording-storage.js";

test("retries replace a recording chunk instead of appending duplicate data", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "tgf-live-recording-"));
  try {
    const chunk = Buffer.from("recording chunk");
    await saveRecordingChunkFile(directory, 1, chunk);
    await saveRecordingChunkFile(directory, 1, chunk);
    const stored = await readFile(path.join(directory, "chunks", "chunk-0000000001.webm"));
    assert.deepEqual(stored, chunk);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("assembles recording parts in chunk order", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "tgf-live-recording-"));
  try {
    await saveRecordingChunkFile(directory, 2, Buffer.from("second"));
    await saveRecordingChunkFile(directory, 1, Buffer.from("first"));
    const partPath = await assembleRecordingPartFile(directory, 1, [2, 1]);
    assert.equal(await readFile(partPath, "utf8"), "firstsecond");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects invalid chunk identifiers and empty payloads", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "tgf-live-recording-"));
  try {
    await assert.rejects(saveRecordingChunkFile(directory, 0, Buffer.from("chunk")), /invalid/);
    await assert.rejects(saveRecordingChunkFile(directory, 1, Buffer.alloc(0)), /invalid/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

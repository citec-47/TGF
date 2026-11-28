import "dotenv/config";
import http from "node:http";
import next from "next";
import pg from "pg";
import { purgeExpiredRecordingTrash } from "./recording-trash.js";
import { createLiveClassSfu } from "./live-class-sfu.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 10_000,
});

await app.prepare();

const server = http.createServer((request, response) => {
  void handle(request, response);
});
const liveClassSfu = await createLiveClassSfu(server, pool);
if (!liveClassSfu) {
  console.info("Live-class media is disabled. Set MEDIASOUP_ENABLED=true to enable it.");
}

let recordingTrashCleanupRunning = false;
const recordingTrashCleanup = setInterval(async () => {
  if (recordingTrashCleanupRunning) return;
  recordingTrashCleanupRunning = true;
  try {
    const result = await purgeExpiredRecordingTrash(pool);
    if (result.failed) {
      console.error(`Automatic class recording cleanup could not delete ${result.failed} video(s).`);
    }
  } catch {
    console.error("Automatic class recording cleanup could not run.");
  } finally {
    recordingTrashCleanupRunning = false;
  }
}, 60 * 60 * 1000);
recordingTrashCleanup.unref();

server.listen(port, hostname, () => {
  console.log(`TGF live class server ready at http://localhost:${port}`);
});

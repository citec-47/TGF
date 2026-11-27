import "dotenv/config";
import http from "node:http";
import pg from "pg";
import { createLiveClassSfu } from "./live-class-sfu.js";

const { Pool } = pg;
const host = process.env.LIVE_CLASS_SFU_HOST || "0.0.0.0";
const port = Number(process.env.LIVE_CLASS_SFU_PORT || 3001);

if (!process.env.DATABASE_URL?.trim()) {
  throw new Error("DATABASE_URL is required to start the live-class SFU.");
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("LIVE_CLASS_SFU_PORT must be a valid TCP port.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 10_000,
});
const server = http.createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    });
    response.end(JSON.stringify({ ok: true, service: "live-class-sfu" }));
    return;
  }
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
});

let sfu;
try {
  await pool.query("SELECT 1");
  sfu = await createLiveClassSfu(server, pool);
  await new Promise((resolve, reject) => {
    const onError = (error) => reject(error);
    server.once("error", onError);
    server.listen(port, host, () => {
      server.removeListener("error", onError);
      resolve();
    });
  });
} catch (error) {
  if (sfu) await sfu.close();
  await pool.end();
  throw error;
}

console.info(`TGF live-class SFU ready on ${host}:${port}.`);

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`Stopping live-class SFU after ${signal}.`);
  try {
    await sfu.close();
    await pool.end();
  } catch (error) {
    console.error("Could not shut down the live-class SFU cleanly.", error);
    process.exitCode = 1;
  }
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

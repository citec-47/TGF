import "dotenv/config";
import http from "node:http";
import next from "next";
import pg from "pg";
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

try {
  await createLiveClassSfu(server, pool);
} catch (error) {
  console.error("Mediasoup live-class server unavailable:", error instanceof Error ? error.message : error);
  console.error("Install the Microsoft Visual C++ runtime on Windows to enable live classes.");
}

server.listen(port, hostname, () => {
  console.log(`TGF live class server ready at http://localhost:${port}`);
});

import test from "node:test";
import assert from "node:assert/strict";
import { isPeerMediaUuid, normalizePeerMediaSignal } from "./live-session-peer.js";

test("accepts valid descriptions and ICE candidates", () => {
  assert.deepEqual(normalizePeerMediaSignal({
    type: "offer",
    payload: { type: "offer", sdp: "v=0\r\n" },
  }), { type: "offer", payload: { type: "offer", sdp: "v=0\r\n" } });
  assert.deepEqual(normalizePeerMediaSignal({
    type: "candidate",
    payload: { candidate: "candidate:1 1 UDP 1 192.0.2.1 5000 typ host", sdpMLineIndex: 0 },
  }), {
    type: "candidate",
    payload: { candidate: "candidate:1 1 UDP 1 192.0.2.1 5000 typ host", sdpMLineIndex: 0 },
  });
});

test("rejects malformed, oversized, and mismatched peer signals", () => {
  assert.equal(normalizePeerMediaSignal(null), null);
  assert.equal(normalizePeerMediaSignal({ type: "offer", payload: { type: "answer", sdp: "x" } }), null);
  assert.equal(normalizePeerMediaSignal({
    type: "offer",
    payload: { type: "offer", sdp: "x".repeat(12001) },
  }), null);
  assert.equal(normalizePeerMediaSignal({
    type: "candidate",
    payload: { candidate: "", sdpMLineIndex: -1 },
  }), null);
});

test("validates peer participant identifiers", () => {
  assert.equal(isPeerMediaUuid("d4f8e377-83bf-4014-9b5b-86a7a527af57"), true);
  assert.equal(isPeerMediaUuid("not-a-uuid"), false);
});

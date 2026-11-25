import assert from "node:assert/strict";
import test from "node:test";
import { normalizeWhatsAppNumber } from "./whatsapp-number.js";

test("normalizes international WhatsApp numbers to a compact plus-prefixed format", () => {
  assert.deepEqual(normalizeWhatsAppNumber("+237 671 234 567"), {
    whatsappNumber: "+237671234567",
  });
  assert.deepEqual(normalizeWhatsAppNumber("00 237 (671) 234-567"), {
    whatsappNumber: "+237671234567",
  });
});

test("rejects numbers without a valid international country code", () => {
  for (const value of ["671234567", "+0237671234567", "+1234567", "+1234567890123456", "not a number"]) {
    assert.match(normalizeWhatsAppNumber(value).error, /WhatsApp number/);
  }
  assert.match(normalizeWhatsAppNumber(null).error, /WhatsApp number/);
});

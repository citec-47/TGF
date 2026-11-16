import test from "node:test";
import assert from "node:assert/strict";
import { extractGeminiOutputText, generateGeminiCurriculum } from "./gemini-curriculum.js";

test("extracts Gemini text from both REST and SDK-shaped responses", () => {
  assert.equal(
    extractGeminiOutputText({ steps: [{ content: [{ text: '{"modules":[]}' }] }] }),
    '{"modules":[]}',
  );
  assert.equal(
    extractGeminiOutputText({ interaction: { output_text: '{"modules":[]}' } }),
    '{"modules":[]}',
  );
  assert.equal(extractGeminiOutputText({ steps: [] }), "");
});

test("sends a PDF and structured output schema to Gemini", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  let requestUrl;
  let requestOptions;
  globalThis.fetch = async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return new Response(JSON.stringify({
      steps: [{ content: [{ text: '{"modules":[]}' }] }],
    }), { status: 200 });
  };

  const result = await generateGeminiCurriculum({
    apiKey: "test-key",
    model: "test-model",
    filename: "course.pdf",
    sourceBytes: Buffer.from("%PDF-test"),
    prompt: "Create a curriculum.",
    responseSchema: { type: "object" },
  });

  assert.deepEqual(result, { modules: [] });
  assert.equal(requestUrl, "https://generativelanguage.googleapis.com/v1beta/interactions");
  assert.equal(requestOptions.headers["x-goog-api-key"], "test-key");
  assert.equal(requestOptions.headers["Api-Revision"], "2026-05-20");
  const body = JSON.parse(requestOptions.body);
  assert.equal(body.model, "test-model");
  assert.deepEqual(body.response_format.schema, { type: "object" });
  assert.deepEqual(body.input[0], {
    type: "document",
    data: Buffer.from("%PDF-test").toString("base64"),
    mime_type: "application/pdf",
  });
});

test("reports invalid Gemini credentials without exposing provider response details", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { message: "private provider detail" },
  }), { status: 401 });

  await assert.rejects(
    generateGeminiCurriculum({
      apiKey: "test-key",
      model: "test-model",
      filename: "course.pdf",
      sourceBytes: Buffer.from("%PDF-test"),
      prompt: "Create a curriculum.",
      responseSchema: { type: "object" },
    }),
    (error) => {
      assert.match(error.message, /Gemini rejected the API key or project access/);
      assert.doesNotMatch(error.message, /private provider detail|test-key/);
      assert.equal(error.status, 502);
      return true;
    },
  );
});

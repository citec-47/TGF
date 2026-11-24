import test from "node:test";
import assert from "node:assert/strict";
import {
  deleteGeminiFile,
  extractGeminiOutputText,
  generateGeminiCurriculum,
  uploadGeminiVideo,
} from "./gemini-curriculum.js";

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

test("uploads a video through the Gemini Files API and waits for an active file", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    if (requests.length === 1) {
      return new Response(null, {
        status: 200,
        headers: {
          "x-goog-upload-url": "https://generativelanguage.googleapis.com/upload/v1beta/files/resumable",
        },
      });
    }
    return new Response(JSON.stringify({
      file: {
        name: "files/course-video",
        uri: "https://generativelanguage.googleapis.com/v1beta/files/course-video",
        mime_type: "video/mp4",
        state: "ACTIVE",
      },
    }), { status: 200 });
  };

  const result = await uploadGeminiVideo({
    apiKey: "test-key",
    filename: "course.mp4",
    mimeType: "video/mp4",
    sourceBytes: Buffer.from("video"),
  });

  assert.deepEqual(result, {
    name: "files/course-video",
    uri: "https://generativelanguage.googleapis.com/v1beta/files/course-video",
    mimeType: "video/mp4",
  });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].options.headers["X-Goog-Upload-Protocol"], "resumable");
  assert.equal(requests[1].options.headers["X-Goog-Upload-Command"], "upload, finalize");
  assert.deepEqual(requests[1].options.body, Buffer.from("video"));
});

test("sends a processed video reference to Gemini for structured curriculum generation", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  let requestOptions;
  globalThis.fetch = async (_url, options) => {
    requestOptions = options;
    return new Response(JSON.stringify({
      steps: [{ content: [{ text: '{"modules":[]}' }] }],
    }), { status: 200 });
  };

  const result = await generateGeminiCurriculum({
    apiKey: "test-key",
    model: "test-model",
    filename: "course.mp4",
    videoUri: "https://generativelanguage.googleapis.com/v1beta/files/course-video",
    videoMimeType: "video/mp4",
    prompt: "Create a curriculum.",
    responseSchema: { type: "object" },
  });

  assert.deepEqual(result, { modules: [] });
  const body = JSON.parse(requestOptions.body);
  assert.deepEqual(body.input[0], {
    type: "video",
    uri: "https://generativelanguage.googleapis.com/v1beta/files/course-video",
    mime_type: "video/mp4",
  });
  assert.deepEqual(body.input[1], { type: "text", text: "Create a curriculum." });
});

test("deletes temporary Gemini video files", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  let requestUrl;
  let requestOptions;
  globalThis.fetch = async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return new Response(null, { status: 200 });
  };

  await deleteGeminiFile({ apiKey: "test-key", name: "files/course-video" });

  assert.equal(requestUrl, "https://generativelanguage.googleapis.com/v1beta/files/course-video");
  assert.equal(requestOptions.method, "DELETE");
  assert.equal(requestOptions.headers["x-goog-api-key"], "test-key");
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

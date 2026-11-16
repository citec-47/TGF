import test from "node:test";
import assert from "node:assert/strict";
import {
  extractOpenAIOutputText,
  generateOpenAICurriculum,
} from "./openai-curriculum.js";

const options = {
  apiKey: "test-key",
  model: "test-model",
  filename: "course.pdf",
  sourceBytes: Buffer.from("%PDF-test"),
  prompt: "Create a curriculum.",
  responseSchema: { type: "object", additionalProperties: false },
};

test("extracts Responses API output text", () => {
  assert.equal(extractOpenAIOutputText({ output_text: '{"modules":[]}' }), '{"modules":[]}');
  assert.equal(
    extractOpenAIOutputText({
      output: [{ content: [{ type: "output_text", text: '{"modules":[]}' }] }],
    }),
    '{"modules":[]}',
  );
  assert.equal(extractOpenAIOutputText({ output: [] }), "");
});

test("sends a complete PDF and strict curriculum schema to OpenAI", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  let requestUrl;
  let requestOptions;
  globalThis.fetch = async (url, fetchOptions) => {
    requestUrl = url;
    requestOptions = fetchOptions;
    return new Response(JSON.stringify({
      status: "completed",
      output_text: '{"modules":[]}',
    }), { status: 200 });
  };

  const result = await generateOpenAICurriculum(options);

  assert.deepEqual(result, { modules: [] });
  assert.equal(requestUrl, "https://api.openai.com/v1/responses");
  assert.equal(requestOptions.headers.Authorization, "Bearer test-key");
  const body = JSON.parse(requestOptions.body);
  assert.equal(body.model, "test-model");
  assert.equal(body.store, false);
  assert.equal(body.text.format.strict, true);
  assert.deepEqual(body.text.format.schema, options.responseSchema);
  assert.deepEqual(body.input[0].content[0], {
    type: "input_file",
    filename: "course.pdf",
    file_data: `data:application/pdf;base64,${options.sourceBytes.toString("base64")}`,
    detail: "high",
  });
});

test("sends DOCX documents using the OpenAI-supported document MIME type", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  let requestOptions;
  globalThis.fetch = async (_url, fetchOptions) => {
    requestOptions = fetchOptions;
    return new Response(JSON.stringify({ output_text: '{"modules":[]}' }), { status: 200 });
  };

  await generateOpenAICurriculum({
    ...options,
    filename: "course.docx",
  });

  const body = JSON.parse(requestOptions.body);
  assert.match(
    body.input[0].content[0].file_data,
    /^data:application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document;base64,/,
  );
  assert.equal("detail" in body.input[0].content[0], false);
});

test("reports invalid OpenAI credentials without exposing provider response details", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { message: "private provider detail" },
  }), { status: 401 });

  await assert.rejects(
    generateOpenAICurriculum(options),
    (error) => {
      assert.match(error.message, /OpenAI rejected the API key or project access/);
      assert.doesNotMatch(error.message, /private provider detail|test-key/);
      assert.equal(error.status, 502);
      return true;
    },
  );
});

test("reports truncated curriculum output instead of treating it as a valid draft", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => new Response(JSON.stringify({
    status: "incomplete",
    incomplete_details: { reason: "max_output_tokens" },
  }), { status: 200 });

  await assert.rejects(
    generateOpenAICurriculum(options),
    /curriculum was too long to finish/,
  );
});

import mammoth from "mammoth";
import path from "node:path";

const GEMINI_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const GEMINI_API_REVISION = "2026-05-20";
const MAX_DOCX_TEXT_CHARACTERS = 1000000;

function errorWithStatus(message, status) {
  return Object.assign(new Error(message), { status });
}

export function extractGeminiOutputText(value) {
  if (!value || typeof value !== "object") return "";

  const candidates = [value];
  if (value.interaction && typeof value.interaction === "object") {
    candidates.push(value.interaction);
  }
  for (const candidate of candidates) {
    if (typeof candidate.output_text === "string") return candidate.output_text;
    if (!Array.isArray(candidate.steps)) continue;

    const textParts = [];
    for (const step of candidate.steps) {
      if (!step || typeof step !== "object" || !Array.isArray(step.content)) continue;
      for (const part of step.content) {
        if (part && typeof part === "object" && typeof part.text === "string") {
          textParts.push(part.text);
        }
      }
    }
    if (textParts.length) return textParts.join("\n");
  }
  return "";
}

async function createGeminiInput(filename, sourceBytes, prompt) {
  const extension = path.extname(filename).toLowerCase();
  if (extension === ".pdf") {
    return [
      {
        type: "document",
        data: sourceBytes.toString("base64"),
        mime_type: "application/pdf",
      },
      { type: "text", text: prompt },
    ];
  }

  if (extension !== ".docx") {
    throw errorWithStatus("Gemini curriculum drafting supports PDF and DOCX files only.", 400);
  }

  let extracted;
  try {
    extracted = await mammoth.extractRawText({ buffer: sourceBytes });
  } catch {
    throw errorWithStatus("The DOCX file could not be read. Resave it as a valid DOCX and try again.", 422);
  }
  const documentText = extracted.value.trim();
  if (!documentText) {
    throw errorWithStatus("No readable text was found in the DOCX file.", 422);
  }
  if (documentText.length > MAX_DOCX_TEXT_CHARACTERS) {
    throw errorWithStatus("This DOCX is too large to draft in one request. Reduce its size and try again.", 413);
  }
  return [{
    type: "text",
    text: `${prompt}\n\nDOCX source text:\n${documentText}`,
  }];
}

/**
 * @param {{
 *   apiKey: string;
 *   model: string;
 *   filename: string;
 *   sourceBytes: Buffer;
 *   prompt: string;
 *   responseSchema: Record<string, unknown>;
 * }} options
 * @returns {Promise<unknown>}
 */
export async function generateGeminiCurriculum(options) {
  const input = await createGeminiInput(options.filename, options.sourceBytes, options.prompt);
  const response = await fetch(GEMINI_INTERACTIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": options.apiKey,
      "Api-Revision": GEMINI_API_REVISION,
    },
    body: JSON.stringify({
      model: options.model,
      input,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: options.responseSchema,
      },
    }),
    signal: AbortSignal.timeout(120000),
  });

  let responseData;
  try {
    responseData = await response.json();
  } catch {
    throw errorWithStatus("Gemini returned an unreadable response.", 502);
  }
  if (!response.ok) {
    const message = response.status === 401 || response.status === 403
      ? "Gemini rejected the API key or project access. Check GEMINI_API_KEY and Gemini API access for the project."
      : response.status === 429
        ? "Gemini quota or rate limit reached. Check the project's quota and billing."
        : `Gemini curriculum generation failed (HTTP ${response.status}). Check GEMINI_MODEL and project access.`;
    throw errorWithStatus(message, 502);
  }

  const outputText = extractGeminiOutputText(responseData);
  if (!outputText) {
    throw errorWithStatus("Gemini did not return a curriculum. Check the selected model and try again.", 502);
  }
  try {
    return JSON.parse(outputText);
  } catch {
    throw errorWithStatus("Gemini returned invalid curriculum JSON. Try generating the draft again.", 502);
  }
}

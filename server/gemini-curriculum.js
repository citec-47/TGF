import mammoth from "mammoth";
import path from "node:path";

const GEMINI_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const GEMINI_FILE_UPLOAD_URL = "https://generativelanguage.googleapis.com/upload/v1beta/files";
const GEMINI_API_REVISION = "2026-05-20";
const MAX_DOCX_TEXT_CHARACTERS = 1000000;
const GEMINI_VIDEO_PROCESSING_TIMEOUT_MS = 10 * 60 * 1000;

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

function getGeminiFileName(fileName) {
  return typeof fileName === "string" && /^files\/[A-Za-z0-9_-]+$/.test(fileName)
    ? fileName
    : "";
}

function readGeminiFileResponse(response, errorMessage) {
  return response.json().catch(() => {
    throw errorWithStatus(errorMessage, 502);
  });
}

export async function uploadGeminiVideo({ apiKey, filename, mimeType, sourceBytes }) {
  if (!apiKey) throw errorWithStatus("Video curriculum drafting requires GEMINI_API_KEY.", 503);
  if (!Buffer.isBuffer(sourceBytes) || sourceBytes.length < 1) {
    throw errorWithStatus("The uploaded course video is empty.", 400);
  }
  if (!["video/mp4", "video/quicktime", "video/webm"].includes(mimeType)) {
    throw errorWithStatus("Upload an MP4, MOV or WebM course video.", 400);
  }

  let startResponse;
  try {
    startResponse = await fetch(GEMINI_FILE_UPLOAD_URL, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(sourceBytes.length),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: { display_name: filename } }),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw errorWithStatus("Gemini could not start the course-video upload.", 503);
  }
  if (!startResponse.ok) {
    throw errorWithStatus(`Gemini video upload could not start (HTTP ${startResponse.status}).`, 502);
  }

  const uploadUrl = startResponse.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw errorWithStatus("Gemini did not return a video upload URL.", 502);
  try {
    if (new URL(uploadUrl).origin !== "https://generativelanguage.googleapis.com") {
      throw new Error("Unexpected upload origin.");
    }
  } catch {
    throw errorWithStatus("Gemini returned an invalid video upload URL.", 502);
  }

  let uploadResponse;
  try {
    uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Length": String(sourceBytes.length),
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
        "Content-Type": mimeType,
      },
      body: sourceBytes,
      signal: AbortSignal.timeout(5 * 60 * 1000),
    });
  } catch {
    throw errorWithStatus("Gemini could not upload the course video.", 503);
  }
  if (!uploadResponse.ok) {
    throw errorWithStatus(`Gemini could not upload the course video (HTTP ${uploadResponse.status}).`, 502);
  }

  const uploadResult = await readGeminiFileResponse(
    uploadResponse,
    "Gemini returned an unreadable course-video upload response.",
  );
  let file = uploadResult?.file;
  const fileName = getGeminiFileName(file?.name);
  if (!fileName || typeof file.uri !== "string" || !file.uri) {
    throw errorWithStatus("Gemini did not return a usable course-video reference.", 502);
  }

  const deadline = Date.now() + GEMINI_VIDEO_PROCESSING_TIMEOUT_MS;
  while (file.state !== "ACTIVE") {
    if (file.state === "FAILED") {
      throw errorWithStatus("Gemini could not process this video. Check its format and try again.", 422);
    }
    if (Date.now() >= deadline) {
      throw errorWithStatus("Gemini video processing took too long. Try again later.", 504);
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
    let statusResponse;
    try {
      statusResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${fileName}`,
        { headers: { "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(15000) },
      );
    } catch {
      throw errorWithStatus("Gemini video processing status is temporarily unavailable.", 503);
    }
    if (!statusResponse.ok) {
      throw errorWithStatus(`Gemini video processing status failed (HTTP ${statusResponse.status}).`, 502);
    }
    const statusResult = await readGeminiFileResponse(
      statusResponse,
      "Gemini returned an unreadable video-processing status.",
    );
    file = statusResult?.file || statusResult;
    if (!file || typeof file !== "object") {
      throw errorWithStatus("Gemini returned an invalid video-processing status.", 502);
    }
  }

  return {
    name: fileName,
    uri: file.uri,
    mimeType: typeof file.mime_type === "string" ? file.mime_type : mimeType,
  };
}

export async function deleteGeminiFile({ apiKey, name }) {
  const fileName = getGeminiFileName(name);
  if (!apiKey || !fileName) throw errorWithStatus("A valid Gemini video file is required for cleanup.", 400);
  let response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${fileName}`,
      { method: "DELETE", headers: { "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(15000) },
    );
  } catch {
    throw errorWithStatus("Gemini temporary video cleanup failed.", 503);
  }
  if (!response.ok && response.status !== 404) {
    throw errorWithStatus(`Gemini temporary video cleanup failed (HTTP ${response.status}).`, 503);
  }
}

/**
 * @param {{
 *   apiKey: string;
 *   model: string;
 *   filename: string;
 *   sourceBytes?: Buffer;
 *   videoUri?: string;
 *   videoMimeType?: string;
 *   prompt: string;
 *   responseSchema: Record<string, unknown>;
 * }} options
 * @returns {Promise<unknown>}
 */
export async function generateGeminiCurriculum(options) {
  const input = options.videoUri
    ? [
      { type: "video", uri: options.videoUri, mime_type: options.videoMimeType },
      { type: "text", text: options.prompt },
    ]
    : await createGeminiInput(options.filename, options.sourceBytes, options.prompt);
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
    signal: AbortSignal.timeout(options.videoUri ? 600000 : 120000),
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

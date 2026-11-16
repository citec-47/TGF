const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MAX_OUTPUT_TOKENS = 16000;

function errorWithStatus(message, status) {
  return Object.assign(new Error(message), { status });
}

export function extractOpenAIOutputText(value) {
  if (!value || typeof value !== "object") return "";
  if (typeof value.output_text === "string") return value.output_text;
  if (!Array.isArray(value.output)) return "";

  const textParts = [];
  for (const item of value.output) {
    if (!item || typeof item !== "object" || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (part && typeof part === "object" &&
          (part.type === "output_text" || typeof part.text === "string") &&
          typeof part.text === "string") {
        textParts.push(part.text);
      }
    }
  }
  return textParts.join("\n");
}

function createFileInput(filename, sourceBytes) {
  const extension = filename.split(".").pop()?.toLowerCase();
  const mimeType = extension === "pdf"
    ? "application/pdf"
    : extension === "docx"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "";
  if (!mimeType) {
    throw errorWithStatus("OpenAI curriculum drafting supports PDF and DOCX files only.", 400);
  }

  return {
    type: "input_file",
    filename,
    file_data: `data:${mimeType};base64,${sourceBytes.toString("base64")}`,
    ...(extension === "pdf" ? { detail: "high" } : {}),
  };
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
export async function generateOpenAICurriculum(options) {
  const fileInput = createFileInput(options.filename, options.sourceBytes);
  let response;
  try {
    response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        store: false,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        input: [{
          role: "user",
          content: [
            fileInput,
            { type: "input_text", text: options.prompt },
          ],
        }],
        text: {
          format: {
            type: "json_schema",
            name: "course_curriculum",
            strict: true,
            schema: options.responseSchema,
          },
        },
      }),
      signal: AbortSignal.timeout(180000),
    });
  } catch {
    throw errorWithStatus(
      "OpenAI could not be reached. Check the server connection and try again.",
      502,
    );
  }

  let responseData;
  try {
    responseData = await response.json();
  } catch {
    throw errorWithStatus("OpenAI returned an unreadable response.", 502);
  }
  if (!responseData || typeof responseData !== "object") {
    throw errorWithStatus("OpenAI returned an invalid response.", 502);
  }

  if (!response.ok) {
    const message = response.status === 401 || response.status === 403
      ? "OpenAI rejected the API key or project access. Check OPENAI_API_KEY and OpenAI project access."
      : response.status === 429
        ? "OpenAI quota or rate limit reached. Check the project's usage limits and billing."
        : response.status === 400 || response.status === 404
          ? "OpenAI rejected the request. Check OPENAI_MODEL and make sure the selected model supports PDF inputs and structured outputs."
          : `OpenAI curriculum generation failed (HTTP ${response.status}). Check the model and project access.`;
    throw errorWithStatus(message, 502);
  }

  if (responseData.status === "incomplete") {
    const message = responseData.incomplete_details?.reason === "max_output_tokens"
      ? "The curriculum was too long to finish. Choose fewer modules and try again."
      : "OpenAI did not finish generating the curriculum. Try again.";
    throw errorWithStatus(message, 502);
  }

  const outputText = extractOpenAIOutputText(responseData);
  if (!outputText) {
    const refused = Array.isArray(responseData.output) &&
      responseData.output.some((item) =>
        Array.isArray(item?.content) && item.content.some((part) => part?.type === "refusal"));
    throw errorWithStatus(
      refused
        ? "OpenAI could not generate a curriculum from this document. Review the document and try again."
        : "OpenAI did not return a curriculum. Check OPENAI_MODEL and try again.",
      502,
    );
  }
  try {
    return JSON.parse(outputText);
  } catch {
    throw errorWithStatus("OpenAI returned invalid curriculum JSON. Try generating the draft again.", 502);
  }
}

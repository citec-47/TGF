import { readFile } from "node:fs/promises";
import path from "node:path";

const pageBodyCache = new Map<string, string>();
const cachePageBodies = process.env.NODE_ENV !== "development";

export async function loadPageBody(fileName: string, pageLabel: string): Promise<string> {
  if (cachePageBodies) {
    const cached = pageBodyCache.get(fileName);
    if (cached) return cached;
  }

  const document = await readFile(path.join(process.cwd(), fileName), "utf8");
  const body = document.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1]?.replace(/\r\n?/g, "\n");
  if (!body) {
    throw new Error(`Could not load the ${pageLabel}.`);
  }

  if (cachePageBodies) pageBodyCache.set(fileName, body);
  return body;
}

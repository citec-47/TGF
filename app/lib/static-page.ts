import { readFile } from "node:fs/promises";
import path from "node:path";

type PageFile = "admin.html" | "corporate.html" | "index.html" | "portal.html" | "student.html" | "teacher.html";

const pageBodyCache = new Map<PageFile, string>();
const cachePageBodies = process.env.NODE_ENV !== "development";

export async function loadPageBody(fileName: PageFile, pageLabel: string): Promise<string> {
  if (cachePageBodies) {
    const cached = pageBodyCache.get(fileName);
    if (cached) return cached;
  }

  const document = await readFile(path.join(process.cwd(), "data", "pages", fileName), "utf8");
  const body = document.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1]?.replace(/\r\n?/g, "\n");
  if (!body) {
    throw new Error(`Could not load the ${pageLabel}.`);
  }

  if (cachePageBodies) pageBodyCache.set(fileName, body);
  return body;
}

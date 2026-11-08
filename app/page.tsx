import { readFile } from "node:fs/promises";
import path from "node:path";
import Script from "next/script";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const document = await readFile(path.join(process.cwd(), "index.html"), "utf8");
  const body = document.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  if (!body) {
    throw new Error("Could not load the TGFVP homepage HTML.");
  }

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: body }} />
      <Script src="/app.js" strategy="afterInteractive" />
    </>
  );
}

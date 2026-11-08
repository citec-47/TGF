import { readFile } from "node:fs/promises";
import path from "node:path";
import Script from "next/script";

export const metadata = {
  title: "Team portal | TGF Group",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const document = await readFile(path.join(process.cwd(), "portal.html"), "utf8");
  const body = document.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  if (!body) {
    throw new Error("Could not load the TGF Group team portal.");
  }

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: body }} />
      <Script src="/portal.js" strategy="afterInteractive" />
    </>
  );
}

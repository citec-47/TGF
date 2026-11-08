import { readFile } from "node:fs/promises";
import path from "node:path";
import Script from "next/script";

export const metadata = {
  title: "TGF Group dashboard | TGFVP Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const document = await readFile(path.join(process.cwd(), "admin.html"), "utf8");
  const body = document.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  if (!body) {
    throw new Error("Could not load the TGFVP admin dashboard.");
  }

  return (
    <div className="admin-page">
      <div dangerouslySetInnerHTML={{ __html: body }} />
      <Script src="/admin.js" strategy="afterInteractive" />
    </div>
  );
}

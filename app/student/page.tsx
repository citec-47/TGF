import { readFile } from "node:fs/promises";
import path from "node:path";
import Script from "next/script";

export const metadata = {
  title: "Student learning space | TGF Vocational Pathways",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StudentPage() {
  const document = await readFile(path.join(process.cwd(), "student.html"), "utf8");
  const body = document.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  if (!body) throw new Error("Could not load the TGFVP student learning space.");

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: body }} />
      <Script src="/classroom.js" strategy="afterInteractive" />
    </>
  );
}

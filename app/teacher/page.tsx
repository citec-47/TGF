import { readFile } from "node:fs/promises";
import path from "node:path";
import Script from "next/script";

export const metadata = {
  title: "Teacher studio | TGF Vocational Pathways",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function TeacherPage() {
  const document = await readFile(path.join(process.cwd(), "teacher.html"), "utf8");
  const body = document.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  if (!body) throw new Error("Could not load the TGFVP teacher studio.");

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: body }} />
      <Script src="/classroom.js" strategy="afterInteractive" />
    </>
  );
}

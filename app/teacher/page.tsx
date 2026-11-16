import Script from "next/script";

import PdfPageRenderer from "../components/pdf-page-renderer";
import { loadPageBody } from "../lib/static-page";

export const metadata = {
  title: "Teacher studio | TGF Vocational Pathways",
  robots: { index: false, follow: false },
};

export default async function TeacherPage() {
  const body = await loadPageBody("teacher.html", "TGFVP teacher studio");

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: body }} />
      <PdfPageRenderer />
      <Script src="/classroom.js" strategy="afterInteractive" />
      <Script src="/messages.js" strategy="afterInteractive" />
      <Script src="/collaboration.js" strategy="afterInteractive" />
    </>
  );
}

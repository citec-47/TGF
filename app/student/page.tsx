import Script from "next/script";

import PdfPageRenderer from "../components/pdf-page-renderer";
import { loadPageBody } from "../lib/static-page";

export const metadata = {
  title: "Student learning space | TGF Vocational Pathways",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StudentPage() {
  const body = await loadPageBody("student.html", "TGFVP student learning space");

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

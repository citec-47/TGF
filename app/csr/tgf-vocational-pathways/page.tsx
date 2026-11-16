import type { Metadata } from "next";
import Script from "next/script";

import { loadPageBody } from "../../lib/static-page";

export const metadata: Metadata = {
  title: "TGF Vocational Pathways | Transgenerational Forces Group",
  description:
    "Explore TGF Vocational Pathways programmes, training locations and admissions information.",
};

export default async function TGFVocationalPathwaysPage() {
  const body = await loadPageBody("index.html", "TGF Vocational Pathways page");

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: body }} />
      <Script src="/app.js" strategy="afterInteractive" />
    </>
  );
}

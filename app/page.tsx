import Script from "next/script";

import { loadPageBody } from "./lib/static-page";

export default async function HomePage() {
  const body = await loadPageBody("corporate.html", "TGF Group corporate homepage HTML");

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: body }} />
      <Script src="/app.js" strategy="afterInteractive" />
      <Script src="/corporate.js" strategy="afterInteractive" />
    </>
  );
}

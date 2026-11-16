import Script from "next/script";

import { loadPageBody } from "../lib/static-page";

export const metadata = {
  title: "Team portal | TGF Group",
  robots: { index: false, follow: false },
};

export default async function PortalPage() {
  const body = await loadPageBody("portal.html", "TGF Group team portal");

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: body }} />
      <Script src="/portal.js" strategy="afterInteractive" />
      <Script src="/messages.js" strategy="afterInteractive" />
    </>
  );
}

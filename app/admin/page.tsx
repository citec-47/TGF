import Script from "next/script";

import { loadPageBody } from "../lib/static-page";

export const metadata = {
  title: "TGF Group dashboard | TGFVP Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const body = await loadPageBody("admin.html", "TGFVP admin dashboard");

  return (
    <div className="admin-page">
      <div dangerouslySetInnerHTML={{ __html: body }} />
      <Script src="/admin.js" strategy="afterInteractive" />
      <Script src="/corporate-content-admin.js" strategy="afterInteractive" />
      <Script src="/submissions-admin.js" strategy="afterInteractive" />
      <Script src="/messages.js" strategy="afterInteractive" />
      <Script src="/collaboration.js" strategy="afterInteractive" />
    </div>
  );
}

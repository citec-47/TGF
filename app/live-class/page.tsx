import { Suspense } from "react";

import ClassroomClient from "./classroom-client";

export const metadata = {
  title: "Live class | TGF Vocational Pathways",
  robots: { index: false, follow: false },
};

export default function LiveClassPage() {
  return (
    <main className="livekit-page">
      <Suspense fallback={<p className="admin-intro">Preparing your classroom…</p>}>
        <ClassroomClient />
      </Suspense>
    </main>
  );
}

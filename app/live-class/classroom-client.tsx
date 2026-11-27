"use client";

import dynamic from "next/dynamic";

const JitsiClassRoom = dynamic(() => import("./room"), {
  loading: () => <p className="admin-intro" role="status">Preparing your classroom…</p>,
});

export default function ClassroomClient() {
  return <JitsiClassRoom />;
}

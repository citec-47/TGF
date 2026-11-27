"use client";

import dynamic from "next/dynamic";

const LiveClassRoom = dynamic(() => import("./room"), {
  loading: () => <p className="admin-intro" role="status">Preparing your classroom…</p>,
});

export default function ClassroomClient() {
  return <LiveClassRoom />;
}

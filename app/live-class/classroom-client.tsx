"use client";

import dynamic from "next/dynamic";

const MediasoupClassRoom = dynamic(() => import("./room"), {
  loading: () => <p className="admin-intro" role="status">Preparing your classroom…</p>,
});

export default function ClassroomClient() {
  return <MediasoupClassRoom />;
}

"use client";

import dynamic from "next/dynamic";

const LiveKitClassRoom = dynamic(() => import("./livekit-room"), {
  loading: () => <p className="admin-intro" role="status">Preparing your classroom…</p>,
});

export default function ClassroomClient() {
  return <LiveKitClassRoom />;
}

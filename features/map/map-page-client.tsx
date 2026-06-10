"use client";

import dynamic from "next/dynamic";

const LiveMap = dynamic(
  () => import("@/features/map/live-map").then((mod) => mod.LiveMap),
  { ssr: false },
);

export function MapPageClient() {
  return <LiveMap />;
}

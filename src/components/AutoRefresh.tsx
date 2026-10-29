"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the server page every few seconds while `active` (e.g. a pipeline run is in progress). */
export default function AutoRefresh({ active, everyMs = 4000 }: { active: boolean; everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(id);
  }, [active, everyMs, router]);
  return null;
}

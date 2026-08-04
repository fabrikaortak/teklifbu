"use client";

import { Suspense } from "react";
import { PremiumHome } from "@/components/home/PremiumHome";

export default function PremiumPage() {
  return (
    <Suspense fallback={<div className="v2-home" style={{ padding: 24 }}>Premium yükleniyor…</div>}>
      <PremiumHome />
    </Suspense>
  );
}

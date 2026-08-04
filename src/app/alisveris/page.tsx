"use client";

import { Suspense } from "react";
import { AlisverisHome } from "@/components/home/AlisverisHome";

export default function AlisverisPage() {
  return (
    <Suspense fallback={<div className="v2-home" style={{ padding: 24 }}>Alışveriş yükleniyor…</div>}>
      <AlisverisHome />
    </Suspense>
  );
}

"use client";

import { Suspense } from "react";
import ListingDetailInner from "./ListingDetailInner";

export default function ListingDetailPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}>Yükleniyor...</div>}>
      <ListingDetailInner />
    </Suspense>
  );
}

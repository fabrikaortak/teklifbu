"use client";

import { Suspense } from "react";
import AccountInner from "./AccountInner";

export default function AccountPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}>Yükleniyor...</div>}>
      <AccountInner />
    </Suspense>
  );
}

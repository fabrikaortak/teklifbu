"use client";

import { Suspense } from "react";
import { AlisverisHome } from "@/components/home/AlisverisHome";

function AlisverisBootFallback() {
  return (
    <div
      className="alisveris-redirect-gate"
      role="status"
      aria-busy="true"
      style={{
        minHeight: "calc(100vh - 140px)",
        display: "grid",
        placeItems: "center",
        padding: "48px 24px",
        background: "var(--bg, #f8fafc)",
      }}
    >
      <div style={{ display: "grid", gap: 18, justifyItems: "center", textAlign: "center" }}>
        <span
          aria-hidden
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: "3px solid #e2e8f0",
            borderTopColor: "var(--orange, #ea580c)",
            animation: "alisveris-gate-spin 0.75s linear infinite",
          }}
        />
        <p
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: "0.04em",
            color: "var(--ink, #0f172a)",
            textTransform: "uppercase",
          }}
        >
          Alışverişe yönlendiriliyorsunuz
        </p>
        <style>{`@keyframes alisveris-gate-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

export default function AlisverisPage() {
  return (
    <Suspense fallback={<AlisverisBootFallback />}>
      <AlisverisHome />
    </Suspense>
  );
}

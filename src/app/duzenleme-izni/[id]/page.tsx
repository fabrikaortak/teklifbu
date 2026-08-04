"use client";

import { Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { SellerGrantEditModal } from "@/components/SellerGrantEditModal";
import { useDialog } from "@/components/ui/ConfirmDialog";

function GrantPageInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { alert } = useDialog();

  if (!id) return null;

  return (
    <div style={{ minHeight: "50vh" }}>
      <SellerGrantEditModal
        grantId={id}
        onClose={() => router.push("/hesabim?s=bildirimler")}
        onSubmitted={async () => {
          await alert({
            title: "Onaya gönderildi",
            message: "Değişiklikleriniz yönetici onayına düştü.",
            tone: "success",
          });
          router.push("/hesabim?s=ilanlarim");
        }}
      />
    </div>
  );
}

export default function GrantEditPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}>Yükleniyor...</div>}>
      <GrantPageInner />
    </Suspense>
  );
}

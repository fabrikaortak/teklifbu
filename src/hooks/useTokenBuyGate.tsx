"use client";

import { useCallback, useState } from "react";
import { TokenBuyModal } from "@/components/TokenBuyModal";

export type InsufficientTokenPayload = {
  requiredTokens?: number;
  balance?: number;
  code?: string;
};

/** API / istemci yetersiz jeton yanıtını ortak forma çevirir */
export function parseInsufficientTokens(
  res: { status: number } | null | undefined,
  data: Record<string, unknown> | null | undefined
): InsufficientTokenPayload | null {
  if (!data) return null;
  const code = String(data.code || "");
  const required = Number(data.requiredTokens ?? data.tokenCost ?? 0);
  const balance = Number(data.balance ?? 0);
  const is402 = res?.status === 402;
  const isCode = code === "INSUFFICIENT_TOKENS";
  const msg = String(data.error || "").toLocaleLowerCase("tr-TR");
  const looksLike =
    is402 ||
    isCode ||
    msg.includes("yetersiz jeton") ||
    msg.includes("insufficient");
  if (!looksLike) return null;
  return {
    code: "INSUFFICIENT_TOKENS",
    requiredTokens: Number.isFinite(required) && required > 0 ? required : 1,
    balance: Number.isFinite(balance) ? balance : 0,
  };
}

export function useTokenBuyGate(opts?: {
  continueLabel?: string;
  title?: string;
  description?: string;
  onPurchased?: (balance: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [requiredTokens, setRequiredTokens] = useState(1);
  const [balance, setBalance] = useState(0);

  const openInsufficient = useCallback((payload: InsufficientTokenPayload) => {
    setRequiredTokens(Math.max(1, Number(payload.requiredTokens) || 1));
    setBalance(Math.max(0, Number(payload.balance) || 0));
    setOpen(true);
  }, []);

  /** fetch sonucunu işler; yetersizse modal açar ve true döner */
  const handleFetchResult = useCallback(
    (
      res: Response,
      data: Record<string, unknown>,
      fallbackRequired?: number
    ): boolean => {
      const parsed = parseInsufficientTokens(res, data);
      if (!parsed) return false;
      openInsufficient({
        ...parsed,
        requiredTokens: parsed.requiredTokens || fallbackRequired || 1,
      });
      return true;
    },
    [openInsufficient]
  );

  /** İstemci tarafı bakiye kontrolü */
  const ensureTokens = useCallback(
    (currentBalance: number, need: number): boolean => {
      if (currentBalance >= need) return true;
      openInsufficient({ requiredTokens: need, balance: currentBalance });
      return false;
    },
    [openInsufficient]
  );

  const modal = (
    <TokenBuyModal
      open={open}
      onClose={() => setOpen(false)}
      requiredTokens={requiredTokens}
      balance={balance}
      continueLabel={opts?.continueLabel || "Devam et"}
      title={opts?.title || "Bu işlem için jeton gerekli"}
      description={
        opts?.description ||
        "Bakiyeniz bu işlem için yetersiz. Jeton yükledikten sonra kaldığınız yerden devam edebilirsiniz."
      }
      onPurchased={(b) => {
        setBalance(b);
        opts?.onPurchased?.(b);
        window.dispatchEvent(new Event("teklifbu:auth"));
      }}
    />
  );

  return {
    tokenModal: modal,
    tokenModalOpen: open,
    setTokenModalOpen: setOpen,
    openInsufficient,
    handleFetchResult,
    ensureTokens,
    tokenNeed: requiredTokens,
    tokenBalance: balance,
    setTokenBalance: setBalance,
  };
}

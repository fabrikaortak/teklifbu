"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info, Trash2, X } from "lucide-react";

export type DialogTone = "danger" | "warning" | "success" | "info";

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
};

export type AlertOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  tone?: DialogTone;
};

type PendingConfirm = ConfirmOptions & {
  mode: "confirm";
  resolve: (value: boolean) => void;
};

type PendingAlert = AlertOptions & {
  mode: "alert";
  resolve: () => void;
};

type Pending = PendingConfirm | PendingAlert;

type DialogApi = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  alert: (opts: AlertOptions | string) => Promise<void>;
};

const DialogContext = createContext<DialogApi | null>(null);

let externalApi: DialogApi | null = null;

/** Provider dışı acil kullanım (mümkünse useDialog tercih edin). */
export function dialogConfirm(opts: ConfirmOptions) {
  if (!externalApi) {
    return Promise.resolve(window.confirm(`${opts.title}\n\n${opts.message}`));
  }
  return externalApi.confirm(opts);
}

export function dialogAlert(opts: AlertOptions | string) {
  if (!externalApi) {
    const msg = typeof opts === "string" ? opts : `${opts.title || ""}\n${opts.message}`.trim();
    window.alert(msg);
    return Promise.resolve();
  }
  return externalApi.alert(opts);
}

function toneMeta(tone: DialogTone) {
  switch (tone) {
    case "danger":
      return {
        icon: Trash2,
        iconBg: "linear-gradient(145deg, #fee2e2, #fecaca)",
        iconColor: "#b91c1c",
        confirmClass: "tb-dialog-btn tb-dialog-btn-danger",
      };
    case "warning":
      return {
        icon: AlertTriangle,
        iconBg: "linear-gradient(145deg, #ffedd5, #fed7aa)",
        iconColor: "#c2410c",
        confirmClass: "tb-dialog-btn tb-dialog-btn-warning",
      };
    case "success":
      return {
        icon: CheckCircle2,
        iconBg: "linear-gradient(145deg, #dcfce7, #bbf7d0)",
        iconColor: "#15803d",
        confirmClass: "tb-dialog-btn tb-dialog-btn-primary",
      };
    default:
      return {
        icon: Info,
        iconBg: "linear-gradient(145deg, #e0e7ff, #c7d2fe)",
        iconColor: "#3730a3",
        confirmClass: "tb-dialog-btn tb-dialog-btn-primary",
      };
  }
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  pendingRef.current = pending;

  const close = useCallback((result: boolean) => {
    const cur = pendingRef.current;
    if (!cur) return;
    setPending(null);
    if (cur.mode === "confirm") cur.resolve(result);
    else cur.resolve();
  }, []);

  const api = useMemo<DialogApi>(
    () => ({
      confirm: (opts) =>
        new Promise<boolean>((resolve) => {
          setPending({
            mode: "confirm",
            title: opts.title,
            message: opts.message,
            confirmLabel: opts.confirmLabel || "Onayla",
            cancelLabel: opts.cancelLabel || "Vazgeç",
            tone: opts.tone || "warning",
            resolve,
          });
        }),
      alert: (opts) =>
        new Promise<void>((resolve) => {
          const normalized =
            typeof opts === "string"
              ? { title: "Bilgi", message: opts, tone: "info" as const }
              : {
                  title: opts.title || "Bilgi",
                  message: opts.message,
                  confirmLabel: opts.confirmLabel,
                  tone: opts.tone || "info",
                };
          setPending({
            mode: "alert",
            title: normalized.title,
            message: normalized.message,
            confirmLabel: normalized.confirmLabel || "Tamam",
            tone: normalized.tone,
            resolve,
          });
        }),
    }),
    []
  );

  useEffect(() => {
    externalApi = api;
    return () => {
      if (externalApi === api) externalApi = null;
    };
  }, [api]);

  useEffect(() => {
    if (!pending) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter" && pending?.mode === "alert") close(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, close]);

  const tone = (pending?.tone || "info") as DialogTone;
  const meta = toneMeta(tone);
  const Icon = meta.icon;

  return (
    <DialogContext.Provider value={api}>
      {children}
      {pending && (
        <div
          className="tb-dialog-backdrop"
          role="presentation"
          onClick={() => close(false)}
        >
          <div
            className="tb-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="tb-dialog-title"
            aria-describedby="tb-dialog-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="tb-dialog-close"
              aria-label="Kapat"
              onClick={() => close(false)}
            >
              <X size={16} />
            </button>

            <div className="tb-dialog-icon" style={{ background: meta.iconBg, color: meta.iconColor }}>
              <Icon size={22} strokeWidth={2.25} />
            </div>

            <h3 id="tb-dialog-title" className="tb-dialog-title">
              {pending.title}
            </h3>
            <p id="tb-dialog-desc" className="tb-dialog-message">
              {pending.message}
            </p>

            <div className="tb-dialog-actions">
              {pending.mode === "confirm" && (
                <button
                  type="button"
                  className="tb-dialog-btn tb-dialog-btn-ghost"
                  onClick={() => close(false)}
                >
                  {pending.cancelLabel || "Vazgeç"}
                </button>
              )}
              <button
                type="button"
                className={meta.confirmClass}
                onClick={() => close(true)}
                autoFocus
              >
                {pending.confirmLabel || (pending.mode === "alert" ? "Tamam" : "Onayla")}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    return {
      confirm: dialogConfirm,
      alert: dialogAlert,
    };
  }
  return ctx;
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { BrowseNode } from "@/data/categoryBrowseTree";
import { browseCategoryValue, mergeMegaL2 } from "@/lib/megaMenuFromBrowse";

export type MegaSelectPatch = {
  category: string;
  dealType: "" | "SATILIK" | "KIRALIK" | "DEVREN_SATILIK" | "DEVREN_KIRALIK";
  subtype: string;
  rental: string;
  brand: string;
  model: string;
  version: string;
  trim: string;
};

const EMPTY: MegaSelectPatch = {
  category: "",
  dealType: "",
  subtype: "",
  rental: "",
  brand: "",
  model: "",
  version: "",
  trim: "",
};

type Props = {
  open: boolean;
  tree: BrowseNode[];
  /** Açılışta odaklanacak ana kategori id (alisveris/elektronik) */
  focusMainId?: string | null;
  onClose: () => void;
  onSelect: (patch: MegaSelectPatch) => void;
};

export function CategoryMegaMenu({ open, tree, focusMainId, onClose, onSelect }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mainId, setMainId] = useState<string | null>(null);
  const [l2Id, setL2Id] = useState<string | null>(null);

  const mains = useMemo(() => tree.filter((n) => n.kind !== "section"), [tree]);

  useEffect(() => {
    if (!open) return;
    const preferred =
      (focusMainId && mains.find((m) => m.id === focusMainId)) ||
      mains[0] ||
      null;
    setMainId(preferred?.id ?? null);
    setL2Id(null);
  }, [open, focusMainId, mains]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      const strip = (t as HTMLElement)?.closest?.(".v2-cat-strip");
      if (strip) return;
      onClose();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDoc);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [open, onClose]);

  const activeMain = mains.find((m) => m.id === mainId) || mains[0] || null;
  const l2List = useMemo(() => mergeMegaL2(activeMain), [activeMain]);
  const activeL2 = l2List.find((n) => n.id === l2Id) || null;

  const columns = useMemo(() => {
    if (!activeL2?.children?.length) return [];
    return activeL2.children.filter((c) => c.kind !== "section");
  }, [activeL2]);

  const promoTiles = useMemo(() => {
    const source = columns.length ? columns : l2List;
    return source.slice(0, 4).map((n) => ({
      id: n.id,
      name: n.name,
      category: browseCategoryValue(n),
      image: (n as BrowseNode & { image?: string }).image,
    }));
  }, [columns, l2List]);

  if (!open) return null;

  function pick(node: BrowseNode) {
    const cat = browseCategoryValue(node);
    if (!cat) return;
    onSelect({ ...EMPTY, category: cat });
    onClose();
  }

  return (
    <div className="tb-mega" ref={panelRef} role="dialog" aria-label="Kategori menüsü">
      <div className="tb-mega-shell">
        {/* Sol: ana kategoriler */}
        <aside className="tb-mega-mains" aria-label="Ana kategoriler">
          {mains.map((m) => {
            const active = m.id === activeMain?.id;
            return (
              <button
                key={m.id}
                type="button"
                className={`tb-mega-main${active ? " is-active" : ""}`}
                onMouseEnter={() => {
                  setMainId(m.id);
                  setL2Id(null);
                }}
                onFocus={() => {
                  setMainId(m.id);
                  setL2Id(null);
                }}
                onClick={() => pick(m)}
              >
                <span>{m.name}</span>
                <ChevronRight size={16} strokeWidth={2} />
              </button>
            );
          })}
        </aside>

        {/* Orta: L2 listesi (görsel 1) */}
        <div className="tb-mega-l2" aria-label="Alt kategoriler">
          <button type="button" className="tb-mega-l2-all" onClick={() => activeMain && pick(activeMain)}>
            Tüm {activeMain?.name || "ürünler"}
          </button>
          {l2List.map((n) => {
            const active = n.id === activeL2?.id;
            const hasKids = Boolean(n.children?.length);
            return (
              <button
                key={n.id}
                type="button"
                className={`tb-mega-l2-item${active ? " is-active" : ""}`}
                onMouseEnter={() => setL2Id(n.id)}
                onFocus={() => setL2Id(n.id)}
                onClick={() => pick(n)}
              >
                <span>{n.name}</span>
                {hasKids ? <ChevronRight size={15} strokeWidth={2} /> : null}
              </button>
            );
          })}
          {!l2List.length ? (
            <p className="tb-mega-empty">Bu kategoride alt başlık yok.</p>
          ) : null}
        </div>

        {/* Sağ: komple navigasyon (görsel 2) */}
        <div className={`tb-mega-panel${activeL2 ? " is-open" : ""}`}>
          {activeL2 ? (
            <>
              <div className="tb-mega-cols">
                {columns.length ? (
                  columns.map((col) => (
                    <div key={col.id} className="tb-mega-col">
                      <button type="button" className="tb-mega-col-title" onClick={() => pick(col)}>
                        {col.name}
                      </button>
                      <ul className="tb-mega-col-links">
                        {(col.children || []).slice(0, 14).map((leaf) => (
                          <li key={leaf.id}>
                            <button type="button" onClick={() => pick(leaf)}>
                              {leaf.name}
                            </button>
                          </li>
                        ))}
                        {!col.children?.length ? (
                          <li>
                            <button type="button" onClick={() => pick(col)}>
                              Tümünü gör
                            </button>
                          </li>
                        ) : null}
                      </ul>
                    </div>
                  ))
                ) : (
                  <div className="tb-mega-col">
                    <button type="button" className="tb-mega-col-title" onClick={() => pick(activeL2)}>
                      {activeL2.name}
                    </button>
                    <p className="tb-mega-empty">Alt kategori bulunamadı — kategoriye gitmek için başlığa tıkla.</p>
                  </div>
                )}
              </div>

              <div className="tb-mega-promos" aria-hidden={!promoTiles.length}>
                <div className="tb-mega-promo-grid">
                  {promoTiles.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="tb-mega-promo-tile"
                      onClick={() => {
                        if (t.category) onSelect({ ...EMPTY, category: t.category });
                        onClose();
                      }}
                    >
                      <span className="tb-mega-promo-label">{t.name}</span>
                      {t.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.image} alt="" />
                      ) : (
                        <span className="tb-mega-promo-ph" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="tb-mega-promo-banner">
                  <strong>Fiyatı sen belirle</strong>
                  <span>En iyi teklifi kap — TeklifBu</span>
                </div>
              </div>
            </>
          ) : (
            <div className="tb-mega-panel-hint">
              <p>Soldan bir alt kategoriye gelince tüm navigasyon burada açılır.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

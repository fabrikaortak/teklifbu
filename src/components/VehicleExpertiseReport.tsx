"use client";

import { useMemo } from "react";
import {
  EXPERTISE_FIRMS,
  EXPERTISE_OBTAINED_AT,
  EXPERTISE_PARTS,
  EXPERTISE_STATUS_META,
  emptyExpertiseParts,
  groupPartsByStatus,
  nextExpertiseStatus,
  partsByListSide,
  type ExpertisePartId,
  type ExpertisePartStatus,
  type VehicleExpertiseReport,
} from "@/data/vehicleExpertiseReport";

type Props = {
  value: VehicleExpertiseReport | null;
  onChange?: (next: VehicleExpertiseReport | null) => void;
  editable?: boolean;
};

function statusOf(
  parts: Partial<Record<ExpertisePartId, ExpertisePartStatus>>,
  id: ExpertisePartId
): ExpertisePartStatus {
  return parts[id] || "original";
}

function PartShape({
  id,
  d,
  parts,
  editable,
  onCycle,
  cx,
  cy,
  fontSize = 10,
}: {
  id: ExpertisePartId;
  d: string;
  parts: Partial<Record<ExpertisePartId, ExpertisePartStatus>>;
  editable: boolean;
  onCycle: (id: ExpertisePartId) => void;
  cx: number;
  cy: number;
  fontSize?: number;
}) {
  const st = statusOf(parts, id);
  const meta = EXPERTISE_STATUS_META[st];
  return (
    <g
      onClick={editable ? () => onCycle(id) : undefined}
      style={{ cursor: editable ? "pointer" : "default" }}
      role={editable ? "button" : undefined}
      tabIndex={editable ? 0 : undefined}
      onKeyDown={
        editable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onCycle(id);
              }
            }
          : undefined
      }
      aria-label={`${EXPERTISE_PARTS.find((p) => p.id === id)?.label || id}: ${meta.label}`}
    >
      <path
        d={d}
        fill={st === "original" ? "#ffffff" : meta.color}
        stroke={st === "original" ? "#9aa3af" : "#64748b"}
        strokeWidth={1.35}
        strokeLinejoin="round"
        style={{ transition: "fill 0.15s ease" }}
      />
      {meta.short ? (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={meta.text}
          fontSize={fontSize}
          fontWeight={800}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {meta.short}
        </text>
      ) : null}
    </g>
  );
}

function StatusLists({
  parts,
  side,
}: {
  parts: Partial<Record<ExpertisePartId, ExpertisePartStatus>>;
  side: "left" | "right";
}) {
  const grouped = useMemo(() => groupPartsByStatus(partsByListSide(parts, side)), [parts, side]);
  if (!grouped.length) {
    return (
      <div className="vx-empty">{side === "left" ? "Sol / ön hasar yok" : "Sağ / arka hasar yok"}</div>
    );
  }
  return (
    <div className="vx-lists">
      {grouped.map((g) => (
        <div key={g.status} className="vx-group">
          <div className="vx-group-title">
            <span className="vx-swatch" style={{ background: g.meta.color }} />
            {g.meta.label} Parçalar
          </div>
          <ul>
            {g.items.map((i) => (
              <li key={i.id}>{i.label}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Sol yan | üstten gövde | sağ yan — önceki düzen */
function CarDiagram({
  parts,
  editable,
  onCycle,
}: {
  parts: Record<ExpertisePartId, ExpertisePartStatus>;
  editable: boolean;
  onCycle: (id: ExpertisePartId) => void;
}) {
  const p = { parts, editable, onCycle };

  return (
    <svg viewBox="0 0 440 360" width="100%" height="auto" role="img" className="vx-car-svg">
      {/* Sol yan */}
      <PartShape
        id="leftFrontFender"
        d="M24 42 C24 28 38 20 54 20 L78 20 L78 78 C78 90 68 98 56 98 L40 98 C28 98 20 88 20 76 L20 56 C20 48 22 42 24 42 Z"
        {...p}
        cx={50}
        cy={56}
      />
      <PartShape id="leftFrontDoor" d="M22 104 L78 104 L78 158 L22 158 Z" {...p} cx={50} cy={131} />
      <PartShape id="leftRearDoor" d="M22 164 L78 164 L78 218 L22 218 Z" {...p} cx={50} cy={191} />
      <PartShape
        id="leftRearFender"
        d="M22 224 L78 224 L78 282 C78 298 64 308 48 308 C32 308 20 296 20 280 L20 248 C20 234 28 224 40 224 Z"
        {...p}
        cx={50}
        cy={262}
      />
      <g style={{ pointerEvents: "none" }}>
        <ellipse cx={50} cy={88} rx={16} ry={16} fill="#d1d5db" stroke="#6b7280" strokeWidth={1.4} />
        <ellipse cx={50} cy={88} rx={8} ry={8} fill="#f9fafb" stroke="#9ca3af" strokeWidth={1} />
        <ellipse cx={50} cy={252} rx={16} ry={16} fill="#d1d5db" stroke="#6b7280" strokeWidth={1.4} />
        <ellipse cx={50} cy={252} rx={8} ry={8} fill="#f9fafb" stroke="#9ca3af" strokeWidth={1} />
        <rect x={30} y={112} width={40} height={36} rx={3} fill="rgba(148,163,184,0.22)" stroke="#94a3b8" strokeWidth={0.8} />
        <rect x={30} y={172} width={40} height={36} rx={3} fill="rgba(148,163,184,0.22)" stroke="#94a3b8" strokeWidth={0.8} />
      </g>

      {/* Orta üstten */}
      <path
        d="M152 16 C178 4 262 4 288 16 L300 36 L296 300 C288 322 196 334 152 322 L140 300 L144 36 Z"
        fill="#eef2f7"
        stroke="none"
        style={{ pointerEvents: "none" }}
      />
      <PartShape
        id="frontBumper"
        d="M158 14 C182 4 258 4 282 14 L292 32 C292 40 284 46 274 46 L166 46 C156 46 148 40 148 32 Z"
        {...p}
        cx={220}
        cy={30}
      />
      <PartShape id="hood" d="M156 50 L284 50 L278 128 L162 128 Z" {...p} cx={220} cy={88} />
      <PartShape id="roof" d="M168 132 L272 132 L266 224 L174 224 Z" {...p} cx={220} cy={178} />
      <PartShape id="trunk" d="M162 228 L278 228 L284 292 L156 292 Z" {...p} cx={220} cy={260} />
      <PartShape
        id="rearBumper"
        d="M158 296 L282 296 C292 296 300 302 300 312 L290 330 C266 344 174 344 150 330 L140 312 C140 302 148 296 158 296 Z"
        {...p}
        cx={220}
        cy={316}
      />
      <g style={{ pointerEvents: "none" }}>
        <path d="M178 140 L262 140 L256 182 L184 182 Z" fill="rgba(100,116,139,0.16)" stroke="#94a3b8" strokeWidth={1} />
        <path d="M184 190 L256 190 L252 216 L188 216 Z" fill="rgba(100,116,139,0.12)" stroke="#94a3b8" strokeWidth={1} />
        <line x1={220} y1={58} x2={220} y2={120} stroke="#cbd5e1" strokeWidth={1.1} />
        <path d="M156 108 L146 118" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" />
        <path d="M284 108 L294 118" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" />
        <ellipse cx={170} cy={30} rx={8} ry={5} fill="#fde68a" stroke="#d97706" strokeWidth={0.8} opacity={0.85} />
        <ellipse cx={270} cy={30} rx={8} ry={5} fill="#fde68a" stroke="#d97706" strokeWidth={0.8} opacity={0.85} />
        <rect x={164} y={304} width={18} height={8} rx={2} fill="#fecaca" stroke="#ef4444" strokeWidth={0.7} opacity={0.9} />
        <rect x={258} y={304} width={18} height={8} rx={2} fill="#fecaca" stroke="#ef4444" strokeWidth={0.7} opacity={0.9} />
      </g>

      {/* Sağ yan */}
      <PartShape
        id="rightFrontFender"
        d="M362 20 L386 20 C402 20 416 28 416 42 L416 76 C416 88 408 98 396 98 L380 98 C368 98 362 90 362 78 Z"
        {...p}
        cx={390}
        cy={56}
      />
      <PartShape id="rightFrontDoor" d="M362 104 L418 104 L418 158 L362 158 Z" {...p} cx={390} cy={131} />
      <PartShape id="rightRearDoor" d="M362 164 L418 164 L418 218 L362 218 Z" {...p} cx={390} cy={191} />
      <PartShape
        id="rightRearFender"
        d="M362 224 L418 224 L418 282 C418 298 404 308 388 308 C372 308 362 296 362 280 Z"
        {...p}
        cx={390}
        cy={262}
      />
      <g style={{ pointerEvents: "none" }}>
        <ellipse cx={390} cy={88} rx={16} ry={16} fill="#d1d5db" stroke="#6b7280" strokeWidth={1.4} />
        <ellipse cx={390} cy={88} rx={8} ry={8} fill="#f9fafb" stroke="#9ca3af" strokeWidth={1} />
        <ellipse cx={390} cy={252} rx={16} ry={16} fill="#d1d5db" stroke="#6b7280" strokeWidth={1.4} />
        <ellipse cx={390} cy={252} rx={8} ry={8} fill="#f9fafb" stroke="#9ca3af" strokeWidth={1} />
        <rect x={370} y={112} width={40} height={36} rx={3} fill="rgba(148,163,184,0.22)" stroke="#94a3b8" strokeWidth={0.8} />
        <rect x={370} y={172} width={40} height={36} rx={3} fill="rgba(148,163,184,0.22)" stroke="#94a3b8" strokeWidth={0.8} />
      </g>
    </svg>
  );
}

export function VehicleExpertiseReportPanel({ value, onChange, editable = false }: Props) {
  const parts = useMemo(() => {
    const base = emptyExpertiseParts();
    if (value?.parts) {
      for (const p of EXPERTISE_PARTS) {
        const s = value.parts[p.id];
        if (s) base[p.id] = s;
      }
    }
    return base;
  }, [value]);

  const obtainedAt = value?.obtainedAt || "";
  const firm = value?.firm || "";

  function emit(
    nextParts: Record<ExpertisePartId, ExpertisePartStatus>,
    nextObtained = obtainedAt,
    nextFirm = firm
  ) {
    if (!onChange) return;
    const slim: Partial<Record<ExpertisePartId, ExpertisePartStatus>> = {};
    for (const p of EXPERTISE_PARTS) {
      if (nextParts[p.id] !== "original") slim[p.id] = nextParts[p.id];
    }
    const oa = nextObtained.trim();
    const f = nextFirm.trim();
    if (!Object.keys(slim).length && !oa && !f) {
      onChange(null);
      return;
    }
    onChange({
      parts: slim,
      ...(oa ? { obtainedAt: oa } : {}),
      ...(f ? { firm: f } : {}),
    });
  }

  function cycle(id: ExpertisePartId) {
    emit({ ...parts, [id]: nextExpertiseStatus(parts[id]) });
  }

  return (
    <div className="vx-report">
      <div className="vx-legend">
        {(
          [
            ["original", "Orijinal"],
            ["lokal", "Lokal Boyalı"],
            ["boyali", "Boyalı"],
            ["degisen", "Değişen"],
          ] as const
        ).map(([k, label]) => (
          <span key={k} className="vx-legend-item">
            <span
              className="vx-swatch"
              style={{ background: k === "original" ? "#fff" : EXPERTISE_STATUS_META[k].color }}
            />
            {label}
          </span>
        ))}
      </div>
      {editable && (
        <p className="vx-hint">Parçalara tıklayarak durum seçin: Orijinal → Lokal → Boyalı → Değişen</p>
      )}

      <div className="vx-layout">
        <aside className="vx-col">
          <StatusLists parts={parts} side="left" />
        </aside>

        <div className="vx-diagram" aria-label="Araç ekspertiz şeması">
          <CarDiagram parts={parts} editable={editable} onCycle={cycle} />
        </div>

        <aside className="vx-col">
          <StatusLists parts={parts} side="right" />
        </aside>
      </div>

      <div className="vx-meta">
        {editable ? (
          <>
            <label>
              <span>Ekspertiz raporu nereden alındı?</span>
              <select
                className="select"
                value={obtainedAt}
                onChange={(e) => emit(parts, e.target.value, firm)}
              >
                <option value="">Seçin</option>
                {EXPERTISE_OBTAINED_AT.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Hangi ekspertiz firması?</span>
              <select className="select" value={firm} onChange={(e) => emit(parts, obtainedAt, e.target.value)}>
                <option value="">Seçin</option>
                {EXPERTISE_FIRMS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <>
            {obtainedAt ? (
              <div>
                <strong>Alındığı yer:</strong> {obtainedAt}
              </div>
            ) : null}
            {firm ? (
              <div>
                <strong>Firma:</strong> {firm}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

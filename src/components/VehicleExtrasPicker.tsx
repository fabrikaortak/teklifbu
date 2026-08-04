"use client";

import { VEHICLE_EXTRA_GROUPS } from "@/data/vehicleExtras";

export function VehicleExtrasPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const selected = new Set(value);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {VEHICLE_EXTRA_GROUPS.map((group) => (
        <div key={group.id} style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{group.label}</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
              gap: 6,
            }}
          >
            {group.items.map((item) => {
              const on = selected.has(item.id);
              return (
                <label
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 10px",
                    borderRadius: 10,
                    border: on ? "1px solid #fdba74" : "1px solid #e2e8f0",
                    background: on ? "#fff7ed" : "#fff",
                    cursor: "pointer",
                    fontSize: 12.5,
                    fontWeight: on ? 700 : 500,
                    color: "#0f172a",
                    userSelect: "none",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(item.id)}
                    style={{ width: 15, height: 15, accentColor: "#ea580c", flexShrink: 0 }}
                  />
                  {item.label}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

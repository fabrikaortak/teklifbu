"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapPoint = { lat: number; lng: number };

type Props = {
  city?: string;
  district?: string;
  neighborhood?: string;
  value: MapPoint | null;
  onChange: (point: MapPoint) => void;
  /** false = sadece görüntüleme (sürükle/tık yok) */
  interactive?: boolean;
  height?: number;
};

const TR_CENTER: MapPoint = { lat: 39.0, lng: 35.0 };

async function geocodeAddress(parts: string[]) {
  const q = parts.filter(Boolean).join(", ");
  if (!q) return null;
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return (data.point as { lat: number; lng: number } | null) || null;
}

export function LocationMapPicker({
  city,
  district,
  neighborhood,
  value,
  onChange,
  interactive = true,
  height = 280,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const onChangeRef = useRef(onChange);
  const [ready, setReady] = useState(false);
  const [geoMsg, setGeoMsg] = useState("");
  const addressKey = [neighborhood, district, city].filter(Boolean).join("|");

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!boxRef.current || mapRef.current) return;
      const L = (await import("leaflet")).default;

      // Fix default marker icons in bundlers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (cancelled || !boxRef.current) return;
      const start = value || TR_CENTER;
      const map = L.map(boxRef.current, {
        zoomControl: true,
        dragging: interactive,
        scrollWheelZoom: interactive,
        doubleClickZoom: interactive,
        boxZoom: interactive,
        keyboard: interactive,
      }).setView([start.lat, start.lng], value ? 15 : 6);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      if (value) {
        markerRef.current = L.marker([value.lat, value.lng], { draggable: interactive }).addTo(map);
        if (interactive) {
          markerRef.current.on("dragend", () => {
            const p = markerRef.current!.getLatLng();
            onChangeRef.current({ lat: p.lat, lng: p.lng });
          });
        }
      }

      if (interactive) {
        map.on("click", (e) => {
          const point = { lat: e.latlng.lat, lng: e.latlng.lng };
          if (!markerRef.current) {
            markerRef.current = L.marker([point.lat, point.lng], { draggable: true }).addTo(map);
            markerRef.current.on("dragend", () => {
              const p = markerRef.current!.getLatLng();
              onChangeRef.current({ lat: p.lat, lng: p.lng });
            });
          } else {
            markerRef.current.setLatLng([point.lat, point.lng]);
          }
          onChangeRef.current(point);
        });
      }

      mapRef.current = map;
      setReady(true);
      setTimeout(() => map.invalidateSize(), 80);
    }
    void init();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value to marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !value || !ready) return;
    void import("leaflet").then((mod) => {
      const L = mod.default;
      if (!markerRef.current) {
        markerRef.current = L.marker([value.lat, value.lng], { draggable: interactive }).addTo(map);
        if (interactive) {
          markerRef.current.on("dragend", () => {
            const p = markerRef.current!.getLatLng();
            onChangeRef.current({ lat: p.lat, lng: p.lng });
          });
        }
      } else {
        markerRef.current.setLatLng([value.lat, value.lng]);
      }
      map.setView([value.lat, value.lng], Math.max(map.getZoom(), 14));
    });
  }, [value, ready, interactive]);

  // Geocode when address selects change
  useEffect(() => {
    if (!interactive || !ready || !addressKey) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setGeoMsg("Konum aranıyor…");
      const point = await geocodeAddress([neighborhood || "", district || "", city || "", "Türkiye"]);
      if (cancelled) return;
      if (!point) {
        setGeoMsg("Adres haritada bulunamadı — haritaya tıklayarak işaretleyin.");
        return;
      }
      setGeoMsg("Adres bulundu. İsterseniz pini sürükleyerek düzeltin.");
      onChangeRef.current(point);
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [addressKey, interactive, ready, city, district, neighborhood]);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div
        ref={boxRef}
        style={{
          height,
          width: "100%",
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid var(--line)",
          background: "#e8eef5",
          zIndex: 0,
        }}
      />
      {interactive && (
        <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.45 }}>
          {geoMsg || "Haritaya tıklayarak konum işaretleyin. Pin sürüklenebilir."}
          {value && (
            <span style={{ marginLeft: 6, fontWeight: 700, color: "#475569" }}>
              ({value.lat.toFixed(5)}, {value.lng.toFixed(5)})
            </span>
          )}
        </div>
      )}
    </div>
  );
}

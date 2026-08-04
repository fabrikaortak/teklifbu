"use client";

import { LocationMapPicker } from "@/components/LocationMapPicker";

export function ListingMapView({ lat, lng }: { lat: number; lng: number }) {
  return (
    <LocationMapPicker
      value={{ lat, lng }}
      onChange={() => {}}
      interactive={false}
      height={260}
    />
  );
}

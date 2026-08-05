import { MagazaPanelGate } from "@/components/magaza/MagazaPanelGate";
import type { ReactNode } from "react";

export default function MagazaPanelLayout({ children }: { children: ReactNode }) {
  return <MagazaPanelGate>{children}</MagazaPanelGate>;
}

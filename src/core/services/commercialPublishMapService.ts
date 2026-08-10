import { getSetting } from "@/core/settings";
import {
  COMMERCIAL_PUBLISH_MAP_SETTING_KEY,
  defaultCommercialPublishMap,
  normalizeCommercialPublishMap,
  type CommercialPublishMap,
} from "@/lib/commercialPublishMap";

export async function getCommercialPublishMap(): Promise<CommercialPublishMap> {
  const raw = await getSetting<unknown>(
    COMMERCIAL_PUBLISH_MAP_SETTING_KEY,
    defaultCommercialPublishMap()
  );
  return normalizeCommercialPublishMap(raw);
}

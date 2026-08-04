import data from "./turkey-locations.json";

export type TurkeyDistrict = {
  name: string;
  neighborhoods: string[];
};

export type TurkeyCity = {
  name: string;
  districts: TurkeyDistrict[];
};

export const TURKEY_CITIES = data.cities as TurkeyCity[];

export const CITY_NAMES = TURKEY_CITIES.map((c) => c.name);

const cityMap = new Map(TURKEY_CITIES.map((c) => [c.name, c]));

export function getCity(name: string) {
  return cityMap.get(name) || null;
}

export function getDistricts(city: string) {
  return getCity(city)?.districts.map((d) => d.name) || [];
}

export function getNeighborhoods(city: string, district: string) {
  const d = getCity(city)?.districts.find((x) => x.name === district);
  return d?.neighborhoods || [];
}

export const SALE_PRICE_OPTIONS = [
  250_000, 500_000, 750_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000, 5_000_000, 7_500_000, 10_000_000, 15_000_000, 20_000_000, 30_000_000, 50_000_000,
] as const;

export const RENT_PRICE_OPTIONS = [
  5_000, 7_500, 10_000, 12_500, 15_000, 20_000, 25_000, 30_000, 40_000, 50_000, 75_000, 100_000, 150_000, 200_000,
] as const;

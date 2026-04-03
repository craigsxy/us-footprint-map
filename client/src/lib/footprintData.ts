/**
 * Footprint Map — Data & Constants
 * Design: Deep Space / Data Observatory
 * States cycle through 7 levels from unvisited to long-term resident
 */

export type FootprintStatus =
  | "unvisited"
  | "transit"
  | "business"
  | "trip"
  | "longstay"
  | "school"
  | "lived";

export interface StatusConfig {
  id: FootprintStatus;
  label: string;
  labelZh: string;
  color: string;
  glowColor: string;
  description: string;
  order: number;
}

export const STATUS_CONFIGS: StatusConfig[] = [
  {
    id: "unvisited",
    label: "Not Visited",
    labelZh: "未去过",
    color: "#111827",
    glowColor: "#374151",
    description: "Haven't been here yet",
    order: 0,
  },
  {
    id: "transit",
    label: "Passed Through",
    labelZh: "路过/中转",
    color: "#0e4d63",
    glowColor: "#06b6d4",
    description: "Just passing through",
    order: 1,
  },
  {
    id: "business",
    label: "Business Trip",
    labelZh: "出差",
    color: "#1040a0",
    glowColor: "#3b82f6",
    description: "Visited for work",
    order: 2,
  },
  {
    id: "trip",
    label: "Short Trip",
    labelZh: "短途旅行",
    color: "#0f5235",
    glowColor: "#10b981",
    description: "Leisure travel",
    order: 3,
  },
  {
    id: "longstay",
    label: "Long Stay",
    labelZh: "长住",
    color: "#6b4f08",
    glowColor: "#f59e0b",
    description: "Extended stay",
    order: 4,
  },
  {
    id: "school",
    label: "Studied Here",
    labelZh: "上学",
    color: "#6b1060",
    glowColor: "#ec4899",
    description: "Attended school",
    order: 5,
  },
  {
    id: "lived",
    label: "Lived Here",
    labelZh: "居住过",
    color: "#7a1010",
    glowColor: "#ef4444",
    description: "Called it home",
    order: 6,
  },
];

export const STATUS_ORDER: FootprintStatus[] = [
  "unvisited",
  "transit",
  "business",
  "trip",
  "longstay",
  "school",
  "lived",
];

export function getNextStatus(current: FootprintStatus): FootprintStatus {
  const idx = STATUS_ORDER.indexOf(current);
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
}

export function getStatusConfig(status: FootprintStatus): StatusConfig {
  return STATUS_CONFIGS.find((s) => s.id === status)!;
}

// FIPS codes for all 50 states + DC
export interface StateInfo {
  fips: string;
  name: string;
  abbr: string;
  type: "state" | "dc";
}

export const US_STATES: StateInfo[] = [
  { fips: "01", name: "Alabama", abbr: "AL", type: "state" },
  { fips: "02", name: "Alaska", abbr: "AK", type: "state" },
  { fips: "04", name: "Arizona", abbr: "AZ", type: "state" },
  { fips: "05", name: "Arkansas", abbr: "AR", type: "state" },
  { fips: "06", name: "California", abbr: "CA", type: "state" },
  { fips: "08", name: "Colorado", abbr: "CO", type: "state" },
  { fips: "09", name: "Connecticut", abbr: "CT", type: "state" },
  { fips: "10", name: "Delaware", abbr: "DE", type: "state" },
  { fips: "11", name: "District of Columbia", abbr: "DC", type: "dc" },
  { fips: "12", name: "Florida", abbr: "FL", type: "state" },
  { fips: "13", name: "Georgia", abbr: "GA", type: "state" },
  { fips: "15", name: "Hawaii", abbr: "HI", type: "state" },
  { fips: "16", name: "Idaho", abbr: "ID", type: "state" },
  { fips: "17", name: "Illinois", abbr: "IL", type: "state" },
  { fips: "18", name: "Indiana", abbr: "IN", type: "state" },
  { fips: "19", name: "Iowa", abbr: "IA", type: "state" },
  { fips: "20", name: "Kansas", abbr: "KS", type: "state" },
  { fips: "21", name: "Kentucky", abbr: "KY", type: "state" },
  { fips: "22", name: "Louisiana", abbr: "LA", type: "state" },
  { fips: "23", name: "Maine", abbr: "ME", type: "state" },
  { fips: "24", name: "Maryland", abbr: "MD", type: "state" },
  { fips: "25", name: "Massachusetts", abbr: "MA", type: "state" },
  { fips: "26", name: "Michigan", abbr: "MI", type: "state" },
  { fips: "27", name: "Minnesota", abbr: "MN", type: "state" },
  { fips: "28", name: "Mississippi", abbr: "MS", type: "state" },
  { fips: "29", name: "Missouri", abbr: "MO", type: "state" },
  { fips: "30", name: "Montana", abbr: "MT", type: "state" },
  { fips: "31", name: "Nebraska", abbr: "NE", type: "state" },
  { fips: "32", name: "Nevada", abbr: "NV", type: "state" },
  { fips: "33", name: "New Hampshire", abbr: "NH", type: "state" },
  { fips: "34", name: "New Jersey", abbr: "NJ", type: "state" },
  { fips: "35", name: "New Mexico", abbr: "NM", type: "state" },
  { fips: "36", name: "New York", abbr: "NY", type: "state" },
  { fips: "37", name: "North Carolina", abbr: "NC", type: "state" },
  { fips: "38", name: "North Dakota", abbr: "ND", type: "state" },
  { fips: "39", name: "Ohio", abbr: "OH", type: "state" },
  { fips: "40", name: "Oklahoma", abbr: "OK", type: "state" },
  { fips: "41", name: "Oregon", abbr: "OR", type: "state" },
  { fips: "42", name: "Pennsylvania", abbr: "PA", type: "state" },
  { fips: "44", name: "Rhode Island", abbr: "RI", type: "state" },
  { fips: "45", name: "South Carolina", abbr: "SC", type: "state" },
  { fips: "46", name: "South Dakota", abbr: "SD", type: "state" },
  { fips: "47", name: "Tennessee", abbr: "TN", type: "state" },
  { fips: "48", name: "Texas", abbr: "TX", type: "state" },
  { fips: "49", name: "Utah", abbr: "UT", type: "state" },
  { fips: "50", name: "Vermont", abbr: "VT", type: "state" },
  { fips: "51", name: "Virginia", abbr: "VA", type: "state" },
  { fips: "53", name: "Washington", abbr: "WA", type: "state" },
  { fips: "54", name: "West Virginia", abbr: "WV", type: "state" },
  { fips: "55", name: "Wisconsin", abbr: "WI", type: "state" },
  { fips: "56", name: "Wyoming", abbr: "WY", type: "state" },
];

// 5 US Territories (not in TopoJSON, rendered separately)
export interface TerritoryInfo {
  id: string;
  name: string;
  abbr: string;
  flag: string;
}

export const US_TERRITORIES: TerritoryInfo[] = [
  { id: "PR", name: "Puerto Rico", abbr: "PR", flag: "🇵🇷" },
  { id: "GU", name: "Guam", abbr: "GU", flag: "🇬🇺" },
  { id: "VI", name: "U.S. Virgin Islands", abbr: "VI", flag: "🇻🇮" },
  { id: "AS", name: "American Samoa", abbr: "AS", flag: "🇦🇸" },
  { id: "MP", name: "N. Mariana Islands", abbr: "MP", flag: "🇲🇵" },
];

// localStorage key
export const STORAGE_KEY = "us-footprint-map-v1";

export type FootprintData = Record<string, FootprintStatus>;

export function loadFootprintData(): FootprintData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {};
}

export function saveFootprintData(data: FootprintData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

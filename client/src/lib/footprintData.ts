/**
 * Footprint Map — Data & Constants
 * Design: Clean Light / Cartographic
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
  color: string;       // fill color for the state
  borderColor: string; // border/stroke color
  textColor: string;   // label text color on top of fill
  description: string;
  order: number;
}

export const STATUS_CONFIGS: StatusConfig[] = [
  {
    id: "unvisited",
    label: "Not Visited",
    labelZh: "未去过",
    color: "#e8edf2",
    borderColor: "#c5cdd6",
    textColor: "#8a9ab0",
    description: "Haven't been here yet",
    order: 0,
  },
  {
    id: "transit",
    label: "Passed Through",
    labelZh: "路过/中转",
    color: "#bae6fd",
    borderColor: "#38bdf8",
    textColor: "#0369a1",
    description: "Just passing through",
    order: 1,
  },
  {
    id: "business",
    label: "Business Trip",
    labelZh: "出差",
    color: "#bfdbfe",
    borderColor: "#60a5fa",
    textColor: "#1d4ed8",
    description: "Visited for work",
    order: 2,
  },
  {
    id: "trip",
    label: "Short Trip",
    labelZh: "短途旅行",
    color: "#bbf7d0",
    borderColor: "#34d399",
    textColor: "#065f46",
    description: "Leisure travel",
    order: 3,
  },
  {
    id: "longstay",
    label: "Long Stay",
    labelZh: "长住",
    color: "#fde68a",
    borderColor: "#fbbf24",
    textColor: "#92400e",
    description: "Extended stay",
    order: 4,
  },
  {
    id: "school",
    label: "Studied Here",
    labelZh: "上学",
    color: "#f5d0fe",
    borderColor: "#e879f9",
    textColor: "#86198f",
    description: "Attended school",
    order: 5,
  },
  {
    id: "lived",
    label: "Lived Here",
    labelZh: "居住过",
    color: "#fecaca",
    borderColor: "#f87171",
    textColor: "#991b1b",
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

// FIPS codes for all 50 states + DC, with Chinese names
export interface StateInfo {
  fips: string;
  name: string;
  nameZh: string;
  abbr: string;
  type: "state" | "dc";
}

export const US_STATES: StateInfo[] = [
  { fips: "01", name: "Alabama",              nameZh: "阿拉巴马",   abbr: "AL", type: "state" },
  { fips: "02", name: "Alaska",               nameZh: "阿拉斯加",   abbr: "AK", type: "state" },
  { fips: "04", name: "Arizona",              nameZh: "亚利桑那",   abbr: "AZ", type: "state" },
  { fips: "05", name: "Arkansas",             nameZh: "阿肯色",     abbr: "AR", type: "state" },
  { fips: "06", name: "California",           nameZh: "加利福尼亚", abbr: "CA", type: "state" },
  { fips: "08", name: "Colorado",             nameZh: "科罗拉多",   abbr: "CO", type: "state" },
  { fips: "09", name: "Connecticut",          nameZh: "康涅狄格",   abbr: "CT", type: "state" },
  { fips: "10", name: "Delaware",             nameZh: "特拉华",     abbr: "DE", type: "state" },
  { fips: "11", name: "District of Columbia", nameZh: "华盛顿特区", abbr: "DC", type: "dc"    },
  { fips: "12", name: "Florida",              nameZh: "佛罗里达",   abbr: "FL", type: "state" },
  { fips: "13", name: "Georgia",              nameZh: "佐治亚",     abbr: "GA", type: "state" },
  { fips: "15", name: "Hawaii",               nameZh: "夏威夷",     abbr: "HI", type: "state" },
  { fips: "16", name: "Idaho",                nameZh: "爱达荷",     abbr: "ID", type: "state" },
  { fips: "17", name: "Illinois",             nameZh: "伊利诺伊",   abbr: "IL", type: "state" },
  { fips: "18", name: "Indiana",              nameZh: "印第安纳",   abbr: "IN", type: "state" },
  { fips: "19", name: "Iowa",                 nameZh: "爱荷华",     abbr: "IA", type: "state" },
  { fips: "20", name: "Kansas",               nameZh: "堪萨斯",     abbr: "KS", type: "state" },
  { fips: "21", name: "Kentucky",             nameZh: "肯塔基",     abbr: "KY", type: "state" },
  { fips: "22", name: "Louisiana",            nameZh: "路易斯安那", abbr: "LA", type: "state" },
  { fips: "23", name: "Maine",                nameZh: "缅因",       abbr: "ME", type: "state" },
  { fips: "24", name: "Maryland",             nameZh: "马里兰",     abbr: "MD", type: "state" },
  { fips: "25", name: "Massachusetts",        nameZh: "马萨诸塞",   abbr: "MA", type: "state" },
  { fips: "26", name: "Michigan",             nameZh: "密歇根",     abbr: "MI", type: "state" },
  { fips: "27", name: "Minnesota",            nameZh: "明尼苏达",   abbr: "MN", type: "state" },
  { fips: "28", name: "Mississippi",          nameZh: "密西西比",   abbr: "MS", type: "state" },
  { fips: "29", name: "Missouri",             nameZh: "密苏里",     abbr: "MO", type: "state" },
  { fips: "30", name: "Montana",              nameZh: "蒙大拿",     abbr: "MT", type: "state" },
  { fips: "31", name: "Nebraska",             nameZh: "内布拉斯加", abbr: "NE", type: "state" },
  { fips: "32", name: "Nevada",               nameZh: "内华达",     abbr: "NV", type: "state" },
  { fips: "33", name: "New Hampshire",        nameZh: "新罕布什尔", abbr: "NH", type: "state" },
  { fips: "34", name: "New Jersey",           nameZh: "新泽西",     abbr: "NJ", type: "state" },
  { fips: "35", name: "New Mexico",           nameZh: "新墨西哥",   abbr: "NM", type: "state" },
  { fips: "36", name: "New York",             nameZh: "纽约",       abbr: "NY", type: "state" },
  { fips: "37", name: "North Carolina",       nameZh: "北卡罗来纳", abbr: "NC", type: "state" },
  { fips: "38", name: "North Dakota",         nameZh: "北达科他",   abbr: "ND", type: "state" },
  { fips: "39", name: "Ohio",                 nameZh: "俄亥俄",     abbr: "OH", type: "state" },
  { fips: "40", name: "Oklahoma",             nameZh: "俄克拉荷马", abbr: "OK", type: "state" },
  { fips: "41", name: "Oregon",               nameZh: "俄勒冈",     abbr: "OR", type: "state" },
  { fips: "42", name: "Pennsylvania",         nameZh: "宾夕法尼亚", abbr: "PA", type: "state" },
  { fips: "44", name: "Rhode Island",         nameZh: "罗德岛",     abbr: "RI", type: "state" },
  { fips: "45", name: "South Carolina",       nameZh: "南卡罗来纳", abbr: "SC", type: "state" },
  { fips: "46", name: "South Dakota",         nameZh: "南达科他",   abbr: "SD", type: "state" },
  { fips: "47", name: "Tennessee",            nameZh: "田纳西",     abbr: "TN", type: "state" },
  { fips: "48", name: "Texas",                nameZh: "得克萨斯",   abbr: "TX", type: "state" },
  { fips: "49", name: "Utah",                 nameZh: "犹他",       abbr: "UT", type: "state" },
  { fips: "50", name: "Vermont",              nameZh: "佛蒙特",     abbr: "VT", type: "state" },
  { fips: "51", name: "Virginia",             nameZh: "弗吉尼亚",   abbr: "VA", type: "state" },
  { fips: "53", name: "Washington",           nameZh: "华盛顿州",   abbr: "WA", type: "state" },
  { fips: "54", name: "West Virginia",        nameZh: "西弗吉尼亚", abbr: "WV", type: "state" },
  { fips: "55", name: "Wisconsin",            nameZh: "威斯康星",   abbr: "WI", type: "state" },
  { fips: "56", name: "Wyoming",              nameZh: "怀俄明",     abbr: "WY", type: "state" },
];

// 5 US Territories (not in TopoJSON, rendered separately)
export interface TerritoryInfo {
  id: string;
  name: string;
  nameZh: string;
  abbr: string;
  flag: string;
}

export const US_TERRITORIES: TerritoryInfo[] = [
  { id: "PR", name: "Puerto Rico",          nameZh: "波多黎各",   abbr: "PR", flag: "🇵🇷" },
  { id: "GU", name: "Guam",                 nameZh: "关岛",       abbr: "GU", flag: "🇬🇺" },
  { id: "VI", name: "U.S. Virgin Islands",  nameZh: "美属维尔京", abbr: "VI", flag: "🇻🇮" },
  { id: "AS", name: "American Samoa",       nameZh: "美属萨摩亚", abbr: "AS", flag: "🇦🇸" },
  { id: "MP", name: "N. Mariana Islands",   nameZh: "北马里亚纳", abbr: "MP", flag: "🇲🇵" },
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

/**
 * Step 1 of the world data build: decide id / country / names for every Natural Earth
 * 10m admin-1 feature and write a lookup CSV + country meta JSON.
 * Step 2 (mapshaper) joins the CSV, dissolves, simplifies and exports TopoJSON — see build.sh.
 *
 * Usage: node build-regions.mjs <dir with a1props.json + a0props.json> <out.csv> <meta.json>
 */
import fs from "fs";
const [, , SRC, OUT_CSV, OUT_META] = process.argv;
const a1 = JSON.parse(fs.readFileSync(SRC + "/a1props.json", "utf8"));
const a0 = JSON.parse(fs.readFileSync(SRC + "/a0props.json", "utf8"));

/* ---------- dissolved groups: "A3|key" -> [English, 中文] ---------- */
const G = {
  // United Kingdom: 9 English regions + Scotland / Wales / Northern Ireland
  "GBR|NE": ["North East England", "英格兰东北"],
  "GBR|NW": ["North West England", "英格兰西北"],
  "GBR|YH": ["Yorkshire and the Humber", "约克郡-亨伯"],
  "GBR|EM": ["East Midlands", "东米德兰"],
  "GBR|WM": ["West Midlands", "西米德兰"],
  "GBR|EE": ["East of England", "英格兰东部"],
  "GBR|LN": ["Greater London", "大伦敦"],
  "GBR|SE": ["South East England", "英格兰东南"],
  "GBR|SW": ["South West England", "英格兰西南"],
  "GBR|SCT": ["Scotland", "苏格兰"],
  "GBR|WLS": ["Wales", "威尔士"],
  "GBR|NIR": ["Northern Ireland", "北爱尔兰"],
  // Italy
  "ITA|Valle d'Aosta": ["Aosta Valley", "瓦莱达奥斯塔"],
  "ITA|Piemonte": ["Piedmont", "皮埃蒙特"],
  "ITA|Lombardia": ["Lombardy", "伦巴第"],
  "ITA|Trentino-Alto Adige": ["Trentino-South Tyrol", "特伦蒂诺-上阿迪杰"],
  "ITA|Liguria": ["Liguria", "利古里亚"],
  "ITA|Emilia-Romagna": ["Emilia-Romagna", "艾米利亚-罗马涅"],
  "ITA|Marche": ["Marche", "马尔凯"],
  "ITA|Veneto": ["Veneto", "威尼托"],
  "ITA|Friuli-Venezia Giulia": ["Friuli-Venezia Giulia", "弗留利-威尼斯朱利亚"],
  "ITA|Abruzzo": ["Abruzzo", "阿布鲁佐"],
  "ITA|Molise": ["Molise", "莫利塞"],
  "ITA|Apulia": ["Apulia", "普利亚"],
  "ITA|Basilicata": ["Basilicata", "巴西利卡塔"],
  "ITA|Calabria": ["Calabria", "卡拉布里亚"],
  "ITA|Campania": ["Campania", "坎帕尼亚"],
  "ITA|Lazio": ["Lazio", "拉齐奥"],
  "ITA|Toscana": ["Tuscany", "托斯卡纳"],
  "ITA|Sicily": ["Sicily", "西西里"],
  "ITA|Sardegna": ["Sardinia", "撒丁"],
  "ITA|Umbria": ["Umbria", "翁布里亚"],
  // France (2016 regions + overseas)
  "FRA|Guyane française": ["French Guiana", "法属圭亚那"],
  "FRA|Hauts-de-France": ["Hauts-de-France", "上法兰西"],
  "FRA|Grand Est": ["Grand Est", "大东部"],
  "FRA|Provence-Alpes-Côte-d'Azur": ["Provence-Alpes-Côte d'Azur", "普罗旺斯-阿尔卑斯-蓝色海岸"],
  "FRA|Auvergne-Rhône-Alpes": ["Auvergne-Rhône-Alpes", "奥弗涅-罗讷-阿尔卑斯"],
  "FRA|Nouvelle-Aquitaine": ["Nouvelle-Aquitaine", "新阿基坦"],
  "FRA|Occitanie": ["Occitanie", "奥克西塔尼"],
  "FRA|Bourgogne-Franche-Comté": ["Bourgogne-Franche-Comté", "勃艮第-弗朗什-孔泰"],
  "FRA|Pays de la Loire": ["Pays de la Loire", "卢瓦尔河地区"],
  "FRA|Bretagne": ["Brittany", "布列塔尼"],
  "FRA|Normandie": ["Normandy", "诺曼底"],
  "FRA|Martinique": ["Martinique", "马提尼克"],
  "FRA|Guadeloupe": ["Guadeloupe", "瓜德罗普"],
  "FRA|Réunion": ["Réunion", "留尼汪"],
  "FRA|Mayotte": ["Mayotte", "马约特"],
  "FRA|Corse": ["Corsica", "科西嘉"],
  "FRA|Centre-Val de Loire": ["Centre-Val de Loire", "中央-卢瓦尔河谷"],
  "FRA|Île-de-France": ["Île-de-France", "法兰西岛"],
  // Spain
  "ESP|Ceuta": ["Ceuta", "休达"],
  "ESP|Melilla": ["Melilla", "梅利利亚"],
  "ESP|Foral de Navarra": ["Navarre", "纳瓦拉"],
  "ESP|País Vasco": ["Basque Country", "巴斯克"],
  "ESP|Aragón": ["Aragon", "阿拉贡"],
  "ESP|Cataluña": ["Catalonia", "加泰罗尼亚"],
  "ESP|Extremadura": ["Extremadura", "埃斯特雷马杜拉"],
  "ESP|Andalucía": ["Andalusia", "安达卢西亚"],
  "ESP|Galicia": ["Galicia", "加利西亚"],
  "ESP|Castilla y León": ["Castile and León", "卡斯蒂利亚-莱昂"],
  "ESP|Valenciana": ["Valencian Community", "瓦伦西亚"],
  "ESP|Murcia": ["Murcia", "穆尔西亚"],
  "ESP|Asturias": ["Asturias", "阿斯图里亚斯"],
  "ESP|Cantabria": ["Cantabria", "坎塔布里亚"],
  "ESP|Canary Is.": ["Canary Islands", "加那利群岛"],
  "ESP|Islas Baleares": ["Balearic Islands", "巴利阿里群岛"],
  "ESP|La Rioja": ["La Rioja", "拉里奥哈"],
  "ESP|Castilla-La Mancha": ["Castilla-La Mancha", "卡斯蒂利亚-拉曼恰"],
  "ESP|Madrid": ["Madrid", "马德里"],
  // Philippines
  "PHL|Autonomous Region in Muslim Mindanao (ARMM)": ["Bangsamoro", "邦萨摩洛"],
  "PHL|Davao (Region XI)": ["Davao Region", "达沃大区"],
  "PHL|Zamboanga Peninsula (Region IX)": ["Zamboanga Peninsula", "三宝颜半岛"],
  "PHL|MIMAROPA (Region IV-B)": ["Mimaropa", "民马罗巴"],
  "PHL|Dinagat Islands (Region XIII)": ["Caraga", "卡拉加"],
  "PHL|Northern Mindanao (Region X)": ["Northern Mindanao", "北棉兰老"],
  "PHL|SOCCSKSARGEN (Region XII)": ["Soccsksargen", "南哥苏萨桑"],
  "PHL|Eastern Visayas (Region VIII)": ["Eastern Visayas", "东米沙鄢"],
  "PHL|Central Luzon (Region III)": ["Central Luzon", "中吕宋"],
  "PHL|CALABARZON (Region IV-A)": ["Calabarzon", "卡拉巴松"],
  "PHL|Bicol (Region V)": ["Bicol", "比科尔"],
  "PHL|National Capital Region": ["Metro Manila", "马尼拉大都会"],
  "PHL|Ilocos (Region I)": ["Ilocos", "伊罗戈"],
  "PHL|Cagayan Valley (Region II)": ["Cagayan Valley", "卡加延河谷"],
  "PHL|Central Visayas (Region VII)": ["Central Visayas", "中米沙鄢"],
  "PHL|Western Visayas (Region VI)": ["Western Visayas", "西米沙鄢"],
  "PHL|Cordillera Administrative Region (CAR)": ["Cordillera", "科迪勒拉"],
  // Slovenia
  "SVN|Obalno-kraška": ["Coastal–Karst", "滨海-喀斯特"],
  "SVN|Pomurska": ["Mura", "穆尔河"],
  "SVN|Gorenjska": ["Upper Carniola", "上卡尼奥拉"],
  "SVN|Goriška": ["Gorizia", "戈里察"],
  "SVN|Podravska": ["Drava", "德拉瓦河"],
  "SVN|Koroška": ["Carinthia", "克恩滕"],
  "SVN|Savinjska": ["Savinja", "萨维尼亚河"],
  "SVN|Spodnjeposavska": ["Lower Sava", "下萨瓦河"],
  "SVN|Jugovzhodna Slovenija": ["Southeast Slovenia", "斯洛文尼亚东南"],
  "SVN|Notranjsko-kraška": ["Littoral–Inner Carniola", "内卡尼奥拉-喀斯特"],
  "SVN|Osrednjeslovenska": ["Central Slovenia", "中斯洛文尼亚"],
  "SVN|Zasavska": ["Central Sava", "中萨瓦河"],
  // Latvia
  "LVA|Vidzeme": ["Vidzeme", "维泽梅"],
  "LVA|Riga": ["Riga", "里加"],
  "LVA|Latgale": ["Latgale", "拉特加莱"],
  "LVA|Zemgale": ["Zemgale", "泽姆加莱"],
  "LVA|Kurzeme": ["Kurzeme", "库尔泽梅"],
  // North Macedonia
  "MKD|Southwestern": ["Southwestern", "西南区"],
  "MKD|Polog": ["Polog", "波洛格区"],
  "MKD|Southeastern": ["Southeastern", "东南区"],
  "MKD|Vardar": ["Vardar", "瓦尔达尔区"],
  "MKD|Pelagonia": ["Pelagonia", "佩拉冈尼亚区"],
  "MKD|Skopje": ["Skopje", "斯科普里区"],
  "MKD|Northeastern": ["Northeastern", "东北区"],
  "MKD|Eastern": ["Eastern", "东部区"],
  // Azerbaijan
  "AZE|Ganja-Gazakh Economic Region": ["Ganja-Gazakh", "占贾-加扎赫"],
  "AZE|Kalbajar-Lachin Economic Region": ["Kalbajar-Lachin", "克尔巴贾尔-拉钦"],
  "AZE|Naxçıvan Autonomous Republic": ["Nakhchivan", "纳希切万"],
  "AZE|Shaki-Zaqatala Economic Region": ["Shaki-Zagatala", "舍基-扎卡塔雷"],
  "AZE|Guba-Khachmaz Economic Region": ["Guba-Khachmaz", "古巴-哈奇马兹"],
  "AZE|Aran Economic Region": ["Aran", "阿兰"],
  "AZE|Lankaran Economic Region": ["Lankaran", "连科兰"],
  "AZE|Yukhari Garabakh Economic Region": ["Upper Karabakh", "上卡拉巴赫"],
  "AZE|Absheron Economic Region": ["Absheron", "阿布歇隆"],
  "AZE|Daghlig Shirvan Economic Region": ["Mountainous Shirvan", "山地希尔万"],
  // Uganda
  "UGA|Western": ["Western Region", "西部区"],
  "UGA|Central": ["Central Region", "中部区"],
  "UGA|Eastern": ["Eastern Region", "东部区"],
  "UGA|Northern": ["Northern Region", "北部区"],
  // Kosovo
  "KOS|Đakovica": ["Gjakova", "贾科维察"],
  "KOS|Prizren": ["Prizren", "普里兹伦"],
  "KOS|Gnjilane": ["Gjilan", "格尼拉内"],
  "KOS|Uroševac": ["Ferizaj", "费里扎伊"],
  "KOS|Kosovska Mitrovica": ["Mitrovica", "米特罗维察"],
  "KOS|Pristina": ["Pristina", "普里什蒂纳"],
  "KOS|Peć": ["Peja", "佩奇"],
  // Burkina Faso
  "BFA|Est": ["Est", "东部大区"],
  "BFA|Cascades": ["Cascades", "瀑布大区"],
  "BFA|Sud-Ouest": ["Sud-Ouest", "西南大区"],
  "BFA|Sahel": ["Sahel", "萨赫勒大区"],
  "BFA|Nord": ["Nord", "北部大区"],
  "BFA|Boucle du Mouhoun": ["Boucle du Mouhoun", "穆翁河湾大区"],
  "BFA|Hauts-Bassins": ["Hauts-Bassins", "上盆地大区"],
  "BFA|Centre-Est": ["Centre-Est", "中东大区"],
  "BFA|Centre-Sud": ["Centre-Sud", "中南大区"],
  "BFA|Centre-Ouest": ["Centre-Ouest", "中西大区"],
  "BFA|Plateau-Central": ["Plateau-Central", "中央高原大区"],
  "BFA|Centre": ["Centre", "中部大区"],
  "BFA|Centre-Nord": ["Centre-Nord", "中北大区"],
  // Guinea
  "GIN|Faranah": ["Faranah", "法拉纳"],
  "GIN|Kindia": ["Kindia", "金迪亚"],
  "GIN|Mamou": ["Mamou", "马木"],
  "GIN|Nzérékoré": ["Nzérékoré", "恩泽雷科雷"],
  "GIN|Kankan": ["Kankan", "康康"],
  "GIN|Boke": ["Boké", "博凯"],
  "GIN|Labé": ["Labé", "拉贝"],
  "GIN|Conakry": ["Conakry", "科纳克里"],
  // Sri Lanka
  "LKA|Næ̆gĕnahira paḷāta": ["Eastern Province", "东部省"],
  "LKA|Uturu paḷāta": ["Northern Province", "北部省"],
  "LKA|Vayamba paḷāta": ["North Western Province", "西北省"],
  "LKA|Basnāhira paḷāta": ["Western Province", "西部省"],
  "LKA|Dakuṇu paḷāta": ["Southern Province", "南部省"],
  "LKA|Sabaragamuva paḷāta": ["Sabaragamuwa", "萨伯勒格穆沃省"],
  "LKA|Ūva paḷāta": ["Uva", "乌沃省"],
  "LKA|Madhyama paḷāta": ["Central Province", "中部省"],
  "LKA|Uturumæ̆da paḷāta": ["North Central Province", "中北省"],
  // Malawi
  "MWI|Northern": ["Northern Region", "北部区"],
  "MWI|Central": ["Central Region", "中部区"],
  "MWI|Southern": ["Southern Region", "南部区"],
  // Malta
  "MLT|Malta": ["Malta Island", "马耳他岛"],
  "MLT|Gozo": ["Gozo", "戈佐岛"],
  // whole-territory merges
  "HKG|*": ["Hong Kong", "香港"],
  "VIR|*": ["U.S. Virgin Islands", "美属维尔京群岛"],
  "ASM|*": ["American Samoa", "美属萨摩亚"],
  "MNP|*": ["Northern Mariana Islands", "北马里亚纳群岛"],
  "ATA|*": ["Antarctica", "南极洲"],
  "XAD|*": ["Akrotiri and Dhekelia", "亚克罗提利与德凯利亚"],
  "UMI|*": ["U.S. Minor Outlying Islands", "美国本土外小岛屿"],
  "NZL|outlying": ["New Zealand Outlying Islands", "新西兰外岛"],
};
const GBR_REGION = {
  "Northern Ireland": "NIR",
  "West Wales and the Valleys": "WLS",
  "East Wales": "WLS",
  "Highlands and Islands": "SCT",
  "North Eastern": "SCT",
  "South Western": "SCT",
  Eastern: "SCT",
  "North West": "NW",
  "North East": "NE",
  "West Midlands": "WM",
  "East Midlands": "EM",
  "South West": "SW",
  "South East": "SE",
  East: "EE",
  "Yorkshire and the Humber": "YH",
  "Greater London": "LN",
};
const BY_REGION = new Set([
  "ITA", "FRA", "ESP", "PHL", "SVN", "LVA", "MKD", "AZE", "UGA", "KOS", "BFA", "GIN", "LKA", "MWI",
]);
const WHOLE = new Set(["HKG", "VIR", "ASM", "MNP", "ATA", "UMI"]);

/** group key for a source feature. "" = unknown (resolved to nearest neighbour), null = keep as is */
function groupKey(f) {
  const c = f.adm0_a3;
  if (WHOLE.has(c)) return "*";
  if (c === "ESB" || c === "WSB") return "*";
  if (c === "GBR") return GBR_REGION[f.region] ?? "";
  if (c === "MKD") return f.region === "Greater Skopje" ? "Skopje" : f.region || "";
  if (c === "MLT") return (f.region || "").startsWith("Gozo") ? "Gozo" : "Malta";
  if (c === "NZL")
    return f.region === "New Zealand Outlying Islands" ||
      (!f.type_en && f.iso_a2 === "NZ" && /X\d/.test(f.iso_3166_2))
      ? "outlying"
      : null;
  if (c === "HUN")
    return /^(County|Capital City)$/.test(f.type_en) ? null : f.region_sub ? "@" + f.region_sub : "";
  if (c === "IRL") return f.region_sub === "Ulster" || !f.region_sub ? null : "@" + f.region_sub;
  if (BY_REGION.has(c)) return f.region || "";
  return null;
}

/* ---------- per-feature decisions for disputed / odd areas (see DISPUTED.md) ---------- */
// source adm1_code -> country (A3) it is listed under
const COUNTRY_OVERRIDE = {
  "RUS-283": "UKR", // Crimea
  "RUS-5482": "UKR", // Sevastopol
  "CYN+00?": "CYP", // Northern Cyprus
};
// source adm1_code -> id of the region it is merged into
const MERGE_INTO = {
  "KAS+00?": "IN-LA", // Siachen Glacier -> Ladakh
  "IND-3299": "CN-XZ", // Arunachal Pradesh (South Tibet) -> Xizang
  "PFA+00?": "CN-HI", // Paracel Islands -> Hainan
  "PGA+00?": "CN-HI", // Spratly Islands -> Hainan
  "USG+00?": "CU-14", // Guantanamo Bay base -> Guantánamo province
  "KAB+00?": "KZ-KZY", // Baikonur -> Kyzylorda
};
// dropped: unnamed slivers
const DROP = new Set(["KIR+99?", "COL+99?", "VEN+99?", "MEX+99?", "RUS+99?"]);

// Dependencies are not entries of their own: each one becomes a single region of
// its sovereign state, level with that state's provinces. Natural Earth SOV_A3 -> A3.
const SOVEREIGN = {
  GB1: ["GBR", "GB"], FR1: ["FRA", "FR"], NL1: ["NLD", "NL"], CH1: ["CHN", "CN"], DN1: ["DNK", "DK"],
  US1: ["USA", "US"], AU1: ["AUS", "AU"], FI1: ["FIN", "FI"], NZ1: ["NZL", "NZ"],
};
const a0of = Object.fromEntries(a0.map((f) => [f.ADM0_A3, f]));
/** A source feature that belongs to a territory folded into one region, else null. */
function wholeTerritory(f) {
  const a = f.adm0_a3;
  if (a === "TWN") return { id: "CN-TW", c: "CHN", n: "Taiwan", z: "台湾省" };
  if (a === "ESB" || a === "WSB")
    return { id: "GB-XAD", c: "GBR", n: "Akrotiri and Dhekelia", z: "亚克罗提利与德凯利亚" };
  const m = a0of[a];
  const sov = m && m.SOVEREIGNT !== m.ADMIN ? SOVEREIGN[m.SOV_A3] : undefined;
  if (!sov) return null;
  // some territories carry their sovereign's ISO code; fall back to the A3 for those
  const iso2 = m.ISO_A2_EH && m.ISO_A2_EH !== "-99" && m.ISO_A2_EH !== sov[1] ? m.ISO_A2_EH : a;
  return {
    id: `${sov[1]}-${iso2}`,
    c: sov[0],
    n: COUNTRY_EN[a] ?? m.NAME_EN ?? m.NAME,
    z: COUNTRY_ZH[a] ?? clean(m.NAME_ZH),
  };
}
const ID_OVERRIDE = { "PRI|US-PR": "US-PR", GUM: "US-GU", VIR: "US-VI", ASM: "US-AS", MNP: "US-MP" };
const COUNTRY_ZH = {
  TWN: "台湾", CHN: "中国", XAD: "英属基地区", PSX: "巴勒斯坦", COD: "刚果（金）", COG: "刚果（布）",
  KOR: "韩国", PRK: "朝鲜", USA: "美国", GBR: "英国", MKD: "北马其顿", SWZ: "斯威士兰", CZE: "捷克",
  ARE: "阿联酋", DOM: "多米尼加", CAF: "中非", BIH: "波黑", MAC: "澳门", HKG: "香港", IOA: "澳属印度洋领地",
};
const COUNTRY_EN = {
  XAD: "Akrotiri and Dhekelia", MKD: "North Macedonia", SWZ: "Eswatini", PSX: "Palestine", SRB: "Serbia",
  TZA: "Tanzania", BHS: "Bahamas", USA: "United States", COD: "DR Congo", COG: "Congo", TLS: "Timor-Leste",
};

const clean = (s) => (s || "").replace(/\s*[（(][^）)]*[）)]\s*/g, "").trim();
const sanitize = (s) => s.replace(/[^A-Za-z0-9-]/g, "");
const dist2 = (a, b) =>
  (a.latitude - b.latitude) ** 2 +
  ((a.longitude - b.longitude) * Math.cos((a.latitude * Math.PI) / 180)) ** 2;

// resolve group keys ("" -> nearest neighbour in the same country that has one)
const keyOf = new Map();
for (const f of a1) keyOf.set(f.ne_id, groupKey(f));
for (const f of a1) {
  if (keyOf.get(f.ne_id) !== "") continue;
  let best = null;
  let bd = Infinity;
  for (const g of a1) {
    if (g.adm0_a3 !== f.adm0_a3 || !groupKey(g)) continue;
    const d = dist2(f, g);
    if (d < bd) (bd = d), (best = g);
  }
  keyOf.set(f.ne_id, best ? groupKey(best) : null);
}

const isoCount = new Map();
for (const f of a1) isoCount.set(f.iso_3166_2, (isoCount.get(f.iso_3166_2) || 0) + 1);

function ownId(f) {
  const iso = f.iso_3166_2;
  return (
    ID_OVERRIDE[`${f.adm0_a3}|${iso}`] ??
    ID_OVERRIDE[f.adm0_a3] ??
    (/^[A-Z]{2}-[A-Z0-9]{1,3}$/.test(iso) && isoCount.get(iso) === 1 ? iso : sanitize(f.adm1_code))
  );
}

// Regions far from the country they belong to. Where a country is lit as one
// piece these stay separate: lighting Britain does not light the Cayman Islands.
// Every folded territory is added below; these are the ones that are ordinary
// first-level regions in the source data.
const standalone = new Set([
  "FR-~FrenchGuiana", "FR-~Martinique", "FR-~Guadeloupe", "FR-~Reunion", "FR-~Mayotte",
  "NL-BQ1", "NL-BQ2", "NL-BQ3", // Bonaire, Saba, St. Eustatius
  "NZL-5472", // Tokelau
]);

const rows = []; // {ne_id, id}
const regions = new Map(); // id -> {c,n,z}
const missing = new Set();
for (const f of a1) {
  if (DROP.has(f.adm1_code)) continue;
  const whole = MERGE_INTO[f.adm1_code] ? null : wholeTerritory(f);
  if (whole) {
    const seen = regions.get(whole.id);
    if (seen && seen.n !== whole.n) {
      console.error("id collision", whole.id, seen.n, whole.n);
      process.exit(1);
    }
    rows.push({ ne_id: f.ne_id, id: whole.id });
    // China and the U.S. are always lit by province, so theirs need no flag
    if (whole.c !== "CHN" && whole.c !== "USA") standalone.add(whole.id);
    if (!seen) regions.set(whole.id, { c: whole.c, n: whole.n, z: whole.z });
    continue;
  }
  let c = COUNTRY_OVERRIDE[f.adm1_code] ?? f.adm0_a3;
  let id, n, z;
  const key = keyOf.get(f.ne_id);
  if (MERGE_INTO[f.adm1_code]) {
    id = MERGE_INTO[f.adm1_code];
  } else if (key != null) {
    if (key.startsWith("@")) {
      // cities merged into the county of the same name; names come from that county feature
      const name = key.slice(1);
      const county =
        a1.find((g) => g.adm0_a3 === f.adm0_a3 && groupKey(g) === null && g.name === name) ||
        a1.find((g) => g.adm0_a3 === f.adm0_a3 && g.name === name && /County/.test(g.type_en)) ||
        a1.find((g) => g.adm0_a3 === f.adm0_a3 && g.region_sub === name && /^County$/.test(g.type_en));
      if (county && keyOf.get(county.ne_id) === null) {
        id = ownId(county); // merged into an existing county feature
      } else {
        id = `${f.iso_a2}-~${sanitize(name.normalize("NFD"))}`;
        n = name;
        z = clean(county?.name_zh) || name;
        if (f.adm0_a3 === "IRL") z = z.replace(/地区$/, "郡");
      }
    } else {
      const g = G[`${c}|${key}`];
      if (!g) {
        missing.add(`${c}|${key}`);
        continue;
      }
      const prefix = f.iso_a2 && f.iso_a2 !== "-1" ? f.iso_a2 : c;
      id = ID_OVERRIDE[c] ?? (key === "*" ? `${c}-ALL` : `${prefix}-~${sanitize(g[0].normalize("NFD"))}`);
      [n, z] = g;
    }
  } else {
    id = ownId(f);
    n = f.name || f.admin;
    z = clean(f.name_zh) || n;
  }
  rows.push({ ne_id: f.ne_id, id });
  if (n && regions.has(id) && regions.get(id).n !== n) {
    console.error("id collision", id, regions.get(id).n, n);
    process.exit(1);
  }
  if (n && !regions.has(id)) regions.set(id, { c, n, z });
}
if (missing.size) {
  console.error("MISSING group names:", [...missing]);
  process.exit(1);
}
for (const r of rows)
  if (!regions.has(r.id)) {
    console.error("merge target missing", r.id);
    process.exit(1);
  }

/* ---------- country meta ---------- */
const CONT = {
  Asia: "AS", Europe: "EU", Africa: "AF", "North America": "NA", "South America": "SA",
  Oceania: "OC", Antarctica: "AN", "Seven seas (open ocean)": "OC",
};
const a0by = Object.fromEntries(a0.map((f) => [f.ADM0_A3, f]));
const countries = {};
for (const { c } of regions.values()) {
  if (countries[c]) continue;
  const f = a0by[c === "XAD" ? "ESB" : c];
  if (!f) {
    console.error("no admin0 for", c);
    process.exit(1);
  }
  const iso2 = f.ISO_A2_EH && f.ISO_A2_EH !== "-99" ? f.ISO_A2_EH : "";
  countries[c] = {
    n: COUNTRY_EN[c] ?? f.NAME_EN ?? f.NAME,
    z: COUNTRY_ZH[c] ?? clean(f.NAME_ZH),
    k: CONT[f.CONTINENT] ?? "OC",
    i: c === "XAD" ? "" : iso2,
    x: +f.LABEL_X.toFixed(2),
    y: +f.LABEL_Y.toFixed(2),
    r: f.LABELRANK,
    // sovereign state (A3) when this entry is a dependency / territory
    s: c === "XAD" ? "GB1" : c === "PSX" ? undefined : f.SOVEREIGNT !== f.ADMIN ? f.SOV_A3 : undefined,
  };
}
const CONT_FIX = { ATF: "AN", HMD: "AN", SGS: "AN", IOT: "AS", MDV: "AS", MUS: "AF", SYC: "AF", SHN: "AF" };
for (const [c, k] of Object.entries(CONT_FIX)) if (countries[c]) countries[c].k = k;

const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
const lines = ["ne_id,rid,c,n,z"];
for (const r of rows) {
  const g = regions.get(r.id);
  lines.push([r.ne_id, esc(r.id), g.c, esc(g.n), esc(g.z)].join(","));
}
fs.writeFileSync(OUT_CSV, lines.join("\n"), "utf8");
for (const id of standalone)
  if (!regions.has(id)) {
    console.error("standalone region missing", id);
    process.exit(1);
  }
fs.writeFileSync(OUT_META, JSON.stringify({ countries, standalone: [...standalone] }), "utf8");
console.log(
  `features ${a1.length} -> kept ${rows.length} -> regions ${regions.size}, countries ${Object.keys(countries).length}`
);
const per = {};
for (const g of regions.values()) per[g.c] = (per[g.c] || 0) + 1;
console.log(
  ["GBR", "ITA", "FRA", "ESP", "HUN", "IRL", "MKD", "NZL", "USA", "CHN", "UKR", "RUS", "CYP", "SOM", "MLT", "AUS"]
    .map((c) => c + ":" + per[c])
    .join(" ")
);

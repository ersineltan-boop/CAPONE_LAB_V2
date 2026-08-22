import { readFileSync } from "node:fs";
import { fetchJson, fetchText } from "../src/collector/http";

const universe = JSON.parse(
  readFileSync(new URL("../data/registry/brand-universe.json", import.meta.url), "utf-8"),
) as {
  brands: Array<{ id: string; brand: string; officialUrl: string; isActive: boolean }>;
};

const PRIORITY_IDS = [
  "by-far",
  "wandler",
  "reformation",
  "atp-atelier",
  "nodaleto",
  "reike-nen",
  "senso",
  "gia-borghini",
  "malone-souliers",
  "emme-parsons",
  "cult-gaia",
  "staud",
  "nomasei",
  "flabelus",
  "naguisa",
  "billi-bi",
  "pavement",
  "lemon-jelly",
  "softwaves",
  "tuas",
  "maria-carlota",
  "jude",
  "yuul-yie",
  "carel",
  "coperni",
  "cecilie-bahnsen",
  "simone-rocha",
  "amina-muaddi",
  "sophia-webster",
  "manu-atelier",
  "pretty-ballerinas",
  "vince-camuto",
  "nine-west",
  "marc-fisher",
  "axel-arigato",
  "melissa",
  "birkenstock",
  "camper",
  "hispanitas",
  "wonders",
  "jonak",
  "bobbies",
  "luiza-barcelos",
  "vicenza",
  "santa-lolla",
  "jorge-bischoff",
  "carrano",
  "bottero",
  "petite-jolie",
  "fly-london",
  "k-jacques",
  "nomasei",
  "repetto",
  "rouje",
  "s-zane",
  "naguisa",
  "flabelus",
];

const extra = [
  { id: "veja", brand: "VEJA", officialUrl: "https://www.veja-store.com" },
  { id: "golden-goose", brand: "GOLDEN GOOSE", officialUrl: "https://www.goldengoose.com" },
  { id: "autry", brand: "AUTRY", officialUrl: "https://www.autry-usa.com" },
  { id: "moon-boot", brand: "MOON BOOT", officialUrl: "https://www.moonboot.com" },
  { id: "tkees", brand: "TKEES", officialUrl: "https://www.tkees.com" },
  { id: "maguire", brand: "MAGUIRE", officialUrl: "https://maguireshop.com" },
  { id: "loeffler-randall", brand: "LOEFFLER RANDALL", officialUrl: "https://www.loefflerrandall.com" },
  { id: "freda-salvador", brand: "FREDA SALVADOR", officialUrl: "https://www.fredasalvador.com" },
  { id: "sarah-flint", brand: "SARAH FLINT", officialUrl: "https://www.sarahflint.com" },
  { id: "bibi-lou", brand: "BIBI LOU", officialUrl: "https://www.bibilou.com" },
  { id: "brother-vellies", brand: "BROTHER VELLIES", officialUrl: "https://www.brothervellies.com" },
  { id: "intentionally-blank", brand: "INTENTIONALLY BLANK", officialUrl: "https://www.intentionally-blank.com" },
  { id: "paloma-wool", brand: "PALOMA WOOL", officialUrl: "https://www.palomawool.com" },
  { id: "aera", brand: "AERA", officialUrl: "https://www.aeralondon.com" },
  { id: "margaux", brand: "MARGAUX", officialUrl: "https://www.margauxny.com" },
  { id: "4ccccees", brand: "4CCCCEES", officialUrl: "https://www.4ccccees.com" },
  { id: "alexandre-birman", brand: "ALEXANDRE BIRMAN", officialUrl: "https://www.alexandrebirman.com" },
];

const byId = new Map(universe.brands.map((entry) => [entry.id, entry]));
const targets: Array<{ id: string; brand: string; officialUrl: string; isActive: boolean }> = [];
for (const id of PRIORITY_IDS) {
  const entry = byId.get(id);
  if (entry && !entry.isActive && !targets.some((item) => item.id === id)) targets.push(entry);
}
for (const item of extra) {
  if (!targets.some((entry) => entry.id === item.id)) {
    targets.push({ ...item, isActive: false });
  }
}

console.log(`Probing ${targets.length} Shopify-likely URLs`);
for (const target of targets) {
  const base = target.officialUrl.replace(/\/$/, "");
  const products = await fetchJson<{ products?: unknown[] }>(`${base}/products.json?limit=2`, 400);
  let collectionsStatus = "-";
  if (products.ok && (products.data?.products?.length ?? 0) > 0) {
    const collections = await fetchJson<{ collections?: unknown[] }>(
      `${base}/collections.json?limit=5`,
      200,
    );
    collectionsStatus = collections.ok
      ? `collections=${collections.data?.collections?.length ?? 0}`
      : `collections-fail ${collections.status}`;
  }
  const shopify =
    products.ok && (products.data?.products?.length ?? 0) > 0
      ? `SHOPIFY products=${products.data?.products?.length}`
      : `no-shopify ${products.status ?? "err"} ${products.error ?? ""}`;
  if (!products.ok && products.status === 0) {
    const home = await fetchText(base, { delayMs: 200 });
    console.log(`${target.id}\t${shopify}\thome=${home.status}\t${collectionsStatus}`);
  } else {
    console.log(`${target.id}\t${shopify}\t${collectionsStatus}`);
  }
}

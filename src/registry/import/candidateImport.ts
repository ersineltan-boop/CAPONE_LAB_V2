import type { BrandUniverseEntry, BrandUniverseFile } from "../build/types";
import {
  normalizeBrandId,
  normalizeBrandName,
  normalizeOfficialUrl,
} from "../build/normalize";

export interface BrandCandidateInput {
  brand: string;
  officialUrl: string;
  country: string;
  notes?: string;
}

export const WAVE1_BRAND_CANDIDATES: readonly BrandCandidateInput[] = [
  { brand: "ZARA", officialUrl: "https://www.zara.com", country: "Spain" },
  { brand: "MANGO", officialUrl: "https://shop.mango.com", country: "Spain" },
  { brand: "MASSIMO DUTTI", officialUrl: "https://www.massimodutti.com", country: "Spain" },
  { brand: "COS", officialUrl: "https://www.cos.com", country: "Sweden" },
  { brand: "& OTHER STORIES", officialUrl: "https://www.stories.com", country: "Sweden" },
  { brand: "AEYDE", officialUrl: "https://www.aeyde.com", country: "Germany" },
  { brand: "DEAR FRANCES", officialUrl: "https://www.dearfrances.com", country: "USA" },
  { brand: "MIISTA", officialUrl: "https://www.miista.com", country: "Spain" },
  { brand: "ALOHAS", officialUrl: "https://www.alohas.io", country: "Spain" },
  { brand: "TONY BIANCO", officialUrl: "https://tonybianco.com.au", country: "Australia" },
  { brand: "SAM EDELMAN", officialUrl: "https://www.samedelman.com", country: "USA" },
  { brand: "STUART WEITZMAN", officialUrl: "https://www.stuartweitzman.com", country: "USA" },
  { brand: "AQUAZZURA", officialUrl: "https://www.aquazzura.com", country: "Italy" },
  { brand: "GIANVITO ROSSI", officialUrl: "https://www.gianvitorossi.com", country: "Italy" },
  { brand: "PARIS TEXAS", officialUrl: "https://paristexasbrand.com", country: "Italy" },
  { brand: "ANCIENT GREEK SANDALS", officialUrl: "https://www.ancient-greek-sandals.com", country: "Greece" },
  { brand: "VAGABOND SHOEMAKERS", officialUrl: "https://www.vagabond.com", country: "Sweden" },
  { brand: "GANNI", officialUrl: "https://www.ganni.com", country: "Denmark" },
  { brand: "KHAITE", officialUrl: "https://khaite.com", country: "USA" },
  { brand: "THE ATTICO", officialUrl: "https://www.theattico.com", country: "Italy" },
];

export const TODAY_EXPANSION_CANDIDATES: readonly BrandCandidateInput[] = [
  { brand: "REFORMATION", officialUrl: "https://www.thereformation.com", country: "USA" },
  { brand: "VINCE CAMUTO", officialUrl: "https://www.vincecamuto.com", country: "USA" },
  { brand: "NINE WEST", officialUrl: "https://ninewest.com", country: "USA" },
  { brand: "CAMPER", officialUrl: "https://www.camper.com", country: "Spain" },
  { brand: "AXEL ARIGATO", officialUrl: "https://axelarigato.com", country: "Sweden" },
  { brand: "VEJA", officialUrl: "https://www.veja-store.com", country: "France" },
  { brand: "GOLDEN GOOSE", officialUrl: "https://www.goldengoose.com", country: "Italy" },
  { brand: "AUTRY", officialUrl: "https://www.autry-usa.com", country: "Italy" },
  { brand: "MOON BOOT", officialUrl: "https://www.moonboot.com", country: "Italy" },
  { brand: "BIRKENSTOCK", officialUrl: "https://www.birkenstock.com", country: "Germany" },
  { brand: "MELISSA", officialUrl: "https://www.melissa.com.br", country: "Brazil" },
  { brand: "JW ANDERSON", officialUrl: "https://www.jwanderson.com", country: "UK" },
  { brand: "ACNE STUDIOS", officialUrl: "https://www.acnestudios.com", country: "Sweden" },
  { brand: "ISABEL MARANT", officialUrl: "https://www.isabelmarant.com", country: "France" },
  { brand: "MARNI", officialUrl: "https://www.marni.com", country: "Italy" },
  { brand: "MAISON MARGIELA", officialUrl: "https://www.maisonmargiela.com", country: "France" },
  { brand: "CHLOÉ", officialUrl: "https://www.chloe.com", country: "France" },
  { brand: "JIMMY CHOO", officialUrl: "https://www.jimmychoo.com", country: "UK" },
  { brand: "MANOLO BLAHNIK", officialUrl: "https://www.manoloblahnik.com", country: "UK" },
  { brand: "ROGER VIVIER", officialUrl: "https://www.rogervivier.com", country: "France" },
  { brand: "FERRAGAMO", officialUrl: "https://www.ferragamo.com", country: "Italy" },
  { brand: "TKEES", officialUrl: "https://www.tkees.com", country: "USA" },
  { brand: "MAGUIRE", officialUrl: "https://maguireshop.com", country: "Canada" },
  { brand: "LOEFFLER RANDALL", officialUrl: "https://www.loefflerrandall.com", country: "USA" },
  { brand: "FREDA SALVADOR", officialUrl: "https://www.fredasalvador.com", country: "USA" },
  { brand: "SARAH FLINT", officialUrl: "https://www.sarahflint.com", country: "USA" },
  { brand: "BIBI LOU", officialUrl: "https://www.bibilou.com", country: "Spain" },
  { brand: "BROTHER VELLIES", officialUrl: "https://www.brothervellies.com", country: "USA" },
  { brand: "INTENTIONALLY BLANK", officialUrl: "https://www.intentionally-blank.com", country: "USA" },
  { brand: "PALOMA WOOL", officialUrl: "https://www.palomawool.com", country: "Spain" },
  { brand: "AERA", officialUrl: "https://www.aeralondon.com", country: "UK" },
  { brand: "MARGAUX", officialUrl: "https://www.margauxny.com", country: "USA" },
  { brand: "4CCCCEES", officialUrl: "https://www.4ccccees.com", country: "Korea" },
  { brand: "ALEXANDRE BIRMAN", officialUrl: "https://www.alexandrebirman.com", country: "Brazil" },
];

export const EXPANSION_PROBE_BRAND_IDS: readonly string[] = [
  "zara",
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
  "tkees",
  "maguire",
  "loeffler-randall",
  "freda-salvador",
  "sarah-flint",
  "bibi-lou",
  "brother-vellies",
  "intentionally-blank",
  "paloma-wool",
  "aera",
  "margaux",
  "4ccccees",
  "alexandre-birman",
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
  "carrano",
  "petite-jolie",
  "fly-london",
  "k-jacques",
  "repetto",
  "veja",
  "golden-goose",
  "autry",
  "moon-boot",
];

export function createInactiveCandidateEntry(
  input: BrandCandidateInput,
): BrandUniverseEntry {
  return {
    id: normalizeBrandId(input.brand),
    brand: normalizeBrandName(input.brand),
    officialUrl: input.officialUrl.trim(),
    country: input.country.trim(),
    segment: "UNCLASSIFIED",
    influenceRole: "UNCLASSIFIED",
    trackingPriority: "P2",
    isActive: false,
    collectorType: "UNKNOWN",
    collectionStatus: "NEEDS_PROBE",
    footwearFocus: "WOMENS_FOOTWEAR",
    womenFootwearRelevant: true,
    sourceType: "BRAND",
    notes: input.notes ?? "Wave 1 candidate — probe before activation",
    footwearInfluence: 0,
    directionalInfluence: 0,
    commercialInfluence: 0,
    collectionUrl: null,
    collectionPaths: [],
    productLimit: 20,
    supportsMultipleImages: false,
    discoverySources: [],
    classificationStatus: "UNREVIEWED",
    radarEligible: false,
  };
}

export function importBrandCandidates(
  universe: BrandUniverseFile,
  candidates: readonly BrandCandidateInput[],
): {
  universe: BrandUniverseFile;
  added: BrandUniverseEntry[];
  alreadyPresent: Array<{ brand: string; id: string; reason: string }>;
} {
  const brands = [...(universe.brands ?? [])];
  const seenIds = new Set(brands.map((entry) => entry.id));
  const seenNames = new Set(brands.map((entry) => normalizeBrandName(entry.brand)));
  const seenUrls = new Set(
    brands.map((entry) => normalizeOfficialUrl(entry.officialUrl)),
  );
  const added: BrandUniverseEntry[] = [];
  const alreadyPresent: Array<{ brand: string; id: string; reason: string }> = [];

  for (const candidate of candidates) {
    const id = normalizeBrandId(candidate.brand);
    const name = normalizeBrandName(candidate.brand);
    const url = normalizeOfficialUrl(candidate.officialUrl);
    if (seenIds.has(id)) {
      alreadyPresent.push({ brand: candidate.brand, id, reason: "duplicate id" });
      continue;
    }
    if (seenNames.has(name)) {
      alreadyPresent.push({ brand: candidate.brand, id, reason: "duplicate brand name" });
      continue;
    }
    if (seenUrls.has(url)) {
      alreadyPresent.push({ brand: candidate.brand, id, reason: "duplicate official URL" });
      continue;
    }
    const entry = createInactiveCandidateEntry(candidate);
    brands.push(entry);
    added.push(entry);
    seenIds.add(id);
    seenNames.add(name);
    seenUrls.add(url);
  }

  return {
    universe: {
      ...universe,
      version: 1,
      generatedAt: new Date().toISOString(),
      brands,
    },
    added,
    alreadyPresent,
  };
}

export function canActivateAfterProbe(input: {
  recommendation: string;
  productDiscoveryWorks: boolean;
  sampleProductCount: number;
}): boolean {
  return (
    input.recommendation === "READY_AUTOMATIC" &&
    input.productDiscoveryWorks &&
    input.sampleProductCount > 0
  );
}

export function canActivateAfterTestCollection(input: {
  probeReady: boolean;
  collectedProductCount: number;
}): boolean {
  return input.probeReady && input.collectedProductCount > 0;
}

export function activationNotes(platform: string, collectedCount: number): string {
  return `Wave 1 — activated after ${platform} probe and test collection (${collectedCount} women's footwear products)`;
}

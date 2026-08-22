import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  normalizeBrandId,
  normalizeBrandName,
  normalizeOfficialUrl,
} from "../src/registry/build/normalize";
import type { BrandUniverseEntry, BrandUniverseFile } from "../src/registry/build/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const UNIVERSE_FILE = join(ROOT, "data", "registry", "brand-universe.json");

const WAVE2_BRANDS: Array<{ brand: string; officialUrl: string; country: string }> = [
  { brand: "THE ROW", officialUrl: "https://www.therow.com", country: "USA" },
  { brand: "BOTTEGA VENETA", officialUrl: "https://www.bottegaveneta.com", country: "Italy" },
  { brand: "PRADA", officialUrl: "https://www.prada.com", country: "Italy" },
  { brand: "MIU MIU", officialUrl: "https://www.miumiu.com", country: "Italy" },
  { brand: "ALAÏA", officialUrl: "https://www.maison-alaia.com", country: "France" },
  { brand: "LOEWE", officialUrl: "https://www.loewe.com", country: "Spain" },
  { brand: "SAINT LAURENT", officialUrl: "https://www.ysl.com", country: "France" },
  { brand: "CELINE", officialUrl: "https://www.celine.com", country: "France" },
  { brand: "GUCCI", officialUrl: "https://www.gucci.com", country: "Italy" },
  { brand: "VALENTINO GARAVANI", officialUrl: "https://www.valentino.com", country: "Italy" },
  { brand: "BALENCIAGA", officialUrl: "https://www.balenciaga.com", country: "France" },
  { brand: "FERRAGAMO", officialUrl: "https://www.ferragamo.com", country: "Italy" },
  { brand: "KHAITE", officialUrl: "https://khaite.com", country: "USA" },
  { brand: "TOTEME", officialUrl: "https://toteme.com", country: "Sweden" },
  { brand: "JIL SANDER", officialUrl: "https://www.jilsander.com", country: "Germany" },
  { brand: "MAISON MARGIELA", officialUrl: "https://www.maisonmargiela.com", country: "France" },
  { brand: "LEMAIRE", officialUrl: "https://www.lemaire.fr", country: "France" },
  { brand: "COURRÈGES", officialUrl: "https://www.courreges.com", country: "France" },
  { brand: "JACQUEMUS", officialUrl: "https://www.jacquemus.com", country: "France" },
  { brand: "COPERNI", officialUrl: "https://coperni.com", country: "France" },
  { brand: "ACNE STUDIOS", officialUrl: "https://www.acnestudios.com", country: "Sweden" },
  { brand: "DRIES VAN NOTEN", officialUrl: "https://www.driesvannoten.com", country: "Belgium" },
  { brand: "MARNI", officialUrl: "https://www.marni.com", country: "Italy" },
  { brand: "CHLOÉ", officialUrl: "https://www.chloe.com", country: "France" },
  { brand: "PROENZA SCHOULER", officialUrl: "https://www.proenzaschouler.com", country: "USA" },
  { brand: "ISABEL MARANT", officialUrl: "https://www.isabelmarant.com", country: "France" },
  { brand: "GANNI", officialUrl: "https://www.ganni.com", country: "Denmark" },
  { brand: "CECILIE BAHNSEN", officialUrl: "https://ceciliebahnsen.com", country: "Denmark" },
  { brand: "SIMONE ROCHA", officialUrl: "https://simonerocha.com", country: "United Kingdom" },
  { brand: "JW ANDERSON", officialUrl: "https://www.jwanderson.com", country: "United Kingdom" },
  { brand: "AMINA MUADDI", officialUrl: "https://aminamuaddi.com", country: "France" },
  { brand: "AQUAZZURA", officialUrl: "https://www.aquazzura.com", country: "Italy" },
  { brand: "GIANVITO ROSSI", officialUrl: "https://www.gianvitorossi.com", country: "Italy" },
  { brand: "MANOLO BLAHNIK", officialUrl: "https://www.manoloblahnik.com", country: "United Kingdom" },
  { brand: "JIMMY CHOO", officialUrl: "https://www.jimmychoo.com", country: "United Kingdom" },
  { brand: "CHRISTIAN LOUBOUTIN", officialUrl: "https://www.christianlouboutin.com", country: "France" },
  { brand: "ROGER VIVIER", officialUrl: "https://www.rogervivier.com", country: "France" },
  { brand: "RENÉ CAOVILLA", officialUrl: "https://www.renecaovilla.com", country: "Italy" },
  { brand: "SERGIO ROSSI", officialUrl: "https://www.sergiorossi.com", country: "Italy" },
  { brand: "CASADEI", officialUrl: "https://www.casadei.com", country: "Italy" },
  { brand: "LE SILLA", officialUrl: "https://www.lesilla.com", country: "Italy" },
  { brand: "PARIS TEXAS", officialUrl: "https://paristexasbrand.com", country: "Italy" },
  { brand: "GIA BORGHINI", officialUrl: "https://www.giaborghini.it", country: "Italy" },
  { brand: "MALONE SOULIERS", officialUrl: "https://www.malonesouliers.com", country: "United Kingdom" },
  { brand: "SOPHIA WEBSTER", officialUrl: "https://www.sophiawebster.com", country: "United Kingdom" },
  { brand: "EMME PARSONS", officialUrl: "https://emmeparsons.com", country: "USA" },
  { brand: "CULT GAIA", officialUrl: "https://cultgaia.com", country: "USA" },
  { brand: "STAUD", officialUrl: "https://staud.clothing", country: "USA" },
  { brand: "TORY BURCH", officialUrl: "https://www.toryburch.com", country: "USA" },
  { brand: "COACH", officialUrl: "https://www.coach.com", country: "USA" },
  { brand: "MICHAEL KORS", officialUrl: "https://www.michaelkors.com", country: "USA" },
  { brand: "KATE SPADE", officialUrl: "https://www.katespade.com", country: "USA" },
  { brand: "SAM EDELMAN", officialUrl: "https://www.samedelman.com", country: "USA" },
  { brand: "MARC FISHER", officialUrl: "https://www.marcfisherfootwear.com", country: "USA" },
  { brand: "VINCE CAMUTO", officialUrl: "https://www.vincecamuto.com", country: "USA" },
  { brand: "NINE WEST", officialUrl: "https://ninewest.com", country: "USA" },
  { brand: "REFORMATION", officialUrl: "https://www.thereformation.com", country: "USA" },
  { brand: "BY FAR", officialUrl: "https://byfar.com", country: "Bulgaria" },
  { brand: "WANDLER", officialUrl: "https://wandler.com", country: "Netherlands" },
  { brand: "MANU ATELIER", officialUrl: "https://manuatelier.com", country: "Türkiye" },
  { brand: "CAREL", officialUrl: "https://www.carel.fr", country: "France" },
  { brand: "REPETTO", officialUrl: "https://www.repetto.com", country: "France" },
  { brand: "NOMASEI", officialUrl: "https://nomasei.com", country: "France" },
  { brand: "K.JACQUES", officialUrl: "https://www.kjacques.fr", country: "France" },
  { brand: "SÉZANE", officialUrl: "https://www.sezane.com", country: "France" },
  { brand: "ROUJE", officialUrl: "https://www.rouje.com", country: "France" },
  { brand: "CAMPER", officialUrl: "https://www.camper.com", country: "Spain" },
  { brand: "PRETTY BALLERINAS", officialUrl: "https://www.prettyballerinas.com", country: "Spain" },
  { brand: "HISPANITAS", officialUrl: "https://www.hispanitas.com", country: "Spain" },
  { brand: "WONDERS", officialUrl: "https://wonders.com", country: "Spain" },
  { brand: "PEDRO MIRALLES", officialUrl: "https://www.pedromiralles.com", country: "Spain" },
  { brand: "MASCARÓ", officialUrl: "https://www.mascaro.com", country: "Spain" },
  { brand: "NAGUISA", officialUrl: "https://naguisa.com", country: "Spain" },
  { brand: "FLABELUS", officialUrl: "https://flabelus.com", country: "Spain" },
  { brand: "VAGABOND SHOEMAKERS", officialUrl: "https://www.vagabond.com", country: "Sweden" },
  { brand: "ATP ATELIER", officialUrl: "https://atpatelier.com", country: "Sweden" },
  { brand: "AXEL ARIGATO", officialUrl: "https://axelarigato.com", country: "Sweden" },
  { brand: "BILLI BI", officialUrl: "https://billibi.com", country: "Denmark" },
  { brand: "PAVEMENT", officialUrl: "https://pavement-official.com", country: "Denmark" },
  { brand: "ANCIENT GREEK SANDALS", officialUrl: "https://www.ancient-greek-sandals.com", country: "Greece" },
  { brand: "BIRKENSTOCK", officialUrl: "https://www.birkenstock.com", country: "Germany" },
  { brand: "MELISSA", officialUrl: "https://www.melissa.com.br", country: "Brazil" },
  { brand: "CARRANO", officialUrl: "https://www.carrano.com.br", country: "Brazil" },
  { brand: "BOTTERO", officialUrl: "https://www.bottero.net", country: "Brazil" },
  { brand: "DUMOND", officialUrl: "https://www.dumond.com.br", country: "Brazil" },
  { brand: "PETITE JOLIE", officialUrl: "https://www.petitejolie.com.br", country: "Brazil" },
  { brand: "PICCADILLY", officialUrl: "https://www.piccadilly.com.br", country: "Brazil" },
  { brand: "RAMARIM", officialUrl: "https://www.ramarim.com.br", country: "Brazil" },
  { brand: "RAPHAELLA BOOZ", officialUrl: "https://www.raphaellabooz.com.br", country: "Brazil" },
  { brand: "USAFLEX", officialUrl: "https://www.usaflex.com.br", country: "Brazil" },
  { brand: "VIZZANO", officialUrl: "https://www.vizzano.com.br", country: "Brazil" },
  { brand: "MOLECA", officialUrl: "https://www.moleca.com.br", country: "Brazil" },
  { brand: "LEMON JELLY", officialUrl: "https://www.lemonjelly.com", country: "Portugal" },
  { brand: "FLY LONDON", officialUrl: "https://www.flylondon.com", country: "United Kingdom" },
  { brand: "SOFTWAVES", officialUrl: "https://www.softwavesshop.com", country: "Portugal" },
  { brand: "TUAS", officialUrl: "https://www.tuas-studio.com", country: "Portugal" },
  { brand: "MARIA CARLOTA", officialUrl: "https://amariacarlota.com", country: "Portugal" },
  { brand: "CHARLES & KEITH", officialUrl: "https://www.charleskeith.com", country: "Singapore" },
  { brand: "PAZZION", officialUrl: "https://www.pazzion.com", country: "Singapore" },
  { brand: "PEDRO", officialUrl: "https://www.pedroshoes.com", country: "Singapore" },
];

function createWave2Entry(input: {
  brand: string;
  officialUrl: string;
  country: string;
}): BrandUniverseEntry {
  return {
    id: normalizeBrandId(input.brand),
    brand: input.brand.trim().toUpperCase(),
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
    notes: "Wave 2 — classification pending review",
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

function patchExistingEntry(entry: BrandUniverseEntry): BrandUniverseEntry {
  return {
    ...entry,
    classificationStatus: entry.classificationStatus ?? "REVIEWED",
    radarEligible: entry.radarEligible ?? true,
  };
}

const universe = JSON.parse(await readFile(UNIVERSE_FILE, "utf-8")) as BrandUniverseFile;
const existing = (universe.brands ?? []).map(patchExistingEntry);

const seenIds = new Set(existing.map((entry) => entry.id));
const seenNames = new Set(existing.map((entry) => normalizeBrandName(entry.brand)));
const seenUrls = new Set(existing.map((entry) => normalizeOfficialUrl(entry.officialUrl)));

const added: string[] = [];
const skipped: Array<{ brand: string; reason: string }> = [];

for (const candidate of WAVE2_BRANDS) {
  const id = normalizeBrandId(candidate.brand);
  const name = normalizeBrandName(candidate.brand);
  const url = normalizeOfficialUrl(candidate.officialUrl);

  if (seenIds.has(id)) {
    skipped.push({ brand: candidate.brand, reason: `duplicate id: ${id}` });
    continue;
  }
  if (seenNames.has(name)) {
    skipped.push({ brand: candidate.brand, reason: `duplicate brand name: ${name}` });
    continue;
  }
  if (seenUrls.has(url)) {
    skipped.push({ brand: candidate.brand, reason: `duplicate url: ${candidate.officialUrl}` });
    continue;
  }

  const entry = createWave2Entry(candidate);
  existing.push(entry);
  seenIds.add(id);
  seenNames.add(name);
  seenUrls.add(url);
  added.push(candidate.brand);
}

const next: BrandUniverseFile = {
  version: 1,
  generatedAt: new Date().toISOString(),
  brands: existing,
};

await mkdir(dirname(UNIVERSE_FILE), { recursive: true });
await writeFile(UNIVERSE_FILE, JSON.stringify(next, null, 2), "utf-8");

console.log(`Existing brands patched: ${existing.length - added.length}`);
console.log(`Wave 2 added: ${added.length}`);
console.log(`Total brands: ${existing.length}`);
if (skipped.length > 0) {
  console.log("\nSkipped:");
  for (const item of skipped) {
    console.log(`  - ${item.brand}: ${item.reason}`);
  }
}

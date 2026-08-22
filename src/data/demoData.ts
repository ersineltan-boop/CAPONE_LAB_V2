import type {
  CaponeDecisionMeta,
  DailySummary,
  GlobalMarket,
  Trend,
} from "../types";
import { deriveCaponeDecision } from "../lib/caponeDecision";

export const dailySummary: DailySummary = {
  trendsAccelerated: 3,
  newSignals: 2,
  colorMovements: 2,
  approachingMainstream: 1,
};

export const navItems = [
  { label: "Trend Radarı", href: "#trend-radari" },
  { label: "Renk", href: "#renk" },
  { label: "Ürün Grupları", href: "#urun-gruplari" },
  { label: "Erken Sinyaller", href: "#erken-sinyaller" },
  { label: "Takip Listem", href: "#takip-listem" },
  { label: "Keşiflerim", href: "#kesiflerim" },
  { label: "Kaynaklar", href: "#kaynaklar" },
];

function emptyReferenceSlots(altPrefix: string): Trend["referenceImages"] {
  return [
    { slot: 1, url: null, alt: `${altPrefix} — referans 1` },
    { slot: 2, url: null, alt: `${altPrefix} — referans 2` },
    { slot: 3, url: null, alt: `${altPrefix} — referans 3` },
  ];
}

function decisionMeta(
  inputs: CaponeDecisionMeta["inputs"],
  rationale: string,
): CaponeDecisionMeta {
  return {
    decision: deriveCaponeDecision(inputs),
    inputs,
    rationale,
  };
}

export const trends: Trend[] = [
  {
    id: "sculpted-kitten-heel",
    name: "Sculpted Kitten Heel",
    nameTr: "Heykelli Kitten Topuk",
    status: "HIZLANIYOR",
    direction:
      "Minimal siluet, yumuşak geometri ve düşük profilli heykelli topuk birleşimi",
    outlook6m:
      "Premium ve çağdaş segmentlerde hızlanan benimseme; lüks markalarda koleksiyon genişlemesi bekleniyor.",
    outlook12m:
      "Kitlesel pazara yayılmadan önce fırsat penceresi açık; fiyatlandırma ve malzeme farklılaşması kritik.",
    referenceImages: emptyReferenceSlots("Heykelli kitten topuk"),
    colors: [
      { name: "Espresso", direction: "↑" },
      { name: "Bordo", direction: "↑" },
      { name: "Krem", direction: "→" },
      { name: "Siyah", direction: "→", note: "Temel" },
    ],
    form: "Yuvarlatılmış burun, ince kayış, düşük profilli heykelli topuk",
    material: "Mat deri, yumuşak süet, sınırlı metalik aksan",
    heelSole: "45–55 mm heykelli kitten; ince taban, platform yok",
    detailAccessory: "Minimal tokalar, gizli dikiş, mikro perforasyon",
    diffusion: [
      "Öncü Tasarımcılar",
      "Lüks",
      "Premium",
      "Çağdaş",
      "Kitlesel Pazar",
    ],
    whyImportant:
      "Düşük topuk talebi güçlenirken tüketici hâlâ siluet farklılaşması arıyor. Heykelli form, hem konfor hem stil beklentisini aynı üründe birleştiriyor.",
    whyImportantShort:
      "Düşük topuk talebi güçlenirken tüketici siluet farklılaşması arıyor; heykelli form konfor ve stili birleştiriyor.",
    opportunityWindow: "En İyi Giriş Zamanı",
    caponeDecision: decisionMeta(
      {
        trendStatus: "HIZLANIYOR",
        opportunityWindow: "En İyi Giriş Zamanı",
        evidenceStrength: "yüksek",
      },
      "Trend hızlanıyor, giriş penceresi açık ve kanıt güçlü — numune geliştirmeye uygun.",
    ),
    caponeOpportunity:
      "Espresso ve bordo renklerinde, mat deri kaplama ve 50 mm heykelli topuklu tek kayışlı mary jane — çağdaş segment için Q2 lansman adayı.",
    evidence: {
      sourceCount: 14,
      brandCount: 7,
      countryCount: 4,
      strength: "yüksek",
    },
    sources: [
      {
        brand: "The Row",
        country: "ABD / İtalya",
        segment: "Lüks",
        date: "2026-02-14",
        evidenceType: "Podyum / Lookbook",
        url: null,
      },
      {
        brand: "Le Monde Mode",
        country: "Fransa",
        segment: "Premium",
        date: "2026-01-28",
        evidenceType: "Editoryal analiz",
        url: null,
      },
      {
        brand: "Milan Footwear Week",
        country: "İtalya",
        segment: "Sektör",
        date: "2026-02-03",
        evidenceType: "Fuar gözlemi",
        url: null,
      },
    ],
  },
  {
    id: "soft-volume-ballet",
    name: "Soft Volume Ballet",
    nameTr: "Yumuşak Hacimli Balerin",
    status: "YÜKSELİYOR",
    direction: "Klasik balerin formunda dolgunlaşmış burun ve yumuşak hacim",
    outlook6m:
      "Erken sinyal aşamasından yükselişe geçiş; sosyal medya ve bağımsız tasarımcılarda artan görünürlük.",
    outlook12m:
      "Ana akıma yaklaşma riski yüksek; hızlı ürün geliştirme ve net renk stratejisi gerekecek.",
    referenceImages: emptyReferenceSlots("Yumuşak hacimli balerin"),
    colors: [
      { name: "Krem", direction: "↑" },
      { name: "Toz Pembe", direction: "↑" },
      { name: "Gri", direction: "→" },
      { name: "Siyah", direction: "→", note: "Temel" },
    ],
    form: "Geniş yuvarlak burun, dolgun üst yüzey, düz taban",
    material: "Nappa deri, yumuşak süet, hafif dolgu",
    heelSole: "Tamamen düz; esnek, hafif taban",
    detailAccessory: "Minimal bant, gizli lastik, dikişsiz burun detayı",
    diffusion: ["Öncü Tasarımcılar", "Lüks", "Premium", "Çağdaş"],
    whyImportant:
      "Konfor-öncelikli tüketici davranışı balerin formunu yeniden popülerleştiriyor. Yumuşak hacim varyasyonu klasik düz balerinden ayrışarak yeni bir alt kategori yaratıyor.",
    whyImportantShort:
      "Konfor odaklı talep balerini geri getiriyor; yumuşak hacim varyasyonu klasik düz balerinden ayrışıyor.",
    opportunityWindow: "Üretime Aday",
    caponeDecision: decisionMeta(
      {
        trendStatus: "YÜKSELİYOR",
        opportunityWindow: "Üretime Aday",
        evidenceStrength: "orta",
      },
      "Yükselişte ve üretime yakın; kanıt orta düzeyde — aktif takip ve doğrulama önerilir.",
    ),
    caponeOpportunity:
      "Toz pembe ve krem tonlarında, nappa deri yumuşak hacimli balerin — günlük kullanım koleksiyonu için erken sezon adayı.",
    evidence: {
      sourceCount: 11,
      brandCount: 5,
      countryCount: 3,
      strength: "orta",
    },
    sources: [
      {
        brand: "Jacquemus",
        country: "Fransa",
        segment: "Premium",
        date: "2026-01-15",
        evidenceType: "Koleksiyon lansmanı",
        url: null,
      },
      {
        brand: "Vogue Runway",
        country: "İngiltere",
        segment: "Medya",
        date: "2026-02-01",
        evidenceType: "Trend raporu",
        url: null,
      },
    ],
  },
  {
    id: "western-refined-boot",
    name: "Western Refined Boot",
    nameTr: "Rafine Western Bot",
    status: "ERKEN SİNYAL",
    direction:
      "Western siluetin premium malzeme ve inceltilmiş detaylarla yeniden yorumu",
    outlook6m:
      "Öncü tasarımcı ve lüks segmentte sınırlı görünürlük; erken gözlem aşaması.",
    outlook12m:
      "Çağdaş ve premium segmentlere yayılma potansiyeli yüksek; mevsimsel koleksiyon entegrasyonu izlenmeli.",
    referenceImages: emptyReferenceSlots("Rafine western bot"),
    colors: [
      { name: "Espresso", direction: "↑" },
      { name: "Tabak", direction: "↑" },
      { name: "Siyah", direction: "→", note: "Temel" },
      { name: "Krem", direction: "→" },
    ],
    form: "Orta boy western bot, inceltilmiş burun, düşük blok topuk",
    material: "Distressed deri, süet kombinasyon, mat metal aksan",
    heelSole: "40 mm blok topuk; kauçuk taban",
    detailAccessory: "Minimal western dikiş, ince kemer detayı, mat toka",
    diffusion: ["Öncü Tasarımcılar", "Lüks", "Premium"],
    whyImportant:
      "Western estetiği ana akımdan çıkış yaparken, rafine yorumu premium segmentte yeni bir niş açıyor. CAPONE için mevsimsel bot koleksiyonunda farklılaşma fırsatı sunuyor.",
    whyImportantShort:
      "Western estetiği ana akımdan çıkarken rafine yorum premium segmentte yeni niş açıyor.",
    opportunityWindow: "Çok Erken",
    caponeDecision: decisionMeta(
      {
        trendStatus: "ERKEN SİNYAL",
        opportunityWindow: "Çok Erken",
        evidenceStrength: "düşük",
      },
      "Erken sinyal, dar kanıt tabanı — henüz numune kararı için erken, gözlemde kal.",
    ),
    caponeOpportunity:
      "Espresso distressed deri, inceltilmiş burun ve 40 mm blok topuklu western bot — FW26 erken sinyal takibi; henüz üretim kararı için erken.",
    evidence: {
      sourceCount: 8,
      brandCount: 4,
      countryCount: 2,
      strength: "düşük",
    },
    sources: [
      {
        brand: "Isabel Marant",
        country: "Fransa",
        segment: "Premium",
        date: "2026-01-08",
        evidenceType: "Showroom gözlemi",
        url: null,
      },
      {
        brand: "Pitti Uomo",
        country: "İtalya",
        segment: "Sektör",
        date: "2026-01-12",
        evidenceType: "Fuar trend notu",
        url: null,
      },
    ],
  },
];

export const globalMarkets: GlobalMarket[] = [
  { name: "Fransa", active: true },
  { name: "İtalya", active: true },
  { name: "İspanya", active: true },
  { name: "Portekiz", active: true },
  { name: "İngiltere", active: true },
  { name: "ABD", active: true },
  { name: "Brezilya", active: true },
  { name: "Avustralya", active: true },
  { name: "Japonya", active: true },
  { name: "Güney Kore", active: true },
  { name: "UAE / Dubai", active: true },
  { name: "İskandinavya", active: true },
  { name: "Almanya", active: true },
  { name: "Hollanda / Belçika", active: true },
];

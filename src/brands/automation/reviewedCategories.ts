import type {ModelFamily} from '../../modelFamily/types';
import type {PrimaryFootwearCategory} from '../../taxonomy/types';

/** Exact official products reviewed against their own gallery, never a model-name guess. */
export const REVIEWED_OFFICIAL_CATEGORIES: ReadonlyArray<{
  productUrl: string; imagePath: string; category: PrimaryFootwearCategory; evidence: string;
}> = [
  {productUrl:'https://manuatelier.com/products/freya-xx-white',
    imagePath:'/s/files/1/0861/2288/9534/files/2019076_Freya_White_Front.jpg',category:'SANDAL',
    evidence:'Official gallery reviewed: open toe, toe post and ankle ties; 2026-10-03.'},
  {productUrl:'https://www.sophiawebster.com/products/grace-platform-black',
    imagePath:'/s/files/1/0950/6648/9157/files/SSS24010-SW-01.png',category:'SANDAL',
    evidence:'Official gallery reviewed: open toe, toe strap, ankle strap and platform; 2026-10-03.'},
  {"productUrl": "https://naguisa.com/products/matea-marron-craft", "imagePath": "/s/files/1/0883/9715/2603/files/26IMAE18BRA-C_NAGUISA_MATEA_BROWNCRAFT_01_0353.jpg", "category": "OXFORD_DERBY", "evidence": "Official product gallery and Spanish construction copy reviewed; 2026-10-03."},
  {"productUrl": "https://naguisa.com/products/matea-marron-oscuro", "imagePath": "/s/files/1/0883/9715/2603/files/Naguisa_L9_0462_MATEA_MARRON_OSC02.jpg", "category": "OXFORD_DERBY", "evidence": "Official product gallery and Spanish construction copy reviewed; 2026-10-03."},
  {"productUrl": "https://naguisa.com/products/fidela-chocolate-trenzado", "imagePath": "/s/files/1/0883/9715/2603/files/26IFID18M20-T_NAGUISA_FIDELA_DAY_01_0011.jpg", "category": "BALLET_FLAT", "evidence": "Official product gallery and Spanish construction copy reviewed; 2026-10-03."},
  {"productUrl": "https://naguisa.com/products/fidela-negro-trenzado", "imagePath": "/s/files/1/0883/9715/2603/files/26IFID18BLA-T_NAGUISA_FIDELA_BLACKWOVEN_01_0276.jpg", "category": "BALLET_FLAT", "evidence": "Official product gallery and Spanish construction copy reviewed; 2026-10-03."},
  {"productUrl": "https://naguisa.com/products/fidela-marron-oscuro", "imagePath": "/s/files/1/0883/9715/2603/files/26IFID18MOD_NAGUISA_FIDELA_DARKBROWN_01_0288.jpg", "category": "BALLET_FLAT", "evidence": "Official product gallery and Spanish construction copy reviewed; 2026-10-03."},
  {"productUrl": "https://naguisa.com/products/cleta-taupe-wild", "imagePath": "/s/files/1/0883/9715/2603/files/Naguisa_L2_0059_CLETA_TAUPE_WILD02_cad4fd58-1a71-420e-bd9a-660de0c4acda.jpg", "category": "BALLET_FLAT", "evidence": "Official product gallery and Spanish construction copy reviewed; 2026-10-03."},
  {"productUrl": "https://naguisa.com/products/cleta-marron-oscuro", "imagePath": "/s/files/1/0883/9715/2603/files/2609-NaguisaGloria-_StudioArandaSantos-HiRes-15.jpg", "category": "BALLET_FLAT", "evidence": "Official product gallery and Spanish construction copy reviewed; 2026-10-03."},
  {"productUrl": "https://naguisa.com/products/cleta-negro-wild", "imagePath": "/s/files/1/0883/9715/2603/files/2609-NaguisaGloria-_StudioArandaSantos-HiRes-26.jpg", "category": "BALLET_FLAT", "evidence": "Official product gallery and Spanish construction copy reviewed; 2026-10-03."},
  {"productUrl": "https://naguisa.com/products/cleta-negro-pelo", "imagePath": "/s/files/1/0883/9715/2603/files/2609-NaguisaGloria-_StudioArandaSantos-HiRes-25.jpg", "category": "BALLET_FLAT", "evidence": "Official product gallery and Spanish construction copy reviewed; 2026-10-03."},
  {"productUrl": "https://naguisa.com/products/fidela-marron", "imagePath": "/s/files/1/0883/9715/2603/files/Naguisa_L13_0348_FIDELA_MARRON02.jpg", "category": "BALLET_FLAT", "evidence": "Official product gallery and Spanish construction copy reviewed; 2026-10-03."},
  {"productUrl": "https://naguisa.com/products/saturia-marron-oscuro", "imagePath": "/s/files/1/0883/9715/2603/files/Naguisa_L1_0014_SATURIA_MARRON_OSC.jpg", "category": "LOAFER", "evidence": "Official product gallery and Spanish construction copy reviewed; 2026-10-03."},
  {"productUrl": "https://naguisa.com/products/saturia-negro-wild", "imagePath": "/s/files/1/0883/9715/2603/files/26ISAT25BLA_NAGUISA_SATURIA_BLACKWILD_01_0443.jpg", "category": "LOAFER", "evidence": "Official product gallery and Spanish construction copy reviewed; 2026-10-03."},
];

export function reviewedOfficialCategory(family: ModelFamily): PrimaryFootwearCategory | null {
  const categories = new Set(family.variants.flatMap(variant => {
    const review=REVIEWED_OFFICIAL_CATEGORIES.find(row=>row.productUrl===variant.url.replace(/\/+$/, '') &&
      variant.images.some(image=>{try{return new URL(image).pathname===row.imagePath;}catch{return false;}}));
    return review?[review.category]:[];
  }));
  return categories.size===1?[...categories][0]!:null;
}

/** V2 — strap topology first, coexisting strap features allowed. */

export const STRAP_ELEMENT_TYPES = [
  "TOE_POST",
  "FOREFOOT_STRAP",
  "INSTEP_STRAP",
  "MARY_JANE_STRAP",
  "T_STRAP_VERTICAL",
  "ANKLE_STRAP",
  "ANKLE_WRAP_LACE",
  "HEEL_SLING",
  "BACK_STRAP",
  "OTHER",
] as const;

export const STRAP_TOPOLOGY_DEFINITIONS = `
STEP 1 — Map every visible strap/connection as strapElements[] before assigning semantic features.

Each element needs:
- type: physical strap role
- location: anatomical zone (TOE | FOREFOOT | INSTEP | ANKLE | HEEL)
- wrapsAround: NONE | FOOT | ANKLE | HEEL
- closure: BUCKLE | TIE | ELASTIC | SLIP_ON | UNKNOWN
- confidence 0-100
- evidenceImageIndexes (0-based)

STEP 2 — Derive semantic features FROM the topology map:

THONG = YES when TOE_POST passes between 1st and 2nd toes at TOE location.

ANKLE_STRAP = YES ONLY when a physical strap at ANKLE anatomical level wraps around or fastens at the ankle.
NOT instep strap, NOT heel sling, NOT toe/forefoot band, NOT decorative vamp.

ANKLE_WRAP_LACE = thin cord/lace wrapping the ankle (store as element; may support ankle-related construction).

SLINGBACK = YES ONLY when a physical strap at HEEL level passes behind the heel.
NOT ankle-wrap, NOT instep strap, NOT backless mule with no heel strap.

MARY_JANE_STRAP = YES ONLY when a distinct horizontal strap crosses the INSTEP as a Mary Jane fastening.
NOT woven upper, NOT vamp overlay, NOT cross-over upper bands, NOT decorative lattice unless it is clearly a separate instep strap.

T_STRAP = YES when T_STRAP_VERTICAL + horizontal connection is visibly forming a T junction.

IMPORTANT: Multiple strap features may ALL be YES on the same shoe.
THONG + ANKLE_STRAP + SLINGBACK can coexist on complex sandals.

Do NOT treat coexisting strap types as contradictions.
Do NOT infer strap features from product title alone — title is hint only.
`;

export const MULTI_IMAGE_VISION_V2_SYSTEM_PROMPT = `You analyze women's footwear using MULTIPLE photos of the SAME product/color variant.

${STRAP_TOPOLOGY_DEFINITIONS}

Rules:
- First output strapElements[] for every visible band/connection.
- Then output semantic features consistent with that topology.
- value must be YES, NO, or UNKNOWN. Prefer UNKNOWN over guessing.
- confidence is 0-100 integer based on visible clarity across images.
- Do NOT mix different color variants.
- Product title/name is NOT evidence — vision only.

Only TRUE contradictions:
- OPEN_TOE and CLOSED_TOE both YES
- CLOSED_BACK and visibly open heel with no back structure both YES`;

export const MULTI_IMAGE_VISION_V2_USER_PROMPT = `Analyze these images. Return strapElements[] first, then structured features with value, confidence, evidenceImageIndexes, reasoningShort.

Be precise about anatomical location — ankle vs heel vs instep vs toe.`;

export const VERIFIER_V2_SYSTEM_PROMPT = `You are a second-pass footwear strap verifier with anatomical precision.

For each initial YES feature, verify GEOMETRY — not just presence of any strap:

ANKLE_STRAP verification:
- Which image shows it?
- Is the band at ANKLE level (not instep, not heel-only)?
- Does it wrap around or fasten at the ankle?
- Distinguish from: heel sling, instep strap, toe/forefoot strap, decorative vamp.

MARY_JANE_STRAP verification:
- Is there a distinct horizontal instep strap fastening?
- NOT woven upper, NOT cross vamp bands, NOT generic lattice.

SLINGBACK verification:
- HEEL-level strap physically passing behind the heel?
- Not ankle-wrap alone.

THONG verification:
- TOE_POST between 1st and 2nd toes visible?

Return VERIFIED only with explicit anatomical evidence.
Return REJECTED when the strap is at the wrong anatomical level.
Return UNCERTAIN when views are insufficient.

Coexisting strap types are valid — do NOT reject ankle strap just because thong or slingback also exists.`;

export const VERIFIER_V2_LOCATION_PROMPTS: Record<string, string> = {
  ankleStrap:
    "Confirm ANKLE-level band wrapping/fastening at ankle. Not heel sling, not instep-only, not toe post.",
  slingback: "Confirm HEEL-level strap passing behind the heel.",
  thong: "Confirm toe post between 1st and 2nd toes at TOE location.",
  maryJaneStrap:
    "Confirm distinct horizontal Mary-Jane instep strap. NOT woven upper or cross vamp bands.",
  tStrap: "Confirm vertical center strap + horizontal junction forming T.",
};

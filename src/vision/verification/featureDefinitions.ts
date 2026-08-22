/** AI prompt / schema tarafında kullanılan görsel tanımlar. */
export const FEATURE_VISUAL_DEFINITIONS: Record<string, string> = {
  ankleStrap:
    "Independent strap that wraps around or fastens at the ankle. NOT an instep/vamp band, NOT a thong piece, NOT a slingback heel strap.",
  slingback:
    "Strap passing behind the heel/back of foot. This is NOT an ankle strap.",
  thong:
    "Strap or piece passing between the first and second toes. NOT an ankle strap.",
  maryJaneStrap:
    "Horizontal instep strap across the top of the foot. NOT an ankle strap.",
  backless:
    "Heel/back of foot is open with no closed counter. Slingback alone does not prove backless if heel cup is closed.",
  closedBack:
    "Closed heel counter or fully enclosed back. Contradicts backless when clearly visible.",
  tStrap:
    "Central vertical strap connected to a horizontal strap forming a T on the vamp/instep.",
  openToe: "Toe box is open; toes visible.",
  closedToe: "Toe box fully closed; toes not visible.",
  lowVamp: "Low-cut vamp exposing more of the foot top.",
  highVamp: "High vamp covering more of the instep.",
};

export const VERIFIER_FOCUS_PROMPTS: Record<string, string> = {
  ankleStrap: `Do photos show a strap that truly wraps or fastens around the ankle?
Do NOT count: thong between toes, instep/mary-jane strap, slingback behind heel, decorative vamp bands.`,
  slingback: `Is there a strap passing behind the heel? Distinguish from ankle strap.`,
  thong: `Is there a thong piece between first and second toes? Distinguish from ankle strap.`,
  maryJaneStrap: `Is there a horizontal instep strap? Distinguish from ankle strap.`,
  backless: `Is the heel/back open without a closed counter?`,
  closedBack: `Is the heel counter/back clearly closed?`,
  tStrap: `Is there a visible T-strap junction?`,
  openToe: `Are toes visibly open?`,
  closedToe: `Is the toe box fully closed?`,
};

export const MULTI_IMAGE_VISION_SYSTEM_PROMPT = `You analyze women's footwear using MULTIPLE photos of the SAME product/color variant.

Rules:
- Use all images together; cite evidenceImageIndexes (0-based) for each feature.
- value must be YES, NO, or UNKNOWN. Prefer UNKNOWN over guessing.
- confidence is 0-100 integer based on visible clarity across images.
- Do NOT mix different color variants.
- Do NOT infer from product title alone.

Feature definitions:
${Object.entries(FEATURE_VISUAL_DEFINITIONS)
  .map(([key, def]) => `- ${key}: ${def}`)
  .join("\n")}`;

export const MULTI_IMAGE_VISION_USER_PROMPT = `Analyze these images of one footwear product. Return structured features with value, confidence (0-100), evidenceImageIndexes, reasoningShort.

Be conservative on strap types — thong, slingback, mary-jane and ankle strap are distinct.`;

export const VERIFIER_SYSTEM_PROMPT = `You are a second-pass footwear feature verifier. Your job is to catch false positives — especially mislabeled ankle straps.

Return VERIFIED only when visual evidence clearly supports the initial YES.
Return REJECTED when photos contradict the initial YES (e.g. thong/slingback/mary-jane mistaken for ankle strap).
Return UNCERTAIN when evidence is insufficient.

Do NOT re-run full analysis; focus on the listed feature only.`;

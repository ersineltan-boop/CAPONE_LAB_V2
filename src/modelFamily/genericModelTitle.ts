const GENERIC_PHRASES = [
  "ankle boot",
  "ballet flat",
  "ballerina flat",
  "chelsea boot",
  "combat boot",
  "court shoe",
  "cowboy boot",
  "cowboy ankle boot",
  "flip flop",
  "flip flops",
  "heeled sandal",
  "heeled sandals",
  "high heel",
  "high heels",
  "knee boot",
  "knee high boot",
  "mary jane",
  "platform sandal",
  "platform pump",
  "wedge sandal",
  "wedge mule",
  "wedge boot",
  "flat sandal",
  "flat shoe",
  "flat shoes",
  "leather boot",
  "leather pump",
  "nappa ankle boot",
  "suede ankle boot",
  "suede pump",
  "patent leather pump",
];

const GENERIC_TOKENS = new Set([
  "boot",
  "boots",
  "ankle",
  "knee",
  "flat",
  "flats",
  "ballet",
  "ballerina",
  "ballerinas",
  "slingback",
  "slingbacks",
  "mule",
  "mules",
  "sandal",
  "sandals",
  "pump",
  "pumps",
  "heel",
  "heels",
  "heeled",
  "wedge",
  "wedges",
  "sneaker",
  "sneakers",
  "loafer",
  "loafers",
  "espadrille",
  "espadrilles",
  "clog",
  "clogs",
  "oxford",
  "derby",
  "mary",
  "jane",
  "slide",
  "slides",
  "flip",
  "flop",
  "flops",
  "thong",
  "thongs",
  "platform",
  "platforms",
  "court",
  "shoe",
  "shoes",
  "footwear",
  "bootie",
  "booties",
  "slipper",
  "slippers",
  "trainer",
  "trainers",
  "chelsea",
  "cowboy",
  "combat",
  "biker",
  "high",
  "low",
  "mid",
  "view",
  "all",
  "new",
  "in",
  "women",
  "womens",
  "woman",
  "zapatos",
  "sandalias",
  "botas",
  "sapatos",
  "sandalias",
  "escarpins",
  "ballerines",
  "bottines",
  "sandales",
  "chaussures",
  "print",
  "effect",
  "classic",
  "vintage",
  "sporty",
  "soft",
  "contrast",
  "leather",
  "nappa",
  "suede",
  "patent",
  "pointed",
  "round",
  "square",
  "almond",
  "open",
  "closed",
  "block",
  "stiletto",
  "toe",
  "cap",
  "strap",
  "cut",
]);

function collapse(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function isGenericModelTitle(normalizedName: string): boolean {
  const name = collapse(normalizedName);
  if (!name) return true;
  if (GENERIC_PHRASES.includes(name)) return true;
  const tokens = name.split(" ").filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((token) => GENERIC_TOKENS.has(token));
}

export function hasDistinctiveModelToken(normalizedName: string): boolean {
  const name = collapse(normalizedName);
  if (!name || isGenericModelTitle(name)) return false;
  const tokens = name.split(" ").filter((token) => !GENERIC_TOKENS.has(token));
  return tokens.some((token) => token.length >= 3);
}

export function additionalGenericLabelsFromNames(names: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const name of names) {
    const collapsed = collapse(name);
    if (!collapsed) continue;
    counts.set(collapsed, (counts.get(collapsed) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([name, count]) => count >= 8 && isGenericModelTitle(name))
    .map(([name]) => name)
    .sort();
}

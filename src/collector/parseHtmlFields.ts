function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractField(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const regex = new RegExp(`${label}\\s*:?\\s*([^\\n|]+)`, "i");
    const match = text.match(regex);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

export function parseProductFieldsFromHtml(html: string): {
  material: string | null;
  toeShape: string | null;
  heelType: string | null;
  heelHeight: string | null;
  details: string | null;
  color: string | null;
} {
  const text = stripHtml(html);

  const material =
    extractField(text, ["Materials", "Material", "Fab~", "Upper"]) ?? null;
  const toeShape =
    extractField(text, ["Toe Style", "Toe-shape", "Toe~", "Toe Shape"]) ??
    null;
  const heelType =
    extractField(text, ["Heel Style", "Heel Type", "Features", "Heel~"]) ??
    null;
  const heelHeight =
    extractField(text, ["Heel Height", "Heel:", "Sole height", "Heel~"]) ??
    null;

  const detailsParts = [
    extractField(text, ["Closure Type", "Features", "Garment Details"]),
  ].filter(Boolean);

  return {
    material,
    toeShape,
    heelType,
    heelHeight,
    details: detailsParts.length > 0 ? detailsParts.join(" · ") : null,
    color: null,
  };
}

export function extractPrimaryColor(
  options: Array<{ name: string; values: string[] }>,
  variants: Array<{ option1?: string | null; title: string }>,
): string | null {
  const colorOption = options.find((o) =>
    /color|colour|cor/i.test(o.name),
  );
  if (colorOption?.values?.[0]) return colorOption.values[0];

  const materialOption = options.find((o) => /material/i.test(o.name));
  if (materialOption?.values?.[0]) return materialOption.values[0];

  const firstVariant = variants[0];
  if (firstVariant?.option1 && !/^\d/.test(firstVariant.option1)) {
    return firstVariant.option1;
  }

  return null;
}

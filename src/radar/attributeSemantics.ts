import type { ClusterAttribute, ClusterDimension } from "./clusterTypes";

/** Category-level form often implies these construction/detail/heel tags. */
const CATEGORY_IMPLIED: Record<string, string[]> = {
  THONG: ["OPEN_TOE", "THONG", "THONG_DETAIL"],
  MULE: ["BACKLESS"],
  SLINGBACK: ["SLINGBACK", "ANKLE_STRAP"],
  WEDGE: ["WEDGE"],
  BALLERINA: ["CLOSED_TOE"],
};

/** Same commercial idea expressed on two dimensions — keep the more specific one. */
const CROSS_DIMENSION_EQUIVALENTS: Array<{
  left: ClusterDimension;
  right: ClusterDimension;
  pairs: Array<[string, string]>;
}> = [
  {
    left: "CATEGORY",
    right: "CONSTRUCTION",
    pairs: [
      ["SLINGBACK", "SLINGBACK"],
      ["THONG", "OPEN_TOE"],
      ["MULE", "BACKLESS"],
      ["WEDGE", "WEDGE"],
    ],
  },
  {
    left: "CATEGORY",
    right: "DETAIL",
    pairs: [["THONG", "THONG"], ["THONG", "THONG_DETAIL"]],
  },
  {
    left: "CATEGORY",
    right: "HEEL_TYPE",
    pairs: [["WEDGE", "WEDGE"]],
  },
];

function findAttribute(
  attributes: ClusterAttribute[],
  dimension: ClusterDimension,
  value?: string,
): ClusterAttribute | undefined {
  return attributes.find(
    (attribute) =>
      attribute.dimension === dimension &&
      (value === undefined || attribute.value === value),
  );
}

function isImpliedByCategory(
  categoryValue: string,
  attribute: ClusterAttribute,
): boolean {
  const implied = CATEGORY_IMPLIED[categoryValue];
  if (!implied) return false;
  return implied.includes(attribute.value);
}

function isCrossDimensionDuplicate(
  attributes: ClusterAttribute[],
  attribute: ClusterAttribute,
): boolean {
  for (const rule of CROSS_DIMENSION_EQUIVALENTS) {
    for (const [leftValue, rightValue] of rule.pairs) {
      const left = findAttribute(attributes, rule.left, leftValue);
      const right = findAttribute(attributes, rule.right, rightValue);
      if (!left || !right) continue;

      if (
        attribute.dimension === rule.right &&
        attribute.value === rightValue &&
        left.value === leftValue
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Drop attributes that do not add distinct commercial signal on top of siblings.
 */
export function pruneRedundantAttributes(
  attributes: ClusterAttribute[],
): ClusterAttribute[] {
  const category = findAttribute(attributes, "CATEGORY");

  return attributes.filter((attribute) => {
    if (
      category &&
      attribute.dimension !== "CATEGORY" &&
      isImpliedByCategory(category.value, attribute)
    ) {
      return false;
    }
    if (isCrossDimensionDuplicate(attributes, attribute)) {
      return false;
    }
    return true;
  });
}

export function countMeaningfulAttributes(attributes: ClusterAttribute[]): number {
  return pruneRedundantAttributes(attributes).length;
}

export function hasMinimumDistinctAttributes(attributes: ClusterAttribute[]): boolean {
  return countMeaningfulAttributes(attributes) >= 2;
}

export function isStrictAttributeSubset(
  child: ClusterAttribute[],
  parent: ClusterAttribute[],
): boolean {
  const childPruned = pruneRedundantAttributes(child);
  const parentPruned = pruneRedundantAttributes(parent);
  if (parentPruned.length >= childPruned.length) return false;

  return parentPruned.every((parentAttribute) =>
    childPruned.some(
      (childAttribute) =>
        childAttribute.dimension === parentAttribute.dimension &&
        childAttribute.value === parentAttribute.value,
    ),
  );
}

export function attributeSpecificityRank(attributes: ClusterAttribute[]): number {
  return pruneRedundantAttributes(attributes).length;
}

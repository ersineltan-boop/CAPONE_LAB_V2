import { describe, expect, it } from "vitest";
import type { PilotProduct } from "../../collector/types";
import { mergePriorityBrandDelivery } from "../priorityDelivery";
import { isVerifiedNew } from "../../newArrivals/newness";

const input = { id: "massimo-dutti", brand: "MASSIMO DUTTI", officialUrl: "https://massimodutti.test", collectedAt: "2026-10-03T12:00:00Z" };
const product = (url: string, isNew: boolean, image: string): PilotProduct => ({
  source: "MASSIMO DUTTI", brand: "MASSIMO DUTTI", productName: "Leather ballerina", productUrl: url,
  imageUrl: image, images: [image], category: "BALLERINA", color: "black", material: "leather",
  toeShape: null, heelType: null, heelHeight: null, details: null, discoveredAt: input.collectedAt,
  collectionPath: isNew ? "/new-in" : "/women/shoes", collectionLabel: isNew ? "New In" : "Shoes",
  isNewArrivalsCollection: isNew, hasNewBadge: false,
});

describe("partial priority source refresh", () => {
  it.each([["Noa Bow Flat", "BALLET_FLAT"], ["Franco Boat Shoe", "LOAFER"], ["Paisley Smoking Slipper", "LOAFER"], ["Fireside House Shoe", "LOAFER"]])("classifies fresh %s before its display name is shortened", (title, expected) => {
    const incoming = {...product("https://massimodutti.test/product/fresh", false, "https://cdn.test/fresh.jpg"), productName: title, category: "OTHER_FOOTWEAR" as const};
    expect(mergePriorityBrandDelivery([], [incoming], input)[0]?.primaryCategory).toBe(expected);
  });
  it("publishes source NEW, updates explicit exits, and retains galleries and stable model identity", () => {
    const url = "https://massimodutti.test/product/ballerina";
    const first = mergePriorityBrandDelivery([], [product(url, true, "https://cdn.test/old.jpg")], input);
    expect(first.some((family) => family.sourceSightings?.some((sighting) => isVerifiedNew(sighting.newness)))).toBe(true);
    const second = mergePriorityBrandDelivery(first, [product(url, false, "https://cdn.test/new.jpg")], input);
    expect(second[0]!.modelFamilyId).toBe(first[0]!.modelFamilyId);
    expect(second[0]!.allImages).toEqual(expect.arrayContaining(["https://cdn.test/new.jpg", "https://cdn.test/old.jpg"]));
    expect(second[0]!.sourceSightings?.some((sighting) => isVerifiedNew(sighting.newness))).toBe(false);
  });
  it("classifies archived source titles without changing their old NEW observations", () => {
    const first = mergePriorityBrandDelivery([], [{...product("https://massimodutti.test/product/old", true, "https://cdn.test/old.jpg"),productName:"Calf hair mules",category:"MULE"}], input);
    const archived = [{...first[0]!,primaryCategory:"UNCLASSIFIED" as const}];
    const updated = mergePriorityBrandDelivery(archived,[product("https://massimodutti.test/product/fresh",false,"https://cdn.test/fresh.jpg")],input);
    const old = updated.find(family => family.modelFamilyId===archived[0]!.modelFamilyId)!;
    expect(old.primaryCategory).toBe("MULE");
    expect(old.sourceSightings).toEqual(archived[0]!.sourceSightings);
  });
  it("keeps unseen partial-source models and their evidence without inventing a confirmed exit", () => {
    const archived = mergePriorityBrandDelivery([], [product("https://massimodutti.test/product/old", true, "https://cdn.test/old.jpg")], input);
    const updated = mergePriorityBrandDelivery(archived, [product("https://massimodutti.test/product/fresh", false, "https://cdn.test/fresh.jpg")], input);
    expect(updated.find((family) => family.modelFamilyId === archived[0]!.modelFamilyId)).toEqual(archived[0]);
  });
});

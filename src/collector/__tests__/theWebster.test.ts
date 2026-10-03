import { describe, expect, it } from "vitest";

import {
  isTheWebsterExcludedBrand,
  parseTheWebsterSourceTotal,
  theWebsterRawProductToPilot,
} from "../theWebster";

describe("The Webster marketplace collector", () => {
  it("reads the official source total", () => {
    expect(parseTheWebsterSourceTotal("<div>Filter & Sort - 246 Products</div>")).toBe(246);
    expect(parseTheWebsterSourceTotal("<span>2,781 Results</span>")).toBe(2781);
    expect(
      parseTheWebsterSourceTotal(
        "<div>Filter & Sort - 25,000 Products</div><span>246 Results</span>",
      ),
    ).toBe(246);
    expect(
      parseTheWebsterSourceTotal(
        "<span>25,000 Results</span><span>246 Results</span>",
      ),
    ).toBe(246);
  });

  it("excludes fast and technical sneaker brands", () => {
    expect(isTheWebsterExcludedBrand("Nike")).toBe(true);
    expect(isTheWebsterExcludedBrand("Salomon")).toBe(true);
    expect(isTheWebsterExcludedBrand("On Running")).toBe(true);
    expect(isTheWebsterExcludedBrand("Alaia")).toBe(false);
  });

  it("preserves the product brand and never marks the baseline as new", () => {
    const product = theWebsterRawProductToPilot(
      {
        id: 1,
        title: "Le Coeur Slingback Pumps",
        handle: "le-coeur-slingback-pumps-black",
        vendor: "Alaia",
        product_type: "Shoes",
        tags: ["women", "pumps"],
        body_html: "<p>Cow Leather</p><p>Vendor Color Code: Black Brand Style: ALAIA-1</p>",
        images: [
          { src: "https://cdn.shopify.com/s/files/1/0000/products/pump_01.jpg?v=1" },
          { src: "https://cdn.shopify.com/s/files/1/0000/products/pump_02.jpg?v=1" },
        ],
        variants: [{ title: "IT 38", sku: "ALAIA-38" }],
      },
      "2026-09-26T10:00:00.000Z",
    );

    expect(product).not.toBeNull();
    expect(product?.source).toBe("the-webster");
    expect(product?.brand).toBe("Alaia");
    expect(product?.color).toBe("Black");
    expect(product?.images).toHaveLength(2);
    expect(product?.isNewArrivalsCollection).toBe(false);
    expect(product?.hasNewBadge).toBe(false);
  });
});

const migrationFixtures = [
  {
    "id": 7763275808977,
    "title": "Katy Sling 105 Elaphe LAVENDAR WATERSNAKE",
    "handle": "1565350-katsl105ellav-katy-sling-105-elaphe-purple",
    "vendor": "Andrea Wazen",
    "product_type": "Migration_Size",
    "tags": [
      "brand_style_:KATSL105ELLAV",
      "evet_merchandise:Campaign: Blooming Romance SS2026 #1",
      "flow-size-guide-backfill",
      "flow-template-backfilled",
      "manufacturer:Andrea Wazen",
      "netsuite_alu:P-11021188",
      "product_type_merchandise:Slingbacks",
      "season:SS2026",
      "subseason:PS2026"
    ],
    "body_html": "<div style=\"display: flex; flex-direction: column; gap: 10px\">\n    <div><ul>\n<li>Open toe</li>\n<li>Sling back</li>\n<li>Leather sole</li>\n<li>Stiletto heel</li>\n<li>Branded logo insole</li>\n<li>Care according to label</li>\n</ul></div>\n                        <div style=\"display: flex; flex-direction: row; gap: 5px\">\n                <span>Size Information:</span>\n                <span>True to size. Listed in EU sizing.</span>\n            </div>\n                                <div style=\"display: flex; flex-direction: row; gap: 5px\">\n                <span>Vendor Color Code:</span>\n                <span>LAVENDAR WATERSNAKE</span>\n            </div>\n                                <div style=\"display: flex; flex-direction: row; gap: 5px\">\n                <span>Brand Style:</span>\n                <span>KATSL105ELLAV</span>\n            </div>\n                                <div style=\"display: flex; flex-direction: row; gap: 5px\">\n                <span>Designer/Brand:</span>\n                <span>Andrea Wazen</span>\n            </div>\n            </div>"
  },
  {
    "id": 7763275776209,
    "title": "Katy Sling 105 Elaphe GOLD WATERSNAKE",
    "handle": "1565338-katsl105elgol-katy-sling-105-elaphe-gold",
    "vendor": "Andrea Wazen",
    "product_type": "Migration_Size",
    "tags": [
      "brand_style_:KATSL105ELGOL",
      "flow-size-guide-backfill",
      "flow-template-backfilled",
      "manufacturer:Andrea Wazen",
      "netsuite_alu:P-11021176",
      "product_type_merchandise:Slingbacks",
      "season:SS2026",
      "subseason:PS2026"
    ],
    "body_html": "<div style=\"display: flex; flex-direction: column; gap: 10px\">\n    <div><ul>\n<li>Open toe</li>\n<li>Sling back</li>\n<li>Leather sole</li>\n<li>Stiletto heel</li>\n<li>Branded logo insole</li>\n<li>Care according to label</li>\n</ul></div>\n                        <div style=\"display: flex; flex-direction: row; gap: 5px\">\n                <span>Size Information:</span>\n                <span>True to size. Listed in EU sizing.</span>\n            </div>\n                                <div style=\"display: flex; flex-direction: row; gap: 5px\">\n                <span>Vendor Color Code:</span>\n                <span>GOLD WATERSNAKE</span>\n            </div>\n                                <div style=\"display: flex; flex-direction: row; gap: 5px\">\n                <span>Brand Style:</span>\n                <span>KATSL105ELGOL</span>\n            </div>\n                                <div style=\"display: flex; flex-direction: row; gap: 5px\">\n                <span>Designer/Brand:</span>\n                <span>Andrea Wazen</span>\n            </div>\n            </div>"
  },
  {
    "id": 7762891538641,
    "title": "Begum Mesh Sling 95 WHITE MESH",
    "handle": "1583186-sb004095t001wh001-begum-mesh-sling-95-white",
    "vendor": "Amina Muaddi",
    "product_type": "Migration_Size",
    "tags": [
      "Amina Muaddi",
      "Evening Bridal",
      "flow-size-guide-backfill",
      "flow-template-backfilled",
      "FW2026",
      "P-10037028",
      "PF2026",
      "SB004095T001WH001",
      "Slingbacks"
    ],
    "body_html": "<div style=\"display: flex; flex-direction: column; gap: 10px\">\n    <div><ul>\n<li>Pointed toe design</li>\n<li>Slingback</li>\n<li>95mm Heel</li>\n<li>Starbust embellished brooch</li>\n<li>Care according to label</li>\n<li>Material: Upper: 100% Mesh; Sole: 70% Leather, 30% Rubber</li>\n</ul></div>\n                                    <div style=\"display: flex; flex-direction: row; gap: 5px\">\n                <span>Vendor Color Code:</span>\n                <span>WHITE MESH</span>\n            </div>\n                                <div style=\"display: flex; flex-direction: row; gap: 5px\">\n                <span>Brand Style:</span>\n                <span>SB004095T001WH001</span>\n            </div>\n                                <div style=\"display: flex; flex-direction: row; gap: 5px\">\n                <span>Designer/Brand:</span>\n                <span>Amina Muaddi</span>\n            </div>\n            </div>"
  },
  {
    "id": 7762713018577,
    "title": "Monsieur Moccasin Navy",
    "handle": "1138799-708902v28r0-monsieur-moccasin-navy",
    "vendor": "Bottega Veneta",
    "product_type": "Migration_Size",
    "tags": [
      "708902V28R0",
      "Bottega Veneta",
      "flow-size-guide-backfill",
      "flow-template-backfilled",
      "FW2023",
      "Moccasins",
      "P-703577",
      "PF2023",
      "Transitional Back to School"
    ],
    "body_html": "<div style=\"display: flex; flex-direction: column; gap: 10px\">\n    <div><ul>\n<li>care according to labelleatherListed in IT sizing, fits true to sizePull-on silhouette</li>\n<li>Crafted from patent leather</li>\n<li>Round toe</li>\n<li>Golden buckle detail at the front</li>\n<li>Rubber outsole</li>\n</ul></div>\n                        <div style=\"display: flex; flex-direction: row; gap: 5px\">\n                <span>Size Information:</span>\n                <span>Listed in IT sizing, fits true to size</span>\n            </div>\n                                <div style=\"display: flex; flex-direction: row; gap: 5px\">\n                <span>Vendor Color Code:</span>\n                <span>Navy</span>\n            </div>\n                                <div style=\"display: flex; flex-direction: row; gap: 5px\">\n                <span>Brand Style:</span>\n                <span>708902V28R0</span>\n            </div>\n                                <div style=\"display: flex; flex-direction: row; gap: 5px\">\n                <span>Designer/Brand:</span>\n                <span>Bottega Veneta</span>\n            </div>\n            </div>"
  },
  {
    "id": 7762663768273,
    "title": "Round Ballet SAGE TINT",
    "handle": "1482226-f1637-n66-round-ballet-green",
    "vendor": "The Row",
    "product_type": "Migration_Size",
    "tags": [
      "Ballet Flats",
      "F1637 N66",
      "flow-size-guide-backfill",
      "flow-template-backfilled",
      "FW2025",
      "Leather",
      "P-10004061",
      "PF2025",
      "The Row"
    ],
    "body_html": "<div style=\"display: flex; flex-direction: column; gap: 10px\">\n    <div><ul>\n<li>Round toe</li>\n<li>Bow detailing</li>\n<li>Adjustable elastic</li>\n<li>Flexible leather sole</li>\n<li>Care according to label</li>\n<li>Material: Leather</li>\n</ul></div>\n                        <div style=\"display: flex; flex-direction: row; gap: 5px\">\n                <span>Size Information:</span>\n                <span>True to size. Listed in IT sizing.</span>\n            </div>\n                                <div style=\"display: flex; flex-direction: row; gap: 5px\">\n                <span>Vendor Color Code:</span>\n                <span>SAGE TINT</span>\n            </div>\n                                <div style=\"display: flex; flex-direction: row; gap: 5px\">\n                <span>Brand Style:</span>\n                <span>F1637 N66</span>\n            </div>\n                                <div style=\"display: flex; flex-direction: row; gap: 5px\">\n                <span>Designer/Brand:</span>\n                <span>The Row</span>\n            </div>\n            </div>"
  },
  {
    "id": 7762663735505,
    "title": "Soft Mocassin BLACK",
    "handle": "1482212-f1626-l305-soft-mocassin-black",
    "vendor": "The Row",
    "product_type": "Migration_Size",
    "tags": [
      "F1626 L305",
      "flow-size-guide-backfill",
      "flow-template-backfilled",
      "FW2025",
      "Moccasins",
      "Officewear",
      "P-10004047",
      "PF2025",
      "Suede",
      "The Row",
      "Transitional Essentials Fall"
    ],
    "body_html": "<div style=\"display: flex; flex-direction: column; gap: 10px\">\n    <div><ul>\n<li>Square toe</li>\n<li>Slip on design</li>\n<li>Unlined</li>\n<li>Penny strap</li>\n<li>Block heel</li>\n<li>Care according to label</li>\n<li>Material: Upper: Suede; Sole: leather</li>\n</ul></div>\n                        <div style=\"display: flex; flex-direction: row; gap: 5px\">\n                <span>Size Information:</span>\n                <span>True to size. Listed in IT sizing.</span>\n            </div>\n                                <div style=\"display: flex; flex-direction: row; gap: 5px\">\n                <span>Vendor Color Code:</span>\n                <span>BLACK</span>\n            </div>\n                                <div style=\"display: flex; flex-direction: row; gap: 5px\">\n                <span>Brand Style:</span>\n                <span>F1626 L305</span>\n            </div>\n                                <div style=\"display: flex; flex-direction: row; gap: 5px\">\n                <span>Designer/Brand:</span>\n                <span>The Row</span>\n            </div>\n            </div>"
  },
  {
    "id": 7762663669969,
    "title": "Tyler Lace Up YELLOW",
    "handle": "1482142-f1338-l305-tyler-lace-up-yellow",
    "vendor": "The Row",
    "product_type": "Migration_Size",
    "tags": [
      "F1338 L305",
      "flow-size-guide-backfill",
      "flow-template-backfilled",
      "FW2025",
      "P-10003992",
      "PF2025",
      "Suede",
      "The Row",
      "Western/Carpenter"
    ],
    "body_html": "<div style=\"display: flex; flex-direction: column; gap: 10px\">\n    <div><ul>\n<li>Oval toe</li>\n<li>Lace-up</li>\n<li>Raised outer stitching</li>\n<li>Rubber sole</li>\n<li>Care according to label</li>\n<li>Material: 100% Calfskin Suede</li>\n</ul></div>\n                        <div style=\"display: flex; flex-direction: row; gap: 5px\">\n                <span>Size Information:</span>\n                <span>True to size. Listed in IT sizing.</span>\n            </div>\n                                <div style=\"display: flex; flex-direction: row; gap: 5px\">\n                <span>Vendor Color Code:</span>\n                <span>YELLOW</span>\n            </div>\n                                <div style=\"display: flex; flex-direction: row; gap: 5px\">\n                <span>Brand Style:</span>\n                <span>F1338 L305</span>\n            </div>\n                                <div style=\"display: flex; flex-direction: row; gap: 5px\">\n                <span>Designer/Brand:</span>\n                <span>The Row</span>\n            </div>\n            </div>"
  },
  {
    "id": 7762552717521,
    "title": "Ballet Runner 2.0 Chocolate",
    "handle": "1570541-lbr2282x36-ballet-runner-20-brown",
    "vendor": "Loewe",
    "product_type": "Migration_Size",
    "tags": [
      "flow-size-guide-backfill",
      "flow-template-backfilled",
      "LBR2282X36",
      "Loewe",
      "P-11022690",
      "PS2026",
      "SS2026",
      "Transitional Essentials Fall"
    ],
    "body_html": "<div style=\"display: flex; flex-direction: column; gap: 10px\">\n    <div><ul>\n<li>Nylon and calfskin sneaker</li>\n<li>Asymmetrical toe shape</li>\n<li>Sock-like internal structure</li>\n<li>Lightweight rubber outsole extending to the toecap</li>\n<li>Includes white and tonal laces</li>\n<li>L monogram at the side, embossed Anagram on the tongue</li>\n<li>Injected rubber LOEWE on the heel tab</li>\n<li>Material: Calf leather; Polyamide</li>\n</ul></div>\n                        <div style=\"display: flex; flex-direction: row; gap: 5px\">\n                <span>Size Information:</span>\n                <span>Listed in FR sizing, fits true to size.</span>\n            </div>\n                                <div style=\"display: flex; flex-direction: row; gap: 5px\">\n                <span>Vendor Color Code:</span>\n                <span>Chocolate</span>\n            </div>\n                                <div style=\"display: flex; flex-direction: row; gap: 5px\">\n                <span>Brand Style:</span>\n                <span>LBR2282X36</span>\n            </div>\n                                <div style=\"display: flex; flex-direction: row; gap: 5px\">\n                <span>Designer/Brand:</span>\n                <span>Loewe</span>\n            </div>\n            </div>"
  }
];

describe("The Webster migrated source evidence", () => {
  it.each(migrationFixtures)("recovers $title without changing its identity", (raw) => {
    const product = theWebsterRawProductToPilot(raw, "2026-09-28T10:00:00Z");
    expect(product).not.toBeNull();
    expect(product?.productName).toBe(raw.title);
    expect(product?.productUrl).toBe(`https://thewebster.com/products/${raw.handle}`);
    expect(product?.sourceProductType).toBe("Migration_Size");
    if (raw.title === "Tyler Lace Up YELLOW") expect(product?.category).toBe("OTHER_FOOTWEAR");
  });
  it("does not accept opaque names on collection membership alone", () => {
    expect(theWebsterRawProductToPilot({id: 99, title: "Unknown Model", handle: "unknown-model", vendor: "The Row", product_type: "Migration_Size"}, "2026-09-28")).toBeNull();
  });
  it("keeps hard non-footwear exclusions despite shoe description evidence", () => {
    expect(theWebsterRawProductToPilot({...migrationFixtures[0], title: "Leather Handbag", handle: "leather-handbag"}, "2026-09-28")).toBeNull();
  });
});

describe("The Webster construction evidence boundaries", () => {
  it.each(["Oval toe Lace-up", "Lace-up Rubber sole", "Oval toe Rubber sole"])("rejects incomplete construction evidence: %s", (body_html) => {
    const raw = migrationFixtures.find((row) => row.title === "Tyler Lace Up YELLOW")!;
    expect(theWebsterRawProductToPilot({...raw, body_html}, "2026-09-28")).toBeNull();
  });
});


it("retains only explicit retailer NEW labels when refreshing The Webster", () => {
  const raw = { id: 1, title: "Le Coeur Slingback Pumps", handle: "le-coeur-pumps", vendor: "Alaia",
    product_type: "Shoes", tags: ["women", "pumps", "New In"],
    images: [{ src: "https://cdn.example/pump.jpg" }] };
  expect(theWebsterRawProductToPilot(raw, "2026-10-03", true)?.hasNewBadge).toBe(true);
  expect(theWebsterRawProductToPilot(raw, "2026-10-03")?.hasNewBadge).toBe(false);
  expect(theWebsterRawProductToPilot({ ...raw, tags: ["women", "pumps", "New York", "new leather design"] }, "2026-10-03", true)?.hasNewBadge).toBe(false);
});

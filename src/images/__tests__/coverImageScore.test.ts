import { describe, expect, it } from "vitest";

import { pickBestCoverImage, scoreCoverImageUrl } from "../coverImageScore";

describe("cover image ranking", () => {
  it("prefers a footwear packshot over lifestyle or body-dominant frames", () => {
    const packshot = "https://cdn.shopify.com/s/files/1/1/products/pump_e.jpg";
    const lifestyle = "https://cdn.example.com/lookbook/on-figure-campaign.jpg";
    expect(scoreCoverImageUrl(packshot)).toBeGreaterThan(scoreCoverImageUrl(lifestyle));
    expect(pickBestCoverImage([lifestyle, packshot])).toBe(packshot);
  });

  it("prefers a Zara e1 packshot over a neutral hash image", () => {
    const packshot =
      "https://static.zara.net/assets/public/8845/b619/6442442eb52f/5741da5c60c1/11000810017-e1/11000810017-e1.jpg";
    const neutral =
      "https://static.zara.net/assets/public/6fb6/1cf7/5ec64dac9fbd/b9ad7f9fdc3d/40eb0cf81c953fc272828c3aaf6ca162/40eb0cf81c953fc272828c3aaf6ca162.jpg";
    expect(scoreCoverImageUrl(packshot)).toBeGreaterThan(scoreCoverImageUrl(neutral));
    expect(pickBestCoverImage([neutral, packshot])).toBe(packshot);
  });

  it("keeps Free People _a packshots ahead of Scene7 _b crops", () => {
    const packshot = "https://images.urbndata.com/is/image/FreePeople/102074473_225_a";
    const crop = "https://images.urbndata.com/is/image/FreePeople/102074473_225_b";
    expect(pickBestCoverImage([crop, packshot])).toBe(packshot);
  });
});

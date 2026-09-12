import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /modelFamily[\\/]buildModelFamilies$/,
        replacement: resolve(root, "src/modelFamily/buildFamilies.ts"),
      },
      {
        find: /modelFamily[\\/]extractStyleCode$/,
        replacement: resolve(root, "src/modelFamily/styleCode.ts"),
      },
    ],
  },
  test: {
    include: [
      "src/engine/**/*.test.ts",
      "src/registry/**/*.test.ts",
      "src/collector/**/*.test.ts",
      "src/analysis/**/*.test.ts",
      "src/vision/**/*.test.ts",
      "src/insight/**/*.test.ts",
      "src/history/**/*.test.ts",
      "src/radar/**/*.test.ts",
      "src/modelFamily/**/*.test.ts",
      "src/taxonomy/**/*.test.ts",
      "src/newArrivals/**/*.test.ts",
      "src/source/**/*.test.ts",
      "src/research/**/*.test.ts",
      "src/categories/**/*.test.ts",
      "src/navigation/**/*.test.ts",
      "src/images/**/*.test.ts",
      "src/brands/**/*.test.ts",
      "src/catalog/**/*.test.ts",
      "src/visual/**/*.test.ts",
      "src/ui/**/*.test.ts",
      "src/modelFamily/__tests__/familyImages.test.ts",
      "src/modelFamily/__tests__/resolveProductUrl.test.ts",
      "src/taxonomy/vision/**/*.test.ts",
      "src/presentation/**/*.test.ts",
      "src/productDates/**/*.test.ts",
      "src/components/visualWall/**/*.test.ts",
      "src/radar/master/**/*.test.ts",
      "src/radar/__tests__/radarMainCategories.test.ts",
      "src/refresh/**/*.test.ts",
      "src/onboarding/**/*.test.ts",
      "src/operator/**/*.test.ts",
    ],
  },
});

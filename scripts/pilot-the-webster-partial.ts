import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { publishMarketplaceDelivery, readMarketplaceDelivery, writeMarketplaceDelivery } from '../src/collector/marketplaceDelivery';
import { createShardedProductCatalogStore } from '../src/collector/sourceProductArchive';
import { collectTheWebster, THE_WEBSTER_BASE_URL, THE_WEBSTER_ID } from '../src/collector/theWebster';
import { refreshArchivePath } from '../src/refresh/refreshArchiveHandoff';
import { isVerifiedNew } from '../src/newArrivals/newness';

const root = process.cwd();
const catalogPath = join('data', 'multibrand', 'model-families', 'marketplaces', `${THE_WEBSTER_ID}.json`);
const previous = await readMarketplaceDelivery(join(root, catalogPath));
const collection = await collectTheWebster({ refresh: false });
const { coverage, products, unmappedProducts } = collection;
const scratch = await mkdtemp(join(tmpdir(), 'the-webster-partial-'));

try {
  const archiveDirectory = join(root, refreshArchivePath);
  const archive = createShardedProductCatalogStore(archiveDirectory);
  const hasArchive = await stat(archiveDirectory).then(
    () => true,
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return false;
      throw error;
    },
  );
  const core = hasArchive ? await archive.read('products') : JSON.parse(await readFile(join(root, 'data/multibrand/products.json'), 'utf8'));
  await mkdir(join(scratch, 'data/multibrand'), { recursive: true });
  await writeFile(join(scratch, 'data/multibrand/products.json'), JSON.stringify(core));
  await writeMarketplaceDelivery(scratch, previous);

  const decision = await publishMarketplaceDelivery(scratch, {
    sourceId: THE_WEBSTER_ID,
    products,
    publicationMode: 'the-webster-verified-subset',
    coverageStatus: coverage.status === 'FAILED' ? 'FAILED' : 'PARTIAL',
    sourceTotal: coverage.sourceTotal,
    rawCollected: coverage.rawCollected,
    eligibleTotal: coverage.eligibleTotal,
    paginationExhausted: coverage.paginationExhausted,
    errors: coverage.errors,
    preExcludedByPolicy: coverage.excludedByPolicy,
    unmappedProductUrls: unmappedProducts.map(product => product.productUrl),
  }, THE_WEBSTER_BASE_URL);

  const proposed = await readMarketplaceDelivery(join(scratch, catalogPath));
  const productsByUrl = new Map(proposed.products.map(product => [product.productUrl, product]));
  const previousUrls = new Set(previous.products.map(product => product.productUrl));
  const missingUrls = previous.products.filter(product => !productsByUrl.has(product.productUrl));
  const lostGalleries = previous.products.filter(product => {
    const next = productsByUrl.get(product.productUrl);
    return next && product.images?.some(image => !next.images?.includes(image));
  });
  const familyIds = new Set(proposed.families.map(family => family.modelFamilyId));
  const missingFamilies = previous.families.filter(family => !familyIds.has(family.modelFamilyId));
  const verifiedNewIds = (delivery: typeof previous) => new Set(delivery.families.filter(family =>
    family.sourceSightings?.some(sighting => sighting.sourceId === THE_WEBSTER_ID && isVerifiedNew(sighting.newness)),
  ).map(family => family.modelFamilyId));
  const beforeNew = verifiedNewIds(previous);
  const afterNew = verifiedNewIds(proposed);
  const newnessChanged = beforeNew.size !== afterNew.size || [...afterNew].some(id => !beforeNew.has(id));

  console.log(JSON.stringify({
    checkedAt: coverage.collectedAt,
    gate: decision.report,
    archiveProductsBefore: previous.products.length,
    archiveProductsAfter: proposed.products.length,
    addedProducts: proposed.products.filter(product => !previousUrls.has(product.productUrl)).length,
    modelsBefore: previous.families.length,
    modelsAfter: proposed.families.length,
    lostProductUrls: missingUrls.length,
    lostModelIds: missingFamilies.length,
    lostGalleries: lostGalleries.length,
    verifiedNewModelsBefore: beforeNew.size,
    verifiedNewModelsAfter: afterNew.size,
    newnessChanged,
    unmappedProducts,
    quarantined: decision.quarantined.map(({ product, reasons }) => ({ productUrl: product.productUrl, reasons })),
  }, null, 2));

  if (!decision.report.accepted || missingUrls.length || lostGalleries.length || missingFamilies.length || newnessChanged) {
    throw new Error('The Webster pilot did not pass the isolated delivery checks');
  }
} finally {
  await rm(scratch, { recursive: true, force: true });
}

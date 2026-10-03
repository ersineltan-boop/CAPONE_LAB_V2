/** Keep one complete record per line, preserving all fields without pretty-print expansion. */
export function serializeProductCatalog(products: readonly unknown[]): string {
  return `[\n${products.map(product => JSON.stringify(product)).join(',\n')}\n]\n`;
}

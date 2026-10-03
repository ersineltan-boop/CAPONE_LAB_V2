import { describe, expect, it } from 'vitest';
import { serializeProductCatalog } from '../catalogJson';

describe('catalog persistence', () => {
  it('retains nested galleries, genuine SKUs, variants, nulls and Unicode in a smaller JSON array', () => {
    const products = [{ productName: 'Çizme – süet', images: ['https://source.example/a.jpg', 'https://source.example/b.jpg'], sourceSizes: [{ size: '38', sku: 'REAL-38', selectable: false }], variants: [{ color: null, sku: null }], details: 'a\nb' }];
    const body = serializeProductCatalog(products);
    expect(JSON.parse(body)).toEqual(products);
    expect(Buffer.byteLength(body)).toBeLessThan(Buffer.byteLength(JSON.stringify(products, null, 2)));
  });
  it('persists an empty catalog as a valid JSON array', () => {
    expect(JSON.parse(serializeProductCatalog([]))).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import margiela from './fixtures/luxury-margiela.json';
import alaia from './fixtures/luxury-alaia.json';
import { parseLuxuryStructuredPage } from '../luxuryStructured';
const html = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
const input = { source: 'maison-margiela', brand: 'MAISON MARGIELA', productUrl: 'https://www.maisonmargiela.com/en-us/paint-replica-sneakers-S58WS0101P1892961.html', discoveredAt: '2026-09-28T00:00:00.000Z' };
describe('verified luxury structured schemas', () => {
  it('keeps Margiela group once and resolves relative gallery with women breadcrumbs', () => {
    const products = parseLuxuryStructuredPage(html(margiela), input);
    expect(products).toHaveLength(1);
    expect(products[0].images).toHaveLength(4);
    expect(products[0].imageUrl).toMatch(/^https:\/\/www.maisonmargiela.com\//);
    expect(products[0].color).toBe('White');
    expect(products[0].sourceCategoryPath).toContain('Women');
  });
  it('reads Alaia ProductGroup in graph using explicit female audience', () => {
    const products = parseLuxuryStructuredPage(html(alaia), { ...input, source: 'ala-a', brand: 'ALAÏA', productUrl: 'https://www.maison-alaia.com/en-us/product/flat-shoes/ballet-flats-in-strass-fishnet-AA3A029A023210.html' });
    expect(products).toHaveLength(1);
    expect(products[0].category).toBe('BALLERINA');
    expect(products[0].variants).toHaveLength(1);
    expect(products[0].color).toBe('WHITE SILVER');
  });
  it('rejects mens and missing-audience records rather than guessing from shoes', () => {
    expect(parseLuxuryStructuredPage(html(JSON.parse(JSON.stringify(margiela).replaceAll('Women', 'Men').replaceAll('/women/', '/men/'))), input)).toEqual([]);
    expect(parseLuxuryStructuredPage(html({ '@type': 'ProductGroup', name: 'Ballet flats', image: '/shoe.jpg' }), input)).toEqual([]);
  });
});

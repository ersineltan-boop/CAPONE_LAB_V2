import { describe, expect, it } from 'vitest';
import { collectLuxuryStaging } from '../luxuryCollector';
import alaia from './fixtures/luxury-alaia.json';
const origin = 'https://www.maison-alaia.com';
const productUrl = origin + '/en-us/product/flat-shoes/ballet-flats-in-strass-fishnet-AA3A029A023210.html';
const xml = (...urls: string[]) => `<urlset>${urls.map(u => `<loc>${u}</loc>`).join('')}</urlset>`;
describe('bounded luxury collector', () => {
  it('collects real female schema and rejects off-origin sitemap URLs; bounded run stays partial', async () => {
    const requests: string[] = [];
    const result = await collectLuxuryStaging('ala-a', { limit: 1, http: { async fetchText(url) {
      requests.push(url);
      const text = url.endsWith('sitemap_index.xml') ? xml(origin + '/en-us/sitemap_0.xml', 'https://outside.test/evil.xml') : url.endsWith('.xml') ? xml(productUrl, origin + '/en-us/other-ballet.html', origin + '/en-ca/shoes.html') : `<script type="application/ld+json">${JSON.stringify(alaia)}</script>`;
      return { ok: true, status: 200, url, text };
    } } });
    expect(result.products).toHaveLength(1);
    expect(result.coverage).toMatchObject({ status: 'PARTIAL', bounded: true, attemptedPages: 1, discoveredCandidateUrls: 2, activated: false });
    expect(requests.every(u => u.startsWith(origin + '/en-us/'))).toBe(true);
  });
  it('records blocked requests without trying alternate access routes', async () => {
    let calls = 0;
    const result = await collectLuxuryStaging('ala-a', { http: { async fetchText(url) { calls++; return { ok: false, status: 403, url, text: 'Forbidden' }; } } });
    expect(calls).toBe(1);
    expect(result.coverage.status).toBe('FAILED');
    expect(result.coverage.errors[0]).toContain('403');
  });
});

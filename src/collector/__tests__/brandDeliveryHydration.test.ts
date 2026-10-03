import { describe, expect, it } from 'vitest';
import { mergeApprovedDelivery } from '../../../scripts/hydrate-existing-brand-delivery.mjs';

const product = (source, productUrl, extra = {}) => ({ source, productUrl, ...extra });
const delivery = { additions: [product('coperni', 'new', { images: ['real'] })], palomaCategories: [] };

describe('approved additive brand delivery', () => {
  it('preserves every existing field and replays without duplicate products', () => {
    const original = [product('other', 'old', { images: ['gallery'], hasNewBadge: false })];
    const merged = mergeApprovedDelivery(original, delivery);
    expect(merged).toEqual([...original, ...delivery.additions]);
    expect(mergeApprovedDelivery(merged, delivery)).toEqual(merged);
    expect(original).toHaveLength(1);
  });
  it('retains a subsequent source refresh without restoring removed products', () => {
    const refreshed = [product('coperni', 'replacement', { images: ['fresh'] })];
    expect(mergeApprovedDelivery(refreshed, delivery)).toEqual(refreshed);
  });
  it('applies audited categories only while the prior category still matches', () => {
    const patch = { additions: [], palomaCategories: [{ productUrl: 'paloma', previousCategory: 'OTHER_FOOTWEAR', category: 'MULE' }] };
    expect(mergeApprovedDelivery([product('paloma-wool', 'paloma', { category: 'OTHER_FOOTWEAR', images: ['real'] })], patch)[0])
      .toEqual(product('paloma-wool', 'paloma', { category: 'MULE', images: ['real'] }));
    const refreshed = [product('paloma-wool', 'paloma', { category: 'SANDAL' })];
    expect(mergeApprovedDelivery(refreshed, patch)).toEqual(refreshed);
  });
  it('rejects unrelated source additions', () => {
    expect(() => mergeApprovedDelivery([], { additions: [product('unknown', 'x')], palomaCategories: [] })).toThrow('Unapproved');
  });
});

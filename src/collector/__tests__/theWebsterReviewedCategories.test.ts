import {describe,expect,it} from 'vitest';
import {THE_WEBSTER_TYLER_REVIEW,reviewedTheWebsterCategory} from '../theWebsterReviewedCategories';
import {theWebsterRawProductToPilot} from '../theWebster';

const raw = () => ({id:7762663669969,handle:'1482142-f1338-l305-tyler-lace-up-yellow',title:'Tyler Lace Up YELLOW',
  vendor:'The Row',product_type:'Migration_Size',body_html:'<p>Oval toe. Lace-up. Rubber sole.</p><p>Brand Style: F1338 L305</p>',
  images:[{src:THE_WEBSTER_TYLER_REVIEW.imageUrl},{src:'https://cdn.shopify.com/s/files/1/0669/4558/1265/files/04_c3166cb5-9c5e-49b4-a840-b5296d230b75.jpg?v=1782218149'}],
  variants:[{title:'IT35',sku:'1482143'}]});
describe('exact Webster source gallery review',()=>{
  it('recovers the reviewed ankle boot without changing its gallery, SKUs or newness',()=>{
    const product=theWebsterRawProductToPilot(raw(),'2026-10-13T17:00:00Z');
    expect(product?.category).toBe('BOOT');
    expect(product?.images).toEqual(raw().images.map(i=>i.src));
    expect(product?.variants[0]?.sku).toBe('1482143');
    expect(product?.hasNewBadge).toBe(false);
    expect(product?.sourceProductType).toBe('Migration_Size');
  });
  it.each([
    {id:1}, {handle:'other-tyler'}, {title:'Tyler Lace Up BLACK'}, {vendor:'Other'},
    {body_html:'Brand Style: F1338 L306'}, {images:[{src:THE_WEBSTER_TYLER_REVIEW.imageUrl.replace('1782218149','1790000000')}]},
  ])('rejects changed product, style or gallery evidence: %j',patch=>{
    expect(reviewedTheWebsterCategory({...raw(),...patch})).toBeNull();
  });
  it('keeps a new explicit source category instead of overriding it with an older review',()=>{
    const product=theWebsterRawProductToPilot({...raw(),product_type:'Sneakers'},'2026-10-13T17:00:00Z');
    expect(product?.category).toBe('SNEAKER');
  });
});

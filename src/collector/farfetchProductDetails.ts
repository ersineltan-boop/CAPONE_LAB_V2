import {createHash} from 'node:crypto';
import {farfetchJsonLdToProduct} from './farfetch';
import {normalizeProductImageUrls} from '../images/resolveImageQuality';
import type {PilotProduct} from './types';

import {FARFETCH_MULES_URL,farfetchProductId,type VerifiedFarfetchProduct} from './farfetchProductIdentity';
export {FARFETCH_MULES_URL,farfetchProductId,type VerifiedFarfetchProduct} from './farfetchProductIdentity';
/** Read the requested model, never a recommendation or a different gender/ID. */
export function parseFarfetchProductDetails(html:string,url:string,checkedAt:string):{product:PilotProduct; evidence:VerifiedFarfetchProduct}|null {
  const id=farfetchProductId(url);
  if(!id)return null;
  const groups:any[]=[];
  const visit=(v:any)=>{if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object') {
    if((v['@type']==='ProductGroup'||v['@type']?.includes?.('ProductGroup'))&&String(v.productGroupID)===id)groups.push(v);
    if(v['@graph'])visit(v['@graph']);
  }};
  for(const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {visit(JSON.parse(m[1]));}catch { /* Ignore non-JSON blocks. */ }
  }
  if(groups.length!==1)return null;
  const group=groups[0];
  if(typeof group.name!=='string'||!(typeof group.brand==='string'||typeof group.brand?.name==='string'))return null;
  const variants=Array.isArray(group.hasVariant)?group.hasVariant:[];
  const offers=variants.flatMap((v:any)=>Array.isArray(v.offers)?v.offers:[v.offers]).filter(Boolean);
  if(!offers.some((offer:any)=>farfetchProductId(offer.url,true)===id))return null;
  const images:string[]=(Array.isArray(group.image)?group.image:[group.image])
    .map((i:any)=>typeof i==='string'?i:i?.contentUrl).filter((i:any)=>typeof i==='string');
  // The public hydration graph can expose the complete gallery for this exact
  // model/variation; never collect images from recommended products.
  const match=html.match(/window\.__HYDRATION_STATE__\s*=\s*("(?:\\.|[^"\\])*")\s*;/);
  let variation:any;
  try {
    const graph=JSON.parse(JSON.parse(match![1])).apolloInitialState;
    for(const [key,ref] of Object.entries(graph.ROOT_QUERY??{})) {
      if(!key.startsWith('variation('))continue;
      const args=JSON.parse(key.slice('variation('.length,-1));
      const node=graph[(ref as any)?.__ref];
      if(String(args.productId)!==id||String(node?.internalProductId)!==id)continue;
      variation??=node;
      for(const image of node.images??[])images.push(image.size1000?.url??image.size600?.url??'');
    }
  }catch { /* ProductGroup remains authoritative when hydration is absent. */ }
  const gallery=normalizeProductImageUrls(images.filter(image=>{
    try {return new URL(image).origin==='https://cdn-images.farfetch-contents.com';}catch{return false;}
  }));
  if(!gallery.length)return null;
  const product=farfetchJsonLdToProduct({name:group.name,brand:group.brand,image:gallery,offers:{url}},FARFETCH_MULES_URL,checkedAt);
  if(!product)return null;
  product.images=gallery;product.imageUrl=gallery[0]??null;
  product.color=typeof variation?.mainColor==='string'?variation.mainColor:typeof group.color==='string'?group.color:null;
  product.details=typeof group.description==='string'?group.description:null;
  product.sourceVerifiedAt=checkedAt;
  product.variants=variants.filter((v:any)=>typeof v.sku==='string').map((v:any)=>({title:v.name??group.name,color:product.color,sku:v.sku}));
  product.sourceSizes=variants.filter((v:any)=>typeof v.size==='string').map((v:any)=>{
    const availability=(Array.isArray(v.offers)?v.offers:[v.offers]).map((o:any)=>o?.availability).filter(Boolean);
    return {size:v.size,displaySize:v.size,sku:v.sku??null,selectable:availability.length?availability.includes('https://schema.org/InStock'):null};
  });
  return {product,evidence:{url,productId:id,listingUrl:FARFETCH_MULES_URL,checkedAt,documentSha256:createHash('sha256').update(html).digest('hex')}};
}

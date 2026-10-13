export const FARFETCH_MULES_URL='https://www.farfetch.com/uk/shopping/women/mules-1/items.aspx';
export interface VerifiedFarfetchProduct {
  url:string;productId:string;listingUrl:string;checkedAt:string;documentSha256:string;
}
export function farfetchProductId(url:string,allowGlobal=false):string|null {
 try {
  const u=new URL(url);
  if(u.origin!=='https://www.farfetch.com'||u.username||u.password)return null;
  return u.pathname.match(allowGlobal?/^\/(?:uk\/)?shopping\/women\/[^/]+-item-(\d+)\.aspx$/:/^\/uk\/shopping\/women\/[^/]+-item-(\d+)\.aspx$/)?.[1]??null;
 }catch{return null;}
}

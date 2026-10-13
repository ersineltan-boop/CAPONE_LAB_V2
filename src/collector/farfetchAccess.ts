/** HTTP 200 does not make a visible access challenge a product/listing page. */
export function farfetchAccessBlocked(response:{status:number;text:string}):boolean {
 return [401,403,429].includes(response.status)||/verify (?:that )?you are human|checking your browser|unusual traffic|automated traffic/i.test(response.text.replace(/<script[\s\S]*?<\/script>/gi,''));
}

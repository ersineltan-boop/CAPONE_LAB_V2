import type {CatalogShard} from '../catalog/types';
const labels:Record<string,string> = {
  espadrilles:'Espadril', slippers:'Ev terliği', mules:'Mule', loafers:'Loafer', ballerinas:'Babet',
  sandals:'Sandalet', pumps:'Topuklu', boots:'Bot / çizme', trainers:'Sneaker',
  'derby-oxford-shoes':'Oxford / Derby', 'flip-flops-slides':'Parmak arası / slide',
};
export function marketplaceCoverageText(coverage:NonNullable<CatalogShard['coverage']>): string {
  if(coverage.verifiedProductCount)return `Kısmen güncellendi. Ürün sayfasından doğrulanan Mule kayıtları: ${coverage.verifiedProductCount}. Önceki kayıtlar korunuyor.${coverage.pending ? ` ${coverage.pending} ürün incelemede.` : ''}`;
  if (coverage.refreshedCategories?.length) {
    const names=coverage.refreshedCategories.map(category=>{
      try {const key=new URL(category.url).pathname.split('/').at(-2)?.replace(/-1$/,'') ?? '';return labels[key] ?? 'Ayakkabı';}
      catch {return 'Ayakkabı';}
    });
    return `Kısmen güncellendi. Son doğrulanan kategoriler: ${[...new Set(names)].join(', ')}. Önceki kayıtlar korunuyor.${coverage.pending ? ` ${coverage.pending} ürün incelemede.` : ''}`;
  }
  return `Katalog kısmi: ${coverage.ready} ürün hazır, ${coverage.pending} ürün incelemede.`;
}

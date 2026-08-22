import type { CaponeDecisionInputs, CaponeDecision } from "../types";

/**
 * CAPONE karar motoru — gerçek veri entegrasyonunda bu fonksiyon
 * trend hızı, fırsat penceresi ve kanıt gücünden kararı türetir.
 * Demo veride sonuç önceden atanır; burada doğrulama/tekrar hesap için kullanılabilir.
 */
export function deriveCaponeDecision(
  inputs: CaponeDecisionInputs,
): CaponeDecision {
  const { trendStatus, opportunityWindow, evidenceStrength } = inputs;

  if (
    trendStatus === "DOYGUN" ||
    opportunityWindow === "Doygun" ||
    opportunityWindow === "Ana Akım"
  ) {
    return "GEÇ KALDIK";
  }

  if (
    (trendStatus === "HIZLANIYOR" || trendStatus === "YÜKSELİYOR") &&
    (opportunityWindow === "En İyi Giriş Zamanı" ||
      opportunityWindow === "Üretime Aday") &&
    evidenceStrength !== "düşük"
  ) {
    return "NUMUNEYE GİR";
  }

  if (
    trendStatus === "ERKEN SİNYAL" ||
    opportunityWindow === "Çok Erken" ||
    evidenceStrength === "düşük"
  ) {
    return "BEKLE";
  }

  return "TAKİP ET";
}

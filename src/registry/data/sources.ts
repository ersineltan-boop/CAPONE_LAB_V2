/**
 * MASTER SOURCE REGISTRY — gerçek kaynak verilerini buraya ekleyin.
 *
 * Trend-market kaynakları ve PRODUCTION (Çin / kopyalanma sinyali)
 * aynı dosyada olabilir; registry otomatik ayırır.
 *
 * Çin / üretim kaynakları:
 *   layer: "PRODUCTION"
 *   role: "PRODUCTION_SIGNAL"
 *
 * Örnek yapı (gerçek veri eklemeden önce silin veya doldurun):
 *
 * {
 *   id: "src-milan-footwear-week",
 *   name: "Milan Footwear Week",
 *   country: "İtalya",
 *   layer: "FOOTWEAR_TRADE",
 *   role: "MARKET",
 *   weight: 0.8,
 *   officialUrl: null,
 *   accessMode: "MANUAL",
 *   refreshCadence: "monthly",
 *   isActive: true,
 *   notes: "",
 * }
 */
import type { TrendSourceRegistryEntry } from "../types/source";

export const sourceEntries: TrendSourceRegistryEntry[] = [];

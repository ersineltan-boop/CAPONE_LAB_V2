import { TASK_TEMPLATES } from "./templates/definitions";
import {
  assertRegistriesIsolated,
  markalarAndPazaryerleriAreSeparateRegistries,
  productionActionsDeniedByDefault,
} from "./policies";
import { MARKET_RESEARCH_REGISTRIES, PRODUCT_RESEARCH_REGISTRIES, TASK_TEMPLATE_IDS } from "./types";

export interface OperatorCheckResult {
  ok: boolean;
  errors: string[];
  templateCount: number;
  approvalDefaultsDeny: boolean;
  registriesIsolated: boolean;
}

export function runOperatorCheck(): OperatorCheckResult {
  const errors: string[] = [];

  if (TASK_TEMPLATES.length !== TASK_TEMPLATE_IDS.length) {
    errors.push("Template catalog does not match TaskTemplateId union");
  }

  const seen = new Set<string>();
  for (const template of TASK_TEMPLATES) {
    if (seen.has(template.id)) errors.push(`Duplicate template ${template.id}`);
    seen.add(template.id);
    const overlap = template.writeTargets.filter((target) =>
      template.forbiddenTargets.includes(target),
    );
    if (overlap.length > 0) {
      errors.push(`${template.id} writes forbidden targets: ${overlap.join(", ")}`);
    }
    if (template.domain === "PRODUCT_RESEARCH") {
      const leaked = template.writeTargets.filter((target) =>
        (MARKET_RESEARCH_REGISTRIES as readonly string[]).includes(target),
      );
      if (leaked.length > 0) {
        errors.push(`${template.id} writes Market Research registries: ${leaked.join(", ")}`);
      }
    }
    if (template.domain === "MARKET_RESEARCH") {
      const leaked = template.writeTargets.filter((target) =>
        (PRODUCT_RESEARCH_REGISTRIES as readonly string[]).includes(target),
      );
      if (leaked.length > 0) {
        errors.push(`${template.id} writes Product Research registries: ${leaked.join(", ")}`);
      }
    }
  }

  if (!productionActionsDeniedByDefault()) {
    errors.push("Production approval gates must default to DENY");
  }

  if (!markalarAndPazaryerleriAreSeparateRegistries()) {
    errors.push("Markalar and Pazaryerleri must remain separate Product Research registries");
  }

  try {
    assertRegistriesIsolated("MARKALAR", "PAZARYERLERI");
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  try {
    assertRegistriesIsolated("MARKALAR", "SALES_MARKET_BRANDS");
    errors.push("Markalar and SALES_MARKET_BRANDS must not be treated as the same surface");
  } catch {
    // expected isolation failure
  }

  return {
    ok: errors.length === 0,
    errors,
    templateCount: TASK_TEMPLATES.length,
    approvalDefaultsDeny: productionActionsDeniedByDefault(),
    registriesIsolated: true,
  };
}

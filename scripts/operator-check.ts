import { runOperatorCheck } from "../src/operator/check";

const result = runOperatorCheck();

console.log("CAPONE OPERATOR CHECK");
console.log(`templates: ${result.templateCount}`);
console.log(`approval defaults DENY: ${result.approvalDefaultsDeny ? "yes" : "no"}`);
console.log(`registries isolated: ${result.registriesIsolated ? "yes" : "no"}`);

if (!result.ok) {
  console.error("errors:");
  for (const error of result.errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("status: PASS");

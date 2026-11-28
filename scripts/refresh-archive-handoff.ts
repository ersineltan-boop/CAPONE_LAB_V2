import { resolve } from "node:path";
import { hydrateRefreshArchive, refreshCatalogDigests, stageRefreshArchive } from "../src/refresh/refreshArchiveHandoff";

const [action, directory = "."] = process.argv.slice(2);
const root = resolve(directory);
switch (action) {
  case "hydrate": console.log(JSON.stringify(await hydrateRefreshArchive(root))); break;
  case "stage": console.log(JSON.stringify(await stageRefreshArchive(root), null, 2)); break;
  case "digest": console.log(JSON.stringify(await refreshCatalogDigests(root))); break;
  default: throw new Error("Use refresh-archive-handoff.ts hydrate|stage|digest [directory]");
}

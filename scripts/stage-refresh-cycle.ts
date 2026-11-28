import { stageRefreshArchive } from "../src/refresh/refreshArchiveHandoff";

const reports = await stageRefreshArchive(process.cwd());
console.log(JSON.stringify(reports, null, 2));

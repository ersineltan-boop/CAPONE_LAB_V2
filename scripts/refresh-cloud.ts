import { runCloudRefresh } from "../src/refresh/runCloudRefresh";

try {
  await runCloudRefresh();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nCloud refresh aborted: ${message}`);
  process.exit(1);
}

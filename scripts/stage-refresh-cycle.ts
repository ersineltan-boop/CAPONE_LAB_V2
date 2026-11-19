import { CYCLE_DELIVERY_PATHS } from "../src/refresh/refreshCycle";
import { stageRefreshDelivery } from "../src/refresh/refreshStaging";

stageRefreshDelivery(process.cwd(), CYCLE_DELIVERY_PATHS);

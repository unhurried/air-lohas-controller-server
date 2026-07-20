import openNextWorker, {
  BucketCachePurge,
  DOQueueHandler,
  DOShardedTagCache,
} from "./.open-next/worker.js";
import { SETTINGS_KEY, normalizeState } from "./src/lib/aircon-settings.ts";
import { applyDueReservation } from "./src/lib/aircon-cron.ts";

function logCron(level, message, context = {}) {
  const line = JSON.stringify({
    type: "cron",
    level,
    message,
    ...context,
  });

  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}

async function applyReservationsByCron(env) {
  const kv = env.AC_SETTINGS_KV;
  if (!kv) {
    logCron("error", "skipped: AC_SETTINGS_KV binding is missing");
    return;
  }

  const raw = await kv.get(SETTINGS_KEY);
  if (!raw) {
    logCron("info", "skipped: settings not found", { key: SETTINGS_KEY });
    return;
  }

  const state = normalizeState(JSON.parse(raw));
  const result = applyDueReservation(state, new Date());

  if (!result) {
    logCron("info", "skipped: no due reservations");
    return;
  }

  await kv.put(SETTINGS_KEY, JSON.stringify(result.nextState));
  logCron("info", "applied", {
    reservationId: result.applied.id,
    time: result.applied.time,
    mode: result.applied.settings.mode,
    baseTemperature: result.applied.settings.baseTemperature,
    markedCount: result.dueCount,
  });
}

const worker = {
  fetch: openNextWorker.fetch,
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      applyReservationsByCron(env).catch((error) => {
        logCron("error", "failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }),
    );
  },
};

export default worker;
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge };

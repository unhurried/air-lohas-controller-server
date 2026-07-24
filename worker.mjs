import openNextWorker, {
  BucketCachePurge,
  DOQueueHandler,
  DOShardedTagCache,
} from "./.open-next/worker.js";
import {
  AirconStateDO,
  AC_STATE_SINGLETON,
} from "./src/lib/aircon-state-do.ts";

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
  const namespace = env.AC_STATE;
  if (!namespace) {
    logCron("error", "skipped: AC_STATE binding is missing");
    return;
  }

  const stub = namespace.get(namespace.idFromName(AC_STATE_SINGLETON));
  const result = await stub.applyDueReservations(new Date().toISOString());

  if (!result) {
    logCron("info", "skipped: no due reservations");
    return;
  }

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
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge, AirconStateDO };

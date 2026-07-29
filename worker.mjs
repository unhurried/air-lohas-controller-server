import openNextWorker, {
  BucketCachePurge,
  DOQueueHandler,
  DOShardedTagCache,
} from "./.open-next/worker.js";
import {
  AirconStateDO,
  AC_STATE_SINGLETON,
} from "./src/lib/aircon-state-do.ts";
import { isAuthorized } from "./src/lib/access-auth.ts";

// フォーム即時更新用の WebSocket エンドポイント。Next.js の Route Handler では
// WebSocket アップグレードをそのまま DO まで届けられないため、Next.js/OpenNext に
// 渡す前にここで横取りして DO の fetch（Hibernation API）へ直接フォワードする。
// middleware.ts のパイプラインを経由しないため、認証（ACCESS_SECRET）もここで
// 同じロジック（src/lib/access-auth.ts）を使って行う。
const WEBSOCKET_PATH = "/api/ws";

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

async function handleStateWebSocket(request, env) {
  if (!isAuthorized(request.url, request.headers.get("Cookie"), env.ACCESS_SECRET)) {
    return new Response("Forbidden", { status: 403 });
  }

  const namespace = env.AC_STATE;
  if (!namespace) {
    return new Response("Service Unavailable", { status: 503 });
  }

  const stub = namespace.get(namespace.idFromName(AC_STATE_SINGLETON));
  return stub.fetch(request);
}

const worker = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === WEBSOCKET_PATH) {
      return handleStateWebSocket(request, env);
    }

    return openNextWorker.fetch(request, env, ctx);
  },
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

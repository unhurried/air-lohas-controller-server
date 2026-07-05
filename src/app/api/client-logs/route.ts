import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === "string" && (LOG_LEVELS as readonly string[]).includes(value);
}

function writeToWorkersLog(level: LogLevel, entry: Record<string, unknown>) {
  const line = JSON.stringify(entry);

  switch (level) {
    case "debug":
      console.debug(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "error":
      console.error(line);
      break;
    default:
      console.log(line);
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 });
  }

  const { level, message, ...context } = body as Record<string, unknown>;

  if (typeof message !== "string" || message.length === 0) {
    return NextResponse.json({ error: '"message" is required' }, { status: 400 });
  }

  const normalizedLevel = isLogLevel(level) ? level : "info";

  writeToWorkersLog(normalizedLevel, {
    type: "client",
    level: normalizedLevel,
    message,
    receivedAt: new Date().toISOString(),
    ...context,
  });

  return NextResponse.json({ ok: true });
}

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { AirconSettings } from "@/lib/aircon-types";
import { getSettings, saveSettings } from "@/lib/aircon-settings";

// 外部クライアント（air-lohas-controller-client）向けの設定 API。
// 旧構成でクライアントが直接読み書きしていた Cloudflare Workers KV の代替。
// 認証は `Authorization: Bearer <ACCESS_SECRET>` ヘッダで行う。middleware は
// このルートを除外しており、ここで独立して認証する。
//
// 読み書きとも現在設定（AirconSettings）のみを対象とする。予約はサーバ側の
// Cron/UI が管理するため、クライアントからは取得も更新もしない。

export const dynamic = "force-dynamic";

function unauthorizedResponse(): NextResponse {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": "Bearer" },
  });
}

function isAuthenticated(request: NextRequest): boolean {
  const accessSecret = process.env.ACCESS_SECRET;
  if (!accessSecret) {
    return false;
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return false;
  }

  const spaceIndex = authHeader.indexOf(" ");
  if (spaceIndex === -1) {
    return false;
  }

  const scheme = authHeader.slice(0, spaceIndex);
  const token = authHeader.slice(spaceIndex + 1);

  return scheme === "Bearer" && token === accessSecret;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthenticated(request)) {
    return unauthorizedResponse();
  }

  const settings = await getSettings();
  return NextResponse.json(settings);
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  if (!isAuthenticated(request)) {
    return unauthorizedResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }

  // ボディは AirconSettings（mode / baseTemperature / roomOffsets）。
  // saveSettings が正規化・clamp し、予約は保持したまま現在設定のみ更新する。
  await saveSettings(body as AirconSettings);
  return new NextResponse("OK");
}

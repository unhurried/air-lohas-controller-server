import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  hasValidAccessCookie,
  hasValidAccessKey,
} from "@/lib/access-auth";

function forbiddenResponse() {
  return new NextResponse("Forbidden", { status: 403 });
}

export function middleware(request: NextRequest) {
  const accessSecret = process.env.ACCESS_SECRET;
  if (!accessSecret) {
    return forbiddenResponse();
  }

  if (hasValidAccessCookie(request.headers.get("cookie"), accessSecret)) {
    return NextResponse.next();
  }

  if (!hasValidAccessKey(request.url, accessSecret)) {
    return forbiddenResponse();
  }

  const response = NextResponse.next();
  response.cookies.set(ACCESS_COOKIE, accessSecret, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}

export const config = {
  // api/state は Bearer トークンでルート側が独立して認証するため middleware から除外する。
  // 他のルート（client-logs 含む）は従来どおり ACCESS_SECRET のクエリ/Cookie で保護する。
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/state).*)"],
};

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const ACCESS_QUERY_PARAM = "key";
const ACCESS_COOKIE = "ah_ctrl_access";

function forbiddenResponse() {
  return new NextResponse("Forbidden", { status: 403 });
}

export function middleware(request: NextRequest) {
  const accessSecret = process.env.ACCESS_SECRET;
  if (!accessSecret) {
    return forbiddenResponse();
  }

  const cookieValue = request.cookies.get(ACCESS_COOKIE)?.value;
  if (cookieValue === accessSecret) {
    return NextResponse.next();
  }

  const key = request.nextUrl.searchParams.get(ACCESS_QUERY_PARAM);
  if (key !== accessSecret) {
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

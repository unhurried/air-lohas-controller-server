/**
 * ACCESS_SECRET によるアクセス制御（Cookie / クエリパラメータ）の判定ロジック。
 * src/middleware.ts（Next.js の全ページ）と worker.mjs（WebSocket アップグレード、
 * Next.js のミドルウェアを経由しない）の双方から共有し、二重実装を避ける。
 * cloudflare:workers にも next/server にも依存しない Pure 関数として保つ。
 */

export const ACCESS_COOKIE = "ah_ctrl_access";
export const ACCESS_QUERY_PARAM = "key";

export function readCookie(
  cookieHeader: string | null | undefined,
  name: string,
): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  for (const part of cookieHeader.split(";")) {
    const eqIndex = part.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }

    if (part.slice(0, eqIndex).trim() !== name) {
      continue;
    }

    try {
      return decodeURIComponent(part.slice(eqIndex + 1).trim());
    } catch {
      return part.slice(eqIndex + 1).trim();
    }
  }

  return undefined;
}

export function hasValidAccessCookie(
  cookieHeader: string | null | undefined,
  accessSecret: string,
): boolean {
  return readCookie(cookieHeader, ACCESS_COOKIE) === accessSecret;
}

export function hasValidAccessKey(url: string, accessSecret: string): boolean {
  return new URL(url).searchParams.get(ACCESS_QUERY_PARAM) === accessSecret;
}

export function isAuthorized(
  url: string,
  cookieHeader: string | null | undefined,
  accessSecret: string | undefined,
): boolean {
  if (!accessSecret) {
    return false;
  }

  return (
    hasValidAccessCookie(cookieHeader, accessSecret) ||
    hasValidAccessKey(url, accessSecret)
  );
}

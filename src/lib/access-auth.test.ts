import { describe, expect, it } from "vitest";
import {
  ACCESS_COOKIE,
  hasValidAccessCookie,
  hasValidAccessKey,
  isAuthorized,
  readCookie,
} from "./access-auth";

describe("readCookie", () => {
  it("returns undefined when the header is missing", () => {
    expect(readCookie(null, ACCESS_COOKIE)).toBeUndefined();
    expect(readCookie(undefined, ACCESS_COOKIE)).toBeUndefined();
  });

  it("finds the named cookie among several", () => {
    expect(readCookie(`foo=bar; ${ACCESS_COOKIE}=secret; baz=qux`, ACCESS_COOKIE)).toBe(
      "secret",
    );
  });

  it("decodes percent-encoded values", () => {
    expect(readCookie(`${ACCESS_COOKIE}=a%20b`, ACCESS_COOKIE)).toBe("a b");
  });

  it("returns undefined when the cookie is absent", () => {
    expect(readCookie("foo=bar", ACCESS_COOKIE)).toBeUndefined();
  });
});

describe("hasValidAccessCookie", () => {
  it("matches when the cookie equals the secret", () => {
    expect(hasValidAccessCookie(`${ACCESS_COOKIE}=abc`, "abc")).toBe(true);
  });

  it("rejects a mismatched cookie", () => {
    expect(hasValidAccessCookie(`${ACCESS_COOKIE}=wrong`, "abc")).toBe(false);
  });
});

describe("hasValidAccessKey", () => {
  it("matches when the query parameter equals the secret", () => {
    expect(hasValidAccessKey("https://example.com/?key=abc", "abc")).toBe(true);
  });

  it("rejects a mismatched or missing key", () => {
    expect(hasValidAccessKey("https://example.com/?key=wrong", "abc")).toBe(false);
    expect(hasValidAccessKey("https://example.com/", "abc")).toBe(false);
  });
});

describe("isAuthorized", () => {
  it("rejects everything when accessSecret is not configured", () => {
    expect(
      isAuthorized("https://example.com/?key=abc", `${ACCESS_COOKIE}=abc`, undefined),
    ).toBe(false);
  });

  it("accepts a valid cookie without a key", () => {
    expect(
      isAuthorized("https://example.com/", `${ACCESS_COOKIE}=abc`, "abc"),
    ).toBe(true);
  });

  it("accepts a valid key without a cookie", () => {
    expect(isAuthorized("https://example.com/?key=abc", null, "abc")).toBe(true);
  });

  it("rejects when neither cookie nor key match", () => {
    expect(
      isAuthorized("https://example.com/?key=wrong", `${ACCESS_COOKIE}=wrong`, "abc"),
    ).toBe(false);
  });
});

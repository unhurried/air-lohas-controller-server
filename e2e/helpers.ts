import { type Page } from "@playwright/test";

/** The access secret used in playwright.config.ts webServer env. */
export const ACCESS_SECRET = "e2e-test-secret";

/**
 * Authenticate by navigating with the `?key=` query parameter.
 * The middleware sets a cookie, so subsequent navigation won't need the param.
 */
export async function authenticate(page: Page, path = "/") {
  await page.goto(`${path}?key=${ACCESS_SECRET}`);
}

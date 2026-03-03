import { test, expect } from "@playwright/test";
import { ACCESS_SECRET } from "./helpers";

test.describe("Middleware authentication", () => {
  test("returns 403 when no key or cookie is provided", async ({ request }) => {
    const response = await request.get("/", {
      headers: { cookie: "" },
    });
    expect(response.status()).toBe(403);
  });

  test("returns 403 with invalid key", async ({ request }) => {
    const response = await request.get("/?key=wrong-secret", {
      headers: { cookie: "" },
    });
    expect(response.status()).toBe(403);
  });

  test("allows access with valid key query parameter", async ({ request }) => {
    const response = await request.get(`/?key=${ACCESS_SECRET}`);
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain("Air LOHAS 設定");
  });

  test("sets cookie after authenticating via query parameter", async ({
    page,
  }) => {
    // First visit with key – sets the cookie
    await page.goto(`/?key=${ACCESS_SECRET}`);
    await expect(page.locator("h1")).toContainText("Air LOHAS 設定");

    // Second visit without key – cookie-based auth
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toContainText("Air LOHAS 設定");
  });
});

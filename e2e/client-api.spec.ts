import { test, expect } from "@playwright/test";
import { ACCESS_SECRET } from "./helpers";

const BEARER_TOKEN = `Bearer ${ACCESS_SECRET}`;

test.describe("Client API – GET /api/state", () => {
  test("returns 401 without Authorization header", async ({ request }) => {
    const response = await request.get("/api/state");
    expect(response.status()).toBe(401);
    expect(response.headers()["www-authenticate"]).toBe("Bearer");
  });

  test("returns 401 with wrong Bearer token", async ({ request }) => {
    const response = await request.get("/api/state", {
      headers: { Authorization: "Bearer wrong-token" },
    });
    expect(response.status()).toBe(401);
  });

  test("returns 401 with non-Bearer scheme", async ({ request }) => {
    const response = await request.get("/api/state", {
      headers: { Authorization: `Basic ${ACCESS_SECRET}` },
    });
    expect(response.status()).toBe(401);
  });

  test("returns 200 with valid Bearer token", async ({ request }) => {
    const response = await request.get("/api/state", {
      headers: { Authorization: BEARER_TOKEN },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("mode");
    expect(body).toHaveProperty("baseTemperature");
    expect(body).toHaveProperty("roomOffsets");
    expect(body).toHaveProperty("updatedAt");
  });

  test("does not include reservations", async ({ request }) => {
    const response = await request.get("/api/state", {
      headers: { Authorization: BEARER_TOKEN },
    });
    const body = await response.json();
    expect(body).not.toHaveProperty("reservations");
    expect(body).not.toHaveProperty("currentSettings");
  });
});

test.describe("Client API – PUT /api/state", () => {
  test("returns 401 without Authorization header", async ({ request }) => {
    const response = await request.put("/api/state", {
      data: {},
    });
    expect(response.status()).toBe(401);
  });

  test("returns 401 with wrong Bearer token", async ({ request }) => {
    const response = await request.put("/api/state", {
      headers: { Authorization: "Bearer wrong-token" },
      data: {},
    });
    expect(response.status()).toBe(401);
  });

  test("returns 400 with invalid JSON body", async ({ request }) => {
    const response = await request.put("/api/state", {
      headers: {
        Authorization: BEARER_TOKEN,
        "Content-Type": "application/json",
      },
      data: Buffer.from("{ not valid json"),
    });
    expect(response.status()).toBe(400);
  });

  test("can update settings via PUT and verify via GET", async ({
    request,
  }) => {
    // Read current settings first
    const getResp = await request.get("/api/state", {
      headers: { Authorization: BEARER_TOKEN },
    });
    const originalSettings = await getResp.json();

    // PUT body is an AirconSettings object (mode / baseTemperature / roomOffsets).
    const putResp = await request.put("/api/state", {
      headers: { Authorization: BEARER_TOKEN },
      data: {
        mode: "heat",
        baseTemperature: 24,
        roomOffsets: originalSettings.roomOffsets,
      },
    });
    expect(putResp.status()).toBe(200);

    // Verify settings were updated.
    const verifyResp = await request.get("/api/state", {
      headers: { Authorization: BEARER_TOKEN },
    });
    const verifiedSettings = await verifyResp.json();
    expect(verifiedSettings.mode).toBe("heat");
    expect(verifiedSettings.baseTemperature).toBe(24);

    // Restore original settings
    await request.put("/api/state", {
      headers: { Authorization: BEARER_TOKEN },
      data: originalSettings,
    });
  });
});

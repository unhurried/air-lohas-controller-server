import { test, expect } from "@playwright/test";
import { authenticate } from "./helpers";

test.describe("Reservations page", () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page, "/reservations");

    // Clean up any existing reservations to ensure a clean slate
    while ((await page.getByRole("button", { name: "削除" }).count()) > 0) {
      await page.getByRole("button", { name: "削除" }).first().click();
      await page.waitForTimeout(300);
    }

    // Reset time input to default
    const timeInput = page.locator('input[type="time"]').first();
    if (await timeInput.isVisible()) {
      await timeInput.fill("08:00");
      await page.waitForTimeout(100);
    }
  });

  test("displays the page title and back link", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("予約設定");
    await expect(
      page.getByRole("link", { name: "現在設定へ" }),
    ).toBeVisible();
  });

  test("shows reservation list section", async ({ page }) => {
    await expect(page.getByRole("button", { name: "予約追加" })).toBeVisible();
  });

  test("shows time input and add button", async ({ page }) => {
    await expect(page.locator('input[type="time"]').first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "予約追加" }),
    ).toBeVisible();
  });

  test("can add a reservation", async ({ page }) => {
    // Set a specific time
    const timeInput = page.locator('input[type="time"]').first();
    await timeInput.fill("08:30");

    // Click add button
    await page.getByRole("button", { name: "予約追加" }).click();
    await page.waitForTimeout(300);

    // The reservation should appear in the list
    await expect(page.getByText("08:30")).toBeVisible();

    // It should have one enabled checkbox and one delete button
    await expect(page.getByRole("checkbox", { name: "有効" })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "削除" })).toHaveCount(1);
  });

  test("can toggle a reservation", async ({ page }) => {
    // Add a reservation first (beforeEach cleans up)
    const timeInput = page.locator('input[type="time"]').first();
    await timeInput.fill("09:00");
    await page
      .getByRole("button", { name: "予約追加" })
      .click();
    await page.waitForTimeout(300);
    await expect(page.getByText("09:00")).toBeVisible();

    const checkbox = page.getByRole("checkbox", { name: "有効" }).first();
    const isChecked = await checkbox.isChecked();

    // Toggle
    await checkbox.click();

    if (isChecked) {
      await expect(checkbox).not.toBeChecked();
    } else {
      await expect(checkbox).toBeChecked();
    }
  });

  test("can delete a reservation", async ({ page }) => {
    // beforeEach cleans up existing reservations
    // Add a reservation first
    const timeInput = page.locator('input[type="time"]').first();
    await timeInput.fill("10:00");
    await page
      .getByRole("button", { name: "予約追加" })
      .click();
    await page.waitForTimeout(300);
    await expect(page.getByText("10:00")).toBeVisible();

    // Delete it
    await page.getByRole("button", { name: "削除" }).first().click();
    await page.waitForTimeout(300);

    // Should show empty state
    await expect(page.getByText("予約はありません")).toBeVisible();
  });

  test("shows empty state when no reservations", async ({ page }) => {
    // beforeEach has already cleaned up reservations
    // Verify empty state is shown
    await expect(page.getByText("予約はありません")).toBeVisible();
  });

  test("can add multiple reservations sorted by time", async ({ page }) => {
    // beforeEach has already cleaned up
    const timeInput = page.locator('input[type="time"]').first();

    // Add reservation at 22:00
    await timeInput.fill("22:00");
    await page.getByRole("button", { name: "予約追加" }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText("22:00")).toBeVisible();

    // Add reservation at 06:00
    await timeInput.fill("06:00");
    await page.getByRole("button", { name: "予約追加" }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText("06:00")).toBeVisible();

    // Both should be visible and sorted
    const timeButtons = page.locator("button[aria-expanded]");
    const texts = await timeButtons.allTextContents();
    const timeTexts = texts
      .map((t) => t.replace(/[▼▶]\s*/, "").trim())
      .filter((t) => /^\d{2}:\d{2}$/.test(t));
    expect(timeTexts).toEqual([...timeTexts].sort());
  });

  test("reservation shows mode and temperature details", async ({ page }) => {
    // beforeEach cleaned up
    const timeInput = page.locator('input[type="time"]').first();
    await timeInput.fill("12:00");
    await page
      .getByRole("button", { name: "予約追加" })
      .click();
    await page.waitForTimeout(300);
    await expect(page.getByText("12:00")).toBeVisible();

    // Each reservation should show mode label and temperature in the header
    await expect(page.getByText(/基準 \d+℃/).first()).toBeVisible();
  });

  test("navigates back to home page", async ({ page }) => {
    await page.getByRole("link", { name: "現在設定へ" }).click();
    await expect(page).toHaveURL(/\/\?key=|\/$/);
    await expect(page.locator("h1")).toContainText("Air LOHAS 設定");
  });

  test("can expand a reservation to see edit controls", async ({ page }) => {
    // Add a reservation
    const timeInput = page.locator('input[type="time"]').first();
    await timeInput.fill("14:00");
    await page.getByRole("button", { name: "予約追加" }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText("14:00")).toBeVisible();

    // Click the time to expand
    const expandButton = page.getByRole("button", { name: /14:00/ });
    await expandButton.click();

    // Should show edit controls
    await expect(page.getByText("予約時刻")).toBeVisible();
    const modeGroup = page.getByRole("group", { name: "動作モード" });
    await expect(modeGroup).toBeVisible();
    await expect(page.getByRole("button", { name: "基準温度を上げる" })).toBeVisible();
    await expect(page.getByRole("button", { name: "基準温度を下げる" })).toBeVisible();
    await expect(page.getByText("各部屋温度補正（基準温度比）")).toBeVisible();

    // Room offset sliders should be visible
    const sliders = page.locator('input[type="range"]');
    await expect(sliders).toHaveCount(8);
  });

  test("can edit a reservation's mode immediately", async ({ page }) => {
    // Add a reservation
    const timeInput = page.locator('input[type="time"]').first();
    await timeInput.fill("15:00");
    await page.getByRole("button", { name: "予約追加" }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText("15:00")).toBeVisible();

    // Expand the reservation
    await page.getByRole("button", { name: /15:00/ }).click();

    // Change mode to "停止"
    const modeGroup = page.getByRole("group", { name: "動作モード" });
    await modeGroup.getByRole("button", { name: "停止" }).click();
    await expect(
      modeGroup.getByRole("button", { name: "停止" }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(300);

    // The reservation header should now show "停止"
    await expect(page.getByText("停止").first()).toBeVisible();
  });

  test("can edit a reservation time immediately", async ({ page }) => {
    // Add a reservation
    const timeInput = page.locator('input[type="time"]').first();
    await timeInput.fill("16:00");
    await page.getByRole("button", { name: "予約追加" }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText("16:00")).toBeVisible();

    // Expand
    await page.getByRole("button", { name: /16:00/ }).click();
    await page.locator('input[type="time"]').nth(1).fill("16:30");
    await page.waitForTimeout(300);

    await expect(page.getByRole("button", { name: /16:30/ })).toBeVisible();
  });

  test("can collapse an expanded reservation by clicking time again", async ({ page }) => {
    // Add a reservation
    const timeInput = page.locator('input[type="time"]').first();
    await timeInput.fill("17:00");
    await page.getByRole("button", { name: "予約追加" }).click();
    await page.waitForTimeout(300);

    // Expand
    const expandButton = page.getByRole("button", { name: /17:00/ });
    await expandButton.click();
    await expect(page.getByText("予約時刻")).toBeVisible();

    // Collapse by clicking time again
    await expandButton.click();
    await expect(page.getByText("予約時刻")).not.toBeVisible();
  });
});

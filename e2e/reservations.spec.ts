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
    const timeInput = page.locator('input[type="time"]');
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

  test("shows mode button group for reservations", async ({ page }) => {
    const modeGroup = page.getByRole("group", {
      name: "予約時の動作モード",
    });
    await expect(modeGroup).toBeVisible();
    await expect(modeGroup.getByRole("button", { name: "電源オフ" })).toBeVisible();
    await expect(modeGroup.getByRole("button", { name: "自動定常" })).toBeVisible();
    await expect(modeGroup.getByRole("button", { name: "自動セーブ" })).toBeVisible();
  });

  test("shows base temperature stepper for reservations", async ({
    page,
  }) => {
    await expect(page.getByText("予約時の基準温度")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "基準温度を上げる" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "基準温度を下げる" }),
    ).toBeVisible();
  });

  test("shows room offset grid for reservations", async ({ page }) => {
    await expect(
      page.getByText("予約時の各部屋温度補正（基準温度比）"),
    ).toBeVisible();

    const sliders = page.locator('input[type="range"]');
    await expect(sliders).toHaveCount(8);
  });

  test("shows reservation list section", async ({ page }) => {
    await expect(page.getByText("予約一覧")).toBeVisible();
  });

  test("shows time input and add button", async ({ page }) => {
    await expect(page.locator('input[type="time"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: "この設定で予約追加" }),
    ).toBeVisible();
  });

  test("can add a reservation", async ({ page }) => {
    // Set a specific time
    const timeInput = page.locator('input[type="time"]');
    await timeInput.fill("08:30");

    // Click add button
    await page.getByRole("button", { name: "この設定で予約追加" }).click();
    await page.waitForTimeout(300);

    // The reservation should appear in the list
    await expect(page.getByText("08:30")).toBeVisible();

    // It should have one enabled checkbox and one delete button
    await expect(page.getByRole("checkbox", { name: "有効" })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "削除" })).toHaveCount(1);
  });

  test("can toggle a reservation", async ({ page }) => {
    // Add a reservation first (beforeEach cleans up)
    const timeInput = page.locator('input[type="time"]');
    await timeInput.fill("09:00");
    await page
      .getByRole("button", { name: "この設定で予約追加" })
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
    const timeInput = page.locator('input[type="time"]');
    await timeInput.fill("10:00");
    await page
      .getByRole("button", { name: "この設定で予約追加" })
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
    const timeInput = page.locator('input[type="time"]');

    // Add reservation at 22:00
    await timeInput.fill("22:00");
    await page.getByRole("button", { name: "この設定で予約追加" }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText("22:00")).toBeVisible();

    // Add reservation at 06:00
    await timeInput.fill("06:00");
    await page.getByRole("button", { name: "この設定で予約追加" }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText("06:00")).toBeVisible();

    // Both should be visible and sorted
    const times = page.locator(".font-medium");
    const texts = await times.allTextContents();
    const timeTexts = texts.filter(
      (t) => /^\d{2}:\d{2}$/.test(t),
    );
    expect(timeTexts).toEqual([...timeTexts].sort());
  });

  test("reservation shows mode and temperature details", async ({ page }) => {
    // beforeEach cleaned up
    const timeInput = page.locator('input[type="time"]');
    await timeInput.fill("12:00");
    await page
      .getByRole("button", { name: "この設定で予約追加" })
      .click();
    await page.waitForTimeout(300);
    await expect(page.getByText("12:00")).toBeVisible();

    // Each reservation should show mode label and temperature
    // Check that mode/temperature line exists
    await expect(page.getByText(/基準 \d+℃/).first()).toBeVisible();
  });

  test("navigates back to home page", async ({ page }) => {
    await page.getByRole("link", { name: "現在設定へ" }).click();
    await expect(page).toHaveURL(/\/\?key=|\/$/);
    await expect(page.locator("h1")).toContainText("Air LOHAS 設定");
  });

  test("can change draft mode before adding reservation", async ({
    page,
  }) => {
    // beforeEach has already cleaned up
    const modeGroup = page.getByRole("group", {
      name: "予約時の動作モード",
    });
    const offButton = modeGroup.getByRole("button", { name: "電源オフ" });

    await offButton.click();
    await expect(offButton).toHaveAttribute("aria-pressed", "true");

    // Add reservation with "off" mode
    const timeInput = page.locator('input[type="time"]');
    await timeInput.fill("23:00");
    await page.getByRole("button", { name: "この設定で予約追加" }).click();
    await page.waitForTimeout(300);

    // The reservation should show "電源オフ" in its details
    await expect(page.getByText("電源オフ").last()).toBeVisible();
  });
});

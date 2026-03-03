import { test, expect } from "@playwright/test";
import { authenticate } from "./helpers";

test.describe("Home page – settings", () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page, "/");

    // Reset mode to 自動定常
    const steadyButton = page
      .getByRole("group", { name: "動作モード" })
      .getByRole("button", { name: "自動定常" });

    if ((await steadyButton.getAttribute("aria-pressed")) !== "true") {
      await steadyButton.click();
    }

    // Reset temperature to 22℃ if needed
    const currentTemp = await page.locator(":text('℃')").first().textContent();
    if (currentTemp?.includes("23")) {
      const downButton = page.getByRole("button", { name: "基準温度を下げる" });
      await downButton.click();
      await page.waitForTimeout(200);
    }

    // Reset room offsets to 0
    const sliders = page.locator('input[type="range"]');
    const count = await sliders.count();
    for (let i = 0; i < count; i++) {
      const slider = sliders.nth(i);
      const currentValue = await slider.inputValue();
      if (currentValue !== "0") {
        await slider.fill("0");
        await page.waitForTimeout(100);
      }
    }
  });

  test("displays the page title and navigation link", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Air LOHAS 設定");
    await expect(
      page.getByRole("link", { name: "予約設定へ" }),
    ).toBeVisible();
  });

  test("shows mode button group with three options", async ({ page }) => {
    const modeGroup = page.getByRole("group", { name: "動作モード" });
    await expect(modeGroup).toBeVisible();

    await expect(modeGroup.getByRole("button", { name: "電源オフ" })).toBeVisible();
    await expect(modeGroup.getByRole("button", { name: "自動定常" })).toBeVisible();
    await expect(modeGroup.getByRole("button", { name: "自動セーブ" })).toBeVisible();
  });

  test("default mode is auto-steady (自動定常)", async ({ page }) => {
    const steadyButton = page
      .getByRole("group", { name: "動作モード" })
      .getByRole("button", { name: "自動定常" });
    await expect(steadyButton).toHaveAttribute("aria-pressed", "true");
  });

  test("can switch mode to 電源オフ", async ({ page }) => {
    const modeGroup = page.getByRole("group", { name: "動作モード" });
    const offButton = modeGroup.getByRole("button", { name: "電源オフ" });

    await offButton.click();
    await expect(offButton).toHaveAttribute("aria-pressed", "true");

    // Other buttons should not be pressed
    await expect(
      modeGroup.getByRole("button", { name: "自動定常" }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(
      modeGroup.getByRole("button", { name: "自動セーブ" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  test("can switch mode to 自動セーブ", async ({ page }) => {
    const modeGroup = page.getByRole("group", { name: "動作モード" });
    const saveButton = modeGroup.getByRole("button", { name: "自動セーブ" });

    await saveButton.click();
    await expect(saveButton).toHaveAttribute("aria-pressed", "true");
  });

  test("displays base temperature stepper", async ({ page }) => {
    await expect(page.getByText("基準温度", { exact: true })).toBeVisible();
    // Default temperature is 22℃
    await expect(page.getByText("22℃")).toBeVisible();
  });

  test("can increase base temperature", async ({ page }) => {
    const upButton = page.getByRole("button", { name: "基準温度を上げる" });
    await upButton.click();

    // After click, temperature should show 23℃
    await expect(page.getByText("23℃")).toBeVisible();
  });

  test("can decrease base temperature", async ({ page }) => {
    const upButton = page.getByRole("button", { name: "基準温度を上げる" });
    const downButton = page.getByRole("button", { name: "基準温度を下げる" });

    // First increase to 23℃
    await upButton.click();
    await expect(page.getByText("23℃")).toBeVisible();

    // Then decrease back to 22℃
    await downButton.click();
    await expect(page.getByText("22℃")).toBeVisible();
  });

  test("displays all 8 room offset sliders", async ({ page }) => {
    const rooms = [
      "リビング",
      "寝室",
      "書斎",
      "玄関",
      "洗面室",
      "子供部屋1",
      "子供部屋2",
      "ホール2",
    ];

    for (const room of rooms) {
      await expect(page.getByText(room, { exact: true }).first()).toBeVisible();
    }

    // There should be 8 range sliders
    const sliders = page.locator('input[type="range"]');
    await expect(sliders).toHaveCount(8);
  });

  test("room offset slider can be changed", async ({ page }) => {
    const sliders = page.locator('input[type="range"]');
    const firstSlider = sliders.first();

    // Default offset is 0, change to 1
    await firstSlider.fill("1");
    await expect(firstSlider).toHaveValue("1");

    // Reset it back to 0 for next test
    await firstSlider.fill("0");
    await expect(firstSlider).toHaveValue("0");
  });

  test("shows auto-save status text", async ({ page }) => {
    await expect(
      page.getByText("変更は自動保存されます"),
    ).toBeVisible();
  });

  test("navigates to reservations page", async ({ page }) => {
    await page.getByRole("link", { name: "予約設定へ" }).click();
    await expect(page).toHaveURL(/\/reservations/);
    await expect(page.locator("h1")).toContainText("予約設定");
  });
});

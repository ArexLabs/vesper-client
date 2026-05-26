import { expect, test } from "@playwright/test";

test.describe("App shell", () => {
  test("renders the sidebar with navigation items", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Vesper Client")).toBeVisible();
    await expect(page.getByText("Config-First Desktop Launcher")).toBeVisible();

    const navLinks = ["Instances", "Discover", "Config Studio", "Diagnostics", "Settings"];
    for (const label of navLinks) {
      await expect(page.getByRole("link", { name: label })).toBeVisible();
    }
  });

  test("navigates between pages via sidebar", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByText("Global Defaults")).toBeVisible();

    await page.getByRole("link", { name: "Instances" }).click();
    await expect(page).toHaveURL(/\/instances/);
  });

  test("displays the correct page title", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText("Settings").first()).toBeVisible();
  });
});

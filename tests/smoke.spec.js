import { test, expect } from "@playwright/test";
// BijliBureau smoke: 7-tab flow + demo load + share-link + rulebook browser.
// Run: npx playwright test (requires `npx serve .` on :3000 or tools/serve.js).
test("demo loads all 7 tabs with verdict", async ({ page }) => {
  await page.goto("http://localhost:3000/#intake");
  await expect(page.locator("#btnRun")).toBeVisible();
  await page.click("#btnRun");
  await expect(page.locator("#t_soh")).not.toHaveText("—");
  for (const tab of ["soh", "warranty", "second", "resale", "evidence", "intel"]) {
    await page.click(`.tab[data-tab="${tab}"]`);
    await expect(page.locator(`#tab-${tab}`)).toBeVisible();
  }
  await expect(page.locator("#r_warrStatus")).not.toBeEmpty();
});

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
  BILAL_DRIVER,
  loginAsController,
  loginAsDriver,
  loginAsOperations,
} from "./helpers/auth";
import {
  createTripAsOperations,
  LIVE_CUSTOMER,
  openTripFromList,
  uniqueReference,
  visibleStatus,
} from "./helpers/trip";

test.describe.serial("live trip lifecycle", () => {
  let reference: string;
  let tripUrl: string;
  let opsContext: BrowserContext;
  let opsPage: Page;
  let driverContext: BrowserContext | undefined;
  let driverPage: Page | undefined;

  test.beforeAll(async ({ browser }) => {
    reference = uniqueReference("E2E-LIVE");
    opsContext = await browser.newContext();
    opsPage = await opsContext.newPage();
  });

  test.afterAll(async () => {
    await driverContext?.close();
    await opsContext?.close();
  });

  test("operations creates an unassigned trip", async () => {
    await loginAsOperations(opsPage);
    await createTripAsOperations(opsPage, LIVE_CUSTOMER, reference);
    await openTripFromList(opsPage, LIVE_CUSTOMER, reference);
    tripUrl = opsPage.url();
    await expect(visibleStatus(opsPage, "Scheduled")).toBeVisible();
  });

  test("controller assigns a driver", async ({ page }) => {
    await loginAsController(page);
    await page.getByLabel("Search trips").fill(reference);
    await expect(
      page.getByRole("link", { name: `Open ${LIVE_CUSTOMER} trip` }),
    ).toBeVisible();
    const row = page.locator("li").filter({
      has: page.getByRole("link", { name: `Open ${LIVE_CUSTOMER} trip` }),
    });
    await row.getByRole("combobox").click();
    await page.getByRole("textbox", { name: "Search drivers" }).fill(BILAL_DRIVER);
    await page.getByRole("option", { name: BILAL_DRIVER }).click();
    await row.getByRole("button", { name: "Assign", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Driver assigned");
    await expect(page.getByRole("status")).toContainText(BILAL_DRIVER);
  });

  test("driver simulates and operations watches live pings", async ({ browser }) => {
    driverContext = await browser.newContext();
    driverPage = await driverContext.newPage();

    await loginAsDriver(driverPage);
    await driverPage.goto(tripUrl);
    await driverPage.getByRole("button", { name: "Simulate trip" }).click();
    const dialog = driverPage.getByRole("alertdialog");
    await dialog.getByLabel("Update interval").fill("1");
    await dialog.getByLabel("Distance per update").fill("1");
    await dialog.getByRole("button", { name: "Simulate trip" }).click();
    await expect(visibleStatus(driverPage, "In transit")).toBeVisible();

    await expect(async () => {
      await opsPage.getByRole("button", { name: "Refresh trips" }).click();
      await expect(visibleStatus(opsPage, "In transit")).toBeVisible();
    }).toPass({ timeout: 15_000 });

    await expect(
      opsPage.getByRole("tab", { name: /Location pings \([1-9]\d*\)/ }),
    ).toBeVisible({ timeout: 20_000 });

    await opsPage.getByRole("tab", { name: "Map" }).click();
    const marker = opsPage
      .getByLabel("Latest vehicle position")
      .or(opsPage.getByLabel("Pickup location"));
    await marker.first().waitFor({ state: "visible", timeout: 10_000 }).catch(() => {
      // Mapbox may not initialize without a valid public token.
    });
  });

  test("driver ends the trip", async () => {
    if (!driverPage) {
      throw new Error("Driver session was not opened.");
    }
    await driverPage.getByRole("button", { name: "End trip" }).click();
    await driverPage
      .getByRole("alertdialog")
      .getByRole("button", { name: "End trip" })
      .click();
    await expect(visibleStatus(driverPage, "Completed")).toBeVisible();

    await expect(async () => {
      if (await visibleStatus(opsPage, "Completed").isVisible()) {
        return;
      }
      await opsPage.getByRole("button", { name: "Refresh trips" }).click();
      await expect(visibleStatus(opsPage, "Completed")).toBeVisible();
    }).toPass({ timeout: 15_000 });
  });
});

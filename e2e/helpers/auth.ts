import { type Page } from "@playwright/test";
import { selectSearchOption } from "./select";

export const DEMO_PASSWORD = "password";
export const CRESCENT_VENDOR = "Crescent Dune Vehicle Logistics LLC";
export const BILAL_DRIVER = "Bilal Rahman";

export async function loginAsOperations(page: Page) {
  await page.goto("/");
  await page.getByRole("heading", { name: "Sign in" }).waitFor();
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/ops/trips");
}

export async function loginAsController(
  page: Page,
  vendorName = CRESCENT_VENDOR,
) {
  await page.goto("/");
  await page.getByRole("heading", { name: "Sign in" }).waitFor();
  await page.getByRole("button", { name: "Logistics Vendor" }).click();
  await selectSearchOption(page, "Vendor", vendorName);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/vendor\/.+\/trips$/);
}

export async function loginAsDriver(
  page: Page,
  vendorName = CRESCENT_VENDOR,
  driverName = BILAL_DRIVER,
) {
  await page.goto("/");
  await page.getByRole("heading", { name: "Sign in" }).waitFor();
  await page.getByRole("button", { name: "Logistics Vendor" }).click();
  await selectSearchOption(page, "Vendor", vendorName);
  await page.getByRole("button", { name: "Driver" }).click();
  await selectSearchOption(page, "Driver", driverName);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/vendor\/.+\/driver\/.+\/trips$/);
}

import { expect, type Page } from "@playwright/test";
import { CRESCENT_VENDOR } from "./auth";
import { selectSearchOption } from "./select";

export const CREATE_CUSTOMER = "Youssef Haddad";
export const LIVE_CUSTOMER = "Lina Khoury";

const PICKUP = {
  address: "Al Quoz Industrial Area, Dubai",
  lat: "25.1388",
  lng: "55.2285",
};

const DROPOFF = {
  address: "Jebel Ali Port, Dubai",
  lat: "24.9857",
  lng: "55.0273",
};

export function uniqueReference(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

export function tomorrowLocalDatetime() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export async function fillCreateTripForm(
  page: Page,
  {
    customerName,
    reference,
  }: {
    customerName: string;
    reference: string;
  },
) {
  await selectSearchOption(page, "Customer", customerName);
  await expect(page.getByRole("combobox", { name: "Vehicle" })).not.toContainText(
    /Select a customer first|Loading vehicles/,
  );
  await selectSearchOption(page, "Logistics vendor", CRESCENT_VENDOR);
  await page.getByLabel("Reference number").fill(reference);
  await page.getByLabel("Scheduled collection").fill(tomorrowLocalDatetime());
  await page.locator("#pickup-address").fill(PICKUP.address);
  await page.locator("#pickup-latitude").fill(PICKUP.lat);
  await page.locator("#pickup-longitude").fill(PICKUP.lng);
  await page.locator("#dropoff-address").fill(DROPOFF.address);
  await page.locator("#dropoff-latitude").fill(DROPOFF.lat);
  await page.locator("#dropoff-longitude").fill(DROPOFF.lng);
}

export async function createTripAsOperations(
  page: Page,
  customerName: string,
  reference: string,
) {
  await page.getByRole("link", { name: "New trip" }).click();
  await expect(page.getByRole("heading", { name: "Create a trip" })).toBeVisible();
  await fillCreateTripForm(page, { customerName, reference });
  await page.getByRole("button", { name: "Create trip" }).click();
  await page.waitForURL(/\/ops\/trips/);
  await expect(page.getByRole("status")).toContainText("Trip created");
  await expect(page.getByRole("status")).toContainText(reference);
}

export async function openTripFromList(page: Page, customerName: string, reference: string) {
  await page.getByLabel("Search trips").fill(reference);
  await page.getByRole("link", { name: `Open ${customerName} trip` }).click();
  await page.waitForURL(/\/trips\/[0-9a-f-]+/i);
}

export function visibleStatus(page: Page, status: string) {
  return page.getByText(status, { exact: true }).filter({ visible: true });
}

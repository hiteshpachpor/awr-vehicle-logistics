import { expect, test } from "@playwright/test";
import { loginAsOperations } from "./helpers/auth";

test("operations signs in and opens the trip workspace", async ({ page }) => {
  await loginAsOperations(page);

  await expect(page).toHaveURL(/\/ops\/trips/);
  await expect(page.getByRole("heading", { name: "Operations Control" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Trips" })).toBeVisible();
});

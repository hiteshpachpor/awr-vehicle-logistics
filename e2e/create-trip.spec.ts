import { expect, test } from "@playwright/test";
import { loginAsOperations } from "./helpers/auth";
import {
  CREATE_CUSTOMER,
  createTripAsOperations,
  uniqueReference,
} from "./helpers/trip";

test("operations creates a trip for an unused vehicle", async ({ page }) => {
  const reference = uniqueReference("E2E-CREATE");

  await loginAsOperations(page);
  await createTripAsOperations(page, CREATE_CUSTOMER, reference);

  await expect(page.getByRole("link", { name: `Open ${CREATE_CUSTOMER} trip` })).toBeVisible();
});

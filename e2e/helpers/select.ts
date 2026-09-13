import { type Page } from "@playwright/test";

export async function selectSearchOption(
  page: Page,
  comboboxName: string,
  option: string,
) {
  const trigger = page.getByRole("combobox", { name: comboboxName });
  await trigger.click();
  const search = page.getByRole("textbox", { name: /Search / });
  if (await search.isVisible()) {
    await search.fill(option);
  }
  await page.getByRole("option", { name: option }).click();
}

import { expect, test } from "@playwright/test";

test("avisa o limite, cria categoria e arquiva sem apagar o relatório", async ({ page }) => {
  await page.goto("/cartoes");
  await page.getByRole("button", { name: "Continuar sem senha" }).click();
  await page.getByRole("button", { name: "Entendi o risco e quero continuar" }).click();

  await page.getByRole("button", { name: "Novo cartão" }).click();
  const cardDialog = page.getByRole("dialog");
  await cardDialog.locator("input").nth(0).fill("Visa teste");
  await cardDialog.locator('input[inputmode="decimal"]').fill("100");
  await cardDialog.getByRole("button", { name: "Salvar" }).click();

  await page.getByText("Visa teste").click();
  await page.getByRole("button", { name: "Nova compra" }).click();
  const buy = page.getByRole("dialog");
  await buy.locator("input").nth(0).fill("Mercado teste");
  await buy.locator('input[inputmode="decimal"]').fill("150,00");
  await expect(buy.getByText("Essa compra passa do limite.")).toBeVisible();
  await buy.getByPlaceholder("Nova categoria").fill("Pet");
  await buy.getByRole("button", { name: "Criar" }).click();
  await expect(buy.getByRole("combobox").filter({ hasText: "Pet" })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await buy.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByText("Mercado teste")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Arquivar cartão" }).click();
  await expect(page.getByRole("button", { name: "Visa teste · arquivado" })).toBeVisible();

  await page.getByRole("link", { name: "Relatórios" }).click();
  await expect(page.getByRole("heading", { name: "Outro dispositivo" })).toBeVisible();
  await expect(page.getByText("R$ 150,00").first()).toBeVisible();
});

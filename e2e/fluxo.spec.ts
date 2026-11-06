import { expect, test } from "@playwright/test";

test("cria senha, lança, faz backup e restaura", async ({ page }) => {
  await page.goto("/");
  const passwords = page.locator('input[type="password"]');
  await passwords.nth(0).fill("senha-forte-ok");
  await passwords.nth(1).fill("senha-forte-ok");
  await page.getByRole("button", { name: "Criar senha e criptografar" }).click();
  await expect(page.getByRole("heading", { name: "Bem-vindo ao Saldo" })).toBeVisible({
    timeout: 60_000,
  });

  await page.getByRole("link", { name: "Adicionar conta" }).click();
  await page.getByRole("button", { name: "Nova conta" }).click();
  await page.getByPlaceholder("Ex.: Nubank").fill("Conta teste");
  await page.getByPlaceholder("0,00").fill("500,00");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("R$ 500,00").first()).toBeVisible();

  await page.getByRole("link", { name: "Dashboard" }).click();
  await page.getByRole("button", { name: "Nova movimentação" }).click();
  const movement = page.getByRole("dialog");
  await movement.locator("input").nth(0).fill("Padaria teste");
  await movement.locator('input[inputmode="decimal"]').fill("12,50");
  await movement.getByRole("combobox").filter({ hasText: "Escolha" }).click();
  await page.getByRole("option", { name: "Alimentação" }).click();
  await movement.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByText("Padaria teste")).toBeVisible();

  await page.getByRole("link", { name: "Relatórios" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Backup" }).click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  expect(backupPath).toBeTruthy();

  await page.getByRole("link", { name: "Movimentações" }).click();
  await page.getByRole("button", { name: "Excluir" }).click();
  await expect(page.getByText("Nada por aqui")).toBeVisible();

  await page.getByRole("link", { name: "Relatórios" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator('input[type="file"]').setInputFiles(backupPath!);
  const dialog = page.getByRole("dialog");
  await dialog.locator('input[type="password"]').fill("senha-errada-xx");
  await dialog.getByRole("button", { name: "Restaurar" }).click();
  await expect(page.getByText("Senha incorreta.")).toBeVisible({ timeout: 60_000 });

  await dialog.locator('input[type="password"]').fill("senha-forte-ok");
  await dialog.getByRole("button", { name: "Restaurar" }).click();
  await expect(page.getByText("Backup restaurado")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("R$ 12,50").first()).toBeVisible();
});

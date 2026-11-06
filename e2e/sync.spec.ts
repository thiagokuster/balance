import { expect, test, type Page } from "@playwright/test";

const conflict =
  "O arquivo vinculado mudou em outro aparelho e não foi atualizado. Não há como juntar as duas versões.";

async function syncFile(page: Page) {
  return page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle("saldo-sync.json");
    let last: unknown;
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        return await (await handle.getFile()).text();
      } catch (error) {
        last = error;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    throw last;
  });
}

test("sem senha, o vínculo não abre a pasta nem gera arquivo", async ({ page }) => {
  await page.addInitScript(() => {
    const target = window as Window & {
      __pickerCalled?: boolean;
      showSaveFilePicker?: () => Promise<never>;
    };
    target.showSaveFilePicker = async () => {
      target.__pickerCalled = true;
      throw new DOMException("The user aborted a request.", "AbortError");
    };
  });
  await page.goto("/relatorios");
  await page.getByRole("button", { name: "Continuar sem senha" }).click();
  await page.getByRole("button", { name: "Entendi o risco e quero continuar" }).click();
  await page.getByRole("button", { name: "Vincular arquivo" }).click();
  await expect(page.getByText("Crie uma senha antes de vincular um arquivo")).toBeVisible();
  expect(await page.evaluate(() => (window as { __pickerCalled?: boolean }).__pickerCalled)).toBe(
    undefined,
  );
});

test("com senha, o arquivo sai criptografado e uma versão alheia não é substituída", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const target = window as Window & {
      showSaveFilePicker?: () => Promise<FileSystemFileHandle>;
    };
    target.showSaveFilePicker = async () => {
      const root = await navigator.storage.getDirectory();
      return root.getFileHandle("saldo-sync.json", { create: true });
    };
  });

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
  await page.getByPlaceholder("Ex.: Nubank").fill("Conta sync");
  await page.getByPlaceholder("0,00").fill("100,00");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("R$ 100,00").first()).toBeVisible();

  await page.getByRole("link", { name: "Relatórios" }).click();
  await page.getByRole("button", { name: "Vincular arquivo" }).click();
  await expect(
    page.getByText("Arquivo vinculado. Ele acompanha as mudanças deste navegador."),
  ).toBeVisible();

  const linked = JSON.parse(await syncFile(page)) as { state?: unknown; sealed?: { alg?: string } };
  expect(linked.state).toBeUndefined();
  expect(linked.sealed?.alg).toBe("AES-GCM");
  expect(await syncFile(page)).not.toContain("Conta sync");

  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle("saldo-sync.json");
    const json = JSON.parse(await (await handle.getFile()).text()) as { exportedAt?: string };
    json.exportedAt = "2099-01-01T00:00:00.000Z";
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(json));
    await writable.close();
  });

  await page.getByRole("link", { name: "Dashboard" }).click();
  await page.getByRole("button", { name: "Nova movimentação" }).click();
  const movement = page.getByRole("dialog");
  await movement.locator("input").nth(0).fill("Padaria sync");
  await movement.locator('input[inputmode="decimal"]').fill("8,00");
  await movement.getByRole("combobox").filter({ hasText: "Escolha" }).click();
  await page.getByRole("option", { name: "Alimentação" }).click();
  await movement.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByText(conflict)).toBeVisible();
  await expect(page.getByText("Padaria sync")).toBeVisible();

  const afterEdit = JSON.parse(await syncFile(page)) as { exportedAt?: string };
  expect(afterEdit.exportedAt).toBe("2099-01-01T00:00:00.000Z");

  await page.getByRole("link", { name: "Relatórios" }).click();
  await page.getByRole("button", { name: "Trazer arquivo vinculado" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('input[type="password"]').fill("senha-forte-ok");
  await dialog.getByRole("button", { name: "Restaurar" }).click();
  await expect(page.getByText("Backup restaurado")).toBeVisible({ timeout: 60_000 });
  await page.getByRole("link", { name: "Movimentações" }).click();
  await expect(page.getByText("Nada por aqui")).toBeVisible();

  await page.getByRole("link", { name: "Dashboard" }).click();
  await page.getByRole("button", { name: "Nova movimentação" }).click();
  const next = page.getByRole("dialog");
  await next.locator("input").nth(0).fill("Mercado sync");
  await next.locator('input[inputmode="decimal"]').fill("4,00");
  await next.getByRole("combobox").filter({ hasText: "Escolha" }).click();
  await page.getByRole("option", { name: "Alimentação" }).click();
  await next.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByText("Mercado sync")).toBeVisible();
  await expect
    .poll(
      async () => {
        try {
          const saved = JSON.parse(await syncFile(page)) as {
            exportedAt?: string;
            state?: unknown;
          };
          return saved.state === undefined && saved.exportedAt !== "2099-01-01T00:00:00.000Z";
        } catch {
          return false;
        }
      },
      { timeout: 60_000 },
    )
    .toBe(true);
});

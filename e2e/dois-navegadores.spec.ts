import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const conflict =
  "O arquivo vinculado mudou em outro aparelho e não foi atualizado. Não há como juntar as duas versões.";

async function shareFolder(context: BrowserContext, file: string, writes: { count: number }) {
  await context.exposeFunction("__readShared", () => fs.readFileSync(file, "utf8"));
  await context.exposeFunction("__writeShared", (text: string) => {
    fs.writeFileSync(file, text);
    writes.count += 1;
  });
  await context.addInitScript(() => {
    const shared = window as unknown as {
      __readShared: () => Promise<string>;
      __writeShared: (text: string) => Promise<void>;
      showSaveFilePicker?: () => Promise<{
        queryPermission: () => Promise<PermissionState>;
        requestPermission: () => Promise<PermissionState>;
        getFile: () => Promise<File>;
        createWritable: () => Promise<{
          write: (data: string) => Promise<void>;
          close: () => Promise<void>;
        }>;
      }>;
    };
    shared.showSaveFilePicker = async () => ({
      queryPermission: async () => "granted",
      requestPermission: async () => "granted",
      getFile: async () => new File([await shared.__readShared()], "saldo-sync.json"),
      createWritable: async () => {
        let next = "";
        return {
          write: async (data: string) => {
            next = String(data);
          },
          close: async () => {
            await shared.__writeShared(next);
          },
        };
      },
    });
  });
}

async function createPassword(page: Page) {
  await page.goto("/");
  const passwords = page.locator('input[type="password"]');
  await passwords.nth(0).fill("senha-forte-ok");
  await passwords.nth(1).fill("senha-forte-ok");
  await page.getByRole("button", { name: "Criar senha e criptografar" }).click();
  await expect(page.getByRole("heading", { name: "Bem-vindo ao Saldo" })).toBeVisible({
    timeout: 60_000,
  });
}

test("dois navegadores usam a mesma pasta e um não apaga a versão do outro", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "saldo-pasta-"));
  const file = path.join(dir, "saldo-sync.json");
  const writes = { count: 0 };
  fs.writeFileSync(file, "");
  const first = await browser.newContext();
  const second = await browser.newContext();
  try {
    await shareFolder(first, file, writes);
    await shareFolder(second, file, writes);
    const pageA = await first.newPage();
    const pageB = await second.newPage();
    pageA.on("dialog", (dialog) => dialog.accept());
    pageB.on("dialog", (dialog) => dialog.accept());

    const headers = (await pageA.request.get("/")).headers();
    expect(headers["x-robots-tag"]).toBe("noindex");

    await createPassword(pageA);
    await pageA.getByRole("link", { name: "Adicionar conta" }).click();
    await pageA.getByRole("button", { name: "Nova conta" }).click();
    await pageA.getByPlaceholder("Ex.: Nubank").fill("Conta compartilhada");
    await pageA.getByPlaceholder("0,00").fill("80,00");
    await pageA.getByRole("button", { name: "Criar conta" }).click();
    await expect(pageA.getByText("R$ 80,00").first()).toBeVisible();

    await pageA.getByRole("link", { name: "Relatórios" }).click();
    await expect(pageA.getByText("a gravação espera Trazer arquivo vinculado")).toBeVisible();
    await pageA.getByRole("button", { name: "Vincular arquivo" }).click();
    await expect(
      pageA.getByText("Arquivo vinculado. Ele acompanha as mudanças deste navegador."),
    ).toBeVisible();
    const linked = JSON.parse(fs.readFileSync(file, "utf8")) as {
      state?: unknown;
      sealed?: { alg?: string };
    };
    expect(linked.state).toBeUndefined();
    expect(linked.sealed?.alg).toBe("AES-GCM");

    await createPassword(pageB);
    await pageB.getByRole("link", { name: "Relatórios" }).click();
    await pageB.getByRole("button", { name: "Vincular arquivo" }).click();
    await expect(pageB.getByText(conflict)).toBeVisible();
    expect(JSON.parse(fs.readFileSync(file, "utf8")).exportedAt).toBe(linked.exportedAt);

    await pageB.getByRole("button", { name: "Trazer arquivo vinculado" }).click();
    const dialog = pageB.getByRole("dialog");
    await dialog.locator('input[type="password"]').fill("senha-forte-ok");
    await dialog.getByRole("button", { name: "Restaurar" }).click();
    await expect(pageB.getByText("Backup restaurado")).toBeVisible({ timeout: 60_000 });
    await pageB.getByRole("link", { name: "Contas" }).click();
    await expect(pageB.getByText("Conta compartilhada")).toBeVisible();

    await pageB.getByRole("link", { name: "Dashboard" }).click();
    await pageB.getByRole("button", { name: "Nova movimentação" }).click();
    const movement = pageB.getByRole("dialog");
    await movement.locator("input").nth(0).fill("Padaria do segundo");
    await movement.locator('input[inputmode="decimal"]').fill("3,00");
    await movement.getByRole("combobox").filter({ hasText: "Escolha" }).click();
    await pageB.getByRole("option", { name: "Alimentação" }).click();
    await movement.getByRole("button", { name: "Adicionar" }).click();
    await expect(pageB.getByText("Padaria do segundo")).toBeVisible();
    const written = writes.count;
    await expect.poll(() => writes.count, { timeout: 60_000 }).toBeGreaterThan(written);
    const afterSecond = fs.readFileSync(file, "utf8");

    await pageA.getByRole("link", { name: "Dashboard" }).click();
    await pageA.getByRole("button", { name: "Nova movimentação" }).click();
    const other = pageA.getByRole("dialog");
    await other.locator("input").nth(0).fill("Padaria do primeiro");
    await other.locator('input[inputmode="decimal"]').fill("2,00");
    await other.getByRole("combobox").filter({ hasText: "Escolha" }).click();
    await pageA.getByRole("option", { name: "Alimentação" }).click();
    await other.getByRole("button", { name: "Adicionar" }).click();
    await expect(pageA.getByText(conflict)).toBeVisible();
    await expect(pageA.getByText("Padaria do primeiro")).toBeVisible();
    expect(fs.readFileSync(file, "utf8")).toBe(afterSecond);
  } finally {
    await first.close().catch(() => undefined);
    await second.close().catch(() => undefined);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

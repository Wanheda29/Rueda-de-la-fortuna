import { test, expect } from "@playwright/test";

async function seed(page, overrides = {}) {
  await page.addInitScript(wheel => {
    localStorage.setItem("ruleta-borrador-v1", JSON.stringify({ version: 1, wheel }));
  }, {
    nombre: "Sorteo de prueba", centro: { texto: "Gira" },
    gajos: ["Uno", "Dos", "Tres", "Cuatro"].map(texto => ({ texto, color: "#14b8a6", probabilidad: 25 })),
    juego: { sonido: false, animaciones: false, retirarGanador: true },
    ...overrides,
  });
}

test("draft survives a reload; undo/redo and saved versions work", async ({ page }) => {
  await page.goto(".");
  const first = page.getByLabel("Premio o texto").first();
  await first.fill("Premio especial");
  await expect(page.getByText("Borrador guardado en este dispositivo", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Premio o texto").first()).toHaveValue("Premio especial");
  await page.getByRole("button", { name: "Duplicar", exact: true }).first().click();
  await expect(page.locator(".prize-item")).toHaveCount(9);
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(page.locator(".prize-item")).toHaveCount(8);
  await page.getByRole("button", { name: "Rehacer", exact: true }).click();
  await expect(page.locator(".prize-item")).toHaveCount(9);
  await page.getByRole("button", { name: "Guardar ruleta", exact: true }).click();
  await page.getByRole("button", { name: "Nueva rueda" }).click();
  await page.getByRole("tab", { name: "Guardadas" }).click();
  await page.getByRole("button", { name: "Cargar", exact: true }).click();
  await page.getByRole("tab", { name: /^Gajos/ }).click();
  await expect(page.getByLabel("Premio o texto").first()).toHaveValue("Premio especial");
});

test("bulk import, reordering, palettes and undo keep a coherent wheel", async ({ page }) => {
  await page.goto(".");
  await page.getByRole("button", { name: "Pegar una lista de premios" }).click();
  await page.getByRole("textbox", { name: /Un premio por línea/ }).fill("A\nB\nC");
  await page.getByRole("button", { name: "Aplicar lista" }).click();
  await expect(page.getByRole("alert")).toContainText("entre 4 y 14");
  await page.getByRole("textbox", { name: /Un premio por línea/ }).fill("A\nB\nC\nD");
  await page.getByRole("button", { name: "Aplicar lista" }).click();
  await expect(page.locator(".prize-item")).toHaveCount(4);
  await page.getByRole("button", { name: "Bajar gajo 1", exact: true }).click();
  await expect(page.getByLabel("Premio o texto").first()).toHaveValue("B");
  await page.getByRole("button", { name: "Pastel", exact: true }).click();
  await expect(page.locator(".slice-color input").first()).toHaveValue("#fecdd3");
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(page.locator(".slice-color input").first()).not.toHaveValue("#fecdd3");
});

test("non-repeating draws exhaust the pool without deleting the design", async ({ page }) => {
  await seed(page);
  await page.goto(".");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: "Girar", exact: true }).click();
    await expect(page.locator(".result-history summary")).toContainText(String(i + 1));
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  }
  await expect(page.getByRole("button", { name: "Sorteo finalizado" })).toBeDisabled();
  await page.locator(".result-history summary").click();
  await expect(page.locator(".result-history li")).toHaveCount(4);
  const names = await page.locator(".result-history li > span").allTextContents();
  expect(new Set(names).size).toBe(4);
  await page.getByRole("button", { name: "Reiniciar sesión", exact: true }).click();
  await expect(page.getByRole("button", { name: "Girar", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Volver al editor" }).click();
  await expect(page.locator(".prize-item")).toHaveCount(4);
});

test("leaving a spin cancels its delayed winner, sound and history entry", async ({ page }) => {
  await seed(page, { juego: { sonido: false, duracion: 2, animaciones: true } });
  await page.clock.install();
  await page.goto(".");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("button", { name: "Girar", exact: true }).click();
  await page.getByRole("button", { name: "Volver al editor" }).click();
  await page.clock.runFor(3000);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.locator(".result-history summary")).toContainText("0");
  await expect(page.getByText("Aún no hay resultado", { exact: true })).toBeVisible();
});

test("turning off winner removal brings all prizes back into the pool", async ({ page }) => {
  await seed(page, { gajos: ["Uno", "Dos", "Tres", "Cuatro"].map((texto, i) => ({ texto, color: "#14b8a6", probabilidad: i === 0 ? 100 : 0 })) });
  await page.goto(".");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("button", { name: "Girar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sorteo finalizado" })).toBeDisabled();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("button", { name: "Volver al editor" }).click();
  await page.getByRole("tab", { name: "Apariencia" }).click();
  await page.getByLabel("Retirar al ganador después de cada tirada").uncheck();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Girar", exact: true })).toBeEnabled();
});

test("preview includes title, logo and result; image fitting can be adjusted", async ({ page }) => {
  const image = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="120" height="60" fill="orange"/></svg>');
  await seed(page, { logoJuego: { imagen: image, opacidad: 80 }, centro: { imagen: image, texto: "", tamanoImagen: 116 } });
  await page.goto(".");
  await expect(page.locator(".scene-preview .scene-title")).toHaveText("Sorteo de prueba");
  await expect(page.locator(".scene-preview .play-logo img")).toBeVisible();
  await expect(page.getByText("Ejemplo de resultado")).toBeVisible();
  await page.getByRole("tab", { name: "Apariencia" }).click();
  await page.getByLabel("Cómo mostrar el logo").selectOption("contain");
  await expect(page.locator(".wheel-center-image")).toHaveCSS("object-fit", "contain");
  await page.getByLabel("Mostrar el título en el juego").uncheck();
  await expect(page.locator(".scene-preview .scene-title")).toHaveCount(0);
});

test("mobile editor and game stay inside the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  await page.goto(".");
  await expect(page.getByRole("tab", { name: /^Gajos/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/editor-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  const wheel = await page.locator(".wheel-wrap").boundingBox();
  expect(wheel.x).toBeGreaterThanOrEqual(0);
  expect(wheel.x + wheel.width).toBeLessThanOrEqual(391);
  await page.screenshot({ path: "test-results/game-mobile.png", fullPage: true });
});

test("reduced motion overrides animation and a stale share link is cleared", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seed(page, { juego: { sonido: false, animaciones: true, confeti: true, duracion: 12 } });
  await page.goto(".?ruleta=old-link");
  await page.getByRole("button", { name: "Nueva rueda" }).click();
  await expect(page).not.toHaveURL(/ruleta=/);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("button", { name: "Girar", exact: true }).click();
  await expect(page.locator(".result-history summary")).toContainText("1", { timeout: 1500 });
  await expect(page.locator(".confetti-layer")).toHaveCount(0);
});

test("desktop presentation supports full screen and keeps the wheel and controls visible", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seed(page);
  await page.goto(".");
  await expect(page.getByText("Borrador guardado en este dispositivo", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/editor-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("button", { name: "Pantalla completa", exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await page.getByRole("button", { name: "Salir de pantalla completa", exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
  await page.screenshot({ path: "test-results/game-desktop.png", fullPage: true });
  const wheel = await page.locator(".wheel-wrap").boundingBox();
  const button = await page.getByRole("button", { name: "Girar", exact: true }).boundingBox();
  expect(wheel.x + wheel.width).toBeLessThan(button.x);
});

test("a blocked browser store reports the failure instead of claiming the draft is saved", async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException("Quota exceeded", "QuotaExceededError"); }; });
  await page.goto(".");
  await page.getByLabel("Premio o texto").first().fill("Cambio importante");
  await expect(page.getByText(/No se pudo guardar el borrador/)).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar copia", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.json$/);
});

async function mockOnline(page, delay = 0, secure = true) {
  await page.route(/\/src\/supabaseClient\.js(?:\?|$)/, route => route.fulfill({
    contentType: "application/javascript",
    body: `
      export const supabaseConfigured = true;
      export const secureEditingEnabled = ${secure};
      const wheel = { nombre: 'Ruleta compartida', gajos: ['A','B','C','D'].map(texto => ({texto, probabilidad:25, color:'#14b8a6'})) };
      export const supabase = {
        auth: { getSession: async () => ({data:{session:{user:{id:'current-editor'}}}}) },
        from: () => ({
          select: () => ({eq: () => ({
            single: () => new Promise(resolve => setTimeout(() => resolve({data:{config_json:wheel},error:null}), ${delay})),
            maybeSingle: async () => ({data:{owner_id:'another-editor'}, error:null})
          })}),
          upsert: async value => { window.lastOnlineSave = value; return {error:null}; }
        })
      };
    `,
  }));
}

test("saving a shared wheel creates an owned copy and never overwrites the original", async ({ page }) => {
  await mockOnline(page);
  await page.goto(".?ruleta=original-id");
  await expect(page.locator(".preview-heading h2")).toHaveText("Ruleta compartida");
  await page.getByRole("button", { name: "Guardar online", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.lastOnlineSave?.owner_id)).toBe("current-editor");
  expect(await page.evaluate(() => window.lastOnlineSave.id)).not.toBe("original-id");
  await expect(page).not.toHaveURL(/original-id/);
  await page.getByRole("button", { name: "Nueva rueda", exact: true }).click();
  await expect(page).not.toHaveURL(/ruleta=/);
  await page.getByRole("tab", { name: "Guardadas", exact: true }).click();
  await expect(page.locator(".share-link-row")).toHaveCount(0);
});

test("a delayed shared wheel cannot replace a new wheel created while loading", async ({ page }) => {
  await mockOnline(page, 800);
  await page.clock.install();
  await page.goto(".?ruleta=original-id");
  await page.getByRole("button", { name: "Nueva rueda", exact: true }).click();
  await page.clock.runFor(1200);
  await expect(page.locator(".preview-heading h2")).toHaveText("Ruleta 1");
  await expect(page).not.toHaveURL(/ruleta=/);
});

test("default online mode remains compatible with the existing schema", async ({ page }) => {
  await mockOnline(page, 0, false);
  await page.goto(".?ruleta=original-id");
  await expect(page.locator(".preview-heading h2")).toHaveText("Ruleta compartida");
  await page.getByRole("button", { name: "Guardar online", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.lastOnlineSave?.id)).toBe("original-id");
  expect(await page.evaluate(() => Object.hasOwn(window.lastOnlineSave, "owner_id"))).toBe(false);
  await expect(page).toHaveURL(/ruleta=original-id/);
});

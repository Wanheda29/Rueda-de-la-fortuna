import { test, expect } from "@playwright/test";
import { wheelSlices, sliceAtPointer } from "../../src/features.mjs";

async function seed(page, options = {}) {
  await page.addInitScript(wheel => {
    if (!localStorage.getItem("ruleta-borrador-v1")) localStorage.setItem("ruleta-borrador-v1", JSON.stringify({ version: 1, wheel }));
    Math.random = () => .75;
  }, {
    nombre: "Ruleta de premios", centro: { texto: "Gira" },
    gajos: [70, 20, 10, 0].map((probabilidad, i) => ({ texto: ["Gran premio", "Pierde turno", "Otra oportunidad", "Sin participación"][i], mensajeResultado: i === 1 ? "Vuelve a intentarlo" : "Resultado", color: ["#f97316", "#14b8a6", "#a855f7", "#3b82f6"][i], probabilidad })),
    juego: { sonido: false, animaciones: false, confeti: false, modoSectores: "proporcionales", retirarGanador: true },
    ...options,
  });
}

test("proportional wheel, pointer, highlight and effective probabilities agree", async ({ page }) => {
  await seed(page);
  await page.goto(".");
  await expect(page.locator(".wheel-face > g")).toHaveCount(3);
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("button", { name: "Girar", exact: true }).click();
  const dialog = page.locator(".winner-text-result");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveText("Pierde turno");
  await expect(dialog.locator(".winner-dot")).toHaveCSS("background-color", "rgb(20, 184, 166)");
  await expect(dialog.getByRole("button")).toHaveCount(0);
  await expect(dialog.locator("#winner-prize")).toHaveText("Pierde turno");
  const rotation = await page.locator(".wheel").evaluate(el => Number(el.style.transform.match(/rotate\(([-.\d]+)deg\)/)[1]));
  expect(sliceAtPointer(wheelSlices([70, 20, 10, 0].map(probabilidad => ({ probabilidad })), "proporcionales"), rotation)).toBe(1);
  await expect(page.locator(".winning-slice")).toHaveAttribute("data-slice-index", "1");
  await page.keyboard.press("Escape");
  await expect(page.locator(".play-layout .probability-info")).toHaveCount(0);
  await expect(page.locator(".wheel-face > g > title")).toHaveText(["Gran premio", "Pierde turno", "Otra oportunidad"]);
  await page.screenshot({ path: "test-results/proportional-game.png", fullPage: true });
  await page.getByRole("button", { name: "Volver al editor", exact: true }).click();
  await page.getByText("Probabilidades actuales", { exact: true }).click();
  const rows = page.locator(".probability-info tbody tr");
  await expect(rows.nth(0).locator("td").last()).toHaveText("87.5%");
  await expect(rows.nth(1).locator("td").last()).toHaveText("0.0%");
  await expect(rows.nth(2).locator("td").last()).toHaveText("12.5%");
});

test("centered result stays visible without blocking repeat or changing focus", async ({ page }) => {
  await page.clock.install();
  await seed(page, { juego: { sonido: false, animaciones: false, confeti: false, mantenerResultado: true } });
  await page.goto(".");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("button", { name: "Girar", exact: true }).click();
  await page.clock.runFor(200);
  await page.clock.runFor(10000);
  await expect(page.locator(".winner-text-result")).toBeVisible();
  await expect(page.locator("dialog")).toHaveCount(0);
  await expect(page.locator(".play-layout > .winner-text-result")).toHaveCount(1);
  const cardBox = await page.locator(".winner-text-result").boundingBox();
  const viewport = page.viewportSize();
  expect(cardBox.x + cardBox.width / 2).toBeCloseTo(viewport.width / 2, 0);
  expect(cardBox.y + cardBox.height / 2).toBeCloseTo(viewport.height / 2, 0);
  expect(await page.locator(".winner-text-result").evaluate(el => el.contains(document.activeElement))).toBe(false);
  await page.screenshot({ path: "test-results/centered-result.png", fullPage: true });
  await page.getByRole("button", { name: "Girar", exact: true }).click();
  await expect(page.locator(".winner-text-result")).toHaveCount(0);
  await page.clock.runFor(200);
  await expect(page.locator(".result-history summary")).toContainText("2");
  await page.keyboard.press("Escape");
  await expect(page.locator(".winner-text-result")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Girar", exact: true })).toBeEnabled();
});

test("mobile result is only centered text and color without a panel or focus trap", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  await page.goto(".");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("button", { name: "Girar", exact: true }).click();
  await expect(page.locator(".winner-text-result")).toBeVisible();
  const cardBox = await page.locator(".winner-text-result").boundingBox();
  expect(cardBox.x + cardBox.width / 2).toBeCloseTo(195, 0);
  expect(cardBox.y + cardBox.height / 2).toBeCloseTo(422, 0);
  expect(cardBox.x).toBeGreaterThanOrEqual(0);
  expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(390);
  await expect(page.locator(".winner-text-result")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(page.locator(".winner-text-result")).toHaveCSS("pointer-events", "none");
  await expect(page.locator("dialog")).toHaveCount(0);
  await page.screenshot({ path: "test-results/centered-result-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Girar ruleta", exact: true }).click();
  await expect(page.locator(".result-history summary")).toContainText("2");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Girar", exact: true })).toBeEnabled();
});

test("long result names wrap within the screen in portrait and landscape", async ({ page }) => {
  const name = "Una experiencia especial para compartir con toda la familia";
  await seed(page, { gajos: Array.from({ length: 4 }, () => ({ texto: name, color: "#ffcf33", probabilidad: 25 })), juego: { sonido: false, animaciones: false, confeti: false, mostrarBotonGirar: false } });
  await page.goto(".");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("button", { name: "Girar ruleta", exact: true }).click();
  await expect(page.locator(".winner-text-result")).toHaveText(name);
  for (const [width, height] of [[390, 844], [1080, 1920], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    const box = await page.locator(".winner-text-result").boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    expect(box.x + box.width / 2).toBeCloseTo(width / 2, 0);
    expect(box.y + box.height / 2).toBeCloseTo(height / 2, 0);
  }
});

test("optional automatic dismissal and idle controls behave without blocking keyboard users", async ({ page }) => {
  await page.clock.install();
  await seed(page, { juego: { sonido: false, animaciones: false, confeti: false, mantenerResultado: false, ocultarControles: true } });
  await page.goto(".");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.clock.runFor(3000);
  await expect(page.locator(".presentation-controls")).toHaveClass(/controls-hidden/);
  await page.getByRole("button", { name: "Mostrar controles", exact: true }).click();
  await expect(page.locator(".presentation-controls")).not.toHaveClass(/controls-hidden/);
  await page.getByText("Volumen", { exact: true }).click();
  const giro = page.getByRole("slider", { name: /Volumen del giro/ });
  await giro.press("End");
  await expect(giro).toHaveValue("100");
  await expect(page.getByRole("slider", { name: /Volumen del resultado/ })).toHaveValue("85");
  await page.getByRole("button", { name: "Girar", exact: true }).click();
  await page.clock.runFor(200);
  await expect(page.locator(".winner-text-result")).toBeVisible();
  await page.clock.runFor(7000);
  await expect(page.locator(".winner-text-result")).toHaveCount(0);
});

test("saved library imports an exported copy, duplicates it, filters and rejects bad JSON", async ({ page }) => {
  await seed(page);
  await page.goto(".");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar copia", exact: true }).click();
  const file = await download;
  await page.getByRole("tab", { name: "Guardadas", exact: true }).click();
  await page.getByLabel("Importar copia JSON").setInputFiles(await file.path());
  await expect(page.locator(".library-card")).toHaveCount(1);
  await expect(page.locator(".saved-thumbnail")).toHaveCount(1);
  await page.getByRole("button", { name: "Duplicar versión", exact: true }).click();
  await expect(page.locator(".library-card")).toHaveCount(2);
  await page.getByLabel("Ordenar por").selectOption("nombre");
  await page.getByLabel("Buscar ruleta").fill("copia");
  await expect(page.locator(".library-card")).toHaveCount(1);
  await expect(page.locator(".library-card h3")).toContainText("(copia)");
  await page.getByLabel("Buscar ruleta").fill("");
  await page.getByLabel("Importar copia JSON").setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from('{"gajos":[]}') });
  await expect(page.getByText(/El archivo no contiene una ruleta válida/)).toBeVisible();
  await expect(page.locator(".library-card")).toHaveCount(2);
  await page.screenshot({ path: "test-results/library.png", fullPage: true });
});

test("mobile preview collapses and quick actions remain available while editing", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  await page.goto(".");
  await expect(page.locator(".preview-content")).toBeHidden();
  await expect(page.getByRole("tab", { name: /^Gajos/ })).toBeVisible();
  await page.getByRole("button", { name: "Ver rueda", exact: true }).click();
  await expect(page.locator(".preview-content")).toBeVisible();
  await page.getByRole("button", { name: "Ocultar rueda", exact: true }).click();
  await page.locator(".prize-item").last().scrollIntoViewIfNeeded();
  await expect(page.getByRole("navigation", { name: "Acciones rápidas" })).toBeInViewport();
  await page.screenshot({ path: "test-results/refined-mobile.png", fullPage: true });
});

test("long labels fit the wheel in both orientations and the custom message survives reload", async ({ page }) => {
  await seed(page, { gajos: Array.from({ length: 14 }, (_, i) => ({ texto: `Premio especial número ${i + 1}`, probabilidad: 100 / 14, color: "#14b8a6" })), juego: { sonido: false, animaciones: false } });
  await page.goto(".");
  await expect(page.locator(".wheel-label")).toHaveCount(14);
  await page.getByRole("tab", { name: "Apariencia" }).click();
  await page.getByLabel("Lectura de los premios").selectOption("horizontal");
  const wheel = await page.locator(".wheel-face").boundingBox();
  for (const label of await page.locator(".wheel-label").all()) {
    const box = await label.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(wheel.x - 1);
    expect(box.y).toBeGreaterThanOrEqual(wheel.y - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(wheel.x + wheel.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(wheel.y + wheel.height + 1);
  }
  await page.getByRole("tab", { name: /^Gajos/ }).click();
  await page.locator(".slice-details summary").first().click();
  await page.getByLabel("Mensaje al salir").first().fill("¡Premio especial!");
  await expect(page.getByText("Borrador guardado en este dispositivo", { exact: true })).toBeVisible();
  await page.reload();
  await page.locator(".slice-details summary").first().click();
  await expect(page.getByLabel("Mensaje al salir").first()).toHaveValue("¡Premio especial!");
  await page.screenshot({ path: "test-results/long-labels.png", fullPage: true });
});

test("spin button visibility persists and allows keyboard and center spins without instructions", async ({ page }) => {
  await page.setViewportSize({ width: 1080, height: 1920 });
  await seed(page, { juego: { sonido: false, animaciones: false, confeti: false, mostrarHistorial: false } });
  await page.goto(".");
  await page.getByRole("tab", { name: "Apariencia" }).click();
  await expect(page.getByLabel("Mostrar botón Girar")).toBeChecked();
  await page.getByLabel("Mostrar botón Girar").uncheck();
  await expect(page.locator(".scene-preview .play-side > .spin-button")).toHaveCount(0);
  await expect(page.getByText("Borrador guardado en este dispositivo", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Apariencia" }).click();
  await expect(page.getByLabel("Mostrar botón Girar")).not.toBeChecked();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByText(/Pulsa Espacio para girar/)).toHaveCount(0);
  await expect(page.locator(".play-side > .spin-button")).toHaveCount(0);
  await page.locator(".wheel-face").click({ position: { x: 100, y: 200 } });
  await page.keyboard.press("Space");
  await expect(page.locator(".winner-text-result")).toBeVisible();
  await expect(page.getByRole("button", { name: "Volver a girar", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator(".winner-text-result")).toHaveCount(0);
  await page.getByRole("button", { name: "Girar ruleta", exact: true }).click();
  await expect(page.locator(".winner-text-result")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.screenshot({ path: "test-results/portrait-without-spin-button.png", fullPage: true });
  await page.getByRole("button", { name: "Volver al editor", exact: true }).click();
  await page.getByRole("tab", { name: "Apariencia" }).click();
  await page.getByLabel("Mostrar botón Girar").check();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Girar", exact: true })).toBeVisible();
  await expect(page.getByText(/Pulsa Espacio para girar/)).toHaveCount(0);
});

test("history visibility persists without losing draws or trapping an exhausted session", async ({ page }) => {
  await seed(page, { gajos: [100, 0, 0, 0].map((probabilidad, i) => ({ texto: `Premio ${i + 1}`, probabilidad, color: "#14b8a6" })) });
  await page.goto(".");
  await page.getByRole("tab", { name: "Apariencia" }).click();
  await page.getByLabel("Mostrar historial de tiradas").uncheck();
  await expect(page.getByText("Borrador guardado en este dispositivo", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Apariencia" }).click();
  await expect(page.getByLabel("Mostrar historial de tiradas")).not.toBeChecked();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.locator(".result-history")).toHaveCount(0);
  await page.getByRole("button", { name: "Girar", exact: true }).click();
  await expect(page.locator(".winner-text-result")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Sorteo finalizado" })).toBeDisabled();
  await expect(page.locator(".result-history")).toHaveCount(0);
  await page.getByRole("button", { name: "Volver al editor", exact: true }).click();
  await page.getByRole("tab", { name: "Apariencia" }).click();
  await page.getByLabel("Mostrar historial de tiradas").check();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.locator(".result-history summary")).toContainText("1");
  await page.getByRole("button", { name: "Volver al editor", exact: true }).click();
  await page.getByRole("tab", { name: "Apariencia" }).click();
  await page.getByLabel("Mostrar historial de tiradas").uncheck();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await page.getByRole("button", { name: "Reiniciar sesión", exact: true }).click();
  await expect(page.getByRole("button", { name: "Girar", exact: true })).toBeEnabled();
  await expect(page.locator(".result-history")).toHaveCount(0);
});

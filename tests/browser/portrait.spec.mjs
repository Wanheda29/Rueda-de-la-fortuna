import { test, expect } from "@playwright/test";

test("portrait composition follows the background at different resolutions and after rotation", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("ruleta-borrador-v1", JSON.stringify({ version: 1, wheel: {
      nombre: "Ruleta vertical", mostrarTitulo: false, mostrarUltimoResultado: false,
      centro: { texto: "Gira" },
      gajos: Array.from({ length: 12 }, (_, i) => ({ texto: ["VERDE", "AMARILLO", "NARANJA", "VIOLETA", "CELESTE", "FUCSIA"][i % 6], color: ["#8bc34a", "#ffd54f", "#f58242", "#802d88", "#32a9d2", "#e91e63"][i % 6], probabilidad: 1 })),
      juego: { sonido: false, animaciones: false, confeti: false, mostrarHistorial: false, ocultarControles: true },
      fondoJuego: { color: "#55b5c6" },
    } }));
  });
  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.goto(".");
  await page.getByRole("button", { name: "Jugar", exact: true }).click();

  for (const [width, height] of [[1080, 1920], [720, 1280], [1440, 2560], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width, height });
    const wheel = page.locator(".play-wheel .wheel-wrap");
    const spin = page.getByRole("button", { name: "Girar", exact: true });
    const diameter = Math.min(width * .72, height * .405);
    await expect.poll(async () => (await wheel.boundingBox()).width).toBeCloseTo(diameter, 0);
    const bounds = await wheel.boundingBox();
    const button = await spin.boundingBox();
    expect(bounds.x + bounds.width / 2).toBeCloseTo(width / 2, 0);
    expect(bounds.y + bounds.height / 2).toBeCloseTo(height * .475, 0);
    expect(button.x + button.width / 2).toBeCloseTo(width / 2, 0);
    expect(button.y).toBeCloseTo(bounds.y + bounds.height + height * .04, 0);
    const controls = await page.locator(".presentation-controls").boundingBox();
    expect(controls.y + controls.height).toBeLessThan(bounds.y - 14);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.screenshot({ path: `test-results/portrait-${width}x${height}.png`, fullPage: true });
  }

  await expect(page.getByRole("button", { name: "Mostrar controles", exact: true })).toBeVisible({ timeout: 5000 });
  const hiddenControls = await page.locator(".show-controls").boundingBox();
  expect(hiddenControls.y).toBeCloseTo(844 * .195, 0);

  await page.setViewportSize({ width: 1920, height: 1080 });
  const landscapeWheel = await page.locator(".play-wheel .wheel-wrap").boundingBox();
  const landscapeButton = await page.getByRole("button", { name: "Girar", exact: true }).boundingBox();
  expect(landscapeButton.x).toBeGreaterThan(landscapeWheel.x + landscapeWheel.width);
  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.getByRole("button", { name: "Girar", exact: true }).click();
  await expect(page.locator(".winner-card")).toBeVisible();
  const wheel = await page.locator(".play-wheel .wheel-wrap").boundingBox();
  const result = await page.locator(".winner-card").boundingBox();
  expect(result.y).toBeGreaterThan(wheel.y + wheel.height);
  await page.screenshot({ path: "test-results/portrait-result.png", fullPage: true });
});

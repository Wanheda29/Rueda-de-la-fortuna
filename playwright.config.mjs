import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  use: { channel: process.env.CI ? undefined : "chrome", baseURL: "http://127.0.0.1:5174/Rueda-de-la-fortuna/", screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: { command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5174 --strictPort", url: "http://127.0.0.1:5174/Rueda-de-la-fortuna/", reuseExistingServer: !process.env.CI },
});

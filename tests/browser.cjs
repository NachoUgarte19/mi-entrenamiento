const { chromium, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const base = process.env.TEST_URL || "http://localhost:3000";
(async () => {
  await fs.mkdir("test-results", { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    await expect(
      page.getByRole("heading", { name: "Hoy entrenás vos" }),
    ).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() =>
      Boolean(navigator.serviceWorker.controller),
    );
    await page.screenshot({
      path: "test-results/home-mobile.png",
      fullPage: true,
    });
    const nav = (label) =>
      page
        .locator(".mobile-nav")
        .getByRole("button", { name: label, exact: true })
        .click();
    await nav("Rutinas");
    await page.getByRole("button", { name: "Ejercicios", exact: true }).click();
    await page
      .getByRole("button", { name: "Crear ejercicio", exact: true })
      .click();
    await page.getByLabel("Nombre", { exact: true }).fill("Remo de prueba");
    await page.getByLabel("Grupo o enfoque").fill("Tirón");
    await page
      .getByRole("button", { name: "Guardar ejercicio", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Remo de prueba" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Rutinas", exact: true })
      .filter({ hasNot: page.locator("svg") })
      .click();
    await page
      .getByRole("button", { name: "Crear rutina", exact: true })
      .click();
    await page.getByLabel("Nombre de la rutina").fill("Prueba de guardado");
    await page
      .getByLabel("Agregar desde tu biblioteca")
      .selectOption({ label: "Remo de prueba" });
    await page
      .getByRole("button", { name: "Agregar ejercicio", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Guardar rutina", exact: true })
      .click();
    const card = page
      .locator(".routine-card")
      .filter({
        has: page.getByRole("heading", {
          name: "Prueba de guardado",
          exact: true,
        }),
      });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Agendar" }).click();
    const today = await page.locator("input[type=date]").inputValue();
    await page.getByRole("button", { name: "Guardar en calendario" }).click();
    await expect(
      page
        .locator(".day-agenda")
        .getByRole("heading", { name: "Prueba de guardado" }),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/calendar-mobile.png",
      fullPage: true,
    });
    await page
      .locator(".day-agenda")
      .getByRole("button", { name: "Cambiar fecha" })
      .click();
    const future = new Date(today + "T12:00:00");
    future.setDate(future.getDate() + 1);
    const date = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, "0")}-${String(future.getDate()).padStart(2, "0")}`;
    await page.getByLabel("Fecha", { exact: true }).fill(date);
    await page.getByRole("button", { name: "Guardar en calendario" }).click();
    await page
      .getByRole("button", { name: "Empezar sesión", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Prueba de guardado", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Completar serie 1", exact: true })
      .click();
    await expect(page.locator(".session-view .error")).toContainText(
      "Cargá el resultado",
    );
    await page
      .getByRole("spinbutton", { name: "Serie 1, Reps", exact: true })
      .fill("10");
    await page
      .getByRole("button", { name: "Completar serie 1", exact: true })
      .click();
    await page.locator(".effort summary").first().click();
    await page
      .getByRole("spinbutton", { name: "Serie 1, RIR", exact: true })
      .fill("2");
    await page
      .getByRole("spinbutton", { name: "Serie 1, RPE", exact: true })
      .fill("8");
    await expect(page.locator(".save-state")).toHaveText(
      "Guardado en el dispositivo",
    );
    await page.screenshot({
      path: "test-results/session-mobile.png",
      fullPage: true,
    });
    await context.setOffline(true);
    await page.reload();
    await expect(
      page.getByRole("button", {
        name: "Continuar entrenamiento",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Continuar entrenamiento", exact: true })
      .click();
    await expect(
      page.getByRole("spinbutton", { name: "Serie 1, Reps", exact: true }),
    ).toHaveValue("10");
    await expect(
      page.getByRole("button", { name: "Desmarcar serie 1", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page
      .getByRole("spinbutton", { name: "Serie 2, Reps", exact: true })
      .fill("9");
    await page
      .getByRole("button", { name: "Completar serie 2", exact: true })
      .click();
    await expect(page.locator(".save-state")).toHaveText(
      "Guardado en el dispositivo",
    );
    await context.setOffline(false);
    await nav("Rutinas");
    const editCard = page
      .locator(".routine-card")
      .filter({
        has: page.getByRole("heading", {
          name: "Prueba de guardado",
          exact: true,
        }),
      });
    await editCard.getByRole("button", { name: "Editar", exact: true }).click();
    await page.getByLabel("Nombre de la rutina").fill("Rutina renombrada");
    await page
      .getByRole("button", { name: "Guardar rutina", exact: true })
      .click();
    await nav("Entrenar");
    await page
      .getByRole("button", { name: "Continuar entrenamiento", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Prueba de guardado", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Terminar por hoy", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Finalizar y guardar", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Tu progreso" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Prueba de guardado", exact: true }),
    ).toBeVisible();
    await page.reload();
    await nav("Progreso");
    await page.getByRole("button", { name: "Ver sesión", exact: true }).click();
    await expect(
      page.getByRole("spinbutton", { name: "Serie 2, Reps", exact: true }),
    ).toHaveValue("9");
    await page.getByRole("button", { name: "Cuenta y ajustes" }).click();
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Exportar respaldo", exact: true })
      .click();
    const downloaded = await download;
    const file = await downloaded.path();
    const backup = JSON.parse(await fs.readFile(file, "utf8"));
    if (
      !backup.records.some(
        (r) => r.kind === "session" && r.data.status === "completed",
      )
    )
      throw Error("Backup omitted completed session");
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const tab of ["Rutinas", "Calendario", "Progreso"]) {
        const region = width >= 1050 ? ".desktop-sidebar" : ".mobile-nav";
        await page
          .locator(region)
          .getByRole("button", { name: tab, exact: true })
          .click();
        if (
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          )
        )
          throw Error("Horizontal overflow: " + width + " " + tab);
      }
    }
    await page
      .locator(".desktop-sidebar")
      .getByRole("button", { name: "Calendario", exact: true })
      .click();
    await page.screenshot({
      path: "test-results/calendar-desktop.png",
      fullPage: true,
    });
    if (errors.length) throw Error(errors.join("\n"));
    console.log(
      "PASS: exercises and routines, planning/replanning, input validation, RIR/RPE, offline reload+save, session snapshots, completion+history reload, JSON backup, service worker, layouts 320/390/1280, no runtime errors.",
    );
    await context.close();
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

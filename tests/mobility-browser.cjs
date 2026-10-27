const { chromium, expect } = require("@playwright/test");
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: "block",
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const email = "password-test@example.test",
      password = "  simulated-password-42  ";
    let attempts = 1;
    const remote = new Map();
    const today = new Date();
    const date = new Date(today);
    date.setDate(date.getDate() - 1);
    const localDate = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const exercise = {
      id: "test-pull",
      name: "Dominada de prueba",
      group: "Tirón",
      unit: "reps",
      load: "added",
      notes: "",
    };
    const item = {
      id: "test-item",
      exerciseId: exercise.id,
      block: "Principal",
      sets: 2,
      target: "8-10",
      rest: 90,
      optional: false,
      notes: "",
      circuit: "",
    };
    const routine = {
      id: "test-routine",
      name: "Rutina de prueba",
      category: "pull",
      items: [item],
      notes: "",
    };
    const session = {
      id: "test-history",
      planId: null,
      routineId: routine.id,
      title: routine.name,
      category: "pull",
      date: localDate(date),
      startedAt: date.toISOString(),
      finishedAt: date.toISOString(),
      status: "completed",
      notes: "",
      items: [
        {
          ...item,
          exercise,
          skipped: false,
          sets: [
            { id: "s1", value: 10, weight: 5, rir: 2, rpe: 8, done: true },
            { id: "s2", value: 8, weight: 5, rir: 3, rpe: 7, done: true },
          ],
        },
      ],
    };
    for (const [kind, data] of [
      ["exercise", exercise],
      ["routine", routine],
      ["session", session],
    ])
      remote.set(data.id, {
        kind,
        id: data.id,
        data,
        revision: 1,
        deleted: false,
      });
    await page.route("https://*.supabase.co/**", async (route) => {
      const request = route.request(),
        url = request.url(),
        data = request.postDataJSON();
      if (url.includes("/auth/v1/token?grant_type=password")) {
        attempts++;
        if (data.email !== email) throw Error("Unexpected email");
        if (attempts === 1)
          return route.fulfill({
            status: 400,
            json: {
              code: "invalid_credentials",
              error_code: "invalid_credentials",
              msg: "Invalid login credentials",
            },
          });
        if (data.password !== password) throw Error("Password was modified");
        const id = "01234567-89ab-4def-8123-456789abcdef",
          exp = Math.floor(Date.now() / 1000) + 3600;
        const jwt =
          Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
            "base64url",
          ) +
          "." +
          Buffer.from(
            JSON.stringify({ sub: id, exp, role: "authenticated" }),
          ).toString("base64url") +
          ".signature";
        return route.fulfill({
          json: {
            access_token: jwt,
            refresh_token: "fake-test-refresh",
            expires_in: 3600,
            token_type: "bearer",
            user: {
              id,
              email,
              aud: "authenticated",
              role: "authenticated",
              app_metadata: {},
              user_metadata: {},
              created_at: new Date().toISOString(),
            },
          },
        });
      }
      if (url.includes("/rest/v1/training_records"))
        return route.fulfill({ json: [...remote.values()] });
      if (url.includes("/rest/v1/rpc/apply_training_record")) {
        const record = {
          id: data.record_id,
          kind: data.record_kind,
          data: data.record_data,
          revision: data.expected_revision + 1,
          deleted: data.is_deleted,
        };
        remote.set(record.id, record);
        return route.fulfill({ json: { ok: true, record } });
      }
      throw Error(
        "Unexpected request (email/redirect flows must not be used): " + url,
      );
    });

    await page.goto(process.env.TEST_URL || "http://localhost:3004");
    await page.getByLabel("Tu correo", { exact: true }).fill(email);
    await page.locator("input[name=password]").fill(password);
    await page
      .getByRole("button", { name: "Iniciar sesión", exact: true })
      .click();
    const nav = async (name) =>
      page
        .locator(".mobile-nav")
        .getByRole("button", { name, exact: true })
        .click();
    await nav("Rutinas");
    await expect(
      page.getByRole("button", {
        name: "Agregar rutina de movilidad",
        exact: true,
      }),
    ).toBeVisible();
    await context.setOffline(true);
    await page
      .getByRole("button", { name: "Agregar rutina de movilidad", exact: true })
      .click();
    const card = page.locator(".routine-card").filter({
      has: page.getByRole("heading", {
        name: "Movilidad y compresiones · 15 min",
        exact: true,
      }),
    });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText("11 ejercicios");
    await expect(
      page.getByRole("button", {
        name: "Agregar rutina de movilidad",
        exact: true,
      }),
    ).toHaveCount(0);
    await card.getByRole("button", { name: "Editar", exact: true }).click();
    await expect(page.locator(".editor-item")).toHaveCount(11);
    await expect(
      page.getByRole("textbox", { name: "Notas generales", exact: true }),
    ).toHaveValue(/20–30 segundos/);
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        throw Error("Page overflow " + width);
      if (
        await page
          .getByRole("dialog")
          .evaluate((el) => el.scrollWidth > el.clientWidth)
      )
        throw Error("Dialog overflow " + width);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    await card.getByRole("button", { name: "Agendar", exact: true }).click();
    await page
      .getByRole("button", { name: "Guardar en calendario", exact: true })
      .click();
    await expect(page.locator(".day-agenda")).toContainText(
      "Movilidad y compresiones · 15 min",
    );
    await context.setOffline(false);
    await page.reload();
    await nav("Rutinas");
    await expect(card).toHaveCount(1);
    await card
      .getByRole("button", { name: "Entrenar ahora", exact: true })
      .click();
    await expect(page.locator(".session-view h1")).toHaveText(
      "Movilidad y compresiones · 15 min",
    );
    await expect(page.locator(".session-view")).toContainText(
      "0 de 16 series completadas",
    );
    await page.locator(".exercise-picker select").selectOption("0");
    await expect(
      page.getByRole("spinbutton", { name: "Serie 1, Segundos", exact: true }),
    ).toBeVisible();
    await page.locator(".exercise-picker select").selectOption("5");
    await expect(page.locator(".exercise-panel h2")).toHaveText(
      "Pike compression lifts",
    );
    await expect(page.locator(".exercise-panel")).toContainText(
      "3 series · 8–12 reps",
    );
    await expect(
      page.getByLabel("Descanso (segundos)", { exact: true }),
    ).toHaveValue("30");
    await expect(
      page.getByRole("spinbutton", { name: "Serie 1, Reps", exact: true }),
    ).toBeVisible();
    await page.locator(".exercise-picker select").selectOption("6");
    await expect(page.locator(".exercise-panel")).toContainText(
      "3 series · 10–15 seg",
    );
    await expect(
      page.getByRole("spinbutton", { name: "Serie 1, Segundos", exact: true }),
    ).toBeVisible();
    await page.locator(".exercise-picker select").selectOption("10");
    await expect(page.locator(".exercise-panel h2")).toHaveText(
      "Extensión de hombros · flexibilidad",
    );
    await expect(page.locator(".exercise-panel")).toContainText(
      "1 series · 60 seg",
    );
    if (errors.length) throw Error(errors.join("\n"));
    console.log(
      "PASS: add mobility offline to existing account, no duplicates, edit all 11 exercises, mobile layouts, calendar, reload and train with correct units, sets and rest. Supabase mocked.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

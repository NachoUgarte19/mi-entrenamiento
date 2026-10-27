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

    remote.clear();
    const skill = {
      id: "skill",
      name: "L-sit",
      group: "Core",
      unit: "seconds",
      load: "none",
      notes: "",
    };
    const extra = Array.from({ length: 70 }, (_, i) => ({
      ...exercise,
      id: "extra-" + i,
      name: "Ejercicio de prueba " + String(i).padStart(2, "0"),
      group: "General",
    }));
    for (const ex of [exercise, skill, ...extra])
      remote.set(ex.id, {
        id: ex.id,
        kind: "exercise",
        data: ex,
        revision: 1,
        deleted: false,
      });
    const makeHistory = (id, days, progression, value) => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      return {
        ...session,
        id,
        date: localDate(d),
        startedAt: d.toISOString(),
        finishedAt: d.toISOString(),
        routineId: null,
        title: "Práctica anterior",
        items: [
          {
            ...session.items[0],
            exercise: skill,
            progression,
            sets: [
              {
                id: "set-" + id,
                value,
                weight: null,
                rir: null,
                rpe: null,
                done: true,
              },
            ],
          },
        ],
      };
    };
    for (const entry of [
      makeHistory("tuck-1", 4, "Tuck", 10),
      makeHistory("leg", 3, "Una pierna", 5),
      makeHistory("tuck-2", 2, "Tuck", 15),
    ]) {
      remote.set(entry.id, {
        id: entry.id,
        kind: "session",
        data: entry,
        revision: 1,
        deleted: false,
      });
    }
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
    const pick = async (label, query, name) => {
      await page
        .getByRole("combobox", { name: label, exact: true })
        .fill(query);
      await page.getByRole("option", { name, exact: false }).click();
    };
    const widths = async () => {
      for (const width of [320, 390, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        const dialog = page.getByRole("dialog").last();
        if (await dialog.count())
          expect(
            await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
          ).toBe(true);
      }
      await page.setViewportSize({ width: 390, height: 844 });
    };
    await nav("Rutinas");
    await page
      .getByRole("button", { name: "Crear rutina", exact: true })
      .click();
    await page
      .getByLabel("Nombre de la rutina", { exact: true })
      .fill("Mis progresiones");
    const add = page.getByRole("combobox", {
      name: "Agregar ejercicio",
      exact: true,
    });
    await add.fill("tiron");
    await expect(
      page.getByRole("option", { name: "Dominada de prueba", exact: false }),
    ).toBeVisible();
    await add.fill("l sit");
    await widths();
    await require("node:fs/promises").mkdir("test-results", {
      recursive: true,
    });
    await page.screenshot({
      path: "test-results/search-suggestions-mobile.png",
    });
    await page.getByRole("option", { name: "L-sit", exact: false }).click();
    await expect(page.locator(".editor-item")).toHaveCount(1);
    await add.fill("No existe todavía");
    await add.press("Enter");
    await expect(
      page.getByRole("dialog", { name: "Crear rutina", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await add.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Crear rutina", exact: true }),
    ).toBeVisible();
    await add.fill("Plancha de prueba");
    await page
      .getByRole("button", { name: "Crear “Plancha de prueba”", exact: true })
      .click();
    const create = page.getByRole("dialog", {
      name: "Nuevo ejercicio",
      exact: true,
    });
    await expect(create.getByLabel("Nombre", { exact: true })).toHaveValue(
      "Plancha de prueba",
    );
    await widths();
    await page.keyboard.press("Escape");
    await expect(create).toHaveCount(0);
    await expect(
      page.getByLabel("Nombre de la rutina", { exact: true }),
    ).toHaveValue("Mis progresiones");
    await add.fill("Plancha de prueba");
    await page
      .getByRole("button", { name: "Crear “Plancha de prueba”", exact: true })
      .click();
    await create
      .getByRole("combobox", { name: "Qué registrar", exact: true })
      .selectOption("seconds");
    await create
      .getByRole("button", { name: "Guardar ejercicio", exact: true })
      .click();
    await expect(page.locator(".editor-item")).toHaveCount(2);
    await page
      .getByRole("button", { name: "Guardar rutina", exact: true })
      .click();
    const card = page.locator(".routine-card").filter({
      has: page.getByRole("heading", {
        name: "Mis progresiones",
        exact: true,
      }),
    });
    await expect(card).toHaveCount(1);
    await context.setOffline(true);
    await card
      .getByRole("button", { name: "Entrenar ahora", exact: true })
      .click();
    await page
      .getByLabel("Variante / progresión de hoy", { exact: true })
      .fill("Tuck");
    await expect(page.locator(".previous")).toContainText("15");
    await expect(page.locator(".previous")).not.toContainText("5 /");
    await page.getByLabel("Descanso automático", { exact: true }).uncheck();
    await page
      .getByRole("button", { name: "Completar serie 1", exact: true })
      .click();
    await expect(
      page.locator(".session-view").getByRole("alert"),
    ).toContainText("repeticiones o el tiempo");
    for (const [n, value] of [
      [1, 20],
      [2, 18],
      [3, 17],
    ]) {
      await page
        .getByRole("spinbutton", {
          name: "Serie " + n + ", Segundos",
          exact: true,
        })
        .fill(String(value));
      await page
        .getByRole("button", { name: "Completar serie " + n, exact: true })
        .click();
    }
    await widths();
    await page.screenshot({
      path: "test-results/progression-session-mobile.png",
    });
    await page
      .getByRole("button", { name: "Agregar ejercicio", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Buscar ejercicio", exact: true })
      .fill("Dominada");
    await page
      .getByRole("combobox", { name: "Buscar ejercicio", exact: true })
      .press("ArrowDown");
    await page
      .getByRole("combobox", { name: "Buscar ejercicio", exact: true })
      .press("Enter");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".exercise-panel h2")).toHaveText(
      "Dominada de prueba",
    );
    await page
      .getByRole("button", { name: "Terminar por hoy", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Finalizar y guardar", exact: true })
      .click();
    await pick("Consultar un ejercicio", "l-sit", "L-sit");
    await expect(
      page.getByRole("combobox", {
        name: "Variante / progresión a comparar",
        exact: true,
      }),
    ).toHaveValue("Tuck");
    await expect(
      page.getByText("Máximo: 20 segundos", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".exercise-chart circle")).toHaveCount(3);
    await expect(page.locator(".progress-change")).toContainText("15 segundos");
    await pick("Variante / progresión a comparar", "una pierna", "Una pierna");
    await expect(
      page.getByText("Máximo: 5 segundos", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".exercise-chart circle")).toHaveCount(1);
    await widths();
    await page.screenshot({
      path: "test-results/progression-chart-mobile.png",
    });
    await context.setOffline(false);
    await page.reload();
    await nav("Progreso");
    await pick("Consultar un ejercicio", "l-sit", "L-sit");
    await expect(
      page.getByText("Máximo: 20 segundos", { exact: true }),
    ).toBeVisible();
    await nav("Calendario");
    await page
      .getByRole("button", {
        name: "Cargar entrenamiento realizado",
        exact: true,
      })
      .click();
    await pick("Agregar ejercicio", "l-sit", "L-sit");
    await page
      .getByLabel("Variante / progresión de hoy", { exact: true })
      .fill("Una pierna");
    await page
      .getByRole("spinbutton", {
        name: "L-sit, serie 1, Segundos",
        exact: true,
      })
      .fill("8");
    await page
      .getByRole("button", {
        name: "Guardar entrenamiento realizado",
        exact: true,
      })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await nav("Progreso");
    await pick("Consultar un ejercicio", "l-sit", "L-sit");
    await pick("Variante / progresión a comparar", "una pierna", "Una pierna");
    await expect(
      page.getByText("Máximo: 8 segundos", { exact: true }),
    ).toBeVisible();

    await context.setOffline(true);
    await page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const r = indexedDB.open("mi-entrenamiento-v1");
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      await new Promise((resolve, reject) => {
        const transaction = db.transaction("records", "readwrite");
        transaction.objectStore("records").clear();
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
      db.close();
      window.dispatchEvent(new Event("training-data-changed"));
    });
    await nav("Rutinas");
    await page
      .getByRole("button", { name: "Crear rutina", exact: true })
      .click();
    await page
      .getByLabel("Nombre de la rutina", { exact: true })
      .fill("Desde cero");
    await page
      .getByRole("combobox", { name: "Agregar ejercicio", exact: true })
      .fill("Mi primer ejercicio");
    await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Crear “Mi primer ejercicio”", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Guardar ejercicio", exact: true })
      .click();
    await expect(page.locator(".editor-item")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Guardar rutina", exact: true })
      .click();
    await expect(
      page.locator(".routine-card").filter({ hasText: "Desde cero" }),
    ).toHaveCount(1);
    if (errors.length) throw Error(errors.join("\n"));
    console.log(
      "PASS: searchable suggestions, keyboard, no premature submit, nested exercise creation, offline variant recording, prior results, separate progression charts, reload, calendar recording, responsive layouts.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

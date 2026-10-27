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

    const plan = {
      id: "past-plan",
      date: localDate(date),
      routineId: routine.id,
      title: routine.name,
      category: routine.category,
    };
    const active = {
      ...session,
      id: "existing-active",
      date: localDate(today),
      startedAt: today.toISOString(),
      finishedAt: null,
      status: "active",
      items: [],
    };
    for (const [kind, data] of [
      ["plan", plan],
      ["session", active],
    ])
      remote.set(data.id, {
        kind,
        id: data.id,
        data,
        revision: 1,
        deleted: false,
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
    const stored = () =>
      page.evaluate(async () => {
        const db = await new Promise((resolve, reject) => {
          const req = indexedDB.open("mi-entrenamiento-v1");
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        try {
          return await new Promise((resolve, reject) => {
            const req = db
              .transaction("records")
              .objectStore("records")
              .getAll();
            req.onsuccess = () => resolve(req.result.filter((r) => !r.deleted));
            req.onerror = () => reject(req.error);
          });
        } finally {
          db.close();
        }
      });
    await nav("Calendario");
    if (localDate(date).slice(0, 7) !== localDate(today).slice(0, 7))
      await page
        .getByRole("button", { name: "Mes anterior", exact: true })
        .click();
    const dayLabel = date.toLocaleDateString("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    await page
      .locator(".calendar-grid button")
      .filter({ hasText: String(date.getDate()) })
      .filter({ visible: true })
      .evaluateAll(
        (els, label) =>
          els
            .find((el) => el.getAttribute("aria-label").startsWith(label + ","))
            .click(),
        dayLabel,
      );
    await page
      .getByRole("button", {
        name: "Cargar entrenamiento realizado",
        exact: true,
      })
      .click();
    await expect(page.getByLabel("Fecha", { exact: true })).toHaveValue(
      localDate(date),
    );
    await expect(
      page.getByRole("combobox", {
        name: "Tipo de entrenamiento",
        exact: true,
      }),
    ).toHaveValue("free");
    await page
      .getByRole("button", {
        name: "Guardar entrenamiento realizado",
        exact: true,
      })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "al menos un ejercicio",
    );
    await page
      .getByLabel("Nombre del entrenamiento", { exact: true })
      .fill("En casa ayer");
    await page
      .getByRole("combobox", { name: "Agregar ejercicio", exact: true })
      .fill("Dominada de prueba");
    await page
      .getByRole("option", { name: "Dominada de prueba", exact: false })
      .click();
    await page
      .getByRole("button", { name: "Agregar serie", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Quitar serie 2 de Dominada de prueba",
        exact: true,
      })
      .click();
    await page
      .getByRole("spinbutton", {
        name: "Dominada de prueba, serie 1, Repeticiones",
        exact: true,
      })
      .fill("8");
    await page
      .getByRole("spinbutton", {
        name: "Dominada de prueba, serie 1, Lastre (kg)",
        exact: true,
      })
      .fill("0");
    await page
      .getByRole("combobox", { name: "Agregar ejercicio", exact: true })
      .fill("Plancha en casa");
    await page
      .getByRole("button", { name: "Crear “Plancha en casa”", exact: true })
      .click();
    const newExercise = page.getByRole("dialog", {
      name: "Nuevo ejercicio",
      exact: true,
    });
    await newExercise
      .getByLabel("Nombre", { exact: true })
      .fill("Plancha en casa");
    await newExercise
      .getByRole("combobox", { name: "Qué registrar", exact: true })
      .selectOption("seconds");
    await newExercise
      .getByRole("button", { name: "Guardar ejercicio", exact: true })
      .click();
    await page
      .getByRole("spinbutton", {
        name: "Plancha en casa, serie 1, Segundos",
        exact: true,
      })
      .fill("30");
    await page
      .getByLabel("Notas", { exact: true })
      .fill("Cargado después de la clase");
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
    await require("node:fs/promises").mkdir("test-results", {
      recursive: true,
    });
    const closeToast = page.getByRole("button", {
      name: "Cerrar aviso",
      exact: true,
    });
    if (await closeToast.count()) await closeToast.click();
    await page.getByRole("dialog").evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.screenshot({ path: "test-results/recorded-session-mobile.png" });
    await context.setOffline(true);
    await page
      .getByRole("button", {
        name: "Guardar entrenamiento realizado",
        exact: true,
      })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".day-agenda")).toContainText("En casa ayer");
    let rows = await stored();
    const saved = rows.find(
      (r) => r.kind === "session" && r.data.title === "En casa ayer",
    );
    expect(saved.data.date).toBe(localDate(date));
    expect(saved.data.status).toBe("completed");
    expect(saved.data.items).toHaveLength(2);
    expect(saved.data.items[0].sets[0]).toMatchObject({
      value: 8,
      weight: 0,
      done: true,
    });
    expect(saved.data.items[1].sets[0]).toMatchObject({
      value: 30,
      done: true,
    });
    expect(rows.find((r) => r.id === active.id).data).toEqual(active);
    expect(saved.dirty).toBe(true);
    // Cancel does not create a session.
    await page
      .getByRole("button", {
        name: "Cargar entrenamiento realizado",
        exact: true,
      })
      .click();
    await page
      .getByRole("combobox", { name: "Tipo de entrenamiento", exact: true })
      .selectOption("class");
    await expect(
      page.getByLabel("Nombre del entrenamiento", { exact: true }),
    ).toHaveValue("Clase de calistenia");
    await page
      .getByLabel("Nombre del entrenamiento", { exact: true })
      .fill("Cancelado");
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    expect((await stored()).some((r) => r.data.title === "Cancelado")).toBe(
      false,
    );
    // Complete a past planned routine without resuming the active workout.
    await page
      .getByRole("button", { name: "Cargar lo realizado", exact: true })
      .click();
    await expect(
      page.getByRole("combobox", {
        name: "Tipo de entrenamiento",
        exact: true,
      }),
    ).toHaveValue(routine.id);
    await page
      .getByRole("button", {
        name: "Quitar serie 2 de Dominada de prueba",
        exact: true,
      })
      .click();
    await page
      .getByRole("spinbutton", {
        name: "Dominada de prueba, serie 1, Repeticiones",
        exact: true,
      })
      .fill("12");
    await page
      .getByRole("spinbutton", {
        name: "Dominada de prueba, serie 1, Lastre (kg)",
        exact: true,
      })
      .fill("5");
    await page
      .getByRole("button", {
        name: "Guardar entrenamiento realizado",
        exact: true,
      })
      .click();
    await expect(page.locator(".plan-card")).toContainText("Completado");
    rows = await stored();
    expect(
      rows.filter((r) => r.kind === "session" && r.data.planId === plan.id),
    ).toHaveLength(1);
    await context.setOffline(false);
    await page.reload();
    await nav("Calendario");
    if (localDate(date).slice(0, 7) !== localDate(today).slice(0, 7))
      await page
        .getByRole("button", { name: "Mes anterior", exact: true })
        .click();
    await page
      .locator(".calendar-grid button")
      .evaluateAll(
        (els, label) =>
          els
            .find((el) => el.getAttribute("aria-label").startsWith(label + ","))
            .click(),
        dayLabel,
      );
    await expect(page.locator(".day-agenda")).toContainText("En casa ayer");
    await expect(page.locator(".plan-card")).toContainText("Completado");
    await page
      .getByRole("button", { name: "En casa ayer", exact: false })
      .click();
    await expect(page.locator(".session-view h1")).toHaveText("En casa ayer");
    await expect(page.locator(".session-view")).toContainText(
      "2 de 2 series completadas",
    );
    await nav("Progreso");
    await page
      .getByRole("combobox", { name: "Consultar un ejercicio", exact: true })
      .fill("Dominada de prueba");
    await page
      .getByRole("option", { name: "Dominada de prueba", exact: false })
      .click();
    await expect(
      page.getByText("Máximo: 12 repeticiones", { exact: true }),
    ).toBeVisible();
    if (errors.length) throw Error(errors.join("\n"));
    console.log(
      "PASS: retrospective free/routine entries, date, new exercises, set removal, zero load, cancellation, active session preserved, offline save, reload, calendar, history, progress and mobile layout. Supabase mocked.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

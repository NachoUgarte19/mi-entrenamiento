"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Cloud,
  CloudOff,
  Copy,
  Download,
  Dumbbell,
  Layers2,
  LogOut,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  TrendingUp,
  Upload,
  WifiOff,
  X,
} from "lucide-react";
import {
  backupParse,
  createSession,
  labels,
  localDate,
  prettyDate,
  uid,
  type Category,
  type Exercise,
  type Kind,
  type LocalRecord,
  type Payload,
  type Plan,
  type Routine,
  type TrainingSession,
} from "@/lib/model";
import {
  cloudConfigured,
  importRecords,
  LOCAL_OWNER,
  prepare,
  records,
  resolveConflict,
  save,
  supabase,
  synchronize,
  watchStore,
} from "@/lib/store";
import { Button } from "./ui/button";
import { Modal } from "./ui/modal";
import { ExerciseEditor, RoutineEditor } from "./editors";
import { SessionView } from "./session";
import { PasswordAccess } from "./password-access";

type Tab = "train" | "routines" | "calendar" | "progress";
type PlanDraft = { id?: string; date: string; routineId: string };
function Badge({ category }: { category: Category }) {
  return <span className={"badge " + category}>{labels[category]}</span>;
}
function Header({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
      </div>
      {children}
    </div>
  );
}
function message(e: unknown) {
  return e instanceof Error
    ? e.message
    : typeof e === "object" && e && "message" in e
      ? String(e.message)
      : "No se pudo completar la operación.";
}

export default function TrainingApp() {
  const [tab, setTab] = useState<Tab>("train"),
    [owner, setOwner] = useState(LOCAL_OWNER),
    [user, setUser] = useState<User | null>(null),
    [data, setData] = useState<LocalRecord[]>([]),
    [ready, setReady] = useState(false),
    [fatal, setFatal] = useState(""),
    [online, setOnline] = useState(true),
    [syncing, setSyncing] = useState(false),
    [syncError, setSyncError] = useState(""),
    [toast, setToast] = useState(""),
    [settings, setSettings] = useState(false),
    [activeView, setActiveView] = useState<string | null>(null);
  const [routineEdit, setRoutineEdit] = useState<Routine | null | undefined>(),
    [exerciseEdit, setExerciseEdit] = useState<Exercise | null | undefined>(),
    [library, setLibrary] = useState(false),
    [search, setSearch] = useState(""),
    [planEdit, setPlanEdit] = useState<PlanDraft | null>(null),
    [selectedDate, setSelectedDate] = useState(localDate()),
    [month, setMonth] = useState(localDate().slice(0, 7)),
    [deleting, setDeleting] = useState<{
      kind: Kind;
      data: Payload;
      name: string;
    } | null>(null);
  const [restore, setRestore] = useState<ReturnType<typeof backupParse> | null>(
      null,
    ),
    [actionBusy, setActionBusy] = useState(false),
    [updateReady, setUpdateReady] = useState<ServiceWorker | null>(null),
    [metricExercise, setMetricExercise] = useState("");
  const ownerRef = useRef(owner),
    starting = useRef(false);
  ownerRef.current = owner;
  const visible = data.filter((r) => !r.deleted);
  const exercises = visible
    .filter((r) => r.kind === "exercise")
    .map((r) => r.data as Exercise)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  const routines = visible
    .filter((r) => r.kind === "routine")
    .map((r) => r.data as Routine);
  const plans = visible
    .filter((r) => r.kind === "plan")
    .map((r) => r.data as Plan);
  const sessions = visible
    .filter((r) => r.kind === "session")
    .map((r) => r.data as TrainingSession);
  const active = sessions
    .filter((s) => s.status === "active")
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const completed = sessions
    .filter((s) => s.status === "completed")
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const view = sessions.find((s) => s.id === activeView),
    conflicts = data.filter((r) => r.conflict),
    pending = data.filter((r) => r.dirty).length;
  const pendingKey = data
    .filter((r) => r.dirty && !r.conflict)
    .map((r) => r.mutation)
    .join(",");
  const syncNow = useCallback(async () => {
    if (owner === LOCAL_OWNER || !navigator.onLine) return;
    setSyncing(true);
    try {
      await synchronize(owner);
      setSyncError("");
    } catch (e) {
      setSyncError(message(e));
    } finally {
      setSyncing(false);
    }
  }, [owner]);
  useEffect(() => {
    const api = supabase();
    if (!api) return;
    const { data: subscription } = api.auth.onAuthStateChange(
      (_event, session) => {
        const nextOwner = session?.user.id ?? LOCAL_OWNER;
        setUser(session?.user ?? null);
        if (ownerRef.current !== nextOwner) {
          setOwner(nextOwner);
          setActiveView(null);
        }
      },
    );
    return () => subscription.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    let alive = true;
    setReady(false);
    setData([]);
    setFatal("");
    const refresh = async () => {
      try {
        const next = await records(owner);
        if (alive) setData(next);
      } catch (e) {
        if (alive) setFatal(message(e));
      }
    };
    const unwatch = watchStore(() => {
      void refresh();
    });
    void prepare(owner)
      .then(refresh)
      .then(() => {
        if (alive) setReady(true);
      })
      .catch((e) => {
        if (alive) setFatal(message(e));
      });
    return () => {
      alive = false;
      unwatch();
    };
  }, [owner]);
  useEffect(() => {
    const connection = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void syncNow();
    };
    setOnline(navigator.onLine);
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    const focus = () => {
      if (document.visibilityState === "visible") void syncNow();
    };
    document.addEventListener("visibilitychange", focus);
    const interval = setInterval(() => void syncNow(), 30000);
    return () => {
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
      document.removeEventListener("visibilitychange", focus);
      clearInterval(interval);
    };
  }, [syncNow]);
  useEffect(() => {
    if (!ready || !pendingKey) return;
    const timer = setTimeout(() => void syncNow(), 1800);
    return () => clearTimeout(timer);
  }, [ready, pendingKey, syncNow]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    )
      return;
    void navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        if (reg.waiting) setUpdateReady(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          worker?.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            )
              setUpdateReady(worker);
          });
        });
      })
      .catch(() => setToast("No se pudo preparar el modo sin conexión."));
  }, []);
  const persist = async (kind: Kind, payload: Payload, deleted = false) => {
    await save(owner, kind, payload, deleted);
  };
  const run = async (fn: () => Promise<void>) => {
    setActionBusy(true);
    try {
      await fn();
    } catch (e) {
      setToast(message(e));
    } finally {
      setActionBusy(false);
    }
  };
  async function start(routine: Routine | null, plan: Plan | null = null) {
    if (starting.current) return;
    if (active.length) {
      setTab("train");
      setActiveView(active[0].id);
      setToast(
        "Retomamos tu sesión pendiente. Finalizala antes de empezar otra.",
      );
      return;
    }
    starting.current = true;
    try {
      const session = createSession(routine, exercises, plan);
      await persist("session", session);
      const next = await records(owner);
      setData(next);
      setTab("train");
      setActiveView(session.id);
    } catch (e) {
      setToast(message(e));
    } finally {
      starting.current = false;
    }
  }
  function planRoutine(r: Routine) {
    setPlanEdit({ date: selectedDate, routineId: r.id });
  }
  function changeMonth(offset: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + offset, 1);
    setMonth(localDate(d).slice(0, 7));
    setSelectedDate(localDate(d));
  }
  async function deleteRecord() {
    if (!deleting) return;
    const { kind, data: payload } = deleting;
    if (
      kind === "exercise" &&
      routines.some((r) => r.items.some((i) => i.exerciseId === payload.id))
    )
      throw Error(
        "Este ejercicio está en una rutina. Quitalo de esas rutinas antes de eliminarlo.",
      );
    if (kind === "routine" && plans.some((p) => p.routineId === payload.id))
      throw Error(
        "Esta rutina está asignada en el calendario. Quitá esas asignaciones antes de eliminarla.",
      );
    await persist(kind, payload, true);
    setDeleting(null);
    setToast("Eliminado. Los entrenamientos anteriores conservan sus datos.");
  }
  function exportBackup() {
    const json = JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        records: visible.map(({ kind, data }) => ({ kind, data })),
      },
      null,
      2,
    );
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `entrenamiento-${localDate()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const status =
    owner === LOCAL_OWNER
      ? "Guardado en este dispositivo"
      : !online
        ? "Sin conexión"
        : conflicts.length
          ? "Cambios por revisar"
          : syncError
            ? "Sincronización pendiente"
            : syncing
              ? "Sincronizando…"
              : pending
                ? `${pending} cambios pendientes`
                : "Sincronizado";
  const dayPlans = plans.filter((p) => p.date === selectedDate);
  const today = localDate(),
    todayPlans = plans.filter(
      (p) =>
        p.date === today &&
        !sessions.some((s) => s.planId === p.id && s.status === "completed"),
    );
  const monthStart = new Date(
      Number(month.slice(0, 4)),
      Number(month.slice(5)) - 1,
      1,
    ),
    daysInMonth = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth() + 1,
      0,
    ).getDate(),
    offset = (monthStart.getDay() + 6) % 7;
  const shownExercises = exercises.filter((e) =>
    (e.name + " " + e.group)
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  function planCard(p: Plan) {
    const routine = routines.find((r) => r.id === p.routineId),
      finished = completed.find((s) => s.planId === p.id),
      inProgress = active.find((s) => s.planId === p.id);
    return (
      <article key={p.id} className="panel plan-card">
        <div className="section-heading">
          <Badge category={routine?.category ?? p.category} />
          <span className="muted text-small">
            {finished ? "Completado" : inProgress ? "En curso" : "Planificado"}
          </span>
        </div>
        <h2>{routine?.name ?? p.title}</h2>
        <div className="actions">
          <Button
            variant="ghost"
            onClick={() =>
              setPlanEdit({
                id: p.id,
                date: p.date,
                routineId: p.routineId ?? "class",
              })
            }
          >
            Cambiar fecha
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={"Quitar " + p.title + " del calendario"}
            onClick={() =>
              setDeleting({ kind: "plan", data: p, name: p.title })
            }
          >
            <Trash2 size={17} />
          </Button>
        </div>
        {finished ? (
          <Button
            variant="secondary"
            className="full"
            onClick={() => setActiveView(finished.id)}
          >
            Ver entrenamiento
            <ArrowRight size={17} />
          </Button>
        ) : (
          <Button
            className="full"
            disabled={!!p.routineId && !routine}
            onClick={() =>
              inProgress
                ? setActiveView(inProgress.id)
                : void start(routine ?? null, p)
            }
          >
            <Play size={16} />
            {inProgress ? "Continuar" : "Empezar sesión"}
          </Button>
        )}
      </article>
    );
  }
  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">
        <div className="brand">
          <img className="brand-icon" src="/pullup-192.png" alt="" width={32} height={32} />
          Mi entrenamiento
        </div>
        <p className="sidebar-caption">Tu espacio para entrenar.</p>
        <Nav
          tab={tab}
          onChange={(t) => {
            setTab(t);
            setActiveView(null);
          }}
        />
        <button className="account-button" onClick={() => setSettings(true)}>
          <Settings size={19} />
          Cuenta y respaldo
        </button>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="brand">
            <img className="brand-icon" src="/pullup-192.png" alt="" width={32} height={32} />
            <span>Mi entrenamiento</span>
          </div>
          <button
            className="avatar"
            aria-label="Cuenta y ajustes"
            onClick={() => setSettings(true)}
          >
            {user?.email?.[0]?.toUpperCase() ?? "N"}
          </button>
        </header>
        <div className="connection">
          <button onClick={() => setSettings(true)}>
            {owner === LOCAL_OWNER ? (
              <CloudOff size={14} />
            ) : !online ? (
              <WifiOff size={14} />
            ) : (
              <Cloud size={14} />
            )}{" "}
            {status}
          </button>
          {updateReady && (
            <button
              onClick={() => {
                if (active.length) {
                  setToast("Finalizá tu sesión antes de actualizar.");
                  return;
                }
                navigator.serviceWorker.addEventListener(
                  "controllerchange",
                  () => location.reload(),
                  { once: true },
                );
                updateReady.postMessage({ type: "SKIP_WAITING" });
              }}
            >
              Actualizar app
            </button>
          )}
        </div>
        {fatal ? (
          <main>
            <div className="empty">
              <h1>No pudimos abrir tus datos</h1>
              <p className="error">{fatal}</p>
              <Button onClick={() => location.reload()}>Reintentar</Button>
            </div>
          </main>
        ) : !ready ? (
          <main className="loading" aria-busy="true">
            <img className="brand-icon" src="/pullup-192.png" alt="" width={32} height={32} />
            <p>Preparando tus rutinas…</p>
          </main>
        ) : (
          <main key={owner}>
            {view ? (
              <SessionView
                key={view.id}
                initial={view}
                exercises={exercises}
                history={sessions}
                onSave={(s) => persist("session", s)}
                onBack={() => setActiveView(null)}
                onFinish={() => {
                  setActiveView(null);
                  setTab("progress");
                  setToast("Entrenamiento guardado.");
                }}
              />
            ) : (
              <>
                {tab === "train" && (
                  <>
                    <Header
                      eyebrow={prettyDate(today)}
                      title={
                        active.length
                          ? "Seguimos donde quedaste"
                          : "Hoy entrenás vos"
                      }
                    />
                    <Week
                      selected={today}
                      plans={plans}
                      onSelect={(date) => {
                        setSelectedDate(date);
                        setMonth(date.slice(0, 7));
                        setTab("calendar");
                      }}
                    />
                    {active.length > 0 ? (
                      <section className="panel featured">
                        <Badge category={active[0].category} />
                        <h2>{active[0].title}</h2>
                        <p className="muted">
                          {
                            active[0].items
                              .flatMap((i) => i.sets)
                              .filter((s) => s.done).length
                          }{" "}
                          series registradas · {prettyDate(active[0].date)}
                        </p>
                        <Button
                          className="full"
                          onClick={() => setActiveView(active[0].id)}
                        >
                          Continuar entrenamiento
                          <ArrowRight size={18} />
                        </Button>
                      </section>
                    ) : todayPlans.length ? (
                      <div className="card-grid">
                        {todayPlans.map(planCard)}
                      </div>
                    ) : (
                      <section className="panel featured">
                        <div className="eyebrow">Tu día, tu ritmo</div>
                        <h2>¿Qué vas a entrenar?</h2>
                        <p className="muted">
                          Elegí una rutina o empezá una clase libre.
                        </p>
                        <Button
                          className="full"
                          onClick={() => {
                            setTab("routines");
                            setLibrary(false);
                          }}
                        >
                          Elegir rutina
                          <ArrowRight size={18} />
                        </Button>
                        <Button
                          variant="ghost"
                          className="full"
                          onClick={() => void start(null)}
                        >
                          Empezar clase de calistenia
                        </Button>
                      </section>
                    )}
                    <div className="section-heading section-space">
                      <h2>Tus rutinas</h2>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setTab("routines");
                          setLibrary(false);
                        }}
                      >
                        Ver todas
                        <ArrowRight size={16} />
                      </Button>
                    </div>
                    <div className="routine-shortcuts">
                      {routines.slice(0, 3).map((r) => (
                        <button
                          key={r.id}
                          className="shortcut"
                          onClick={() => void start(r)}
                        >
                          <Badge category={r.category} />
                          <span>{r.name}</span>
                          <Play size={16} />
                        </button>
                      ))}
                    </div>
                    <div className="section-heading section-space">
                      <h2>Próximos días</h2>
                      <Button
                        variant="ghost"
                        onClick={() => setTab("calendar")}
                      >
                        <CalendarDays size={17} />
                        Calendario
                      </Button>
                    </div>
                    {plans
                      .filter((p) => p.date > today)
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .slice(0, 3)
                      .map((p) => (
                        <button
                          className="agenda-row"
                          key={p.id}
                          onClick={() => {
                            setSelectedDate(p.date);
                            setMonth(p.date.slice(0, 7));
                            setTab("calendar");
                          }}
                        >
                          <div>
                            <small>{prettyDate(p.date)}</small>
                            <strong>
                              {routines.find((r) => r.id === p.routineId)
                                ?.name ?? p.title}
                            </strong>
                          </div>
                          <Badge category={p.category} />
                        </button>
                      ))}
                    {!plans.some((p) => p.date > today) && (
                      <p className="muted">
                        Todavía no asignaste entrenamientos para los próximos
                        días.
                      </p>
                    )}
                  </>
                )}
                {tab === "routines" && (
                  <>
                    <Header
                      eyebrow="Tu biblioteca"
                      title={library ? "Ejercicios" : "Rutinas"}
                    >
                      <Button
                        size="icon"
                        aria-label={
                          library ? "Crear ejercicio" : "Crear rutina"
                        }
                        onClick={() =>
                          library ? setExerciseEdit(null) : setRoutineEdit(null)
                        }
                      >
                        <Plus size={20} />
                      </Button>
                    </Header>
                    <div className="segmented" aria-label="Tipo de biblioteca">
                      <button
                        aria-pressed={!library}
                        onClick={() => setLibrary(false)}
                      >
                        Rutinas
                      </button>
                      <button
                        aria-pressed={library}
                        onClick={() => setLibrary(true)}
                      >
                        Ejercicios
                      </button>
                    </div>
                    {library ? (
                      <>
                        <label className="search-label">
                          Buscar ejercicio
                          <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Nombre o grupo muscular"
                          />
                        </label>
                        <div className="exercise-list">
                          {shownExercises.map((e) => (
                            <article
                              className="exercise-library-row"
                              key={e.id}
                            >
                              <div>
                                <h3>{e.name}</h3>
                                <small>
                                  {e.group} ·{" "}
                                  {
                                    {
                                      reps: "Repeticiones",
                                      seconds: "Segundos",
                                      minutes: "Minutos",
                                      check: "Completar",
                                    }[e.unit]
                                  }
                                </small>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={"Editar " + e.name}
                                onClick={() => setExerciseEdit(e)}
                              >
                                <Pencil size={17} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={"Eliminar " + e.name}
                                onClick={() =>
                                  setDeleting({
                                    kind: "exercise",
                                    data: e,
                                    name: e.name,
                                  })
                                }
                              >
                                <Trash2 size={17} />
                              </Button>
                            </article>
                          ))}
                        </div>
                        {!shownExercises.length && (
                          <div className="empty">
                            <p>No hay ejercicios con ese nombre.</p>
                            <Button onClick={() => setExerciseEdit(null)}>
                              Crear ejercicio
                            </Button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="card-grid">
                        {routines.map((r) => (
                          <article className="panel routine-card" key={r.id}>
                            <div className="section-heading">
                              <Badge category={r.category} />
                              <div className="actions">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={"Duplicar " + r.name}
                                  onClick={() =>
                                    setRoutineEdit({
                                      ...structuredClone(r),
                                      id: uid(),
                                      name: r.name + " · copia",
                                      items: r.items.map((i) => ({
                                        ...i,
                                        id: uid(),
                                      })),
                                    })
                                  }
                                >
                                  <Copy size={16} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={"Eliminar " + r.name}
                                  onClick={() =>
                                    setDeleting({
                                      kind: "routine",
                                      data: r,
                                      name: r.name,
                                    })
                                  }
                                >
                                  <Trash2 size={16} />
                                </Button>
                              </div>
                            </div>
                            <h2>{r.name}</h2>
                            <p className="muted">
                              {r.items.length} ejercicios y bloques
                            </p>
                            <div className="routine-preview">
                              {r.items
                                .filter((i) => i.block === "Trabajo principal")
                                .slice(0, 3)
                                .map((i) => (
                                  <span key={i.id}>
                                    {
                                      exercises.find(
                                        (e) => e.id === i.exerciseId,
                                      )?.name
                                    }
                                  </span>
                                ))}
                            </div>
                            <div className="actions">
                              <Button
                                variant="ghost"
                                onClick={() => setRoutineEdit(r)}
                              >
                                <Pencil size={16} />
                                Editar
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() => planRoutine(r)}
                              >
                                <CalendarPlus size={17} />
                                Agendar
                              </Button>
                            </div>
                            <Button
                              variant="secondary"
                              className="full"
                              onClick={() => void start(r)}
                            >
                              <Play size={16} />
                              Entrenar ahora
                            </Button>
                          </article>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {tab === "calendar" && (
                  <>
                    <Header eyebrow="Organizá tu semana" title="Calendario">
                      <Button
                        size="icon"
                        aria-label="Asignar entrenamiento"
                        onClick={() =>
                          setPlanEdit({
                            date: selectedDate,
                            routineId: routines[0]?.id ?? "class",
                          })
                        }
                      >
                        <Plus size={20} />
                      </Button>
                    </Header>
                    <div className="calendar-layout">
                      <section className="calendar-panel">
                        <div className="month-controls">
                          <Button
                            variant="secondary"
                            size="icon"
                            aria-label="Mes anterior"
                            onClick={() => changeMonth(-1)}
                          >
                            <ChevronLeft size={18} />
                          </Button>
                          <h2>
                            {monthStart.toLocaleDateString("es-AR", {
                              month: "long",
                              year: "numeric",
                            })}
                          </h2>
                          <Button
                            variant="secondary"
                            size="icon"
                            aria-label="Mes siguiente"
                            onClick={() => changeMonth(1)}
                          >
                            <ChevronRight size={18} />
                          </Button>
                        </div>
                        <div className="calendar-grid" aria-label="Elegir día">
                          {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                            <span className="weekday" key={i}>
                              {d}
                            </span>
                          ))}
                          {Array.from({ length: offset }, (_, i) => (
                            <span key={"empty" + i} />
                          ))}
                          {Array.from({ length: daysInMonth }, (_, i) => {
                            const date = `${month}-${String(i + 1).padStart(2, "0")}`,
                              ps = plans.filter((p) => p.date === date),
                              ss = completed.filter((s) => s.date === date);
                            const categories = [
                              ...new Set([
                                ...ps.map((p) => p.category),
                                ...ss.map((s) => s.category),
                              ]),
                            ];
                            return (
                              <button
                                className={date === today ? "today" : ""}
                                key={date}
                                aria-label={`${prettyDate(date)}, ${ps.length} planificados, ${ss.length} realizados`}
                                aria-pressed={date === selectedDate}
                                onClick={() => setSelectedDate(date)}
                              >
                                {i + 1}
                                <span className="calendar-dots">
                                  {categories.map((c) => (
                                    <i key={c} className={c} />
                                  ))}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        <div className="legend">
                          {(["pull", "push", "full", "class"] as const).map(
                            (c) => (
                              <Badge key={c} category={c} />
                            ),
                          )}
                        </div>
                      </section>
                      <section className="day-agenda">
                        <h2>{prettyDate(selectedDate)}</h2>
                        {dayPlans.map(planCard)}
                        {completed
                          .filter(
                            (s) =>
                              s.date === selectedDate &&
                              !dayPlans.some((p) => p.id === s.planId),
                          )
                          .map((s) => (
                            <button
                              className="agenda-row"
                              key={s.id}
                              onClick={() => setActiveView(s.id)}
                            >
                              <div>
                                <small>Realizado</small>
                                <strong>{s.title}</strong>
                              </div>
                              <Check size={19} />
                            </button>
                          ))}
                        {!dayPlans.length &&
                          !completed.some((s) => s.date === selectedDate) && (
                            <div className="empty compact">
                              <CalendarDays size={28} />
                              <h3>Un día libre</h3>
                              <p>Asigná una rutina o reservá tu clase.</p>
                            </div>
                          )}
                        <Button
                          variant="secondary"
                          className="full"
                          onClick={() =>
                            setPlanEdit({
                              date: selectedDate,
                              routineId: routines[0]?.id ?? "class",
                            })
                          }
                        >
                          <Plus size={17} />
                          Asignar entrenamiento
                        </Button>
                      </section>
                    </div>
                  </>
                )}
                {tab === "progress" && (
                  <>
                    <Header eyebrow="Cada sesión cuenta" title="Tu progreso" />
                    <div className="stats">
                      <div>
                        <span className="muted">Este mes</span>
                        <strong>
                          {
                            completed.filter((s) =>
                              s.date.startsWith(today.slice(0, 7)),
                            ).length
                          }
                        </strong>
                        <small>entrenamientos</small>
                      </div>
                      <div>
                        <span className="muted">Historial</span>
                        <strong>{completed.length}</strong>
                        <small>sesiones guardadas</small>
                      </div>
                      <div>
                        <span className="muted">Series</span>
                        <strong>
                          {
                            completed
                              .flatMap((s) => s.items)
                              .flatMap((i) => i.sets)
                              .filter((s) => s.done).length
                          }
                        </strong>
                        <small>completadas</small>
                      </div>
                    </div>
                    <label className="search-label">
                      Consultar un ejercicio
                      <select
                        value={metricExercise}
                        onChange={(e) => setMetricExercise(e.target.value)}
                      >
                        <option value="">Todos los entrenamientos</option>
                        {Array.from(
                          new Map(
                            completed
                              .flatMap((s) => s.items)
                              .map((i) => [i.exercise.id, i.exercise.name]),
                          ).entries(),
                        ).map(([id, name]) => (
                          <option key={id} value={id}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="section-heading section-space">
                      <h2>
                        {metricExercise
                          ? "Registro por ejercicio"
                          : "Historial"}
                      </h2>
                    </div>
                    {completed
                      .filter(
                        (s) =>
                          !metricExercise ||
                          s.items.some((i) => i.exercise.id === metricExercise),
                      )
                      .map((s) => (
                        <article className="panel history-card" key={s.id}>
                          <div className="section-heading">
                            <Badge category={s.category} />
                            <small>{prettyDate(s.date)}</small>
                          </div>
                          <h3>{s.title}</h3>
                          {metricExercise &&
                            s.items
                              .filter((i) => i.exercise.id === metricExercise)
                              .map((i) => (
                                <p className="history-values" key={i.id}>
                                  {i.sets
                                    .filter((set) => set.done)
                                    .map(
                                      (set) =>
                                        `${set.value ?? "✓"}${i.exercise.unit === "seconds" ? " seg" : i.exercise.unit === "minutes" ? " min" : i.exercise.unit === "check" ? "" : " reps"}${set.weight !== null ? ` · ${set.weight} kg` : ""}`,
                                    )
                                    .join(" / ") || "Sin series completadas"}
                                </p>
                              ))}
                          <Button
                            variant="ghost"
                            onClick={() => setActiveView(s.id)}
                          >
                            Ver sesión
                            <ArrowRight size={16} />
                          </Button>
                        </article>
                      ))}
                    {!completed.length && (
                      <div className="empty">
                        <TrendingUp size={32} />
                        <h2>Acá empieza tu historia</h2>
                        <p>
                          Al finalizar tu primer entrenamiento, vas a poder
                          consultarlo y comparar tus registros.
                        </p>
                        <Button onClick={() => setTab("train")}>
                          Ir a entrenar
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </main>
        )}
        <div className="mobile-nav">
          <Nav
            tab={tab}
            onChange={(t) => {
              setTab(t);
              setActiveView(null);
            }}
          />
        </div>
      </div>
      {toast && (
        <div role="status" className="toast">
          <span>{toast}</span>
          <button aria-label="Cerrar aviso" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {routineEdit !== undefined && (
        <RoutineEditor
          initial={routineEdit ?? undefined}
          exercises={exercises}
          onSave={(r) => persist("routine", r)}
          onClose={() => setRoutineEdit(undefined)}
        />
      )}
      {exerciseEdit !== undefined && (
        <ExerciseEditor
          initial={exerciseEdit ?? undefined}
          onSave={(e) => persist("exercise", e)}
          onClose={() => setExerciseEdit(undefined)}
        />
      )}
      {planEdit && (
        <Modal
          title={planEdit.id ? "Editar planificación" : "Asignar entrenamiento"}
          onClose={() => setPlanEdit(null)}
        >
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const routine = routines.find(
                  (r) => r.id === planEdit.routineId,
                );
                if (!routine && planEdit.routineId !== "class")
                  throw Error("Seleccioná una rutina disponible.");
                const plan: Plan = {
                  id: planEdit.id ?? uid(),
                  date: planEdit.date,
                  routineId: routine?.id ?? null,
                  title: routine?.name ?? "Clase de calistenia",
                  category: routine?.category ?? "class",
                };
                await persist("plan", plan);
                setSelectedDate(plan.date);
                setMonth(plan.date.slice(0, 7));
                setPlanEdit(null);
                setTab("calendar");
                setActiveView(null);
                setToast("Entrenamiento asignado.");
              });
            }}
          >
            <label>
              Rutina o clase
              <select
                value={planEdit.routineId}
                onChange={(e) =>
                  setPlanEdit({ ...planEdit, routineId: e.target.value })
                }
              >
                {routines.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
                <option value="class">
                  Clase de calistenia · sesión libre
                </option>
              </select>
            </label>
            <label>
              Fecha
              <input
                type="date"
                required
                value={planEdit.date}
                onChange={(e) =>
                  setPlanEdit({ ...planEdit, date: e.target.value })
                }
              />
            </label>
            <p className="muted">Podés moverlo cuando cambien tus planes.</p>
            <Button type="submit" disabled={actionBusy}>
              Guardar en calendario
            </Button>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal
          title={"¿Eliminar " + deleting.name + "?"}
          description="Los entrenamientos realizados conservan sus ejercicios y resultados."
          onClose={() => setDeleting(null)}
        >
          <div className="actions form-grid">
            <Button
              variant="destructive"
              disabled={actionBusy}
              onClick={() => void run(deleteRecord)}
            >
              Eliminar
            </Button>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
          </div>
        </Modal>
      )}
      {settings && (
        <Modal title="Cuenta y respaldo" onClose={() => setSettings(false)}>
          <div className="form-grid">
            <div className="notice">
              <strong>{status}</strong>
              <p>
                {owner === LOCAL_OWNER
                  ? "Los datos están guardados en este navegador. Exportá un respaldo para conservar una copia."
                  : "Tus datos pertenecen a esta cuenta y se sincronizan cuando hay conexión."}
              </p>
            </div>
            {!cloudConfigured() ? (
              <div className="settings-block">
                <h3>Sincronización entre dispositivos</h3>
                <p className="muted">
                  Todavía no está conectada. La app funciona en este
                  dispositivo; falta configurar tu proyecto de Supabase.
                </p>
              </div>
            ) : user ? (
              <>
                <p className="account-email">{user.email}</p>
                <Button
                  variant="secondary"
                  disabled={syncing || !online}
                  onClick={() => void syncNow()}
                >
                  <RefreshCw size={16} />
                  {syncing ? "Sincronizando…" : "Sincronizar ahora"}
                </Button>
                {syncError && (
                  <p className="error" role="alert">
                    No pudimos sincronizar: {syncError}
                  </p>
                )}
                <Button
                  variant="secondary"
                  onClick={() =>
                    void run(async () => {
                      const local = (await records(LOCAL_OWNER)).filter(
                        (r) => !r.deleted,
                      );
                      setRestore(
                        local.map((r) => ({ kind: r.kind, data: r.data })),
                      );
                      setSettings(false);
                    })
                  }
                >
                  Importar datos guardados sin cuenta
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    void run(async () => {
                      if (pending)
                        throw Error(
                          "Sincronizá los cambios pendientes antes de cerrar sesión.",
                        );
                      const { error } = await supabase()!.auth.signOut();
                      if (error) throw error;
                    })
                  }
                >
                  <LogOut size={17} />
                  Cerrar sesión
                </Button>
              </>
            ) : (
              <PasswordAccess
                online={online}
                onSuccess={() =>
                  setToast("Cuenta conectada en este dispositivo.")
                }
              />
            )}
            {conflicts.map((r) => (
              <div key={r.id} className="conflict">
                <h3>Dos versiones de un registro</h3>
                <p>
                  {"name" in r.data
                    ? r.data.name
                    : "title" in r.data
                      ? r.data.title
                      : r.kind}
                </p>
                <p className="muted">
                  Este registro cambió en otro dispositivo. Descargá el respaldo
                  antes de elegir si querés conservar ambas versiones.
                </p>
                <details>
                  <summary>Comparar versiones</summary>
                  <h4>Este dispositivo</h4>
                  <pre>{JSON.stringify(r.data, null, 2)}</pre>
                  <h4>En la nube</h4>
                  <pre>{JSON.stringify(r.conflict?.data, null, 2)}</pre>
                </details>
                <div className="form-grid">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void run(() => resolveConflict(owner, r.id, "local"))
                    }
                  >
                    Usar este dispositivo
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void run(() => resolveConflict(owner, r.id, "cloud"))
                    }
                  >
                    Usar la nube
                  </Button>
                </div>
              </div>
            ))}
            <div className="settings-block">
              <h3>Respaldo de tus datos</h3>
              <Button
                variant="secondary"
                className="full"
                onClick={exportBackup}
              >
                <Download size={17} />
                Exportar respaldo
              </Button>
              <label className="file-label">
                <Upload size={17} />
                Restaurar respaldo JSON
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file)
                      void run(async () => {
                        if (file.size > 20 * 1024 * 1024)
                          throw Error(
                            "El archivo es demasiado grande (máximo 20 MB).",
                          );
                        setRestore(backupParse(JSON.parse(await file.text())));
                        setSettings(false);
                      });
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <div className="settings-block">
              <h3>
                <CircleHelp size={17} /> Instalar en iPhone
              </h3>
              <p className="muted">
                Abrí la dirección de la app en Safari. Tocá Compartir y luego
                “Agregar a pantalla de inicio”. Necesitás abrirla con conexión
                una vez para preparar el uso sin conexión.
              </p>
            </div>
          </div>
        </Modal>
      )}
      {restore && (
        <Modal
          title="Restaurar datos"
          description={`${restore.length} registros. Se agregarán los nuevos y se reemplazarán los que tengan el mismo identificador. Los demás se conservan.`}
          onClose={() => setRestore(null)}
        >
          <div className="form-grid">
            <Button variant="secondary" onClick={exportBackup}>
              Descargar respaldo actual primero
            </Button>
            <Button
              disabled={actionBusy}
              onClick={() =>
                void run(async () => {
                  await importRecords(owner, restore);
                  setRestore(null);
                  setToast("Respaldo restaurado.");
                })
              }
            >
              Restaurar {restore.length} registros
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Nav({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav aria-label="Navegación principal">
      {(
        [
          { id: "train", label: "Entrenar", icon: Play },
          { id: "routines", label: "Rutinas", icon: BookOpen },
          { id: "calendar", label: "Calendario", icon: CalendarDays },
          { id: "progress", label: "Progreso", icon: TrendingUp },
        ] as const
      ).map((t) => (
        <button
          key={t.id}
          aria-current={tab === t.id ? "page" : undefined}
          onClick={() => onChange(t.id)}
        >
          <t.icon size={21} />
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
function Week({
  selected,
  plans,
  onSelect,
}: {
  selected: string;
  plans: Plan[];
  onSelect: (date: string) => void;
}) {
  const base = new Date(selected + "T12:00:00");
  base.setDate(base.getDate() - ((base.getDay() + 6) % 7));
  return (
    <div className="week-strip">
      {Array.from({ length: 7 }, (_, i) => {
        const d = new Date(base);
        d.setDate(d.getDate() + i);
        const date = localDate(d);
        return (
          <button
            key={date}
            aria-label={prettyDate(date)}
            aria-pressed={date === selected}
            onClick={() => onSelect(date)}
          >
            <span>{["L", "M", "M", "J", "V", "S", "D"][i]}</span>
            <strong>{d.getDate()}</strong>
            <i
              className={plans.some((p) => p.date === date) ? "planned" : ""}
            />
          </button>
        );
      })}
    </div>
  );
}


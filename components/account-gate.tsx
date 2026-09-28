"use client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/store";
import TrainingApp from "./training-app";
import { PasswordAccess } from "./password-access";
import { SetPassword } from "./set-password";

export default function AccountGate() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [setup, setSetup] = useState(false);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const hash = new URLSearchParams(location.hash.slice(1));
    const type = hash.get("type");
    const needsPassword = type === "invite" || type === "recovery";
    if (needsPassword) sessionStorage.setItem("training-password-setup", "1");
    setSetup(needsPassword || sessionStorage.getItem("training-password-setup") === "1");
    if (hash.has("error")) {
      setError("El enlace no es válido o venció. Solicitá una nueva invitación o recuperación.");
      history.replaceState(null, "", location.pathname);
    }
    const connection = () => setOnline(navigator.onLine);
    connection(); window.addEventListener("online", connection); window.addEventListener("offline", connection);
    const api = supabase();
    if (!api) { setError("El acceso todavía no está configurado."); setReady(true); }
    const subscription = api?.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") { setSetup(true); sessionStorage.setItem("training-password-setup", "1"); }
      if (event === "SIGNED_OUT") { setSetup(false); sessionStorage.removeItem("training-password-setup"); }
      setUser(session?.user ?? null); setReady(true);
    });
    return () => { subscription?.data.subscription.unsubscribe(); window.removeEventListener("online", connection); window.removeEventListener("offline", connection); };
  }, []);
  if (ready && user && !setup) return <TrainingApp key={user.id} initialUser={user} />;
  return <main className="access-screen"><section className="access-card">
    <img src="/pullup-192.png" alt="" width={64} height={64} className="access-logo" />
    <h1>Mi entrenamiento</h1>
    <p className="muted">Un espacio personal para tus rutinas y tu progreso. Acceso por invitación.</p>
    {!ready ? <p role="status">Comprobando tu cuenta…</p> : user && setup ? <SetPassword onDone={() => { sessionStorage.removeItem("training-password-setup"); setSetup(false); history.replaceState(null, "", location.pathname); }} /> : <PasswordAccess online={online} onSuccess={() => {}} />}
    {error && <p role="alert" className="error">{error}</p>}
  </section></main>;
}


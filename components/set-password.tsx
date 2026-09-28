"use client";
import { useState } from "react";
import { supabase } from "@/lib/store";
import { Button } from "./ui/button";
export function SetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <form className="form-grid" onSubmit={async e => {
    e.preventDefault();
    if (busy) return;
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    setBusy(true); setError("");
    try {
      const api = supabase();
      if (!api) throw Error();
      const { error } = await api.auth.updateUser({ password });
      if (error) throw error;
      setPassword(""); setConfirm(""); onDone();
    } catch { setError("No pudimos guardar la contraseña. Probá una más larga o solicitá un nuevo enlace si venció."); }
    finally { setBusy(false); }
  }}>
    <h3>Elegí tu contraseña</h3>
    <p className="muted">Usá al menos 12 caracteres. Después podés entrar desde el iPhone con tu correo y esta contraseña.</p>
    <label>Nueva contraseña<input type="password" autoComplete="new-password" minLength={12} required disabled={busy} value={password} onChange={e => setPassword(e.target.value)} /></label>
    <label>Repetir contraseña<input type="password" autoComplete="new-password" minLength={12} required disabled={busy} value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
    <Button disabled={busy || password.length < 12 || !confirm}>{busy ? "Guardando…" : "Guardar contraseña"}</Button>
    {error && <p role="alert" className="error">{error}</p>}
  </form>;
}



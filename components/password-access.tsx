"use client";
import { useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/store";
import { Button } from "./ui/button";

function accessError(error: unknown) {
  const e = error as { code?: string; status?: number };
  if (e.code === "invalid_credentials")
    return "El correo o la contraseña no son correctos. Revisalos e intentá de nuevo.";
  if (e.code === "email_not_confirmed")
    return "Tu correo todavía no está confirmado. Abrí el enlace de tu invitación o contactá a quien te dio acceso.";
  if (e.status === 429)
    return "Demasiados intentos. Esperá unos minutos antes de volver a entrar.";
  return "No pudimos iniciar sesión. Revisá la conexión e intentá nuevamente.";
}
export function PasswordAccess({
  online,
  onSuccess,
}: {
  online: boolean;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  async function login() {
    if (submitting.current || !online) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const api = supabase();
      if (!api) throw Error("Not configured");
      const { error } = await api.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      setPassword("");
      try {
        sessionStorage.removeItem("training-pending-login");
      } catch {
        /* Optional cleanup of the previous code flow. */
      }
      onSuccess();
    } catch (error) {
      setError(accessError(error));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <form
      className="form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        void login();
      }}
    >
      <h3>Entrar a tu cuenta</h3>
      <p className="muted">
        Usá tu correo y contraseña para sincronizar tus entrenamientos en este
        dispositivo.
      </p>
      <label>
        Tu correo
        <input
          name="email"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          disabled={busy}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label>
        Contraseña
        <div className="actions">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            autoCapitalize="none"
            spellCheck={false}
            required
            disabled={busy}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={busy}
            aria-label={
              showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
            }
            aria-pressed={showPassword}
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </Button>
        </div>
      </label>
      <Button
        type="submit"
        disabled={busy || !online || !email.trim() || !password}
      >
        {busy ? "Ingresando…" : "Iniciar sesión"}
      </Button>
      {!online && (
        <p className="muted">
          Necesitás conexión para iniciar sesión. Tus registros locales se
          conservan.
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </form>
  );
}


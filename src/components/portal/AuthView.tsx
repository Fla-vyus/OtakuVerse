"use client";

import { useState } from "react";
import { MoonStar, Loader2, ShieldCheck, Eye, EyeOff, Check, X, CloudCheck } from "lucide-react";
import { usePortal } from "./store";

function Strength({ pass }: { pass: string }) {
  const checks = [
    { ok: pass.length >= 8, label: "8+ caracteres" },
    { ok: /[a-zA-Z]/.test(pass), label: "letras" },
    { ok: /[0-9]/.test(pass), label: "números" },
    { ok: /[^a-zA-Z0-9]/.test(pass), label: "símbolo (opcional)" },
  ];
  const score = checks.filter((c) => c.ok).length;
  const colors = ["bg-red-500", "bg-amber-500", "bg-amber-500", "bg-emerald-500", "bg-emerald-500"];
  return (
    <div className="mt-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${i < score ? colors[score] : "bg-muted"}`} />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]">
        {checks.map((c) => (
          <span key={c.label} className={`flex items-center gap-0.5 ${c.ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
            {c.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AuthView() {
  const user = usePortal((s) => s.user);
  const setUser = usePortal((s) => s.setUser);
  const refreshAuth = usePortal((s) => s.refreshAuth);
  const go = usePortal((s) => s.go);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [id, setId] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
        <span className="bg-brand-gradient flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-black text-white">
          {(user.displayName || user.username)[0].toUpperCase()}
        </span>
        <div>
          <p className="text-lg font-black">Você já está logado!</p>
          <p className="text-sm text-muted-foreground">Conectado como {user.displayName || user.username}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => go("profile")} className="bg-brand-gradient rounded-xl px-5 py-2.5 text-sm font-bold text-white">Ir ao perfil</button>
          <button onClick={() => go("home")} className="rounded-xl border border-border px-5 py-2.5 text-sm font-bold">Início</button>
        </div>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const url = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        mode === "login"
          ? { id, password }
          : { email, username, password, acceptedTerms: accepted, adultConsent: false };
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d.ok) {
        setUser(d.user);
        await refreshAuth();
        go("home");
      } else {
        setError(d.error ?? "Algo deu errado.");
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-4xl gap-6 py-6 md:grid-cols-2">
      {/* lado texto */}
      <div className="flex flex-col justify-center gap-4 rounded-3xl bg-hero-grad p-7 text-white">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
          <MoonStar className="h-7 w-7" />
        </span>
        <h1 className="text-2xl font-black leading-tight sm:text-3xl">
          Sua biblioteca, na sua nuvem.
        </h1>
        <p className="text-sm leading-relaxed text-white/85">
          Crie sua conta para sincronizar favoritos, listas e notas em qualquer dispositivo.
          Tudo salvo com criptografia de senha (scrypt) e sessão segura.
        </p>
        <ul className="flex flex-col gap-2 text-sm text-white/90">
          <li className="flex items-center gap-2"><CloudCheck className="h-4 w-4" /> Nuvem pessoal: coleção sempre sincronizada</li>
          <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Senha nunca armazenada em texto puro</li>
          <li className="flex items-center gap-2">⚙️ Configurações avançadas no perfil (inclui Modo +18 opcional)</li>
        </ul>
        <p className="text-[11px] text-white/60">
          Ao criar conta você concorda com os <button onClick={() => go("legal")} className="underline">Termos</button> e a{" "}
          <button onClick={() => { usePortal.setState({ legalTab: "privacidade" }); go("legal"); }} className="underline">Política de Privacidade</button>.
        </p>
      </div>

      {/* lado form */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <div className="mb-5 flex rounded-xl bg-secondary p-1">
          <button
            onClick={() => { setMode("login"); setError(null); }}
            className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${mode === "login" ? "bg-card shadow text-primary" : "text-muted-foreground"}`}
          >
            Entrar
          </button>
          <button
            onClick={() => { setMode("register"); setError(null); }}
            className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${mode === "register" ? "bg-card shadow text-primary" : "text-muted-foreground"}`}
          >
            Criar conta
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3.5">
          {mode === "login" ? (
            <label className="text-xs font-bold text-muted-foreground">
              Usuário ou e-mail
              <input
                value={id}
                onChange={(e) => setId(e.target.value)}
                required
                autoComplete="username"
                className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="otaku123 ou voce@email.com"
              />
            </label>
          ) : (
            <>
              <label className="text-xs font-bold text-muted-foreground">
                E-mail
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="voce@email.com"
                />
              </label>
              <label className="text-xs font-bold text-muted-foreground">
                Nome de usuário
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  required
                  className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="letras minúsculas, números, . _ -"
                />
              </label>
            </>
          )}

          <label className="text-xs font-bold text-muted-foreground">
            Senha
            <div className="relative mt-1">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="h-11 w-full rounded-xl border border-input bg-background px-3 pr-10 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="mínimo 8 caracteres com letras e números"
              />
              <button type="button" onClick={() => setShowPass((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label="Mostrar senha">
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {mode === "register" && <Strength pass={password} />}
          </label>

          {mode === "register" && (
            <label className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />
              <span>
                Li e aceito os <button type="button" onClick={() => go("legal")} className="font-bold text-primary underline">Termos de Uso</button>, a{" "}
                <button type="button" onClick={() => { usePortal.setState({ legalTab: "privacidade" }); go("legal"); }} className="font-bold text-primary underline">Política de Privacidade</button> e as{" "}
                <button type="button" onClick={() => { usePortal.setState({ legalTab: "regras" }); go("legal"); }} className="font-bold text-primary underline">Regras da comunidade</button>.
              </span>
            </label>
          )}

          {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading || (mode === "register" && !accepted)}
            className="bg-brand-gradient flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-black text-white shadow-lg transition hover:brightness-110 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === "login" ? "Entrar" : "Criar minha conta"}
          </button>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import {
  User, CloudCheck, CloudUpload, CloudDownload, Palette, ShieldAlert, ShieldOff,
  Loader2, Save, Lock, LogOut, FileDown, FileUp, Trash2, Eye, EyeOff, KeyRound, Laptop,
} from "lucide-react";
import { usePortal, THEMES, LIB_STATUS_LABEL } from "./store";

interface SessionInfo { id: string; createdAt: string; expiresAt: string; ua?: string | null }

function Section({ icon, title, sub, children }: { icon: React.ReactNode; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="bg-brand-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white">{icon}</span>
        <div>
          <h2 className="text-sm font-black">{title}</h2>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function ProfileView() {
  const user = usePortal((s) => s.user);
  const authChecked = usePortal((s) => s.authChecked);
  const refreshAuth = usePortal((s) => s.refreshAuth);
  const theme = usePortal((s) => s.theme);
  const setTheme = usePortal((s) => s.setTheme);
  const hypeMode = usePortal((s) => s.hypeMode);
  const setHypeMode = usePortal((s) => s.setHypeMode);
  const library = usePortal((s) => s.library);
  const syncState = usePortal((s) => s.syncState);
  const lastSync = usePortal((s) => s.lastSync);
  const syncCloud = usePortal((s) => s.syncCloud);
  const go = usePortal((s) => s.go);
  const setLibrary = usePortal((s) => s.setLibrary);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarColor, setAvatarColor] = useState("#2563eb");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loaded, setLoaded] = useState(false);

  // estado do modo +18 (portão escondido)
  const [adultMode, setAdultMode] = useState(false);
  const [adultRevealed, setAdultRevealed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAge, setConfirmAge] = useState(false);
  const [confirmTerms, setConfirmTerms] = useState(false);

  const [importData, setImportData] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName ?? user.username);
    setBio(user.bio ?? "");
    setAvatarColor(user.avatarColor ?? "#2563eb");
    setAdultMode(user.adultMode);
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setSessions(d.sessions ?? []);
          if (d.user.adultMode) setAdultRevealed(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [user?.id]);

  if (!authChecked) {
    return <div className="py-20 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!user) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
        <User className="h-10 w-10 text-muted-foreground" />
        <p className="text-lg font-black">Entre para acessar seu perfil</p>
        <p className="text-sm text-muted-foreground">Perfil, nuvem pessoal, biblioteca e configurações ficam na sua conta.</p>
        <button onClick={() => go("auth")} className="bg-brand-gradient rounded-xl px-6 py-2.5 text-sm font-bold text-white">Entrar / Criar conta</button>
      </div>
    );
  }

  const save = async (extra: Record<string, unknown> = {}) => {
    setSaving(true);
    setSavedMsg(null);
    try {
      const settings = { theme, hypeMode };
      const r = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, bio, avatarColor, settings, ...extra }),
      });
      const d = await r.json();
      if (d.ok) {
        // atualiza user no store
        usePortal.getState().setUser({ ...usePortal.getState().user!, ...d.user, settings: JSON.stringify(settings) });
        setSavedMsg("Salvo na nuvem ✓");
        setTimeout(() => setSavedMsg(null), 2500);
      } else {
        setSavedMsg(d.error ?? "Erro ao salvar");
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleAdult = async (on: boolean) => {
    await save({
      adultMode: on,
      adultConsent: on ? new Date().toISOString() : undefined,
    });
    setAdultMode(on);
    if (on) setAdultRevealed(true);
    // re-puxa biblioteca/nada muda — só sinaliza
  };

  const doImport = async () => {
    if (!importData) return;
    try {
      const r = await fetch("/api/cloud/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: importData,
      });
      const d = await r.json();
      if (d.ok) {
        await refreshAuth();
        await syncCloud("pull");
        setImportData(null);
        if (fileRef.current) fileRef.current.value = "";
        setSavedMsg(`Backup importado: ${d.imported} itens ✓`);
        setTimeout(() => setSavedMsg(null), 3000);
      } else {
        setSavedMsg(d.error ?? "Backup inválido");
      }
    } catch {
      setSavedMsg("Erro ao importar");
    }
  };

  const initial = (displayName || user.username)[0].toUpperCase();
  const libCount = Object.keys(library).length;
  const counts = Object.values(library).reduce((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-col gap-5">
      {/* cabeçalho do perfil */}
      <section className="relative overflow-hidden rounded-3xl bg-hero-grad p-6 text-white sm:p-8">
        <div className="relative z-10 flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-black shadow-xl" style={{ background: avatarColor }}>
            {initial}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black">{displayName || user.username}</h1>
            <p className="truncate text-sm text-white/75">{user.email}</p>
            <p className="mt-0.5 text-[11px] text-white/60">
              @{user.username} · conta desde {new Date(user.createdAt ?? Date.now()).toLocaleDateString("pt-BR")}
            </p>
          </div>
          {adultMode && (
            <span className="ml-auto flex items-center gap-1.5 rounded-xl bg-red-600/80 px-3 py-1.5 text-[11px] font-black uppercase backdrop-blur">
              <ShieldAlert className="h-3.5 w-3.5" /> Modo +18 ativo
            </span>
          )}
        </div>
        <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      </section>

      {/* grid de seções */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* PERFIL EDITÁVEL */}
        <Section icon={<User className="h-4 w-4" />} title="Identidade" sub="Como você aparece para a comunidade">
          <div className="flex flex-col gap-3">
            <label className="text-xs font-bold text-muted-foreground">
              Nome de exibição
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground" />
            </label>
            <label className="text-xs font-bold text-muted-foreground">
              Bio
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={400} rows={2} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-semibold text-foreground" placeholder="fã de ecchi com bom gosto pra arte e história..." />
            </label>
            <div>
              <p className="text-xs font-bold text-muted-foreground">Cor do avatar</p>
              <div className="mt-1.5 flex gap-2">
                {["#2563eb", "#0891b2", "#7c3aed", "#db2777", "#059669", "#d97706", "#dc2626", "#4f46e5"].map((c) => (
                  <button
                    key={c}
                    onClick={() => setAvatarColor(c)}
                    className={`h-8 w-8 rounded-lg border-2 transition ${avatarColor === c ? "scale-110 border-foreground" : "border-transparent"}`}
                    style={{ background: c }}
                    aria-label={`Cor ${c}`}
                  />
                ))}
              </div>
            </div>
            <button onClick={() => save()} disabled={saving} className="bg-brand-gradient flex h-10 w-fit items-center gap-2 rounded-xl px-5 text-sm font-bold text-white disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar perfil
            </button>
          </div>
        </Section>

        {/* NUVEM */}
        <Section icon={<CloudCheck className="h-4 w-4" />} title="Nuvem OtakuVerse" sub="Sua coleção salva e sincronizada em todos os dispositivos">
          <div className="mb-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-secondary px-2 py-3">
              <p className="text-xl font-black">{libCount}</p>
              <p className="text-[10px] font-bold text-muted-foreground">itens na nuvem</p>
            </div>
            <div className="rounded-xl bg-secondary px-2 py-3">
              <p className={`text-xl font-black ${syncState === "error" ? "text-destructive" : syncState === "ok" ? "text-emerald-500" : ""}`}>
                {syncState === "syncing" ? "..." : syncState === "error" ? "✕" : "✓"}
              </p>
              <p className="text-[10px] font-bold text-muted-foreground">
                {syncState === "error" ? "falha no sync" : syncState === "ok" ? "sincronizado" : "sincronizando"}
              </p>
            </div>
            <div className="rounded-xl bg-secondary px-2 py-3">
              <p className="text-xl font-black">{lastSync ? new Date(lastSync).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}</p>
              <p className="text-[10px] font-bold text-muted-foreground">último sync</p>
            </div>
          </div>
          {Object.keys(counts).length > 0 && (
            <p className="mb-3 flex flex-wrap gap-1.5 text-[11px]">
              {Object.entries(counts).map(([st, n]) => (
                <span key={st} className="rounded-md bg-primary/10 px-2 py-0.5 font-bold text-primary">{LIB_STATUS_LABEL[st as keyof typeof LIB_STATUS_LABEL] ?? st}: {n}</span>
              ))}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => syncCloud("push")} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold transition hover:bg-accent">
              <CloudUpload className="h-4 w-4 text-primary" /> Enviar locais
            </button>
            <button onClick={() => syncCloud("pull")} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold transition hover:bg-accent">
              <CloudDownload className="h-4 w-4 text-primary" /> Puxar da nuvem
            </button>
            <a href="/api/cloud/export" className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold transition hover:bg-accent">
              <FileDown className="h-4 w-4 text-primary" /> Baixar backup .json
            </a>
          </div>
          <div className="mt-3 rounded-xl border border-dashed border-border p-3">
            <p className="mb-2 text-xs font-bold text-muted-foreground">Restaurar backup</p>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => setImportData(String(reader.result));
                reader.readAsText(f);
              }}
              className="w-full text-xs"
            />
            {importData && (
              <button onClick={doImport} className="bg-brand-gradient mt-2 flex h-9 items-center gap-1.5 rounded-xl px-4 text-xs font-bold text-white">
                <FileUp className="h-3.5 w-3.5" /> Importar agora
              </button>
            )}
          </div>
          {savedMsg && <p className="mt-2 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-300">{savedMsg}</p>}
        </Section>

        {/* APARÊNCIA */}
        <Section icon={<Palette className="h-4 w-4" />} title="Aparência" sub="Tema do site e destaque do topo">
          <div className="mb-4">
            <p className="mb-1.5 text-xs font-bold text-muted-foreground">Tema</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setTheme(t.id); save(); }}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition ${theme === t.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"}`}
                >
                  <span className="h-4 w-4 rounded-full border border-black/10" style={{ background: t.dot }} />
                  {t.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-bold text-muted-foreground">Destaque do topo (carrossel)</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "hype", label: "Hype do momento" },
                { id: "score", label: "Melhores notas" },
                { id: "new", label: "Novidades quentes" },
                { id: "classic", label: "Clássicos" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setHypeMode(m.id); save(); }}
                  className={`rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition ${hypeMode === m.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* CONTEÚDO +18 (portão escondido no perfil) */}
        <Section icon={adultMode ? <ShieldAlert className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />} title="Configurações de conteúdo" sub="Controle fino do que aparece para você">
          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
            O catálogo principal do OtakuVerse é sempre limpo: mangás, manhwas, manhuas, LNs e animes
            — incluindo obras <span className="font-bold text-foreground">ecchi</span> (sensoriais), que ficam etiquetadas e filtráveis.
            Conteúdo <span className="font-bold text-foreground">adulto (hentai, doujin, +18)</span> fica totalmente fora do catálogo e das buscas.
          </p>

          {!adultRevealed ? (
            <button
              onClick={() => setAdultRevealed(true)}
              className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-xs font-bold text-muted-foreground transition hover:text-foreground"
            >
              <Eye className="h-4 w-4" /> Mostrar opção de conteúdo adulto (+18)
            </button>
          ) : (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black">Modo Adulto (+18)</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Ativa a aba <span className="font-bold">Zona Adulta</span> com doujins, hentai e conteúdo +18 classificado.
                    Nunca misturamos isso no catálogo, na home ou nas buscas normais.
                  </p>
                </div>
                <button
                  onClick={() => (adultMode ? toggleAdult(false) : setConfirmOpen(true))}
                  className={`relative h-7 w-13 shrink-0 rounded-full transition ${adultMode ? "bg-red-600" : "bg-muted"}`}
                  style={{ width: 52 }}
                  aria-label="Ativar modo adulto"
                >
                  <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${adultMode ? "left-[26px]" : "left-0.5"}`} />
                </button>
              </div>

              {confirmOpen && (
                <div className="mt-3 rounded-xl border border-red-500/40 bg-card p-3.5">
                  <p className="mb-2 text-sm font-black">Confirmação obrigatória</p>
                  <label className="flex items-start gap-2 text-xs">
                    <input type="checkbox" checked={confirmAge} onChange={(e) => setConfirmAge(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--destructive)]" />
                    <span>Declaro que tenho <span className="font-black">18 anos ou mais</span> e que assistir/ler conteúdo adulto é legal onde vivo.</span>
                  </label>
                  <label className="mt-2 flex items-start gap-2 text-xs">
                    <input type="checkbox" checked={confirmTerms} onChange={(e) => setConfirmTerms(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--destructive)]" />
                    <span>Entendo que essa opção fica registrada com data/hora (consentimento) e pode ser desligada a qualquer momento. Conheço as <button onClick={() => usePortal.setState({ legalTab: "regras" }) || go("legal")} className="font-bold text-primary underline">Regras de conteúdo</button>.</span>
                  </label>
                  <div className="mt-3 flex gap-2">
                    <button
                      disabled={!confirmAge || !confirmTerms}
                      onClick={() => { setConfirmOpen(false); setConfirmAge(false); setConfirmTerms(false); toggleAdult(true); }}
                      className="rounded-xl bg-red-600 px-4 py-2 text-xs font-black text-white disabled:opacity-40"
                    >
                      Ativar Modo +18
                    </button>
                    <button onClick={() => { setConfirmOpen(false); setConfirmAge(false); setConfirmTerms(false); }} className="rounded-xl border border-border px-4 py-2 text-xs font-bold">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* segurança */}
          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-black"><KeyRound className="h-4 w-4 text-primary" /> Segurança</p>
            <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
              Sua senha é protegida com hash <span className="font-bold">scrypt (N=16384)</span> e salt aleatório — nem nós conseguimos lê-la.
              Sessões em cookies httpOnly com expiração de 30 dias.
            </p>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-muted-foreground"><Laptop className="h-3.5 w-3.5" /> Sessões ativas: {sessions.length}</p>
            <div className="flex flex-col gap-1">
              {sessions.slice(0, 3).map((s) => (
                <div key={s.id} className="rounded-lg bg-secondary px-3 py-1.5 text-[10px] text-muted-foreground">
                  <span className="font-bold text-foreground">{s.ua ? s.ua.slice(0, 42) : "dispositivo"}</span> · desde {new Date(s.createdAt).toLocaleDateString("pt-BR")}
                </div>
              ))}
            </div>
            <button
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                usePortal.getState().setUser(null);
                usePortal.getState().setLibrary({});
                go("home");
              }}
              className="mt-3 flex items-center gap-1.5 rounded-xl border border-destructive/40 px-4 py-2 text-xs font-bold text-destructive transition hover:bg-destructive/10"
            >
              <LogOut className="h-3.5 w-3.5" /> Encerrar sessão
            </button>
          </div>
        </Section>
      </div>

      {/* zona de perigo */}
      <section className="rounded-2xl border border-destructive/25 bg-destructive/5 p-5">
        <p className="mb-1 flex items-center gap-2 text-sm font-black text-destructive"><Trash2 className="h-4 w-4" /> Zona de perigo</p>
        <p className="mb-3 text-xs text-muted-foreground">Apaga o espelho local (o que está na nuvem continua lá — puxe de novo para restaurar).</p>
        <button
          onClick={() => {
            if (typeof window !== "undefined") localStorage.removeItem("ov_library_v2");
            setLibrary({});
          }}
          className="flex items-center gap-1.5 rounded-xl border border-destructive/40 px-4 py-2 text-xs font-bold text-destructive transition hover:bg-destructive/10"
        >
          <EyeOff className="h-3.5 w-3.5" /> Limpar cache local
        </button>
      </section>
    </div>
  );
}

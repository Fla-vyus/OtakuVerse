"use client";

import { useMemo, useState } from "react";
import { Loader2, UserRound, Sparkles, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { usePortal } from "./store";
import { fetchMe } from "./shelf";
/** Medidor visual da força da senha (mesma régua do servidor) */
function strengthOf(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  if (/^(.)\1+$/.test(pw)) score = 0;
  if (pw.length < 8) score = Math.min(score, 1);
  const meta = [
    { label: "muito curta", color: "bg-destructive" },
    { label: "fraca", color: "bg-destructive" },
    { label: "razoável", color: "bg-amber-500" },
    { label: "boa", color: "bg-yellow-400" },
    { label: "forte", color: "bg-emerald-500" },
    { label: "excelente", color: "bg-emerald-400" },
  ];
  return { score, ...meta[score] };
}

export function AuthDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [agree, setAgree] = useState(false);
  const setUser = usePortal((s) => s.setUser);
  const { toast } = useToast();

  const strength = useMemo(() => strengthOf(password), [password]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "register" && !agree) {
      setError("Você precisa aceitar os Termos e a Política de Privacidade para criar a conta.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      const me = await fetchMe();
      setUser(me.user);
      toast({ title: mode === "register" ? `Bem-vindo(a), ${d.user.username}!` : `Bem-vindo(a) de volta, ${d.user.username}!`, description: "Sua biblioteca está pronta e sincronizada na nuvem." });
      onOpenChange(false);
      setUsername("");
      setPassword("");
      setAgree(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            {mode === "register" ? "Criar conta no OtakuVerse" : "Entrar no OtakuVerse"}
          </DialogTitle>
          <DialogDescription>
            {mode === "register"
              ? "Crie seu perfil para salvar obras na nuvem, montar listas e receber recomendações com base no seu gosto."
              : "Acesse sua biblioteca, listas e preferências sincronizadas na nuvem."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="ov-user">Nome de usuário</Label>
            <Input id="ov-user" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ex.: sakura_reader" autoComplete="username" required minLength={3} maxLength={20} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ov-pass">Senha</Label>
            <div className="relative">
              <Input
                id="ov-pass"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "register" ? "mín. 8 caracteres, letras + números" : "sua senha"}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                required
                minLength={mode === "register" ? 8 : 6}
                className="pr-10"
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showPw ? "Ocultar senha" : "Mostrar senha"} tabIndex={-1}>
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {mode === "register" && password.length > 0 && (
              <div className="pt-1">
                <div className="flex items-center gap-2">
                  <div className="flex h-1.5 flex-1 gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span key={i} className={`h-full flex-1 rounded-full transition-colors ${i <= strength.score ? strength.color : "bg-secondary"}`} />
                    ))}
                  </div>
                  <span className="w-20 text-right text-[10px] font-bold text-muted-foreground">{strength.label}</span>
                </div>
                <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <ShieldCheck className="h-3 w-3 text-emerald-500" /> Guardada com hash scrypt + salt — ninguém (nem nós) vê sua senha.
                </p>
              </div>
            )}
          </div>
          {mode === "register" && (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-secondary/40 p-2.5 text-[11px] leading-snug text-muted-foreground">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 accent-[var(--primary)]" />
              <span>
                Li e aceito os <button type="button" className="font-bold text-primary underline" onClick={(e) => { e.preventDefault(); usePortal.setState({ legalTab: "termos" }); usePortal.getState().go("legal"); }}>Termos de Uso</button> e a{" "}
                <button type="button" className="font-bold text-primary underline" onClick={(e) => { e.preventDefault(); usePortal.setState({ legalTab: "privacidade" }); usePortal.getState().go("legal"); }}>Política de Privacidade</button> (LGPD).
              </span>
            </label>
          )}
          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{error}</p>}
          <Button type="submit" disabled={loading || (mode === "register" && !agree)} className="bg-brand-gradient w-full text-white">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserRound className="mr-2 h-4 w-4" />}
            {mode === "register" ? "Criar minha conta" : "Entrar"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {mode === "register" ? "Já tem conta?" : "Ainda não tem conta?"}{" "}
            <button type="button" className="font-bold text-primary underline" onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(""); }}>
              {mode === "register" ? "Fazer login" : "Criar agora"}
            </button>
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}

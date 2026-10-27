"use client";

// Contas de usuário (client-side, persistidas em localStorage)
// Registro/login múltiplos perfis, cada um com biblioteca e preferências próprias.
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface UserAccount {
  uid: string;
  name: string;
  email: string;
  passHash: string;
  emoji: string; // avatar
  hue: number; // matiz do gradiente do avatar
  bio: string;
  favTags: string[]; // tags favoritas p/ personalização
  createdAt: number;
}

export const AVATAR_EMOJIS = ["🦊", "🐉", "🦋", "🌙", "⚡", "🌸", "🦉", "🐺", "🐙", "👾", "🎧", "🍥", "☕", "🧋", "🎭", "🗡️"];

// hash simples (demo client-side — não é segurança real)
function hashPass(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

interface AuthState {
  users: Record<string, UserAccount>;
  sessionUid: string | null;
  register: (name: string, email: string, pass: string) => { ok: boolean; error?: string; uid?: string };
  login: (email: string, pass: string) => { ok: boolean; error?: string; uid?: string };
  logout: () => void;
  updateProfile: (partial: Partial<Pick<UserAccount, "name" | "emoji" | "hue" | "bio" | "favTags">>) => void;
  current: () => UserAccount | null;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      users: {},
      sessionUid: null,

      register: (name, email, pass) => {
        const clean = email.trim().toLowerCase();
        if (name.trim().length < 2) return { ok: false, error: "Nome muito curto" };
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { ok: false, error: "E-mail inválido" };
        if (pass.length < 4) return { ok: false, error: "Senha precisa de 4+ caracteres" };
        const users = { ...get().users };
        if (Object.values(users).some((u) => u.email === clean)) return { ok: false, error: "E-mail já cadastrado" };
        const uid = `u${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
        users[uid] = {
          uid,
          name: name.trim(),
          email: clean,
          passHash: hashPass(pass),
          emoji: AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)],
          hue: Math.floor(Math.random() * 360),
          bio: "",
          favTags: [],
          createdAt: Date.now(),
        };
        set({ users, sessionUid: uid });
        return { ok: true, uid };
      },

      login: (email, pass) => {
        const clean = email.trim().toLowerCase();
        const user = Object.values(get().users).find((u) => u.email === clean);
        if (!user) return { ok: false, error: "Conta não encontrada" };
        if (user.passHash !== hashPass(pass)) return { ok: false, error: "Senha incorreta" };
        set({ sessionUid: user.uid });
        return { ok: true, uid: user.uid };
      },

      logout: () => set({ sessionUid: null }),

      updateProfile: (partial) => {
        const uid = get().sessionUid;
        if (!uid) return;
        const users = { ...get().users };
        users[uid] = { ...users[uid], ...partial };
        set({ users });
      },

      current: () => {
        const { users, sessionUid } = get();
        return sessionUid ? users[sessionUid] ?? null : null;
      },
    }),
    { name: "otakuverse-accounts-v1" }
  )
);

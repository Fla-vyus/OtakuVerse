// v3.9 — ENV DE RUNTIME para deploys onde ninguém injeta variáveis de ambiente.
//
// A plataforma de publicação executa o server.js standalone diretamente (bun/node)
// sem passar pelo package.json — logo, sem `export DATABASE_URL=...`. O Next
// standalone TAMBÉM não carrega .env em runtime (comprovado: ausência de
// loadEnvConfig no server.js gerado). Este módulo resolve isso: procura um
// `otakuverse.runtime.json` perto do server.js (cwd, pai e avô) e injeta as
// chaves no process.env ANTES de qualquer módulo ler configuração.
//
// Regras:
//   · Idempotente (guard de módulo) — pode ser importado de qualquer lugar.
//   · NUNCA sobrescreve env já definida (plataforma/Vercel/shell têm prioridade).
//   · Arquivo é opcional: dev local continua exportando DATABASE_URL=file: no script.
//   · O arquivo contém segredos → .gitignore (nunca vai ao GitHub), mas viaja
//     no payload via outputFileTracingIncludes.
//
// Uso: `import "./runtime-env"` como PRIMEIRO import de db.ts e instrumentation.ts.

import { existsSync, readFileSync } from "fs";
import path from "path";

type RuntimeCfg = Record<string, string>;

const g = globalThis as unknown as { __ovRuntimeEnvLoaded?: boolean };

function loadRuntimeEnv(): void {
  if (g.__ovRuntimeEnvLoaded) return;
  g.__ovRuntimeEnvLoaded = true;

  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "otakuverse.runtime.json"),
    path.join(cwd, "..", "otakuverse.runtime.json"),
    path.join(cwd, "..", "..", "otakuverse.runtime.json"),
  ];

  for (const file of candidates) {
    try {
      if (!existsSync(file)) continue;
      const cfg = JSON.parse(readFileSync(file, "utf8")) as RuntimeCfg;
      let applied = 0;
      for (const [k, v] of Object.entries(cfg)) {
        if (typeof v !== "string" || v.length === 0) continue;
        if (process.env[k] === undefined || process.env[k] === "") {
          process.env[k] = v;
          applied++;
        }
      }
      // log discreto — útil no log da plataforma para confirmar o modo
      const mode = /^libsql:\/\//i.test(process.env.DATABASE_URL ?? "")
        ? "libsql (Turso)"
        : process.env.DATABASE_URL
          ? "file (SQLite)"
          : "indefinido";
      console.log(`[runtime-env] ${path.basename(file)} → ${applied} chave(s) aplicadas · banco: ${mode}`);
      return;
    } catch {
      // arquivo corrompido/ilegível → tenta o próximo candidato
    }
  }
}

loadRuntimeEnv();

/** true quando o banco configurado é remoto (Turso). Lido DEPOIS do loader. */
export const isRemoteDb = /^libsql:\/\//i.test(process.env.DATABASE_URL ?? "");

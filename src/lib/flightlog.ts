// v3.9.4 — GRAVADOR DE VOO: eventos críticos em disco (data/events.log) para
// diagnosticar quedas da instância publicada SEM acesso aos logs da plataforma
// (o console do Function Compute é inalcançável pra nós; o health /api/health
// mostra o presente, mas morre junto com o processo).
// O arquivo vive no cwd do standalone e sobrevive a restarts do processo — só
// a recriação do container o apaga. NUNCA lança: telemetria não pode derrubar nada.
// v3.9.4b — escrita SÍNCRONA (appendFileSync): no boot, jobs de queda e sinais o
// processo pode morrer antes de um appendFile assíncrono completar; síncrono
// garante o registro e custa ~1ms. Erros de FS vão ao console (visível no
// server.log local) mas nunca propagam.
import { appendFileSync, mkdirSync, statSync, renameSync } from "node:fs";
import path from "node:path";

const LOG = path.join(process.cwd(), "data", "events.log");
const MAX_LOG_BYTES = 512 * 1024; // rotação simples: events.log → events.log.old

export function flight(event: string, data: Record<string, unknown> = {}) {
  try {
    let line: string;
    try {
      line = JSON.stringify({ t: new Date().toISOString(), event, ...data }) + "\n";
    } catch {
      line = JSON.stringify({ t: new Date().toISOString(), event, note: "payload não-serializável" }) + "\n";
    }
    try {
      mkdirSync(path.dirname(LOG), { recursive: true });
      try {
        const st = statSync(LOG);
        if (st.size > MAX_LOG_BYTES) renameSync(LOG, LOG + ".old");
      } catch {}
      appendFileSync(LOG, line);
    } catch (e) {
      // filesystem read-only ou indisponível — telemetria não pode derrubar nada
      console.warn("[flight] append falhou:", e instanceof Error ? e.message : e);
    }
  } catch {}
}

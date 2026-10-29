// Cliente da Aoi independente de plataforma — a crítica externa pedia exatamente
// isto: sem dependência do SDK interno da sandbox, com provedor configurável.
//
// Ordem de resolução:
//   1. ENV (produção): AI_BASE_URL + AI_API_KEY + AI_MODEL — qualquer endpoint
//      OpenAI-compatible. Default pensado para a API pública da Z.ai:
//        AI_BASE_URL=https://api.z.ai/api/paas/v4
//        AI_MODEL=glm-4.5-flash   (gratuita na Z.ai — mesma família da Aoi)
//   2. Fallback (dev na plataforma): SDK z-ai-web-dev-sdk, que lê o .z-ai-config
//      injetado pela sandbox — o comportamento antigo fica intacto fora da Vercel.
//
// A superfície usada pelas rotas é só: (await createAoi()).chat.completions.create({
//   messages, thinking?, temperature?, max_tokens? }) → { choices: [{ message: { content } }] }

export interface AoiMessage {
  role: string;
  content: string;
}

export interface AoiCompletionParams {
  messages: AoiMessage[];
  thinking?: { type: "enabled" | "disabled" };
  temperature?: number;
  max_tokens?: number;
  [key: string]: unknown;
}

export interface AoiCompletionResult {
  choices: { message?: { content?: string | null } }[];
}

interface AoiClient {
  chat: {
    completions: {
      create: (params: AoiCompletionParams) => Promise<AoiCompletionResult>;
    };
  };
}

/** true quando há provedor externo configurado por env (Vercel/produção). */
export function aiEnvConfigured(): boolean {
  return !!process.env.AI_API_KEY && !!process.env.AI_BASE_URL;
}

function normalizeBase(base: string): string {
  return base.replace(/\/+$/, "");
}

async function envChatCompletion(params: AoiCompletionParams): Promise<AoiCompletionResult> {
  const base = normalizeBase(process.env.AI_BASE_URL!);
  const model = process.env.AI_MODEL ?? "glm-4.5-flash";
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
    },
    body: JSON.stringify({ model, ...params }),
    // sinopses/catálogos grandes podem demorar; 60s cobre o GLM com folga
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`IA indisponível (${res.status}): ${body.slice(0, 180)}`);
  }
  return (await res.json()) as AoiCompletionResult;
}

/** Cliente da Aoi: env primeiro, SDK da plataforma como fallback de desenvolvimento. */
export async function createAoi(): Promise<AoiClient> {
  if (aiEnvConfigured()) {
    return {
      chat: {
        completions: { create: envChatCompletion },
      },
    };
  }
  // Fallback de desenvolvimento (sandbox Z.ai): o SDK lê /etc/.z-ai-config.
  // Import dinâmico: fora da plataforma o módulo não entra no caminho quente.
  const mod = await import("z-ai-web-dev-sdk");
  const zai = await mod.default.create();
  return zai as unknown as AoiClient;
}

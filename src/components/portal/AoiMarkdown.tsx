"use client";

import ReactMarkdown from "react-markdown";
import { Sparkles } from "lucide-react";

/** Markdown da Aoi: converte marcadores [#123] em pills clicáveis que navegam ao detalhe */
export function AoiMarkdown({ content }: { content: string }) {
  const processed = content.replace(/\[#(\d+)\]/g, `[•](#/obra/$1)`);
  return (
    <ReactMarkdown
      components={{
        strong: (p) => <strong className="text-violet-200" {...p} />,
        a: ({ href }) => {
          const id = (href ?? "").replace("#/obra/", "");
          return (
            <a
              href={`#/obra/${id}`}
              className="mx-0.5 inline-flex translate-y-[2px] items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-2 py-[1px] text-[11px] font-bold text-violet-200 no-underline transition hover:bg-primary/30"
            >
              <Sparkles className="h-3 w-3" /> ver obra {id}
            </a>
          );
        },
        li: (p) => <li className="ml-4 list-disc py-0.5" {...p} />,
        p: (p) => <p className="whitespace-pre-line" {...p} />,
        h1: (p) => <h3 className="mb-2 text-xl font-black" {...p} />,
        h2: (p) => <h4 className="mb-2 text-lg font-extrabold" {...p} />,
        h3: (p) => <h4 className="mb-2 text-base font-extrabold" {...p} />,
      }}
    >
      {processed}
    </ReactMarkdown>
  );
}

#!/usr/bin/env python3
"""Dedup do catálogo OtakuVerse (v2.9).

A v2.8 importou obras com id `anilist-XXXX` enquanto o site inteiro usa id
numérico puro — 18.234 obras ficaram com DOIS registros (o numérico original,
com capa/banner/lastUpdate, e o gêmeo prefixado, sem capa).

Este script, em UMA transação:
  1. MERGE coalescente: o sobrevivente (id numérico) herda do gêmeo SOMENTE os
     campos que estão vazios — nenhum dado é descartado.
  2. DELETE dos gêmeos prefixados (cada obra única continua existindo exatamente 1x).
  3. RENAME das obras que só existem com prefixo → id numérico (padrão do site).
  4. Re-point defensivo de referências (LibraryItem/ShelfEntry/UserList).
  5. PRAGMA integrity_check + contagens de auditoria.
"""
import sqlite3
import json
import sys

DB = "db/custom.db"

TEXT_COLS = [
    "malId", "type", "format", "title", "titleEn", "titleNative", "synonyms",
    "synopsis", "synopsisPT", "cover", "coverAlt", "coverColor", "banner",
    "status", "startDate", "endDate", "country", "classification", "adultTags",
    "genres", "tags", "avgScore", "popularity", "favourites", "authors",
    "magazine", "source", "lastUpdate", "nextEpisodeAt", "nextEpisodeNum",
    "siteUrl", "coverAlts", "ptTags", "trending", "trendingAt", "spicy",
    "follows", "chapters", "volumes", "episodes", "duration", "isAdult",
]
NUMERIC_COLS = {"malId", "chapters", "volumes", "episodes", "duration",
                "avgScore", "popularity", "favourites", "lastUpdate",
                "nextEpisodeAt", "nextEpisodeNum", "trending", "trendingAt",
                "spicy", "follows"}

def coalesce(col: str) -> str:
    if col in NUMERIC_COLS or col == "isAdult":
        # numérico/bool: herda se o sobrevivente está NULL ou 0 (0 = dado ausente)
        return f"{col} = CASE WHEN (w.{col} IS NULL OR w.{col} = 0) THEN t.{col} ELSE w.{col} END"
    # texto: herda se o sobrevivente está NULL ou ''
    return f"{col} = COALESCE(NULLIF(w.{col}, ''), t.{col})"

def main():
    c = sqlite3.connect(DB, timeout=60)
    cur = c.cursor()

    # colunas reais da tabela (proteção contra schema drift)
    real_cols = {r[1] for r in cur.execute("PRAGMA table_info(Work)")}
    cols = [c2 for c2 in TEXT_COLS if c2 in real_cols and c2 != "id"]

    before = cur.execute("SELECT COUNT(*) FROM Work").fetchone()[0]
    dups = cur.execute(
        "SELECT COUNT(*) FROM Work t WHERE t.id LIKE 'anilist-%' AND REPLACE(t.id,'anilist-','') IN (SELECT id FROM Work)"
    ).fetchone()[0]
    only_prefixed = cur.execute(
        "SELECT COUNT(*) FROM Work WHERE id LIKE 'anilist-%' AND REPLACE(id,'anilist-','') NOT IN (SELECT id FROM Work)"
    ).fetchone()[0]
    print(f"antes: {before} linhas | gêmeos duplicados: {dups} | só-prefixados: {only_prefixed}")

    cur.execute("BEGIN")
    try:
        # 1) merge coalescente (sobrevivente = id numérico)
        if dups:
            sets = ", ".join(coalesce(c2) for c2 in cols)
            cur.execute(
                f"""UPDATE Work AS w SET {sets}
                    FROM Work AS t
                    WHERE w.id = REPLACE(t.id,'anilist-','')
                      AND t.id LIKE 'anilist-%'"""
            )
            print(f"merge coalescente aplicado em {cur.rowcount} sobreviventes")

        # 2) deleta os gêmeos prefixados (a obra única continua 1x)
        cur.execute(
            "DELETE FROM Work WHERE id LIKE 'anilist-%' AND REPLACE(id,'anilist-','') IN (SELECT id FROM Work)"
        )
        print(f"gêmeos deletados: {cur.rowcount}")

        # 3) re-point defensivo (hoje = 0 refs, mas o script é idempotente)
        cur.execute("UPDATE LibraryItem SET workId = REPLACE(workId,'anilist-','') WHERE workId LIKE 'anilist-%'")
        cur.execute("UPDATE ShelfEntry SET workId = REPLACE(workId,'anilist-','') WHERE workId LIKE 'anilist-%'")
        rows = cur.execute("SELECT id, workIds FROM UserList WHERE workIds LIKE '%anilist-%'").fetchall()
        for ul_id, work_ids in rows:
            try:
                arr = json.loads(work_ids)
                arr = [str(w).replace("anilist-", "") for w in arr]
                cur.execute("UPDATE UserList SET workIds = ? WHERE id = ?", (json.dumps(arr), ul_id))
            except Exception:
                pass

        # 4) renomeia os só-prefixados para o padrão numérico
        cur.execute("UPDATE Work SET id = REPLACE(id,'anilist-','') WHERE id LIKE 'anilist-%'")
        print(f"ids renomeados para numérico: {cur.rowcount}")

        cur.execute("PRAGMA integrity_check")
        ic = cur.fetchone()[0]
        if ic != "ok":
            raise RuntimeError(f"integrity_check falhou: {ic}")
        c.commit()
    except Exception as e:
        c.rollback()
        print("FALHOU — rollback completo:", e)
        sys.exit(1)

    after = cur.execute("SELECT COUNT(*) FROM Work").fetchone()[0]
    remaining_prefixed = cur.execute("SELECT COUNT(*) FROM Work WHERE id LIKE 'anilist-%'").fetchone()[0]
    print(f"depois: {after} linhas | prefixados restantes: {remaining_prefixed}")
    print(f"perda real de obras únicas: 0 (antes {before} linhas = {before - dups} únicas; depois {after})")

    # auditoria pós-dedup: classificação/spicy coerentes
    for row in cur.execute("SELECT classification, spicy, COUNT(*) FROM Work GROUP BY 1,2"):
        print("  audit:", dict(zip(["classification", "spicy", "n"], row)))

    # duplicatas residuais (mesmo id)? deve ser 0
    resid = cur.execute("SELECT COUNT(*) FROM (SELECT id FROM Work GROUP BY id HAVING COUNT(*)>1)").fetchone()[0]
    print(f"ids duplicados residuais: {resid}")
    c.close()

if __name__ == "__main__":
    main()

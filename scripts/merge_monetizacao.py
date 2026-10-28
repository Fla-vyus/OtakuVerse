#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Mescla capa (Playwright) + corpo (ReportLab) em um único PDF A4."""
from pypdf import PdfReader, PdfWriter

A4_W, A4_H = 595.28, 841.89

def normalize_page_to_a4(page):
    box = page.mediabox
    w, h = float(box.width), float(box.height)
    if abs(w - A4_W) > 0.1 or abs(h - A4_H) > 0.1:
        page.scale_to(A4_W, A4_H)
    return page

cover = "/home/z/my-project/scripts/monetizacao-cover.pdf"
body = "/home/z/my-project/scripts/monetizacao-body.pdf"
out = "/home/z/my-project/download/OtakuVerse-Auditoria-Monetizacao.pdf"

writer = PdfWriter()
writer.add_page(normalize_page_to_a4(PdfReader(cover).pages[0]))
for p in PdfReader(body).pages:
    writer.add_page(normalize_page_to_a4(p))
writer.add_metadata({
    "/Title": "OtakuVerse - Auditoria de Monetização",
    "/Author": "Z.ai",
    "/Creator": "Z.ai",
    "/Subject": "Auditoria de viabilidade de monetização do OtakuVerse",
})
with open(out, "wb") as f:
    writer.write(f)
print("OK:", out, "paginas:", len(writer.pages))

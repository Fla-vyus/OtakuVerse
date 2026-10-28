#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OtakuVerse — Auditoria de Monetização (corpo do relatório, ReportLab)
Rota Report: TocDocTemplate + multiBuild, fonte FreeSerif (PT-BR),
paleta fixa do Template 07 Crystal Blue (cover.md).
"""
import os
import sys
import hashlib

PDF_SKILL_DIR = "/home/z/my-project/skills/pdf"
sys.path.insert(0, os.path.join(PDF_SKILL_DIR, "scripts"))

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    KeepTogether, CondPageBreak,
)
from reportlab.platypus.tableofcontents import TableOfContents

# ── Fontes registradas (somente as permitidas pelo brief) ──────────────────
FONT_DIR = "/usr/share/fonts"
pdfmetrics.registerFont(TTFont("NotoSerifSC", f"{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf"))
pdfmetrics.registerFont(TTFont("NotoSerifSC-Bold", f"{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf"))
pdfmetrics.registerFont(TTFont("FreeSerif", f"{FONT_DIR}/truetype/freefont/FreeSerif.ttf"))
pdfmetrics.registerFont(TTFont("FreeSerif-Bold", f"{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf"))
pdfmetrics.registerFont(TTFont("FreeSerif-Italic", f"{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf"))
pdfmetrics.registerFont(TTFont("FreeSerif-BoldItalic", f"{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf"))
registerFontFamily("NotoSerifSC", normal="NotoSerifSC", bold="NotoSerifSC-Bold")
registerFontFamily("FreeSerif", normal="FreeSerif", bold="FreeSerif-Bold",
                   italic="FreeSerif-Italic", boldItalic="FreeSerif-BoldItalic")

from pdf import install_font_fallback  # noqa: E402
install_font_fallback()

# ── Paleta fixa do Template 07 Crystal Blue (typesetting/cover.md) ─────────
PAGE_BG      = colors.HexColor("#f5f8fc")   # XL
SECTION_BG   = colors.HexColor("#edf2f9")   # XL
CARD_BG      = colors.HexColor("#e4ecf5")   # L
TABLE_STRIPE = colors.HexColor("#eef3fa")   # L
HEADER_FILL  = colors.HexColor("#1a4a7a")   # M
BORDER       = colors.HexColor("#c0d0e2")   # S
ACCENT       = colors.HexColor("#2d7ab3")   # XS
TEXT_PRIMARY = colors.HexColor("#142840")
TEXT_MUTED   = colors.HexColor("#5a7a96")

TABLE_HEADER_COLOR = HEADER_FILL
TABLE_ROW_EVEN = colors.white
TABLE_ROW_ODD = TABLE_STRIPE

# ── Página e margens simétricas ─────────────────────────────────────────────
MARGIN = 0.9 * inch
PAGE_W, PAGE_H = A4
AVAIL_W = PAGE_W - 2 * MARGIN
AVAIL_H = PAGE_H - 2 * MARGIN
H1_THRESHOLD = AVAIL_H * 0.25

OUT = "/home/z/my-project/scripts/monetizacao-body.pdf"
DOC_TITLE = "OtakuVerse — Auditoria de Monetização"

# ── Estilos ─────────────────────────────────────────────────────────────────
h1 = ParagraphStyle("H1", fontName="FreeSerif", fontSize=20, leading=26,
                    textColor=HEADER_FILL, spaceBefore=18, spaceAfter=10)
h2 = ParagraphStyle("H2", fontName="FreeSerif", fontSize=14, leading=20,
                    textColor=TEXT_PRIMARY, spaceBefore=14, spaceAfter=8)
body = ParagraphStyle("Body", fontName="FreeSerif", fontSize=10.5, leading=17,
                      textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY, spaceAfter=10)
bullet = ParagraphStyle("Bullet", fontName="FreeSerif", fontSize=10.5, leading=17,
                        textColor=TEXT_PRIMARY, alignment=TA_LEFT,
                        leftIndent=16, spaceAfter=6)
quote = ParagraphStyle("Quote", fontName="FreeSerif-Italic", fontSize=10.5, leading=17,
                       textColor=TEXT_MUTED, leftIndent=24, spaceBefore=6, spaceAfter=10,
                       borderColor=ACCENT, borderWidth=0, alignment=TA_LEFT)
caption = ParagraphStyle("Caption", fontName="FreeSerif", fontSize=8.5, leading=12,
                         textColor=TEXT_MUTED, alignment=TA_CENTER, spaceBefore=3, spaceAfter=6)
th_style = ParagraphStyle("TH", fontName="FreeSerif", fontSize=9.5, leading=13,
                          textColor=colors.white, alignment=TA_CENTER)
td_style = ParagraphStyle("TD", fontName="FreeSerif", fontSize=9.5, leading=13,
                          textColor=TEXT_PRIMARY, alignment=TA_LEFT)
td_c = ParagraphStyle("TDC", parent=td_style, alignment=TA_CENTER)
stat_style = ParagraphStyle("StatBig", fontName="FreeSerif", fontSize=20, leading=24,
                            textColor=ACCENT, alignment=TA_CENTER)
label_style = ParagraphStyle("StatLabel", fontName="FreeSerif", fontSize=8.5, leading=11,
                             textColor=TEXT_MUTED, alignment=TA_CENTER)

# ── TOC (TocDocTemplate + multiBuild — nunca TOC manual) ───────────────────
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, "bookmark_name"):
            level = getattr(flowable, "bookmark_level", 0)
            text = getattr(flowable, "bookmark_text", "")
            key = getattr(flowable, "bookmark_key", "")
            self.notify("TOCEntry", (level, text, self.page, key))

def add_heading(text, style, level=0):
    key = "h_" + hashlib.md5(text.encode()).hexdigest()[:8]
    p = Paragraph(f'<a name="{key}"/><b>{text}</b>', style)
    p.bookmark_name = key
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def h1_block(text):
    return [CondPageBreak(H1_THRESHOLD), add_heading(text, h1, level=0)]

def h2_block(text):
    return [CondPageBreak(0.12 * AVAIL_H), add_heading(text, h2, level=1)]

# ── Cabeçalho / rodapé ──────────────────────────────────────────────────────
def on_page(canvas, doc):
    canvas.saveState()
    # cabeçalho: título à esquerda + régua accent
    canvas.setFont("FreeSerif", 7.5)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(MARGIN, PAGE_H - 0.55 * inch, DOC_TITLE)
    canvas.setStrokeColor(ACCENT)
    canvas.setLineWidth(1.2)
    canvas.line(MARGIN, PAGE_H - 0.62 * inch, PAGE_W - MARGIN, PAGE_H - 0.62 * inch)
    # rodapé: autor à esquerda + número à direita (sem "X de Y")
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, 0.62 * inch, PAGE_W - MARGIN, 0.62 * inch)
    canvas.setFont("FreeSerif", 7.5)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(MARGIN, 0.45 * inch, "OtakuVerse · Relatório de viabilidade")
    canvas.drawRightString(PAGE_W - MARGIN, 0.45 * inch, str(doc.page))
    canvas.restoreState()

def callout_row(stats):
    """Linha de 3 callouts lado a lado (números-chave)."""
    cells = []
    for big, label in stats:
        inner = Table([[Paragraph(f"<b>{big}</b>", stat_style)],
                       [Paragraph(label, label_style)]], colWidths=[(AVAIL_W - 24) / 3])
        inner.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), CARD_BG),
            ("BOX", (0, 0), (-1, -1), 1, ACCENT),
            ("TOPPADDING", (0, 0), (-1, 0), 10), ("BOTTOMPADDING", (0, -1), (-1, -1), 10),
            ("TOPPADDING", (0, 1), (-1, 1), 2),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        cells.append(inner)
    row = Table([cells], colWidths=[(AVAIL_W - 24) / 3 + 8] * 3, hAlign="CENTER")
    row.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    return KeepTogether([Spacer(1, 6), row, Spacer(1, 12)])

def make_table(headers, rows, ratios, aligns=None):
    """Tabela padrão: header HEADER_FILL, zebra TABLE_STRIPE, células Paragraph."""
    col_widths = [r * AVAIL_W for r in ratios]
    data = [[Paragraph(f"<b>{h}</b>", th_style) for h in headers]]
    for r in rows:
        line = []
        for i, cell in enumerate(r):
            st = td_c if (aligns and aligns[i] == "c") else td_style
            line.append(Paragraph(str(cell), st))
        data.append(line)
    t = Table(data, colWidths=col_widths, hAlign="CENTER", repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]
    for i in range(1, len(data)):
        style.append(("BACKGROUND", (0, i), (-1, i), TABLE_ROW_ODD if i % 2 else TABLE_ROW_EVEN))
    t.setStyle(TableStyle(style))
    return t

# ═══════════════════════════ STORY ══════════════════════════════════════════
story = []

# ── Sumário (TOC) ──
toc = TableOfContents()
toc.levelStyles = [
    ParagraphStyle("TOC1", fontName="FreeSerif", fontSize=11.5, leading=18,
                   leftIndent=16, textColor=TEXT_PRIMARY),
    ParagraphStyle("TOC2", fontName="FreeSerif", fontSize=10, leading=15,
                   leftIndent=34, textColor=TEXT_MUTED),
]
story.append(Paragraph("<b>Sumário</b>", h1))
story.append(Spacer(1, 8))
story.append(toc)
story.append(PageBreak())

# ═══ 1. Sumário Executivo ═══
story += h1_block("1. Sumário Executivo")
story.append(Paragraph(
    "A resposta direta à pergunta feita é: <b>sim, o OtakuVerse tem condições reais de gerar receita</b>, "
    "mas com uma ordem certa de atacar as fontes e uma expectativa honesta de valores. Entre as três vias "
    "citadas — Google AdSense, marketing de afiliados e anúncios em geral — a via com maior aderência "
    "imediata ao produto é o <b>marketing de afiliados</b>, porque o site já é, por natureza, um vitrine de "
    "obras que o público quer comprar em formato físico ou digital. O AdSense é viável, porém tem um "
    "obstáculo específico neste projeto: a política de conteúdo adulto do Google, que exige segmentação "
    "cuidada da zona +18 e do acervo ecchi. Anúncios diretos e doações são fontes complementares que "
    "entram sem barreira técnica alguma e podem começar a valer inclusive antes do AdSense.", body))
story.append(Paragraph(
    "Dois pré-requisitos dominam tudo o que vem depois: <b>público</b> e <b>endereço público</b>. "
    "Nenhuma fonte de receita funciona sem tráfego constante, e o tráfego exige o site publicado num "
    "domínio próprio acessível ao Google — o ambiente de preview atual não é indexável nem aceito pelo "
    "AdSense. A boa notícia é que a fundação técnica já está construída: catálogo real de dezenas de "
    "milhares de obras, carregamento em fases com payload comprimido, PWA instalável, proteção de dados "
    "com autenticação e gating +18, além de SEO básico ativo. O que falta é publicar, crescer audiência "
    "e depois ligar as torneiras de monetização, nessa ordem.", body))
story.append(callout_row([
    ("40.456", "obras catalogadas — volume que sustenta páginas indexáveis"),
    ("-84%", "payload das APIs após compressão gzip (v3.6)"),
    ("R$ 40/ano", "custo único inevitável: registro do domínio próprio"),
]))
story.append(Paragraph(
    "O roteiro recomendado, detalhado no capítulo 8, resum-se em quatro fases: publicar o site em domínio "
    "próprio (fase 0), ativar afiliados de lojas brasileiras logo no primeiro mês de público (fase 1), "
    "submeter o AdSense somente quando houver tráfego recorrente e a zona adulta estiver isolada dos "
    "anúncios (fase 2) e, por fim, explorar anúncios diretos e parcerias com lojas especializadas quando "
    "as métricas provarem audiência (fase 3). Doações via Pix ou Ko-fi podem ser habilitadas desde a fase "
    "0, pois não têm requisito de tráfego nem aprovação de terceiros.", body))

# ═══ 2. Estado Atual da Plataforma ═══
story += h1_block("2. Estado Atual da Plataforma")
story.append(Paragraph(
    "Antes de falar de dinheiro, é preciso mapear o que a plataforma já oferece de aproveitável — e onde "
    "estão as lacunas. O inventário abaixo foi verificado diretamente no código e no servidor em "
    "produção nesta data. O catálogo é real, persistido em SQLite com 40.456 obras distribuídas entre "
    "mangás (9.560), animes (8.592), manhwas (7.140), light novels (6.971), manhuas (5.311) e webnovels "
    "(2.882), alimentado por sincronização automática a cada 30 minutos com fontes gratuitas (AniList, "
    "Kitsu e MangaUpdates). Cada obra tem página própria com sinopse, nota, gêneros, tags e capa — exatamente "
    "a estrutura de que buscadores e redes de anúncio precisam para indexar e renderizar.", body))
story.append(Paragraph(
    "No aspecto técnico, a home carrega em duas fases (o essencial imediatamente, o resto sob demanda via "
    "IntersectionObserver), as respostas de API viajam comprimidas com gzip desde a versão 3.6 — queda "
    "média de 84% no tráfego de dados — e o site é instalável como aplicativo (PWA com service worker e "
    "manifest). A segurança inclui sessões com senha hasheada (scrypt), rate limit no login, cabeçalhos "
    "CSP/HSTS e página legal com política de privacidade. Na esfera de conteúdo, o acervo tem classificação "
    "etária por obra e a zona adulta fica atrás de login com modo +18 explícito — um ponto que vai pesar "
    "positivamente na análise do AdSense, mas que ainda exige o refinamento descrito no capítulo 3.", body))
story.append(Paragraph(
    "As lacunas concretas são três. Primeiro, <b>não há domínio próprio público</b>: o site roda em ambiente "
    "de preview, que o Google não indexa e o AdSense não aceita. Segundo, <b>não há instrumentação de "
    "audiência</b> — sem analytics não se prova tráfego, e programas de afiliados e anunciantes pedem "
    "números. Terceiro, <b>não existem superfícies comerciais</b>: nada hoje aponta para lojas, nem há "
    "espaços reservados para mídia. As três lacunas são endereçáveis em dias, não meses, como detalha o "
    "roteiro do capítulo 8.", body))
story.append(Paragraph(
    "Vale registrar a resiliência operacional como ativo de monetização: backup diário verificado "
    "(VACUUM INTO com integrity_check), restauração automática a partir de snapshot assinado com SHA-256 "
    "e rotina de 30 minutos em daemon permanente. Um site que cai ou perde catálogo perde anunciantes e "
    "posições no buscador — essa fundação, que já existia, protege justamente o ativo que se pretende "
    "monetizar: a audiência acumulada.", body))

# ═══ 3. Google AdSense ═══
story += h1_block("3. Google AdSense — Viabilidade e Riscos")
story.append(Paragraph(
    "O AdSense paga por impressão e clique sobre anúncios contextuais entregues pelo Google, e é a porta "
    "de entrada clássica para sites de conteúdo. A adesão é gratuita, o pagamento no Brasil é feito por "
    "transferência quando o saldo cruza US$ 100, e a aprovação depende de cumprir as Políticas do Programa "
    "e as diretrizes para editores. Para o OtakuVerse o balanço é <b>viável com ressalvas</b>: o modelo de "
    "negócio (catálogo informativo com curadoria) é aceito, mas há um risco específico de conteúdo e uma "
    "lista de requisitos formais que precisam estar resolvidos antes de submeter o site à análise.", body))
story += h2_block("3.1 Requisitos formais de adesão")
story.append(make_table(
    ["Requisito", "Situação no OtakuVerse", "Ação necessária"],
    [
        ["Site público em domínio próprio", "Falta — roda em preview privado",
         "Registrar domínio (ex.: otakuverse.com.br) e publicar"],
        ["Conteúdo com valor próprio", "Parcial — sinopses vêm de APIs, mas há curadoria, rankings, hype e notícias",
         "Ampliar conteúdo editorial próprio (resenhas, guias)"],
        ["Política de privacidade", "Existe (página legal)",
         "Incluir cláusula sobre cookies de publicidade"],
        ["Idade mínima e titularidade", "Requisito do titular da conta (18+)",
         "Cadastrar com dados do responsável"],
        ["Navegação e site funcional", "OK — navegação, busca e catálogo reais",
         "Manter"],
        ["Tráfego mínimo", "Não é requisito formal, mas ajuda a aprovação",
         "Acumular 2-4 semanas de visitas antes de submeter"],
    ],
    [0.30, 0.38, 0.32],
))
story.append(Paragraph("Tabela 1 — Requisitos do programa AdSense frente ao estado atual da plataforma.", caption))
story += h2_block("3.2 O risco específico: conteúdo adulto e ecchi")
story.append(Paragraph(
    "As políticas do Google proíbem anúncios sobre conteúdo para adultos, e conteúdo <i>suggestive</i> "
    "fica em zona cinzenta que exige cuidado. O catálogo do OtakuVerse contém 1.105 obras de classificação "
    "suggestive (incluindo o gênero ecchi, de interesse declarado do público) e 535 obras adult, que já "
    "ficam atrás do login +18. O risco prático é duplo: a <b>rejeição na análise</b> do site se o robô do "
    "Google enxergar capas e sinopses sensíveis em páginas onde os anúncios apareceriam, e o <b>banimento "
    "posterior</b> se anúncios forem servidos em contexto adulto. A mitigação é arquitetural e o site já "
    "tem a base para ela: <b>nenhum anúncio é renderizado em páginas classificadas suggestive ou adult</b>, "
    "e o inventário de anúncios só entra nas páginas de classificação safe. Tecnicamente isso significa "
    "checar a classificação da obra na página antes de montar a tag de anúncio, além de excluir a zona "
    "+18 por completo da malha publicitária.", body))
story.append(Paragraph(
    "Há ainda dois ajustes finos. O primeiro é a <b>LGPD e o consentimento de cookies</b>: o AdSense usa "
    "cookies de publicidade, e a página de privacidade precisa mencionar isso, com um banner de consentimento "
    "simples na primeira visita (a versão brasileira da exigência europeia; o Google exige Consent Mode "
    "v2 para tráfego do Espaço Econômico Europeu, e para o Brasil é boa prática e blindagem jurídica). "
    "O segundo é o <b>CSP</b>: os cabeçalhos de segurança atuais bloqueiam scripts de terceiros, então, "
    "no dia da ativação, os domínios do Google (googlesyndication, doubleclick e afins) precisam ser "
    "liberados seletivamente no proxy — uma linha de configuração, mas que quebra os anúncios silenciosamente "
    "se esquecida.", body))
story += h2_block("3.3 Expectativa de ganho com AdSense")
story.append(Paragraph(
    "É importante calibrar expectativa: CPM brasileiro em nicho de entretenimento/anime fica tipicamente "
    "na faixa de R$ 2 a R$ 10 por mil pageviews, conforme sazonalidade e qualidade do inventário. Isso "
    "significa que mil visitas por dia (~30 mil pageviews/mês) gerariam algo entre R$ 60 e R$ 300/mês — "
    "relevante como renda de projeto, insuficiente como salário. O AdSense, portanto, não deve ser o plano "
    "A de receita do OtakuVerse, e sim a camada de base que monetiza todo o tráfego que não converte em "
    "clique de compra. O capítulo 7 consolida os cenários numéricos.", body))

# ═══ 4. Marketing de Afiliados ═══
story += h1_block("4. Marketing de Afiliados — A Aposta Principal")
story.append(Paragraph(
    "Afiliado é quem indica um produto com um link rastreável e recebe comissão sobre a venda. Para um "
    "site de descoberta de mangás e novels, essa é a fonte de maior aderência estrutural: o visitante já "
    "está pesquisando uma obra específica, e o gesto natural seguinte é comprar o volume ou assinar o "
    "serviço. Diferentemente do AdSense, os grandes programas brasileiros <b>não exigem tráfego mínimo</b> "
    "para aprovação de sites de conteúdo, têm política de conteúdo menos restritiva (ecchi suggestive "
    "passa; explícito não — a zona adulta também deve ficar fora) e pagam por resultado, não por impressão.", body))
story += h2_block("4.1 Programas disponíveis no Brasil (custo zero para entrar)")
story.append(make_table(
    ["Programa", "O que vende no nicho", "Comissão típica", "Aprovação"],
    [
        ["Amazon Associados BR", "Mangás, box colecionáveis, LNs, Kindle Unlimited",
         "3% a 8% do produto", "Fácil — site de conteúdo"],
        ["Mercado Livre Afiliados", "Mangás e novels com frete e preço competitivo",
         "5% a 11% por categoria", "Fácil — cadastro direto"],
        ["Shopee Afiliados", "Volumes avulsos baratos, merchandising otaku",
         "até ~10% + bônus de meta", "Muito fácil — aprovação rápida"],
        ["Awin / Rakuten (redes)", "Editoras e lojas especializadas (Panini, JBC, NewPOP conforme adesão)",
         "5% a 12% variável", "Média — avaliação por anunciantes"],
        ["Steam / lojas de jogos (via redes)", "Adaptações em jogo, DLCs de visuais novels",
         "3% a 10%", "Variável"],
    ],
    [0.22, 0.36, 0.22, 0.20],
))
story.append(Paragraph("Tabela 2 — Programas de afiliados com aderência ao catálogo do OtakuVerse (faixas públicas divulgadas pelos próprios programas; confirmar valor vigente na adesão).", caption))
story += h2_block("4.2 Onde os links entram no produto")
story.append(Paragraph(
    "A integração é natural porque o site já tem as superfícies certas. Na <b>página da obra</b>, um botão "
    "\"comprar\" discreto abaixo da sinopse, com o link de afiliado da loja que tiver o volume — para "
    "séries em publicação, apontar para o volume mais recente e para o box da coleção. Nas <b>fileiras da "
    "home</b> (Bestsellers, Lançamentos do mês), os cards podem ganhar um selo \"disponível em\" que "
    "transforma listagem em vitrine comercial. No <b>calendário de lançamentos</b>, cada estreia física é "
    "um gancho de pré-venda. E nas <b>webnovels e light novels</b>, assinaturas de leitura (Kindle "
    "Unlimited e similares) rendem comissão recorrente por assinante indicado que mantém o plano.", body))
story.append(Paragraph(
    "Duas regras de compliance valem ouro aqui. A primeira é o <b>disclaimer de afiliado</b> — os programas "
    "exigem, e o Código de Defesa do Consumidor recomenda, que o usuário saiba que os links são "
    "monetizados; um aviso fixo de uma linha no rodapé das páginas com links resolve. A segunda é "
    "<b>não monetizar a zona adulta</b>: além da política das próprias redes (Amazon e Mercado Livre "
    "restringem conteúdo explícito), o público +18 compraria em lojas específicas que não convêm ao "
    "posicionamento do site. A regra de ouro é a mesma do AdSense: monetização apenas em contexto safe.", body))
story.append(Paragraph(
    "Em termos de ganho: comissão média de R$ 2 a R$ 5 por volume vendido, com conversão típica de 2% a "
    "4% dos cliques. Cem cliques por dia em links de compra — número alcançável com tráfego diário de 2 a "
    "5 mil visitas — produzem 2 a 4 vendas diárias, ou R$ 150 a R$ 400/mês no início, crescendo "
    "linearmente com a audiência e de forma composta quando o site começa a rankear no Google para "
    "buscas do tipo \"onde comprar [mangá] volume X\", que é exatamente o tipo de consulta que o "
    "catálogo responde.", body))

# ═══ 5. Outras Fontes ═══
story += h1_block("5. Outras Fontes de Receita")
story += h2_block("5.1 Anúncios diretos e patrocínios")
story.append(Paragraph(
    "Quando o tráfego prova valor, lojas de mangá, livrarias Geek e serviços de streaming de anime do "
    "Brasil são compradores naturais de banner ou sessão patrocinada (\"Lançamentos do mês apresentados "
    "por X\"). Anúncio direto paga valores fixos mensais por espaço, sem intermediário: um banner para "
    "audiência de nicho de 20-50 mil visitas/mês costuma valer entre R$ 200 e R$ 800/mês por posicionamento, "
    "negociado direto. O requisito é ter mídia kit com números — mais um motivo para instalar analytics "
    "antes de qualquer outra coisa. Redes intermediárias alternativas ao AdSense (Ezoic, por exemplo, "
    "sem mínimo rígido) podem elevar o CPM depois que o volume justificar, mas convém só entrar nessa "
    "avenida depois do AdSense aprovado e medindo.", body))
story += h2_block("5.2 Doações e apoio direto")
story.append(Paragraph(
    "Ko-fi, Buy Me a Coffee ou um Pix de apoiador no rodapé não exigem aprovação, tráfego mínimo ou "
    "conformidade publicitária — podem ser ligados hoje. A conversão média de comunidades de nicho fica "
    "entre 0,3% e 1% dos usuários recorrentes, com ticket livre; é a fonte mais lenta, porém a mais "
    "independente, e serve também como válvula de feedback: quem doa é o público mais engajado para "
    "testar funcionalidades e pedir catálogo. Com a PWA instalável e a comunidade otaku brasileira "
    "acostumada a apoiar criadores, é uma via subestimada mas real para o longo prazo.", body))
story += h2_block("5.3 O que evitar por ora")
story.append(Paragraph(
    "Redes de anúncios de baixa qualidade (popunders, redirects) pagam mais por impressão, mas "
    "destroem a confiança e a reputação do domínio junto ao Google — custo altíssimo para ganho baixo. "
    "Do mesmo modo, monetizar antes de ter conteúdo e audiência mínimos queima a primeira impressão "
    "do site com o público e com o avaliador do AdSense. A disciplina de ordem (público primeiro, "
    "monetização depois) é o que separa projetos que rendem de projetos que só têm banners.", body))

# ═══ 6. Requisitos Técnicos e Jurídicos ═══
story += h1_block("6. Requisitos Técnicos e Jurídicos")
story += h2_block("6.1 Infraestrutura")
story.append(Paragraph(
    "O único gasto inevitável do plano inteiro é o <b>domínio próprio</b> — de R$ 30 a R$ 50/ano em "
    "registradores nacionais para um .com.br (ou similar em .com). É o endereço que o Google indexa, que "
    "o AdSense exige e que dá ao projeto endereço permanente para as cadeias de links de afiliado. A "
    "hospedagem pode permanecer em custo zero no curto prazo: a pilha atual (Next.js standalone + SQLite "
    "em disco + daemon de sincronização) roda confortavelmente em uma VPS gratuita de tier always-free "
    "(Oracle Cloud, por exemplo, oferece capacidade ARM que dá folga para este perfil), ou na própria "
    "infraestrutura atual enquanto o tráfego não justifica migração. À medida que a audiência crescer, "
    "uma VPS de R$ 25 a R$ 40/mês cobre o cenário de 50-100 mil visitas/mês com folga, dado o consumo "
    "medido do OtakuVerse (respostas comprimidas, cache de capas local e carregamento em fases).", body))
story += h2_block("6.2 Conformidade e conteúdo")
story.append(make_table(
    ["Item", "Status hoje", "Momento de resolver"],
    [
        ["Política de privacidade (LGPD)", "Existe; falta cláusula de cookies de publicidade", "Antes do AdSense"],
        ["Banner de consentimento de cookies", "Não existe", "Antes do AdSense"],
        ["Disclaimer de links de afiliado", "Não existe", "Na ativação dos afiliados"],
        ["Isolamento de anúncios na zona adulta", "Gating +18 já existe; regra publicitária a definir", "Antes do AdSense"],
        ["Analytics de audiência", "Não existe", "Imediato (grátis: Cloudflare Web Analytics ou GA4)"],
        ["ads.txt no domínio", "Não se aplica ainda", "Na aprovação do AdSense"],
        ["Liberação de CSP para domínios do Google", "CSP atual bloqueia", "Na ativação do AdSense"],
        ["sitemap.xml e robots.txt", "Já existem e liberam Googlebot", "Manter"],
    ],
    [0.34, 0.36, 0.30],
))
story.append(Paragraph("Tabela 3 — Checklist de conformidade técnica e jurídica para monetização.", caption))
story.append(Paragraph(
    "Nenhum desses itens é caro ou demorado; o ponto é que alguns têm <b>sequência obrigatória</b> — não "
    "faz sentido liberar CSP para o Google antes do domínio existir, nem colocar banner de consentimento "
    "antes de haver cookies de terceiros para consentir. A tabela acima serve de mapa: a coluna da direita "
    "âncora cada item à fase correspondente do roteiro do capítulo 8, evitando trabalho desperdiçado e "
    "gargalos de última hora.", body))

# ═══ 7. Estimativas Realistas ═══
story += h1_block("7. Estimativas Realistas de Receita")
story.append(Paragraph(
    "Os números abaixo combinam as faixas públicas de comissão dos programas com conversões conservadoras "
    "de nicho (CTR de 1,5% a 2% sobre pageviews para links de compra; conversão de 3% dos cliques em "
    "venda; ticket médio de R$ 35 em mangás com comissão média de R$ 3; CPM de R$ 2 a R$ 10 no AdSense "
    "para o nicho). São estimativas para planejamento, não promessas — a variável dominante é sempre o "
    "tráfego qualificado, e é por isso que o capítulo 8 começa por ele.", body))
story.append(make_table(
    ["Cenário de tráfego", "Afiliados /mês", "AdSense /mês", "Total estimado"],
    [
        ["10 mil pageviews/mês (início)", "R$ 15 - R$ 60", "R$ 20 - R$ 100", "R$ 35 - R$ 160"],
        ["50 mil pageviews/mês (6-12 meses)", "R$ 75 - R$ 300", "R$ 100 - R$ 500", "R$ 175 - R$ 800"],
        ["100 mil pageviews/mês (meta 18 meses)", "R$ 150 - R$ 600", "R$ 200 - R$ 1.000", "R$ 350 - R$ 1.600"],
        ["+ 1 patrocínio direto (a partir de 50k)", "n/a", "n/a", "+ R$ 200 - R$ 800"],
    ],
    [0.34, 0.22, 0.22, 0.22],
    aligns=["l", "c", "c", "c"],
))
story.append(Paragraph("Tabela 4 — Cenários mensais de receita por faixa de tráfego (estimativas conservadoras para o nicho no Brasil).", caption))
story.append(Paragraph(
    "A leitura correta da tabela: no primeiro ano, o retorno realista se parece com uma renda de projeto "
    "de R$ 50 a R$ 300/mês, não com um salário. O salto de valor acontece quando o catálogo começa a "
    "rankear no Google para buscas de descoberta e compra — aí cada nova página indexada vira um vendedor "
    "silencioso, e o custo marginal de servir uma página a mais é praticamente zero na arquitetura atual. "
    "É também por isso que o investimento mais lucrativo dos próximos meses não é publicidade, e sim "
    "conteúdo: resenhas, guias de leitura e listas curadas ampliam o leque de consultas atendidas.", body))

# ═══ 8. Roteiro Recomendado ═══
story += h1_block("8. Roteiro Recomendado")
story.append(make_table(
    ["Fase", "Quando", "Ações", "Critério de passagem"],
    [
        ["0 — Fundação", "Semana 1-2",
         "Registrar domínio; publicar o site público; instalar analytics grátis; adicionar cláusula de privacidade",
         "Site indexável, analytics contando"],
        ["1 — Afiliados", "Mês 1-2 de público",
         "Cadastrar Amazon/Mercado Livre/Shopee; botão comprar na página da obra; disclaimer no rodapé",
         "Primeiras comissões registradas"],
        ["2 — AdSense", "Com 2-4 semanas de tráfego estável",
         "Banner de consentimento; regra sem anúncio em suggestive/adult; submeter análise; ads.txt; liberar CSP",
         "Conta aprovada e anúncios servindo"],
        ["3 — Escala", "A partir de 50k pageviews/mês",
         "Mídia kit; abordar lojas para patrocínio; avaliar Ezoic; testar doações Ko-fi/Pix",
         "Primeiro contrato direto assinado"],
    ],
    [0.16, 0.18, 0.42, 0.24],
))
story.append(Paragraph("Tabela 5 — Roadmap de monetização em quatro fases com critérios objetivos de passagem.", caption))
story.append(Paragraph(
    "Do ponto de vista de engenharia, as entregas técnicas do OtakuVerse dentro desse roteiro são "
    "pontuais e baratas: componente de \"link de compra\" na ficha da obra (dados por API das lojas ou "
    "busca por ISBN), sinalizador de classificação já existente reutilizado como chave da regra "
    "publicitária, slots reservados de banner com lazy loading (mesma disciplina de fases do resto do "
    "site, para não regredir a performance) e o banner de consentimento. Nada disso toca no catálogo, "
    "no banco ou nas linhas vermelhas do projeto — e a zona +18 continua intocada por qualquer monetização.", body))

# ═══ 9. Riscos e Mitigações ═══
story += h1_block("9. Riscos e Mitigações")
story.append(make_table(
    ["Risco", "Probabilidade", "Impacto", "Mitigação"],
    [
        ["Rejeição/banimento AdSense por conteúdo sensível", "Média", "Alto",
         "Anúncios só em páginas safe; zona adulta fora; análise manual prévia das páginas com capa sensível"],
        ["Conteúdo considerado \"thin\" pelo Google", "Média", "Médio",
         "Camada editorial própria (resenhas, guias); evitar páginas-duplicata de franquia"],
        ["Tráfego crescer devagar", "Alta", "Médio",
         "SEO técnico já ok; foco em conteúdo que responde buscas de compra; PWA para retenção"],
        ["Dependência de APIs gratuitas (AniList/Kitsu caem)", "Baixa", "Médio",
         "Já mitigada: cache local, snapshot restaurável e fallback entre fontes"],
        ["Banco corrompido / perda de catálogo", "Baixa", "Alto",
         "Backup diário verificado + WAL checkpoint + auto-restauração (ativados nesta auditoria)"],
        ["Programa de afiliados altera comissões", "Média", "Baixo",
         "Diversificar 2-3 programas desde o início; comparar preço entre lojas por obra"],
    ],
    [0.30, 0.13, 0.11, 0.46],
))
story.append(Paragraph("Tabela 6 — Matriz de riscos da monetização com mitigações correspondentes.", caption))
story.append(Paragraph(
    "Em síntese: a monetização do OtakuVerse é uma questão de sequência e disciplina, não de viabilidade. "
    "A fundação técnica que já existe — catálogo real de 40 mil obras, carregamento em fases, PWA, "
    "segurança e resiliência — é o ativo difícil de copiar; as camadas de receita são as partes fáceis, "
    "desde que cheguem depois do público e nunca contaminem a confiança construída. Registrado o domínio "
    "e publicado o site, o caminho das fases 1 a 3 fica inteiramente dentro do alcance do projeto, "
    "mantendo o custo operacional próximo de zero, como exige a premissa de custo zero do OtakuVerse.", body))

# ── Build ────────────────────────────────────────────────────────────────────
doc = TocDocTemplate(
    OUT, pagesize=A4,
    leftMargin=MARGIN, rightMargin=MARGIN, topMargin=MARGIN, bottomMargin=MARGIN,
    title=DOC_TITLE, author="Z.ai", creator="Z.ai",
    subject="Auditoria de viabilidade de monetização do OtakuVerse",
)
doc.multiBuild(story, onFirstPage=on_page, onLaterPages=on_page)
print("OK:", OUT)

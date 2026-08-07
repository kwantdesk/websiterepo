from __future__ import annotations

import math
import os
from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image
from reportlab.lib.colors import Color, HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path(r"C:\Users\Karen\Documents\QUANT DESK\kwantdesk-websiterepo")
OUT_DIR = ROOT / "output" / "pdf"
TMP_DIR = ROOT / "tmp" / "pdfs"
OUT_DIR.mkdir(parents=True, exist_ok=True)
TMP_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT = OUT_DIR / "Kwant_Desk_Product_Overview.pdf"
WORDMARK_WEBP = ROOT / "public" / "images" / "kwantdesk-wordmark.webp"
WORDMARK_PNG = TMP_DIR / "kwantdesk-wordmark.png"

PAGE_W, PAGE_H = A4
M = 42

BG = HexColor("#070707")
BG_ALT = HexColor("#0B0A08")
CARD = HexColor("#11100D")
CARD_2 = HexColor("#15130F")
BORDER = HexColor("#2F2A20")
GOLD = HexColor("#D6B45F")
GOLD_LIGHT = HexColor("#F0D990")
CREAM = HexColor("#F4F1E8")
WHITE = HexColor("#FFFFFF")
TEXT = HexColor("#D8D3C7")
MUTED = HexColor("#8F8A80")
DIM = HexColor("#605C55")
GREEN = HexColor("#6ED3A0")
RED = HexColor("#FF7F73")
CYAN = HexColor("#61C6D7")
BLUE = HexColor("#75A7FF")
PURPLE = HexColor("#B296FF")


def register_fonts() -> None:
    candidates = {
        "KD-Regular": [
            Path(r"C:\Windows\Fonts\segoeui.ttf"),
            ROOT / "node_modules" / "next" / "dist" / "compiled" / "@vercel" / "og" / "Geist-Regular.ttf",
        ],
        "KD-Semibold": [
            Path(r"C:\Windows\Fonts\seguisb.ttf"),
            Path(r"C:\Windows\Fonts\segoeuib.ttf"),
        ],
        "KD-Bold": [
            Path(r"C:\Windows\Fonts\segoeuib.ttf"),
            Path(r"C:\Windows\Fonts\seguisb.ttf"),
        ],
        "KD-Mono": [
            Path(r"C:\Windows\Fonts\consola.ttf"),
            Path(r"C:\Windows\Fonts\cour.ttf"),
        ],
    }
    for name, paths in candidates.items():
        for path in paths:
            if path.exists():
                pdfmetrics.registerFont(TTFont(name, str(path)))
                break
        else:
            raise FileNotFoundError(f"No font found for {name}")


register_fonts()


def prep_wordmark() -> None:
    if WORDMARK_WEBP.exists():
        image = Image.open(WORDMARK_WEBP).convert("RGBA")
        image.save(WORDMARK_PNG)


prep_wordmark()


def style(
    name: str,
    size: float,
    leading: float | None = None,
    color=TEXT,
    font: str = "KD-Regular",
    align=TA_LEFT,
    space_after: float = 0,
) -> ParagraphStyle:
    return ParagraphStyle(
        name,
        fontName=font,
        fontSize=size,
        leading=leading or size * 1.35,
        textColor=color,
        alignment=align,
        spaceAfter=space_after,
    )


BODY = style("body", 9.2, 13.7)
BODY_SMALL = style("body_small", 8.0, 11.6, MUTED)
BODY_TINY = style("body_tiny", 6.8, 9.2, MUTED)
BODY_WHITE = style("body_white", 9.2, 13.7, CREAM)
H1 = style("h1", 25, 29, CREAM, "KD-Semibold")
H2 = style("h2", 14, 17, CREAM, "KD-Semibold")
H3 = style("h3", 10.5, 13, GOLD_LIGHT, "KD-Semibold")
LABEL = style("label", 6.7, 8.4, GOLD, "KD-Bold")
MONO = style("mono", 7.2, 9.5, GOLD_LIGHT, "KD-Mono")
CENTER_BODY = style("center_body", 10, 15, TEXT, "KD-Regular", TA_CENTER)
CENTER_SMALL = style("center_small", 7.8, 11, MUTED, "KD-Regular", TA_CENTER)


def rounded_rect(c: canvas.Canvas, x, y, w, h, radius=10, fill=CARD, stroke=BORDER, width=0.8):
    c.setLineWidth(width)
    c.setStrokeColor(stroke)
    c.setFillColor(fill)
    c.roundRect(x, y, w, h, radius, stroke=1, fill=1)


def para(c: canvas.Canvas, text: str, x, top, width, pstyle=BODY, max_height=700):
    safe = escape(text).replace("\n", "<br/>")
    p = Paragraph(safe, pstyle)
    w, h = p.wrap(width, max_height)
    p.drawOn(c, x, top - h)
    return top - h, h


def rich_para(c: canvas.Canvas, markup: str, x, top, width, pstyle=BODY, max_height=700):
    p = Paragraph(markup, pstyle)
    w, h = p.wrap(width, max_height)
    p.drawOn(c, x, top - h)
    return top - h, h


def bullet_list(c: canvas.Canvas, items, x, top, width, pstyle=BODY, gap=6, bullet_color=GOLD):
    y = top
    for item in items:
        c.setFillColor(bullet_color)
        c.circle(x + 3, y - 6.3, 1.8, stroke=0, fill=1)
        y2, h = para(c, item, x + 13, y, width - 13, pstyle)
        y = y2 - gap
    return y


def section_label(c: canvas.Canvas, text: str, x, top):
    c.setFillColor(GOLD)
    c.roundRect(x, top - 15, 4, 15, 2, stroke=0, fill=1)
    c.setFillColor(GOLD)
    c.setFont("KD-Bold", 7)
    c.drawString(x + 11, top - 11, text.upper())


def page_base(c: canvas.Canvas, page_num: int, title: str, section: str, alt=False):
    c.setFillColor(BG_ALT if alt else BG)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    c.setFillColor(CARD_2)
    c.rect(0, PAGE_H - 18, PAGE_W, 18, stroke=0, fill=1)
    c.setFillColor(GOLD)
    c.rect(0, PAGE_H - 18, 70, 1.5, stroke=0, fill=1)
    c.setFont("KD-Bold", 6.6)
    c.setFillColor(GOLD)
    c.drawString(M, PAGE_H - 36, section.upper())
    c.setFont("KD-Regular", 6.6)
    c.setFillColor(MUTED)
    c.drawRightString(PAGE_W - M, PAGE_H - 36, f"KWANT DESK  /  PRODUCT OVERVIEW  /  JULY 2026")
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.6)
    c.line(M, 27, PAGE_W - M, 27)
    c.setFont("KD-Regular", 6.5)
    c.setFillColor(DIM)
    c.drawString(M, 15, title.upper())
    c.setFont("KD-Mono", 6.5)
    c.setFillColor(GOLD)
    c.drawRightString(PAGE_W - M, 15, f"{page_num:02d}")


def page_title(c: canvas.Canvas, eyebrow: str, title: str, intro: str | None = None):
    section_label(c, eyebrow, M, PAGE_H - 61)
    y, _ = para(c, title, M, PAGE_H - 88, PAGE_W - 2 * M, H1)
    if intro:
        y -= 9
        y, _ = para(c, intro, M, y, PAGE_W - 2 * M, style("intro", 10.2, 15.2, TEXT))
    return y - 16


def card(c: canvas.Canvas, x, top, w, h, title: str, text: str, index: str | None = None, accent=GOLD):
    y = top - h
    rounded_rect(c, x, y, w, h, 11)
    if index:
        c.setFillColor(accent)
        c.circle(x + 21, top - 23, 10, stroke=0, fill=1)
        c.setFillColor(BG)
        c.setFont("KD-Bold", 7)
        c.drawCentredString(x + 21, top - 25.5, index)
        tx = x + 39
    else:
        c.setFillColor(accent)
        c.roundRect(x + 14, top - 25, 4, 13, 2, stroke=0, fill=1)
        tx = x + 27
    c.setFillColor(CREAM)
    c.setFont("KD-Semibold", 10.5)
    c.drawString(tx, top - 23, title)
    para(c, text, x + 15, top - 40, w - 30, BODY_SMALL)


def callout(c: canvas.Canvas, x, top, w, text: str, label: str = "THE KWANT DESK PRINCIPLE"):
    p = Paragraph(escape(text), style("callout", 11.5, 17, CREAM, "KD-Semibold"))
    _, ph = p.wrap(w - 40, 500)
    h = ph + 55
    y = top - h
    rounded_rect(c, x, y, w, h, 14, CARD_2, GOLD, 1.0)
    c.setFillColor(GOLD)
    c.setFont("KD-Bold", 6.4)
    c.drawString(x + 20, top - 21, label)
    p.drawOn(c, x + 20, top - 39 - ph)
    return y


def stat_box(c, x, top, w, value, label, accent=GOLD):
    h = 70
    rounded_rect(c, x, top - h, w, h, 10, CARD, BORDER)
    c.setFont("KD-Semibold", 19)
    c.setFillColor(accent)
    c.drawString(x + 15, top - 31, value)
    c.setFont("KD-Regular", 7.2)
    c.setFillColor(MUTED)
    c.drawString(x + 15, top - 49, label.upper())


def top_rule(c, x, top, w, accent=GOLD):
    c.setStrokeColor(accent)
    c.setLineWidth(1.4)
    c.line(x, top, x + w, top)


def draw_brand_mark(c, x, y, w):
    if WORDMARK_PNG.exists():
        with Image.open(WORDMARK_PNG) as im:
            ratio = im.height / im.width
        c.drawImage(ImageReader(str(WORDMARK_PNG)), x, y, width=w, height=w * ratio, mask="auto")
    else:
        c.setFillColor(CREAM)
        c.setFont("KD-Semibold", 28)
        c.drawString(x, y, "kwant desk")


def draw_particles(c):
    c.saveState()
    c.setLineWidth(0.35)
    for row in range(8):
        path = c.beginPath()
        base = 95 + row * 13
        for i in range(0, 80):
            x = i / 79 * PAGE_W
            y = base + 18 * math.sin(i * 0.26 + row * 0.75) + 7 * math.sin(i * 0.08)
            if i == 0:
                path.moveTo(x, y)
            else:
                path.lineTo(x, y)
        c.setStrokeColor(Color(GOLD.red, GOLD.green, GOLD.blue, alpha=0.16 + row * 0.02))
        c.drawPath(path, stroke=1, fill=0)
    for i in range(165):
        x = (i * 47) % int(PAGE_W)
        y = 63 + ((i * 31) % 160)
        wave = 14 * math.sin(x * 0.03)
        c.setFillColor(Color(1, 1, 1, alpha=0.06 + (i % 4) * 0.02))
        c.circle(x, y + wave, 0.7 + (i % 3) * 0.25, stroke=0, fill=1)
    c.restoreState()


def cover(c):
    c.setFillColor(BG)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    draw_particles(c)
    c.setFillColor(GOLD)
    c.rect(M, PAGE_H - 62, 58, 2, stroke=0, fill=1)
    c.setFillColor(MUTED)
    c.setFont("KD-Bold", 7)
    c.drawString(M, PAGE_H - 82, "PRODUCT OVERVIEW  /  JULY 2026")
    draw_brand_mark(c, M, PAGE_H - 202, 285)
    y, _ = para(
        c,
        "The complete decision environment for futures and options traders.",
        M,
        PAGE_H - 248,
        430,
        style("cover_title", 27, 32, CREAM, "KD-Semibold"),
    )
    y -= 18
    para(
        c,
        "See where the market may be forced to react, understand why those locations matter, and know what evidence should confirm or invalidate the trade - before risk is committed.",
        M,
        y,
        415,
        style("cover_body", 11, 17, TEXT),
    )
    c.setFillColor(CARD_2)
    c.roundRect(M, 235, PAGE_W - 2 * M, 68, 12, stroke=0, fill=1)
    c.setStrokeColor(BORDER)
    c.roundRect(M, 235, PAGE_W - 2 * M, 68, 12, stroke=1, fill=0)
    labels = [
        ("PREPARE", "Session map"),
        ("OBSERVE", "Live context"),
        ("CONFIRM", "Evidence"),
        ("REVIEW", "Receipts"),
        ("IMPROVE", "Memory"),
    ]
    col_w = (PAGE_W - 2 * M) / len(labels)
    for i, (a, b) in enumerate(labels):
        x = M + i * col_w
        if i:
            c.setStrokeColor(BORDER)
            c.line(x, 247, x, 291)
        c.setFillColor(GOLD)
        c.setFont("KD-Bold", 6.5)
        c.drawCentredString(x + col_w / 2, 277, a)
        c.setFillColor(TEXT)
        c.setFont("KD-Regular", 8)
        c.drawCentredString(x + col_w / 2, 258, b)
    c.setFont("KD-Mono", 6.6)
    c.setFillColor(DIM)
    c.drawString(M, 34, "KWANTDESK.COM")
    c.drawRightString(PAGE_W - M, 34, "PRIVATE MARKET INTELLIGENCE WORKSPACE")
    c.showPage()


def overview(c):
    page_base(c, 2, "Executive overview", "The proposition", alt=True)
    y = page_title(
        c,
        "Executive overview",
        "One platform. One market narrative. Better decisions.",
        "Kwant Desk brings live futures charts, options positioning, pre-session planning, event risk, market interpretation, and evidence-based review into a single professional workspace.",
    )
    y = callout(
        c,
        M,
        y,
        PAGE_W - 2 * M,
        "We show traders where the market may be forced to react, why the location matters, and what to look for when price arrives.",
    ) - 19
    gap = 12
    w = (PAGE_W - 2 * M - gap) / 2
    card(
        c,
        M,
        y,
        w,
        120,
        "What the trader receives",
        "A live map of price, positioning, pressure, catalysts, scenarios, and prior evidence - organised around the next decision rather than the next data point.",
        "01",
    )
    card(
        c,
        M + w + gap,
        y,
        w,
        120,
        "What changes",
        "Preparation becomes faster. Market context becomes visible. Trade ideas become conditional. Reviews become measurable. The platform remembers what the trader would otherwise forget.",
        "02",
    )
    y -= 139
    c.setFillColor(CREAM)
    c.setFont("KD-Semibold", 13)
    c.drawString(M, y, "The commercial promise")
    y -= 18
    bullet_list(
        c,
        [
            "Reduce the gap between complex market data and an executable trading decision.",
            "Replace fragmented tabs, static levels, and hindsight commentary with one live operating picture.",
            "Make every important level explainable: why it exists, what a hold means, and what a break means.",
            "Give every session a plan, every live update a context, and every completed idea a receipt.",
            "Serve newer traders in seconds while preserving the depth professional users expect.",
        ],
        M,
        y,
        PAGE_W - 2 * M,
    )
    c.showPage()


def problems(c):
    page_base(c, 3, "Problems solved", "Why Kwant Desk exists")
    y = page_title(
        c,
        "Problems solved",
        "Trading does not suffer from a shortage of data. It suffers from a shortage of usable context.",
        "Most traders already have charts, calendars, news, options feeds, and opinions. The difficult part is deciding what matters now, how the pieces relate, and whether the market is actually confirming the idea.",
    )
    rows = [
        (
            "Fragmented information",
            "Charts, flow, events, levels, and notes live in separate tools.",
            "One connected decision workspace keeps the evidence in view.",
        ),
        (
            "Naked levels",
            "A number on a chart gives no reason to trust, fade, or break it.",
            "Every level carries purpose, source, strength, and hold/break logic.",
        ),
        (
            "Reactive preparation",
            "The plan is written after the move or abandoned when volatility rises.",
            "Gameplan frames both sides before the session begins.",
        ),
        (
            "Options opacity",
            "Gamma and flow data can be difficult to translate into price decisions.",
            "Options positioning is converted into visible structure and plain language.",
        ),
        (
            "Short memory",
            "Traders forget prior reactions, invalidate their own rules, and repeat mistakes.",
            "Journals, level memory, and post-outcome reviews preserve the evidence.",
        ),
        (
            "Unaccountable analysis",
            "Commentary can sound intelligent without being testable.",
            "Calls are timestamped, outcomes are reviewed, and reasoning quality is graded.",
        ),
    ]
    top = y
    row_h = 86
    widths = [135, 178, 199]
    headers = ["THE PROBLEM", "WHAT IT COSTS", "WHAT KWANT DESK CHANGES"]
    x = M
    for i, h in enumerate(headers):
        c.setFillColor(GOLD if i == 2 else MUTED)
        c.setFont("KD-Bold", 6.4)
        c.drawString(x + 8, top - 10, h)
        x += widths[i]
    top -= 22
    for r, (a, b, d) in enumerate(rows):
        y0 = top - r * row_h
        c.setFillColor(CARD if r % 2 == 0 else CARD_2)
        c.roundRect(M, y0 - row_h + 4, sum(widths), row_h - 6, 7, stroke=0, fill=1)
        c.setStrokeColor(BORDER)
        c.roundRect(M, y0 - row_h + 4, sum(widths), row_h - 6, 7, stroke=1, fill=0)
        x = M
        para(c, a, x + 9, y0 - 13, widths[0] - 18, H3)
        x += widths[0]
        para(c, b, x + 9, y0 - 13, widths[1] - 18, BODY_SMALL)
        x += widths[1]
        para(c, d, x + 9, y0 - 13, widths[2] - 18, BODY_SMALL)
    c.showPage()


def platform_map(c):
    page_base(c, 4, "Platform map", "What the platform provides", alt=True)
    y = page_title(
        c,
        "Platform map",
        "Seven connected product areas. One continuous trading workflow.",
        "Each area answers a different question. Together they create a market operating system rather than a collection of disconnected features.",
    )
    center_x = PAGE_W / 2
    center_y = 395
    c.setFillColor(CARD_2)
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.2)
    c.circle(center_x, center_y, 67, stroke=1, fill=1)
    c.setFillColor(GOLD)
    c.setFont("KD-Bold", 9)
    c.drawCentredString(center_x, center_y + 10, "THE NEXT")
    c.drawCentredString(center_x, center_y - 4, "TRADING")
    c.drawCentredString(center_x, center_y - 18, "DECISION")
    nodes = [
        ("CHARTS", "What is price doing?", 90),
        ("GAMMA", "Where is options pressure?", 39),
        ("GEXMAP", "How is exposure distributed?", -12),
        ("GAMEPLAN", "What matters this session?", -63),
        ("KWANTBOT", "What is changing now?", -114),
        ("NEWS", "What can disrupt the map?", -165),
        ("MEMORY", "What did we learn?", 141),
    ]
    radius = 205
    for i, (title, question, deg) in enumerate(nodes):
        angle = math.radians(deg)
        nx = center_x + radius * math.cos(angle)
        ny = center_y + radius * math.sin(angle)
        c.setStrokeColor(BORDER)
        c.setLineWidth(0.8)
        c.line(
            center_x + 69 * math.cos(angle),
            center_y + 69 * math.sin(angle),
            nx - 53 * math.cos(angle),
            ny - 29 * math.sin(angle),
        )
        w = 134
        h = 64
        rounded_rect(c, nx - w / 2, ny - h / 2, w, h, 10, CARD, BORDER)
        c.setFillColor(GOLD)
        c.setFont("KD-Bold", 7.2)
        c.drawCentredString(nx, ny + 8, title)
        para(c, question, nx - w / 2 + 10, ny - 1, w - 20, CENTER_SMALL)
    c.setFillColor(MUTED)
    c.setFont("KD-Regular", 7.5)
    c.drawCentredString(
        PAGE_W / 2,
        80,
        "The user moves through the questions. The platform keeps the context connected.",
    )
    c.showPage()


def workflow(c):
    page_base(c, 5, "The operating loop", "From preparation to improvement")
    y = page_title(
        c,
        "The operating loop",
        "A disciplined loop for every session.",
        "Kwant Desk is designed around how strong decisions are actually made: prepare the map, observe live behaviour, demand confirmation, review the outcome, and improve the next decision.",
    )
    steps = [
        ("01", "PREPARE", "Open the session Gameplan. Understand the environment, key levels, scenarios, and scheduled catalysts."),
        ("02", "MAP", "Place options and Gameplan structure onto the relevant futures chart. Know where the next decision lives."),
        ("03", "OBSERVE", "Track live price, options positioning, exposure changes, event risk, and proximity to important levels."),
        ("04", "CONFIRM", "Use the printed reaction - not the level alone - as permission. A hold and a break have different implications."),
        ("05", "ACT", "Express the trade only when the market confirms the scenario and the invalidation is clear."),
        ("06", "REVIEW", "Record what happened, compare it with the original reasoning, and preserve the result as evidence."),
        ("07", "IMPROVE", "Carry forward the lesson through level memory, recurring blind spots, and explicit next-time rules."),
    ]
    top = y
    h = 72
    for i, (num, title, text) in enumerate(steps):
        y0 = top - i * (h + 7)
        rounded_rect(c, M, y0 - h, PAGE_W - 2 * M, h, 9, CARD if i % 2 == 0 else CARD_2, BORDER)
        c.setFillColor(GOLD)
        c.circle(M + 27, y0 - 36, 16, stroke=0, fill=1)
        c.setFillColor(BG)
        c.setFont("KD-Bold", 7.5)
        c.drawCentredString(M + 27, y0 - 39, num)
        c.setFillColor(CREAM)
        c.setFont("KD-Semibold", 9.5)
        c.drawString(M + 56, y0 - 25, title)
        para(c, text, M + 56, y0 - 36, PAGE_W - 2 * M - 73, BODY_SMALL)
    c.showPage()


def charts_page(c):
    page_base(c, 6, "Live futures charts", "Charts")
    y = page_title(
        c,
        "Live futures charts",
        "A professional market canvas built around the way futures traders work.",
        "Kwant Desk combines live price, historical context, flexible time construction, multi-chart layouts, and decision levels without forcing the trader to leave the workspace.",
    )
    stat_w = (PAGE_W - 2 * M - 24) / 3
    stat_box(c, M, y, stat_w, "30", "Core futures instruments")
    stat_box(c, M + stat_w + 12, y, stat_w, "5 DAYS", "Immediately available chart history", CYAN)
    stat_box(c, M + 2 * (stat_w + 12), y, stat_w, "LIVE", "Price and watchlist context", GREEN)
    y -= 92
    w = (PAGE_W - 2 * M - 12) / 2
    card(
        c,
        M,
        y,
        w,
        140,
        "Market coverage",
        "Equity index futures and micros, energy, metals, rates, foreign exchange, and agriculture - including ES, NQ, YM, RTY, MES, MNQ, CL, GC, ZN, 6E, and the wider core set.",
        "01",
    )
    card(
        c,
        M + w + 12,
        y,
        w,
        140,
        "Live watchlist",
        "Monitor the instruments that matter with Last, Change, and Change percent. Add or remove markets so the watchlist reflects the trader's actual focus.",
        "02",
    )
    y -= 157
    card(
        c,
        M,
        y,
        w,
        140,
        "Time construction",
        "Use seconds, minutes, hours, daily, weekly, and monthly bars. Advanced traders can also work with range, volume, trade, Renko, point-and-figure, and delta-based views.",
        "03",
    )
    card(
        c,
        M + w + 12,
        y,
        w,
        140,
        "Decision overlays",
        "Switch Gamma levels and Gameplan levels on or off directly from the chart. Important market structure becomes part of the price view rather than a separate note.",
        "04",
    )
    y -= 163
    callout(
        c,
        M,
        y,
        PAGE_W - 2 * M,
        "The chart is not treated as the product. It is the canvas on which positioning, preparation, and live evidence become visible.",
        "WHY THIS MATTERS",
    )
    c.showPage()


def workspaces_page(c):
    page_base(c, 7, "Workspaces and control", "Charts", alt=True)
    y = page_title(
        c,
        "Workspaces and control",
        "Build the screen around the decision, not the other way around.",
        "From a single focused chart to a multi-market command screen, workspaces can be arranged, resized, saved, exported, imported, and restored.",
    )
    # Workspace diagram
    panel_top = y
    panel_h = 248
    rounded_rect(c, M, panel_top - panel_h, PAGE_W - 2 * M, panel_h, 12, HexColor("#090909"), BORDER)
    px = M + 16
    py = panel_top - 44
    pw = PAGE_W - 2 * M - 32
    ph = 80
    for r in range(2):
        for col in range(2):
            x = px + col * (pw / 2 + 4)
            yy = py - r * (ph + 8)
            ww = pw / 2 - 4
            rounded_rect(c, x, yy - ph, ww, ph, 6, CARD_2, BORDER)
            c.setStrokeColor(Color(GOLD.red, GOLD.green, GOLD.blue, alpha=0.45))
            path = c.beginPath()
            for j in range(16):
                xx = x + 12 + j * (ww - 24) / 15
                val = yy - ph / 2 + 12 * math.sin(j * 0.7 + r + col) + (j - 8) * 0.35
                if j == 0:
                    path.moveTo(xx, val)
                else:
                    path.lineTo(xx, val)
            c.drawPath(path, stroke=1, fill=0)
    c.setFillColor(GOLD)
    c.setFont("KD-Bold", 7)
    c.drawString(M + 17, panel_top - 20, "SAVED WORKSPACE  /  QUAD MARKET VIEW")
    c.setFillColor(MUTED)
    c.setFont("KD-Mono", 6.2)
    c.drawRightString(PAGE_W - M - 17, panel_top - 20, "LOCKED  /  UTC+10")
    y = panel_top - panel_h - 20
    items = [
        ("Flexible layouts", "Single, side-by-side, stacked, quad, and custom arrangements."),
        ("Chart control", "Add, remove, reorder, resize, and lock panels as the workflow changes."),
        ("Workspace persistence", "Quick-save, Save As, import, and export preserve the working environment."),
        ("Drawing suite", "Trend, ray, horizontal, vertical, Fibonacci, shape, note, measurement, position, and anchored VWAP tools."),
        ("Fast interval entry", "Press the keyboard shortcut, type the interval, and move immediately to the required view."),
        ("Portable levels", "Export Gamma and Gameplan levels by instrument as JSON, CSV, or DeepChart XML."),
    ]
    gap = 10
    w = (PAGE_W - 2 * M - gap) / 2
    h = 80
    for i, (title, text) in enumerate(items):
        col = i % 2
        row = i // 2
        card(c, M + col * (w + gap), y - row * (h + 8), w, h, title, text)
    c.showPage()


def gamma_page(c):
    page_base(c, 8, "Gamma intelligence", "Options intelligence")
    y = page_title(
        c,
        "Gamma intelligence",
        "Translate the options market into futures decision structure.",
        "Kwant Desk turns options exposure, expiry pressure, premium movement, and same-day positioning into a readable map of the forces surrounding price.",
    )
    left = M
    chart_top = y
    chart_h = 225
    chart_w = 320
    rounded_rect(c, left, chart_top - chart_h, chart_w, chart_h, 12, CARD, BORDER)
    c.setFillColor(GOLD)
    c.setFont("KD-Bold", 6.5)
    c.drawString(left + 16, chart_top - 21, "EXPOSURE BY STRIKE  /  CALLS + PUTS")
    mid = left + 155
    c.setStrokeColor(DIM)
    c.line(mid, chart_top - 45, mid, chart_top - chart_h + 20)
    strikes = [27900, 27950, 28000, 28050, 28100, 28150, 28200]
    values = [-55, -30, 42, 85, 58, -24, 67]
    for i, (strike, val) in enumerate(zip(strikes, values)):
        yy = chart_top - 59 - i * 21
        c.setFillColor(MUTED)
        c.setFont("KD-Mono", 5.8)
        c.drawRightString(left + 60, yy - 2, str(strike))
        c.setFillColor(GREEN if val >= 0 else RED)
        if val >= 0:
            c.rect(mid, yy - 6, val * 1.25, 9, stroke=0, fill=1)
        else:
            c.rect(mid + val * 1.25, yy - 6, abs(val) * 1.25, 9, stroke=0, fill=1)
    right_x = M + chart_w + 14
    right_w = PAGE_W - M - right_x
    stat_box(c, right_x, chart_top, right_w, "POSITIVE", "Gamma environment", GREEN)
    stat_box(c, right_x, chart_top - 82, right_w, "0DTE", "Same-day positioning", GOLD)
    stat_box(c, right_x, chart_top - 164, right_w, "LIVE", "Market translation", CYAN)
    y = chart_top - chart_h - 21
    items = [
        ("GEX", "Dealer gamma exposure per one percent market move."),
        ("DEX", "Directional delta concentration across the options surface."),
        ("VEX", "Sensitivity of delta to changes in implied volatility."),
        ("CHEX", "Time-driven change in delta as expiry approaches."),
        ("Key levels", "Walls, magnets, centres, supports, and ranked concentration zones."),
        ("Expected move", "A practical range reference for the current options structure."),
    ]
    w = (PAGE_W - 2 * M - 12) / 2
    h = 79
    for i, (title, text) in enumerate(items):
        col = i % 2
        row = i // 2
        card(c, M + col * (w + 12), y - row * (h + 8), w, h, title, text)
    c.showPage()


def options_tape_page(c):
    page_base(c, 9, "Options flow and tape", "Options intelligence", alt=True)
    y = page_title(
        c,
        "Options flow and tape",
        "See the positioning, the premium, and the urgency behind the move.",
        "The Options Flow workspace combines structural exposure with the live activity that can change the short-term market narrative.",
    )
    left_w = 210
    top = y
    card(
        c,
        M,
        top,
        left_w,
        142,
        "Consolidated options tape",
        "Review sweeps, blocks, and split executions with time, call or put, expiry, strike, size, premium, trade side, sentiment, and notable flags.",
        "01",
    )
    card(
        c,
        M,
        top - 156,
        left_w,
        142,
        "Premium drift",
        "Track cumulative premium movement through the session to understand whether the flow is building, reversing, or losing urgency.",
        "02",
    )
    card(
        c,
        M,
        top - 312,
        left_w,
        142,
        "Expiry pressure",
        "Compare exposure across expirations and identify when same-day options are dominating the visible market structure.",
        "03",
    )
    tx = M + left_w + 14
    tw = PAGE_W - M - tx
    rounded_rect(c, tx, top - 454, tw, 454, 12, CARD, BORDER)
    c.setFillColor(GOLD)
    c.setFont("KD-Bold", 6.5)
    c.drawString(tx + 15, top - 20, "LIVE CONSOLIDATED TAPE")
    headers = ["TIME", "TYPE", "C/P", "STRIKE", "SIZE", "PREMIUM", "SIDE"]
    col_x = [0, 50, 92, 121, 170, 214, 268]
    c.setFont("KD-Bold", 5.4)
    for j, head in enumerate(headers):
        c.setFillColor(MUTED)
        c.drawString(tx + 14 + col_x[j], top - 45, head)
    tape = [
        ("09:34:11", "SWEEP", "C", "28100", "240", "$1.21m", "ASK"),
        ("09:36:09", "BLOCK", "P", "27900", "800", "$2.84m", "MID"),
        ("09:41:32", "SPLIT", "C", "28200", "360", "$920k", "ASK"),
        ("09:44:06", "SWEEP", "P", "27850", "510", "$1.73m", "BID"),
        ("09:48:53", "BLOCK", "C", "28050", "420", "$1.09m", "MID"),
        ("09:51:17", "SWEEP", "C", "28300", "610", "$2.35m", "ASK"),
        ("09:56:45", "SPLIT", "P", "28000", "275", "$740k", "BID"),
        ("10:02:21", "SWEEP", "C", "28150", "330", "$1.14m", "ASK"),
    ]
    for i, row in enumerate(tape):
        yy = top - 68 - i * 38
        c.setFillColor(CARD_2 if i % 2 == 0 else BG_ALT)
        c.roundRect(tx + 10, yy - 19, tw - 20, 30, 4, stroke=0, fill=1)
        for j, val in enumerate(row):
            c.setFillColor(
                GREEN
                if (j == 6 and val == "ASK") or (j == 2 and val == "C")
                else RED
                if (j == 6 and val == "BID") or (j == 2 and val == "P")
                else TEXT
            )
            c.setFont("KD-Mono", 5.8)
            c.drawString(tx + 14 + col_x[j], yy - 9, val)
    para(
        c,
        "The objective is not to chase every print. It is to see when live activity confirms, challenges, or shifts the positioning already visible in the map.",
        tx + 15,
        top - 392,
        tw - 30,
        BODY_SMALL,
    )
    c.showPage()


def gexmap_page(c):
    page_base(c, 10, "GEXMAP", "Exposure mapping")
    y = page_title(
        c,
        "GEXMAP",
        "See where exposure is concentrated - and how it evolves.",
        "GEXMAP presents signed options exposure by strike across three configurable panels. It lets the trader compare instruments, Greeks, and moments in time without reducing the options surface to a single number.",
    )
    top = y
    panel_gap = 9
    panel_w = (PAGE_W - 2 * M - 2 * panel_gap) / 3
    panel_h = 315
    labels = [("NQ", "GEX"), ("ES", "DEX"), ("NQ", "VEX")]
    for p, (inst, greek) in enumerate(labels):
        x = M + p * (panel_w + panel_gap)
        rounded_rect(c, x, top - panel_h, panel_w, panel_h, 9, CARD, BORDER)
        c.setFillColor(GOLD)
        c.setFont("KD-Bold", 6.4)
        c.drawString(x + 11, top - 20, f"{inst}  /  {greek}")
        center = x + panel_w / 2
        c.setStrokeColor(DIM)
        c.line(center, top - 39, center, top - panel_h + 22)
        for i in range(10):
            yy = top - 55 - i * 23
            val = math.sin(i * 1.7 + p) * 0.9
            length = abs(val) * 52
            c.setFillColor(GREEN if val >= 0 else RED)
            if val >= 0:
                c.rect(center, yy, length, 8, stroke=0, fill=1)
            else:
                c.rect(center - length, yy, length, 8, stroke=0, fill=1)
            c.setFillColor(MUTED)
            c.setFont("KD-Mono", 5.3)
            c.drawRightString(x + 30, yy + 1, str(27750 + i * 50))
    y = top - panel_h - 18
    items = [
        ("Three simultaneous views", "Compare different instruments or Greeks without losing the common price context."),
        ("Flexible exposure lens", "Switch between Gamma, Delta, Vanna, and Charm exposure."),
        ("Time-frame evolution", "Step through short intervals to see where exposure is building or decaying."),
        ("Replay and scrub", "Move through an earlier session, pause at key moments, and compare structure with what price did next."),
        ("Positive and negative intensity", "Signed exposure is visually separated so concentration and polarity remain clear."),
        ("Theme-matched presentation", "The map follows the active workspace theme without sacrificing analytical contrast."),
    ]
    w = (PAGE_W - 2 * M - 10) / 2
    h = 74
    for i, (title, text) in enumerate(items):
        col = i % 2
        row = i // 2
        card(c, M + col * (w + 10), y - row * (h + 7), w, h, title, text)
    c.showPage()


def gameplan_overview(c):
    page_base(c, 11, "Gameplan", "Pre-session intelligence", alt=True)
    y = page_title(
        c,
        "Gameplan",
        "Know the map before the session begins.",
        "Gameplan is the pre-session decision layer for NQ and ES. It converts market structure into a concise briefing that is understandable in 30 seconds and deep enough to guide a full session.",
    )
    y = callout(
        c,
        M,
        y,
        PAGE_W - 2 * M,
        "The plan earns nothing until a level prints its reaction - the map is the map, the print is the permission.",
        "THE PERMANENT CONSCIENCE LINE",
    ) - 17
    stat_w = (PAGE_W - 2 * M - 24) / 3
    stat_box(c, M, y, stat_w, "2", "Session editions")
    stat_box(c, M + stat_w + 12, y, stat_w, "6-14", "Fused decision levels", CYAN)
    stat_box(c, M + 2 * (stat_w + 12), y, stat_w, "BOTH", "Bull and bear scenarios", GREEN)
    y -= 92
    items = [
        ("Pre-Globex and pre-New York", "Use the edition that matches the session being traded."),
        ("Live one-liner", "A concise market read refreshes every five minutes with current price and the nearest decision."),
        ("Session ladder", "See all important levels in order with a live animated YOU ARE HERE marker."),
        ("Market environment", "Volatility, tape character, fear, flow, and expiry pressure define the session backdrop."),
        ("Scenario roads", "Each path includes trigger, projected path, kill condition, and relative weight."),
        ("THE ONE TRADE", "A single high-conviction conditional setup with permission, invalidation, and targets."),
        ("Receipts", "Yesterday's map is graded honestly: held, broke, or remained untested."),
        ("Progressive depth", "Beginner, Standard, and Pro views reveal the amount of explanation each user wants."),
    ]
    w = (PAGE_W - 2 * M - 10) / 2
    h = 80
    for i, (title, text) in enumerate(items):
        col = i % 2
        row = i // 2
        card(c, M + col * (w + 10), y - row * (h + 8), w, h, title, text)
    c.showPage()


def level_anatomy(c):
    page_base(c, 12, "Anatomy of a useful level", "Gameplan")
    y = page_title(
        c,
        "Anatomy of a useful level",
        "No naked numbers.",
        "A Kwant Desk level is not simply a price. It is a compact decision object: a location, a reason, a behavioural expectation, and an explicit invalidation.",
    )
    top = y
    left_w = 214
    rounded_rect(c, M, top - 440, left_w, 440, 14, CARD, GOLD, 1.0)
    c.setFillColor(GOLD)
    c.setFont("KD-Bold", 6.4)
    c.drawString(M + 18, top - 24, "LEVEL CARD")
    c.setFillColor(CREAM)
    c.setFont("KD-Semibold", 18)
    c.drawString(M + 18, top - 59, "THE FORTRESS")
    c.setFillColor(GOLD_LIGHT)
    c.setFont("KD-Mono", 14)
    c.drawString(M + 18, top - 88, "28,100.00")
    c.setFillColor(MUTED)
    c.setFont("KD-Regular", 7)
    c.drawString(M + 18, top - 108, "STRENGTH 5  /  WALL  /  STICKY TERRAIN")
    divider_y = top - 126
    c.setStrokeColor(BORDER)
    c.line(M + 18, divider_y, M + left_w - 18, divider_y)
    labels = [
        ("WHY IT EXISTS", "Largest absolute put-gamma concentration across the visible chain."),
        ("IF IT HOLDS", "Treat rejection and failed acceptance as evidence of active defence."),
        ("IF IT BREAKS", "Wait for acceptance beyond the level before expecting continuation."),
        ("WHAT CONFIRMS", "Repeated rejection, pace change, and supporting flow."),
        ("WHAT INVALIDATES", "Sustained trade beyond the level with no reclaim."),
    ]
    yy = top - 147
    for label, text in labels:
        c.setFillColor(GOLD)
        c.setFont("KD-Bold", 5.9)
        c.drawString(M + 18, yy, label)
        yy, _ = para(c, text, M + 18, yy - 8, left_w - 36, BODY_TINY)
        yy -= 15
    right_x = M + left_w + 16
    right_w = PAGE_W - M - right_x
    principles = [
        ("Identity", "A memorable plain-English name, exact price, role, and strength."),
        ("Reason", "The level explains the positioning or market structure that created it."),
        ("Visit logic", "The plan states what matters as price approaches and first tests the location."),
        ("Hold case", "The trader knows what would make the level act as a wall, magnet, or pivot."),
        ("Break case", "The trader knows what acceptance beyond the level would imply."),
        ("History", "Prior touches and completed outcomes build a career for the level."),
        ("Honesty", "Concentration is not presented as certainty. The reaction is still required."),
    ]
    for i, (title, text) in enumerate(principles):
        card(c, right_x, top - i * 68, right_w, 59, title, text, f"{i+1:02d}")
    y = top - 467
    callout(
        c,
        M,
        y,
        PAGE_W - 2 * M,
        "A level becomes useful only when the trader can describe what success, failure, and uncertainty look like before price arrives.",
        "THE STANDARD",
    )
    c.showPage()


def scenarios_page(c):
    page_base(c, 13, "Scenarios, permission, and receipts", "Gameplan", alt=True)
    y = page_title(
        c,
        "Scenarios, permission, and receipts",
        "Plan both sides. Trade only the side the market confirms.",
        "Gameplan avoids one-way prediction. It prepares the user for the most important paths, defines the evidence required, and then measures the quality of the map after the session.",
    )
    top = y
    lane_gap = 12
    lane_w = (PAGE_W - 2 * M - lane_gap) / 2
    for i, (title, color, steps) in enumerate(
        [
            (
                "BULL ROAD",
                GREEN,
                [
                    "Trigger: reclaim the decision zone",
                    "Path: acceptance toward the next magnet",
                    "Kill: close back below the reclaimed level",
                ],
            ),
            (
                "BEAR ROAD",
                RED,
                [
                    "Trigger: fail and lose the decision zone",
                    "Path: acceleration through low-liquidity air",
                    "Kill: rapid reclaim and sustained acceptance",
                ],
            ),
        ]
    ):
        x = M + i * (lane_w + lane_gap)
        rounded_rect(c, x, top - 164, lane_w, 164, 11, CARD, BORDER)
        c.setFillColor(color)
        c.setFont("KD-Bold", 7)
        c.drawString(x + 15, top - 23, title)
        yy = top - 49
        for j, line in enumerate(steps):
            c.setFillColor(color)
            c.circle(x + 19, yy - 3, 3.5, stroke=0, fill=1)
            para(c, line, x + 31, yy + 2, lane_w - 45, BODY_SMALL)
            if j < 2:
                c.setStrokeColor(Color(color.red, color.green, color.blue, alpha=0.4))
                c.line(x + 19, yy - 11, x + 19, yy - 34)
            yy -= 40
    y = top - 181
    card(
        c,
        M,
        y,
        PAGE_W - 2 * M,
        118,
        "THE ONE TRADE",
        "The highest-conviction conditional expression of the map. It states the exact permission required, the stop or invalidation, the target path, and the condition under which the idea is explicitly NOT A TRADE. It is designed to reduce overtrading and make patience visible.",
        "01",
    )
    y -= 136
    card(
        c,
        M,
        y,
        PAGE_W - 2 * M,
        118,
        "Receipts",
        "The prior edition is not forgotten. Levels are marked as held, broken, or untested; the session receives an honest note; and the trader can see whether the original map earned trust. The purpose is accountability, not retrospective storytelling.",
        "02",
    )
    y -= 142
    c.setFillColor(CREAM)
    c.setFont("KD-Semibold", 13)
    c.drawString(M, y, "What this changes for the trader")
    y -= 18
    bullet_list(
        c,
        [
            "Directional bias becomes conditional scenario planning.",
            "A level becomes a testable interaction, not an automatic entry.",
            "The best setup is separated from the temptation to trade everything.",
            "Yesterday's claims remain visible when today's plan is produced.",
        ],
        M,
        y,
        PAGE_W - 2 * M,
    )
    c.showPage()


def chart_bridge_page(c):
    page_base(c, 14, "From Gameplan to chart", "Connected workflow")
    y = page_title(
        c,
        "From Gameplan to chart",
        "Turn the written plan into visible chart structure with one action.",
        "The Gameplan does not end as a report. Its levels and zones can be added to the matching NQ or ES chart, named, colour coordinated, and removed as a complete set when the session changes.",
    )
    top = y
    rounded_rect(c, M, top - 315, PAGE_W - 2 * M, 315, 12, CARD, BORDER)
    chart_x = M + 18
    chart_y = top - 282
    chart_w = PAGE_W - 2 * M - 36
    chart_h = 235
    c.setFillColor(HexColor("#080808"))
    c.rect(chart_x, chart_y, chart_w, chart_h, stroke=0, fill=1)
    # Grid
    c.setStrokeColor(HexColor("#1B1915"))
    c.setLineWidth(0.4)
    for i in range(1, 6):
        yy = chart_y + i * chart_h / 6
        c.line(chart_x, yy, chart_x + chart_w, yy)
    for i in range(1, 9):
        xx = chart_x + i * chart_w / 9
        c.line(xx, chart_y, xx, chart_y + chart_h)
    # Gameplan zones under candles
    levels = [(chart_y + 181, "FORTRESS", RED), (chart_y + 125, "POSITIONING WALL", GOLD), (chart_y + 69, "ACCELERATION ZONE", CYAN)]
    for yy, label, color in levels:
        c.setFillColor(Color(color.red, color.green, color.blue, alpha=0.12))
        c.rect(chart_x, yy - 10, chart_w, 20, stroke=0, fill=1)
        c.setStrokeColor(color)
        c.setLineWidth(0.8)
        c.line(chart_x, yy, chart_x + chart_w, yy)
        c.setFillColor(color)
        c.roundRect(chart_x + chart_w - 96, yy - 8, 92, 16, 4, stroke=0, fill=1)
        c.setFillColor(BG)
        c.setFont("KD-Bold", 5.5)
        c.drawCentredString(chart_x + chart_w - 50, yy - 2, label)
    # Candles drawn on top
    prices = [92, 101, 97, 112, 125, 118, 130, 146, 157, 151, 162, 174, 166, 183, 190, 179, 169, 160, 143, 135, 122, 131]
    cw = 8
    for i in range(len(prices) - 1):
        xx = chart_x + 17 + i * (chart_w - 34) / (len(prices) - 1)
        open_y = chart_y + prices[i]
        close_y = chart_y + prices[i + 1]
        color = GREEN if close_y >= open_y else RED
        c.setStrokeColor(color)
        c.setFillColor(color)
        c.line(xx, min(open_y, close_y) - 7, xx, max(open_y, close_y) + 7)
        c.rect(xx - cw / 2, min(open_y, close_y), cw, max(3, abs(close_y - open_y)), stroke=0, fill=1)
    c.setFillColor(GOLD)
    c.setFont("KD-Bold", 6.4)
    c.drawString(M + 18, top - 20, "NQ  /  GAMEPLAN LEVELS ON")
    y = top - 337
    items = [
        ("One-click overlay", "Add the active edition to the matching chart without leaving the Gameplan."),
        ("Named structure", "Every line and zone retains its role so the chart remains explainable."),
        ("Candles stay visible", "Gameplan zones sit beneath the price series so the live reaction remains clear."),
        ("Clean removal", "Right-click and remove all Gameplan levels when the session or edition changes."),
        ("Portable output", "Export level sets for DeepChart, Sierra-compatible CSV, JSON, or broader analysis."),
        ("Instrument integrity", "NQ levels stay with NQ; ES levels stay with ES."),
    ]
    w = (PAGE_W - 2 * M - 10) / 2
    h = 73
    for i, (title, text) in enumerate(items):
        col = i % 2
        row = i // 2
        card(c, M + col * (w + 10), y - row * (h + 7), w, h, title, text)
    c.showPage()


def interpreter_page(c):
    page_base(c, 15, "KwantBot Interpreter", "Live market interpretation", alt=True)
    y = page_title(
        c,
        "KwantBot Interpreter",
        "A live market conversation that understands the map.",
        "The side-panel interpreter keeps NQ and ES context close to the chart. It combines live price, Gameplan levels, options positioning, recent market memory, and user questions in one ongoing conversation.",
    )
    top = y
    phone_w = 270
    phone_h = 430
    phone_x = M
    rounded_rect(c, phone_x, top - phone_h, phone_w, phone_h, 18, CARD, BORDER)
    c.setFillColor(CARD_2)
    c.roundRect(phone_x + 9, top - 51, phone_w - 18, 40, 10, stroke=0, fill=1)
    c.setFillColor(GOLD)
    c.circle(phone_x + 29, top - 31, 11, stroke=0, fill=1)
    c.setFillColor(BG)
    c.setFont("KD-Bold", 8)
    c.drawCentredString(phone_x + 29, top - 34, "K")
    c.setFillColor(CREAM)
    c.setFont("KD-Semibold", 8)
    c.drawString(phone_x + 48, top - 27, "KwantBot - NQ")
    c.setFillColor(GREEN)
    c.setFont("KD-Regular", 5.8)
    c.drawString(phone_x + 48, top - 40, "CONNECTED  /  28,021.25")
    messages = [
        ("K", "Price is 11 points below the Positioning Wall. The level has two prior holds today, but the most recent approach has less downside pace.", True),
        ("U", "What confirms a long here?", False),
        ("K", "A reclaim alone is not enough. I want acceptance above the wall, a failed retest, and no renewed put-side urgency before treating it as support.", True),
        ("K", "If price rejects immediately, the next lower decision remains active. No trade until the reaction prints.", True),
    ]
    yy = top - 75
    for avatar, text, incoming in messages:
        bubble_w = 204 if incoming else 170
        x = phone_x + 18 if incoming else phone_x + phone_w - bubble_w - 18
        p = Paragraph(escape(text), style("bubble", 6.5, 9, TEXT if incoming else BG, "KD-Regular"))
        _, ph = p.wrap(bubble_w - 22, 200)
        bh = ph + 22
        fill = CARD_2 if incoming else GOLD
        stroke = BORDER if incoming else GOLD
        rounded_rect(c, x, yy - bh, bubble_w, bh, 12, fill, stroke)
        p.drawOn(c, x + 11, yy - 11 - ph)
        yy -= bh + 10
    c.setFillColor(CARD_2)
    c.roundRect(phone_x + 13, top - phone_h + 14, phone_w - 26, 39, 13, stroke=0, fill=1)
    c.setFillColor(MUTED)
    c.setFont("KD-Regular", 6.5)
    c.drawString(phone_x + 28, top - phone_h + 30, "Message KwantBot...")
    right_x = phone_x + phone_w + 16
    right_w = PAGE_W - M - right_x
    benefits = [
        ("Instrument-specific chats", "Switch between NQ and ES without mixing the narratives."),
        ("Live proximity awareness", "The interpreter knows which decision level price is approaching."),
        ("Context before conclusion", "Updates explain why a level matters and what evidence is still missing."),
        ("User conversation", "Ask follow-up questions and attach supporting images or files."),
        ("Automatic continuity", "Messages remain in a readable thread and stay anchored to the newest update."),
        ("Exportable archive", "Preserve the conversation and journal for later review."),
    ]
    for i, (title, text) in enumerate(benefits):
        card(c, right_x, top - i * 78, right_w, 69, title, text)
    c.showPage()


def intelligence_page(c):
    page_base(c, 16, "KwantBot Intelligence", "Deep market reasoning")
    y = page_title(
        c,
        "KwantBot Intelligence",
        "From live commentary to a persistent market reasoning system.",
        "The main KwantBot workspace expands the live interpreter into a structured evidence environment. It explains what the market is doing, records why it believes that, checks prior notes, and keeps every conclusion available for review.",
    )
    top = y
    tabs = [
        ("COMMAND CENTRE", "The current thesis, live evidence, nearest decision, validation, and invalidation."),
        ("RUNNING JOURNAL", "A timestamped record of market reads, level reactions, options shifts, and outcomes."),
        ("LEVEL MEMORY", "A career history for important levels, including touches, reactions, and confirmed results."),
        ("MACHINE LEARNING", "Post-outcome scoring, missed evidence, improvement rules, and recurring blind spots."),
    ]
    for i, (title, text) in enumerate(tabs):
        h = 105
        y0 = top - i * (h + 11)
        rounded_rect(c, M, y0 - h, PAGE_W - 2 * M, h, 12, CARD if i % 2 == 0 else CARD_2, BORDER)
        c.setFillColor(GOLD)
        c.setFont("KD-Mono", 8)
        c.drawString(M + 18, y0 - 26, f"0{i+1}")
        c.setFillColor(CREAM)
        c.setFont("KD-Semibold", 12)
        c.drawString(M + 54, y0 - 27, title)
        para(c, text, M + 54, y0 - 43, PAGE_W - 2 * M - 75, BODY_SMALL)
    y = top - 4 * 116 - 5
    callout(
        c,
        M,
        y,
        PAGE_W - 2 * M,
        "The purpose is not to manufacture certainty. It is to make the reasoning visible, testable, and harder to rewrite after the outcome is known.",
        "INTELLIGENCE WITH RECEIPTS",
    )
    c.showPage()


def journal_page(c):
    page_base(c, 17, "Running Journal", "KwantBot Intelligence", alt=True)
    y = page_title(
        c,
        "Running Journal",
        "A live memory of the market narrative.",
        "Every important read can be timestamped, classified, searched, filtered, and revisited. The journal turns a day of fleeting observations into a durable evidence trail.",
    )
    top = y
    rounded_rect(c, M, top - 365, PAGE_W - 2 * M, 365, 12, CARD, BORDER)
    entries = [
        ("09:31:14", "MARKET READ", "Opening pace is high, but price remains inside the nearest decision zone. No directional permission yet.", GOLD),
        ("09:43:02", "LEVEL REACTION", "First test of the Positioning Wall rejected 18 points. Reclaim attempt now determines whether the hold is durable.", CYAN),
        ("09:57:48", "OPTIONS", "Same-day call concentration increased above price while put urgency softened below the market.", PURPLE),
        ("10:11:09", "OUTCOME", "The failed retest confirmed the earlier wall hold. Initial target printed; remaining thesis stays valid above the reclaim.", GREEN),
        ("10:29:35", "REVIEW NOTE", "The direction was correct, but confirmation language should have required a full bar close rather than an intrabar reclaim.", RED),
    ]
    for i, (time, kind, text, color) in enumerate(entries):
        yy = top - 28 - i * 65
        c.setFillColor(color)
        c.circle(M + 25, yy - 12, 4, stroke=0, fill=1)
        if i < len(entries) - 1:
            c.setStrokeColor(BORDER)
            c.line(M + 25, yy - 19, M + 25, yy - 62)
        c.setFillColor(MUTED)
        c.setFont("KD-Mono", 6.1)
        c.drawString(M + 42, yy - 7, time)
        c.setFillColor(color)
        c.setFont("KD-Bold", 5.9)
        c.drawString(M + 102, yy - 7, kind)
        para(c, text, M + 42, yy - 18, PAGE_W - 2 * M - 58, BODY_SMALL)
    y = top - 385
    items = [
        ("Searchable evidence", "Find a level, event, time, or repeated behaviour without scanning an entire session."),
        ("Useful filters", "Separate market reads, level reactions, options observations, and completed outcomes."),
        ("NQ and ES continuity", "Keep instrument narratives distinct while preserving the full day."),
        ("Cloud-first resilience", "Preferences and intelligence are retained with a local safety copy when needed."),
        ("JSON archive", "Export the recorded reasoning for independent review or future research."),
        ("No disappearing history", "The product is designed to remember the context that normally vanishes when the chart moves on."),
    ]
    w = (PAGE_W - 2 * M - 10) / 2
    h = 75
    for i, (title, text) in enumerate(items):
        card(c, M + (i % 2) * (w + 10), y - (i // 2) * (h + 7), w, h, title, text)
    c.showPage()


def level_memory_page(c):
    page_base(c, 18, "Level Memory", "KwantBot Intelligence")
    y = page_title(
        c,
        "Level Memory",
        "Important levels develop a career.",
        "Level Memory connects the current map with stored touches, reactions, and reviewed outcomes. The trader can see whether a location has repeatedly mattered, how it behaved, and what the present approach has in common with prior tests.",
    )
    top = y
    c.setFillColor(CARD_2)
    c.setStrokeColor(GOLD)
    c.setLineWidth(1)
    c.roundRect(M, top - 146, PAGE_W - 2 * M, 146, 13, stroke=1, fill=1)
    c.setFillColor(Color(GOLD.red, GOLD.green, GOLD.blue, alpha=0.08))
    for rad in [16, 27, 38]:
        c.circle(M + 37, top - 48, rad, stroke=0, fill=1)
    c.setFillColor(GOLD)
    c.circle(M + 37, top - 48, 7, stroke=0, fill=1)
    c.setFillColor(CREAM)
    c.setFont("KD-Semibold", 15)
    c.drawString(M + 81, top - 39, "POSITIONING WALL")
    c.setFillColor(GOLD_LIGHT)
    c.setFont("KD-Mono", 10)
    c.drawString(M + 81, top - 59, "CURRENT NEAREST DECISION  /  11.25 POINTS")
    c.setFillColor(MUTED)
    c.setFont("KD-Regular", 7.2)
    c.drawString(M + 81, top - 79, "5 touches  /  3 confirmed reactions  /  4 reviewed outcomes")
    para(
        c,
        "Current adaptation rule: prepare for first response, observe pace on arrival, require confirmation, review the outcome, and update the next approach.",
        M + 81,
        top - 91,
        PAGE_W - 2 * M - 105,
        BODY_SMALL,
    )
    y = top - 166
    steps = [
        ("PREPARE", "What should matter if price arrives?"),
        ("OBSERVE", "What does pace and flow do on approach?"),
        ("CONFIRM", "Did the expected reaction actually print?"),
        ("REVIEW", "Which parts of the original thesis survived?"),
        ("ADAPT", "What explicit rule changes next time?"),
    ]
    gap = 7
    w = (PAGE_W - 2 * M - 4 * gap) / 5
    for i, (title, text) in enumerate(steps):
        x = M + i * (w + gap)
        rounded_rect(c, x, y - 142, w, 142, 9, CARD, BORDER)
        c.setFillColor(GOLD)
        c.circle(x + w / 2, y - 27, 11, stroke=0, fill=1)
        c.setFillColor(BG)
        c.setFont("KD-Bold", 6.4)
        c.drawCentredString(x + w / 2, y - 29.5, str(i + 1))
        c.setFillColor(CREAM)
        c.setFont("KD-Bold", 6.3)
        c.drawCentredString(x + w / 2, y - 52, title)
        para(c, text, x + 8, y - 65, w - 16, CENTER_SMALL)
    y -= 163
    c.setFillColor(CREAM)
    c.setFont("KD-Semibold", 13)
    c.drawString(M, y, "What the trader gains")
    y -= 18
    bullet_list(
        c,
        [
            "A visible history instead of a vague memory that a level worked before.",
            "Separation between a level's structural importance and the latest live reaction.",
            "A clearer view of first touch, repeated touch, confirmed response, and eventual failure.",
            "A repeatable process for updating expectations without rewriting history.",
            "A stronger bridge between session preparation and long-run behavioural evidence.",
        ],
        M,
        y,
        PAGE_W - 2 * M,
    )
    c.showPage()


def machine_learning_page(c):
    page_base(c, 19, "Machine Learning", "KwantBot Intelligence", alt=True)
    y = page_title(
        c,
        "Machine Learning",
        "The system reviews the quality of its own reasoning.",
        "After a call is complete, the original reasoning is kept immutable and compared with what actually happened. The goal is not to reward lucky outcomes. It is to improve the evidence standards behind future decisions.",
    )
    top = y
    # Score gauge
    gauge_x = M + 75
    gauge_y = top - 112
    c.setStrokeColor(BORDER)
    c.setLineWidth(12)
    c.arc(gauge_x - 55, gauge_y - 55, gauge_x + 55, gauge_y + 55, 0, 180)
    c.setStrokeColor(GOLD)
    c.arc(gauge_x - 55, gauge_y - 55, gauge_x + 55, gauge_y + 55, 0, 139)
    c.setFillColor(GOLD_LIGHT)
    c.setFont("KD-Semibold", 25)
    c.drawCentredString(gauge_x, gauge_y - 10, "77")
    c.setFillColor(MUTED)
    c.setFont("KD-Bold", 6.3)
    c.drawCentredString(gauge_x, gauge_y - 28, "REASONING QUALITY")
    right_x = M + 165
    right_w = PAGE_W - M - right_x
    card(c, right_x, top, right_w, 74, "Verdict", "PARTIAL - Direction correct, confirmation standard incomplete.", "01", GOLD)
    card(c, right_x, top - 86, right_w, 74, "What worked", "The level and likely reaction were identified before the test.", "02", GREEN)
    card(c, right_x, top - 172, right_w, 74, "What was missed", "The thesis did not require enough time above the reclaimed zone.", "03", RED)
    y = top - 260
    items = [
        ("Immutable original call", "The system cannot edit the reasoning after the result is known."),
        ("Outcome-aware score", "Reasoning quality is graded from 0 to 100 with confirmed, partial, or failed verdicts."),
        ("Explicit improvement rule", "Every review produces a concrete next-time standard, not a generic lesson."),
        ("Recurring blind spots", "Repeated misses become visible across sessions and instruments."),
        ("Calibration trend", "The trader can see whether reasoning quality is improving over time."),
        ("Post-outcome history", "Completed reviews remain available as a persistent training record."),
    ]
    w = (PAGE_W - 2 * M - 10) / 2
    h = 66
    for i, (title, text) in enumerate(items):
        card(c, M + (i % 2) * (w + 10), y - (i // 2) * (h + 7), w, h, title, text)
    y -= 3 * 73 + 4
    callout(
        c,
        M,
        y,
        PAGE_W - 2 * M,
        "A correct outcome with weak reasoning is not treated as mastery. A failed outcome with disciplined reasoning can still teach something useful.",
        "THE REVIEW STANDARD",
    )
    c.showPage()


def news_page(c):
    page_base(c, 20, "Economic Calendar", "Catalyst intelligence")
    y = page_title(
        c,
        "Economic Calendar",
        "Put scheduled event risk beside the market plan.",
        "The News workspace organises economic catalysts by date, time, currency, impact, forecast, previous reading, actual result, and detailed event context.",
    )
    top = y
    rounded_rect(c, M, top - 285, PAGE_W - 2 * M, 285, 12, CARD, BORDER)
    c.setFillColor(CARD_2)
    c.roundRect(M + 12, top - 48, PAGE_W - 2 * M - 24, 35, 8, stroke=0, fill=1)
    currencies = ["ALL", "USD", "EUR", "GBP", "JPY", "AUD", "CAD"]
    for i, curr in enumerate(currencies):
        x = M + 25 + i * 61
        c.setFillColor(GOLD if curr in ["USD", "EUR"] else MUTED)
        c.setFont("KD-Bold", 6.3)
        c.drawCentredString(x, top - 34, curr)
    c.setFillColor(MUTED)
    c.setFont("KD-Bold", 5.7)
    heads = [("TIME", 15), ("CCY", 75), ("IMPACT", 113), ("EVENT", 174), ("FORECAST", 355), ("PREVIOUS", 416)]
    for h, offset in heads:
        c.drawString(M + offset, top - 70, h)
    events = [
        ("08:30", "USD", "HIGH", "Core PCE Price Index", "0.2%", "0.1%"),
        ("10:00", "USD", "HIGH", "Consumer Confidence", "101.4", "100.8"),
        ("11:30", "USD", "MED", "Crude Oil Inventories", "-1.6m", "-0.8m"),
        ("14:00", "EUR", "MED", "ECB President Speech", "-", "-"),
        ("16:45", "NZD", "LOW", "Trade Balance", "0.42b", "0.31b"),
    ]
    for i, row in enumerate(events):
        yy = top - 84 - i * 35
        c.setFillColor(CARD_2 if i % 2 == 0 else BG_ALT)
        c.roundRect(M + 10, yy - 25, PAGE_W - 2 * M - 20, 31, 5, stroke=0, fill=1)
        for j, val in enumerate(row):
            offset = [15, 75, 113, 174, 355, 416][j]
            color = RED if (j == 2 and val == "HIGH") else GOLD if (j == 2 and val == "MED") else TEXT
            c.setFillColor(color)
            c.setFont("KD-Mono" if j in [0, 1, 4, 5] else "KD-Regular", 6.3)
            c.drawString(M + offset, yy - 14, val)
    c.setFillColor(GOLD)
    c.rect(M + 10, top - 285 + 19, PAGE_W - 2 * M - 20, 1, stroke=0, fill=1)
    c.setFillColor(GOLD)
    c.setFont("KD-Bold", 6.1)
    c.drawString(M + 15, top - 262, "NOW  /  NEXT HIGH-IMPACT CATALYST IN 00:42:18")
    y = top - 305
    items = [
        ("Calendar navigation", "Move by day, jump to Today, or select a future date."),
        ("Currency filters", "Focus on currencies relevant to the markets being traded."),
        ("Impact filters", "Separate high, medium, and low-impact catalysts."),
        ("Local time", "Use the user's chosen timezone and a live clock."),
        ("Expandable detail", "Compare event context, Actual, Forecast, and Previous."),
        ("Device alerts", "Receive a local reminder when notifications are enabled."),
        ("Forward coverage", "Keep upcoming sessions visible for early preparation."),
        ("Last-good continuity", "Retain the last reliable view during a temporary interruption."),
    ]
    w = (PAGE_W - 2 * M - 10) / 2
    h = 66
    for i, (title, text) in enumerate(items):
        card(c, M + (i % 2) * (w + 10), y - (i // 2) * (h + 4), w, h, title, text)
    c.showPage()


def personalization_page(c):
    page_base(c, 21, "Personalisation and continuity", "User experience", alt=True)
    y = page_title(
        c,
        "Personalisation and continuity",
        "The workspace remembers the trader.",
        "Kwant Desk preserves the visual and operational choices that shape a user's process, reducing setup friction each time the platform is opened.",
    )
    top = y
    themes = [
        ("ONYX GOLD", "#070707", "#D6B45F"),
        ("CARBON BLUE", "#080B10", "#4E8DFF"),
        ("BLACK EMERALD", "#060B08", "#39D98A"),
        ("NOIR CHROME", "#090909", "#E6E6E6"),
        ("ELECTRIC VIOLET", "#0B0710", "#A855F7"),
        ("BLACK CHERRY", "#0B0608", "#F43F5E"),
        ("ABYSS CYAN", "#050A0D", "#06B6D4"),
        ("SIGNAL LIME", "#060907", "#84CC16"),
        ("ROYAL COBALT", "#080A11", "#4169E1"),
        ("BURNISHED AMBER", "#0B0804", "#F59E0B"),
        ("POLAR NIGHT", "#07101A", "#38BDF8"),
        ("NEON ROSE", "#0B070A", "#EC4899"),
    ]
    sw = (PAGE_W - 2 * M - 22) / 3
    sh = 60
    for i, (name, bg, accent) in enumerate(themes):
        col = i % 3
        row = i // 3
        x = M + col * (sw + 11)
        yy = top - row * (sh + 9)
        rounded_rect(c, x, yy - sh, sw, sh, 8, HexColor(bg), BORDER)
        c.setFillColor(HexColor(accent))
        c.rect(x + 11, yy - 24, sw - 22, 7, stroke=0, fill=1)
        c.setFillColor(CREAM)
        c.setFont("KD-Bold", 5.8)
        c.drawString(x + 11, yy - 43, name)
    y = top - 4 * (sh + 9) - 7
    para(
        c,
        "The wider library includes 24 professional dark, creative, and light themes. Themes control the full workspace language, including chart candles and the crosshair, so the product feels deliberate rather than partially recoloured.",
        M,
        y,
        PAGE_W - 2 * M,
        BODY_SMALL,
    )
    y -= 52
    items = [
        ("Account persistence", "Theme, layout, chart choices, and related preferences return with the user's account."),
        ("Chart timezone", "Set the chart clock to the trader's own location or workflow."),
        ("Calendar timezone", "View event risk in the timezone used for actual preparation."),
        ("Chart appearance", "Control candle, crosshair, and key visual defaults while keeping the interface coherent."),
        ("Workspace portability", "Import or export configurations and preserve a productive multi-chart setup."),
        ("Smooth navigation", "Move across major product areas without breaking the sense of one continuous workspace."),
    ]
    w = (PAGE_W - 2 * M - 10) / 2
    h = 82
    for i, (title, text) in enumerate(items):
        card(c, M + (i % 2) * (w + 10), y - (i // 2) * (h + 8), w, h, title, text)
    c.showPage()


def differentiators_page(c):
    page_base(c, 22, "Why Kwant Desk", "Commercial differentiation")
    y = page_title(
        c,
        "Why Kwant Desk",
        "The strongest selling points.",
        "Kwant Desk stands apart because it connects preparation, live structure, explanation, accountability, and improvement. The value is not any one chart or indicator. It is the continuity of the decision process.",
    )
    points = [
        ("01", "A decision system, not a dashboard", "Every product area contributes to the next trading decision and the evidence behind it."),
        ("02", "Options intelligence made usable", "Gamma, Delta, Vanna, Charm, tape, and expiry pressure are translated into visible price structure."),
        ("03", "Every level has a because", "Important prices come with purpose, strength, visit logic, hold logic, break logic, and history."),
        ("04", "Both sides are prepared", "The platform avoids forced directional certainty and defines the conditions for bull and bear paths."),
        ("05", "Live context stays connected", "Price, proximity, options structure, Gameplan, and catalysts remain part of the same narrative."),
        ("06", "Preparation becomes executable", "Gameplan levels and zones move directly onto the chart instead of remaining trapped in a report."),
        ("07", "Receipts are built in", "Past calls, level reactions, and session maps remain available after the outcome is known."),
        ("08", "The product learns from misses", "Reasoning quality is scored, blind spots are tracked, and explicit improvement rules are created."),
        ("09", "Progressive disclosure", "A new user can understand the map quickly while an experienced trader can open the full evidence."),
        ("10", "Professional continuity", "Workspaces, themes, timezones, preferences, exports, and archives preserve the user's operating environment."),
    ]
    top = y
    row_h = 56
    for i, (num, title, text) in enumerate(points):
        yy = top - i * (row_h + 4)
        rounded_rect(c, M, yy - row_h, PAGE_W - 2 * M, row_h, 8, CARD if i % 2 == 0 else CARD_2, BORDER)
        c.setFillColor(GOLD)
        c.setFont("KD-Mono", 7)
        c.drawString(M + 14, yy - 22, num)
        c.setFillColor(CREAM)
        c.setFont("KD-Semibold", 8.6)
        c.drawString(M + 48, yy - 21, title)
        para(c, text, M + 48, yy - 29, PAGE_W - 2 * M - 63, BODY_TINY)
    c.showPage()


def audiences_page(c):
    page_base(c, 23, "Who it is for", "Use cases", alt=True)
    y = page_title(
        c,
        "Who it is for",
        "Different experience levels. The same disciplined decision standard.",
        "Kwant Desk is designed for users who want more than a direction or an indicator. It supports fast understanding for developing traders and evidence-rich control for advanced discretionary users.",
    )
    users = [
        (
            "Developing futures trader",
            "Needs a clear map without being buried in options terminology.",
            [
                "30-second session one-liner",
                "Plain-English named levels",
                "Beginner disclosure mode",
                "What-if hold and break paths",
                "One conditional trade focus",
            ],
            GOLD,
        ),
        (
            "Active discretionary trader",
            "Needs live context, confirmation standards, and repeatable preparation.",
            [
                "Multi-chart futures workspace",
                "Gamma and Gameplan overlays",
                "Live interpreter",
                "Event-risk timeline",
                "Saved layouts and exports",
            ],
            CYAN,
        ),
        (
            "Advanced options-aware trader",
            "Needs exposure, tape, expiry pressure, replay, and structural depth.",
            [
                "GEX, DEX, VEX, CHEX",
                "Live consolidated tape",
                "GEXMAP comparison and replay",
                "0DTE concentration",
                "Pro disclosure and receipts",
            ],
            PURPLE,
        ),
        (
            "Trading team or research desk",
            "Needs a consistent language for plans, calls, outcomes, and review.",
            [
                "Shared decision framework",
                "Exportable level sets",
                "Timestamped reasoning archive",
                "Level career memory",
                "Post-outcome review standard",
            ],
            GREEN,
        ),
    ]
    top = y
    gap = 12
    w = (PAGE_W - 2 * M - gap) / 2
    h = 245
    for i, (title, need, bullets, color) in enumerate(users):
        col = i % 2
        row = i // 2
        x = M + col * (w + gap)
        yy = top - row * (h + 12)
        rounded_rect(c, x, yy - h, w, h, 12, CARD, BORDER)
        c.setFillColor(color)
        c.rect(x, yy - 4, w, 4, stroke=0, fill=1)
        c.setFillColor(CREAM)
        c.setFont("KD-Semibold", 11)
        c.drawString(x + 16, yy - 32, title)
        para(c, need, x + 16, yy - 47, w - 32, BODY_SMALL)
        c.setFillColor(color)
        c.setFont("KD-Bold", 6)
        c.drawString(x + 16, yy - 96, "MOST VALUABLE CAPABILITIES")
        bullet_list(c, bullets, x + 16, yy - 111, w - 32, BODY_SMALL, 5, color)
    c.showPage()


def feature_inventory(c):
    page_base(c, 24, "Feature inventory", "Complete product scope")
    y = page_title(
        c,
        "Feature inventory",
        "The Kwant Desk capability set at a glance.",
        "A concise inventory of the customer-facing capabilities available across the current product.",
    )
    columns = [
        (
            "CHARTS",
            [
                "Live CME futures context",
                "30 core futures instruments",
                "Watchlist: Last, Chg, Chg%",
                "Five-day history at open",
                "Seconds to monthly intervals",
                "Range, volume, trade, Renko, P&F, delta views",
                "Custom interval entry",
                "Single to custom layouts",
                "Saved and portable workspaces",
                "Drawing and measurement suite",
                "Gamma level toggle",
                "Gameplan overlays",
                "Level exports",
                "Chart timezone",
            ],
        ),
        (
            "OPTIONS INTELLIGENCE",
            [
                "Gamma, Delta, Vanna, Charm exposure",
                "Calls and puts by strike",
                "Gamma environment",
                "0DTE concentration",
                "Key walls, magnets, and supports",
                "Expected move",
                "Intraday premium drift",
                "Exposure by expiry",
                "Cross-instrument flow",
                "Consolidated tape",
                "Sweeps, blocks, and splits",
                "GEXMAP three-panel comparison",
                "Replay and timeline scrub",
                "Futures translation",
            ],
        ),
        (
            "GAMEPLAN",
            [
                "NQ and ES editions",
                "Globex and New York plans",
                "Live five-minute one-liner",
                "Session level ladder",
                "Animated live price marker",
                "Level strength and purpose",
                "Visit, hold, and break logic",
                "Market environment",
                "Volatility state",
                "Bull and bear scenarios",
                "THE ONE TRADE",
                "Receipts and grading",
                "Beginner to Pro depth",
                "Chart and file bridge",
            ],
        ),
        (
            "KWANTBOT + NEWS",
            [
                "NQ and ES conversations",
                "Live proximity interpretation",
                "User questions and attachments",
                "Command Centre",
                "Running Journal",
                "Search and filters",
                "Level Memory",
                "Reasoning quality scores",
                "Improvement rules",
                "Blind-spot tracking",
                "Economic catalyst calendar",
                "Currency and impact filters",
                "Timezone controls",
                "Expandable event detail",
            ],
        ),
    ]
    top = y
    gap = 8
    w = (PAGE_W - 2 * M - 3 * gap) / 4
    h = 565
    for i, (title, items) in enumerate(columns):
        x = M + i * (w + gap)
        rounded_rect(c, x, top - h, w, h, 9, CARD if i % 2 == 0 else CARD_2, BORDER)
        c.setFillColor(GOLD)
        c.setFont("KD-Bold", 6.4)
        c.drawString(x + 10, top - 22, title)
        yy = top - 42
        for item in items:
            c.setFillColor(GOLD)
            c.circle(x + 12, yy - 3.7, 1.3, stroke=0, fill=1)
            yy, _ = para(c, item, x + 19, yy, w - 27, BODY_TINY)
            yy -= 7
    c.showPage()


def principles_page(c):
    page_base(c, 25, "Product principles", "Trust and clarity", alt=True)
    y = page_title(
        c,
        "Product principles",
        "Intelligence only matters if the trader can trust how it is presented.",
        "Kwant Desk is guided by a set of product standards designed to keep the experience useful, honest, and decision-focused.",
    )
    principles = [
        ("Never show a naked number", "A level must explain why it exists and what should happen if it holds or breaks."),
        ("Prepare both sides", "The platform does not force a directional claim when the market has not earned one."),
        ("The print is permission", "A mapped location is a place to observe, not an automatic instruction to trade."),
        ("Freshness is visible", "Current status, edition, live price, and timestamps remain part of the decision context."),
        ("Receipts survive the outcome", "Original calls, notes, and reasoning remain available after the result is known."),
        ("Uncertainty is allowed", "No trade is a valid outcome when confirmation, timing, or risk is poor."),
        ("Complexity must earn its place", "Advanced data is translated into a clear question, decision, or warning."),
        ("Memory should improve behaviour", "History is useful only when it produces a more explicit standard next time."),
    ]
    top = y
    gap = 10
    w = (PAGE_W - 2 * M - gap) / 2
    h = 103
    for i, (title, text) in enumerate(principles):
        card(c, M + (i % 2) * (w + gap), top - (i // 2) * (h + 9), w, h, title, text, f"{i+1:02d}")
    y = top - 4 * (h + 9) - 5
    callout(
        c,
        M,
        y,
        PAGE_W - 2 * M,
        "Kwant Desk is designed to improve preparation, context, and decision discipline. It does not remove market risk, guarantee outcomes, or replace the trader's responsibility for execution.",
        "RESPONSIBLE POSITIONING",
    )
    c.showPage()


def closing(c):
    c.setFillColor(BG)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    draw_particles(c)
    draw_brand_mark(c, M, PAGE_H - 157, 250)
    c.setFillColor(GOLD)
    c.rect(M, PAGE_H - 197, 67, 2, stroke=0, fill=1)
    y, _ = para(
        c,
        "See the map. Understand the pressure. Wait for permission.",
        M,
        PAGE_H - 239,
        430,
        style("closing", 28, 33, CREAM, "KD-Semibold"),
    )
    y -= 22
    para(
        c,
        "Kwant Desk gives futures and options traders a complete operating picture: live price, options structure, pre-session scenarios, event risk, market interpretation, evidence memory, and an honest review loop.",
        M,
        y,
        418,
        style("closing_body", 11, 17, TEXT),
    )
    rounded_rect(c, M, 235, PAGE_W - 2 * M, 108, 14, CARD_2, GOLD, 1.0)
    c.setFillColor(GOLD)
    c.setFont("KD-Bold", 6.5)
    c.drawString(M + 20, 318, "THE OUTCOME")
    para(
        c,
        "Less fragmentation. Less blind reaction. More preparation. More context. More disciplined confirmation. More honest review.",
        M + 20,
        301,
        PAGE_W - 2 * M - 40,
        style("outcome", 14, 20, CREAM, "KD-Semibold"),
    )
    c.setFillColor(GOLD)
    c.setFont("KD-Mono", 8)
    c.drawString(M, 176, "KWANTDESK.COM")
    para(
        c,
        "Product overview prepared July 2026. Feature descriptions reflect the current Kwant Desk product scope and are intended for product, marketing, partnership, and customer education purposes.",
        M,
        139,
        420,
        BODY_TINY,
    )
    para(
        c,
        "Risk disclosure: Trading futures and options involves substantial risk and is not suitable for every person. Market intelligence, scenarios, levels, and analytical tools are informational only and do not constitute financial advice, a recommendation, or a guarantee of performance. Users remain responsible for their own decisions, risk controls, and execution.",
        M,
        100,
        PAGE_W - 2 * M,
        BODY_TINY,
    )
    c.setFont("KD-Mono", 6.5)
    c.setFillColor(DIM)
    c.drawRightString(PAGE_W - M, 34, "26  /  26")
    c.showPage()


def build():
    c = canvas.Canvas(str(OUTPUT), pagesize=A4)
    c.setTitle("Kwant Desk Product Overview")
    c.setAuthor("Kwant Desk")
    c.setSubject("Comprehensive product, capability, and value overview")
    c.setCreator("Kwant Desk")
    cover(c)
    overview(c)
    problems(c)
    platform_map(c)
    workflow(c)
    charts_page(c)
    workspaces_page(c)
    gamma_page(c)
    options_tape_page(c)
    gexmap_page(c)
    gameplan_overview(c)
    level_anatomy(c)
    scenarios_page(c)
    chart_bridge_page(c)
    interpreter_page(c)
    intelligence_page(c)
    journal_page(c)
    level_memory_page(c)
    machine_learning_page(c)
    news_page(c)
    personalization_page(c)
    differentiators_page(c)
    audiences_page(c)
    feature_inventory(c)
    principles_page(c)
    closing(c)
    c.save()
    print(OUTPUT)


if __name__ == "__main__":
    build()

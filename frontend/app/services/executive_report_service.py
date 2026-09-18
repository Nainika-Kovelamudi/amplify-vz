from __future__ import annotations

import asyncio
import html
import logging
from datetime import datetime, timezone
from io import BytesIO

from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

from app.config import get_settings
from app.db.base import get_session_factory
from app.services.email_service import send_email_with_attachment

logger = logging.getLogger(__name__)


def _add_heading(document: Document, text: str, level: int = 1) -> None:
    heading = document.add_heading(text, level=level)
    heading.style.font.name = "Arial"
    heading.style.font.color.rgb = RGBColor(30, 41, 59)


def _add_metrics(document: Document, metrics: list[tuple[str, object]], columns: int = 5) -> None:
    table = document.add_table(rows=0, cols=columns)
    table.autofit = False
    fills = ["EEF2FF", "ECFDF5", "FFF7ED", "EFF6FF", "F5F3FF", "FDF2F8"]
    for start in range(0, len(metrics), columns):
        row = table.add_row().cells
        for index in range(columns):
            if start + index >= len(metrics):
                row[index].text = ""
                continue
            label, value = metrics[start + index]
            cell = row[index]
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            tc_pr = cell._tc.get_or_add_tcPr()
            shading = OxmlElement("w:shd")
            shading.set(qn("w:fill"), fills[(start + index) % len(fills)])
            tc_pr.append(shading)
            margins = OxmlElement("w:tcMar")
            for side in ("top", "left", "bottom", "right"):
                node = OxmlElement(f"w:{side}")
                node.set(qn("w:w"), "120")
                node.set(qn("w:type"), "dxa")
                margins.append(node)
            tc_pr.append(margins)
            paragraph = row[index].paragraphs[0]
            paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
            value_run = paragraph.add_run(f"{value}\n")
            value_run.bold = True
            value_run.font.size = Pt(20)
            value_run.font.color.rgb = RGBColor(15, 23, 42)
            label_run = paragraph.add_run(label)
            label_run.bold = True
            label_run.font.size = Pt(7.5)
            label_run.font.color.rgb = RGBColor(100, 116, 139)
    document.add_paragraph().paragraph_format.space_after = Pt(0)


def _add_data_table(document: Document, headers: list[str], rows: list[list[object]]) -> None:
    table = document.add_table(rows=1, cols=len(headers))
    table.style = "Light Shading Accent 1"
    for index, header in enumerate(headers):
        table.rows[0].cells[index].text = header
    if not rows:
        cells = table.add_row().cells
        cells[0].text = "No data available"
        return
    for values in rows:
        cells = table.add_row().cells
        for index, value in enumerate(values):
            cells[index].text = str(value)


def _add_bar_chart(document: Document, values: list[tuple[str, int]], width: int = 28) -> None:
    """Render a polished horizontal chart as an embedded image in Word."""
    maximum = max((value for _, value in values), default=0)
    if maximum <= 0:
        document.add_paragraph("No chart data available.")
        return
    from PIL import Image, ImageDraw, ImageFont

    chart_values = values[:10]
    image_width = 1400
    row_height = 58
    image_height = 45 + len(chart_values) * row_height
    image = Image.new("RGB", (image_width, image_height), "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=18)
    bold = ImageFont.load_default(size=20)
    label_width, bar_width = 360, 880
    for index, (label, value) in enumerate(chart_values):
        y = 25 + index * row_height
        draw.text((10, y + 8), label[:38], fill="#334155", font=font)
        draw.rounded_rectangle((label_width, y + 8, label_width + bar_width, y + 36), radius=10, fill="#EEF2FF")
        filled = int(bar_width * value / maximum) if maximum else 0
        if filled:
            draw.rounded_rectangle((label_width, y + 8, label_width + max(14, filled), y + 36), radius=10, fill="#6366F1")
        draw.text((label_width + bar_width + 20, y + 7), str(value), fill="#0F172A", font=bold)
    stream = BytesIO()
    image.save(stream, format="PNG", optimize=True)
    stream.seek(0)
    document.add_picture(stream, width=Inches(7.25))


def _add_line_chart(document: Document, series: list[tuple[str, list[int]]], labels: list[str]) -> None:
    """Embed a clean multi-series trend chart in the Word report."""
    if not labels or not series:
        document.add_paragraph("No trend data available.")
        return
    from PIL import Image, ImageDraw, ImageFont

    width, height = 1400, 520
    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=17)
    left, top, right, bottom = 100, 45, 1340, 425
    maximum = max((value for _, values in series for value in values), default=1) or 1
    for step in range(5):
        y = bottom - step * (bottom - top) / 4
        draw.line((left, y, right, y), fill="#E2E8F0", width=2)
        draw.text((40, y - 9), str(round(maximum * step / 4)), fill="#64748B", font=font)
    palette = ["#6366F1", "#10B981", "#F59E0B", "#EC4899"]
    x_step = (right - left) / max(1, len(labels) - 1)
    for index, (name, values) in enumerate(series):
        points = [(left + i * x_step, bottom - value * (bottom - top) / maximum) for i, value in enumerate(values)]
        if len(points) > 1:
            draw.line(points, fill=palette[index % len(palette)], width=5, joint="curve")
        for x, y in points:
            draw.ellipse((x - 6, y - 6, x + 6, y + 6), fill=palette[index % len(palette)])
        legend_x = left + index * 260
        draw.rounded_rectangle((legend_x, 465, legend_x + 28, 483), radius=5, fill=palette[index % len(palette)])
        draw.text((legend_x + 38, 460), name, fill="#334155", font=font)
    label_step = max(1, len(labels) // 7)
    for index in range(0, len(labels), label_step):
        draw.text((left + index * x_step - 35, bottom + 12), labels[index][5:], fill="#64748B", font=font)
    stream = BytesIO()
    image.save(stream, format="PNG", optimize=True)
    stream.seek(0)
    document.add_picture(stream, width=Inches(7.25))


def build_executive_report_docx(report) -> bytes:
    """Create a portable Word report containing every executive-report dataset."""
    document = Document()
    section = document.sections[0]
    section.top_margin = Inches(0.6)
    section.bottom_margin = Inches(0.6)
    section.left_margin = Inches(0.65)
    section.right_margin = Inches(0.65)

    title = document.add_heading("AIMPLIFY Executive Report", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.runs[0].font.color.rgb = RGBColor(79, 70, 229)
    title.runs[0].font.size = Pt(26)
    subtitle = document.add_paragraph(
        f"Asset Governance & Adoption | {report.period_start:%d %b %Y} – {report.period_end:%d %b %Y}"
    )
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER

    summary = report.summary
    _add_heading(document, "Assets Catalog")
    _add_metrics(document, [
        ("Total assets", summary.total_assets),
        ("Published assets", summary.published_assets),
        ("Awaiting review", summary.awaiting_review),
        ("L1 waiting approval", summary.l1_waiting_approval),
        ("L2 waiting approval", summary.l2_waiting_approval),
    ])

    _add_heading(document, "Asset Families")
    _add_bar_chart(document, [(item.name, item.asset_count) for item in report.family_assets])

    engagement = report.engagement
    _add_heading(document, "Platform Adoption")
    _add_metrics(document, [
        ("Active users", engagement.active_users),
        ("Asset views", engagement.catalog_views),
        ("Demo views", engagement.demo_views),
        ("Downloads", engagement.artifact_downloads),
        ("Clone requests", engagement.clone_requests),
        ("Demo requests", engagement.demo_requests),
    ], columns=3)

    document.add_page_break()
    _add_heading(document, "Top Events")
    _add_bar_chart(document, [(item.label, item.count) for item in report.top_events])

    _add_heading(document, "Most Trending Assets")
    _add_bar_chart(document, [(item.title, item.engagement_score) for item in report.trending_assets])

    document.add_page_break()
    _add_heading(document, "Most Active Users")
    _add_data_table(document, ["Name", "Email", "Events", "Last active"], [
        [item.name, item.email, item.events, item.last_active.strftime("%d %b %Y %H:%M UTC")]
        for item in report.active_users
    ])

    _add_heading(document, "Daily Submission and Publishing Trend")
    _add_line_chart(document, [
        ("Submitted", [item.submitted for item in report.daily_trend]),
        ("Approved", [item.approved for item in report.daily_trend]),
        ("Published", [item.published for item in report.daily_trend]),
        ("Needs changes", [item.needs_changes for item in report.daily_trend]),
    ], [item.date.isoformat() for item in report.daily_trend])

    _add_heading(document, "Current Governance Funnel")
    _add_bar_chart(document, [(key.replace("_", " ").title(), value) for key, value in report.status_funnel.items()])

    document.add_page_break()
    for title_text, rows in (("Performance by Department", report.departments), ("Performance by Platform Family", report.families)):
        _add_heading(document, title_text)
        _add_data_table(document, ["Name", "Submitted", "Approved", "Published", "Average AI score"], [
            [item.name, item.submitted, item.approved, item.published, round(item.average_ai_score)] for item in rows
        ])

    footer = document.add_paragraph(f"Generated {datetime.now(timezone.utc):%d %b %Y %H:%M UTC}")
    footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    footer.runs[0].font.size = Pt(8)
    footer.runs[0].font.color.rgb = RGBColor(148, 163, 184)

    output = BytesIO()
    document.save(output)
    return output.getvalue()


def build_executive_report_xlsx(report) -> bytes:
    """Create a styled Excel dashboard plus detailed supporting worksheets."""
    from openpyxl import Workbook
    from openpyxl.chart import LineChart, Reference
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

    workbook = Workbook()
    dashboard = workbook.active
    dashboard.title = "Dashboard"
    navy, indigo, pale, white, border = "0F172A", "6366F1", "EEF2FF", "FFFFFF", "CBD5E1"
    thin = Side(style="thin", color=border)

    dashboard.merge_cells("A1:J2")
    dashboard["A1"] = "AIMPLIFY Observability Dashboard"
    dashboard["A1"].font = Font(size=22, bold=True, color=white)
    dashboard["A1"].fill = PatternFill("solid", fgColor=navy)
    dashboard["A1"].alignment = Alignment(horizontal="center", vertical="center")
    dashboard.merge_cells("A3:J3")
    dashboard["A3"] = f"Reporting period: {report.period_start:%d %b %Y} – {report.period_end:%d %b %Y}"
    dashboard["A3"].alignment = Alignment(horizontal="center")
    dashboard["A3"].font = Font(italic=True, color="64748B")

    def section(row: int, title: str) -> int:
        dashboard.merge_cells(start_row=row, start_column=1, end_row=row, end_column=10)
        cell = dashboard.cell(row, 1, title)
        cell.font = Font(bold=True, color=white, size=12)
        cell.fill = PatternFill("solid", fgColor=indigo)
        return row + 1

    def metrics(row: int, values: list[tuple[str, object]]) -> int:
        for index, (label, value) in enumerate(values):
            column = 1 + (index % 5) * 2
            current_row = row + (index // 5) * 3
            dashboard.merge_cells(start_row=current_row, start_column=column, end_row=current_row, end_column=column + 1)
            dashboard.merge_cells(start_row=current_row + 1, start_column=column, end_row=current_row + 1, end_column=column + 1)
            value_cell = dashboard.cell(current_row, column, value)
            value_cell.font = Font(size=18, bold=True, color=navy)
            value_cell.fill = PatternFill("solid", fgColor=pale)
            value_cell.alignment = Alignment(horizontal="center")
            label_cell = dashboard.cell(current_row + 1, column, label)
            label_cell.font = Font(size=9, bold=True, color="475569")
            label_cell.fill = PatternFill("solid", fgColor=pale)
            label_cell.alignment = Alignment(horizontal="center")
            for r in (current_row, current_row + 1):
                for c in range(column, column + 2):
                    dashboard.cell(r, c).border = Border(left=thin, right=thin, top=thin, bottom=thin)
        return row + ((len(values) + 4) // 5) * 3

    row = section(5, "Asset Governance")
    summary = report.summary
    row = metrics(row, [
        ("Total assets", summary.total_assets), ("Published assets", summary.published_assets),
        ("Awaiting review", summary.awaiting_review), ("L1 waiting", summary.l1_waiting_approval),
        ("L2 waiting", summary.l2_waiting_approval),
    ])
    row = section(row, "Platform Adoption")
    engagement = report.engagement
    row = metrics(row, [
        ("Active users", engagement.active_users), ("Asset views", engagement.catalog_views),
        ("Demo views", engagement.demo_views), ("Downloads", engagement.artifact_downloads),
        ("Clone requests", engagement.clone_requests), ("Demo requests", engagement.demo_requests),
    ])

    row = section(row, "Asset Families and Top Events")

    def dashboard_table(start_col: int, title: str, headers: list[str], values: list[list[object]]) -> None:
        end_col = start_col + len(headers) - 1
        dashboard.merge_cells(start_row=row, start_column=start_col, end_row=row, end_column=end_col)
        title_cell = dashboard.cell(row, start_col, title)
        title_cell.font = Font(size=11, bold=True, color=navy)
        title_cell.fill = PatternFill("solid", fgColor="E0E7FF")
        title_cell.alignment = Alignment(horizontal="left")
        for index, header in enumerate(headers, start_col):
            cell = dashboard.cell(row + 1, index, header)
            cell.font = Font(bold=True, color=white)
            cell.fill = PatternFill("solid", fgColor="475569")
            cell.alignment = Alignment(horizontal="left")
            cell.border = Border(left=thin, right=thin, top=thin, bottom=thin)
        for row_offset, item_values in enumerate(values, row + 2):
            for col_offset, value in enumerate(item_values, start_col):
                cell = dashboard.cell(row_offset, col_offset, value)
                cell.fill = PatternFill("solid", fgColor="F8FAFC" if row_offset % 2 == 0 else white)
                cell.border = Border(left=thin, right=thin, top=thin, bottom=thin)
                cell.alignment = Alignment(horizontal="left" if col_offset == start_col else "center")

    dashboard_table(1, "Published Assets by Family", ["Family", "Assets", "Share"], [
        [item.name, item.asset_count, f"{round(item.percentage)}%"] for item in report.family_assets
    ])
    dashboard_table(6, "Top Events", ["Event", "Count"], [
        [item.label, item.count] for item in report.top_events
    ])

    def detail_sheet(title: str, headers: list[str], rows: list[list[object]]):
        sheet = workbook.create_sheet(title)
        sheet.append(headers)
        for values in rows:
            sheet.append(values)
        for cell in sheet[1]:
            cell.font = Font(bold=True, color=white)
            cell.fill = PatternFill("solid", fgColor=indigo)
        sheet.freeze_panes = "A2"
        sheet.auto_filter.ref = sheet.dimensions
        for column in sheet.columns:
            width = min(45, max(12, max(len(str(cell.value or "")) for cell in column) + 2))
            sheet.column_dimensions[column[0].column_letter].width = width
        return sheet

    trend = detail_sheet("Daily Trend", ["Date", "Submitted", "Approved", "Published", "Needs Changes"], [
        [item.date.isoformat(), item.submitted, item.approved, item.published, item.needs_changes] for item in report.daily_trend
    ])
    if report.daily_trend:
        chart = LineChart()
        chart.title = "Submission and Publishing Trend"
        chart.add_data(Reference(trend, min_col=2, max_col=5, min_row=1, max_row=len(report.daily_trend) + 1), titles_from_data=True)
        chart.set_categories(Reference(trend, min_col=1, min_row=2, max_row=len(report.daily_trend) + 1))
        chart.height, chart.width = 8, 16
        trend.add_chart(chart, "G2")
    detail_sheet("Trending Assets", ["Asset", "Family", "Views", "Downloads", "Clones", "Demo Requests", "Score"], [
        [item.title, item.family, item.views, item.downloads, item.clone_requests, item.demo_requests, item.engagement_score]
        for item in report.trending_assets
    ])
    detail_sheet("Active Users", ["Name", "Email", "Events", "Last Active"], [
        [item.name, item.email, item.events, item.last_active.strftime("%d %b %Y %H:%M UTC")] for item in report.active_users
    ])
    detail_sheet("Departments", ["Name", "Submitted", "Approved", "Published", "Average AI Score"], [
        [item.name, item.submitted, item.approved, item.published, round(item.average_ai_score)] for item in report.departments
    ])
    detail_sheet("Platform Families", ["Name", "Submitted", "Approved", "Published", "Average AI Score"], [
        [item.name, item.submitted, item.approved, item.published, round(item.average_ai_score)] for item in report.families
    ])
    for column in range(1, 11):
        dashboard.column_dimensions[chr(64 + column)].width = 15
    dashboard.sheet_view.showGridLines = False
    dashboard.freeze_panes = "A5"
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


def build_executive_report_pdf(report) -> bytes:
    """Create a landscape, dashboard-style PDF report."""
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.graphics.shapes import Drawing, Rect, String
    from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    output = BytesIO()
    doc = SimpleDocTemplate(output, pagesize=landscape(A4), leftMargin=12 * mm, rightMargin=12 * mm, topMargin=10 * mm, bottomMargin=10 * mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("ReportTitle", parent=styles["Title"], textColor=colors.HexColor("#0F172A"), alignment=TA_CENTER, fontSize=20)
    section_style = ParagraphStyle("Section", parent=styles["Heading2"], textColor=colors.HexColor("#334155"), spaceBefore=8, spaceAfter=5)
    story = [Paragraph("AIMPLIFY Observability Dashboard", title_style), Paragraph(
        f"{report.period_start:%d %b %Y} – {report.period_end:%d %b %Y}",
        ParagraphStyle("Period", parent=styles["Normal"], alignment=TA_CENTER, textColor=colors.HexColor("#64748B")),
    ), Spacer(1, 6)]

    def formatted_table(headers, rows, widths=None):
        table = Table([headers] + rows, colWidths=widths, repeatRows=1, hAlign="LEFT")
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#6366F1")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ]))
        return table

    def kpi_table(values):
        cells = [[Paragraph(f"<b><font size='16'>{value}</font></b><br/><font color='#64748B' size='7'>{label}</font>", styles["Normal"]) for label, value in values]]
        table = Table(cells, colWidths=[(landscape(A4)[0] - 24 * mm) / len(values)] * len(values), rowHeights=18 * mm)
        table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#EEF2FF")), ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#C7D2FE")), ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#C7D2FE")), ("ALIGN", (0, 0), (-1, -1), "CENTER"), ("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
        return table

    def bar_chart(values, title):
        values = values[:10]
        maximum = max((value for _, value in values), default=0)
        drawing = Drawing(710, 35 + 24 * len(values))
        drawing.add(String(0, 18 + 24 * len(values), title, fontName="Helvetica-Bold", fontSize=11, fillColor=colors.HexColor("#334155")))
        for index, (label, value) in enumerate(values):
            y = 24 * (len(values) - index - 1)
            drawing.add(String(0, y + 5, label[:34], fontSize=8, fillColor=colors.HexColor("#475569")))
            drawing.add(Rect(190, y + 3, 430, 12, rx=5, ry=5, fillColor=colors.HexColor("#EEF2FF"), strokeColor=None))
            width = (430 * value / maximum) if maximum else 0
            if width:
                drawing.add(Rect(190, y + 3, max(8, width), 12, rx=5, ry=5, fillColor=colors.HexColor("#6366F1"), strokeColor=None))
            drawing.add(String(635, y + 4, str(value), fontName="Helvetica-Bold", fontSize=8, fillColor=colors.HexColor("#0F172A")))
        return drawing

    summary, engagement = report.summary, report.engagement
    story += [Paragraph("Asset Governance", section_style), kpi_table([
        ("Total Assets", summary.total_assets), ("Published", summary.published_assets), ("Awaiting Review", summary.awaiting_review),
        ("L1 Waiting", summary.l1_waiting_approval), ("L2 Waiting", summary.l2_waiting_approval),
    ]), Paragraph("Platform Adoption", section_style), kpi_table([
        ("Active Users", engagement.active_users), ("Asset Views", engagement.catalog_views), ("Demo Views", engagement.demo_views),
        ("Downloads", engagement.artifact_downloads), ("Clone Requests", engagement.clone_requests), ("Demo Requests", engagement.demo_requests),
    ]), Spacer(1, 8), bar_chart([(item.name, item.asset_count) for item in report.family_assets], "Published Assets by Family"),
    PageBreak(), bar_chart([(item.label, item.count) for item in report.top_events], "Top Events"),
    Spacer(1, 12), bar_chart([(item.title, item.engagement_score) for item in report.trending_assets], "Trending Assets by Engagement Score"),
    PageBreak(), Paragraph("Most Active Users", section_style), formatted_table(["Name", "Email", "Events", "Last Active"], [
        [item.name, item.email, item.events, item.last_active.strftime("%d %b %Y %H:%M UTC")] for item in report.active_users
    ], [55 * mm, 75 * mm, 25 * mm, 50 * mm]), PageBreak(), Paragraph("Daily Submission and Publishing Trend", section_style), formatted_table(
        ["Date", "Submitted", "Approved", "Published", "Needs Changes"],
        [[item.date.isoformat(), item.submitted, item.approved, item.published, item.needs_changes] for item in report.daily_trend],
        [45 * mm, 35 * mm, 35 * mm, 35 * mm, 40 * mm],
    ), Paragraph("Performance by Department", section_style), formatted_table(
        ["Department", "Submitted", "Approved", "Published", "Average AI Score"],
        [[item.name, item.submitted, item.approved, item.published, round(item.average_ai_score)] for item in report.departments],
    )]
    doc.build(story)
    return output.getvalue()


def build_executive_report_email_html(report) -> str:
    """Email-client-safe dashboard summary with table-based KPI cards and bars."""
    summary, engagement = report.summary, report.engagement

    def cards(values: list[tuple[str, object]]) -> str:
        cells = "".join(
            f'<td style="padding:14px;border:1px solid #c7d2fe;background:#eef2ff;text-align:center">'
            f'<div style="font-size:24px;font-weight:800;color:#0f172a">{html.escape(str(value))}</div>'
            f'<div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase">{html.escape(label)}</div></td>'
            for label, value in values
        )
        return f'<table role="presentation" width="100%" cellspacing="6"><tr>{cells}</tr></table>'

    def bars(values: list[tuple[str, int]]) -> str:
        maximum = max((value for _, value in values), default=0) or 1
        return "".join(
            f'<tr><td style="padding:5px 8px 5px 0;color:#475569;font-size:12px;width:150px">{html.escape(label)}</td>'
            f'<td style="padding:5px 0"><div style="height:12px;background:#eef2ff;border-radius:6px">'
            f'<div style="height:12px;width:{round(value * 100 / maximum)}%;background:#6366f1;border-radius:6px"></div></div></td>'
            f'<td style="padding:5px 0 5px 10px;font-weight:700;color:#0f172a;font-size:12px">{value}</td></tr>'
            for label, value in values
        )

    return f"""
    <div style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a">
      <div style="max-width:920px;margin:auto;background:white;border:1px solid #e2e8f0;border-radius:14px;padding:24px">
        <h1 style="margin:0;text-align:center;color:#4f46e5;font-size:26px">AIMPLIFY Executive Dashboard</h1>
        <p style="text-align:center;color:#64748b;font-size:13px">{report.period_start:%d %b %Y} - {report.period_end:%d %b %Y}</p>
        <h2 style="font-size:16px;color:#334155;margin-top:24px">Asset Governance</h2>
        {cards([('Total assets', summary.total_assets), ('Published', summary.published_assets), ('Awaiting review', summary.awaiting_review), ('L1 waiting', summary.l1_waiting_approval), ('L2 waiting', summary.l2_waiting_approval)])}
        <h2 style="font-size:16px;color:#334155;margin-top:24px">Platform Adoption</h2>
        {cards([('Active users', engagement.active_users), ('Asset views', engagement.catalog_views), ('Demo views', engagement.demo_views), ('Downloads', engagement.artifact_downloads), ('Clone requests', engagement.clone_requests), ('Demo requests', engagement.demo_requests)])}
        <table role="presentation" width="100%" cellspacing="0"><tr><td style="vertical-align:top;width:50%;padding-right:18px">
          <h2 style="font-size:16px;color:#334155;margin-top:24px">Asset Families</h2>
          <table role="presentation" width="100%">{bars([(item.name, item.asset_count) for item in report.family_assets])}</table>
        </td><td style="vertical-align:top;width:50%;padding-left:18px">
          <h2 style="font-size:16px;color:#334155;margin-top:24px">Top Events</h2>
          <table role="presentation" width="100%">{bars([(item.label, item.count) for item in report.top_events])}</table>
        </td></tr></table>
        <h2 style="font-size:16px;color:#334155;margin-top:24px">Trending Assets</h2>
        <table role="presentation" width="100%">{bars([(item.title, item.engagement_score) for item in report.trending_assets])}</table>
        <p style="margin-top:24px;color:#64748b;font-size:12px">The complete chart-enabled executive report is attached.</p>
      </div>
    </div>"""


async def email_executive_report(to_email: str, report, format: str = "docx") -> None:
    builders = {
        "docx": (build_executive_report_docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        "xlsx": (build_executive_report_xlsx, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        "pdf": (build_executive_report_pdf, "application/pdf"),
    }
    builder, content_type = builders.get(format, builders["docx"])
    report_bytes = builder(report)
    filename = f"AIMPLIFY_Executive_Report_{report.period_end:%Y%m%d}.{format}"
    await send_email_with_attachment(
        to_email,
        "[AIMPLIFY] Executive Report",
        build_executive_report_email_html(report),
        filename,
        report_bytes,
        content_type,
    )


async def run_executive_report_scheduler() -> None:
    """Environment-controlled scheduler; disabled unless explicitly enabled."""
    settings = get_settings()
    if not settings.executive_report_schedule_enabled:
        logger.info("Executive report scheduler is disabled.")
        return
    recipients = [address.strip() for address in settings.executive_report_recipients.split(",") if address.strip()]
    if not recipients:
        logger.warning("Executive report scheduler enabled without recipients; scheduler stopped.")
        return

    interval_seconds = settings.executive_report_interval_hours * 3600
    while True:
        await asyncio.sleep(interval_seconds)
        try:
            from app.routers.admin import get_executive_report
            async with get_session_factory()() as db:
                report = await get_executive_report(days=settings.executive_report_days, db=db, user=None)
            for recipient in recipients:
                await email_executive_report(recipient, report)
            logger.info("Scheduled executive report sent to %d recipient(s).", len(recipients))
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Scheduled executive report delivery failed.")

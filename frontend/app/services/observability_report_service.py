from __future__ import annotations

from io import BytesIO


def build_observability_xlsx(data: dict) -> bytes:
    from openpyxl import Workbook
    from openpyxl.chart import BarChart, Reference
    from openpyxl.styles import Font, PatternFill
    from openpyxl.utils import get_column_letter

    wb = Workbook()
    ws = wb.active
    ws.title = "Observability"
    ws.append(["AIMPLIFY Observability Dashboard"])
    ws["A1"].font = Font(size=18, bold=True, color="FFFFFF")
    ws["A1"].fill = PatternFill("solid", fgColor="4F46E5")
    ws.merge_cells("A1:F1")
    ws.append([])
    ws.append(["Governance KPI", "Value"])
    for label, value in data["governance"]:
        ws.append([label, value])
    ws.append([])
    ws.append(["Platform Activity", "Value"])
    for label, value in data["activity"]:
        ws.append([label, value])
    ws.append([])
    event_header = ws.max_row + 1
    ws.append(["Top Event", "Count"])
    for label, value in data["top_events"]:
        ws.append([label, value])
    if data["top_events"]:
        chart = BarChart()
        chart.title = "Top Events"
        chart.add_data(Reference(ws, min_col=2, min_row=event_header, max_row=ws.max_row), titles_from_data=True)
        chart.set_categories(Reference(ws, min_col=1, min_row=event_header + 1, max_row=ws.max_row))
        ws.add_chart(chart, "D4")

    users = wb.create_sheet("Active Users")
    users.append(["Name", "Email", "Events", "Last Active"])
    for row in data["active_users"]:
        users.append(row)
    assets = wb.create_sheet("Asset Engagement")
    assets.append(["Asset", "Family", "Views", "Clones", "Demo Requests"])
    for row in data["assets"]:
        assets.append(row)
    events = wb.create_sheet("Live Event Stream")
    events.append(["Time", "Event", "Actor", "Email", "Entity Type", "Entity ID"])
    for row in data["recent_events"]:
        events.append(row)
    for sheet in wb.worksheets:
        sheet.freeze_panes = "A2"
        for cell in sheet[1]:
            cell.font = Font(bold=True)
        for index, column in enumerate(sheet.columns, start=1):
            sheet.column_dimensions[get_column_letter(index)].width = min(45, max(14, max(len(str(c.value or "")) for c in column) + 2))
    out = BytesIO(); wb.save(out); return out.getvalue()


def build_observability_docx(data: dict) -> bytes:
    from docx import Document
    from docx.shared import Inches

    doc = Document()
    doc.add_heading("AIMPLIFY Observability Dashboard", 0)
    doc.add_paragraph("Platform traceability, user activity, asset engagement, and event stream.")
    for heading, rows in (("Asset Governance", data["governance"]), ("Platform Activity", data["activity"]), ("Top Events", data["top_events"])):
        doc.add_heading(heading, level=1)
        table = doc.add_table(rows=1, cols=2); table.style = "Light Shading Accent 1"
        table.rows[0].cells[0].text, table.rows[0].cells[1].text = "Metric", "Value"
        for label, value in rows:
            cells = table.add_row().cells; cells[0].text = str(label); cells[1].text = str(value)
    doc.add_heading("Most Active Users", level=1)
    table = doc.add_table(rows=1, cols=4); table.style = "Light Shading Accent 1"
    for i, h in enumerate(("Name", "Email", "Events", "Last Active")): table.rows[0].cells[i].text = h
    for row in data["active_users"][:20]:
        cells = table.add_row().cells
        for i, value in enumerate(row): cells[i].text = str(value or "")
    doc.add_heading("Asset Engagement", level=1)
    table = doc.add_table(rows=1, cols=5); table.style = "Light Shading Accent 1"
    for i, h in enumerate(("Asset", "Family", "Views", "Clones", "Demo Requests")): table.rows[0].cells[i].text = h
    for row in data["assets"][:20]:
        cells = table.add_row().cells
        for i, value in enumerate(row): cells[i].text = str(value or "")
    section = doc.sections[0]; section.left_margin = section.right_margin = Inches(0.6)
    out = BytesIO(); doc.save(out); return out.getvalue()


def build_observability_pdf(data: dict) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import landscape, A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

    out = BytesIO(); styles = getSampleStyleSheet()
    story = [Paragraph("AIMPLIFY Observability Dashboard", styles["Title"]), Spacer(1, 12)]
    for heading, rows in (("Asset Governance", data["governance"]), ("Platform Activity", data["activity"]), ("Top Events", data["top_events"])):
        story.extend([Paragraph(heading, styles["Heading2"]), Table([["Metric", "Value"], *rows], colWidths=[240, 100]), Spacer(1, 12)])
    story.append(Paragraph("Most Active Users", styles["Heading2"]))
    story.append(Table([["Name", "Email", "Events", "Last Active"], *data["active_users"][:20]], repeatRows=1, colWidths=[120, 210, 60, 120]))
    for item in story:
        if isinstance(item, Table):
            item.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4F46E5")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("GRID", (0, 0), (-1, -1), .3, colors.grey), ("FONTSIZE", (0, 0), (-1, -1), 8)]))
    SimpleDocTemplate(out, pagesize=landscape(A4), leftMargin=24, rightMargin=24).build(story)
    return out.getvalue()

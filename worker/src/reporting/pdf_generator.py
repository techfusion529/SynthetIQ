"""Form-1 PDF generator using ReportLab.

Produces an A4 CPCB Form-1 document from a :class:`Form1Data` payload.
Unsigned documents carry a diagonal "DRAFT" watermark.
"""

from __future__ import annotations

import io
import logging

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Spacer, Table, TableStyle

from reporting.form1_schema import Form1Data

logger = logging.getLogger(__name__)


def generate_form1_pdf(data: Form1Data) -> bytes:
    """Render *data* as a CPCB Form-1 PDF and return raw bytes.

    Args:
        data: Validated :class:`Form1Data` payload.

    Returns:
        Raw PDF bytes suitable for writing to disk or uploading.
    """
    buf = io.BytesIO()

    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        title="CPCB Form-1 — EPR Credit Registration",
    )

    styles = getSampleStyleSheet()

    # Truncate chain_head for display (first 16 chars + ellipsis)
    chain_head_display = data.chain_head[:16] + "..." if len(data.chain_head) > 16 else data.chain_head

    table_data = [
        ["Field", "Value"],
        ["Organisation Name", data.org_name],
        ["Fiscal Year", data.fiscal_year],
        ["Plastic Category", data.category],
        ["Volume (tons)", f"{data.volume_tons:.4f}"],
        ["Compliance %", f"{data.compliance_pct:.2f}%"],
        ["Audit ID", data.audit_id],
        ["PO Reference", data.po_reference],
        ["Chain Head", chain_head_display],
        ["Generated Date", data.generated_date],
        ["Signed", "YES" if data.is_signed else "NO"],
    ]

    col_widths = [6 * cm, 11 * cm]
    table = Table(table_data, colWidths=col_widths)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#003366")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 11),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.white]),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )

    story = [
        Spacer(1, 0.5 * cm),
        table,
    ]

    # Attach DRAFT watermark callback when the form is unsigned
    if not data.is_signed:

        def _draw_draft_watermark(canvas, doc):  # noqa: ANN001
            canvas.saveState()
            canvas.setFont("Helvetica-Bold", 72)
            canvas.setFillGray(0.85)
            canvas.translate(A4[0] / 2, A4[1] / 2)
            canvas.rotate(45)
            canvas.drawCentredString(0, 0, "DRAFT")
            canvas.restoreState()

        doc.build(story, onFirstPage=_draw_draft_watermark, onLaterPages=_draw_draft_watermark)
    else:
        doc.build(story)

    pdf_bytes = buf.getvalue()
    logger.info(
        "Form-1 PDF generated: org=%s, fy=%s, size=%d bytes, signed=%s",
        data.org_name,
        data.fiscal_year,
        len(pdf_bytes),
        data.is_signed,
    )
    return pdf_bytes

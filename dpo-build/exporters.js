import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
export async function excelBytes(report) {
  const book = new ExcelJS.Workbook();
  book.creator = "Dirección de Operaciones";
  const sheet = book.addWorksheet("Reporte", {
    views: [{ state: "frozen", ySplit: 6 }],
  });
  sheet.addRow([report.title]);
  sheet.addRow([report.source]);
  sheet.addRow([report.scopeLabel]);
  sheet.addRow([`Generado: ${report.generatedAt}`]);
  sheet.addRow([report.note]);
  sheet.addRow(report.headers);
  for (const row of report.rows)
    sheet.addRow(row.map((v) => (typeof v === "number" ? v : String(v ?? ""))));
  for (let r = 1; r <= 5; r++) sheet.mergeCells(r, 1, r, report.headers.length);
  sheet.getRow(1).font = { bold: true, size: 18, color: { argb: "FF125B61" } };
  sheet.getRow(6).eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF125B61" },
    };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  });
  sheet.columns.forEach((c, i) => {
    c.width = i === report.headers.length - 1 ? 40 : 24;
    c.alignment = { vertical: "top", wrapText: true };
  });
  sheet.getRow(3).height = 42;
  sheet.getRow(5).height = 60;
  for (let i = 7; i <= sheet.rowCount; i++)
    sheet.getRow(i).height = Math.min(
      250,
      Math.max(
        32,
        ...report.rows[i - 7].map((v) => Math.ceil(String(v).length / 25) * 15),
      ),
    );
  sheet.autoFilter = {
    from: { row: 6, column: 1 },
    to: { row: Math.max(6, sheet.rowCount), column: report.headers.length },
  };
  return book.xlsx.writeBuffer();
}
export function printPeriod(f = {}) {
  const year = Number(f.year), month = Number(f.month), half = Number(f.half);
  const date = (m,d) => `${year}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const bounded = year > 0;
  return {
    from: f.from || (bounded ? date(month || 1, month && half === 2 ? 16 : 1) : 'Sin límite'),
    to: f.to || (bounded ? date(month || 12, month && half === 1 ? 15 : new Date(Date.UTC(year,month || 12,0)).getUTCDate()) : 'Sin límite')
  };
}
export function pdfBytes(report, {user = 'Usuario no identificado', filters = report.filters || {}, now = new Date()} = {}) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const period = printPeriod(filters);
  const emitted = new Intl.DateTimeFormat('es-PY', {timeZone:'America/Asuncion',dateStyle:'short',timeStyle:'medium'}).format(now);
  const width = 269;
  pdf.setFontSize(15);
  const title = pdf.splitTextToSize(report.title, width);
  pdf.setFontSize(9);
  const responsible = pdf.splitTextToSize('Responsable de la impresión: ' + user, width);
  const headerBottom = 13 + title.length * 6 + 6 + responsible.length * 4 + 4;
  const metadata = pdf.splitTextToSize([report.source, report.scopeLabel, report.note].filter(Boolean).join('\n'), width);
  pdf.setTextColor(70);
  pdf.text(metadata,14,headerBottom + 4);
  autoTable(pdf, {
    startY: headerBottom + 8 + metadata.length * 4,
    head: [report.headers], body: report.rows,
    styles: {font:"helvetica",fontSize:8,overflow:"linebreak",cellPadding:2},
    headStyles:{fillColor:[18,91,97]},
    margin:{top:headerBottom + 4,bottom:26,left:14,right:14},
    rowPageBreak:"avoid"
  });
  const pages = pdf.getNumberOfPages();
  for(let page=1;page<=pages;page++){
    pdf.setPage(page);
    pdf.setTextColor(18,91,97);pdf.setFont('helvetica','bold');pdf.setFontSize(15);
    pdf.text(title,14,13);
    pdf.setFont('helvetica','normal');pdf.setTextColor(40);pdf.setFontSize(9);
    pdf.text(`Fecha desde: ${period.from}    Hasta: ${period.to}`,14,13+title.length*6);
    pdf.text(responsible,14,19+title.length*6);
    pdf.setDrawColor(190);pdf.line(14,headerBottom,283,headerBottom);
    pdf.line(14,186,283,186);pdf.setFontSize(8);
    pdf.text('DPO/UNIDAD DE OPERACIONES',14,193);
    const footer=pdf.splitTextToSize(`Generado: ${emitted} · Usuario: ${user}`,170);
    pdf.text(footer,283,193,{align:'right'});
    pdf.text(`Página ${page} de ${pages}`,283,193+footer.length*3.5,{align:'right'});
  }
  return pdf.output("arraybuffer");
}
export function download(bytes, name, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

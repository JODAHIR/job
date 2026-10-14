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
export function pdfBytes(report) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  pdf.setFontSize(16);
  pdf.setTextColor(18, 91, 97);
  pdf.text(report.title, 14, 16);
  pdf.setFontSize(9);
  pdf.setTextColor(30);
  const metadata = pdf.splitTextToSize(
    `${report.source}\n${report.scopeLabel}\nGenerado: ${report.generatedAt}\n${report.note}`,
    268,
  );
  pdf.text(metadata, 14, 23);
  autoTable(pdf, {
    startY: 26 + metadata.length * 4,
    head: [report.headers],
    body: report.rows,
    styles: {
      font: "helvetica",
      fontSize: 8,
      overflow: "linebreak",
      cellPadding: 2,
    },
    headStyles: { fillColor: [18, 91, 97] },
    margin: { top: 15, bottom: 15 },
    rowPageBreak: "avoid",
    didDrawPage: () => {
      pdf.setFontSize(8);
      pdf.text(
        `Dirección de Operaciones · Página ${pdf.getNumberOfPages()}`,
        14,
        202,
      );
    },
  });
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

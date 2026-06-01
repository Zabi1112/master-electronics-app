import html2pdf from "html2pdf.js";

export const downloadPdf = (elementId, fileName = "document.pdf") => {
  const element = document.getElementById(elementId);

  if (!element) {
    alert("PDF content not found");
    return;
  }

  const options = {
    margin: [8, 8, 8, 8],
    filename: fileName,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      scrollY: 0,
      backgroundColor: "#050505",
    },
    jsPDF: {
      unit: "mm",
      format: "a4",
      orientation: "portrait",
    },
    pagebreak: {
      mode: ["avoid-all", "css", "legacy"],
      avoid: [".avoid-break", ".no-break", "tr", ".pdf-card"],
    },
  };

  html2pdf().set(options).from(element).save();
};

export const printElement = (elementId) => {
  const element = document.getElementById(elementId);

  if (!element) {
    alert("Print content not found");
    return;
  }

  const printWindow = window.open("", "_blank");

  printWindow.document.write(`
    <html>
      <head>
        <title>Master Electronics</title>
        <style>
          body {
            font-family: Inter, Arial, sans-serif;
            color: #fff;
            background: #050505;
            padding: 20px;
          }

          .invoice-root, .receipt-root {
            width: 100%;
            box-sizing: border-box;
            background: #050505;
            color: #fff;
          }

          .header-card {
            border: 1px solid rgba(251, 191, 36, 0.2);
            background: rgba(251, 191, 36, 0.1);
          }

          .section-card {
            border: 1px solid rgba(251, 191, 36, 0.1);
            background: rgba(255, 255, 255, 0.04);
            border-radius: 24px;
            padding: 18px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }

          th, td {
            border: 1px solid #2b2b34;
            padding: 12px 14px;
          }

          thead tr {
            background: #111827;
            color: #d1d5db;
          }

          tbody tr:nth-child(odd) {
            background: rgba(255, 255, 255, 0.04);
          }

          .text-yellow {
            color: #fbbf24;
          }

          .text-gray {
            color: #9ca3af;
          }

          .text-muted {
            color: #d1d5db;
          }

          .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          }

          .signature {
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            padding-top: 16px;
            text-align: center;
          }

          .no-break, .avoid-break, .pdf-card, tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .page-break {
            page-break-before: always;
          }
        </style>
      </head>
      <body>
        ${element.innerHTML}
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};
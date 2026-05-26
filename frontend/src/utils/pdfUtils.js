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
            font-family: Arial, sans-serif;
            color: #111;
            padding: 20px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          th, td {
            border: 1px solid #ddd;
            padding: 8px;
            font-size: 12px;
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
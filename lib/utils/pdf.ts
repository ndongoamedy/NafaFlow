import { jsPDF } from "jspdf";
import { fetchOrgSettings, fetchClientProfile, OrgSettings, ClientProfile } from "./orgProfile";
import { formatFCFA, formatDate, formatPhone } from "./format";

interface PDFLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface PDFDocumentData {
  id: string;
  type: "facture" | "devis";
  clientName: string;
  clientId: string;
  issueDate: string;
  dueDate?: string;     // Invoice only
  validityDays?: number; // Quote only
  status: string;
  lines: PDFLineItem[];
  total: number;
  amountPaid?: number;
  amountRemaining?: number;
}

function getImageDimensions(base64: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve({ width: 35, height: 15 });
      return;
    }
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
    };
    img.onerror = () => {
      resolve({ width: 35, height: 15 });
    };
    img.src = base64;
  });
}

// Code client court et lisible sur le document (au lieu de l'UUID complet).
function shortClientCode(clientId: string): string {
  const compact = (clientId || "").replace(/-/g, "").toUpperCase();
  return compact ? `CL-${compact.slice(0, 6)}` : "-";
}

export async function generateDocumentPDF(data: PDFDocumentData) {
  // Les infos émetteur et client viennent de Supabase : ce sont exactement
  // celles saisies dans Paramètres et dans la fiche client.
  const [settings, clientObj]: [OrgSettings | null, ClientProfile | null] = await Promise.all([
    fetchOrgSettings(),
    fetchClientProfile(data.clientId),
  ]);

  const company = settings?.company;
  const applyVat = settings?.billing?.applyVat ?? true;
  const vatRate = settings?.billing?.vat ?? 18;
  const paymentTerm = settings?.billing?.paymentTerm ?? 30;

  // Initialize jsPDF (A4 page: 210mm x 297mm)
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Fonts & styling tokens
  const primaryColor = [21, 62, 43];     // Brand green #15803D (RGB: 21, 62, 43)
  const darkTextColor = [30, 41, 59];    // slate-800
  const lightTextColor = [100, 116, 139]; // slate-500
  const borderLight = [226, 232, 240];    // slate-200
  const bgLight = [248, 250, 252];       // slate-50

  // 1. Logo & Header Area
  let y = 20;

  let imgWidth = 35;
  let imgHeight = 15;

  const logo = company?.logo || "";
  const hasLogo = logo.startsWith("data:image");

  if (hasLogo) {
    try {
      const dims = await getImageDimensions(logo);
      if (dims.width > 0 && dims.height > 0) {
        imgHeight = 15; // constrain height to max 15mm
        imgWidth = imgHeight * (dims.width / dims.height);
        // Cap width to maximum 55mm to prevent horizontal overflow
        if (imgWidth > 55) {
          imgWidth = 55;
          imgHeight = imgWidth * (dims.height / dims.width);
        }
      }
    } catch (err) {
      console.error("Failed to load logo dimensions", err);
    }
  }

  // Render company logo or text representation
  let logoRendered = false;
  if (hasLogo) {
    try {
      const format = logo.includes("image/jpeg") || logo.includes("image/jpg") ? "JPEG" : "PNG";
      doc.addImage(logo, format, 20, y, imgWidth, imgHeight);
      logoRendered = true;
    } catch {
      logoRendered = false;
    }
  }
  if (!logoRendered) {
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(company?.name || "NAFAFLOW", 20, y + 10);
  }

  // Right-aligned header metadata
  const headerX = 130;
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(data.type === "facture" ? "FACTURE" : "DEVIS", headerX, y + 5);

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);

  y = y + 13;
  doc.setFont("Helvetica", "bold");
  doc.text(`Réf : ${data.id}`, headerX, y);

  doc.setFont("Helvetica", "normal");
  doc.setTextColor(lightTextColor[0], lightTextColor[1], lightTextColor[2]);
  y = y + 5;
  doc.text(`Date d'émission : ${formatDate(data.issueDate)}`, headerX, y);

  y = y + 5;
  if (data.type === "facture" && data.dueDate) {
    doc.text(`Date d'échéance : ${formatDate(data.dueDate)}`, headerX, y);
  } else if (data.type === "devis" && data.validityDays) {
    doc.text(`Durée de validité : ${data.validityDays} jours`, headerX, y);
  }

  y = y + 5;
  doc.text(`Code client : ${shortClientCode(data.clientId)}`, headerX, y);

  // 2. Address Blocks (Side-by-side boxed panels)
  y = y + 12;
  const boxHeight = 32;
  const boxWidth = 82;

  // Left Box - Issuer Info
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  doc.rect(20, y, boxWidth, boxHeight, "FD");

  // Right Box - Recipient Info
  doc.rect(108, y, boxWidth, boxHeight, "FD");

  // Fill Issuer text
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("ÉMETTEUR", 24, y + 6);

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.text(company?.name || "-", 24, y + 11);

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(lightTextColor[0], lightTextColor[1], lightTextColor[2]);

  // Wrap company address text to fit box
  const companyAddrLines = doc.splitTextToSize(company?.address || "-", boxWidth - 8).slice(0, 2);
  doc.text(companyAddrLines, 24, y + 16);

  // Contact (téléphone / email) si renseignés dans Paramètres
  const companyContactParts: string[] = [];
  if (company?.phone) companyContactParts.push(`Tél : ${formatPhone(company.phone)}`);
  if (company?.email) companyContactParts.push(company.email);
  if (companyContactParts.length > 0) {
    doc.text(companyContactParts.join("  |  "), 24, y + 24);
  }

  const nineaRcText = `NINEA : ${company?.ninea || "-"}  |  RC : ${company?.rc || "-"}`;
  doc.text(nineaRcText, 24, y + 28);

  // Fill Client text
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(data.type === "facture" ? "FACTURÉ À" : "DESTINATAIRE", 112, y + 6);

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.text(clientObj?.name || data.clientName, 112, y + 11);

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(lightTextColor[0], lightTextColor[1], lightTextColor[2]);

  const clientAddrLines = doc.splitTextToSize(clientObj?.address || "-", boxWidth - 8).slice(0, 2);
  doc.text(clientAddrLines, 112, y + 16);

  const clientContactParts: string[] = [];
  if (clientObj?.whatsapp) clientContactParts.push(`Tél : ${formatPhone(clientObj.whatsapp)}`);
  if (clientObj?.email) clientContactParts.push(clientObj.email);
  if (clientContactParts.length > 0) {
    doc.text(clientContactParts.join("  |  "), 112, y + 24);
  }

  if (clientObj?.ninea || clientObj?.rc) {
    const clientNineaRc = `NINEA : ${clientObj?.ninea || "-"}  |  RC : ${clientObj?.rc || "-"}`;
    doc.text(clientNineaRc, 112, y + 28);
  }

  // 3. Table of Lines / Prestataires
  y = y + boxHeight + 10;

  // Table headers background
  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  doc.rect(20, y, 170, 7.5, "F");

  // Headers text alignment
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);

  doc.text("Désignation", 24, y + 5);
  doc.text("TVA", 112, y + 5);
  doc.text("P.U. HT", 132, y + 5);
  doc.text("Qté", 156, y + 5);
  doc.text("Total HT", 172, y + 5);

  // Bottom line of header row
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.line(20, y + 7.5, 190, y + 7.5);
  y = y + 7.5;

  // Lines rendering loop
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(8.5);

  data.lines.forEach((line) => {
    // Description text wrapping
    const descLines = doc.splitTextToSize(line.description, 80);
    const lineCount = descLines.length;
    const rowHeight = Math.max(8, lineCount * 4 + 2);

    // Prevent page overflow (A4 height is 297mm, margin is 20mm)
    if (y + rowHeight > 240) {
      doc.addPage();
      y = 20; // reset y on new page
      // Re-draw headers
      doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
      doc.rect(20, y, 170, 7.5, "F");
      doc.setFont("Helvetica", "bold");
      doc.text("Désignation", 24, y + 5);
      doc.text("TVA", 112, y + 5);
      doc.text("P.U. HT", 132, y + 5);
      doc.text("Qté", 156, y + 5);
      doc.text("Total HT", 172, y + 5);
      doc.line(20, y + 7.5, 190, y + 7.5);
      y = y + 7.5;
      doc.setFont("Helvetica", "normal");
    }

    // Output description text block
    doc.text(descLines, 24, y + 4.5);

    // TVA percentage
    const vatPercentText = applyVat ? `${vatRate}%` : "0%";
    doc.text(vatPercentText, 112, y + 4.5);

    // Unit Price HT
    const unitPriceText = formatFCFA(line.unitPrice).replace(" F", "");
    doc.text(unitPriceText, 132, y + 4.5);

    // Quantity
    doc.text(String(line.quantity), 158, y + 4.5);

    // Total Line HT
    const lineTotalHT = line.quantity * line.unitPrice;
    const totalLineText = formatFCFA(lineTotalHT).replace(" F", "");
    doc.text(totalLineText, 172, y + 4.5);

    // Draw bottom row divider line
    doc.line(20, y + rowHeight, 190, y + rowHeight);
    y = y + rowHeight;
  });

  // 4. Totals block (placed bottom-right)
  y = y + 8;
  const totalsStartX = 125;
  const totalsWidth = 65;
  const lineSpacing = 6.5;

  const items = data.lines || [];
  const subtotalHT = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const vatAmount = applyVat ? Math.round(subtotalHT * (vatRate / 100)) : 0;
  const totalTTC = subtotalHT + vatAmount;

  // Let's decide if this invoice is paid
  const isPaid = data.status.trim().toLowerCase() === "payée" || data.status.trim().toLowerCase() === "accepted";
  const amountPaid = data.amountPaid !== undefined ? data.amountPaid : (isPaid ? totalTTC : 0);
  const amountRemaining = data.amountRemaining !== undefined ? data.amountRemaining : (totalTTC - amountPaid);

  const totals =
    data.type === "facture"
      ? [
          { label: "Total HT :", value: formatFCFA(subtotalHT) },
          { label: `Total TVA (${applyVat ? vatRate : 0}%) :`, value: formatFCFA(vatAmount) },
          { label: "Total TTC :", value: formatFCFA(totalTTC), bold: true, highlight: true },
          { label: "Montant Payé :", value: formatFCFA(amountPaid) },
          { label: "Reste à payer :", value: formatFCFA(amountRemaining), bold: true },
        ]
      : [
          { label: "Total HT :", value: formatFCFA(subtotalHT) },
          { label: `Total TVA (${applyVat ? vatRate : 0}%) :`, value: formatFCFA(vatAmount) },
          { label: "Total TTC :", value: formatFCFA(totalTTC), bold: true, highlight: true },
        ];

  totals.forEach((row: { label: string; value: string; bold?: boolean; highlight?: boolean }) => {
    if (row.highlight) {
      // Draw highlighted green background box for Total TTC
      doc.setFillColor(240, 253, 244); // #F0FDF4
      doc.rect(totalsStartX - 2, y - 4, totalsWidth + 2, 6, "F");
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    } else if (row.bold) {
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
    } else {
      doc.setFont("Helvetica", "normal");
      doc.setTextColor(lightTextColor[0], lightTextColor[1], lightTextColor[2]);
    }

    doc.setFontSize(8.5);
    doc.text(row.label, totalsStartX, y);
    doc.text(row.value, totalsStartX + totalsWidth - 2, y, { align: "right" });

    y = y + lineSpacing;
  });

  // 5. Terms & Bank details (Footer Area)
  // Position it fixed near bottom of A4 page
  const footerY = 258;
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.line(20, footerY, 190, footerY);

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(lightTextColor[0], lightTextColor[1], lightTextColor[2]);

  let footerLineY = footerY + 5;

  // Note / Payment Conditions (délai réel configuré dans Paramètres)
  doc.setFont("Helvetica", "bold");
  doc.text("Conditions de règlement :", 20, footerLineY);
  doc.setFont("Helvetica", "normal");
  const termsText =
    data.type === "facture"
      ? `Paiement à ${paymentTerm} jours à compter de la date d'émission de la facture.`
      : `Devis valable ${data.validityDays || 15} jours. Paiement à ${paymentTerm} jours après facturation.`;
  doc.text(termsText, 54, footerLineY);
  footerLineY += 4;

  // Coordonnées bancaires : uniquement si renseignées dans Paramètres
  if (company?.bank) {
    doc.setFont("Helvetica", "bold");
    doc.text("Coordonnées Bancaires (RIB) :", 20, footerLineY);
    doc.setFont("Helvetica", "normal");
    doc.text(company.bank, 62, footerLineY);
    footerLineY += 4;
  }

  doc.setFont("Helvetica", "italic");
  doc.text("Merci pour votre confiance !", 20, footerLineY + 1);

  // Save the document as valid PDF binary file
  doc.save(`${data.type}-${data.id}.pdf`);
}

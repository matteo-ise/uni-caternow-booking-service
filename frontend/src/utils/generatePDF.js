// PDF quote generator — jsPDF + autoTable for the menu breakdown, QR code linking
// back to the checkout page. Uses CaterNow teal (#037A8B) throughout.
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import QRCode from 'qrcode'

const COURSE_LABELS = {
  vorspeise: 'Vorspeise',
  hauptspeise1: 'Hauptspeise 1',
  hauptspeise2: 'Hauptspeise 2',
  nachspeise: 'Nachspeise',
}

const VAT_RATE = 0.19

export default async function generatePDF({
  menu,
  quantities,
  priceStats,
  wizardData,
  selectedServices,
  customWish,
  contactInfo,
  checkoutUrl,
}) {
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  let y = margin

  // --- Header ---
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(3, 122, 139) // #037A8B
  doc.text('CaterNow', margin, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139) // #64748b
  doc.text('Premium Catering Service', margin, y + 6)

  // Right-aligned document info
  doc.setFontSize(10)
  doc.setTextColor(15, 23, 42) // #0f172a
  doc.setFont('helvetica', 'bold')
  doc.text('Kostenblatt / Angebot', pageWidth - margin, y, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
  doc.text(`Erstellt am ${today}`, pageWidth - margin, y + 6, { align: 'right' })

  y += 14

  // Divider
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  // --- Event Details ---
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(15, 23, 42)
  doc.text('Veranstaltungsdetails', margin, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)

  const eventDate = wizardData.date
    ? new Date(wizardData.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
    : '-'

  const details = [
    ['Datum:', eventDate],
    ['Personenzahl:', `${wizardData.persons || '-'} Personen`],
    ['Kundentyp:', wizardData.customerType === 'business' ? 'Business (B2B)' : 'Privat (B2C)'],
  ]
  if (wizardData.companyName) {
    details.push(['Firma:', wizardData.companyName])
  }

  details.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold')
    doc.text(label, margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(value, margin + 35, y)
    y += 5
  })

  y += 4

  // --- Contact Info ---
  if (contactInfo) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(15, 23, 42)
    doc.text('Kontakt & Lieferadresse', margin, y)
    y += 7

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(71, 85, 105)

    const contactDetails = [
      ['Name:', contactInfo.name || '-'],
      ['E-Mail:', contactInfo.email || '-'],
      ['Adresse:', contactInfo.address || '-'],
    ]
    contactDetails.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold')
      doc.text(label, margin, y)
      doc.setFont('helvetica', 'normal')
      doc.text(value, margin + 35, y)
      y += 5
    })
    y += 4
  }

  // --- Menu Table ---
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(15, 23, 42)
  doc.text('Positionen', margin, y)
  y += 4

  const tableBody = []
  Object.entries(COURSE_LABELS).forEach(([key, label]) => {
    const dish = menu[key]
    if (!dish) return
    const qty = quantities[key] || 0
    const price = dish.preis || 15.0
    const total = qty * price
    tableBody.push([
      label,
      dish.name || '-',
      `${qty}`,
      `${price.toFixed(2)} \u20AC`,
      `${total.toFixed(2)} \u20AC`,
    ])
  })

  autoTable(doc, {
    startY: y,
    head: [['Gang', 'Gericht', 'Menge', 'Einzelpreis', 'Gesamt']],
    body: tableBody,
    theme: 'striped',
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [3, 122, 139],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [15, 23, 42],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      2: { halign: 'center' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
  })

  y = doc.lastAutoTable.finalY + 6

  // --- Price Summary ---
  const deliveryFee = priceStats.currentDelivery
  const subtotal = priceStats.subtotal
  const vat = priceStats.vat
  const total = priceStats.total

  const summaryX = pageWidth - margin - 70
  const valX = pageWidth - margin

  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)

  const summaryLines = [
    ['Zwischensumme (Netto):', `${subtotal.toFixed(2)} \u20AC`],
    ['Lieferung & Service:', `${deliveryFee.toFixed(2)} \u20AC`],
    ['MwSt. (19%):', `${vat.toFixed(2)} \u20AC`],
  ]

  summaryLines.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal')
    doc.text(label, summaryX, y, { align: 'right' })
    doc.text(value, valX, y, { align: 'right' })
    y += 5
  })

  y += 2
  doc.setDrawColor(15, 23, 42)
  doc.setLineWidth(0.8)
  doc.line(summaryX - 10, y, pageWidth - margin, y)
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(15, 23, 42)
  doc.text('Gesamtbetrag:', summaryX, y, { align: 'right' })
  doc.setTextColor(3, 122, 139)
  doc.text(`${total.toFixed(2)} \u20AC`, valX, y, { align: 'right' })
  y += 10

  // --- Services ---
  if (selectedServices.length > 0 || customWish) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42)
    doc.text('Zusatzleistungen', margin, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(71, 85, 105)
    selectedServices.forEach((s) => {
      doc.text(`\u2022 ${s}`, margin + 4, y)
      y += 5
    })
    if (customWish) {
      doc.text(`\u2022 Sonderwunsch: ${customWish}`, margin + 4, y)
      y += 5
    }
    y += 2
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.text('Zusatzleistungen werden gesondert nach Aufwand berechnet.', margin, y)
    y += 8
  }

  // --- QR Code + Link ---
  if (checkoutUrl) {
    // Check if we need a new page
    if (y > 240) {
      doc.addPage()
      y = margin
    }

    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(margin, y, pageWidth - margin, y)
    y += 8

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42)
    doc.text('Angebot online aufrufen', margin, y)
    y += 6

    try {
      const qrDataUrl = await QRCode.toDataURL(checkoutUrl, { width: 200, margin: 1, color: { dark: '#0f172a' } })
      doc.addImage(qrDataUrl, 'PNG', margin, y, 30, 30)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(100, 116, 139)
      doc.text('QR-Code scannen oder Link aufrufen:', margin + 36, y + 8)
      doc.setTextColor(3, 122, 139)
      doc.setFont('helvetica', 'bold')
      doc.text(checkoutUrl, margin + 36, y + 14)

      y += 36
    } catch {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(3, 122, 139)
      doc.text(checkoutUrl, margin, y)
      y += 8
    }
  }

  // --- Footer ---
  const footerY = doc.internal.pageSize.getHeight() - 12
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(148, 163, 184)
  doc.text(`Erstellt via CaterNow am ${today} | Dieses Dokument dient als internes Kostenblatt zur Freigabe.`, margin, footerY)

  // Save
  const fileName = `CaterNow_Kostenblatt_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(fileName)
}

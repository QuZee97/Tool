import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { page1, page2, css, filename } = req.body;

  if (!page1) {
    return res.status(400).json({ error: 'page1 content required' });
  }

  // Wir bauen EINEN durchgehenden HTML-Fluss.
  // Puppeteer paginiert selbst – kein festes min-height, kein overflow-hidden.
  // 25 mm Rand an allen Seiten via @page margin.
  // Seitenumbruch zwischen Angebot-Inhalt und AGB wird mit page-break-before erzwungen.
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    /* ── Reset ── */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root { --accent: #4a4a4a; --accent-light: #f5f5f5; }

    /* ── Basis-Typografie ── */
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 13px;
      color: #1a1a1a;
      background: #fff;
    }

    /* ── A4-Seite: Puppeteer übernimmt die Paginierung ── */
    @page {
      size: A4;
      margin: 25mm;   /* 2,5 cm Weißraum an allen Seiten */
    }

    /* ── Seiteninhalt-Container ── */
    /* page1 und page2 kommen direkt als innerHTML – ihre Styles bleiben erhalten */

    /* Ursprüngliche .page-Klasse deaktivieren (kommt aus dem .innerHTML) */
    .page {
      width: auto !important;
      min-height: 0 !important;
      height: auto !important;
      margin: 0 !important;
      padding: 0 !important;
      box-shadow: none !important;
      overflow: visible !important;
    }

    /* Trennlinie zwischen Seite 1 und AGB (Seite 2) */
    .page-break {
      page-break-before: always;
    }

    /* ── Farbtreue für Tabellen-Header, Totals, Info-Boxen ── */
    thead tr,
    .totals tr.total-row,
    .info-box,
    tbody tr:nth-child(even) {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── Alle ursprünglichen Tool-Styles ── */
    ${css || ''}

    /* ── Overrides die nach dem Tool-CSS kommen müssen ── */
    /* Kein festes page-Rechteck mehr – Inhalt fließt frei */
    #page1, #page2 {
      display: block !important;
      width: auto !important;
      min-height: 0 !important;
      height: auto !important;
      padding: 0 !important;
      margin: 0 !important;
      box-shadow: none !important;
      overflow: visible !important;
    }

    /* Header-Abstand nach oben entfernen (kommt von @page margin) */
    .header { margin-top: 0 !important; }

    /* Footer immer sichtbar, kein position:absolute */
    .doc-footer { position: static !important; }

    /* Sicherstellen dass Seite 2 (AGB) immer auf neuer Seite beginnt */
    #page2 { page-break-before: always; }
  </style>
</head>
<body>
  <div id="page1">${page1}</div>
  ${page2 ? `<div id="page2">${page2}</div>` : ''}
</body>
</html>`;

  let browser = null;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      // Margin wird komplett über @page CSS gesteuert – hier 0
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      displayHeaderFooter: false,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename || 'Dokument')}.pdf"`
    );
    res.send(pdf);

  } catch (err) {
    console.error('PDF error:', err);
    res.status(500).json({ error: 'PDF generation failed', details: err.message });
  } finally {
    if (browser) await browser.close();
  }
}

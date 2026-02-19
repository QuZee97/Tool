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

  // Vollständiges HTML für das PDF bauen
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root { --accent: #4a4a4a; --accent-light: #f5f5f5; }
    ${css || ''}
    .print-page {
      padding: 18mm 20mm 20mm 25mm;
      page-break-after: always;
      width: 210mm;
      min-height: 297mm;
    }
    .print-page:last-child { page-break-after: auto; }
    @page { size: A4; margin: 0; }
    thead tr { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .totals tr.total-row { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .info-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    tbody tr:nth-child(even) { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style>
</head>
<body>
  <div class="print-page">${page1}</div>
  ${page2 ? `<div class="print-page">${page2}</div>` : ''}
</body>
</html>`;

  let browser = null;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename || 'Dokument')}.pdf"`);
    res.send(pdf);

  } catch (err) {
    console.error('PDF error:', err);
    res.status(500).json({ error: 'PDF generation failed', details: err.message });
  } finally {
    if (browser) await browser.close();
  }
}

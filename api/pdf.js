module.exports.config = {
  api: { bodyParser: { sizeLimit: '5mb' } }
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { page1, page2, css, filename } = req.body;
  if (!page1) {
    return res.status(400).json({ error: 'page1 content required' });
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root { --accent: #4a4a4a; --accent-light: #f5f5f5; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 13px;
      color: #1a1a1a;
      background: #fff;
    }
    @page { size: A4; margin: 25mm; }
    .page {
      width: auto !important;
      min-height: 0 !important;
      height: auto !important;
      margin: 0 !important;
      padding: 0 !important;
      box-shadow: none !important;
      overflow: visible !important;
    }
    thead tr,
    .totals tr.total-row,
    .info-box,
    tbody tr:nth-child(even) {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    ${css || ''}
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
    .header { margin-top: 0 !important; }
    .doc-footer { position: static !important; }
    #page2 { page-break-before: always; }
  </style>
</head>
<body>
  <div id="page1">${page1}</div>
  ${page2 ? `<div id="page2">${page2}</div>` : ''}
</body>
</html>`;

  const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN;
  if (!BROWSERLESS_TOKEN) {
    return res.status(500).json({ error: 'BROWSERLESS_TOKEN not configured' });
  }

  try {
    const response = await fetch(
      `https://production-sfo.browserless.io/pdf?token=${BROWSERLESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html,
          options: {
            format: 'A4',
            printBackground: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
            displayHeaderFooter: false,
          }
        })
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Browserless error ${response.status}: ${text}`);
    }

    const pdfBuffer = Buffer.from(await response.arrayBuffer());

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename || 'Dokument')}.pdf"`
    );
    res.send(pdfBuffer);

  } catch (err) {
    console.error('PDF error:', err);
    res.status(500).json({ error: 'PDF generation failed', details: err.message });
  }
};

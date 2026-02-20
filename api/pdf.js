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
    /* ── BASE RESET ──────────────────────────────────────── */
    * { margin: 0; padding: 0; box-sizing: border-box; }

    /* ── CSS-VARIABLEN: Dark-Theme komplett überschreiben ── */
    :root {
      --bg: #ffffff;
      --surface: #ffffff;
      --surface2: #f7f7f7;
      --surface3: #eeeeee;
      --border: #e0e0e0;
      --border2: #cccccc;
      --text: #1a1a1a;
      --text2: #444444;
      --text3: #666666;
      --accent: #d4cc2e;
      --accent-dim: #a8a325;
      --red: #c0392b;
      --green: #27ae60;
      --blue: #2980b9;
      /* Dok-spezifische Variablen */
      --doc-accent: #5a5a5a;
      --doc-accent-soft: #888888;
      --doc-light: #f7f7f7;
    }

    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 12.5px;
      color: #1a1a1a !important;
      background: #ffffff !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    @page { size: A4; margin: 25mm; }

    /* ── DOKUMENT-SEITEN ─────────────────────────────────── */
    #page1, #page2 {
      display: block !important;
      width: auto !important;
      min-height: 0 !important;
      height: auto !important;
      padding: 0 !important;
      margin: 0 !important;
      box-shadow: none !important;
      overflow: visible !important;
      background: #fff !important;
      color: #1a1a1a !important;
    }
    #page2 { page-break-before: always; }

    /* ── FARBKORREKTUR: alle Texte auf dunkel ────────────── */
    /* Verhindert dass CSS-Variablen-Reste zu hellem Text führen */
    .doc-page, .doc-page * {
      color: inherit;
    }
    .doc-page { color: #1a1a1a; }
    .doc-meta-row { color: #444 !important; }
    .doc-meta-label { color: #888 !important; }
    .doc-name-sub { color: #888 !important; }
    .sender-bar { color: #aaa !important; }
    .doc-intro { color: #333 !important; }
    .sign-block { color: #333 !important; }
    .doc-footer { color: #444 !important; }
    .doc-footer strong { color: #222 !important; }
    .info-box { color: #333 !important; background: #f8f8f8 !important; }
    .agb-hint-box { color: #444 !important; background: #f8f8f8 !important; }
    .agb-section p { color: #333 !important; }
    .agb-section h3 { color: #4a4a4a !important; }
    .doc-table tbody td { color: #1a1a1a !important; }
    .doc-table tbody tr:nth-child(even) { background: #f7f7f7 !important; }
    .doc-table thead tr { background: #5a5a5a !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .doc-table thead th { color: #fff !important; }
    .totals-wrap td { color: #1a1a1a !important; }
    .totals-wrap tr.total-final { background: #5a5a5a !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .totals-wrap tr.total-final td { color: #fff !important; }
    .hist-badge { color: #1a1a1a !important; }
    .sig-field { color: #888 !important; }

    /* ── INLINE-EDIT FELDER im PDF unsichtbar ────────────── */
    .ie, .ie-block, .ie-select, .ie-date {
      border: none !important;
      background: transparent !important;
      color: inherit !important;
      outline: none !important;
    }
    input, select, textarea {
      border: none !important;
      background: transparent !important;
      -webkit-appearance: none;
      appearance: none;
    }

    /* ── NO-PRINT ausblenden ─────────────────────────────── */
    .no-print { display: none !important; }
    .recipient-toolbar { display: none !important; }
    .add-row-btn { display: none !important; }
    .pos-del { display: none !important; }

    /* ── TABELLENZEILEN: Kein Umbruch innerhalb einer Leistungszeile ── */
    .doc-table tbody tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    /* Abschlussblock komplett zusammenhalten */
    .doc-closing-block {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    /* ── TOTALS + FOOTER: Immer zusammen auf der gleichen Seite ── */
    .totals-wrap {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    /* Footer-Block: zusammen mit den Rechnungsdaten halten */
    .doc-footer {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    /* Signatur-Block auf Seite 2 zusammenhalten */
    .sig-block {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    /* Info-Boxen nicht auftrennen */
    .info-box, .agb-hint-box {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    /* AGB-Sektionen einzeln zusammenhalten */
    .agb-section {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    /* Unterschriftsblock + Zahlungsbedinungen + Footer: als Gruppe */
    .sign-block {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    /* Totals + Footer + Sign zusammenhalten (verhindert Trennung am Seitenende) */
    .totals-wrap, .sign-block, .doc-footer, .info-box {
      orphans: 4;
      widows: 4;
    }

    /* ── DANN: Page-spezifisches CSS aus dem Tool ────────── */
    ${css || ''}

    /* ── NACH DEM TOOL-CSS: Farben nochmals erzwingen ───── */
    body { color: #1a1a1a !important; background: #fff !important; }
    .doc-page { color: #1a1a1a !important; background: #fff !important; }
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

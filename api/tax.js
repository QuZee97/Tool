module.exports.config = {
  api: { bodyParser: { sizeLimit: '10mb' } }
};

// Steuerkategorien für deutsche Kleinunternehmer / Regelbesteuerer
const CATEGORIES = {
  // EINNAHMEN
  einnahmen_19: { label: 'Einnahmen 19% MwSt.', type: 'income', vat: 0.19 },
  einnahmen_7:  { label: 'Einnahmen 7% MwSt.',  type: 'income', vat: 0.07 },
  einnahmen_0:  { label: 'Einnahmen steuerfrei / Ausland', type: 'income', vat: 0 },

  // AUSGABEN – Betriebsausgaben (Vorsteuerabzug möglich)
  software:        { label: 'Software & Tools',         type: 'expense', vat: 0.19 },
  hardware:        { label: 'Hardware & Technik',        type: 'expense', vat: 0.19 },
  buero:           { label: 'Büro & Arbeitsmittel',      type: 'expense', vat: 0.19 },
  marketing:       { label: 'Marketing & Werbung',       type: 'expense', vat: 0.19 },
  reise:           { label: 'Reise & Fahrtkosten',       type: 'expense', vat: 0.07 },
  bewirtung:       { label: 'Bewirtung (70% absetzbar)', type: 'expense', vat: 0.19, limitFactor: 0.7 },
  telefon:         { label: 'Telefon & Internet',        type: 'expense', vat: 0.19 },
  weiterbildung:   { label: 'Weiterbildung & Kurse',     type: 'expense', vat: 0.19 },
  freelancer:      { label: 'Fremdleistungen / Freelancer', type: 'expense', vat: 0.19 },
  versicherung:    { label: 'Versicherungen',            type: 'expense', vat: 0 },
  steuerberatung:  { label: 'Steuerberatung & Buchhaltung', type: 'expense', vat: 0.19 },
  miete:           { label: 'Miete / Raumkosten',        type: 'expense', vat: 0.19 },
  sonstiges:       { label: 'Sonstiges',                 type: 'expense', vat: 0.19 },
  privat:          { label: 'Privat (nicht absetzbar)',  type: 'private', vat: 0 },
};

// Kompaktes System-Prompt – weniger Token = schnellere Antwort
const CAT_LIST = Object.entries(CATEGORIES).map(([k,v]) => `${k}:${v.label}`).join('|');
const SYSTEM_PROMPT = `Steuerexperte DE. Kategorisiere Finanztransaktionen für UStVA/EÜR.
Kategorien: ${CAT_LIST}
Antworte NUR als JSON: {"entries":[{"id":<id>,"beschreibung":<str>,"kategorie":<key>,"betrag_netto":<num>,"betrag_brutto":<num>,"mwst_betrag":<num>,"mwst_satz":<0|0.07|0.19>,"datum":<str>,"begruendung":<max60chr>,"konfidenz":<hoch|mittel|niedrig>,"unklar":<bool>}]}
Regeln: Betrag immer positiv. Bei Unklarheit unklar:true. Bewirtung limitFactor 0.7.`;

const VISION_PROMPT = `Du bist ein deutscher Steuerexperte. Analysiere dieses Bild (Rechnung, Kontoauszug oder Beleg).
Extrahiere ALLE erkennbaren Finanztransaktionen oder Buchungsposten.

${SYSTEM_PROMPT}

Für Bilder von Rechnungen/Belegen: Erkenne Datum, Händler/Empfänger, Betrag (Brutto und Netto) und MwSt-Satz.
Für Kontoauszüge: Extrahiere jede einzelne Buchungszeile mit Datum, Beschreibung und Betrag.
Antwort als JSON-Objekt: { "entries": [ ... ] }`;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY nicht konfiguriert' });

  const { entries, mode, imageData, imageType, filename } = req.body;
  // mode: 'categorize' | 'freitext' | 'vision' | 'categories'

  // Nur Kategorien zurückgeben (für Client-Init)
  if (mode === 'categories') {
    return res.status(200).json({ categories: CATEGORIES });
  }

  // ── VISION MODE: Bild oder PDF als base64 ──────────────────
  if (mode === 'vision') {
    if (!imageData) return res.status(400).json({ error: 'Kein Bildinhalt übermittelt' });

    let messages;
    const mimeType = imageType || 'image/jpeg';
    const isPDF = mimeType === 'application/pdf' || (filename || '').toLowerCase().endsWith('.pdf');

    if (isPDF) {
      // PDF: Text-basiert über gpt-4o mit base64-encodiertem PDF-Inhalt
      // OpenAI unterstützt PDFs nativ als file input in gpt-4o
      messages = [
        { role: 'system', content: VISION_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analysiere dieses PDF-Dokument (${filename || 'Dokument'}) und extrahiere alle Finanztransaktionen.`
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageData}`,
                detail: 'high'
              }
            }
          ]
        }
      ];
    } else {
      // Bild (PNG, JPG, HEIC, WEBP etc.)
      messages = [
        { role: 'system', content: VISION_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analysiere dieses Bild und extrahiere alle erkennbaren Finanztransaktionen oder Buchungsposten.`
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageData}`,
                detail: 'high'
              }
            }
          ]
        }
      ];
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',  // Vision benötigt gpt-4o, nicht mini
          messages,
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        return res.status(502).json({ error: 'OpenAI Vision Fehler: ' + (err.error?.message || response.statusText) });
      }

      const data = await response.json();
      const raw = data.choices[0].message.content;

      let parsed;
      try {
        const obj = JSON.parse(raw);
        parsed = Array.isArray(obj) ? obj : (obj.entries || obj.transactions || obj.items || Object.values(obj)[0]);
        if (!Array.isArray(parsed)) parsed = [];
      } catch {
        return res.status(500).json({ error: 'KI-Antwort nicht parsebar', raw });
      }

      const enriched = parsed.map((item, i) => ({
        ...item,
        id: item.id || ('v' + i),
        kategorie_info: CATEGORIES[item.kategorie] || CATEGORIES.sonstiges,
      }));

      return res.status(200).json({ results: enriched, usage: data.usage, categories: CATEGORIES });

    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── TEXT MODES (categorize / freitext) ────────────────────
  if (!entries || !entries.length) return res.status(400).json({ error: 'Keine Einträge' });

  const userContent = mode === 'freitext'
    ? `Extrahiere alle Finanztransaktionen aus folgendem Text und kategorisiere sie:\n\n${entries[0].text}`
    : `Kategorisiere diese ${entries.length} Transaktionen:\n\n${JSON.stringify(entries.map(e => ({
        id: e.id,
        beschreibung: e.beschreibung || e.text || '',
        betrag: e.betrag,
        datum: e.datum || '',
        quelle: e.quelle || '',
      })), null, 2)}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: userContent },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(502).json({ error: 'OpenAI Fehler: ' + (err.error?.message || response.statusText) });
    }

    const data = await response.json();
    const raw = data.choices[0].message.content;

    let parsed;
    try {
      const obj = JSON.parse(raw);
      parsed = Array.isArray(obj) ? obj : (obj.entries || obj.transactions || obj.items || Object.values(obj)[0]);
      if (!Array.isArray(parsed)) parsed = [];
    } catch {
      return res.status(500).json({ error: 'KI-Antwort nicht parsebar', raw });
    }

    const enriched = parsed.map(item => ({
      ...item,
      kategorie_info: CATEGORIES[item.kategorie] || CATEGORIES.sonstiges,
    }));

    return res.status(200).json({ results: enriched, usage: data.usage, categories: CATEGORIES });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

module.exports.config = {
  api: { bodyParser: { sizeLimit: '10mb' } }
};

// Steuerkategorien für deutsche Kleinunternehmer / Regelbesteuerer
const CATEGORIES = {
  // EINNAHMEN
  einnahmen_19: { label: 'Einnahmen 19% MwSt.', type: 'income', vat: 0.19 },
  einnahmen_7:  { label: 'Einnahmen 7% MwSt.',  type: 'income', vat: 0.07 },
  einnahmen_0:  { label: 'Einnahmen steuerfrei / EU-Ausland', type: 'income', vat: 0 },
  einnahmen_eu:        { label: 'EU-Leistungen (§4 Nr.1b, innergemeinschaftlich)',   type: 'income',  vat: 0 },
  einnahmen_drittland: { label: 'Drittland-Leistungen (§4 Nr.1a, außerhalb EU)',     type: 'income',  vat: 0 },

  // BETRIEBSAUSGABEN (Vorsteuerabzug möglich)
  software:        { label: 'Software & Tools',             type: 'expense', vat: 0.19 },
  hardware:        { label: 'Hardware & Technik',            type: 'expense', vat: 0.19 },
  buero:           { label: 'Büro & Arbeitsmittel',          type: 'expense', vat: 0.19 },
  marketing:       { label: 'Marketing & Werbung',           type: 'expense', vat: 0.19 },
  reise:           { label: 'Reise & Fahrtkosten',           type: 'expense', vat: 0.07 },
  bewirtung:       { label: 'Bewirtung (70% absetzbar)',     type: 'expense', vat: 0.19, limitFactor: 0.7 },
  telefon:         { label: 'Telefon & Internet',            type: 'expense', vat: 0.19 },
  weiterbildung:   { label: 'Weiterbildung & Kurse',         type: 'expense', vat: 0.19 },
  freelancer:      { label: 'Fremdleistungen / Freelancer',  type: 'expense', vat: 0.19 },
  versicherung:    { label: 'Versicherungen',                type: 'expense', vat: 0 },
  steuerberatung:  { label: 'Steuerberatung & Buchhaltung',  type: 'expense', vat: 0.19 },
  miete:           { label: 'Miete / Raumkosten',            type: 'expense', vat: 0.19 },
  kontofuehrung:   { label: 'Kontoführung (mit MwSt, z.B. Kontist)', type: 'expense', vat: 0.19 },
  bankgebuehr:     { label: 'Bankgebühren (ohne MwSt)',      type: 'expense', vat: 0 },
  sonstiges:       { label: 'Sonstiges (Ausgabe)',           type: 'expense', vat: 0.19 },
  rc_eingang:      { label: 'Reverse Charge Eingang (§13b)', type: 'expense', vat: 0.19 },

  // STEUERZAHLUNGEN (NICHT absetzbar als Betriebsausgabe!)
  steuer_ust:   { label: 'USt-Vorauszahlung / USt-Erstattung', type: 'tax', vat: 0 },
  steuer_est:   { label: 'Einkommensteuer-Zahlung',             type: 'tax', vat: 0 },
  steuer_gewst: { label: 'Gewerbesteuer-Zahlung',               type: 'tax', vat: 0 },
  steuer_soli:  { label: 'Solidaritätszuschlag',                type: 'tax', vat: 0 },
  steuer_kist:  { label: 'Kirchensteuer',                       type: 'tax', vat: 0 },

  // PRIVAT
  privat:          { label: 'Privat (nicht absetzbar)',       type: 'private', vat: 0 },
};

const CAT_LIST = Object.entries(CATEGORIES).map(([k,v]) => `${k} = ${v.label}`).join('\n');

// Verbessertes System-Prompt: klare Regeln, keine 60-Zeichen-Beschränkung für Begründungen
const SYSTEM_PROMPT = `Du bist ein erfahrener Steuerberater für deutsche Selbstständige und GmbHs.
Deine Aufgabe: Kategorisiere Finanztransaktionen für die deutsche UStVA und EÜR.

VERFÜGBARE KATEGORIEN:
${CAT_LIST}

AUSGABE-FORMAT (strikt als JSON-Objekt):
{
  "entries": [
    {
      "id": "<exakt gleiche ID wie in der Eingabe>",
      "beschreibung": "<präzise Buchungsbeschreibung, max 100 Zeichen>",
      "kategorie": "<einer der Kategorie-Schlüssel oben>",
      "betrag_brutto": <Zahl, immer positiv>,
      "betrag_netto": <Zahl, immer positiv>,
      "mwst_betrag": <Zahl>,
      "mwst_satz": <0 | 0.07 | 0.19>,
      "datum": "<YYYY-MM-DD oder leer>",
      "begruendung": "<Begründung warum diese Kategorie, 1-2 Sätze, z.B. ob Reverse Charge, EU-Leistung, private Abgrenzung etc.>",
      "konfidenz": "<hoch | mittel | niedrig>",
      "unklar": <true | false>
    }
  ]
}

REGELN:
- IDs MÜSSEN exakt mit der Eingabe übereinstimmen (wichtig fürs Matching!)
- Beträge immer positiv (Vorzeichen wird vom System bestimmt)
- Wenn Buchung eindeutig privat ist: kategorie = "privat"
- Fintech-Kontoführung MIT MwSt (Kontist, Qonto, Penta, N26 Business, Finom): kategorie = "kontofuehrung" (MwSt = 19%). NICHT "steuerberatung"!
- Klassische Bankgebühren OHNE MwSt (Sparkasse, Volksbank, Commerzbank, Zinsen): kategorie = "bankgebuehr" (MwSt = 0). NICHT "steuerberatung"!
- EU-Ausland Einnahmen (B2B Leistungen an EU-Unternehmen, §4 Nr.1b, z.B. Österreich, Frankreich): kategorie = "einnahmen_eu", keine MwSt ausweisen
- Drittland-Einnahmen (§4 Nr.1a, außerhalb EU: USA, UK, Schweiz, etc.): kategorie = "einnahmen_drittland", keine MwSt ausweisen
- EU-Ausland Ausgaben ohne MwSt (z.B. Meta Ads, Google Cloud, Adobe, Stripe, GitHub, Slack, Figma): kategorie = "rc_eingang" (Reverse Charge §13b), unklar=true zur Prüfung
- Software-Abos (Figma, Notion, Slack, Adobe, GitHub etc.): kategorie = "software"
- Bewirtungsbeleg: limitFactor 0.7 beachten (nur 70% absetzbar)

STEUERZAHLUNGEN (WICHTIG – nicht mit Betriebsausgaben verwechseln!):
- Umsatzsteuer-Vorauszahlung ans Finanzamt / USt-Erstattung: kategorie = "steuer_ust"
- Einkommensteuer-Zahlung / ESt-Vorauszahlung / Einkommensteuer-Erstattung: kategorie = "steuer_est"
- Gewerbesteuer-Zahlung: kategorie = "steuer_gewst"
- Solidaritätszuschlag: kategorie = "steuer_soli"
- Kirchensteuer: kategorie = "steuer_kist"
- Erkennungshinweise: "Finanzamt", "FA ", "Steuernummer", "USt", "ESt", "GewSt", "Vorauszahlung"
- Steuerzahlungen sind KEINE Betriebsausgaben und KEINE Vorsteuer!

- Bei Unklarheit: unklar=true und erkläre in begruendung warum
- konfidenz="niedrig" wenn Buchungstext sehr vage ist`;

// Vision-Prompt für Belege (Bilder/PDFs)
const VISION_SYSTEM = `Du bist ein erfahrener Steuerberater für deutsche Selbstständige.
Analysiere dieses Dokument (Rechnung, Quittung oder Beleg) und extrahiere die Finanzdaten.

Extrahiere folgende Felder:
- datum: Rechnungsdatum (Format YYYY-MM-DD)
- absender: Firmenname des Ausstellers/Händlers (max 60 Zeichen, z.B. "Amazon EU S.à r.l.", "Rewe GmbH"), null falls nicht erkennbar
- rechnungsnummer: Rechnungs- oder Belegnummer exakt wie auf dem Dokument (z.B. "RE-2024-001", "INV-12345", "2024-R-00815"), null falls nicht vorhanden
- beschreibung: Händler + kurze Leistungsbeschreibung (max 80 Zeichen)
- betrag_brutto: Gesamtbetrag inkl. MwSt (positiv)
- betrag_netto: Nettobetrag ohne MwSt (positiv)
- mwst_betrag: MwSt-Betrag
- mwst_satz: MwSt-Satz (0, 0.07 oder 0.19)
- kategorie: Kategorie-Schlüssel (siehe unten)
- begruendung: Warum diese Kategorie? Besonderheiten? (1-2 Sätze)
- konfidenz: hoch/mittel/niedrig

KATEGORIEN:
${CAT_LIST}

Antworte als JSON: { "entries": [ { "datum": ..., "absender": ..., "rechnungsnummer": ..., "beschreibung": ..., "betrag_brutto": ..., "betrag_netto": ..., "mwst_betrag": ..., "mwst_satz": ..., "kategorie": ..., "begruendung": ..., "konfidenz": ... } ] }`;

// Upload PDF to OpenAI Files API, then use file_id in message
async function uploadPDFToOpenAI(base64, filename, apiKey) {
  const { Readable } = require('stream');
  const FormData = require('form-data');

  const buffer = Buffer.from(base64, 'base64');
  const form = new FormData();
  form.append('purpose', 'assistants');
  form.append('file', buffer, {
    filename: filename || 'document.pdf',
    contentType: 'application/pdf',
  });

  const response = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      ...form.getHeaders(),
    },
    body: form,
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error('File upload fehlgeschlagen: ' + (err.error?.message || response.statusText));
  }
  const data = await response.json();
  return data.id; // file_id
}

// Lösche eine Datei von OpenAI Files API (nach Verwendung)
async function deletePDFFromOpenAI(fileId, apiKey) {
  try {
    await fetch(`https://api.openai.com/v1/files/${fileId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
  } catch {} // ignoriere Fehler beim Aufräumen
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY nicht konfiguriert' });

  const { entries, mode, imageData, imageType, filename, messages, context } = req.body;

  // Nur Kategorien zurückgeben
  if (mode === 'categories') {
    return res.status(200).json({ categories: CATEGORIES });
  }

  // ── TAX CHAT MODE ──────────────────────────────────────────
  if (mode === 'tax_chat') {
    if (!messages?.length) return res.status(400).json({ error: 'Keine Nachrichten' });

    const fmt = n => n != null ? Number(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '?';

    const systemPrompt = `Du bist ein persönlicher Steuerberater für einen deutschen Freiberufler/Selbstständigen (Einzelunternehmer, Regelbesteuerung, UStVA-pflichtig).

AKTUELLE FINANZSITUATION (${context?.period || 'aktueller Zeitraum'}):
- Einnahmen brutto: ${fmt(context?.einnahmen)} €
- Betriebsausgaben netto: ${fmt(context?.ausgaben)} €
- Gewinn (EÜR): ${fmt(context?.gewinn)} €
- USt-Zahllast: ${fmt(context?.ustZahllast)} €
- Offene Ausgangsrechnungen: ${context?.offeneRechnungen != null ? fmt(context.offeneRechnungen) + ' €' : 'nicht geladen'}
- Genutzte Kategorien: ${context?.categories || 'keine Angabe'}

DEINE AUFGABE:
- Beantworte Steuerfragen präzise und praxisnah
- Zeige konkrete Steuersparpotenziale auf (was kann ich noch absetzen?)
- Erkläre welche Ausgaben absetzbar sind und wie
- Nenne wichtige Fristen (UStVA, Vorauszahlungen, Jahresabschluss)
- Bei Abschreibungsfragen: erkläre GWG-Grenze (800 € netto) und lineare Abschreibung
- Verweise auf relevante Paragraphen wo sinnvoll (§ 4 EStG etc.)
- Antworte IMMER auf Deutsch, klar und strukturiert
- Maximal 200 Wörter pro Antwort
- Keine Haftungsausschlüsse – gib direkte, umsetzbare Empfehlungen`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.slice(-12), // max 12 Nachrichten History
          ],
          temperature: 0.3,
          max_tokens: 700,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        return res.status(502).json({ error: 'OpenAI Fehler: ' + (err.error?.message || response.statusText) });
      }

      const data = await response.json();
      const answer = data.choices[0].message.content;
      return res.status(200).json({ answer, usage: data.usage });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── VISION MODE ────────────────────────────────────────────
  if (mode === 'vision') {
    if (!imageData) return res.status(400).json({ error: 'Kein Bildinhalt übermittelt' });

    const mimeType = imageType || 'image/jpeg';
    const isPDF = mimeType === 'application/pdf' || (filename || '').toLowerCase().endsWith('.pdf');

    let messages;

    if (isPDF) {
      // PDFs: OpenAI Responses API mit nativem input_file (gpt-4o unterstützt PDFs nativ)
      // Chat Completions unterstützt PDFs NICHT als image_url → wir nutzen /v1/responses
      console.log('[tax/vision] PDF erkannt, nutze Responses API mit input_file:', filename);
      try {
        const responsesBody = {
          model: 'gpt-4o',
          input: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_file',
                  filename: filename || 'document.pdf',
                  file_data: `data:application/pdf;base64,${imageData}`,
                },
                {
                  type: 'input_text',
                  text: `Analysiere diese Rechnung/diesen Beleg (PDF: ${filename || 'Dokument'}). Extrahiere alle Finanzdaten: Datum, Empfänger/Händler, Brutto/Netto-Betrag, MwSt-Satz und Kategorie.\n\n${VISION_SYSTEM}`,
                },
              ],
            },
          ],
          text: { format: { type: 'json_object' } },
          temperature: 0.1,
          max_output_tokens: 2000,
        };

        const responsesResp = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify(responsesBody),
        });

        if (!responsesResp.ok) {
          const err = await responsesResp.json();
          console.error('[tax/vision] Responses API Fehler:', JSON.stringify(err).slice(0, 400));
          return res.status(502).json({ error: 'OpenAI Vision Fehler (PDF): ' + (err.error?.message || responsesResp.statusText) });
        }

        const responsesData = await responsesResp.json();
        console.log('[tax/vision] Responses API usage:', JSON.stringify(responsesData.usage));

        // Responses API gibt output[].content[].text zurück
        const rawContent = responsesData.output?.find(o => o.type === 'message')
          ?.content?.find(c => c.type === 'output_text')?.text
          || responsesData.output_text
          || '';

        console.log('[tax/vision] PDF raw response:', rawContent.slice(0, 500));

        let parsed;
        try {
          const obj = JSON.parse(rawContent);
          parsed = Array.isArray(obj) ? obj : (obj.entries || obj.transactions || obj.items || Object.values(obj)[0]);
          if (!Array.isArray(parsed)) parsed = [];
        } catch {
          return res.status(500).json({ error: 'KI-Antwort (PDF) nicht parsebar', raw: rawContent });
        }

        const enriched = parsed.map((item, i) => ({
          ...item,
          id: item.id || ('v' + i),
          kategorie: CATEGORIES[item.kategorie] ? item.kategorie : 'sonstiges',
          kategorie_info: CATEGORIES[item.kategorie] || CATEGORIES.sonstiges,
        }));

        return res.status(200).json({ results: enriched, usage: responsesData.usage, categories: CATEGORIES });

      } catch (e) {
        console.error('[tax/vision] PDF Fehler:', e.message);
        return res.status(500).json({ error: 'PDF-Verarbeitung fehlgeschlagen: ' + e.message });
      }
    } else {
      // Bild (PNG, JPG, HEIC, WEBP)
      messages = [
        { role: 'system', content: VISION_SYSTEM },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Analysiere diesen Beleg/diese Rechnung (${filename || 'Bild'}). Extrahiere alle Finanzdaten.` },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageData}`, detail: 'high' } }
          ]
        }
      ];
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages,
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        return res.status(502).json({ error: 'OpenAI Vision Fehler: ' + (err.error?.message || response.statusText) });
      }

      const data = await response.json();
      const raw = data.choices[0].message.content;
      console.log('[tax/vision] response raw:', raw.slice(0, 500));

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
        kategorie: CATEGORIES[item.kategorie] ? item.kategorie : 'sonstiges',
        kategorie_info: CATEGORIES[item.kategorie] || CATEGORIES.sonstiges,
      }));

      return res.status(200).json({ results: enriched, usage: data.usage, categories: CATEGORIES });

    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── CATEGORIZE MODE ────────────────────────────────────────
  if (!entries || !entries.length) return res.status(400).json({ error: 'Keine Einträge' });

  const userContent = mode === 'freitext'
    ? `Extrahiere alle Finanztransaktionen aus folgendem Text und kategorisiere sie:\n\n${entries[0].text}`
    : `Kategorisiere diese ${entries.length} Transaktionen. Gib für JEDE Transaktion einen Eintrag zurück, mit exakt derselben ID:\n\n${
        JSON.stringify(entries.map(e => ({
          id: e.id,
          beschreibung: e.beschreibung || e.text || '',
          betrag: e.betrag,
          datum: e.datum || '',
          quelle: e.quelle || '',
        })), null, 2)
      }`;

  console.log('[tax/categorize] sending', entries.length, 'entries, first:', entries[0]?.id, entries[0]?.beschreibung?.slice(0,60));

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: userContent },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(502).json({ error: 'OpenAI Fehler: ' + (err.error?.message || response.statusText) });
    }

    const data = await response.json();
    const raw = data.choices[0].message.content;
    console.log('[tax/categorize] raw response:', raw.slice(0, 800));

    let parsed;
    try {
      const obj = JSON.parse(raw);
      parsed = Array.isArray(obj) ? obj : (obj.entries || obj.transactions || obj.items || Object.values(obj)[0]);
      if (!Array.isArray(parsed)) parsed = [];
    } catch {
      return res.status(500).json({ error: 'KI-Antwort nicht parsebar', raw });
    }

    console.log('[tax/categorize] parsed', parsed.length, 'results, first:', parsed[0]?.id, parsed[0]?.kategorie);

    // Validiere: Kategorie-Schlüssel muss in CATEGORIES existieren
    const enriched = parsed.map(item => ({
      ...item,
      kategorie: CATEGORIES[item.kategorie] ? item.kategorie : (item.kategorie ? 'sonstiges' : null),
      kategorie_info: CATEGORIES[item.kategorie] || CATEGORIES.sonstiges,
    }));

    return res.status(200).json({ results: enriched, usage: data.usage, categories: CATEGORIES });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

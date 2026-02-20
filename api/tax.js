module.exports.config = {
  api: { bodyParser: { sizeLimit: '2mb' } }
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

const SYSTEM_PROMPT = `Du bist ein deutscher Steuerexperte-Assistent für Selbstständige und Freiberufler.
Deine Aufgabe: Analysiere Finanztransaktionen und kategorisiere sie für die Umsatzsteuervoranmeldung (UStVA) und Einnahmenüberschussrechnung (EÜR).

Verfügbare Kategorien:
${Object.entries(CATEGORIES).map(([k,v]) => `- "${k}": ${v.label} (${v.type})`).join('\n')}

Antworte IMMER als valides JSON-Array. Für jeden Eintrag:
{
  "id": <original id>,
  "kategorie": <kategorie-key>,
  "betrag_netto": <Nettobetrag als Zahl>,
  "betrag_brutto": <Bruttobetrag als Zahl>,
  "mwst_betrag": <MwSt-Betrag als Zahl>,
  "mwst_satz": <0.19 oder 0.07 oder 0>,
  "begruendung": <kurze Begründung auf Deutsch, max 80 Zeichen>,
  "konfidenz": <"hoch"|"mittel"|"niedrig">,
  "unklar": <true wenn Human-Review empfohlen>
}

Regeln:
- Bei Ausgaben: Vorsteuer nur wenn Beleg vorliegt und betrieblicher Zweck klar ist
- Bewirtung: max 70% der Kosten absetzbar, flagge als unklar wenn >50€
- Gemischte Nutzung (privat/geschäftlich): flagge als unklar
- Im Zweifel: konfidenz "niedrig" und unklar: true setzen
- Betrag immer positiv zurückgeben, Typ (income/expense) kommt aus der Kategorie`;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY nicht konfiguriert' });

  const { entries, mode } = req.body;
  // mode: 'categorize' | 'ustvasuche' | 'freitext'

  if (!entries || !entries.length) return res.status(400).json({ error: 'Keine Einträge' });

  // Eingabe für die KI aufbereiten
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
        temperature: 0.1, // niedrig = konsistent, deterministisch
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(502).json({ error: 'OpenAI Fehler: ' + (err.error?.message || response.statusText) });
    }

    const data = await response.json();
    const raw = data.choices[0].message.content;

    // JSON parsen – KI gibt manchmal { "entries": [...] } oder direkt [...] zurück
    let parsed;
    try {
      const obj = JSON.parse(raw);
      parsed = Array.isArray(obj) ? obj : (obj.entries || obj.transactions || obj.items || Object.values(obj)[0]);
    } catch {
      return res.status(500).json({ error: 'KI-Antwort nicht parsebar', raw });
    }

    // Kategorien anreichern
    const enriched = parsed.map(item => ({
      ...item,
      kategorie_info: CATEGORIES[item.kategorie] || CATEGORIES.sonstiges,
    }));

    return res.status(200).json({
      results: enriched,
      usage: data.usage,
      categories: CATEGORIES,
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

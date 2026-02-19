# VISO Media Tool – Deployment Anleitung
## Zeitaufwand: ca. 30–40 Minuten

---

## Schritt 1 – Supabase einrichten (10 Min.)

1. Gehe zu https://supabase.com → "Start your project" → kostenlos registrieren
2. "New Project" → Name: `viso-tool`, Passwort merken, Region: `EU West`
3. Warte ~2 Min. bis das Projekt läuft
4. Linkes Menü → **SQL Editor** → "New query"
5. Kopiere den gesamten Inhalt von `supabase-setup.sql` rein → "Run"
6. Linkes Menü → **Authentication** → **Users** → "Add user" → deine E-Mail + Passwort eingeben
7. Linkes Menü → **Settings** → **API** → kopiere:
   - `Project URL` (sieht aus wie `https://xyzabc.supabase.co`)
   - `anon public` Key (beginnt mit `eyJ...`)

---

## Schritt 2 – Keys eintragen (2 Min.)

Öffne `supabase.js` und trage deine Werte ein:

```js
const SUPABASE_URL  = 'https://DEIN-PROJEKT.supabase.co';
const SUPABASE_ANON = 'eyJ...DEIN-ANON-KEY...';
```

---

## Schritt 3 – GitHub Repository anlegen (5 Min.)

1. Gehe zu https://github.com → kostenlos registrieren (falls noch nicht)
2. "New repository" → Name: `viso-tool`, Private ✓ → "Create repository"
3. Öffne ein Terminal auf deinem Computer:

```bash
cd pfad/zu/viso-tool/     # Ordner mit den Dateien
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/DEIN-USERNAME/viso-tool.git
git push -u origin main
```

---

## Schritt 4 – Vercel deployen (5 Min.)

1. Gehe zu https://vercel.com → kostenlos registrieren (mit GitHub-Account)
2. "Add New Project" → dein GitHub-Repo `viso-tool` importieren
3. Alles lassen wie es ist → "Deploy"
4. Warte ~2 Min. → Vercel gibt dir eine URL wie `viso-tool-xxx.vercel.app`
5. Teste: öffne die URL → Login-Screen sollte erscheinen

---

## Schritt 5 – Eigene Domain einrichten (5 Min.)

1. In Vercel: dein Projekt → **Settings** → **Domains**
2. `tools.viso.media` eingeben → "Add"
3. Vercel zeigt dir einen CNAME-Record
4. In deinem Domain-Anbieter (wo viso.media verwaltet wird):
   - DNS-Eintrag hinzufügen: `CNAME tools → cname.vercel-dns.com`
5. Nach 5–15 Min. ist `https://tools.viso.media` live

---

## Bestehende Daten importieren

1. Öffne das alte Tool im Browser
2. Gehe zu **Daten** → "Alle Daten exportieren"
3. Speichere die `.json`-Datei
4. Öffne das neue Tool auf Vercel
5. Gehe zu **Daten** → "Import" → die `.json`-Datei hochladen
6. Alle Kunden, Leistungen und Dokumente werden in die Datenbank importiert ✓

---

## Dateistruktur

```
viso-tool/
├── index.html          ← Login-Screen
├── tool.html           ← Das Tool
├── supabase.js         ← Supabase-Verbindung (Keys hier eintragen!)
├── supabase-setup.sql  ← Datenbank-Setup (einmalig ausführen)
├── api/
│   └── pdf.js          ← Serverless PDF-Funktion (Puppeteer)
├── package.json        ← Node-Abhängigkeiten
├── vercel.json         ← Vercel-Konfiguration
└── ANLEITUNG.md        ← Diese Datei
```

---

## PDF-Funktion

Das PDF wird serverseitig mit Puppeteer (echtem Chrome) generiert.
- **Kein** Browser-Druck-Dialog
- Exaktes WYSIWYG – was du siehst, ist was im PDF landet
- Datei wird direkt heruntergeladen

Falls die API noch nicht eingerichtet ist, fällt das Tool automatisch auf Browser-Druck zurück.

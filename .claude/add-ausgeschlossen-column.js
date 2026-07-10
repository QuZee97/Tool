#!/usr/bin/env node
// Fügt die Spalte "ausgeschlossen" zur matches-Tabelle hinzu (für Buchungen-Ausschluss-Feature).
// Ausführen: node .claude/add-ausgeschlossen-column.js
const https = require('https');

const PROJECT_REF = 'yriexfiocbktdneranhm';

const SQL = `
ALTER TABLE matches ADD COLUMN IF NOT EXISTS ausgeschlossen boolean NOT NULL DEFAULT false;
`;

function req(method, hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const opts = { hostname, path, method, headers };
    const r = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

async function run() {
  console.log('Versuche Spalte via Supabase Management API hinzuzufügen …');

  // Supabase Management API: POST /v1/projects/{ref}/database/query
  // Benötigt einen Personal Access Token (PAT) – NICHT den Service Role Key.
  const PAT = process.env.SUPABASE_PAT || '';

  if (!PAT) {
    console.log('\n⚠  Kein SUPABASE_PAT gesetzt.\n');
    console.log('Option 1: Personal Access Token setzen und Skript erneut ausführen:');
    console.log('  export SUPABASE_PAT=sbp_xxxxxxxx');
    console.log('  node .claude/add-ausgeschlossen-column.js\n');
    console.log('Option 2: SQL manuell im Supabase Dashboard ausführen:');
    console.log('  https://supabase.com/dashboard/project/' + PROJECT_REF + '/sql/new\n');
    console.log('SQL:\n' + SQL);
    return;
  }

  const body = JSON.stringify({ query: SQL });
  const res = await req(
    'POST',
    'api.supabase.com',
    `/v1/projects/${PROJECT_REF}/database/query`,
    {
      Authorization: `Bearer ${PAT}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
    body
  );

  if (res.status === 200 || res.status === 201) {
    console.log('✓ Spalte "ausgeschlossen" erfolgreich hinzugefügt!');
  } else {
    console.error('Fehler:', res.status, JSON.stringify(res.body));
    console.log('\nSQL für manuelles Ausführen:\n' + SQL);
  }
}

run().catch(console.error);

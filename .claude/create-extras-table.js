#!/usr/bin/env node
// Erstellt die steuer_extras Tabelle in Supabase.
// Ausführen: node .claude/create-extras-table.js
const https = require('https');

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyaWV4ZmlvY2JrdGRuZXJhbmhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTUxNDI3MiwiZXhwIjoyMDg3MDkwMjcyfQ.2YyXWQvzhiOp3bt7XaBbhGXg9_dr595bZTVKwA_NGLk';
const PROJECT_REF = 'yriexfiocbktdneranhm';

const SQL = `
CREATE TABLE IF NOT EXISTS steuer_extras (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL,
  data       jsonb       NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE steuer_extras ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='steuer_extras' AND policyname='steuer_extras_owner'
  ) THEN
    EXECUTE 'CREATE POLICY steuer_extras_owner ON steuer_extras FOR ALL USING (auth.uid() = user_id)';
  END IF;
END $$;
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
  console.log('Versuche Tabelle via Supabase Management API zu erstellen …');

  // Supabase Management API: POST /v1/projects/{ref}/database/query
  // Benötigt einen Personal Access Token (PAT) – NICHT den Service Role Key.
  // Falls du einen PAT hast, trage ihn hier ein:
  const PAT = process.env.SUPABASE_PAT || '';

  if (!PAT) {
    console.log('\n⚠  Kein SUPABASE_PAT gesetzt.\n');
    console.log('Option 1: Personal Access Token setzen:');
    console.log('  export SUPABASE_PAT=sbp_xxxxxxxx');
    console.log('  node .claude/create-extras-table.js\n');
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
    console.log('✓ Tabelle steuer_extras erfolgreich erstellt!');
  } else {
    console.error('Fehler:', res.status, JSON.stringify(res.body));
    console.log('\nSQL für manuelles Ausführen:\n' + SQL);
  }
}

run().catch(console.error);

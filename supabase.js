const SUPABASE_URL  = 'https://yriexfiocbktdneranhm.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyaWV4ZmlvY2JrdGRuZXJhbmhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTQyNzIsImV4cCI6MjA4NzA5MDI3Mn0.Xnp_sunDFDWqKk_ES78hM7TXSHgqUXIse4iODZT43JI';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

async function signIn(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signOut() {
  await db.auth.signOut();
  window.location.href = '/';
}

async function getUser() {
  const { data: { user } } = await db.auth.getUser();
  return user;
}

const DB = {
  async getCustomers() {
    const { data, error } = await db.from('customers').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  async saveCustomer(customer) {
    const user = await getUser();
    const { data, error } = await db.from('customers').insert({ ...customer, user_id: user.id }).select().single();
    if (error) throw error;
    return data;
  },
  async deleteCustomer(id) {
    const { error } = await db.from('customers').delete().eq('id', id);
    if (error) throw error;
  },

  async getLibrary() {
    const { data, error } = await db.from('library').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    // Feldname zurück mappen: beschreibung → desc (für das Tool)
    return (data || []).map(l => ({ ...l, desc: l.beschreibung }));
  },
  async saveLibItem(item) {
    const user = await getUser();
    // desc → beschreibung für die DB
    const { desc, ...rest } = item;
    const { data, error } = await db.from('library').insert({ ...rest, beschreibung: desc, user_id: user.id }).select().single();
    if (error) throw error;
    return { ...data, desc: data.beschreibung };
  },
  async deleteLibItem(id) {
    const { error } = await db.from('library').delete().eq('id', id);
    if (error) throw error;
  },

  async getDocuments() {
    const { data, error } = await db.from('documents').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  async saveDocument(doc) {
    const user = await getUser();
    const { id, ...rest } = doc;
    const payload = { ...rest, user_id: user.id, updated_at: new Date().toISOString() };
    let query;
    if (id) {
      // Update existierendes Dokument via ID – id NICHT im payload (kann PK nicht updaten)
      query = db.from('documents').update(payload).eq('id', id).select().single();
    } else {
      // Neues Dokument einfügen
      query = db.from('documents')
        .insert(payload)
        .select().single();
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  async updateDocStatus(id, status) {
    const { error } = await db.from('documents').update({ status }).eq('id', id);
    if (error) throw error;
  },
  async deleteDocument(id) {
    const { error } = await db.from('documents').delete().eq('id', id);
    if (error) throw error;
  },

  async getEmailTemplates() {
    const { data, error } = await db.from('email_templates').select('*');
    if (error) throw error;
    const result = {};
    (data || []).forEach(t => { result[t.key] = { subject: t.subject, body: t.body }; });
    return result;
  },
  async saveEmailTemplate(key, subject, body) {
    const user = await getUser();
    const { error } = await db.from('email_templates')
      .upsert({ key, subject, body, user_id: user.id }, { onConflict: 'key,user_id' });
    if (error) throw error;
  },

  // ── TRANSAKTIONEN (CSV-Import) ─────────────────────────────
  // Tabelle: transactions (id, user_id, datum, empfaenger, verwendungszweck,
  //          beschreibung, betrag, is_einnahme, quelle_datei, created_at)
  async saveTransactions(rows) {
    const user = await getUser();
    if (!rows.length) return [];
    // Erst alle Transaktionen derselben Quelldatei löschen (verhindert Duplikate beim erneuten Hochladen)
    const quellDatei = rows[0]?.quellDatei;
    if (quellDatei) {
      await db.from('transactions')
        .delete()
        .eq('user_id', user.id)
        .eq('quelle_datei', quellDatei);
    }
    const payload = rows.map(r => ({
      user_id:          user.id,
      datum:            r.datum || null,
      empfaenger:       r.empfaenger || null,
      verwendungszweck: r.verwendungszweck || null,
      beschreibung:     r.beschreibung || null,
      betrag:           r.betrag || 0,
      is_einnahme:      r.isEinnahme || false,
      quelle_datei:     r.quellDatei || null,
    }));
    const { data, error } = await db.from('transactions').insert(payload).select();
    if (error) throw error;
    return data || [];
  },
  async getTransactions(year, quartal) {
    let q = db.from('transactions').select('*').order('datum', { ascending: false });
    if (year) {
      q = q.gte('datum', `${year}-01-01`).lte('datum', `${year}-12-31`);
    }
    if (quartal && quartal > 0) {
      const qMap = { 1: ['01','03'], 2: ['04','06'], 3: ['07','09'], 4: ['10','12'] };
      const [mFrom, mTo] = qMap[quartal] || ['01','12'];
      q = q.gte('datum', `${year}-${mFrom}-01`).lte('datum', `${year}-${mTo}-31`);
    }
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },
  async deleteAllTransactions(year) {
    const user = await getUser();
    let q = db.from('transactions').delete().eq('user_id', user.id);
    if (year) q = q.gte('datum', `${year}-01-01`).lte('datum', `${year}-12-31`);
    const { error } = await q;
    if (error) throw error;
  },
  async deleteTransaction(id) {
    const { error } = await db.from('transactions').delete().eq('id', id);
    if (error) throw error;
  },

  // ── BELEGE / RECEIPTS (Supabase Storage) ──────────────────
  // Bucket: "receipts" – muss einmalig in Supabase Dashboard → Storage → New Bucket
  // erstellt werden (Name: "receipts", Private bucket aktivieren).
  async uploadReceipt(file, meta = {}) {
    const user = await getUser();
    const ts  = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    // Pfad: user_id als Präfix mit Doppelstrich-Trenner (kein Unterordner-Problem)
    const path = `${user.id}__${ts}_${safeName}`;
    // 1) Datei in Storage hochladen
    const { error: upErr } = await db.storage.from('receipts').upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || 'application/octet-stream',
    });
    if (upErr) throw new Error(`Storage-Upload fehlgeschlagen: ${upErr.message}`);
    // 2) Signed URL für späteren Zugriff (1 Jahr gültig)
    const { data: urlData, error: urlErr } = await db.storage
      .from('receipts').createSignedUrl(path, 60 * 60 * 24 * 365);
    if (urlErr) throw urlErr;
    // 3) Metadaten in DB-Tabelle "receipts" speichern
    const { data, error } = await db.from('receipts').insert({
      user_id: user.id,
      filename: file.name,
      storage_path: path,
      signed_url: urlData.signedUrl,
      size_bytes: file.size,
      mime_type: file.type || 'application/octet-stream',
      datum: meta.datum || null,
      beschreibung: meta.beschreibung || file.name,
      kategorie: meta.kategorie || null,
      betrag: meta.betrag || null,
    }).select().single();
    if (error) throw error;
    return data;
  },
  async getReceipts() {
    const { data, error } = await db.from('receipts')
      .select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  async saveReceiptMeta(meta) {
    const user = await getUser();
    const { data, error } = await db.from('receipts').insert({
      user_id:      user.id,
      filename:     meta.filename || null,
      storage_path: null,
      signed_url:   null,
      size_bytes:   meta.size_bytes || 0,
      mime_type:    meta.mime_type || 'application/octet-stream',
      datum:        meta.datum || null,
      beschreibung: meta.beschreibung || meta.filename || null,
      kategorie:    meta.kategorie || null,
      betrag:       meta.betrag || null,
    }).select().single();
    if (error) throw error;
    return data;
  },
  async updateReceipt(id, changes) {
    const { error } = await db.from('receipts').update(changes).eq('id', id);
    if (error) throw error;
  },
  async deleteReceipt(id, storagePath) {
    if (storagePath) await db.storage.from('receipts').remove([storagePath]);
    const { error } = await db.from('receipts').delete().eq('id', id);
    if (error) throw error;
  },
  async refreshReceiptUrl(storagePath) {
    const { data, error } = await db.storage
      .from('receipts').createSignedUrl(storagePath, 60 * 60 * 24 * 365);
    if (error) throw error;
    return data.signedUrl;
  },

  // ── MATCHES (KI-Zuordnungen, persistent) ──────────────────
  // Tabelle: matches (id, user_id, transaction_id, receipt_id,
  //   kategorie, betrag_brutto, betrag_netto, mwst_satz, mwst_betrag,
  //   beschreibung, datum, begruendung, konfidenz, unklar, bestaetigt,
  //   quelle, is_einnahme, year, created_at, updated_at)
  async saveMatches(rows) {
    const user = await getUser();
    if (!rows.length) return [];
    // Upsert: per transaction_id – ein Match pro Transaktion
    const payload = rows.map(r => ({
      user_id:       user.id,
      transaction_id: r.transaction_id || r.id || null,
      receipt_id:    r.receipt_id || null,
      kategorie:     r.kategorie || 'sonstiges',
      betrag_brutto: r.betrag_brutto || 0,
      betrag_netto:  r.betrag_netto  || 0,
      mwst_satz:     r.mwst_satz    || 0,
      mwst_betrag:   r.mwst_betrag  || 0,
      beschreibung:  r.beschreibung || null,
      datum:         r.datum || null,
      begruendung:   r.begruendung  || null,
      konfidenz:     r.konfidenz    ?? null,   // null = noch nicht KI-analysiert
      unklar:        r.unklar       || false,
      bestaetigt:    r.bestaetigt   || false,
      quelle:        r.quelle       || 'csv',
      is_einnahme:   r.is_einnahme  ?? (r._isEinnahme || false),
      year:          r.datum ? parseInt(r.datum.slice(0,4)) : null,
      updated_at:    new Date().toISOString(),
    }));
    const { data, error } = await db.from('matches')
      .upsert(payload, { onConflict: 'user_id,transaction_id' })
      .select();
    if (error) throw error;
    return data || [];
  },
  async getMatches(year, quartal) {
    // Kein FK-JOIN (FK fehlt in Schema) → zwei separate Queries + client-seitiges Mergen
    let q = db.from('matches').select('*').order('datum', { ascending: false });
    if (year) {
      q = q.eq('year', year);
    }
    if (quartal && quartal > 0) {
      const qMap = { 1:['01','03'], 2:['04','06'], 3:['07','09'], 4:['10','12'] };
      const [mFrom, mTo] = qMap[quartal] || ['01','12'];
      q = q.gte('datum', `${year}-${mFrom}-01`).lte('datum', `${year}-${mTo}-31`);
    }
    const { data: matchData, error } = await q;
    if (error) throw error;
    if (!matchData || !matchData.length) return [];

    // Hole alle referenzierten Belege in einem Query
    const receiptIds = [...new Set(matchData.filter(m => m.receipt_id).map(m => m.receipt_id))];
    let receiptMap = {};
    if (receiptIds.length) {
      const { data: recs } = await db.from('receipts')
        .select('id,filename,thumbnail_data,signed_url,storage_path,datum,betrag,beschreibung')
        .in('id', receiptIds);
      (recs || []).forEach(r => { receiptMap[r.id] = r; });
    }

    return matchData.map(m => ({
      ...m,
      receipts: m.receipt_id ? (receiptMap[m.receipt_id] || null) : null,
    }));
  },
  async updateMatch(id, changes) {
    const payload = { ...changes, updated_at: new Date().toISOString() };
    const { error } = await db.from('matches').update(payload).eq('id', id);
    if (error) throw error;
  },
  async deleteMatch(id) {
    const { error } = await db.from('matches').delete().eq('id', id);
    if (error) throw error;
  },
  async deleteMatchesByYear(year) {
    const user = await getUser();
    const { error } = await db.from('matches')
      .delete().eq('user_id', user.id).eq('year', year);
    if (error) throw error;
  },
};

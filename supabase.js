// ── SUPABASE CONFIG ───────────────────────────────────────
// Diese zwei Werte aus deinem Supabase-Projekt eintragen:
// Supabase Dashboard → Settings → API
const SUPABASE_URL  = 'DEINE_SUPABASE_URL';   // z.B. https://xyzabc.supabase.co
const SUPABASE_ANON = 'DEIN_ANON_KEY';        // beginnt mit eyJ...

// Supabase Client initialisieren (via CDN, kein Build-Tool nötig)
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── AUTH ──────────────────────────────────────────────────
async function signIn(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signOut() {
  await db.auth.signOut();
  window.location.href = 'index.html';
}

async function getUser() {
  const { data: { user } } = await db.auth.getUser();
  return user;
}

// ── DATENBANK-OPERATIONEN ─────────────────────────────────
// Alle CRUD-Operationen für das Tool

const DB = {
  // Kunden
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

  // Leistungsbibliothek
  async getLibrary() {
    const { data, error } = await db.from('library').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  async saveLibItem(item) {
    const user = await getUser();
    const { data, error } = await db.from('library').insert({ ...item, user_id: user.id }).select().single();
    if (error) throw error;
    return data;
  },
  async deleteLibItem(id) {
    const { error } = await db.from('library').delete().eq('id', id);
    if (error) throw error;
  },

  // Dokumente (Angebote & Rechnungen)
  async getDocuments() {
    const { data, error } = await db.from('documents').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  async saveDocument(doc) {
    const user = await getUser();
    // Upsert: update wenn nr schon existiert, sonst insert
    const { data, error } = await db.from('documents')
      .upsert({ ...doc, user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: 'nr,user_id' })
      .select().single();
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

  // E-Mail-Vorlagen
  async getEmailTemplates() {
    const { data, error } = await db.from('email_templates').select('*');
    if (error) throw error;
    // In Objekt umwandeln: { key: { subject, body } }
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
};

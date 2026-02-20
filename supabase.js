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
};

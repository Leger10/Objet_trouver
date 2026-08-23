import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Variables Supabase manquantes dans .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'objetrouve-auth'
  }
});

// ============================================================
// ADAPTATEUR POCKETBASE → SUPABASE
// ============================================================

const EXPAND_MAP = {
  claims: {
    declaration: { column: 'declaration', table: 'declarations' },
    claimant: { column: 'claimant', table: 'users' },
  },
  matches: {
    lost: { column: 'lost', table: 'declarations' },
    found: { column: 'found', table: 'declarations' },
  },
  reports: {
    declaration: { column: 'declaration', table: 'declarations' },
    reporter: { column: 'reporter', table: 'users' },
  },
  declarations: {
    owner: { column: 'owner', table: 'users' },
    category: { column: 'category', table: 'categories', keyColumn: 'slug' },
  },
  withdrawals: {
    user: { column: 'user', table: 'users' },
  },
  payments: {
    user: { column: 'user', table: 'users' },
  },
  subscriptions: {
    user: { column: 'user', table: 'users' },
  },
  pro_accounts: {
    user: { column: 'user', table: 'users' },
    owner: { column: 'user', table: 'users' },
  },
  pvs: {
    user: { column: 'user', table: 'users' },
    generated_by: { column: 'user', table: 'users' },
    related_declaration: { column: 'declaration_id', table: 'declarations' },
    declaration_id: { column: 'declaration_id', table: 'declarations' },
  },
  notifications: {
    user: { column: 'user', table: 'users' },
  },
  point_purchases: {
    user: { column: 'user', table: 'users' },
  },
  gift_orders: {
    user: { column: 'user', table: 'users' },
  },
};

class SupabaseCollection {
  constructor(collectionName, supabaseClient) {
    this.collectionName = collectionName;
    this.supabase = supabaseClient;
  }

  async _expandData(items, expandStr) {
    if (!items?.length || !expandStr) return items;
    const names = expandStr.split(',').map(s => s.trim()).filter(Boolean);
    const config = EXPAND_MAP[this.collectionName];
    if (!config) return items;

    const fetches = [];
    for (const name of names) {
      const cfg = config[name];
      if (!cfg) continue;
      const keyCol = cfg.keyColumn || 'id';
      const values = [...new Set(items.map(i => i[cfg.column]).filter(Boolean))];
      if (values.length === 0) {
        items.forEach(i => { i.expand = i.expand || {}; i.expand[name] = null; });
        continue;
      }
      fetches.push(
        this.supabase
          .from(cfg.table)
          .select('*')
          .in(keyCol, values)
          .then(({ data }) => {
            const map = new Map((data || []).map(r => [r[keyCol], r]));
            items.forEach(i => {
              i.expand = i.expand || {};
              i.expand[name] = map.get(i[cfg.column]) || null;
            });
          })
      );
    }
    await Promise.all(fetches);
    return items;
  }

  _applySort(query, sort) {
    if (!sort) return query;
    const fields = sort.split(',').map(s => s.trim()).filter(Boolean);
    for (const field of fields) {
      const isDesc = field.startsWith('-');
      let cleanField = isDesc ? field.slice(1) : field;
      if (cleanField === 'created') cleanField = 'created_at';
      if (cleanField === 'updated') cleanField = 'updated_at';
      query = query.order(cleanField, { ascending: !isDesc });
    }
    return query;
  }

  async getList(page = 1, perPage = 50, options = {}) {
    const { filter, sort, expand, ...rest } = options;
    
    let query = this.supabase
      .from(this.collectionName)
      .select('*', { count: 'exact' });

    const start = (page - 1) * perPage;
    const end = start + perPage - 1;
    query = query.range(start, end);

    // Filtres PocketBase → Supabase
    if (filter) {
      const conditions = this.parsePocketBaseFilter(filter);
      for (const cond of conditions) {
        if (cond.field && cond.operator && cond.value) {
          const field = cond.quoted ? `"${cond.field}"` : cond.field;
          switch (cond.operator) {
            case '=':
              query = query.eq(field, cond.value);
              break;
            case '~':
              query = query.ilike(field, `%${cond.value}%`);
              break;
            case '>=':
              query = query.gte(field, cond.value);
              break;
            case '<=':
              query = query.lte(field, cond.value);
              break;
            case '!=':
              query = query.neq(field, cond.value);
              break;
            default:
              break;
          }
        }
      }
    }

    // Tri
    query = this._applySort(query, sort);

    const { data, count, error } = await query;

    if (error) {
      console.error(`❌ Erreur getList ${this.collectionName}:`, error);
      throw error;
    }

    const items = data || [];
    if (expand) await this._expandData(items, expand);

    return {
      items,
      totalItems: count || 0,
      page,
      perPage
    };
  }

  async getOne(id, options = {}) {
    const { expand } = options;
    const query = this.supabase
      .from(this.collectionName)
      .select('*')
      .eq('id', id)
      .single();

    const { data, error } = await query;

    if (error) {
      console.error(`❌ Erreur getOne ${this.collectionName}:`, error);
      throw error;
    }

    if (data && expand) await this._expandData([data], expand);

    return data;
  }

  async getFirstListItem(filter, options = {}) {
    const { sort, expand, ...rest } = options;
    
    let query = this.supabase
      .from(this.collectionName)
      .select('*')
      .limit(1);

    // Parser le filtre PocketBase
    if (filter) {
      const conditions = this.parsePocketBaseFilter(filter);
      for (const cond of conditions) {
        if (cond.field && cond.operator && cond.value) {
          const field = cond.quoted ? `"${cond.field}"` : cond.field;
          switch (cond.operator) {
            case '=':
              query = query.eq(field, cond.value);
              break;
            case '~':
              query = query.ilike(field, `%${cond.value}%`);
              break;
            case '>=':
              query = query.gte(field, cond.value);
              break;
            case '<=':
              query = query.lte(field, cond.value);
              break;
            case '!=':
              query = query.neq(field, cond.value);
              break;
            default:
              break;
          }
        }
      }
    }

    query = this._applySort(query, sort);

    const { data, error } = await query;

    if (error) {
      console.error(`❌ Erreur getFirstListItem ${this.collectionName}:`, error);
      throw error;
    }

    if (!data || data.length === 0) {
      throw new Error('Aucun enregistrement trouvé');
    }

    const item = data[0];
    if (expand) await this._expandData([item], expand);

    return item;
  }

  async create(data) {
    let payload = data;
    let fileField = null;
    let fileObj = null;

    if (data instanceof FormData) {
      payload = {};
      for (const [key, value] of data.entries()) {
        if (value instanceof File && value.size > 0) {
          fileField = key;
          fileObj = value;
        } else if (!(value instanceof File)) {
          payload[key] = value;
        }
      }
    }

    // Correction des booléens
    for (const key of ['priority', 'auto_renew']) {
      if (payload[key] === 'true') payload[key] = true;
      if (payload[key] === 'false') payload[key] = false;
    }

    // Upload du fichier s'il y en a un
    if (fileObj && fileField) {
      try {
        const ext = fileObj.name?.split('.').pop() || 'jpg';
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: uploadErr } = await this.supabase.storage
          .from('uploads')
          .upload(path, fileObj, { cacheControl: '3600', upsert: false });
        if (!uploadErr) {
          const { data: urlData } = this.supabase.storage.from('uploads').getPublicUrl(path);
          payload[fileField] = urlData?.publicUrl || '';
          if (fileField === 'photo') payload.photo_url = urlData?.publicUrl || '';
        } else {
          console.warn('⚠️ Upload fichier échoué:', uploadErr.message);
        }
      } catch (uploadErr) {
        console.warn('⚠️ Upload fichier erreur:', uploadErr);
      }
    }

    const { data: result, error } = await this.supabase
      .from(this.collectionName)
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error(`❌ Erreur create ${this.collectionName}:`, error);
      throw error;
    }

    return result;
  }

  async update(id, data) {
    let payload = data;
    const fileUploads = [];

    if (data instanceof FormData) {
      payload = {};
      for (const [key, value] of data.entries()) {
        if (value instanceof File && value.size > 0) {
          fileUploads.push({ field: key, file: value });
        } else if (!(value instanceof File)) {
          payload[key] = value;
        }
      }
    }

    for (const key of ['priority', 'auto_renew']) {
      if (payload[key] === 'true') payload[key] = true;
      if (payload[key] === 'false') payload[key] = false;
    }

    // Upload files to storage
    for (const { field, file } of fileUploads) {
      try {
        const ext = file.name?.split('.').pop() || 'jpg';
        const path = `${id}/${field}-${Date.now()}.${ext}`;
        const bucket = this.collectionName === 'branding_settings' ? 'branding' : 'uploads';
        const { error: uploadErr } = await this.supabase.storage
          .from(bucket)
          .upload(path, file, { cacheControl: '3600', upsert: true });
        if (!uploadErr) {
          const { data: urlData } = this.supabase.storage.from(bucket).getPublicUrl(path);
          payload[field] = urlData?.publicUrl || path;
        } else {
          console.warn(`⚠️ Upload ${field} échoué:`, uploadErr.message);
        }
      } catch (err) {
        console.warn(`⚠️ Upload ${field} erreur:`, err);
      }
    }

    const { data: result, error } = await this.supabase
      .from(this.collectionName)
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`❌ Erreur update ${this.collectionName}:`, error);
      throw error;
    }

    return result;
  }

  async delete(id) {
    const { error } = await this.supabase
      .from(this.collectionName)
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`❌ Erreur delete ${this.collectionName}:`, error);
      throw error;
    }

    return true;
  }

  async getFullList(options = {}) {
    const { filter, sort, expand, ...rest } = options;
    
    let query = this.supabase
      .from(this.collectionName)
      .select('*');

    if (filter) {
      const conditions = this.parsePocketBaseFilter(filter);
      for (const cond of conditions) {
        if (cond.field && cond.operator && cond.value) {
          const field = cond.quoted ? `"${cond.field}"` : cond.field;
          switch (cond.operator) {
            case '=':
              query = query.eq(field, cond.value);
              break;
            case '~':
              query = query.ilike(field, `%${cond.value}%`);
              break;
            case '>=':
              query = query.gte(field, cond.value);
              break;
            case '<=':
              query = query.lte(field, cond.value);
              break;
            case '!=':
              query = query.neq(field, cond.value);
              break;
            default:
              break;
          }
        }
      }
    }

    query = this._applySort(query, sort);

    const { data, error } = await query;

    if (error) {
      console.error(`❌ Erreur getFullList ${this.collectionName}:`, error);
      throw error;
    }

    const items = data || [];
    if (expand) await this._expandData(items, expand);

    return items;
  }

  parsePocketBaseFilter(filter) {
    const conditions = [];
    const parts = filter.split(/\s*&&\s*/);
    
    for (const part of parts) {
      const trimmed = part.trim();
      // Support quoted column names like "user" = :val
      const matchQuoted = trimmed.match(/^"([^"]+)"\s*(=|!=|~|>=|<=)\s*['"]?(.+?)['"]?$/);
      if (matchQuoted) {
        conditions.push({
          field: matchQuoted[1],
          operator: matchQuoted[2],
          value: matchQuoted[3],
          quoted: true,
        });
        continue;
      }
      const match = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_.]*)\s*(=|!=|~|>=|<=)\s*['"]?(.+?)['"]?$/);
      if (match) {
        conditions.push({
          field: match[1],
          operator: match[2],
          value: match[3]
        });
      }
    }
    
    return conditions;
  }
}

// ============================================================
// CLASSE POCKETBASE COMPATIBLE AVEC BRANDING
// ============================================================

class PocketBaseCompatible {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
    this.authStore = {
      record: null,
      token: null,
      isAuth: false
    };
    this.collections = {};
  }

  // PocketBase-style filter template: pb.filter('kind = {:k}', { k: 'lost' })
  filter(template, params = {}) {
    let result = template;
    for (const [key, val] of Object.entries(params)) {
      result = result.replace(new RegExp(`\\{:${key}\\}`, 'g'), String(val));
    }
    return result;
  }

  collection(name) {
    if (!this.collections[name]) {
      this.collections[name] = new SupabaseCollection(name, this.supabase);
    }
    return this.collections[name];
  }

  async authWithPassword(email, password) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    this.authStore.record = data.user;
    this.authStore.token = data.session?.access_token || null;
    this.authStore.isAuth = true;

    return data;
  }

  async authWithSignUp(email, password, userData = {}) {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: userData.name || '',
          phone: userData.phone || '',
          city: userData.city || '',
          referred_by: userData.referred_by || '',
        }
      }
    });

    if (error) throw error;

    this.authStore.record = data.user;
    this.authStore.token = data.session?.access_token || null;
    this.authStore.isAuth = !!data.session;

    return data;
  }

  async authLogout() {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
    
    this.authStore.record = null;
    this.authStore.token = null;
    this.authStore.isAuth = false;
  }

  getCurrentUser() {
    return this.supabase.auth.getUser();
  }

  // ============================================================
  // GESTION DES FICHIERS (BRANDING)
  // ============================================================
  
  files = {
    /**
     * Récupère l'URL d'un fichier stocké dans Supabase Storage
     * @param {Object} item - L'objet contenant la référence du fichier
     * @param {string} field - Le nom du champ contenant le nom du fichier
     * @param {Object} options - Options (thumb, etc.)
     * @returns {string} L'URL publique du fichier
     */
    getURL: (item, field, options = {}) => {
      if (!item || !field) return '';
      
      const val = item[field];
      if (!val) return '';
      
      // If the value is already a full URL, return it directly
      if (typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://'))) {
        return options.thumb ? `${val}?width=${options.thumb.split('x')[0]}&height=${options.thumb.split('x')[1]}&resize=cover` : val;
      }
      
      let bucket = 'uploads';
      if (item.collectionName === 'branding_settings' || field === 'logo_file' || field === 'hero_file') {
        bucket = 'branding';
      }
      
      const path = `${item.id}/${val}`;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
      
      if (options.thumb) {
        const [width, height] = options.thumb.split('x');
        return `${url}?width=${width}&height=${height}&resize=cover`;
      }
      
      return url;
    },
    
    /**
     * Upload d'un fichier vers Supabase Storage
     * @param {string} bucket - Nom du bucket
     * @param {string} path - Chemin du fichier
     * @param {File} file - Le fichier à uploader
     * @returns {Promise<Object>} Les données de l'upload
     */
    upload: async (bucket, path, file) => {
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true
        });
      
      if (error) throw error;
      return data;
    },
    
    /**
     * Supprime un fichier du storage
     * @param {string} bucket - Nom du bucket
     * @param {string} path - Chemin du fichier
     * @returns {Promise<void>}
     */
    delete: async (bucket, path) => {
      const { error } = await this.supabase.storage
        .from(bucket)
        .remove([path]);
      
      if (error) throw error;
    },
    
    /**
     * Récupère l'URL d'un fichier de branding
     * @param {Object} item - L'objet branding
     * @param {string} field - Le champ du fichier
     * @param {Object} options - Options
     * @returns {string} L'URL du fichier
     */
    getBrandingUrl: (item, field = 'logo_file', options = {}) => {
      if (!item) return '';
      
      const val = item[field];
      if (!val) return item.logo_url || '';
      
      // If the value is already a full URL, return it directly
      if (typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://'))) {
        return options.thumb ? `${val}?width=${options.thumb.split('x')[0]}&height=${options.thumb.split('x')[1]}&resize=cover` : val;
      }
      
      const path = `${item.id}/${val}`;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/branding/${path}`;
      
      if (options.thumb) {
        const [width, height] = options.thumb.split('x');
        return `${url}?width=${width}&height=${height}&resize=cover`;
      }
      
      return url;
    }
  };
}

// ============================================================
// EXPORT
// ============================================================

export const pb = new PocketBaseCompatible(supabase);

export const supabaseAuth = supabase.auth;
export const supabaseStorage = supabase.storage;

export default supabase;
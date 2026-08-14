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

class SupabaseCollection {
  constructor(collectionName, supabaseClient) {
    this.collectionName = collectionName;
    this.supabase = supabaseClient;
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
          switch (cond.operator) {
            case '=':
              query = query.eq(cond.field, cond.value);
              break;
            case '~':
              query = query.ilike(cond.field, `%${cond.value}%`);
              break;
            case '>=':
              query = query.gte(cond.field, cond.value);
              break;
            case '<=':
              query = query.lte(cond.field, cond.value);
              break;
            case '!=':
              query = query.neq(cond.field, cond.value);
              break;
            default:
              break;
          }
        }
      }
    }

    // Tri
    if (sort) {
      const isDesc = sort.startsWith('-');
      const cleanField = isDesc ? sort.slice(1) : sort;
      query = query.order(cleanField, { ascending: !isDesc });
    }

    const { data, count, error } = await query;

    if (error) {
      console.error(`❌ Erreur getList ${this.collectionName}:`, error);
      throw error;
    }

    return {
      items: data || [],
      totalItems: count || 0,
      page,
      perPage
    };
  }

  async getOne(id, options = {}) {
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

    return data;
  }

  async getFirstListItem(filter, options = {}) {
    const { sort, ...rest } = options;
    
    let query = this.supabase
      .from(this.collectionName)
      .select('*')
      .limit(1);

    // Parser le filtre PocketBase
    if (filter) {
      const conditions = this.parsePocketBaseFilter(filter);
      for (const cond of conditions) {
        if (cond.field && cond.operator && cond.value) {
          switch (cond.operator) {
            case '=':
              query = query.eq(cond.field, cond.value);
              break;
            case '~':
              query = query.ilike(cond.field, `%${cond.value}%`);
              break;
            case '>=':
              query = query.gte(cond.field, cond.value);
              break;
            case '<=':
              query = query.lte(cond.field, cond.value);
              break;
            case '!=':
              query = query.neq(cond.field, cond.value);
              break;
            default:
              break;
          }
        }
      }
    }

    if (sort) {
      const isDesc = sort.startsWith('-');
      const cleanField = isDesc ? sort.slice(1) : sort;
      query = query.order(cleanField, { ascending: !isDesc });
    }

    const { data, error } = await query;

    if (error) {
      console.error(`❌ Erreur getFirstListItem ${this.collectionName}:`, error);
      throw error;
    }

    if (!data || data.length === 0) {
      throw new Error('Aucun enregistrement trouvé');
    }

    return data[0];
  }

  async create(data) {
    let payload = data;
    if (data instanceof FormData) {
      payload = {};
      for (const [key, value] of data.entries()) {
        if (!(value instanceof File)) {
          payload[key] = value;
        }
      }
    }

    // Correction des booléens
    for (const key of ['priority', 'auto_renew']) {
      if (payload[key] === 'true') payload[key] = true;
      if (payload[key] === 'false') payload[key] = false;
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
    if (data instanceof FormData) {
      payload = {};
      for (const [key, value] of data.entries()) {
        if (!(value instanceof File)) {
          payload[key] = value;
        }
      }
    }

    for (const key of ['priority', 'auto_renew']) {
      if (payload[key] === 'true') payload[key] = true;
      if (payload[key] === 'false') payload[key] = false;
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
    const { filter, sort, ...rest } = options;
    
    let query = this.supabase
      .from(this.collectionName)
      .select('*');

    if (filter) {
      const conditions = this.parsePocketBaseFilter(filter);
      for (const cond of conditions) {
        if (cond.field && cond.operator && cond.value) {
          switch (cond.operator) {
            case '=':
              query = query.eq(cond.field, cond.value);
              break;
            case '~':
              query = query.ilike(cond.field, `%${cond.value}%`);
              break;
            default:
              break;
          }
        }
      }
    }

    if (sort) {
      const isDesc = sort.startsWith('-');
      const cleanField = isDesc ? sort.slice(1) : sort;
      query = query.order(cleanField, { ascending: !isDesc });
    }

    const { data, error } = await query;

    if (error) {
      console.error(`❌ Erreur getFullList ${this.collectionName}:`, error);
      throw error;
    }

    return data || [];
  }

  parsePocketBaseFilter(filter) {
    const conditions = [];
    const parts = filter.split(/\s*&&\s*/);
    
    for (const part of parts) {
      const trimmed = part.trim();
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
        data: userData
      }
    });

    if (error) throw error;

    if (data.user) {
      const { error: insertError } = await this.supabase
        .from('users')
        .insert({
          id: data.user.id,
          email: email,
          name: userData.name || '',
          phone: userData.phone || '',
          city: userData.city || '',
          referred_by: userData.referred_by || '',
          points: 0,
          points_earned: 0,
          plan: 'free',
          role: 'user'
        });

      if (insertError) {
        console.error('❌ Erreur création utilisateur:', insertError);
      }
    }

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
      
      const fileName = item[field];
      if (!fileName) return '';
      
      // Déterminer le bucket en fonction de la collection
      let bucket = 'uploads';
      if (item.collectionName === 'branding_settings' || field === 'logo_file') {
        bucket = 'branding';
      }
      
      // Chemin du fichier
      const path = `${item.id}/${fileName}`;
      
      // Construction de l'URL publique
      const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
      
      // Si des options de transformation sont demandées (thumb)
      if (options.thumb) {
        // Supabase supporte les transformations d'images via l'API
        // Exemple: /image/resize?width=400&height=300
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
      
      const fileName = item[field];
      if (!fileName) return item.logo_url || '';
      
      const path = `branding/${item.id}/${fileName}`;
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
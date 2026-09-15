'use client';

import { createAuthClient } from 'better-auth/react';
import env from './env';

// ════════════════════════════════════════════════════════════
// CLIENT PRINCIPAL — pont vers les API Routes Next.js
// (Prisma + Better Auth + Cloudinary)
// ════════════════════════════════════════════════════════════

export const authClient = createAuthClient();

// ── Helpers API ──

async function apiJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) {
    const err = new Error(data.error || `Erreur API (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function pbApi(collection, action, extra = {}, data = null) {
  if (data instanceof FormData) {
    const form = new FormData();
    if (data) {
      for (const [k, v] of data.entries()) form.append(k, v);
    }
    form.append('action', action);
    form.append('collection', collection);
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined && v !== null) form.append(k, String(v));
    }
    const res = await fetch('/api/pb', { method: 'POST', body: form, credentials: 'include' });
    const result = await res.json().catch(() => ({}));
    if (!result.ok) throw new Error(result.error || 'Erreur API');
    return result;
  }
  return apiJson('/api/pb', { action, collection, ...extra, data });
}

// ── Événements d'auth (compat onAuthStateChange) ──

const authListeners = new Set();
function emitAuth(event, session) {
  authListeners.forEach((cb) => {
    try { cb(event, session); } catch { /* noop */ }
  });
}

// ════════════════════════════════════════════════════════════
// SHIM SUPABASE (auth + from() + storage + rpc)
// ════════════════════════════════════════════════════════════

class QueryBuilder {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.sorts = [];
    this.limitNum = undefined;
    this.singleFlag = false;
    this.countExact = false;
    this.insertData = undefined;
    this.updateData = undefined;
    this.deleteMode = false;
    this.executed = false;
  }

  select(_cols = '*', opts = {}) {
    this.countExact = !!opts.count;
    return this;
  }

  _cond(col, op, val) {
    const v = typeof val === 'string' ? `'${val.replace(/'/g, "\\'")}'` : val;
    const colName = /^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(col) ? col : `"${col}"`;
    this.filters.push(`${colName} ${op} ${v}`);
    return this;
  }

  eq(col, val) { return this._cond(col, '=', val); }
  neq(col, val) { return this._cond(col, '!=', val); }
  gt(col, val) { return this._cond(col, '>', val); }
  gte(col, val) { return this._cond(col, '>=', val); }
  lt(col, val) { return this._cond(col, '<', val); }
  lte(col, val) { return this._cond(col, '<=', val); }
  ilike(col, val) { return this._cond(col, '~', String(val).replace(/%/g, '')); }

  in(col, vals) {
    const arr = Array.isArray(vals) ? vals : [];
    const ors = arr.map((v) => {
      const sv = typeof v === 'string' ? `'${v.replace(/'/g, "\\'")}'` : v;
      return `${col} = ${sv}`;
    });
    this.filters.push(`(${ors.join(' || ')})`);
    return this;
  }

  or(str) {
    this.filters.push(`(${str.replace(/,/g, ' || ')})`);
    return this;
  }

  order(col, opts = {}) {
    this.sorts.push(`${opts.ascending === false ? '-' : ''}${col}`);
    return this;
  }

  limit(n) { this.limitNum = n; return this; }
  range(s, e) { this.range = [s, e]; return this; }
  single() { this.singleFlag = true; return this; }
  maybeSingle() { this.singleFlag = true; this.maybe = true; return this; }

  insert(data) { this.insertData = data; return this; }
  update(data) { this.updateData = data; return this; }
  delete() { this.deleteMode = true; return this; }

  _extractId() {
    for (const f of this.filters) {
      const m = f.match(/^"?([A-Za-z0-9_]+)"?\s*=\s*'([^']+)'$/);
      if (m && m[1] === 'id') return m[2];
    }
    return null;
  }

  async exec() {
    this.executed = true;
    const filter = this.filters.join(' && ');
    const sort = this.sorts.join(',');

    if (this.insertData !== undefined) {
      const { item } = await pbApi(this.table, 'create', {}, this.insertData);
      return { data: item, count: null, error: null };
    }

    if (this.updateData !== undefined) {
      const id = this._extractId();
      if (!id) return { data: null, count: null, error: new Error('id requis pour update') };
      const { item } = await pbApi(this.table, 'update', { id }, this.updateData);
      return { data: item, count: null, error: null };
    }

    if (this.deleteMode) {
      const id = this._extractId();
      if (id) await pbApi(this.table, 'delete', { id });
      return { data: null, count: null, error: null };
    }

    const { items, totalItems } = await pbApi(this.table, 'getList', {
      filter,
      sort,
      page: 1,
      perPage: this.limitNum || 500,
    });
    let rows = items;
    if (this.limitNum && rows?.length > this.limitNum) rows = rows.slice(0, this.limitNum);
    if (this.range) rows = (rows || []).slice(this.range[0], this.range[1] + 1);

    if (this.singleFlag) {
      const row = rows?.[0] || null;
      return { data: row, count: row ? 1 : this.countExact ? 0 : null, error: null };
    }
    return { data: rows, count: this.countExact ? totalItems : null, error: null };
  }

  then(resolve, reject) {
    return Promise.resolve(this.exec()).then(resolve, reject);
  }
}

export const supabase = {
  auth: {
    async getSession() {
      const { data, error } = await authClient.getSession();
      return { data: { session: data }, error };
    },
    async getUser() {
      const { data, error } = await authClient.getUser();
      return { data: { user: data?.user || null }, error };
    },
    async signInWithPassword({ email, password }) {
      const { data, error } = await authClient.signIn.email({ email, password });
      if (!error && data?.user) emitAuth('SIGNED_IN', data);
      return {
        data: data ? { user: data.user, session: data.session || null } : null,
        error,
      };
    },
    async signUp({ email, password, options = {} }) {
      const extra = options?.data || {};
      const { data, error } = await authClient.signUp.email({
        email,
        password,
        name: extra.name || '',
        phone: extra.phone || '',
        city: extra.city || '',
        quarter: extra.quarter || '',
        referredBy: extra.referred_by || '',
      });
      if (!error && data?.user) emitAuth('SIGNED_IN', { user: data.user });
      return {
        data: data ? { user: data.user, session: data.session || null } : null,
        error,
      };
    },
    async signOut() {
      const { error } = await authClient.signOut();
      if (!error) emitAuth('SIGNED_OUT', null);
      return { error };
    },
    async updateUser({ password }) {
      const { data, error } = await authClient.resetPassword({ newPassword: password });
      return { data, error };
    },
    async resetPasswordForEmail(email, { redirectTo } = {}) {
      const { error } = await authClient.forgetPassword({ email, redirectTo });
      return { error };
    },
    onAuthStateChange(cb) {
      authListeners.add(cb);
      return { data: { subscription: { unsubscribe: () => authListeners.delete(cb) } } };
    },
  },

  from(table) {
    return new QueryBuilder(table);
  },

  rpc(name, params = {}) {
    return apiJson('/api/rpc', { name, params });
  },

  storage: {
    from(bucket) {
      const folder = bucket === 'branding' ? '/branding' : '';
      return {
        upload: async (_path, file, _opts = {}) => {
          try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('folder', folder);
            const res = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'include' });
            const result = await res.json().catch(() => ({}));
            if (!result.ok) return { data: null, error: new Error(result.error || 'Upload échoué') };
            return { data: { path: result.url, publicId: result.publicId }, error: null };
          } catch (e) {
            return { data: null, error: e };
          }
        },
        getPublicUrl: (path) => {
          if (path && /^https?:\/\//.test(path)) return { data: { publicUrl: path }, error: null };
          return { data: { publicUrl: path || '' }, error: null };
        },
        remove: async (paths = []) => {
          for (const p of paths) {
            try {
              await fetch('/api/files/remove', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ publicId: p }),
              });
            } catch { /* best-effort */ }
          }
          return { error: null };
        },
      };
    },
  },
};

// ════════════════════════════════════════════════════════════
// ADAPTATEUR POCKETBASE → API /api/pb
// ════════════════════════════════════════════════════════════

class PbCollection {
  constructor(collectionName) {
    this.collectionName = collectionName;
  }

  async getList(page = 1, perPage = 50, options = {}) {
    const { filter, sort, expand } = options;
    const { items, totalItems, page: p, perPage: pp } = await pbApi(
      this.collectionName,
      'getList',
      { filter, sort, expand, page, perPage }
    );
    return { items, totalItems, page: p, perPage: pp };
  }

  async getFullList(options = {}) {
    const { filter, sort, expand } = options;
    const { items } = await pbApi(this.collectionName, 'getFullList', { filter, sort, expand });
    return items;
  }

  async getOne(id, options = {}) {
    const { expand } = options;
    const { item } = await pbApi(this.collectionName, 'getOne', { id, expand });
    return item;
  }

  async getFirstListItem(filter = '', options = {}) {
    const { sort, expand } = options;
    const { item } = await pbApi(this.collectionName, 'getFirstListItem', { filter, sort, expand });
    return item;
  }

  async count(filter = '') {
    const { count } = await pbApi(this.collectionName, 'count', { filter });
    return count;
  }

  async create(data, _options = {}) {
    const { item } = await pbApi(this.collectionName, 'create', {}, data);
    return item;
  }

  async update(id, data, _options = {}) {
    const { item } = await pbApi(this.collectionName, 'update', { id }, data);
    return item;
  }

  async delete(id) {
    await pbApi(this.collectionName, 'delete', { id });
    return true;
  }
}

class PocketBaseCompatible {
  constructor() {
    this.authStore = {
      record: null,
      token: null,
      isAuth: false,
    };
    this.collections = {};
    this.supabase = supabase;
    this.files = {
      getURL: (item, field, _options = {}) => {
        if (!item || !field) return '';
        const val = item[field];
        if (!val) return '';
        if (typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://'))) {
          return val;
        }
        return '';
      },
      upload: async (_bucket, _path, file) => {
        const { data, error } = await supabase.storage.from('uploads').upload(_path, file);
        if (error) throw error;
        return data;
      },
      delete: async (_bucket, _path) => {
        await supabase.storage.from('uploads').remove([_path]);
      },
      getBrandingUrl: (item, field = 'logo_file', _options = {}) => {
        if (!item) return '';
        const val = item[field];
        if (!val) return item.logo_url || '';
        if (typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://'))) {
          return val;
        }
        return item.logo_url || '';
      },
    };
  }

  filter(template, params = {}) {
    let result = template;
    for (const [key, val] of Object.entries(params)) {
      result = result.replace(new RegExp(`\\{:${key}\\}`, 'g'), String(val));
    }
    return result;
  }

  collection(name) {
    if (!this.collections[name]) {
      this.collections[name] = new PbCollection(name);
    }
    return this.collections[name];
  }

  async authWithPassword(email, password) {
    const { data, error } = await authClient.signIn.email({ email, password });
    if (error) throw error;
    const user = data?.user || null;
    this.authStore.record = user;
    this.authStore.token = data?.token || null;
    this.authStore.isAuth = !!user;
    return { user, token: data?.token || null, session: null };
  }

  async authWithSignUp(email, password, userData = {}) {
    const { data, error } = await authClient.signUp.email({
      email,
      password,
      name: userData.name || '',
      phone: userData.phone || '',
      city: userData.city || '',
      quarter: userData.quarter || '',
      referredBy: userData.referred_by || '',
    });
    if (error) throw error;
    const user = data?.user || null;
    this.authStore.record = user;
    this.authStore.token = data?.token || null;
    this.authStore.isAuth = !!user;
    return { user, token: data?.token || null, session: data?.session || (data?.token ? { access_token: data.token } : null) };
  }

  async authLogout() {
    await authClient.signOut();
    this.authStore.record = null;
    this.authStore.token = null;
    this.authStore.isAuth = false;
    emitAuth('SIGNED_OUT', null);
  }

  getCurrentUser() {
    return authClient.getUser();
  }
}

// ════════════════════════════════════════════════════════════
// EXPORTS (interface inchangée)
// ════════════════════════════════════════════════════════════

export const pb = new PocketBaseCompatible();
export const supabaseAuth = supabase.auth;
export const supabaseStorage = supabase.storage;
export default supabase;
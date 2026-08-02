(function (global) {
  "use strict";

  function safeJson(text) {
    if (!text) return null;
    try { return JSON.parse(text); } catch (_error) { return text; }
  }

  function errorFromPayload(payload, status, fallback) {
    const message = payload?.message || payload?.msg || payload?.error_description || payload?.error || fallback || `Error HTTP ${status}`;
    const error = new Error(String(message));
    error.status = status;
    error.payload = payload;
    return error;
  }

  async function request(url, options = {}, timeoutMs = 25000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const text = await response.text();
      const payload = safeJson(text);
      if (!response.ok) throw errorFromPayload(payload, response.status, "Supabase rechazó la solicitud");
      return { response, payload };
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("La conexión con Supabase demoró demasiado");
      if (error instanceof TypeError) throw new Error("No se pudo llegar a Supabase. Revisá la conexión a internet o la configuración del proyecto.");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  function projectRef(url) {
    try { return new URL(url).hostname.split(".")[0]; } catch (_error) { return "campo-hoy"; }
  }

  function normalizeSession(payload) {
    if (!payload) return null;
    if (payload.session) return normalizeSession(payload.session);
    if (!payload.access_token) return null;
    return {
      ...payload,
      expires_at: payload.expires_at || Math.floor(Date.now() / 1000) + Number(payload.expires_in || 3600),
      user: payload.user || null,
    };
  }

  class AuthClient {
    constructor(baseUrl, apiKey) {
      this.baseUrl = baseUrl.replace(/\/$/, "");
      this.apiKey = apiKey;
      this.storageKey = `sb-${projectRef(baseUrl)}-auth-token`;
      this.fallbackStorageKey = "campo-hoy-supabase-session-v1";
      this.listeners = new Set();
      this.session = this.readStoredSession();
      this.refreshPromise = null;
    }

    readStorage(key) {
      try { return global.localStorage?.getItem(key); } catch (_error) { return null; }
    }

    writeStorage(key, value) {
      try {
        if (value == null) global.localStorage?.removeItem(key);
        else global.localStorage?.setItem(key, value);
      } catch (_error) {}
    }

    readStoredSession() {
      const candidates = [this.readStorage(this.storageKey), this.readStorage(this.fallbackStorageKey)];
      for (const raw of candidates) {
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          const session = normalizeSession(parsed?.currentSession || parsed);
          if (session?.access_token) return session;
        } catch (_error) {}
      }
      return null;
    }

    storeSession(session) {
      this.session = session || null;
      if (this.session) {
        const raw = JSON.stringify(this.session);
        this.writeStorage(this.storageKey, raw);
        this.writeStorage(this.fallbackStorageKey, raw);
      } else {
        this.writeStorage(this.storageKey, null);
        this.writeStorage(this.fallbackStorageKey, null);
      }
    }

    emit(event) {
      for (const listener of this.listeners) {
        try { listener(event, this.session); } catch (error) { console.warn(error); }
      }
    }

    async signInWithPassword({ email, password }) {
      try {
        const { payload } = await request(`${this.baseUrl}/auth/v1/token?grant_type=password`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: this.apiKey },
          body: JSON.stringify({ email, password }),
        });
        const session = normalizeSession(payload);
        if (!session) throw new Error("Supabase no devolvió una sesión válida");
        this.storeSession(session);
        this.emit("SIGNED_IN");
        return { data: { user: session.user, session }, error: null };
      } catch (error) {
        return { data: { user: null, session: null }, error };
      }
    }

    async signUp({ email, password }) {
      try {
        const { payload } = await request(`${this.baseUrl}/auth/v1/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: this.apiKey },
          body: JSON.stringify({ email, password }),
        });
        const session = normalizeSession(payload);
        if (session) {
          this.storeSession(session);
          this.emit("SIGNED_IN");
        }
        return { data: { user: payload?.user || session?.user || null, session }, error: null };
      } catch (error) {
        return { data: { user: null, session: null }, error };
      }
    }

    async refreshSession() {
      if (!this.session?.refresh_token) return null;
      if (this.refreshPromise) return this.refreshPromise;
      this.refreshPromise = (async () => {
        try {
          const { payload } = await request(`${this.baseUrl}/auth/v1/token?grant_type=refresh_token`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: this.apiKey },
            body: JSON.stringify({ refresh_token: this.session.refresh_token }),
          });
          const session = normalizeSession(payload);
          if (!session) throw new Error("No se pudo renovar la sesión");
          this.storeSession(session);
          this.emit("TOKEN_REFRESHED");
          return session;
        } catch (error) {
          console.warn("No se pudo renovar la sesión", error);
          this.storeSession(null);
          this.emit("SIGNED_OUT");
          return null;
        } finally {
          this.refreshPromise = null;
        }
      })();
      return this.refreshPromise;
    }

    async validSession() {
      const session = this.session || this.readStoredSession();
      if (!session) return null;
      this.session = session;
      const expiresAt = Number(session.expires_at || 0);
      if (expiresAt && expiresAt <= Math.floor(Date.now() / 1000) + 60) return this.refreshSession();
      return session;
    }

    async getSession() {
      const session = await this.validSession();
      return { data: { session }, error: null };
    }

    onAuthStateChange(callback) {
      this.listeners.add(callback);
      return { data: { subscription: { unsubscribe: () => this.listeners.delete(callback) } } };
    }

    async signOut() {
      const token = this.session?.access_token;
      try {
        if (token) {
          await request(`${this.baseUrl}/auth/v1/logout`, {
            method: "POST",
            headers: { apikey: this.apiKey, Authorization: `Bearer ${token}` },
          }, 10000);
        }
      } catch (error) {
        console.warn("Cierre remoto no disponible", error);
      }
      this.storeSession(null);
      this.emit("SIGNED_OUT");
      return { error: null };
    }

    async authHeaders() {
      const session = await this.validSession();
      return {
        apikey: this.apiKey,
        Authorization: `Bearer ${session?.access_token || this.apiKey}`,
      };
    }
  }

  class QueryBuilder {
    constructor(client, table) {
      this.client = client;
      this.table = table;
      this.method = "GET";
      this.columns = "*";
      this.filters = [];
      this.ordering = null;
      this.rangeFrom = null;
      this.rangeTo = null;
    }

    select(columns = "*") { this.method = "GET"; this.columns = columns; return this; }
    delete() { this.method = "DELETE"; return this; }
    eq(column, value) { this.filters.push([column, value]); return this; }
    order(column, options = {}) { this.ordering = [column, options.ascending !== false]; return this; }
    range(from, to) { this.rangeFrom = Number(from); this.rangeTo = Number(to); return this; }

    async execute() {
      try {
        const url = new URL(`${this.client.baseUrl}/rest/v1/${encodeURIComponent(this.table)}`);
        if (this.method === "GET") url.searchParams.set("select", this.columns);
        for (const [column, value] of this.filters) url.searchParams.append(column, `eq.${value}`);
        if (this.ordering) url.searchParams.set("order", `${this.ordering[0]}.${this.ordering[1] ? "asc" : "desc"}`);
        const headers = { ...(await this.client.auth.authHeaders()), Accept: "application/json" };
        if (this.rangeFrom !== null && this.rangeTo !== null) headers.Range = `${this.rangeFrom}-${this.rangeTo}`;
        if (this.method === "DELETE") headers.Prefer = "return=minimal";
        const { payload } = await request(url.toString(), { method: this.method, headers });
        return { data: this.method === "DELETE" ? null : (payload || []), error: null };
      } catch (error) {
        return { data: null, error };
      }
    }

    then(resolve, reject) { return this.execute().then(resolve, reject); }
    catch(reject) { return this.execute().catch(reject); }
  }

  class SupabaseClient {
    constructor(baseUrl, apiKey) {
      this.baseUrl = baseUrl.replace(/\/$/, "");
      this.apiKey = apiKey;
      this.auth = new AuthClient(this.baseUrl, apiKey);
    }

    from(table) {
      const client = this;
      return {
        select(columns = "*") { return new QueryBuilder(client, table).select(columns); },
        delete() { return new QueryBuilder(client, table).delete(); },
        async upsert(rows, options = {}) {
          try {
            const url = new URL(`${client.baseUrl}/rest/v1/${encodeURIComponent(table)}`);
            if (options.onConflict) url.searchParams.set("on_conflict", options.onConflict);
            const headers = {
              ...(await client.auth.authHeaders()),
              "Content-Type": "application/json",
              Accept: "application/json",
              Prefer: "resolution=merge-duplicates,return=representation",
            };
            const { payload } = await request(url.toString(), { method: "POST", headers, body: JSON.stringify(rows) });
            return { data: payload, error: null };
          } catch (error) {
            return { data: null, error };
          }
        },
      };
    }
  }

  global.supabase = {
    createClient(url, key) {
      if (!url || !key) throw new Error("Falta configurar la URL o la clave pública de Supabase");
      return new SupabaseClient(url, key);
    },
  };
})(window);

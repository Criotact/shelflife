import axios, { AxiosInstance } from "axios";
import { MatchCandidate } from "../types";
import { getItem, setItem, removeItem } from "./storage";
import { Capacitor } from "@capacitor/core";

export interface ConnectionConfig {
  url: string;
  token: string;
  isDirect: boolean;
  extraHeaders: Record<string, string>;
}

class ApiClient {
  private client: AxiosInstance | null = null;
  private config: ConnectionConfig | null = null;

  constructor() {
    // initialize must be called asynchronously at startup
  }

  // Load connection config from storage or fallback to server env
  public async initialize() {
    const url = await getItem("ABS_URL");
    const token = await getItem("ABS_TOKEN");
    const extraHeadersRaw = await getItem("ABS_EXTRA_HEADERS");
    const isNative = Capacitor.isNativePlatform();

    let extraHeaders: Record<string, string> = {};
    if (extraHeadersRaw) {
      try {
        extraHeaders = JSON.parse(extraHeadersRaw);
      } catch {
        console.warn("ABS_EXTRA_HEADERS in storage is not valid JSON — ignoring.");
      }
    }

    if (url && token) {
      this.config = {
        url: url.endsWith("/") ? url.slice(0, -1) : url,
        token,
        isDirect: true,
        extraHeaders,
      };

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };

      if (!isNative) {
        // Web: routes through /gateway
        headers["X-Target-URL"] = this.config.url;
        if (Object.keys(extraHeaders).length > 0) {
          headers["X-ABS-Extra-Headers"] = JSON.stringify(extraHeaders);
        }
      } else {
        // Native: direct
        Object.assign(headers, extraHeaders);
      }

      this.client = axios.create({
        baseURL: isNative ? `${this.config.url}/api` : "/gateway/api",
        headers,
      });
    } else {
      // Proxy Mode Fallback (reads relative from server env via /gateway)
      this.config = {
        url: isNative ? "http://localhost" : window.location.origin,
        token: "",
        isDirect: false,
        extraHeaders,
      };

      const headers: Record<string, string> = {};
      if (!isNative) {
        if (Object.keys(extraHeaders).length > 0) {
          headers["X-ABS-Extra-Headers"] = JSON.stringify(extraHeaders);
        }
      } else {
        Object.assign(headers, extraHeaders);
      }

      this.client = axios.create({
        baseURL: isNative ? "http://localhost/api" : "/gateway/api",
        headers,
      });
    }

    this.client.interceptors.response.use((response) => {
      const contentType = response.headers?.['content-type'];
      const contentTypeStr = typeof contentType === 'string' ? contentType : '';
      if (
        contentTypeStr.includes('text/html') ||
        (typeof response.data === 'string' && response.data.trim().startsWith('<!DOCTYPE'))
      ) {
        throw new Error('Upstream returned HTML instead of JSON. This typically indicates a Cloudflare Access or authentication gateway challenge.');
      }
      return response;
    });
  }

  public getConfig(): ConnectionConfig | null {
    return this.config;
  }

  public isDirectMode(): boolean {
    return !!this.config?.isDirect;
  }

  // Save direct credentials (and optional extra headers)
  public async saveConnection(url: string, token: string, extraHeaders?: Record<string, string>) {
    const cleanUrl = url.endsWith("/") ? url.slice(0, -1) : url;
    await setItem("ABS_URL", cleanUrl);
    await setItem("ABS_TOKEN", token);
    if (extraHeaders && Object.keys(extraHeaders).length > 0) {
      await setItem("ABS_EXTRA_HEADERS", JSON.stringify(extraHeaders));
    } else {
      await removeItem("ABS_EXTRA_HEADERS");
    }
    await this.initialize();
  }

  // Save extra headers separately (e.g. from Settings)
  public async saveExtraHeaders(extraHeaders: Record<string, string>) {
    if (Object.keys(extraHeaders).length > 0) {
      await setItem("ABS_EXTRA_HEADERS", JSON.stringify(extraHeaders));
    } else {
      await removeItem("ABS_EXTRA_HEADERS");
    }
    await this.initialize();
  }

  // Clear credentials (logout)
  public async disconnect() {
    await removeItem("ABS_URL");
    await removeItem("ABS_TOKEN");
    await removeItem("ABS_EXTRA_HEADERS");
    await this.initialize();
  }

  // Get cover path dynamically based on connection mode
  public getCoverPath(itemId: string): string {
    const isNative = Capacitor.isNativePlatform();
    if (isNative && this.config?.url) {
      return `${this.config.url}/api/items/${itemId}/cover`;
    }
    return `/gateway/api/items/${itemId}/cover`;
  }

  // Fetch cover as secure blob URL with proper credentials in headers
  public async fetchCoverAsBlob(itemId: string): Promise<string | null> {
    const isNative = Capacitor.isNativePlatform();
    const coverPath = this.getCoverPath(itemId);
    try {
      const headers: Record<string, string> = {};
      if (!isNative) {
        // Web: through gateway
        if (this.config?.isDirect && this.config.url) {
          headers["X-Target-URL"] = this.config.url;
          if (this.config.token) {
            headers["Authorization"] = `Bearer ${this.config.token}`;
          }
        }
        const extraHeaders = this.config?.extraHeaders || {};
        if (Object.keys(extraHeaders).length > 0) {
          headers["X-ABS-Extra-Headers"] = JSON.stringify(extraHeaders);
        }
      } else {
        // Native: direct request
        if (this.config?.token) {
          headers["Authorization"] = `Bearer ${this.config.token}`;
        }
        const extraHeaders = this.config?.extraHeaders || {};
        if (Object.keys(extraHeaders).length > 0) {
          Object.assign(headers, extraHeaders);
        }
      }
      const response = await fetch(coverPath, { headers });
      if (!response.ok) return null;
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (err) {
      console.error("Failed to fetch cover as blob:", err);
      return null;
    }
  }

  // Health check to test if server is reachable
  public async checkHealth(): Promise<{ error?: string; ok: boolean }> {
    if (!this.client) {
      return { ok: false, error: "API client not initialized" };
    }

    const isNative = Capacitor.isNativePlatform();

    try {
      if (isNative) {
        if (this.config?.url) {
          const extraHeaders = this.config?.extraHeaders || {};
          await axios.get(`${this.config.url}/ping`, {
            timeout: 5000,
            headers: extraHeaders,
          });
        } else {
          return { ok: false, error: "No URL configured" };
        }
      } else {
        // Web: ping the target via the gateway
        const headers: Record<string, string> = {};
        if (this.config?.isDirect && this.config.url) {
          headers["X-Target-URL"] = this.config.url;
        }
        const extraHeaders = this.config?.extraHeaders || {};
        if (Object.keys(extraHeaders).length > 0) {
          headers["X-ABS-Extra-Headers"] = JSON.stringify(extraHeaders);
        }
        await axios.get("/gateway/ping", {
          timeout: 5000,
          headers,
        });
      }

      // Test credentials/token by loading libraries
      await this.client.get("/libraries", { timeout: 5000 });
      return { ok: true };
    } catch (err: any) {
      console.error("Health check error:", err);
      const msg = err.response?.status === 401 
        ? "Unauthorized: Invalid API Token." 
        : err.message || "Network Error";
      return { ok: false, error: msg };
    }
  }

  // Get libraries
  public async getLibraries() {
    if (!this.client) throw new Error("Client not initialized");
    const response = await this.client.get("/libraries");
    return response.data;
  }

  // Get users
  public async getUsers() {
    if (!this.client) throw new Error("Client not initialized");
    const response = await this.client.get("/users");
    return response.data;
  }

  // Get online users
  public async getOnlineUsers() {
    if (!this.client) throw new Error("Client not initialized");
    const response = await this.client.get("/users/online");
    return response.data;
  }

  // Get sessions
  public async getSessions(params: any) {
    if (!this.client) throw new Error("Client not initialized");
    // Standard query parameters
    const response = await this.client.get("/sessions", { params });
    return response.data;
  }

  // Library-specific items
  public async getLibraryItems(libraryId: string, params?: any) {
    if (!this.client) throw new Error("Client not initialized");
    const response = await this.client.get(`/libraries/${libraryId}/items`, { params });
    return response.data;
  }

  // Get library stats (total size, duration, etc.)
  public async getLibraryStats(libraryId: string) {
    if (!this.client) throw new Error("Client not initialized");
    const response = await this.client.get(`/libraries/${libraryId}/stats`);
    return response.data;
  }

  // Library-specific controls
  public async scanLibrary(libraryId: string) {
    if (!this.client) throw new Error("Client not initialized");
    const response = await this.client.post(`/libraries/${libraryId}/scan?force=1`);
    return response.data;
  }

  // Get running/active tasks
  public async getTasks() {
    if (!this.client) throw new Error("Client not initialized");
    const response = await this.client.get("/tasks");
    return response.data;
  }

  public async matchLibraryItem(itemId: string, matchData?: MatchCandidate) {
    if (!this.client) throw new Error("Client not initialized");
    const payload = matchData ? {
      provider: matchData.provider,
      id: matchData.id,
      title: matchData.title,
      author: matchData.author || null,
      isbn: matchData.isbn || null,
      asin: matchData.asin || null,
      coverUrl: matchData.coverUrl || null,
      subtitle: matchData.subtitle || null,
      publisher: matchData.publisher || null,
      publishDate: matchData.publishDate || null,
      description: matchData.description || null
    } : undefined;
    const response = await this.client.post(`/items/${itemId}/match`, payload);
    return response.data;
  }

  public async searchMatches(itemId: string, provider: string, title: string, author?: string): Promise<MatchCandidate[]> {
    if (!this.client) throw new Error("Client not initialized");
    const response = await this.client.get("/search/books", {
      params: { provider, title, author }
    });
    const candidates = response.data || [];
    return candidates.map((c: any) => ({
      title: c.title,
      author: c.author,
      coverUrl: c.cover || (c.covers && c.covers[0]) || undefined,
      asin: c.asin || undefined,
      isbn: c.isbn || undefined,
      subtitle: c.subtitle || undefined,
      publisher: c.publisher || undefined,
      publishDate: c.publishDate || c.publishedYear || undefined,
      description: c.description || undefined,
      provider: provider,
      id: c.id || c.key || c.edition || ""
    }));
  }

  // Recent items - always aggregate client-side
  public async getRecentItems(): Promise<{ results: any[]; totalBooks: number }> {
    if (!this.client) throw new Error("Client not initialized");

    try {
      const libData = await this.getLibraries();
      const libraries = libData?.libraries || libData || [];
      
      if (libraries.length === 0) {
        return { results: [], totalBooks: 0 };
      }

      const recentPromises = libraries.map((lib: any) =>
        this.client!.get(`/libraries/${lib.id}/items?limit=10&sort=addedAt&desc=1`)
          .then((res) => ({
            results: res.data.results || [],
            total: res.data.total || 0,
          }))
          .catch((err) => {
            console.error(`Failed to load library items for ${lib.id}:`, err);
            return { results: [], total: 0 };
          })
      );

      const results = await Promise.all(recentPromises);
      const totalBooks = results.reduce((acc, r) => acc + r.total, 0);
      const flattened = results.flatMap((r) => r.results);
      
      const sorted = flattened.sort((a: any, b: any) => b.addedAt - a.addedAt);
      return {
        results: sorted.slice(0, 10),
        totalBooks,
      };
    } catch (err) {
      console.error("Failed client-side aggregation of recent items:", err);
      throw err;
    }
  }

  public async getItemDetails(itemId: string) {
    if (!this.client) throw new Error("Client not initialized");
    const response = await this.client.get(`/items/${itemId}`);
    return response.data;
  }

  public async lookupChapters(asin: string, region?: string) {
    const params: Record<string, string> = {};
    if (region) params.region = region;
    const response = await axios.get(`https://api.audnex.us/books/${asin}/chapters`, { params });
    return response.data;
  }

  public async updateChapters(itemId: string, chapters: any[]) {
    if (!this.client) throw new Error("Client not initialized");
    const response = await this.client.post(`/items/${itemId}/chapters`, { chapters });
    return response.data;
  }
}

export const api = new ApiClient();

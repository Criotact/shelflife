import axios, { AxiosInstance } from "axios";
import { MatchCandidate } from "../types";

export interface ConnectionConfig {
  url: string;
  token: string;
  isDirect: boolean;
}

class ApiClient {
  private client: AxiosInstance | null = null;
  private config: ConnectionConfig | null = null;

  constructor() {
    this.initialize();
  }

  // Load connection config from storage or fallback to server env
  public initialize() {
    const url = localStorage.getItem("ABS_URL");
    const token = localStorage.getItem("ABS_TOKEN");

    if (url && token) {
      this.config = {
        url: url.endsWith("/") ? url.slice(0, -1) : url,
        token,
        isDirect: true,
      };
      this.client = axios.create({
        baseURL: "/api/abs",
        headers: {
          "X-ABS-URL": this.config.url,
          Authorization: `Bearer ${token}`,
        },
      });
    } else {
      // Proxy Mode Fallback (reads relative from server hosting the web app)
      this.config = {
        url: window.location.origin,
        token: "",
        isDirect: false,
      };
      this.client = axios.create({
        baseURL: "/api/abs",
      });
    }
  }

  public getConfig(): ConnectionConfig | null {
    return this.config;
  }

  public isDirectMode(): boolean {
    return !!this.config?.isDirect;
  }

  // Save direct credentials
  public saveConnection(url: string, token: string) {
    const cleanUrl = url.endsWith("/") ? url.slice(0, -1) : url;
    localStorage.setItem("ABS_URL", cleanUrl);
    localStorage.setItem("ABS_TOKEN", token);
    this.initialize();
  }

  // Clear credentials (logout)
  public disconnect() {
    localStorage.removeItem("ABS_URL");
    localStorage.removeItem("ABS_TOKEN");
    this.initialize();
  }

  // Get cover path dynamically based on connection mode
  public getCoverPath(itemId: string): string {
    if (this.config?.isDirect && this.config.url) {
      const encodedUrl = encodeURIComponent(this.config.url);
      return `/metadata/items/${itemId}/cover.jpg?absUrl=${encodedUrl}`;
    }
    return `/metadata/items/${itemId}/cover.jpg`;
  }

  // Fetch cover as secure blob URL with proper credentials in headers
  public async fetchCoverAsBlob(itemId: string): Promise<string | null> {
    const coverPath = this.getCoverPath(itemId);
    try {
      const headers: Record<string, string> = {};
      if (this.config?.token) {
        headers["Authorization"] = `Bearer ${this.config.token}`;
      }
      if (this.config?.isDirect && this.config.url) {
        headers["X-ABS-URL"] = this.config.url;
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

    try {
      // Both modes call the Express backend's health route via proxy
      const response = await this.client.get("/health");
      if (response.data?.error) {
        return { ok: false, error: `Could not connect to host at ${this.config?.url || 'Audiobookshelf'}. Error: ${response.data.error}` };
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

  // Library-specific controls
  public async scanLibrary(libraryId: string) {
    if (!this.client) throw new Error("Client not initialized");
    const response = await this.client.post(`/libraries/${libraryId}/scan?force=1`);
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

  // Recent items - aggregate client-side if in direct mode
  public async getRecentItems(): Promise<{ results: any[]; totalBooks: number }> {
    if (!this.client) throw new Error("Client not initialized");

    if (this.config?.isDirect) {
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
    } else {
      // Proxy Mode calls the Express aggregation endpoint directly
      const response = await this.client.get("/recent");
      return response.data;
    }
  }

  public async getItemDetails(itemId: string) {
    if (!this.client) throw new Error("Client not initialized");
    const response = await this.client.get(`/items/${itemId}`);
    return response.data;
  }

  public async lookupChapters(asin: string, region?: string) {
    if (this.config?.isDirect) {
      const params: Record<string, string> = {};
      if (region) params.region = region;
      const response = await axios.get(`https://api.audnex.us/books/${asin}/chapters`, { params });
      return response.data;
    } else {
      if (!this.client) throw new Error("Client not initialized");
      const params: Record<string, string> = { asin };
      if (region) params.region = region;
      const response = await this.client.get("/chapters/lookup", { params });
      return response.data;
    }
  }

  public async updateChapters(itemId: string, chapters: any[]) {
    if (!this.client) throw new Error("Client not initialized");
    const response = await this.client.post(`/items/${itemId}/chapters`, { chapters });
    return response.data;
  }
}

export const api = new ApiClient();

import { request as playwrightRequest, type APIRequestContext, type APIResponse } from "@playwright/test";
import { io, type Socket } from "socket.io-client";
import type { SeedAccount } from "./seed-accounts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionInfo {
  userId: string;
  name: string;
  email: string;
  role: string;
}

interface SocketEventBuffer {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  filter?: (data: unknown) => boolean;
  timer: ReturnType<typeof setTimeout>;
}

// ---------------------------------------------------------------------------
// TestAgent — one simulated user
// ---------------------------------------------------------------------------

export class TestAgent {
  readonly account: SeedAccount;
  readonly baseURL: string;
  private _request: APIRequestContext;
  private _ownsContext: boolean;
  private _cookies: string = "";
  private _session: SessionInfo | null = null;
  private _socket: Socket | null = null;

  /** Buffered events received before anyone called waitForEvent */
  private _eventBuffers: Map<string, unknown[]> = new Map();
  /** Pending waitForEvent callers */
  private _pendingWaits: Map<string, SocketEventBuffer[]> = new Map();
  /** Global rate limit tracking per user (persists across TestAgent instances in same process) */
  private static _globalMsgTimestamps = new Map<string, number[]>();

  constructor(request: APIRequestContext, account: SeedAccount, baseURL: string) {
    this._request = request;
    this._ownsContext = false;
    this.account = account;
    this.baseURL = baseURL;
  }

  /** Create a TestAgent with its own APIRequestContext (safe for beforeAll) */
  static async create(account: SeedAccount, baseURL: string): Promise<TestAgent> {
    const ctx = await playwrightRequest.newContext({ baseURL });
    const agent = new TestAgent(ctx, account, baseURL);
    agent._ownsContext = true;
    await agent.login();
    return agent;
  }

  get session(): SessionInfo {
    if (!this._session) throw new Error("Not logged in — call login() first");
    return this._session;
  }

  get userId(): string {
    return this.session.userId;
  }

  // =========================================================================
  // Authentication
  // =========================================================================

  async login(): Promise<SessionInfo> {
    // 1. Get CSRF token
    const csrfRes = await this._request.get(`${this.baseURL}/api/auth/csrf`);
    const csrfBody = await csrfRes.json();
    const csrfToken = csrfBody.csrfToken;
    this._collectCookies(csrfRes);

    // 2. POST credentials
    const loginRes = await this._request.post(
      `${this.baseURL}/api/auth/callback/credentials`,
      {
        form: {
          email: this.account.email,
          password: this.account.password,
          csrfToken,
          json: "true",
        },
        headers: { cookie: this._cookies },
        maxRedirects: 0,
      },
    );
    this._collectCookies(loginRes);

    // Handle redirect — follow it to collect session cookie
    if (loginRes.status() >= 300 && loginRes.status() < 400) {
      const location = loginRes.headers()["location"];
      if (location) {
        const redirectURL = location.startsWith("http")
          ? location
          : `${this.baseURL}${location}`;
        const followRes = await this._request.get(redirectURL, {
          headers: { cookie: this._cookies },
          maxRedirects: 5,
        });
        this._collectCookies(followRes);
      }
    }

    // 3. Get session
    const sessionRes = await this._request.get(`${this.baseURL}/api/auth/session`, {
      headers: { cookie: this._cookies },
    });
    this._collectCookies(sessionRes);
    const sessionData = await sessionRes.json();

    if (!sessionData?.user?.id) {
      throw new Error(
        `Login failed for ${this.account.email}: ${JSON.stringify(sessionData)}`,
      );
    }

    this._session = {
      userId: sessionData.user.id,
      name: sessionData.user.name || this.account.name,
      email: sessionData.user.email || this.account.email,
      role: sessionData.user.role || this.account.role,
    };

    return this._session;
  }

  // =========================================================================
  // REST helpers
  // =========================================================================

  async get(path: string): Promise<APIResponse> {
    return this._request.get(`${this.baseURL}${path}`, {
      headers: { cookie: this._cookies },
    });
  }

  async post(path: string, data?: unknown): Promise<APIResponse> {
    return this._request.post(`${this.baseURL}${path}`, {
      headers: { cookie: this._cookies, "content-type": "application/json" },
      data: data ?? {},
    });
  }

  async put(path: string, data?: unknown): Promise<APIResponse> {
    return this._request.put(`${this.baseURL}${path}`, {
      headers: { cookie: this._cookies, "content-type": "application/json" },
      data: data ?? {},
    });
  }

  async patch(path: string, data?: unknown): Promise<APIResponse> {
    return this._request.patch(`${this.baseURL}${path}`, {
      headers: { cookie: this._cookies, "content-type": "application/json" },
      data: data ?? {},
    });
  }

  async delete(path: string): Promise<APIResponse> {
    return this._request.delete(`${this.baseURL}${path}`, {
      headers: { cookie: this._cookies },
    });
  }

  async del(path: string): Promise<APIResponse> {
    return this.delete(path);
  }

  // =========================================================================
  // REST helpers — Bearer-token auth (for EA API key endpoints)
  // =========================================================================

  async postWithBearer(path: string, apiKey: string, data?: unknown): Promise<APIResponse> {
    return this._request.post(`${this.baseURL}${path}`, {
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      data: data ?? {},
    });
  }

  async getWithBearer(path: string, apiKey: string): Promise<APIResponse> {
    return this._request.get(`${this.baseURL}${path}`, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
  }

  // =========================================================================
  // Socket.io helpers
  // =========================================================================

  connectSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._socket = io(this.baseURL, {
        path: "/api/socketio",
        transports: ["websocket", "polling"],
        withCredentials: true,
        extraHeaders: { cookie: this._cookies },
        reconnection: false,
        timeout: 10000,
      });

      this._socket.on("connect", () => resolve());
      this._socket.on("connect_error", (err) =>
        reject(new Error(`Socket connect failed for ${this.account.email}: ${err.message}`)),
      );

      // Buffer all incoming events for waitForEvent
      const self = this;
      this._socket.onAny((event: string, data: unknown) => {
        if (process.env.DEBUG_SOCKET) {
          console.log(`[${self.account.email}] onAny: ${event}`, typeof data === 'object' ? JSON.stringify(data).slice(0, 120) : data);
        }
        // Try to resolve a pending wait first
        const pending = self._pendingWaits.get(event);
        if (pending && pending.length > 0) {
          const first = pending[0];
          if (!first.filter || first.filter(data)) {
            pending.shift();
            clearTimeout(first.timer);
            first.resolve(data);
            return;
          }
        }
        // Otherwise buffer it
        if (!self._eventBuffers.has(event)) {
          self._eventBuffers.set(event, []);
        }
        self._eventBuffers.get(event)!.push(data);
      });
    });
  }

  emit(event: string, data?: unknown): void {
    if (!this._socket) throw new Error("Socket not connected");
    this._socket.emit(event, data);
  }

  /**
   * Wait for a specific socket event. Checks the buffer first, then waits.
   * @param event The event name
   * @param opts.timeout Timeout in ms (default 10000)
   * @param opts.filter Optional predicate to match a specific event payload
   */
  waitForEvent<T = unknown>(
    event: string,
    opts?: { timeout?: number; filter?: (data: T) => boolean },
  ): Promise<T> {
    const timeout = opts?.timeout ?? 10000;
    const filter = opts?.filter as ((data: unknown) => boolean) | undefined;

    // Check buffer first
    const buffer = this._eventBuffers.get(event);
    if (buffer && buffer.length > 0) {
      const idx = filter ? buffer.findIndex((d) => filter(d)) : 0;
      if (idx >= 0) {
        const data = buffer.splice(idx, 1)[0];
        return Promise.resolve(data as T);
      }
    }

    // Wait for it
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        // Remove from pending
        const pending = this._pendingWaits.get(event);
        if (pending) {
          const idx = pending.findIndex((p) => p.timer === timer);
          if (idx >= 0) pending.splice(idx, 1);
        }
        reject(new Error(`Timeout waiting for event "${event}" (${timeout}ms)`));
      }, timeout);

      const entry: SocketEventBuffer = { resolve: resolve as (v: unknown) => void, reject, filter, timer };
      if (!this._pendingWaits.has(event)) {
        this._pendingWaits.set(event, []);
      }
      this._pendingWaits.get(event)!.push(entry);
    });
  }

  /** Wait for a socket error event related to a specific source event */
  waitForError(sourceEvent?: string, timeout = 5000): Promise<{ event: string; message: string }> {
    return this.waitForEvent("error", {
      timeout,
      filter: sourceEvent ? (d: { event: string }) => d.event === sourceEvent : undefined,
    }) as Promise<{ event: string; message: string }>;
  }

  disconnectSocket(): void {
    if (this._socket) {
      this._socket.removeAllListeners();
      this._socket.disconnect();
      this._socket = null;
    }
    this._eventBuffers.clear();
    this._pendingWaits.forEach((list) =>
      list.forEach((p) => {
        clearTimeout(p.timer);
        p.reject(new Error("Socket disconnected"));
      }),
    );
    this._pendingWaits.clear();
  }

  clearEventBuffer(event?: string): void {
    if (event) {
      this._eventBuffers.delete(event);
    } else {
      this._eventBuffers.clear();
    }
  }

  // =========================================================================
  // High-level: Clans (REST)
  // =========================================================================

  async createClan(data: {
    name: string;
    description?: string;
    tradingFocus?: string;
    isPublic: boolean;
  }) {
    const res = await this.post("/api/clans", data);
    return { res, body: await res.json() };
  }

  async getClan(clanId: string) {
    const res = await this.get(`/api/clans/${clanId}`);
    return { res, body: await res.json() };
  }

  async updateClan(clanId: string, data: Record<string, unknown>) {
    const res = await this.patch(`/api/clans/${clanId}`, data);
    return { res, body: await res.json() };
  }

  async deleteClan(clanId: string) {
    const res = await this.del(`/api/clans/${clanId}`);
    return res;
  }

  async updateClanSettings(clanId: string, data: Record<string, unknown>) {
    const res = await this.patch(`/api/clans/${clanId}/settings`, data);
    return { res, body: await res.json() };
  }

  // =========================================================================
  // High-level: Members (REST)
  // =========================================================================

  async getClanMembers(clanId: string) {
    const res = await this.get(`/api/clans/${clanId}/members`);
    return { res, body: await res.json() };
  }

  async updateMemberRole(clanId: string, userId: string, role: string) {
    const res = await this.patch(`/api/clans/${clanId}/members/${userId}`, { role });
    return { res, body: await res.json() };
  }

  async removeMember(clanId: string, userId: string) {
    const res = await this.del(`/api/clans/${clanId}/members/${userId}`);
    return res;
  }

  // =========================================================================
  // High-level: Join Requests (REST)
  // =========================================================================

  async requestToJoin(clanId: string, message?: string) {
    const res = await this.post(`/api/clans/${clanId}/join-requests`, { message });
    return { res, body: await res.json() };
  }

  async getJoinRequests(clanId: string) {
    const res = await this.get(`/api/clans/${clanId}/join-requests`);
    return { res, body: await res.json() };
  }

  async reviewJoinRequest(
    clanId: string,
    requestId: string,
    action: "APPROVED" | "REJECTED",
    rejectReason?: string,
  ) {
    const res = await this.patch(`/api/clans/${clanId}/join-requests/${requestId}`, {
      action,
      rejectReason,
    });
    return { res, body: await res.json() };
  }

  // =========================================================================
  // High-level: Invites (REST)
  // =========================================================================

  async createInvite(clanId: string, data?: { expiresInHours?: number; maxUses?: number }) {
    const res = await this.post(`/api/clans/${clanId}/invites`, data ?? {});
    return { res, body: await res.json() };
  }

  async getInvites(clanId: string) {
    const res = await this.get(`/api/clans/${clanId}/invites`);
    return { res, body: await res.json() };
  }

  async revokeInvite(clanId: string, inviteId: string) {
    const res = await this.del(`/api/clans/${clanId}/invites/${inviteId}`);
    return res;
  }

  // =========================================================================
  // High-level: Topics (REST)
  // =========================================================================

  async getTopics(clanId: string) {
    const res = await this.get(`/api/clans/${clanId}/topics`);
    return { res, body: await res.json() };
  }

  async createTopic(clanId: string, data: { name: string; description?: string }) {
    const res = await this.post(`/api/clans/${clanId}/topics`, data);
    return { res, body: await res.json() };
  }

  // =========================================================================
  // Rate limit awareness (5 msgs / 10 seconds per user)
  // =========================================================================

  private async _waitForRateLimit(): Promise<void> {
    const email = this.account.email;
    const now = Date.now();
    const windowMs = 10_000;
    const maxMessages = 5;
    let timestamps = TestAgent._globalMsgTimestamps.get(email) || [];
    timestamps = timestamps.filter((t) => now - t < windowMs);
    if (timestamps.length >= maxMessages) {
      const oldest = timestamps[timestamps.length - maxMessages];
      const waitMs = windowMs - (now - oldest) + 200;
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      const afterWait = Date.now();
      timestamps = timestamps.filter((t) => afterWait - t < windowMs);
    }
    timestamps.push(Date.now());
    TestAgent._globalMsgTimestamps.set(email, timestamps);
  }

  // =========================================================================
  // High-level: Chat (Socket.io)
  // =========================================================================

  joinClanChat(clanId: string, topicId?: string): void {
    this.emit("join_clan", topicId ? { clanId, topicId } : clanId);
  }

  leaveClanChat(clanId: string): void {
    this.emit("leave_clan", clanId);
  }

  switchTopic(clanId: string, fromTopicId: string, toTopicId: string): void {
    this.emit("switch_topic", { clanId, fromTopicId, toTopicId });
  }

  async sendMessage(clanId: string, topicId: string, content: string, replyToId?: string): Promise<void> {
    await this._waitForRateLimit();
    this.emit("send_message", { clanId, topicId, content, replyToId });
  }

  editMessage(messageId: string, clanId: string, content: string): void {
    this.emit("edit_message", { messageId, clanId, content });
  }

  deleteMessage(messageId: string, clanId: string): void {
    this.emit("delete_message", { messageId, clanId });
  }

  reactToMessage(messageId: string, clanId: string, emoji: string): void {
    this.emit("react_message", { messageId, clanId, emoji });
  }

  pinMessage(messageId: string, clanId: string): void {
    this.emit("pin_message", { messageId, clanId });
  }

  unpinMessage(messageId: string, clanId: string): void {
    this.emit("unpin_message", { messageId, clanId });
  }

  emitTyping(clanId: string): void {
    this.emit("typing", clanId);
  }

  emitStopTyping(clanId: string): void {
    this.emit("stop_typing", clanId);
  }

  // =========================================================================
  // High-level: Trade Cards (Socket.io)
  // =========================================================================

  async sendTradeCard(data: {
    clanId: string;
    topicId: string;
    instrument: string;
    direction: "LONG" | "SHORT";
    entry: number;
    stopLoss: number;
    targets: number[];
    timeframe: string;
    riskPct?: number;
    note?: string;
    tags?: string[];
  }): Promise<void> {
    await this._waitForRateLimit();
    this.emit("send_trade_card", data);
  }

  editTradeCard(data: {
    messageId: string;
    clanId: string;
    instrument: string;
    direction: "LONG" | "SHORT";
    entry: number;
    stopLoss: number;
    targets: number[];
    timeframe: string;
    riskPct?: number;
    note?: string;
    tags?: string[];
  }): void {
    this.emit("edit_trade_card", data);
  }

  trackTrade(messageId: string, clanId: string): void {
    this.emit("track_trade", { messageId, clanId });
  }

  updateTradeStatus(tradeId: string, clanId: string, status: string, note?: string): void {
    this.emit("update_trade_status", { tradeId, clanId, status, note });
  }

  executeTradeAction(data: {
    tradeId: string;
    clanId: string;
    actionType: string;
    newValue?: string;
    note?: string;
  }): void {
    this.emit("execute_trade_action", data);
  }

  // =========================================================================
  // High-level: DMs (Socket.io + REST)
  // =========================================================================

  joinDm(recipientId: string): void {
    this.emit("join_dm", recipientId);
  }

  async sendDm(recipientId: string, content: string, replyToId?: string): Promise<void> {
    await this._waitForRateLimit();
    this.emit("send_dm", { recipientId, content, replyToId });
  }

  editDm(messageId: string, recipientId: string, content: string): void {
    this.emit("edit_dm", { messageId, recipientId, content });
  }

  deleteDm(messageId: string, recipientId: string): void {
    this.emit("delete_dm", { messageId, recipientId });
  }

  emitDmTyping(recipientId: string): void {
    this.emit("dm_typing", recipientId);
  }

  emitDmStopTyping(recipientId: string): void {
    this.emit("dm_stop_typing", recipientId);
  }

  markDmRead(recipientId: string): void {
    this.emit("dm_read", recipientId);
  }

  async getDmMessages(recipientId: string, cursor?: string) {
    const url = cursor
      ? `/api/dms/${recipientId}?cursor=${cursor}`
      : `/api/dms/${recipientId}`;
    const res = await this.get(url);
    return { res, body: await res.json() };
  }

  async getConversations() {
    const res = await this.get("/api/me/dms");
    return { res, body: await res.json() };
  }

  // =========================================================================
  // High-level: Channel Posts (REST)
  // =========================================================================

  async createPost(clanId: string, data: { title?: string; content: string; isPremium?: boolean }) {
    const res = await this.post(`/api/clans/${clanId}/posts`, data);
    return { res, body: await res.json() };
  }

  async getPost(clanId: string, postId: string) {
    const res = await this.get(`/api/clans/${clanId}/posts/${postId}`);
    return { res, body: await res.json() };
  }

  async getPosts(clanId: string) {
    const res = await this.get(`/api/clans/${clanId}/posts`);
    return { res, body: await res.json() };
  }

  async updatePost(clanId: string, postId: string, data: Record<string, unknown>) {
    const res = await this.patch(`/api/clans/${clanId}/posts/${postId}`, data);
    return { res, body: await res.json() };
  }

  async deletePost(clanId: string, postId: string) {
    return this.del(`/api/clans/${clanId}/posts/${postId}`);
  }

  async reactToPost(clanId: string, postId: string, emoji: string) {
    const res = await this.post(`/api/clans/${clanId}/posts/${postId}/reactions`, { emoji });
    return { res, body: await res.json() };
  }

  // =========================================================================
  // High-level: Discovery & Leaderboard (REST)
  // =========================================================================

  async discoverClans(query?: string) {
    const url = query ? `/api/discover/clans?q=${encodeURIComponent(query)}` : "/api/discover/clans";
    const res = await this.get(url);
    return { res, body: await res.json() };
  }

  async discoverFreeAgents() {
    const res = await this.get("/api/discover/free-agents");
    return { res, body: await res.json() };
  }

  async getLeaderboard(lens?: string) {
    const url = lens ? `/api/leaderboard?lens=${lens}` : "/api/leaderboard";
    const res = await this.get(url);
    return { res, body: await res.json() };
  }

  // =========================================================================
  // High-level: Users (REST)
  // =========================================================================

  async updateProfile(data: Record<string, unknown>) {
    const res = await this.patch("/api/users/me", data);
    return { res, body: await res.json() };
  }

  async searchUsers(query: string) {
    const res = await this.get(`/api/users/search?q=${encodeURIComponent(query)}`);
    return { res, body: await res.json() };
  }

  async getUser(userId: string) {
    const res = await this.get(`/api/users/${userId}`);
    return { res, body: await res.json() };
  }

  // =========================================================================
  // High-level: Messages via REST
  // =========================================================================

  async getMessages(clanId: string, topicId: string, opts?: { pinned?: boolean; cursor?: string }) {
    const params = new URLSearchParams();
    if (opts?.pinned) params.set("pinned", "true");
    if (opts?.cursor) params.set("cursor", opts.cursor);
    const qs = params.toString();
    const res = await this.get(`/api/clans/${clanId}/topics/${topicId}/messages${qs ? `?${qs}` : ""}`);
    return { res, body: await res.json() };
  }

  // =========================================================================
  // Cleanup
  // =========================================================================

  /** Leave all clans this user is in. Handles the { chats: [...] } response shape. */
  async leaveAllClans(): Promise<void> {
    try {
      const res = await this.get("/api/me/chats");
      const data = await res.json();
      const chatList = data.chats ?? (Array.isArray(data) ? data : []);
      for (const c of chatList) {
        try {
          await this.removeMember(c.clanId, this.userId);
        } catch { /* ignore errors — may not be able to leave if LEADER */ }
      }
    } catch { /* ignore */ }
  }

  async cleanup(): Promise<void> {
    this.disconnectSocket();
  }

  async dispose(): Promise<void> {
    this.disconnectSocket();
    if (this._ownsContext) {
      await this._request.dispose();
    }
  }

  // =========================================================================
  // Private
  // =========================================================================

  private _collectCookies(res: APIResponse): void {
    const setCookieHeaders = res.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie");
    for (const header of setCookieHeaders) {
      const cookiePart = header.value.split(";")[0];
      const [name] = cookiePart.split("=");
      // Replace existing cookie with same name or append
      const existingCookies = this._cookies ? this._cookies.split("; ") : [];
      const filtered = existingCookies.filter((c) => !c.startsWith(`${name.trim()}=`));
      filtered.push(cookiePart.trim());
      this._cookies = filtered.join("; ");
    }
  }
}

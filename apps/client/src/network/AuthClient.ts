export interface AuthUser {
  id: number;
  username: string;
  isGuest?: boolean;
  character: {
    id: number;
    name: string;
    playerClass: string;
    x: number;
    y: number;
  } | null;
}

const BASE = "/api/auth";

async function request(
  path: string,
  opts?: RequestInit
): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    ...opts,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...opts?.headers,
    },
  });
}

export const AuthClient = {
  async register(
    username: string,
    password: string
  ): Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }> {
    const res = await request("/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error };
    return { ok: true, user: data };
  },

  async login(
    username: string,
    password: string
  ): Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }> {
    const res = await request("/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error };
    return { ok: true, user: data };
  },

  async logout(): Promise<void> {
    await request("/logout", { method: "POST" });
  },

  async guest(): Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }> {
    const res = await request("/guest", { method: "POST" });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error };
    return { ok: true, user: data };
  },

  async claim(
    username: string,
    password: string
  ): Promise<{ ok: true; user: { id: number; username: string; isGuest: boolean } } | { ok: false; error: string }> {
    const res = await request("/claim", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error };
    return { ok: true, user: data };
  },

  async me(): Promise<AuthUser | null> {
    const res = await request("/me");
    if (!res.ok) return null;
    return res.json();
  },
};

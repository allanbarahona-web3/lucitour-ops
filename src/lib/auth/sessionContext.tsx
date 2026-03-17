"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { currentUser as defaultUser, users as defaultUsers } from "./mockSession";
import { Role, type User } from "../types/ops";

const ACCESS_TOKEN_KEY = "opsAccessToken";
const REFRESH_TOKEN_KEY = "opsRefreshToken";

interface AuthenticatedApiUser {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
}

const getApiBaseUrl = (): string => {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!value) {
    throw new Error("Missing NEXT_PUBLIC_API_BASE_URL");
  }
  return value.replace(/\/$/, "");
};

const getOrgId = (): string => {
  return process.env.NEXT_PUBLIC_ORG_ID?.trim() || "lucitour";
};

const shouldBypassNgrokWarning = (apiBaseUrl: string): boolean => {
  return apiBaseUrl.includes(".ngrok-free.dev") || apiBaseUrl.includes(".ngrok-free.app");
};

const buildApiHeaders = (apiBaseUrl: string, init?: HeadersInit): Headers => {
  const headers = new Headers(init);
  if (shouldBypassNgrokWarning(apiBaseUrl)) {
    headers.set("ngrok-skip-browser-warning", "true");
  }
  return headers;
};

const roleFromApi = (roles: string[]): Role => {
  const priority: Role[] = [
    Role.ADMIN,
    Role.SUPERVISOR,
    Role.CONTRACTS,
    Role.ACCOUNTING,
    Role.QUOTES,
    Role.BILLING,
    Role.PURCHASES,
    Role.AGENT,
    Role.VIEWER,
  ];
  for (const role of priority) {
    if (roles.includes(role)) {
      return role;
    }
  }
  return Role.VIEWER;
};

const mapApiUserToAppUser = (input: AuthenticatedApiUser): User => {
  return {
    id: input.id,
    email: input.email,
    name: input.fullName,
    role: roleFromApi(input.roles),
  };
};

interface SessionContextValue {
  user: User;
  setUserById: (userId: string) => void;
  users: User[];
  updateUserRole: (userId: string, role: User["role"]) => void;
  addUser: (input: Omit<User, "id">) => User;
  removeUser: (userId: string) => void;
  isAuthenticated: boolean;
  isReady: boolean;
  login: (identifier: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface SessionProviderProps {
  children: ReactNode;
}

export const SessionProvider = ({ children }: SessionProviderProps) => {
  const [user, setUser] = useState<User>(defaultUser);
  const [users, setUsers] = useState<User[]>(defaultUsers);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const restoreSession = async () => {
      if (typeof window === "undefined") {
        setIsReady(true);
        return;
      }

      const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
      if (!accessToken) {
        setIsReady(true);
        return;
      }

      try {
        const apiBaseUrl = getApiBaseUrl();
        const response = await fetch(`${apiBaseUrl}/auth/me`, {
          method: "GET",
          headers: buildApiHeaders(apiBaseUrl, {
            Authorization: `Bearer ${accessToken}`,
            "x-org-id": getOrgId(),
          }),
        });

        if (!response.ok) {
          throw new Error("Session not valid");
        }

        const payload = (await response.json()) as AuthenticatedApiUser;
        const appUser = mapApiUserToAppUser(payload);
        setUser(appUser);
        setUsers((prev) => {
          const alreadyExists = prev.some((entry) => entry.id === appUser.id);
          return alreadyExists ? prev : [...prev, appUser];
        });
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      } finally {
        setIsReady(true);
      }
    };

    void restoreSession();
  }, []);

  const setUserById = (userId: string) => {
    const nextUser = users.find((entry) => entry.id === userId);
    if (nextUser) {
      setUser(nextUser);
    }
  };

  const updateUserRole = (userId: string, role: User["role"]) => {
    setUsers((prev) =>
      prev.map((entry) => (entry.id === userId ? { ...entry, role } : entry)),
    );
    if (user.id === userId) {
      setUser((prev) => ({ ...prev, role }));
    }
  };

  const addUser = (input: Omit<User, "id">) => {
    const created: User = {
      id: `ops_user_${Date.now()}`,
      ...input,
    };
    setUsers((prev) => [...prev, created]);
    return created;
  };

  const removeUser = (userId: string) => {
    setUsers((prev) => prev.filter((entry) => entry.id !== userId));
    if (user.id === userId) {
      setIsAuthenticated(false);
      setUser(defaultUser);
      if (typeof window !== "undefined") {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      }
    }
  };

  const login = async (identifier: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: "POST",
        headers: buildApiHeaders(apiBaseUrl, {
          "Content-Type": "application/json",
          "x-org-id": getOrgId(),
        }),
        body: JSON.stringify({ identifier, password }),
      });

      if (!response.ok) {
        return {
          ok: false,
          error: response.status === 401 ? "Credenciales invalidas." : "No se pudo iniciar sesion.",
        };
      }

      const payload = (await response.json()) as {
        accessToken: string;
        refreshToken: string;
        user: AuthenticatedApiUser;
      };

      const appUser = mapApiUserToAppUser(payload.user);
      setUser(appUser);
      setUsers((prev) => {
        const alreadyExists = prev.some((entry) => entry.id === appUser.id);
        return alreadyExists ? prev : [...prev, appUser];
      });
      setIsAuthenticated(true);

      if (typeof window !== "undefined") {
        localStorage.setItem(ACCESS_TOKEN_KEY, payload.accessToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken);
      }

      return { ok: true };
    } catch {
      return { ok: false, error: "Error de red al iniciar sesion." };
    }
  };

  const logout = () => {
    const accessToken =
      typeof window !== "undefined" ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;

    if (accessToken) {
      const apiBaseUrl = getApiBaseUrl();
      void fetch(`${apiBaseUrl}/auth/logout`, {
        method: "POST",
        headers: buildApiHeaders(apiBaseUrl, {
          Authorization: `Bearer ${accessToken}`,
          "x-org-id": getOrgId(),
        }),
      }).catch(() => undefined);
    }

    setIsAuthenticated(false);
    setUser(defaultUser);
    if (typeof window !== "undefined") {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  };

  const value = useMemo(
    () => ({
      user,
      setUserById,
      users,
      updateUserRole,
      addUser,
      removeUser,
      isAuthenticated,
      isReady,
      login,
      logout,
    }),
    [user, users, isAuthenticated, isReady],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return context;
};

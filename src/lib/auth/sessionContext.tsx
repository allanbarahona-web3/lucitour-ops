"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { currentUser as defaultUser, users as defaultUsers } from "./mockSession";
import type { User } from "../types/ops";

interface SessionContextValue {
  user: User;
  setUserById: (userId: string) => void;
  users: User[];
  updateUserRole: (userId: string, role: User["role"]) => void;
  addUser: (input: Omit<User, "id">) => User;
  removeUser: (userId: string) => void;
  isAuthenticated: boolean;
  isReady: boolean;
  login: (userId: string) => boolean;
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
    const storedUserId = typeof window !== "undefined" ? localStorage.getItem("opsUserId") : null;
    if (storedUserId) {
      const nextUser = defaultUsers.find((entry) => entry.id === storedUserId);
      if (nextUser) {
        setUser(nextUser);
        setIsAuthenticated(true);
      }
    }
    setIsReady(true);
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
        localStorage.removeItem("opsUserId");
      }
    }
  };

  const login = (userId: string) => {
    const nextUser = users.find((entry) => entry.id === userId);
    if (!nextUser) {
      return false;
    }
    setUser(nextUser);
    setIsAuthenticated(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("opsUserId", nextUser.id);
    }
    return true;
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(defaultUser);
    if (typeof window !== "undefined") {
      localStorage.removeItem("opsUserId");
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

"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { currentUser as defaultUser, users as defaultUsers } from "./mockSession";
import type { User } from "../types/ops";

interface SessionContextValue {
  user: User;
  setUserById: (userId: string) => void;
  users: User[];
  updateUserRole: (userId: string, role: User["role"]) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface SessionProviderProps {
  children: ReactNode;
}

export const SessionProvider = ({ children }: SessionProviderProps) => {
  const [user, setUser] = useState<User>(defaultUser);
  const [users, setUsers] = useState<User[]>(defaultUsers);

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

  const value = useMemo(
    () => ({ user, setUserById, users, updateUserRole }),
    [user, users],
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

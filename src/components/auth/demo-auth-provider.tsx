"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  demoSessionStorageKey,
  parseDemoSession,
  type DemoSession,
} from "@/lib/demo-auth";

type DemoAuthContextValue = {
  hydrated: boolean;
  session: DemoSession | null;
  login: (session: DemoSession) => void;
  logout: () => void;
};

const DemoAuthContext = createContext<DemoAuthContextValue | null>(null);

export function DemoAuthProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [session, setSession] = useState<DemoSession | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSession(
        parseDemoSession(window.localStorage.getItem(demoSessionStorageKey)),
      );
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const login = useCallback((nextSession: DemoSession) => {
    window.localStorage.setItem(
      demoSessionStorageKey,
      JSON.stringify(nextSession),
    );
    setSession(nextSession);
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(demoSessionStorageKey);
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ hydrated, session, login, logout }),
    [hydrated, login, logout, session],
  );

  return (
    <DemoAuthContext.Provider value={value}>
      {children}
    </DemoAuthContext.Provider>
  );
}

export function useDemoAuth() {
  const context = useContext(DemoAuthContext);
  if (!context) {
    throw new Error("useDemoAuth must be used inside DemoAuthProvider");
  }
  return context;
}

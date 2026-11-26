"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [csrfToken, setCsrfToken] = useState("");
  const [status, setStatus] = useState("loading");

  async function refresh() {
    try {
      const current = await apiRequest("/auth/me");
      const csrf = await apiRequest("/auth/csrf");
      setUser(current);
      setCsrfToken(csrf.csrf_token);
      setStatus("authenticated");
      return current;
    } catch (problem) {
      if (problem.status === 401) {
        setUser(null);
        setCsrfToken("");
        setStatus("unauthenticated");
        return null;
      }
      setUser(null);
      setCsrfToken("");
      setStatus("error");
      throw problem;
    }
  }

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => apiRequest("/auth/me"))
      .then(async (current) => {
        const csrf = await apiRequest("/auth/csrf");
        if (active) {
          setUser(current);
          setCsrfToken(csrf.csrf_token);
          setStatus("authenticated");
        }
      })
      .catch((problem) => {
        if (!active) return;
        setUser(null);
        setCsrfToken("");
        setStatus(problem.status === 401 ? "unauthenticated" : "error");
      });
    return () => { active = false; };
  }, []);

  async function logout() {
    await apiRequest("/auth/logout", { method: "POST", csrfToken });
    setUser(null);
    setCsrfToken("");
    setStatus("unauthenticated");
  }

  const value = useMemo(() => ({ user, csrfToken, status, refresh, logout }), [user, csrfToken, status]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

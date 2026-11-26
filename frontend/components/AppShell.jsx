"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { apiRequest, getErrorMessage } from "@/lib/api";
import { preferredWard, rememberWard } from "@/lib/workspace.mjs";
import { ErrorState, Skeleton } from "@/components/ui";
import { ShellFrame } from "@/components/shell/ShellFrame";
import { WorkspaceContext } from "@/components/shell/WorkspaceContext";
import "@/styles/shell.css";

export function AppShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, csrfToken, status, logout, refresh } = useAuth();
  const [logoutError, setLogoutError] = useState("");
  const [count, setCount] = useState(null);
  const [wards, setWards] = useState([]);
  const [wardId, setWardId] = useState("");
  const [wardsLoading, setWardsLoading] = useState(true);
  const [wardsError, setWardsError] = useState("");
  const [pendingLoading, setPendingLoading] = useState(true);
  const [pendingError, setPendingError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [lastSync, setLastSync] = useState(null);
  const [offline, setOffline] = useState(false);
  const [search, setSearch] = useState("");
  useEffect(() => { const update = () => setSearch(window.location.search); update(); window.addEventListener("popstate", update); return () => window.removeEventListener("popstate", update); }, [pathname]);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine); update();
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    const load = () => {
      setPendingLoading(true);
      return apiRequest("/entries/pending-count").then(data => { if (active) { setCount(data.count); setPendingError(false); setLastSync(new Date()); } })
        .catch(() => { if (active) { setCount(null); setPendingError(true); } }).finally(() => { if (active) setPendingLoading(false); });
    };
    load(); window.addEventListener("inpatient-entries-changed", load);
    return () => { active = false; window.removeEventListener("inpatient-entries-changed", load); };
  }, [status, retry]);
  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true; setWardsLoading(true); setWardsError("");
    apiRequest("/wards").then(items => {
      if (!active) return;
      const linkedWard = new URLSearchParams(window.location.search).get("ward");
      setWards(items); setWardId(old => items.some(item => item.id === old) ? old : items.find(item => item.id === linkedWard)?.id || preferredWard(items) || items[0]?.id || ""); setLastSync(new Date());
    }).catch(error => { if (active) setWardsError(getErrorMessage(error, "โหลดรายชื่อหอผู้ป่วยไม่สำเร็จ")); }).finally(() => { if (active) setWardsLoading(false); });
    return () => { active = false; };
  }, [status, retry]);
  useEffect(() => { if (status === "unauthenticated") router.replace("/login"); }, [status, router]);
  if (status === "loading") return <main className="center-state"><Skeleton label="กำลังตรวจสอบบัญชีผู้ใช้" /></main>;
  if (status === "error") return <main className="center-state"><ErrorState title="เชื่อมต่อระบบไม่ได้" onRetry={() => refresh().catch(() => {})} /></main>;
  if (!user) return <main className="center-state">กำลังไปหน้าเข้าสู่ระบบ…</main>;
  async function signOut() {
    setLogoutError("");
    try { await logout(); router.replace("/login"); } catch (error) { setLogoutError(getErrorMessage(error)); }
  }
  const selectWard = id => { if (wards.some(ward => ward.id === id)) { setWardId(id); rememberWard(id); } };
  const connection = offline || wardsError || pendingError ? "offline" : wardsLoading || pendingLoading ? "syncing" : "online";
  const workspace = { wards, selectedWardId: wardId, ward: wards.find(ward => ward.id === wardId), wardsLoading, wardsError, retry: () => setRetry(value => value + 1) };
  return <WorkspaceContext.Provider value={workspace}><ShellFrame {...{ user, csrfToken, pathname, search, count, wards, wardsLoading, connection, lastSync, logoutError }} selectedWardId={wardId} onWardChange={selectWard} onRetry={workspace.retry} onLogout={signOut}>{children}</ShellFrame></WorkspaceContext.Provider>;
}

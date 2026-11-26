"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button, Dialog, Drawer, Icon, InfoCallout, Select, TextInput } from "@/components/ui";
import { PasswordChecklist } from "@/components/PasswordChecklist";
import { apiRequest, getErrorMessage } from "@/lib/api";
import { evaluatePasswordPolicy } from "@/lib/password-policy.mjs";
import { satisfactionLink } from "@/lib/satisfaction.mjs";
import { formatThaiDate, formatThaiTime, todayISO } from "@/lib/thai-date.mjs";
import { navigation, pageContext } from "@/lib/workspace.mjs";

function PendingBadge({ count }) {
  return count > 0 ? <span className="shell-count" aria-label={`${count} รายการรอยืนยัน`}>{count > 99 ? "99+" : count}</span> : null;
}
function UserMenu({ user, ward, onLogout, onProfile, onPassword, placement }) {
  const ref = useRef(null);
  const fullName = user?.full_name?.trim() || "";
  const displayName = fullName || user.username;
  useEffect(() => {
    const close = event => { if (event.key === "Escape" || (event.type === "pointerdown" && !ref.current?.contains(event.target))) { if (event.key === "Escape" && ref.current?.open) ref.current.querySelector("summary")?.focus(); if (ref.current) ref.current.open = false; } };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, []);
  return <details className={`shell-user shell-user--${placement}`} ref={ref}><summary aria-label={`เมนูผู้ใช้ ${fullName ? `${fullName} (${user.username})` : user.username}`}><span className="shell-avatar" aria-hidden="true">{(displayName || "U").slice(0, 1).toUpperCase()}</span><span className="shell-user-meta"><strong>{displayName}</strong><small>{fullName ? `${user.username} · ` : ""}{user.is_admin ? "ผู้ดูแลระบบ" : "ผู้ใช้งานตามสิทธิ์ที่ได้รับ"}</small><small>{ward?.name || "ยังไม่เลือกหอผู้ป่วย"}</small></span><Icon name="chevron" /></summary><div className="shell-user-menu"><Button variant="ghost" icon="user" onClick={() => { ref.current.open = false; onProfile(); }}>โปรไฟล์</Button><Button variant="ghost" icon="key" onClick={() => { ref.current.open = false; onPassword(); }}>เปลี่ยนรหัสผ่าน</Button><Button variant="ghost" icon="logout" data-confirm-leave onClick={() => { ref.current.open = false; onLogout(); }}>ออกจากระบบ</Button></div></details>;
}
function NavigationLinks({ current, count, isAdmin, satisfactionHref, onNavigate }) {
  const visible = navigation.filter(item => !item.adminOnly || isAdmin);
  const groups = ["งานประจำวัน", "ข้อมูลและรายงาน", "การจัดการระบบ"];
  return <>{groups.map(group => {
    const items = visible.filter(item => item.group === group);
    if (!items.length) return null;
    return <div className="shell-nav-group" key={group}><p className="shell-nav-label">{group}</p>{items.map(item => <a href={item.href} key={item.href} className={`shell-link ${current.href === item.href ? "is-active" : ""}`} aria-current={current.href === item.href ? "page" : undefined} onClick={onNavigate}><span className="shell-link-icon"><Icon name={item.icon} />{item.pending && <PendingBadge count={count} />}</span><span className="shell-link-full">{item.label}</span><span className="shell-link-short">{item.short}</span></a>)}{group === "งานประจำวัน" && satisfactionHref && <a href={satisfactionHref} target="_blank" rel="noreferrer" className="shell-link" onClick={onNavigate}><span className="shell-link-icon"><Icon name="activity" /></span><span className="shell-link-full">อัตราความพึงพอใจ</span><span className="shell-link-short">ความพึงพอใจ</span></a>}</div>;
  })}</>;
}
export function ShellFrame({ children, user, csrfToken = "", pathname = "/", search = "", count, wards = [], selectedWardId = "", onWardChange, wardsLoading, connection = "online", lastSync, onRetry, logoutError, onLogout }) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [profile, setProfile] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [connectionOpen, setConnectionOpen] = useState(false);
  const current = pageContext(pathname, search);
  const ward = wards.find(item => item.id === selectedWardId);
  const isAdmin = Boolean(user?.is_admin);
  const fullName = user?.full_name?.trim() || "";
  const satisfactionHref = satisfactionLink(process.env.NEXT_PUBLIC_SATISFACTION_URL, ward?.legacy_code, Boolean(ward?.can_write));
  useEffect(() => { try { setCollapsed(localStorage.getItem("inpatient-sidebar-collapsed") === "true"); } catch { /* Optional preference. */ } }, []);
  useEffect(() => { const media = window.matchMedia("(min-width: 768px)"); const close = () => { if (media.matches) setDrawer(false); }; media.addEventListener("change", close); return () => media.removeEventListener("change", close); }, []);
  useEffect(() => { setDrawer(false); }, [pathname, search]);
  function toggleRail() { setCollapsed(value => { const next = !value; try { localStorage.setItem("inpatient-sidebar-collapsed", String(next)); } catch { /* Optional preference. */ } return next; }); }
  const statusText = { online: "ออนไลน์", syncing: "กำลังซิงก์", offline: "ขาดการเชื่อมต่อ" }[connection];
  const openProfile = () => setProfile(true);
  function openPasswordDialog() {
    setProfile(false);
    setDrawer(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setPasswordSuccess("");
    setPasswordOpen(true);
  }
  async function submitPasswordChange(event) {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    if (!currentPassword) { setPasswordError("กรุณากรอกรหัสผ่านเดิม"); return; }
    if (!evaluatePasswordPolicy(newPassword).valid) {
      setPasswordError("รหัสผ่านใหม่ไม่ตรงตามเงื่อนไข ต้องมีอย่างน้อย 8 ตัวอักษร ตัวพิมพ์ใหญ่ (A–Z) อย่างน้อย 1 ตัว และอักษรพิเศษอย่างน้อย 1 ตัว");
      return;
    }
    if (newPassword !== confirmPassword) { setPasswordError("รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน"); return; }
    setPasswordSaving(true);
    try {
      await apiRequest("/auth/change-password", {
        method: "POST",
        csrfToken,
        body: { current_password: currentPassword, new_password: newPassword },
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว อุปกรณ์อื่นที่เข้าสู่ระบบค้างไว้จะถูกออกจากระบบอัตโนมัติ");
    } catch (error) {
      setPasswordError(getErrorMessage(error, "เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองใหม่"));
    } finally {
      setPasswordSaving(false);
    }
  }
  return <div className={`shell-frame ${collapsed ? "shell-frame--collapsed" : ""}`}><a className="ui-skip-link" href="#main-content">ข้ามไปเนื้อหาหลัก</a>
    <aside className="shell-sidebar" aria-label="แถบนำทาง"><a className="shell-brand" href="/" aria-label="ระบบรายงานจำนวนผู้ป่วยใน หน้าแรก"><span className="shell-brand-mark"><Image src="/brand/moph-seal.png" width={175} height={175} alt="" aria-hidden="true" unoptimized /></span><span className="shell-brand-text"><strong>ข้อมูลผู้ป่วยใน</strong><small>ระบบรายงานหอผู้ป่วย</small></span></a><nav className="shell-nav" aria-label="เมนูหลัก"><NavigationLinks {...{ current, count, isAdmin, satisfactionHref }} /></nav><div className="shell-sidebar-footer"><Button className="shell-collapse" variant="ghost" icon="panel" onClick={toggleRail} aria-expanded={!collapsed} aria-label={collapsed ? "ขยายแถบเมนู" : "ย่อแถบเมนู"}><span>{collapsed ? "ขยาย" : "ย่อแถบเมนู"}</span></Button><UserMenu {...{ user, ward, onLogout }} onProfile={openProfile} onPassword={openPasswordDialog} placement="sidebar" /></div></aside>
    <div className="shell-main"><header className="shell-header"><div className="shell-heading"><span className="shell-header-icon"><Icon name={current.icon} /></span><div>{current.href !== "/" && <nav className="shell-breadcrumb" aria-label="เส้นทางหน้าปัจจุบัน"><a href="/">หน้าแรก</a><span aria-hidden="true">/</span><span>{current.label}</span></nav>}<p className="shell-page-title">{current.label}</p><p className="shell-date">{formatThaiDate(todayISO(), { month: "long" })}</p></div></div><div className="shell-header-tools"><div className="shell-ward"><Select label="หอผู้ป่วยปัจจุบัน" value={selectedWardId} onChange={event => onWardChange(event.target.value)} disabled={wardsLoading || wards.length < 2} placeholder={wards.length ? undefined : wardsLoading ? "กำลังโหลดหอผู้ป่วย…" : "ยังไม่มีหอผู้ป่วยที่ได้รับสิทธิ์"} options={wards.map(item => ({ value: item.id, label: item.name }))} /></div><div className="shell-connection-wrap"><button type="button" className={`shell-connection shell-connection--${connection}`} onClick={() => setConnectionOpen(true)} aria-label={`${statusText} ดูรายละเอียดการเชื่อมต่อ`}><Icon name={connection === "online" ? "check" : connection === "syncing" ? "refresh" : "warning"} /><span>{statusText}</span></button>{connection === "offline" && <Button variant="ghost" icon="refresh" onClick={onRetry}><span className="shell-retry-text">ลองใหม่</span></Button>}</div><div className="shell-header-user"><UserMenu {...{ user, ward, onLogout }} onProfile={openProfile} onPassword={openPasswordDialog} placement="header" /></div></div></header><main id="main-content" className="shell-content" tabIndex={-1}>{logoutError && <div className="ui-callout ui-tone--danger" role="alert"><Icon name="error" />{logoutError}</div>}{children}</main></div>
    <nav className="shell-mobile-nav" aria-label="เมนูหลักบนมือถือ">{[navigation[0], navigation[1], navigation[3], navigation[5]].map(item => <a href={item.href} key={item.href} className={`shell-mobile-link ${current.href === item.href ? "is-active" : ""}`} aria-current={current.href === item.href ? "page" : undefined}><span><Icon name={item.icon} />{item.pending && <PendingBadge count={count} />}</span>{item.short}</a>)}<button type="button" className={`shell-mobile-link ${["/history", "/indicators", "/occupancy", "/users"].includes(current.href) ? "is-active" : ""}`} aria-expanded={drawer} aria-haspopup="dialog" onClick={() => setDrawer(true)}><Icon name="more" />เมนู</button></nav>
    <Drawer open={drawer} onClose={() => setDrawer(false)} title="เมนูทั้งหมด"><div className="shell-drawer-brand"><span className="shell-brand-mark"><Image src="/brand/moph-seal.png" width={175} height={175} alt="" aria-hidden="true" unoptimized /></span><strong>โรงพยาบาลอากาศอำนวย</strong></div><nav className="shell-drawer-nav" aria-label="เมนูทั้งหมด"><NavigationLinks {...{ current, count, isAdmin, satisfactionHref }} onNavigate={() => setDrawer(false)} /></nav><div className="shell-drawer-user"><strong>{fullName || user.username}</strong>{fullName && <p>{user.username}</p>}<p>{user.is_admin ? "ผู้ดูแลระบบ" : "ผู้ใช้งานตามสิทธิ์ที่ได้รับ"}</p><Button variant="secondary" icon="user" onClick={() => { setDrawer(false); setProfile(true); }}>โปรไฟล์</Button><Button variant="secondary" icon="key" onClick={openPasswordDialog}>เปลี่ยนรหัสผ่าน</Button><Button variant="ghost" icon="logout" data-confirm-leave onClick={() => { setDrawer(false); onLogout(); }}>ออกจากระบบ</Button></div></Drawer>
    <Dialog open={profile} onClose={() => setProfile(false)} title="โปรไฟล์" description="ข้อมูลบัญชีที่กำลังใช้งาน" actions={<Button variant="secondary" icon="key" onClick={openPasswordDialog}>เปลี่ยนรหัสผ่าน</Button>}><dl className="shell-profile"><div><dt>ชื่อ-นามสกุล</dt><dd>{fullName || user.username}</dd></div><div><dt>ชื่อบัญชี</dt><dd>{user.username}</dd></div><div><dt>สิทธิ์</dt><dd>{user.is_admin ? "ผู้ดูแลระบบ" : "สิทธิ์ตามหอผู้ป่วยที่ได้รับมอบหมาย"}</dd></div><div><dt>หอผู้ป่วยปัจจุบัน</dt><dd>{ward?.name || "ยังไม่ได้เลือก"}</dd></div></dl></Dialog>
    <Dialog open={passwordOpen} onClose={() => setPasswordOpen(false)} title="เปลี่ยนรหัสผ่าน" description={`ตั้งรหัสผ่านใหม่สำหรับบัญชี ${user.username}`} busy={passwordSaving} actions={<><Button variant="secondary" disabled={passwordSaving} onClick={() => setPasswordOpen(false)}>ปิด</Button><Button type="submit" form="shell-change-password-form" loading={passwordSaving} icon="save">บันทึกรหัสผ่านใหม่</Button></>}>
      <form id="shell-change-password-form" className="shell-password-form" onSubmit={submitPasswordChange}>
        <TextInput label="รหัสผ่านเดิม" type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required />
        <TextInput label="รหัสผ่านใหม่" type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} required aria-describedby="shell-pw-rules" />
        <PasswordChecklist id="shell-pw-rules" password={newPassword} />
        <TextInput label="ยืนยันรหัสผ่านใหม่" type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required error={confirmPassword && confirmPassword !== newPassword ? "รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน" : undefined} />
        {passwordError && <InfoCallout tone="danger" title="เปลี่ยนรหัสผ่านไม่สำเร็จ">{passwordError}</InfoCallout>}
        {passwordSuccess && <InfoCallout tone="success" title="สำเร็จ">{passwordSuccess}</InfoCallout>}
      </form>
    </Dialog>
    <Dialog open={connectionOpen} onClose={() => setConnectionOpen(false)} title="สถานะการเชื่อมต่อ"><p>{statusText}</p><p>ตรวจสอบล่าสุด {lastSync ? formatThaiTime(lastSync) : "ยังไม่มีการเชื่อมต่อสำเร็จ"}</p><p className="ui-field-hint">อ้างอิงการโหลดรายชื่อหอผู้ป่วยและจำนวนรายการรอยืนยัน ไม่ใช่เวลาที่ข้อมูลทุกส่วนถูกปรับปรุง</p><Button variant="secondary" icon="refresh" onClick={() => { setConnectionOpen(false); onRetry(); }}>ลองเชื่อมต่อใหม่</Button></Dialog>
  </div>;
}

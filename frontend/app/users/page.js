"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { PasswordChecklist } from "@/components/PasswordChecklist";
import {
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  Icon,
  InfoCallout,
  PageHeader,
  PasswordInput,
  Select,
  StatusBadge,
  TextInput,
  Toast,
} from "@/components/ui";
import { apiRequest, getErrorMessage } from "@/lib/api";
import {
  GLOBAL_ROLE_OPTIONS,
  ROLE_GUIDE,
  ROLE_LABELS,
  WARD_ROLE_OPTIONS,
  evaluatePasswordPolicy,
  summarizeUserRoles,
} from "@/lib/password-policy.mjs";
import { formatThaiDate, todayISO } from "@/lib/thai-date.mjs";
import "@/styles/users.css";

function WardRoleEditor({ wards, value, onChange, disabled = false }) {
  const [selectedWardId, setSelectedWardId] = useState("");
  const [selectedRole, setSelectedRole] = useState("ward_recorder");
  const wardMap = useMemo(() => new Map(wards.map(item => [item.id, item])), [wards]);
  const assignedWardIds = useMemo(() => new Set(value.map(item => item.ward_id)), [value]);
  const availableWards = useMemo(
    () => wards.filter(item => !assignedWardIds.has(item.id)),
    [wards, assignedWardIds],
  );

  function addAssignment() {
    if (!selectedWardId) return;
    onChange([...value, { ward_id: selectedWardId, role_code: selectedRole }]);
    setSelectedWardId("");
  }

  function removeAssignment(wardId, roleCode) {
    onChange(value.filter(item => !(item.ward_id === wardId && item.role_code === roleCode)));
  }

  return (
    <div className="users-ward-assign">
      <h3>สิทธิ์รายหอผู้ป่วย</h3>
      {disabled ? (
        <InfoCallout tone="info">
          บทบาทผู้ดูแลระบบสามารถเข้าถึงและจัดการข้อมูลได้ทุกหอผู้ป่วยโดยอัตโนมัติ ไม่จำเป็นต้องกำหนดหอผู้ป่วยเพิ่ม
        </InfoCallout>
      ) : (
        <>
          <div className="users-ward-picker">
            <Select
              label="เลือกหอผู้ป่วย"
              value={selectedWardId}
              onChange={event => setSelectedWardId(event.target.value)}
              placeholder={availableWards.length ? "เลือกหอผู้ป่วย" : "เลือกครบทุกหอผู้ป่วยแล้ว"}
              disabled={!availableWards.length}
              options={availableWards.map(item => ({ value: item.id, label: item.name }))}
            />
            <Select
              label="บทบาทในหอผู้ป่วย"
              value={selectedRole}
              onChange={event => setSelectedRole(event.target.value)}
              options={WARD_ROLE_OPTIONS}
            />
            <Button variant="secondary" icon="plus" onClick={addAssignment} disabled={!selectedWardId}>
              เพิ่มหอผู้ป่วย
            </Button>
          </div>
          {value.length > 0 ? (
            <ul className="users-assigned-list" aria-label="รายการสิทธิ์รายหอผู้ป่วยที่เลือก">
              {value.map(item => (
                <li key={`${item.ward_id}:${item.role_code}`} className="users-assigned-item">
                  <span>
                    <strong>{wardMap.get(item.ward_id)?.name || "หอผู้ป่วยไม่ทราบชื่อ"}</strong>
                    <small>{ROLE_LABELS[item.role_code] || item.role_code}</small>
                  </span>
                  <Button
                    variant="ghost"
                    icon="close"
                    aria-label={`ลบสิทธิ์ ${wardMap.get(item.ward_id)?.name || "หอผู้ป่วย"}`}
                    onClick={() => removeAssignment(item.ward_id, item.role_code)}
                  >
                    ลบ
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ui-muted">ยังไม่ได้เลือกหอผู้ป่วย หากต้องการให้บันทึกหรือดูรายงาน กรุณาเลือกอย่างน้อย 1 หอผู้ป่วย</p>
          )}
        </>
      )}
    </div>
  );
}

function UsersContent() {
  const { user, csrfToken, refresh } = useAuth();
  const { wards } = useWorkspace();
  const wardMap = useMemo(() => new Map(wards.map(item => [item.id, item])), [wards]);

  const [users, setUsers] = useState([]);
  const [tableState, setTableState] = useState("loading");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [toast, setToast] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createUsername, setCreateUsername] = useState("");
  const [createFullName, setCreateFullName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createConfirm, setCreateConfirm] = useState("");
  const [createGlobalRole, setCreateGlobalRole] = useState("");
  const [createWardRoles, setCreateWardRoles] = useState([]);
  const [createError, setCreateError] = useState("");
  const [createSaving, setCreateSaving] = useState(false);

  const [editTarget, setEditTarget] = useState(null);
  const [editFullName, setEditFullName] = useState("");
  const [editGlobalRole, setEditGlobalRole] = useState("");
  const [editWardRoles, setEditWardRoles] = useState([]);
  const [editActive, setEditActive] = useState("true");
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSaving, setResetSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    if (!user?.is_admin) return;
    setTableState("loading");
    try {
      const items = await apiRequest("/admin/users");
      setUsers(items);
      setTableState(items.length ? "ready" : "empty");
    } catch {
      setTableState("error");
    }
  }, [user?.is_admin]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const hasActiveFilter = Boolean(search.trim() || statusFilter || roleFilter);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return users.filter(item => {
      if (statusFilter === "active" && !item.is_active) return false;
      if (statusFilter === "inactive" && item.is_active) return false;
      if (roleFilter === "system_admin" && item.global_role !== "system_admin") return false;
      if (roleFilter === "auditor" && item.global_role !== "auditor") return false;
      if (roleFilter === "ward_recorder" && !(item.ward_roles || []).some(role => role.role_code === "ward_recorder")) return false;
      if (roleFilter === "report_reader" && !(item.ward_roles || []).some(role => role.role_code === "report_reader")) return false;
      if (!keyword) return true;
      const summary = summarizeUserRoles(item, wardMap);
      return (
        item.username.toLowerCase().includes(keyword) ||
        (item.full_name || "").toLowerCase().includes(keyword) ||
        summary.globalLabel.toLowerCase().includes(keyword) ||
        summary.wardSummary.toLowerCase().includes(keyword)
      );
    });
  }, [users, search, statusFilter, roleFilter, wardMap]);

  function openCreateDialog() {
    setCreateUsername("");
    setCreateFullName("");
    setCreatePassword("");
    setCreateConfirm("");
    setCreateGlobalRole("");
    setCreateWardRoles([]);
    setCreateError("");
    setCreateOpen(true);
  }

  async function submitCreate(event) {
    event.preventDefault();
    setCreateError("");
    const trimmed = createUsername.trim();
    if (trimmed.length < 3 || trimmed.length > 80) {
      setCreateError("ชื่อบัญชีต้องมีความยาว 3 ถึง 80 ตัวอักษร");
      return;
    }
    if (!evaluatePasswordPolicy(createPassword).valid) {
      setCreateError("รหัสผ่านไม่ตรงตามเงื่อนไข ต้องมีอย่างน้อย 8 ตัวอักษร ตัวพิมพ์ใหญ่ (A–Z) อย่างน้อย 1 ตัว และอักษรพิเศษอย่างน้อย 1 ตัว");
      return;
    }
    if (createPassword !== createConfirm) {
      setCreateError("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }
    setCreateSaving(true);
    try {
      await apiRequest("/admin/users", {
        method: "POST",
        csrfToken,
        body: {
          username: trimmed,
          full_name: createFullName.trim() || null,
          password: createPassword,
          global_role: createGlobalRole || null,
          ward_roles: createGlobalRole === "system_admin" ? [] : createWardRoles,
        },
      });
      setCreateOpen(false);
      setToast({ tone: "success", title: "สร้างบัญชีผู้ใช้สำเร็จ", description: `เพิ่มบัญชี ${trimmed} เรียบร้อยแล้ว` });
      await loadUsers();
    } catch (error) {
      setCreateError(getErrorMessage(error, "สร้างบัญชีผู้ใช้ไม่สำเร็จ กรุณาลองใหม่"));
    } finally {
      setCreateSaving(false);
    }
  }

  function openEditDialog(row) {
    setEditTarget(row);
    setEditFullName(row.full_name || "");
    setEditGlobalRole(row.global_role || "");
    setEditWardRoles(row.ward_roles || []);
    setEditActive(row.is_active ? "true" : "false");
    setEditError("");
  }

  async function submitEdit(event) {
    event.preventDefault();
    if (!editTarget) return;
    setEditError("");
    setEditSaving(true);
    try {
      await apiRequest(`/admin/users/${editTarget.id}`, {
        method: "PATCH",
        csrfToken,
        body: {
          full_name: editFullName.trim() || null,
          global_role: editGlobalRole || null,
          ward_roles: editGlobalRole === "system_admin" ? [] : editWardRoles,
          is_active: editActive === "true",
        },
      });
      const updatedName = editTarget.username;
      const editedSelf = editTarget.id === user.id;
      setEditTarget(null);
      setToast({ tone: "success", title: "บันทึกข้อมูลและสิทธิ์สำเร็จ", description: `อัปเดตบัญชี ${updatedName} เรียบร้อยแล้ว` });
      await loadUsers();
      if (editedSelf) await refresh().catch(() => {});
    } catch (error) {
      setEditError(getErrorMessage(error, "บันทึกข้อมูลและสิทธิ์ไม่สำเร็จ กรุณาลองใหม่"));
    } finally {
      setEditSaving(false);
    }
  }

  function openResetDialog(row) {
    setResetTarget(row);
    setResetPassword("");
    setResetConfirm("");
    setResetError("");
  }

  async function submitReset(event) {
    event.preventDefault();
    if (!resetTarget) return;
    setResetError("");
    if (!evaluatePasswordPolicy(resetPassword).valid) {
      setResetError("รหัสผ่านใหม่ไม่ตรงตามเงื่อนไข ต้องมีอย่างน้อย 8 ตัวอักษร ตัวพิมพ์ใหญ่ (A–Z) อย่างน้อย 1 ตัว และอักษรพิเศษอย่างน้อย 1 ตัว");
      return;
    }
    if (resetPassword !== resetConfirm) {
      setResetError("รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }
    setResetSaving(true);
    try {
      await apiRequest(`/admin/users/${resetTarget.id}/password`, {
        method: "POST",
        csrfToken,
        body: { new_password: resetPassword },
      });
      const targetName = resetTarget.username;
      setResetTarget(null);
      setToast({ tone: "success", title: "ตั้งรหัสผ่านใหม่สำเร็จ", description: `เปลี่ยนรหัสผ่านของบัญชี ${targetName} เรียบร้อยแล้ว` });
    } catch (error) {
      setResetError(getErrorMessage(error, "ตั้งรหัสผ่านใหม่ไม่สำเร็จ กรุณาลองใหม่"));
    } finally {
      setResetSaving(false);
    }
  }

  if (!user?.is_admin) {
    return (
      <div className="users-page">
        <PageHeader
          title="จัดการผู้ใช้และสิทธิ์"
          description="จัดการบัญชีผู้ใช้งาน บทบาท และสิทธิ์เข้าถึงแต่ละหอผู้ป่วย"
        />
        <Card>
          <EmptyState
            icon="lock"
            title="หน้านี้สำหรับผู้ดูแลระบบเท่านั้น"
            description="บัญชีของคุณไม่มีสิทธิ์จัดการผู้ใช้งาน กรุณาติดต่อผู้ดูแลระบบหากต้องการขอปรับสิทธิ์หรือตั้งรหัสผ่านใหม่"
            action={<Link className="ui-button ui-button--secondary" href="/">กลับหน้าแรก</Link>}
          />
        </Card>
      </div>
    );
  }

  const columns = [
    {
      key: "username",
      label: "ชื่อบัญชี",
      sortable: true,
      render: (value, row) => (
        <div className="users-name-cell">
          <strong>{value}</strong>
          {row.id === user.id && <span className="ui-badge ui-tone--info">บัญชีปัจจุบัน</span>}
        </div>
      ),
    },
    {
      key: "full_name",
      label: "ชื่อ-นามสกุล",
      sortable: true,
      render: value => value || <span className="ui-muted">—</span>,
    },
    {
      key: "global_role",
      label: "บทบาทระดับระบบ",
      render: (_value, row) => summarizeUserRoles(row, wardMap).globalLabel,
    },
    {
      key: "ward_roles",
      label: "สิทธิ์รายหอผู้ป่วย",
      render: (_value, row) => {
        const summary = summarizeUserRoles(row, wardMap);
        if (row.global_role === "system_admin") {
          return <span className="ui-muted">{summary.wardSummary}</span>;
        }
        if (!summary.wardItems.length) {
          return <span className="ui-muted">{summary.wardSummary}</span>;
        }
        return (
          <ul className="users-ward-list">
            {summary.wardItems.map(item => (
              <li key={item.key} className="users-ward-pill" title={item.wardShortName ? `${item.wardName} (${item.wardShortName})` : item.wardName}>
                <span>{item.wardName}</span>
                <small>({item.roleLabel})</small>
              </li>
            ))}
          </ul>
        );
      },
    },
    {
      key: "is_active",
      label: "สถานะบัญชี",
      render: value => (
        <StatusBadge status={value ? "confirmed" : "readonly"} label={value ? "ใช้งานอยู่" : "ปิดใช้งาน"} />
      ),
    },
    {
      key: "created_at",
      label: "วันที่สร้าง",
      render: value => {
        if (!value) return "—";
        const parsed = new Date(value);
        return Number.isFinite(parsed.getTime()) ? formatThaiDate(todayISO(parsed)) : "—";
      },
    },
    {
      key: "actions",
      label: "การจัดการ",
      render: (_value, row) => (
        <div className="users-row-actions">
          <Button variant="secondary" icon="edit" onClick={() => openEditDialog(row)}>
            แก้ไขสิทธิ์
          </Button>
          <Button variant="ghost" icon="key" onClick={() => openResetDialog(row)}>
            ตั้งรหัสผ่านใหม่
          </Button>
        </div>
      ),
    },
  ];

  const isEditingSelf = Boolean(editTarget && editTarget.id === user.id);

  return (
    <div className="users-page">
      <PageHeader
        title="จัดการผู้ใช้และสิทธิ์"
        description="สร้างบัญชีผู้ใช้ กำหนดบทบาทและหอผู้ป่วย และตั้งรหัสผ่านตามเงื่อนไขความปลอดภัย"
        actions={
          <Button icon="plus" onClick={openCreateDialog}>
            เพิ่มผู้ใช้ใหม่
          </Button>
        }
      />

      <details className="ui-card users-role-details">
        <summary className="users-role-summary">
          <div>
            <h2>ดูคำอธิบายบทบาทและขอบเขตสิทธิ์</h2>
            <p className="ui-muted">บทบาทและขอบเขตสิทธิ์ในระบบสำหรับเลือกกำหนดให้เหมาะกับหน้าที่ของแต่ละผู้ใช้งาน</p>
          </div>
          <Icon name="chevron" />
        </summary>
        <div className="users-role-grid">
          {ROLE_GUIDE.map(role => (
            <article key={role.code} className="users-role-card">
              <div className="users-role-head">
                <h3>{role.title}</h3>
                <span className={`ui-badge ${role.code === "system_admin" ? "ui-tone--info" : "ui-tone--neutral"}`}>{role.scope}</span>
              </div>
              <p>{role.description}</p>
            </article>
          ))}
        </div>
      </details>

      <Card title="รายชื่อบัญชีผู้ใช้" description="ค้นหาและปรับปรุงบทบาท หอผู้ป่วย สถานะการใช้งาน หรือตั้งรหัสผ่านใหม่">
        <div className="users-toolbar">
          <div className="users-filters">
            <TextInput
              label="ค้นหาบัญชีหรือหอผู้ป่วย"
              type="search"
              placeholder="พิมพ์ชื่อบัญชี บทบาท หรือชื่อหอผู้ป่วย"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <Select
              label="สถานะบัญชี"
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value)}
              options={[
                { value: "", label: "ทั้งหมด" },
                { value: "active", label: "ใช้งานอยู่" },
                { value: "inactive", label: "ปิดใช้งาน" },
              ]}
            />
            <Select
              label="บทบาท"
              value={roleFilter}
              onChange={event => setRoleFilter(event.target.value)}
              options={[
                { value: "", label: "ทั้งหมด" },
                { value: "system_admin", label: "ผู้ดูแลระบบ" },
                { value: "auditor", label: "ผู้ตรวจสอบ" },
                { value: "ward_recorder", label: "ผู้บันทึกประจำหอ" },
                { value: "report_reader", label: "ผู้ดูรายงาน" },
              ]}
            />
          </div>
          <div className="users-toolbar-meta">
            <p className="users-count">แสดง {filteredUsers.length} จาก {users.length} บัญชี</p>
            {hasActiveFilter && (
              <Button variant="ghost" onClick={() => { setSearch(""); setStatusFilter(""); setRoleFilter(""); }}>
                ล้างตัวกรอง
              </Button>
            )}
          </div>
        </div>

        <DataTable
          label="ตารางรายชื่อบัญชีผู้ใช้"
          columns={columns}
          rows={filteredUsers}
          state={tableState === "ready" && !filteredUsers.length ? "empty" : tableState}
          onRetry={loadUsers}
          emptyTitle={hasActiveFilter ? "ไม่พบบัญชีที่ตรงกับเงื่อนไขที่เลือก" : "ยังไม่มีบัญชีผู้ใช้"}
          emptyDescription={hasActiveFilter ? "ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะบัญชีและบทบาท" : "กดปุ่ม “เพิ่มผู้ใช้ใหม่” เพื่อสร้างบัญชีแรก"}
        />
      </Card>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="เพิ่มผู้ใช้ใหม่"
        description="กำหนดชื่อบัญชี รหัสผ่าน และบทบาทที่ได้รับอนุญาต"
        busy={createSaving}
        actions={
          <>
            <Button variant="secondary" disabled={createSaving} onClick={() => setCreateOpen(false)}>
              ยกเลิก
            </Button>
            <Button type="submit" form="create-user-form" loading={createSaving} icon="save">
              สร้างบัญชีผู้ใช้
            </Button>
          </>
        }
      >
        <form id="create-user-form" className="users-dialog-form" onSubmit={submitCreate}>
          <TextInput
            label="ชื่อบัญชี"
            hint="ความยาว 3 ถึง 80 ตัวอักษร"
            value={createUsername}
            onChange={event => setCreateUsername(event.target.value)}
            required
            maxLength={80}
          />
          <TextInput
            label="ชื่อ-นามสกุล (ไม่บังคับ)"
            hint="ชื่อและนามสกุลจริงของผู้ใช้งานสำหรับแสดงในแถบผู้ใช้และโปรไฟล์"
            value={createFullName}
            onChange={event => setCreateFullName(event.target.value)}
            maxLength={160}
          />
          <PasswordInput
            label="รหัสผ่าน"
            autoComplete="new-password"
            value={createPassword}
            onChange={event => setCreatePassword(event.target.value)}
            required
            aria-describedby="create-pw-rules"
          />
          <PasswordChecklist id="create-pw-rules" password={createPassword} />
          <PasswordInput
            label="ยืนยันรหัสผ่าน"
            autoComplete="new-password"
            value={createConfirm}
            onChange={event => setCreateConfirm(event.target.value)}
            required
            error={createConfirm && createConfirm !== createPassword ? "รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน" : undefined}
          />
          <Select
            label="บทบาทระดับระบบ"
            value={createGlobalRole}
            onChange={event => setCreateGlobalRole(event.target.value)}
            options={GLOBAL_ROLE_OPTIONS}
          />
          <WardRoleEditor
            wards={wards}
            value={createWardRoles}
            onChange={setCreateWardRoles}
            disabled={createGlobalRole === "system_admin"}
          />
          {createError && <InfoCallout tone="danger" title="สร้างบัญชีไม่สำเร็จ">{createError}</InfoCallout>}
        </form>
      </Dialog>

      <Dialog
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title="แก้ไขสิทธิ์และสถานะบัญชี"
        description={editTarget ? `ปรับบทบาทและหอผู้ป่วยของบัญชี ${editTarget.username}` : undefined}
        busy={editSaving}
        actions={
          <>
            <Button variant="secondary" disabled={editSaving} onClick={() => setEditTarget(null)}>
              ยกเลิก
            </Button>
            <Button type="submit" form="edit-user-form" loading={editSaving} icon="save">
              บันทึกการเปลี่ยนแปลง
            </Button>
          </>
        }
      >
        <form id="edit-user-form" className="users-dialog-form" onSubmit={submitEdit}>
          <TextInput
            label="ชื่อ-นามสกุล (ไม่บังคับ)"
            hint="เว้นว่างได้หากต้องการแสดงเฉพาะชื่อบัญชี"
            value={editFullName}
            onChange={event => setEditFullName(event.target.value)}
            maxLength={160}
          />
          <Select
            label="สถานะบัญชี"
            value={editActive}
            onChange={event => setEditActive(event.target.value)}
            disabled={isEditingSelf}
            hint={isEditingSelf ? "ไม่สามารถปิดใช้งานบัญชีที่กำลังใช้งานอยู่ได้" : "เมื่อปิดใช้งาน บัญชีนี้จะถูกออกจากระบบทันที"}
            options={[
              { value: "true", label: "ใช้งานอยู่" },
              { value: "false", label: "ปิดใช้งาน" },
            ]}
          />
          <Select
            label="บทบาทระดับระบบ"
            value={editGlobalRole}
            onChange={event => setEditGlobalRole(event.target.value)}
            disabled={isEditingSelf}
            hint={isEditingSelf ? "ไม่สามารถถอดสิทธิ์ผู้ดูแลระบบของบัญชีที่กำลังใช้งานอยู่ได้" : undefined}
            options={GLOBAL_ROLE_OPTIONS}
          />
          <WardRoleEditor
            wards={wards}
            value={editWardRoles}
            onChange={setEditWardRoles}
            disabled={editGlobalRole === "system_admin"}
          />
          {editError && <InfoCallout tone="danger" title="บันทึกไม่สำเร็จ">{editError}</InfoCallout>}
        </form>
      </Dialog>

      <Dialog
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        title="ตั้งรหัสผ่านใหม่"
        description={resetTarget ? `กำหนดรหัสผ่านใหม่ให้บัญชี ${resetTarget.username}` : undefined}
        busy={resetSaving}
        actions={
          <>
            <Button variant="secondary" disabled={resetSaving} onClick={() => setResetTarget(null)}>
              ยกเลิก
            </Button>
            <Button type="submit" form="reset-user-password-form" loading={resetSaving} icon="save">
              บันทึกรหัสผ่านใหม่
            </Button>
          </>
        }
      >
        <form id="reset-user-password-form" className="users-dialog-form" onSubmit={submitReset}>
          <InfoCallout tone="warning">
            หลังตั้งรหัสผ่านใหม่ อุปกรณ์อื่นที่เข้าสู่ระบบค้างไว้ของบัญชีนี้จะถูกออกจากระบบทันที
          </InfoCallout>
          <PasswordInput
            label="รหัสผ่านใหม่"
            autoComplete="new-password"
            value={resetPassword}
            onChange={event => setResetPassword(event.target.value)}
            required
            aria-describedby="reset-pw-rules"
          />
          <PasswordChecklist id="reset-pw-rules" password={resetPassword} />
          <PasswordInput
            label="ยืนยันรหัสผ่านใหม่"
            autoComplete="new-password"
            value={resetConfirm}
            onChange={event => setResetConfirm(event.target.value)}
            required
            error={resetConfirm && resetConfirm !== resetPassword ? "รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน" : undefined}
          />
          {resetError && <InfoCallout tone="danger" title="ตั้งรหัสผ่านไม่สำเร็จ">{resetError}</InfoCallout>}
        </form>
      </Dialog>

      <div className="users-toast">
        <Toast
          open={Boolean(toast)}
          tone={toast?.tone || "success"}
          title={toast?.title}
          description={toast?.description}
          onClose={() => setToast(null)}
        />
      </div>
    </div>
  );
}

export default function UsersPage() {
  return (
    <AppShell>
      <UsersContent />
    </AppShell>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import {
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  InfoCallout,
  NumberInput,
  PageHeader,
  Select,
  StatusBadge,
  TextInput,
  ThaiDatePicker,
  Toast,
} from "@/components/ui";
import { apiRequest, getErrorMessage } from "@/lib/api";
import { formatThaiDate, formatThaiNumber, parseISODate, todayISO } from "@/lib/thai-date.mjs";
import "@/styles/master.css";

const TABS = [
  { id: "wards", label: "หอผู้ป่วย" },
  { id: "shifts", label: "ประเภทเวร" },
  { id: "capacity", label: "ความจุเตียงมาตรฐาน" },
];

function MasterManagementContent() {
  const { user, csrfToken } = useAuth();
  const workspace = useWorkspace();

  const [activeTab, setActiveTab] = useState("wards");
  const [toast, setToast] = useState(null);

  // --- Wards state ---
  const [wards, setWards] = useState([]);
  const [wardsState, setWardsState] = useState("loading");
  const [wardSearch, setWardSearch] = useState("");
  const [wardDialogOpen, setWardDialogOpen] = useState(false);
  const [wardCode, setWardCode] = useState("");
  const [wardName, setWardName] = useState("");
  const [wardShortName, setWardShortName] = useState("");
  const [wardOrder, setWardOrder] = useState("0");
  const [wardError, setWardError] = useState("");
  const [wardSaving, setWardSaving] = useState(false);

  // --- Shifts state ---
  const [shifts, setShifts] = useState([]);
  const [shiftsState, setShiftsState] = useState("loading");
  const [shiftCreateOpen, setShiftCreateOpen] = useState(false);
  const [shiftCode, setShiftCode] = useState("");
  const [shiftName, setShiftName] = useState("");
  const [shiftOrder, setShiftOrder] = useState("0");
  const [shiftCreateError, setShiftCreateError] = useState("");
  const [shiftCreateSaving, setShiftCreateSaving] = useState(false);

  const [editShiftTarget, setEditShiftTarget] = useState(null);
  const [editShiftName, setEditShiftName] = useState("");
  const [editShiftOrder, setEditShiftOrder] = useState("0");
  const [editShiftActive, setEditShiftActive] = useState("true");
  const [editShiftError, setEditShiftError] = useState("");
  const [editShiftSaving, setEditShiftSaving] = useState(false);
  const [togglingShiftId, setTogglingShiftId] = useState(null);

  // --- Capacity state ---
  const [capacityWardId, setCapacityWardId] = useState("");
  const [capacities, setCapacities] = useState([]);
  const [capacityState, setCapacityState] = useState("empty");
  const [effectiveFrom, setEffectiveFrom] = useState(() => todayISO());
  const [effectiveTo, setEffectiveTo] = useState("");
  const [bedCount, setBedCount] = useState("");
  const [capacityResetToken, setCapacityResetToken] = useState(0);
  const [capacityError, setCapacityError] = useState("");
  const [capacitySaving, setCapacitySaving] = useState(false);

  const loadWards = useCallback(async () => {
    if (!user?.is_admin) return;
    setWardsState("loading");
    try {
      const items = await apiRequest("/wards");
      setWards(items);
      setWardsState(items.length ? "ready" : "empty");
      setCapacityWardId(old => (items.some(item => item.id === old) ? old : items[0]?.id || ""));
    } catch {
      setWardsState("error");
    }
  }, [user?.is_admin]);

  const loadShifts = useCallback(async () => {
    if (!user?.is_admin) return;
    setShiftsState("loading");
    try {
      const items = await apiRequest("/shifts?include_inactive=true");
      setShifts(items);
      setShiftsState(items.length ? "ready" : "empty");
    } catch {
      setShiftsState("error");
    }
  }, [user?.is_admin]);

  const loadCapacity = useCallback(async targetWardId => {
    if (!user?.is_admin || !targetWardId) {
      setCapacities([]);
      setCapacityState("empty");
      return;
    }
    setCapacityState("loading");
    try {
      const items = await apiRequest(`/wards/${targetWardId}/capacity`);
      setCapacities(items);
      setCapacityState(items.length ? "ready" : "empty");
    } catch {
      setCapacityState("error");
    }
  }, [user?.is_admin]);

  useEffect(() => {
    loadWards();
    loadShifts();
  }, [loadWards, loadShifts]);

  useEffect(() => {
    loadCapacity(capacityWardId);
  }, [capacityWardId, loadCapacity]);

  const filteredWards = useMemo(() => {
    const keyword = wardSearch.trim().toLowerCase();
    if (!keyword) return wards;
    return wards.filter(item =>
      item.code.toLowerCase().includes(keyword) ||
      item.name.toLowerCase().includes(keyword) ||
      (item.short_name || "").toLowerCase().includes(keyword)
    );
  }, [wards, wardSearch]);

  function handleTabKeyDown(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = TABS.findIndex(tab => tab.id === activeTab);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? TABS.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
    const nextTab = TABS[nextIndex].id;
    setActiveTab(nextTab);
    document.getElementById(`master-tab-${nextTab}`)?.focus();
  }

  // --- Ward actions ---
  function openCreateWard() {
    setWardCode("");
    setWardName("");
    setWardShortName("");
    setWardOrder("0");
    setWardError("");
    setWardDialogOpen(true);
  }

  async function submitCreateWard(event) {
    event.preventDefault();
    setWardError("");
    const code = wardCode.trim();
    const name = wardName.trim();
    const shortName = wardShortName.trim();
    if (!code) {
      setWardError("กรุณาระบุรหัสหอผู้ป่วย");
      return;
    }
    if (!name) {
      setWardError("กรุณาระบุชื่อเต็มหอผู้ป่วย");
      return;
    }
    const orderNum = wardOrder === "" ? 0 : Number(wardOrder);
    if (!Number.isSafeInteger(orderNum) || orderNum < 0 || orderNum > 2147483647) {
      setWardError("ลำดับแสดงผลต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป");
      return;
    }
    setWardSaving(true);
    try {
      const created = await apiRequest("/wards", {
        method: "POST",
        csrfToken,
        body: {
          code,
          name,
          short_name: shortName || null,
          display_order: orderNum,
        },
      });
      setWardDialogOpen(false);
      setToast({ tone: "success", title: "เพิ่มหอผู้ป่วยสำเร็จ", description: `เพิ่ม ${created.name} (${created.code}) เรียบร้อยแล้ว` });
      await loadWards();
      workspace?.retry?.();
    } catch (error) {
      setWardError(getErrorMessage(error, "เพิ่มหอผู้ป่วยไม่สำเร็จ กรุณาลองใหม่"));
    } finally {
      setWardSaving(false);
    }
  }

  // --- Shift actions ---
  function openCreateShift() {
    const nextOrder = shifts.length ? Math.max(...shifts.map(item => item.display_order || 0)) + 1 : 1;
    setShiftCode("");
    setShiftName("");
    setShiftOrder(String(Math.min(nextOrder, 32767)));
    setShiftCreateError("");
    setShiftCreateOpen(true);
  }

  async function submitCreateShift(event) {
    event.preventDefault();
    setShiftCreateError("");
    const code = shiftCode.trim();
    const displayName = shiftName.trim();
    if (!code) {
      setShiftCreateError("กรุณาระบุรหัสเวร");
      return;
    }
    if (!displayName) {
      setShiftCreateError("กรุณาระบุชื่อเวร");
      return;
    }
    if (shiftOrder === "" || !Number.isSafeInteger(Number(shiftOrder)) || Number(shiftOrder) < 0 || Number(shiftOrder) > 32767) {
      setShiftCreateError("ลำดับแสดงผลต้องเป็นจำนวนเต็มตั้งแต่ 0 ถึง 32,767");
      return;
    }
    setShiftCreateSaving(true);
    try {
      const created = await apiRequest("/shifts", {
        method: "POST",
        csrfToken,
        body: {
          code,
          display_name: displayName,
          display_order: Number(shiftOrder),
        },
      });
      setShiftCreateOpen(false);
      setToast({ tone: "success", title: "เพิ่มประเภทเวรสำเร็จ", description: `เพิ่มเวร${created.display_name} เรียบร้อยแล้ว` });
      await loadShifts();
    } catch (error) {
      setShiftCreateError(getErrorMessage(error, "เพิ่มประเภทเวรไม่สำเร็จ กรุณาลองใหม่"));
    } finally {
      setShiftCreateSaving(false);
    }
  }

  function openEditShift(row) {
    setEditShiftTarget(row);
    setEditShiftName(row.display_name || "");
    setEditShiftOrder(String(row.display_order ?? 0));
    setEditShiftActive(row.is_active ? "true" : "false");
    setEditShiftError("");
  }

  async function submitEditShift(event) {
    event.preventDefault();
    if (!editShiftTarget) return;
    setEditShiftError("");
    const displayName = editShiftName.trim();
    if (!displayName) {
      setEditShiftError("กรุณาระบุชื่อเวร");
      return;
    }
    if (editShiftOrder === "" || !Number.isSafeInteger(Number(editShiftOrder)) || Number(editShiftOrder) < 0 || Number(editShiftOrder) > 32767) {
      setEditShiftError("ลำดับแสดงผลต้องเป็นจำนวนเต็มตั้งแต่ 0 ถึง 32,767");
      return;
    }
    setEditShiftSaving(true);
    try {
      const updated = await apiRequest(`/shifts/${editShiftTarget.id}`, {
        method: "PATCH",
        csrfToken,
        body: {
          display_name: displayName,
          display_order: Number(editShiftOrder),
          is_active: editShiftActive === "true",
        },
      });
      setEditShiftTarget(null);
      setToast({ tone: "success", title: "บันทึกประเภทเวรสำเร็จ", description: `อัปเดตเวร${updated.display_name} เรียบร้อยแล้ว` });
      await loadShifts();
    } catch (error) {
      setEditShiftError(getErrorMessage(error, "บันทึกประเภทเวรไม่สำเร็จ กรุณาลองใหม่"));
    } finally {
      setEditShiftSaving(false);
    }
  }

  async function toggleShiftActive(row) {
    if (togglingShiftId !== null) return;
    setTogglingShiftId(row.id);
    try {
      const updated = await apiRequest(`/shifts/${row.id}`, {
        method: "PATCH",
        csrfToken,
        body: { is_active: !row.is_active },
      });
      setToast({
        tone: "success",
        title: updated.is_active ? "เปิดใช้งานเวรแล้ว" : "ปิดใช้งานเวรแล้ว",
        description: `เวร${updated.display_name} เปลี่ยนสถานะเป็น${updated.is_active ? "เปิดใช้งาน" : "ปิดใช้งาน"}`,
      });
      await loadShifts();
    } catch (error) {
      setToast({
        tone: "danger",
        title: "เปลี่ยนสถานะเวรไม่สำเร็จ",
        description: getErrorMessage(error, "ไม่สามารถเปลี่ยนสถานะประเภทเวรได้ กรุณาลองใหม่"),
      });
    } finally {
      setTogglingShiftId(null);
    }
  }

  // --- Capacity actions ---
  async function submitCapacity(event) {
    event.preventDefault();
    setCapacityError("");
    if (!capacityWardId) {
      setCapacityError("กรุณาเลือกหอผู้ป่วยก่อนบันทึกความจุเตียง");
      return;
    }
    if (!parseISODate(effectiveFrom)) {
      setCapacityError("กรุณาระบุวันที่เริ่มใช้งานให้ถูกต้อง");
      return;
    }
    if (effectiveTo && !parseISODate(effectiveTo)) {
      setCapacityError("กรุณาระบุวันที่สิ้นสุดให้ถูกต้อง หรือเว้นว่างหากใช้งานต่อเนื่อง");
      return;
    }
    if (effectiveTo && effectiveTo < effectiveFrom) {
      setCapacityError("วันที่สิ้นสุดต้องไม่อยู่ก่อนวันที่เริ่มใช้งาน");
      return;
    }
    const beds = Number(bedCount);
    if (bedCount === "" || !Number.isSafeInteger(beds) || beds < 1 || beds > 2147483647) {
      setCapacityError("กรุณาระบุจำนวนเตียงมาตรฐานตั้งแต่ 1 เตียงขึ้นไป");
      return;
    }
    setCapacitySaving(true);
    try {
      await apiRequest(`/wards/${capacityWardId}/capacity`, {
        method: "POST",
        csrfToken,
        body: {
          effective_from: effectiveFrom,
          effective_to: effectiveTo || null,
          bed_count: beds,
        },
      });
      setEffectiveFrom(todayISO());
      setEffectiveTo("");
      setBedCount("");
      setCapacityResetToken(value => value + 1);
      setToast({
        tone: "success",
        title: "บันทึกความจุเตียงมาตรฐานสำเร็จ",
        description: `เพิ่มช่วงความจุ ${formatThaiNumber(beds)} เตียง ตั้งแต่วันที่ ${formatThaiDate(effectiveFrom)} แล้ว`,
      });
      await loadCapacity(capacityWardId);
    } catch (error) {
      setCapacityError(getErrorMessage(error, "บันทึกความจุเตียงไม่สำเร็จ กรุณาตรวจสอบช่วงวันที่แล้วลองใหม่"));
    } finally {
      setCapacitySaving(false);
    }
  }

  if (!user?.is_admin) {
    return (
      <div className="master-page">
        <PageHeader
          title="จัดการหอผู้ป่วยและเวร"
          description="จัดการข้อมูลพื้นฐานของหอผู้ป่วย ประเภทเวร และความจุเตียงมาตรฐาน"
        />
        <Card>
          <EmptyState
            icon="lock"
            title="หน้านี้สำหรับผู้ดูแลระบบเท่านั้น"
            description="บัญชีของคุณไม่มีสิทธิ์จัดการข้อมูลหอผู้ป่วย ประเภทเวร หรือความจุเตียงมาตรฐาน กรุณาติดต่อผู้ดูแลระบบหากต้องการปรับปรุงข้อมูล"
            action={<Link className="ui-button ui-button--secondary" href="/">กลับหน้าแรก</Link>}
          />
        </Card>
      </div>
    );
  }

  const wardColumns = [
    {
      key: "code",
      label: "รหัสหอผู้ป่วย",
      sortable: true,
      render: value => <strong>{value}</strong>,
    },
    {
      key: "name",
      label: "ชื่อเต็มหอผู้ป่วย",
      sortable: true,
    },
    {
      key: "short_name",
      label: "ชื่อย่อ",
      sortable: true,
      render: value => value || <span className="ui-muted">—</span>,
    },
    {
      key: "is_active",
      label: "สถานะ",
      render: value => (
        <StatusBadge status={value ? "confirmed" : "readonly"} label={value ? "ใช้งานอยู่" : "ปิดใช้งาน"} />
      ),
    },
  ];

  const shiftColumns = [
    {
      key: "display_name",
      label: "ชื่อเวร",
      sortable: true,
      render: (value, row) => (
        <div className="master-shift-name">
          <strong>{value}</strong>
          <small className="ui-muted">รหัส: {row.code}</small>
        </div>
      ),
    },
    {
      key: "display_order",
      label: "ลำดับแสดงผล",
      numeric: true,
      sortable: true,
      compare: (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
      render: value => formatThaiNumber(value),
    },
    {
      key: "is_active",
      label: "สถานะ",
      render: value => (
        <StatusBadge status={value ? "confirmed" : "readonly"} label={value ? "เปิดใช้งาน" : "ปิดใช้งาน"} />
      ),
    },
    {
      key: "actions",
      label: "การจัดการ",
      render: (_value, row) => (
        <div className="master-row-actions">
          <Button
            variant="secondary"
            icon="edit"
            disabled={togglingShiftId === row.id}
            onClick={() => openEditShift(row)}
          >
            แก้ไข
          </Button>
          <Button
            variant="ghost"
            loading={togglingShiftId === row.id}
            onClick={() => toggleShiftActive(row)}
          >
            {row.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
          </Button>
        </div>
      ),
    },
  ];

  const capacityColumns = [
    {
      key: "effective_from",
      label: "วันที่เริ่มใช้งาน",
      sortable: true,
      compare: (a, b) => String(a.effective_from || "").localeCompare(String(b.effective_from || "")),
      render: value => formatThaiDate(value, { month: "long" }),
    },
    {
      key: "effective_to",
      label: "วันที่สิ้นสุด",
      sortable: true,
      compare: (a, b) => String(a.effective_to || "9999-99-99").localeCompare(String(b.effective_to || "9999-99-99")),
      render: value => (value ? formatThaiDate(value, { month: "long" }) : <StatusBadge status="confirmed" label="ใช้งานต่อเนื่อง" />),
    },
    {
      key: "bed_count",
      label: "จำนวนเตียงมาตรฐาน",
      numeric: true,
      sortable: true,
      compare: (a, b) => (a.bed_count ?? 0) - (b.bed_count ?? 0),
      render: value => `${formatThaiNumber(value)} เตียง`,
    },
  ];

  const selectedCapacityWard = wards.find(item => item.id === capacityWardId);

  return (
    <div className="master-page">
      <PageHeader
        title="จัดการหอผู้ป่วยและเวร"
        description="จัดการข้อมูลหลักของหอผู้ป่วย ประเภทเวร และประวัติช่วงความจุเตียงมาตรฐาน"
      />

      <div className="master-tabs" role="tablist" aria-label="หมวดข้อมูลพื้นฐาน" onKeyDown={handleTabKeyDown}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`master-tab-${tab.id}`}
            className="master-tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`master-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* แท็บที่ 1: หอผู้ป่วย */}
      <div
        id="master-panel-wards"
        role="tabpanel"
        aria-labelledby="master-tab-wards"
        className="master-panel"
        hidden={activeTab !== "wards"}
      >
        <Card
          title="รายชื่อหอผู้ป่วย"
          description="รายการหอผู้ป่วยที่เปิดใช้งานในระบบ"
          actions={
            <Button icon="plus" onClick={openCreateWard}>
              เพิ่มหอผู้ป่วยใหม่
            </Button>
          }
        >
          <InfoCallout tone="info" className="master-callout">
            ข้อมูลหอผู้ป่วยที่บันทึกไว้แล้วแสดงแบบอ่านอย่างเดียว หากต้องการเพิ่มหอผู้ป่วยใหม่ให้กดปุ่ม “เพิ่มหอผู้ป่วยใหม่”
          </InfoCallout>

          {wards.length > 0 && (
            <div className="master-toolbar">
              <div className="master-search">
                <TextInput
                  label="ค้นหาหอผู้ป่วย"
                  type="search"
                  placeholder="พิมพ์รหัส ชื่อเต็ม หรือชื่อย่อ"
                  value={wardSearch}
                  onChange={event => setWardSearch(event.target.value)}
                />
              </div>
              <p className="master-count">
                แสดง {formatThaiNumber(filteredWards.length)} จาก {formatThaiNumber(wards.length)} หอผู้ป่วย
              </p>
            </div>
          )}

          <DataTable
            label="ตารางรายชื่อหอผู้ป่วย"
            columns={wardColumns}
            rows={filteredWards}
            state={wardsState === "ready" && !filteredWards.length ? "empty" : wardsState}
            onRetry={loadWards}
            emptyTitle={wardSearch.trim() ? "ไม่พบหอผู้ป่วยที่ตรงกับคำค้นหา" : "ยังไม่มีข้อมูลหอผู้ป่วย"}
            emptyDescription={wardSearch.trim() ? "ลองเปลี่ยนคำค้นหาหรือล้างช่องค้นหา" : "กดปุ่ม “เพิ่มหอผู้ป่วยใหม่” เพื่อเพิ่มรายการแรก"}
          />
        </Card>
      </div>

      {/* แท็บที่ 2: ประเภทเวร */}
      <div
        id="master-panel-shifts"
        role="tabpanel"
        aria-labelledby="master-tab-shifts"
        className="master-panel"
        hidden={activeTab !== "shifts"}
      >
        <Card
          title="รายการประเภทเวร"
          description="เพิ่มเวรใหม่ ปรับชื่อเวร ลำดับการแสดงผล และสถานะเปิดหรือปิดการใช้งาน"
          actions={
            <Button icon="plus" onClick={openCreateShift}>
              เพิ่มประเภทเวร
            </Button>
          }
        >
          <InfoCallout tone="info" className="master-callout">
            สามารถเพิ่มประเภทเวรใหม่ แก้ไขชื่อเวร ปรับลำดับการแสดงผล และเปิดหรือปิดการใช้งานได้ ส่วนรหัสเวรจะแสดงแบบอ่านอย่างเดียวหลังสร้างรายการ
          </InfoCallout>

          <DataTable
            label="ตารางประเภทเวร"
            columns={shiftColumns}
            rows={shifts}
            state={shiftsState}
            onRetry={loadShifts}
            emptyTitle="ยังไม่มีข้อมูลประเภทเวร"
            emptyDescription="กดปุ่ม “เพิ่มประเภทเวร” เพื่อสร้างประเภทเวรแรก"
          />
        </Card>
      </div>

      {/* แท็บที่ 3: ความจุเตียงมาตรฐาน */}
      <div
        id="master-panel-capacity"
        role="tabpanel"
        aria-labelledby="master-tab-capacity"
        className="master-panel"
        hidden={activeTab !== "capacity"}
      >
        <Card title="เลือกหอผู้ป่วย" description="เลือกหอผู้ป่วยเพื่อดูประวัติและเพิ่มช่วงความจุเตียงมาตรฐาน">
          {wardsState === "loading" ? (
            <p className="ui-muted">กำลังโหลดรายชื่อหอผู้ป่วย…</p>
          ) : !wards.length ? (
            <EmptyState
              title="ยังไม่มีหอผู้ป่วยในระบบ"
              description="กรุณาเพิ่มหอผู้ป่วยในแท็บ “หอผู้ป่วย” ก่อนกำหนดความจุเตียงมาตรฐาน"
            />
          ) : (
            <div className="master-ward-select">
              <Select
                label="หอผู้ป่วย"
                value={capacityWardId}
                onChange={event => {
                  setCapacityWardId(event.target.value);
                  setCapacityError("");
                }}
                options={wards.map(item => ({ value: item.id, label: `${item.name} (${item.code})` }))}
              />
            </div>
          )}
        </Card>

        {wards.length > 0 && (
          <>
            <Card
              title="เพิ่มช่วงความจุเตียงใหม่"
              description={selectedCapacityWard ? `กำหนดความจุเตียงมาตรฐานสำหรับ ${selectedCapacityWard.name}` : "กำหนดวันที่เริ่มใช้งานและจำนวนเตียงมาตรฐาน"}
            >
              <form className="master-capacity-form" onSubmit={submitCapacity}>
                <div className="master-capacity-fields">
                  <ThaiDatePicker
                    resetToken={capacityResetToken}
                    label="วันที่เริ่มใช้งาน"
                    required
                    value={effectiveFrom}
                    onChange={value => {
                      setEffectiveFrom(value);
                      setCapacityError("");
                    }}
                    disabled={!capacityWardId || capacitySaving}
                  />
                  <ThaiDatePicker
                    resetToken={capacityResetToken}
                    label="วันที่สิ้นสุด (ถ้ามี)"
                    hint="เว้นว่างได้หากยังใช้งานต่อเนื่องไม่มีกำหนดสิ้นสุด"
                    value={effectiveTo}
                    min={effectiveFrom || undefined}
                    onChange={value => {
                      setEffectiveTo(value);
                      setCapacityError("");
                    }}
                    disabled={!capacityWardId || capacitySaving}
                  />
                  <NumberInput
                    label="จำนวนเตียงมาตรฐาน"
                    required
                    min={1}
                    max={2147483647}
                    placeholder="ระบุจำนวนเตียงตั้งแต่ 1 เตียง"
                    hint="ระบุจำนวนเต็มมากกว่า 0"
                    value={bedCount}
                    onChange={value => {
                      setBedCount(value);
                      setCapacityError("");
                    }}
                    disabled={!capacityWardId || capacitySaving}
                  />
                </div>
                {capacityError && (
                  <InfoCallout tone="danger" title="บันทึกความจุเตียงไม่สำเร็จ" role="alert">
                    {capacityError}
                  </InfoCallout>
                )}
                <div className="master-capacity-actions">
                  <Button type="submit" icon="plus" loading={capacitySaving} disabled={!capacityWardId}>
                    บันทึกช่วงความจุเตียง
                  </Button>
                </div>
              </form>
            </Card>

            <Card
              title="ประวัติช่วงความจุเตียงมาตรฐาน"
              description={selectedCapacityWard ? `${selectedCapacityWard.name} (${selectedCapacityWard.code})` : undefined}
            >
              <InfoCallout tone="info" className="master-callout">
                ประวัติช่วงความจุเตียงที่บันทึกแล้วแสดงแบบอ่านอย่างเดียว โดยช่วงวันที่ที่เพิ่มใหม่ต้องไม่ซ้อนทับกับช่วงที่มีอยู่เดิม
              </InfoCallout>

              <DataTable
                label="ตารางประวัติช่วงความจุเตียงมาตรฐาน"
                rowKey="effective_from"
                columns={capacityColumns}
                rows={capacities}
                state={capacityState}
                onRetry={() => loadCapacity(capacityWardId)}
                emptyTitle="ยังไม่มีประวัติความจุเตียงมาตรฐาน"
                emptyDescription="กรอกแบบฟอร์มด้านบนเพื่อเพิ่มช่วงความจุเตียงแรกของหอผู้ป่วยนี้"
              />
            </Card>
          </>
        )}
      </div>

      {/* Dialog: เพิ่มหอผู้ป่วยใหม่ */}
      <Dialog
        open={wardDialogOpen}
        onClose={() => { if (!wardSaving) setWardDialogOpen(false); }}
        title="เพิ่มหอผู้ป่วยใหม่"
        description="กำหนดรหัส ชื่อเต็ม และชื่อย่อของหอผู้ป่วย"
        busy={wardSaving}
        actions={
          <>
            <Button variant="secondary" disabled={wardSaving} onClick={() => setWardDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button type="submit" form="master-create-ward-form" icon="save" loading={wardSaving}>
              บันทึกหอผู้ป่วย
            </Button>
          </>
        }
      >
        <form id="master-create-ward-form" className="master-dialog-form" onSubmit={submitCreateWard}>
          <TextInput
            label="รหัสหอผู้ป่วย"
            required
            maxLength={32}
            placeholder="เช่น MED1 หรือ SURG1"
            hint="ความยาวไม่เกิน 32 ตัวอักษร และต้องไม่ซ้ำกับรหัสที่มีอยู่"
            value={wardCode}
            onChange={event => setWardCode(event.target.value)}
            disabled={wardSaving}
          />
          <TextInput
            label="ชื่อเต็มหอผู้ป่วย"
            required
            maxLength={160}
            placeholder="เช่น หอผู้ป่วยอายุรกรรมชาย"
            value={wardName}
            onChange={event => setWardName(event.target.value)}
            disabled={wardSaving}
          />
          <TextInput
            label="ชื่อย่อ"
            maxLength={40}
            placeholder="เช่น อช. (เว้นว่างได้)"
            hint="ใช้แสดงบนหน้าจอขนาดเล็ก"
            value={wardShortName}
            onChange={event => setWardShortName(event.target.value)}
            disabled={wardSaving}
          />
          <NumberInput
            label="ลำดับแสดงผล"
            min={0}
            max={2147483647}
            hint="ตัวเลขน้อยแสดงก่อน (ค่าเริ่มต้น 0)"
            value={wardOrder}
            onChange={setWardOrder}
            disabled={wardSaving}
          />
          {wardError && (
            <InfoCallout tone="danger" title="เพิ่มหอผู้ป่วยไม่สำเร็จ" role="alert">
              {wardError}
            </InfoCallout>
          )}
        </form>
      </Dialog>

      {/* Dialog: เพิ่มประเภทเวร */}
      <Dialog
        open={shiftCreateOpen}
        onClose={() => { if (!shiftCreateSaving) setShiftCreateOpen(false); }}
        title="เพิ่มประเภทเวร"
        description="กำหนดรหัส ชื่อเวร และลำดับการแสดงผล"
        busy={shiftCreateSaving}
        actions={
          <>
            <Button variant="secondary" disabled={shiftCreateSaving} onClick={() => setShiftCreateOpen(false)}>
              ยกเลิก
            </Button>
            <Button type="submit" form="master-create-shift-form" icon="save" loading={shiftCreateSaving}>
              บันทึกประเภทเวร
            </Button>
          </>
        }
      >
        <form id="master-create-shift-form" className="master-dialog-form" onSubmit={submitCreateShift}>
          <TextInput
            label="รหัสเวร"
            required
            maxLength={32}
            placeholder="เช่น night, morning, afternoon"
            hint="กำหนดครั้งเดียวตอนสร้าง ไม่สามารถแก้ไขภายหลัง"
            value={shiftCode}
            onChange={event => setShiftCode(event.target.value)}
            disabled={shiftCreateSaving}
          />
          <TextInput
            label="ชื่อเวร"
            required
            maxLength={80}
            placeholder="เช่น ดึก, เช้า, บ่าย"
            value={shiftName}
            onChange={event => setShiftName(event.target.value)}
            disabled={shiftCreateSaving}
          />
          <NumberInput
            label="ลำดับแสดงผล"
            required
            min={0}
            max={32767}
            hint="เรียงจากน้อยไปมาก (0 ถึง 32,767)"
            value={shiftOrder}
            onChange={setShiftOrder}
            disabled={shiftCreateSaving}
          />
          {shiftCreateError && (
            <InfoCallout tone="danger" title="เพิ่มประเภทเวรไม่สำเร็จ" role="alert">
              {shiftCreateError}
            </InfoCallout>
          )}
        </form>
      </Dialog>

      {/* Dialog: แก้ไขประเภทเวร */}
      <Dialog
        open={Boolean(editShiftTarget)}
        onClose={() => { if (!editShiftSaving) setEditShiftTarget(null); }}
        title="แก้ไขประเภทเวร"
        description={editShiftTarget ? `ปรับปรุงข้อมูลของเวร${editShiftTarget.display_name}` : undefined}
        busy={editShiftSaving}
        actions={
          <>
            <Button variant="secondary" disabled={editShiftSaving} onClick={() => setEditShiftTarget(null)}>
              ยกเลิก
            </Button>
            <Button type="submit" form="master-edit-shift-form" icon="save" loading={editShiftSaving}>
              บันทึกการแก้ไข
            </Button>
          </>
        }
      >
        {editShiftTarget && (
          <form id="master-edit-shift-form" className="master-dialog-form" onSubmit={submitEditShift}>
            <TextInput label="รหัสเวร" value={editShiftTarget.code} readOnly />
            <TextInput
              label="ชื่อเวร"
              required
              maxLength={80}
              value={editShiftName}
              onChange={event => setEditShiftName(event.target.value)}
              disabled={editShiftSaving}
            />
            <NumberInput
              label="ลำดับแสดงผล"
              required
              min={0}
              max={32767}
              value={editShiftOrder}
              onChange={setEditShiftOrder}
              disabled={editShiftSaving}
            />
            <Select
              label="สถานะการใช้งาน"
              value={editShiftActive}
              onChange={event => setEditShiftActive(event.target.value)}
              disabled={editShiftSaving}
              options={[
                { value: "true", label: "เปิดใช้งาน" },
                { value: "false", label: "ปิดใช้งาน" },
              ]}
            />
            {editShiftError && (
              <InfoCallout tone="danger" title="บันทึกประเภทเวรไม่สำเร็จ" role="alert">
                {editShiftError}
              </InfoCallout>
            )}
          </form>
        )}
      </Dialog>

      <div className="master-toast">
        <Toast
          open={Boolean(toast)}
          tone={toast?.tone}
          title={toast?.title}
          description={toast?.description}
          onClose={() => setToast(null)}
        />
      </div>
    </div>
  );
}

export default function AdminMasterPage() {
  return (
    <AppShell>
      <MasterManagementContent />
    </AppShell>
  );
}

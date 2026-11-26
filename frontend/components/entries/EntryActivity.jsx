"use client";

import { useEffect, useState } from "react";
import { ErrorState, Icon, InfoCallout, Skeleton } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { formatThaiDate, formatThaiTime, todayISO } from "@/lib/thai-date.mjs";
import "@/styles/entry-activity.css";

const actions = { created: "บันทึกข้อมูล", updated: "แก้ไขข้อมูล", confirmed: "ยืนยันข้อมูล", returned: "ส่งกลับแก้ไข", legacy_confirmed: "ยืนยันในระบบเดิม" };
const statuses = { unconfirmed: "รอยืนยัน", confirmed: "ยืนยันแล้ว" };

export function EntryActivity({ entry }) {
  const [events, setEvents] = useState([]);
  const [phase, setPhase] = useState("loading");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setEvents([]); setPhase("loading");
    apiRequest(`/entries/${entry.id}/events`).then(rows => {
      if (active) { setEvents(rows); setPhase("ready"); }
    }).catch(() => { if (active) setPhase("error"); });
    return () => { active = false; };
  }, [entry.id, entry.version, retry]);
  const returned = entry.status === "unconfirmed" ? events.findLast(event => event.action_code === "returned") : null;
  return <section className="entry-activity" aria-label="ประวัติการทำรายการ">
    {returned && <InfoCallout tone="warning" title="เหตุผลที่ส่งกลับแก้ไข"><p>{returned.reason}</p><p>ส่งกลับโดย {returned.actor_username}</p></InfoCallout>}
    <details><summary>ประวัติการทำรายการ<Icon name="chevron" /></summary>
      {phase === "loading" ? <Skeleton label="กำลังโหลดประวัติการทำรายการ" lines={2} /> : phase === "error" ? <ErrorState title="โหลดประวัติการทำรายการไม่สำเร็จ" description="ลองโหลดประวัติอีกครั้ง ข้อมูลในแบบฟอร์มยังคงอยู่" onRetry={() => setRetry(value => value + 1)} /> : !events.length ? <p className="ui-muted">ยังไม่มีประวัติการทำรายการในระบบใหม่</p> : <ol>{events.map(event => <li key={event.id}>
        <strong>{actions[event.action_code]}{event.to_status ? ` · ${statuses[event.to_status]}` : ""}</strong>
        <span>โดย {event.actor_username || "ไม่พบข้อมูลผู้ยืนยัน"}</span>
        {event.occurred_at ? <time dateTime={event.occurred_at}>{formatThaiDate(todayISO(new Date(event.occurred_at)))} {formatThaiTime(event.occurred_at)}</time> : <span>ไม่พบข้อมูลวันและเวลายืนยัน</span>}
        {event.reason && <p>เหตุผล: {event.reason}</p>}
      </li>)}</ol>}
    </details>
  </section>;
}

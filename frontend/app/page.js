"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { apiRequest, getErrorMessage } from "@/lib/api";
import { Button, Card, Dialog, EmptyState, ErrorState, FormField, Skeleton, TextInput, Toast } from "@/components/ui";
import { Dashboard } from "@/components/home/Dashboard";
import { formatThaiDate, todayISO } from "@/lib/thai-date.mjs";
import "@/styles/home.css";

const blank = {title:"", body:"", published:false};
export default function HomePage() {
  const {user, csrfToken} = useAuth();
  const [news, setNews] = useState([]);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [newsRetry, setNewsRetry] = useState(0);
  useEffect(() => {
    setLoading(true); setError("");
    apiRequest("/news").then(setNews).catch(e => setError(getErrorMessage(e))).finally(() => setLoading(false));
  }, [newsRetry]);
  async function save(event) {
    event.preventDefault(); setBusy(true); setError("");
    const {title,body,published} = draft;
    try {
      const item = await apiRequest(draft.id ? "/news/"+draft.id+"?version="+draft.version : "/news", {
        method: draft.id ? "PUT" : "POST", csrfToken, body:{title,body,published}
      });
      setNews(old => draft.id ? old.map(n => n.id === item.id ? item : n) : [item, ...old]); setDraft(null);
      setNotice("บันทึกข่าวประกาศแล้ว");
    } catch (e) { setError(getErrorMessage(e)); } finally { setBusy(false); }
  }
  async function remove(item) {
    if (!window.confirm("ลบประกาศ "+item.title+" หรือไม่?")) return;
    setBusy(true); setError("");
    try {
      await apiRequest("/news/"+item.id+"?version="+item.version, {method:"DELETE",csrfToken});
      setNews(old => old.filter(n => n.id !== item.id)); if (draft?.id === item.id) setDraft(null);
      setNotice("ลบข่าวประกาศแล้ว");
    } catch (e) {setError(getErrorMessage(e));} finally {setBusy(false);}
  }
  const announcements = <Card title="ข่าวประกาศ" description="ข่าวสารสำหรับหอผู้ป่วย" actions={user?.is_admin && <Button variant="secondary" icon="plus" onClick={() => setDraft({...blank})} disabled={busy}>เพิ่มข่าว</Button>}>
    {loading ? <Skeleton label="กำลังโหลดข่าวประกาศ" lines={5} /> : error && !news.length ? <ErrorState description={error} onRetry={() => setNewsRetry(value => value + 1)} /> : !news.length ? <EmptyState title="ยังไม่มีข่าวประกาศ" description="ข่าวสารใหม่จะแสดงที่นี่เมื่อมีการเผยแพร่" /> : <div className="home-news-list">{news.map(item => <article key={item.id} className="home-news-item"><details><summary><span className="home-news-title">{item.title}</span><span className="home-news-date">{formatThaiDate(todayISO(new Date(item.created_at)), { month: "long" })}{!item.published && <span className="ui-badge ui-tone--neutral">ฉบับร่าง</span>}</span></summary><p className="home-news-body">{item.body}</p><p className="ui-field-hint home-news-publisher">ผู้ประกาศ: {item.publisher_username || "ไม่พบข้อมูลผู้ประกาศเดิม"}</p></details>{user?.is_admin && <div className="ui-actions"><Button disabled={busy} variant="ghost" icon="edit" onClick={() => setDraft({...item})}>แก้ไขข่าว</Button><Button disabled={busy} variant="ghost" onClick={() => remove(item)}>ลบข่าว</Button></div>}</article>)}</div>}
    {error && news.length > 0 && <p role="alert" className="ui-field-error">{error}</p>}
  </Card>;
  return <AppShell><Dashboard {...{ announcements }} /><Dialog open={Boolean(draft && user?.is_admin)} onClose={() => setDraft(null)} title={draft?.id ? "แก้ไขข่าวประกาศ" : "เพิ่มข่าวประกาศ"} busy={busy}>{draft && user?.is_admin && <form onSubmit={save} className="home-news-form"><fieldset className="plain-fields" disabled={busy}>
    <TextInput required label="หัวข้อข่าว" maxLength={240} value={draft.title} onChange={e => setDraft({...draft,title:e.target.value})} />
    <FormField label="รายละเอียด" required>{field => <textarea {...field} className="ui-input" rows={6} value={draft.body} onChange={e => setDraft({...draft,body:e.target.value})} />}</FormField>
    <label className="home-publish"><input type="checkbox" checked={draft.published} onChange={e => setDraft({...draft,published:e.target.checked})} /> เผยแพร่ให้หอผู้ป่วย</label>
    {error && <p role="alert" className="ui-field-error">{error}</p>}<div className="ui-actions"><Button type="submit" icon="save" loading={busy}>บันทึกข่าว</Button><Button variant="secondary" disabled={busy} onClick={() => setDraft(null)}>ยกเลิก</Button></div>
  </fieldset></form>}</Dialog><div className="home-toast"><Toast open={Boolean(notice)} title={notice} onClose={() => setNotice("")} /></div></AppShell>;
}

"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Button, Card, InfoCallout, PasswordInput, TextInput } from "@/components/ui";
import { getErrorMessage } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      if (!response.ok) {
        if (response.status === 401) throw { status: 401, detail: "invalid_credentials" };
        throw { status: response.status };
      }
      await refresh();
      router.replace("/entries");
    } catch (problem) {
      setError(problem.detail === "invalid_credentials"
        ? "ชื่อบัญชีหรือรหัสผ่านไม่ถูกต้อง"
        : getErrorMessage(problem, "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่"));
    } finally {
      setPending(false);
      setPassword("");
    }
  }

  return (
    <main className="login-page">
      <Card as="form" className="login-panel" aria-labelledby="login-title" onSubmit={submit}>
        <header className="login-heading">
          <Image className="login-hospital-logo" src="/brand/akat-hospital.webp" width={400} height={106} alt="โรงพยาบาลอากาศอำนวย" preload unoptimized />
          <h1 id="login-title">ระบบรายงานจำนวนผู้ป่วยใน</h1>
          <p className="ui-muted">เข้าสู่ระบบด้วยบัญชีที่ได้รับจากผู้ดูแลระบบ</p>
        </header>
        <TextInput label="ชื่อบัญชี" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required maxLength={80} />
        <PasswordInput label="รหัสผ่าน" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <InfoCallout tone="danger" role="alert">{error}</InfoCallout>}
        <Button type="submit" disabled={pending}>
          {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
        </Button>
        <p className="login-help ui-muted">หากเข้าสู่ระบบไม่ได้ กรุณาติดต่อผู้ดูแลระบบ</p>
      </Card>
    </main>
  );
}

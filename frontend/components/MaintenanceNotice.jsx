"use client";

import Image from "next/image";
import { Button, Card, Icon, InfoCallout, StatusBadge } from "@/components/ui";
import { getMaintenanceContent } from "@/lib/maintenance.mjs";

export function MaintenanceNotice({ note, onRetry }) {
  const content = getMaintenanceContent({ note });
  function handleRetry() {
    if (onRetry) {
      onRetry();
      return;
    }
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  }
  return (
    <main id="main-content" className="login-page maintenance-page" tabIndex={-1}>
      <Card as="section" className="login-panel maintenance-panel" aria-labelledby="maintenance-title">
        <header className="login-heading maintenance-heading">
          <Image
            className="login-hospital-logo"
            src="/brand/akat-hospital.webp"
            width={400}
            height={106}
            alt={content.hospitalName}
            preload
            unoptimized
          />
          <div className="maintenance-badge-row">
            <StatusBadge status="unrecorded" label={content.badgeLabel} />
            <span className="ui-muted">{content.systemName}</span>
          </div>
          <h1 id="maintenance-title">{content.title}</h1>
          <p className="ui-muted">{content.hospitalName}</p>
        </header>

        <p className="maintenance-description">{content.description}</p>

        <InfoCallout tone="warning" title="คำแนะนำสำหรับผู้ใช้งาน">
          {content.guidance}
        </InfoCallout>

        <div className="maintenance-actions">
          <Button icon="refresh" onClick={handleRetry}>
            ลองเข้าใช้งานอีกครั้ง
          </Button>
        </div>

        <p className="login-help ui-muted">
          <Icon name="clock" /> {content.contactLabel}
        </p>
      </Card>
    </main>
  );
}

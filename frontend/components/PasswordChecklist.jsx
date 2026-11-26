"use client";

import { Icon } from "@/components/ui";
import { evaluatePasswordPolicy } from "@/lib/password-policy.mjs";

export function PasswordChecklist({ password = "", id }) {
  const hasInput = password.length > 0;
  const result = evaluatePasswordPolicy(password);
  return (
    <div className="pw-checklist-wrap" id={id} aria-live="polite">
      <p className="pw-checklist-title">เงื่อนไขการตั้งรหัสผ่าน</p>
      <ul className="pw-checklist">
        {result.rules.map(rule => {
          const state = rule.passed ? "pass" : hasInput ? "fail" : "idle";
          const icon = rule.passed ? "check" : hasInput ? "error" : "info";
          return (
            <li key={rule.key} className={`pw-rule pw-rule--${state}`}>
              <Icon name={icon} />
              <span>{rule.label}</span>
              <span className="ui-sr-only">{rule.passed ? " ผ่านแล้ว" : " ยังไม่ผ่าน"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

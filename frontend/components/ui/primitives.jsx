"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./Icon";

export function useMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(width < 768px)");
    const update = () => setMobile(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return mobile;
}

export function Button({ variant = "primary", loading = false, disabled, icon, children, className = "", type = "button", ...props }) {
  return <button type={type} className={`ui-button ui-button--${variant} ${className}`} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
    {loading ? <span className="ui-spinner" aria-hidden="true" /> : icon && <Icon name={icon} />}{children}{loading && <span className="ui-sr-only"> กำลังดำเนินการ</span>}
  </button>;
}

export function Card({ title, description, actions, children, className = "", as: Tag = "section", ...props }) {
  const id = useId();
  return <Tag className={`ui-card ${className}`} aria-labelledby={title ? id : undefined} {...props}>
    {(title || actions) && <div className="ui-card-heading"><div>{title && <h2 id={id}>{title}</h2>}{description && <p className="ui-muted">{description}</p>}</div>{actions}</div>}{children}
  </Tag>;
}

export function FormField({ id: suppliedId, label, required, hint, error, children, className = "" }) {
  const generatedId = useId();
  const id = suppliedId || generatedId;
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return <div className={`ui-field ${className}`}>
    <label htmlFor={id}>{label}{required && <span className="ui-required" aria-hidden="true"> *</span>}</label>
    {children({ id, required, "aria-invalid": Boolean(error) || undefined, "aria-describedby": describedBy })}
    {hint && <p id={`${id}-hint`} className="ui-field-hint">{hint}</p>}
    {error && <p id={`${id}-error`} className="ui-field-error"><Icon name="error" />{error}</p>}
  </div>;
}

export function TextInput({ label, hint, error, id, required, className = "", ...props }) {
  return <FormField {...{ label, hint, error, id, required }}>
    {field => <input className={`ui-input ${className}`} {...field} {...props} />}
  </FormField>;
}

export function PasswordInput({ label, hint, error, id, required, disabled, readOnly, className = "", type: _type, "aria-describedby": ariaDescribedBy, ...props }) {
  const [visible, setVisible] = useState(false);
  return <FormField {...{ label, hint, error, id, required }}>
    {field => <div className="ui-input-action">
      <input className={`ui-input ${className}`} {...field} {...props} type={visible ? "text" : "password"} disabled={disabled} readOnly={readOnly}
        aria-describedby={[field["aria-describedby"], ariaDescribedBy].filter(Boolean).join(" ") || undefined} />
      <Button type="button" variant="ghost" icon={visible ? "eyeOff" : "eye"} aria-label={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} aria-pressed={visible}
        disabled={disabled} onClick={() => setVisible(current => !current)} />
    </div>}
  </FormField>;
}

export function Select({ label, hint, error, id, required, options = [], groups, placeholder, readOnly, className = "", ...props }) {
  const flatOptions = groups ? groups.flatMap(group => group.options || []) : options;
  return <FormField {...{ label, hint, error, id, required }}>
    {field => readOnly ? <input className="ui-input" {...field} readOnly value={flatOptions.find(option => String(option.value) === String(props.value))?.label || "—"} /> :
      <div className="ui-select-wrap"><select className={`ui-input ui-select ${className}`} {...field} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {groups
          ? groups.filter(group => group.options?.length).map(group => <optgroup key={group.label} label={group.label}>{group.options.map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}</optgroup>)
          : options.map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
      </select><Icon name="chevron" /></div>}
  </FormField>;
}

/** Controlled numeric text. onChange receives the raw digit string, including an empty string. */
export function NumberInput({ label, hint, error, id, required, value = "", onChange, min = 0, max = 2147483647, readOnly, disabled, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    const text = String(value);
    const invalid = text !== "" && (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text)) || Number(text) < min || Number(text) > max);
    ref.current?.setCustomValidity(invalid ? `กรอกจำนวนเต็มตั้งแต่ ${min} ถึง ${max}` : "");
  }, [value, min, max]);
  return <FormField {...{ label, hint, error, id, required }}>
    {field => <input ref={ref} className="ui-input ui-number" type="text" inputMode="numeric" pattern="[0-9]*" value={value} readOnly={readOnly} disabled={disabled}
      {...field} {...props} onFocus={event => event.target.select()} onChange={event => { if (/^\d*$/.test(event.target.value)) onChange?.(event.target.value, event); }} />}
  </FormField>;
}

const statuses = {
  unrecorded: ["ยังไม่บันทึก", "warning", "clock"], overdue: ["เลยกำหนด", "danger", "warning"],
  unconfirmed: ["รอยืนยัน", "info", "clock"], confirmed: ["ยืนยันแล้ว", "success", "check"],
  readonly: ["อ่านอย่างเดียว", "neutral", "lock"],
};
export function StatusBadge({ status = "unrecorded", label }) {
  const [text, tone, icon] = statuses[status] || ["ไม่ทราบสถานะ", "neutral", "info"];
  return <span className={`ui-badge ui-tone--${tone}`}><Icon name={icon} />{label || text}</span>;
}

export function InfoCallout({ tone = "info", title, children, className = "", ...props }) {
  return <div className={`ui-callout ui-tone--${tone}${className ? ` ${className}` : ""}`} {...props}><Icon name={tone === "danger" ? "error" : tone === "warning" ? "warning" : tone === "success" ? "check" : "info"} /><div>{title && <strong>{title}</strong>}{children && <div>{children}</div>}</div></div>;
}

export function EmptyState({ title = "ยังไม่มีข้อมูล", description = "เลือกช่วงข้อมูลหรือเริ่มเพิ่มรายการใหม่", action, icon = "empty" }) {
  return <div className="ui-state"><span className="ui-state-icon"><Icon name={icon} /></span><h3>{title}</h3><p className="ui-muted">{description}</p>{action}</div>;
}

export function ErrorState({ title = "โหลดข้อมูลไม่สำเร็จ", description = "ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง", onRetry, loading = false }) {
  return <div role="alert" className="ui-error-state"><EmptyState {...{ title, description }} icon="error" action={onRetry && <Button variant="secondary" icon="refresh" onClick={onRetry} loading={loading}>ลองใหม่</Button>} /></div>;
}

export function Skeleton({ lines = 3, label = "กำลังโหลดข้อมูล" }) {
  return <div className="ui-skeleton" role="status" aria-label={label}><span className="ui-sr-only">{label}</span>{Array.from({ length: lines }, (_, index) => <span key={index} className="ui-skeleton-line" aria-hidden="true" />)}</div>;
}

export function Legend({ items, label = "คำอธิบาย" }) {
  return <div className="ui-legend" aria-label={label}>{items.map(item => <span key={item.label}>{item.icon && <Icon name={item.icon} />}<strong>{item.label}</strong>{item.description && <span className="ui-muted">{item.description}</span>}</span>)}</div>;
}

export function InfoPopover({ label = "ดูคำอธิบาย", trigger, children }) {
  const id = useId();
  return <span className="ui-popover"><button type="button" className="ui-popover-trigger" popoverTarget={id} aria-label={label}>{trigger || <Icon name="info" />}</button><span id={id} popover="auto" role="note" aria-label={label} className="ui-popover-content">{children}</span></span>;
}

export function ShiftSelector({ label = "เวร", value, onChange, options, disabled, required = false }) {
  const groupId = useId();
  const selected = options.find(option => String(option.value) === String(value));
  const available = options.filter(option => !option.disabled);
  function move(event) {
    if (disabled || !["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key) || !available.length) return;
    event.preventDefault();
    const index = available.findIndex(option => String(option.value) === String(value));
    const next = event.key === "Home" ? 0 : event.key === "End" ? available.length - 1 : (index + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) + available.length) % available.length;
    onChange?.(available[next].value);
    event.currentTarget.querySelectorAll('[role="radio"]')[options.indexOf(available[next])]?.focus();
  }
  if (required && !options.length) return <Select {...{ label, value, disabled, required }} placeholder="เลือกเวร" options={[]} />;
  if (required) return <fieldset className="ui-shifts" disabled={disabled}><legend id={groupId}>{label} <span className="ui-required" aria-hidden="true">*</span></legend><div className="ui-segmented ui-native-shifts" role="radiogroup" aria-labelledby={groupId}>
    {options.map(option => { const statusId = option.status ? `${groupId}-${option.value}-status` : undefined; return <label className="ui-shift-option" key={option.value}><input type="radio" name={groupId} value={option.value} aria-label={option.label} aria-describedby={statusId} checked={String(option.value) === String(value)} required disabled={disabled || option.disabled} onChange={() => onChange?.(option.value)} /><span><strong>{option.label}</strong>{option.time && <small>{option.time}</small>}{option.status && <span id={statusId}><StatusBadge status={option.status} /></span>}</span></label>; })}
  </div></fieldset>;
  return <fieldset className="ui-shifts" disabled={disabled}><legend id={groupId}>{label}</legend><div className="ui-segmented" role="radiogroup" aria-labelledby={groupId} onKeyDown={move}>
    {options.map((option, index) => <button type="button" role="radio" aria-checked={String(option.value) === String(value)} tabIndex={String(option.value) === String(value) || (!selected && index === options.indexOf(available[0])) ? 0 : -1}
      key={option.value} disabled={disabled || option.disabled} onClick={() => onChange?.(option.value)}><strong>{option.label}</strong>{option.time && <small>{option.time}</small>}{option.status && <StatusBadge status={option.status} />}</button>)}
  </div></fieldset>;
}

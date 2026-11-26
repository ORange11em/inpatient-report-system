const paths = {
  print: <><path d="M6 9V3h12v6M6 18H3v-9h18v9h-3M6 14h12v8H6Z" /><path d="M17 12h1" /></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M3 16v5h18v-5" /></>,
  home: <><path d="m3 10 9-7 9 7v11h-6v-7H9v7H3Z" /></>,
  edit: <><path d="m15 4 5 5M4 20l4-1L21 6l-5-5L3 14l-1 8 2-2ZM13 21h9" /></>,
  history: <><path d="M3 3v6h6M3 9a9 9 0 1 1 1 9M12 7v5l3 2" /></>,
  checklist: <><rect x="4" y="4" width="16" height="18" rx="2" /><path d="M9 2h6v4H9Zm-2 9 2 2 3-3m2 2h3m-10 5 2 2 3-3m2 2h3" /></>,
  activity: <><path d="M2 12h5l3-8 4 16 3-8h5" /></>,
  report: <><path d="M5 2h10l5 5v15H5Zm10 0v6h5M9 18v-4m4 4V9m4 9v-6" /></>,
  bed: <><path d="M3 5v16m18-7v7M3 17h18M3 9h7a3 3 0 0 1 3 3v5m0-7h5a3 3 0 0 1 3 3v4" /><circle cx="7" cy="12" r="2" /></>,
  menu: <path d="M3 5h18M3 12h18M3 19h18" />,
  user: <><circle cx="12" cy="7" r="4" /><path d="M4 22v-2a8 8 0 0 1 16 0v2" /></>,
  users: <><circle cx="9" cy="7" r="3.5" /><path d="M2 21v-2a6.5 6.5 0 0 1 13 0v2" /><circle cx="17.5" cy="8.5" r="2.5" /><path d="M16.5 14a5 5 0 0 1 5.5 5v2" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9m-3 3 2 2m-4-1 2 2" /></>,
  logout: <><path d="M9 3H3v18h6m4-14 5 5-5 5M8 12h13" /></>,
  panel: <><rect x="2" y="3" width="20" height="18" rx="2" /><path d="M8 3v18m9-14-3 5 3 5" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18m-12 5h.01M12 16h.01M15 16h.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10h.01" /></>,
  warning: <><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v5m0 3h.01" /></>,
  error: <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6m-6 0 6-6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  empty: <><path d="M4 5h16v15H4zM4 14h5l2 3h2l2-3h5" /><path d="M9 9h6" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.3 8a7 7 0 0 1 11.5-3L20 8M4 16l3.2 3A7 7 0 0 0 18.7 16" /></>,
  filter: <><path d="M4 6h16M7 12h10m-7 6h4" /><circle cx="8" cy="6" r="2" /><circle cx="15" cy="12" r="2" /></>,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  save: <><path d="M5 3h12l4 4v14H3V3h2Z" /><path d="M7 3v6h10V3M7 21v-7h10v7" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  sort: <path d="M8 4v16m-4-4 4 4 4-4m4-12v16m-4-16 4-4 4 4" />,
};

/** One internal icon set; decorative by default, labelled when used alone. */
export function Icon({ name = "info", label, className = "", ...props }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    className={`ui-icon ${className}`} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false" {...props}>{paths[name] || paths.info}</svg>;
}

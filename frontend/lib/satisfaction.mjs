/** The external installation owns authentication; legacy account IDs are not guessed. */
export function satisfactionLink(configuredUrl, legacyWardCode, canWrite = true) {
  const effectiveUrl = configuredUrl || (typeof window !== "undefined" ? window.__INPATIENT_SATISFACTION_URL__ : "");
  if (!canWrite || !effectiveUrl || !legacyWardCode) return undefined;
  try {
    const target = new URL(effectiveUrl);
    if (!['http:', 'https:'].includes(target.protocol)) return undefined;
    target.searchParams.set('ward', legacyWardCode);
    return target.href;
  } catch { return undefined; }
}

// ข้อมูลสมมติเท่านั้น // TODO: เชื่อม API — ตรวจรับสำเนาโรงพยาบาลแยกภายหลัง
// Connects the real UI only to the isolated rehearsal service; no mocked responses.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const config = JSON.parse(fs.readFileSync(process.env.ROLLOUT_BROWSER_CONFIG, 'utf8'));
const output = process.env.ROLLOUT_BROWSER_OUTPUT;
assert.equal(new URL(config.origin).hostname, '127.0.0.1');
assert.ok(['localhost', '127.0.0.1'].includes(new URL(config.ui).hostname));

(async () => {
  const browser = await chromium.launch({headless: true, channel: 'msedge'});
  const result = {synthetic_only: true, stage: config.stage, checks: [], errors: []};
  try {
    for (const [actor, expected] of [['reader', 12], ['admin', 18]]) {
      const context = await browser.newContext({viewport: {width: 1440, height: 1000},
        locale: 'th-TH', timezoneId: 'Asia/Bangkok', reducedMotion: 'reduce', acceptDownloads: true});
      await context.route('**/api/v1/**', async route => {
        const url = new URL(route.request().url());
        try {
          const response = await route.fetch({url: config.origin + url.pathname + url.search});
          await route.fulfill({response});
        } catch (e) {
          if (!/closed|disposed|canceled/i.test(String(e && e.message))) throw e;
        }
      });
      const page = await context.newPage();
      page.on('pageerror', () => result.errors.push('page_error'));
      await page.goto(config.ui + '/login');
      await page.getByLabel('ชื่อบัญชี', {exact: true}).fill(config.credentials[actor].username);
      await page.getByLabel('รหัสผ่าน', {exact: true}).fill(config.credentials[actor].password);
      await page.getByRole('button', {name: 'เข้าสู่ระบบ', exact: true}).click();
      await page.waitForURL(config.ui + '/entries');
      await page.goto(config.ui + '/reports?kind=daily-all&date=2026-11-01&shift=' + config.shift);
      await page.getByRole('button', {name: 'ส่งออก Excel', exact: true}).waitFor();
      await page.locator('.report-screen .ui-table tfoot tr').waitFor({state: 'attached'});
      for (const width of [360, 768, 1024, 1440]) {
        await page.setViewportSize({width, height: 1000});
        if (width === 360) await page.getByRole('button', {name: 'ตาราง', exact: true}).click();
        const table = await page.locator('.report-screen .ui-table').evaluate(t => ({
          columns: [...t.querySelectorAll('thead tr:last-child th')].map(c => c.innerText.trim()),
          detail: [...t.querySelectorAll('tbody tr')].map(r => [...r.querySelectorAll('th,td')].map(c => c.innerText.trim())),
          total: [...t.querySelectorAll('tfoot tr:last-child th,tfoot tr:last-child td')].map(c => c.innerText.trim())
        }));
        const column = table.columns.indexOf('คงเหลือ PT');
        assert.ok(column >= 0);
        assert.equal(Number(table.total[column].replaceAll(',', '')), expected);
        assert.equal(table.detail.reduce((n, r) => n + Number(r[column].replaceAll(',', '')), 0), expected);
        const size = await page.evaluate(() => ({client: document.documentElement.clientWidth,
          scroll: document.documentElement.scrollWidth}));
        assert.equal(size.client, size.scroll);
        result.checks.push({actor, width, totalPT: expected, pageOverflow: false});
      }
      const printed = await page.locator('.report-print-only').innerText();
      assert.equal(printed.includes('หอสมมติ B'), actor === 'admin');
      const wait = page.waitForEvent('download');
      await page.getByRole('button', {name: 'ส่งออก Excel', exact: true}).click();
      const download = await wait;
      assert.match(download.suggestedFilename(), /\.xml$/);
      const exported = path.join(path.dirname(output), config.stage + '-' + actor + '.xml');
      await download.saveAs(exported);
      const rows = await page.evaluate(xml => {
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        return [...doc.querySelectorAll('Row')].map(r => [...r.querySelectorAll('Data')].map(c => ({
          text: c.textContent, type: c.getAttributeNS('urn:schemas-microsoft-com:office:spreadsheet', 'Type')
        })));
      }, fs.readFileSync(exported, 'utf8'));
      const index = rows[2].findIndex(c => c.text === 'คงเหลือ PT');
      assert.ok(index >= 0);
      assert.deepEqual(rows.at(-1)[index], {text: String(expected), type: 'Number'});
      result.checks.push({actor, xmlTotalPT: expected, xmlNumeric: true, printScopeCorrect: true});
      await page.screenshot({path: path.join(path.dirname(output), config.stage + '-' + actor + '-1440.png')});
      await context.close();
    }
    assert.deepEqual(result.errors, []);
    result.passed = true;
    fs.writeFileSync(output, JSON.stringify(result, null, 2));
    console.log('PASS imported-data browser:', config.stage, '8 responsive cases, 2 print/XML scopes');
  } finally {
    await browser.close();
  }
})().catch(() => {
  console.error('FAIL imported-data browser check; credentials and page content suppressed');
  process.exitCode = 1;
});

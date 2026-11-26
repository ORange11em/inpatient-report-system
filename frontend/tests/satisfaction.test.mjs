import test from 'node:test';
import assert from 'node:assert/strict';
import { satisfactionLink } from '../lib/satisfaction.mjs';

test('ความพึงพอใจใช้หอที่เลือกและคงพารามิเตอร์ปลายทาง โดยไม่เดารหัสบัญชีเก่า', () => {
  const target = new URL(satisfactionLink('https://example.invalid/contentment/index.php?source=inpatient', '10'));
  assert.equal(target.searchParams.get('ward'), '10');
  assert.equal(target.searchParams.get('source'), 'inpatient');
  assert.equal(target.searchParams.has('id'), false);
  assert.equal(new URL(satisfactionLink(target.href, '11')).searchParams.get('ward'), '11');
});
test('ยังไม่กำหนดปลายทางหรือไม่มีรหัสหอเดิม ไม่สร้างลิงก์สมมติ', () => {
  assert.equal(satisfactionLink('', '10'), undefined);
  assert.equal(satisfactionLink('https://example.invalid', null), undefined);
});
test('ลิงก์ภายนอกรับเฉพาะที่อยู่เว็บสมบูรณ์ http/https', () => {
  for (const value of ['../contentment', 'javascript:alert(1)', 'data:text/html,test', 'not a URL']) assert.equal(satisfactionLink(value, '10'), undefined);
  assert.equal(new URL(satisfactionLink('http://example.invalid/contentment', '10')).protocol, 'http:');
});
test('รหัสหอถูกเข้ารหัสในค่าพารามิเตอร์ ไม่แทรกพารามิเตอร์อื่น', () => {
  const target = new URL(satisfactionLink('https://example.invalid', '10&unexpected=1'));
  assert.equal(target.searchParams.get('ward'), '10&unexpected=1');
  assert.equal(target.searchParams.has('unexpected'), false);
});
test('ซ่อนลิงก์เมื่อผู้ใช้ไม่มีสิทธิ์บันทึกในหอปัจจุบัน', () => {
  assert.equal(satisfactionLink('https://example.invalid/contentment/index.php', '10', false), undefined);
  assert.equal(
    satisfactionLink('https://example.invalid/contentment/index.php', '10', true),
    'https://example.invalid/contentment/index.php?ward=10',
  );
});

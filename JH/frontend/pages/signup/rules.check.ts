// 회원가입 입력 검사 자체 점검 — 실행: node JH/frontend/pages/signup/rules.check.ts (Node 23+ 타입 제거 실행)
import assert from 'node:assert/strict';
import { validate } from './rules.ts';

const ok = { name: '김지환', employeeNo: 'e0001', email: 'jh@example.com', userId: 'jh.kim', password: 'pass1234', password2: 'pass1234' };
assert.deepEqual(validate(ok), {});
assert.deepEqual(validate({ ...ok, employeeNo: 'E0001', userId: 'JhKim' }), {});            // 대문자는 서버가 소문자로
assert.ok(validate({ ...ok, name: '  ' }).name);
assert.ok(validate({ ...ok, employeeNo: '0001' }).employeeNo);
assert.ok(validate({ ...ok, email: 'jh@' }).email);
assert.ok(validate({ ...ok, userId: 'ab' }).userId);
assert.ok(validate({ ...ok, userId: '_abcd' }).userId);
assert.ok(validate({ ...ok, password: 'password', password2: 'password' }).password);       // 숫자 없음
assert.ok(validate({ ...ok, password: '1234567', password2: '1234567' }).password);         // 짧음·영문 없음
assert.equal(validate({ ...ok, password2: 'pass12345' }).password2, '비밀번호가 일치하지 않습니다.');
assert.equal(Object.keys(validate({ name: '', employeeNo: '', email: '', userId: '', password: '', password2: '' })).length, 6);
console.log('signup rules: OK');

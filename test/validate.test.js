const test = require('node:test');
const assert = require('node:assert/strict');
const { validateEmployee } = require('../src/validate');

const valid = {
  first_name: 'Asha',
  last_name: 'Verma',
  email: 'Asha.Verma@Example.com',
  phone: '+91 98765 43210',
  department: 'DevOps',
  designation: 'Cloud Engineer',
  date_of_joining: '2026-03-01',
};

test('accepts a valid employee and normalises email', () => {
  const { errors, data } = validateEmployee(valid);
  assert.deepEqual(errors, []);
  assert.equal(data.email, 'asha.verma@example.com');
});

test('phone is optional', () => {
  const { errors } = validateEmployee({ ...valid, phone: '' });
  assert.deepEqual(errors, []);
});

test('rejects missing required fields', () => {
  const { errors } = validateEmployee({});
  assert.ok(errors.some((e) => e.includes('First name')));
  assert.ok(errors.some((e) => e.includes('Last name')));
  assert.ok(errors.some((e) => e.includes('email')));
});

test('rejects an invalid email', () => {
  const { errors } = validateEmployee({ ...valid, email: 'not-an-email' });
  assert.equal(errors.length, 1);
});

test('rejects a department that is not in the list', () => {
  const { errors } = validateEmployee({ ...valid, department: 'Pirates' });
  assert.ok(errors.some((e) => e.includes('department')));
});

test('rejects a malformed date', () => {
  const { errors } = validateEmployee({ ...valid, date_of_joining: '01/03/2026' });
  assert.ok(errors.some((e) => e.includes('Date of joining')));
});

test('rejects an over-long first name', () => {
  const { errors } = validateEmployee({ ...valid, first_name: 'x'.repeat(81) });
  assert.ok(errors.some((e) => e.includes('First name')));
});

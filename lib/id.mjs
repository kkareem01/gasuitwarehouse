import { randomBytes } from 'node:crypto';

function hex(bytes) {
  return randomBytes(bytes).toString('hex').toUpperCase();
}

export function newBookingId() {
  return `BK-${hex(4)}`;
}

export function newLeadId() {
  return `LD-${hex(4)}`;
}

export function newIntakeId() {
  return `IN-${hex(4)}`;
}

export function newSpecialOrderId() {
  return `SO-${hex(4)}`;
}

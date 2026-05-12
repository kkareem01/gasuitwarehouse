/**
 * SQL-backed repository for the staff "Special Orders" feature.
 *
 * Kept separate from lib/store.mjs (which is already large) so the
 * special-order surface area is self-contained and easy to evolve.
 */

import { getDb } from './db.mjs';

export const VALID_ORDER_STATUSES = ['pending', 'ordered', 'arrived', 'picked_up'];
export const VALID_ITEM_TYPES = ['suit', 'shirt', 'shoes', 'accessory', 'other'];

function rowToSpecialOrder(r) {
  return {
    id: r.id,
    firstName: r.first_name ?? '',
    lastName: r.last_name ?? '',
    phone: r.phone ?? '',
    email: r.email ?? '',
    itemType: r.item_type,
    color: r.color ?? '',
    size: r.size ?? '',
    description: r.description ?? '',
    additionalNotes: r.additional_notes ?? '',
    needByDate: r.need_by_date ?? '',
    orderStatus: r.order_status,
    arrivalNoticeStatus: r.arrival_notice_status,
    arrivalNoticeSentAt: r.arrival_notice_sent_at,
    orderedAt: r.ordered_at,
    arrivedAt: r.arrived_at,
    pickedUpAt: r.picked_up_at,
    createdAt: r.created_at,
  };
}

export async function createSpecialOrder(record, idGenerator) {
  const db = getDb();
  const order = {
    ...record,
    id: idGenerator(),
    createdAt: new Date().toISOString(),
  };

  await db.execute({
    sql: `INSERT INTO special_orders (
      id, first_name, last_name, phone, email,
      item_type, color, size, description, additional_notes, need_by_date,
      order_status, arrival_notice_status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      order.id,
      order.firstName ?? '',
      order.lastName ?? '',
      order.phone ?? '',
      order.email ?? '',
      order.itemType,
      order.color ?? '',
      order.size ?? '',
      order.description ?? '',
      order.additionalNotes ?? '',
      order.needByDate ?? '',
      'pending',
      'pending',
      order.createdAt,
    ],
  });
  return { ok: true, order };
}

/**
 * List special orders for the staff dashboard.
 * @param {object} opts
 * @param {string} [opts.status]  - filter by order_status: 'pending'|'ordered'|'arrived'|'picked_up'|'all'
 * @param {string} [opts.search]  - case-insensitive substring across name/email/phone/description
 * @param {number} [opts.limit]   - max rows (default 200)
 */
export async function listSpecialOrders({ status, search, limit = 200 } = {}) {
  const db = getDb();
  const where = [];
  const args = [];

  if (status && status !== 'all') {
    where.push('order_status = ?');
    args.push(status);
  }

  if (search && typeof search === 'string' && search.trim().length > 0) {
    const like = `%${search.trim().toLowerCase()}%`;
    where.push('(LOWER(first_name) LIKE ? OR LOWER(last_name) LIKE ? OR LOWER(email) LIKE ? OR phone LIKE ? OR LOWER(description) LIKE ? OR LOWER(color) LIKE ?)');
    args.push(like, like, like, like, like, like);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  // Orders without a need-by date sort last; otherwise oldest need-by first,
  // then newest created.
  const sql = `SELECT * FROM special_orders ${whereSql}
    ORDER BY
      CASE WHEN need_by_date = '' THEN 1 ELSE 0 END ASC,
      need_by_date ASC,
      created_at DESC
    LIMIT ?`;
  args.push(Math.max(1, Math.min(1000, Number(limit) || 200)));

  const result = await db.execute({ sql, args });
  return result.rows.map(rowToSpecialOrder);
}

export async function findSpecialOrderById(id) {
  const db = getDb();
  const rs = await db.execute({
    sql: 'SELECT * FROM special_orders WHERE id = ? LIMIT 1',
    args: [id],
  });
  if (rs.rows.length === 0) return null;
  return rowToSpecialOrder(rs.rows[0]);
}

/**
 * Update order_status. Stamps the matching transition timestamp the first time
 * the order enters each terminal state (ordered_at / arrived_at / picked_up_at).
 * Existing timestamps are preserved across re-entry so we keep the original
 * transition time as a stable audit trail.
 */
export async function updateSpecialOrderStatus(id, status) {
  if (!VALID_ORDER_STATUSES.includes(status)) {
    return { ok: false, error: 'INVALID_STATUS' };
  }
  const db = getDb();
  const now = new Date().toISOString();

  const existing = await findSpecialOrderById(id);
  if (!existing) return { ok: false, error: 'NOT_FOUND' };

  const stamps = {
    ordered_at: existing.orderedAt,
    arrived_at: existing.arrivedAt,
    picked_up_at: existing.pickedUpAt,
  };
  if (status === 'ordered' && !stamps.ordered_at) stamps.ordered_at = now;
  if (status === 'arrived' && !stamps.arrived_at) stamps.arrived_at = now;
  if (status === 'picked_up' && !stamps.picked_up_at) stamps.picked_up_at = now;

  const result = await db.execute({
    sql: `UPDATE special_orders
            SET order_status = ?, ordered_at = ?, arrived_at = ?, picked_up_at = ?
          WHERE id = ?`,
    args: [status, stamps.ordered_at, stamps.arrived_at, stamps.picked_up_at, id],
  });
  if (result.rowsAffected === 0) return { ok: false, error: 'NOT_FOUND' };
  return { ok: true };
}

const EDITABLE_COLUMNS = {
  firstName:       'first_name',
  lastName:        'last_name',
  phone:           'phone',
  email:           'email',
  itemType:        'item_type',
  color:           'color',
  size:            'size',
  description:     'description',
  additionalNotes: 'additional_notes',
  needByDate:      'need_by_date',
};

export async function updateSpecialOrderFields(id, fields) {
  const sets = [];
  const args = [];
  for (const [key, col] of Object.entries(EDITABLE_COLUMNS)) {
    if (fields[key] === undefined) continue;
    sets.push(`${col} = ?`);
    args.push(fields[key]);
  }
  if (sets.length === 0) return { ok: false, error: 'NO_FIELDS' };
  args.push(id);
  const db = getDb();
  const result = await db.execute({
    sql: `UPDATE special_orders SET ${sets.join(', ')} WHERE id = ?`,
    args,
  });
  if (result.rowsAffected === 0) return { ok: false, error: 'NOT_FOUND' };
  return { ok: true };
}

export async function deleteSpecialOrder(id) {
  const db = getDb();
  const result = await db.execute({
    sql: 'DELETE FROM special_orders WHERE id = ?',
    args: [id],
  });
  if (result.rowsAffected === 0) return { ok: false, error: 'NOT_FOUND' };
  return { ok: true };
}

export async function markSpecialOrderArrivalNoticeSent(id, { status = 'sent', sentAt } = {}) {
  const db = getDb();
  const result = await db.execute({
    sql: 'UPDATE special_orders SET arrival_notice_status = ?, arrival_notice_sent_at = ? WHERE id = ?',
    args: [status, sentAt ?? new Date().toISOString(), id],
  });
  if (result.rowsAffected === 0) return { ok: false, error: 'NOT_FOUND' };
  return { ok: true };
}

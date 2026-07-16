/**
 * Single dispatching function for every staff admin endpoint — keeps Vercel's
 * Hobby 12-function ceiling intact. The dynamic [action] segment matches the
 * leaf path: /api/admin/funnel-stats → action="funnel-stats", etc.
 */
import {
  handleAdminLookupCode,
  handleAdminRedeem,
  handleAdminFunnelStats,
  handleAdminListIntakes,
  handleAdminUpdateIntake,
  handleAdminEditIntake,
  handleAdminDeleteIntake,
  handleAdminNotifyIntakeReady,
  handleAdminListSpecialOrders,
  handleAdminCreateSpecialOrder,
  handleAdminEditSpecialOrder,
  handleAdminUpdateSpecialOrderStatus,
  handleAdminDeleteSpecialOrder,
  handleAdminNotifySpecialOrderArrived,
  handleAdminListBookings,
  handleAdminBookingsCount,
  handleAdminCreateBooking,
  handleAdminUpdateBookingStatus,
  handleAdminEditBooking,
  handleAdminDeleteBooking,
} from '../../lib/handlers.mjs';
import {
  handleAdminRecordBookingSale,
  handleAdminListAdSpend,
  handleAdminSetAdSpend,
  handleAdminRevenueStats,
  handleAdsConversionsFeed,
} from '../../lib/handlers-sales.mjs';

const KNOWN_ACTIONS = [
  'lookup-code', 'redeem', 'funnel-stats',
  'intakes', 'intake-status', 'intake-edit', 'intake-delete', 'intake-notify-ready',
  'special-orders', 'special-order-create', 'special-order-edit',
  'special-order-status', 'special-order-delete', 'special-order-notify-arrived',
  'bookings', 'bookings-count', 'booking-create', 'booking-status', 'booking-edit', 'booking-delete',
  'booking-sale', 'ad-spend', 'ad-spend-set', 'revenue-stats', 'ads-conversions',
];

export default async function (req, res) {
  const action = req.query?.action || req.url.split('?')[0].split('/').pop();

  if (action === 'lookup-code' && req.method === 'GET') {
    return handleAdminLookupCode(req, res);
  }
  if (action === 'redeem' && req.method === 'POST') {
    return handleAdminRedeem(req, res);
  }
  if (action === 'funnel-stats' && req.method === 'GET') {
    return handleAdminFunnelStats(req, res);
  }
  if (action === 'intakes' && req.method === 'GET') {
    return handleAdminListIntakes(req, res);
  }
  if (action === 'intake-status' && req.method === 'POST') {
    return handleAdminUpdateIntake(req, res);
  }
  if (action === 'intake-edit' && req.method === 'POST') {
    return handleAdminEditIntake(req, res);
  }
  if (action === 'intake-delete' && req.method === 'POST') {
    return handleAdminDeleteIntake(req, res);
  }
  if (action === 'intake-notify-ready' && req.method === 'POST') {
    return handleAdminNotifyIntakeReady(req, res);
  }
  if (action === 'special-orders' && req.method === 'GET') {
    return handleAdminListSpecialOrders(req, res);
  }
  if (action === 'special-order-create' && req.method === 'POST') {
    return handleAdminCreateSpecialOrder(req, res);
  }
  if (action === 'special-order-edit' && req.method === 'POST') {
    return handleAdminEditSpecialOrder(req, res);
  }
  if (action === 'special-order-status' && req.method === 'POST') {
    return handleAdminUpdateSpecialOrderStatus(req, res);
  }
  if (action === 'special-order-delete' && req.method === 'POST') {
    return handleAdminDeleteSpecialOrder(req, res);
  }
  if (action === 'special-order-notify-arrived' && req.method === 'POST') {
    return handleAdminNotifySpecialOrderArrived(req, res);
  }
  if (action === 'bookings' && req.method === 'GET') {
    return handleAdminListBookings(req, res);
  }
  if (action === 'bookings-count' && req.method === 'GET') {
    return handleAdminBookingsCount(req, res);
  }
  if (action === 'booking-create' && req.method === 'POST') {
    return handleAdminCreateBooking(req, res);
  }
  if (action === 'booking-status' && req.method === 'POST') {
    return handleAdminUpdateBookingStatus(req, res);
  }
  if (action === 'booking-edit' && req.method === 'POST') {
    return handleAdminEditBooking(req, res);
  }
  if (action === 'booking-delete' && req.method === 'POST') {
    return handleAdminDeleteBooking(req, res);
  }
  if (action === 'booking-sale' && req.method === 'POST') {
    return handleAdminRecordBookingSale(req, res);
  }
  if (action === 'ad-spend' && req.method === 'GET') {
    return handleAdminListAdSpend(req, res);
  }
  if (action === 'ad-spend-set' && req.method === 'POST') {
    return handleAdminSetAdSpend(req, res);
  }
  if (action === 'revenue-stats' && req.method === 'GET') {
    return handleAdminRevenueStats(req, res);
  }
  // Basic-auth (not staff Bearer): fetched by Google Ads' scheduled uploader.
  if (action === 'ads-conversions' && req.method === 'GET') {
    return handleAdsConversionsFeed(req, res);
  }

  res.statusCode = KNOWN_ACTIONS.includes(action) ? 405 : 404;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify({ ok: false, error: res.statusCode === 405 ? 'METHOD_NOT_ALLOWED' : 'UNKNOWN_ACTION', action }));
}

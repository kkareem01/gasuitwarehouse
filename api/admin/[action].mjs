/**
 * Single dispatching function for every staff admin endpoint — keeps Vercel's
 * Hobby 12-function ceiling intact. The dynamic [action] segment matches the
 * leaf path: /api/admin/funnel-stats → action="funnel-stats", etc.
 */
import {
  handleAdminLookupCode,
  handleAdminRedeem,
  handleAdminFunnelStats,
} from '../../lib/handlers.mjs';

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

  res.statusCode = ['lookup-code', 'redeem', 'funnel-stats'].includes(action) ? 405 : 404;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify({ ok: false, error: res.statusCode === 405 ? 'METHOD_NOT_ALLOWED' : 'UNKNOWN_ACTION', action }));
}

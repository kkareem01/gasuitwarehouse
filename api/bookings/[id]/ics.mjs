import { handleGetBookingIcs } from '../../../lib/handlers.mjs';

export default async function (req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end('Method not allowed');
  }
  const id = req.query?.id || '';
  await handleGetBookingIcs(req, res, id);
}

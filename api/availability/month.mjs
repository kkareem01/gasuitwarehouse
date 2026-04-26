import { handleAvailabilityMonth } from '../../lib/handlers.mjs';

export default async function (req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end('Method not allowed');
  }
  await handleAvailabilityMonth(req, res);
}

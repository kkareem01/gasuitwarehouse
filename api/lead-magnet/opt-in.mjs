import { handleLeadMagnetOptIn } from '../../lib/handlers.mjs';

export default async function (req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('Method not allowed');
  }
  await handleLeadMagnetOptIn(req, res);
}

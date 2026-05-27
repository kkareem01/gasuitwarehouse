import { handleConfig, handleGoogleRating } from '../lib/handlers.mjs';

// This function also serves /api/google-rating via the rewrite in vercel.json
// (consolidated to stay under Vercel's 12-function Hobby limit).
export default async function (req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end('Method not allowed');
  }
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.searchParams.get('__route') === 'google-rating') {
    return handleGoogleRating(req, res);
  }
  await handleConfig(req, res);
}

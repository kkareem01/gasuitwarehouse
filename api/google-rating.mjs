// Returns the live Google rating for the configured Place ID.
// Cached at the edge for 6h, served stale up to 24h, so traffic to Google
// Places stays trivial regardless of pageviews.

const PLACES_ENDPOINT = 'https://places.googleapis.com/v1/places';

export default async function (req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end('Method not allowed');
  }

  const placeId = process.env.GOOGLE_PLACE_ID;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  res.setHeader('Content-Type', 'application/json');

  if (!placeId || !apiKey) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ error: 'Not configured' }));
  }

  try {
    const upstream = await fetch(`${PLACES_ENDPOINT}/${encodeURIComponent(placeId)}`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'rating',
      },
    });

    if (!upstream.ok) {
      res.statusCode = 502;
      return res.end(JSON.stringify({ error: 'Upstream error', status: upstream.status }));
    }

    const data = await upstream.json();
    const rating = typeof data.rating === 'number' ? data.rating : null;

    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    return res.end(JSON.stringify({ rating }));
  } catch (err) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: 'Internal error' }));
  }
}

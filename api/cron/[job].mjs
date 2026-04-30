/**
 * Single dispatching function for every cron job — keeps Vercel's Hobby
 * 12-function ceiling intact. The dynamic [job] segment matches the path
 * configured in vercel.json (e.g. /api/cron/nurture-t3 → job="nurture-t3").
 */
import {
  handleCronNurtureT3,
  handleCronNurtureT1,
  handleCronNurtureDayOf,
  handleCronExpireCodes,
  handleCronRotateOffer,
} from '../../lib/handlers.mjs';

const HANDLERS = {
  'nurture-t3':    handleCronNurtureT3,
  'nurture-t1':    handleCronNurtureT1,
  'nurture-dayof': handleCronNurtureDayOf,
  'expire-codes':  handleCronExpireCodes,
  'rotate-offer':  handleCronRotateOffer,
};

export default async function (req, res) {
  const job = req.query?.job || req.url.split('?')[0].split('/').pop();
  const handler = HANDLERS[job];
  if (!handler) {
    res.statusCode = 404;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: 'UNKNOWN_JOB', job }));
  }
  await handler(req, res);
}

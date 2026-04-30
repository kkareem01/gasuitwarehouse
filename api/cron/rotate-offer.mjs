import { handleCronRotateOffer } from '../../lib/handlers.mjs';

export default async function (req, res) {
  await handleCronRotateOffer(req, res);
}

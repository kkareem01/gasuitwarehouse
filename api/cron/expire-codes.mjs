import { handleCronExpireCodes } from '../../lib/handlers.mjs';

export default async function (req, res) {
  await handleCronExpireCodes(req, res);
}

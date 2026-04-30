import { handleCronNurtureT1 } from '../../lib/handlers.mjs';

export default async function (req, res) {
  await handleCronNurtureT1(req, res);
}

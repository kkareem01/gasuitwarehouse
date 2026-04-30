import { handleCronNurtureDayOf } from '../../lib/handlers.mjs';

export default async function (req, res) {
  await handleCronNurtureDayOf(req, res);
}

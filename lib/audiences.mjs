/**
 * Per-audience field schema for step 2 of the booking form.
 * MUST stay in sync with assets/js/booking-form.js FIELD_SCHEMAS.
 * server.mjs runs a startup self-test that diffs both lists and exits if they drift.
 */

export const AUDIENCES = ['weddings', 'general'];

export const FIELD_SCHEMAS = {
  weddings: [
    { name: 'eventDate', label: 'Wedding date', type: 'date', required: true },
    {
      name: 'partySize',
      label: '# in your wedding party',
      type: 'select',
      required: true,
      options: ['Just me', '2-4', '5-7', '8-10', '11+'],
    },
    {
      name: 'priorities',
      label: 'Anything we should know?',
      type: 'textarea',
      required: false,
      maxLength: 500,
      placeholder: 'Color palette, venue, deadlines…',
    },
  ],
  general: [
    {
      name: 'occasion',
      label: "What's the suit for?",
      type: 'text',
      required: true,
      maxLength: 80,
      placeholder: 'New job, court, gala, daily wear…',
    },
    {
      name: 'eventDate',
      label: 'Date you need it by (optional)',
      type: 'date',
      required: false,
    },
    {
      name: 'serviceType',
      label: 'What do you need?',
      type: 'select',
      required: true,
      options: ['Buy a new suit', 'Rent', 'Alterations only', 'Just exploring'],
    },
    {
      name: 'notes',
      label: 'Anything else?',
      type: 'textarea',
      required: false,
      maxLength: 500,
    },
  ],
};

export function isValidAudience(a) {
  return AUDIENCES.includes(a);
}

export function fieldNames(audience) {
  const schema = FIELD_SCHEMAS[audience];
  if (!schema) return [];
  return schema.map((f) => f.name);
}

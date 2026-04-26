/**
 * Per-audience field schema for step 2 of the booking form.
 * MUST stay in sync with assets/js/booking-form.js FIELD_SCHEMAS.
 * server.mjs runs a startup self-test that diffs both lists and exits if they drift.
 */

export const AUDIENCES = ['weddings', 'prom', 'professionals', 'other'];

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
  prom: [
    { name: 'promDate', label: 'Prom date', type: 'date', required: true },
    { name: 'school', label: 'School', type: 'text', required: true, maxLength: 80 },
    {
      name: 'lookGoal',
      label: 'What look are you going for?',
      type: 'select',
      required: true,
      options: ['Classic black tux', 'Bold color', 'Velvet', 'Three-piece', 'Not sure yet'],
    },
    {
      name: 'dateColor',
      label: "Your date's dress color (optional)",
      type: 'text',
      required: false,
      maxLength: 60,
      placeholder: 'Helps us coordinate',
    },
  ],
  professionals: [
    {
      name: 'occasion',
      label: "What's the suit for?",
      type: 'select',
      required: true,
      options: [
        'New job or promotion',
        'Court',
        'Conference or speaking',
        'Wardrobe refresh',
        'Daily wear',
      ],
    },
    {
      name: 'numSuits',
      label: 'How many suits?',
      type: 'select',
      required: true,
      options: ['1', '2-3', '4-6', '7+ (corporate)'],
    },
    {
      name: 'timeline',
      label: 'When do you need it by?',
      type: 'select',
      required: true,
      options: ['Within 2 weeks', '2-4 weeks', '1-2 months', 'No rush'],
    },
  ],
  other: [
    {
      name: 'occasion',
      label: "What's the occasion?",
      type: 'text',
      required: true,
      maxLength: 80,
      placeholder: 'Gala, court date, anniversary…',
    },
    { name: 'eventDate', label: 'Date of event', type: 'date', required: true },
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

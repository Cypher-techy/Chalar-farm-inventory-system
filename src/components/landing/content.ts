/**
 * Public marketing content for the Chalar Farms landing page.
 *
 * Every figure, name and claim below is taken from Chalar Farms' own published
 * material (chalarfarms.com and its About/CSR pages) or from the ERP's own
 * operational model. Nothing here is invented: no fabricated customers,
 * certificate numbers, testimonials or KPIs.
 */

export const COMPANY = {
  name: 'Chalar Farms Limited',
  tagline: 'Growers & Exporters of Fresh Herbs',
  established: 2015,
  location: 'Madulu A Village, Chala Ward, Taveta Sub-County, Taita-Taveta County, Kenya',
  addressLines: ['Madulu A Village, Chala Ward', 'Taveta Sub-County, Taita-Taveta County', 'Kenya'],
  phone: '+254 722 944 496',
  phoneHref: 'tel:+254722944496',
  email: 'info@chalarfarms.com',
  emailHref: 'mailto:info@chalarfarms.com',
  sisterFarm: 'Royal Herbs Exporters',
} as const;

export const HERO_STATS = [
  { value: 12, suffix: '+', label: 'Tonnes exported weekly' },
  { value: 150, suffix: '+', label: 'Trained team members' },
  { value: 70, suffix: '%', label: 'Female workforce' },
  { value: 9, suffix: '', label: 'Years of operation' },
] as const;

/** Floating produce chips in the hero — labelled with published weekly volumes. */
export const HERO_CHIPS = [
  {
    name: 'Sweet Basil',
    figure: '6 t',
    unit: 'per week, average',
    image: '/images/chalar/greenhouse-sweet-basil.jpg',
    alt: 'Sweet basil growing in a Chalar Farms greenhouse',
    depth: 0.06,
    className: 'lg:-mt-6',
  },
  {
    name: 'Rosemary',
    figure: '300 kg',
    unit: 'per week capacity',
    image: '/images/chalar/drip-irrigated-rosemary.jpg',
    alt: 'Drip-irrigated rosemary at Chalar Farms',
    depth: 0.14,
    className: 'lg:mt-10 lg:ml-16',
  },
  {
    name: 'Double-cut Chives',
    figure: '1 t',
    unit: 'per week, via sister farm',
    image: '/images/chalar/fresh-herb-bundle.jpg',
    alt: 'Freshly cut herb bundles from the Chalar Farms packhouse',
    depth: 0.1,
    className: 'lg:-mt-4 lg:ml-6',
  },
] as const;

export const HERBS = [
  {
    name: 'Basil',
    figure: '6 t',
    unit: 'average per week',
    note: 'Held at 8–10 °C — basil chills below that.',
    image: '/images/chalar/greenhouse-sweet-basil.jpg',
  },
  {
    name: 'Chives',
    figure: '1 t',
    unit: 'double-cut, per week',
    note: 'Supplied through our sister farm, Royal Herbs Exporters.',
    image: '/images/chalar/fresh-herb-bundle.jpg',
  },
  {
    name: 'Lemongrass',
    figure: '1 t',
    unit: 'per week',
    note: 'Open-field blocks under drip irrigation.',
    image: '/images/chalar/farm-aerial-taveta.jpg',
  },
  {
    name: 'Sage',
    figure: '1 t+',
    unit: 'during peak season',
    note: 'Volume peaks with the season; scheduled in crop cycles.',
    image: '/images/chalar/farm-fields-greenhouses.jpg',
  },
  {
    name: 'Thyme',
    figure: '300 kg',
    unit: 'every week',
    note: 'Hardy herb, packed in bunches and liners.',
    image: '/images/chalar/rosemary-blossom.jpg',
  },
  {
    name: 'Rosemary',
    figure: '300 kg',
    unit: 'per week capacity',
    note: 'Drip-irrigated blocks with logged input applications.',
    image: '/images/chalar/drip-irrigated-rosemary.jpg',
  },
  {
    name: 'Tarragon',
    figure: '250 kg',
    unit: 'per week',
    note: 'Hand-picked, graded and pre-cooled the same morning.',
    image: '/images/chalar/culinary-herb-garden.jpg',
  },
  {
    name: 'Oregano',
    figure: '200 kg',
    unit: 'every week',
    note: 'Packed to customer specification in 30–100 g bunches.',
    image: '/images/chalar/packhouse-herb-crates.jpg',
  },
] as const;

/** Marquee band: certifications and operating facts, all publicly listed. */
export const TICKER_ITEMS = [
  'GLOBALG.A.P. certified',
  'GRASP social practice',
  'SMETA ethical trade audit',
  'LEAF Marque',
  '12+ tonnes every week',
  'Year-round supply',
  'Taveta · Taita-Taveta',
  'EU · UK · Middle East',
  'Est. 2015',
] as const;

export const CERTIFICATIONS = [
  { code: 'GLOBALG.A.P.', label: 'Certified growing practice' },
  { code: 'GRASP', label: 'Social practice assessment' },
  { code: 'SMETA', label: 'Ethical trade audit' },
  { code: 'LEAF Marque', label: 'Environmental assurance' },
] as const;

export const JOURNEY = [
  {
    step: '01',
    title: 'Plan the cycle',
    body: 'Field blocks and greenhouse bays are planned as crop cycles with varieties, planting dates and expected harvest windows.',
    record: 'field_blocks · crop_cycles',
  },
  {
    step: '02',
    title: 'Grow and scout',
    body: 'Irrigation, input applications and pest scouting are logged against the block, so every intervention is attributable.',
    record: 'input_applications · scouting_logs',
  },
  {
    step: '03',
    title: 'Harvest at dawn',
    body: 'Each cut raises a harvest batch carrying block, cycle, crew and field weight — the identity that follows the produce all the way out.',
    record: 'harvest_batches',
  },
  {
    step: '04',
    title: 'Weigh in at the packhouse',
    body: 'Intake records accepted and rejected mass against the batch; washing loss is tracked so mass balance always reconciles.',
    record: 'packhouse_intakes',
  },
  {
    step: '05',
    title: 'Grade and pack',
    body: 'Packing orders convert accepted mass into 30 g, 75 g and 100 g bunches, 1–3 kg liners, sleeves or MAP bags, labelled per batch.',
    record: 'packing_orders',
  },
  {
    step: '06',
    title: 'Inspect and release',
    body: 'QA measurements decide the outcome server-side. Release authority sits with a second officer — never the inspector who scored the batch.',
    record: 'qa_inspections · qa_releases',
  },
  {
    step: '07',
    title: 'Cold chain and dispatch',
    body: 'Reefer trucks, temperature limits, phytosanitary and EUR.1 documents, airwaybill and customer are bound to the shipment before it leaves.',
    record: 'shipments · export_documents',
  },
] as const;

export const CUSTOMERS = [
  { name: 'Vitacress', market: 'United Kingdom' },
  { name: 'Fresh Choice', market: 'United Kingdom' },
  { name: 'VanVugt', market: 'Netherlands' },
  { name: 'Fresh Handling', market: 'Netherlands' },
  { name: 'Gaia', market: 'Netherlands' },
  { name: 'Herrmann Krauter', market: 'Germany' },
  { name: 'Baur', market: 'Switzerland' },
  { name: 'Magnani', market: 'Italy' },
  { name: 'Afrex', market: 'South Africa' },
  { name: 'Lauren International', market: 'Middle East' },
] as const;

export const COLD_CHAIN_SPECS = [
  {
    label: 'Cold chain',
    figure: '2–4',
    unit: '°C',
    detail: 'Most herbs',
    second: { figure: '8–10', unit: '°C', detail: 'Basil, held warmer' },
  },
  {
    label: 'Shelf life',
    figure: '~14',
    unit: 'days',
    detail: 'From pack, at correct temperature',
    second: null,
  },
  {
    label: 'Pack formats',
    figure: '30·75·100',
    unit: 'g bunches',
    detail: 'Plus 1–3 kg liners, sleeves & MAP bags',
    second: null,
  },
] as const;

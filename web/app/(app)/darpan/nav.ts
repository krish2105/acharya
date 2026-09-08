export const DARPAN_TABS = [
  { href: '/darpan', label: 'Completion' },
  { href: '/darpan/observations', label: 'Observations' },
  { href: '/darpan/inputs', label: '360° inputs' },
  { href: '/darpan/descriptors', label: 'Descriptors' },
  { href: '/darpan/reports', label: 'Reports' },
];

export const DOMAINS = ['cognitive', 'affective', 'socio_emotional', 'psychomotor'] as const;
export const DOMAIN_LABEL: Record<string, { en: string; hi: string }> = {
  cognitive: { en: 'Learning & understanding', hi: 'सीखना और समझ' },
  affective: { en: 'Attitudes, values & interests', hi: 'दृष्टिकोण, मूल्य और रुचियाँ' },
  socio_emotional: { en: 'Working with others', hi: 'दूसरों के साथ काम करना' },
  psychomotor: { en: 'Physical skills & creativity', hi: 'शारीरिक कौशल और रचनात्मकता' },
};
export const CONTEXTS = ['class discussion', 'group work', 'presentation', 'lab', 'sport', 'art', 'homework', 'play'];
export const CURRENT_TERM = 'T1 2026-27';

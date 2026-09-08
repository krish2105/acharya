export const PRASHNA_TABS = [
  { href: '/prashna', label: 'Overview' },
  { href: '/prashna/bank', label: 'Item bank' },
  { href: '/prashna/generate', label: 'Generate' },
  { href: '/prashna/review', label: 'HOD review' },
  { href: '/prashna/blueprints', label: 'Blueprints' },
  { href: '/prashna/papers', label: 'Papers' },
  { href: '/prashna/calibration', label: 'Calibration' },
];

export const ITEM_TYPES = ['mcq', 'assertion_reason', 'case_based', 'source_based', 'short_answer', 'long_answer', 'numerical', 'diagram', 'competency_cluster'] as const;
export const BLOOMS = ['remember', 'understand', 'apply', 'analyse', 'evaluate', 'create'] as const;
export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export const EXAM_KINDS = ['unit_test', 'midterm', 'preboard', 'main_board_practice', 'improvement_practice', 'mock'] as const;

export const label = (s: string) => s.replace(/_/g, ' ');

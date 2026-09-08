export const SAARTHI_TABS = [
  { href: '/saarthi', label: 'Overview' },
  { href: '/saarthi/plan', label: 'Lesson plan' },
  { href: '/saarthi/worksheet', label: 'Worksheet' },
  { href: '/saarthi/rubric', label: 'Rubric' },
  { href: '/saarthi/message', label: 'Parent message' },
  { href: '/saarthi/remediation', label: 'Remediation' },
  { href: '/saarthi/history', label: 'My artifacts' },
  { href: '/saarthi/time-saved', label: 'Time saved' },
];

export const KINDS = ['lesson_plan', 'worksheet', 'rubric', 'parent_message', 'activity', 'remediation_set', 'revision_sheet'] as const;
export type Kind = (typeof KINDS)[number];
export const KIND_LABEL: Record<Kind, string> = {
  lesson_plan: 'Lesson plan', worksheet: 'Differentiated worksheet', rubric: 'Rubric', parent_message: 'Parent message',
  activity: 'Activity', remediation_set: 'Remediation set', revision_sheet: 'Revision sheet',
};
export const KIND_ROUTE: Record<string, Kind> = { plan: 'lesson_plan', worksheet: 'worksheet', rubric: 'rubric', message: 'parent_message', activity: 'activity', revision: 'revision_sheet' };

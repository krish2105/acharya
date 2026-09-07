// The Section 3 permission matrix, transcribed as data. This is the single
// source of truth `can()` reads from -- do not duplicate role/module logic
// elsewhere.

export type Role =
  | 'super_admin'
  | 'principal'
  | 'academic_head'
  | 'board_coordinator'
  | 'hod'
  | 'teacher'
  | 'ct_ai_lead'
  | 'exam_officer'
  | 'parent'
  | 'student';

export type ModuleCode = 'setu' | 'prashna' | 'saarthi' | 'darpan' | 'uday';

export type AccessLevel =
  | { level: 'full' }
  | { level: 'config' }
  | { level: 'read' }
  | { level: 'none' }
  // "config" access that additionally can never see report/note content,
  // even though it can view module configuration (rule 2.1.3: super_admin
  // may never read DARPAN report content or teacher-student notes).
  | { level: 'config'; excludeContent: true }
  // read access, plus the ability to propose (not confirm) alignments.
  | { level: 'read'; canPropose: true }
  | { level: 'scoped'; scope: 'own_framework' }
  | { level: 'scoped'; scope: 'own_subject'; canApproveItems?: true }
  | { level: 'scoped'; scope: 'own_classes' }
  | { level: 'scoped'; scope: 'own_students' }
  | { level: 'scoped'; scope: 'own_child' }
  | { level: 'scoped'; scope: 'own_self_and_peers' }
  | { level: 'scoped'; scope: 'own_projects' };

export const MATRIX: Record<Role, Record<ModuleCode, AccessLevel>> = {
  super_admin: {
    setu: { level: 'config' },
    prashna: { level: 'config' },
    saarthi: { level: 'config' },
    darpan: { level: 'config', excludeContent: true },
    uday: { level: 'config' },
  },
  principal: {
    setu: { level: 'full' },
    prashna: { level: 'full' },
    saarthi: { level: 'full' },
    darpan: { level: 'full' },
    uday: { level: 'full' },
  },
  academic_head: {
    setu: { level: 'full' },
    prashna: { level: 'full' },
    saarthi: { level: 'full' },
    darpan: { level: 'full' },
    uday: { level: 'full' },
  },
  board_coordinator: {
    setu: { level: 'scoped', scope: 'own_framework' },
    prashna: { level: 'scoped', scope: 'own_framework' },
    saarthi: { level: 'scoped', scope: 'own_framework' },
    darpan: { level: 'scoped', scope: 'own_framework' },
    uday: { level: 'read' },
  },
  hod: {
    setu: { level: 'scoped', scope: 'own_subject' },
    prashna: { level: 'scoped', scope: 'own_subject', canApproveItems: true },
    saarthi: { level: 'scoped', scope: 'own_subject' },
    darpan: { level: 'read' },
    uday: { level: 'read' },
  },
  teacher: {
    setu: { level: 'read', canPropose: true },
    prashna: { level: 'scoped', scope: 'own_classes' }, // own items, own papers
    saarthi: { level: 'scoped', scope: 'own_classes' }, // full for own classes
    darpan: { level: 'scoped', scope: 'own_students' },
    uday: { level: 'scoped', scope: 'own_classes' },
  },
  ct_ai_lead: {
    setu: { level: 'read' },
    prashna: { level: 'read' },
    saarthi: { level: 'read' },
    darpan: { level: 'none' },
    uday: { level: 'full' },
  },
  exam_officer: {
    setu: { level: 'read' },
    prashna: { level: 'full' }, // full papers + blueprints
    saarthi: { level: 'none' },
    darpan: { level: 'none' },
    uday: { level: 'none' },
  },
  parent: {
    setu: { level: 'none' },
    prashna: { level: 'none' },
    saarthi: { level: 'none' },
    darpan: { level: 'scoped', scope: 'own_child' },
    uday: { level: 'none' },
  },
  student: {
    setu: { level: 'none' },
    prashna: { level: 'none' },
    saarthi: { level: 'none' },
    darpan: { level: 'scoped', scope: 'own_self_and_peers' },
    uday: { level: 'scoped', scope: 'own_projects' },
  },
};

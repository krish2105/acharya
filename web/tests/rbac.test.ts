import { describe, expect, it } from 'vitest';
import { can, type AuthedUser } from '@/lib/rbac';

function user(overrides: Partial<AuthedUser>): AuthedUser {
  return {
    id: 'u1',
    role: 'teacher',
    schoolId: 's1',
    frameworkId: null,
    subjectId: null,
    ...overrides,
  };
}

describe('rbac: full and none access', () => {
  it('principal has full access to every module', () => {
    const principal = user({ id: 'p1', role: 'principal' });
    for (const mod of ['setu', 'prashna', 'saarthi', 'darpan', 'uday'] as const) {
      expect(can(principal, 'view', mod)).toBe(true);
      expect(can(principal, 'approve', mod)).toBe(true);
      expect(can(principal, 'config', mod)).toBe(true);
    }
  });

  it('parent has no access outside DARPAN', () => {
    const parent = user({ id: 'g1', role: 'parent' });
    expect(can(parent, 'view', 'setu')).toBe(false);
    expect(can(parent, 'view', 'prashna')).toBe(false);
    expect(can(parent, 'view', 'saarthi')).toBe(false);
    expect(can(parent, 'view', 'uday')).toBe(false);
  });

  it('exam_officer has no access to SAARTHI, DARPAN or UDAY', () => {
    const examOfficer = user({ id: 'e1', role: 'exam_officer' });
    expect(can(examOfficer, 'view', 'saarthi')).toBe(false);
    expect(can(examOfficer, 'view', 'darpan')).toBe(false);
    expect(can(examOfficer, 'view', 'uday')).toBe(false);
    expect(can(examOfficer, 'edit', 'prashna')).toBe(true); // full papers + blueprints
  });
});

describe('rbac: super_admin is excluded from DARPAN report content (rule 2.1.3)', () => {
  const superAdmin = user({ id: 'sa1', role: 'super_admin' });

  it('can configure DARPAN', () => {
    expect(can(superAdmin, 'config', 'darpan')).toBe(true);
  });

  it('cannot view DARPAN report content in any tenant', () => {
    expect(can(superAdmin, 'view', 'darpan', { isReportContent: true })).toBe(false);
  });

  it('can still view non-content DARPAN config surfaces', () => {
    expect(can(superAdmin, 'view', 'darpan', { isReportContent: false })).toBe(true);
  });

  it('can configure every other module too', () => {
    for (const mod of ['setu', 'prashna', 'saarthi', 'uday'] as const) {
      expect(can(superAdmin, 'config', mod)).toBe(true);
    }
  });
});

describe('rbac: board_coordinator is scoped to their own framework', () => {
  const ibCoordinator = user({ id: 'bc1', role: 'board_coordinator', frameworkId: 'ib-dp' });

  it('can act on resources in their own framework', () => {
    expect(can(ibCoordinator, 'edit', 'setu', { frameworkId: 'ib-dp' })).toBe(true);
  });

  it('cannot act on another framework\'s resources', () => {
    expect(can(ibCoordinator, 'edit', 'setu', { frameworkId: 'cbse' })).toBe(false);
  });

  it('has read-only access to UDAY (not framework-scoped)', () => {
    expect(can(ibCoordinator, 'view', 'uday')).toBe(true);
    expect(can(ibCoordinator, 'edit', 'uday')).toBe(false);
  });
});

describe('rbac: hod is scoped to their own subject, with item-approval in PRASHNA', () => {
  const scienceHod = user({ id: 'h1', role: 'hod', subjectId: 'science' });

  it('can edit within their own subject', () => {
    expect(can(scienceHod, 'edit', 'saarthi', { subjectId: 'science' })).toBe(true);
    expect(can(scienceHod, 'edit', 'saarthi', { subjectId: 'maths' })).toBe(false);
  });

  it('can approve PRASHNA items in their own subject only', () => {
    expect(can(scienceHod, 'approve', 'prashna', { subjectId: 'science' })).toBe(true);
    expect(can(scienceHod, 'approve', 'prashna', { subjectId: 'maths' })).toBe(false);
  });

  it('has read-only access to DARPAN and UDAY', () => {
    expect(can(scienceHod, 'view', 'darpan')).toBe(true);
    expect(can(scienceHod, 'edit', 'darpan')).toBe(false);
  });
});

describe('rbac: teacher scoping', () => {
  const teacher = user({ id: 't1', role: 'teacher' });

  it('can propose (not confirm) SETU alignments', () => {
    expect(can(teacher, 'propose', 'setu')).toBe(true);
    expect(can(teacher, 'approve', 'setu')).toBe(false);
  });

  it('has full control over their own classes in SAARTHI', () => {
    expect(can(teacher, 'edit', 'saarthi', { teacherId: 't1' })).toBe(true);
    expect(can(teacher, 'edit', 'saarthi', { teacherId: 'someone-else' })).toBe(false);
  });
});

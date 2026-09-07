import { MATRIX, type ModuleCode, type Role } from './matrix';

export type Action = 'view' | 'create' | 'edit' | 'approve' | 'config' | 'propose';

export interface AuthedUser {
  id: string;
  role: Role;
  schoolId: string;
  frameworkId: string | null;
  subjectId: string | null;
}

// The entity being acted on. Only the fields relevant to the module's scope
// need to be supplied; `can` only reads the ones it needs to decide.
export interface Resource {
  frameworkId?: string | null;
  subjectId?: string | null;
  teacherId?: string | null; // owning teacher, for "own classes"/"own items"
  studentId?: string | null; // for "own students"/"own child"/"own self"
  guardianUserId?: string | null; // parent portal: which auth user is the guardian
  isReportContent?: boolean; // DARPAN: observations, descriptors, hpc_reports
}

/**
 * All UI gating routes through this function (Section 8, Phase 0 task 4).
 * The database's RLS policies are the actual security boundary; this is
 * for deciding what to render, not a substitute for RLS.
 */
export function can(user: AuthedUser, action: Action, module: ModuleCode, resource?: Resource): boolean {
  const cell = MATRIX[user.role][module];

  if (cell.level === 'none') return false;

  if (cell.level === 'full') return true;

  if (cell.level === 'config') {
    if (action === 'config') return true;
    if (action === 'view') {
      if ('excludeContent' in cell && cell.excludeContent && resource?.isReportContent) return false;
      return true;
    }
    return false;
  }

  if (cell.level === 'read') {
    if (action === 'view') return true;
    if (action === 'propose') return 'canPropose' in cell && cell.canPropose === true;
    return false;
  }

  // scoped
  if (action === 'view') return true; // scoped roles can see their own slice's UI

  switch (cell.scope) {
    case 'own_framework':
      return resource?.frameworkId != null && resource.frameworkId === user.frameworkId;

    case 'own_subject':
      if (action === 'approve') {
        return 'canApproveItems' in cell && cell.canApproveItems === true &&
          resource?.subjectId != null && resource.subjectId === user.subjectId;
      }
      return resource?.subjectId != null && resource.subjectId === user.subjectId;

    case 'own_classes':
      return resource?.teacherId != null && resource.teacherId === user.id;

    case 'own_students':
      // teacher: gated by teaching_assignments at the data layer; here we
      // only confirm the resource is scoped to a specific student, not to
      // the whole tenant. Real enforcement is the observation_scope RLS
      // policy pattern from Section 6.8.
      return resource?.studentId != null;

    case 'own_child':
      return resource?.guardianUserId != null && resource.guardianUserId === user.id;

    case 'own_self_and_peers':
      return resource?.studentId != null;

    case 'own_projects':
      return resource?.studentId != null && resource.studentId === user.id;

    default:
      return false;
  }
}

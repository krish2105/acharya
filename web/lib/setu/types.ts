export interface OutcomeRow {
  id: string;
  ref_code: string;
  statement: string;
  grade: string;
  cognitive_level: string | null;
  framework_id: string;
  subject_id: string | null;
  frameworks: { code: string; name: string } | null;
  subjects: { name: string; code: string } | null;
}

export interface ConceptRow {
  id: string;
  title: string;
  description: string | null;
  stage: string | null;
  parent_id: string | null;
  subject_id: string | null;
}

export interface PendingLink {
  learning_outcome_id: string;
  concept_id: string;
  confidence: number | null;
  method: 'embedding_suggested' | 'llm_suggested';
  justification: string | null;
  outcome: { ref_code: string; statement: string; grade: string; frameworks: { code: string } | null } | null;
  concept: { title: string; description: string | null } | null;
}

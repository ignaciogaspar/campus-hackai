export interface Reflection {
  id: string; session_id: string; person_id: string
  takeaway: string; unclear: string; application: string
  revision: number; updated_at: string
}

/** Only published fields cross the student boundary. */
export interface Feedback {
  id: string; session_id: string; person_id: string
  body: string; action_label: string; action_href: string
  visible_at: string; publication_id: string; read_at: string | null; applied_at: string | null
}

export interface FeedbackDraft extends Omit<Feedback, 'body' | 'visible_at' | 'publication_id'> {
  body: string | null; visible_at: string | null; publication_id: string | null
  draft_body: string; draft_action_label: string; draft_action_href: string
  revision: number; updated_at: string
}

export interface LearningSession {
  id: string; ordinal: number; title: string; starts_at: string | null; deck_id: string | null
}

export interface LearningActionState { ok?: string; error?: string; revision?: number }

export interface NextStep {
  kind: 'live' | 'overdue' | 'feedback' | 'reflection' | 'prepare' | 'history'
  eyebrow: string; title: string; detail: string; label: string; href: string
}

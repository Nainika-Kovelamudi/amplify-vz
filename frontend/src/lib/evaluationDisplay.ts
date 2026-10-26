const currentWeights: Record<string, number> = {
  relevance: 18, tech_quality: 22, description: 12, demo_readiness: 13,
  duplicate_check: 10, document_validation: 13, video_validation: 12,
};
const legacyWeights: Record<string, number> = {
  relevance: 25, tech_quality: 30, description: 15, demo_readiness: 20, duplicate_check: 10,
};

export function evaluationWeights(feedback: Record<string, unknown> | null) {
  const stored = feedback?.weights as Record<string, number> | undefined;
  if (stored && Object.values(stored).every(v => typeof v === 'number' && Number.isFinite(v))) return stored;
  const scores = feedback?.agent_scores as Record<string, number> | undefined;
  return scores && ('document_validation' in scores || 'video_validation' in scores) ? currentWeights : legacyWeights;
}

export function scoreExplanation(feedback: Record<string, unknown> | null): string | null {
  if (!feedback) return null;
  const cap = feedback.applied_cap;
  const raw = feedback.raw_score;
  if (typeof cap === 'number' && typeof raw === 'number' && raw > cap) {
    return `Weighted score ${raw.toFixed(1)} was capped at ${cap} by the completeness and pre-approval checks. Review the pre-approval checklist and submission metadata.`;
  }
  const fails = feedback.checklist_fails;
  if (Array.isArray(fails) && fails.length) return `Pre-approval failures (${fails.join(', ')}) may cap the overall score below the weighted agent total. Review the checklist before resubmitting.`;
  return null;
}

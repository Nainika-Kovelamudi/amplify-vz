export const ViewState = {
  ASSESSMENT: 'ASSESSMENT',
  RESULT: 'RESULT',
  RULES: 'RULES',
  LOGIN: 'LOGIN',
  ADMIN: 'ADMIN',
} as const;

export type ViewState = (typeof ViewState)[keyof typeof ViewState];

export const ModelChoice = {
  SLM: 'Small Language Model (SLM)',
  LLM: 'Large Language Model (LLM)',
} as const;

export type ModelChoice = (typeof ModelChoice)[keyof typeof ModelChoice];

export interface FormData {
  // User Info
  userName: string;
  email: string;
  companyName: string;
  projectName: string;
  projectDescription: string;

  // Gatekeepers (G1-G7)
  g1_edge: boolean;
  g2_offline: boolean;
  g3_dataResidency: boolean;
  g4_regulatory: boolean;
  g5_externalApi: 'not_acceptable' | 'risk_mitigation' | 'fully_acceptable';
  g6_infraRefusal: boolean;
  g7_timeToMarket: boolean;

  // Scored Questions (S1-S14) - Scale 1-5
  s1_latency: number;
  s2_volume: number;
  s3_cost: number;
  s4_longevity: number;
  s5_narrowness: number;
  s6_domain: number;
  s7_determinism: number;
  s8_explainability: number;
  s9_readiness: number;
  s10_maintenance: number;
  s11_investment: number;
  s12_breadth: number; // Reverse
  s13_experimentation: number; // Reverse
  s14_lowVolume: number; // Reverse
}

export interface Submission {
  id: string;
  user: string;
  timestamp: Date;
  data: FormData;
  score: number;
  maxScore: number;
  decision: ModelChoice;
  aiExplanation: string;
  hardBlocker?: string; // Reason if a gatekeeper forced the decision
}

// --- Question Definitions ---

export const GATEKEEPER_QUESTIONS = [
  {
    id: 'g1_edge',
    label: 'Does this solution require on-device or edge deployment?',
    subLabel: '(e.g., mobile apps, kiosks, embedded systems, offline-first environments)',
    type: 'binary',
    forceDecision: ModelChoice.SLM,
    hardBlockerText: 'On-device or edge deployment requirement'
  },
  {
    id: 'g2_offline',
    label: 'Must the solution operate in environments with limited or no internet connectivity?',
    type: 'binary',
    forceDecision: ModelChoice.SLM,
    hardBlockerText: 'Offline or limited connectivity requirement'
  },
  {
    id: 'g3_dataResidency',
    label: 'Must all data processed by the model remain within your internal infrastructure at all times?',
    subLabel: '(e.g., confidential, regulated, proprietary data)',
    type: 'binary',
    forceDecision: ModelChoice.SLM,
    hardBlockerText: 'Internal-only data and inference requirement'
  },
  {
    id: 'g4_regulatory',
    label: 'Are there regulatory, legal, or contractual obligations requiring full control over the model and inference process?',
    subLabel: '(e.g., healthcare, finance, government, enterprise IP protection)',
    type: 'binary',
    forceDecision: ModelChoice.SLM,
    hardBlockerText: 'Regulatory mandate for model control'
  },
  // G5 is a select, handled separately in UI logic
  {
    id: 'g6_infraRefusal',
    label: 'Is the organization unwilling to host or manage AI infrastructure under any circumstances?',
    type: 'binary',
    forceDecision: ModelChoice.LLM, // Overrides SLM
    hardBlockerText: 'Organization refuses infrastructure ownership'
  },
  {
    id: 'g7_timeToMarket',
    label: 'Is immediate production readiness required (weeks rather than months)?',
    type: 'binary',
    forceDecision: ModelChoice.LLM, // Overrides SLM
    hardBlockerText: 'Time-to-market constraint favors managed LLMs'
  }
];

export const SCORED_QUESTIONS = [
  { id: 's1_latency', text: 'Sub-100ms response latency is critical to the user experience.', weight: 5, reverse: false },
  { id: 's2_volume', text: 'This system will handle high or rapidly growing request volumes.', weight: 5, reverse: false },
  { id: 's3_cost', text: 'Predictable, fixed operating costs are preferred over usage-based pricing.', weight: 4, reverse: false },
  { id: 's4_longevity', text: 'This system is expected to remain in production for 3 years or more.', weight: 4, reverse: false },
  { id: 's5_narrowness', text: 'The use case is narrow, repetitive, and well-defined.', weight: 3, reverse: false },
  { id: 's6_domain', text: 'The solution relies heavily on domain-specific terminology or workflows.', weight: 3, reverse: false },
  { id: 's7_determinism', text: 'Deterministic, tightly controlled outputs are required.', weight: 3, reverse: false },
  { id: 's8_explainability', text: 'Explainability or auditability of model behavior is important.', weight: 3, reverse: false },
  { id: 's9_readiness', text: 'Our organization has the technical capability to host and manage AI models.', weight: 4, reverse: false },
  { id: 's10_maintenance', text: 'We are comfortable maintaining infrastructure for model deployment, scaling, and monitoring.', weight: 3, reverse: false },
  { id: 's11_investment', text: 'We are willing to invest upfront in exchange for long-term operational benefits.', weight: 4, reverse: false },
  // Reverse Indicators (High Agreement = Favors LLM)
  { id: 's12_breadth', text: 'This solution requires broad general intelligence across many unrelated tasks.', weight: 4, reverse: true },
  { id: 's13_experimentation', text: 'Rapid experimentation and speed to market are more important than optimization and control.', weight: 3, reverse: true },
  { id: 's14_lowVolume', text: 'The expected request volume is low and unlikely to scale significantly.', weight: 4, reverse: true },
];

// Based on Sum of Weights (52) * 5
export const MAX_POSSIBLE_SCORE = 260; 
export const SCORING_THRESHOLD = 130; // 50% midpoint
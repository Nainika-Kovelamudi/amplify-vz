import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { ViewState, ModelChoice, GATEKEEPER_QUESTIONS, SCORED_QUESTIONS, SCORING_THRESHOLD, MAX_POSSIBLE_SCORE } from './types';
import type { FormData, Submission, ModelChoice as ModelChoiceType } from './types';
import { generateEvaluation, generateRandomScenario } from './services/gemini';
import { fetchSubmissions, saveSubmission } from './services/database';
import { AlertCircle, ArrowRight, Lock, ShieldCheck, User, Activity, BrainCircuit, Sparkles, ChevronRight, MessageSquare } from 'lucide-react';

// --- Rich display for AI explanation: intro box, bullet cards, bold phrases (no bg) ---
function renderBoldPhrases(text: string | undefined): React.ReactNode[] {
  if (text == null || typeof text !== 'string' || !text.trim()) return [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const match = part.match(/^\*\*(.+)\*\*$/);
    if (match) return <strong key={i} className="font-semibold text-slate-900">{match[1]}</strong>;
    return part;
  });
}

function ExplanationDisplay({ text, variant = 'result' }: { text: string | undefined; variant?: 'result' | 'dashboard' }) {
  const safeText = text != null && typeof text === 'string' ? text : '';
  const lines = safeText.split(/\n/).map(l => l.trim()).filter(Boolean);
  const introLines: string[] = [];
  const bulletLines: string[] = [];
  let foundBullet = false;
  for (const line of lines) {
    const isBullet = /^[•\-\*]\s*/.test(line) || line.startsWith('•');
    const bulletContent = line.replace(/^[•\-\*]\s*/, '').trim();
    if (isBullet && bulletContent) {
      foundBullet = true;
      bulletLines.push(bulletContent);
    } else if (!foundBullet && line) {
      introLines.push(line);
    } else if (foundBullet && line && !/^[•\-\*]\s*/.test(line)) {
      bulletLines.push(line);
    }
  }
  const introText = introLines.join(' ').trim();
  const compact = variant === 'dashboard';

  return (
    <div className="space-y-4">
      {introText && (
        <div className={`rounded-xl border-l-4 ${compact ? 'p-4' : 'p-5'} bg-gradient-to-r from-indigo-50 to-slate-50 border-indigo-400 shadow-sm`}>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">Key takeaway</p>
              <p className={`text-slate-800 leading-relaxed ${compact ? 'text-sm' : 'text-base'}`}>
                {renderBoldPhrases(introText)}
              </p>
            </div>
          </div>
        </div>
      )}
      {bulletLines.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Supporting points</p>
          {bulletLines.map((line, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-lg border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow ${compact ? 'p-3' : 'p-4'}`}
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center mt-0.5">
                <ChevronRight className="w-4 h-4 text-emerald-600" />
              </div>
              <p className={`text-slate-700 leading-relaxed flex-1 ${compact ? 'text-sm' : 'text-base'}`}>
                {renderBoldPhrases(line)}
              </p>
            </div>
          ))}
        </div>
      )}
      {!introText && bulletLines.length === 0 && (
        <p className="text-slate-500 italic">
          {safeText ? safeText : 'No explanation available. The AI analysis may still be loading or was not saved.'}
        </p>
      )}
    </div>
  );
}

export function ArchevalTool() {
  const [view, setView] = useState<ViewState>(ViewState.ASSESSMENT);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [currentSubmission, setCurrentSubmission] = useState<Submission | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // --- INITIAL DATA LOAD ---
  useEffect(() => {
    const loadData = async () => {
      try {
        const dbData = await fetchSubmissions();
        setSubmissions(dbData);
      } catch (e) {
        console.error('Failed to load data', e);
        setSubmissions([]);
      } finally {
        setIsLoading(false);
      }
    };
    void loadData();
  }, []);

  const refreshSubmissions = useCallback(async () => {
    const dbData = await fetchSubmissions();
    setSubmissions(dbData);
    return dbData;
  }, []);

  // --- SCROLL TO TOP ON VIEW CHANGE ---
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  // --- ACTIONS ---
  const handleAssessmentSubmit = async (data: FormData) => {
    let decision: ModelChoiceType = ModelChoice.LLM;
    let hardBlocker = undefined;
    
    // --- 1. GATEKEEPER LOGIC ---
    // Priority: G6/G7 (Force LLM) > G1-G4 (Force SLM)
    
    // Check LLM Forcers first (Strongest Blockers against SLM)
    if (data.g6_infraRefusal) {
        decision = ModelChoice.LLM;
        hardBlocker = "Organization refuses infrastructure ownership (SLM Infeasible)";
    } else if (data.g7_timeToMarket) {
        decision = ModelChoice.LLM;
        hardBlocker = "Time-to-market constraint favors managed LLMs";
    } 
    // If no LLM force, check SLM Forcers
    else if (data.g1_edge) {
        decision = ModelChoice.SLM;
        hardBlocker = "On-device or edge deployment requirement";
    } else if (data.g2_offline) {
        decision = ModelChoice.SLM;
        hardBlocker = "Offline or limited connectivity requirement";
    } else if (data.g3_dataResidency) {
        decision = ModelChoice.SLM;
        hardBlocker = "Internal-only data and inference requirement";
    } else if (data.g4_regulatory) {
        decision = ModelChoice.SLM;
        hardBlocker = "Regulatory mandate for model control";
    }

    // --- 2. SCORING LOGIC ---
    // Calculate score regardless of gatekeepers for reporting
    let weightedScore = 0;
    
    SCORED_QUESTIONS.forEach(q => {
        const userValue = data[q.id as keyof FormData] as number;
        // If reverse: (6 - userValue) * weight. If normal: userValue * weight.
        const effectiveValue = q.reverse ? (6 - userValue) : userValue;
        weightedScore += effectiveValue * q.weight;
    });

    // If no hard blocker, use score
    if (!hardBlocker) {
        // G5 Check: "Not Acceptable" strongly favors SLM. 
        // We can treat it as a tie-breaker or simple weight. 
        // Given the prompt, let's let the score drive, but G5 is implicitly captured in risk/readiness questions often.
        // If G5 is not_acceptable, we might nudge, but let's stick to the math:
        
        if (weightedScore >= SCORING_THRESHOLD) {
            decision = ModelChoice.SLM;
        } else {
            decision = ModelChoice.LLM;
        }
    }

    // 3. Create Submission Object
    const tempId = Math.random().toString(36).substr(2, 9);
    const newSubmission: Submission = {
      id: tempId,
      user: data.userName || 'Guest User',
      timestamp: new Date(),
      data,
      score: weightedScore,
      maxScore: MAX_POSSIBLE_SCORE,
      decision,
      hardBlocker,
      aiExplanation: "Analyzing detailed constraints..."
    };

    setCurrentSubmission(newSubmission);
    setView(ViewState.RESULT);

    // 4. Async AI Call
    const explanation = await generateEvaluation(data, decision, weightedScore, hardBlocker);
    
    const finalSubmission = { ...newSubmission, aiExplanation: explanation };
    setCurrentSubmission(finalSubmission);
    
    // 5. Update State & DB
    setSubmissions(prev => [finalSubmission, ...prev]);
    await saveSubmission(finalSubmission);
  };

  const handleLogin = async (success: boolean) => {
    if (success) {
      setIsAdmin(true);
      await refreshSubmissions();
      setView(ViewState.ADMIN);
    }
  };

  if (isLoading) {
    return <div className="bg-slate-50 flex items-center py-24 justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>;
  }

  return (
    <div className="bg-slate-50 flex flex-col font-sans text-slate-900 min-h-0">
      <Navbar currentView={view} changeView={setView} isAdmin={isAdmin} />
      
      <main className={`flex-grow flex flex-col min-h-0 ${view === ViewState.ADMIN ? 'min-h-[calc(100vh-12rem)]' : ''}`}>
        {view === ViewState.ASSESSMENT && <AssessmentPage onSubmit={handleAssessmentSubmit} />}
        {view === ViewState.RESULT && currentSubmission && <ResultPage submission={currentSubmission} onReset={() => setView(ViewState.ASSESSMENT)} onViewRules={() => setView(ViewState.RULES)} />}
        {view === ViewState.RULES && <RulesPage />}
        {view === ViewState.LOGIN && <LoginPage onLogin={handleLogin} />}
        {view === ViewState.ADMIN && <AdminPage submissions={submissions} onRefresh={refreshSubmissions} />}
      </main>
      
    </div>
  );
}

// ==========================================
// PAGE 1: ASSESSMENT FORM (UPDATED)
// ==========================================
const AssessmentPage = ({ onSubmit }: { onSubmit: (data: FormData) => void }) => {
  const [formData, setFormData] = useState<Partial<FormData>>({
    // Defaults for likert to middle to avoid nulls
    s1_latency: 3, s2_volume: 3, s3_cost: 3, s4_longevity: 3, s5_narrowness: 3, 
    s6_domain: 3, s7_determinism: 3, s8_explainability: 3, s9_readiness: 3, 
    s10_maintenance: 3, s11_investment: 3, s12_breadth: 3, s13_experimentation: 3, s14_lowVolume: 3,
    g1_edge: false, g2_offline: false, g3_dataResidency: false, g4_regulatory: false, g6_infraRefusal: false, g7_timeToMarket: false,
    g5_externalApi: 'risk_mitigation' as any
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerateScenario = async () => {
    setIsGenerating(true);
    const scenario = await generateRandomScenario();
    if (scenario) {
      setFormData(scenario);
    } else {
      alert("Could not generate scenario. Please check your network.");
    }
    setIsGenerating(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.projectName || !formData.projectDescription || !formData.userName) {
        alert("Please fill in the required User Info fields.");
        return;
    }
    setIsSubmitting(true);
    onSubmit(formData as FormData);
  };

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-10">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">SLM vs LLM Decision Assessment</h1>
        <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
          Evaluate deployment constraints, scale, and operational readiness to determine the optimal AI model class.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* ACTION BAR */}
        <div className="flex justify-end mb-2">
             <button 
              type="button" 
              onClick={handleGenerateScenario}
              disabled={isGenerating}
              className="text-indigo-600 hover:text-white text-sm font-semibold hover:bg-indigo-600 border border-indigo-200 hover:border-indigo-600 flex items-center bg-indigo-50 px-5 py-2.5 rounded-full transition-all duration-300 shadow-sm"
             >
               {isGenerating ? 'Generating...' : <><Sparkles className="w-4 h-4 mr-2" /> Auto-Fill Scenario</>}
             </button>
        </div>

        {/* SECTION 1: USER INFO */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center">
            <User className="w-5 h-5 text-indigo-600 mr-2.5" />
            <h2 className="text-xl font-bold text-slate-800">User Information</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Name *</label>
                <input required type="text" className="w-full px-3 py-2.5 text-sm border border-slate-300 bg-white text-slate-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition" 
                  value={formData.userName || ''} onChange={(e) => handleChange('userName', e.target.value)} />
            </div>
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email *</label>
                <input required type="email" className="w-full px-3 py-2.5 text-sm border border-slate-300 bg-white text-slate-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition" 
                  value={formData.email || ''} onChange={(e) => handleChange('email', e.target.value)} />
            </div>
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Company Name</label>
                <input type="text" className="w-full px-3 py-2.5 text-sm border border-slate-300 bg-white text-slate-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition" 
                  value={formData.companyName || ''} onChange={(e) => handleChange('companyName', e.target.value)} />
            </div>
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Project Name *</label>
                <input required type="text" className="w-full px-3 py-2.5 text-sm border border-slate-300 bg-white text-slate-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition" 
                  value={formData.projectName || ''} onChange={(e) => handleChange('projectName', e.target.value)} />
            </div>
            <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Project Description * (Min 100 chars)</label>
                <textarea required minLength={100} className="w-full px-3 py-2.5 text-sm border border-slate-300 bg-white text-slate-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none transition" 
                  placeholder="Describe your use case..."
                  value={formData.projectDescription || ''} onChange={(e) => handleChange('projectDescription', e.target.value)} />
            </div>
          </div>
        </div>

        {/* SECTION 2: GATEKEEPERS */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center">
                <ShieldCheck className="w-5 h-5 text-red-600 mr-2.5" />
                <h2 className="text-xl font-bold text-slate-800">Deployment & Compliance Gatekeepers</h2>
            </div>
            <span className="text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-bold uppercase tracking-wide">High Priority</span>
          </div>
          <div className="p-6 space-y-5">
            {GATEKEEPER_QUESTIONS.map((q) => (
                <div key={q.id} className="flex flex-col md:flex-row md:items-center justify-between py-3 border-b border-slate-100 last:border-0">
                    <div className="pr-4 mb-3 md:mb-0 max-w-3xl">
                        <p className="text-base font-semibold text-slate-800 leading-snug">{q.label}</p>
                        {q.subLabel && <p className="text-sm text-slate-500 mt-1">{q.subLabel}</p>}
                    </div>
                    <div className="flex space-x-2 flex-shrink-0">
                         <button type="button" 
                            onClick={() => handleChange(q.id as keyof FormData, true)}
                            className={`px-5 py-2 rounded-lg text-sm font-bold transition shadow-sm border ${formData[q.id as keyof FormData] === true ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                            Yes
                         </button>
                         <button type="button" 
                            onClick={() => handleChange(q.id as keyof FormData, false)}
                            className={`px-5 py-2 rounded-lg text-sm font-bold transition shadow-sm border ${formData[q.id as keyof FormData] === false ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                            No
                         </button>
                    </div>
                </div>
            ))}
            {/* G5 Special Case */}
            <div className="flex flex-col md:flex-row md:items-center justify-between py-3">
                <div className="pr-4 mb-3 md:mb-0">
                    <p className="text-base font-semibold text-slate-800">How acceptable is dependency on third-party AI APIs?</p>
                </div>
                <div className="relative">
                  <select 
                      value={formData.g5_externalApi}
                      onChange={(e) => handleChange('g5_externalApi', e.target.value)}
                      className="bg-white border border-slate-300 text-slate-800 text-sm font-medium rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full md:w-auto p-2.5 pr-8 shadow-sm outline-none cursor-pointer"
                  >
                      <option value="not_acceptable">Not acceptable under any circumstances</option>
                      <option value="risk_mitigation">Acceptable with risk mitigation</option>
                      <option value="fully_acceptable">Fully acceptable</option>
                  </select>
                </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: SCORED QUESTIONS */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center">
            <Activity className="w-5 h-5 text-indigo-600 mr-2.5" />
            <h2 className="text-xl font-bold text-slate-800">Operational & Strategic Assessment</h2>
          </div>
          <div className="p-6 space-y-8">
            <div className="bg-indigo-50 p-3 rounded-lg flex items-start">
               <div className="bg-indigo-200 p-0.5 rounded-full mr-2.5 mt-0.5"><Activity className="w-3.5 h-3.5 text-indigo-700" /></div>
               <p className="text-sm text-indigo-900 font-medium">Rate your agreement with the following statements on a scale from 1 (Strongly Disagree) to 5 (Strongly Agree).</p>
            </div>
            
            {SCORED_QUESTIONS.map((q) => (
                <div key={q.id} className="border-b border-slate-100 pb-6 last:pb-0 last:border-0">
                    <div className="mb-3">
                        <label className="text-base font-semibold text-slate-800 leading-snug block mb-2">{q.text}</label>
                    </div>
                    
                    {/* CUSTOM RATING BUTTONS 1-5 */}
                    <div className="flex flex-col space-y-2">
                      <div className="flex gap-2 w-full">
                        {[1, 2, 3, 4, 5].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => handleChange(q.id as keyof FormData, val)}
                            className={`flex-1 py-2.5 rounded-lg text-sm md:text-base font-bold transition-all border shadow-sm ${
                              (formData[q.id as keyof FormData] as number) === val
                                ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-200 transform scale-[1.02]'
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-600'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                      <div className="flex justify-between px-1 mt-0.5">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Strongly Disagree</span>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Neutral</span>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Strongly Agree</span>
                      </div>
                    </div>
                </div>
            ))}
          </div>
        </div>

        <button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-lg py-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex justify-center items-center transform hover:-translate-y-0.5"
        >
          {isSubmitting ? 'Analyzing Framework...' : 'Generate Recommendation'}
          {!isSubmitting && <ArrowRight className="ml-2.5 w-5 h-5" />}
        </button>

      </form>
    </div>
  );
};

// ==========================================
// PAGE 2: RESULT (UPDATED)
// ==========================================
const ResultPage = ({ submission, onReset, onViewRules }: { submission: Submission, onReset: () => void, onViewRules: () => void }) => {
  const isLLM = submission.decision === ModelChoice.LLM;
  const scorePercent = Math.round((submission.score / submission.maxScore) * 100);

  return (
    <div className="max-w-6xl mx-auto w-full px-6 py-10 flex-grow flex flex-col">
      
      {/* Header Decision */}
      <div className={`text-center py-12 rounded-t-2xl ${isLLM ? 'bg-gradient-to-br from-indigo-900 to-purple-800' : 'bg-gradient-to-br from-emerald-800 to-teal-700'} text-white shadow-2xl relative overflow-hidden`}>
        <div className="relative z-10 px-4">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] opacity-80 mb-3">Model Class Recommendation</h2>
            <h1 className="text-6xl font-black tracking-tighter mb-4 drop-shadow-lg">{isLLM ? 'LLM' : 'SLM'}</h1>
            <p className="text-2xl font-light opacity-95">{submission.decision}</p>
            {submission.hardBlocker && (
                <div className="mt-6 inline-flex items-center bg-black/30 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/20">
                    <Lock className="w-4 h-4 mr-2.5 text-red-300" />
                    <p className="text-base font-medium text-red-100">
                        Forced by: {submission.hardBlocker}
                    </p>
                </div>
            )}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-b-2xl shadow-xl border-x border-b border-slate-200 p-8 md:p-10 mb-8">
        
        {/* Score Visual */}
        <div className="mb-10">
            <div className="flex justify-between items-end mb-3">
                <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Fit Score</span>
                <span className="text-base font-bold text-slate-700">{submission.score} / {submission.maxScore} Points</span>
            </div>
            <div className="h-5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                {/* 0-50% LLM Zone, 50-100% SLM Zone */}
                <div 
                    className={`h-full transition-all duration-1000 ease-out ${isLLM ? 'bg-purple-600' : 'bg-emerald-500'}`} 
                    style={{ width: `${scorePercent}%` }}
                ></div>
            </div>
            <div className="flex justify-between mt-2.5 text-xs text-slate-400 font-medium">
                <span>Strongly LLM</span>
                <span className="text-slate-300">| Threshold (130)</span>
                <span>Strongly SLM</span>
            </div>
        </div>

        <div className="flex items-start mb-6">
          <div className="bg-indigo-50 p-3 rounded-xl mr-4">
            <BrainCircuit className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 mb-1">Executive Summary</h3>
            <p className="text-slate-500 text-sm">Analysis based on deployment and operational constraints</p>
          </div>
        </div>

        <div className="mb-10">
          <ExplanationDisplay text={submission.aiExplanation ?? (submission as any).ai_explanation} variant="result" />
        </div>

        <div className="pt-8 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
            <span className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-1.5">Infrastructure</span>
            <span className="text-slate-900 text-base font-bold flex items-center">
                {submission.data.g6_infraRefusal ? <span className="text-purple-600">Managed (LLM)</span> : <span className="text-emerald-600">Self-Hosted (SLM)</span>}
            </span>
          </div>
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
            <span className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-1.5">Connectivity</span>
            <span className="text-slate-900 text-base font-bold flex items-center">
                {submission.data.g2_offline ? "Offline Required" : "Online Allowed"}
            </span>
          </div>
           <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
            <span className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-1.5">Time to Market</span>
            <span className="text-slate-900 text-base font-bold flex items-center">
                {submission.data.g7_timeToMarket ? "Immediate (Weeks)" : "Standard"}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-center space-x-4">
        <button onClick={onReset} className="px-6 py-3 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition font-bold text-base shadow-sm hover:shadow-md">
          Start New Assessment
        </button>
        <button onClick={onViewRules} className="px-6 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-900 shadow-md hover:shadow-lg transition font-bold text-base">
          Methodology & Rules
        </button>
      </div>
    </div>
  );
};

// ==========================================
// PAGE 3: RULES
// ==========================================
const RulesPage = () => {
  return (
    <div className="max-w-6xl mx-auto w-full px-6 py-10">
      <h1 className="text-3xl font-extrabold text-slate-900 mb-8 tracking-tight">Assessment Methodology</h1>
      
      <div className="space-y-8">
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-5 flex items-center">
                <ShieldCheck className="w-7 h-7 text-red-600 mr-3" />
                Gatekeepers (Hard Constraints)
            </h2>
            <p className="text-lg text-slate-600 mb-6 leading-relaxed max-w-4xl">
                These questions represent "hard blockers". Answering <span className="font-bold text-slate-900">Yes</span> to specific gatekeepers immediately forces a decision regardless of the score.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {GATEKEEPER_QUESTIONS.map(q => (
                    <div key={q.id} className="flex items-start bg-slate-50 p-4 rounded-lg border border-slate-100">
                        <div className={`mt-1.5 min-w-[6px] h-6 rounded-full mr-3 ${q.forceDecision === ModelChoice.SLM ? 'bg-emerald-500' : 'bg-purple-600'}`}></div>
                        <div>
                            <p className="text-base font-bold text-slate-800">{q.label}</p>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mt-1.5">
                                Forces: <span className={q.forceDecision === ModelChoice.SLM ? 'text-emerald-600' : 'text-purple-600'}>{q.forceDecision === ModelChoice.SLM ? 'SLM' : 'LLM'}</span>
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-5 flex items-center">
                <Activity className="w-7 h-7 text-indigo-600 mr-3" />
                Scored Dimensions
            </h2>
             <p className="text-lg text-slate-600 mb-6 leading-relaxed">
                If no hard blockers exist, the system calculates a weighted score based on these dimensions.
                <br/>
                <span className="inline-block bg-slate-100 px-2.5 py-0.5 rounded-md mt-2 text-slate-800 font-bold text-base">Threshold: {SCORING_THRESHOLD} / {MAX_POSSIBLE_SCORE}</span> <span className="text-slate-500 text-sm ml-2">(Higher Score = Favors SLM)</span>
            </p>
             <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {SCORED_QUESTIONS.map(q => (
                    <div key={q.id} className="border border-slate-200 rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition">
                        <div className="flex justify-between items-start mb-2.5">
                            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded uppercase tracking-wider">Weight: {q.weight}</span>
                            {q.reverse && <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded uppercase tracking-wider">Reverse</span>}
                        </div>
                        <p className="text-base text-slate-800 font-medium leading-snug mb-2.5">{q.text}</p>
                        <p className="text-xs text-slate-500 border-t border-slate-100 pt-2.5">
                            {q.reverse ? 'High Agreement → Favors LLM' : 'High Agreement → Favors SLM'}
                        </p>
                    </div>
                ))}
            </div>
        </div>

        {/* Pros and Cons Section — from doc: title (bold), one-line description, two bullet points */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">Model Class Comparison: Pros & Cons</h2>
            
            <div className="grid md:grid-cols-2 gap-8">
                {/* SLM — When SLMs Are the Better Choice (Pros) / When SLMs Are Not (Cons) */}
                <div className="border-2 border-emerald-200 rounded-xl p-6 bg-emerald-50/30">
                    <div className="flex items-center mb-6">
                        <div className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-lg">SLM</div>
                        <span className="ml-3 text-sm text-slate-600">Small Language Model</span>
                    </div>
                    
                    <div className="mb-8">
                        <h3 className="font-bold text-emerald-800 mb-4 text-lg border-b border-emerald-200 pb-2">When SLMs Are the Better Choice</h3>
                        <div className="space-y-5">
                            <div>
                                <p className="font-bold text-slate-900 mb-1">High Repeatability of Workflows</p>
                                <p className="text-sm text-slate-600 mb-2">Predictable, repeatable processes where the same types of queries and tasks recur.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• SLMs excel when input patterns and expected outputs are stable over time.</li>
                                    <li>• Reduces variability and supports consistent quality and compliance.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Accuracy Matters More Than Breadth</p>
                                <p className="text-sm text-slate-600 mb-2">Narrow, well-defined use cases where precision in a specific domain is critical.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• Fine-tuned SLMs can match or exceed LLM accuracy for focused tasks.</li>
                                    <li>• Depth in one domain often beats broad but shallow general knowledge.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Latency and Throughput Are Business-Critical</p>
                                <p className="text-sm text-slate-600 mb-2">Real-time or high-volume systems where response time and throughput drive user experience or cost.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• Sub-100ms latency and high requests-per-second are achievable with on-prem or edge SLMs.</li>
                                    <li>• Avoids network round-trips and API rate limits that constrain cloud LLMs.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Cost Efficiency at Scale (Not Just Model Cost)</p>
                                <p className="text-sm text-slate-600 mb-2">High, sustained inference volume where total cost of ownership favors fixed infrastructure.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• At scale, per-token cloud pricing can exceed the cost of self-hosted inference.</li>
                                    <li>• Predictable capex/opex supports budgeting and long-term planning.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Controlled Behavior Is Required</p>
                                <p className="text-sm text-slate-600 mb-2">Regulatory, safety, or product requirements demand deterministic, auditable outputs.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• SLMs offer tighter control over generation and fewer unexpected behaviors.</li>
                                    <li>• Easier to validate, certify, and explain for compliance and risk management.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Data Sovereignty and Deployment Control Matter</p>
                                <p className="text-sm text-slate-600 mb-2">Data must never leave your environment due to policy, regulation, or security.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• On-device or on-prem deployment keeps all data and inference inside your boundary.</li>
                                    <li>• Eliminates dependency on third-party data handling and cross-border transfer.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Human-in-the-Loop Improvements Are Feasible</p>
                                <p className="text-sm text-slate-600 mb-2">You have domain experts and feedback loops to iteratively improve a focused model.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• Continuous fine-tuning and curation are viable with a stable, narrow scope.</li>
                                    <li>• Human feedback directly improves accuracy and behavior in that domain.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Stable Domain, Even If Surface Data Changes</p>
                                <p className="text-sm text-slate-600 mb-2">The underlying task and ontology are stable; only surface wording or formats evolve.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• SLMs can be retrained or fine-tuned periodically without fundamental architecture changes.</li>
                                    <li>• Evolution is manageable as long as the core use case does not shift.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Lower Long-Term Inference Cost Matters More Than Training Cost</p>
                                <p className="text-sm text-slate-600 mb-2">Inference volume is high enough that amortized training cost is secondary to per-query cost.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• Self-hosted SLM inference can have lower marginal cost than cloud API at scale.</li>
                                    <li>• One-time or periodic training cost is offset by sustained inference savings.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">You Want Engineering Leverage, Not Just Model Power</p>
                                <p className="text-sm text-slate-600 mb-2">Team can own pipelines, tooling, and optimization around a smaller, controllable model.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• Custom preprocessing, caching, and routing multiply the value of a focused SLM.</li>
                                    <li>• Engineering control over the full stack often beats raw model size alone.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    
                    <div>
                        <h3 className="font-bold text-red-800 mb-4 text-lg border-b border-red-200 pb-2">When SLMs Are Not the Better Choice</h3>
                        <div className="space-y-5">
                            <div>
                                <p className="font-bold text-slate-900 mb-1">High Domain Volatility Forces Continuous Fine-Tuning</p>
                                <p className="text-sm text-slate-600 mb-2">The domain or task definition changes frequently; keeping the SLM current becomes expensive.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• Constant retraining and data curation drain resources and delay time-to-value.</li>
                                    <li>• Managed LLMs absorb domain shifts via provider updates with no extra effort from you.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Fine-Tuning Is Not the Real Cost — The Pipeline Is</p>
                                <p className="text-sm text-slate-600 mb-2">Data pipelines, evaluation, and ops around training and deployment dominate total cost.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• ML ops, labeling, and monitoring often exceed the cost of the model itself.</li>
                                    <li>• LLM APIs externalize most of this complexity to the provider.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Workflow Drift Without Domain Drift Still Hurts SLMs</p>
                                <p className="text-sm text-slate-600 mb-2">User workflows or product requirements change even when the underlying domain is stable.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• SLMs tuned for one workflow may not generalize to new flows or UI changes.</li>
                                    <li>• LLMs adapt to new prompts and use cases without retraining.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">SLMs Penalize You for Unpredictable Query Mix</p>
                                <p className="text-sm text-slate-600 mb-2">Query types are diverse or shifting; a single narrow model cannot cover them well.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• Multiple specialized SLMs increase complexity and integration cost.</li>
                                    <li>• A general-purpose LLM handles variety out of the box.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Marginal Cost Savings Can Be Overwhelmed by Operational Overhead</p>
                                <p className="text-sm text-slate-600 mb-2">Savings from self-hosted inference are offset by DevOps, monitoring, and incident response.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• Staff and tooling for 24/7 model serving can exceed the delta vs. API costs.</li>
                                    <li>• Managed LLMs turn inference into a variable cost with minimal ops burden.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">SLMs Do Not Age Gracefully Without Maintenance</p>
                                <p className="text-sm text-slate-600 mb-2">Models drift or become outdated without regular retraining and data refresh.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• Stale SLMs lose accuracy and relevance; upkeep is ongoing and non-trivial.</li>
                                    <li>• Provider-updated LLMs stay current without your team’s direct effort.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Engineering Focus Shifts Away from Business Value</p>
                                <p className="text-sm text-slate-600 mb-2">Team spends more time on model and infra than on product and user value.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• Building and maintaining SLM pipelines can distract from core business goals.</li>
                                    <li>• LLM APIs let engineering focus on integration and experience, not model ops.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">SLMs Lock You Into Narrow ROI Assumptions</p>
                                <p className="text-sm text-slate-600 mb-2">ROI depends on high volume and stable scope; if scope expands, assumptions break.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• New use cases or products may require a different model class entirely.</li>
                                    <li>• LLMs offer flexibility to explore new use cases without upfront model commitment.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Generalization Becomes More Valuable Than Peak Accuracy</p>
                                <p className="text-sm text-slate-600 mb-2">Coverage across many tasks matters more than best-in-class performance on one task.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• A single generalist LLM can serve many workflows with good-enough quality.</li>
                                    <li>• Maintaining multiple SLMs for breadth is costly and complex.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Time-to-Value Favors Managed or Mini/Nano LLMs</p>
                                <p className="text-sm text-slate-600 mb-2">You need production value in weeks, not months; building SLM pipelines takes too long.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• API-based or small-footprint LLMs get you to market faster with less upfront investment.</li>
                                    <li>• SLM ROI only materializes when you have time and volume to justify the build.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                {/* LLM — Pros and Cons (parallel structure, professional titles) */}
                <div className="border-2 border-purple-200 rounded-xl p-6 bg-purple-50/30">
                    <div className="flex items-center mb-6">
                        <div className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold text-lg">LLM</div>
                        <span className="ml-3 text-sm text-slate-600">Large Language Model</span>
                    </div>
                    
                    <div className="mb-8">
                        <h3 className="font-bold text-purple-800 mb-4 text-lg border-b border-purple-200 pb-2">When LLMs Are the Better Choice</h3>
                        <div className="space-y-5">
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Broad Task Coverage and Generalization</p>
                                <p className="text-sm text-slate-600 mb-2">Use cases span many domains or query types; one model should handle variety without retraining.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• General-purpose LLMs deliver good-enough quality across diverse tasks from a single API.</li>
                                    <li>• Reduces the need for multiple specialized models and complex routing logic.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Zero Infrastructure and Operational Overhead</p>
                                <p className="text-sm text-slate-600 mb-2">Organization prefers not to host or maintain AI infrastructure; managed APIs are acceptable.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• No DevOps, GPU provisioning, or model deployment; provider handles scaling and availability.</li>
                                    <li>• Engineering can focus on product and integration instead of ML ops.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Rapid Time-to-Value and Experimentation</p>
                                <p className="text-sm text-slate-600 mb-2">Speed to production and ability to iterate matter more than marginal cost or latency.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• API-based LLMs enable production in days or weeks with minimal upfront investment.</li>
                                    <li>• Easy to test new use cases and prompts without retraining or redeploying.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Continuous Improvement Without Your Effort</p>
                                <p className="text-sm text-slate-600 mb-2">Provider updates models and capabilities; you benefit without running training or refresh pipelines.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• New features, better accuracy, and safety improvements ship automatically.</li>
                                    <li>• Avoids the ongoing cost of keeping a self-hosted model current.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Elastic Scale and Variable Demand</p>
                                <p className="text-sm text-slate-600 mb-2">Traffic is spiky or unpredictable; you want pay-per-use instead of fixed capacity.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• Managed LLMs scale automatically; no need to provision for peak or overbuild for average.</li>
                                    <li>• Cost aligns with actual usage, which suits experimentation and early-stage products.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Flexibility Over Determinism</p>
                                <p className="text-sm text-slate-600 mb-2">Use case benefits from creative or diverse outputs; strict reproducibility is not required.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• LLMs support open-ended generation, summarization, and multi-turn dialogue.</li>
                                    <li>• Acceptable trade-off when regulatory or safety constraints do not demand full control.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Data Residency and External API Are Acceptable</p>
                                <p className="text-sm text-slate-600 mb-2">Sending data to a third-party API is allowed by policy, regulation, and risk tolerance.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• No need for on-prem or edge deployment; cloud API meets compliance and security requirements.</li>
                                    <li>• Simplifies architecture and avoids building and securing inference infrastructure.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Evolving Workflows and Product Scope</p>
                                <p className="text-sm text-slate-600 mb-2">Product and user workflows will change; the model must adapt without retraining cycles.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• Prompt and integration changes extend LLM behavior to new flows quickly.</li>
                                    <li>• Avoids lock-in to a narrow, static SLM tuned for today’s workflow only.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Lower Upfront Cost and Faster ROI Horizon</p>
                                <p className="text-sm text-slate-600 mb-2">Capital and time are limited; you need value before investing in training and pipelines.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• No large upfront training or infra cost; pay as you grow.</li>
                                    <li>• ROI can be measured in weeks when usage and use cases are still evolving.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Leverage Provider Capability Over In-House Depth</p>
                                <p className="text-sm text-slate-600 mb-2">Relying on a provider’s scale and research beats building deep in-house ML for general intelligence.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• Access to state-of-the-art models without owning the full stack.</li>
                                    <li>• Frees talent to work on domain logic, UX, and integration rather than model engineering.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    
                    <div>
                        <h3 className="font-bold text-red-800 mb-4 text-lg border-b border-red-200 pb-2">When LLMs Are Not the Better Choice</h3>
                        <div className="space-y-5">
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Latency and Throughput Are Non-Negotiable</p>
                                <p className="text-sm text-slate-600 mb-2">Sub-100ms or very high QPS is required; API latency and rate limits are unacceptable.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• Cloud round-trips and provider throttling prevent meeting strict SLA or UX requirements.</li>
                                    <li>• On-device or edge SLMs are the only way to guarantee low latency at scale.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Data Must Never Leave Your Boundary</p>
                                <p className="text-sm text-slate-600 mb-2">Regulation, policy, or security forbids sending data to external APIs.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• LLM APIs require data to leave your environment; SLMs keep inference on-prem or on-device.</li>
                                    <li>• No amount of contracting or encryption satisfies strict data sovereignty in some sectors.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Usage-Based Cost Becomes Prohibitive at Scale</p>
                                <p className="text-sm text-slate-600 mb-2">High, sustained volume makes per-token pricing more expensive than self-hosted inference.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• At millions of queries, API costs can exceed the TCO of dedicated SLM infrastructure.</li>
                                    <li>• Fixed-cost SLM deployment supports predictable budgeting at scale.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Controlled, Auditable Behavior Is Mandatory</p>
                                <p className="text-sm text-slate-600 mb-2">Regulatory or safety requirements demand deterministic, explainable, and certifiable outputs.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• LLM behavior can vary and is harder to fully control and audit.</li>
                                    <li>• SLMs offer tighter control and clearer attribution for compliance and certification.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Offline or Air-Gapped Deployment Is Required</p>
                                <p className="text-sm text-slate-600 mb-2">Environments have no or restricted connectivity; cloud API is not an option.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• LLMs depend on network access; SLMs run fully on-device or in isolated networks.</li>
                                    <li>• Critical for field, mobile, or secure environments where connectivity is limited.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Narrow, Stable Use Case Favors Specialized Accuracy</p>
                                <p className="text-sm text-slate-600 mb-2">One well-defined task where peak accuracy matters more than breadth.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• A fine-tuned SLM can outperform a generalist LLM on that task at lower marginal cost.</li>
                                    <li>• Investment in one focused model pays off when the use case is long-lived and high-volume.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Vendor Lock-In and Provider Risk Are Unacceptable</p>
                                <p className="text-sm text-slate-600 mb-2">Dependence on a single provider’s API, pricing, or availability is too risky.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• SLMs give you ownership of the model and deployment; you are not tied to one vendor.</li>
                                    <li>• Mitigates risk of API changes, discontinuation, or unexpected cost increases.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Engineering Wants Full Stack Control</p>
                                <p className="text-sm text-slate-600 mb-2">Team has the skills and mandate to own pipelines, optimization, and model lifecycle.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• Custom preprocessing, caching, and routing with an SLM can yield better ROI than a black-box API.</li>
                                    <li>• Engineering leverage multiplies when you control the entire inference stack.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Long-Term Inference Cost Dominates TCO</p>
                                <p className="text-sm text-slate-600 mb-2">Amortized training and ops cost is small relative to inference volume over years.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• Self-hosted SLM inference can have lower marginal cost over time than API at scale.</li>
                                    <li>• One-time or periodic training cost is justified by sustained inference savings.</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Repeatability and Consistency Are Product Requirements</p>
                                <p className="text-sm text-slate-600 mb-2">Users or downstream systems expect stable, reproducible outputs for the same input.</p>
                                <ul className="text-sm text-slate-700 space-y-1 ml-0 list-none">
                                    <li>• SLMs support deterministic or low-variance behavior more easily than general-purpose LLMs.</li>
                                    <li>• Critical for automation, testing, and compliance where variability is undesirable.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-6 p-4 bg-slate-100 rounded-lg border border-slate-200">
                <p className="text-sm text-slate-700 text-center">
                    <strong>Best Practice:</strong> The optimal choice depends on your specific constraints. Use this assessment tool to evaluate your requirements objectively.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// PAGE 4: LOGIN
// ==========================================
const LoginPage = ({ onLogin }: { onLogin: (success: boolean) => void }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Simple client-side check for demo purposes
        if (password === '$Infovision2026$') {
            onLogin(true);
        } else {
            setError(true);
        }
    };

    return (
        <div className="flex-grow flex items-center justify-center bg-slate-50 px-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
                <div className="text-center mb-6">
                    <div className="bg-indigo-100 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Lock className="w-7 h-7 text-indigo-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">Admin Login</h2>
                    <p className="text-slate-500 text-sm mt-1">Restricted access for model evaluation review board.</p>
                </div>
                
                <form onSubmit={handleSubmit}>
                    <div className="mb-5">
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
                        <input 
                            type="password" 
                            className="w-full px-3 py-2.5 text-base border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setError(false); }}
                            placeholder="Enter admin password"
                        />
                    </div>
                    {error && <p className="text-red-600 text-sm mb-5 flex items-center"><AlertCircle className="w-4 h-4 mr-2"/> Invalid password</p>}
                    
                    <button type="submit" className="w-full bg-slate-900 text-white font-bold text-base py-3 rounded-lg hover:bg-slate-800 transition shadow-lg">
                        Access Dashboard
                    </button>
                </form>
            </div>
        </div>
    );
};

// ==========================================
// PAGE 5: ADMIN — Split screen 30% list / 70% read-only form + result
// ==========================================
const AdminPage = ({
  submissions,
  onRefresh,
}: {
  submissions: Submission[];
  onRefresh: () => Promise<Submission[]>;
}) => {
    const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
      let cancelled = false;
      setIsRefreshing(true);
      void onRefresh()
        .finally(() => {
          if (!cancelled) setIsRefreshing(false);
        });
      return () => {
        cancelled = true;
      };
    }, [onRefresh]);

    useEffect(() => {
      if (submissions.length === 0) {
        setSelectedSubmission(null);
        return;
      }
      if (!selectedSubmission || !submissions.some((row) => row.id === selectedSubmission.id)) {
        setSelectedSubmission(submissions[0]);
      }
    }, [submissions, selectedSubmission]);

    return (
        <div className="flex min-h-[calc(100vh-12rem)] w-full">
            {/* LEFT 30% — User list */}
            <div className="w-[30%] min-w-[260px] max-w-[400px] flex flex-col border-r border-slate-200 bg-white overflow-hidden flex-shrink-0">
                <div className="flex-shrink-0 px-4 py-4 border-b border-slate-200 bg-slate-50">
                    <h1 className="text-lg font-bold text-slate-900">Assessment Dashboard</h1>
                    <p className="text-slate-500 text-sm mt-0.5">{isRefreshing ? 'Refreshing…' : `${submissions.length} submissions`}</p>
                    <div className="flex gap-2 mt-3">
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-bold">
                            LLM: {submissions.filter(s => s.decision === ModelChoice.LLM).length}
                        </span>
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-bold">
                            SLM: {submissions.filter(s => s.decision === ModelChoice.SLM).length}
                        </span>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {submissions.length === 0 ? (
                        <div className="p-6 text-center text-slate-500 text-sm">No assessments recorded yet.</div>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {submissions.map((sub) => (
                                <li
                                    key={sub.id}
                                    onClick={() => setSelectedSubmission(sub)}
                                    className={`px-4 py-4 cursor-pointer transition ${
                                        selectedSubmission?.id === sub.id
                                            ? 'bg-indigo-50 border-l-4 border-indigo-600'
                                            : 'hover:bg-slate-50 border-l-4 border-transparent'
                                    }`}
                                >
                                    <div className="font-semibold text-slate-900 text-sm truncate">{sub.data.projectName}</div>
                                    <div className="text-xs text-slate-500 mt-0.5 truncate">{sub.user}</div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${sub.decision === ModelChoice.SLM ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'}`}>
                                            {sub.decision === ModelChoice.SLM ? 'SLM' : 'LLM'}
                                        </span>
                                        {sub.hardBlocker && <Lock className="w-3 h-3 text-red-500 flex-shrink-0" />}
                                        <span className="text-xs text-slate-400">{sub.timestamp.toLocaleDateString()}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* RIGHT 70% — Read-only form + result (Page 2 content) concatenated */}
            <div className="flex-1 overflow-y-auto bg-slate-50">
                {!selectedSubmission ? (
                    <div className="h-full flex items-center justify-center text-slate-400 text-base">
                        Select a submission from the list to view details
                    </div>
                ) : (
                    <div className="p-6 max-w-4xl mx-auto space-y-6 pb-12">
                        {/* ——— PART 1: Read-only form they filled ——— */}
                        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200">
                                <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Submitted form (read-only)</h2>
                            </div>
                            <div className="p-6 space-y-6">
                                {/* User info */}
                                <div>
                                    <h3 className="text-base font-bold text-slate-800 mb-2 flex items-center">
                                        <User className="w-4 h-4 mr-2 text-indigo-600" /> User information
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div><span className="text-slate-500 block text-xs">Name</span><span className="font-medium text-slate-900">{selectedSubmission.data.userName}</span></div>
                                        <div><span className="text-slate-500 block text-xs">Email</span><span className="font-medium text-slate-900">{selectedSubmission.data.email}</span></div>
                                        {selectedSubmission.data.companyName && <div className="col-span-2"><span className="text-slate-500 block text-xs">Company</span><span className="font-medium text-slate-900">{selectedSubmission.data.companyName}</span></div>}
                                        <div className="col-span-2"><span className="text-slate-500 block text-xs">Project name</span><span className="font-medium text-slate-900">{selectedSubmission.data.projectName}</span></div>
                                        <div className="col-span-2"><span className="text-slate-500 block text-xs">Project description</span><p className="font-medium text-slate-900 text-sm leading-relaxed">{selectedSubmission.data.projectDescription}</p></div>
                                    </div>
                                </div>
                                {/* Gatekeepers */}
                                <div>
                                    <h3 className="text-base font-bold text-slate-800 mb-2 flex items-center">
                                        <ShieldCheck className="w-4 h-4 mr-2 text-red-600" /> Gatekeepers
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {GATEKEEPER_QUESTIONS.map((q) => {
                                            const value = selectedSubmission.data[q.id as keyof FormData];
                                            return (
                                                <div key={q.id} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0 text-sm">
                                                    <span className="text-slate-700 pr-2">{q.label}</span>
                                                    <span className={`font-bold flex-shrink-0 ${value ? 'text-emerald-600' : 'text-slate-400'}`}>{value ? 'Yes' : 'No'}</span>
                                                </div>
                                            );
                                        })}
                                        <div className="flex justify-between items-center py-2 border-b border-slate-100 text-sm col-span-2">
                                            <span className="text-slate-700">External API dependency</span>
                                            <span className="font-bold text-slate-900 capitalize">{selectedSubmission.data.g5_externalApi?.replace('_', ' ')}</span>
                                        </div>
                                    </div>
                                </div>
                                {/* Scored dimensions */}
                                <div>
                                    <h3 className="text-base font-bold text-slate-800 mb-2 flex items-center">
                                        <Activity className="w-4 h-4 mr-2 text-indigo-600" /> Scored dimensions
                                    </h3>
                                    <div className="space-y-2">
                                        {SCORED_QUESTIONS.map((q) => {
                                            const value = selectedSubmission.data[q.id as keyof FormData] as number;
                                            return (
                                                <div key={q.id} className="flex items-center gap-3 text-sm">
                                                    <span className="text-slate-700 flex-1 min-w-0">{q.text}</span>
                                                    <div className="flex gap-0.5 flex-shrink-0">
                                                        {[1, 2, 3, 4, 5].map((v) => (
                                                            <div key={v} className={`w-5 h-2 rounded-sm ${v <= value ? 'bg-indigo-600' : 'bg-slate-200'}`} />
                                                        ))}
                                                    </div>
                                                    <span className="font-bold text-slate-900 w-6 text-right">{value}/5</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* ——— PART 2: Result page content (Page 2) ——— */}
                        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200">
                                <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Result & recommendation</h2>
                            </div>
                            <div className="p-0">
                                {/* Decision header (same as ResultPage) */}
                                <div className={`text-center py-10 px-6 ${selectedSubmission.decision === ModelChoice.LLM ? 'bg-gradient-to-br from-indigo-900 to-purple-800' : 'bg-gradient-to-br from-emerald-800 to-teal-700'} text-white`}>
                                    <h2 className="text-xs font-bold uppercase tracking-widest opacity-80 mb-2">Model Class Recommendation</h2>
                                    <h1 className="text-5xl font-black tracking-tighter mb-2">{selectedSubmission.decision === ModelChoice.LLM ? 'LLM' : 'SLM'}</h1>
                                    <p className="text-lg font-light opacity-95">{selectedSubmission.decision}</p>
                                    {selectedSubmission.hardBlocker && (
                                        <div className="mt-4 inline-flex items-center bg-black/30 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
                                            <Lock className="w-4 h-4 mr-2 text-red-300" />
                                            <span className="text-sm font-medium">Forced by: {selectedSubmission.hardBlocker}</span>
                                        </div>
                                    )}
                                </div>
                                {/* Score + summary (same as ResultPage) */}
                                <div className="p-6 md:p-8">
                                    <div className="mb-8">
                                        <div className="flex justify-between items-end mb-2">
                                            <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Fit score</span>
                                            <span className="text-base font-bold text-slate-700">{selectedSubmission.score} / {selectedSubmission.maxScore} points</span>
                                        </div>
                                        <div className="h-4 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                                            <div
                                                className={`h-full transition-all ${selectedSubmission.decision === ModelChoice.LLM ? 'bg-purple-600' : 'bg-emerald-500'}`}
                                                style={{ width: `${Math.round((selectedSubmission.score / selectedSubmission.maxScore) * 100)}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between mt-2 text-xs text-slate-400 font-medium">
                                            <span>Strongly LLM</span>
                                            <span className="text-slate-300">| Threshold (130)</span>
                                            <span>Strongly SLM</span>
                                        </div>
                                    </div>
                                    <div className="flex items-start mb-4">
                                        <div className="bg-indigo-50 p-2 rounded-lg mr-3">
                                            <BrainCircuit className="w-5 h-5 text-indigo-600" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900">Executive summary</h3>
                                            <p className="text-slate-500 text-sm">Analysis based on deployment and operational constraints</p>
                                        </div>
                                    </div>
                                    <div className="mb-8">
                                        <ExplanationDisplay text={selectedSubmission.aiExplanation ?? (selectedSubmission as any).ai_explanation} variant="dashboard" />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-slate-100">
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                            <span className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Infrastructure</span>
                                            <span className="text-slate-900 font-bold">
                                                {selectedSubmission.data.g6_infraRefusal ? <span className="text-purple-600">Managed (LLM)</span> : <span className="text-emerald-600">Self-hosted (SLM)</span>}
                                            </span>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                            <span className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Connectivity</span>
                                            <span className="text-slate-900 font-bold">{selectedSubmission.data.g2_offline ? 'Offline required' : 'Online allowed'}</span>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                            <span className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Time to market</span>
                                            <span className="text-slate-900 font-bold">{selectedSubmission.data.g7_timeToMarket ? 'Immediate (weeks)' : 'Standard'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
};
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ModelChoice } from '../types';
import type { FormData } from '../types';

export const generateRandomScenario = async (): Promise<FormData | null> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY ?? import.meta.env.VITE_API_KEY;
  if (!apiKey) {
    console.warn("API Key missing for scenario generation");
    return null;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const targetIsSLM = Math.random() > 0.5;

  const prompt = `
    Generate a realistic enterprise software project scenario for an AI architecture assessment.
    
    Target Outcome: ${targetIsSLM ? "SMALL LANGUAGE MODEL (SLM) - Needs privacy, edge, or offline." : "LARGE LANGUAGE MODEL (LLM) - Needs complex reasoning, cloud, or zero maintenance."}
    
    Return a valid JSON object matching this TypeScript interface exactly:
    {
      "userName": "Name",
      "email": "email",
      "companyName": "Company",
      "projectName": "Project Name",
      "projectDescription": "Description > 100 chars",
      "g1_edge": boolean,
      "g2_offline": boolean,
      "g3_dataResidency": boolean,
      "g4_regulatory": boolean,
      "g5_externalApi": "not_acceptable" | "risk_mitigation" | "fully_acceptable",
      "g6_infraRefusal": boolean,
      "g7_timeToMarket": boolean,
      "s1_latency": 1-5,
      "s2_volume": 1-5,
      "s3_cost": 1-5,
      "s4_longevity": 1-5,
      "s5_narrowness": 1-5,
      "s6_domain": 1-5,
      "s7_determinism": 1-5,
      "s8_explainability": 1-5,
      "s9_readiness": 1-5,
      "s10_maintenance": 1-5,
      "s11_investment": 1-5,
      "s12_breadth": 1-5,
      "s13_experimentation": 1-5,
      "s14_lowVolume": 1-5
    }

    Rules:
    1. If Target is SLM: Set g1, g2, or g3 to true often. Set s1, s2, s5 high (4 or 5).
    2. If Target is LLM: Set g6 or g7 to true often. Set s12, s13 high (4 or 5).
  `;

  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-pro',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 1.0
      }
    });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    if (!text) return null;
    return JSON.parse(text) as FormData;
  } catch (error) {
    console.error("AI Scenario Gen Error:", error);
    return null;
  }
};

export const generateEvaluation = async (formData: FormData, decision: ModelChoice, score: number, hardBlocker?: string): Promise<string> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY ?? import.meta.env.VITE_API_KEY;
  if (!apiKey) return "API Key is missing. Unable to generate AI explanation.";

  const genAI = new GoogleGenerativeAI(apiKey);

  // Build detailed list of ALL responses with their values
  const gatekeeperResponses: string[] = [];
  const scoredResponses: string[] = [];
  
  // Gatekeeper responses (only include if YES)
  if (formData.g1_edge) gatekeeperResponses.push("✓ On-device/edge deployment required");
  if (formData.g2_offline) gatekeeperResponses.push("✓ Offline or limited connectivity environment");
  if (formData.g3_dataResidency) gatekeeperResponses.push("✓ Data must remain within internal infrastructure");
  if (formData.g4_regulatory) gatekeeperResponses.push("✓ Regulatory/legal requirements for model control");
  if (formData.g6_infraRefusal) gatekeeperResponses.push("✓ Organization unwilling to manage AI infrastructure");
  if (formData.g7_timeToMarket) gatekeeperResponses.push("✓ Immediate production readiness required (weeks)");
  
  // Scored dimensions - include ALL with their ratings
  scoredResponses.push(`Sub-100ms response latency is critical: ${formData.s1_latency}/5`);
  scoredResponses.push(`High or rapidly growing request volumes: ${formData.s2_volume}/5`);
  scoredResponses.push(`Predictable, fixed costs preferred: ${formData.s3_cost}/5`);
  scoredResponses.push(`System longevity (3+ years): ${formData.s4_longevity}/5`);
  scoredResponses.push(`Use case is narrow and well-defined: ${formData.s5_narrowness}/5`);
  scoredResponses.push(`Domain-specific expertise required: ${formData.s6_domain}/5`);
  scoredResponses.push(`Consistent, deterministic outputs required: ${formData.s7_determinism}/5`);
  scoredResponses.push(`Explainability and auditability needed: ${formData.s8_explainability}/5`);
  scoredResponses.push(`Team readiness to manage infrastructure: ${formData.s9_readiness}/5`);
  scoredResponses.push(`Willingness to maintain and update models: ${formData.s10_maintenance}/5`);
  scoredResponses.push(`Investment capacity for infrastructure: ${formData.s11_investment}/5`);
  scoredResponses.push(`Broad, diverse task requirements: ${formData.s12_breadth}/5 (reverse)`);
  scoredResponses.push(`Need for experimentation and iteration: ${formData.s13_experimentation}/5 (reverse)`);
  scoredResponses.push(`Low-volume, occasional usage: ${formData.s14_lowVolume}/5 (reverse)`);

  const prompt = `
    Role: Senior AI Solutions Architect evaluating model class selection for "${formData.projectName}".
    
    Decision Made: ${decision}
    ${hardBlocker ? `Hard Blocker: ${hardBlocker}` : `Score: ${score}/280 (Threshold: 130, higher favors SLM)`}
    
    Task: Provide a DETAILED explanation with comprehensive bullet points for EACH relevant question the user answered. Do NOT use words like "summary" or "executive summary" in your response.
    
    GATEKEEPER RESPONSES (Hard Constraints):
    ${gatekeeperResponses.length > 0 ? gatekeeperResponses.join('\n') : 'None'}
    
    SCORED DIMENSIONS (All ratings):
    ${scoredResponses.join('\n')}
    
    ADDITIONAL CONTEXT:
    - External API dependency tolerance: ${formData.g5_externalApi?.replace('_', ' ')}
    - Project description: ${formData.projectDescription}
    
    INSTRUCTIONS:
    1. Start with ONE clear sentence stating why ${decision === ModelChoice.SLM ? 'Small Language Model (SLM)' : 'Large Language Model (LLM)'} was selected.
    2. Then provide 6-10 detailed bullet points (using • character) covering:
       - The hard blocker if one exists
       - Each significant scored dimension (ratings of 4-5 for normal questions, 1-2 for reverse questions)
       - How each response specifically supports the ${decision} decision
    3. Each bullet point should:
       - Reference the specific question/constraint
       - Include the user's rating/response
       - Explain WHY this supports the decision
    4. Use ONLY the bullet character • (not -, *, or numbers)
    5. Be thorough and detailed - aim for 250-300 words total
    6. In each bullet and in the opening sentence, wrap the ONE most important phrase in **double asterisks** so it will display as bold. Do not overuse: one bold phrase per bullet and one in the opening line. Choose the phrase that best captures the key reason (e.g. the conclusion or the decisive factor). No other markdown.
    
    FORMAT EXAMPLE:
    The ${decision === ModelChoice.SLM ? 'Small Language Model (SLM)' : 'Large Language Model (LLM)'} was selected because **primary reason in bold**.
    
    • [Question 1]: The user rated [X/5], **key takeaway phrase in bold** — rest of explanation
    • [Question 2]: With a score of [Y/5], **key phrase** — detailed reasoning
    • [Question 3]: [Gatekeeper response] — **hard requirement in bold** — explanation
    [Continue for all relevant responses...]
  `;

  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-pro',
      generationConfig: {
        temperature: 0.7
      }
    });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text() || "Analysis generated, but no text returned.";
  } catch (error) {
    console.error("AI API Error:", error);
    return "Unable to generate AI explanation due to a network or API error.";
  }
};
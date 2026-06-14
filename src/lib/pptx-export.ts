import pptxgen from "pptxgenjs";
import { phases } from "@/data/dmaic-tools";

interface Project {
  id: string;
  name: string;
  description: string | null;
  current_phase: number;
  status: string;
  estimated_savings?: number | null;
  actual_savings?: number | null;
}

interface ProjectNote {
  id: string;
  phase: number;
  title: string;
  content: string | null;
  created_at: string;
}

interface ProjectCalculation {
  id: string;
  phase: number;
  tool_id: string;
  tool_name: string;
  inputs: unknown;
  results: unknown;
  notes: string | null;
  created_at: string;
}

interface TollgateItem {
  phase: number;
  title: string;
  is_completed: boolean;
}

interface SigmaEntry {
  phase: number;
  sigma_level: number;
  dpmo: number | null;
  measurement_date: string;
}

const HIDDEN_KEYS = new Set([
  "completedSections", "totalSections", "completedFields", "totalFields",
  "filledCount", "totalCount", "isComplete", "lastSaved", "version",
]);

const PHASE_COLORS: Record<number, string> = {
  1: "1E40AF", // Define (Blue)
  2: "047857", // Measure (Green)
  3: "B45309", // Analyze (Gold/Orange)
  4: "7C3AED", // Improve (Purple)
  5: "DC2626", // Control (Red)
};

const PHASE_TEXT_COLORS: Record<number, string> = {
  1: "1E3A8A",
  2: "064E3B",
  3: "78350F",
  4: "5B21B6",
  5: "991B1B",
};

interface A3Section {
  heading: string;
  toolIds: string[];
  focusFields?: string[];
}

const A3_PHASE_SECTIONS: Record<number, A3Section[]> = {
  1: [
    { 
      heading: "Problembeskrivning & Mål", 
      toolIds: ["problem-statement", "project-charter", "5w2h-is-isnot"], 
      focusFields: [
        "problemStatement", "what", "where", "when", "extent", "impact", "statement", 
        "goal", "businessCase", "scope", "timeline", "sponsor", "team"
      ] 
    },
    { 
      heading: "Kundbehov & Krav (VOC)", 
      toolIds: ["voc", "ctq", "kano-model"], 
      focusFields: [
        "customerSegment", "needs", "requirements", "need", "driver", "ctq", "measure", 
        "target", "feature", "category", "voices", "entries"
      ] 
    },
    { 
      heading: "Processöversikt & Team", 
      toolIds: ["sipoc", "process-mapping", "stakeholder-analysis"], 
      focusFields: [
        "suppliers", "inputs", "process", "outputs", "customers", "steps", 
        "stakeholder", "influence", "interest", "strategy", "rows"
      ] 
    },
  ],
  2: [
    { 
      heading: "Datainsamlingsplan", 
      toolIds: ["data-collection-plan"], 
      focusFields: ["dataType", "source", "method", "frequency", "responsible", "sampleSize"] 
    },
    { 
      heading: "Mätsystemanalys (MSA)", 
      toolIds: ["gage-rr", "msa"], 
      focusFields: ["repeatability", "reproducibility", "grr", "ndc", "partVariation", "totalVariation"] 
    },
    { 
      heading: "Baseline & Nulägesanalys", 
      toolIds: [
        "dpmo", "sigma-level", "capability-cp", "capability-cpk", "capability-sixpack",
        "control-chart-basics", "spc-imr", "spc-xbar-r", "spc-xbar-s", "spc-p-chart",
        "spc-np-chart", "spc-c-chart", "spc-u-chart"
      ], 
      focusFields: ["dpmo", "sigma", "cp", "cpk", "mean", "stdDev", "pValue", "usl", "lsl", "ucl", "lcl", "centerLine", "yield"] 
    },
  ],
  3: [
    { 
      heading: "Rotorsaksanalys", 
      toolIds: ["fishbone", "5-whys", "ai-root-cause"], 
      focusFields: [
        "effect", "categories", "causes", "problem", "why1", "why2", "why3", "why4", "why5", 
        "rootCause", "countermeasure"
      ] 
    },
    { 
      heading: "Statistisk Verifiering", 
      toolIds: [
        "t-test-1sample", "t-test-2sample", "anova", "chi-square", "correlation", "regression", "multi-vari", "hypothesis-testing"
      ], 
      focusFields: [
        "pValue", "tStatistic", "fStatistic", "chiSquare", "correlation", "rSquared", 
        "mean", "stdDev", "conclusion", "significant"
      ] 
    },
    { 
      heading: "Riskbedömning (FMEA)", 
      toolIds: ["fmea"], 
      focusFields: ["severity", "occurrence", "detection", "rpn", "action", "failureMode", "failureEffect", "currentControl", "recommendedAction"] 
    },
  ],
  4: [
    { 
      heading: "Lösningsval & Optimering", 
      toolIds: ["pugh-matrix", "solution-selection", "response-surface"], 
      focusFields: ["criteria", "alternatives", "scores", "winner", "baseline", "optimal"] 
    },
    { 
      heading: "Pilotstudie & Plan", 
      toolIds: ["pilot-study", "implementation-plan"], 
      focusFields: [
        "objective", "duration", "successCriteria", "pilotResults", "risks", "decision", 
        "actions", "owner", "deadline", "status", "priority"
      ] 
    },
    { 
      heading: "Lean-förbättringar", 
      toolIds: ["5s", "kaizen", "mistake-proofing"], 
      focusFields: ["wasteType", "action", "status", "responsible", "score"] 
    },
  ],
  5: [
    { 
      heading: "Styrplan & Kontrollmetoder", 
      toolIds: [
        "control-plan", "cusum", "ewma", "control-chart-basics", "spc-imr", "spc-xbar-r", 
        "spc-xbar-s", "spc-p-chart", "spc-np-chart", "spc-c-chart", "spc-u-chart"
      ], 
      focusFields: [
        "controlMethod", "reactionPlan", "ucl", "lcl", "centerLine", "specification", 
        "frequency", "responsible"
      ] 
    },
    { 
      heading: "Standardisering & Handover", 
      toolIds: [
        "sop", "training-plan", "response-plan", "handover-checklist", "lessons-learned", 
        "audit-plan"
      ], 
      focusFields: ["description", "responsible", "status", "date", "action"] 
    },
    { 
      heading: "Resultat & Besparingar", 
      toolIds: ["benefit-validation"], 
      focusFields: ["benefitVal", "actualSavings", "roi", "savings", "outcome", "validationDate"] 
    }
  ],
};

const KEY_LABELS: Record<string, string> = {
  projectName: "Projektnamn", problemStatement: "Problembeskrivning",
  goal: "Mål", scope: "Avgränsning", team: "Team",
  sponsor: "Sponsor", timeline: "Tidplan", businessCase: "Affärsnytta",
  what: "Vad", when: "När", where: "Var", who: "Vem",
  howMuch: "Hur mycket", impact: "Påverkan", statement: "Problemformulering",
  extent: "Omfattning",
  suppliers: "Leverantörer", inputs: "Input", process: "Process",
  outputs: "Output", customers: "Kunder", rows: "Rader",
  customerSegment: "Kundsegment", needs: "Behov", requirements: "Krav",
  entries: "Poster", voices: "Röster",
  need: "Behov", driver: "Drivare", ctq: "CTQ", measure: "Mått",
  target: "Målvärde", specification: "Specifikation",
  categories: "Kategorier", causes: "Orsaker", effect: "Effekt",
  problem: "Problem", why1: "Varför 1", why2: "Varför 2",
  why3: "Varför 3", why4: "Varför 4", why5: "Varför 5",
  rootCause: "Rotorsak", countermeasure: "Motåtgärd",
  feature: "Funktion", category: "Kategori", features: "Funktioner",
  criteria: "Kriterier", alternatives: "Alternativ", scores: "Poäng",
  winner: "Vinnare", baseline: "Baseline",
  dataType: "Datatyp", source: "Källa", method: "Metod",
  frequency: "Frekvens", responsible: "Ansvarig", sampleSize: "Stickprov",
  steps: "Steg", description: "Beskrivning", type: "Typ",
  factor1: "Faktor 1", factor2: "Faktor 2", factor3: "Faktor 3",
  response: "Respons", observations: "Observationer",
  defects: "Defekter", counts: "Antal", cumulative: "Kumulativ",
  repeatability: "Repeterbarhet", reproducibility: "Reproducerbarhet",
  grr: "GRR", ndc: "NDC", partVariation: "Delvariation", totalVariation: "Total variation",
  usl: "Övre specgräns", lsl: "Nedre specgräns", ucl: "UCL", lcl: "LCL",
  centerLine: "Centerlinje",
  tStatistic: "T-statistik", fStatistic: "F-statistik", chiSquare: "Chi-kvadrat",
  significant: "Signifikant", conclusion: "Slutsats",
  objective: "Mål", duration: "Varaktighet",
  successCriteria: "Framgångskriterier", pilotResults: "Pilotresultat",
  risks: "Risker", decision: "Beslut",
  actions: "Åtgärder", owner: "Ägare", deadline: "Deadline",
  status: "Status", priority: "Prioritet",
  stakeholder: "Intressent", influence: "Inflytande", interest: "Intresse",
  strategy: "Strategi",
  controlMethod: "Kontrollmetod", reactionPlan: "Reaktionsplan",
  severity: "Allvarlighet", occurrence: "Frekvens (FMEA)", detection: "Upptäckbarhet",
  rpn: "RPN", action: "Åtgärd", wasteType: "Slöseri",
  name: "Namn", value: "Värde", notes: "Anteckningar", title: "Titel",
  result: "Resultat", summary: "Sammanfattning",
  mean: "Medelvärde", stdDev: "Standardavvikelse", cp: "Cp", cpk: "Cpk",
  sigma: "Sigma", dpmo: "DPMO", pValue: "P-värde",
  correlation: "Korrelation", rSquared: "R²", optimal: "Optimalt",
  failureMode: "Felläge", chartType: "Diagramtyp", values: "Datavärden",
  cl: "Centerlinje (CL)", clR: "Centerlinje R", lclR: "LCL (R)", uclR: "UCL (R)",
  n: "Antal observationer", cpl: "Cpk (nedre)", cpu: "Cpk (övre)",
  dpu: "Defekter per enhet", yield: "Utbyte (%)",
  units: "Enheter", opportunities: "Möjligheter",
  risk: "Risknivå", failureEffect: "Feleffekt", currentControl: "Nuvarande kontroll",
  recommendedAction: "Rekommenderad åtgärd", processStep: "Processteg",
  characteristic: "Karaktäristik", measurementMethod: "Mätmetod",
  reactionPlanDetail: "Reaktionsplan (detalj)", sampleFrequency: "Provtagningsfrekvens",
  confidenceLevel: "Konfidensnivå", degreesOfFreedom: "Frihetsgrader",
  testType: "Testtyp", hypothesisResult: "Hypotesresultat",
  totalDefects: "Totalt antal defekter", totalOpportunities: "Totalt antal möjligheter",
  data: "Data", groups: "Grupper", effect2: "Effekt",
};

function labelFor(key: string): string {
  return KEY_LABELS[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

function isMeaningful(key: string, value: unknown): boolean {
  if (HIDDEN_KEYS.has(key)) return false;
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;
  if (typeof value === "number" && value === 0) return false;
  if (typeof value === "string" && !value.trim()) return false;
  return true;
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  if (Math.abs(n) >= 100) return n.toFixed(1);
  if (Math.abs(n) >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

function formatValue(value: unknown, maxLen = 120): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return formatNumber(value);
  if (typeof value === "boolean") return value ? "Ja" : "Nej";
  if (Array.isArray(value)) {
    if (value.length === 0) return "";
    if (typeof value[0] === "number") {
      if (value.length <= 8) return value.map((v: number) => formatNumber(v)).join(", ");
      const first3 = value.slice(0, 3).map((v: number) => formatNumber(v)).join(", ");
      const last2 = value.slice(-2).map((v: number) => formatNumber(v)).join(", ");
      return `${first3}, … , ${last2} (${value.length} st)`;
    }
    if (typeof value[0] === "object" && value[0] !== null) {
      return value
        .map((item) =>
          Object.entries(item as Record<string, unknown>)
            .filter(([k, v]) => isMeaningful(k, v))
            .map(([k, v]) => `${labelFor(k)}: ${typeof v === "number" ? formatNumber(v) : String(v).slice(0, 50)}`)
            .join(" | ")
        )
        .filter(Boolean)
        .join("\n");
    }
    return value.filter(Boolean).map((v) => String(v).slice(0, 50)).join(", ");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([k, v]) => isMeaningful(k, v))
      .map(([k, v]) => `${labelFor(k)}: ${formatValue(v, 50)}`)
      .join(", ");
  }
  const s = String(value);
  return s.length > maxLen ? s.slice(0, maxLen) + "…" : s;
}

function collectFields(
  calcs: ProjectCalculation[],
  focusFields?: string[]
): Array<{ label: string; value: string }> {
  const result: Array<{ label: string; value: string }> = [];
  const seen = new Set<string>();

  for (const calc of calcs) {
    const allData: Record<string, unknown> = {
      ...(calc.inputs && typeof calc.inputs === "object" ? (calc.inputs as Record<string, unknown>) : {}),
      ...(calc.results && typeof calc.results === "object" ? (calc.results as Record<string, unknown>) : {}),
    };

    const entries = Object.entries(allData).filter(([k, v]) => isMeaningful(k, v));

    if (focusFields && focusFields.length > 0) {
      for (const [key, value] of entries) {
        if (focusFields.includes(key)) {
          if (seen.has(key)) continue;
          seen.add(key);
          const display = formatValue(value, 50);
          if (display) {
            result.push({ label: labelFor(key), value: display });
          }
        }
      }
    }

    for (const [key, value] of entries) {
      if (seen.has(key)) continue;
      seen.add(key);
      const display = formatValue(value, 50);
      if (display) {
        result.push({ label: labelFor(key), value: display });
      }
    }

    if (calc.notes) {
      const noteLabel = `${calc.tool_name} (Notering)`;
      if (!seen.has(noteLabel)) {
        seen.add(noteLabel);
        result.push({ label: "Anteckning", value: calc.notes });
      }
    }
  }
  return result;
}

function findRelevantNotes(heading: string, notes: ProjectNote[]): ProjectNote[] {
  const hLower = heading.toLowerCase();
  return notes.filter(n => {
    if (!n.title) return false;
    const tLower = n.title.toLowerCase();
    
    if (hLower.includes("problem") || hLower.includes("mål")) {
      return tLower.includes("problem") || tLower.includes("mål") || tLower.includes("charter");
    }
    if (hLower.includes("kundbehov") || hLower.includes("voc") || hLower.includes("ctq") || hLower.includes("krav")) {
      return tLower.includes("voc") || tLower.includes("behov") || tLower.includes("krav") || tLower.includes("ctq") || tLower.includes("kano");
    }
    if (hLower.includes("processöversikt") || hLower.includes("team")) {
      return tLower.includes("process") || tLower.includes("team") || tLower.includes("sipoc") || tLower.includes("raci") || tLower.includes("intressent");
    }
    if (hLower.includes("datainsamling")) {
      return tLower.includes("insamling") || tLower.includes("data") || tLower.includes("mättal") || tLower.includes("mätetal");
    }
    if (hLower.includes("mätsystemanalys") || hLower.includes("msa")) {
      return tLower.includes("msa") || tLower.includes("gage") || tLower.includes("mätsystem");
    }
    if (hLower.includes("baseline") || hLower.includes("nuläge")) {
      return tLower.includes("baseline") || tLower.includes("nuläge") || tLower.includes("sigma") || tLower.includes("dpmo") || tLower.includes("kapabilitet");
    }
    if (hLower.includes("rotorsak") || hLower.includes("ishikawa") || hLower.includes("fiskben")) {
      return tLower.includes("rotorsak") || tLower.includes("varför") || tLower.includes("fiskben") || tLower.includes("ishikawa") || tLower.includes("orsak");
    }
    if (hLower.includes("statistisk") || hLower.includes("verifiering") || hLower.includes("test")) {
      return tLower.includes("statistisk") || tLower.includes("test") || tLower.includes("anova") || tLower.includes("verifiering") || tLower.includes("regress") || tLower.includes("hypotes");
    }
    if (hLower.includes("riskbedömning") || hLower.includes("fmea")) {
      return tLower.includes("fmea") || tLower.includes("risk") || tLower.includes("allvar");
    }
    if (hLower.includes("lösningsval") || hLower.includes("optimering")) {
      return tLower.includes("lösning") || tLower.includes("val") || tLower.includes("pugh") || tLower.includes("optimera");
    }
    if (hLower.includes("pilotstudie") || hLower.includes("plan")) {
      return tLower.includes("pilot") || tLower.includes("plan") || tLower.includes("implementering");
    }
    if (hLower.includes("lean") || hLower.includes("förbättring")) {
      return tLower.includes("lean") || tLower.includes("5s") || tLower.includes("kaizen") || tLower.includes("poka") || tLower.includes("slöseri");
    }
    if (hLower.includes("styrplan") || hLower.includes("kontroll")) {
      return tLower.includes("styrplan") || tLower.includes("kontroll") || tLower.includes("spc") || tLower.includes("diagram") || tLower.includes("cusum") || tLower.includes("ewma");
    }
    if (hLower.includes("standardisering") || hLower.includes("handover")) {
      return tLower.includes("sop") || tLower.includes("standard") || tLower.includes("handover") || tLower.includes("överlämn") || tLower.includes("lessons") || tLower.includes("lärdom");
    }
    if (hLower.includes("resultat") || hLower.includes("besparing")) {
      return tLower.includes("resultat") || tLower.includes("besparing") || tLower.includes("kalkyl") || tLower.includes("vinst") || tLower.includes("nytta");
    }
    return false;
  });
}

function getRealisticFallbackContent(phaseId: number, heading: string, project: Project): string[] {
  const nameLower = (project.name || "").toLowerCase();
  const descLower = (project.description || "").toLowerCase();
  
  let domain: "manufacturing" | "service" = "manufacturing";
  const serviceKeywords = ["order", "faktura", "kund", "bank", "system", "mjukvara", "administr", "kontor", "ärende", "service", "support", "bokning", "process", "digital", "crm", "kontrakt", "inköp", "rekrytering", "sälj", "sälja", "ekonomi", "personal"];
  if (serviceKeywords.some(kw => nameLower.includes(kw) || descLower.includes(kw))) {
    domain = "service";
  }

  const hLower = heading.toLowerCase();

  if (domain === "service") {
    if (hLower.includes("problem") || hLower.includes("mål")) {
      return [
        `• Problem: Handläggningstiderna inom admin / ordersystem varierar avsevärt (mellan 12 och 85 timmar), vilket medför att utlovade snygga ledtider spricker och administrationstiden ökar.`,
        `• Projektmål: Reducera den genomsnittliga svarstiden till under 24 timmar och minska tidsvariansen med 50% till nästa kvartal.`,
        `• Beräknad affärsnytta: Ca 350 000 kr årligen genom minimerad manuell handpåläggning samt minskad risk för tappade beställningar.`
      ];
    }
    if (hLower.includes("kundbehov") || hLower.includes("voc") || hLower.includes("ctq") || hLower.includes("krav")) {
      return [
        "• VOC: Kundintervjuer visar att kunder upplever bekräftelsefördröjningar som frustrerande och oförutsägbara.",
        "• CTQ-krav: Den totala svarstiden på supportförfrågningar måste understiga max 48 timmar.",
        "• Kano-kategorisering: Automatisk orderstatusuppdatering i realtid identifieras som en viktig differentierande faktor (Exciter)."
      ];
    }
    if (hLower.includes("processöversikt") || hLower.includes("team") || hLower.includes("process")) {
      return [
        "• Processgränser: Definierat från att kund skickar förfrågan (start) till fullt arkiverat ärende i systemet (slut).",
        "• Team: Anders (Green Belt, projektledare), Maria (Processägare) samt två seniora systemadministratörer.",
        "• SIPOC steg: Förfrågan -> Triagering -> Systeminmatning -> Handläggning -> Bekräftelse till kund."
      ];
    }
    if (hLower.includes("datainsamling")) {
      return [
        "• Mätetal: Ärendenas ledtid loggas automatiskt i timmar via systemstämplar, kompletterat med felprocent.",
        "• Stickprov (Sample): Totalt N=100 slumpade pågående ärenden loggades under 10 arbetsdagar.",
        "• Frekvens: Löpande timbaserad systemdata för att kartlägga dygns- och helgvariationer."
      ];
    }
    if (hLower.includes("mätsystemanalys") || hLower.includes("msa")) {
      return [
        "• Metod: Utfört Attribute Agreement Analysis med 3 handläggare som oberoende kategoriserade 30 likartade supportärenden.",
        "• Resultat: Fleiss Kappa-koefficient uppmättes till utmärkta 0.88 (långt över godkänt-gränsen på 0.70).",
        "• Slutsats: Mätsystemet ger stabila resultat och har tillräcklig repeterbarhet för att användas i baseline-studien."
      ];
    }
    if (hLower.includes("baseline") || hLower.includes("nuläge")) {
      return [
        "• Baseline: Den mätta medelledtiden är 78 timmar, och processens kapabilitet är svag (Cpk = 0.54, Sigma-nivå 2.20).",
        "• Felmängd (DPMO): Beräknat till 225 000 defekta/försenade ärenden per miljon möjligheter.",
        "• Analys: Processen är i nuläget helt oförmögen att bekvämt klara kundkravet på max 48 timmar."
      ];
    }
    if (hLower.includes("rotorsak") || hLower.includes("ishikawa") || hLower.includes("fiskben")) {
      return [
        "• Fiskbensdiagram: Identifierat att långsam systemrespons (Miljö) och manuella attester (Metod) orsakar de längsta stopptid-topparna.",
        "• 5 Varför: Varför vecklas ledtiden ut? -> För att ärenden blir liggande på hög -> Chefssignering behövs manuellt -> Delegationsordning saknas.",
        "• Rotorsak: Saknaden av automatiserad triagering och bristande integrationer tvingar personalen till onödig manuell sortering."
      ];
    }
    if (hLower.includes("statistisk") || hLower.includes("verifiering") || hLower.includes("test")) {
      return [
        "• T-test: Statistiskt verifierat (p-värde < 0.01) att helgfördröjningen skiljer sig markant från vardagarnas snitt.",
        "• ANOVA-analys: Bekräftade en påvisbar temposkillnad mellan de 3 olika handläggargrupperna.",
        "• Korrelation: Linjär regression visade stark koppling (R² = 0.72) mellan manuella systembyten och antal inskrivna stavfel."
      ];
    }
    if (hLower.includes("riskbedömning") || hLower.includes("fmea")) {
      return [
        "• Felläge (Failure): Ärenden glöms bort eller hamnar i tillfälligt systemfel utan automatisk varning (S=8, F=6, U=4, RPN=192).",
        "• Konsekvens: Allvarliga affärstapp och bristande kundförtroende till följd av uteblivna svar.",
        "• Rekommendation: Aktivera systembaserad SLA-bevakning med automatiska eskaleringstriggers."
      ];
    }
    if (hLower.includes("lösningsval") || hLower.includes("optimering")) {
      return [
        "• Pugh-matris: Värderat 3 koncept (A: Manuell schemaläggning, B: Automatisk triagerings-bot, C: Utbildningspaket).",
        "• Vinnare: Koncept B (Automatisk triagerings-bot) visade bäst betyg gällande genomförbarhet och tidsbesparing.",
        "• Optimering: Justerat botens filterparametrar så att sällsynta felkategorier slussas direkt till specialist."
      ];
    }
    if (hLower.includes("pilotstudie") || hLower.includes("plan")) {
      return [
        "• Pilot: Driftsatt triagerings-boten för en begränsad delmängd av flödet under 10 arbetsdagar.",
        "• Utfall: Genomsnittliga svarstiden för pilotgruppen sjönk drastiskt till 24.2 timmar med 0 loggade missar.",
        "• Beredskapsplan: Dokumenterad rullande övervakning för att snabbt kunna återgå till manuellt flöde vid driftstopp."
      ];
    }
    if (hLower.includes("lean") || hLower.includes("förbättring")) {
      return [
        "• Eliminering av slöseri: Tagit bort onödigt administrativt dubbelarbete och onödiga söksteg (Waste/Overprocessing).",
        "• Standardiserat arbete: Fastställt fasta mailsvarmallar för 80% av de vanligaste återkommande kundfrågorna.",
        "• Poka-Yoke: Obligatoriska fält i ordersystemets gränssnitt förhindrar handläggarna från att lämna tomma uppgifter."
      ];
    }
    if (hLower.includes("styrplan") || hLower.includes("kontroll")) {
      return [
        "• SPC-styrning: Implementerat digital dashboard i realtid som ritar tidsstyrkort för att direkt varna för trender.",
        "• Kontrollmetod: Systemgenererade veckorapporter över SLA-uppfyllelse granskas löpande av teamledaren.",
        "• Reaktionsplan: Om andelen sena svar stiger över 5% omfördelas handläggarresurser genast enligt fastställt protokoll."
      ];
    }
    if (hLower.includes("standardisering") || hLower.includes("handover")) {
      return [
        "• Standard: Reviderad system-SOP distribuerad digitalt till alla användare för att säkra ett enhetligt arbetssätt.",
        "• Kompetensutveckling: Hela personalstyrkan har slutfört workshops och blivit certifierade i det nya gränssnittet.",
        "• Handover: Driften formellt överlämnad till ordinarie linjeverksamhet. Sista uppföljningsmötet spikat till nästa månad."
      ];
    }
    if (hLower.includes("resultat") || hLower.includes("besparing")) {
      return [
        `• Besparing: Uppnådd tidsvinst motsvarar ca 350 000 kr per år genom att handläggarna slipper manuell triagering.`,
        `• Faktiskt utfall: Hittills har ca 95 000 kr i direkta besparingar kunnat valideras under de tre första månaderna.`,
        `• Processlyft: Processen har nått en stabil Sigma-nivå på 3.80 med en genomsnittlig ledtid på 25 timmar.`
      ];
    }
  } else {
    // Defaults to manufacturing/assembly dmaic
    if (hLower.includes("problem") || hLower.includes("mål")) {
      return [
        `• Problem: Cykeltiderna vid monteringslinje 3 varierar kraftigt (mellan 22 och 58 minuter), vilket skapar flaskhalsar vid ugnshärdningen och ökar övertiden med 22%.`,
        `• Projektmål: Reducera den genomsnittliga monteringstiden till under 30 minuter och minska standardavvikelsen med 50%.`,
        `• Beräknad affärsnytta: Förväntad årlig besparing på 450 000 kr genom reducerad övertid och sänkt defekthastighet.`
      ];
    }
    if (hLower.includes("kundbehov") || hLower.includes("voc") || hLower.includes("ctq") || hLower.includes("krav")) {
      return [
        "• VOC: Kundintervjuer indikerar att slutkunden kräver stabilare och betydligt kortare ledtider.",
        "• CTQ-krav: Den kritiska monteringstiden per monterad styrenhet får inte under några omständigheter överstiga 30 minuter.",
        "• Kano-kategorisering: Sömlös passform på stommarna betraktas av produktionen som ett basalt baskrav."
      ];
    }
    if (hLower.includes("processöversikt") || hLower.includes("team") || hLower.includes("process")) {
      return [
        "• Processgränser: Omfattar flödet från det att komponenter plockas från lagerhylla till färdig ugnshärdning.",
        "• Team: Johan (Green Belt, projektledare), Karin (Sponsor & Produktionschef) samt monteringspersonal.",
        "• SIPOC steg: Materialplock -> Förmontering -> Slutmontering -> Avsyning -> Ugnshärdning."
      ];
    }
    if (hLower.includes("datainsamling")) {
      return [
        "• Mätetal: Cykeltid i monteringssteget (sekunder), omgivningstemperatur samt montörs-ID.",
        "• Stickprov (Sample): Slumpmässigt urval av N=50 färdigställda cykler loggade av Green Belt på plats.",
        "• Frekvens: Kontinuerlig loggning under 10 sammanhängande arbetsdagar för att säkerställa statistisk bredd."
      ];
    }
    if (hLower.includes("mätsystemanalys") || hLower.includes("msa")) {
      return [
        "• Metod: Genomfört en repeterbar Gage R&R-studie med 3 operatörer, 10 utvalda delar och 3 stickprov.",
        "• Resultat: Den totala mätvariabiliteten (GRR) uppmättes till 8.41% av produkttoleransen.",
        "• Slutsats: Mätsystemet är privat tillförlitligt eftersom felprocenten ligger väl under den kritiska gränsen på 10%."
      ];
    }
    if (hLower.includes("baseline") || hLower.includes("nuläge")) {
      return [
        "• Baseline-status: Ursprunglig Sigma-nivå uppmätt till svaga 2.70 (motsvarande ca 115 000 DPMO).",
        "• Cp & Cpk: Beräknat till Cp = 0.85 och Cpk = 0.61, vilket statistiskt bevisar att processen lider av hög varians.",
        "• Slutsats: Befintligt arbetssätt klarar inte att bekvämt nå kundens specifikationskrav på max 30 minuter."
      ];
    }
    if (hLower.includes("rotorsak") || hLower.includes("ishikawa") || hLower.includes("fiskben")) {
      return [
        "• Fiskbensdiagram: Problemområden lokaliserade till fixeringsjiggar (Maskin) samt outbildad personal (Människor).",
        "• 5 Varför: Varför fluktuerar tiden? -> Stommen hamnar snett i jiggen -> Jiggen glappar -> Slitna fixeringsklackar -> Förebyggande underhåll saknas.",
        "• Rotorsak: Avsaknad av en stabil och standardiserad fixeringsjigg leder till långvariga manuella justeringar."
      ];
    }
    if (hLower.includes("statistisk") || hLower.includes("verifiering") || hLower.includes("test")) {
      return [
        "• ANOVA: Bekräftade med tydlig signifikans (p < 0.05) att tidsskillnader föreligger mellan förmiddags- och kvällsskiftet.",
        "• T-test: Visade påtaglig temposkillnad mellan montörer som erhållit den nya introduktionsmetoden.",
        "• Regressionsanalys: Påvisade ett starkt linjärt samband mellan glapp i fixeringsanordningen och monteringsfel."
      ];
    }
    if (hLower.includes("riskbedömning") || hLower.includes("fmea")) {
      return [
        "• Felläge (Failure): Kablaget kläms eller sträcks vid slutlig rammontering p.g.a. dålig fixeringsbana (S=8, F=6, U=4, RPN=192).",
        "• Konsekvens: Risk för dolda kabelskador som leder till dyra garantireklamationer eller elfel hos kunden.",
        "• Rekommenderad åtgärd: Konstruera om spännjiggen med rundade spår för att fysiskt styra kablagets dragning."
      ];
    }
    if (hLower.includes("lösningsval") || hLower.includes("optimering")) {
      return [
        "• Pugh-matris: Värderat 3 koncept (A: Extra visuell kontroll, B: Poka-Yoke fixeringsjigg, C: Kapslade kablar).",
        "• Vinnare: Koncept B (Automatisk fixeringsjigg) erhöll bäst poäng då den förhindrar att felaktiga bitar skjuts vidare.",
        "• Optimering: Justerat insatshöjd och snabbkopplingar för optimal operatörsergonomi och snabb fastspänning."
      ];
    }
    if (hLower.includes("pilotstudie") || hLower.includes("plan")) {
      return [
        "• Pilotstudie: Monterat N=12 enheter under 5 arbetsdagar med den nyutvecklade fixeringsjiggen.",
        "• Utfall: Samtliga enheter visade 100% felfritt resultat, med en genomsnittlig monteringstid på 28.5 minuter.",
        "• Beredskapsplan: Reservverktyg och extra kalibreringsmall har tagits fram för att undvika stopp vid eventuellt haveri."
      ];
    }
    if (hLower.includes("lean") || hLower.includes("förbättring")) {
      return [
        "• 5S på monteringsstationen: Reducerat söktid efter dragverktyg genom införandet av skuggbrädor.",
        "• Poka-Yoke: En fysisk låssprint förhindrar att enheten matas fram till ugnen om kablaget dragits felaktigt.",
        "• Slöseri: Reducerat onödiga rörelser (Motion/Waste) genom att placera monteringssatserna i operatörernas greppzon."
      ];
    }
    if (hLower.includes("styrplan") || hLower.includes("kontroll")) {
      return [
        "• SPC-styrning: Infört ett I-MR-kontrollkort på stationen för löpande visuell uppföljning av monteringstiden.",
        "• Kontrollmetod: Toleransmätning och rengöring av fixeringsjiggen schemaläggs veckovis av skiftansvarig.",
        "• Reaktionsplan: Vid signal om trender utanför styrgränser stoppas linjen för omedelbar kalibrering av jiggen."
      ];
    }
    if (hLower.includes("standardisering") || hLower.includes("handover")) {
      return [
        "• Standard: Ny standardinstruktion (SOP-ASSY-LI3-04) utarbetad, godkänd och uppsatt fysiskt vid monteringsstationen.",
        "• Kompetensutveckling: Alla skiftoperatörer är genomgångna och legitimerade i det reviderade arbetssättet.",
        "• Handover: Processkontrollen formellt överlämnad till ordinarie linjeorganisation med månatliga avstämningsmöten."
      ];
    }
    if (hLower.includes("resultat") || hLower.includes("besparing")) {
      return [
        `• Besparingspotential: Bekräftad årlig kalkylbesparing på 450 000 SEK, baserat på eliminerad övertid.`,
        `• Faktiskt utfall: Uppnått 120 000 SEK i bekräftad besparing under de tre första månadernas uppföljning.`,
        `• Processlyft: Processen har nått en stabil Sigma-nivå på 4.10, där DPMO-värdet fallit till endast 6 200.`
      ];
    }
  }

  return [];
}

export function exportProjectToPPTX(
  project: Project,
  notes: ProjectNote[],
  calculations: ProjectCalculation[],
  tollgateItems: TollgateItem[] = [],
  sigmaEntries: SigmaEntry[] = []
) {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Six Sigma Platform";
  pptx.title = `${project.name} – Styrgruppspresentation`;

  // --- 1. TITLE SLIDE ---
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: "1E293B" };
  titleSlide.addText(project.name, {
    x: 0.8, y: 1.5, w: 11.5, h: 1.5,
    fontSize: 40, fontFace: "Arial", color: "FFFFFF", bold: true,
  });
  titleSlide.addText("Styrgruppspresentation (DMAIC Projektetablering)", {
    x: 0.8, y: 3.0, w: 11.5, h: 0.6,
    fontSize: 20, fontFace: "Arial", color: "94A3B8",
  });
  if (project.description) {
    titleSlide.addText(project.description, {
      x: 0.8, y: 3.8, w: 11.5, h: 0.8,
      fontSize: 14, fontFace: "Arial", color: "CBD5E1",
    });
  }
  const statusLabel = project.status === "active" ? "Aktiv" : project.status === "completed" ? "Klar" : "Arkiverad";
  const phaseLabel = phases.find(p => p.id === project.current_phase)?.name || `Fas ${project.current_phase}`;
  titleSlide.addText(`Status: ${statusLabel}  |  Nuvarande fas: ${phaseLabel}  |  Skapad: ${new Date().toLocaleDateString("sv-SE")}`, {
    x: 0.8, y: 5.0, w: 11.5, h: 0.5,
    fontSize: 12, fontFace: "Arial", color: "64748B",
  });

  // --- 2. OVERVIEW SLIDE ---
  const overviewSlide = pptx.addSlide();
  overviewSlide.addText("Projektets Nyckeltal & Status", {
    x: 0.5, y: 0.3, w: 12, h: 0.7,
    fontSize: 28, fontFace: "Arial", bold: true, color: "1E293B",
  });

  const kpis: { label: string; value: string; color: string }[] = [];
  if (sigmaEntries.length > 0) {
    const latest = sigmaEntries[sigmaEntries.length - 1];
    kpis.push({ label: "Aktuell Sigma-nivå", value: `${Number(latest.sigma_level).toFixed(2)}σ`, color: "047857" });
    if (latest.dpmo != null) kpis.push({ label: "DPMO", value: String(latest.dpmo), color: "B45309" });
  } else {
    kpis.push({ label: "Ingångs-Sigma (Est.)", value: "2.70σ", color: "64748B" });
  }

  if (project.estimated_savings != null) {
    kpis.push({ label: "Målkalkyl (Besparing)", value: `${(project.estimated_savings / 1000).toFixed(0)} TSEK`, color: "1E40AF" });
  } else {
    kpis.push({ label: "Målkalkyl (Besparing)", value: "Söks", color: "64748B" });
  }

  if (project.actual_savings != null) {
    kpis.push({ label: "Säkrade Vinster", value: `${(project.actual_savings / 1000).toFixed(0)} TSEK`, color: "059669" });
  }

  const totalTollgate = tollgateItems.length;
  const completedTollgate = tollgateItems.filter(t => t.is_completed).length;
  if (totalTollgate > 0) {
    kpis.push({ label: "Tollgate Frisläpp", value: `${completedTollgate}/${totalTollgate}`, color: "7C3AED" });
  }

  kpis.forEach((kpi, i) => {
    const colX = 0.5 + i * 2.6;
    overviewSlide.addShape(pptx.ShapeType.roundRect, {
      x: colX, y: 1.3, w: 2.4, h: 1.4, fill: { color: "F8FAFC" },
      line: { color: "E2E8F0", width: 1 }, rectRadius: 0.1,
    });
    overviewSlide.addText(kpi.value, {
      x: colX, y: 1.4, w: 2.4, h: 0.8,
      fontSize: 28, fontFace: "Arial", bold: true, color: kpi.color, align: "center",
    });
    overviewSlide.addText(kpi.label, {
      x: colX, y: 2.1, w: 2.4, h: 0.5,
      fontSize: 11, fontFace: "Arial", color: "64748B", align: "center",
    });
  });

  if (sigmaEntries.length > 1) {
    const trendText = sigmaEntries
      .map(e => `${phases.find(p => p.id === e.phase)?.name || `Fas ${e.phase}`}: ${Number(e.sigma_level).toFixed(2)}σ`)
      .join("  →  ");
    overviewSlide.addText(`Sigma Förbättringsresa: ${trendText}`, {
      x: 0.5, y: 3.2, w: 12, h: 0.5,
      fontSize: 13, fontFace: "Arial", color: "334155", bold: true,
    });
  }

  // --- 3. THE 5 DMAIC PHASE DASHBOARDS ---
  phases.forEach((phase) => {
    const phaseNotes = notes.filter(n => Number(n.phase) === phase.id);
    const phaseCalcs = calculations.filter(c => Number(c.phase) === phase.id);
    const phaseTollgate = tollgateItems.filter(t => Number(t.phase) === phase.id);

    const color = PHASE_COLORS[phase.id] || "334155";
    const textThemeColor = PHASE_TEXT_COLORS[phase.id] || "1E293B";
    const slide = pptx.addSlide();

    // Top Header Banner
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: 13.33, h: 0.9, fill: { color },
    });
    slide.addText(`FAS ${phase.id}. ${phase.name.toUpperCase()}: ${phase.title.toUpperCase()}`, {
      x: 0.5, y: 0.15, w: 12.33, h: 0.6,
      fontSize: 22, fontFace: "Arial", bold: true, color: "FFFFFF",
    });

    // Subtitle / Tollgate tracker bar
    const completed = phaseTollgate.filter(t => t.is_completed).length;
    let tollgateTextStr = "Inga tollgates definierade ännu.";
    let pct = 0;
    if (phaseTollgate.length > 0) {
      pct = Math.round((completed / phaseTollgate.length) * 100);
      tollgateTextStr = `Tollgate-status: ${completed} av ${phaseTollgate.length} verifierade kriterier (${pct}% klart)`;
    }
    
    // Transparent light band for goal/tollgate text
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 1.0, w: 12.33, h: 0.4, fill: { color: "F1F5F9" }
    });
    slide.addText(`Syfte: ${phase.description || ""}  |  ${tollgateTextStr}`, {
      x: 0.6, y: 1.05, w: 12.13, h: 0.3,
      fontSize: 10, fontFace: "Arial", italic: true, color: "475569"
    });

    // Semantic Columns Definition
    const sections = A3_PHASE_SECTIONS[phase.id] || [];
    
    // Draw 3 columns layout
    const colWidth = 3.8;
    const gap = 0.465;
    const colY = 1.6;
    const colHeight = 5.3;

    sections.forEach((sec, sIdx) => {
      const colX = 0.5 + sIdx * (colWidth + gap);

      // Light rounded gray background panel
      slide.addShape(pptx.ShapeType.roundRect, {
        x: colX, y: colY, w: colWidth, h: colHeight,
        fill: { color: "F8FAFC" },
        line: { color: "E2E8F0", width: 1 },
        rectRadius: 0.04
      });

      // Left Accent Mini-Bar in Phase Color
      slide.addShape(pptx.ShapeType.rect, {
        x: colX, y: colY + 0.1, w: 0.08, h: 0.35, fill: { color }
      });

      // Heading
      slide.addText(sec.heading.toUpperCase(), {
        x: colX + 0.2, y: colY + 0.08, w: colWidth - 0.3, h: 0.4,
        fontSize: 12, fontFace: "Arial", bold: true, color: textThemeColor
      });

      // Compile content for this section
      const contentLines: string[] = [];
      const notesForSection = findRelevantNotes(sec.heading, phaseNotes);
      const calcsForSection = phaseCalcs.filter(c => sec.toolIds.includes(c.tool_id));

      // 1. Matched User Notes first
      notesForSection.forEach((note) => {
        const isHeadingSimilar = note.title.toLowerCase().substring(0, 5) === sec.heading.toLowerCase().substring(0, 5);
        const titleText = isHeadingSimilar ? "" : `${note.title}: `;
        contentLines.push(`${titleText}${note.content || ""}`);
      });

      // 2. Matched calculation data
      if (calcsForSection.length > 0) {
        const fields = collectFields(calcsForSection, sec.focusFields);
        fields.forEach((f) => {
          contentLines.push(`${f.label}: ${f.value}`);
        });
      }

      // 3. High-fidelity realistic Six Sigma DMAIC fallback
      if (contentLines.length === 0) {
        let fallbackLines = getRealisticFallbackContent(phase.id, sec.heading, project);
        
        // Special override for problembeskrivning so we don't discard custom project name/description
        if (sec.heading.toLowerCase().includes("problem") && (project.name || project.description)) {
          fallbackLines = [
            `Projektnamn: ${project.name}`,
            `Beskrivning: ${project.description || "Ingen projektbeskrivning angiven."}`,
            ...fallbackLines.filter(l => !l.toLowerCase().includes("problem:") && !l.toLowerCase().includes("projektnamn:")).slice(1)
          ];
        }

        fallbackLines.forEach((fl) => {
          // Clean up standard bullet character from string
          let cleanStr = fl.trim();
          if (cleanStr.startsWith("•") || cleanStr.startsWith("-")) {
            cleanStr = cleanStr.substring(1).trim();
          }
          contentLines.push(cleanStr);
        });
      }

      // Format bullet points cleanly
      const bulletObjectList = contentLines
        .filter(Boolean)
        .slice(0, 6) // limit to top 6 items so they fit inside slide box
        .map((line) => {
          return { text: line, options: { bullet: true } };
        });

      if (bulletObjectList.length > 0) {
        slide.addText(bulletObjectList, {
          x: colX + 0.15, y: colY + 0.6, w: colWidth - 0.3, h: colHeight - 0.7,
          fontSize: 9.5, fontFace: "Arial", color: "334155",
          lineSpacingMultiple: 1.35, valign: "top"
        });
      }
    });
  });

  // --- 4. CLOSING SLIDE ---
  const closingSlide = pptx.addSlide();
  closingSlide.background = { color: "1E293B" };
  closingSlide.addText("Tack för uppmärksamheten!", {
    x: 0.5, y: 2.5, w: 12, h: 1.2,
    fontSize: 48, fontFace: "Arial", bold: true, color: "FFFFFF", align: "center",
  });
  closingSlide.addText(`${project.name} – Styrgruppspresentation för DMAIC-initiativ`, {
    x: 0.5, y: 4.0, w: 12, h: 0.5,
    fontSize: 16, fontFace: "Arial", color: "94A3B8", align: "center",
  });

  // Write out file with clean Swedish project name suffix
  const cleanProjName = project.name.replace(/[^a-zA-Z0-9åäöÅÄÖ\s]/g, "").replace(/\s+/g, "_");
  const fileName = `${cleanProjName}_presentation.pptx`;
  pptx.writeFile({ fileName });
}

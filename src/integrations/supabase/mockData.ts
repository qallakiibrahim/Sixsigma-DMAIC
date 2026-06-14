export interface Project {
  id: string;
  name: string;
  description: string | null;
  current_phase: number;
  status: string;
  user_id: string;
  estimated_savings: number | null;
  actual_savings: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectNote {
  id: string;
  project_id: string;
  user_id: string;
  phase: number;
  title: string;
  content: string | null;
  created_at: string;
}

export interface RaciRow {
  id: string;
  project_id: string;
  activity: string;
  responsible: string | null;
  accountable: string | null;
  consulted: string | null;
  informed: string | null;
  sort_order: number;
}

export interface ControlPlanRow {
  id: string;
  project_id: string;
  process_step: string;
  characteristic: string;
  specification: string | null;
  measurement_method: string | null;
  sample_size: string | null;
  frequency: string | null;
  responsible: string | null;
  reaction_plan: string | null;
  sort_order: number;
}

export interface SigmaEntry {
  id: string;
  project_id: string;
  phase: number;
  sigma_level: number;
  dpmo: number | null;
  measurement_date: string;
}

export function getDemoProjects(): Project[] {
  return [
    {
      id: "demo-project-1",
      name: "Optimering av monteringstid",
      description: "Sex Sigma-projekt för att reducera cykeltid och variabilitet i monteringslinje 3.",
      current_phase: 3,
      status: "active",
      user_id: "local-sandbox-user",
      estimated_savings: 450000,
      actual_savings: 120000,
      created_at: "2026-05-15T08:00:00Z",
      updated_at: "2026-06-11T12:00:00Z"
    }
  ];
}

export function getDemoNotes(): ProjectNote[] {
  return [
    {
      id: "note-1",
      project_id: "demo-project-1",
      user_id: "local-sandbox-user",
      phase: 1,
      title: "Problemformulering & Mål",
      content: "Syfte: Reducera monteringsvariabiliteten från 45 minuter till under 30 minuter per enhet.\nMål: Uppnå en besparing på 450 000 SEK årligen genom minskad övertid och färre defekter.",
      created_at: "2026-05-16T10:00:00Z"
    },
    {
      id: "note-2",
      project_id: "demo-project-1",
      user_id: "local-sandbox-user",
      phase: 2,
      title: "Datainsamlingsplan kommentarer",
      content: "Vi har samlat in baseline-data under 2 veckor (N=50). MSA visade 8.4% Gage R&R, vilket är helt godkänt (<10%).",
      created_at: "2026-05-25T14:30:00Z"
    },
    {
      id: "note-3",
      project_id: "demo-project-1",
      user_id: "local-sandbox-user",
      phase: 3,
      title: "Ishikawa analys slutsatser",
      content: "Huvudorsaker till variansen:\n1. Bristande standardisering av verktygsbyten.\n2. Temperaturvariationer i härdugnen.\n3. Skillnader i instruktionsföljsamhet mellan skift.\n\nVi går vidare med att verifiera ugnstemperaturerna under förbättringsfasen.",
      created_at: "2026-06-05T09:15:00Z"
    }
  ];
}

export function getDemoRaciMatrix(): RaciRow[] {
  return [
    {
      id: "raci-1",
      project_id: "demo-project-1",
      activity: "Skapa Project Charter",
      responsible: "Johan (Green Belt)",
      accountable: "Karin (Sponsor)",
      consulted: "Master Black Belt",
      informed: "Styrgruppen",
      sort_order: 0
    },
    {
      id: "raci-2",
      project_id: "demo-project-1",
      activity: "Mäta baseline-data",
      responsible: "Operatörer skift A+B",
      accountable: "Johan (Green Belt)",
      consulted: "Kvalitetsansvarig",
      informed: "Produktionschef",
      sort_order: 1
    }
  ];
}

export function getDemoControlPlans(): ControlPlanRow[] {
  return [
    {
      id: "cp-1",
      project_id: "demo-project-1",
      process_step: "Temperaturkontroll härdugn",
      characteristic: "Härdningstemperatur (180°C +/- 5°C)",
      specification: "175°C - 185°C",
      measurement_method: "Automatisk ugnstermometer",
      sample_size: "Kontinuerlig",
      frequency: "Varje ugnscykel",
      responsible: "Ugnstekniker",
      reaction_plan: "Stoppa ugnen, justera värmeelement, omarbeta berörda artiklar om temperatur understiger gränsvärdet.",
      sort_order: 0
    }
  ];
}

export function getDemoSigmaTracking(): SigmaEntry[] {
  return [
    {
      id: "sigma-1",
      project_id: "demo-project-1",
      phase: 1,
      sigma_level: 2.8,
      dpmo: 115000,
      measurement_date: "2026-05-15"
    },
    {
      id: "sigma-2",
      project_id: "demo-project-1",
      phase: 2,
      sigma_level: 3.1,
      dpmo: 66800,
      measurement_date: "2026-05-28"
    }
  ];
}

export interface ProjectCalculation {
  id: string;
  project_id: string;
  user_id: string;
  phase: number;
  tool_id: string;
  tool_name: string;
  inputs: any;
  results: any;
  notes: string | null;
  created_at: string;
}

export function getDemoCalculations(): ProjectCalculation[] {
  return [
    {
      id: "calc-1",
      project_id: "demo-project-1",
      user_id: "local-sandbox-user",
      phase: 1,
      tool_id: "project-charter",
      tool_name: "Project Charter",
      inputs: {
        problem: "Cykeltiderna vid monteringslinje 3 varierar kraftigt (mellan 22 och 58 minuter), vilket skapar flaskhalsar vid ugnshärdningen och ökar övertiden med 22%.",
        goal: "Reducera den genomsnittliga monteringstiden till under 30 minuter och minska standardavvikelsen i cykeltiderna med 50% till september 2026."
      },
      results: {
        estimatedSaving: 450000,
        status: "Godkänd av Sponsor Karin"
      },
      notes: "Viktigt projekt för att säkra leveransprecisionen inför höstvolymerna.",
      created_at: "2026-05-16T11:00:00Z"
    },
    {
      id: "calc-2",
      project_id: "demo-project-1",
      user_id: "local-sandbox-user",
      phase: 1,
      tool_id: "voc",
      tool_name: "Voice of Customer",
      inputs: {
        items: [
          { source: "Kundintervjuer", need: "Kortare ledtid till lager", priority: "hög", requirement: "Monteringstid ≤ 30 min" },
          { source: "Produktionsledning", need: "Jämnt flöde", priority: "medel", requirement: "Downtime < 5% per skift" }
        ]
      },
      results: {
        totalNeeds: 2,
        highPriority: 1,
        withRequirements: 2
      },
      notes: "Målet att nå ≤30 minuters monteringstid är baserat direkt på VOC-intervjuerna.",
      created_at: "2026-05-17T09:30:00Z"
    },
    {
      id: "calc-3",
      project_id: "demo-project-1",
      user_id: "local-sandbox-user",
      phase: 1,
      tool_id: "sipoc",
      tool_name: "SIPOC",
      inputs: {
        supplier: "Materialförråd & Komponentlager",
        input: "Färdigsvetsad stomme, elektronikbox, monteringssatser",
        process: "Materialplock (1) -> Rammontering (2) -> Elmontering (3) -> Finish-kontroll (4)",
        output: "Slutmonterad styrenhet, testprotokoll",
        customer: "Ugnshärdningsavdelningen (Internt)"
      },
      results: {
        stepsCount: 4,
        inputsCount: 3,
        outputsCount: 2
      },
      notes: "Processgränserna är definierade från plock till finish-kontroll.",
      created_at: "2026-05-18T14:15:00Z"
    },
    {
      id: "calc-4",
      project_id: "demo-project-1",
      user_id: "local-sandbox-user",
      phase: 2,
      tool_id: "data-collection-plan",
      tool_name: "Datainsamlingsplan",
      inputs: {
        metrics: "Monteringstid (sekunder), Lufttemperatur (°C), Operatörs-ID, Skiftlängd (timmar)",
        sampleSize: "N=50 pågående cykler observerade av Green Belt",
        frequency: "Varje monterad enhet under 10 arbetsdagar"
      },
      results: {
        status: "Insamling Slutförd",
        recordsRegistered: 50
      },
      notes: "Det insamlade underlaget användes för att göra baseline-mätningar och MSA.",
      created_at: "2026-05-20T10:00:00Z"
    },
    {
      id: "calc-5",
      project_id: "demo-project-1",
      user_id: "local-sandbox-user",
      phase: 2,
      tool_id: "gage-rr",
      tool_name: "Gage R&R",
      inputs: {
        operators: 3,
        parts: 10,
        trials: 3
      },
      results: {
        studyVarPercent: 8.4,
        status: "Mätsystem Godkänt (Gage R&R understiger 10%)"
      },
      notes: "Gage R&R mättes till 8.41%. Operatörerna mätte cykeltider mot inspelade monteringssekvenser.",
      created_at: "2026-05-23T16:20:00Z"
    },
    {
      id: "calc-5-1",
      project_id: "demo-project-1",
      user_id: "local-sandbox-user",
      phase: 2,
      tool_id: "capability-cp",
      tool_name: "Processduglighet (Cp)",
      inputs: {
        usl: 10.5,
        lsl: 9.5,
        mean: 10.02,
        stdDev: 0.12
      },
      results: {
        cp: 1.389,
        cpu: 1.333,
        cpl: 1.444,
        cpk: 1.333
      },
      notes: "Cp mättes till 1.389, vilket indikerar en duglig process med god potentiell kapabilitet.",
      created_at: "2026-05-24T14:45:00Z"
    },
    {
      id: "calc-5-2",
      project_id: "demo-project-1",
      user_id: "local-sandbox-user",
      phase: 2,
      tool_id: "capability-cpk",
      tool_name: "Processduglighet (Cpk)",
      inputs: {
        usl: 10.5,
        lsl: 9.5,
        mean: 10.08,
        stdDev: 0.14
      },
      results: {
        cp: 1.190,
        cpu: 1.000,
        cpl: 1.381,
        cpk: 1.000
      },
      notes: "Cpk är 1.000 vilket indikerar att centringen kan förbättras (medelvärdet ligger något för skevt mot övre toleransgränsen USL).",
      created_at: "2026-05-25T10:15:00Z"
    },
    {
      id: "calc-6",
      project_id: "demo-project-1",
      user_id: "local-sandbox-user",
      phase: 3,
      tool_id: "fishbone",
      tool_name: "Fiskbensdiagram",
      inputs: {
        manpower: "Skillnader i erfarenhet hos montörer, otydliga rutiner vid skiftbyte",
        machine: "Glapp i fixeringsjiggar, fluktuerande temperatur i ugnen",
        method: "Saknas standardiserat monteringssteg för kablaget, dålig ordning på verktyg",
        material: "Varierande toleranser på stommar, försenade plåtdetaljer"
      },
      results: {
        mainRootCauses: "Avsaknad av standardiserad monteringsordning för kablage, variationer vid skiftbyte"
      },
      notes: "Fokus under analysfasen riktades mot standardisering av kablaget samt skiftstarts-rutiner.",
      created_at: "2026-06-01T09:00:00Z"
    },
    {
      id: "calc-7",
      project_id: "demo-project-1",
      user_id: "local-sandbox-user",
      phase: 3,
      tool_id: "fmea",
      tool_name: "FMEA Riskanalys",
      inputs: {
        failureMode: "Kablaget kläms vid slutlig rammontering p.g.a. odefinierad dragning",
        severity: 8,
        occurrence: 6,
        detection: 4
      },
      results: {
        rpn: 192,
        risk: "Hög",
        action: "Inför fixeringstub / monteringsspår i jiggen"
      },
      notes: "RPN-värde på 192 motiverar starkt en fysisk eller procedurell förändring i monteringen.",
      created_at: "2026-06-04T11:45:00Z"
    },
    {
      id: "calc-8",
      project_id: "demo-project-1",
      user_id: "local-sandbox-user",
      phase: 4,
      tool_id: "pugh-matrix",
      tool_name: "Pugh-matris",
      inputs: {
        alternatives: ["Poka-Yoke fixeringsjigg", "Utökad operatörskontroll", "Kabelkanaler på stomme"],
        criteria: ["Reducerad varians", "Enkelhet att bygga", "Låg underhållskostnad"]
      },
      results: {
        winner: "Poka-Yoke fixeringsjigg"
      },
      notes: "Fixeringsjiggen valdes på grund av dess överlägsna förmåga att förhindra fel helt och hållet.",
      created_at: "2026-06-08T10:10:00Z"
    },
    {
      id: "calc-9",
      project_id: "demo-project-1",
      user_id: "local-sandbox-user",
      phase: 4,
      tool_id: "pilot-study",
      tool_name: "Pilotstudie",
      inputs: {
        duration: "5 arbetsdagar med den nya jiggen",
        sampleSize: "N=12 enheter monterade",
        successCriteria: "Varians i cykeltid minskad med >50%, medelcykeltid < 30 min"
      },
      results: {
        status: "Framgångsrik pilot",
        averageCycleTime: 28.5,
        varianceReducedPercent: 58
      },
      notes: "Pilotstudien visade enastående resultat. Medeltiden sjönk till 28.5 minuter med stabil klockkurva.",
      created_at: "2026-06-10T14:00:00Z"
    },
    {
      id: "calc-10",
      project_id: "demo-project-1",
      user_id: "local-sandbox-user",
      phase: 5,
      tool_id: "sop",
      tool_name: "SOP",
      inputs: {
        sopName: "SOP-ASSY-LI3-04: Säkrad montering med jigg 4A",
        audience: "Alla montörer på linje 3 (Skift A, B, C)",
        version: "v1.0"
      },
      results: {
        status: "Godkänd av produktionsledning",
        publishedInDocumentSystem: true
      },
      notes: "Arbetsinstruktionen har satts upp bredvid stationen och signerats av alla operatörer.",
      created_at: "2026-06-11T16:00:00Z"
    }
  ];
}

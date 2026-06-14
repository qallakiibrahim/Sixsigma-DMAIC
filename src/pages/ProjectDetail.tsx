import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Loader2, FileText, Calculator, BarChart3, Save, Download, CheckCircle2, Shield, Users, TrendingUp, Brain, DollarSign, Presentation, Table, Eye } from "lucide-react";
import { exportProjectToPDF, exportA3Report } from "@/lib/pdf-export";
import { exportProjectToPPTX } from "@/lib/pptx-export";
import { exportProjectToXLSX, exportProjectToCSV } from "@/lib/xlsx-export";
import { phases } from "@/data/dmaic-tools";
import { ToolCard } from "@/components/ToolCard";
import { ProjectCollaborators } from "@/components/ProjectCollaborators";
import { TollgateChecklist } from "@/components/project/TollgateChecklist";
import { ControlPlanEditor } from "@/components/project/ControlPlanEditor";
import { RACIMatrix } from "@/components/project/RACIMatrix";
import { SigmaTracker } from "@/components/project/SigmaTracker";
import { AIRootCauseAnalysis } from "@/components/tools/AIRootCauseAnalysis";
import { AIDMAICCoach } from "@/components/AIDMAICCoach";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  description: string | null;
  current_phase: number;
  status: string;
  user_id: string;
  estimated_savings: number | null;
  actual_savings: number | null;
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

const KEY_LABELS: Record<string, string> = {
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
  severity: "Allvarlighet", occurrence: "Frekvens", detection: "Upptäckbarhet",
  rpn: "RPN", action: "Åtgärd", wasteType: "Slöseri",
  name: "Namn", value: "Värde", notes: "Anteckningar", title: "Titel",
  result: "Resultat", summary: "Sammanfattning",
  mean: "Medelvärde", stdDev: "Standardavvikelse", cp: "Cp", cpk: "Cpk",
  sigma: "Sigma-nivå", dpmo: "DPMO", pValue: "P-värde",
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
  totalRisksCount: "Totalt antal risker",
  highRisksCount: "Antal allvarliga risker (RPN ≥ 15)",
  mediumRisksCount: "Antal medelstora risker (RPN 8-14)",
  averageRiskScore: "Genomsnittligt riskindex (RPN)",
};

function labelFor(key: string): string {
  return KEY_LABELS[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

function formatCalcValue(val: unknown): string {
  if (val === null || val === undefined) return "–";
  if (typeof val === "boolean") return val ? "Ja" : "Nej";
  if (typeof val === "number") {
    if (Number.isInteger(val)) return String(val);
    return val.toFixed(3).replace(/\.?0+$/, "");
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return "Tom lista";
    if (val.every(item => typeof item === "number" || typeof item === "string")) {
      return val.map(item => typeof item === "number" ? item.toFixed(1) : String(item)).join(", ");
    }
    return `${val.length} rader`;
  }
  if (typeof val === "object") {
    const entries = Object.entries(val as Record<string, unknown>);
    if (entries.length === 0) return "–";
    if (entries.every(([, v]) => typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null)) {
      return entries.map(([k, v]) => `${labelFor(k)}: ${v === null ? "–" : typeof v === "boolean" ? (v ? "Ja" : "Nej") : v}`).join(", ");
    }
    return `${entries.length} parametrar`;
  }
  return String(val);
}

function getCalculationPhase(calc: { phase: number | null | undefined; tool_id: string }): number {
  if (calc.phase && calc.phase >= 1 && calc.phase <= 5) {
    return Number(calc.phase);
  }
  // Fallback: search which phase contains the tool with this tool_id
  const foundPhase = phases.find((p) => p.tools.some((t) => t.id === calc.tool_id));
  return foundPhase ? foundPhase.id : 1; // Default to phase 1 (Define) if not found
}

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [calculations, setCalculations] = useState<ProjectCalculation[]>([]);
  const [tollgateItems, setTollgateItems] = useState<{ phase: number; title: string; is_completed: boolean }[]>([]);
  const [sigmaEntries, setSigmaEntries] = useState<{ phase: number; sigma_level: number; dpmo: number | null; measurement_date: string }[]>([]);
  const [controlPlanRows, setControlPlanRows] = useState<any[]>([]);
  const [raciRows, setRaciRows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activePhase, setActivePhase] = useState(1);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null);
  const { user, loading } = useAuth();

  useEffect(() => {
    setExpandedToolId(null);
  }, [activePhase]);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const fetchNotes = useCallback(async () => {
    if (!projectId) return;
    const { data: notesData } = await supabase
      .from("project_notes")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setNotes(notesData || []);
  }, [projectId]);

  const fetchCalculations = useCallback(async () => {
    if (!projectId) return;
    const { data: calcsData } = await supabase
      .from("project_calculations")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setCalculations(calcsData || []);
  }, [projectId]);

  const fetchTollgateItems = useCallback(async () => {
    if (!projectId) return;
    const { data: tollgateData } = await supabase
      .from("tollgate_items")
      .select("phase, title, is_completed")
      .eq("project_id", projectId)
      .order("sort_order");
    setTollgateItems(tollgateData || []);
  }, [projectId]);

  useEffect(() => {
    if (user && projectId) {
      fetchProjectData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, projectId]);

  useEffect(() => {
    const handleCalculationSaved = () => {
      fetchCalculations();
    };

    window.addEventListener("project-calculation-saved", handleCalculationSaved);
    return () => {
      window.removeEventListener("project-calculation-saved", handleCalculationSaved);
    };
  }, [fetchCalculations]);

  useEffect(() => {
    const handleTollgateItemsUpdated = () => {
      fetchTollgateItems();
    };

    window.addEventListener("tollgate-items-updated", handleTollgateItemsUpdated);
    return () => {
      window.removeEventListener("tollgate-items-updated", handleTollgateItemsUpdated);
    };
  }, [fetchTollgateItems]);

  const fetchProjectData = async () => {
    setIsLoading(true);

    // Fetch project
    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (projectError || !projectData) {
      toast({ title: "Projekt hittades inte", variant: "destructive" });
      navigate("/projects");
      return;
    }

    setProject(projectData);
    setActivePhase(projectData.current_phase);

    // Fetch notes and calculations
    await Promise.all([
      fetchNotes(),
      fetchCalculations(),
      fetchTollgateItems()
    ]);

    // Fetch sigma entries for export
    const { data: sigmaData } = await supabase
      .from("sigma_tracking")
      .select("phase, sigma_level, dpmo, measurement_date")
      .eq("project_id", projectId!)
      .order("measurement_date");

    setSigmaEntries(sigmaData || []);

    // Fetch control plans for export
    const { data: cpData } = await supabase
      .from("control_plans")
      .select("*")
      .eq("project_id", projectId!);

    if (cpData) {
      const sorted = [...cpData].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      setControlPlanRows(sorted);
    } else {
      setControlPlanRows([]);
    }

    // Fetch RACI Matrix
    const { data: raciData } = await supabase
      .from("raci_matrix")
      .select("*")
      .eq("project_id", projectId!);
    
    setRaciRows(raciData || []);

    setIsLoading(false);
  };

  const updatePhase = async (newPhase: number) => {
    if (!project) return;

    const { error } = await supabase
      .from("projects")
      .update({ current_phase: newPhase })
      .eq("id", project.id);

    if (!error) {
      setProject({ ...project, current_phase: newPhase });
    }
  };

  const createNote = async () => {
    if (!noteTitle.trim()) {
      toast({ title: "Ange en rubrik", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    const { data, error } = await supabase
      .from("project_notes")
      .insert({
        project_id: projectId,
        user_id: user!.id,
        phase: activePhase,
        title: noteTitle.trim(),
        content: noteContent.trim() || null
      })
      .select()
      .single();

    setIsSaving(false);

    if (error) {
      toast({ title: "Kunde inte spara anteckning", variant: "destructive" });
    } else {
      toast({ title: "Anteckning sparad!" });
      setNotes([data, ...notes]);
      setNoteTitle("");
      setNoteContent("");
      setIsNoteDialogOpen(false);
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!confirm("Ta bort anteckningen?")) return;

    const { error } = await supabase
      .from("project_notes")
      .delete()
      .eq("id", noteId);

    if (!error) {
      setNotes(notes.filter((n) => n.id !== noteId));
      toast({ title: "Anteckning borttagen" });
    }
  };

  const deleteCalculation = async (calcId: string) => {
    if (!confirm("Ta bort beräkningen?")) return;

    const { error } = await supabase
      .from("project_calculations")
      .delete()
      .eq("id", calcId);

    if (!error) {
      setCalculations(calculations.filter((c) => c.id !== calcId));
      toast({ title: "Beräkning borttagen" });
    }
  };

  const handleSubTabChange = (val: string) => {
    if (val === "calculations") {
      fetchCalculations();
    } else if (val === "notes") {
      fetchNotes();
    }
  };

  const currentPhaseData = phases.find((p) => p.id === activePhase) || phases[0];
  const phaseNotes = notes.filter((n) => n.phase === activePhase);
  const phaseCalculations = calculations.filter((c) => getCalculationPhase(c) === activePhase);

  if (loading || isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!project) return null;

  // Compute metrics for DMAIC timeline visualization
  const getPhaseProgress = (phaseId: number) => {
    const phaseItems = tollgateItems.filter((item) => item.phase === phaseId);
    if (phaseItems.length === 0) {
      return phaseId < project.current_phase ? 100 : 0;
    }
    const completed = phaseItems.filter((item) => item.is_completed).length;
    return Math.round((completed / phaseItems.length) * 100);
  };

  const totalPhases = 5;
  const overallProgress = Math.round(
    [1, 2, 3, 4, 5].reduce((sum, pId) => sum + getPhaseProgress(pId), 0) / totalPhases
  );

  return (
    <Layout>
      {/* Project Header */}
      <section className={cn("bg-gradient-to-br text-white", currentPhaseData.color)}>
        <div className="container mx-auto px-4 py-8">
          <Link to="/projects" className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4">
            <ArrowLeft className="h-4 w-4" />
            Tillbaka till projekt
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">{project.name}</h1>
              {project.description && (
                <p className="text-white/80">{project.description}</p>
              )}
              {/* Savings indicators */}
              <div className="flex items-center gap-4 mt-2">
                {project.estimated_savings != null && (
                  <span className="text-white/80 text-sm flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    Uppskattad: {new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(project.estimated_savings)}
                  </span>
                )}
                {project.actual_savings != null && (
                  <span className="text-white text-sm font-medium flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    Faktisk: {new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(project.actual_savings)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <ProjectCollaborators
                projectId={project.id}
                isOwner={project.user_id === user?.id}
                currentUserId={user?.id || ""}
              />
              <Button
                variant="outline"
                size="sm"
                className="bg-white/20 border-white/40 text-white hover:bg-white/30"
                onClick={() => exportProjectToPDF(project, notes, calculations, tollgateItems, sigmaEntries, controlPlanRows)}
              >
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-white/20 border-white/40 text-white hover:bg-white/30"
                onClick={() => exportA3Report(project, notes, calculations, tollgateItems, sigmaEntries, controlPlanRows, raciRows)}
              >
                <Download className="h-4 w-4 mr-2" />
                A3 Rapport
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-white/20 border-white/40 text-white hover:bg-white/30"
                onClick={() => exportProjectToPPTX(project, notes, calculations, tollgateItems, sigmaEntries)}
              >
                <Presentation className="h-4 w-4 mr-2" />
                PPTX
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-white/20 border-white/40 text-white hover:bg-white/30"
                onClick={() => exportProjectToXLSX(project, notes, calculations, tollgateItems, sigmaEntries, controlPlanRows, raciRows)}
              >
                <Table className="h-4 w-4 mr-2" />
                Excel (.xlsx)
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-white/20 border-white/40 text-white hover:bg-white/30"
                onClick={() => exportProjectToCSV(project, notes, calculations, tollgateItems, sigmaEntries, controlPlanRows, raciRows)}
                title="Semicolon-separerad CSV perfekt för svenska Excel-installationer samt begränsade IT-miljöer"
              >
                <Table className="h-4 w-4 mr-2" />
                CSV (Svensk Excel / Backup)
              </Button>
              <Badge variant="outline" className="bg-white/20 text-white border-white/40">
                {project.status === "active" ? "Aktiv" : project.status === "completed" ? "Klar" : "Arkiverad"}
              </Badge>
            </div>
          </div>

          {/* Phase Progress Timeline & Navigation */}
          <div className="mt-8 bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
            {/* Overall progress indicator with progress bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-white/10">
              <div>
                <h3 className="text-lg font-semibold text-white">DMAIC Projektlinje</h3>
                <p className="text-white/70 text-xs">Följ dina framsteg och fyll i tollgate-checklists under respektive faser</p>
              </div>
              <div className="flex items-center gap-3 bg-white/15 px-4 py-2 rounded-xl border border-white/10">
                <span className="text-sm font-medium text-white/90">Sammanlagd framdrift:</span>
                <span className="text-base font-bold text-white bg-white/20 px-2.5 py-0.5 rounded-lg">
                  {overallProgress}%
                </span>
              </div>
            </div>

            <div className="space-y-6">
              {/* Headline progress bar for overall completion */}
              <Progress value={overallProgress} className="h-2.5 bg-white/20 [&>div]:bg-white" />

              {/* Overall and Phase-by-phase Timeline connector track */}
              <div className="relative pt-2">
                {/* Desktop Connecting Line */}
                <div className="absolute top-[28px] left-[10%] right-[10%] h-[3px] bg-white/20 hidden md:block rounded-full">
                  <div 
                    className="h-full bg-white transition-all duration-300 rounded-full" 
                    style={{ width: `${Math.max(0, Math.min(100, (project.current_phase - 1) * 25))}%` }}
                  />
                </div>

                {/* Grid of Phases representing timeline checkpoints */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 md:gap-4 relative z-10">
                  {phases.map((phase) => {
                    const pct = getPhaseProgress(phase.id);
                    const isActive = phase.id === activePhase;
                    const isCurrentPhase = phase.id === project.current_phase;
                    const isPast = phase.id < project.current_phase;
                    const isUnlocked = phase.id <= project.current_phase;

                    return (
                      <div 
                        key={phase.id} 
                        className={cn(
                          "flex flex-col items-center p-3 rounded-xl transition-all duration-200 cursor-pointer relative",
                          isActive 
                            ? "bg-white/15 border border-white/25 shadow-lg" 
                            : "border border-transparent hover:bg-white/5"
                        )}
                        onClick={() => {
                          setActivePhase(phase.id);
                          if (phase.id > project.current_phase) {
                            updatePhase(phase.id);
                          }
                        }}
                      >
                        {/* Circle indicator node with icon */}
                        <div className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center transition-all border-2 relative z-20",
                          isActive
                            ? "bg-white text-slate-900 border-white scale-110 shadow-lg ring-4 ring-white/20 font-bold"
                            : isPast
                            ? "bg-emerald-500/90 text-white border-emerald-400 font-bold"
                            : isCurrentPhase
                            ? "bg-white/25 text-white border-white scale-105 animate-pulse"
                            : "bg-black/20 text-white/40 border-transparent"
                        )}>
                          {pct === 100 ? (
                            <span className="text-base font-bold">✓</span>
                          ) : (
                            <span className="text-base">{phase.icon}</span>
                          )}
                          
                          {/* Status Checkmark or Badge for completion inside or on top of node */}
                          <div className={cn(
                            "absolute -bottom-2.5 right-1/2 translate-x-1/2 text-[9px] px-1.5 py-0.2 rounded-full font-bold shadow-sm border whitespace-nowrap",
                            pct === 100
                              ? "bg-emerald-500 text-white border-emerald-400"
                              : "bg-white/95 text-slate-950 border-white/30"
                          )}>
                            {pct}%
                          </div>
                        </div>

                        {/* Phase Labels */}
                        <span className={cn(
                          "text-xs mt-4 font-bold tracking-wide",
                          isActive ? "text-white" : "text-white/80"
                        )}>
                          {phase.name}
                        </span>
                        
                        {/* Smaller visual indicator under name to show completion status */}
                        <div className="w-full max-w-[80px] mt-2">
                          <Progress 
                            value={pct} 
                            className="h-1 bg-white/20 [&>div]:bg-emerald-400" 
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Phase Content */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <span className="text-3xl">{currentPhaseData.icon}</span>
                {currentPhaseData.name}: {currentPhaseData.title}
              </h2>
              <p className="text-muted-foreground mt-1">{currentPhaseData.description}</p>
            </div>

            <Tabs defaultValue="notes" onValueChange={handleSubTabChange} className="space-y-6">
              <TabsList className="flex flex-wrap h-auto gap-1">
                <TabsTrigger value="notes" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Anteckningar ({phaseNotes.length})
                </TabsTrigger>
                <TabsTrigger value="tollgate" className="gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Tollgate
                </TabsTrigger>
                <TabsTrigger value="calculations" className="gap-2">
                  <Calculator className="h-4 w-4" />
                  Beräkningar ({phaseCalculations.length})
                </TabsTrigger>
                <TabsTrigger value="tools" className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Verktyg
                </TabsTrigger>
                {activePhase === 5 && (
                  <TabsTrigger value="control-plan" className="gap-2">
                    <Shield className="h-4 w-4" />
                    Kontrollplan
                  </TabsTrigger>
                )}
                <TabsTrigger value="raci" className="gap-2">
                  <Users className="h-4 w-4" />
                  RACI
                </TabsTrigger>
                <TabsTrigger value="sigma" className="gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Sigma
                </TabsTrigger>
                {activePhase === 3 && (
                  <TabsTrigger value="ai-analysis" className="gap-2">
                    <Brain className="h-4 w-4" />
                    AI-analys
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="notes" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">Anteckningar för {currentPhaseData.name}</h3>
                  <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-2">
                        <Plus className="h-4 w-4" />
                        Ny anteckning
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Ny anteckning - {currentPhaseData.name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                           <Label>Rubrik</Label>
                          <Input
                            placeholder="T.ex. Problemformulering"
                            value={noteTitle}
                            onChange={(e) => setNoteTitle(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Innehåll</Label>
                          <Textarea
                            placeholder="Skriv din anteckning här..."
                            rows={6}
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                          />
                        </div>
                        <Button onClick={createNote} className="w-full" disabled={isSaving}>
                          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                          Spara
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {phaseNotes.length === 0 ? (
                  <Card className="text-center py-8">
                    <CardContent>
                      <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                      <p className="text-muted-foreground">Inga anteckningar för denna fas ännu</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {phaseNotes.map((note) => (
                      <Card key={note.id}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-lg">{note.title}</CardTitle>
                              <CardDescription>
                                {new Date(note.created_at).toLocaleDateString("sv-SE")}
                              </CardDescription>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => deleteNote(note.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        {note.content && (
                          <CardContent>
                            <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                          </CardContent>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="calculations" className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold">Sparade beräkningar för {currentPhaseData.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    Visa och hantera alla matematiska och statistiska modeller som sparats under {currentPhaseData.title}.
                  </p>
                </div>

                {phaseCalculations.length === 0 ? (
                  <Card className="text-center py-8">
                    <CardContent>
                      <Calculator className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        Inga sparade beräkningar i {currentPhaseData.name} ännu
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                        Gå till fliken <strong>"Verktyg"</strong> för att köra analyser (t.ex. FMEA, Procesduglighet, Hypotesprövning) och spara dina framsteg.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {phaseCalculations.map((calc) => (
                      <Card
                        key={calc.id}
                        className="bg-white dark:bg-slate-920 border-slate-200 dark:border-slate-850 shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
                      >
                        <CardHeader className="pb-2 pt-3 px-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-xs font-bold leading-tight">{calc.tool_name}</CardTitle>
                              <CardDescription className="text-[9px] font-mono mt-0.5">
                                {new Date(calc.created_at).toLocaleDateString("sv-SE")}
                              </CardDescription>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive h-6 w-6"
                              onClick={() => deleteCalculation(calc.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-3">
                          <div className="text-xs space-y-3">
                            {/* Indata (Inputs) if there are simple/short key-values */}
                            {calc.inputs && typeof calc.inputs === "object" && Object.keys(calc.inputs).length > 0 && (
                              <div className="space-y-1">
                                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80 block">Indata</span>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 bg-slate-50/50 dark:bg-slate-900/10 p-2 rounded-md font-mono text-[9px] border border-slate-100 dark:border-slate-900/20">
                                  {Object.entries(calc.inputs as Record<string, unknown>)
                                    .filter(([key, val]) => {
                                      // Skip massive arrays or logs to keep the summary card compact
                                      if (Array.isArray(val) && val.length > 10) return false;
                                      if (typeof val === "string" && val.length > 50) return false;
                                      return true;
                                    })
                                    .map(([key, value]) => (
                                      <div key={key} className="flex justify-between border-b border-slate-100/50 dark:border-slate-900/10 py-0.5 last:border-0 truncate">
                                        <span className="text-muted-foreground truncate font-sans pr-1" title={labelFor(key)}>{labelFor(key)}:</span>
                                        <span className="font-medium text-slate-700 dark:text-slate-400 text-right truncate">
                                          {formatCalcValue(value)}
                                        </span>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* Resultat (Results) */}
                            {calc.results && typeof calc.results === "object" && Object.keys(calc.results).length > 0 && (
                              <div className="space-y-1">
                                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/85 block">Resultat</span>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 bg-slate-50 dark:bg-slate-900/40 p-2 rounded-md font-mono text-[9px] border border-slate-100 dark:border-slate-900/45">
                                  {Object.entries(calc.results as Record<string, unknown>).map(([key, value]) => (
                                    <div key={key} className="flex justify-between border-b border-slate-100/70 dark:border-slate-900/30 py-0.5 last:border-0 truncate">
                                      <span className="text-muted-foreground truncate font-sans pr-1" title={labelFor(key)}>{labelFor(key)}:</span>
                                      <span className="font-bold text-slate-800 dark:text-slate-200 text-right truncate">
                                        {formatCalcValue(value)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {calc.notes && (
                              <p className="text-muted-foreground text-[10px] leading-relaxed pt-1.5 border-t italic border-dashed border-slate-200 dark:border-slate-800">
                                Obs: {calc.notes}
                              </p>
                            )}

                            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800/60 mt-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-[10px] h-7 px-2.5 gap-1.5 font-medium hover:bg-slate-50 dark:hover:bg-slate-900"
                                onClick={() => {
                                  setExpandedToolId(calc.tool_id);
                                  // Find the "Verktyg" tab trigger and click it
                                  const trigger = document.querySelector('[role="tablist"] button[value="tools"]') as HTMLButtonElement | null;
                                  if (trigger) {
                                    trigger.click();
                                  }
                                }}
                              >
                                <Eye className="h-3 w-3 text-primary" />
                                Öppna i verktyg
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="tools" className="space-y-4">
                <h3 className="font-semibold">Verktyg för {currentPhaseData.name}</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {currentPhaseData.tools.map((tool) => (
                    <ToolCard
                      key={tool.id}
                      tool={tool}
                      phaseColor={currentPhaseData.color}
                      phaseId={activePhase}
                      initiallyExpanded={expandedToolId === tool.id}
                    />
                  ))}
                </div>
              </TabsContent>

              {/* Tollgate */}
              <TabsContent value="tollgate" className="space-y-4">
                <TollgateChecklist
                  projectId={project.id}
                  phase={activePhase}
                  isEditor={project.user_id === user?.id}
                />
              </TabsContent>

              {/* Control Plan */}
              {activePhase === 5 && (
                <TabsContent value="control-plan" className="space-y-4">
                  <ControlPlanEditor projectId={project.id} />
                </TabsContent>
              )}

              {/* RACI */}
              <TabsContent value="raci" className="space-y-4">
                <RACIMatrix projectId={project.id} />
              </TabsContent>

              {/* Sigma Tracker */}
              <TabsContent value="sigma" className="space-y-4">
                <SigmaTracker projectId={project.id} />
              </TabsContent>

              {/* AI Analysis */}
              {activePhase === 3 && (
                <TabsContent value="ai-analysis" className="space-y-4">
                  <AIRootCauseAnalysis />
                </TabsContent>
              )}
            </Tabs>
          </div>
        </div>
      </section>

      <AIDMAICCoach projectId={project.id} projectName={project.name} />
    </Layout>
  );
}

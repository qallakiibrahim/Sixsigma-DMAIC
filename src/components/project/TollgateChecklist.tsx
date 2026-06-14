import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  Loader2, 
  Sparkles, 
  AlertTriangle, 
  XCircle, 
  History,
  Calendar,
  Lock
} from "lucide-react";
import { toast } from "sonner";
import { phases } from "@/data/dmaic-tools";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ReactMarkdown from "react-markdown";

interface TollgateItem {
  id: string;
  phase: number;
  title: string;
  description: string | null;
  is_completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  sort_order: number;
}

const DEFAULT_CHECKLIST: Record<number, string[]> = {
  1: [
    "Project Charter godkänd",
    "Problem- och målformulering definierad",
    "SIPOC-diagram komplett",
    "VOC/CTQ identifierade",
    "Projektomfattning avgränsad",
    "Intressentanalys genomförd",
    "Teammedlemmar tilldelade",
  ],
  2: [
    "Datainsamlingsplan upprättad",
    "MSA/Gage R&R godkänd (<10% R&R)",
    "Baseline-data insamlad",
    "Processkapabilitet (Cp/Cpk) beräknad",
    "Sigma-nivå fastställd",
    "Processkarta detaljerad",
    "Mätetal validerade",
  ],
  3: [
    "Rotorsaker identifierade (Fiskben/5 Varför)",
    "Statistiska tester genomförda",
    "Kritiska X-faktorer verifierade",
    "Paretoanalys av defekttyper",
    "Korrelation/regression analyserad",
    "FMEA uppdaterad",
    "Datadrivna slutsatser dokumenterade",
  ],
  4: [
    "Lösningar genererade och utvärderade",
    "DOE genomförd och analyserad",
    "Pilottest genomfört",
    "Förbättring verifierad med data",
    "Implementeringsplan klar",
    "Riskanalys för implementation",
    "Intressenter informerade",
  ],
  5: [
    "Kontrollplan upprättad",
    "Styrdiagram implementerade",
    "SOP:ar uppdaterade",
    "Utbildning genomförd",
    "Reaktionsplan dokumenterad",
    "Processägare utsedd",
    "Projektrapport/A3 färdigställd",
  ],
};

interface TollgateChecklistProps {
  projectId: string;
  phase: number;
  isEditor?: boolean;
}

interface CriterionReview {
  title: string;
  status: "pass" | "warning" | "fail";
  comment: string;
}

interface AISolutionReview {
  status: string;
  score: number;
  missingArtifacts: string[];
  recommendations: string;
  criterionAssessments: CriterionReview[];
}

export function TollgateChecklist({ projectId, phase, isEditor = true }: TollgateChecklistProps) {
  const [items, setItems] = useState<TollgateItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const { user } = useAuth();

  // AI Tollgate Review States
  const [isReviewing, setIsReviewing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [reviewResult, setReviewResult] = useState<AISolutionReview | null>(null);
  const [historyReviews, setHistoryReviews] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetchItems();
    fetchHistoryReviews();
  }, [projectId, phase]);

  const fetchItems = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("tollgate_items")
      .select("*")
      .eq("project_id", projectId)
      .eq("phase", phase);

    if (error) {
      console.error("Error fetching tollgate items:", error);
    } else if (data && data.length === 0) {
      // Initialize with defaults
      await initializeDefaults();
    } else if (data) {
      const sorted = [...data].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      setItems(sorted);
    }
    setIsLoading(false);
  };

  const fetchHistoryReviews = async () => {
    const { data, error } = await supabase
      .from("tollgate_reviews")
      .select("*")
      .eq("project_id", projectId)
      .eq("phase", phase);

    if (!error && data) {
      const sorted = [...data].sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA; // Descending
      });
      setHistoryReviews(sorted);
    }
  };

  const initializeDefaults = async () => {
    const defaults = DEFAULT_CHECKLIST[phase] || [];
    const inserts = defaults.map((title, i) => ({
      project_id: projectId,
      phase,
      title,
      sort_order: i,
    }));

    if (inserts.length === 0) return;

    const { data, error } = await supabase
      .from("tollgate_items")
      .insert(inserts)
      .select();

    if (!error && data) {
      setItems(data);
      window.dispatchEvent(new CustomEvent("tollgate-items-updated"));
    }
  };

  const toggleItem = async (item: TollgateItem) => {
    if (!isEditor) return;
    const newCompleted = !item.is_completed;
    const { error } = await supabase
      .from("tollgate_items")
      .update({
        is_completed: newCompleted,
        completed_by: newCompleted ? user?.id : null,
        completed_at: newCompleted ? new Date().toISOString() : null,
      })
      .eq("id", item.id);

    if (!error) {
      setItems(items.map(i => i.id === item.id ? {
        ...i,
        is_completed: newCompleted,
        completed_by: newCompleted ? user?.id || null : null,
        completed_at: newCompleted ? new Date().toISOString() : null,
      } : i));
      window.dispatchEvent(new CustomEvent("tollgate-items-updated"));
    }
  };

  const addItem = async () => {
    if (!newTitle.trim()) return;
    const { data, error } = await supabase
      .from("tollgate_items")
      .insert({
        project_id: projectId,
        phase,
        title: newTitle.trim(),
        sort_order: items.length,
      })
      .select()
      .single();

    if (!error && data) {
      setItems([...items, data]);
      setNewTitle("");
      window.dispatchEvent(new CustomEvent("tollgate-items-updated"));
    } else {
      toast.error("Kunde inte lägga till punkt");
    }
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from("tollgate_items").delete().eq("id", id);
    if (!error) {
      setItems(items.filter(i => i.id !== id));
      window.dispatchEvent(new CustomEvent("tollgate-items-updated"));
    }
  };

  // AI Review Service Handler
  const handleRunReview = async () => {
    setIsReviewing(true);
    try {
      // 1. Gather all local calculations, notes, and sigma metrics for current phase
      const { data: calcs } = await supabase
        .from("project_calculations")
        .select("*")
        .eq("project_id", projectId)
        .eq("phase", phase);

      const { data: notes } = await supabase
        .from("project_notes")
        .select("*")
        .eq("project_id", projectId)
        .eq("phase", phase);

      const { data: sigmas } = await supabase
        .from("sigma_tracking")
        .select("*")
        .eq("project_id", projectId)
        .eq("phase", phase);

      const { data: proj } = await supabase
        .from("projects")
        .select("name, description")
        .eq("id", projectId)
        .maybeSingle();

      // 2. Call our auto-tollgate-review endpoint
      const response = await fetch("/api/ai-tollgate-review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          projectName: proj?.name || "Namnlöst",
          projectDescription: proj?.description || "",
          phase,
          phaseName: phaseData?.name || `Fas ${phase}`,
          tollgateItems: items,
          calculations: calcs || [],
          sigmaEntries: sigmas || [],
          notes: notes || []
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Serverfel vid hämtning av ai-review.");
      }

      const reviewData: AISolutionReview = await response.json();
      setReviewResult(reviewData);

      // 3. Save review record to tollgate_reviews table
      const newReview = {
        project_id: projectId,
        phase,
        reviewer_id: user?.id || "anonymous-reviewer",
        score: reviewData.score,
        status: reviewData.status,
        missing_artifacts: reviewData.missingArtifacts || [],
        recommendations: reviewData.recommendations || "",
        criterion_assessments: reviewData.criterionAssessments || [],
        created_at: new Date().toISOString()
      };

      await supabase.from("tollgate_reviews").insert(newReview);

      // 4. Handle auto-checking of pass items ("auto-bocka av godkända")
      if (reviewData.criterionAssessments && reviewData.criterionAssessments.length > 0) {
        const passTitlesSet = new Set(
          reviewData.criterionAssessments
            .filter(c => c.status === "pass")
            .map(c => c.title.toLowerCase().trim())
        );

        const itemsToUpdate = items.filter(
          item => !item.is_completed && passTitlesSet.has(item.title.toLowerCase().trim())
        );

        if (itemsToUpdate.length > 0) {
          toast.success(`${itemsToUpdate.length} punkter bockades av automatiskt eftersom AI:n godkände dem!`);
          
          await Promise.all(
            itemsToUpdate.map(async (item) => {
              await supabase
                .from("tollgate_items")
                .update({
                  is_completed: true,
                  completed_by: user?.id,
                  completed_at: new Date().toISOString()
                })
                .eq("id", item.id);
            })
          );
          // Reload checklists
          await fetchItems();
        } else {
          toast.success("AI Tollgate Review är klar!");
        }
      }

      // Reload histories
      fetchHistoryReviews();
      setIsDialogOpen(true);
    } catch (err: any) {
      console.error("Failed to run Tollgate review:", err);
      toast.error(err.message || "Ett fel uppstod under AI-granskningen.");
    } finally {
      setIsReviewing(false);
    }
  };

  // Phase Advancement Handler
  const handleApprovePhase = async () => {
    if (!isEditor) return;
    const nextPhase = phase + 1;
    const isFinalPhase = nextPhase > 5;

    const updatePayload: any = {
      current_phase: isFinalPhase ? 5 : nextPhase
    };
    if (isFinalPhase) {
      updatePayload.status = "completed";
    }

    const { error } = await supabase
      .from("projects")
      .update(updatePayload)
      .eq("id", projectId);

    if (!error) {
      toast.success(
        isFinalPhase
          ? "Grattis! Du har officiellt godkänt och avslutat sista fasen (Control). Hela projektet är nu framgångsrikt slutfört!"
          : `Fasen har godkänts officiellt! Projektet flyttades till fas ${nextPhase} (${phases.find(p => p.id === nextPhase)?.name || ""})`
      );
      setIsDialogOpen(false);
      // Reload page context to update calculations
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      toast.error("Kunde inte uppdatera projektets fas.");
    }
  };

  const completed = items.filter(i => i.is_completed).length;
  const total = items.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const phaseData = phases.find(p => p.id === phase);

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const getStatusIcon = (status: "pass" | "warning" | "fail") => {
    if (status === "pass") return <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />;
    if (status === "warning") return <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />;
    return <XCircle className="h-5 w-5 text-red-500 shrink-0" />;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              {progress === 100 ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
              Tollgate: {phaseData?.name}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={progress === 100 ? "default" : "secondary"}>
                {completed}/{total} ({progress}%)
              </Badge>

              {/* Run Review Trigger */}
              <Button
                size="sm"
                variant="outline"
                className="flex items-center gap-1 border-primary/20 hover:bg-primary/5 hover:text-primary"
                onClick={handleRunReview}
                disabled={isReviewing}
              >
                {isReviewing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Granskar...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Kör Tollgate-review
                  </>
                )}
              </Button>

              {/* Toggle History Trigger */}
              {historyReviews.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowHistory(!showHistory)}
                  title="Granskningshistorik"
                  className="font-normal"
                >
                  <History className="h-4 w-4 mr-1 text-muted-foreground" />
                  Historik ({historyReviews.length})
                </Button>
              )}
            </div>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-2 mt-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 group"
            >
              <Checkbox
                checked={item.is_completed}
                onCheckedChange={() => toggleItem(item)}
                disabled={!isEditor}
              />
              <span className={`flex-1 text-sm ${item.is_completed ? "line-through text-muted-foreground" : ""}`}>
                {item.title}
              </span>
              {item.completed_at && (
                <span className="text-xs text-muted-foreground">
                  {new Date(item.completed_at).toLocaleDateString("sv-SE")}
                </span>
              )}
              {isEditor && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100"
                  onClick={() => deleteItem(item.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}

          {isEditor && (
            <div className="flex gap-2 pt-2">
              <Input
                placeholder="Lägg till egen punkt..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addItem()}
                className="h-8 text-sm"
              />
              <Button size="sm" variant="outline" onClick={addItem} className="h-8">
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expandable History Logs */}
      {showHistory && historyReviews.length > 0 && (
        <Card className="border-dashed">
          <CardHeader className="py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
              <History className="h-4 w-4" />
              Tidigare granskningar för {phaseData?.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {historyReviews.map((rev) => (
              <div key={rev.id} className="p-3 border rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors text-sm">
                <div className="flex justify-between items-start gap-4 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      Betyg: {rev.score}/100
                    </span>
                    <Badge variant={rev.status.includes("✅") ? "default" : rev.status.includes("⚠️") ? "secondary" : "destructive"}>
                      {rev.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {new Date(rev.created_at).toLocaleString("sv-SE")}
                  </div>
                </div>
                {rev.missing_artifacts && rev.missing_artifacts.length > 0 && (
                  <div className="mb-2 text-xs text-amber-700 dark:text-amber-400">
                    <span className="font-semibold">Saknade delar:</span> {rev.missing_artifacts.join(", ")}
                  </div>
                )}
                {rev.recommendations && (
                  <div className="text-xs text-muted-foreground line-clamp-2 max-w-none prose dark:prose-invert">
                    <ReactMarkdown>{rev.recommendations}</ReactMarkdown>
                  </div>
                )}
                <Button 
                  size="sm" 
                  variant="link" 
                  className="h-5 p-0 text-xs mt-1" 
                  onClick={() => {
                    setReviewResult({
                      status: rev.status,
                      score: rev.score,
                      missingArtifacts: rev.missing_artifacts || [],
                      recommendations: rev.recommendations || "",
                      criterionAssessments: rev.criterion_assessments ? (
                        Array.isArray(rev.criterion_assessments)
                          ? rev.criterion_assessments
                          : Object.entries(rev.criterion_assessments).map(([title, detail]: [string, any]) => ({
                              title,
                              status: detail.status || "warning",
                              comment: detail.comment || ""
                            }))
                      ) : []
                    });
                    setIsDialogOpen(true);
                  }}
                >
                  Visa fullständig historisk rapport
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Interactive AI Review Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Tollgate-review: {phaseData?.name}
            </DialogTitle>
            <DialogDescription>
              Extern Six Sigma-analys och revision av dina inlämnade DMAIC-mätetal och artefakter.
            </DialogDescription>
          </DialogHeader>

          {reviewResult && (
            <div className="space-y-6 pt-4">
              {/* Overall Banner Status */}
              <div className="p-4 rounded-xl border flex flex-col md:flex-row items-center gap-4 justify-between bg-card">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">Fasens status</div>
                  <div className="text-2xl font-bold flex items-center gap-2 mt-1">
                    {reviewResult.status}
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-1">Slutförandegrad</div>
                  <div className="relative flex items-center justify-center">
                    {/* Ring gauge SVG */}
                    <svg className="w-16 h-16 transform -rotate-90">
                      <circle cx="32" cy="32" r="28" className="stroke-muted fill-transparent" strokeWidth="6" />
                      <circle 
                        cx="32" 
                        cy="32" 
                        r="28" 
                        className="stroke-primary fill-transparent transition-all duration-1000 ease-out" 
                        strokeWidth="6" 
                        strokeDasharray={2 * Math.PI * 28}
                        strokeDashoffset={2 * Math.PI * 28 * (1 - reviewResult.score / 100)}
                      />
                    </svg>
                    <span className="absolute font-bold text-base">{reviewResult.score}</span>
                  </div>
                </div>
              </div>

              {/* Missing Artifacts Section */}
              {reviewResult.missingArtifacts && reviewResult.missingArtifacts.length > 0 && (
                <div className="p-4 rounded-xl border border-rose-100 dark:border-rose-950/20 bg-rose-50/20 dark:bg-rose-950/5 text-sm space-y-2">
                  <div className="font-semibold text-rose-800 dark:text-rose-400 flex items-center gap-1.5">
                    <XCircle className="h-4 w-4 shrink-0" />
                    Kompletteringar som krävs:
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-rose-700/90 dark:text-rose-300">
                    {reviewResult.missingArtifacts.map((art, idx) => (
                      <li key={idx}>{art}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-foreground uppercase tracking-widest text-muted-foreground">Analys & Rekommendationer</h4>
                <div className="p-4 rounded-xl bg-muted/30 border text-sm leading-relaxed max-w-none prose prose-slate dark:prose-invert prose-headings:mt-3 prose-headings:mb-1 prose-p:my-1.5 prose-ul:my-1.5 font-sans">
                  <ReactMarkdown>{reviewResult.recommendations}</ReactMarkdown>
                </div>
              </div>

              {/* Per-item audit checklist */}
              {reviewResult.criterionAssessments && reviewResult.criterionAssessments.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-foreground uppercase tracking-widest text-muted-foreground">Detaljerad punktbedömning (auto-kontroll)</h4>
                  <div className="space-y-2 max-h-[220px] overflow-y-auto border rounded-xl divide-y p-1">
                    {reviewResult.criterionAssessments.map((crit, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-2.5 bg-card/60">
                        {getStatusIcon(crit.status)}
                        <div>
                          <div className="font-semibold text-sm">{crit.title}</div>
                          <div className="text-xs text-muted-foreground font-light mt-0.5">{crit.comment}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Approve & lock phase button */}
              {isEditor && (
                <div className="pt-4 border-t flex gap-3 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(false)}>
                    Stäng rapport
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleApprovePhase}
                    className="gap-1.5 bg-green-600 hover:bg-green-700 text-white font-medium"
                    disabled={reviewResult.score < 50}
                  >
                    <Lock className="h-3.5 w-3.5" />
                    Officiellt godkänn och lås fasen
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

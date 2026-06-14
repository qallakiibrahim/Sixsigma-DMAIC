import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, BarChart3, CheckCircle2, Clock, ArrowRight, FolderOpen,
  TrendingUp, Target, AlertTriangle, DollarSign, Activity, CalendarDays,
  Search, Filter, ArrowUpRight, Coins, List, Calendar
} from "lucide-react";
import { phases } from "@/data/dmaic-tools";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell, AreaChart, Area
} from "recharts";

interface Project {
  id: string;
  name: string;
  description: string | null;
  current_phase: number;
  status: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  estimated_savings: number | null;
  actual_savings: number | null;
}

interface SigmaEntry {
  project_id: string;
  sigma_level: number;
  measurement_date: string;
  phase: number;
}

interface TollgateProgress {
  completed: number;
  total: number;
}

interface FMEARisk {
  project_id: string;
  rpn: number;
  failureMode: string;
  risk: string;
}

const PHASE_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ef4444"];

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function formatCurrency(val: number | null): string {
  if (val == null) return "–";
  return new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(val);
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tollgateProgress, setTollgateProgress] = useState<Record<string, TollgateProgress>>({});
  const [sigmaData, setSigmaData] = useState<SigmaEntry[]>([]);
  const [toolsUsed, setToolsUsed] = useState<Record<string, string[]>>({});
  const [fmeaRisks, setFmeaRisks] = useState<FMEARisk[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Search and Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed">("all");
  const [phaseFilter, setPhaseFilter] = useState<number | "all">("all");
  const [viewMode, setViewMode] = useState<"card" | "gantt">("card");

  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    setIsLoading(true);

    const { data: projectsData } = await supabase
      .from("projects")
      .select("*")
      .order("updated_at", { ascending: false });

    const projs = (projectsData || []) as Project[];
    setProjects(projs);

    if (projs.length > 0) {
      const ids = projs.map(p => p.id);

      // Tollgate progress
      const { data: tollgateData } = await supabase
        .from("tollgate_items")
        .select("project_id, is_completed")
        .in("project_id", ids);

      if (tollgateData) {
        const progress: Record<string, TollgateProgress> = {};
        tollgateData.forEach(item => {
          if (!progress[item.project_id]) progress[item.project_id] = { completed: 0, total: 0 };
          progress[item.project_id].total++;
          if (item.is_completed) progress[item.project_id].completed++;
        });
        setTollgateProgress(progress);
      }

      // Sigma data
      const { data: sigmaEntries } = await supabase
        .from("sigma_tracking")
        .select("project_id, sigma_level, measurement_date, phase")
        .in("project_id", ids)
        .order("measurement_date");

      setSigmaData(sigmaEntries || []);

      // Tools used per project + FMEA risks
      const { data: calcData } = await supabase
        .from("project_calculations")
        .select("project_id, tool_id, results, inputs")
        .in("project_id", ids);

      if (calcData) {
        const tools: Record<string, string[]> = {};
        const risks: FMEARisk[] = [];
        calcData.forEach((c: any) => {
          if (!tools[c.project_id]) tools[c.project_id] = [];
          if (!tools[c.project_id].includes(c.tool_id)) tools[c.project_id].push(c.tool_id);
          
          if (c.tool_id === 'fmea' && c.results?.rpn) {
            risks.push({
              project_id: c.project_id,
              rpn: Number(c.results.rpn),
              failureMode: c.inputs?.failureMode || 'Okänt',
              risk: c.results.risk || 'Okänd',
            });
          }
        });
        setToolsUsed(tools);
        setFmeaRisks(risks);
      }
    }

    setIsLoading(false);
  };

  // Derived stats
  const activeProjects = projects.filter(p => p.status === "active");
  const completedProjects = projects.filter(p => p.status === "completed");
  const stagnantProjects = activeProjects.filter(p => daysSince(p.updated_at) > 14);
  const totalEstimatedSavings = projects.reduce((sum, p) => sum + (p.estimated_savings || 0), 0);
  const totalActualSavings = projects.reduce((sum, p) => sum + (p.actual_savings || 0), 0);
  const highRiskFmea = fmeaRisks.filter(r => r.rpn >= 200);
  const fmeaByProject = fmeaRisks.reduce<Record<string, FMEARisk[]>>((acc, r) => {
    if (!acc[r.project_id]) acc[r.project_id] = [];
    acc[r.project_id].push(r);
    return acc;
  }, {});

  // Compute filtered projects list for status card grid
  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    const matchesPhase = phaseFilter === "all" || p.current_phase === phaseFilter;
    return matchesSearch && matchesStatus && matchesPhase;
  });

  // Phase distribution for bar chart
  const phaseDistData = phases.map(phase => ({
    name: phase.name,
    icon: phase.icon,
    count: activeProjects.filter(p => p.current_phase === phase.id).length,
  }));

  // Sigma trend (all projects combined, chronological)
  const sigmaTrendData = sigmaData.map(s => ({
    date: new Date(s.measurement_date).toLocaleDateString("sv-SE"),
    sigma: Number(s.sigma_level),
  }));

  // Expected tools per phase
  const expectedToolsPerPhase: Record<number, number> = { 1: 7, 2: 10, 3: 12, 4: 11, 5: 13 };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 dark:bg-slate-950/95 border border-slate-200 dark:border-slate-800/80 p-3 rounded-xl shadow-lg backdrop-blur-md text-xs">
          <p className="font-semibold text-slate-500 dark:text-slate-400 mb-1">{label}</p>
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-500"></span>
            σ-nivå: <span className="text-blue-500">{Number(payload[0].value).toFixed(2)}σ</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 dark:bg-slate-950/95 border border-slate-200 dark:border-slate-800/80 p-3 rounded-xl shadow-lg backdrop-blur-md text-xs">
          <p className="font-semibold text-slate-950 dark:text-slate-100 mb-1">{label}</p>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Antal aktiva: <span className="text-blue-600 dark:text-blue-400 font-mono text-sm">{payload[0].value} par</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const getGanttMonths = () => {
    if (filteredProjects.length === 0) {
      const months = [];
      const current = new Date();
      for (let i = 0; i < 6; i++) {
        months.push(new Date(current.getFullYear(), current.getMonth() + i, 1));
      }
      return months;
    }

    const startDates = filteredProjects.map(p => new Date(p.created_at).getTime());
    const minTime = Math.min(...startDates);
    const earliestDate = new Date(minTime);

    const timelineStartMon = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);

    const months = [];
    for (let i = 0; i < 6; i++) {
      months.push(new Date(timelineStartMon.getFullYear(), timelineStartMon.getMonth() + i, 1));
    }
    return months;
  };

  const ganttMonths = getGanttMonths();
  const timelineStartMs = new Date(ganttMonths[0].getFullYear(), ganttMonths[0].getMonth(), 1).getTime();
  const lastMonth = ganttMonths[ganttMonths.length - 1];
  const timelineEndMs = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).getTime();
  const totalTimelineRangeMs = Math.max(1, timelineEndMs - timelineStartMs);

  const getGanttBarPosition = (proj: Project) => {
    const startMs = new Date(proj.created_at).getTime();
    // Assuming a progressive default standard duration of 16 weeks (112 days)
    const durationMs = 112 * 24 * 60 * 60 * 1000;
    let endMs = startMs + durationMs;

    if (proj.status === "completed" && new Date(proj.updated_at).getTime() > startMs) {
      endMs = new Date(proj.updated_at).getTime();
    }

    const leftPercent = ((startMs - timelineStartMs) / totalTimelineRangeMs) * 100;
    const widthPercent = ((endMs - startMs) / totalTimelineRangeMs) * 100;

    const clampedLeft = Math.max(0.5, Math.min(92, leftPercent));
    const clampedWidth = Math.max(8, Math.min(100 - clampedLeft, widthPercent));

    return {
      left: `${clampedLeft}%`,
      width: `${clampedWidth}%`,
      startDate: new Date(startMs).toLocaleDateString("sv-SE", { month: "short", day: "numeric" }),
      endDate: new Date(endMs).toLocaleDateString("sv-SE", { month: "short", day: "numeric" }),
    };
  };

  if (loading || isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="py-8 bg-slate-50/50 dark:bg-slate-950/20 min-h-screen">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto space-y-8">

            {/* Premium Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/40 shadow-sm">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40">
                    Portfolio
                  </span>
                  <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">Uppdaterad idag</p>
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-1">Projektportfölj</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Din realtidsöversikt över DMAIC-metodik, KPI:er och riskhantering.</p>
              </div>
              <Button asChild className="shrink-0 font-medium">
                <Link to="/projects">
                  Hantera projekt <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>

            {/* Top Premium KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              
              {/* Card 1: Totalt */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:border-blue-200 dark:hover:border-blue-900/40 transition-all group">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl group-hover:scale-110 transition-transform">
                    <FolderOpen className="h-5 w-5" />
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-mono font-medium">Totalt</Badge>
                </div>
                <div className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{projects.length}</div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium">Registrerade projekt</p>
              </div>

              {/* Card 2: Aktiva */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:border-emerald-200 dark:hover:border-emerald-900/40 transition-all group">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl group-hover:scale-110 transition-transform">
                    <Activity className="h-5 w-5" />
                  </div>
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                </div>
                <div className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{activeProjects.length}</div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium">Under genomförande</p>
              </div>

              {/* Card 3: Avslutade */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:border-slate-300 dark:hover:border-slate-700 transition-all group">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-300 rounded-xl group-hover:scale-110 transition-transform">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono text-emerald-600 border-emerald-100 dark:text-emerald-400 dark:border-emerald-950">
                    {projects.length > 0 ? Math.round((completedProjects.length / projects.length) * 100) : 0}% klar
                  </Badge>
                </div>
                <div className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{completedProjects.length}</div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium">Säkrade & avslutade</p>
              </div>

              {/* Card 4: Besparingar */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:border-indigo-200 dark:hover:border-indigo-900/40 transition-all group col-span-1 md:col-span-1">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl group-hover:scale-110 transition-transform">
                    <Coins className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-[9px] text-indigo-600 border-indigo-100 dark:text-indigo-300 dark:border-indigo-950/60">SEK</Badge>
                </div>
                <div className="text-xl font-extrabold tracking-tight text-indigo-600 dark:text-indigo-400 truncate" title={formatCurrency(totalActualSavings || totalEstimatedSavings)}>
                  {formatCurrency(totalActualSavings || totalEstimatedSavings)}
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 font-medium">Ackumulerad besparing</p>
              </div>

              {/* Card 5: RPN Risk */}
              <div className={`p-5 rounded-2xl border shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all group ${
                highRiskFmea.length > 0 
                  ? "bg-red-50/40 dark:bg-red-950/10 border-red-100 dark:border-red-950/40 hover:border-red-200" 
                  : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700"
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-xl group-hover:scale-110 transition-transform ${
                    highRiskFmea.length > 0 ? "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400" : "bg-slate-50 dark:bg-slate-850 text-slate-500"
                  }`}>
                    <Target className="h-5 w-5" />
                  </div>
                  {highRiskFmea.length > 0 && (
                    <span className="flex h-2 w-2 rounded-full bg-red-500 animate-ping"></span>
                  )}
                </div>
                <div className={`text-3xl font-extrabold tracking-tight ${highRiskFmea.length > 0 ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-slate-100"}`}>
                  {highRiskFmea.length}
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium">FMEA risker (RPN ≥ 200)</p>
              </div>

              {/* Card 6: Stagnerade */}
              <div className={`p-5 rounded-2xl border shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all group ${
                stagnantProjects.length > 0
                  ? "bg-amber-50/40 dark:bg-amber-950/10 border-amber-100 dark:border-amber-950/40 hover:border-amber-200"
                  : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700"
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-xl group-hover:scale-110 transition-transform ${
                    stagnantProjects.length > 0 ? "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400" : "bg-slate-50 dark:bg-slate-850 text-slate-500"
                  }`}>
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                </div>
                <div className={`text-3xl font-extrabold tracking-tight ${stagnantProjects.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-slate-100"}`}>
                  {stagnantProjects.length}
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium font-sans">Inaktivitet &gt;14d</p>
              </div>

            </div>

            {/* Graphs Row with Premium Background & Gradients */}
            <div className="grid lg:grid-cols-2 gap-6">
              
              {/* Graph 1: Phase distribution */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-blue-600 dark:text-blue-400">
                      <BarChart3 className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Fasfördelning</h3>
                      <p className="text-[11px] text-slate-400">Antal aktiva projekt per DMAIC-fas</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    {activeProjects.length} aktiva
                  </Badge>
                </div>
                
                <div className="h-52 pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={phaseDistData} margin={{ top: 10, right: 10, bottom: 0, left: -25 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-10 dark:opacity-5" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} />
                      <Bar dataKey="count" radius={[5, 5, 0, 0]} barSize={34}>
                        {phaseDistData.map((_, i) => (
                          <Cell key={i} fill={PHASE_COLORS[i]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Graph 2: Sigma Level Trend (Area Gradient) */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-violet-50 dark:bg-violet-950/40 rounded-lg text-violet-600 dark:text-violet-400">
                      <TrendingUp className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Sigma-nivå Trend</h3>
                      <p className="text-[11px] text-slate-400">Kvalitetshöjning över tid (alla projekt)</p>
                    </div>
                  </div>
                  {sigmaTrendData.length > 0 && (
                    <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 font-mono border-emerald-100 dark:border-emerald-950/50">
                      Live data
                    </Badge>
                  )}
                </div>

                {sigmaTrendData.length === 0 ? (
                  <div className="h-52 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-950/10 rounded-xl space-y-1">
                    <TrendingUp className="h-8 w-8 opacity-40 text-slate-400" />
                    <p className="text-xs font-semibold">Ingen sigma-spårning registrerad</p>
                    <p className="text-[10px] max-w-[200px] text-center opacity-85">Fyll i mätdata på projektsidan för att rita trenden.</p>
                  </div>
                ) : (
                  <div className="h-52 pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sigmaTrendData} margin={{ top: 10, right: 10, bottom: 0, left: -25 }}>
                        <defs>
                          <linearGradient id="sigmaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-10 dark:opacity-5" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 6]} tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area 
                          type="monotone" 
                          dataKey="sigma" 
                          stroke="#3b82f6" 
                          strokeWidth={2.5} 
                          fillOpacity={1} 
                          fill="url(#sigmaGradient)" 
                          dot={{ r: 3, fill: '#3b82f6', strokeWidth: 1.5, stroke: '#fff' }} 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

            </div>

            {/* Intelligent Priority Alerts Column */}
            {(stagnantProjects.length > 0 || highRiskFmea.length > 0) && (
              <div className="grid md:grid-cols-2 gap-4">
                
                {/* Active Stagnant Alerts */}
                {stagnantProjects.length > 0 && (
                  <div className="bg-amber-50/35 dark:bg-amber-950/5 border border-amber-100/80 dark:border-amber-950/30 p-5 rounded-2xl relative overflow-hidden space-y-3">
                    <div className="absolute right-0 top-0 translate-x-[15%] -translate-y-[15%] w-24 h-24 bg-amber-500/5 dark:bg-amber-500/2 rounded-full pointer-events-none"></div>
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <h4 className="font-bold text-sm">Stagnerade projekt (åtgärd krävs)</h4>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Följande pågående projekt har legat orörda i mer än 14 dagar.</p>
                    <div className="space-y-2">
                      {stagnantProjects.map(p => {
                        const days = daysSince(p.updated_at);
                        const phaseData = phases.find(ph => ph.id === p.current_phase) || phases[0];
                        return (
                          <Link 
                            to={`/project/${p.id}`} 
                            key={p.id} 
                            className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-100/50 dark:border-amber-900/10 hover:shadow-sm transition-all"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-base">{phaseData.icon}</span>
                              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">{p.name}</span>
                            </div>
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3" />
                              {days} dagar sedan
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* FMEA RPN Warnings */}
                {highRiskFmea.length > 0 && (
                  <div className="bg-red-50/35 dark:bg-red-950/5 border border-red-100/80 dark:border-red-950/30 p-5 rounded-2xl relative overflow-hidden space-y-3">
                    <div className="absolute right-0 top-0 translate-x-[15%] -translate-y-[15%] w-24 h-24 bg-red-500/5 dark:bg-red-500/2 rounded-full pointer-events-none"></div>
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                      <Target className="h-4 w-4 shrink-0" />
                      <h4 className="font-bold text-sm">FMEA Kritiska processrisker</h4>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Dessa riskfaktorer har ett kritiskt Risk Priority Number (RPN) ≥ 200.</p>
                    <div className="space-y-2">
                      {highRiskFmea.slice(0, 3).map((risk, i) => {
                        const proj = projects.find(p => p.id === risk.project_id);
                        return (
                          <Link 
                            to={`/project/${risk.project_id}`} 
                            key={i} 
                            className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-red-100/50 dark:border-red-900/10 hover:shadow-sm transition-all"
                          >
                            <div className="min-w-0 pr-2">
                              <p className="text-[10px] text-slate-400 truncate">{proj?.name}</p>
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate pr-0.5">Felläge: {risk.failureMode}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[9px] font-bold uppercase tracking-tight text-white bg-red-600 px-2 py-0.5 rounded-full shadow-[0_1px_3px_rgba(239,68,68,0.2)] font-mono">
                                RPN {risk.rpn}
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* Search & Interface Controller Segment */}
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Projektstatus & Spårbarhet</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Använd filtren för att isolera och granska specifika projekt eller faskategorier.</p>
                </div>
                
                {/* Search Inputs and Controls */}
                <div className="flex items-center gap-3 flex-wrap">
                  {/* View Mode Switcher Toggle */}
                  <div className="flex border border-slate-200/85 dark:border-slate-800 rounded-xl p-0.5 bg-slate-50 dark:bg-slate-950/40 h-9 items-center shadow-inner">
                    <button
                      type="button"
                      onClick={() => setViewMode("card")}
                      className={`flex items-center gap-1 px-3 h-full rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                        viewMode === "card"
                          ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200/40 dark:border-slate-800/80"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                      }`}
                    >
                      <List className="h-3.5 w-3.5" />
                      <span>Kortvy</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("gantt")}
                      className={`flex items-center gap-1 px-3 h-full rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                        viewMode === "gantt"
                          ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200/40 dark:border-slate-800/80"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                      }`}
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Gantt-tidslinje</span>
                    </button>
                  </div>

                  <div className="relative max-w-xs w-full">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Sök projekt..."
                      className="w-full text-xs h-9 pl-9 pr-4 rounded-xl border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-400"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e: any) => setStatusFilter(e.target.value)}
                    className="text-xs h-9 rounded-xl border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="all">Alla statusar</option>
                    <option value="active">Aktiva</option>
                    <option value="completed">Avslutade</option>
                  </select>

                  <select
                    value={phaseFilter === "all" ? "all" : phaseFilter}
                    onChange={(e: any) => setPhaseFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
                    className="text-xs h-9 rounded-xl border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="all">Alla faser</option>
                    {phases.map(p => (
                      <option key={p.id} value={p.id}>{p.id}. {p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Grid matching dynamic list */}
              {filteredProjects.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-12 text-center text-slate-400 dark:text-slate-500">
                  <FolderOpen className="h-10 w-10 mx-auto text-slate-400 opacity-60 mb-3" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Inga matchande projekt hittades</p>
                  <p className="text-xs opacity-80 mt-1">Ändra dina sökord eller nollställ filterkriterierna.</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-4"
                    onClick={() => {
                      setSearchTerm("");
                      setStatusFilter("all");
                      setPhaseFilter("all");
                    }}
                  >
                    Återställ filter
                  </Button>
                </div>
              ) : viewMode === "card" ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredProjects.map(project => {
                    const phaseData = phases.find(p => p.id === project.current_phase) || phases[0];
                    const tp = tollgateProgress[project.id];
                    const tollgatePercent = tp ? Math.round((tp.completed / tp.total) * 100) : 0;
                    const projectSigma = sigmaData.filter(s => s.project_id === project.id);
                    const latestSigma = projectSigma.length > 0 ? Number(projectSigma[projectSigma.length - 1].sigma_level) : null;
                    const firstSigma = projectSigma.length > 0 ? Number(projectSigma[0].sigma_level) : null;
                    const tools = toolsUsed[project.id] || [];
                    const expectedCount = expectedToolsPerPhase[project.current_phase] || 10;
                    const toolMaturityPercent = Math.min(100, Math.round((tools.length / expectedCount) * 100));
                    const days = daysSince(project.updated_at);
                    const isStagnant = project.status === "active" && days > 14;

                    // Compute dynamic left border color depending on current active phase
                    const phaseBorderStyles: Record<number, string> = {
                      1: "border-l-[5px] border-l-blue-500 hover:border-l-blue-600",
                      2: "border-l-[5px] border-l-green-500 hover:border-l-green-600",
                      3: "border-l-[5px] border-l-amber-500 hover:border-l-amber-600",
                      4: "border-l-[5px] border-l-purple-500 hover:border-l-purple-600",
                      5: "border-l-[5px] border-l-red-500 hover:border-l-red-600"
                    };

                    return (
                      <Link to={`/project/${project.id}`} key={project.id} className="block block-link group">
                        <Card className={`bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 hover:shadow-md transition-all h-full cursor-pointer relative overflow-hidden ${
                          phaseBorderStyles[project.current_phase] || "border-l-[5px] border-l-blue-500"
                        } hover:-translate-y-0.5 duration-200`}>
                          
                          <CardHeader className="pb-3 pt-4 px-4">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <CardTitle className="text-sm font-extrabold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                                  {project.name}
                                </CardTitle>
                                {project.description ? (
                                  <CardDescription className="line-clamp-1 text-[11px] mt-0.5 font-sans leading-relaxed text-slate-400 dark:text-slate-500">
                                    {project.description}
                                  </CardDescription>
                                ) : (
                                  <span className="text-[11px] text-slate-300 dark:text-slate-700 italic block mt-0.5">Ingen beskrivning angiven</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {isStagnant && (
                                  <span className="h-2 w-2 rounded-full bg-amber-500 inline-block animate-pulse" title="Stagnerat"></span>
                                )}
                                <Badge variant={project.status === "completed" ? "default" : "secondary"} className="text-[9px] font-bold px-1.5 py-0">
                                  {project.status === "active" ? "Aktiv" : "Klar"}
                                </Badge>
                              </div>
                            </div>
                          </CardHeader>

                          <CardContent className="space-y-4 px-4 pb-4">
                            
                            {/* Linear tracker for DMAIC Steps */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 font-semibold">
                                  <span>{phaseData.icon}</span>
                                  <span>Fas: {phaseData.name}</span>
                                </span>
                                <span className="font-mono text-slate-400 font-bold text-[10px]">{project.current_phase}/5 Metodik</span>
                              </div>
                              
                              {/* 5 bars indicating completion state */}
                              <div className="flex gap-1">
                                {phases.map(p => {
                                  let bgClass = "bg-slate-100 dark:bg-slate-800/60";
                                  if (p.id <= project.current_phase) {
                                    bgClass = p.id === 1 ? "bg-blue-500" 
                                            : p.id === 2 ? "bg-green-500" 
                                            : p.id === 3 ? "bg-amber-500" 
                                            : p.id === 4 ? "bg-purple-500" 
                                            : "bg-red-500";
                                  }
                                  return (
                                    <div
                                      key={p.id}
                                      className={`h-1.5 flex-1 rounded-full ${bgClass}`}
                                      title={`Fas ${p.id}: ${p.name}`}
                                    />
                                  );
                                })}
                              </div>
                            </div>

                            {/* Tollgate Completion State */}
                            {tp && (
                              <div className="space-y-1 bg-slate-50/60 dark:bg-slate-950/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/40">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-slate-400 dark:text-slate-500 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                                    <CheckCircle2 className="h-3 w-3 text-emerald-500" /> TOLLGATES
                                  </span>
                                  <span className="font-mono font-bold text-[10px] text-slate-600 dark:text-slate-300">{tp.completed} av {tp.total} ({tollgatePercent}%)</span>
                                </div>
                                <Progress value={tollgatePercent} className="h-1 bg-slate-100 dark:bg-slate-800" />
                              </div>
                            )}

                            {/* Sigma + Financial Metrics row */}
                            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800/40">
                              
                              {/* Left side: Sigma info */}
                              <div>
                                {latestSigma !== null ? (
                                  <div className="flex items-center gap-1.5" title="Senaste tillgängliga sigma-språng">
                                    <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                                    <span className="font-mono font-extrabold text-xs text-slate-900 dark:text-slate-100">{latestSigma.toFixed(2)}σ</span>
                                    {firstSigma !== null && latestSigma !== firstSigma && (
                                      <Badge 
                                        variant="outline" 
                                        className={`text-[9px] px-1 py-0 font-bold ${
                                          latestSigma >= firstSigma 
                                            ? "text-emerald-600 bg-emerald-50/60 border-emerald-100 dark:text-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-900/50" 
                                            : "text-red-600 bg-red-50/60 border-red-100 dark:text-red-300 dark:bg-red-950/20 dark:border-red-900/50"
                                        }`}
                                      >
                                        {latestSigma >= firstSigma ? "↑" : "↓"} {(latestSigma - firstSigma).toFixed(1)}
                                      </Badge>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-medium">Ej sigma-mätt ännu</span>
                                )}
                              </div>

                              {/* Right side: Savings info */}
                              <div>
                                {(project.estimated_savings || project.actual_savings) ? (
                                  <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs">
                                    <Coins className="h-3.5 w-3.5" />
                                    <span>{formatCurrency(project.actual_savings || project.estimated_savings)}</span>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-medium">Inga besparingar</span>
                                )}
                              </div>

                            </div>

                            {/* Footer block: Tools and activity logs context */}
                            <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
                              <span className="font-medium bg-slate-50 dark:bg-slate-850 px-2 py-0.5 rounded text-[10px] text-slate-600 dark:text-slate-400">
                                {tools.length} verktyg anslutna
                              </span>
                              <span className="flex items-center gap-1">
                                <CalendarDays className="h-3 w-3" />
                                {days === 0 ? "Idag" : `${days} d sedan`}
                              </span>
                            </div>

                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden border-t-2 border-t-blue-500/80">
                  <div className="overflow-x-auto">
                    <div className="min-w-[900px]">
                      
                      {/* Gantt Header */}
                      <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 text-[10px] font-bold font-mono tracking-wider text-slate-400 dark:text-slate-505 select-none">
                        <div className="w-80 shrink-0 p-4 border-r border-slate-100 dark:border-slate-800/70">
                          PROJEKT & AKTIV FAS
                        </div>
                        
                        {/* Time Columns Header */}
                        <div className="flex-1 flex relative">
                          {ganttMonths.map((m, i) => (
                            <div 
                              key={i} 
                              className="flex-1 text-center p-4 border-r border-slate-100 dark:border-slate-800/50 last:border-0"
                            >
                              {m.toLocaleDateString("sv-SE", { month: "short", year: "2-digit" }).toUpperCase()}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Gantt Rows */}
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                        {filteredProjects.map(project => {
                          const pos = getGanttBarPosition(project);
                          const phaseData = phases.find(ph => ph.id === project.current_phase) || phases[0];
                          const days = daysSince(project.updated_at);
                          const isStagnant = project.status === "active" && days > 14;

                          return (
                            <div key={project.id} className="flex min-h-[90px] items-center hover:bg-slate-50/20 dark:hover:bg-slate-950/5 transition-colors">
                              
                              {/* Project info column */}
                              <div className="w-80 shrink-0 p-4 border-r border-slate-100 dark:border-slate-800/70 flex flex-col justify-center space-y-1.5 overflow-hidden">
                                <div className="flex items-center gap-1.5 justify-between">
                                  <Link 
                                    to={`/project/${project.id}`} 
                                    className="font-extrabold text-xs text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-1 pr-1"
                                  >
                                    {project.name}
                                  </Link>
                                  <Badge variant={project.status === "completed" ? "default" : "secondary"} className="text-[9px] font-bold px-1.5 py-0 shrink-0">
                                    {project.status === "active" ? "Aktiv" : "Klar"}
                                  </Badge>
                                </div>
                                
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                                  <span>{phaseData.icon}</span>
                                  <span className="font-semibold">Fas {project.current_phase}: {phaseData.name}</span>
                                </div>
                                
                                <div className="text-[9px] text-slate-400 dark:text-slate-500 font-mono tracking-tight flex items-center gap-1.5">
                                  <span>Start: {new Date(project.created_at).toLocaleDateString("sv-SE")}</span>
                                  <span>•</span>
                                  <span className={isStagnant ? "text-amber-500 dark:text-amber-400 font-semibold" : ""}>
                                    {days === 0 ? "Aktiv idag" : `${days} d sedan`}
                                  </span>
                                </div>
                              </div>

                              {/* Timeline Gantt Columns with horizontal progressive bar */}
                              <div className="flex-1 h-full min-h-[90px] relative flex items-center pr-4">
                                
                                {/* Vertical helper grids */}
                                <div className="absolute inset-0 flex pointer-events-none">
                                  {ganttMonths.map((_, i) => (
                                    <div key={i} className="flex-1 border-r border-slate-100/35 dark:border-slate-850/15 last:border-0 h-full" />
                                  ))}
                                </div>

                                {/* Gantt Progressive Row Bar */}
                                <div 
                                  className="absolute h-9 rounded-xl flex items-center p-0.5 overflow-hidden transition-all group/gantt hover:scale-[1.01] border border-slate-200/50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20"
                                  style={{ left: pos.left, width: pos.width }}
                                >
                                  {/* Draw 5 visual segmented modules inside representing DMAIC */}
                                  <div className="flex w-full h-full gap-0.5">
                                    {[1, 2, 3, 4, 5].map((idx) => {
                                      const phaseColor = PHASE_COLORS[idx - 1];
                                      const isCurrent = idx === project.current_phase;
                                      const isCompleted = idx < project.current_phase;
                                      const isPastOrCurrent = idx <= project.current_phase;

                                      return (
                                        <div 
                                          key={idx} 
                                          className={`flex-1 h-full rounded flex items-center justify-center relative transition-all ${
                                            isCurrent 
                                              ? "shadow-[0_1px_4px_rgba(59,130,246,0.3)] saturate-125 z-10 font-bold" 
                                              : ""
                                          }`}
                                          style={{ 
                                            backgroundColor: isPastOrCurrent ? phaseColor : "transparent"
                                          }}
                                        >
                                          {/* Text indicator */}
                                          <span className={`text-[9px] font-extrabold select-none ${
                                            isPastOrCurrent ? "text-white" : "text-slate-300 dark:text-slate-700 font-light"
                                          }`}>
                                            {idx === 1 ? "D" : idx === 2 ? "M" : idx === 3 ? "A" : idx === 4 ? "I" : "C"}
                                          </span>

                                          {/* Active blinking dot helper */}
                                          {isCurrent && (
                                            <span className="absolute -top-0.5 -right-0.5 flex h-1 w-1">
                                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-80"></span>
                                              <span className="relative inline-flex rounded-full h-1 w-1 bg-white"></span>
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* Tiny hover timestamp popover */}
                                  <div className="absolute inset-0 bg-slate-950/90 dark:bg-white/95 text-white dark:text-slate-950 flex items-center justify-center opacity-0 group-hover/gantt:opacity-100 transition-opacity pointer-events-none rounded-lg">
                                    <div className="text-[10px] font-bold font-mono tracking-wide flex items-center gap-2">
                                      <span>{pos.startDate}</span>
                                      <span className="text-blue-500">→</span>
                                      <span>{pos.endDate} (estimerat slut)</span>
                                    </div>
                                  </div>

                                </div>

                              </div>

                            </div>
                          );
                        })}
                      </div>

                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}

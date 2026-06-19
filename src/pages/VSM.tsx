import { useState, useCallback, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Workflow, 
  Plus, 
  Trash2, 
  ArrowRight, 
  Play, 
  Sparkles, 
  Layers, 
  TrendingUp, 
  Clock, 
  AlertTriangle, 
  Box, 
  Users, 
  HelpCircle,
  FileSpreadsheet,
  Download
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCalculatorSave } from "@/hooks/useCalculatorSave";
import { CalculatorSaveButton } from "@/components/calculators/CalculatorSaveButton";
import { CalculatorLoadButton } from "@/components/calculators/CalculatorLoadButton";
import { toast } from "sonner";

// Flow steps structure
interface VsmProcessStep {
  id: string;
  name: string;
  cycleTime: number;       // Value Added (VA) time in seconds/minutes
  changeoverTime: number;  // C/O in minutes
  uptime: number;          // % uptime (0-100)
  operators: number;       // Number of operators
  inventoryQuantity: number; // Inventory units waiting after this step
}

const TEMPLATES = {
  manufacturing: {
    customerDemand: 120, // units per day
    shiftHours: 8,       // hours per shift
    steps: [
      { id: "1", name: "Stansning", cycleTime: 45, changeoverTime: 15, uptime: 95, operators: 1, inventoryQuantity: 80 },
      { id: "2", name: "Svetsning", cycleTime: 120, changeoverTime: 5, uptime: 88, operators: 2, inventoryQuantity: 220 },
      { id: "3", name: "Montering", cycleTime: 180, changeoverTime: 0, uptime: 98, operators: 4, inventoryQuantity: 50 },
      { id: "4", name: "Kontroll & Paketering", cycleTime: 60, changeoverTime: 2, uptime: 99, operators: 1, inventoryQuantity: 10 }
    ]
  },
  administrative: {
    customerDemand: 40,   // applications processed per day
    shiftHours: 7.5,      // working hours per day
    steps: [
      { id: "1", name: "Registrering", cycleTime: 300, changeoverTime: 0, uptime: 100, operators: 1, inventoryQuantity: 15 },
      { id: "2", name: "Granskning", cycleTime: 900, changeoverTime: 0, uptime: 95, operators: 2, inventoryQuantity: 35 },
      { id: "3", name: "Beslutsfattande", cycleTime: 600, changeoverTime: 0, uptime: 100, operators: 1, inventoryQuantity: 10 },
      { id: "4", name: "Utskick", cycleTime: 120, changeoverTime: 0, uptime: 100, operators: 1, inventoryQuantity: 2 }
    ]
  }
};

export default function VSM() {
  const [customerDemand, setCustomerDemand] = useState<string>("120");
  const [shiftHours, setShiftHours] = useState<string>("8");
  const [steps, setSteps] = useState<VsmProcessStep[]>(TEMPLATES.manufacturing.steps);

  // New step creation state
  const [newStepName, setNewStepName] = useState("");
  const [newCycleTime, setNewCycleTime] = useState("");
  const [newCOTime, setNewCOTime] = useState("");
  const [newUptime, setNewUptime] = useState("95");
  const [newOperators, setNewOperators] = useState("1");
  const [newInventory, setNewInventory] = useState("");

  const handleLoad = useCallback((inputs: Record<string, unknown>) => {
    if (inputs.customerDemand !== undefined) setCustomerDemand(String(inputs.customerDemand));
    if (inputs.shiftHours !== undefined) setShiftHours(String(inputs.shiftHours));
    if (inputs.steps && Array.isArray(inputs.steps)) {
      setSteps(inputs.steps as VsmProcessStep[]);
    }
  }, []);

  const { canSave, isSaving, notes, setNotes, saveCalculation, savedCalculation, isLoadingSaved } = useCalculatorSave("vsm-mapping", handleLoad);

  const loadTemplate = (type: "manufacturing" | "administrative") => {
    const template = TEMPLATES[type];
    setCustomerDemand(String(template.customerDemand));
    setShiftHours(String(template.shiftHours));
    setSteps(template.steps);
    toast.success(`Laddade ${type === "manufacturing" ? "Tillverkningsmall" : "Administrativ processmall"}!`);
  };

  const addStep = () => {
    if (!newStepName.trim()) {
      toast.error("Vänligen ange ett namn på processsteget.");
      return;
    }
    const ct = parseFloat(newCycleTime) || 0;
    const co = parseFloat(newCOTime) || 0;
    const ut = parseFloat(newUptime) || 100;
    const op = parseFloat(newOperators) || 1;
    const inv = parseFloat(newInventory) || 0;

    const nextId = (Math.max(...steps.map(s => parseInt(s.id) || 0), 0) + 1).toString();
    const newStep: VsmProcessStep = {
      id: nextId,
      name: newStepName,
      cycleTime: ct,
      changeoverTime: co,
      uptime: ut,
      operators: op,
      inventoryQuantity: inv
    };

    setSteps([...steps, newStep]);
    setNewStepName("");
    setNewCycleTime("");
    setNewCOTime("");
    setNewInventory("");
    toast.success(`Lade till steget "${newStepName}"`);
  };

  const removeStep = (id: string) => {
    if (steps.length <= 1) {
      toast.error("Processen måste innehålla minst ett kvitto på processteg.");
      return;
    }
    setSteps(steps.filter(s => s.id !== id));
  };

  const updateStepField = (id: string, field: keyof VsmProcessStep, value: number | string) => {
    setSteps(steps.map(s => {
      if (s.id !== id) return s;
      return { ...s, [field]: value };
    }));
  };

  // Intermediate computations
  const demand = parseFloat(customerDemand) || 1;
  const hours = parseFloat(shiftHours) || 8;
  const availableSecondsPerDay = hours * 3600;
  
  // Takt Time = available time / demand (in seconds)
  const customerTaktSeconds = availableSecondsPerDay / demand;

  // Inventory Lead Time = inventory size / demand (in days)
  // To express in hours: (inv / demand) * shiftHours
  const getInventoryLeadTimeDays = (qty: number) => {
    if (qty <= 0 || demand <= 0) return 0;
    return qty / demand;
  };

  const getInventoryLeadTimeHours = (qty: number) => {
    return getInventoryLeadTimeDays(qty) * hours;
  };

  // Total Value-Add (VA) Time: sum of cycle times
  const totalVATimeSeconds = steps.reduce((sum, s) => sum + s.cycleTime, 0);

  // Total Non-Value-Add (NVA) Time: sum of inventory lead times converted to seconds
  // 1 inventory-day = availableSecondsPerDay (since we only work shiftHours per day)
  const totalNVATimeSeconds = steps.reduce((sum, s) => {
    const invDays = getInventoryLeadTimeDays(s.inventoryQuantity);
    return sum + (invDays * availableSecondsPerDay);
  }, 0);

  const totalLeadTimeSec = totalVATimeSeconds + totalNVATimeSeconds;
  
  // Lead Time in Days
  const totalLeadTimeDays = totalLeadTimeSec / availableSecondsPerDay;
  const processCycleEfficiency = totalLeadTimeSec > 0 ? (totalVATimeSeconds / totalLeadTimeSec) * 100 : 0;

  const handleSave = () => {
    saveCalculation({
      toolId: "vsm-mapping",
      toolName: "Värdeflödesanalys (VSM)",
      phase: 2,
      inputs: { customerDemand, shiftHours, steps },
      results: {
        customerTaktSeconds,
        totalVATimeSeconds,
        totalNVATimeSeconds,
        totalLeadTimeSec,
        totalLeadTimeDays,
        processCycleEfficiency
      }
    });
  };

  return (
    <Layout>
      <section className="py-8 bg-muted/20 min-h-screen">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="space-y-6">
            
            {/* VSM Header */}
            <div className="bg-background border border-primary/5 rounded-2xl p-8 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
              <div className="absolute right-0 top-0 h-40 w-40 bg-primary/2.5 rounded-full blur-3xl" />
              <div className="space-y-1.5 max-w-3xl">
                <div className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/20 text-primary px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
                  <Workflow className="h-3.5 w-3.5" /> Lean Metodik
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight">Värdeflödesanalys (Value Stream Mapping)</h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Kartlägg informations- och materialflöden i din verksamhet. VSM identifierar flaskhalsar, överproduktion och slöseri genom att visualisera värdeskapande processtid (VA) i relation till icke-värdeskapande ledtid (NVA).
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <CalculatorLoadButton savedCalculation={savedCalculation} isLoading={isLoadingSaved} onLoad={handleLoad} />
              </div>
            </div>

            {/* Template Selector & Customer Core Params */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Customer and overall setup */}
              <div className="lg:col-span-4 space-y-6">
                <Card className="border border-primary/5 shadow-3xs">
                  <CardHeader className="pb-3 border-b border-primary/5">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" /> Kundens efterfrågan & Takt
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div className="flex gap-2">
                      <Button variant="outline" size="xs" onClick={() => loadTemplate("manufacturing")} className="flex-1 text-xs py-1.5">
                        ⚙️ Tillverkning (Standard)
                      </Button>
                      <Button variant="outline" size="xs" onClick={() => loadTemplate("administrative")} className="flex-1 text-xs py-1.5">
                        📂 Administrativt
                      </Button>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="space-y-1">
                        <Label htmlFor="customerDemand" className="text-xs font-semibold">Kundens efterfrågan / Dygn</Label>
                        <div className="relative">
                          <Input 
                            id="customerDemand" 
                            type="number" 
                            value={customerDemand} 
                            onChange={e => setCustomerDemand(e.target.value)} 
                            className="text-sm font-medium"
                          />
                          <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">enh / dygn</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="shiftHours" className="text-xs font-semibold">Effektiv arbetstid / Skift</Label>
                        <div className="relative">
                          <Input 
                            id="shiftHours" 
                            type="number" 
                            step="0.5"
                            value={shiftHours} 
                            onChange={e => setShiftHours(e.target.value)} 
                            className="text-sm font-medium"
                          />
                          <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">timmar</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-muted/20 border rounded-lg space-y-1 text-center">
                      <div className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Beräknad Kundtakt (Takt Time)</div>
                      <div className="text-2xl font-black font-sans text-primary">
                        {customerTaktSeconds.toFixed(1)}s
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-snug">
                        Kunden förbrukar 1 enhet var {customerTaktSeconds.toFixed(0)}e sekund. Alla processteg bör ligga under denna tid!
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Adding step form */}
                <Card className="border border-primary/5 shadow-3xs">
                  <CardHeader className="pb-3 border-b border-primary/5">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Plus className="h-4 w-4 text-emerald-500" /> Lägg till nytt processsteg
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="newStepName" className="text-xs">Steg/Aktivitet</Label>
                      <Input 
                        id="newStepName" 
                        placeholder="T.ex. Montering, Lackering" 
                        value={newStepName} 
                        onChange={e => setNewStepName(e.target.value)}
                        className="text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="newCycleTime" className="text-xs">Cykeltid C/T (sek)</Label>
                        <Input 
                          id="newCycleTime" 
                          type="number" 
                          placeholder="Ex. 180" 
                          value={newCycleTime} 
                          onChange={e => setNewCycleTime(e.target.value)}
                          className="text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="newCOTime" className="text-xs">Ställtid C/O (min)</Label>
                        <Input 
                          id="newCOTime" 
                          type="number" 
                          placeholder="Ex. 15" 
                          value={newCOTime} 
                          onChange={e => setNewCOTime(e.target.value)}
                          className="text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="newUptime" className="text-xs">Uptime (%)</Label>
                        <Input 
                          id="newUptime" 
                          type="number" 
                          placeholder="100" 
                          value={newUptime} 
                          onChange={e => setNewUptime(e.target.value)}
                          className="text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="newOperators" className="text-xs">Operatörer</Label>
                        <Input 
                          id="newOperators" 
                          type="number" 
                          placeholder="1" 
                          value={newOperators} 
                          onChange={e => setNewOperators(e.target.value)}
                          className="text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-1 pt-1">
                      <Label htmlFor="newInventory" className="text-xs flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5 text-amber-500" /> Lager efter steget (enheter)
                      </Label>
                      <Input 
                        id="newInventory" 
                        type="number" 
                        placeholder="Ex. 50" 
                        value={newInventory} 
                        onChange={e => setNewInventory(e.target.value)}
                        className="text-xs"
                      />
                      <span className="text-[10px] text-muted-foreground block">
                        Lagrade halvfabrikat / köande ärenden före nästa operation.
                      </span>
                    </div>

                    <Button onClick={addStep} size="sm" className="w-full mt-2 font-medium">
                      Infoga processsteg
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Interactive map list and stair step timeline preview */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* Visual Flow Representation Map */}
                <Card className="border border-primary/10 overflow-hidden shadow-sm">
                  <CardHeader className="bg-muted/10 border-b border-primary/5 py-4">
                    <CardTitle className="text-base font-bold flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Workflow className="h-4.5 w-4.5 text-primary" /> Visualisering av Värdeflödet (Material & Lager)
                      </span>
                      <span className="text-xs text-muted-foreground">Klicka i fälten för att ändra värden direkt i kedjan</span>
                    </CardTitle>
                  </CardHeader>
                  
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row flex-wrap items-center justify-start gap-4">
                      {steps.map((step, index) => {
                        const isTaktExceeded = step.cycleTime > customerTaktSeconds;
                        const leadTimeHrs = getInventoryLeadTimeHours(step.inventoryQuantity);
                        const leadTimeDays = getInventoryLeadTimeDays(step.inventoryQuantity);

                        return (
                          <div key={step.id} className="flex flex-col md:flex-row items-center gap-4">
                            {/* Process Block Card */}
                            <div className={`w-52 rounded-xl border p-4 bg-background shadow-3xs relative transition-all hover:ring-1 hover:ring-primary/20 ${isTaktExceeded ? "border-rose-400 dark:border-rose-800" : "border-primary/10"}`}>
                              {isTaktExceeded && (
                                <Badge variant="destructive" className="absolute -top-2.5 left-3 text-[9px] uppercase tracking-wider py-0.5 px-2">
                                  Flaskhals (&gt; Takt)
                                </Badge>
                              )}
                              
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">Steg {index + 1}</span>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => removeStep(step.id)}
                                  className="h-5 w-5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>

                              <input 
                                className="font-semibold text-sm w-full bg-transparent border-0 border-b border-transparent hover:border-muted-foreground/30 focus:border-primary focus:ring-0 p-0 mb-3 text-foreground"
                                value={step.name} 
                                onChange={e => updateStepField(step.id, "name", e.target.value)} 
                              />

                              <div className="space-y-2 text-xs">
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">Cykeltid (C/T):</span>
                                  <div className="flex items-center gap-1 w-20 justify-end">
                                    <input 
                                      type="number" 
                                      className="font-bold text-right p-0 h-5 w-12 bg-muted/30 border-0 rounded text-xs" 
                                      value={step.cycleTime || ""} 
                                      onChange={e => updateStepField(step.id, "cycleTime", parseFloat(e.target.value) || 0)} 
                                    />
                                    <span className="text-muted-foreground text-[10px]">s</span>
                                  </div>
                                </div>

                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">Ställtid (C/O):</span>
                                  <div className="flex items-center gap-1 w-20 justify-end">
                                    <input 
                                      type="number" 
                                      className="p-0 text-right h-5 w-12 bg-muted/10 border-0 rounded text-xs" 
                                      value={step.changeoverTime || ""} 
                                      onChange={e => updateStepField(step.id, "changeoverTime", parseFloat(e.target.value) || 0)} 
                                    />
                                    <span className="text-muted-foreground text-[10px]">m</span>
                                  </div>
                                </div>

                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">Uptime:</span>
                                  <div className="flex items-center gap-1 w-20 justify-end">
                                    <input 
                                      type="number" 
                                      className="p-0 text-right h-5 w-12 bg-muted/10 border-0 rounded text-xs" 
                                      value={step.uptime || ""} 
                                      onChange={e => updateStepField(step.id, "uptime", parseFloat(e.target.value) || 100)} 
                                    />
                                    <span className="text-muted-foreground text-[10px]">%</span>
                                  </div>
                                </div>

                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">Operatörer:</span>
                                  <div className="flex items-center gap-1 w-20 justify-end">
                                    <input 
                                      type="number" 
                                      className="p-0 text-right h-5 w-12 bg-muted/10 border-0 rounded text-xs" 
                                      value={step.operators || ""} 
                                      onChange={e => updateStepField(step.id, "operators", parseFloat(e.target.value) || 1)} 
                                    />
                                    <span className="text-muted-foreground text-[10px]">st</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Arrow and Intercepting Inventory Triangle */}
                            <div className="flex md:flex-row items-center gap-2">
                              <ArrowRight className="h-4 w-4 text-muted-foreground hidden md:block" />
                              
                              {/* Inventory Visual Triangle Block representation */}
                              <div className="flex flex-col items-center bg-amber-500/5 border border-amber-500/20 p-2.5 rounded-lg text-center min-w-28 relative">
                                <div className="absolute -top-1 right-1">
                                  <Badge className="bg-amber-500 hover:bg-amber-600 font-bold p-0 px-1 text-[8px] h-3">∆</Badge>
                                </div>
                                <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider block mb-1">Mellanlager</span>
                                <div className="flex items-center justify-center gap-1 mb-1">
                                  <input 
                                    type="number" 
                                    className="font-bold text-center p-0 h-6 w-14 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-0 rounded text-xs" 
                                    value={step.inventoryQuantity || ""} 
                                    placeholder="0"
                                    onChange={e => updateStepField(step.id, "inventoryQuantity", parseFloat(e.target.value) || 0)} 
                                  />
                                  <span className="text-[10px] text-muted-foreground">st</span>
                                </div>
                                <span className="text-[10px] font-mono text-muted-foreground leading-none">
                                  {leadTimeDays >= 1 
                                    ? `~${leadTimeDays.toFixed(1)} dygn` 
                                    : `${leadTimeHrs.toFixed(1)} tim`
                                  } ledtid
                                </span>
                              </div>

                              {index < steps.length - 1 && (
                                <ArrowRight className="h-4 w-4 text-muted-foreground hidden md:block" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                </CardContent>
              </Card>

              {/* Classic Lead Time Stairway Chart (Visuella Trappan) */}
              <Card className="border border-primary/10 overflow-hidden shadow-sm">
                <CardHeader className="bg-muted/10 border-b border-primary/5 py-3">
                  <CardTitle className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-primary" /> Värdeflödestidslinje (Value Stream Timeline Staircase)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="relative border-b pb-4">
                    {/* Visual stairs */}
                    <div className="flex flex-col md:flex-row items-stretch w-full justify-start select-none">
                      {steps.map((step, idx) => {
                        const invDays = getInventoryLeadTimeDays(step.inventoryQuantity);
                        const isHighInventory = invDays > 1;

                        return (
                          <div key={step.id} className="flex-1 flex flex-col justify-between pt-8">
                            
                            {/* Inventory NVA (Upper line of stair) */}
                            <div className="border-t-2 border-r-2 border-dashed border-amber-500/50 h-10 px-2 relative text-right flex flex-col justify-end">
                              <span className="absolute -top-5 right-2 text-[10px] font-mono text-amber-600 font-semibold">
                                NVA: {invDays >= 1 ? `${invDays.toFixed(1)}d` : `${(invDays * hours).toFixed(1)}h`}
                              </span>
                              {isHighInventory && (
                                <span className="absolute -top-7 left-1 text-[9px] text-rose-500 font-bold flex items-center gap-0.5">
                                  <AlertTriangle className="h-2.5 w-2.5" /> Hög väntetid
                                </span>
                              )}
                            </div>

                            {/* Process VA (Lower line of stair) */}
                            <div className="border-t-2 border-r-2 border-primary h-10 px-2 relative bg-primary/2.5">
                              <span className="absolute bottom-1 left-2 text-[10px] font-bold text-primary truncate max-w-[95%]">
                                {step.name}
                              </span>
                              <span className="absolute top-1 right-2 text-[10px] font-mono font-medium text-muted-foreground">
                                VA: {step.cycleTime}s
                              </span>
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Summary Indicators */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8 pt-4">
                    
                    <div className="bg-muted/10 border p-4 rounded-xl text-center">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Process Lead Time (PLT)</div>
                      <div className="text-3xl font-black font-sans leading-none mb-1 text-amber-600 dark:text-amber-400">
                        {totalLeadTimeDays.toFixed(1)}d
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Totalt {(totalLeadTimeSec / 3600).toFixed(0)} arbetstimmar i flödet
                      </p>
                    </div>

                    <div className="bg-muted/10 border p-4 rounded-xl text-center">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Värdeskapande Tid (VA)</div>
                      <div className="text-3xl font-black font-sans leading-none mb-1 text-primary">
                        {totalVATimeSeconds.toFixed(0)}s
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Summan av alla förädlande operationer
                      </p>
                    </div>

                    <div className="bg-muted/10 border p-4 rounded-xl text-center">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Icke-Värdeskapande Tid</div>
                      <div className="text-3xl font-black font-sans leading-none mb-1 text-rose-500">
                        {(totalNVATimeSeconds / 3600).toFixed(1)}h
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Lagerledtid, köande och väntande
                      </p>
                    </div>

                    <div className="bg-muted/10 border p-4 rounded-xl text-center">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Flödeseffektivitet (PCE)</div>
                      <div className="text-3xl font-black font-sans leading-none mb-1 text-emerald-600 dark:text-emerald-400">
                        {processCycleEfficiency.toFixed(2)}%
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {processCycleEfficiency < 5 ? "🔴 Mycket låg (Slöseri!)" : processCycleEfficiency < 15 ? "🟡 Genomsnittlig" : "🟢 Världsklass (&gt;15%)"}
                      </p>
                    </div>

                  </div>

                  <div className="mt-6 flex flex-col sm:flex-row justify-between items-center border-t border-primary/5 pt-6 gap-4">
                    <p className="text-xs text-muted-foreground max-w-xl">
                      💡 <strong>Lean-rekommendation:</strong> Traditionella flöden har ofta ett PCE-värde under 5%. Genom att halvera lager- och väntetider framför flaskhalsar kan ni sänka ledtiden till kunden dramatiskt utan att behöva öka takten på maskinerna!
                    </p>
                    <div className="w-full sm:w-auto shrink-0 flex items-center justify-end">
                      <CalculatorSaveButton canSave={canSave} isSaving={isSaving} hasResult={true} notes={notes} onNotesChange={setNotes} onSave={handleSave} />
                    </div>
                  </div>

                </CardContent>
              </Card>

              </div>
            </div>

          </div>
        </div>
      </section>
    </Layout>
  );
}

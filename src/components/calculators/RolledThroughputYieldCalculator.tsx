import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Sparkles, TrendingDown, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCalculatorSave } from "@/hooks/useCalculatorSave";
import { CalculatorSaveButton } from "./CalculatorSaveButton";
import { CalculatorLoadButton } from "./CalculatorLoadButton";
import { sigmaTable } from "@/data/dmaic-tools";

interface Step {
  id: string;
  name: string;
  inputUnits: string; // optional input-based calculation
  defects: string;     // optional input-based calculation
  yieldPct: string;   // direct yield percentage input
}

const DEFAULT_STEPS: Step[] = [
  { id: "1", name: "Steg 1: Montering", inputUnits: "1000", defects: "20", yieldPct: "98.0" },
  { id: "2", name: "Steg 2: Lödning", inputUnits: "980", defects: "49", yieldPct: "95.0" },
  { id: "3", name: "Steg 3: Testning", inputUnits: "931", defects: "9", yieldPct: "99.0" },
];

export function RolledThroughputYieldCalculator({ toolId = "rty-calculator", toolName = "Rolled Throughput Yield (RTY)", phase = 2 }: { toolId?: string; toolName?: string; phase?: number }) {
  const [steps, setSteps] = useState<Step[]>(DEFAULT_STEPS);
  const [result, setResult] = useState<{
    rty: number;
    stepYields: { id: string; name: string; computedYield: number }[];
    totalDpu: number;
    equivalentSigma: number;
  } | null>(null);

  const handleLoad = useCallback((inputs: Record<string, unknown>) => {
    if (inputs.steps && Array.isArray(inputs.steps)) {
      setSteps(inputs.steps as Step[]);
    }
  }, []);

  const { canSave, isSaving, notes, setNotes, saveCalculation, savedCalculation, isLoadingSaved } = useCalculatorSave(toolId, handleLoad);

  const addStep = () => {
    const nextId = (Math.max(...steps.map(s => parseInt(s.id) || 0), 0) + 1).toString();
    setSteps([...steps, { id: nextId, name: `Steg ${nextId}`, inputUnits: "", defects: "", yieldPct: "" }]);
  };

  const removeStep = (id: string) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter(s => s.id !== id));
  };

  const updateStep = (id: string, field: keyof Step, value: string) => {
    setSteps(steps.map(s => {
      if (s.id !== id) return s;
      const updated = { ...s, [field]: value };
      
      // Auto-compute yield from inputs if updated with inputUnits & defects
      if (field === "inputUnits" || field === "defects") {
        const units = parseFloat(field === "inputUnits" ? value : s.inputUnits);
        const defs = parseFloat(field === "defects" ? value : s.defects);
        if (!isNaN(units) && !isNaN(defs) && units > 0) {
          const computed = ((units - defs) / units) * 100;
          updated.yieldPct = Math.max(0, Math.min(100, computed)).toFixed(1);
        }
      }
      return updated;
    }));
  };

  const calculate = () => {
    let cumulativeYield = 1.0;
    let sumDpu = 0;
    const computedStepYields: { id: string; name: string; computedYield: number }[] = [];

    for (const step of steps) {
      let yVal = parseFloat(step.yieldPct) / 100;
      if (isNaN(yVal)) {
        // Fallback to compute from units & defects directly
        const units = parseFloat(step.inputUnits);
        const defs = parseFloat(step.defects);
        if (!isNaN(units) && !isNaN(defs) && units > 0) {
          yVal = (units - defs) / units;
        } else {
          yVal = 1.0; // Assume 100% if empty
        }
      }
      
      yVal = Math.max(0, Math.min(1, yVal));
      cumulativeYield *= yVal;
      
      // DPU = -ln(yield)
      if (yVal > 0) {
        sumDpu += -Math.log(yVal);
      } else {
        sumDpu += 999;
      }
      
      computedStepYields.push({
        id: step.id,
        name: step.name || `Steg ${step.id}`,
        computedYield: yVal * 100,
      });
    }

    const rty = cumulativeYield * 100;

    // Find equivalent sigma-level from rty (Using 1.5 shift standard table or lookup)
    const dpmoEquivalent = (1 - (rty / 100)) * 1000000;
    let equivalentSigma = 0;
    for (let i = sigmaTable.length - 1; i >= 0; i--) {
      if (dpmoEquivalent <= sigmaTable[i].dpmo) {
        equivalentSigma = sigmaTable[i].sigma;
        break;
      }
    }

    setResult({
      rty,
      stepYields: computedStepYields,
      totalDpu: sumDpu,
      equivalentSigma,
    });
  };

  const handleSave = () => {
    if (!result) return;
    saveCalculation({
      toolId,
      toolName,
      phase,
      inputs: { steps },
      results: result,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-muted/20 p-4 rounded-xl border border-primary/5">
        <div className="space-y-1">
          <h3 className="font-semibold text-lg">Steg-för-steg utbyte (Rolled Throughput Yield)</h3>
          <p className="text-sm text-muted-foreground">
            RTY mäter sannolikheten att en enhet passerar hela processen utan några defekter.
          </p>
        </div>
        <div className="flex gap-2">
          <CalculatorLoadButton savedCalculation={savedCalculation} isLoading={isLoadingSaved} onLoad={handleLoad} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-12 gap-3 pb-2 font-semibold text-sm text-muted-foreground border-b border-primary/5 px-2">
          <div className="col-span-4">Processsteg</div>
          <div className="col-span-3">Inkommande enheter (frivillig)</div>
          <div className="col-span-2">Defekter (frivillig)</div>
          <div className="col-span-2 text-right">Direkt utbyte (%)</div>
          <div className="col-span-1"></div>
        </div>

        {steps.map((step, idx) => (
          <div key={step.id} className="grid grid-cols-12 gap-3 items-center hover:bg-muted/10 p-2 rounded-lg transition-colors">
            <div className="col-span-4">
              <Input
                placeholder={`Mätpunkt t.ex. Steg ${idx + 1}`}
                value={step.name}
                onChange={(e) => updateStep(step.id, "name", e.target.value)}
                className="font-medium"
              />
            </div>
            <div className="col-span-3">
              <Input
                type="number"
                placeholder="Ex. 100"
                value={step.inputUnits}
                onChange={(e) => updateStep(step.id, "inputUnits", e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <Input
                type="number"
                placeholder="Ex. 2"
                value={step.defects}
                onChange={(e) => updateStep(step.id, "defects", e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <div className="relative">
                <Input
                  type="number"
                  placeholder="98.5"
                  value={step.yieldPct}
                  onChange={(e) => updateStep(step.id, "yieldPct", e.target.value)}
                  className="text-right pr-6"
                />
                <span className="absolute right-2 top-2 text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <div className="col-span-1 text-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeStep(step.id)}
                disabled={steps.length <= 1}
                className="text-destructive hover:bg-destructive/15 hover:text-destructive h-9 w-9"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        <div className="flex justify-between items-center pt-3">
          <Button variant="outline" size="sm" onClick={addStep} className="gap-1">
            <Plus className="h-4 w-4" /> Lägg till processsteg
          </Button>
          <Button onClick={calculate} size="lg" className="px-8 font-medium gap-2">
            <Sparkles className="h-4 w-4" /> Beräkna RTY
          </Button>
        </div>
      </div>

      {result && (
        <div className="bg-gradient-to-br from-primary/5 via-muted/50 to-primary/5 rounded-2xl p-6 border border-primary/10 mt-6 shadow-sm">
          <h4 className="text-base font-semibold mb-4 flex items-center gap-2">
            📊 Beräkningsresultat för Processkedjan
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-background border border-primary/5 rounded-xl p-4 text-center shadow-xs">
              <div className="text-muted-foreground text-xs font-semibold mb-1 uppercase tracking-wider">
                Rolled Throughput Yield (RTY)
              </div>
              <div className="text-4xl font-extrabold text-primary font-sans leading-none mb-1">
                {result.rty.toFixed(2)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Sannolikhet för felfri enhet genom hela kedjan
              </p>
            </div>

            <div className="bg-background border border-primary/5 rounded-xl p-4 text-center shadow-xs">
              <div className="text-muted-foreground text-xs font-semibold mb-1 uppercase tracking-wider">
                Totalt Processbortfall
              </div>
              <div className="text-4xl font-extrabold text-rose-500 font-sans leading-none mb-1">
                {(100 - result.rty).toFixed(2)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Ackumulerad defektrisk
              </p>
            </div>

            <div className="bg-background border border-primary/5 rounded-xl p-4 text-center shadow-xs">
              <div className="text-muted-foreground text-xs font-semibold mb-1 uppercase tracking-wider">
                Total DPU (Defects/Unit)
              </div>
              <div className="text-4xl font-extrabold text-sky-600 dark:text-sky-400 font-mono leading-none mb-1">
                {result.totalDpu.toFixed(4)}
              </div>
              <p className="text-xs text-muted-foreground">
                Summan av felen per enhet
              </p>
            </div>

            <div className="bg-background border border-primary/5 rounded-xl p-4 text-center shadow-xs">
              <div className="text-muted-foreground text-xs font-semibold mb-1 uppercase tracking-wider">
                Motsvarande Sigma-nivå
              </div>
              <div className="text-4xl font-extrabold text-emerald-600 dark:text-emerald-400 font-sans leading-none mb-1">
                {result.equivalentSigma > 0 ? `${result.equivalentSigma}σ` : "Ej kapabel (< 1σ)"}
              </div>
              <p className="text-xs text-muted-foreground">
                Övergripande processduglighet
              </p>
            </div>
          </div>

          <div className="space-y-3 bg-background border border-primary/5 rounded-xl p-4">
            <h5 className="font-semibold text-sm flex items-center gap-1">
              <TrendingDown className="h-4 w-4 text-rose-500" /> Analys av svagaste länken och förluster
            </h5>
            <div className="space-y-2">
              {result.stepYields.map((sy, i) => {
                const prevYield = i === 0 ? 100 : result.stepYields.slice(0, i).reduce((acc, step) => acc * (step.computedYield / 100), 1) * 100;
                const drop = prevYield - (prevYield * (sy.computedYield / 100));
                
                return (
                  <div key={sy.id} className="flex justify-between items-center text-xs p-2 rounded-lg hover:bg-muted/30 transition-all">
                    <span className="font-medium text-muted-foreground">
                      {sy.name}:
                    </span>
                    <div className="flex gap-4 items-center">
                      <span className="font-bold">
                        {sy.computedYield.toFixed(1)}% utbyte
                      </span>
                      {drop > 0.01 && (
                        <span className="text-rose-500 font-medium">
                          (-{drop.toFixed(1)}% av total produktion)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <CalculatorSaveButton canSave={canSave} isSaving={isSaving} hasResult={true} notes={notes} onNotesChange={setNotes} onSave={handleSave} />
        </div>
      )}
    </div>
  );
}

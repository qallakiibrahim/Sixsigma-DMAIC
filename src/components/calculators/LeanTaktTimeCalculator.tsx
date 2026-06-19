import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Sparkles, Users, Info, ChevronRight, Activity, Zap } from "lucide-react";
import { useCalculatorSave } from "@/hooks/useCalculatorSave";
import { CalculatorSaveButton } from "./CalculatorSaveButton";
import { CalculatorLoadButton } from "./CalculatorLoadButton";

const EXAMPLES = {
  customerDelivery: {
    availableHours: "7.5", // hours per shift (7.5h net)
    demand: "150",       // units demanded per shift
    actualCycleTime: "165", // seconds per unit
    totalWorkContent: "450" // sum of all step times in seconds
  },
  eCommerceWarehouse: {
    availableHours: "16", // 2 shifts of 8 hours
    demand: "2400",       // packages per day
    actualCycleTime: "22", // seconds per pkg
    totalWorkContent: "75"  // total steps pick + pack + label
  }
};

export function LeanTaktTimeCalculator({ toolId = "takt-calculator", toolName = "Takt- och Cykeltid", phase = 2 }: { toolId?: string; toolName?: string; phase?: number }) {
  const [availableHours, setAvailableHours] = useState("");
  const [demand, setDemand] = useState("");
  const [actualCycleTime, setActualCycleTime] = useState("");
  const [totalWorkContent, setTotalWorkContent] = useState("");

  const [result, setResult] = useState<{
    taktTimeSec: number;
    taktTimeMin: number;
    taktRatio: number;
    status: "bottleneck" | "balanced" | "overcapacity";
    requiredOperators: number;
    statusText: string;
    statusDesc: string;
  } | null>(null);

  const handleLoad = useCallback((inputs: Record<string, unknown>) => {
    if (inputs.availableHours !== undefined) setAvailableHours(String(inputs.availableHours));
    if (inputs.demand !== undefined) setDemand(String(inputs.demand));
    if (inputs.actualCycleTime !== undefined) setActualCycleTime(String(inputs.actualCycleTime));
    if (inputs.totalWorkContent !== undefined) setTotalWorkContent(String(inputs.totalWorkContent));
  }, []);

  const { canSave, isSaving, notes, setNotes, saveCalculation, savedCalculation, isLoadingSaved } = useCalculatorSave(toolId, handleLoad);

  const loadExample = (type: keyof typeof EXAMPLES) => {
    const ex = EXAMPLES[type];
    setAvailableHours(ex.availableHours);
    setDemand(ex.demand);
    setActualCycleTime(ex.actualCycleTime);
    setTotalWorkContent(ex.totalWorkContent);
    setResult(null);
  };

  const calculate = () => {
    const hours = parseFloat(availableHours);
    const cmdDemand = parseFloat(demand);
    const ct = parseFloat(actualCycleTime) || 0;
    const twc = parseFloat(totalWorkContent) || 0;

    if (isNaN(hours) || hours <= 0 || isNaN(cmdDemand) || cmdDemand <= 0) return;

    // Available Time in Seconds
    const availableSeconds = hours * 3600;
    
    // Takt Time = Available Time / Customer Demand
    const taktTimeSec = availableSeconds / cmdDemand;
    const taktTimeMin = taktTimeSec / 60;

    // Ratio = Cycle Time / Takt Time
    const taktRatio = ct > 0 ? ct / taktTimeSec : 0;

    let status: "bottleneck" | "balanced" | "overcapacity" = "balanced";
    let statusText = "Processen är balanserad";
    let statusDesc = "Processen kan möta efterfrågan på ett stabilt sätt utan omedelbar risk för flaskhalsar.";

    if (ct > taktTimeSec) {
      status = "bottleneck";
      statusText = "⚠ Flaskhals / Överbelastning";
      statusDesc = `Cykeltiden (${ct.toFixed(1)}s) överstiger takttiden (${taktTimeSec.toFixed(1)}s). Processen hinner INTE med kundens efterfrågan. Det krävs ${Math.ceil(ct / taktTimeSec)} st pararella arbetsstationer eller minskat slöseri.`;
    } else if (ct > 0 && ct < taktTimeSec * 0.5) {
      status = "overcapacity";
      statusText = "⚠ Allvarlig överkapacitet";
      statusDesc = "Arbetscykeln är extremt snabb jämfört med takten. Detta medför stor risk för överproduktion, onödig lagring, samt dötid hos operatörer.";
    }

    // Required Operators = Total Work Content / Takt Time
    const requiredOperators = twc > 0 ? twc / taktTimeSec : 0;

    setResult({
      taktTimeSec,
      taktTimeMin,
      taktRatio,
      status,
      requiredOperators,
      statusText,
      statusDesc,
    });
  };

  const handleSave = () => {
    if (!result) return;
    saveCalculation({
      toolId,
      toolName,
      phase,
      inputs: { availableHours, demand, actualCycleTime, totalWorkContent },
      results: result,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-muted/20 p-4 rounded-xl border border-primary/5">
        <div className="space-y-1">
          <h3 className="font-semibold text-lg">Takttid & Cykeltidsanalys (Lean Takt Time)</h3>
          <p className="text-sm text-muted-foreground">
            Takttakt mäter hur ofta en produkt måste färdigställas för att svara mot kundbehovet.
          </p>
        </div>
        <div className="flex gap-2">
          <CalculatorLoadButton savedCalculation={savedCalculation} isLoading={isLoadingSaved} onLoad={handleLoad} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex gap-2 mb-2">
            <Button variant="outline" size="sm" onClick={() => loadExample("customerDelivery")}>Exempel: Kundmottagning</Button>
            <Button variant="outline" size="sm" onClick={() => loadExample("eCommerceWarehouse")}>Exempel: E-handelslager</Button>
          </div>

          <div className="space-y-4 bg-muted/10 p-5 rounded-xl border border-primary/5">
            <h4 className="font-semibold text-sm flex items-center gap-1.5 text-primary">
              <Activity className="h-4 w-4" /> Kundbehov & Tillgänglig tid
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="availableHours">Tillgänglig tid per skift</Label>
                <div className="relative">
                  <Input id="availableHours" type="number" placeholder="7.5" step="0.1" value={availableHours} onChange={e => setAvailableHours(e.target.value)} />
                  <span className="absolute right-2.5 top-2.5 text-xs text-muted-foreground">timmar</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="demand">Kundens efterfrågan / skift</Label>
                <div className="relative">
                  <Input id="demand" type="number" placeholder="150" value={demand} onChange={e => setDemand(e.target.value)} />
                  <span className="absolute right-2.5 top-2.5 text-xs text-muted-foreground">enheter</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 bg-muted/10 p-5 rounded-xl border border-primary/5">
            <h4 className="font-semibold text-sm flex items-center gap-1.5 text-primary">
              <Zap className="h-4 w-4" /> Cykeltid & Arbetsinnehåll (sekunder)
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="actualCycleTime">Aktuell cykeltid (flaskhals)</Label>
                <div className="relative">
                  <Input id="actualCycleTime" type="number" placeholder="165" value={actualCycleTime} onChange={e => setActualCycleTime(e.target.value)} />
                  <span className="absolute right-2.5 top-2.5 text-xs text-muted-foreground">sek</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="totalWorkContent">Totalt arbetsinnehåll (TWC)</Label>
                <div className="relative">
                  <Input id="totalWorkContent" type="number" placeholder="450" value={totalWorkContent} onChange={e => setTotalWorkContent(e.target.value)} />
                  <span className="absolute right-2.5 top-2.5 text-xs text-muted-foreground">sek</span>
                </div>
              </div>
            </div>
          </div>

          <Button onClick={calculate} size="lg" className="w-full gap-2">
            <Sparkles className="h-4 w-4" /> Beräkna takttakt
          </Button>
        </div>

        <div className="space-y-4">
          {result ? (
            <div className="bg-gradient-to-br from-primary/5 via-muted/50 to-primary/5 rounded-2xl p-6 border border-primary/10 shadow-sm space-y-6">
              <div className="text-center">
                <div className="text-sm text-muted-foreground uppercase tracking-widest font-semibold mb-2">
                  Beräknad Takttid
                </div>
                <div className="text-5xl font-extrabold tracking-tight mb-2">
                  {result.taktTimeSec.toFixed(1)}s
                </div>
                <div className="text-sm text-muted-foreground">
                  Motsvarar {result.taktTimeMin.toFixed(2)} min per enhet
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-b border-primary/5 py-4 bg-background px-3 rounded-xl shadow-2xs">
                <div className="text-center space-y-1">
                  <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Taktutnyttjande</div>
                  <div className="text-xl font-bold font-mono">{(result.taktRatio * 100).toFixed(0)}%</div>
                  <div className="text-[10px] text-muted-foreground italic"> Cykeltid / Takttid </div>
                </div>
                <div className="text-center space-y-1 border-l">
                  <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider flex items-center justify-center gap-1">
                    <Users className="h-3 w-3" /> Operatörsbehov
                  </div>
                  <div className="text-xl font-bold font-mono">{result.requiredOperators.toFixed(1)}</div>
                  <div className="text-[10px] text-muted-foreground">Teoretiskt antal personer</div>
                </div>
              </div>

              <div className="space-y-2 bg-background p-4 rounded-xl border border-primary/5 shadow-3xs">
                <div className={`font-semibold text-sm ${result.status === "bottleneck" ? "text-rose-500" : result.status === "overcapacity" ? "text-amber-500" : "text-emerald-500"}`}>
                  {result.statusText}
                </div>
                <p className="text-xs text-muted-foreground leading-normal">
                  {result.statusDesc}
                </p>
              </div>

              {result.totalWorkContent !== 0 && (
                <div className="text-xs text-muted-foreground italic leading-relaxed">
                  💡 <strong>Operatörstips:</strong> Eftersom totalt manuellt arbete är {totalWorkContent} sekunder, behövs minst {Math.ceil(result.requiredOperators)} st operatörer som delar upp stegen om vardera håller sig under takttiden på {result.taktTimeSec.toFixed(1)}s.
                </div>
              )}

              <CalculatorSaveButton canSave={canSave} isSaving={isSaving} hasResult={true} notes={notes} onNotesChange={setNotes} onSave={handleSave} />
            </div>
          ) : (
            <div className="h-full flex flex-col justify-center items-center border border-dashed rounded-2xl p-12 text-center text-muted-foreground">
              <ClockTimeAnim />
              <p className="font-medium text-sm">Fyll i skifttimmar och kundbehov i formuläret.</p>
              <p className="text-xs">Klicka därefter på &quot;Beräkna takttakt&quot; för att se balansanalysen.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ClockTimeAnim() {
  return (
    <div className="relative h-12 w-12 mb-3 text-muted-foreground/50 flex items-center justify-center">
      <div className="absolute inset-0 border-2 rounded-full border-muted-foreground/20 animate-ping" />
      <Info className="h-10 w-10 text-muted-foreground/40" />
    </div>
  );
}

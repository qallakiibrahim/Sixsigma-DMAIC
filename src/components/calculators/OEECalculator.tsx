import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Sparkles, Play, Clock, BarChart4, AlertTriangle, CheckCircle } from "lucide-react";
import { useCalculatorSave } from "@/hooks/useCalculatorSave";
import { CalculatorSaveButton } from "./CalculatorSaveButton";
import { CalculatorLoadButton } from "./CalculatorLoadButton";

const EXAMPLES = {
  assemblyLine: {
    shiftLength: "480", // 8 hours in minutes
    breaks: "30",
    downtime: "45",
    idealRate: "2.5",  // 2.5 products per minute
    totalUnits: "900",
    defects: "18"
  },
  packagingLine: {
    shiftLength: "1440", // 24 hours
    breaks: "90",
    downtime: "120",
    idealRate: "15.0", // 15 products per min
    totalUnits: "18500",
    defects: "320"
  }
};

export function OEECalculator({ toolId = "oee-calculator", toolName = "Overall Equipment Effectiveness (OEE)", phase = 4 }: { toolId?: string; toolName?: string; phase?: number }) {
  const [shiftLength, setShiftLength] = useState("");
  const [breaks, setBreaks] = useState("");
  const [downtime, setDowntime] = useState("");
  const [idealRate, setIdealRate] = useState("");
  const [totalUnits, setTotalUnits] = useState("");
  const [defects, setDefects] = useState("");

  const [result, setResult] = useState<{
    availability: number;
    performance: number;
    quality: number;
    oee: number;
    plannedTime: number;
    operatingTime: number;
    valuableTime: number;
  } | null>(null);

  const handleLoad = useCallback((inputs: Record<string, unknown>) => {
    if (inputs.shiftLength !== undefined) setShiftLength(String(inputs.shiftLength));
    if (inputs.breaks !== undefined) setBreaks(String(inputs.breaks));
    if (inputs.downtime !== undefined) setDowntime(String(inputs.downtime));
    if (inputs.idealRate !== undefined) setIdealRate(String(inputs.idealRate));
    if (inputs.totalUnits !== undefined) setTotalUnits(String(inputs.totalUnits));
    if (inputs.defects !== undefined) setDefects(String(inputs.defects));
  }, []);

  const { canSave, isSaving, notes, setNotes, saveCalculation, savedCalculation, isLoadingSaved } = useCalculatorSave(toolId, handleLoad);

  const loadExample = (type: keyof typeof EXAMPLES) => {
    const ex = EXAMPLES[type];
    setShiftLength(ex.shiftLength);
    setBreaks(ex.breaks);
    setDowntime(ex.downtime);
    setIdealRate(ex.idealRate);
    setTotalUnits(ex.totalUnits);
    setDefects(ex.defects);
    setResult(null);
  };

  const calculate = () => {
    const sLen = parseFloat(shiftLength);
    const br = parseFloat(breaks) || 0;
    const dTime = parseFloat(downtime) || 0;
    const rate = parseFloat(idealRate);
    const units = parseFloat(totalUnits);
    const def = parseFloat(defects) || 0;

    if (isNaN(sLen) || sLen <= 0 || isNaN(rate) || rate <= 0 || isNaN(units) || units < 0) return;

    // Planned Production Time
    const plannedTime = sLen - br;
    if (plannedTime <= 0) return;

    // Operating Time = Planned Production Time - Downtime
    const operatingTime = plannedTime - dTime;
    const availability = operatingTime > 0 ? (operatingTime / plannedTime) * 100 : 0;

    // Performance = (Total Count * Ideal Cycle Time) / Operating Time
    // Ideal cycle time = 1 / idealRate
    const idealCycleTime = 1 / rate;
    const performance = operatingTime > 0 ? ((units * idealCycleTime) / operatingTime) * 100 : 0;

    // Quality = (Total Count - Defects) / Total Count
    const quality = units > 0 ? ((units - def) / units) * 100 : 0;

    // OEE = A * P * Q
    const oee = (availability / 100) * (performance / 100) * (quality / 100) * 100;

    const valuableTime = operatingTime * (performance / 100) * (quality / 100);

    setResult({
      availability: Math.min(100, Math.max(0, availability)),
      performance: Math.min(100, Math.max(0, performance)),
      quality: Math.min(100, Math.max(0, quality)),
      oee: Math.min(100, Math.max(0, oee)),
      plannedTime,
      operatingTime,
      valuableTime,
    });
  };

  const handleSave = () => {
    if (!result) return;
    saveCalculation({
      toolId,
      toolName,
      phase,
      inputs: { shiftLength, breaks, downtime, idealRate, totalUnits, defects },
      results: result,
    });
  };

  const getOEEClass = (val: number) => {
    if (val >= 85) return { text: "Världsklass (World Class)", color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10 border-green-500/20" };
    if (val >= 75) return { text: "Hög Duglighet (Good)", color: "text-emerald-500 dark:text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" };
    if (val >= 60) return { text: "Genomsnittlig (Average-Acceptable)", color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20" };
    return { text: "Låg effektivitet - Insatser krävs (Need Action)", color: "text-rose-500", bg: "bg-rose-500/10 border-rose-500/20" };
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-muted/20 p-4 rounded-xl border border-primary/5">
        <div className="space-y-1">
          <h3 className="font-semibold text-lg">Övergripande utrustningseffektivitet (OEE-kalkylator)</h3>
          <p className="text-sm text-muted-foreground">
            OEE mäter tillgänglighet, anläggningsprestanda och produktkvalitet för maskiner och produktionslinjer.
          </p>
        </div>
        <div className="flex gap-2">
          <CalculatorLoadButton savedCalculation={savedCalculation} isLoading={isLoadingSaved} onLoad={handleLoad} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex gap-2 mb-2">
            <Button variant="outline" size="sm" onClick={() => loadExample("assemblyLine")}>Exempel: Monteringslinje</Button>
            <Button variant="outline" size="sm" onClick={() => loadExample("packagingLine")}>Exempel: Packlina (Dygnsdrift)</Button>
          </div>

          <div className="space-y-4 bg-muted/10 p-5 rounded-xl border border-primary/5">
            <h4 className="font-semibold text-sm flex items-center gap-1.5 text-primary">
              <Clock className="h-4 w-4" /> Tidsparametrar (minuter)
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="shiftLength">Skiftlängd (totaltid)</Label>
                <div className="relative">
                  <Input id="shiftLength" type="number" placeholder="480" value={shiftLength} onChange={e => setShiftLength(e.target.value)} />
                  <span className="absolute right-2.5 top-2.5 text-xs text-muted-foreground font-medium">min</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="breaks">Planerade stopp/raster</Label>
                <div className="relative">
                  <Input id="breaks" type="number" placeholder="30" value={breaks} onChange={e => setBreaks(e.target.value)} />
                  <span className="absolute right-2.5 top-2.5 text-xs text-muted-foreground font-medium">min</span>
                </div>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="downtime">Oplanerade stopp (Ställtid, fel m.m.)</Label>
                <div className="relative">
                  <Input id="downtime" type="number" placeholder="45" value={downtime} onChange={e => setDowntime(e.target.value)} />
                  <span className="absolute right-2.5 top-2.5 text-xs text-muted-foreground font-medium">min</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 bg-muted/10 p-5 rounded-xl border border-primary/5">
            <h4 className="font-semibold text-sm flex items-center gap-1.5 text-primary">
              <BarChart4 className="h-4 w-4" /> Produktionsdata & Hastighet
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="idealRate">Teoretisk maxhastighet</Label>
                <div className="relative">
                  <Input id="idealRate" type="number" placeholder="2.5" step="0.1" value={idealRate} onChange={e => setIdealRate(e.target.value)} />
                  <span className="absolute right-2.5 top-2.5 text-xs text-muted-foreground">enh/min</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="totalUnits">Totalt tillverkat antal</Label>
                <Input id="totalUnits" type="number" placeholder="900" value={totalUnits} onChange={e => setTotalUnits(e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="defects">Härav kasserade / defekta enheter</Label>
                <Input id="defects" type="number" placeholder="18" value={defects} onChange={e => setDefects(e.target.value)} />
              </div>
            </div>
          </div>

          <Button onClick={calculate} size="lg" className="w-full gap-2">
            <Sparkles className="h-4 w-4" /> Beräkna OEE
          </Button>
        </div>

        <div className="space-y-4">
          {result ? (
            <div className="bg-gradient-to-br from-primary/5 via-muted/50 to-primary/5 rounded-2xl p-6 border border-primary/10 shadow-sm space-y-6">
              <div className="text-center">
                <div className="text-sm text-muted-foreground uppercase tracking-widest font-semibold mb-2">
                  Total utrustningsseffektivitet (OEE)
                </div>
                <div className="text-5xl font-extrabold tracking-tight mb-2">
                  {result.oee.toFixed(1)}%
                </div>
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase border ${getOEEClass(result.oee).color} ${getOEEClass(result.oee).bg}`}>
                  {result.oee >= 60 ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {getOEEClass(result.oee).text}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 border-t border-b border-primary/5 py-4 bg-background px-3 rounded-xl shadow-2xs">
                <div className="text-center space-y-1">
                  <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Tillgänglighet</div>
                  <div className="text-xl font-bold font-mono">{result.availability.toFixed(1)}%</div>
                  <div className="text-[10px] text-muted-foreground"> Driftstid / Planerad tid </div>
                </div>
                <div className="text-center space-y-1 border-l border-r border-primary/5">
                  <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Prestanda</div>
                  <div className="text-xl font-bold font-mono">{result.performance.toFixed(1)}%</div>
                  <div className="text-[10px] text-muted-foreground">Aktuell vs Teoretisk takt</div>
                </div>
                <div className="text-center space-y-1">
                  <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Kvalitetsutbyte</div>
                  <div className="text-xl font-bold font-mono">{result.quality.toFixed(1)}%</div>
                  <div className="text-[10px] text-muted-foreground">Felfritt vs Totalt</div>
                </div>
              </div>

              <div className="space-y-3">
                <h5 className="font-semibold text-sm">Tidsförlustanalys och effektiv drifttid:</h5>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex justify-between p-1.5 rounded bg-muted/20">
                    <span>Planerad produktionstid:</span>
                    <span className="font-semibold text-foreground">{result.plannedTime} minuter</span>
                  </div>
                  <div className="flex justify-between p-1.5 rounded bg-muted/20">
                    <span>Fysisk driftstid:</span>
                    <span className="font-semibold text-foreground">{result.operatingTime} minuter</span>
                  </div>
                  <div className="flex justify-between p-1.5 rounded bg-muted/20">
                    <span>Värdeskapande drifttid:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{result.valuableTime.toFixed(1)} minuter</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground italic leading-normal">
                  💡 Förlusttolkning: Utrustningen stod stilla {breaks + downtime} minuter, gick i hastighetsförlust motsvarande {Math.max(0, result.operatingTime - (result.operatingTime * (result.performance / 100))).toFixed(0)} minuter, och tillverkade defekter motsvarande {Math.max(0, (result.operatingTime * (result.performance / 100)) - result.valuableTime).toFixed(0)} minuter.
                </p>
              </div>

              <CalculatorSaveButton canSave={canSave} isSaving={isSaving} hasResult={true} notes={notes} onNotesChange={setNotes} onSave={handleSave} />
            </div>
          ) : (
            <div className="h-full flex flex-col justify-center items-center border border-dashed rounded-2xl p-12 text-center text-muted-foreground">
              <Clock className="h-10 w-10 mb-3 text-muted-foreground/50 animate-pulse" />
              <p className="font-medium text-sm">Fyll i tidsparametrar & produktionsdata till vänster.</p>
              <p className="text-xs">Klicka därefter på &quot;Beräkna OEE&quot; för att se analysen.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

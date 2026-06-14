import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useCalculatorSave } from "@/hooks/useCalculatorSave";
import { CalculatorSaveButton } from "@/components/calculators/CalculatorSaveButton";
import { CalculatorLoadButton } from "@/components/calculators/CalculatorLoadButton";
import { ExampleDataButton } from "@/components/calculators/ExampleDataButton";
import { CheckCircle2, ShieldCheck, Plus, Trash2, AlertTriangle, PlayCircle } from "lucide-react";

interface VerificationItem {
  id: string;
  originalRisk: string;
  mitigationAction: string;
  evidence: string;
  status: "Ej påbörjad" | "Pågående" | "Verifierad & Mitigerad" | "Kräver åtgärd";
  verifiedBy: string;
  date: string;
}

interface Props { toolId?: string; toolName?: string; phase?: number; }

export function ImproveRiskVerificationTool({ toolId = "improve-risk-verification", toolName = "Riskverifiering & Åtgärdskontroll", phase = 4 }: Props) {
  const [items, setItems] = useState<VerificationItem[]>([
    {
      id: "v1",
      originalRisk: "Nyckelresurser har begränsad tid pga linjearbete.",
      mitigationAction: "Etablera backup-resurser och säkra formell tidsallokering.",
      evidence: "Linjechefer har signerat tidsallokeringen. Två backup-resurser utbildades under Measure och är redo vid resursbortfall.",
      status: "Verifierad & Mitigerad",
      verifiedBy: "Lars G (Sponsor)",
      date: new Date().toLocaleDateString("sv-SE")
    },
    {
      id: "v2",
      originalRisk: "Dålig datakvalitet i ERP-system vid mätskede.",
      mitigationAction: "Sätt upp kompletterande manuella loggningsrutiner.",
      evidence: "Manuella loggningsmallar togs fram och användes under mätperioden. Datakvaliteten verifierades via Gage R&R.",
      status: "Verifierad & Mitigerad",
      verifiedBy: "Anna L (Black Belt)",
      date: new Date().toLocaleDateString("sv-SE")
    }
  ]);

  const [overarchingResolution, setOverarchingResolution] = useState("");

  const handleLoad = useCallback((inputs: Record<string, unknown>) => {
    if (inputs.items && Array.isArray(inputs.items)) {
      setItems(inputs.items.map((i: any, idx: number) => ({
        id: i.id || String(idx),
        originalRisk: i.originalRisk || "",
        mitigationAction: i.mitigationAction || "",
        evidence: i.evidence || "",
        status: i.status || "Pågående",
        verifiedBy: i.verifiedBy || "",
        date: i.date || ""
      })));
    }
    setOverarchingResolution(String(inputs.overarchingResolution || ""));
  }, []);

  const { canSave, isSaving, notes, setNotes, saveCalculation, savedCalculation, isLoadingSaved } = useCalculatorSave(toolId, handleLoad);

  const addItem = () => {
    const newItem: VerificationItem = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
      originalRisk: "",
      mitigationAction: "",
      evidence: "",
      status: "Pågående",
      verifiedBy: "",
      date: new Date().toLocaleDateString("sv-SE")
    };
    setItems(prev => [...prev, newItem]);
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: keyof VerificationItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Verifierad & Mitigerad":
        return "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-300 dark:border-green-900/50";
      case "Kräver åtgärd":
        return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-300 dark:border-red-900/50";
      case "Pågående":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/50";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-800";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Verifierad & Mitigerad":
        return <span className="flex items-center gap-1 text-[10px] bg-green-500 text-white font-bold px-1.5 py-0.5 rounded"><CheckCircle2 className="h-3 w-3" /> Verifierad</span>;
      case "Kräver åtgärd":
        return <span className="flex items-center gap-1 text-[10px] bg-red-500 text-white font-bold px-1.5 py-0.5 rounded"><AlertTriangle className="h-3 w-3" /> Åtgärd</span>;
      case "Pågående":
        return <span className="flex items-center gap-1 text-[10px] bg-amber-500 text-white font-bold px-1.5 py-0.5 rounded"><PlayCircle className="h-3 w-3" /> Pågående</span>;
      default:
        return <span className="text-[10px] bg-slate-400 text-white font-bold px-1.5 py-0.5 rounded">Väntar</span>;
    }
  };

  const loadExample = () => {
    setItems([
      {
        id: "ex-v1",
        originalRisk: "Motstånd mot förändring hos operatörer på linje 2.",
        mitigationAction: "Involvera nyckelpersoner tidigt i Kaizen-event.",
        evidence: "Tvärfunktionellt designmöte genomfördes vecka 16. Operatörerna deltog engagerat och tog fram SOP-mallen gemensamt.",
        status: "Verifierad & Mitigerad",
        verifiedBy: "Anna L (Black Belt)",
        date: new Date().toLocaleDateString("sv-SE")
      },
      {
        id: "ex-v2",
        originalRisk: "Långa ledtider för IT-behörigheter.",
        mitigationAction: "Skicka in kontobeställningar samtliga behörigheter under vecka 1 i Define.",
        evidence: "Behörigheter beställdes tidigt men IT-avdelningen har lång backlog. Två i teamet saknar fortfarande behörighet.",
        status: "Kräver åtgärd",
        verifiedBy: "Projektledare",
        date: new Date().toLocaleDateString("sv-SE")
      }
    ]);
    setOverarchingResolution("Riskmitigeringen har haft utmärkt effekt förutom på IT-behörigheterna. Frågan har lyfts till styrgruppens ordförande för omedelbar prioritering.");
  };

  const hasResult = items.length > 0 || overarchingResolution.trim().length > 0;

  return (
    <div className="space-y-4">
      <CalculatorLoadButton savedCalculation={savedCalculation} isLoading={isLoadingSaved} onLoad={handleLoad} />
      <ExampleDataButton onLoad={loadExample} />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Verifiering av risker och planerade åtgärder
          </Label>
          <Button type="button" variant="outline" size="xs" onClick={addItem} className="h-7 text-xs flex items-center gap-1">
            <Plus className="h-3 w-3" />
            Lägg till verifiering
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="border border-dashed border-muted rounded-lg p-6 text-center text-muted-foreground text-sm">
            Inga riskbeslut eller verifieringar inlagda ännu. Klicka på "Lägg till verifiering" eller ladda exempel för att starta.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={item.id} className={`border rounded-lg p-3 space-y-2 transition-colors ${getStatusColor(item.status)}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-medium text-slate-500">Uppföljning #{index + 1}</span>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(item.status)}
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={() => removeItem(item.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">Ursprunglig risk</Label>
                    <Input
                      value={item.originalRisk}
                      onChange={e => updateItem(item.id, "originalRisk", e.target.value)}
                      placeholder="Vilken risk adresserades?"
                      className="h-8 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">Planerad åtgärd (Mitigering)</Label>
                    <Input
                      value={item.mitigationAction}
                      onChange={e => updateItem(item.id, "mitigationAction", e.target.value)}
                      placeholder="Hur skulle risken minimeras?"
                      className="h-8 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-slate-500">Införda bevis / Utfall & Verifiering</Label>
                  <Input
                    value={item.evidence}
                    onChange={e => updateItem(item.id, "evidence", e.target.value)}
                    placeholder="Beskriv bevis och utfall av åtgärden..."
                    className="h-8 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">Status</Label>
                    <select
                      value={item.status}
                      onChange={e => updateItem(item.id, "status", e.target.value)}
                      className="w-full h-8 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 focus:ring-1 focus:ring-slate-400 focus:outline-none text-slate-900 dark:text-slate-100"
                    >
                      <option value="Pågående" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Pågående</option>
                      <option value="Verifierad & Mitigerad" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Verifierad & Mitigerad</option>
                      <option value="Kräver åtgärd" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Kräver åtgärd / Eskalering</option>
                      <option value="Ej påbörjad" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Ej påbörjad</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">Verifierad av</Label>
                    <Input
                      value={item.verifiedBy}
                      onChange={e => updateItem(item.id, "verifiedBy", e.target.value)}
                      placeholder="Namn / Roll"
                      className="h-8 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">Datum</Label>
                    <Input
                      value={item.date}
                      onChange={e => updateItem(item.id, "date", e.target.value)}
                      placeholder="åååå-mm-dd"
                      className="h-8 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          Övergripande Riskutlåtande inför Handover
        </Label>
        <Textarea
          value={overarchingResolution}
          onChange={e => setOverarchingResolution(e.target.value)}
          placeholder="Sammanfatta hur riskerna har mitigerats totalt sett..."
          className="text-xs h-16 resize-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800"
        />
      </div>

      <CalculatorSaveButton
        canSave={canSave}
        isSaving={isSaving}
        hasResult={hasResult}
        notes={notes}
        onNotesChange={setNotes}
        onSave={() => saveCalculation({
          toolId,
          toolName,
          phase,
          inputs: {
            items,
            overarchingResolution
          },
          results: {
            totalActionItems: items.length,
            verifiedItemsCount: items.filter(v => v.status === "Verifierad & Mitigerad").length,
            pendingItemsCount: items.filter(v => v.status === "Pågående" || v.status === "Ej påbörjad").length,
            warningItemsCount: items.filter(v => v.status === "Kräver åtgärd").length
          }
        })}
      />
    </div>
  );
}

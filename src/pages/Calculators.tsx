import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { 
  Award, 
  BarChart3, 
  Calculator, 
  CheckCircle, 
  ChevronRight, 
  Compass, 
  FileSpreadsheet, 
  Gauge, 
  GitBranch, 
  LineChart, 
  Percent, 
  Scale, 
  Settings, 
  Shuffle, 
  ShieldAlert,
  HelpCircle,
  TrendingUp,
  Workflow
} from "lucide-react";
import {
  CpCpkCalculator,
  DPMOCalculator,
  FMEACalculator,
  TTestCalculator,
  CorrelationCalculator,
  DOECalculator,
  ControlLimitsCalculator,
  GageRRCalculator,
  TwoSampleTTestCalculator,
  ANOVACalculator,
  ChiSquareCalculator,
  NormalityTestCalculator,
  CapabilitySixpack,
  RolledThroughputYieldCalculator,
  OEECalculator,
  LeanTaktTimeCalculator,
} from "@/components/calculators";

// Category definitions for cleaner workspace management
const CATEGORIES = [
  {
    id: "capability",
    name: "Kapabilitet & Duglighet",
    icon: Gauge,
    description: "Mät processens förmåga att möta toleranser",
    calculators: [
      { id: "cp-cpk", name: "Cp / Cpk-analys", description: "Standard processkapabilitet och centreringsmått (Short-term)", component: CpCpkCalculator },
      { id: "sixpack", name: "Capability Sixpack", description: "Flera kompletterande mätningar inklusive i-grind m.m.", component: CapabilitySixpack },
      { id: "sample-size", name: "Stickprovsstorlek", description: "Beräkna erforderlig samplingstorlek för statistisk signifikans", component: SampleSizeCalculator }
    ]
  },
  {
    id: "quality",
    name: "Kvalitet & Felanalys",
    icon: ShieldAlert,
    description: "Analysera processbortfall och risker",
    calculators: [
      { id: "dpmo", name: "DPMO & Sigma-nivå", description: "Defekter per miljon möjligheter till långsiktig Sigma-skattning", component: DPMOCalculator },
      { id: "rty", name: "Rolled Throughput Yield (RTY)", description: "Samlat utbyte och sårbarhet över flera produktionssteg", component: RolledThroughputYieldCalculator },
      { id: "fmea", name: "FMEA Riskbedömning", description: "Felmods- och feleffektsanalys med Risk Priority Number (RPN)", component: FMEACalculator }
    ]
  },
  {
    id: "hypothesis",
    name: "Hypotesprövning & Statistik",
    icon: Scale,
    description: "Statistiska bevis och analys",
    calculators: [
      { id: "normality", name: "Normalfördelningstest", description: "Utvärdera om fördelningen av mätdata följer normalfördelningskurvan", component: NormalityTestCalculator },
      { id: "t-test-1", name: "Enkelt T-test (1-sample)", description: "Jämför medelvärdet av mätdata mot ett specifikt målvärde", component: TTestCalculator },
      { id: "t-test-2", name: "Parat T-test (2-sample)", description: "Jämför medelvärden mellan två oparade grupper eller förändring", component: TwoSampleTTestCalculator },
      { id: "anova", name: "Variansanalys (ANOVA)", description: "Analysera skillnader mellan medelvärden i 3 eller fler grupper", component: ANOVACalculator },
      { id: "chi-square", name: "Chi-två Analys", description: "Testa oberoende och samvariation för kvalitativa attributdata", component: ChiSquareCalculator },
      { id: "correlation", name: "Korrelation & Regression", description: "Linjära beroenden mellan in- och utvariabler (Scatter)", component: CorrelationCalculator }
    ]
  },
  {
    id: "spc",
    name: "Styrdiagram & MSA",
    icon: LineChart,
    description: "Säkra stabila mätningar och processer",
    calculators: [
      { id: "grr", name: "Gage R&R (MSA)", description: "Mätonoggrannhet, repeterbarhet och reproducerbarhet", component: GageRRCalculator },
      { id: "control-limits", name: "Styrgränser (SPC)", description: "Statistisk processtyrning för Xbar-R, Xbar-S, I-MR och attribut", component: ControlLimitsCalculator }
    ]
  },
  {
    id: "lean",
    name: "Lean & Försöksplanering",
    icon: Workflow,
    description: "Optimera flöden och experimentera",
    calculators: [
      { id: "oee", name: "OEE-kalkylator", description: "Övergripande utrustningseffektivitet (Tillgänglighet × Prestanda × Kvalitet)", component: OEECalculator },
      { id: "takt", name: "Takt- & Cykeltid", description: "Balansera processhastigheten mot kundens efterfrågan", component: LeanTaktTimeCalculator },
      { id: "doe", name: "Försöksplanering (DOE)", description: "Generera och beräkna fullt 2-nivåers faktorförsök för optimering", component: DOECalculator }
    ]
  }
];

export default function Calculators() {
  const [selectedCategory, setSelectedCategory] = useState("capability");
  const [selectedCalc, setSelectedCalc] = useState("cp-cpk");

  const currentCategory = CATEGORIES.find(c => c.id === selectedCategory) || CATEGORIES[0];
  const activeCalculatorObj = currentCategory.calculators.find(c => c.id === selectedCalc) || currentCategory.calculators[0];
  const ActiveCalculatorComponent = activeCalculatorObj?.component;

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    const cat = CATEGORIES.find(c => c.id === categoryId);
    if (cat && cat.calculators.length > 0) {
      setSelectedCalc(cat.calculators[0].id);
    }
  };

  return (
    <Layout>
      <section className="py-8 bg-muted/20 min-h-screen">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto space-y-6">
            
            {/* Header section with deep design styling */}
            <div className="bg-background border border-primary/5 rounded-2xl p-8 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
              <div className="absolute right-0 top-0 h-40 w-40 bg-primary/2.5 rounded-full blur-3xl" />
              <div className="space-y-1.5 max-w-2xl">
                <div className="inline-flex items-center gap-1 bg-primary/10 border border-primary/20 text-primary px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
                  <Award className="h-3.5 w-3.5" /> Metodikverktyg & Statistik
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight">Statistiska Six Sigma Kalkylatorer</h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  En samling av professionella metrologiska, matematiska och processinriktade beräkningsverktyg som används inom DMAIC och Lean Six Sigma.
                </p>
              </div>
            </div>

            {/* Layout layout with Sidebar/Main area */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
              
              {/* Category sidebar selector */}
              <div className="space-y-3 col-span-1 lg:col-span-1">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-2 mb-1">
                  Kategorier
                </div>
                {CATEGORIES.map((cat) => {
                  const CatIcon = cat.icon;
                  const isSelected = selectedCategory === cat.id;

                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleCategorySelect(cat.id)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 flex items-start gap-3 shadow-3xs ${
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground font-medium"
                          : "bg-background border-primary/5 hover:border-primary/20 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg ${isSelected ? "bg-white/15" : "bg-muted text-primary"}`}>
                        <CatIcon className="h-4 w-4" />
                      </div>
                      <div className="space-y-0.5 overflow-hidden">
                        <div className={`text-sm font-semibold truncate ${isSelected ? "text-white" : "text-foreground"}`}>
                          {cat.name}
                        </div>
                        <div className={`text-[10px] line-clamp-1 leading-normal ${isSelected ? "text-white/80" : "text-muted-foreground"}`}>
                          {cat.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Main calculator panel */}
              <div className="col-span-1 lg:col-span-3 space-y-4">
                
                {/* Specific calculator tabs switcher inside the category */}
                <div className="bg-background rounded-xl p-2 border border-primary/5 shadow-3xs flex flex-wrap gap-1.5">
                  {currentCategory.calculators.map((calc) => {
                    const isActive = selectedCalc === calc.id;
                    return (
                      <button
                        key={calc.id}
                        onClick={() => setSelectedCalc(calc.id)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                          isActive
                            ? "bg-muted text-foreground ring-1 ring-primary/20"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        }`}
                      >
                        {calc.name}
                      </button>
                    );
                  })}
                </div>

                {/* Actual Active Calculator viewport with rich card container */}
                <Card className="border border-primary/10 overflow-hidden shadow-sm">
                  <header className="px-6 py-4 border-b border-primary/5 bg-background relative">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Calculator className="h-4 w-4 text-primary" />
                        <CardTitle className="text-xl font-bold">{activeCalculatorObj?.name}</CardTitle>
                      </div>
                      <CardDescription className="text-sm">
                        {activeCalculatorObj?.description}
                      </CardDescription>
                    </div>
                  </header>
                  <CardContent className="p-6 bg-background">
                    {ActiveCalculatorComponent ? (
                      <ActiveCalculatorComponent />
                    ) : (
                      <div className="py-12 text-center text-muted-foreground text-sm">
                        Kalkylatorn laddas...
                      </div>
                    )}
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

// Custom localized sample size calculator so it maintains full Sweden style integration
function SampleSizeCalculator() {
  const [confidence, setConfidence] = useState("95");
  const [margin, setMargin] = useState("");
  const [population, setPopulation] = useState("");
  const [result, setResult] = useState<number | null>(null);

  const calculate = () => {
    const conf = parseFloat(confidence);
    const e = parseFloat(margin) / 100;
    const N = parseFloat(population);

    if (isNaN(conf) || isNaN(e) || e === 0) return;

    let z = 1.96; // 95%
    if (conf === 90) z = 1.645;
    if (conf === 99) z = 2.576;

    const p = 0.5; // p = 0.5 for maximum required sample size

    let n = (z * z * p * (1 - p)) / (e * e);

    if (!isNaN(N) && N > 0) {
      n = n / (1 + (n - 1) / N);
    }

    setResult(Math.ceil(n));
  };

  return (
    <div className="space-y-4">
      <div className="bg-muted/10 p-4 border border-primary/5 rounded-xl text-sm text-muted-foreground leading-normal">
        💡 Beräkna hur många mätpunkter (enheter) du måste mäta för att få tillräcklig representativitet mätmässigt med önskat konfidensintervall.
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="confidence">Konfidensnivå (%)</Label>
          <select
            id="confidence"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={confidence}
            onChange={(e) => setConfidence(e.target.value)}
          >
            <option value="90">90%</option>
            <option value="95">95%</option>
            <option value="99">99%</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="margin">Tillåten felmarginal (%)</Label>
          <div className="relative">
            <Input
              id="margin"
              type="number"
              placeholder="Ex. 5"
              value={margin}
              onChange={(e) => setMargin(e.target.value)}
              className="pr-6"
            />
            <span className="absolute right-2.5 top-2.5 text-xs text-muted-foreground font-medium">%</span>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="population">Populationsstorlek (valfritt)</Label>
          <Input
            id="population"
            type="number"
            placeholder="Oändlig population"
            value={population}
            onChange={(e) => setPopulation(e.target.value)}
          />
        </div>
      </div>
      <Button onClick={calculate} size="lg" className="w-full">Beräkna Stickprovsstorlek</Button>

      {result && (
        <div className="mt-4 p-6 bg-gradient-to-br from-primary/5 to-muted/30 rounded-xl text-center border">
          <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1">
            Minsta erforderliga stickprovsstorlek:
          </div>
          <div className="text-4xl font-extrabold text-primary mb-1">
            {result.toLocaleString()} st
          </div>
          <p className="text-xs text-muted-foreground">
            enheter eller transaktioner måste slumpvis väljas och mätas för statistisk giltighet.
          </p>
        </div>
      )}
    </div>
  );
}

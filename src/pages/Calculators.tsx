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

interface HelpDoc {
  what: string;
  when: string;
  formula: string;
  interpretation: string[];
}

const CALCULATOR_HELP_DOCS: Record<string, HelpDoc> = {
  "cp-cpk": {
    what: "Cp och Cpk är duglighetsindex som mäter en process förmåga att producera enheter inom kundens toleransgränser (övre och undre specifikationsgräns, USL/LSL).",
    when: "Mätfasen (Measure) & Analysfasen (Analyze) för att mäta nuläget, samt i Styrfasen (Control) för att övervaka och säkerställa stabil duglighet.",
    formula: "• Cp (Potentiell duglighet) = (USL - LSL) / (6 * σ)\n• Cpk (Reell duglighet) = Min((USL - μ) / (3 * σ), (μ - LSL) / (3 * σ))\ndär μ är medelvärdet och σ är standardavvikelsen.",
    interpretation: [
      "Cp/Cpk >= 1.33: Processen är duglig (tillräckligt utrymme för normal variation).",
      "Cp/Cpk >= 1.67: Processen har utmärkt duglighet (mycket låg risk för defekter).",
      "Cpk < 1.00: Processen är inte duglig. Det produceras defekter utanför toleransgränserna.",
      "Skillnaden mellan Cp och Cpk visar hur väl centrerad processen är. Om Cp är högt men Cpk är lågt, beror duglighetsproblemet på felaktig centrering, inte på för stor variation."
    ]
  },
  "sixpack": {
    what: "Capability Sixpack är ett sammansatt verktyg som kombinerar sex olika analyser för att bedöma om processen är i statistisk kontroll och följer normalfördelningen innan man litar på Cp/Cpk-indexen.",
    when: "Analysfasen (Analyze). Du bör alltid köra ett Sixpack innan du presenterar duglighetsindex, eftersom ett instabilt eller icke-normalfördelat flöde ger helt felaktiga Cp/Cpk-värden.",
    formula: "Kombinerar mätningar av:\n1. Tidsseriestabilitet (I-diagram / Medelvärde)\n2. Spridningsstabilitet (MR-diagram / R-diagram)\n3. Kumulativ Standardavvikelse för stabilitet\n4. Histogram med toleranslinjer\n5. Normalfördelningsplot (Q-Q plot)\n6. Duglighetsöversikt (kortsiktig Cp/Cpk vs långsiktig Pp/Ppk)",
    interpretation: [
      "Om punkter ligger utanför styrgränserna i I-diagrammet är processen instabil. Cp/Cpk-mätningen är då missvisande.",
      "Om normalfördelningsplotten (Q-Q) visar markant krökta linjer eller p-värde < 0.05 är data inte normalfördelade.",
      "Detta verktyg ger dig den ultimata tryggheten i att dina processberäkningar stämmer med verkligheten."
    ]
  },
  "sample-size": {
    what: "Beräknar det minsta antal enheter (stickprov) du måste mäta eller testa för att kunna dra pålitliga, statistiskt signifikanta slutsatser om hela populationen.",
    when: "Mätfasen (Measure) inför insamling av mätdata, samt i Förbättringsfasen (Improve) vid planering av tester.",
    formula: "• n = (Z_α/2 * σ / E)²\ndär Z_α/2 är konfidenskoefficienten (t.ex. 1.96 för 95%), σ är processens standardavvikelse, och E är den maximalt tillåtna felmarginalen.",
    interpretation: [
      "Ju mindre felmarginal (högre precision) du kräver, desto fler prover måste tas.",
      "Ju större variation (standardavvikelse) processen har, desto större stickprov behövs.",
      "Att mäta för få enheter ökar risken att missa verkliga problem (typ II-fel), medan att mäta för många innebär onödigt resurs- och tidsspill."
    ]
  },
  "dpmo": {
    what: "DPMO (Defects Per Million Opportunities) mäter hur många fel som uppstår per miljon möjligheter. Detta översätts direkt till en process-Sigma-nivå.",
    when: "Mätfasen (Measure) för att sätta en tydlig baslinje (DPMO-nuläge), samt i Styrfasen (Control) för att redovisa förbättringen.",
    formula: "• DPMO = (1 000 000 * Defekter) / (Producerade enheter * Möjligheter per enhet)\n• Sigma-nivå = Excel-koppling: NORMSINV(1 - (DPMO / 1 000 000)) + 1.5 (den klassiska 1.5-Sigma förskjutningen).",
    interpretation: [
      "6 Sigma = 3.4 DPMO (Världsklass, nästintill felfri produktion).",
      "4 Sigma = 6 210 DPMO (Normal industrinivå för genomsnittliga processer).",
      "2 Sigma = 308 537 DPMO (Hög felprocent, kräver akut prioritering).",
      "Detta mått är perfekt för attributdata (t.ex. felaktiga fakturor, repor på detaljer) där det är svårt mätts i millimetrar eller sekunder."
    ]
  },
  "rty": {
    what: "Rolled Throughput Yield (RTY) visar det totala kvalitetsutbytet för en hel processkedja i flera steg. Det speglar risken för fel och omarbete genom hela flödet.",
    when: "Mätfasen (Measure) och Analysfasen (Analyze) för att synliggöra 'den dolda fabriken' (dvs omarbete som görs men inte alltid syns i slutbesiktningen).",
    formula: "• RTY = Yield_Steg_1 * Yield_Steg_2 * ... * Yield_Steg_N\ndär Yield för varje steg är: (Inmatat antal - Kassationer och omarbeten) / Inmatat antal.",
    interpretation: [
      "Att enbart titta på slutbesiktningens utbyte är missvisande om enheterna har omarbetats flera gånger längs vägen.",
      "Exempel: Om en process har 5 steg och varje steg har 95% utbyte, är RTY bara: 0.95 * 0.95 * 0.95 * 0.95 * 0.95 = 77.4%. En fjärdedel av alla produkter kräver alltså spill eller omarbete!",
      "Målet är att höja RTY genom att åtgärda felen vid källan direkt."
    ]
  },
  "fmea": {
    what: "FMEA (Failure Mode and Effects Analysis) är en systematisk riskbedömning där man rangordnar potentiella feltyper utifrån Allvarlighet, Sannolikhet och Upptäckbarhet.",
    when: "Analysfasen (Analyze) för att peka ut var i processen riskerna är som störst, eller i Improve-fasen för att förebygga fel i en ny design.",
    formula: "• RPN (Risk Priority Number) = Allvarlighet (S) * Sannolikhet (O) * Upptäckbarhet (D)\nVarje faktor poängsätts på en skala från 1 till 10.",
    interpretation: [
      "RPN-värdet kan variera mellan 1 och 1000.",
      "Allvarlighetsgrad (S): Hur hårt drabbas kunden? (10 = katastrofalt, 1 = ingen märkbar effekt).",
      "Sannolikhet (O): Hur ofta inträffar felet? (10 = nästan säkert, 1 = extremt sällsynt).",
      "Upptäckbarhet (D): Hur lätt upptäcks felet innan leverans? (10 = omöjligt att upptäcka, 1 = upptäcks alltid).",
      "Åtgärder bör sättas in för feltyper med högst RPN (ofta >120) eller där Allvarlighetsgraden är kritisk (S >= 8)."
    ]
  },
  "normality": {
    what: "Normalfördelningstestet utvärderar statistiskt om fördelningen av dina insamlade mätdata liknar en normalfördelning (klockkurva).",
    when: "Analysfasen (Analyze). Detta är ett obligatoriskt steg innan du väljer testmetod, eftersom parametriska tester (som t-test och ANOVA) förutsätter normalfördelning.",
    formula: "Metoden bygger på hypotesprövning där:\n• Nollhypotes (H0): Data är normalfördelade.\n• Alternativhypotes (H1): Data följer inte en normalfördelning.",
    interpretation: [
      "p-värde >= 0.05: Nollhypotesen bevaras. Du kan anta att dina data är normalfördelade och använda vanliga parametriska tester.",
      "p-värde < 0.05: Data avviker på ett statistiskt säkerställt sätt från normalfördelningen. Du bör använda icke-parametriska tester (t.ex. Mann-Whitney) eller transformera dina data.",
      "Observera även Q-Q plotten: Om mätpunkterna ligger samlade längs den diagonala linjen tyder det på god normalfördelning."
    ]
  },
  "t-test-1": {
    what: "Ett jämställt T-test (1-sample t-test) jämför medelvärdet av dina mätdata mot ett känt, fast referensvärde eller målvärde för att se om skillnaden är slumpmässig.",
    when: "Analysfasen (Analyze) för att verifiera om din process faktiskt uppfyller ett kravmått eller ritningsmått.",
    formula: "• t = (μ_stickprov - μ_mål) / (s / √n)\ndär μ_stickprov är medelvärdet, μ_mål är målet, s är standardavvikelsen och n är antal prover.",
    interpretation: [
      "p-värde < 0.05: Det finns en statistiskt säkerställd (signifikant) skillnad mellan processens medelvärde och målet.",
      "p-värde >= 0.05: Skillnaden är så liten att den kan förklaras av naturlig slumpmässig variation. Processen anses hålla måttet.",
      "Konfidensintervallet visar inom vilket intervall det sanna medelvärdet ligger med t.ex. 95% sannolikhet."
    ]
  },
  "t-test-2": {
    what: "Två-provs T-test (2-sample t-test) jämför medelvärdena mellan två helt oberoende grupper (t.ex. maskin A vs maskin B, eller före- vs efter-mätningar).",
    when: "Analysfasen (Analyze) för att hitta rotorsaker, eller i Förbättringsfasen (Improve) för att bevisa effekten av en genomförd åtgärd.",
    formula: "• t = (μ1 - μ2) / √(s1²/n1 + s2²/n2)\ndär μ, s och n anger medelvärde, standardavvikelse och antal för respektive grupp.",
    interpretation: [
      "p-värde < 0.05: Grupperna skiljer sig åt på ett statistiskt säkerställt sätt. Åtgärden har gett en bevisad effekt!",
      "p-värde >= 0.05: Det finns ingen påvisbar skillnad mellan gruppernas medmedelvärden. Skillnaderna kan bero på ren slump.",
      "Denna beräkning kallas även parat t-test om samma enheter mäts före och efter en förändring."
    ]
  },
  "anova": {
    what: "ANOVA (Analysis of Variance/Variansanalys) jämför medelvärdena för tre eller fler grupper samtidigt för att avgöra om minst en grupp avviker statistiskt.",
    when: "Analysfasen (Analyze) för att testa om olika skift, råmaterialleverantörer, maskiner eller veckodagar ger olika kvalitetsresultat.",
    formula: "Jämför variationen *mellan* grupperna (MSTR) med variationen *inom* grupperna (MSE) genom ett F-test:\n• F = MSTR / MSE",
    interpretation: [
      "p-värde < 0.05: Minst en av grupperna har ett medelvärde som skiljer sig signifikant från de andra. Det finns en påverkande faktor!",
      "p-värde >= 0.05: Inga signifikanta skillnader kunde påvisas. Alla grupper presterar likvärdigt.",
      "Når ANOVA visar ett p-värde < 0.05 gör man ofta en 'Tukey post-hoc' eller boxplot-analys för att fastställa exakt vilken grupp som avviker."
    ]
  },
  "chi-square": {
    what: "Chi-två Analys (Chi-Square) prövar om det finns ett beroende eller samband mellan två kvalitativa/kategoriska faktorer (t.ex. typ av fel och vilket skift det uppstod på).",
    when: "Analysfasen (Analyze) för att analysera attributdata och mönster i felrapporter.",
    formula: "• χ² = Σ ((Observerat - Förväntat)² / Förväntat)\ndär Observerat är ditt faktiska utfall och Förväntat är utfallet om faktorerna vore helt oberoende.",
    interpretation: [
      "p-värde < 0.05: Det finns ett statistiskt säkerställt beroende. Feltyperna fördelar sig inte slumpmässigt över skiften (och därmed finns en rotorsak!).",
      "p-värde >= 0.05: Faktorerna är oberoende av varandra. Det finns inget mönster som tyder på koppling.",
      "Otroligt användbart för att analysera kundklagomål, garantispill och okulära besiktningsdata."
    ]
  },
  "correlation": {
    what: "Korrelation mäter styrkan på det linjära sambandet mellan en insignal (X) och en utsignal (Y). Regressionsanalys ger en matematisk formel för att förutsäga Y baserat på X.",
    when: "Analysfasen (Analyze) för att förstå hur en processtemperatur, hastighet eller tryck påverkar kvalitetsegenskapen hos slutprodukten.",
    formula: "• Korrelationskoefficient (r): Ligger mellan -1 och +1.\n• Regressionslinje: Y = a + bX, där a är interceptet och b är lutningen.",
    interpretation: [
      "r = +1.0 eller -1.0: Perfekt linjärt samband.",
      "r runt 0.0: Inget linjärt förhållande överhuvudtaget.",
      "Förklaringsgrad (R²): Visar hur stor del av variationen i Y som kan förklaras av variationen i X. Ett R² på 0.80 betyder att 80% av variationen är förklarad av insignalen."
    ]
  },
  "grr": {
    what: "Gage R&R (Gauge Repeatability and Reproducibility) är en mätstationsanalys (MSA) som utvärderar repeterbarhet (utrustningens mätvariation) och reproducerbarhet (operatörernas mätvariation).",
    when: "Mätfasen (Measure). Du måste alltid genomföra ett Gage R&R innan du samlar in data för din analys, för att säkerställa att du mäter rätt saker med tillräcklig precision.",
    formula: "Delar upp den totala mätvariationen i:\n• Repeatability (EV): Variation från utrustningen (samma operatör mäter samma detalj).\n• Reproducibility (AV): Variation från operatörerna (olika operatörer mäter samma detalj).",
    interpretation: [
      "GRR-procent < 10%: Mätsystemet är utmärkt och fullt dugligt.",
      "GRR-procent 10% - 30%: Acceptabelt beroende på hur kritiskt måttet är samt kostnaden för instrumentet.",
      "GRR-procent > 30%: Mätsystemet är helt odugligt! Data som samlas in kommer till för stor del att bestå av mätbrus istället för verkliga processvärden. Kalibrera instrumentet eller utbilda personalen."
    ]
  },
  "control-limits": {
    what: "Styrgränser (SPC - Statistical Process Control) beräknar de statistiskt grundade larmgränserna UCL (övre) och LCL (undre) för en process i mätteknisk balans.",
    when: "Styrfasen (Control) för att sätta upp kontrollkort för att upptäcka när en process drar iväg innan det hinner bli faktiska kassationer.",
    formula: "Gränserna sätts normalt 3 standardavvikelser ifrån medelvärdet (3 Sigma):\n• UCL = Medelvärde + 3 * σ\n• LCL = Medelvärde - 3 * σ\n(σ beräknas ofta med approximationsfaktorer utifrån mätseriens spridning).",
    interpretation: [
      "Styrgränser (UCL/LCL) representerar processens naturliga röst (vad processen kan leverera). De ska ALDRIG förväxlas med kundens toleransgränser (ritningen)!",
      "Varje punkt utanför styrgränserna är ett statistiskt larm om att något har förändrats (Special Cause variation). Processen måste då undersökas."
    ]
  },
  "oee": {
    what: "OEE (Overall Equipment Effectiveness / Övergripande utrustningseffektivitet) är en nyckelindikator inom Lean som mäter hur effektivt en maskin eller lina utnyttjas.",
    when: "Mätfasen (Measure) för att få en tydlig nulägesbild över utrustning, samt i Förbättringsfasen (Improve) för att följa upp effektivitetsökningar.",
    formula: "• OEE (%) = Tillgänglighetsgrad * Prestandagrad * Kvalitetsgrad\n• Tillgänglighet = Drifttid / Planerad tid\n• Prestanda = Faktisk produktionstakt / Teoretiskt max\n• Kvalitet = Godkända enheter / Producerade enheter",
    interpretation: [
      "Varje faktor belyser en typ av förlust: stopptider (Tillgänglighet), sänkt hastighet (Prestanda) och kassation/omarbeten (Kvalitet).",
      "OEE = 60%: Mycket vanligt industrisnitt.",
      "OEE >= 85%: Anses vara i absolut världsklass för traditionell industriproduktion."
    ]
  },
  "takt": {
    what: "Takt Time (Kundtakt) beskriver i vilket tidstempo som kunden köper din produkt. Processen måste anpassas för att leverera i samma tempo.",
    when: "Förbättringsfasen (Improve) vid balansering av produktionslinor, resurshattering och kapacitetsplanering i Lean-projekt.",
    formula: "• Kundtakt = Tillgänglig produktionstid (sek) / Kundens efterfrågan (antal enheter per dag)\n• Planerad cykeltid (Target C/T) = Kundtakt * Driftfaktor (t.ex. 90% för att tåla mindre störningar).",
    interpretation: [
      "Om din process cykeltid (C/T) är längre än kundtakten (Takt Time) kommer du att missa leveranserna.",
      "Om din cykeltid är extremt mycket kortare än kundtakten skapas risk för överproduktion och onödiga lageruppbyggnader.",
      "Målet är att synkronisera processens flaskhals så jag den ligger strax under kundtakten."
    ]
  },
  "doe": {
    what: "DOE (Design of Experiments / Försöksplanering) är en metodik för att planera experiment, där man systematiskt varierar flera faktorer (t.ex. temperatur och tryck) samtidigt för att finna den optimala inställningen.",
    when: "Förbättringsfasen (Improve) för att ställa in komplexa processer och minimera variation med minimalt antal testkörningar.",
    formula: "Bygger på en tillförlitlig helt faktoriell experimentmatris (ytor i 2^k dimensioner). Resultaten matas in i regressionsmodeller för att beräkna huvudeffekter och interaktionseffekter.",
    interpretation: [
      "Visar exakt hur mycket varje faktor påverkar utsignalen (Y).",
      "Visar interaktioner, det vill säga om effekten av temperatur beror på vilket tryck som är inställt. Detta missar man helt om man bara testar en sak i taget (OFAT).",
      "Ger en prediktionsformel som låter dig simulera och optimera dina processinställningar direkt."
    ]
  }
};

export default function Calculators() {
  const [selectedCategory, setSelectedCategory] = useState("capability");
  const [selectedCalc, setSelectedCalc] = useState("cp-cpk");
  const [showHelp, setShowHelp] = useState(false);

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
              <div className="absolute right-0 top-0 h-40 w-40 bg-primary/2.5 rounded-full blur-3xl pointer-events-none" />
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
                        onClick={() => {
                          setSelectedCalc(calc.id);
                          setShowHelp(false);
                        }}
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
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Calculator className="h-4 w-4 text-primary" />
                          <CardTitle className="text-xl font-bold">{activeCalculatorObj?.name}</CardTitle>
                        </div>
                        <CardDescription className="text-sm">
                          {activeCalculatorObj?.description}
                        </CardDescription>
                      </div>

                      <Button
                        variant={showHelp ? "default" : "outline"}
                        size="xs"
                        onClick={() => setShowHelp(!showHelp)}
                        className="flex items-center gap-1 w-full md:w-auto md:px-3 py-1.5 text-xs font-medium cursor-pointer shrink-0 transition-all"
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                        {showHelp ? "Dölj guide" : "Förklara uträkningen & verktyget"}
                      </Button>
                    </div>
                  </header>

                  {/* Expandable beautiful help guide in premium swedish DMAIC tone */}
                  {showHelp && activeCalculatorObj && (
                    <div className="mx-6 mt-4 p-5 bg-primary/2 rounded-xl border border-primary/10 space-y-4 animate-in fade-in duration-200">
                      <div className="flex items-center gap-2 font-bold text-xs text-primary uppercase tracking-wider border-b border-primary/5 pb-2">
                        <HelpCircle className="h-4 w-4 text-primary animate-pulse" />
                        <span>Professionell vägledning: {activeCalculatorObj.name}</span>
                      </div>
                      
                      {CALCULATOR_HELP_DOCS[activeCalculatorObj.id] ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
                          <div className="space-y-3.5">
                            <div>
                              <h4 className="font-bold text-xs text-foreground mb-1">Vad är detta?</h4>
                              <p className="text-muted-foreground text-xs leading-relaxed">
                                {CALCULATOR_HELP_DOCS[activeCalculatorObj.id].what}
                              </p>
                            </div>
                            <div>
                              <h4 className="font-bold text-xs text-foreground mb-1">När används det under DMAIC?</h4>
                              <p className="text-muted-foreground text-xs leading-relaxed">
                                {CALCULATOR_HELP_DOCS[activeCalculatorObj.id].when}
                              </p>
                            </div>
                            <div>
                              <h4 className="font-bold text-xs text-foreground mb-1">Hur tolkar man resultatet?</h4>
                              <ul className="list-disc pl-4 space-y-1 text-xs text-muted-foreground">
                                {CALCULATOR_HELP_DOCS[activeCalculatorObj.id].interpretation.map((item, idx) => (
                                  <li key={idx} className="leading-relaxed">{item}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          
                          <div className="bg-muted/30 p-4 rounded-lg border border-primary/5 space-y-3 flex flex-col justify-between">
                            <div>
                              <h4 className="font-bold text-xs text-primary uppercase tracking-wider mb-2">Formel &amp; Beräkningsmodell</h4>
                              <div className="font-mono text-xs text-foreground bg-background p-3.5 rounded border leading-relaxed whitespace-pre-line overflow-x-auto">
                                {CALCULATOR_HELP_DOCS[activeCalculatorObj.id].formula}
                              </div>
                            </div>
                            <div className="text-[10px] text-muted-foreground leading-normal italic pt-2 border-t mt-2">
                              💡 Tips: Alla dina beräkningar kan sparas i projektmappen via loggarna längst ner för löpande spårbarhet.
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Ingen utökad guide tillgänglig för denna kalkylator ännu. Kontakta din Six Sigma Master Black Belt för ytterligare metodstöd.
                        </p>
                      )}
                    </div>
                  )}

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

import { useState, useRef } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";
import { controlChartConstants } from "@/data/dmaic-tools";
import { BarChart3, TrendingUp, Target, AlertTriangle, Download, Info, Sparkles } from "lucide-react";
import { toPng } from "html-to-image";
import { checkWesternElectricRules, WEViolation, ChartDataPoint } from "@/lib/western-electric-rules";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function ControlCharts() {
  // X̄-R Chart State
  const [xbarData, setXbarData] = useState("");
  const [xbarSubgroupSize, setXbarSubgroupSize] = useState(5);
  const [xbarChartData, setXbarChartData] = useState<{ xbar: ChartDataPoint[]; r: ChartDataPoint[] } | null>(null);

  // I-MR Chart State
  const [imrData, setImrData] = useState("");
  const [imrChartData, setImrChartData] = useState<{ i: ChartDataPoint[]; mr: ChartDataPoint[] } | null>(null);

  // p-Chart State
  const [pChartData, setPChartData] = useState("");
  const [pChartSampleSize, setPChartSampleSize] = useState(100);
  const [pChartResult, setPChartResult] = useState<ChartDataPoint[] | null>(null);

  // c-Chart State
  const [cChartData, setCChartData] = useState("");
  const [cChartResult, setCChartResult] = useState<ChartDataPoint[] | null>(null);

  // np-Chart State
  const [npChartData, setNpChartData] = useState("");
  const [npChartSampleSize, setNpChartSampleSize] = useState(100);
  const [npChartResult, setNpChartResult] = useState<ChartDataPoint[] | null>(null);

  // u-Chart State
  const [uChartData, setUChartData] = useState("");
  const [uChartResult, setUChartResult] = useState<ChartDataPoint[] | null>(null);

  // Western Electric violations
  const [weViolations, setWeViolations] = useState<Record<string, WEViolation[]>>({});

  // Chart refs for export
  const chartRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Export chart as PNG
  const exportChart = async (chartId: string, fileName: string) => {
    const element = chartRefs.current[chartId];
    if (!element) return;

    try {
      const dataUrl = await toPng(element, { 
        backgroundColor: 'white',
        quality: 1,
        pixelRatio: 2 
      });
      const link = document.createElement('a');
      link.download = `${fileName}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  // X̄-R Chart Calculation
  const calculateXbarR = (customData?: unknown, customSize?: unknown) => {
    const activeData = typeof customData === "string" ? customData : xbarData;
    const activeSize = typeof customSize === "number" ? customSize : xbarSubgroupSize;
    const rows = activeData.trim().split("\n").filter(r => r.trim());
    if (rows.length < 2) return;

    const subgroups = rows.map(row => 
      row.split(/[,;\s]+/).map(v => parseFloat(v.trim())).filter(v => !isNaN(v))
    );

    const n = activeSize;
    const constants = {
      A2: controlChartConstants.A2[n as keyof typeof controlChartConstants.A2],
      D3: controlChartConstants.D3[n as keyof typeof controlChartConstants.D3],
      D4: controlChartConstants.D4[n as keyof typeof controlChartConstants.D4],
      d2: controlChartConstants.d2[n as keyof typeof controlChartConstants.d2],
    };
    if (constants.A2 === undefined || constants.D3 === undefined || constants.D4 === undefined) return;

    const xbars = subgroups.map(sg => sg.reduce((a, b) => a + b, 0) / sg.length);
    const ranges = subgroups.map(sg => Math.max(...sg) - Math.min(...sg));

    const xbarBar = xbars.reduce((a, b) => a + b, 0) / xbars.length;
    const rBar = ranges.reduce((a, b) => a + b, 0) / ranges.length;

    const xbarUCL = xbarBar + constants.A2 * rBar;
    const xbarLCL = xbarBar - constants.A2 * rBar;
    const rUCL = constants.D4 * rBar;
    const rLCL = constants.D3 * rBar;

    const xbarChartPoints: ChartDataPoint[] = xbars.map((val, i) => ({
      sample: i + 1,
      value: parseFloat(val.toFixed(4)),
      ucl: parseFloat(xbarUCL.toFixed(4)),
      lcl: parseFloat(xbarLCL.toFixed(4)),
      cl: parseFloat(xbarBar.toFixed(4))
    }));

    const rChartPoints: ChartDataPoint[] = ranges.map((val, i) => ({
      sample: i + 1,
      value: parseFloat(val.toFixed(4)),
      ucl: parseFloat(rUCL.toFixed(4)),
      lcl: parseFloat(rLCL.toFixed(4)),
      cl: parseFloat(rBar.toFixed(4))
    }));

    setXbarChartData({ xbar: xbarChartPoints, r: rChartPoints });
    setWeViolations(prev => ({
      ...prev,
      'xbar': checkWesternElectricRules(xbarChartPoints),
      'r': checkWesternElectricRules(rChartPoints)
    }));
  };

  // I-MR Chart Calculation
  const calculateIMR = (customData?: unknown) => {
    const activeData = typeof customData === "string" ? customData : imrData;
    const values = activeData.split(/[,;\s\n]+/).map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
    if (values.length < 2) return;

    const movingRanges: number[] = [];
    for (let i = 1; i < values.length; i++) {
      movingRanges.push(Math.abs(values[i] - values[i - 1]));
    }

    const xBar = values.reduce((a, b) => a + b, 0) / values.length;
    const mrBar = movingRanges.reduce((a, b) => a + b, 0) / movingRanges.length;

    const E2 = 2.66;
    const D4 = 3.267;
    const D3 = 0;

    const iUCL = xBar + E2 * mrBar;
    const iLCL = xBar - E2 * mrBar;
    const mrUCL = D4 * mrBar;
    const mrLCL = D3 * mrBar;

    const iChartPoints: ChartDataPoint[] = values.map((val, i) => ({
      sample: i + 1,
      value: parseFloat(val.toFixed(4)),
      ucl: parseFloat(iUCL.toFixed(4)),
      lcl: parseFloat(iLCL.toFixed(4)),
      cl: parseFloat(xBar.toFixed(4))
    }));

    const mrChartPoints: ChartDataPoint[] = movingRanges.map((val, i) => ({
      sample: i + 2,
      value: parseFloat(val.toFixed(4)),
      ucl: parseFloat(mrUCL.toFixed(4)),
      lcl: parseFloat(mrLCL.toFixed(4)),
      cl: parseFloat(mrBar.toFixed(4))
    }));

    setImrChartData({ i: iChartPoints, mr: mrChartPoints });
    setWeViolations(prev => ({
      ...prev,
      'i': checkWesternElectricRules(iChartPoints),
      'mr': checkWesternElectricRules(mrChartPoints)
    }));
  };

  // p-Chart Calculation
  const calculatePChart = (customData?: unknown, customSize?: unknown) => {
    const activeData = typeof customData === "string" ? customData : pChartData;
    const activeSize = typeof customSize === "number" ? customSize : pChartSampleSize;
    const defects = activeData.split(/[,;\s\n]+/).map(v => parseInt(v.trim())).filter(v => !isNaN(v));
    if (defects.length < 2) return;

    const n = activeSize;
    const proportions = defects.map(d => d / n);
    const pBar = proportions.reduce((a, b) => a + b, 0) / proportions.length;

    const ucl = pBar + 3 * Math.sqrt((pBar * (1 - pBar)) / n);
    const lcl = Math.max(0, pBar - 3 * Math.sqrt((pBar * (1 - pBar)) / n));

    const chartPoints: ChartDataPoint[] = proportions.map((val, i) => ({
      sample: i + 1,
      value: parseFloat(val.toFixed(4)),
      ucl: parseFloat(ucl.toFixed(4)),
      lcl: parseFloat(lcl.toFixed(4)),
      cl: parseFloat(pBar.toFixed(4))
    }));

    setPChartResult(chartPoints);
    setWeViolations(prev => ({ ...prev, 'p': checkWesternElectricRules(chartPoints) }));
  };

  // c-Chart Calculation
  const calculateCChart = (customData?: unknown) => {
    const activeData = typeof customData === "string" ? customData : cChartData;
    const counts = activeData.split(/[,;\s\n]+/).map(v => parseInt(v.trim())).filter(v => !isNaN(v));
    if (counts.length < 2) return;

    const cBar = counts.reduce((a, b) => a + b, 0) / counts.length;
    const ucl = cBar + 3 * Math.sqrt(cBar);
    const lcl = Math.max(0, cBar - 3 * Math.sqrt(cBar));

    const chartPoints: ChartDataPoint[] = counts.map((val, i) => ({
      sample: i + 1,
      value: val,
      ucl: parseFloat(ucl.toFixed(4)),
      lcl: parseFloat(lcl.toFixed(4)),
      cl: parseFloat(cBar.toFixed(4))
    }));

    setCChartResult(chartPoints);
    setWeViolations(prev => ({ ...prev, 'c': checkWesternElectricRules(chartPoints) }));
  };

  // np-Chart Calculation
  const calculateNpChart = (customData?: unknown, customSize?: unknown) => {
    const activeData = typeof customData === "string" ? customData : npChartData;
    const activeSize = typeof customSize === "number" ? customSize : npChartSampleSize;
    const defects = activeData.split(/[,;\s\n]+/).map(v => parseInt(v.trim())).filter(v => !isNaN(v));
    if (defects.length < 2) return;

    const n = activeSize;
    const npBar = defects.reduce((a, b) => a + b, 0) / defects.length;
    const pBar = npBar / n;

    const ucl = npBar + 3 * Math.sqrt(npBar * (1 - pBar));
    const lcl = Math.max(0, npBar - 3 * Math.sqrt(npBar * (1 - pBar)));

    const chartPoints: ChartDataPoint[] = defects.map((val, i) => ({
      sample: i + 1,
      value: val,
      ucl: parseFloat(ucl.toFixed(4)),
      lcl: parseFloat(lcl.toFixed(4)),
      cl: parseFloat(npBar.toFixed(4))
    }));

    setNpChartResult(chartPoints);
    setWeViolations(prev => ({ ...prev, 'np': checkWesternElectricRules(chartPoints) }));
  };

  // u-Chart Calculation
  const calculateUChart = (customData?: unknown) => {
    const activeData = typeof customData === "string" ? customData : uChartData;
    // Format: "defects,units" per line or "defects units"
    const rows = activeData.trim().split("\n").filter(r => r.trim());
    if (rows.length < 2) return;

    const data = rows.map(row => {
      const parts = row.split(/[,;\s]+/).map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
      return { defects: parts[0] || 0, units: parts[1] || 1 };
    });

    const totalDefects = data.reduce((a, b) => a + b.defects, 0);
    const totalUnits = data.reduce((a, b) => a + b.units, 0);
    const uBar = totalDefects / totalUnits;

    const chartPoints: ChartDataPoint[] = data.map((d, i) => {
      const u = d.defects / d.units;
      const ucl = uBar + 3 * Math.sqrt(uBar / d.units);
      const lcl = Math.max(0, uBar - 3 * Math.sqrt(uBar / d.units));
      return {
        sample: i + 1,
        value: parseFloat(u.toFixed(4)),
        ucl: parseFloat(ucl.toFixed(4)),
        lcl: parseFloat(lcl.toFixed(4)),
        cl: parseFloat(uBar.toFixed(4))
      };
    });

    setUChartResult(chartPoints);
    setWeViolations(prev => ({ ...prev, 'u': checkWesternElectricRules(chartPoints) }));
  };

  // Scenario Loading Method
  const loadScenario = (
    chartType: "xbar-r" | "i-mr" | "p-chart" | "np-chart" | "c-chart" | "u-chart",
    scenarioType: "stable" | "unstable"
  ) => {
    if (chartType === "xbar-r") {
      let dataStr = "";
      const size = 5;
      if (scenarioType === "stable") {
        dataStr = "10.1, 10.3, 10.2, 10.4, 10.0\n10.2, 10.5, 10.1, 10.3, 10.4\n10.0, 10.2, 10.3, 10.1, 10.2\n10.3, 10.1, 10.4, 10.2, 10.3\n10.1, 10.4, 10.2, 10.0, 10.1\n10.2, 10.3, 10.1, 10.4, 10.2\n10.0, 10.2, 10.3, 10.1, 10.4\n10.4, 10.1, 10.2, 10.3, 10.1";
      } else {
        // unstable / shift
        dataStr = "10.1, 10.3, 10.2, 10.4, 10.0\n10.2, 10.5, 10.1, 10.3, 10.4\n10.0, 10.2, 10.3, 10.1, 10.2\n10.3, 10.1, 10.4, 10.2, 10.3\n11.9, 12.1, 11.8, 12.3, 12.0\n12.2, 12.5, 12.1, 12.4, 12.2\n12.0, 12.3, 12.4, 12.1, 12.5\n12.4, 12.1, 12.2, 12.3, 12.1";
      }
      setXbarData(dataStr);
      setXbarSubgroupSize(size);
      calculateXbarR(dataStr, size);
    } else if (chartType === "i-mr") {
      let dataStr = "";
      if (scenarioType === "stable") {
        dataStr = "10.05, 10.12, 9.98, 10.03, 10.15, 9.92, 10.07, 10.01, 10.11, 9.95, 10.04, 10.08, 9.99, 10.02, 10.14";
      } else {
        dataStr = "10.05, 10.12, 9.98, 10.03, 10.15, 9.92, 10.07, 11.85, 12.10, 10.04, 10.08, 9.99, 10.02, 10.14, 8.21";
      }
      setImrData(dataStr);
      calculateIMR(dataStr);
    } else if (chartType === "p-chart") {
      let dataStr = "";
      const subsetSize = 100;
      if (scenarioType === "stable") {
        dataStr = "2, 3, 1, 4, 2, 3, 2, 1, 3, 2, 4, 1, 2, 3, 2";
      } else {
        dataStr = "2, 1, 3, 2, 4, 1, 2, 12, 14, 15, 3, 2, 1, 2, 3";
      }
      setPChartData(dataStr);
      setPChartSampleSize(subsetSize);
      calculatePChart(dataStr, subsetSize);
    } else if (chartType === "np-chart") {
      let dataStr = "";
      const subsetSize = 150;
      if (scenarioType === "stable") {
        dataStr = "3, 5, 2, 4, 6, 3, 2, 5, 4, 3, 4, 5, 2, 3, 4";
      } else {
        dataStr = "3, 5, 2, 4, 6, 18, 22, 25, 4, 3, 4, 5, 2, 3, 4";
      }
      setNpChartData(dataStr);
      setNpChartSampleSize(subsetSize);
      calculateNpChart(dataStr, subsetSize);
    } else if (chartType === "c-chart") {
      let dataStr = "";
      if (scenarioType === "stable") {
        dataStr = "2, 4, 3, 1, 3, 2, 4, 3, 2, 5, 3, 2, 1, 4, 3";
      } else {
        dataStr = "2, 4, 3, 1, 3, 15, 18, 14, 2, 5, 3, 2, 1, 4, 3";
      }
      setCChartData(dataStr);
      calculateCChart(dataStr);
    } else if (chartType === "u-chart") {
      let dataStr = "";
      if (scenarioType === "stable") {
        dataStr = "4, 1.0\n6, 1.2\n5, 1.0\n3, 0.8\n5, 1.0\n4, 1.0\n6, 1.2\n5, 1.0\n3, 0.8\n5, 1.0";
      } else {
        dataStr = "4, 1.0\n6, 1.2\n15, 1.0\n18, 0.8\n5, 1.0\n4, 1.0\n6, 1.2\n5, 1.0\n3, 0.8\n5, 1.0";
      }
      setUChartData(dataStr);
      calculateUChart(dataStr);
    }
  };

  const renderControlChart = (
    data: ChartDataPoint[], 
    title: string, 
    yLabel: string, 
    chartId: string,
    violations: WEViolation[] = []
  ) => {
    const hasOutOfControl = data.some(d => d.value > d.ucl || d.value < d.lcl);
    const violationPoints = violations.flatMap(v => v.points);
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h4 className="font-semibold">{title}</h4>
          <div className="flex items-center gap-2">
            {hasOutOfControl && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Utom kontroll
              </Badge>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => exportChart(chartId, `${title.replace(/[^a-zA-Z0-9]/g, '_')}`)}
            >
              <Download className="h-4 w-4 mr-1" />
              Exportera
            </Button>
          </div>
        </div>

        <div 
          ref={el => { chartRefs.current[chartId] = el; }}
          className="h-64 bg-background p-2 rounded-lg"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="sample" label={{ value: 'Stickprov', position: 'bottom', offset: -5 }} />
              <YAxis label={{ value: yLabel, angle: -90, position: 'insideLeft' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <ReferenceLine y={data[0]?.ucl} stroke="hsl(var(--destructive))" strokeDasharray="5 5" label="UCL" />
              <ReferenceLine y={data[0]?.cl} stroke="hsl(var(--primary))" strokeDasharray="3 3" label="CL" />
              <ReferenceLine y={data[0]?.lcl} stroke="hsl(var(--destructive))" strokeDasharray="5 5" label="LCL" />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="hsl(var(--accent))" 
                strokeWidth={2}
                dot={(props) => {
                  const { cx, cy, payload, key } = props;
                  const isOutOfControl = payload.value > payload.ucl || payload.value < payload.lcl;
                  const isViolation = violationPoints.includes(payload.sample);
                  const showWarning = isOutOfControl || isViolation;
                  return (
                    <circle 
                      key={key || `dot-${payload.sample}`}
                      cx={cx} 
                      cy={cy} 
                      r={showWarning ? 6 : 4} 
                      fill={isOutOfControl ? 'hsl(var(--destructive))' : isViolation ? 'hsl(38, 92%, 50%)' : 'hsl(var(--accent))'}
                      stroke="white"
                      strokeWidth={2}
                    />
                  );
                }}
                name="Värde"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center p-2 bg-destructive/10 rounded-lg">
            <div className="text-muted-foreground">UCL</div>
            <div className="font-mono font-semibold">{data[0]?.ucl}</div>
          </div>
          <div className="text-center p-2 bg-primary/10 rounded-lg">
            <div className="text-muted-foreground">CL</div>
            <div className="font-mono font-semibold">{data[0]?.cl}</div>
          </div>
          <div className="text-center p-2 bg-destructive/10 rounded-lg">
            <div className="text-muted-foreground">LCL</div>
            <div className="font-mono font-semibold">{data[0]?.lcl}</div>
          </div>
        </div>

        {violations.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full">
                <Info className="h-4 w-4 mr-2" />
                Visa Western Electric-avvikelser ({violations.length})
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="space-y-2">
                {violations.map((v, i) => (
              <Alert key={i} variant="default" className="bg-accent/10 border-accent/30">
                    <AlertTriangle className="h-4 w-4 text-accent" />
                    <AlertTitle className="text-sm">Regel {v.rule}</AlertTitle>
                    <AlertDescription className="text-sm">
                      {v.description}
                      <br />
                      <span className="text-muted-foreground">Punkter: {v.points.join(', ')}</span>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    );
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Styrdiagram (SPC)</h1>
          <p className="text-muted-foreground">
            Interaktiva styrdiagram för Statistical Process Control. Mata in data för att beräkna kontrollgränser och visualisera processens stabilitet.
          </p>
        </div>

        <Tabs defaultValue="xbar-r" className="space-y-6">
          <TabsList className="grid grid-cols-3 md:grid-cols-6 gap-2 h-auto p-2">
            <TabsTrigger value="xbar-r" className="flex items-center gap-2 py-3">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">X̄-R</span>
              <span className="sm:hidden">X̄-R</span>
            </TabsTrigger>
            <TabsTrigger value="i-mr" className="flex items-center gap-2 py-3">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">I-MR</span>
              <span className="sm:hidden">I-MR</span>
            </TabsTrigger>
            <TabsTrigger value="p-chart" className="flex items-center gap-2 py-3">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">p-diagram</span>
              <span className="sm:hidden">p</span>
            </TabsTrigger>
            <TabsTrigger value="np-chart" className="flex items-center gap-2 py-3">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">np-diagram</span>
              <span className="sm:hidden">np</span>
            </TabsTrigger>
            <TabsTrigger value="c-chart" className="flex items-center gap-2 py-3">
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">c-diagram</span>
              <span className="sm:hidden">c</span>
            </TabsTrigger>
            <TabsTrigger value="u-chart" className="flex items-center gap-2 py-3">
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">u-diagram</span>
              <span className="sm:hidden">u</span>
            </TabsTrigger>
          </TabsList>

          {/* X̄-R Chart */}
          <TabsContent value="xbar-r">
            <Card>
              <CardHeader>
                <CardTitle>X̄-R Styrdiagram</CardTitle>
                <CardDescription>
                  Används för kontinuerliga data med delgrupper (2-10 mätningar per grupp). Övervakar både medelvärde och variation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-muted/40 border border-primary/10 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Sparkles className="h-4 w-4 text-amber-500 fill-amber-500" />
                    <span>Ladda testscenarier för X̄-R styrdiagram:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadScenario("xbar-r", "stable")}
                      className="text-xs h-8 bg-background border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-950 dark:text-green-300"
                    >
                      Stabil process (I kontroll)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadScenario("xbar-r", "unstable")}
                      className="text-xs h-8 bg-background border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-950 dark:text-red-300"
                    >
                      Processförskjutning (Specialorsak / Larm)
                    </Button>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Delgruppsstorlek (n)</Label>
                    <Input
                      type="number"
                      min={2}
                      max={10}
                      value={xbarSubgroupSize}
                      onChange={(e) => setXbarSubgroupSize(parseInt(e.target.value) || 5)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Data (en delgrupp per rad, värden separerade med komma eller mellanslag)</Label>
                  <textarea
                    className="w-full h-32 p-3 border rounded-lg bg-background font-mono text-sm"
                    placeholder="10.2, 10.5, 10.3, 10.4, 10.1&#10;10.3, 10.6, 10.2, 10.5, 10.4&#10;10.1, 10.4, 10.5, 10.3, 10.2"
                    value={xbarData}
                    onChange={(e) => setXbarData(e.target.value)}
                  />
                </div>
                <Button onClick={calculateXbarR} className="w-full md:w-auto">
                  Beräkna styrdiagram
                </Button>

                {xbarChartData && (
                  <div className="space-y-8 pt-4 border-t">
                    {renderControlChart(xbarChartData.xbar, "X̄-diagram (Medelvärde)", "X̄", "xbar", weViolations['xbar'])}
                    {renderControlChart(xbarChartData.r, "R-diagram (Variationsvidd)", "R", "r", weViolations['r'])}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* I-MR Chart */}
          <TabsContent value="i-mr">
            <Card>
              <CardHeader>
                <CardTitle>I-MR Styrdiagram (Individuella värden)</CardTitle>
                <CardDescription>
                  Används för kontinuerliga data där endast en mätning görs åt gången. Perfekt för långa cykeltider eller dyra mätningar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-muted/40 border border-primary/10 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Sparkles className="h-4 w-4 text-amber-500 fill-amber-500" />
                    <span>Ladda testscenarier för I-MR styrdiagram:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadScenario("i-mr", "stable")}
                      className="text-xs h-8 bg-background border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-950 dark:text-green-300"
                    >
                      Stabil process (Normalmätningar)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadScenario("i-mr", "unstable")}
                      className="text-xs h-8 bg-background border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-950 dark:text-red-300"
                    >
                      Instabila spikar (Undantag / Larm)
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Data (värden separerade med komma, mellanslag eller radbrytning)</Label>
                  <textarea
                    className="w-full h-32 p-3 border rounded-lg bg-background font-mono text-sm"
                    placeholder="10.2, 10.5, 10.3, 10.4, 10.1, 10.3, 10.6, 10.2"
                    value={imrData}
                    onChange={(e) => setImrData(e.target.value)}
                  />
                </div>
                <Button onClick={calculateIMR} className="w-full md:w-auto">
                  Beräkna styrdiagram
                </Button>

                {imrChartData && (
                  <div className="space-y-8 pt-4 border-t">
                    {renderControlChart(imrChartData.i, "I-diagram (Individuella värden)", "X", "i", weViolations['i'])}
                    {renderControlChart(imrChartData.mr, "MR-diagram (Glidande variationsvidd)", "MR", "mr", weViolations['mr'])}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* p-Chart */}
          <TabsContent value="p-chart">
            <Card>
              <CardHeader>
                <CardTitle>p-diagram (Andel defekta)</CardTitle>
                <CardDescription>
                  Används för attributdata där man räknar andelen defekta enheter i varje stickprov. Stickprovsstorleken är konstant.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-muted/40 border border-primary/10 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Sparkles className="h-4 w-4 text-amber-500 fill-amber-500" />
                    <span>Ladda testscenarier för p-diagram (Andel defekta):</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadScenario("p-chart", "stable")}
                      className="text-xs h-8 bg-background border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-950 dark:text-green-300"
                    >
                      Låg och stabil felandel (~2%)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadScenario("p-chart", "unstable")}
                      className="text-xs h-8 bg-background border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-950 dark:text-red-300"
                    >
                      Plötslig kvalitetsförsämring (Larm)
                    </Button>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Stickprovsstorlek (n)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={pChartSampleSize}
                      onChange={(e) => setPChartSampleSize(parseInt(e.target.value) || 100)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Antal defekta per stickprov (separerade med komma eller radbrytning)</Label>
                  <textarea
                    className="w-full h-32 p-3 border rounded-lg bg-background font-mono text-sm"
                    placeholder="3, 5, 2, 4, 6, 3, 2, 5, 4, 3"
                    value={pChartData}
                    onChange={(e) => setPChartData(e.target.value)}
                  />
                </div>
                <Button onClick={calculatePChart} className="w-full md:w-auto">
                  Beräkna styrdiagram
                </Button>

                {pChartResult && (
                  <div className="space-y-8 pt-4 border-t">
                    {renderControlChart(pChartResult, "p-diagram (Andel defekta)", "p", "p", weViolations['p'])}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* np-Chart */}
          <TabsContent value="np-chart">
            <Card>
              <CardHeader>
                <CardTitle>np-diagram (Antal defekta)</CardTitle>
                <CardDescription>
                  Används för attributdata där man räknar antalet defekta enheter. Stickprovsstorleken är konstant. Skillnad mot p-diagram: visar absoluta tal istället för andelar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-muted/40 border border-primary/10 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Sparkles className="h-4 w-4 text-amber-500 fill-amber-500" />
                    <span>Ladda testscenarier för np-diagram (Antal defekta):</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadScenario("np-chart", "stable")}
                      className="text-xs h-8 bg-background border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-950 dark:text-green-300"
                    >
                      Konstant lågt antal defekta enheter
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadScenario("np-chart", "unstable")}
                      className="text-xs h-8 bg-background border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-950 dark:text-red-300"
                    >
                      Processdrift och onormal spridning (Larm)
                    </Button>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Stickprovsstorlek (n)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={npChartSampleSize}
                      onChange={(e) => setNpChartSampleSize(parseInt(e.target.value) || 100)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Antal defekta per stickprov (separerade med komma eller radbrytning)</Label>
                  <textarea
                    className="w-full h-32 p-3 border rounded-lg bg-background font-mono text-sm"
                    placeholder="3, 5, 2, 4, 6, 3, 2, 5, 4, 3"
                    value={npChartData}
                    onChange={(e) => setNpChartData(e.target.value)}
                  />
                </div>
                <Button onClick={calculateNpChart} className="w-full md:w-auto">
                  Beräkna styrdiagram
                </Button>

                {npChartResult && (
                  <div className="space-y-8 pt-4 border-t">
                    {renderControlChart(npChartResult, "np-diagram (Antal defekta)", "np", "np", weViolations['np'])}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* c-Chart */}
          <TabsContent value="c-chart">
            <Card>
              <CardHeader>
                <CardTitle>c-diagram (Antal fel)</CardTitle>
                <CardDescription>
                  Används för attributdata där man räknar antal fel per enhet. Enheten är konstant (t.ex. fel per produkt, per dag, per m²).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-muted/40 border border-primary/10 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Sparkles className="h-4 w-4 text-amber-500 fill-amber-500" />
                    <span>Ladda testscenarier för c-diagram (Antal fel):</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadScenario("c-chart", "stable")}
                      className="text-xs h-8 bg-background border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-950 dark:text-green-300"
                    >
                      Stabil tillverkningsyta (Få slumpmässiga fel)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadScenario("c-chart", "unstable")}
                      className="text-xs h-8 bg-background border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-950 dark:text-red-300"
                    >
                      Kvalitetssvacka / Skenande antal fel (Larm)
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Antal fel per enhet (separerade med komma eller radbrytning)</Label>
                  <textarea
                    className="w-full h-32 p-3 border rounded-lg bg-background font-mono text-sm"
                    placeholder="3, 5, 2, 4, 6, 3, 2, 5, 4, 3, 7, 2"
                    value={cChartData}
                    onChange={(e) => setCChartData(e.target.value)}
                  />
                </div>
                <Button onClick={calculateCChart} className="w-full md:w-auto">
                  Beräkna styrdiagram
                </Button>

                {cChartResult && (
                  <div className="space-y-8 pt-4 border-t">
                    {renderControlChart(cChartResult, "c-diagram (Antal fel)", "c", "c", weViolations['c'])}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* u-Chart */}
          <TabsContent value="u-chart">
            <Card>
              <CardHeader>
                <CardTitle>u-diagram (Fel per enhet)</CardTitle>
                <CardDescription>
                  Används för attributdata där man räknar fel per enhet och enhetsstorleken varierar. Varje rad: "antal fel, antal enheter".
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-muted/40 border border-primary/10 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Sparkles className="h-4 w-4 text-amber-500 fill-amber-500" />
                    <span>Ladda testscenarier för u-diagram (Fel per enhet):</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadScenario("u-chart", "stable")}
                      className="text-xs h-8 bg-background border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-950 dark:text-green-300"
                    >
                      Varierande batcher (Stabil felkvot per enhet)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadScenario("u-chart", "unstable")}
                      className="text-xs h-8 bg-background border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-950 dark:text-red-300"
                    >
                      Batchproblem (Skenande felkvot / Larm)
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Data (en rad per stickprov: "antal fel, antal enheter")</Label>
                  <textarea
                    className="w-full h-32 p-3 border rounded-lg bg-background font-mono text-sm"
                    placeholder="12, 10&#10;8, 8&#10;15, 12&#10;10, 10&#10;6, 5"
                    value={uChartData}
                    onChange={(e) => setUChartData(e.target.value)}
                  />
                </div>
                <Button onClick={calculateUChart} className="w-full md:w-auto">
                  Beräkna styrdiagram
                </Button>

                {uChartResult && (
                  <div className="space-y-8 pt-4 border-t">
                    {renderControlChart(uChartResult, "u-diagram (Fel per enhet)", "u", "u", weViolations['u'])}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Western Electric Rules Info */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Western Electric-regler
            </CardTitle>
            <CardDescription>
              Regler för att identifiera specialorsaker till variation i styrdiagram
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="p-3 bg-muted rounded-lg">
                  <strong>Regel 1:</strong> En punkt utanför 3σ (kontrollgräns)
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <strong>Regel 2:</strong> 9 punkter i rad på samma sida om centerlinjen
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <strong>Regel 3:</strong> 6 punkter i rad stigande eller fallande
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <strong>Regel 4:</strong> 14 punkter i rad alternerande upp och ner
                </div>
              </div>
              <div className="space-y-2">
                <div className="p-3 bg-muted rounded-lg">
                  <strong>Regel 5:</strong> 2 av 3 punkter utanför 2σ på samma sida
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <strong>Regel 6:</strong> 4 av 5 punkter utanför 1σ på samma sida
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <strong>Regel 7:</strong> 15 punkter i rad inom 1σ (stratifiering)
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <strong>Regel 8:</strong> 8 punkter i rad utanför 1σ (blandning)
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Om styrdiagram</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none text-muted-foreground">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-foreground font-semibold mb-2">Kontinuerliga data</h4>
                <ul className="space-y-1">
                  <li><strong>X̄-R:</strong> Delgrupper med 2-10 mätningar</li>
                  <li><strong>X̄-S:</strong> Delgrupper med &gt;10 mätningar (använder standardavvikelse)</li>
                  <li><strong>I-MR:</strong> Individuella mätningar utan delgrupper</li>
                </ul>
              </div>
              <div>
                <h4 className="text-foreground font-semibold mb-2">Attributdata</h4>
                <ul className="space-y-1">
                  <li><strong>p-diagram:</strong> Andel defekta (konstant n)</li>
                  <li><strong>np-diagram:</strong> Antal defekta (konstant n)</li>
                  <li><strong>c-diagram:</strong> Antal fel per enhet (konstant enhet)</li>
                  <li><strong>u-diagram:</strong> Fel per enhet (variabel enhetsstorlek)</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

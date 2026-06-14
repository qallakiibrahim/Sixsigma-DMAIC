import { useState, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, BarChart2, Eye, TrendingUp, AlertTriangle, CheckCircle, HelpCircle, Download } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
  Legend,
} from "recharts";
import { DataInput } from "./DataInput";
import { useCalculatorSave } from "@/hooks/useCalculatorSave";
import { CalculatorSaveButton } from "./CalculatorSaveButton";
import { CalculatorLoadButton } from "./CalculatorLoadButton";

// Numerical approximations
function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.39894228 * Math.exp((-z * z) / 2);
  let p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  if (z > 0) p = 1 - p;
  return p;
}

function quantileNormal(p: number): number {
  if (p <= 0 || p >= 1) return 0;
  // Rational approximation for inverse normal CDF (Wichura's)
  const t = Math.sqrt(-2 * Math.log(p < 0.5 ? p : 1 - p));
  const c0 = 2.515517;
  const c1 = 0.802853;
  const c2 = 0.010328;
  const d1 = 1.432788;
  const d2 = 0.189269;
  const d3 = 0.001308;
  const z = t - ((c2 * t + c1) * t + c0) / (((d3 * t + d2) * t + d1) * t + 1.0);
  return p < 0.5 ? -z : z;
}

// PDF computation
function normalPDF(x: number, mean: number, stdDev: number): number {
  return (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-Math.pow(x - mean, 2) / (2 * Math.pow(stdDev, 2)));
}

// AD Normality Test
function runADTest(sortedData: number[], mean: number, stdDev: number) {
  const N = sortedData.length;
  if (N < 5 || stdDev === 0) return { AD: 0, pVal: 1 };

  let ADSum = 0;
  for (let i = 0; i < N; i++) {
    const p1 = normalCDF((sortedData[i] - mean) / stdDev);
    const p2 = normalCDF((sortedData[N - 1 - i] - mean) / stdDev);
    // Boundary guards
    const term1 = Math.log(Math.max(1e-15, p1));
    const term2 = Math.log(Math.max(1e-15, 1 - p2));
    ADSum += (2 * (i + 1) - 1) * (term1 + term2);
  }

  const AD = -N - ADSum / N;
  // Adjusted AD statistic
  const AD_adj = AD * (1 + 0.75 / N + 2.25 / (N * N));

  // Approx P-Value for AD test
  let pVal = 0;
  if (AD_adj >= 0.6) {
    pVal = Math.exp(1.2937 - 5.709 * AD_adj + 0.0186 * AD_adj * AD_adj);
  } else if (AD_adj > 0.34) {
    pVal = Math.exp(0.9177 - 4.279 * AD_adj - 1.38 * AD_adj * AD_adj);
  } else if (AD_adj > 0.2) {
    pVal = 1 - Math.exp(-1.29305 + 11.6008 * AD_adj - 38.081 * AD_adj * AD_adj);
  } else {
    pVal = 1 - Math.exp(-4.35823 + 47.9358 * AD_adj - 156.4 * AD_adj * AD_adj);
  }

  // Cap at 0.99 and 0.0001
  pVal = Math.max(0.0001, Math.min(0.999, pVal));
  return { AD, pVal };
}

const DEFAULT_LSL = "9.50";
const DEFAULT_USL = "10.50";
const DEFAULT_TARGET = "10.00";
const DEFAULT_DATA = "10.02, 10.15, 9.88, 9.95, 10.11, 10.08, 9.94, 10.02, 10.23, 9.78, \n10.12, 10.01, 10.18, 9.91, 9.85, 10.14, 10.02, 10.09, 9.97, 10.21, \n10.03, 9.96, 10.10, 10.05, 10.11, 9.82, 10.24, 10.01, 9.89, 10.13";

export function CapabilitySixpack({ toolId = "capability-sixpack", phase = 3 }: { toolId?: string; toolName?: string; phase?: number }) {
  const [dataStr, setDataStr] = useState(DEFAULT_DATA);
  const [lslStr, setLslStr] = useState(DEFAULT_LSL);
  const [uslStr, setUslStr] = useState(DEFAULT_USL);
  const [targetStr, setTargetStr] = useState(DEFAULT_TARGET);
  const [runAnalyis, setRunAnalysis] = useState(false);

  const handleLoad = useCallback((inputs: Record<string, unknown>) => {
    if (inputs.dataStr !== undefined) setDataStr(String(inputs.dataStr));
    if (inputs.lslStr !== undefined) setLslStr(String(inputs.lslStr));
    if (inputs.uslStr !== undefined) setUslStr(String(inputs.uslStr));
    if (inputs.targetStr !== undefined) setTargetStr(String(inputs.targetStr));
    setRunAnalysis(true);
  }, []);

  const { canSave, isSaving, notes, setNotes, saveCalculation, savedCalculation, isLoadingSaved } = useCalculatorSave(toolId, handleLoad);

  const loadScenario = (type: "ideal" | "offset" | "unstable" | "non-normal" | "drift") => {
    switch (type) {
      case "ideal":
        setDataStr("10.02, 10.08, 9.94, 10.02, 10.11, 9.95, 9.88, 10.05, 10.15, 9.91, \n10.03, 9.96, 10.10, 10.05, 10.11, 9.89, 10.13, 10.01, 9.85, 10.14, \n10.02, 10.09, 9.97, 10.21, 10.12, 10.01, 10.18, 9.91, 9.82, 10.09");
        setLslStr("9.50");
        setUslStr("10.50");
        setTargetStr("10.00");
        break;
      case "offset":
        setDataStr("10.22, 10.28, 10.14, 10.22, 10.31, 10.15, 10.08, 10.25, 10.35, 10.11, \n10.23, 10.16, 10.30, 10.25, 10.31, 10.09, 10.33, 10.21, 10.05, 10.34, \n10.22, 10.29, 10.17, 10.41, 10.32, 10.21, 10.38, 10.11, 10.02, 10.29");
        setLslStr("9.50");
        setUslStr("10.50");
        setTargetStr("10.00");
        break;
      case "unstable":
        setDataStr("10.02, 10.12, 9.95, 10.05, 9.88, 10.44, 9.51, 10.02, 10.11, 9.98, \n10.15, 10.02, 10.09, 9.94, 9.87, 10.11, 10.05, 10.13, 9.92, 10.19, \n10.04, 10.15, 10.65, 9.38, 10.03, 10.09, 9.95, 10.11, 10.01, 10.14");
        setLslStr("9.50");
        setUslStr("10.50");
        setTargetStr("10.00");
        break;
      case "non-normal":
        setDataStr("9.55, 9.58, 9.61, 9.62, 9.64, 9.65, 9.67, 9.69, 9.71, 9.74, \n9.78, 9.82, 9.87, 9.93, 10.01, 10.11, 10.24, 10.41, 10.63, 10.92, \n9.56, 9.63, 9.72, 9.81, 9.92, 10.05, 10.21, 10.42, 10.71, 11.15");
        setLslStr("9.50");
        setUslStr("10.80");
        setTargetStr("10.00");
        break;
      case "drift":
        setDataStr("9.62, 9.68, 9.65, 9.73, 9.71, 9.78, 9.75, 9.84, 9.81, 9.89, \n9.86, 9.95, 9.92, 10.01, 9.98, 10.07, 10.04, 10.13, 10.10, 10.19, \n10.16, 10.25, 10.22, 10.31, 10.28, 10.37, 10.34, 10.43, 10.40, 10.49");
        setLslStr("9.50");
        setUslStr("10.50");
        setTargetStr("10.00");
        break;
    }
    setRunAnalysis(true);
  };

  const loadExample = () => {
    loadScenario("ideal");
  };

  const parsedData = useMemo(() => {
    return dataStr
      .split(/[,\s\t;\n\r]+/)
      .map((v) => parseFloat(v.trim()))
      .filter((v) => !isNaN(v));
  }, [dataStr]);

  const analysis = useMemo(() => {
    if (parsedData.length < 3) return null;

    const LSL = parseFloat(lslStr);
    const USL = parseFloat(uslStr);
    const Target = targetStr ? parseFloat(targetStr) : (LSL + USL) / 2;

    if (isNaN(LSL) || isNaN(USL) || LSL >= USL) return null;

    const N = parsedData.length;
    
    // Mean
    const mean = parsedData.reduce((a, b) => a + b, 0) / N;

    // Standard deviation Overall
    const varianceOverall = parsedData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (N - 1);
    const sigmaOverall = Math.sqrt(varianceOverall);

    // Standard deviation Within (using Moving Range estimate: MR_bar / d2 where d2 = 1.128 for subgroup size 2)
    let mrSum = 0;
    const movingRanges: number[] = [];
    for (let i = 1; i < N; i++) {
      const mr = Math.abs(parsedData[i] - parsedData[i - 1]);
      movingRanges.push(mr);
      mrSum += mr;
    }
    const mrBar = mrSum / (N - 1);
    const sigmaWithin = mrBar / 1.128;

    // Capabilities (Within/Potential)
    const cp = (USL - LSL) / (6 * sigmaWithin);
    const cpuWithin = (USL - mean) / (3 * sigmaWithin);
    const cplWithin = (mean - LSL) / (3 * sigmaWithin);
    const cpk = Math.min(cpuWithin, cplWithin);

    // Performance (Overall)
    const pp = (USL - LSL) / (6 * sigmaOverall);
    const cpuOverall = (USL - mean) / (3 * sigmaOverall);
    const cplOverall = (mean - LSL) / (3 * sigmaOverall);
    const ppk = Math.min(cpuOverall, cplOverall);

    // Cpm index (Taguchi Capability index centering target)
    const cpmDenominator = 6 * Math.sqrt(varianceOverall + Math.pow(mean - Target, 2));
    const cpm = cpmDenominator > 0 ? (USL - LSL) / cpmDenominator : 0;

    // PPM / Percent outside specs
    // Observed actual percent out of spec
    const numLSLOut = parsedData.filter((v) => v < LSL).length;
    const numUSLOut = parsedData.filter((v) => v > USL).length;
    const pctLSLOut = (numLSLOut / N) * 100;
    const pctUSLOut = (numUSLOut / N) * 100;
    const pctTotalOut = pctLSLOut + pctUSLOut;

    // Expected Performance Within
    const zLSLWithin = (LSL - mean) / sigmaWithin;
    const zUSLWithin = (USL - mean) / sigmaWithin;
    const expFractionLSLWithin = normalCDF(zLSLWithin);
    const expFractionUSLWithin = 1 - normalCDF(zUSLWithin);
    const expPPM_LSLWithin = expFractionLSLWithin * 1_000_000;
    const expPPM_USLWithin = expFractionUSLWithin * 1_000_000;
    const expPPM_TotalWithin = expPPM_LSLWithin + expPPM_USLWithin;

    // Expected Performance Overall
    const zLSLOverall = (LSL - mean) / sigmaOverall;
    const zUSLOverall = (USL - mean) / sigmaOverall;
    const expFractionLSLOverall = normalCDF(zLSLOverall);
    const expFractionUSLOverall = 1 - normalCDF(zUSLOverall);
    const expPPM_LSLOverall = expFractionLSLOverall * 1_000_000;
    const expPPM_USLOverall = expFractionUSLOverall * 1_000_000;
    const expPPM_TotalOverall = expPPM_LSLOverall + expPPM_USLOverall;

    // I-Chart Control Limits
    const uclI = mean + 2.66 * mrBar;
    const lclI = mean - 2.66 * mrBar;

    const iChartData = parsedData.map((val, idx) => {
      const isOut = val > uclI || val < lclI;
      return {
        id: idx + 1,
        value: val,
        mean: parseFloat(mean.toFixed(4)),
        ucl: parseFloat(uclI.toFixed(4)),
        lcl: parseFloat(lclI.toFixed(4)),
        isOut,
      };
    });

    // MR-Chart Control Limits
    const uclMR = 3.267 * mrBar;
    const lclMR = 0; // standard lcl is 0 for subgroup 2

    const mrChartData = movingRanges.map((val, idx) => {
      const isOut = val > uclMR;
      return {
        id: idx + 2,
        value: val,
        mean: parseFloat(mrBar.toFixed(4)),
        ucl: parseFloat(uclMR.toFixed(4)),
        lcl: parseFloat(lclMR.toFixed(4)),
        isOut,
      };
    });

    // Normal probability plot (Q-Q plot)
    const sortedVals = [...parsedData].sort((a, b) => a - b);
    const qqData = sortedVals.map((val, idx) => {
      const p = (idx + 1 - 0.375) / (N + 0.25); // Blom plotting position
      const zScore = quantileNormal(p);
      const expectedNormal = mean + zScore * sigmaOverall;
      return {
        z: zScore,
        observedValue: val,
        expectedNormal: expectedNormal,
        percent: p * 100,
      };
    });

    // Anderson-Darling test
    const { AD, pVal } = runADTest(sortedVals, mean, sigmaOverall);

    // Histogram calculations
    const minVal = Math.min(...parsedData);
    const maxVal = Math.max(...parsedData);
    const valRange = maxVal - minVal;
    
    // Choose nice bins (typically 8 to 12)
    const binCount = Math.max(6, Math.min(12, Math.ceil(Math.sqrt(N))));
    const binWidth = valRange > 0 ? valRange / binCount : 0.1;
    const startVal = minVal - binWidth / 2;

    const bins = Array.from({ length: binCount + 2 }).map((_, i) => {
      const bMin = startVal + (i - 1) * binWidth;
      const bMax = bMin + binWidth;
      const bMid = bMin + binWidth / 2;
      return {
        mid: parseFloat(bMid.toFixed(4)),
        min: bMin,
        max: bMax,
        count: 0,
      };
    });

    parsedData.forEach((val) => {
      for (const bin of bins) {
        if (val >= bin.min && val < bin.max) {
          bin.count++;
          break;
        }
      }
    });

    // Generate normal curve values overlaid on histogram midpoints
    // Curve height is scaled so that visual area is proportional
    // f(x) * N * binWidth gives the expected frequency count in a bin
    const histogramData = bins.map((bin) => {
      const pdfWithin = normalPDF(bin.mid, mean, sigmaWithin) * N * binWidth;
      const pdfOverall = normalPDF(bin.mid, mean, sigmaOverall) * N * binWidth;
      return {
        binMid: bin.mid,
        Frekvens: bin.count,
        "Normal (Within)": parseFloat(pdfWithin.toFixed(4)),
        "Normal (Overall)": parseFloat(pdfOverall.toFixed(4)),
      };
    });

    // Visual comparison ranges
    const rangeData = [
      {
        name: "Specs",
        min: LSL,
        max: USL,
        target: Target,
      },
      {
        name: "Within (3σ)",
        min: mean - 3 * sigmaWithin,
        max: mean + 3 * sigmaWithin,
        target: mean,
      },
      {
        name: "Overall (3σ)",
        min: mean - 3 * sigmaOverall,
        max: mean + 3 * sigmaOverall,
        target: mean,
      },
    ];

    return {
      N,
      mean,
      sigmaWithin,
      sigmaOverall,
      cp,
      cpk,
      pp,
      ppk,
      cpm,
      AD,
      pVal,
      observedOut: pctTotalOut,
      expectedOutWithin: expPPM_TotalWithin / 10000,
      expectedOutOverall: expPPM_TotalOverall / 10000,
      ppmTotalWithin: expPPM_TotalWithin,
      ppmTotalOverall: expPPM_TotalOverall,
      iChartData,
      uclI,
      lclI,
      mrChartData,
      uclMR,
      lclMR,
      qqData,
      histogramData,
      rangeData,
      LSL,
      USL,
      Target,
    };
  }, [parsedData, lslStr, uslStr, targetStr]);

  const calculate = () => {
    if (parsedData.length < 3) return;
    setRunAnalysis(true);
  };

  const handleSave = () => {
    if (!analysis) return;
    saveCalculation({
      toolId: "capability-sixpack",
      toolName: "Capability Sixpack",
      phase, // Analyze
      inputs: {
        dataStr,
        lslStr,
        uslStr,
        targetStr,
      },
      results: {
        N: analysis.N,
        mean: analysis.mean,
        sigmaWithin: analysis.sigmaWithin,
        sigmaOverall: analysis.sigmaOverall,
        cp: analysis.cp,
        cpk: analysis.cpk,
        pp: analysis.pp,
        ppk: analysis.ppk,
      },
    });
  };

  const getBadge = (val: number) => {
    if (val >= 1.33) {
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:text-green-300">UTMÄRKT (≥1.33)</Badge>;
    }
    if (val >= 1.0) {
      return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-950 dark:text-yellow-300">MARGINELL (1.0-1.33)</Badge>;
    }
    return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-300">OTILLRÄCKLIG (&lt;1.0)</Badge>;
  };

  const iChartCustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded p-2 text-xs shadow-md">
          <p className="font-semibold">Obs {data.id}</p>
          <p className="text-foreground">Värde: <span className="font-mono">{data.value.toFixed(4)}</span></p>
          <p className="text-muted-foreground">UCL: {data.ucl}</p>
          <p className="text-muted-foreground">LCL: {data.lcl}</p>
          {data.isOut && <p className="text-rose-500 font-semibold mt-1">⚠️ Utanför gräns!</p>}
        </div>
      );
    }
    return null;
  };

  const mrChartCustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded p-2 text-xs shadow-md">
          <p className="font-semibold">Obs-intervall {data.id - 1} till {data.id}</p>
          <p className="text-foreground">MR: <span className="font-mono">{data.value.toFixed(4)}</span></p>
          <p className="text-muted-foreground">UCL: {data.ucl}</p>
          {data.isOut && <p className="text-rose-500 font-semibold mt-1">⚠️ SPC Variation Alert!</p>}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 pt-2">
      <CalculatorLoadButton savedCalculation={savedCalculation} isLoading={isLoadingSaved} onLoad={handleLoad} />
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 pb-2">
        <div>
          <h3 className="text-md font-semibold flex items-center gap-1.5 text-foreground">
            <TrendingUp className="h-4 w-4 text-primary" />
            Minitab-killer: Capability Sixpack
          </h3>
          <p className="text-xs text-muted-foreground">
            Duglighetsanalys med SPC-kontroll, normalitetstest och processtabilitet på en sida.
          </p>
        </div>
      </div>

      <div className="bg-muted/40 border border-primary/10 rounded-xl p-3.5 space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          <Sparkles className="h-4 w-4 text-amber-500 fill-amber-500" />
          <span>Välj testscenario för att utvärdera samtliga 6 diagram & diagnostikmetoder:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadScenario("ideal")}
            className="text-xs h-8 bg-background border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-950 dark:text-green-300"
          >
            1. Idealt & Kapabelt (Cp ~1.5, Cpk ~1.5)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadScenario("offset")}
            className="text-xs h-8 bg-background border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-950 dark:text-amber-300"
          >
            2. Centreringsfel (Cp 1.5, Cpk 0.8 - Centroid-fel)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadScenario("unstable")}
            className="text-xs h-8 bg-background border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-950 dark:text-red-300"
          >
            3. Instabilt (Röda larm i styrdiagrammen)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadScenario("non-normal")}
            className="text-xs h-8 bg-background border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800 dark:border-purple-950 dark:text-purple-300"
          >
            4. Ej normalfördelat (AD P-värde &lt; 0.05)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadScenario("drift")}
            className="text-xs h-8 bg-background border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 dark:border-blue-950 dark:text-blue-300"
          >
            5. Slitagetrend / Drift (Kortsiktig vs Långsiktig)
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Genom att klicka på knapparna laddas skräddarsydd mätteknisk processdata in. Du kan direkt studera hur SPC-gränser, Anderson-Darling normalitetstestet, normalfördelningskurvorna och kortsiktig (Within/Cp) och långsiktig (Overall/Pp) spridning beter sig och samverkar pedagogiskt.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2">
          <Label className="text-xs font-semibold mb-1 block">Rådata (Kopiera/klistra in från Excel, tabulerad eller kommaseparerad)</Label>
          <Textarea
            value={dataStr}
            onChange={(e) => {
              setDataStr(e.target.value);
              setRunAnalysis(false);
            }}
            placeholder="Klistra mätvärden t.ex: 10.1, 10.0, 9.9, ..."
            className="h-28 text-xs font-mono resize-none leading-relaxed"
          />
          {parsedData.length > 0 && (
            <p className="text-[10px] text-muted-foreground mt-1">
              ✓ Hittade <strong>{parsedData.length}</strong> giltiga mätvärden. Jämn mätning över tid förutsätts.
            </p>
          )}
        </div>

        <div className="space-y-2.5">
          <div>
            <Label htmlFor="sixpack-lsl" className="text-xs font-semibold">LSL (Nedre specgräns)</Label>
            <Input
              id="sixpack-lsl"
              type="number"
              step="0.01"
              value={lslStr}
              onChange={(e) => {
                setLslStr(e.target.value);
                setRunAnalysis(false);
              }}
              className="h-8 text-sm font-mono mt-0.5"
            />
          </div>
          <div>
            <Label htmlFor="sixpack-usl" className="text-xs font-semibold">USL (Övre specgräns)</Label>
            <Input
              id="sixpack-usl"
              type="number"
              step="0.01"
              value={uslStr}
              onChange={(e) => {
                setUslStr(e.target.value);
                setRunAnalysis(false);
              }}
              className="h-8 text-sm font-mono mt-0.5"
            />
          </div>
        </div>

        <div className="space-y-2.5">
          <div>
            <Label htmlFor="sixpack-target" className="text-xs font-semibold">Target (Valfritt nominellt målvärde)</Label>
            <Input
              id="sixpack-target"
              type="number"
              step="0.01"
              value={targetStr}
              onChange={(e) => {
                setTargetStr(e.target.value);
                setRunAnalysis(false);
              }}
              className="h-8 text-sm font-mono mt-0.5"
            />
          </div>
          <div className="pt-5">
            <Button
              onClick={calculate}
              className="w-full h-8 text-xs font-semibold bg-primary hover:bg-primary/90"
              disabled={parsedData.length < 3 || isNaN(parseFloat(lslStr)) || isNaN(parseFloat(uslStr))}
            >
              Generera Sixpack-analys
            </Button>
          </div>
        </div>
      </div>

      {runAnalyis && analysis && (
        <div className="space-y-6">
          {/* Main indices stats cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Card className="border-primary/25 bg-background shadow-sm">
              <CardContent className="p-3 text-center">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Potential Cp (Within)</div>
                <div className="text-3xl font-extrabold text-foreground tabular-nums my-0.5">{analysis.cp.toFixed(3)}</div>
                <div className="mt-1">{getBadge(analysis.cp)}</div>
              </CardContent>
            </Card>

            <Card className="border-primary/25 bg-background shadow-sm">
              <CardContent className="p-3 text-center">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Duglighet Cpk (Within)</div>
                <div className="text-3xl font-extrabold text-foreground tabular-nums my-0.5">{analysis.cpk.toFixed(3)}</div>
                <div className="mt-1">{getBadge(analysis.cpk)}</div>
              </CardContent>
            </Card>

            <Card className="border-border bg-background shadow-sm">
              <CardContent className="p-3 text-center">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Prestanda Pp (Overall)</div>
                <div className="text-3xl font-extrabold text-foreground tabular-nums my-0.5">{analysis.pp.toFixed(3)}</div>
                <div className="mt-1">{getBadge(analysis.pp)}</div>
              </CardContent>
            </Card>

            <Card className="border-border bg-background shadow-sm">
              <CardContent className="p-3 text-center">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Prestanda Ppk (Overall)</div>
                <div className="text-3xl font-extrabold text-foreground tabular-nums my-0.5">{analysis.ppk.toFixed(3)}</div>
                <div className="mt-1">{getBadge(analysis.ppk)}</div>
              </CardContent>
            </Card>

            <Card className="border-border bg-background shadow-sm col-span-2 lg:col-span-1">
              <CardContent className="p-3 text-center flex flex-col justify-between h-full">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide font-semibold">Normalitet (AD)</div>
                <div className="text-3xl font-extrabold text-foreground tabular-nums my-0.5">
                  p = {analysis.pVal < 0.001 ? "<0.001" : analysis.pVal.toFixed(3)}
                </div>
                <div className="mt-1">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    analysis.pVal >= 0.05 
                      ? "text-emerald-700 bg-emerald-500/10 dark:text-emerald-400" 
                      : "text-rose-700 bg-rose-500/10 dark:text-rose-400"
                  }`}>
                    {analysis.pVal >= 0.05 ? "Normalfördelad" : "Ej normalfördelad"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Six diagnostics Minitab grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border p-4 rounded-xl bg-muted/40">
            
            {/* 1. Individual Value SPC (I Chart) */}
            <Card className="md:col-span-1 shadow-sm overflow-hidden border bg-background">
              <CardHeader className="py-2.5 px-3 bg-muted/30 border-b">
                <CardTitle className="text-xs font-semibold flex items-center justify-between">
                  <span>I-styrdiagram (Individer)</span>
                  <span className="text-[9px] font-mono text-muted-foreground">n=1, d2=1.128</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analysis.iChartData} margin={{ top: 8, right: 10, left: -20, bottom: -5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="id" tick={{ fontSize: 9 }} />
                    <YAxis
                      domain={[
                        (dataMin: number) => Math.min(dataMin, analysis.lclI) * 0.999,
                        (dataMax: number) => Math.max(dataMax, analysis.uclI) * 1.001
                      ]}
                      tick={{ fontSize: 9 }}
                      tickFormatter={(val) => val.toFixed(2)}
                    />
                    <Tooltip content={iChartCustomTooltip} />
                    <ReferenceLine y={analysis.mean} stroke="#2563eb" strokeWidth={1.5} label={{ value: `X̄: ${analysis.mean.toFixed(2)}`, fill: "#2563eb", fontSize: 8, position: "insideTopLeft" }} />
                    <ReferenceLine y={analysis.uclI} stroke="#e11d48" strokeWidth={1} strokeDasharray="4 2" label={{ value: `UCL: ${analysis.uclI.toFixed(2)}`, fill: "#e11d48", fontSize: 8, position: "insideBottomLeft" }} />
                    <ReferenceLine y={analysis.lclI} stroke="#e11d48" strokeWidth={1} strokeDasharray="4 2" label={{ value: `LCL: ${analysis.lclI.toFixed(2)}`, fill: "#e11d48", fontSize: 8, position: "insideTopLeft" }} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#4b5563"
                      strokeWidth={1.5}
                      dot={(props) => {
                        const { cx, cy, payload } = props;
                        return (
                          <circle
                            key={payload.id}
                            cx={cx}
                            cy={cy}
                            r={props.payload.isOut ? 3.5 : 2}
                            fill={props.payload.isOut ? "#ef4444" : "#4b5563"}
                            stroke={props.payload.isOut ? "#ffffff" : "none"}
                            strokeWidth={1}
                          />
                        );
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 2. Moving Range SPC (MR Chart) */}
            <Card className="shadow-sm overflow-hidden border bg-background">
              <CardHeader className="py-2.5 px-3 bg-muted/30 border-b">
                <CardTitle className="text-xs font-semibold flex items-center justify-between">
                  <span>MR-styrdiagram (Moving Range)</span>
                  <span className="text-[9px] font-mono text-muted-foreground">Medel MR</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analysis.mrChartData} margin={{ top: 8, right: 10, left: -20, bottom: -5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="id" tick={{ fontSize: 9 }} />
                    <YAxis
                      domain={[0, (dataMax: number) => Math.max(dataMax, analysis.uclMR) * 1.05]}
                      tick={{ fontSize: 9 }}
                      tickFormatter={(val) => val.toFixed(2)}
                    />
                    <Tooltip content={mrChartCustomTooltip} />
                    <ReferenceLine y={analysis.mrChartData[0]?.mean || 0} stroke="#2563eb" strokeWidth={1} label={{ value: `MR̄: ${(analysis.mrChartData[0]?.mean || 0).toFixed(3)}`, fill: "#2563eb", fontSize: 8, position: "insideTopLeft" }} />
                    <ReferenceLine y={analysis.uclMR} stroke="#e11d48" strokeWidth={1} strokeDasharray="4 2" label={{ value: `UCL: ${analysis.uclMR.toFixed(3)}`, fill: "#e11d48", fontSize: 8, position: "insideBottomLeft" }} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#4b5563"
                      strokeWidth={1.2}
                      dot={(props) => {
                        const { cx, cy, payload } = props;
                        return (
                          <circle
                            key={payload.id}
                            cx={cx}
                            cy={cy}
                            r={props.payload.isOut ? 3.5 : 1.5}
                            fill={props.payload.isOut ? "#ef4444" : "#4b5563"}
                            stroke={props.payload.isOut ? "#ffffff" : "none"}
                            strokeWidth={1}
                          />
                        );
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 3. Histogram and Normality Fitting curves */}
            <Card className="shadow-sm overflow-hidden border bg-background">
              <CardHeader className="py-2.5 px-3 bg-muted/30 border-b">
                <CardTitle className="text-xs font-semibold flex items-center justify-between">
                  <span>Histogram med normalfördelning</span>
                  <span className="text-[9px] font-mono text-muted-foreground">LSL, target, USL</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysis.histogramData} margin={{ top: 8, right: 10, left: -20, bottom: -5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="binMid" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <ReferenceLine x={analysis.LSL} stroke="#f43f5e" strokeWidth={1} strokeDasharray="3 3" label={{ value: "LSL", fill: "#f43f5e", fontSize: 8, position: "insideTopLeft" }} />
                    <ReferenceLine x={analysis.USL} stroke="#f43f5e" strokeWidth={1} strokeDasharray="3 3" label={{ value: "USL", fill: "#f43f5e", fontSize: 8, position: "insideTopRight" }} />
                    <ReferenceLine x={analysis.Target} stroke="#10b981" strokeWidth={1.2} label={{ value: "T", fill: "#10b981", fontSize: 8, position: "insideTop" }} />
                    <Bar dataKey="Frekvens" fill="#9ca3af" opacity={0.6} radius={[2, 2, 0, 0]} />
                    <Line type="monotone" dataKey="Normal (Within)" stroke="#2563eb" strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="Normal (Overall)" stroke="#16a34a" strokeWidth={1.5} dot={false} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 4. Normal Probability Plot (Q-Q) */}
            <Card className="shadow-sm overflow-hidden border bg-background">
              <CardHeader className="py-2 px-3 bg-muted/30 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <CardTitle className="text-xs font-semibold flex flex-col gap-0.5">
                  <span>Normal sannolikhetsplott (Q-Q)</span>
                  <span className="text-[9px] font-mono text-muted-foreground font-normal">Anderson-Darling normalitetstest</span>
                </CardTitle>
                <div className="bg-background/90 border border-border px-2 py-0.5 rounded-md text-[9px] font-mono flex flex-wrap items-center gap-x-2 shadow-sm self-start sm:self-auto">
                  <span>A²: <span className="font-semibold">{analysis.AD.toFixed(3)}</span></span>
                  <div className="h-2.5 w-[1px] bg-border/60" />
                  <span>
                    p: <span className={`font-bold ${analysis.pVal < 0.05 ? "text-rose-500" : "text-emerald-500"}`}>
                      {analysis.pVal < 0.001 ? "<0.001" : analysis.pVal.toFixed(4)}
                    </span>
                  </span>
                  <div className="h-2.5 w-[1px] bg-border/60" />
                  <span className={`inline-block px-1 rounded-sm text-[8px] font-bold ${
                    analysis.pVal >= 0.05 
                      ? "text-emerald-700 bg-emerald-500/10 dark:text-emerald-400" 
                      : "text-rose-700 bg-rose-500/10 dark:text-rose-300"
                  }`}>
                    {analysis.pVal >= 0.05 ? "Normal" : "Ej normal"}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-2 h-44 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 8, right: 10, left: -20, bottom: -5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      dataKey="z"
                      name="Statistiska kvantiler (Z)"
                      domain={[-3.2, 3.2]}
                      tick={{ fontSize: 9 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="observedValue"
                      name="Mätt värde"
                      domain={[
                        (dataMin: number) => Math.min(dataMin, analysis.LSL) * 0.999,
                        (dataMax: number) => Math.max(dataMax, analysis.USL) * 1.001
                      ]}
                      tick={{ fontSize: 9 }}
                      tickFormatter={(val) => val.toFixed(2)}
                    />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter name="Mätvärden" data={analysis.qqData} fill="#3b82f6" shape="circle" size={12} />
                    {/* Linear trendline using expected normal values */}
                    <Scatter
                      name="Normal linje"
                      data={[
                        { z: -3, observedValue: analysis.mean - 3 * analysis.sigmaOverall },
                        { z: 3, observedValue: analysis.mean + 3 * analysis.sigmaOverall }
                      ]}
                      line={{ stroke: '#ef4444', strokeWidth: 1.2 }}
                      shape={() => null} // Hide marker
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 5. Capability Comparison Plot (Range Bars) */}
            <Card className="shadow-sm overflow-hidden border bg-background">
              <CardHeader className="py-2.5 px-3 bg-muted/30 border-b">
                <CardTitle className="text-xs font-semibold flex items-center justify-between">
                  <span>Duglighetsintervall (Tolerans vs Spridning)</span>
                  <span className="text-[9px] font-mono text-muted-foreground">±3 Standardavvikelser</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 h-44 flex flex-col justify-center">
                <div className="space-y-3.5 px-2">
                  {analysis.rangeData.map((range, idx) => {
                    // Compute percentages relative to a broad visual margin
                    const vizMin = Math.min(analysis.LSL, analysis.mean - 4.5 * analysis.sigmaOverall);
                    const vizMax = Math.max(analysis.USL, analysis.mean + 4.5 * analysis.sigmaOverall);
                    const vizRange = vizMax - vizMin;

                    const leftPct = ((range.min - vizMin) / vizRange) * 100;
                    const widthPct = ((range.max - range.min) / vizRange) * 100;
                    const centerPct = ((range.target - vizMin) / vizRange) * 100;

                    const isSpec = range.name === "Specs";
                    const barColor = isSpec 
                      ? "bg-rose-500/20 border-rose-500 text-rose-700 dark:text-rose-300 dark:bg-rose-950/40" 
                      : idx === 1 
                        ? "bg-blue-500/20 border-blue-600 text-blue-700 dark:text-blue-300 dark:bg-blue-950/40"
                        : "bg-green-500/20 border-green-600 text-green-700 dark:text-green-300 dark:bg-green-950/40";

                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-[10px] font-semibold text-foreground">
                          <span>{range.name}</span>
                          <span className="font-mono text-[9px] text-muted-foreground">
                            [{range.min.toFixed(2)} - {range.max.toFixed(2)}]
                          </span>
                        </div>
                        <div className="relative w-full h-5 bg-muted rounded-md border border-border overflow-hidden">
                          {/* Anchor Grid Marks for spec */}
                          <div className="absolute left-[LSL]" />
                          {/* Range Bar */}
                          <div
                            className={`absolute h-full border-l-2 border-r-2 ${barColor} flex items-center justify-center text-[9px] font-bold`}
                            style={{ left: `${Math.max(0, Math.min(95, leftPct))}%`, width: `${Math.max(3, Math.min(100 - leftPct, widthPct))}%` }}
                          >
                            {/* Mean / Target marker */}
                            <div 
                              className="absolute w-1 h-3.5 bg-foreground" 
                              style={{ left: `${((range.target - range.min) / (range.max - range.min)) * 100}%` }}
                              title={`Centrering: ${range.target.toFixed(3)}`}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* 6. Detailed Capabilities Summary Panel */}
            <Card className="shadow-sm overflow-hidden border bg-background">
              <CardHeader className="py-2.5 px-3 bg-muted/30 border-b">
                <CardTitle className="text-xs font-semibold flex items-center justify-between">
                  <span>Sammanfattande processmått</span>
                  <span className="text-[9px] text-muted-foreground">Parts Per Million (PPM)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 text-[10px] space-y-2 h-44 overflow-y-auto">
                <div className="grid grid-cols-2 gap-1.5 pb-1 border-b">
                  <div>
                    <span className="text-muted-foreground">N (stickprov):</span>
                    <strong className="float-right font-mono text-foreground">{analysis.N}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Medel X̄:</span>
                    <strong className="float-right font-mono text-foreground">{analysis.mean.toFixed(4)}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">σ (Within):</span>
                    <strong className="float-right font-mono text-foreground">{analysis.sigmaWithin.toFixed(4)}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">σ (Overall):</span>
                    <strong className="float-right font-mono text-foreground">{analysis.sigmaOverall.toFixed(4)}</strong>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between font-semibold text-primary">
                    <span>MÅTT</span>
                    <span>WITHIN (Cp)</span>
                    <span>OVERALL (Pp)</span>
                  </div>
                  <div className="flex justify-between border-b py-0.5 font-mono">
                    <span className="text-muted-foreground font-sans">Kvalitetsindex:</span>
                    <span>Cpk: <strong>{analysis.cpk.toFixed(3)}</strong></span>
                    <span>Ppk: <strong>{analysis.ppk.toFixed(3)}</strong></span>
                  </div>
                  <div className="flex justify-between border-b py-0.5 font-mono">
                    <span className="text-muted-foreground font-sans">Förväntad PPM:</span>
                    <span className={analysis.ppmTotalWithin > 1000 ? "text-rose-500 font-bold" : "text-foreground"}>
                      {analysis.ppmTotalWithin === 0 ? "0" : Math.round(analysis.ppmTotalWithin).toLocaleString()}
                    </span>
                    <span className={analysis.ppmTotalOverall > 1000 ? "text-rose-500 font-bold" : "text-foreground"}>
                      {analysis.ppmTotalOverall === 0 ? "0" : Math.round(analysis.ppmTotalOverall).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between border-b py-0.5 font-mono">
                    <span className="text-muted-foreground font-sans">Utanför spec (%):</span>
                    <span>{analysis.expectedOutWithin.toFixed(3)}%</span>
                    <span>{analysis.expectedOutOverall.toFixed(3)}%</span>
                  </div>
                  <div className="flex justify-between py-0.5 font-mono text-amber-600 dark:text-amber-400">
                    <span className="text-muted-foreground font-sans">Obs total ut (%):</span>
                    <span className="col-span-2 text-right w-full font-bold">{analysis.observedOut.toFixed(2)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Sixpack Interpretation Guidance */}
          <Card className="border border-indigo-100 bg-indigo-50/50 dark:border-indigo-950/50 dark:bg-indigo-950/20">
            <CardHeader className="p-3">
              <CardTitle className="text-sm font-semibold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                Duglighetssummering & Rekommendationer
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-2 text-xs text-indigo-800 dark:text-indigo-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p>
                    <strong>1. Processtabilitet (SPC I & MR charts):</strong>{" "}
                    {analysis.iChartData.some((d) => d.isOut) || analysis.mrChartData.some((d) => d.isOut) ? (
                      <span className="text-rose-600 dark:text-rose-400 font-semibold">
                        ❌ Processen uppvisar instabilitet! Det finns punkter som ligger utanför kontrollgränserna (UCL/LCL). Eliminera speciella orsaker (Special Cause variation) innan du litar på duglighetsindexen.
                      </span>
                    ) : (
                      <span className="text-green-600 dark:text-green-400 font-semibold">
                        ✓ Processen är under statistisk kontroll. Inga punkter överträder kontrollgränserna. Statistiskt underlag för duglighetsanalys är giltigt.
                      </span>
                    )}
                  </p>
                  <p>
                    <strong>2. Normalitetsantagande (AD test):</strong>{" "}
                    {analysis.pVal < 0.05 ? (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">
                        ⚠️ Data är inte strikt mjukt normalfördelad (P &lt; 0.05). Sannolikhetsplottens punkter böjer sig bort från normallinjen. Överväg en Box-Cox-transformering eller använd icke-parametrisk metod.
                      </span>
                    ) : (
                      <span className="text-green-600 dark:text-green-400 font-semibold">
                        ✓ Data följer normalfördelningen väl (P ≥ 0.05). AD-testet bekräftar att standardberäkningarna för Cp/Cpk är fullt tillförlitliga.
                      </span>
                    )}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <p>
                    <strong>3. Cp vs Cpk (Centrering):</strong>{" "}
                    {analysis.cp - analysis.cpk > 0.15 ? (
                      <span className="text-amber-600 dark:text-amber-400 font-bold">
                        ⚠️ Stor centreringsskillnad (Cp = {analysis.cp.toFixed(2)}, Cpk = {analysis.cpk.toFixed(2)}). Processens inneboende variation är kapabel, men processmedelvärdet ({analysis.mean.toFixed(2)}) avviker avsevärt från specifikationens centroid ({analysis.Target.toFixed(2)}). Justera medelvärdet för att omedelbart drastiskt höja Cpk!
                      </span>
                    ) : (
                      <span className="text-green-600 dark:text-green-400 font-semibold">
                        ✓ Processen är väl centrerad i förhållande till kraven. Cp ({analysis.cp.toFixed(2)}) och Cpk ({analysis.cpk.toFixed(2)}) ligger nära varandra.
                      </span>
                    )}
                  </p>
                  <p>
                    <strong>4. Kortsiktig vs Långsiktig (Within vs Overall):</strong>{" "}
                    {analysis.sigmaOverall > analysis.sigmaWithin * 1.15 ? (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">
                        ⚠️ Långsiktig variation (Overall Pp={analysis.pp.toFixed(2)}) är märkbart sämre än kortsiktig variation (Within Cp={analysis.cp.toFixed(2)}). Detta tyder på skift, trender eller batchvisa svängningar över tid. Kontrollera råvaror, temperaturändringar eller skiftbyten.
                      </span>
                    ) : (
                      <span className="text-green-600 dark:text-green-400 font-semibold">
                        ✓ Tillfredsställande kontroll över tid. Kortsiktig ({analysis.sigmaWithin.toFixed(3)}) och långsiktig ({analysis.sigmaOverall.toFixed(3)}) variation är väl sammanhållna.
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {runAnalyis && analysis && (
        <div className="pt-2">
          <CalculatorSaveButton
            canSave={canSave}
            isSaving={isSaving}
            hasResult={!!analysis}
            notes={notes}
            onNotesChange={setNotes}
            onSave={handleSave}
          />
        </div>
      )}
    </div>
  );
}

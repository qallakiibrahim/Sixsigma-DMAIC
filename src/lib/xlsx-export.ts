import * as XLSX from "xlsx";
import { phases } from "@/data/dmaic-tools";

interface Project {
  id: string;
  name: string;
  description: string | null;
  current_phase: number;
  status: string;
  estimated_savings?: number | null;
  actual_savings?: number | null;
}

interface ProjectNote {
  id: string;
  phase: number;
  title: string;
  content: string | null;
  created_at: string;
}

interface ProjectCalculation {
  id: string;
  phase: number;
  tool_id: string;
  tool_name: string;
  inputs: unknown;
  results: unknown;
  notes: string | null;
  created_at: string;
}

interface TollgateItem {
  phase: number;
  title: string;
  is_completed: boolean;
}

interface SigmaEntry {
  phase: number;
  sigma_level: number;
  dpmo: number | null;
  measurement_date: string;
}

const HIDDEN_KEYS = new Set([
  "completedSections", "totalSections", "completedFields", "totalFields",
  "filledCount", "totalCount", "isComplete", "lastSaved", "version",
]);

function flattenObj(obj: unknown, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  if (!obj || typeof obj !== "object") return result;
  
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (HIDDEN_KEYS.has(key)) continue;
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value)) {
      result[fullKey] = value.length > 0 && typeof value[0] === "object"
        ? JSON.stringify(value)
        : value.join(", ");
    } else if (typeof value === "object") {
      Object.assign(result, flattenObj(value, fullKey));
    } else {
      result[fullKey] = String(value);
    }
  }
  return result;
}

export function exportProjectToXLSX(
  project: Project,
  notes: ProjectNote[],
  calculations: ProjectCalculation[],
  tollgateItems: TollgateItem[] = [],
  sigmaEntries: SigmaEntry[] = [],
  controlPlanRows: any[] = [],
  raciRows: any[] = []
) {
  const wb = XLSX.utils.book_new();

  // --- Projektöversikt ---
  const overviewData = [
    ["PROJEKTÖVERSIKT OCH STATUSRAPPORT", ""],
    ["", ""],
    ["Projektnamn", project.name],
    ["Beskrivning", project.description || ""],
    ["Status", project.status === "active" ? "Aktiv" : project.status === "completed" ? "Klar" : "Arkiverad"],
    ["Nuvarande fas", phases.find(p => p.id === project.current_phase)?.name || `Fas ${project.current_phase}`],
    ["Uppskattad besparing (SEK)", project.estimated_savings != null ? project.estimated_savings : ""],
    ["Faktisk besparing (SEK)", project.actual_savings != null ? project.actual_savings : ""],
    ["Exporterad", new Date().toLocaleDateString("sv-SE")],
    ["Licensierings-version", "Excel 2021 (Fullständig Schema-kompatibilitet)"],
  ];
  const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
  wsOverview["!cols"] = [{ wch: 30 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, wsOverview, "Översikt");

  // --- Processkontrollplan (Control Plan) ---
  if (controlPlanRows && controlPlanRows.length > 0) {
    const cpHeaders = [
      "Processsteg (Process Step)",
      "Karaktäristik (Characteristic)",
      "Specifikationsgräns (Specification)",
      "Mätmetod (Measurement Method)",
      "Provstorlek (Sample Size)",
      "Frekvens (Frequency)",
      "Ansvarig (Responsible)",
      "Akutåtgärd / Reaktionsplan (Reaction Plan)"
    ];
    const cpRows = controlPlanRows.map(row => [
      row.process_step || "",
      row.characteristic || "",
      row.specification || "",
      row.measurement_method || "",
      row.sample_size || "",
      row.frequency || "",
      row.responsible || "",
      row.reaction_plan || ""
    ]);
    const wsCP = XLSX.utils.aoa_to_sheet([cpHeaders, ...cpRows]);
    wsCP["!cols"] = [
      { wch: 25 }, { wch: 25 }, { wch: 20 }, { wch: 20 },
      { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 30 }
    ];
    XLSX.utils.book_append_sheet(wb, wsCP, "Kontrollplan");
  }

  // --- Ansvarsmatris (RACI Matrix) ---
  if (raciRows && raciRows.length > 0) {
    const raciHeaders = [
      "Fas (Phase)",
      "Arbetsuppgift / Aktivitet (Activity)",
      "Ansvarig - Utför (Responsible)",
      "Huvudansvarig - Attesterar (Accountable)",
      "Konsulterad (Consulted)",
      "Informerad (Informed)"
    ];
    const raciRowsData = raciRows.map(row => [
      row.phase ? (phases.find(p => p.id === row.phase)?.name || `Fas ${row.phase}`) : "Gemensam",
      row.activity || "",
      row.responsible || "",
      row.accountable || "",
      row.consulted || "",
      row.informed || ""
    ]);
    const wsRACI = XLSX.utils.aoa_to_sheet([raciHeaders, ...raciRowsData]);
    wsRACI["!cols"] = [
      { wch: 15 }, { wch: 35 }, { wch: 20 }, { wch: 20 },
      { wch: 20 }, { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(wb, wsRACI, "RACI Ansvarsmatris");
  }

  // --- Mätdata för Analys (Dynamic Vertical Series for easy Excel formulas & graphs) ---
  const analysisColumns: { name: string; info: string; values: number[] }[] = [];

  calculations.forEach(c => {
    const scanObj = (obj: any, toolName: string) => {
      if (!obj || typeof obj !== "object") return;
      for (const [key, val] of Object.entries(obj)) {
        if (Array.isArray(val) && val.length > 0 && typeof val[0] === "number") {
          analysisColumns.push({
            name: `${toolName} - ${key}`,
            info: `${new Date(c.created_at).toLocaleDateString("sv-SE")}`,
            values: val as number[]
          });
        }
      }
    };
    scanObj(c.inputs, c.tool_name);
    scanObj(c.results, c.tool_name);
  });

  if (analysisColumns.length > 0) {
    const maxRows = Math.max(...analysisColumns.map(col => col.values.length));
    
    // Header rows
    const analysisHeaderRows = [
      analysisColumns.map(col => col.name),
      analysisColumns.map(col => `Registrerad: ${col.info}`),
    ];

    const analysisBodyRows: any[][] = [];
    for (let r = 0; r < maxRows; r++) {
      const row: any[] = [];
      analysisColumns.forEach(col => {
        const val = col.values[r];
        row.push(val !== undefined ? val : "");
      });
      analysisBodyRows.push(row);
    }

    const wsAnalysis = XLSX.utils.aoa_to_sheet([...analysisHeaderRows, ...analysisBodyRows]);
    wsAnalysis["!cols"] = analysisColumns.map(() => ({ wch: 28 }));
    XLSX.utils.book_append_sheet(wb, wsAnalysis, "Mätdata till Analys");
  }

  // --- Beräkningar (Alla Verktygsutfall) ---
  const calcHeaders = ["Fas", "Verktyg", "Datum", "Anteckning"];
  // Collect all unique keys from inputs/results
  const allInputKeys = new Set<string>();
  const allResultKeys = new Set<string>();
  calculations.forEach(c => {
    const inp = flattenObj(c.inputs);
    const res = flattenObj(c.results);
    Object.keys(inp).forEach(k => allInputKeys.add(k));
    Object.keys(res).forEach(k => allResultKeys.add(k));
  });
  const inputKeysArr = Array.from(allInputKeys).sort();
  const resultKeysArr = Array.from(allResultKeys).sort();
  const fullCalcHeaders = [...calcHeaders, ...inputKeysArr.map(k => `[Indata] ${k}`), ...resultKeysArr.map(k => `[Resultat] ${k}`)];

  const calcRows = calculations.map(c => {
    const inp = flattenObj(c.inputs);
    const res = flattenObj(c.results);
    return [
      phases.find(p => p.id === c.phase)?.name || `Fas ${c.phase}`,
      c.tool_name,
      new Date(c.created_at).toLocaleDateString("sv-SE"),
      c.notes || "",
      ...inputKeysArr.map(k => inp[k] || ""),
      ...resultKeysArr.map(k => res[k] || ""),
    ];
  });
  const wsCalcs = XLSX.utils.aoa_to_sheet([fullCalcHeaders, ...calcRows]);
  // Give it slightly larger column sizing to prevent text clipping
  wsCalcs["!cols"] = [
    { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 30 },
    ...inputKeysArr.map(() => ({ wch: 20 })),
    ...resultKeysArr.map(() => ({ wch: 20 }))
  ];
  XLSX.utils.book_append_sheet(wb, wsCalcs, "Beräkningar sammanställt");

  // --- Anteckningar ---
  const notesHeaders = ["Fas", "Rubrik", "Innehåll", "Datum"];
  const notesRows = notes.map(n => [
    phases.find(p => p.id === n.phase)?.name || `Fas ${n.phase}`,
    n.title,
    n.content || "",
    new Date(n.created_at).toLocaleDateString("sv-SE"),
  ]);
  const wsNotes = XLSX.utils.aoa_to_sheet([notesHeaders, ...notesRows]);
  wsNotes["!cols"] = [{ wch: 15 }, { wch: 30 }, { wch: 60 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, wsNotes, "Anteckningar");

  // --- Tollgate ---
  const tollgateHeaders = ["Fas", "Punkt", "Klar"];
  const tollgateRows = tollgateItems.map(t => [
    phases.find(p => p.id === t.phase)?.name || `Fas ${t.phase}`,
    t.title,
    t.is_completed ? "Ja" : "Nej",
  ]);
  const wsTollgate = XLSX.utils.aoa_to_sheet([tollgateHeaders, ...tollgateRows]);
  wsTollgate["!cols"] = [{ wch: 15 }, { wch: 45 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsTollgate, "Tollgate steg");

  // --- Sigma ---
  const sigmaHeaders = ["Fas", "Sigma-nivå", "DPMO", "Mätdatum"];
  const sigmaRows = sigmaEntries.map(s => [
    phases.find(p => p.id === s.phase)?.name || `Fas ${s.phase}`,
    Number(s.sigma_level).toFixed(2),
    s.dpmo != null ? s.dpmo : "",
    new Date(s.measurement_date).toLocaleDateString("sv-SE"),
  ]);
  const wsSigma = XLSX.utils.aoa_to_sheet([sigmaHeaders, ...sigmaRows]);
  wsSigma["!cols"] = [{ wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, wsSigma, "Sigma-utveckling");

  const cleanProjectName = project.name
    .replace(/[åäÅÄ]/g, "a")
    .replace(/[öÖ]/g, "o")
    .replace(/[^a-zA-Z0-9\s-_]/g, "")
    .replace(/\s+/g, "_");
    
  const fileName = `${cleanProjectName}_analys_export.xlsx`;
  
  // Use XLSX.writeFile directly which has built-in robust browser trigger detection and cross-browser safety guards
  XLSX.writeFile(wb, fileName, { bookType: "xlsx", bookSST: true });
}

export function exportProjectToCSV(
  project: Project,
  notes: ProjectNote[],
  calculations: ProjectCalculation[],
  tollgateItems: TollgateItem[] = [],
  sigmaEntries: SigmaEntry[] = [],
  controlPlanRows: any[] = [],
  raciRows: any[] = []
) {
  let csvContent = "";
  const sep = ";"; // Standard Swedish Excel delimiter (since Swedish locale uses comma as decimal separator)

  const esc = (val: any) => {
    if (val === null || val === undefined) return "";
    const str = String(val).replace(/"/g, '""');
    if (str.includes(sep) || str.includes("\n") || str.includes('\r') || str.includes('"')) {
      return `"${str}"`;
    }
    return str;
  };

  // --- Projektöversikt ---
  csvContent += `PROJEKTÖVERSIKT OCH STATUSRAPPORT\r\n\r\n`;
  csvContent += `Projektnamn${sep}${esc(project.name)}\r\n`;
  csvContent += `Beskrivning${sep}${esc(project.description || "")}\r\n`;
  csvContent += `Status${sep}${project.status === "active" ? "Aktiv" : project.status === "completed" ? "Klar" : "Arkiverad"}\r\n`;
  csvContent += `Nuvarande fas${sep}${phases.find(p => p.id === project.current_phase)?.name || `Fas ${project.current_phase}`}\r\n`;
  csvContent += `Uppskattad besparing (SEK)${sep}${project.estimated_savings != null ? project.estimated_savings : ""}\r\n`;
  csvContent += `Faktisk besparing (SEK)${sep}${project.actual_savings != null ? project.actual_savings : ""}\r\n`;
  csvContent += `Exporterad${sep}${new Date().toLocaleDateString("sv-SE")}\r\n\r\n\r\n`;

  // --- Processkontrollplan ---
  if (controlPlanRows && controlPlanRows.length > 0) {
    csvContent += `PROCESSKONTROLLPLAN\r\n`;
    csvContent += `Processsteg${sep}Karaktäristik${sep}Specifikationsgräns${sep}Mätmetod${sep}Provstorlek${sep}Frekvens${sep}Ansvarig${sep}Akutåtgärd / Reaktionsplan\r\n`;
    controlPlanRows.forEach(row => {
      csvContent += `${esc(row.process_step || "")}${sep}${esc(row.characteristic || "")}${sep}${esc(row.specification || "")}${sep}${esc(row.measurement_method || "")}${sep}${esc(row.sample_size || "")}${sep}${esc(row.frequency || "")}${sep}${esc(row.responsible || "")}${sep}${esc(row.reaction_plan || "")}\r\n`;
    });
    csvContent += `\r\n\r\n`;
  }

  // --- RACI Ansvarsmatris ---
  if (raciRows && raciRows.length > 0) {
    csvContent += `RACI ANSVARSMATRIS\r\n`;
    csvContent += `Fas${sep}Arbetsuppgift / Aktivitet${sep}Ansvarig - Utför (R)${sep}Huvudansvarig - Attesterar (A)${sep}Konsulterad (C)${sep}Informerad (I)\r\n`;
    raciRows.forEach(row => {
      const phaseName = row.phase ? (phases.find(p => p.id === row.phase)?.name || `Fas ${row.phase}`) : "Gemensam";
      csvContent += `${esc(phaseName)}${sep}${esc(row.activity || "")}${sep}${esc(row.responsible || "")}${sep}${esc(row.accountable || "")}${sep}${esc(row.consulted || "")}${sep}${esc(row.informed || "")}\r\n`;
    });
    csvContent += `\r\n\r\n`;
  }

  // --- Anteckningar ---
  if (notes && notes.length > 0) {
    csvContent += `ANTECKNINGAR\r\n`;
    csvContent += `Fas${sep}Rubrik${sep}Innehåll${sep}Datum\r\n`;
    notes.forEach(n => {
      const phaseName = phases.find(p => p.id === n.phase)?.name || `Fas ${n.phase}`;
      csvContent += `${esc(phaseName)}${sep}${esc(n.title)}${sep}${esc(n.content || "")}${sep}${esc(new Date(n.created_at).toLocaleDateString("sv-SE"))}\r\n`;
    });
    csvContent += `\r\n\r\n`;
  }

  // --- Tollgate Checklist ---
  if (tollgateItems && tollgateItems.length > 0) {
    csvContent += `TOLLGATE CHECKLISTA\r\n`;
    csvContent += `Fas${sep}Checkpunkt${sep}Status\r\n`;
    tollgateItems.forEach(t => {
      const phaseName = phases.find(p => p.id === t.phase)?.name || `Fas ${t.phase}`;
      csvContent += `${esc(phaseName)}${sep}${esc(t.title)}${sep}${t.is_completed ? "Klar (Ja)" : "Inte klar (Nej)"}\r\n`;
    });
    csvContent += `\r\n\r\n`;
  }

  // --- Sigma ---
  if (sigmaEntries && sigmaEntries.length > 0) {
    csvContent += `SIGMA-UTVECKLING\r\n`;
    csvContent += `Fas${sep}Sigma-nivå${sep}DPMO${sep}Mätdatum\r\n`;
    sigmaEntries.forEach(s => {
      const phaseName = phases.find(p => p.id === s.phase)?.name || `Fas ${s.phase}`;
      csvContent += `${esc(phaseName)}${sep}${Number(s.sigma_level).toFixed(2)}${sep}${s.dpmo != null ? s.dpmo : ""}${sep}${esc(new Date(s.measurement_date).toLocaleDateString("sv-SE"))}\r\n`;
    });
  }

  const cleanProjName = project.name
    .replace(/[åäÅÄ]/g, "a")
    .replace(/[öÖ]/g, "o")
    .replace(/[^a-zA-Z0-9\s-_]/g, "")
    .replace(/\s+/g, "_");
  const fileName = `${cleanProjName}_analys_export.csv`;

  // Use UTF-8 with BOM (\uFEFF) to guarantee Swedish characters like åäö / ÅÄÖ display perfectly in Microsoft Excel
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.style.display = "none";
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  
  setTimeout(() => {
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
  }, 100);
}

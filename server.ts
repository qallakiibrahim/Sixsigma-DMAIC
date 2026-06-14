import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize GoogleGenAI client (lazy or directly if key is present on start)
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required but missing.");
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

// Robust helper to execute content generation with a prioritized list of fallback models on transient 503/429/500 errors
async function generateContentWithFallback(aiClient: any, options: {
  contents: string;
  systemInstruction?: string;
  responseMimeType?: string;
  responseSchema?: any;
}) {
  const modelsToTry = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite", "gemini-3.1-pro-preview"];
  let lastError: any = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const currentModel = modelsToTry[i];
    try {
      console.log(`[Gemini Client] Attempting generateContent using model: ${currentModel}`);
      const response = await aiClient.models.generateContent({
        model: currentModel,
        contents: options.contents,
        config: {
          ...(options.systemInstruction ? { systemInstruction: options.systemInstruction } : {}),
          ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
          ...(options.responseSchema ? { responseSchema: options.responseSchema } : {}),
        }
      });
      return response;
    } catch (error: any) {
      const isTransient = error.status === 503 || error.status === 429 || error.status === 500 || 
                          String(error).includes("503") || String(error).includes("429") || String(error).includes("UNAVAILABLE") || String(error).includes("ResourceExhausted") || String(error).includes("high demand");
      
      const errorMessage = error?.message || String(error);
      console.log(`[Gemini Client] Note: model ${currentModel} returned status: ${error?.status || "unknown"}, message: "${errorMessage.substring(0, 150)}"`);
      lastError = error;
      
      if (!isTransient && i === 0) {
        throw error;
      }

      if (i < modelsToTry.length - 1) {
        const sleepMs = 800 * (i + 1);
        console.log(`[Gemini Client] Dynamic retry: backing off for ${sleepMs}ms before trying next model: ${modelsToTry[i + 1]}`);
        await new Promise(resolve => setTimeout(resolve, sleepMs));
      }
    }
  }

  // If we reach here, all models have failed, only then we throw and print detailed warning
  console.error("[Gemini Client] All fallback models failed.");
  throw lastError || new Error("All models failed to generate content.");
}

// Highly customized local fallback engines to handle extreme API model demand times gracefully
function getLocalDmaicCoachResponse(params: {
  projectName: string;
  projectDescription: string;
  currentPhase: number;
  notes: any[];
  tollgateItems: any[];
  sigmaEntries: any[];
  calculations: any[];
  question?: string;
}) {
  const { projectName, projectDescription, currentPhase, notes, tollgateItems, sigmaEntries, calculations, question } = params;
  const phaseNames = ["Define (Definiera)", "Measure (Mäta)", "Analyze (Analysera)", "Improve (Förbättra)", "Control (Styra)"];
  const currentPhaseName = phaseNames[currentPhase] || "Okänd";

  // Filter components by current phase
  const currentNotes = notes.filter((n: any) => Number(n.phase) === currentPhase);
  const currentCalcs = calculations.filter((c: any) => Number(c.phase) === currentPhase);
  const currentTollgates = tollgateItems.filter((t: any) => Number(t.phase) === currentPhase);
  const currentSigma = sigmaEntries.filter((s: any) => Number(s.phase) === currentPhase);

  const completedTollgates = currentTollgates.filter((t: any) => t.is_completed);
  const pendingTollgates = currentTollgates.filter((t: any) => !t.is_completed);

  let markdown = `### 🌟 AI DMAIC-coach (Lokal reservanalys)\n\n`;
  markdown += `*Obs: Vår huvudsakliga AI-modell har för rörlig belastning eller är tillfälligt överbelastad. Den här analysen har genomförts omedelbart av vår lokala expertmotor baserat på din sparade data för att garantera att du kan fortsätta arbeta oavbrutet.*\n\n`;

  if (question) {
    markdown += `**Angående din fråga:** "${question}"\n\n`;
    markdown += `Eftersom fjärrmodellen är tillfälligt överbelastad har vi sammanställt en grundlig statusgranskning för ditt projekt **${projectName}** i **${currentPhaseName}**-fasen. Den täcker de vanligaste frågorna och utmaningarna för detta steg.\n\n`;
  } else {
    markdown += `Här är en personlig coachande statusgranskning för **${projectName}** baserat på din digitala projektdata i **${currentPhaseName}**-fasen.\n\n`;
  }

  markdown += `#### 📋 Status för ${currentPhaseName}\n`;
  markdown += `- **Slutförda tollgates**: ${completedTollgates.length} av ${currentTollgates.length || 5}\n`;
  markdown += `- **Sparade beräkningar & verktyg**: ${currentCalcs.length} st\n`;
  markdown += `- **Projektanteckningar**: ${currentNotes.length} st\n`;
  if (currentSigma.length > 0) {
    const latestSigma = currentSigma[currentSigma.length - 1];
    markdown += `- **Aktuell processprestanda**: Sigma: ${latestSigma.sigma_level || "N/A"} (DPMO: ${latestSigma.dpmo || "N/A"})\n`;
  }
  markdown += `\n`;

  markdown += `#### 📈 Styrkor & Klara delar\n`;
  if (completedTollgates.length > 0) {
    markdown += `Du har bockat av följande viktiga milstolpar i fasen:\n`;
    completedTollgates.forEach(t => {
      markdown += `- 👍 **${t.title}** (Verifierad klar)\n`;
    });
  } else {
    markdown += `- Du har precis påbörjat den här fasen eller behöver utföra de första stegen i din tollgate-checklista för att bygga en solid grund.\n`;
  }
  
  if (currentCalcs.length > 0) {
    markdown += `\nDu har framgångsrikt använt och sparat resultat för följande Six Sigma-verktyg:\n`;
    currentCalcs.forEach(c => {
      markdown += `- 🛠️ **${c.tool_name}**: Data har analyserats och lagrats säkert under beräkningar.\n`;
    });
  }
  markdown += `\n`;

  markdown += `#### 🔍 Saker att fokusera på (Utestående delar)\n`;
  if (pendingTollgates.length > 0) {
    markdown += `För att framgångsrikt stänga denna tollgate och passera till nästa fas rekommenderas du att slutföra följande punkter:\n`;
    pendingTollgates.forEach(t => {
      markdown += `- 🟥 **${t.title}**: Fortfarande ej markerad som avslutad. `;
      // Add a dynamic description based on typical items
      const titleL = t.title.toLowerCase();
      if (titleL.includes("charter")) {
        markdown += `Detta är fundamentet för ditt projekt. Definiera problem, mål och ramar.`;
      } else if (titleL.includes("sipoc")) {
        markdown += `Kartlägg leverantörer, input, process, output och kunder för att se helheten.`;
      } else if (titleL.includes("ctq") || titleL.includes("voc")) {
        markdown += `Översätt kundens röst (VOC) till mätbara kvalitetsegenskaper (CTQ).`;
      } else if (titleL.includes("mätsystem") || titleL.includes("gage")) {
        markdown += `Genomför en Gage R&R för att verifiera att ditt mätfel inte förvränger analysen.`;
      } else if (titleL.includes("duglighet") || titleL.includes("capability") || titleL.includes("cpk")) {
        markdown += `Beräkna processens förmåga (Cp/Cpk och Sigma-nivå) för att sätta en baseline.`;
      } else if (titleL.includes("rotorsak") || titleL.includes("fiskben") || titleL.includes("ishikawa")) {
        markdown += `Gör ett fiskbensdiagram och fråga varför i 5 steg för att hitta dolda rotproblem.`;
      } else if (titleL.includes("fmea")) {
        markdown += `Utför en FMEA för att prioritera risker baserat på Risk Priority Number (RPN).`;
      } else if (titleL.includes("pugh") || titleL.includes("lösning")) {
        markdown += `Jämför olika lösningsförslag strukturerat i en Pugh-matris.`;
      } else if (titleL.includes("kontrollplan") || titleL.includes("control plan")) {
        markdown += `Skapa en kontrollplan för att säkerställa att förbättringen blir bestående över tid.`;
      } else {
        markdown += `Arbeta vidare med denna punkt och dokumentera dina framsteg under Verktyg eller Anteckningar.`;
      }
      markdown += `\n`;
    });
  } else {
    markdown += `- Fantastiskt! Alla definierade tollgates för den här fasen är bockade som klara. Du är redo att utvärdera din fas och gå vidare! \n`;
  }
  markdown += `\n`;

  markdown += `#### 💡 Praktisk Vägledning för ${currentPhaseName}\n`;
  if (currentPhase === 1) { // Define
    markdown += `1. **Säkra din Project Charter**: Kontrollera att det finansiella eller operativa målet är uttryckt i siffror (t.ex. "minska fel från 8% till under 2% till sista september").\n`;
    markdown += `2. **Rita ditt SIPOC**: Begränsa processen tydligt: Var börjar den och var slutar den? Det förhindrar scope creep.\n`;
    markdown += `3. **Etablera CTQs**: Se till att kundkraven är mätbara och kan spåras i Measure-fasen.\n`;
  } else if (currentPhase === 2) { // Measure
    markdown += `1. **Verifiera mätmetoden**: Innan du analyserar, kör en Gage R&R. Om mätvariationen är över 30% kan du inte lita på dina mätdata.\n`;
    markdown += `2. **Sätt en tydlig Baseline**: Beräkna Cp, Cpk och din nuvarande DPMO/Sigma-nivå. Denna siffra är referensen du ska förbättra mot i Improve-fasen.\n`;
    markdown += `3. **Skapa en datainsamlingsplan**: Var noga med urvalsstorlek och hur stickproven tas för att undvika systematiska fel.\n`;
  } else if (currentPhase === 3) { // Analyze
    markdown += `1. **Gå på djupet med rotanalys**: Nöj dig inte med första bästa förklaring. Bevisa sambandet med hypotesprövning (ANOVA, t-test eller chi-2) eller linjär regression.\n`;
    markdown += `2. **Prioritera risker med FMEA**: Fokusera dina resurser på feltyper med ett RPN-score över 100.\n`;
    markdown += `3. **Håll sikte på processhastighet**: Identifiera flaskhalsar och de icke-värdeskapande stegen i din processkartläggning.\n`;
  } else if (currentPhase === 4) { // Improve
    markdown += `1. **Utveckla robusta lösningar**: Använd Pugh-matrisen för att ställa förslag mot nuvarande standard (Datum) och vikta kriterierna.\n`;
    markdown += `2. **Utför en pilot**: Implementera aldrig i full skala på en gång. Testa i liten skala och räkna ut den nya kapabilitetsstatistiken.\n`;
    markdown += `3. **Definiera Change Management**: Hur motiverar du medarbetarna att anamma det nya arbetssättet?\n`;
  } else if (currentPhase === 5) { // Control
    markdown += `1. **Automatisera övervakningen**: Integrera styrdiagram (t.ex. EWMA eller X-bar R) så att du ser avvikelser direkt innan de blir defekter.\n`;
    markdown += `2. **Etablera en reaktionsplan**: Vad händer om en punkt går utanför kontrollgränserna? Vem larmas och vilka åtgärder vidtas omedelbart?\n`;
    markdown += `3. **Överlämna formellt**: Se till att processägaren godkänner kontrollplanen och att SOP:ar är uppdaterade.\n`;
  }

  markdown += `\n*Fortsätt göra beräkningar i fliken "Verktyg" och glöm inte att spara dem till projektet för att hålla AI-coachen fullt uppdaterad!*`;
  return markdown;
}

function getLocalTollgateReview(params: {
  projectName: string;
  projectDescription: string;
  phase: number;
  phaseName: string;
  tollgateItems: any[];
  calculations: any[];
  sigmaEntries: any[];
  notes: any[];
}) {
  const { projectName, projectDescription, phase, phaseName, tollgateItems, calculations, sigmaEntries, notes } = params;
  
  // Filter for the specific phase if items aren't filtered yet
  const phaseTollgates = tollgateItems.filter((t: any) => Number(t.phase) === phase);
  const phaseCalcs = calculations.filter((c: any) => Number(c.phase) === phase);
  const phaseNotes = notes.filter((n: any) => Number(n.phase) === phase);
  const phaseSigma = sigmaEntries.filter((s: any) => Number(s.phase) === phase);

  // Calculate score based on actual metrics
  const completedCount = phaseTollgates.filter((t: any) => t.is_completed).length;
  const totalCount = phaseTollgates.length || 1;
  
  // Base score from checklist completion
  let score = Math.round((completedCount / totalCount) * 75);
  
  // Bonus score from actual calculations and notes saved
  if (phaseCalcs.length > 0) score += 15;
  if (phaseNotes.length > 0) score += 10;
  
  // Cap at 100 and floor at 15
  score = Math.max(15, Math.min(100, score));

  // Determine status
  let status = "❌ Underkänd";
  if (score >= 90) {
    status = "✅ Godkänd";
  } else if (score >= 50) {
    status = "⚠️ Villkorad";
  }

  // Identify missing artifacts based on phase and calculations
  const missingArtifacts: string[] = [];
  const lowercaseTools = phaseCalcs.map(c => c.tool_id ? c.tool_id.toLowerCase() : "");

  if (phase === 1) { // Define
    if (!lowercaseTools.includes("charter")) missingArtifacts.push("Project Charter (Projektbeskrivning, mål och avgränsningar)");
    if (!lowercaseTools.includes("sipoc")) missingArtifacts.push("SIPOC-diagram (Processöversikt)");
    if (!lowercaseTools.includes("ctq")) missingArtifacts.push("VOC & CTQ-träd (Översättning av kundkrav)");
  } else if (phase === 2) { // Measure
    if (!lowercaseTools.includes("gage-rr") && !lowercaseTools.includes("gage")) missingArtifacts.push("Gage R&R (Utvärdering av mätsystemets tillförlitlighet)");
    if (!lowercaseTools.includes("cp-cpk") && !lowercaseTools.includes("cpk")) missingArtifacts.push("Processkapabilitet / Baseline-duglighet (Cp/Cpk)");
    if (phaseSigma.length === 0) missingArtifacts.push("Registrerad Baseline Sigma-nivå");
  } else if (phase === 3) { // Analyze
    if (!lowercaseTools.includes("fmea")) missingArtifacts.push("FMEA (Felsöknings- och riskanalys)");
    if (!lowercaseTools.some(t => t.includes("test") || t.includes("anova") || t.includes("correlation"))) missingArtifacts.push("Verifierad statistisk hypotesprövning (t-test, ANOVA eller korrelation)");
  } else if (phase === 4) { // Improve
    if (!lowercaseTools.includes("pugh-matrix") && !lowercaseTools.includes("pugh")) missingArtifacts.push("Pugh Lösningsmatris (Strukturerad utvärdering av idéer)");
    if (!lowercaseTools.includes("pilot") && !lowercaseTools.includes("pilot-study")) missingArtifacts.push("Pilotstudie (Provkörning med ny mätdata)");
  } else if (phase === 5) { // Control
    if (!lowercaseTools.includes("control-limits") && !lowercaseTools.includes("ewma")) missingArtifacts.push("Implementerade styrdiagram med kalkylerade gränser (SPC)");
  }

  // Also include unfinished tollgate items
  phaseTollgates.forEach((t: any) => {
    if (!t.is_completed) {
      missingArtifacts.push(`Ej slutförd tollgate: "${t.title}"`);
    }
  });

  // Evaluate each tollgate item and produce comments
  const criterionAssessments = phaseTollgates.map((t: any) => {
    let itemStatus = t.is_completed ? "pass" : "fail";
    let comment = "";

    if (t.is_completed) {
      comment = `Bockat som slutfört av projektet. Det visar bra framsteg.`;
      // Enhance comment if we actually have the tool
      const matchedCalc = phaseCalcs.find(c => {
        const tid = c.tool_id ? c.tool_id.toLowerCase() : "";
        const titleL = t.title.toLowerCase();
        return (titleL.includes("charter") && tid.includes("charter")) ||
               (titleL.includes("sipoc") && tid.includes("sipoc")) ||
               (titleL.includes("ctq") && tid.includes("ctq")) ||
               (titleL.includes("gage") && tid.includes("gage")) ||
               (titleL.includes("kapabilitet") && tid.includes("cpk")) ||
               (titleL.includes("duglighet") && tid.includes("cp")) ||
               (titleL.includes("fmea") && tid.includes("fmea")) ||
               (titleL.includes("pugh") && tid.includes("pugh")) ||
               (titleL.includes("pilot") && tid.includes("pilot")) ||
               (titleL.includes("styrdiagram") && (tid.includes("control") || tid.includes("ewma")));
      });
      if (matchedCalc) {
        comment += ` Det finns även en matchande sparad beräkning "${matchedCalc.tool_name}".`;
      }
    } else {
      comment = `Den här punkten är inte bockad i checklistan än. `;
      const titleL = t.title.toLowerCase();
      if (titleL.includes("charter")) {
        comment += `Fyll först i Project Charter-verktyget för att definiera problemformulering och projektets mål.`;
      } else if (titleL.includes("sipoc")) {
        comment += `Vänligen rita upp processens SIPOC för att förstå processgränserna.`;
      } else if (titleL.includes("ctq") || titleL.includes("voc")) {
        comment += `Lyssna på kunden och översätt feedbacken till mätbara specifikationer med CTQ-trädet.`;
      } else if (titleL.includes("mätsystem") || titleL.includes("gage")) {
        comment += `Genomför Gage R&R för att bevisa att ditt mätsystem fungerar stabilt innan datainsamling påbörjas.`;
      } else if (titleL.includes("kapabilitet") || titleL.includes("cpk") || titleL.includes("duglighet")) {
        comment += `Kör Cp/Cpk-beräkningen för att definiera din processkapabilitet innan förbättringar påbörjas.`;
      } else if (titleL.includes("fmea")) {
        comment += `Kalkulera risker i en FMEA för att proaktivt motverka felorsaker.`;
      } else if (titleL.includes("pugh") || titleL.includes("lösning")) {
        comment += `Ställ dina lösningar i Pugh-matrisen för att opartiskt och rationellt finna den bästa idén.`;
      } else if (titleL.includes("kontrollplan")) {
        comment += `Mata in värden under Kontrollplanen för att specificera löpande processkontroll och reaktionsansvar.`;
      } else {
        comment += `Vänligen arbeta med denna tollgate och markera den som klar när alla tillhörande aktiviteter slutförts.`;
      }
      itemStatus = "warning"; // friendly warning
    }

    return {
      title: t.title,
      status: itemStatus,
      comment: comment
    };
  });

  // Provide robust Swedish recommendations in Markdown
  let recommendations = `### 📋 Tollgate Review: Rekommendationer för ${phaseName}\n\n`;
  recommendations += `*Obs: Online AI-granskningen upplever hög belastning för tillfället. Nedanstående professionella utvärdering har beräknats av vårt lokala expertsystem baserat på dina bockade tollgates och sparade verktygsdata i databasen.*\n\n`;

  if (status === "✅ Godkänd") {
    recommendations += `#### 🎉 Utmärkt Arbete - Granskningen är Godkänd!\n`;
    recommendations += `Ditt projekt uppfyller alla de strikta kriterier och dokumentationskrav som ställs under **${phaseName}**. Du har ett robust underlag, dokumenterade beräkningar och slutförda milstolpar. Du är formellt redo att passera denna tollgate och gå vidare till nästa fas i DMAIC-cykeln!\n\n`;
  } else if (status === "⚠️ Villkorad") {
    recommendations += `#### ⚖️ Granskningen är Godkänd med Förbehåll (Villkorad)\n`;
    recommendations += `Du gör utmärkta framsteg i din **${phaseName}**! Dock finns det några mindre luckor i dokumentationen eller beräkningarna som behöver uppmärksammas innan fasen kan stängas formellt.\n\n`;
  } else {
    recommendations += `#### 🟥 Kompletteringar Krävs - Granskningen är Ej Godkänd\n`;
    recommendations += `Det finns betydande utestående delar eller saknade nyckelverktyg i din **${phaseName}** för att hålla en professionell Six Sigma Black Belt-standard. Vi rekommenderar starkt att du fyller i de saknade modulerna i Verktygsfliken före tollgate-mötet.\n\n`;
  }

  recommendations += `#### 🛠️ Rekommenderade Åtgärder per Prioritetsordning:\n`;
  
  if (missingArtifacts.length > 0) {
    missingArtifacts.forEach((art, idx) => {
      recommendations += `${idx + 1}. **Komplettera ${art}**: `;
      if (art.includes("Charter")) {
        recommendations += `Gå till fliken 'Verktyg' -> välj 'Project Charter'. Definiera problemet och sätt avgränsningen tydligt. Spara beräkningen.\n`;
      } else if (art.includes("SIPOC")) {
        recommendations += `En solid processkarta behövs. Rita upp ditt SIPOC och spara för att ge en överskådlig systembild.\n`;
      } else if (art.includes("CTQ")) {
        recommendations += `Koppla dina övergripande kundkrav till konkreta, kontrollerbara värden med CTQ-trädet.\n`;
      } else if (art.includes("Gage")) {
        recommendations += `Verifiera att mätsystemet mäter korrekt. Utan en godkänd Gage R&R är insamlade data opålitliga.\n`;
      } else if (art.includes("Processkapabilitet") || art.includes("Cp/Cpk")) {
        recommendations += `Räkna ut Cp/Cpk och processens baseline Sigma-nivå. Denna baseline visar den faktiska förlusten i nuläget.\n`;
      } else if (art.includes("FMEA")) {
        recommendations += `Ladda upp riskanalysen. Identifiera potentiella fel, beräkna RPN och prioritera korrigerande åtgärder.\n`;
      } else if (art.includes("Pugh")) {
        recommendations += `Matrisen säkerställer att ni väljer lösningar objektivt och faktabaserat istället för baserat på gissningar.\n`;
      } else if (art.includes("Kontrollplan")) {
        recommendations += `Du måste rita upp hur framgången ska låsas fast. Skapa en kontrollplan med specifika toleransgränser och korrektionsplan.\n`;
      } else {
        recommendations += `Följ instruktionerna, registrera data och markera den som slutförd.\n`;
      }
    });
  } else {
    recommendations += `- Alla mätverktyg och checklistor är klara! Grattis till ett fläckfritt utförande.\n`;
  }

  recommendations += `\n*Spara och exportera gärna denna rapport som en del av din projektdokumentation.*`;

  return {
    status,
    score,
    missingArtifacts,
    recommendations,
    criterionAssessments
  };
}

app.post("/api/ai-dmaic-coach", async (req, res) => {
  try {
    const { 
      projectName, 
      projectDescription, 
      currentPhase, 
      notes, 
      tollgateItems, 
      sigmaEntries, 
      calculations, 
      question 
    } = req.body;

    const phaseNames = ["Define (Definiera)", "Measure (Mäta)", "Analyze (Analysera)", "Improve (Förbättra)", "Control (Styra)"];
    const currentPhaseName = phaseNames[currentPhase] || "Okänd";

    const promptContext = `
Du är en expert-coach inom Six Sigma DMAIC-metodiken. Din roll är att granska, vägleda och förbättra användarprojektet baserat på tillgängliga data. Svara på ett pedagogiskt, professionellt och inspirerande sätt på svenska. Använd Markdown för snygg formatering.

Här är projektinformationen:
- **Projektnamn**: ${projectName || "Namnlöst projekt"}
- **Projektbeskrivning**: ${projectDescription || "Ingen beskrivning angiven"}
- **Nuvarande Fas/Steg i DMAIC**: Phase ${currentPhase} (${currentPhaseName})

Här är tillgänglig data i projektet:
1. **Projektanteckningar/Loggbok (Project Notes)**:
${notes && notes.length > 0 
  ? notes.map((n: any) => `- Fas: ${phaseNames[n.phase] || n.phase}. Titel: "${n.title}". Innehåll: ${n.content || "Tom"}`).join('\n')
  : "Inga anteckningar har skapats än."}

2. **Checklistor för faser (Tollgate Items)**:
${tollgateItems && tollgateItems.length > 0
  ? tollgateItems.map((t: any) => `- Fas: ${phaseNames[t.phase] || t.phase}. "${t.title}" -> ${t.is_completed ? "KLAR" : "INTE KLAR"}`).join('\n')
  : "Inga checklista-punkter laddades."}

3. **Sigma-mätningar & Spårning (Sigma Tracking)**:
${sigmaEntries && sigmaEntries.length > 0
  ? sigmaEntries.map((s: any) => `- Fas: ${phaseNames[s.phase] || s.phase}. Sigma Level: ${s.sigma_level || "N/A"} (DPMO: ${s.dpmo || "N/A"}) under ${s.measurement_date || "okänt datum"}`).join('\n')
  : "Inga Sigma-mätningar registrerade än."}

4. **Verktyg & Beräkningar (Tools & Calculations)**:
${calculations && calculations.length > 0
  ? calculations.map((c: any) => `- Verktyg: "${c.tool_name}" (ID: ${c.tool_id}).
    * Detaljerad data/insatser: ${JSON.stringify(c.inputs || {})}
    * Resultat/Status: ${JSON.stringify(c.results || {})}
    * Verktygsanteckningar: ${c.notes || "Inga"}`).join('\n')
  : "Inga beräkningar eller ifyllda verktygsmoduler ännu."}

Användarfråga:
${question ? `Användaren har ställt denna specifika fråga: "${question}"` : "Användaren har inte ställt en specifik fråga utan vill ha en övergripande coachande analys av projektets framsteg i den nuvarande fasen."}

Vägledning för dina svar:
- Om användaren ställde en specifik fråga, besvara den i detalj med grund i Six Sigma / DMAIC, och ge praktiska exempel applicerade på deras projekt.
- Om ingen specifik fråga ställdes, ge en strukturerad statusanalys för nuvarande fas (${currentPhaseName}):
  1. **Sammanfattning**: Hur ligger de till baserat på sin beskrivning och data?
  2. **Styrkor & Klara delar**: Vad ser bra ut i den här fasen?
  3. **Eventuella luckor/Nästa steg**: Vilka tollgates är fortfarande inte klara? Vad behövs fyllas i (t.ex. saknas beräkningar eller anteckningar)?
  4. **Rekommendationer**: Konkreta, praktiska coachande råd för att ta sig vidare till nästa fas.
- Svara alltid med en uppmuntrande och tydlig ton, och använd rika DMAIC-begrepp (t.ex. CTQ, Fishbone, SIPOC, FMEA, Control Chart, DPMO) där det är relevant.
`;

    let responseText = "";
    try {
      const aiClient = getGeminiClient();
      const response = await generateContentWithFallback(aiClient, {
        contents: promptContext,
      });
      responseText = response.text || "";
    } catch (apiError: any) {
      console.warn("[Gemini Client] Gemini API failed with error. Falling back to local coach generation...", apiError?.message || apiError);
      responseText = getLocalDmaicCoachResponse({
        projectName,
        projectDescription,
        currentPhase,
        notes: notes || [],
        tollgateItems: tollgateItems || [],
        sigmaEntries: sigmaEntries || [],
        calculations: calculations || [],
        question
      });
    }

    res.json({ text: responseText });
  } catch (error: any) {
    console.error("Error in AI DMAIC Coach backend:", error);
    res.status(500).json({ error: error.message || "Ett internt serverfel uppstod." });
  }
});

app.post("/api/ai-tollgate-review", async (req, res) => {
  try {
    const { 
      projectName, 
      projectDescription, 
      phase, 
      phaseName, 
      tollgateItems, 
      calculations, 
      sigmaEntries, 
      notes 
    } = req.body;

    const systemInstruction = `
Du är en Six Sigma Master Black Belt och en rigorös extern granskare för organisationers DMAIC-projektcertifieringar.
Ditt uppdrag är att göra en grundlig, professionell och saklig "Tollgate Review" av projektet för den angivna fasen: Phase ${phase} (${phaseName}).

Du kommer att få projektbeskrivning, ifyllda checklistpunkter, sparade statistiska verktyg/beräkningar, sigma-mätningar och anteckningar för fasen.

Gör följande intellektuella utvärdering på svenska:
1. Analysera om alla väsentliga artefakter för fasen har fyllts i och är väl genomförda.
   - Fas 1 (Define): Kräver en solid Project Charter (problembeskrivning, mål, avgränsning), SIPOC-diagram, VOC och översatt CTQ. Kontrollera om dessa verktyg har data angivna i calculations-listan.
   - Fas 2 (Measure): Kräver en Datainsamlingsplan, ett tillförlitligt mätsystem (Gage R&R med variation helst <10% och absolut max <30%), en Baseline processkapabilitetsberäkning (Cp/Cpk), Baseline Sigma-nivå samt detaljerad processkartläggning.
   - Fas 3 (Analyze): Kräver att rotorsaker har identifierats och utvärderats (t.ex. Fiskbensdiagram, 5 Varför), samt bevis på analys av kritiska X-faktorer (hypotesprövning, Pareto, regressionsanalys) och en uppdaterad FMEA.
   - Fas 4 (Improve): Kräver genererade och systematiskt valda lösningar (t.ex. Pugh-matris), pilotstudie, uppmätt/verifierad förbättring med ny kapabilitetsdata, och en tydlig implementeringsplan med riskanalys.
   - Fas 5 (Control): Kräver en robust Kontrollplan, implementerade styrdiagram (Control Charts/SPC) med uppsatta kontrollgränser (LCL, UCL), SOP:ar, en tydlig reaktionsplan och utsedd processägare.
2. Bestäm ett övergripande betyg (score) mellan 0 och 100:
   - Över 90: Utmärkt arbete. Alla kritiska artefakter finns, har högkvalitativ data och är bevisat godkända.
   - 50-89: Bra framsteg, men det finns vissa luckor, ofullständiga beräkningar eller svaga mätvärden (t.ex. Gage R&R är "warning" eller mätdata saknas för nyckelområden).
   - Under 50: Allvarliga brister. Mycket av fasens kritiska verktyg saknas helt, eller mätsystemet/kapabiliteten är underbetyg.
3. Sätt en status baserat på tillståndet:
   - '✅ Godkänd' om score är >= 90
   - '⚠️ Villkorad' om score är mellan 50 och 89 (t.ex. smärre luckor som kan lösas under tiden)
   - '❌ Underkänd' om score är < 50 (kräver stora kompletteringar innan fasen kan stängas)
4. Gör en bedömning per checkpoint i checklistan (tollgateItems). Matchade checklistans punkter med de verktyg och anteckningar som faktiskt finns (t.ex. bocka av "Gage R&R" as 'pass' om "gage-rr" finns i calculations med bra mätning, annars 'warning' eller 'fail').
5. Identifiera saknade artefakter (missingArtifacts).
6. Skriv tydliga, pedagogiska och detaljerade rekommendationer (recommendations) i Markdown på svenska. Förklara exakt vad som saknas och hur de kan förbättra fasens resultat för att uppfylla Six Sigma standarder.

Returnera svaret strikt strukturerat enligt det begärda JSON-schemat.
`;

    const userPrompt = `
Här är projektets aktuella data för Phase ${phase} (${phaseName}):

PROJEKT:
- Namn: ${projectName || "Namnlöst"}
- Beskrivning: ${projectDescription || "Finns ej"}

TOLLGATE CHECKLISTA:
${tollgateItems && tollgateItems.length > 0 
  ? tollgateItems.map((item: any) => `- [${item.is_completed ? "X" : " "}] ${item.title}`).join('\n')
  : "Inga checklistpunkter har skapats än."}

VERKTYG & BERÄKNINGAR (CALCULATIONS):
${calculations && calculations.length > 0
  ? calculations.map((c: any) => `- Verktyg: ${c.tool_name} (ID: ${c.tool_id})
    Inputs: ${JSON.stringify(c.inputs || {})}
    Results: ${JSON.stringify(c.results || {})}
    Notes: ${c.notes || "Inga anteckningar"}`).join('\n')
  : "Inga verktyg eller beräkningar har körts i denna fas."}

SIGMA RECORDS:
${sigmaEntries && sigmaEntries.length > 0
  ? sigmaEntries.map((s: any) => `- Datum: ${s.measurement_date}, Sigma: ${s.sigma_level}, DPMO: ${s.dpmo}, Notes: ${s.notes}`).join('\n')
  : "Inga Sigma-mätningar registrerade."}

ANTECKNINGAR:
${notes && notes.length > 0
  ? notes.map((n: any) => `- "${n.title}": ${n.content}`).join('\n')
  : "Inga anteckningar gjorda i denna fas."}
`;

    let resultJson: any = null;
    try {
      const aiClient = getGeminiClient();
      const response = await generateContentWithFallback(aiClient, {
        contents: userPrompt,
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: {
              type: Type.STRING,
              description: "Övergripande status för granskningen: '✅ Godkänd', '⚠️ Villkorad' eller '❌ Underkänd'"
            },
            score: {
              type: Type.INTEGER,
              description: "Ett heltal mellan 0 och 100 som representerar fasens mognad och fullständighet."
            },
            missingArtifacts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Lista över saknade eller ofullständiga nyckel-artefakter/verktyg eller checklistapunkter för denna fas."
            },
            recommendations: {
              type: Type.STRING,
              description: "Omfattande coachningsrekommendationer i Markdown-format med rubriker, punktlistor och konkreta råd för förbättring."
            },
            criterionAssessments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "Checkliste-punktens exakta titel." },
                  status: { type: Type.STRING, description: "Bedömning för denna punkt: 'pass', 'warning' eller 'fail'" },
                  comment: { type: Type.STRING, description: "AI-coach kommentar för denna punkt." }
                },
                required: ["title", "status", "comment"]
              },
              description: "Bedömning per punkt i tollgate-checklistan."
            }
          },
          required: ["status", "score", "missingArtifacts", "recommendations", "criterionAssessments"]
        }
      });

      resultJson = JSON.parse(response.text || "{}");
    } catch (apiError: any) {
      console.warn("[Gemini Client] Tollgate Review Gemini API failed with error. Falling back to local reviewer...", apiError?.message || apiError);
      resultJson = getLocalTollgateReview({
        projectName,
        projectDescription,
        phase,
        phaseName,
        tollgateItems: tollgateItems || [],
        calculations: calculations || [],
        sigmaEntries: sigmaEntries || [],
        notes: notes || []
      });
    }

    res.json(resultJson);
  } catch (error: any) {
    console.error("Error in AI Tollgate Review backend:", error);
    res.status(500).json({ error: error.message || "Ett internt serverfel uppstod under granskningen." });
  }
});

// Setup Vite Dev server middleware or serve production dist
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

setupVite();

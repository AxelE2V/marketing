/**
 * Google Apps Script - Analyse intelligente des sessions du calculateur AMCore
 * UNE SEULE ligne par session avec résumé complet
 */

const SPREADSHEET_ID = '1VXFNL4ocE-rOutifPWPDkXEKLwkZFw38Bh3bKX6bx_A';

function doPost(e) {
  try {
    const rawData = e.parameter.data;
    const data = JSON.parse(rawData);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // Feuille principale : "Sessions" - UNE ligne par session
    let sheet = ss.getSheetByName('Sessions');
    if (!sheet) {
      sheet = ss.insertSheet('Sessions');
      sheet.appendRow([
        'Timestamp', 'User ID', 'Session ID',
        'Duration (min)', 'Nb Changes',
        // Config finale
        'Final Savings (£)', 'Final Hours Saved', 'Final PRN Recovered (£)',
        'Final PRN Hrs/Week', 'Final Hourly Rate (£)', 'Final Missed PRN (%)',
        'Final Tonnage (t)', 'Final PRN Value (£)', 'Final Automation (%)',
        'Final Incidents/Year', 'Final Incident Cost (£)', 'Final Incident Reduction (%)',
        // Analyse comportementale
        'Confidence (%)', 'Behavior Type', 'Exploration Range (£)',
        'Avg Savings Explored (£)', 'Time on Final Config (s)',
        // Tendances
        'Tonnage Trend', 'Price Trend', 'Risk Appetite',
        'Analysis Summary'
      ]);
      sheet.getRange(1, 1, 1, 26).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    // Analyser la session
    const analysis = analyzeSession(data);

    // Insérer UNE SEULE ligne
    sheet.appendRow([
      new Date().toISOString(),
      data.userId,
      data.sessionId,
      Math.round(data.totalSessionSeconds / 60 * 10) / 10, // minutes avec 1 décimale
      data.totalChanges,
      // Config finale
      analysis.finalConfig?.results?.totalAnnualSavings || 0,
      analysis.finalConfig?.results?.prnHoursSaved || 0,
      analysis.finalConfig?.results?.prnRecovered || 0,
      analysis.finalConfig?.inputs?.prnHoursPerWeek || 0,
      analysis.finalConfig?.inputs?.prnHourlyRate || 0,
      analysis.finalConfig?.inputs?.missedPrnRate || 0,
      analysis.finalConfig?.inputs?.monthlyTonnage || 0,
      analysis.finalConfig?.inputs?.prnValuePerTonne || 0,
      analysis.finalConfig?.inputs?.automationReduction || 0,
      analysis.finalConfig?.inputs?.contaminationIncidentsPerYear || 0,
      analysis.finalConfig?.inputs?.avgIncidentCost || 0,
      analysis.finalConfig?.inputs?.incidentReduction || 0,
      // Analyse comportementale
      analysis.confidence,
      analysis.behaviorType,
      analysis.explorationRange,
      analysis.avgSavings,
      analysis.timeOnFinalConfig,
      // Tendances
      analysis.tonnageTrend,
      analysis.priceTrend,
      analysis.riskAppetite,
      analysis.summary
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    console.error('Error:', error);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function analyzeSession(data) {
  const configs = data.configHistory || [];
  const finalConfig = data.finalConfig;

  if (configs.length === 0) {
    return {
      finalConfig: null,
      confidence: 0,
      behaviorType: 'No interaction',
      explorationRange: 0,
      avgSavings: 0,
      timeOnFinalConfig: 0,
      tonnageTrend: 'N/A',
      priceTrend: 'N/A',
      riskAppetite: 'N/A',
      summary: 'User did not interact with the calculator'
    };
  }

  // Extraire les valeurs pour analyse
  const savings = configs.map(c => c.results?.totalAnnualSavings || 0);
  const tonnages = configs.map(c => c.inputs?.monthlyTonnage || 0);
  const incidentCosts = configs.map(c => c.inputs?.avgIncidentCost || 0);
  const durations = configs.map(c => c.durationMs || 0);

  const totalDuration = durations.reduce((a, b) => a + b, 0);
  const finalDuration = finalConfig?.durationMs || 0;

  // Calculs statistiques
  const minSavings = Math.min(...savings);
  const maxSavings = Math.max(...savings);
  const avgSavings = Math.round(savings.reduce((a, b) => a + b, 0) / savings.length);
  const explorationRange = maxSavings - minSavings;

  // Confiance : basée sur le temps passé sur la config finale vs temps total
  const confidence = totalDuration > 0
    ? Math.min(100, Math.round((finalDuration / totalDuration) * 100 + (configs.length < 3 ? 30 : 0)))
    : 50;

  // Type de comportement
  let behaviorType;
  if (configs.length <= 2) {
    behaviorType = 'Decided';
  } else if (configs.length <= 5) {
    behaviorType = 'Methodical';
  } else if (configs.length <= 10) {
    behaviorType = 'Explorer';
  } else {
    behaviorType = 'Deep Explorer';
  }

  // Tendance tonnage
  const tonnageTrend = analyzeTrend(tonnages);

  // Tendance prix/économies
  const priceTrend = analyzeTrend(savings);

  // Appétit pour le risque (basé sur les coûts d'incidents explorés)
  const avgIncidentCost = incidentCosts.reduce((a, b) => a + b, 0) / incidentCosts.length;
  let riskAppetite;
  if (avgIncidentCost > 150000) {
    riskAppetite = 'High awareness';
  } else if (avgIncidentCost > 80000) {
    riskAppetite = 'Moderate awareness';
  } else {
    riskAppetite = 'Conservative';
  }

  // Résumé textuel
  const summary = generateSummary(data, configs, finalConfig, behaviorType, confidence, explorationRange);

  return {
    finalConfig,
    confidence,
    behaviorType,
    explorationRange,
    avgSavings,
    timeOnFinalConfig: Math.round(finalDuration / 1000),
    tonnageTrend,
    priceTrend,
    riskAppetite,
    summary
  };
}

function analyzeTrend(values) {
  if (values.length < 2) return 'Stable';

  const first = values.slice(0, Math.ceil(values.length / 2));
  const second = values.slice(Math.ceil(values.length / 2));

  const avgFirst = first.reduce((a, b) => a + b, 0) / first.length;
  const avgSecond = second.reduce((a, b) => a + b, 0) / second.length;

  const change = (avgSecond - avgFirst) / avgFirst * 100;

  if (change > 15) return 'Increasing';
  if (change < -15) return 'Decreasing';
  return 'Stable';
}

function generateSummary(data, configs, finalConfig, behaviorType, confidence, explorationRange) {
  const parts = [];

  // Comportement
  if (behaviorType === 'Decided') {
    parts.push('Quick decision maker - knew their numbers');
  } else if (behaviorType === 'Deep Explorer') {
    parts.push('Thoroughly explored options');
  } else {
    parts.push(`${behaviorType} approach`);
  }

  // Confiance
  if (confidence >= 80) {
    parts.push('high confidence in final config');
  } else if (confidence >= 50) {
    parts.push('moderate confidence');
  } else {
    parts.push('still exploring');
  }

  // Range exploré
  if (explorationRange > 100000) {
    parts.push(`wide savings range explored (£${Math.round(explorationRange/1000)}k)`);
  }

  // Config finale
  if (finalConfig?.results?.totalAnnualSavings) {
    parts.push(`settled on £${Math.round(finalConfig.results.totalAnnualSavings/1000)}k savings`);
  }

  // Tonnage final (indicateur de taille d'opération)
  if (finalConfig?.inputs?.monthlyTonnage) {
    const t = finalConfig.inputs.monthlyTonnage;
    if (t >= 4000) {
      parts.push('large operation');
    } else if (t >= 2000) {
      parts.push('medium operation');
    } else {
      parts.push('smaller operation');
    }
  }

  return parts.join('. ') + '.';
}

function doGet(e) {
  return ContentService
    .createTextOutput('AMCore Tracker - Intelligent Session Analysis')
    .setMimeType(ContentService.MimeType.TEXT);
}

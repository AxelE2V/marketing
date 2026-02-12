/**
 * Google Apps Script - Analyse intelligente des sessions du calculateur Tyre EPR
 * eco2Veritas x GeoCycle - Mexico Market
 * UNE SEULE ligne par session avec résumé complet
 */

const SPREADSHEET_ID = '1SIkxQ108FoHuzDtdVac4kUR9Q4tkIupRPTdso24AqQ8';

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
        // Scenario sélectionné
        'Selected Year', 'Market Share (%)', 'Volume (tonnes)',
        // Config finale - Market Parameters
        'Total Market (t)', 'Petcoke Price ($/t)', 'TDF Discount (%)',
        // Config finale - Value Chain Costs
        'Garage Fee ($/t)', 'Collection Fee ($/t)', 'Transport Fee ($/t)',
        'Shredding Fee ($/t)', 'Certification Fee ($/t)',
        // Résultats calculés
        'Total Eco-Fee ($)', 'Eco-Fee per Tonne ($/t)',
        'E2V Revenue ($)', 'E2V Margin (%)',
        'GeoCycle Savings ($)', 'TDF Price ($/t)',
        // Analyse comportementale
        'Confidence (%)', 'Behavior Type', 'Volume Range Explored (t)',
        'Avg Volume Explored (t)', 'Time on Final Config (s)',
        // Tendances
        'Volume Trend', 'Price Trend', 'Fee Exploration',
        'Analysis Summary'
      ]);
      sheet.getRange(1, 1, 1, 30).setFontWeight('bold');
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
      // Scenario
      analysis.finalConfig?.scenario?.year || 'Year 1',
      analysis.finalConfig?.scenario?.marketShare || 3,
      analysis.finalConfig?.scenario?.volume || 13500,
      // Market Parameters
      analysis.finalConfig?.inputs?.totalMarket || 450000,
      analysis.finalConfig?.inputs?.petcokePrice || 120,
      analysis.finalConfig?.inputs?.tdfDiscount || 25,
      // Value Chain Costs
      analysis.finalConfig?.inputs?.garageFee || 45,
      analysis.finalConfig?.inputs?.collectionFee || 12,
      analysis.finalConfig?.inputs?.transportFee || 30,
      analysis.finalConfig?.inputs?.shreddingFee || 17,
      analysis.finalConfig?.inputs?.certificationFee || 15,
      // Results
      analysis.finalConfig?.results?.totalEcoFee || 0,
      analysis.finalConfig?.results?.ecoFeePerTonne || 119,
      analysis.finalConfig?.results?.e2vRevenue || 0,
      analysis.finalConfig?.results?.e2vMargin || 40,
      analysis.finalConfig?.results?.geocycleSavings || 0,
      analysis.finalConfig?.results?.tdfPrice || 0,
      // Analyse comportementale
      analysis.confidence,
      analysis.behaviorType,
      analysis.volumeRange,
      analysis.avgVolume,
      analysis.timeOnFinalConfig,
      // Tendances
      analysis.volumeTrend,
      analysis.priceTrend,
      analysis.feeExploration,
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
      volumeRange: 0,
      avgVolume: 0,
      timeOnFinalConfig: 0,
      volumeTrend: 'N/A',
      priceTrend: 'N/A',
      feeExploration: 'N/A',
      summary: 'User did not interact with the calculator'
    };
  }

  // Extraire les valeurs pour analyse
  const volumes = configs.map(c => c.scenario?.volume || c.inputs?.volume || 13500);
  const ecoFees = configs.map(c => c.results?.totalEcoFee || 0);
  const geocycleSavings = configs.map(c => c.results?.geocycleSavings || 0);
  const durations = configs.map(c => c.durationMs || 0);

  const totalDuration = durations.reduce((a, b) => a + b, 0);
  const finalDuration = finalConfig?.durationMs || 0;

  // Calculs statistiques
  const minVolume = Math.min(...volumes);
  const maxVolume = Math.max(...volumes);
  const avgVolume = Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length);
  const volumeRange = maxVolume - minVolume;

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

  // Tendance volume
  const volumeTrend = analyzeTrend(volumes);

  // Tendance économies GeoCycle
  const priceTrend = analyzeTrend(geocycleSavings);

  // Exploration des frais (basé sur la variance des eco-fees)
  const avgEcoFee = ecoFees.reduce((a, b) => a + b, 0) / ecoFees.length;
  const feeVariance = ecoFees.reduce((a, b) => a + Math.pow(b - avgEcoFee, 2), 0) / ecoFees.length;
  let feeExploration;
  if (feeVariance > 100000000) { // High variance
    feeExploration = 'Wide exploration';
  } else if (feeVariance > 10000000) {
    feeExploration = 'Moderate exploration';
  } else {
    feeExploration = 'Focused';
  }

  // Résumé textuel
  const summary = generateSummary(data, configs, finalConfig, behaviorType, confidence, volumeRange);

  return {
    finalConfig,
    confidence,
    behaviorType,
    volumeRange,
    avgVolume,
    timeOnFinalConfig: Math.round(finalDuration / 1000),
    volumeTrend,
    priceTrend,
    feeExploration,
    summary
  };
}

function analyzeTrend(values) {
  if (values.length < 2) return 'Stable';

  const first = values.slice(0, Math.ceil(values.length / 2));
  const second = values.slice(Math.ceil(values.length / 2));

  const avgFirst = first.reduce((a, b) => a + b, 0) / first.length;
  const avgSecond = second.reduce((a, b) => a + b, 0) / second.length;

  if (avgFirst === 0) return 'Stable';
  const change = (avgSecond - avgFirst) / avgFirst * 100;

  if (change > 15) return 'Increasing';
  if (change < -15) return 'Decreasing';
  return 'Stable';
}

function generateSummary(data, configs, finalConfig, behaviorType, confidence, volumeRange) {
  const parts = [];

  // Comportement
  if (behaviorType === 'Decided') {
    parts.push('Quick decision maker - knew their scenario');
  } else if (behaviorType === 'Deep Explorer') {
    parts.push('Thoroughly explored multi-year scenarios');
  } else {
    parts.push(`${behaviorType} approach`);
  }

  // Confiance
  if (confidence >= 80) {
    parts.push('high confidence in final scenario');
  } else if (confidence >= 50) {
    parts.push('moderate confidence');
  } else {
    parts.push('still exploring options');
  }

  // Range volume exploré
  if (volumeRange > 50000) {
    parts.push(`wide volume range explored (${Math.round(volumeRange/1000)}k tonnes)`);
  }

  // Scenario final
  if (finalConfig?.scenario?.year) {
    parts.push(`settled on ${finalConfig.scenario.year}`);
  }

  // Volume final (indicateur d'ambition)
  if (finalConfig?.scenario?.volume) {
    const v = finalConfig.scenario.volume;
    if (v >= 100000) {
      parts.push('targeting scale deployment (100k+ t)');
    } else if (v >= 40000) {
      parts.push('growth phase target');
    } else {
      parts.push('pilot phase focus');
    }
  }

  // GeoCycle savings
  if (finalConfig?.results?.geocycleSavings) {
    const s = finalConfig.results.geocycleSavings;
    parts.push(`GeoCycle savings: $${Math.round(s/1000)}k`);
  }

  return parts.join('. ') + '.';
}

function doGet(e) {
  return ContentService
    .createTextOutput('Tyre EPR Tracker - eco2Veritas x GeoCycle Session Analysis')
    .setMimeType(ContentService.MimeType.TEXT);
}

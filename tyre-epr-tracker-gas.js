/**
 * Google Apps Script - Tyre EPR Calculator Session Tracker
 * eco2Veritas x GeoCycle - Mexico Market
 * Version compatible Google Apps Script (sans optional chaining)
 */

var SPREADSHEET_ID = '1SIkxQ108FoHuzDtdVac4kUR9Q4tkIupRPTdso24AqQ8';

function doPost(e) {
  try {
    var rawData = e.parameter.data;
    var data = JSON.parse(rawData);
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    var sheet = ss.getSheetByName('Sessions');
    if (!sheet) {
      sheet = ss.insertSheet('Sessions');
      sheet.appendRow([
        'Timestamp', 'User ID', 'Session ID',
        'Duration (min)', 'Nb Changes',
        'Selected Year', 'Market Share (%)', 'Volume (tonnes)',
        'Total Market (t)', 'Petcoke Price ($/t)', 'TDF Discount (%)',
        'Garage Fee ($/t)', 'Collection Fee ($/t)', 'Transport Fee ($/t)',
        'Shredding Fee ($/t)', 'Certification Fee ($/t)',
        'Total Eco-Fee ($)', 'Eco-Fee per Tonne ($/t)',
        'E2V Revenue ($)', 'E2V Margin (%)',
        'GeoCycle Savings ($)', 'TDF Price ($/t)',
        'Confidence (%)', 'Behavior Type', 'Volume Range Explored (t)',
        'Avg Volume Explored (t)', 'Time on Final Config (s)',
        'Volume Trend', 'Price Trend', 'Fee Exploration',
        'Analysis Summary'
      ]);
      sheet.getRange(1, 1, 1, 31).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    var analysis = analyzeSession(data);
    var fc = analysis.finalConfig || {};
    var scenario = fc.scenario || {};
    var inputs = fc.inputs || {};
    var results = fc.results || {};

    sheet.appendRow([
      new Date().toISOString(),
      data.userId || 'anonymous',
      data.sessionId || '',
      Math.round((data.totalSessionSeconds || 0) / 60 * 10) / 10,
      data.totalChanges || 0,
      scenario.year || 1,
      scenario.marketShare || 3,
      scenario.volume || 13500,
      inputs.totalMarket || 450000,
      inputs.petcokePrice || 120,
      inputs.tdfDiscount || 25,
      inputs.garageFee || 45,
      inputs.collectionFee || 12,
      inputs.transportFee || 30,
      inputs.shreddingFee || 17,
      inputs.certificationFee || 15,
      results.totalEcoFee || 0,
      results.ecoFeePerTonne || 119,
      results.e2vRevenue || 0,
      results.e2vMargin || 40,
      results.geocycleSavings || 0,
      results.tdfPrice || 0,
      analysis.confidence,
      analysis.behaviorType,
      analysis.volumeRange,
      analysis.avgVolume,
      analysis.timeOnFinalConfig,
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
  var configs = data.configHistory || [];
  var finalConfig = data.finalConfig || null;

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

  var volumes = configs.map(function(c) {
    var s = c.scenario || {};
    var i = c.inputs || {};
    return s.volume || i.volume || 13500;
  });

  var ecoFees = configs.map(function(c) {
    var r = c.results || {};
    return r.totalEcoFee || 0;
  });

  var geocycleSavings = configs.map(function(c) {
    var r = c.results || {};
    return r.geocycleSavings || 0;
  });

  var durations = configs.map(function(c) {
    return c.durationMs || 0;
  });

  var totalDuration = durations.reduce(function(a, b) { return a + b; }, 0);
  var finalDuration = (finalConfig && finalConfig.durationMs) ? finalConfig.durationMs : 0;

  var minVolume = Math.min.apply(null, volumes);
  var maxVolume = Math.max.apply(null, volumes);
  var sumVolume = volumes.reduce(function(a, b) { return a + b; }, 0);
  var avgVolume = Math.round(sumVolume / volumes.length);
  var volumeRange = maxVolume - minVolume;

  var confidence = totalDuration > 0
    ? Math.min(100, Math.round((finalDuration / totalDuration) * 100 + (configs.length < 3 ? 30 : 0)))
    : 50;

  var behaviorType;
  if (configs.length <= 2) {
    behaviorType = 'Decided';
  } else if (configs.length <= 5) {
    behaviorType = 'Methodical';
  } else if (configs.length <= 10) {
    behaviorType = 'Explorer';
  } else {
    behaviorType = 'Deep Explorer';
  }

  var volumeTrend = analyzeTrend(volumes);
  var priceTrend = analyzeTrend(geocycleSavings);

  var sumEcoFee = ecoFees.reduce(function(a, b) { return a + b; }, 0);
  var avgEcoFee = sumEcoFee / ecoFees.length;
  var feeVariance = ecoFees.reduce(function(a, b) {
    return a + Math.pow(b - avgEcoFee, 2);
  }, 0) / ecoFees.length;

  var feeExploration;
  if (feeVariance > 100000000) {
    feeExploration = 'Wide exploration';
  } else if (feeVariance > 10000000) {
    feeExploration = 'Moderate exploration';
  } else {
    feeExploration = 'Focused';
  }

  var summary = generateSummary(finalConfig, behaviorType, confidence, volumeRange);

  return {
    finalConfig: finalConfig,
    confidence: confidence,
    behaviorType: behaviorType,
    volumeRange: volumeRange,
    avgVolume: avgVolume,
    timeOnFinalConfig: Math.round(finalDuration / 1000),
    volumeTrend: volumeTrend,
    priceTrend: priceTrend,
    feeExploration: feeExploration,
    summary: summary
  };
}

function analyzeTrend(values) {
  if (values.length < 2) return 'Stable';

  var mid = Math.ceil(values.length / 2);
  var first = values.slice(0, mid);
  var second = values.slice(mid);

  var sumFirst = first.reduce(function(a, b) { return a + b; }, 0);
  var sumSecond = second.reduce(function(a, b) { return a + b; }, 0);
  var avgFirst = sumFirst / first.length;
  var avgSecond = sumSecond / second.length;

  if (avgFirst === 0) return 'Stable';
  var change = (avgSecond - avgFirst) / avgFirst * 100;

  if (change > 15) return 'Increasing';
  if (change < -15) return 'Decreasing';
  return 'Stable';
}

function generateSummary(finalConfig, behaviorType, confidence, volumeRange) {
  var parts = [];

  if (behaviorType === 'Decided') {
    parts.push('Quick decision maker');
  } else if (behaviorType === 'Deep Explorer') {
    parts.push('Thoroughly explored scenarios');
  } else {
    parts.push(behaviorType + ' approach');
  }

  if (confidence >= 80) {
    parts.push('high confidence');
  } else if (confidence >= 50) {
    parts.push('moderate confidence');
  } else {
    parts.push('still exploring');
  }

  if (volumeRange > 50000) {
    parts.push('wide range (' + Math.round(volumeRange/1000) + 'k t)');
  }

  if (finalConfig && finalConfig.scenario && finalConfig.scenario.year) {
    parts.push('Year ' + finalConfig.scenario.year);
  }

  if (finalConfig && finalConfig.scenario && finalConfig.scenario.volume) {
    var v = finalConfig.scenario.volume;
    if (v >= 100000) {
      parts.push('scale target');
    } else if (v >= 40000) {
      parts.push('growth phase');
    } else {
      parts.push('pilot focus');
    }
  }

  if (finalConfig && finalConfig.results && finalConfig.results.geocycleSavings) {
    var s = finalConfig.results.geocycleSavings;
    parts.push('GC saves $' + Math.round(s/1000) + 'k');
  }

  return parts.join('. ') + '.';
}

function doGet(e) {
  return ContentService
    .createTextOutput('Tyre EPR Tracker - eco2Veritas x GeoCycle')
    .setMimeType(ContentService.MimeType.TEXT);
}

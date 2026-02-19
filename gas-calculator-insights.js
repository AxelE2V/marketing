/**
 * Google Apps Script — Calculator Insights (E2V Outreach)
 * Mechanical Recycling Workflow Simulator — Behavioral Analytics
 *
 * Scientific foundations:
 * - Fogg Behavior Model (B=MAT): Motivation × Ability × Trigger
 * - Kahneman Peak-End Rule & Anchoring Effect (1974)
 * - Kissmetrics optimal engagement research (3-7 min sessions)
 * - B2B SaaS interactive demo conversion benchmarks
 *
 * SETUP:
 * 1. Open the E2V Outreach Google Sheet
 * 2. Extensions → Apps Script
 * 3. Paste this code, save
 * 4. Deploy → New deployment → Web app → Anyone can access
 * 5. Copy the URL → paste into Tracker.ENDPOINT in the HTML
 */

const SPREADSHEET_ID = '1VXFNL4ocE-rOutifPWPDkXEKLwkZFw38Bh3bKX6bx_A';
const SHEET_NAME = 'Calculator Insights';

function doPost(e) {
  try {
    const data = JSON.parse(e.parameter.data);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      const headers = [
        // Session identity (A-F)
        'Timestamp', 'User ID', 'Company', 'Session ID', 'Calculator', 'Is Final',
        // Session metrics (G-L)
        'Duration (min)', 'Slider Changes', 'Total Interactions', 'Tab Switches',
        'Workflows Visited', 'Primary Workflow',
        // Tab dwell times in seconds (M-P)
        'Dwell: Incoming (s)', 'Dwell: PRN/EPR (s)', 'Dwell: Mass Balance (s)', 'Dwell: COA (s)',
        // Results (Q-V)
        'Final Savings (£)', 'Final Hours Saved', 'Peak Savings (£)',
        'Exploration Range (£)', 'Avg Savings (£)', 'Anchoring Bias (%)',
        // Behavioral science (W-AD)
        'Behavior Type', 'Engagement Score', 'Decision Confidence (%)',
        'Stability Score', 'Session Momentum', 'Savings Trend',
        'Conversion Probability (%)', 'Intent Signal',
        // Analysis (AE)
        'Analysis Summary',
        // Per-workflow breakdown (AF-AM)
        'Incoming Savings (£)', 'Incoming Hours',
        'PRN/EPR Savings (£)', 'PRN/EPR Hours',
        'Mass Balance Savings (£)', 'Mass Balance Hours',
        'COA Savings (£)', 'COA Hours',
        // Final inputs (AN)
        'Final Inputs (JSON)'
      ];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sheet.setFrozenRows(1);

      // Color-code header groups
      const headerColors = [
        { range: [1, 1, 1, 6],  color: '#E8F0FE' },  // Session identity - blue
        { range: [1, 7, 1, 6],  color: '#FEF7E0' },  // Metrics - yellow
        { range: [1, 13, 1, 4], color: '#F3E8FD' },   // Dwell times - purple
        { range: [1, 17, 1, 6], color: '#E6F4EA' },   // Results - green
        { range: [1, 23, 1, 8], color: '#FCE8E6' },   // Behavioral - red
        { range: [1, 31, 1, 1], color: '#FFF3E0' },   // Summary - orange
        { range: [1, 32, 1, 8], color: '#E8F5E9' },   // Per-workflow - light green
        { range: [1, 40, 1, 1], color: '#F3E5F5' },   // Inputs JSON - lavender
      ];
      headerColors.forEach(h => {
        sheet.getRange(h.range[0], h.range[1], h.range[2], h.range[3]).setBackground(h.color);
      });
    }

    // Generate deep analysis
    const analysis = analyzeSession(data);

    // Build row
    const dwell = data.tabDwellSeconds || [0, 0, 0, 0];
    sheet.appendRow([
      // Session identity
      new Date().toISOString(),
      data.userId || 'anonymous',
      data.company || '',
      data.sessionId || '',
      data.calculator || 'Mechanical Recycling Simulator',
      data.isFinal ? 'YES' : 'interim',
      // Metrics
      Math.round(data.durationSec / 6) / 10,  // minutes with 1 decimal
      data.sliderChanges || 0,
      data.totalInteractions || 0,
      data.tabSwitches || 0,
      data.workflowsVisited || '',
      data.primaryWorkflow || '',
      // Dwell
      dwell[0] || 0, dwell[1] || 0, dwell[2] || 0, dwell[3] || 0,
      // Results
      data.finalSavings || 0,
      data.finalHours || 0,
      data.peakSavings || 0,
      data.explorationRange || 0,
      data.avgSavings || 0,
      data.anchoringBias || 0,
      // Behavioral
      data.behaviorType || 'Unknown',
      data.engagementScore || 0,
      data.confidence || 0,
      data.stabilityScore || 0,
      data.momentum || 'Steady',
      data.savingsTrend || 'Stable',
      data.conversionProb || 0,
      data.intentSignal || 'Cold',
      // Summary
      analysis.summary,
      // Per-workflow breakdown
      data.incomingSavings || 0,
      data.incomingHours || 0,
      data.prnSavings || 0,
      data.prnHours || 0,
      data.massBalanceSavings || 0,
      data.massBalanceHours || 0,
      data.coaSavings || 0,
      data.coaHours || 0,
      // Final inputs
      data.finalInputs || ''
    ]);

    // Conditional formatting for Intent Signal (if first data row)
    if (sheet.getLastRow() === 2) {
      applyConditionalFormatting(sheet);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    console.error('Calculator Insights Error:', error);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Deep session analysis — generates human-readable summary
 * combining all behavioral signals.
 */
function analyzeSession(data) {
  const parts = [];

  // 1. User profile
  const user = data.userId !== 'anonymous' ? data.userId : 'Anonymous visitor';
  const company = data.company ? ` (${data.company})` : '';

  // 2. Engagement narrative
  const dur = Math.round(data.durationSec / 60 * 10) / 10;
  if (dur < 1) {
    parts.push('Brief glance (<1 min)');
  } else if (dur < 3) {
    parts.push(`Quick review (${dur} min)`);
  } else if (dur <= 7) {
    parts.push(`Optimal engagement window (${dur} min)`);
  } else if (dur <= 15) {
    parts.push(`Deep session (${dur} min)`);
  } else {
    parts.push(`Extended session (${dur} min) — possible meeting/demo context`);
  }

  // 3. Behavior pattern
  const bt = data.behaviorType || 'Unknown';
  if (bt === 'Decided') {
    parts.push('quick decision maker — knew their numbers');
  } else if (bt === 'Methodical') {
    parts.push('methodical approach — systematic parameter testing');
  } else if (bt === 'Explorer') {
    parts.push('thorough explorer — tested multiple scenarios');
  } else if (bt === 'Deep Explorer') {
    parts.push('deep explorer — exhaustive scenario analysis');
  }

  // 4. Workflow coverage
  const wfCount = (data.workflowsVisited || '').split(',').filter(w => w.trim()).length;
  if (wfCount >= 4) {
    parts.push('explored all 4 workflows');
  } else if (wfCount >= 2) {
    parts.push(`focused on ${wfCount} workflows (primary: ${data.primaryWorkflow || 'unknown'})`);
  } else {
    parts.push(`single workflow focus: ${data.primaryWorkflow || 'Incoming Goods'}`);
  }

  // 5. Anchoring bias interpretation
  const anchor = data.anchoringBias || 0;
  if (Math.abs(anchor) > 30) {
    parts.push(anchor > 0
      ? `shifted ${anchor}% above initial anchor — optimistic re-evaluation`
      : `reduced expectations by ${Math.abs(anchor)}% from anchor — conservative adjustment`);
  }

  // 6. Final results
  const savings = data.finalSavings || 0;
  if (savings > 0) {
    parts.push(`settled on £${Math.round(savings/1000)}k annual savings`);
  }

  // 7. Conversion signal
  const intent = data.intentSignal || 'Cold';
  const prob = data.conversionProb || 0;
  if (intent === 'Hot') {
    parts.push(`HIGH intent (${prob}% conversion probability) — prioritize follow-up`);
  } else if (intent === 'Warm') {
    parts.push(`moderate intent (${prob}%) — nurture with case study`);
  } else {
    parts.push(`low intent (${prob}%) — early stage, send more info`);
  }

  return {
    summary: `${user}${company}: ${parts.join('. ')}.`
  };
}

/**
 * Apply conditional formatting for visual dashboard feel
 */
function applyConditionalFormatting(sheet) {
  // Intent Signal column (AD = col 30)
  const intentCol = 30;
  const range = sheet.getRange(2, intentCol, 500, 1);

  // Hot = green
  const hotRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('Hot')
    .setBackground('#D5F5E3')
    .setFontColor('#1E8449')
    .setRanges([range])
    .build();

  // Warm = orange
  const warmRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('Warm')
    .setBackground('#FEF9E7')
    .setFontColor('#B7950B')
    .setRanges([range])
    .build();

  // Cold = red
  const coldRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('Cold')
    .setBackground('#FDEDEC')
    .setFontColor('#C0392B')
    .setRanges([range])
    .build();

  // Conversion probability column (AC = col 29) - color scale
  const probRange = sheet.getRange(2, 29, 500, 1);
  const probRule = SpreadsheetApp.newConditionalFormatRule()
    .setGradientMinpointWithValue('#FDEDEC', SpreadsheetApp.InterpolationType.NUMBER, '0')
    .setGradientMidpointWithValue('#FEF9E7', SpreadsheetApp.InterpolationType.NUMBER, '50')
    .setGradientMaxpointWithValue('#D5F5E3', SpreadsheetApp.InterpolationType.NUMBER, '100')
    .setRanges([probRange])
    .build();

  // Engagement Score column (X = col 24)
  const engRange = sheet.getRange(2, 24, 500, 1);
  const engRule = SpreadsheetApp.newConditionalFormatRule()
    .setGradientMinpointWithValue('#F2F4F4', SpreadsheetApp.InterpolationType.NUMBER, '0')
    .setGradientMidpointWithValue('#D4EFDF', SpreadsheetApp.InterpolationType.NUMBER, '50')
    .setGradientMaxpointWithValue('#82E0AA', SpreadsheetApp.InterpolationType.NUMBER, '100')
    .setRanges([engRange])
    .build();

  const rules = sheet.getConditionalFormatRules();
  rules.push(hotRule, warmRule, coldRule, probRule, engRule);
  sheet.setConditionalFormatRules(rules);
}

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || '';

  if (action === 'getData') {
    try {
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      const sheet = ss.getSheetByName(SHEET_NAME);

      if (!sheet || sheet.getLastRow() <= 1) {
        return ContentService
          .createTextOutput(JSON.stringify({ rows: [] }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
      const data = dataRange.getValues();

      const rows = data.map(function(row) {
        var obj = {};
        headers.forEach(function(header, idx) {
          obj[header] = row[idx];
        });
        return obj;
      });

      return ContentService
        .createTextOutput(JSON.stringify({ rows: rows }))
        .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
      return ContentService
        .createTextOutput(JSON.stringify({ error: error.toString(), rows: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService
    .createTextOutput('E2V Calculator Insights — Mechanical Recycling Simulator Tracker')
    .setMimeType(ContentService.MimeType.TEXT);
}

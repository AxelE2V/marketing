/**
 * Google Apps Script pour recevoir les données de tracking du calculateur AMCore
 *
 * INSTRUCTIONS DE DÉPLOIEMENT:
 * 1. Allez sur https://script.google.com et créez un nouveau projet
 * 2. Copiez-collez ce code dans le fichier Code.gs
 * 3. Cliquez sur "Déployer" > "Nouveau déploiement"
 * 4. Choisissez "Application Web"
 * 5. Configurez:
 *    - Exécuter en tant que: "Moi"
 *    - Qui a accès: "Tout le monde"
 * 6. Cliquez sur "Déployer" et copiez l'URL générée
 * 7. Collez cette URL dans amcor-calculator.html à la place de 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE'
 */

// ID de votre Google Sheet (créez-en un et copiez l'ID depuis l'URL)
// L'URL ressemble à: https://docs.google.com/spreadsheets/d/VOTRE_ID_ICI/edit
const SPREADSHEET_ID = 'VOTRE_SPREADSHEET_ID_ICI';

function doPost(e) {
  try {
    // Lire les données depuis form-urlencoded (évite les erreurs CORS)
    const rawData = e.parameter.data;
    const data = JSON.parse(rawData);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // Feuille "Sessions" - une ligne par session
    let sessionsSheet = ss.getSheetByName('Sessions');
    if (!sessionsSheet) {
      sessionsSheet = ss.insertSheet('Sessions');
      sessionsSheet.appendRow([
        'Timestamp', 'Session ID', 'User ID', 'Session Start',
        'Total Duration (s)', 'Config Count', 'Longest Dwell (s)',
        'Longest Dwell Savings (£)', 'Savings Min (£)', 'Savings Max (£)',
        'Is Final Event'
      ]);
      sessionsSheet.getRange(1, 1, 1, 11).setFontWeight('bold');
    }

    // Feuille "Configurations" - une ligne par configuration testée
    let configsSheet = ss.getSheetByName('Configurations');
    if (!configsSheet) {
      configsSheet = ss.insertSheet('Configurations');
      configsSheet.appendRow([
        'Timestamp', 'Session ID', 'User ID', 'Config Time', 'Duration (s)',
        'Total Savings (£)', 'Hours Saved', 'Incidents Avoided', 'PRN Recovered (£)',
        // Inputs
        'PRN Hours/Week', 'PRN Hourly Rate (£)', 'Missed PRN Rate (%)',
        'Monthly Tonnage (t)', 'PRN Value/Tonne (£)', 'Automation Reduction (%)',
        'Incidents/Year', 'Avg Incident Cost (£)', 'Incident Reduction (%)'
      ]);
      configsSheet.getRange(1, 1, 1, 18).setFontWeight('bold');
    }

    // Feuille "Users" - résumé par utilisateur
    let usersSheet = ss.getSheetByName('Users');
    if (!usersSheet) {
      usersSheet = ss.insertSheet('Users');
      usersSheet.appendRow([
        'User ID', 'First Seen', 'Last Seen', 'Total Sessions',
        'Total Time (s)', 'Avg Savings Explored (£)', 'Most Likely Config Savings (£)'
      ]);
      usersSheet.getRange(1, 1, 1, 7).setFontWeight('bold');
    }

    const now = new Date().toISOString();

    // Ajouter la session
    if (data.summary) {
      sessionsSheet.appendRow([
        now,
        data.sessionId,
        data.userId,
        data.sessionStart,
        data.totalSessionSeconds,
        data.summary.configCount,
        data.summary.longestDwellSeconds,
        data.summary.longestDwellSavings,
        data.summary.savingsRange?.min,
        data.summary.savingsRange?.max,
        data.isFinalEvent
      ]);
    }

    // Ajouter chaque configuration
    if (data.configurations && data.configurations.length > 0) {
      data.configurations.forEach(config => {
        configsSheet.appendRow([
          now,
          data.sessionId,
          data.userId,
          config.timestampISO,
          config.durationSeconds,
          config.results.totalAnnualSavings,
          config.results.prnHoursSaved,
          config.results.incidentsAvoided,
          config.results.prnRecovered,
          // Inputs
          config.inputs.prnHoursPerWeek,
          config.inputs.prnHourlyRate,
          config.inputs.missedPrnRate,
          config.inputs.monthlyTonnage,
          config.inputs.prnValuePerTonne,
          config.inputs.automationReduction,
          config.inputs.contaminationIncidentsPerYear,
          config.inputs.avgIncidentCost,
          config.inputs.incidentReduction
        ]);
      });
    }

    // Mettre à jour le résumé utilisateur
    updateUserSummary(usersSheet, data);

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

function updateUserSummary(sheet, data) {
  const userId = data.userId;
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  let userRow = -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === userId) {
      userRow = i + 1;
      break;
    }
  }

  const now = new Date().toISOString();

  if (userRow === -1) {
    // Nouvel utilisateur
    const avgSavings = data.summary ? data.summary.longestDwellSavings : 0;
    sheet.appendRow([
      userId,
      now, // First seen
      now, // Last seen
      1,   // Total sessions
      data.totalSessionSeconds,
      avgSavings,
      avgSavings // Most likely config
    ]);
  } else {
    // Utilisateur existant - mettre à jour
    const currentSessions = sheet.getRange(userRow, 4).getValue() || 0;
    const currentTime = sheet.getRange(userRow, 5).getValue() || 0;

    sheet.getRange(userRow, 3).setValue(now); // Last seen
    sheet.getRange(userRow, 4).setValue(currentSessions + 1); // Sessions
    sheet.getRange(userRow, 5).setValue(currentTime + data.totalSessionSeconds); // Total time

    if (data.summary && data.summary.longestDwellSeconds > 30) {
      // Si l'utilisateur est resté > 30s sur une config, c'est probablement sa vraie config
      sheet.getRange(userRow, 7).setValue(data.summary.longestDwellSavings);
    }
  }
}

// Fonction pour tester le déploiement
function doGet(e) {
  return ContentService
    .createTextOutput('Tracker endpoint is working!')
    .setMimeType(ContentService.MimeType.TEXT);
}

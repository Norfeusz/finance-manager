const { google } = require('googleapis');
require('dotenv').config({ path: './.env' });

// Zakres uprawnień, jakich potrzebujemy (pełny dostęp do arkuszy)
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Funkcja do autoryzacji
async function getAuthClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_CREDENTIALS_PATH,
    scopes: SCOPES,
  });
  const client = await auth.getClient();
  return client;
}

// Funkcja do uzyskania instancji API Google Sheets
async function getGoogleSheets() {
  const authClient = await getAuthClient();
  const googleSheets = google.sheets({ version: 'v4', auth: authClient });
  return googleSheets;
}

module.exports = { getGoogleSheets };
const rp = require('request-promise');
const cheerio = require('cheerio');
const options = {
  uri: `http://typersi.com/`,
  transform: function(body) {
    return cheerio.load(body);
  }
};

const path = require('path');

// Google API
const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = [ 'https://www.googleapis.com/auth/spreadsheets' ];
const TOKEN_PATH = 'token.json';

const jsonPath = path.join(__dirname, 'page', 'index.html');

let sheets = null;
// Authorize to drive with credentials
fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Sheets API.
  authorize(JSON.parse(content), setSheet);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', code => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error while trying to retrieve access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), err => {
        if (err) console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

setSheet = auth => {
  sheets = google.sheets({ version: 'v4', auth });
};

setRow = (rows, index) => {
  // let values = [
  //   [ tipster, time, match, tip, odds, score ]
  //   // Additional rows ...
  // ];
  const data = [
    {
      range: `Sheet1!A2:F`,
      values: rows
    }
  ];
  // Additional ranges to update ...
  const resource = {
    data,
    valueInputOption: 'RAW'
  };
  sheets.spreadsheets.values.batchUpdate(
    {
      spreadsheetId: '1ix0N2d1G1SeIdc1iae2FDUlfQr5TIvxH5R2pyk0mvYQ',
      // range: 'Sheet1!A2',
      valueInputOption: 'RAW',
      resource //{values: [['MEGESZED']]}
    },
    (err, res) => {
      if (err) return console.log('The API returned an error: ' + err);
      const rows = res.data.values || [];
      if (rows.length) {
        console.log('Name, Major:');
        // Print columns A and E, which correspond to indices 0 and 4.
        rows.map(row => {
          console.log(`${row[0]}, ${row[4]}`);
        });
      } else {
        console.log('No data found.');
      }
    }
  );
};

rp(options)
  .then($ => {
    let readyRows = [];
    $('.tableBox').each((i, el) => {
      // console.log('----> ', i, $($(el).html()).find('h2, h4').text());
      const container = $($(el).html());
      const title = 'Picks from tipsters with the best efficiency';
      console.log(i, '. TABLE ================');
      let tableRows = [];
      let row = {};

      $(container.find(`tr td`)).each((k, tr) => {
        // console.log(idx, idx % 8, $(tr).text().trim());
        const value = $(tr).text().trim();
        const idx = parseInt(k) + 1;
        const mod = parseInt(idx % 8);
        if (mod !== 5 && mod !== 7) {
          switch (mod) {
            case 1: //tipster
              row.tipster = value;
              break;
            case 2: //time
              row.time = value;
              break;
            case 3: //match
              row.match = value;
              break;
            case 4: //tip
              row.tip = value;
              break;
            case 6: //odds
              row.odds = value;
              break;
            case 0: //score
              row.score = value;
              break;

            default:
              break;
          }
        }

        if (mod === 0 && idx !== 1) {
          tableRows.push(row);
          row = {};
        }
      });

      const aggregatedRows = tableRows.reduce((acc, row) => {
        const tmp = [];
        tmp.push(row.tipster);
        tmp.push(row.time);
        tmp.push(row.match);
        tmp.push(row.tip);
        tmp.push(row.odds);
        tmp.push(row.score);
        return [ ...acc, tmp ];
      }, []);

      console.log('====>>>>>>>>>', i, aggregatedRows);
      readyRows = readyRows.concat(aggregatedRows);

    });

    setRow(readyRows);
  })
  .catch(err => {
    console.log(err);
  });

/**
 * This script uses twitch developer application 
 * credentials to poll the twitch api every 60 
 * seconds and broadcast a message through discord 
 * webhook when channels in the linked spreadsheet go live.
 *
 * The following are setup as script attributes:
 * twitchClientId: The client id from the twitch application dashboard
 * twitchClientSecret: The client secret from the twitch application dashboard
 * discordWebhookURL: The URL of the webhook that you find in the discord channel settings
 */

function main() {
  
  let clientId = PropertiesService.getScriptProperties().getProperty('twitchClientId');
  let clientSecret = PropertiesService.getScriptProperties().getProperty('twitchClientSecret');
  
  let oauthToken = getTwitchOAuthToken(clientId, clientSecret);

  let dataRows = getDataRows();

  let streamData = getTwitchLivestreamData(dataRows, clientId, oauthToken);

  broadcastStreamStartToWebhook(streamData, dataRows);  

  overwriteSheet(dataRows);
}

/**
 * Request an oauth token from the twitch api
 */
function getTwitchOAuthToken(clientId, clientSecret) {

  let params = {
    'method': 'post',
    'contentType': 'application/x-www-form-urlencoded'
  };

  let response = UrlFetchApp.fetch(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&grant_type=client_credentials&client_secret=${clientSecret}`, params).getContentText();
  let responseJson = JSON.parse(response);

  return responseJson['access_token'];
}

/**
 * Get all the rows in the spreadsheet as a dictionary list
 */
function getDataRows() {

  let values = SpreadsheetApp.getActiveSheet().getDataRange().getValues();
  let entries = [];
  
  for (i = 1; i < values.length; i++) {
    let entry = {};

    for (j = 0; j < values[0].length; j++) {
      entry[values[0][j]] = values[i][j];
    }

    entries.push(entry);
  }

  return entries;
}

/**
 * Request livestream data for each channel in entries from the twitch api
 */
function getTwitchLivestreamData(entries, clientId, oauthToken) {

  let url = "https://api.twitch.tv/helix/streams?";

  for (var i = 0; i < entries.length; i++) {
    url += `user_login=${entries[i]["channelName"]}&`;
  }

  let params = {
    "method": "get",
    "headers": {"Authorization": `Bearer ${oauthToken}`, "Client-Id": clientId}
  }

  response = UrlFetchApp.fetch(url, params).getContentText();
  
  return JSON.parse(response).data;
}

/**
 * Send a message to the discord webhook for each live channel
 * NOTE: the isOnline value is used to prevent notification spam to the webhook
 */
function broadcastStreamStartToWebhook(streams, sheetEntries) {

  for (var i = 0; i < sheetEntries.length; i++) {
    let streamEntry = getStreamEntryWithChannelName(sheetEntries[i]["channelName"], streams);

    if (streamEntry != null && sheetEntries[i]["isOnline"] == 0) {
      sheetEntries[i]["isOnline"] = 1;
      sendWebhookMessage(streamEntry, sheetEntries[i]["message"]);
    }
    else if (streamEntry == null && sheetEntries[i]["isOnline"] == 1) {
      sheetEntries[i]["isOnline"] = 0;
    }
  }
}

/**
 * Find the specific entry containing the channel name from streamEntries
 * If none are found, return null
 */
function getStreamEntryWithChannelName(channelName, streamEntries) {

  for (var i = 0; i < streamEntries.length; i++) {
    let userName = streamEntries[i]["user_login"];
    if (userName == channelName.toLowerCase()) {
        return streamEntries[i];
    }
  }

  return null;
}

/**
 * Overwrite the spreadsheet with the updated isOnline values
 * NOTE: This actually overwrites the entire sheet because I'm lazy
 */
function overwriteSheet(entries) {
  let sheet = SpreadsheetApp.getActiveSheet();

  for (var i = 0; i < entries.length; i++) {

    let values = [];
    for (var j in entries[i]) {
      values.push(entries[i][j]);
    }
    let range = sheet.getRange(`A${i+2}:C${i+2}`);
    range.setValues([values]);
  }
}

/**
 * Sends a request to the webhook to display a message
 */
function sendWebhookMessage(streamEntry, message) {
  
  let url = PropertiesService.getScriptProperties().getProperty("discordWebhookURL");

  let content = {
      "content": `${message} https://twitch.tv/${streamEntry["user_login"]}`,
    };
  
  let params = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(content)
  };

  UrlFetchApp.fetch(url, params);
}
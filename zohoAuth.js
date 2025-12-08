// zohoAuth.js
const axios = require("axios");
require("dotenv").config();

const ACCOUNTS = process.env.ZOHO_ACCOUNTS_DOMAIN || "https://accounts.zoho.com";

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  const now = Date.now() / 1000;
  if (cachedToken && tokenExpiry - 30 > now) { // if token valid >30s
    return cachedToken;
  }

  const params = new URLSearchParams();
  params.append("refresh_token", process.env.ZOHO_REFRESH_TOKEN);
  params.append("client_id", process.env.ZOHO_CLIENT_ID);
  params.append("client_secret", process.env.ZOHO_CLIENT_SECRET);
  params.append("grant_type", "refresh_token");

  const url = `${ACCOUNTS}/oauth/v2/token`;

  const resp = await axios.post(url, params).catch(err => {
    console.error("Error refreshing Zoho token:", err.response ? err.response.data : err.message);
    throw err;
  });

  cachedToken = resp.data.access_token;
  // Zoho returns expires_in (seconds)
  tokenExpiry = (Date.now() / 1000) + (resp.data.expires_in || 3600);
  return cachedToken;
}

module.exports = { getAccessToken };

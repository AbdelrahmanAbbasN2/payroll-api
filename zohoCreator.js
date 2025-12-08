// zohoCreator.js
const axios = require("axios");
const { getAccessToken } = require("./zohoAuth");
require("dotenv").config();

const OWNER = process.env.ZOHO_OWNER_NAME;
const APP = process.env.CREATOR_APP_LINK;
const CREATOR_BASE = `https://creator.zoho.com/api/v2/${OWNER}/${APP}`;

/**
 * Query Creator form records by criteria using the search API (report API)
 * We'll use the "records" API with criteria query param.
 * NOTE: Creator API syntax for criteria: (Field == "value")
 */
async function queryForm(formLinkName, criteria = "", page = 1, perPage = 200) {
  const token = await getAccessToken();
  // Using list records endpoint:
  const url = `${CREATOR_BASE}/report/${formLinkName}?criteria=${encodeURIComponent(criteria)}&page=${page}&perPage=${perPage}`;
  const resp = await axios.get(url, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` }
  });
  // Creator wraps result: resp.data.data (check actual shape)
  return resp.data;
}

async function updateFormRecord(formLinkName, recordId, dataMap) {
  const token = await getAccessToken();
  const url = `${CREATOR_BASE}/form/${formLinkName}/${recordId}`;
  const resp = await axios.put(url, { data: dataMap }, {
    headers: { Authorization: `Zoho-oauthtoken ${token}`, "Content-Type": "application/json" }
  });
  return resp.data;
}

module.exports = { queryForm, updateFormRecord };

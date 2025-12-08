// zohoPeople.js
const axios = require("axios");
const { getAccessToken } = require("./zohoAuth");

const PEOPLE_BASE = "https://people.zoho.com/people/api"; // may be region-specific; adjust if necessary

async function getEmployees(start = 0, limit = 1, searchParams = {}) {
  const token = await getAccessToken();
  // Endpoint: forms/{formLink}/getRecords?start={start}&limit={limit}
  // Using P_Employee form
  const url = `${PEOPLE_BASE}/forms/P_Employee/getRecords?start=${start}&limit=${limit}`;
  // Append searchMap parameters if needed - Deluge used searchMap variable; for now we ignore it or add query string params
  const resp = await axios.get(url, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` }
  });
  // Response format may be array or map; return data
  const resultObject = resp.data.response.result[0];
  // Get the first employee ID key
  const employeeIdKey = Object.keys(resultObject)[0];
  // Get the employee data array
  const employeeDataArray = resultObject[employeeIdKey];
  // ...existing code...
  return employeeDataArray; // return the array directly
}

async function getAttendance(empId, startDate, endDate) {
  const token = await getAccessToken();
  const url = `https://people.zoho.com/people/api/attendance/getUserReport?empId=${encodeURIComponent(empId)}&sdate=${encodeURIComponent(startDate)}&edate=${encodeURIComponent(endDate)}`;
  const resp = await axios.get(url, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` }
  });
  return resp.data;
}

getEmployees();
module.exports = { getEmployees, getAttendance };

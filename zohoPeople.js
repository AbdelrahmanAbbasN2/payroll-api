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
  // const token = "1000.27de627491f11be00eeebdc7fe67e981.26adcb41a34b54c4715b4ddbff0f8b91";
  const url = `https://people.zoho.com/people/api/attendance/getUserReport?empId=${encodeURIComponent(empId)}&sdate=${encodeURIComponent(startDate)}&edate=${encodeURIComponent(endDate)}`;
  // const url = `https://people.zoho.com/people/api/attendance/getUserReport?empId=sdate=${encodeURIComponent(startDate)}&edate=${encodeURIComponent(endDate)}&startIndex=${empId}`;
  const resp = await axios.get(url, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` }
  });
  return resp.data;
}
async function get_data()
{
  let attendance_response = [];
  for (let i = 0; i < 900; i += 100)
    {
      attendance_response.push(await getAttendance(i, "1-Nov-2025", "30-Nov-2025"))
    }
    console.log(attendance_response);
    console.log(attendance_response.length);
    return attendance_response;
}
get_data();
// getEmployees();
module.exports = { getEmployees, getAttendance };

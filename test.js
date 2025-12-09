const rp = require("request-promise");
const fs = require("fs");
const path = require("path");

async function getAttendance() {
    let employeeId = "ST5114";
    let accessToken = "1000.391d83d9bd76a3936f2d708bc74453d1.840f098a368c8b69940958b598974cb0"
    let sdate = "01-Nov-2025";
    let edate = "30-Nov-2025";
    const attendanceURL =
        `https://people.zoho.com/people/api/attendance/getUserReport?` +
        `&sdate=${sdate}&edate=${edate}&startIndex=99`;

    try {
        const attendanceResponse = await rp({
            uri: attendanceURL,
            method: "GET",
            json: true,
            headers: {
                Authorization: "Zoho-oauthtoken " + accessToken
            }
        });
        console.log(attendanceResponse);
        
        // Save to JSON file
        const outputPath = path.join(__dirname, "attendance_response.json");
        fs.writeFileSync(outputPath, JSON.stringify(attendanceResponse, null, 2));
        console.log(`\nResponse saved to: ${outputPath}`);
    } catch (err) {
        console.error("Error:", err.message);
    }
}

getAttendance();
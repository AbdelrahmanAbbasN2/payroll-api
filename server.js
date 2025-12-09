const express = require("express");
const app = express();

const getEmployeesMonthlyReport = require("./zohoReport.js");

app.get("/", (req, res) => {
  res.send("Zoho Payroll API Server");
});

app.get("/zoho-report", getEmployeesMonthlyReport);

app.listen(3000, () => console.log("Server running on port 3000"));
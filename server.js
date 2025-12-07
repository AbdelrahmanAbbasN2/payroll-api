const express = require("express");
const app = express();

app.use(express.json());

app.post("/calculate", (req, res) => {
    const data = req.body;

    const basicNet = parseFloat(data.basicNet || 0);
    const insuranceRate = 0.11; // 11% employee share

    // --- Reverse Insurance (example formula) ----
    const grossBasic = basicNet / (1 - insuranceRate);
    const insuranceEmployee = grossBasic * insuranceRate;

    const result = {
        gross_basic: Math.round(grossBasic * 100) / 100,
        insurance_employee: Math.round(insuranceEmployee * 100) / 100,
        // Add more values as needed
        message: "Calculation complete"
    };

    return res.json(result);

});

app.get("/", (req, res) => {
    res.send("Welcome to the Salary Calculation API");
});

app.listen(3000, () => console.log("Server running on port 3000"));

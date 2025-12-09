const rp = require("request-promise");
// const getAccessToken = require("./zohoAuth").getAccessToken;

module.exports = async function getEmployeesMonthlyReport(req, res) {
    try {
        // Get access token from request body or headers
        const accessToken = req.body?.accessToken || req.headers?.authorization?.replace("Bearer ", "") || req.query?.accessToken;
        
        if (!accessToken) {
            return res.status(400).json({ 
                success: false, 
                error: "Access token is required. Pass it via: body.accessToken, header Authorization, or query parameter ?accessToken=..." 
            });
        }

        const OWNER = "ahmed_smahmoud_gochat247";
        const APP = "payroll";
        const CREATOR_BASE = `https://creator.zoho.com/api/v2/${OWNER}/${APP}`;

        // --- Helper function to round to 2 decimal places ---
        function round(n, decimals = 2) {
            return Math.round((n + Number.EPSILON) * Math.pow(10, decimals)) / Math.pow(10, decimals);
        }

        // --- Tax Calculator Function ---
        function calculateAnnualTax(taxableAnnual) {
            let annualTax = 0;
            let brackets = [];

            if (taxableAnnual <= 600000) {
                brackets = [
                    { lower: 0, upper: 40000, rate: 0 },
                    { lower: 40000, upper: 55000, rate: 0.10 },
                    { lower: 55000, upper: 70000, rate: 0.15 },
                    { lower: 70000, upper: 200000, rate: 0.20 },
                    { lower: 200000, upper: 400000, rate: 0.225 },
                    { lower: 400000, upper: 1200000, rate: 0.25 },
                    { lower: 1200000, upper: 999999999, rate: 0.275 },
                ];
            } else if (taxableAnnual <= 700000) {
                brackets = [
                    { lower: 0, upper: 55000, rate: 0.10 },
                    { lower: 55000, upper: 70000, rate: 0.15 },
                    { lower: 70000, upper: 200000, rate: 0.20 },
                    { lower: 200000, upper: 400000, rate: 0.225 },
                    { lower: 400000, upper: 1200000, rate: 0.25 },
                    { lower: 1200000, upper: 999999999, rate: 0.275 },
                ];
            } else if (taxableAnnual <= 800000) {
                brackets = [
                    { lower: 0, upper: 70000, rate: 0.15 },
                    { lower: 70000, upper: 200000, rate: 0.20 },
                    { lower: 200000, upper: 400000, rate: 0.225 },
                    { lower: 400000, upper: 1200000, rate: 0.25 },
                    { lower: 1200000, upper: 999999999, rate: 0.275 },
                ];
            } else if (taxableAnnual <= 900000) {
                brackets = [
                    { lower: 0, upper: 200000, rate: 0.20 },
                    { lower: 200000, upper: 400000, rate: 0.225 },
                    { lower: 400000, upper: 1200000, rate: 0.25 },
                    { lower: 1200000, upper: 999999999, rate: 0.275 },
                ];
            } else if (taxableAnnual <= 1200000) {
                brackets = [
                    { lower: 0, upper: 400000, rate: 0.225 },
                    { lower: 400000, upper: 1200000, rate: 0.25 },
                    { lower: 1200000, upper: 999999999, rate: 0.275 },
                ];
            } else {
                brackets = [
                    { lower: 400000, upper: 1200000, rate: 0.25 },
                    { lower: 1200000, upper: 999999999, rate: 0.275 },
                ];
            }

            for (const br of brackets) {
                if (taxableAnnual > br.lower) {
                    const top = Math.min(taxableAnnual, br.upper);
                    const portion = top - br.lower;
                    if (portion > 0) {
                        annualTax += portion * br.rate;
                    }
                }
            }

            return annualTax;
        }

        // --- Helper function to query Creator forms ---
        async function queryCreatorForm(formLinkName, criteria = "", page = 1, perPage = 200) {
            const url = `${CREATOR_BASE}/report/${formLinkName}?criteria=${encodeURIComponent(criteria)}&page=${page}&perPage=${perPage}`;
            return rp({
                uri: url,
                method: "GET",
                headers: {
                    Authorization: "Zoho-oauthtoken " + accessToken
                },
                json: true
            }).catch(() => ({ data: [] })); // Return empty data on error
        }

        // --- Date Formatting ---
        function formatDateString(dateObj) {
            const d = dateObj.getDate().toString().padStart(2, "0");
            const m = dateObj.toLocaleString("en-US", { month: "short" });
            const y = dateObj.getFullYear();
            return `${d}-${m}-${y}`;
        }

        let today = new Date();
        const month = today.getMonth(); // 0-based
        const sdate = formatDateString(new Date(today.getFullYear(), today.getMonth(), 1));
        const edate = formatDateString(new Date(today.getFullYear(), today.getMonth() + 1, 0));

        const results = [];

        // --- Fetch employees ---
        const employeeOptions = {
            uri:
                "https://people.zoho.com/people/api/forms/P_Employee/getRecords" +
                `?fromIndex=0&range=5`,
            method: "GET",
            headers: {
                Authorization: "Zoho-oauthtoken " + accessToken
            },
            json: true
        };

        const employeeRecords = await rp(employeeOptions);
        const records = employeeRecords.response.result;

        // --- Fetch attendance for all employees in parallel ---
        const attendancePromises = records.map(entry => {
            const key = Object.keys(entry)[0];
            const emp = entry[key][0];
            const employeeId = emp.EmployeeID;
            const attendanceURL =
                `https://people.zoho.com/people/api/attendance/getUserReport` +
                `?empId=${employeeId}&sdate=${sdate}&edate=${edate}`;

            return rp({
                uri: attendanceURL,
                method: "GET",
                headers: {
                    Authorization: "Zoho-oauthtoken " + accessToken
                },
                json: true
            }).catch(() => ({})); // Return empty object on error
        });

        // --- Fetch Creator data for all employees in parallel ---
        const creatorDataPromises = records.map(entry => {
            const key = Object.keys(entry)[0];
            const emp = entry[key][0];
            const employeeId = emp.EmployeeID;

            // Execute all 4 Creator queries in parallel for each employee
            return Promise.all([
                queryCreatorForm("All_Bonuses", `(Employee_Id == "${employeeId}")`, 1, 200),
                queryCreatorForm("All_Deductions", `(Employee_Id == "${employeeId}")`, 1, 200),
                queryCreatorForm("All_Loans", `(Employee_Id == "${employeeId}")`, 1, 200),
                queryCreatorForm("All_Extra_Hours", `(Employee_Id == "${employeeId}")`, 1, 200)
            ]).catch(() => [{ data: [] }, { data: [] }, { data: [] }, { data: [] }]);
        });

        // Wait for all attendance calls to complete
        const attendanceData = await Promise.all(attendancePromises);
        
        // Wait for all Creator data to complete
        const creatorData = await Promise.all(creatorDataPromises);

        // Process results
        for (let i = 0; i < records.length; i++) {
            const entry = records[i];

            const key = Object.keys(entry)[0];
            const emp = entry[key][0];
            const attendance = attendanceData[i];

            // ------------------------
            //  Extract Employee Data
            // ------------------------
            const employee_name = `${emp.FirstName} ${emp.LastName}`;
            const employeeId = emp.EmployeeID;
            const employee_basic_salary = round(parseFloat(emp.Basic_Salary || 0));
            const employee_gross_salary = round(parseFloat(emp.Gross_Salary || 0));
            const department = emp.Department || "";
            const title = emp.Title || "";
            const hiring_date = emp.Dateofjoining || "";
            const cost_center = emp.Cost_Center || "";
            const payment_method = emp.Payment_Method === "Cash" ? "Cash" : "Bank Transfer";
            const kpi = round(parseFloat(emp.Kpi || 0));
            let is_socially_insured = emp.SI_Status !== false;

            // Daily rate
            const daily_rate = round(employee_basic_salary / 30);

            // Medical insurance
            let employee_medical_insurance = 0;
            let employer_medical_insurance = 0;
            const plans = { A: 482, B: 356, C: 290 };

            if (emp.Medical_insurance === true || emp.Medical_insurance === "true") {
                const plan = emp.Medical_Insurance_Plan;
                if (plans[plan]) {
                    const amount = plans[plan];
                    employee_medical_insurance = round(amount / 2);
                    employer_medical_insurance = round(amount / 2);
                }
            }

            // ------------------------
            //  Attendance Logic
            // ------------------------
            let day_count = 0;
            let paid_days = 0;
            let unpaid_days = 0;

            if (attendance && typeof attendance === "object") {
                for (const dayKey of Object.keys(attendance)) {
                    const record = attendance[dayKey];
                    day_count++;

                    let status = (record.Status || "").trim().toLowerCase();
                    if (status === "absent") unpaid_days++;
                    else paid_days++;
                }
            }

            const attendance_deduction = round(daily_rate * unpaid_days);

            // ------------------------
            //  Extract Creator Data
            // ------------------------
            const [bonusesResp, dedResp, loansResp, extraResp] = creatorData[i];
            const bonuses = (bonusesResp && bonusesResp.data) ? bonusesResp.data : [];
            const deductions = (dedResp && dedResp.data) ? dedResp.data : [];
            const loans = (loansResp && loansResp.data) ? loansResp.data : [];
            const extraHours = (extraResp && extraResp.data) ? extraResp.data : [];

            // Allowances, KPI, Loans Logic
            const allowances = round(parseFloat(emp.Allowances || 0));
            const kpi_bonus = kpi; // KPI as bonus
            
            // === Process Bonuses ===
            let total_bonus = kpi_bonus;
            let recognition = 0;
            let suspension_amount = 0;
            let public_holiday = 0;
            let training_amount = 0;
            let other_bonus = 0;

            for (const bonus of bonuses) {
                const dateField = new Date(bonus.Date_field);
                if (dateField.getMonth() === month) {
                    const bType = bonus.Bonus_Type;
                    const amt = round(parseFloat(bonus.Bonus_Amount || 0));
                    if (bType === "Recognition") recognition += amt;
                    else if (bType === "Suspension Amount") suspension_amount += amt;
                    else if (bType === "Public Holiday") public_holiday += amt;
                    else if (bType === "Training Amount") training_amount += amt;
                    else if (bType === "Other") other_bonus += amt;
                    total_bonus += amt;
                }
            }

            // === Process Deductions ===
            let penalty = 0;
            let premium_card = round(parseFloat(emp.Premium_Card === "true" ? 100 : 0));
            let halan_advance = 0;
            let er_deductions = 0;
            let other_deductions = 0;

            for (const ded of deductions) {
                const dateField = new Date(ded.Date_field);
                if (dateField.getMonth() === month) {
                    const t = ded.Deduction_Type;
                    const amt = round(parseFloat(ded.Deduction_Amount || 0));
                    if (t === "Penalty") penalty += amt;
                    else if (t === "Premium Card") premium_card += amt;
                    else if (t === "Halan Advance") halan_advance += amt;
                    else if (t === "ER Deductions") er_deductions += amt;
                    else if (t === "Other") other_deductions += amt;
                }
            }

            // === Process Loans ===
            let total_loans = 0;
            for (const loan of loans) {
                total_loans += round(parseFloat(loan.Installment_Amount || 0));
            }
            other_deductions += total_loans;

            // === Process Extra Hours ===
            let total_extra_hours_payment = 0;
            for (const eh of extraHours) {
                const dateField = new Date(eh.Date_field);
                if (dateField.getMonth() === month) {
                    total_extra_hours_payment += round(parseFloat(eh.Total_Payment_Due || 0));
                }
            }

            const total_deductions = round(penalty + premium_card + halan_advance + er_deductions + other_deductions);
            const total_addition_amount = round(total_extra_hours_payment + total_bonus + allowances);

            // === Tax & Insurance Calculation ===
            const gross = employee_gross_salary;
            const personalExemptionAnnual = 20000.0;
            const empSocialRate = 0.11;
            const employerSocialRate = 0.1875;
            const martyrsRate = 0.0005;
            const minInsurable = 2300.0;
            const maxInsurable = 14500.0;

            let employeeSocial = 0;
            let employerSocial = 0;
            let martyrsFund = 0;
            let monthlyTax = 0;
            let netMonthly = 0;
            let ctc = 0;
            let insurableSalary = 0;
            let annualTax = 0;

            if (!gross || gross === 0) {
                console.warn("No gross salary for", employeeId);
            } else {
                let exemption_amount = gross * 0.30;
                insurableSalary = round(gross - exemption_amount);
                if (insurableSalary < minInsurable) insurableSalary = minInsurable;
                if (insurableSalary > maxInsurable) insurableSalary = maxInsurable;

                employeeSocial = round(insurableSalary * empSocialRate);
                employerSocial = round(insurableSalary * employerSocialRate);
                martyrsFund = round(gross * martyrsRate);

                if (!is_socially_insured) {
                    employeeSocial = 0;
                    employerSocial = 0;
                }

                const total_deduction_amount = attendance_deduction + total_deductions;
                const annualNetAfterSI = (gross - employeeSocial - employee_medical_insurance - total_deduction_amount + total_addition_amount) * 12.0;
                let taxableAnnual = annualNetAfterSI - personalExemptionAnnual;
                if (taxableAnnual < 0) taxableAnnual = 0;

                annualTax = calculateAnnualTax(taxableAnnual);
                monthlyTax = round(annualTax / 12.0);

                netMonthly = round(gross - employeeSocial - martyrsFund - monthlyTax - employee_medical_insurance);
                ctc = round(gross + employerSocial);
            }

            // ------------------------
            //  Add to results
            // ------------------------
            results.push({
                employeeId,
                employee_name,
                department,
                title,
                hiring_date,
                cost_center,
                payment_method,
                is_socially_insured,
                employee_basic_salary,
                employee_gross_salary,
                daily_rate,
                employee_medical_insurance,
                employer_medical_insurance,

                // Attendance summary
                day_count,
                paid_days,
                unpaid_days,
                attendance_deduction,

                // Allowances & Bonuses
                allowances,
                kpi,
                total_bonus,
                recognition,
                suspension_amount,
                public_holiday,
                training_amount,
                other_bonus,

                // Extra hours & Loans
                total_extra_hours_payment,
                total_loans,

                // Deductions
                penalty,
                premium_card,
                halan_advance,
                er_deductions,
                other_deductions,
                total_deductions,

                // Totals
                total_addition_amount,
                total_deduction_amount: round(attendance_deduction + total_deductions),
                salary_after_additions_deductions: round(employee_basic_salary + total_addition_amount - (attendance_deduction + total_deductions)),

                // Insurance & Tax
                insurableSalary,
                employeeSocial,
                employerSocial,
                martyrsFund,
                annualTax,
                monthlyTax,
                netMonthly,
                ctc
            });
        }

        // Return JSON (normal server)
        return res.json({ success: true, results });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, error: err.message });
    }
};

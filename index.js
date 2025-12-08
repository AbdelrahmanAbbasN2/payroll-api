// index.js
require("dotenv").config();
const { getEmployees, getAttendance } = require("./zohoPeople");
const { queryForm, updateFormRecord } = require("./zohoCreator");
const { calculateAnnualTax } = require("./taxCalculator");

const PAGE_SIZE = 10;

function round(n, decimals = 2) {
  return Math.round((n + Number.EPSILON) * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

function toLongSafe(v) {
  if (v === null || v === undefined || v === "") return 0;
  return Number(v);
}

async function processPayroll(selectedDateString) {
  const selectedDate = new Date(selectedDateString);
  const salary_month = selectedDate.toLocaleString("en-US", { month: "long" });
  const month = selectedDate.getMonth(); // 0-based in JS

  const startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0); // last day

  console.log("Processing payroll for:", salary_month, startDate.toISOString(), endDate.toISOString());

  let fromIndex = 0; // we'll page with start index 0, 200, 400...
  let employee_counter = 0;

  while (true) {
    // fetch employees page
    const employeesResp = await getEmployees(fromIndex, PAGE_SIZE);
    // Depending on People API response format, adjust
    let employees_list = employeesResp;
    if (employeesResp && employeesResp.response && employeesResp.response.result) {
      // handle for certain People response shapes
      employees_list = employeesResp.response.result;
    }

    if (!employees_list || employees_list.length === 0) break;

    for (const employee of employees_list) {
      employee_counter++;
      console.log(`Processing employee #${employee_counter}`);

      // Fields mapping (adjust keys to actual People response)
      const employee_id = employee.EmployeeID || employee.EmployeeId || employee.employee_id;
      const first = employee.FirstName || "";
      const last = employee.LastName || "";
      const employee_name = `${first} ${last}`.trim();
      const basic_salary = toLongSafe(employee.Basic_Salary || employee.basic_salary || 0);
      const gross_salary = toLongSafe(employee.Gross_Salary || employee.gross_salary || 0);
      const employee_basic_salary = basic_salary;
      const employee_gross_salary = gross_salary;

      let payment_method = (employee.Payment_Method === "Cash") ? "Cash" : "Bank Transfer";
      let department = employee.Department || "";
      let hiring_date = employee.Dateofjoining || employee.Hiring_Date || "";
      let title = employee.Title || "";
      let cost_center = employee.Cost_Center || "";

      // insurances & allowances
      let kpi = toLongSafe(employee.Kpi || employee.kpi || 0);
      let allowances = toLongSafe(employee.Allowances || employee.allowances || 0);

      // medical plans - you had medical_insurance_plans in Deluge map
      // Provide a mapping here or load from config (placeholder)
      const medical_insurance_plans = {
        "A": 482,
        "B": 356,
        "C": 290
      };

      let employee_medical_insurance = 0;
      let employer_medical_insurance = 0;
      if (employee.Medical_insurance === true || employee.Medical_insurance === "true") {
        const planKey = employee.Medical_Insurance_Plan;
        if (planKey && medical_insurance_plans[planKey]) {
          const mamt = medical_insurance_plans[planKey];
          employee_medical_insurance = mamt / 2;
          employer_medical_insurance = mamt / 2;
        }
      }

      const is_socially_insured = (employee.SI_Status !== false && employee.SI_Status !== "false");

      // Payment cycle B adjustments
      let effective_start = startDate;
      let effective_end = end_date = endDate;
      if (employee.Payment_Cycle === "B") {
        // your Deluge used start = first-of-month + 24 days etc.
        effective_start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 25); // 25th?
        effective_end = new Date(effective_start.getFullYear(), effective_start.getMonth() + 1, 1);
        effective_end.setDate(effective_end.getDate() - 1); // last day previous
      }

      // attendance call (format dd-MMM-yyyy)
      const sStr = `${effective_start.getDate().toString().padStart(2,"0")}-${effective_start.toLocaleString('en-US',{month:'short'})}-${effective_start.getFullYear()}`;
      const eStr = `${effective_end.getDate().toString().padStart(2,"0")}-${effective_end.toLocaleString('en-US',{month:'short'})}-${effective_end.getFullYear()}`;

      let attendance_response = {};
      try {
        attendance_response = await getAttendance(employee_id, sStr, eStr);
      } catch (err) {
        console.warn("Attendance fetch failed for", employee_id, err.message);
        attendance_response = {};
      }

      // calculate daily rate (basic / 30)
      const daily_rate = employee_basic_salary / 30;

      // attendance days counting
      let day_count = 0;
      let paid_days = 0;
      let unpaid_days = 0;
      if (attendance_response && Object.keys(attendance_response).length > 0) {
        const keys = Object.keys(attendance_response);
        for (const k of keys) {
          day_count++;
          const dayDetails = attendance_response[k];
          if (!dayDetails) continue;
          let status = (dayDetails.Status || "").toString().trim().toLowerCase();
          if (status === "absent") unpaid_days++;
          else paid_days++;
        }
      }
      const attendance_deduction = daily_rate * unpaid_days;

      // === Bonuses (Creator) ===
      let total_bonus = 0;
      let recognition = 0;
      let suspension_amount = 0;
      let public_holiday = 0;
      let training_amount = 0;
      let other_amount = 0;

      // Query Creator Bonus form — adjust report/form link name to your report link
      const bonusCriteria = `(Employee_Id == "${employee_id}")`;
      let bonusesResp = await queryForm("All_Bonuses", bonusCriteria, 1, 200).catch(() => null);
      if (bonusesResp && bonusesResp.data) {
        const bonuses = bonusesResp.data;
        for (const bonus of bonuses) {
          // ensure month matching
          const dateField = new Date(bonus.Date_field);
          if (dateField.getMonth() === month) {
            const bType = bonus.Bonus_Type;
            const amt = toLongSafe(bonus.Bonus_Amount);
            if (bType === "Recognition") recognition += amt;
            else if (bType === "Suspension Amount") suspension_amount += amt;
            else if (bType === "Public Holiday") public_holiday += amt;
            else if (bType === "Training Amount") training_amount += amt;
            else if (bType === "Other") other_amount += amt;
            total_bonus += amt;
          }
        }
      }

      // === Deductions (Creator) ===
      let total_deductions = 0, penalty = 0, premium_card = 0, halan_advance = 0, er_deductions = 0, other_deductions = 0;
      const dedCriteria = `(Employee_Id == "${employee_id}")`;
      let dedResp = await queryForm("All_Deductions", dedCriteria, 1, 200).catch(()=> null);
      if (dedResp && dedResp.data) {
        for (const d of dedResp.data) {
          const dateField = new Date(d.Date_field);
          if (dateField.getMonth() === month) {
            const t = d.Deduction_Type;
            const amt = toLongSafe(d.Deduction_Amount);
            if (t === "Penalty") penalty += amt;
            else if (t === "Premium Card") premium_card += amt;
            else if (t === "Halan Advance") halan_advance += amt;
            else if (t === "ER Deductions") er_deductions += amt;
            else if (t === "Other") other_deductions += amt;
            total_deductions += amt;
          }
        }
      }

      // === Loans ===
      let total_loans = 0;
      const loansResp = await queryForm("All_Loans", `(Employee_Id == "${employee_id}")`, 1, 200).catch(()=>null);
      if (loansResp && loansResp.data) {
        for (const loan of loansResp.data) {
          total_loans += toLongSafe(loan.Installment_Amount);
        }
      }
      other_deductions += total_loans;

      // === Extra hours ===
      let total_extra_hours_payment = 0;
      const extraResp = await queryForm("All_Extra_Hours", `(Employee_Id == "${employee_id}")`, 1, 200).catch(()=>null);
      if (extraResp && extraResp.data) {
        for (const eh of extraResp.data) {
          const dateField = new Date(eh.Date_field);
          if (dateField.getMonth() === month) {
            total_extra_hours_payment += toLongSafe(eh.Total_Payment_Due);
          }
        }
      }

      const additional_deduction_amount = total_deductions + total_loans;
      const total_deduction_amount = attendance_deduction + total_deductions + total_loans;
      const total_addition_amount = total_extra_hours_payment + total_bonus;

      const salary_after_adds_and_deductions = employee_basic_salary + total_addition_amount - total_deduction_amount;

      // === INSURANCE + TAXES (copying Deluge logic) ===
      const gross = employee_gross_salary;
      const personalExemptionAnnual = 20000.0;
      const empSocialRate = 0.11;
      const employerSocialRate = 0.1875;
      const martyrsRate = 0.0005;
      const minInsurable = 2300.0;
      const maxInsurable = 14500.0;

      if (!gross || gross === 0) {
        console.warn("No gross salary for", employee_id);
      } else {
        let exemption_amount = gross * 0.30;
        let insurableSalary = gross - exemption_amount;
        if (insurableSalary < minInsurable) insurableSalary = minInsurable;
        if (insurableSalary > maxInsurable) insurableSalary = maxInsurable;

        let employeeSocial = round(insurableSalary * empSocialRate, 2);
        let employerSocial = round(insurableSalary * employerSocialRate, 2);
        let martyrsFund = round(gross * martyrsRate, 2);

        if (!is_socially_insured) {
          employeeSocial = 0;
          employerSocial = 0;
        }

        const annualNetAfterSI = (gross - employeeSocial - employee_medical_insurance - total_deduction_amount + total_addition_amount) * 12.0;
        let taxableAnnual = annualNetAfterSI - personalExemptionAnnual;
        if (taxableAnnual < 0) taxableAnnual = 0;

        const annualTax = calculateAnnualTax(taxableAnnual);
        const monthlyTax = round(annualTax / 12.0, 2);

        const netMonthly = round(gross - employeeSocial - martyrsFund - monthlyTax - employee_medical_insurance, 2);
        const ctc = round(gross + employerSocial, 2);

        // Prepare update payload or console log
        const computed = {
          employee_id,
          employee_name,
          gross,
          insurableSalary,
          employeeSocial,
          employerSocial,
          martyrsFund,
          annualTax,
          monthlyTax,
          netMonthly,
          ctc,
          total_addition_amount,
          total_deduction_amount,
          attendance_deduction,
          total_bonus,
          recognition,
          allowances,
          suspension_amount,
          kpi,
          total_extra_hours_payment
        };

        console.log("Computed:", JSON.stringify(computed, null, 2));

        // OPTIONAL: update Creator PaySlip/your form - implement updateFormRecord if needed
        // Example:
        // await updateFormRecord("PaySlip", someRecordId, {
        //   Gross_Salary: gross,
        //   Employee_Social_Insurance: employeeSocial,
        //   Employer_Social_Insurance: employerSocial,
        //   Monthly_Income_Tax: monthlyTax,
        //   Final_Amount: netMonthly
        // });
      }
    }

    // next page
    fromIndex += PAGE_SIZE;
  }

  console.log("Payroll processing finished for", employee_counter, "employees.");
}

// run
const selectedDate = process.argv[2] || new Date().toISOString();
processPayroll(selectedDate).catch(err => {
  console.error("Fatal error:", err);
});

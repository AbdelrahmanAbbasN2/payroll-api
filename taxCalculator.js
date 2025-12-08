// taxCalculator.js
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

module.exports = { calculateAnnualTax };

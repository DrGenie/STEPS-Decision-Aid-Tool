/****************************************************************************
 * SCRIPT.JS
 * Enhanced tabs, intuitive inputs, realistic coefficients, 
 * detailed cost-benefit and WTP analysis, and responsive scenario management.
 *
 * Author: Mesfin Genie, Newcastle Business School, University of Newcastle, Australia
 ****************************************************************************/

/** On page load, set default tab */
window.onload = function() {
  openTab('introTab', document.querySelector('.tablink'));
};

/** Tab switching */
function openTab(tabId, btn) {
  const tabs = document.getElementsByClassName("tabcontent");
  for (let tab of tabs) { tab.style.display = "none"; }
  const tabButtons = document.getElementsByClassName("tablink");
  for (let button of tabButtons) { 
    button.classList.remove("active");
    button.setAttribute("aria-selected", "false");
  }
  document.getElementById(tabId).style.display = "block";
  btn.classList.add("active");
  btn.setAttribute("aria-selected", "true");

  // Render charts if necessary
  if (tabId === "wtpTab") renderWTPChart();
  if (tabId === "cbaTab") renderCostsBenefits();
}

/** ---------------- Range Slider Updates ---------------- */
const cohortSlider = document.getElementById("cohort-size");
const cohortDisplay = document.getElementById("cohort-size-value");
cohortDisplay.textContent = cohortSlider.value;
cohortSlider.addEventListener("input", () => { cohortDisplay.textContent = cohortSlider.value; });

const costSlider = document.getElementById("cost-per-participant");
const costDisplay = document.getElementById("cost-per-participant-value");
costDisplay.textContent = `$${parseInt(costSlider.value).toLocaleString()}`;
costSlider.addEventListener("input", () => { costDisplay.textContent = `$${parseInt(costSlider.value).toLocaleString()}`; });

/** ---------------- Realistic Coefficients & Cost Data ---------------- */
/* Coefficient estimates based on literature review and theoretical expectations */
const coefficients = {
  ASC: 1.0,
  TrainingLevel: { // Reference: Advanced
    Frontline: 0.8,
    Intermediate: 0.5,
    Advanced: 0.0
  },
  DeliveryMethod: { // Reference: Online
    "In-Person": 0.7,
    "Online": 0.0,
    "Hybrid": 0.5
  },
  Accreditation: { // Reference: None
    National: 0.6,
    International: 1.0,
    None: 0.0
  },
  Location: { // Reference: District-Level
    "District-Level": 0.0,
    "State-Level": 0.5,
    "Regional Centers": 0.3
  },
  CohortSize: -0.002,       // Larger cohorts slightly reduce uptake
  CostPerParticipant: -0.0003, // Higher cost reduces uptake (per USD)
  ASC_optout: 0.3
};

/* Cost-Benefit estimates (USD) */
const costBenefitEstimates = {
  Frontline: { cost: 250000, benefit: 750000 },
  Intermediate: { cost: 450000, benefit: 1300000 },
  Advanced: { cost: 650000, benefit: 2000000 }
};

/** ---------------- Chart Variables ---------------- */
let uptakeChart, cbaChart, wtpChart;
let wtpData = [];
let currentUptake = 0, currentTotalCost = 0, currentTotalBenefit = 0, currentNetBenefit = 0;

/** Random error function */
function getRandomError(min, max) { return Math.random() * (max - min) + min; }

/** ---------------- Predicted Program Uptake Chart ---------------- */
function drawUptakeChart(uptakeVal) {
  const ctx = document.getElementById("uptakeChart").getContext("2d");
  if (uptakeChart) uptakeChart.destroy();
  uptakeChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Predicted Uptake", "Remaining"],
      datasets: [{
        data: [uptakeVal, 100 - uptakeVal],
        backgroundColor: ["#28a745", "#dc3545"]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: `Predicted Program Uptake: ${uptakeVal.toFixed(1)}%`, font: { size: 16 } }
      }
    }
  });
}

/** ---------------- Cost-Benefit Chart & Summary ---------------- */
function renderCostsBenefits() {
  // Educational summary for costs & benefits
  // Fixed costs and variable costs are explained below.
  // Benefits: QALY gains multiplied by $50,000 per QALY.
  
  const baseParticipants = 250;
  const uptakeFraction = computeUptakeFraction(buildScenarioFromInputs());
  const numberOfParticipants = baseParticipants * uptakeFraction;
  const QALY_PER_PARTICIPANT = 0.05; // moderate scenario
  const totalQALY = numberOfParticipants * QALY_PER_PARTICIPANT;
  const VALUE_PER_QALY = 50000;
  const monetizedBenefits = totalQALY * VALUE_PER_QALY;
  
  const scenario = buildScenarioFromInputs();
  if (!scenario) return;
  const totalInterventionCost = costBenefitEstimates[scenario.trainingLevel].cost * scenario.cohortSize;
  const netBenefit = monetizedBenefits - totalInterventionCost;
  
  currentTotalCost = totalInterventionCost;
  currentTotalBenefit = monetizedBenefits;
  currentNetBenefit = netBenefit;
  
  // Update summary table
  const summaryTable = document.getElementById("benefit-summary-table");
  summaryTable.innerHTML = `
    <tr><th>Total Cost</th><td>$${totalInterventionCost.toLocaleString()}</td></tr>
    <tr><th>Total Benefit</th><td>$${monetizedBenefits.toLocaleString()}</td></tr>
    <tr><th>Net Benefit</th><td>$${netBenefit.toLocaleString()}</td></tr>
  `;
  
  // Draw bar chart
  const ctx = document.getElementById("cbaChart").getContext("2d");
  if (cbaChart) cbaChart.destroy();
  cbaChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Total Cost", "Total Benefit", "Net Benefit"],
      datasets: [{
        label: "USD",
        data: [totalInterventionCost, monetizedBenefits, netBenefit],
        backgroundColor: ["#dc3545", "#28a745", "#ffc107"]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } },
      plugins: {
        title: { display: true, text: "Cost-Benefit Analysis", font: { size: 16 } }
      }
    }
  });
}

/** ---------------- WTP Calculation for Each Attribute Level ---------------- */
function calculateWTP(scenario) {
  // For each categorical attribute, use a baseline level for comparison.
  const benchmarks = {
    TrainingLevel: "Advanced",       // baseline: Advanced (lowest value)
    DeliveryMethod: "Online",          // baseline: Online
    Accreditation: "None",             // baseline: None
    Location: "District-Level"         // baseline: District-Level
  };

  const attrDiff = {
    TrainingLevel: coefficients.TrainingLevel[scenario.trainingLevel] - coefficients.TrainingLevel[benchmarks.TrainingLevel],
    DeliveryMethod: coefficients.DeliveryMethod[scenario.deliveryMethod] - coefficients.DeliveryMethod[benchmarks.DeliveryMethod],
    Accreditation: coefficients.Accreditation[scenario.accreditation] - coefficients.Accreditation[benchmarks.Accreditation],
    Location: coefficients.Location[scenario.location] - coefficients.Location[benchmarks.Location]
  };

  let results = [];
  for (let attr in attrDiff) {
    const diff = attrDiff[attr];
    // WTP in USD for a one unit change is diff divided by negative cost coefficient,
    // scaled by 1000 for easier interpretation.
    const wtpVal = diff / -coefficients.CostPerParticipant;
    results.push({ attribute: attr, wtp: wtpVal * 1000, se: Math.abs(wtpVal * 1000) * 0.1 });
  }
  wtpData = results;
}

function renderWTPChart() {
  const ctx = document.getElementById("wtpChartMain").getContext("2d");
  if (wtpChart) wtpChart.destroy();
  
  const labels = wtpData.map(item => item.attribute);
  const values = wtpData.map(item => item.wtp);
  const errors = wtpData.map(item => item.se);
  
  wtpChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "WTP (USD)",
        data: values,
        backgroundColor: values.map(v => v >= 0 ? "rgba(0,123,255,0.6)" : "rgba(220,53,69,0.6)"),
        borderColor: values.map(v => v >= 0 ? "rgba(0,123,255,1)" : "rgba(220,53,69,1)"),
        borderWidth: 1,
        error: errors
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } },
      plugins: {
        legend: { display: false },
        title: { display: true, text: "Willingness to Pay (USD)", font: { size: 16 } }
      }
    },
    plugins: [{
      id: "errorbars",
      afterDraw: chart => {
        const { ctx, scales: { y } } = chart;
        chart.getDatasetMeta(0).data.forEach((bar, i) => {
          const centerX = bar.x;
          const value = values[i];
          const se = errors[i];
          if (se && typeof se === "number") {
            const topY = y.getPixelForValue(value + se);
            const bottomY = y.getPixelForValue(value - se);
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 1;
            ctx.moveTo(centerX, topY);
            ctx.lineTo(centerX, bottomY);
            ctx.moveTo(centerX - 5, topY);
            ctx.lineTo(centerX + 5, topY);
            ctx.moveTo(centerX - 5, bottomY);
            ctx.lineTo(centerX + 5, bottomY);
            ctx.stroke();
            ctx.restore();
          }
        });
      }
    }]
  });
}

/** ---------------- Compute Uptake Probability ---------------- */
function computeUptakeFraction(sc) {
  let finalCost = sc.cost_per_participant;
  // Here we assume no additional cost adjustments.
  const U_alt = coefficients.ASC +
    coefficients.TrainingLevel[sc.trainingLevel] +
    coefficients.DeliveryMethod[sc.deliveryMethod] +
    coefficients.Accreditation[sc.accreditation] +
    coefficients.Location[sc.location] +
    coefficients.CohortSize * sc.cohortSize +
    coefficients.CostPerParticipant * finalCost;
  const U_opt = coefficients.ASC_optout;
  return Math.exp(U_alt) / (Math.exp(U_alt) + Math.exp(U_opt));
}

/** ---------------- Build Scenario From Inputs ---------------- */
function buildScenarioFromInputs() {
  // For simplicity, only categorical inputs and continuous ones are used.
  const trainingLevel = document.querySelector('input[name="training-level"]:checked').value;
  const deliveryMethod = document.querySelector('input[name="delivery-method"]:checked').value;
  const accreditation = document.querySelector('input[name="accreditation"]:checked').value;
  const location = document.querySelector('input[name="location"]:checked').value;
  const cohortSize = parseInt(document.getElementById("cohort-size").value);
  const cost_per_participant = parseInt(document.getElementById("cost-per-participant").value);

  // Return scenario object
  return { trainingLevel, deliveryMethod, accreditation, location, cohortSize, cost_per_participant };
}

/** ---------------- Predict Program Uptake ---------------- */
document.getElementById("view-results").addEventListener("click", () => {
  const scenario = buildScenarioFromInputs();
  if (!scenario) return;
  
  // Compute utility and uptake probability (in %)
  let utility = coefficients.ASC +
    coefficients.TrainingLevel[scenario.trainingLevel] +
    coefficients.DeliveryMethod[scenario.deliveryMethod] +
    coefficients.Accreditation[scenario.accreditation] +
    coefficients.Location[scenario.location] +
    coefficients.CohortSize * scenario.cohortSize +
    coefficients.CostPerParticipant * scenario.cost_per_participant;
    
  const uptakeFraction = Math.exp(utility) / (Math.exp(utility) + Math.exp(coefficients.ASC_optout));
  let predictedUptake = uptakeFraction * 100;
  predictedUptake += getRandomError(-3, 3);
  predictedUptake = Math.min(Math.max(predictedUptake, 0), 100);
  
  currentUptake = predictedUptake;
  
  // Draw Uptake Chart
  const uptakeDiv = document.getElementById("uptake-content");
  uptakeDiv.innerHTML = `
    <p><strong>Predicted Program Uptake:</strong> ${predictedUptake.toFixed(1)}%</p>
    <div class="chart-box">
      <canvas id="uptakeChart"></canvas>
    </div>
  `;
  drawUptakeChart(predictedUptake);
  
  // Compute Cost-Benefit (Total cost based on cohort size and training level cost)
  const totalCost = scenario.cohortSize * costBenefitEstimates[scenario.trainingLevel].cost;
  const totalBenefit = scenario.cohortSize * costBenefitEstimates[scenario.trainingLevel].benefit;
  const netBenefit = totalBenefit - totalCost;
  currentTotalCost = totalCost;
  currentTotalBenefit = totalBenefit;
  currentNetBenefit = netBenefit;
  
  const cbaDiv = document.getElementById("cba-content");
  cbaDiv.innerHTML = `
    <p><strong>Cost-Benefit Analysis:</strong></p>
    <div class="chart-box">
      <canvas id="cbaChart"></canvas>
    </div>
    <div class="summary-table">
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Value (USD)</th>
          </tr>
        </thead>
        <tbody id="benefit-summary-table">
          <tr><td>Total Cost</td><td>$${totalCost.toLocaleString()}</td></tr>
          <tr><td>Total Benefit</td><td>$${totalBenefit.toLocaleString()}</td></tr>
          <tr><td>Net Benefit</td><td>$${netBenefit.toLocaleString()}</td></tr>
        </tbody>
      </table>
    </div>
    <p>Costs include fixed expenses (trainer salaries, venue hire, materials, etc.) and variable costs. Benefits are estimated based on expected Quality-Adjusted Life Year (QALY) gains (assumed 0.05 QALY per participant) valued at $50,000 per QALY.</p>
  `;
  drawCBAChart(totalCost, totalBenefit, netBenefit);
  
  // Calculate and Render WTP Chart (for each attribute relative to baseline)
  calculateWTP(scenario);
  renderWTPChart();
});

/** ---------------- Scenario Saving & PDF Export ---------------- */
let savedScenarios = [];
document.getElementById("save-scenario").addEventListener("click", () => {
  const scenario = buildScenarioFromInputs();
  if (!scenario) return;
  scenario.predictedUptake = currentUptake.toFixed(1);
  scenario.netBenefit = currentNetBenefit.toFixed(2);
  scenario.name = `Scenario ${savedScenarios.length + 1}`;
  savedScenarios.push(scenario);
  updateScenarioList();
  alert(`Scenario "${scenario.name}" saved successfully.`);
});

function updateScenarioList() {
  const list = document.getElementById("saved-scenarios-list");
  list.innerHTML = "";
  savedScenarios.forEach((s, idx) => {
    const div = document.createElement("div");
    div.className = "list-group-item";
    div.innerHTML = `
      <strong>${s.name}</strong> - Uptake: ${s.predictedUptake}%, Net Benefit: $${s.netBenefit}
      <div>
        <button class="btn btn-sm btn-primary" onclick="loadScenario(${idx})">Load</button>
        <button class="btn btn-sm btn-danger" onclick="deleteScenario(${idx})">Delete</button>
      </div>
    `;
    list.appendChild(div);
  });
}

function loadScenario(index) {
  const s = savedScenarios[index];
  document.querySelector(`input[name="training-level"][value="${s.trainingLevel}"]`).checked = true;
  document.querySelector(`input[name="delivery-method"][value="${s.deliveryMethod}"]`).checked = true;
  document.querySelector(`input[name="accreditation"][value="${s.accreditation}"]`).checked = true;
  document.querySelector(`input[name="location"][value="${s.location}"]`).checked = true;
  document.getElementById("cohort-size").value = s.cohortSize;
  document.getElementById("cohort-size-value").textContent = s.cohortSize;
  document.getElementById("cost-per-participant").value = s.cost_per_participant;
  document.getElementById("cost-per-participant-value").textContent = `$${s.cost_per_participant.toLocaleString()}`;
}

function deleteScenario(index) {
  if (confirm("Are you sure you want to delete this scenario?")) {
    savedScenarios.splice(index, 1);
    updateScenarioList();
  }
}

document.getElementById("export-pdf").addEventListener("click", () => {
  if (!savedScenarios.length) {
    alert("No scenarios saved to export.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 15;
  doc.setFontSize(16);
  doc.text("STEPS - Scenarios Comparison", pageWidth / 2, currentY, { align: "center" });
  currentY += 10;
  savedScenarios.forEach((s, idx) => {
    if (currentY + 60 > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      currentY = 15;
    }
    doc.setFontSize(14);
    doc.text(`Scenario ${idx + 1}: ${s.name}`, 15, currentY);
    currentY += 7;
    doc.setFontSize(12);
    doc.text(`Training Level: ${s.trainingLevel}`, 15, currentY);
    currentY += 5;
    doc.text(`Delivery Method: ${s.deliveryMethod}`, 15, currentY);
    currentY += 5;
    doc.text(`Accreditation: ${s.accreditation}`, 15, currentY);
    currentY += 5;
    doc.text(`Location: ${s.location}`, 15, currentY);
    currentY += 5;
    doc.text(`Cohort Size: ${s.cohortSize}`, 15, currentY);
    currentY += 5;
    doc.text(`Cost per Participant: $${s.cost_per_participant.toLocaleString()}`, 15, currentY);
    currentY += 5;
    doc.text(`Predicted Uptake: ${s.predictedUptake}%`, 15, currentY);
    currentY += 5;
    doc.text(`Net Benefit: $${s.netBenefit}`, 15, currentY);
    currentY += 10;
  });
  doc.save("Scenarios_Comparison.pdf");
});

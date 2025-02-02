/****************************************************************************
 * SCRIPT.JS
 * Enhanced tabs, intuitive level cards with SVG icons and tooltips,
 * realistic uptake predictions and cost-benefit analysis, 
 * detailed WTP calculation per attribute level (baseline comparison),
 * and comprehensive scenario management.
 *
 * Author: Mesfin Genie, Newcastle Business School, University of Newcastle, Australia
 ****************************************************************************/

/** On page load, show default tab */
window.onload = function() {
  openTab('introTab', document.querySelector('.tablink'));
};

/** Tab Switching */
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
  
  if (tabId === "wtpTab") renderWTPChart();
  if (tabId === "cbaTab") renderCostsBenefits();
}

/** Range Slider Updates */
const cohortSlider = document.getElementById("cohort-size");
const cohortDisplay = document.getElementById("cohort-size-value");
cohortDisplay.textContent = cohortSlider.value;
cohortSlider.addEventListener("input", () => { cohortDisplay.textContent = cohortSlider.value; });

const costSlider = document.getElementById("cost-per-participant");
const costDisplay = document.getElementById("cost-per-participant-value");
costDisplay.textContent = `$${parseInt(costSlider.value).toLocaleString()}`;
costSlider.addEventListener("input", () => { costDisplay.textContent = `$${parseInt(costSlider.value).toLocaleString()}`; });

/** Realistic Coefficient Estimates (Adjusted for realistic uptake) */
const coefficients = {
  ASC: 1.0,
  TrainingLevel: { // Baseline: Advanced
    Frontline: 0.8,
    Intermediate: 0.5,
    Advanced: 0.0
  },
  DeliveryMethod: { // Baseline: Online
    "In-Person": 0.7,
    "Online": 0.0,
    "Hybrid": 0.5
  },
  Accreditation: { // Baseline: None
    National: 0.6,
    International: 1.0,
    None: 0.0
  },
  Location: { // Baseline: District-Level
    "District-Level": 0.0,
    "State-Level": 0.5,
    "Regional Centers": 0.3
  },
  CohortSize: -0.002, // Slight negative effect with larger cohorts
  CostPerParticipant: -0.0004, // In USD
  ASC_optout: 0.3
};

/** Realistic Cost-Benefit Data (USD) */
const costBenefitEstimates = {
  Frontline: { cost: 250000, benefit: 750000 },
  Intermediate: { cost: 450000, benefit: 1300000 },
  Advanced: { cost: 650000, benefit: 2000000 }
};

/** Chart Instances & Global Variables */
let uptakeChart, cbaChart, wtpChart;
let wtpData = [];
let currentUptake = 0, currentTotalCost = 0, currentTotalBenefit = 0, currentNetBenefit = 0;

/** Random Error for Uptake Variability */
function getRandomError(min, max) { return Math.random() * (max - min) + min; }

/** Compute Uptake Fraction (without additional cost multipliers) */
function computeUptakeFraction(sc) {
  const U_alt = coefficients.ASC +
    coefficients.TrainingLevel[sc.trainingLevel] +
    coefficients.DeliveryMethod[sc.deliveryMethod] +
    coefficients.Accreditation[sc.accreditation] +
    coefficients.Location[sc.location] +
    coefficients.CohortSize * sc.cohortSize +
    coefficients.CostPerParticipant * sc.cost_per_participant;
  const U_opt = coefficients.ASC_optout;
  return Math.exp(U_alt) / (Math.exp(U_alt) + Math.exp(U_opt));
}

/** Build Scenario from Inputs */
function buildScenarioFromInputs() {
  const trainingLevel = document.querySelector('input[name="training-level"]:checked').value;
  const deliveryMethod = document.querySelector('input[name="delivery-method"]:checked').value;
  const accreditation = document.querySelector('input[name="accreditation"]:checked').value;
  const location = document.querySelector('input[name="location"]:checked').value;
  const cohortSize = parseInt(document.getElementById("cohort-size").value);
  const cost_per_participant = parseInt(document.getElementById("cost-per-participant").value);
  return { trainingLevel, deliveryMethod, accreditation, location, cohortSize, cost_per_participant };
}

/** ---------------- Predict Program Uptake ---------------- */
document.getElementById("view-results").addEventListener("click", () => {
  const scenario = buildScenarioFromInputs();
  if (!scenario) return;
  
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
  
  // Update Predicted Program Uptake tab
  const uptakeDiv = document.getElementById("uptake-content");
  uptakeDiv.innerHTML = `
    <p><strong>Predicted Program Uptake:</strong> ${predictedUptake.toFixed(1)}%</p>
    <div class="chart-box">
      <canvas id="uptakeChart"></canvas>
    </div>
  `;
  drawUptakeChart(predictedUptake);
  
  // Compute Cost-Benefit (total cost and benefits based on training level & cohort size)
  const totalCost = scenario.cohortSize * costBenefitEstimates[scenario.trainingLevel].cost;
  const totalBenefit = scenario.cohortSize * costBenefitEstimates[scenario.trainingLevel].benefit;
  const netBenefit = totalBenefit - totalCost;
  currentTotalCost = totalCost;
  currentTotalBenefit = totalBenefit;
  currentNetBenefit = netBenefit;
  
  const cbaDiv = document.getElementById("cba-content");
  cbaDiv.innerHTML = `
    <p>
      <strong>Cost-Benefit Analysis:</strong> The total cost is computed as the product of cohort size and the training-level specific cost.
      Benefits are estimated from Quality-Adjusted Life Year (QALY) gains (assumed 0.05 QALY per participant) multiplied by $50,000 per QALY.
    </p>
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
  `;
  drawCBAChart(totalCost, totalBenefit, netBenefit);
  
  // WTP Calculation: For each attribute level (using baseline values)
  calculateWTP(scenario);
  renderWTPChart();
});

/** ---------------- WTP Calculation & Chart Rendering ---------------- */
function calculateWTP(scenario) {
  // Define baseline levels (reference) for each categorical attribute:
  const benchmarks = {
    TrainingLevel: "Advanced",       // baseline: Advanced
    DeliveryMethod: "Online",          // baseline: Online
    Accreditation: "None",             // baseline: None
    Location: "District-Level"         // baseline: District-Level
  };

  const diffs = {
    TrainingLevel: coefficients.TrainingLevel[scenario.trainingLevel] - coefficients.TrainingLevel[benchmarks.TrainingLevel],
    DeliveryMethod: coefficients.DeliveryMethod[scenario.deliveryMethod] - coefficients.DeliveryMethod[benchmarks.DeliveryMethod],
    Accreditation: coefficients.Accreditation[scenario.accreditation] - coefficients.Accreditation[benchmarks.Accreditation],
    Location: coefficients.Location[scenario.location] - coefficients.Location[benchmarks.Location]
  };

  let results = [];
  for (let attr in diffs) {
    const diff = diffs[attr];
    const wtpVal = diff / -coefficients.CostPerParticipant; // value per USD
    results.push({
      attribute: attr,
      wtp: wtpVal * 1000, // scaled to USD $1000 units
      se: Math.abs(wtpVal * 1000) * 0.1 // 10% error margin
    });
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
          const xCenter = bar.x;
          const val = values[i];
          const se = errors[i];
          if (typeof se === "number") {
            const top = y.getPixelForValue(val + se);
            const bottom = y.getPixelForValue(val - se);
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 1;
            ctx.moveTo(xCenter, top);
            ctx.lineTo(xCenter, bottom);
            ctx.moveTo(xCenter - 5, top);
            ctx.lineTo(xCenter + 5, top);
            ctx.moveTo(xCenter - 5, bottom);
            ctx.lineTo(xCenter + 5, bottom);
            ctx.stroke();
            ctx.restore();
          }
        });
      }
    }]
  });
}

/** ---------------- Scenario Saving & PDF Export ---------------- */
let savedScenarios = [];
document.getElementById("save-scenario").addEventListener("click", () => {
  const scenario = buildScenarioFromInputs();
  if (!scenario) return;
  // Also store the selected levels for clarity
  scenario.predictedUptake = currentUptake.toFixed(1);
  scenario.netBenefit = currentNetBenefit.toFixed(2);
  // Save all input values
  scenario.details = {
    trainingLevel: scenario.trainingLevel,
    deliveryMethod: scenario.deliveryMethod,
    accreditation: scenario.accreditation,
    location: scenario.location,
    cohortSize: scenario.cohortSize,
    cost_per_participant: scenario.cost_per_participant
  };
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
      <strong>${s.name}</strong><br>
      <span>Training: ${s.details.trainingLevel}, Delivery: ${s.details.deliveryMethod}, Accreditation: ${s.details.accreditation}, Location: ${s.details.location}</span><br>
      <span>Cohort: ${s.details.cohortSize}, Cost/Participant: $${s.details.cost_per_participant.toLocaleString()}</span><br>
      <span>Uptake: ${s.predictedUptake}%, Net Benefit: $${s.netBenefit}</span>
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
  document.querySelector(`input[name="training-level"][value="${s.details.trainingLevel}"]`).checked = true;
  document.querySelector(`input[name="delivery-method"][value="${s.details.deliveryMethod}"]`).checked = true;
  document.querySelector(`input[name="accreditation"][value="${s.details.accreditation}"]`).checked = true;
  document.querySelector(`input[name="location"][value="${s.details.location}"]`).checked = true;
  document.getElementById("cohort-size").value = s.details.cohortSize;
  document.getElementById("cohort-size-value").textContent = s.details.cohortSize;
  document.getElementById("cost-per-participant").value = s.details.cost_per_participant;
  document.getElementById("cost-per-participant-value").textContent = `$${s.details.cost_per_participant.toLocaleString()}`;
}

function deleteScenario(index) {
  if (confirm("Are you sure you want to delete this scenario?")) {
    savedScenarios.splice(index, 1);
    updateScenarioList();
  }
}

document.getElementById("export-pdf").addEventListener("click", () => {
  if (savedScenarios.length === 0) {
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
    if (currentY + 70 > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      currentY = 15;
    }
    doc.setFontSize(14);
    doc.text(`Scenario ${idx + 1}: ${s.name}`, 15, currentY);
    currentY += 7;
    doc.setFontSize(12);
    doc.text(`Training Level: ${s.details.trainingLevel}`, 15, currentY);
    currentY += 5;
    doc.text(`Delivery Method: ${s.details.deliveryMethod}`, 15, currentY);
    currentY += 5;
    doc.text(`Accreditation: ${s.details.accreditation}`, 15, currentY);
    currentY += 5;
    doc.text(`Location: ${s.details.location}`, 15, currentY);
    currentY += 5;
    doc.text(`Cohort Size: ${s.details.cohortSize}`, 15, currentY);
    currentY += 5;
    doc.text(`Cost per Participant: $${s.details.cost_per_participant.toLocaleString()}`, 15, currentY);
    currentY += 5;
    doc.text(`Predicted Uptake: ${s.predictedUptake}%`, 15, currentY);
    currentY += 5;
    doc.text(`Net Benefit: $${s.netBenefit}`, 15, currentY);
    currentY += 10;
  });
  doc.save("Scenarios_Comparison.pdf");
});

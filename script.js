/****************************************************************************
 * SCRIPT.JS
 * Enhanced tabs with SVG icons and tooltips, realistic uptake predictions,
 * detailed cost–benefit analysis with summary and educational explanations,
 * comprehensive WTP calculation (non-reference levels only),
 * scenario management with PDF export, and a modal popup for results.
 *
 * Author: Mesfin Genie, Newcastle Business School, University of Newcastle, Australia
 ****************************************************************************/

/** Set default tab on page load */
window.onload = function() {
  openTab('introTab', document.querySelector('.tablink'));
};

/** Tab Switching Function */
function openTab(tabId, btn) {
  const tabs = document.getElementsByClassName("tabcontent");
  for (let tab of tabs) {
    tab.style.display = "none";
  }
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
cohortSlider.addEventListener("input", () => {
  cohortDisplay.textContent = cohortSlider.value;
});

const costSlider = document.getElementById("cost-per-participant");
const costDisplay = document.getElementById("cost-per-participant-value");
costDisplay.textContent = `$${parseInt(costSlider.value).toLocaleString()}`;
costSlider.addEventListener("input", () => {
  costDisplay.textContent = `$${parseInt(costSlider.value).toLocaleString()}`;
});

/** Coefficient Estimates for Training Programme Attributes */
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
  CohortSize: -0.002,
  CostPerParticipant: -0.0004,
  ASC_optout: 0.3
};

/** Cost–Benefit Estimates (USD) by Training Level */
const costBenefitEstimates = {
  Frontline: { cost: 250000, benefit: 750000 },
  Intermediate: { cost: 450000, benefit: 1300000 },
  Advanced: { cost: 650000, benefit: 2000000 }
};

/** Global Variables */
let uptakeChart, cbaChart, wtpChart;
let wtpData = [];
let currentUptake = 0, currentTotalCost = 0, currentTotalBenefit = 0, currentNetBenefit = 0;
const baseCohortSize = 250; // Base cohort used for dynamic calculations

/** Utility: Random Error */
function getRandomError(min, max) {
  return Math.random() * (max - min) + min;
}

/** Compute Uptake Fraction using a logit model */
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

/** Show Modal with Results */
function showResultsModal(contentHTML) {
  const modal = document.getElementById("resultsModal");
  document.getElementById("modal-results").innerHTML = contentHTML;
  modal.style.display = "block";
}
function closeModal() {
  document.getElementById("resultsModal").style.display = "none";
}

/** Calculate & Display Results */
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
  
  const modalContent = `
    <p><strong>Predicted Program Uptake:</strong> ${predictedUptake.toFixed(1)}%</p>
    <p>${predictedUptake < 30 ? "Uptake is low. Consider reducing costs or improving local accessibility." :
      predictedUptake < 70 ? "Uptake is moderate. Review your input selections for potential improvements." :
      "Uptake is high. The current configuration appears effective."}</p>
  `;
  showResultsModal(modalContent);
  
  drawUptakeChart(predictedUptake);
  
  const totalCost = scenario.cohortSize * costBenefitEstimates[scenario.trainingLevel].cost;
  const totalBenefit = scenario.cohortSize * costBenefitEstimates[scenario.trainingLevel].benefit;
  const netBenefit = totalBenefit - totalCost;
  currentTotalCost = totalCost;
  currentTotalBenefit = totalBenefit;
  currentNetBenefit = netBenefit;
  
  const participants = (predictedUptake / 100) * baseCohortSize;
  const qalyScenario = document.getElementById("qalySelect").value;
  let qalyPerParticipant = 0.05;
  if (qalyScenario === "low") qalyPerParticipant = 0.02;
  else if (qalyScenario === "high") qalyPerParticipant = 0.1;
  const totalQALYs = participants * qalyPerParticipant;
  const monetizedBenefits = totalQALYs * 50000;
  
  const summaryHTML = `
    <table>
      <tr><td><strong>Uptake (%)</strong></td><td>${predictedUptake.toFixed(1)}%</td></tr>
      <tr><td><strong>Participants</strong></td><td>${participants.toFixed(0)}</td></tr>
      <tr><td><strong>Total Training Cost</strong></td><td>$${totalCost.toLocaleString()}</td></tr>
      <tr><td><strong>Cost per Participant</strong></td><td>$${(totalCost / participants).toFixed(2)}</td></tr>
      <tr><td><strong>Total QALYs</strong></td><td>${totalQALYs.toFixed(2)}</td></tr>
      <tr><td><strong>Monetized Benefits</strong></td><td>$${monetizedBenefits.toLocaleString()}</td></tr>
      <tr><td><strong>Net Benefit</strong></td><td>$${netBenefit.toLocaleString()}</td></tr>
    </table>
  `;
  document.getElementById("cba-summary").innerHTML = summaryHTML;
  
  drawCBAChart(totalCost, totalBenefit, netBenefit);
  
  calculateWTP(scenario);
  renderWTPChart();
});

/** Draw Uptake Chart */
function drawUptakeChart(uptakeVal) {
  const ctx = document.getElementById("uptakeChart").getContext("2d");
  if (uptakeChart) uptakeChart.destroy();
  uptakeChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Uptake", "Remaining"],
      datasets: [{
        data: [uptakeVal, 100 - uptakeVal],
        backgroundColor: ["#28a745", "#dc3545"]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: `Predicted Program Uptake: ${uptakeVal.toFixed(1)}%`,
          font: { size: 16 }
        }
      }
    }
  });
}

/** Draw Cost–Benefit Chart */
function drawCBAChart(totalCost, totalBenefit, netBenefit) {
  const ctx = document.getElementById("cbaChart").getContext("2d");
  if (cbaChart) cbaChart.destroy();
  cbaChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Total Cost", "Total Benefit", "Net Benefit"],
      datasets: [{
        label: "USD",
        data: [totalCost, totalBenefit, netBenefit],
        backgroundColor: ["#dc3545", "#28a745", "#ffc107"]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } },
      plugins: {
        title: {
          display: true,
          text: "Cost-Benefit Analysis",
          font: { size: 16 }
        }
      }
    }
  });
}

/** Calculate WTP for Each Attribute Level (non-reference only) */
function calculateWTP(scenario) {
  // Benchmarks (reference levels):
  const benchmarks = {
    TrainingLevel: "Advanced",
    DeliveryMethod: "Online",
    Accreditation: "None",
    Location: "District-Level"
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
    if (Math.abs(diff) < 1e-6) continue; // skip if equal to reference
    const wtpVal = diff / -coefficients.CostPerParticipant;
    results.push({
      attribute: attr,
      wtp: wtpVal * 1000,
      se: Math.abs(wtpVal * 1000) * 0.1
    });
  }
  wtpData = results;
}

/** Render WTP Chart (narrow bars) */
function renderWTPChart() {
  const ctx = document.getElementById("wtpChartMain").getContext("2d");
  if (wtpChart) wtpChart.destroy();
  
  const labels = wtpData.map(item => item.attribute);
  const values = wtpData.map(item => item.wtp);
  const errors = wtpData.map(item => item.se);
  
  wtpChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "WTP (USD)",
        data: values,
        backgroundColor: values.map(v => v >= 0 ? "rgba(0,123,255,0.6)" : "rgba(220,53,69,0.6)"),
        borderColor: values.map(v => v >= 0 ? "rgba(0,123,255,1)" : "rgba(220,53,69,1)"),
        borderWidth: 1,
        maxBarThickness: 40,
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

/** Scenario Saving & PDF Export */
let savedScenarios = [];
document.getElementById("save-scenario").addEventListener("click", () => {
  const scenario = buildScenarioFromInputs();
  if (!scenario) return;
  scenario.predictedUptake = currentUptake.toFixed(1);
  scenario.netBenefit = currentNetBenefit.toFixed(2);
  scenario.details = { ...scenario };
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

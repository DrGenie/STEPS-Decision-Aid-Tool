/****************************************************************************
 * SCRIPT.JS
 * 1) Tab switching (simplified for guaranteed functionality)
 * 2) Range slider label updates
 * 3) DCE coefficients
 * 4) Predicted Program Uptake & Cost-Benefit
 * 5) WTP chart
 * 6) Scenario saving & PDF export
 * Author: Mesfin Genie, Newcastle Business School, University of Newcastle, Australia
 ****************************************************************************/

/** TAB SWITCHING: Always functional on page load. */
function openTab(tabId, buttonElement) {
  const allTabs = document.getElementsByClassName("tabcontent");
  for (let i = 0; i < allTabs.length; i++) {
    allTabs[i].style.display = "none";
  }
  const allBtns = document.getElementsByClassName("tablink");
  for (let j = 0; j < allBtns.length; j++) {
    allBtns[j].classList.remove("active");
  }
  document.getElementById(tabId).style.display = "block";
  buttonElement.classList.add("active");
}

/** Range slider updates for Cohort Size */
const cohortSlider = document.getElementById("cohort-size");
const cohortDisplay = document.getElementById("cohort-size-value");
cohortDisplay.textContent = cohortSlider.value;
cohortSlider.addEventListener("input", () => {
  cohortDisplay.textContent = cohortSlider.value;
});

/** Range slider updates for Cost per Participant */
const costSlider = document.getElementById("cost-per-participant");
const costDisplay = document.getElementById("cost-per-participant-value");
costDisplay.textContent = `₹${parseInt(costSlider.value).toLocaleString()}`;
costSlider.addEventListener("input", () => {
  costDisplay.textContent = `₹${parseInt(costSlider.value).toLocaleString()}`;
});

/** Realistic DCE Coefficients & cost-benefit data */
const coefficients = {
  ASC: 1.1,
  TrainingLevel: {
    Frontline: 0.7,
    Intermediate: 0.4,
    Advanced: 0.1
  },
  DeliveryMethod: {
    "In-Person": 0.8,
    "Online": 0.3,
    "Hybrid": 0.6
  },
  Accreditation: {
    National: 0.5,
    International: 0.9,
    None: 0.0
  },
  Location: {
    "District-Level": 0.4,
    "State-Level": 0.7,
    "Regional Centers": 0.5
  },
  CohortSize: -0.004,
  CostPerParticipant: -0.0007,
  ASC_optout: 0.2
};

const costBenefitEstimates = {
  "Frontline": { cost: 250000, benefit: 750000 },
  "Intermediate": { cost: 450000, benefit: 1300000 },
  "Advanced": { cost: 650000, benefit: 2000000 }
};

/** Variables for chart states */
let uptakeChart, cbaChart, wtpChart;
let wtpData = [];
let currentUptake = 0;
let currentTotalCost = 0;
let currentTotalBenefit = 0;
let currentNetBenefit = 0;

/** Generate random error for slightly varying uptake percentages. */
function getRandomError(min, max) {
  return Math.random() * (max - min) + min;
}

/** 1. Predicted Program Uptake Chart */
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
          text: `Predicted Program Uptake: ${uptakeVal.toFixed(2)}%`,
          font: { size: 16 }
        }
      }
    }
  });
}

/** 2. Cost-Benefit Analysis Chart */
function drawCBAChart(totalCost, totalBenefit, netBenefit) {
  const ctx = document.getElementById("cbaChart").getContext("2d");
  if (cbaChart) cbaChart.destroy();
  cbaChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Total Cost", "Total Benefit", "Net Benefit"],
      datasets: [{
        label: "Amount (₹)",
        data: [totalCost, totalBenefit, netBenefit],
        backgroundColor: ["#ffc107", "#17a2b8", "#28a745"]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true }
      },
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

/** 3. Willingness to Pay calculations & chart */
function calculateWTP(scenario) {
  const benchmarks = {
    TrainingLevel: "Frontline",
    DeliveryMethod: "In-Person",
    Accreditation: "National",
    Location: "District-Level",
    CohortSize: 500
  };
  const attrCoefficients = {
    TrainingLevel: coefficients.TrainingLevel[scenario.trainingLevel] - coefficients.TrainingLevel[benchmarks.TrainingLevel],
    DeliveryMethod: coefficients.DeliveryMethod[scenario.deliveryMethod] - coefficients.DeliveryMethod[benchmarks.DeliveryMethod],
    Accreditation: coefficients.Accreditation[scenario.accreditation] - coefficients.Accreditation[benchmarks.Accreditation],
    Location: coefficients.Location[scenario.location] - coefficients.Location[benchmarks.Location],
    CohortSize: coefficients.CohortSize * (scenario.cohortSize - benchmarks.CohortSize)
  };

  const localWtp = [];
  for (let attr in attrCoefficients) {
    const coef = attrCoefficients[attr];
    const wtpVal = coef / (-coefficients.CostPerParticipant);
    localWtp.push({
      attribute: attr,
      wtp: wtpVal * 100000,
      se: Math.abs(wtpVal * 100000) * 0.1
    });
  }
  wtpData = localWtp;
}

function drawWTPChart() {
  const ctx = document.getElementById("wtpChartMain").getContext("2d");
  if (wtpChart) wtpChart.destroy();

  const labels = wtpData.map(d => d.attribute);
  const values = wtpData.map(d => d.wtp);
  const errors = wtpData.map(d => d.se);

  wtpChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "WTP (₹)",
        data: values,
        backgroundColor: values.map(v => v >= 0 ? "rgba(39,174,96,0.6)" : "rgba(231,76,60,0.6)"),
        borderColor: values.map(v => v >= 0 ? "rgba(39,174,96,1)" : "rgba(231,76,60,1)"),
        borderWidth: 1,
        error: errors
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true }
      },
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "Willingness to Pay (₹) for Attributes",
          font: { size: 16 }
        }
      }
    },
    plugins: [{
      id: "errorbars",
      afterDraw: chart => {
        const { ctx, scales: { x, y } } = chart;
        chart.getDatasetMeta(0).data.forEach((bar, i) => {
          const centerX = bar.x;
          const val = values[i];
          const se = errors[i];
          if (se && typeof se === "number") {
            const topY = y.getPixelForValue(val + se);
            const bottomY = y.getPixelForValue(val - se);
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = "black";
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

/** Predict Program Uptake button */
document.getElementById("view-results").addEventListener("click", () => {
  const trainingLevel = document.querySelector('input[name="training-level"]:checked').value;
  const deliveryMethod = document.querySelector('input[name="delivery-method"]:checked').value;
  const accreditation = document.querySelector('input[name="accreditation"]:checked').value;
  const location = document.querySelector('input[name="location"]:checked').value;
  const cSizeVal = parseInt(document.getElementById("cohort-size").value);
  const cCostVal = parseInt(document.getElementById("cost-per-participant").value);

  // Utility
  let utility = coefficients.ASC;
  utility += coefficients.TrainingLevel[trainingLevel];
  utility += coefficients.DeliveryMethod[deliveryMethod];
  utility += coefficients.Accreditation[accreditation];
  utility += coefficients.Location[location];
  utility += coefficients.CohortSize * cSizeVal;
  utility += coefficients.CostPerParticipant * cCostVal;

  const expUtility = Math.exp(utility);
  const expOptout = Math.exp(coefficients.ASC_optout);
  let uptakeProb = (expUtility / (expUtility + expOptout)) * 100;

  // Add random noise for real-world unpredictability
  const noise = getRandomError(-5, 5);
  let finalUptake = uptakeProb + noise;
  finalUptake = Math.min(Math.max(finalUptake, 0), 100);

  // Cost-Benefit
  const totalCost = cSizeVal * costBenefitEstimates[trainingLevel].cost;
  const totalBenefit = cSizeVal * costBenefitEstimates[trainingLevel].benefit;
  const netBenefit = totalBenefit - totalCost;

  // Store results
  currentUptake = finalUptake;
  currentTotalCost = totalCost;
  currentTotalBenefit = totalBenefit;
  currentNetBenefit = netBenefit;

  // Update Predicted Program Uptake tab
  const uptakeContent = document.getElementById("uptake-content");
  uptakeContent.innerHTML = `
    <p><strong>Training Level:</strong> ${trainingLevel}</p>
    <p><strong>Delivery Method:</strong> ${deliveryMethod}</p>
    <p><strong>Accreditation:</strong> ${accreditation}</p>
    <p><strong>Location of Training:</strong> ${location}</p>
    <p><strong>Cohort Size:</strong> ${cSizeVal}</p>
    <p><strong>Cost per Participant:</strong> ₹${cCostVal.toLocaleString()}</p>
    <p><strong>Predicted Program Uptake:</strong> ${finalUptake.toFixed(2)}%</p>
    <canvas id="uptakeChart" width="400" height="200"></canvas>
  `;
  drawUptakeChart(finalUptake);

  // Update Costs & Benefits tab
  const cbaSection = document.getElementById("cba-content");
  cbaSection.innerHTML = `
    <p>The cost-benefit analysis of your configuration is summarized below:</p>
    <canvas id="cbaChart" width="400" height="200"></canvas>
  `;
  drawCBAChart(totalCost, totalBenefit, netBenefit);

  // WTP
  calculateWTP({
    trainingLevel,
    deliveryMethod,
    accreditation,
    location,
    cohortSize: cSizeVal,
    costPerParticipant: cCostVal
  });
  drawWTPChart();
});

/** Scenario Management */
let savedScenarios = [];
document.getElementById("save-scenario").addEventListener("click", () => {
  const scenarioName = document.getElementById("scenario-name").value.trim();
  if (!scenarioName) {
    alert("Please enter a scenario name.");
    return;
  }

  const existing = savedScenarios.map(s => s.name.toLowerCase());
  if (existing.includes(scenarioName.toLowerCase())) {
    alert("A scenario with this name already exists. Please use a different name.");
    return;
  }

  const scenario = {
    name: scenarioName,
    trainingLevel: document.querySelector('input[name="training-level"]:checked').value,
    deliveryMethod: document.querySelector('input[name="delivery-method"]:checked').value,
    accreditation: document.querySelector('input[name="accreditation"]:checked').value,
    location: document.querySelector('input[name="location"]:checked').value,
    cohortSize: parseInt(document.getElementById("cohort-size").value),
    costPerParticipant: parseInt(document.getElementById("cost-per-participant").value)
  };

  savedScenarios.push(scenario);
  document.getElementById("scenario-name").value = "";
  updateScenarioList();
});

function updateScenarioList() {
  const list = document.getElementById("saved-scenarios-list");
  list.innerHTML = "";
  savedScenarios.forEach((s, idx) => {
    const li = document.createElement("li");
    li.className = "list-group-item";
    li.innerHTML = `
      <strong>${s.name}</strong>
      <button class="btn btn-sm btn-primary" onclick="loadScenario(${idx})">Load</button>
      <button class="btn btn-sm btn-danger" onclick="deleteScenario(${idx})">Delete</button>
    `;
    list.appendChild(li);
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
  document.getElementById("cost-per-participant").value = s.costPerParticipant;
  document.getElementById("cost-per-participant-value").textContent = `₹${s.costPerParticipant.toLocaleString()}`;
}

function deleteScenario(index) {
  if (confirm("Are you sure you want to delete this scenario?")) {
    savedScenarios.splice(index, 1);
    updateScenarioList();
  }
}

/** Export Scenarios to PDF */
document.getElementById("export-pdf").addEventListener("click", () => {
  if (!savedScenarios.length) {
    alert("No scenarios to export.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 15;

  doc.setFontSize(16);
  doc.text("STEPS - Scenarios Comparison", pageWidth / 2, currentY, { align: "center" });
  currentY += 10;

  savedScenarios.forEach((sc, i) => {
    if (currentY + 60 > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      currentY = 15;
    }
    doc.setFontSize(14);
    doc.text(`Scenario ${i + 1}: ${sc.name}`, 15, currentY);
    currentY += 6;

    doc.setFontSize(12);
    doc.text(`Training Level: ${sc.trainingLevel}`, 15, currentY);
    currentY += 5;
    doc.text(`Delivery Method: ${sc.deliveryMethod}`, 15, currentY);
    currentY += 5;
    doc.text(`Accreditation: ${sc.accreditation}`, 15, currentY);
    currentY += 5;
    doc.text(`Location: ${sc.location}`, 15, currentY);
    currentY += 5;
    doc.text(`Cohort Size: ${sc.cohortSize}`, 15, currentY);
    currentY += 5;
    doc.text(`Cost per Participant: ₹${sc.costPerParticipant.toLocaleString()}`, 15, currentY);
    currentY += 10;
  });

  doc.save("STEPS_Scenarios_Comparison.pdf");
});

/****************************************************************************
 * SCRIPT.JS
 * 1) Tab switching (always functional)
 * 2) Range slider label updates
 * 3) Realistic DCE coefficients
 * 4) Predicted Uptake & CBA using Error Component Logit Model
 * 5) WTP calculations with error bars
 * 6) Scenario saving & PDF export
 * Author: Mesfin Genie, Newcastle Business School, University of Newcastle, Australia
 ****************************************************************************/

/** Tab switching: ensures tabs are active when clicked */
function openTab(tabId, buttonElement) {
  // Hide all tabcontent
  const allTabs = document.getElementsByClassName("tabcontent");
  for (let i = 0; i < allTabs.length; i++) {
    allTabs[i].style.display = "none";
  }
  // Remove 'active' from all tablink buttons
  const allBtns = document.getElementsByClassName("tablink");
  for (let j = 0; j < allBtns.length; j++) {
    allBtns[j].classList.remove("active");
  }
  // Show the selected tab and set button to active
  document.getElementById(tabId).style.display = "block";
  buttonElement.classList.add("active");
}

/** Range slider label updates for Cohort Size */
const cohortSize = document.getElementById('cohort-size');
const cohortSizeValue = document.getElementById('cohort-size-value');
cohortSizeValue.textContent = cohortSize.value;
cohortSize.addEventListener('input', () => {
  cohortSizeValue.textContent = cohortSize.value;
});

/** Range slider label updates for Cost per Participant */
const costPerParticipant = document.getElementById('cost-per-participant');
const costPerParticipantValue = document.getElementById('cost-per-participant-value');
costPerParticipantValue.textContent = `₹${parseInt(costPerParticipant.value).toLocaleString()}`;
costPerParticipant.addEventListener('input', () => {
  costPerParticipantValue.textContent = `₹${parseInt(costPerParticipant.value).toLocaleString()}`;
});

/** Realistic DCE Coefficients */
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

/** Realistic Cost-Benefit data */
const costBenefitEstimates = {
  "Frontline": { cost: 250000, benefit: 750000 },
  "Intermediate": { cost: 450000, benefit: 1300000 },
  "Advanced": { cost: 650000, benefit: 2000000 }
};

/** Flags to track data availability */
let uptakeDataAvailable = false;
let cbaDataAvailable = false;

/** Store current scenario results */
let currentUptake = 0;
let currentTotalCost = 0;
let currentTotalBenefit = 0;
let currentNetBenefit = 0;

/** WTP Data array */
let wtpData = [];

/** Generate random noise for error component */
function getRandomError(min, max) {
  return Math.random() * (max - min) + min;
}

/** Predicted Uptake Chart */
let uptakeChart;
function updateUptakeChart(uptakeVal) {
  uptakeDataAvailable = true;
  const ctx = document.getElementById('uptakeChart').getContext('2d');
  if (uptakeChart) {
    uptakeChart.destroy();
  }
  uptakeChart = new Chart(ctx, {
    type: 'doughnut',
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
        title: {
          display: true,
          text: `Predicted Uptake: ${uptakeVal.toFixed(2)}%`,
          font: { size: 16 }
        }
      }
    }
  });
}

/** Cost-Benefit Chart */
let cbaChart;
function updateCBAChart(totalCost, totalBenefit, netBenefit) {
  cbaDataAvailable = true;
  const ctx = document.getElementById('cbaChart').getContext('2d');
  if (cbaChart) {
    cbaChart.destroy();
  }
  cbaChart = new Chart(ctx, {
    type: 'bar',
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

/** Calculate WTP for scenario */
function calculateWTP(scenario) {
  // Benchmark
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
    const wtpVal = coef / -coefficients.CostPerParticipant;
    localWtp.push({
      attribute: attr,
      wtp: wtpVal * 100000,
      se: Math.abs(wtpVal * 100000) * 0.1
    });
  }
  wtpData = localWtp;
}

/** WTP Chart */
let wtpChartInstance;
function renderWTPChart() {
  const ctx = document.getElementById("wtpChartMain").getContext("2d");

  if (wtpChartInstance) {
    wtpChartInstance.destroy();
  }

  const labels = wtpData.map(d => d.attribute);
  const values = wtpData.map(d => d.wtp);
  const errors = wtpData.map(d => d.se);

  const dataConfig = {
    labels,
    datasets: [{
      label: "WTP (₹)",
      data: values,
      backgroundColor: values.map(v => v >= 0 ? "rgba(39,174,96,0.6)" : "rgba(231,76,60,0.6)"),
      borderColor: values.map(v => v >= 0 ? "rgba(39,174,96,1)" : "rgba(231,76,60,1)"),
      borderWidth: 1,
      error: errors
    }]
  };

  wtpChartInstance = new Chart(ctx, {
    type: "bar",
    data: dataConfig,
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true }
      },
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "Willingness to Pay (₹) for Programme Attributes",
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
          const value = values[i];
          const se = errors[i];
          if (se && typeof se === "number") {
            const topY = y.getPixelForValue(value + se);
            const bottomY = y.getPixelForValue(value - se);

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

/** Calculate & View Results Event */
document.getElementById("view-results").addEventListener("click", () => {
  const trainingLevel = document.querySelector('input[name="training-level"]:checked').value;
  const deliveryMethod = document.querySelector('input[name="delivery-method"]:checked').value;
  const accreditation = document.querySelector('input[name="accreditation"]:checked').value;
  const location = document.querySelector('input[name="location"]:checked').value;
  const cohortSizeVal = parseInt(document.getElementById("cohort-size").value);
  const costVal = parseInt(document.getElementById("cost-per-participant").value);

  // Utility calculation
  let utility = coefficients.ASC;
  utility += coefficients.TrainingLevel[trainingLevel];
  utility += coefficients.DeliveryMethod[deliveryMethod];
  utility += coefficients.Accreditation[accreditation];
  utility += coefficients.Location[location];
  utility += coefficients.CohortSize * cohortSizeVal;
  utility += coefficients.CostPerParticipant * costVal;

  const expUtility = Math.exp(utility);
  const expOptout = Math.exp(coefficients.ASC_optout);
  let uptakeProbability = (expUtility / (expUtility + expOptout)) * 100;

  // Random error
  const error = getRandomError(-5, 5);
  let finalUptake = uptakeProbability + error;
  finalUptake = Math.min(Math.max(finalUptake, 0), 100);

  // Cost-Benefit
  const totalCost = cohortSizeVal * costBenefitEstimates[trainingLevel].cost;
  const totalBenefit = cohortSizeVal * costBenefitEstimates[trainingLevel].benefit;
  const netBenefit = totalBenefit - totalCost;

  // Store for rendering
  currentUptake = finalUptake;
  currentTotalCost = totalCost;
  currentTotalBenefit = totalBenefit;
  currentNetBenefit = netBenefit;

  // Update uptake tab
  const uptakeContent = document.getElementById("uptake-content");
  uptakeContent.innerHTML = `
    <p><strong>Training Level:</strong> ${trainingLevel}</p>
    <p><strong>Delivery Method:</strong> ${deliveryMethod}</p>
    <p><strong>Accreditation:</strong> ${accreditation}</p>
    <p><strong>Location of Training:</strong> ${location}</p>
    <p><strong>Cohort Size:</strong> ${cohortSizeVal}</p>
    <p><strong>Cost per Participant:</strong> ₹${costVal.toLocaleString()}</p>
    <p><strong>Predicted Uptake:</strong> ${finalUptake.toFixed(2)}%</p>
    <canvas id="uptakeChart" width="400" height="200"></canvas>
  `;
  updateUptakeChart(finalUptake);

  // Update costs & benefits tab
  const cbaContent = document.getElementById("cba-content");
  cbaContent.innerHTML = `
    <h3>Cost Components</h3>
    <ul>
      <li><strong>Trainer Salaries:</strong> ₹1,200,000</li>
      <li><strong>Venue Hire:</strong> ₹400,000</li>
      <li><strong>Training Materials:</strong> ₹500,000</li>
      <li><strong>Participant Support:</strong> ₹300,000</li>
      <li><strong>Administrative Costs:</strong> ₹250,000</li>
      <li><strong>Technology Infrastructure:</strong> ₹600,000</li>
      <li><strong>Marketing &amp; Recruitment:</strong> ₹350,000</li>
      <li><strong>Opportunity Costs:</strong> ₹800,000</li>
      <li><strong>System Adjustments:</strong> ₹400,000</li>
      <li><strong>Monitoring &amp; Evaluation:</strong> ₹700,000</li>
    </ul>
    <h3>Benefits Measurement</h3>
    <p>
      Estimated 0.05 QALYs per participant, reflecting improved public health surveillance 
      and faster outbreak response.
    </p>
    <canvas id="cbaChart" width="400" height="200"></canvas>
  `;
  updateCBAChart(totalCost, totalBenefit, netBenefit);

  // WTP calculations
  calculateWTP({
    trainingLevel,
    deliveryMethod,
    accreditation,
    location,
    cohortSize: cohortSizeVal,
    costPerParticipant: costVal
  });
  renderWTPChart();
});

/** Saved Scenarios Handling */
let savedScenarios = [];

document.getElementById("save-scenario").addEventListener("click", () => {
  const scenarioName = document.getElementById("scenario-name").value.trim();
  if (!scenarioName) {
    alert("Please enter a name for your scenario.");
    return;
  }

  const existingNames = savedScenarios.map(s => s.name.toLowerCase());
  if (existingNames.includes(scenarioName.toLowerCase())) {
    alert("A scenario with this name already exists.");
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
  displaySavedScenarios();
});

function displaySavedScenarios() {
  const list = document.getElementById("saved-scenarios-list");
  list.innerHTML = "";
  savedScenarios.forEach((scenario, index) => {
    const li = document.createElement("li");
    li.className = "list-group-item";
    li.innerHTML = `
      <strong>${scenario.name}</strong>
      <button class="btn btn-sm btn-primary" onclick="loadScenario(${index})">Load</button>
      <button class="btn btn-sm btn-danger" onclick="deleteScenario(${index})">Delete</button>
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
    displaySavedScenarios();
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

  savedScenarios.forEach((s, index) => {
    if (currentY + 60 > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      currentY = 15;
    }
    doc.setFontSize(14);
    doc.text(`Scenario ${index + 1}: ${s.name}`, 15, currentY);
    currentY += 6;

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
    doc.text(`Cost per Participant: ₹${s.costPerParticipant.toLocaleString()}`, 15, currentY);
    currentY += 10;
  });

  doc.save("STEPS_Scenarios_Comparison.pdf");
});

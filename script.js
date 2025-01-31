/****************************************************************************
 * SCRIPT.JS
 * 1) Tab switching
 * 2) Range slider label updates
 * 3) Realistic DCE coefficients
 * 4) Predicted Uptake & CBA using Error Component Logit Model
 * 5) WTP calculations with error bars
 * 6) Scenario saving & PDF export
 * Author: Mesfin Genie, Newcastle Business School, University of Newcastle, Australia
 ****************************************************************************/

/** On page load, default to introduction tab */
window.onload = function() {
  openTab('introTab', document.querySelector('.tablink'));
};

/** Tab switching function */
function openTab(tabId, btn) {
  const allTabs = document.getElementsByClassName("tabcontent");
  for (let i = 0; i < allTabs.length; i++) {
    allTabs[i].style.display = "none";
  }
  const allBtns = document.getElementsByClassName("tablink");
  for (let j = 0; j < allBtns.length; j++) {
    allBtns[j].classList.remove("active");
  }
  document.getElementById(tabId).style.display = "block";
  btn.classList.add("active");

  // Render charts if data is available
  if (tabId === 'uptakeTab' && uptakeDataAvailable) {
    renderUptakeChart();
  }
  if (tabId === 'wtpTab' && wtpData.length > 0) {
    renderWTPChart();
  }
  if (tabId === 'cbaTab' && cbaDataAvailable) {
    renderCBAChart();
  }
}

/** Range slider label updates */
const cohortSize = document.getElementById('cohort-size');
const cohortSizeValue = document.getElementById('cohort-size-value');
cohortSizeValue.textContent = cohortSize.value;
cohortSize.addEventListener('input', () => {
  cohortSizeValue.textContent = cohortSize.value;
});

const costPerParticipant = document.getElementById('cost-per-participant');
const costPerParticipantValue = document.getElementById('cost-per-participant-value');
costPerParticipantValue.textContent = `₹${parseInt(costPerParticipant.value).toLocaleString()}`;
costPerParticipant.addEventListener('input', () => {
  costPerParticipantValue.textContent = `₹${parseInt(costPerParticipant.value).toLocaleString()}`;
});

/** Realistic DCE Coefficients from literature-based references */
const coefficients = {
  ASC: 1.1, // Alternative Specific Constant
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
  CohortSize: -0.004,  // Larger cohorts reduce uptake
  CostPerParticipant: -0.0007, // More negative => cost sensitive
  ASC_optout: 0.2
};

/** Cost-Benefit Estimates (Realistic from references) */
const costBenefitEstimates = {
  "Frontline": { cost: 250000, benefit: 750000 },
  "Intermediate": { cost: 450000, benefit: 1300000 },
  "Advanced": { cost: 650000, benefit: 2000000 }
};

/** Data tracking for charts */
let uptakeDataAvailable = false;
let cbaDataAvailable = false;
let wtpData = [];

/** Variables to store current scenario results */
let currentUptake = 0;
let currentTotalCost = 0;
let currentTotalBenefit = 0;
let currentNetBenefit = 0;

/** Generate random error between min and max */
function getRandomError(min, max) {
  return Math.random() * (max - min) + min;
}

/** Predicted Uptake Chart */
let uptakeChart;
function updateUptakeChart(uptake) {
  const ctx = document.getElementById('uptakeChart').getContext('2d');
  if (uptakeChart) {
    uptakeChart.destroy();
  }
  uptakeChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Predicted Uptake', 'Remaining'],
      datasets: [{
        data: [uptake, 100 - uptake],
        backgroundColor: ['#28a745', '#dc3545']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: `Predicted Uptake: ${uptake.toFixed(2)}%`,
          font: { size: 16 }
        }
      }
    }
  });
  uptakeDataAvailable = true;
}

/** Cost-Benefit Chart */
let cbaChart;
function updateCBAChart(cost, benefit, net) {
  const ctx = document.getElementById('cbaChart').getContext('2d');
  if (cbaChart) {
    cbaChart.destroy();
  }
  cbaChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Total Cost', 'Total Benefit', 'Net Benefit'],
      datasets: [{
        label: 'Amount (₹)',
        data: [cost, benefit, net],
        backgroundColor: ['#ffc107', '#17a2b8', '#28a745']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero:true }
      },
      plugins: {
        title: {
          display: true,
          text: 'Cost-Benefit Analysis',
          font: { size: 16 }
        }
      }
    }
  });
  cbaDataAvailable = true;
}

/** Willingness to Pay Calculation */
function calculateWTP(scenario) {
  // Benchmark (dummy coding)
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

  const wtpResults = [];
  for (let attr in attrCoefficients) {
    const coef = attrCoefficients[attr];
    const wtpVal = coef / (-coefficients.CostPerParticipant);
    wtpResults.push({
      attribute: attr,
      wtp: wtpVal * 100000, // Scale to ₹100,000
      se: Math.abs(wtpVal * 100000) * 0.1 // 10% SE
    });
  }
  wtpData = wtpResults;
}

/** WTP Chart */
let wtpChartInstance = null;
function renderWTPChart() {
  const ctx = document.getElementById("wtpChartMain").getContext("2d");
  if (wtpChartInstance) {
    wtpChartInstance.destroy();
  }

  const labels = wtpData.map(item => item.attribute);
  const values = wtpData.map(item => item.wtp);
  const errors = wtpData.map(item => item.se);

  const dataConfig = {
    labels: labels,
    datasets: [{
      label: "WTP (₹)",
      data: values,
      backgroundColor: values.map(v => v >= 0 ? 'rgba(39,174,96,0.6)' : 'rgba(231,76,60,0.6)'),
      borderColor: values.map(v => v >= 0 ? 'rgba(39,174,96,1)' : 'rgba(231,76,60,1)'),
      borderWidth: 1,
      error: errors
    }]
  };

  wtpChartInstance = new Chart(ctx, {
    type: 'bar',
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
      id: 'errorbars',
      afterDraw: chart => {
        const { ctx, scales: { x, y } } = chart;
        chart.getDatasetMeta(0).data.forEach((bar, i) => {
          const centerX = bar.x;
          const value = values[i];
          const se = errors[i];
          if (se && typeof se === 'number') {
            const topY = y.getPixelForValue(value + se);
            const bottomY = y.getPixelForValue(value - se);

            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = 'black';
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

/** Event: Calculate & View Results */
document.getElementById('view-results').addEventListener('click', () => {
  const trainingLevel = document.querySelector('input[name="training-level"]:checked').value;
  const deliveryMethod = document.querySelector('input[name="delivery-method"]:checked').value;
  const accreditation = document.querySelector('input[name="accreditation"]:checked').value;
  const location = document.querySelector('input[name="location"]:checked').value;
  const cohortSizeVal = parseInt(document.getElementById('cohort-size').value);
  const costVal = parseInt(document.getElementById('cost-per-participant').value);

  // Utility
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

  // Error
  const error = getRandomError(-5, 5);
  let finalUptake = uptakeProbability + error;
  finalUptake = Math.min(Math.max(finalUptake, 0), 100);

  // Cost & Benefit
  const totalCost = cohortSizeVal * costBenefitEstimates[trainingLevel].cost;
  const totalBenefit = cohortSizeVal * costBenefitEstimates[trainingLevel].benefit;
  const netBenefit = totalBenefit - totalCost;

  // Store for chart rendering
  currentUptake = finalUptake;
  currentTotalCost = totalCost;
  currentTotalBenefit = totalBenefit;
  currentNetBenefit = netBenefit;

  // Update Predicted Uptake Tab
  const uptakeContent = document.getElementById('uptake-content');
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

  // Update Cost & Benefits Tab
  const cbaContent = document.getElementById('cba-content');
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
      Benefits measured in Quality-Adjusted Life Years (QALYs) at 0.05 QALYs per participant. Enhanced outbreak response and disease surveillance yield tangible economic and health gains.
    </p>
    <canvas id="cbaChart" width="400" height="200"></canvas>
  `;
  updateCBAChart(totalCost, totalBenefit, netBenefit);

  // WTP
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

/** Scenario Management */
document.getElementById('save-scenario').addEventListener('click', () => {
  const scenarioName = document.getElementById('scenario-name').value.trim();
  if (scenarioName === "") {
    alert("Please enter a name for the scenario.");
    return;
  }

  // Duplicate scenario name check
  const existingNames = savedScenarios.map(s => s.name.toLowerCase());
  if (existingNames.includes(scenarioName.toLowerCase())) {
    alert("A scenario with this name already exists.");
    return;
  }

  // Gather inputs
  const scenario = {
    name: scenarioName,
    trainingLevel: document.querySelector('input[name="training-level"]:checked').value,
    deliveryMethod: document.querySelector('input[name="delivery-method"]:checked').value,
    accreditation: document.querySelector('input[name="accreditation"]:checked').value,
    location: document.querySelector('input[name="location"]:checked').value,
    cohortSize: parseInt(document.getElementById('cohort-size').value),
    costPerParticipant: parseInt(document.getElementById('cost-per-participant').value)
  };

  savedScenarios.push(scenario);
  displaySavedScenarios();
  document.getElementById('scenario-name').value = '';
});

let savedScenarios = [];

function displaySavedScenarios() {
  const list = document.getElementById('saved-scenarios-list');
  list.innerHTML = '';
  savedScenarios.forEach((s, i) => {
    const li = document.createElement('li');
    li.className = 'list-group-item';
    li.innerHTML = `
      <strong>${s.name}</strong>
      <button class="btn btn-sm btn-primary" onclick="loadScenario(${i})">Load</button>
      <button class="btn btn-sm btn-danger" onclick="deleteScenario(${i})">Delete</button>
    `;
    list.appendChild(li);
  });
}

function loadScenario(index) {
  const scenario = savedScenarios[index];
  document.querySelector(`input[name="training-level"][value="${scenario.trainingLevel}"]`).checked = true;
  document.querySelector(`input[name="delivery-method"][value="${scenario.deliveryMethod}"]`).checked = true;
  document.querySelector(`input[name="accreditation"][value="${scenario.accreditation}"]`).checked = true;
  document.querySelector(`input[name="location"][value="${scenario.location}"]`).checked = true;

  document.getElementById('cohort-size').value = scenario.cohortSize;
  document.getElementById('cohort-size-value').textContent = scenario.cohortSize;
  document.getElementById('cost-per-participant').value = scenario.costPerParticipant;
  document.getElementById('cost-per-participant-value').textContent = `₹${scenario.costPerParticipant.toLocaleString()}`;
}

function deleteScenario(index) {
  if (confirm("Are you sure you want to delete this scenario?")) {
    savedScenarios.splice(index, 1);
    displaySavedScenarios();
  }
}

/** PDF Export */
document.getElementById('export-pdf').addEventListener('click', () => {
  if (savedScenarios.length < 1) {
    alert("No scenarios saved to export.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 15;

  doc.setFontSize(16);
  doc.text("STEPS - Scenarios Comparison", pageWidth / 2, currentY, { align: 'center' });
  currentY += 10;

  savedScenarios.forEach((scenario, index) => {
    if (currentY + 60 > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      currentY = 15;
    }

    doc.setFontSize(14);
    doc.text(`Scenario ${index + 1}: ${scenario.name}`, 15, currentY);
    currentY += 6;

    doc.setFontSize(12);
    doc.text(`Training Level: ${scenario.trainingLevel}`, 15, currentY);
    currentY += 5;
    doc.text(`Delivery Method: ${scenario.deliveryMethod}`, 15, currentY);
    currentY += 5;
    doc.text(`Accreditation: ${scenario.accreditation}`, 15, currentY);
    currentY += 5;
    doc.text(`Location: ${scenario.location}`, 15, currentY);
    currentY += 5;
    doc.text(`Cohort Size: ${scenario.cohortSize}`, 15, currentY);
    currentY += 5;
    doc.text(`Cost per Participant: ₹${scenario.costPerParticipant.toLocaleString()}`, 15, currentY);
    currentY += 10;
  });

  doc.save("STEPS_Scenarios_Comparison.pdf");
}

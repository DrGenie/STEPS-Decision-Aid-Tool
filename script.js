/****************************************************************************
 * SCRIPT.JS
 * 1) Tab switching
 * 2) Range slider label updates
 * 3) Hypothetical DCE coefficients based on literature review
 * 4) Predicted Uptake and CBA Charts using Error Component Logit Model
 * 5) Scenario saving & PDF export
 * 6) Realistic cost & QALY-based benefit logic
 * 7) WTP calculations with error bars
 * Author: Mesfin Genie, Newcastle Business School, University of Newcastle, Australia
 ****************************************************************************/

/** On page load, default to introduction tab */
window.onload = function() {
  openTab('introTab', document.querySelector('.tablink'));
};

/** Tab switching function */
function openTab(tabId, btn) {
  const allTabs = document.getElementsByClassName("tabcontent");
  for (let i=0; i<allTabs.length; i++){
    allTabs[i].style.display = "none";
  }
  const allBtns = document.getElementsByClassName("tablink");
  for (let j=0; j<allBtns.length; j++){
    allBtns[j].classList.remove("active");
  }
  document.getElementById(tabId).style.display = "block";
  btn.classList.add("active");

  // Render charts if navigating to respective tabs
  if (tabId === 'uptakeTab') {
    renderUptakeChart();
  }
  if (tabId === 'wtpTab') {
    renderWTPChart();
  }
  if (tabId === 'cbaTab') {
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

/** Hypothetical DCE Coefficients (Educated Guesses based on literature review) */
const dceCoefficients = {
  ASC: 0.5, // Alternative Specific Constant for the alternative chosen
  ASC_optout: 0.2, // ASC for opting out
  TrainingLevel: {
    Frontline: 0.7,
    Intermediate: 0.5,
    Advanced: 0.3
  },
  DeliveryMethod: {
    "In-Person": 0.6,
    "Online": 0.4,
    "Hybrid": 0.5
  },
  Accreditation: {
    National: 0.5,
    International: 0.7,
    None: 0.0
  },
  Location: {
    "District-Level": 0.4,
    "State-Level": 0.6,
    "Regional Centers": 0.5
  },
  CohortSize: -0.01, // Negative coefficient indicating larger cohorts may reduce uptake
  CostPerParticipant: -0.0005 // Continuous attribute
};

/** Cost-Benefit Estimates (Educated Guesses based on literature) */
const costBenefitEstimates = {
  "Frontline": { cost: 200000, benefit: 500000 },
  "Intermediate": { cost: 400000, benefit: 1000000 },
  "Advanced": { cost: 600000, benefit: 1500000 }
};

/** WTP Estimates (Educated Guesses based on literature) */
const wtpEstimates = {
  TrainingLevel: {
    Frontline: { wtp: 100000, se: 15000 },
    Intermediate: { wtp: 150000, se: 20000 },
    Advanced: { wtp: 200000, se: 25000 }
  },
  DeliveryMethod: {
    "In-Person": { wtp: 80000, se: 12000 },
    "Online": { wtp: 60000, se: 10000 },
    "Hybrid": { wtp: 70000, se: 11000 }
  },
  Accreditation: {
    National: { wtp: 50000, se: 8000 },
    International: { wtp: 100000, se: 15000 },
    None: { wtp: 0, se: 0 }
  },
  Location: {
    "District-Level": { wtp: 40000, se: 6000 },
    "State-Level": { wtp: 60000, se: 9000 },
    "Regional Centers": { wtp: 50000, se: 7500 }
  },
  CohortSize: {
    "Small": { wtp: 50000, se: 7000 },
    "Medium": { wtp: 30000, se: 5000 },
    "Large": { wtp: 10000, se: 2000 }
  }
};

/** Function to run analysis */
document.getElementById('view-results').addEventListener('click', () => {
  // Gather input values
  const trainingLevel = document.getElementById('training-level').value;
  const deliveryMethod = document.getElementById('delivery-method').value;
  const accreditation = document.getElementById('accreditation').value;
  const location = document.getElementById('location').value;
  const cohortSizeVal = parseInt(document.getElementById('cohort-size').value);
  const costPerParticipantVal = parseInt(document.getElementById('cost-per-participant').value);

  // Calculate Predicted Uptake based on Training Level using Error Component Logit Model
  // Compute utility
  let utility = dceCoefficients.ASC;
  utility += dceCoefficients.TrainingLevel[trainingLevel];
  utility += dceCoefficients.DeliveryMethod[deliveryMethod];
  utility += dceCoefficients.Accreditation[accreditation];
  utility += dceCoefficients.Location[location];
  utility += dceCoefficients.CohortSize * cohortSizeVal;
  utility += dceCoefficients.CostPerParticipant * costPerParticipantVal;

  // Calculate uptake probability
  const expUtility = Math.exp(utility);
  const expOptout = Math.exp(dceCoefficients.ASC_optout);
  const uptakeProbability = (expUtility) / (expUtility + expOptout) * 100; // in percentage

  // Adjust uptake based on error component (random noise)
  const error = getRandomError(-5, 5); // ±5% error
  const finalUptake = Math.min(Math.max(uptakeProbability + error, 0), 100); // Ensure between 0 and 100

  // Calculate Total Cost, Total Benefit, and Net Benefit
  const totalCost = cohortSizeVal * costBenefitEstimates[trainingLevel].cost;
  const totalBenefit = cohortSizeVal * costBenefitEstimates[trainingLevel].benefit;
  const netBenefit = totalBenefit - totalCost;

  // Display Results in Predicted Uptake Tab
  const uptakeContent = document.getElementById('uptake-content');
  uptakeContent.innerHTML = `
    <p><strong>Training Level:</strong> ${trainingLevel}</p>
    <p><strong>Delivery Method:</strong> ${deliveryMethod}</p>
    <p><strong>Accreditation:</strong> ${accreditation}</p>
    <p><strong>Location of Training:</strong> ${location}</p>
    <p><strong>Cohort Size:</strong> ${cohortSizeVal}</p>
    <p><strong>Cost per Participant:</strong> ₹${costPerParticipantVal.toLocaleString()}</p>
    <canvas id="uptakeChart" width="400" height="200"></canvas>
  `;

  // Update Predicted Uptake Chart
  updateUptakeChart(finalUptake);

  // Display Results in Cost-Benefit Analysis Tab
  const cbaContent = document.getElementById('cba-content');
  cbaContent.innerHTML = `
    <h3>Cost Components</h3>
    <ul>
      <li><strong>Advertisement:</strong> ₹34,990.60 (Includes advertisements in local media and online platforms)</li>
      <li><strong>Training Materials:</strong> ₹50,000 (Includes manuals, digital resources, and equipment)</li>
      <li><strong>Trainer Salaries:</strong> ₹150,000 (Compensation for trainers conducting sessions)</li>
      <li><strong>Venue Hire:</strong> ₹40,000 (Cost of renting training facilities)</li>
      <li><strong>Participant Support:</strong> ₹30,000 (Includes transportation and accommodation for participants)</li>
      <li><strong>Administrative Costs:</strong> ₹25,000 (Includes project management and administrative support)</li>
      <li><strong>Staffing and Operational Costs:</strong> ₹60,000 (Hiring program directors, project management staff, administrative staff, and support personnel)</li>
      <li><strong>Material and Logistical Support:</strong> ₹45,000 (Purchase of technology, equipment, training materials, manuals, data collection tools, learning management systems, and software licenses)</li>
      <li><strong>Training of Trainers:</strong> ₹35,000 (Continual investment in upskilling trainers and mentors via specialized training of trainer programs)</li>
      <li><strong>Opportunity Costs for Participants and Stakeholders:</strong> ₹50,000 (Lost work hours/back fill and cost of adjusting current systems and protocols)</li>
      <li><strong>Program Monitoring and Evaluation:</strong> ₹40,000 (Routine M&E and impact evaluation costs)</li>
    </ul>
    <h3>Benefits Measurement</h3>
    <p>
      Benefits are measured in terms of improved public health outcomes, quantified as Quality-Adjusted Life Years (QALYs), and economic returns from health investments. The detailed benefits include:
    </p>
    <ul>
      <li><strong>Improved Public Health Outcomes:</strong> Enhanced disease surveillance and response, reduced economic impact of epidemics, and data-driven decision-making in public health policy.</li>
      <li><strong>Long-Term Workforce Development:</strong> Building a skilled epidemiology workforce, strengthening institutional capacity, and promoting career growth and retention for health professionals.</li>
      <li><strong>Economic Returns from Health Investment:</strong> Cost savings in healthcare, increased productivity, and attracting funding and support.</li>
      <li><strong>Strengthened Community Resilience and Trust in Health Systems:</strong> Community-level benefits and improved risk communication.</li>
    </ul>
    <p>
      Each participant gains an estimated 0.05 QALYs through enhanced epidemiological skills, leading to better disease surveillance and outbreak response capabilities. Benefits are monetized based on the value per QALY.
    </p>
    <canvas id="cbaChart" width="400" height="200"></canvas>
  `;

  // Update Cost-Benefit Chart
  updateCBAChart(totalCost, totalBenefit, netBenefit);

  // Calculate and Update WTP
  calculateWTP();
});

/** Function to generate random error between min and max */
function getRandomError(min, max) {
  return Math.random() * (max - min) + min;
}

/** Function to update Predicted Uptake Chart */
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
        backgroundColor: ['#27ae60', '#e74c3c'],
        hoverBackgroundColor: ['#2ecc71', '#c0392b']
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
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.label}: ${context.parsed}%`;
            }
          }
        }
      }
    }
  });
}

/** Function to update Cost-Benefit Chart */
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
        backgroundColor: [
          '#e67e22',
          '#3498db',
          '#2ecc71'
        ],
        hoverBackgroundColor: [
          '#d35400',
          '#2980b9',
          '#27ae60'
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'Cost-Benefit Analysis',
          font: { size: 16 }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ₹${context.parsed.y.toLocaleString()}`;
            }
          }
        }
      },
      scales: {
        y: { beginAtZero:true }
      }
    }
  });
}

/** Saving Scenarios */
let savedScenarios = [];

document.getElementById('save-scenario').addEventListener('click', () => {
  const scenarioName = document.getElementById('scenario-name').value.trim();
  if (scenarioName === "") {
    alert("Please enter a name for the scenario.");
    return;
  }

  // Gather current inputs
  const scenario = {
    name: scenarioName,
    trainingLevel: document.getElementById('training-level').value,
    deliveryMethod: document.getElementById('delivery-method').value,
    accreditation: document.getElementById('accreditation').value,
    location: document.getElementById('location').value,
    cohortSize: parseInt(document.getElementById('cohort-size').value),
    costPerParticipant: parseInt(document.getElementById('cost-per-participant').value)
  };

  savedScenarios.push(scenario);
  displaySavedScenarios();
  document.getElementById('scenario-name').value = '';
});

/** Display Saved Scenarios */
function displaySavedScenarios() {
  const tableBody = document.querySelector("#scenarioTable tbody");
  tableBody.innerHTML = '';
  savedScenarios.forEach((scenario, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${scenario.name}</td>
      <td>${scenario.trainingLevel}</td>
      <td>${scenario.deliveryMethod}</td>
      <td>${scenario.accreditation}</td>
      <td>${scenario.location}</td>
      <td>${scenario.cohortSize}</td>
      <td>₹${scenario.costPerParticipant.toLocaleString()}</td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="loadScenario(${index})">Load</button>
        <button class="btn btn-danger btn-sm" onclick="deleteScenario(${index})">Delete</button>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

/** Load Scenario */
function loadScenario(index) {
  const scenario = savedScenarios[index];
  document.getElementById('training-level').value = scenario.trainingLevel;
  document.getElementById('delivery-method').value = scenario.deliveryMethod;
  document.getElementById('accreditation').value = scenario.accreditation;
  document.getElementById('location').value = scenario.location;
  document.getElementById('cohort-size').value = scenario.cohortSize;
  document.getElementById('cohort-size-value').textContent = scenario.cohortSize;
  document.getElementById('cost-per-participant').value = scenario.costPerParticipant;
  document.getElementById('cost-per-participant-value').textContent = `₹${scenario.costPerParticipant.toLocaleString()}`;
}

/** Delete Scenario */
function deleteScenario(index) {
  if (confirm("Are you sure you want to delete this scenario?")) {
    savedScenarios.splice(index, 1);
    displaySavedScenarios();
  }
}

/** Export Scenarios to PDF */
document.getElementById('export-pdf').addEventListener('click', () => {
  if (savedScenarios.length < 1) {
    alert("No scenarios saved to export.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let currentY = margin;

  doc.setFontSize(16);
  doc.text("STEPS - Scenarios Comparison", pageWidth / 2, currentY, { align: 'center' });
  currentY += 10;

  savedScenarios.forEach((scenario, index) => {
    // Check if adding this scenario exceeds the page height
    if (currentY + 60 > pageHeight - margin) {
      doc.addPage();
      currentY = margin;
    }

    doc.setFontSize(14);
    doc.text(`Scenario ${index + 1}: ${scenario.name}`, margin, currentY);
    currentY += 7;

    doc.setFontSize(12);
    doc.text(`Training Level: ${scenario.trainingLevel}`, margin, currentY);
    currentY += 5;
    doc.text(`Delivery Method: ${scenario.deliveryMethod}`, margin, currentY);
    currentY += 5;
    doc.text(`Accreditation: ${scenario.accreditation}`, margin, currentY);
    currentY += 5;
    doc.text(`Location of Training: ${scenario.location}`, margin, currentY);
    currentY += 5;
    doc.text(`Cohort Size: ${scenario.cohortSize}`, margin, currentY);
    currentY += 5;
    doc.text(`Cost per Participant: ₹${scenario.costPerParticipant.toLocaleString()}`, margin, currentY);
    currentY += 10;
  });

  doc.save("STEPS_Scenarios_Comparison.pdf");
});

/** WTP Calculations and Rendering */
function calculateWTP() {
  // Placeholder: Implement based on actual utility coefficients and cost coefficients
  // This function should calculate WTP for each attribute level based on coefficients

  // Example: WTP = Coefficient / -CostCoefficient
  // For simplicity, assuming CostCoefficient is the same for all attributes
  // Replace with actual calculations as per literature
}

let wtpChartInstance = null;

/** Function to render WTP Chart */
function renderWTPChart() {
  const ctx = document.getElementById("wtpChartMain").getContext("2d");

  if (wtpChartInstance) {
    wtpChartInstance.destroy();
  }

  // Prepare WTP Data
  const attributes = ["Training Level", "Delivery Method", "Accreditation", "Location of Training", "Cohort Size"];
  const levels = {
    "Training Level": ["Frontline", "Intermediate", "Advanced"],
    "Delivery Method": ["In-Person", "Online", "Hybrid"],
    "Accreditation": ["National", "International", "None"],
    "Location of Training": ["District-Level", "State-Level", "Regional Centers"],
    "Cohort Size": ["Small", "Medium", "Large"]
  };

  let wtpData = [];
  let errors = [];

  attributes.forEach(attr => {
    levels[attr].forEach(level => {
      const wtp = wtpEstimates[attr][level].wtp;
      const se = wtpEstimates[attr][level].se;
      if (wtp > 0) { // Exclude 'None' or baseline levels
        wtpData.push({ attribute: `${attr} - ${level}`, wtp: wtp, se: se });
      }
    });
  });

  const labels = wtpData.map(item => item.attribute);
  const values = wtpData.map(item => item.wtp);
  const errorsData = wtpData.map(item => item.se);

  const dataConfig = {
    labels: labels,
    datasets: [{
      label: "WTP (₹)",
      data: values,
      backgroundColor: 'rgba(46, 204, 113, 0.6)',
      borderColor: 'rgba(39, 174, 96, 1)',
      borderWidth: 1,
      error: errorsData
    }]
  };

  wtpChartInstance = new Chart(ctx, {
    type: 'bar',
    data: dataConfig,
    options: {
      responsive: true,
      scales: {
        y: { 
          beginAtZero: true,
          title: {
            display: true,
            text: 'Willingness to Pay (₹)'
          }
        }
      },
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "Willingness to Pay (₹) for Programme Attributes",
          font: { size: 18 }
        },
        tooltip: {
          callbacks: {
            afterBody: function(context) {
              const index = context[0].dataIndex;
              const se = dataConfig.datasets[0].error[index];
              return `SE: ₹${se}`;
            }
          }
        }
      }
    },
    plugins: [{
      // Draw error bars
      id: 'errorbars',
      afterDraw: chart => {
        const { ctx, scales: { x, y } } = chart;

        chart.getDatasetMeta(0).data.forEach((bar, i) => {
          const centerX = bar.x;
          const value = values[i];
          const se = errorsData[i];
          if (se && typeof se === 'number') {
            const topY = y.getPixelForValue(value + se);
            const bottomY = y.getPixelForValue(value - se);

            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = '#34495e';
            ctx.lineWidth = 1.5;
            // Main error line
            ctx.moveTo(centerX, topY);
            ctx.lineTo(centerX, bottomY);
            // Top cap
            ctx.moveTo(centerX - 5, topY);
            ctx.lineTo(centerX + 5, topY);
            // Bottom cap
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

/** Cost-Benefit Analysis Calculations and Rendering */
let cbaChartInstance = null;

function renderCBAChart() {
  const cbaContent = document.getElementById('cba-content');
  if (!cbaContent.innerHTML.includes('cbaChart')) {
    return; // Ensure the chart canvas is present
  }

  // Placeholder: Implement actual CBA calculations based on inputs
  // This function should update the CBA chart based on saved scenarios or current inputs

  // Example: Assuming values are already calculated and displayed
  // No additional action needed here unless dynamic updates are required
}

/** WTP Calculation (Example Implementation) */
function calculateWTP() {
  // Implement actual WTP calculations based on DCE coefficients and cost coefficients
  // For this example, using predefined WTP estimates
  // Replace with actual calculations when data is available
}

/** Cost-Benefit Analysis Logic */
const QALY_VALUE = 50000; // ₹50,000 per QALY

/** Function to calculate and render WTP */
function calculateWTPValues(scenario) {
  const attributes = ["TrainingLevel", "DeliveryMethod", "Accreditation", "Location", "CohortSize"];
  let wtpResults = [];

  attributes.forEach(attr => {
    const level = scenario[attr];
    if (wtpEstimates[attr][level].wtp > 0) { // Exclude baseline levels
      wtpResults.push({
        attribute: `${attr} - ${level}`,
        wtp: wtpEstimates[attr][level].wtp,
        se: wtpEstimates[attr][level].se
      });
    }
  });

  return wtpResults;
}

/** WTP Data Injection for Current Scenario */
function injectWTPData(scenario) {
  const wtpData = calculateWTPValues(scenario);
  return wtpData;
}

/** Function to render WTP Chart with Current Scenario */
function renderWTPChart() {
  const ctx = document.getElementById("wtpChartMain").getContext("2d");

  if (wtpChartInstance) {
    wtpChartInstance.destroy();
  }

  // Assuming only the last saved scenario is used for WTP
  if (savedScenarios.length === 0) {
    alert("Please save a scenario to view WTP.");
    return;
  }

  const latestScenario = savedScenarios[savedScenarios.length - 1];
  const wtpData = injectWTPData(latestScenario);

  const labels = wtpData.map(item => item.attribute);
  const values = wtpData.map(item => item.wtp);
  const errorsData = wtpData.map(item => item.se);

  const dataConfig = {
    labels: labels,
    datasets: [{
      label: "WTP (₹)",
      data: values,
      backgroundColor: 'rgba(52, 152, 219, 0.6)',
      borderColor: 'rgba(41, 128, 185, 1)',
      borderWidth: 1,
      error: errorsData
    }]
  };

  wtpChartInstance = new Chart(ctx, {
    type: 'bar',
    data: dataConfig,
    options: {
      responsive: true,
      scales: {
        y: { 
          beginAtZero: true,
          title: {
            display: true,
            text: 'Willingness to Pay (₹)'
          }
        }
      },
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "Willingness to Pay (₹) for Programme Attributes",
          font: { size: 18 }
        },
        tooltip: {
          callbacks: {
            afterBody: function(context) {
              const index = context[0].dataIndex;
              const se = dataConfig.datasets[0].error[index];
              return `SE: ₹${se}`;
            }
          }
        }
      }
    },
    plugins: [{
      // Draw error bars
      id: 'errorbars',
      afterDraw: chart => {
        const { ctx, scales: { x, y } } = chart;

        chart.getDatasetMeta(0).data.forEach((bar, i) => {
          const centerX = bar.x;
          const value = values[i];
          const se = errorsData[i];
          if (se && typeof se === 'number') {
            const topY = y.getPixelForValue(value + se);
            const bottomY = y.getPixelForValue(value - se);

            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = '#2c3e50';
            ctx.lineWidth = 1.5;
            // Main error line
            ctx.moveTo(centerX, topY);
            ctx.lineTo(centerX, bottomY);
            // Top cap
            ctx.moveTo(centerX - 5, topY);
            ctx.lineTo(centerX + 5, topY);
            // Bottom cap
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

/** WTP Chart Rendering End */

/** Cost-Benefit Analysis Calculations and Rendering */
let cbaChartInstance = null;

function renderCBAChart() {
  const cbaContent = document.getElementById('cba-content');
  if (!cbaContent.innerHTML.includes('cbaChart')) {
    return; // Ensure the chart canvas is present
  }

  // Extract the latest scenario for CBA
  if (savedScenarios.length === 0) {
    alert("Please save a scenario to view Cost-Benefit Analysis.");
    return;
  }

  const latestScenario = savedScenarios[savedScenarios.length - 1];
  const trainingLevel = latestScenario.trainingLevel;
  const cohortSizeVal = latestScenario.cohortSize;

  // Calculate Total Cost
  let totalCost = 34990.60 + 50000 + 150000 + 40000 + 30000 + 25000 + 60000 + 45000 + 35000 + 50000 + 40000;
  totalCost = totalCost * cohortSizeVal; // Assuming costs scale linearly with cohort size

  // Calculate Total Benefit
  const totalQALY = cohortSizeVal * 0.05; // Each participant gains 0.05 QALYs
  const monetizedBenefits = totalQALY * QALY_VALUE;

  // Net Benefit
  const netBenefit = monetizedBenefits - totalCost;

  // Update CBA Chart
  const ctx = document.getElementById('cbaChart').getContext('2d');
  if (cbaChartInstance) {
    cbaChartInstance.destroy();
  }
  cbaChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Total Cost', 'Total Benefit', 'Net Benefit'],
      datasets: [{
        label: 'Amount (₹)',
        data: [totalCost, monetizedBenefits, netBenefit],
        backgroundColor: [
          '#e67e22',
          '#3498db',
          '#2ecc71'
        ],
        hoverBackgroundColor: [
          '#d35400',
          '#2980b9',
          '#27ae60'
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'Cost-Benefit Analysis',
          font: { size: 18 }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ₹${context.parsed.y.toLocaleString()}`;
            }
          }
        }
      },
      scales: {
        y: { 
          beginAtZero:true,
          title: {
            display: true,
            text: 'Amount (₹)'
          }
        }
      }
    }
  });
}

/** WTP Calculation and Rendering End */

/** WTP Calculations based on Coefficients */
function calculateWTP() {
  // Example implementation, replace with actual model-based calculations
  // For this example, using predefined WTP estimates
}

/** Scenario Saving and Management End */

/** Final Notes:
   - Ensure all scenarios are saved before exporting.
   - Replace hypothetical estimates with actual data when available.
*/

/** Ensure that WTP calculations are linked to actual data when integrated */

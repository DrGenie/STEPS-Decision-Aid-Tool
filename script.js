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
  for (let i = 0; i < allTabs.length; i++) {
    allTabs[i].style.display = "none";
  }
  const allBtns = document.getElementsByClassName("tablink");
  for (let j = 0; j < allBtns.length; j++) {
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

/** Hypothetical DCE Coefficients based on literature review */
const coefficients = {
  ASC: 0.5, // Alternative Specific Constant
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
  CostPerParticipant: -0.0005, // Continuous attribute
  ASC_optout: 0.2 // Alternative Specific Constant for opt-out
};

/** Cost-Benefit Estimates (Educated Guesses based on literature) */
const costBenefitEstimates = {
  "Frontline": { cost: 200000, benefit: 500000 },
  "Intermediate": { cost: 400000, benefit: 1000000 },
  "Advanced": { cost: 600000, benefit: 1500000 }
};

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
        backgroundColor: ['#28a745', '#dc3545'],
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
              let label = context.label || '';
              if (label) {
                label += ': ';
              }
              label += `${context.parsed.toFixed(2)}%`;
              return label;
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
          '#ffc107',
          '#17a2b8',
          '#28a745'
        ],
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
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              label += `₹${context.parsed.toLocaleString()}`;
              return label;
            }
          }
        }
      }
    }
  });
}

/** Function to calculate WTP and prepare data */
let wtpData = [];

function calculateWTP(scenario) {
  // Dummy coding: Set the first level of each attribute as the benchmark (0)
  // Other levels will have coefficients relative to the benchmark

  // Define benchmarks
  const benchmarks = {
    TrainingLevel: "Frontline",
    DeliveryMethod: "In-Person",
    Accreditation: "National",
    Location: "District-Level",
    CohortSize: 500 // Assuming 'Small' as benchmark
  };

  // Extract coefficients
  const attrCoefficients = {
    TrainingLevel: coefficients.TrainingLevel[scenario.trainingLevel] - coefficients.TrainingLevel[benchmarks.TrainingLevel],
    DeliveryMethod: coefficients.DeliveryMethod[scenario.deliveryMethod] - coefficients.DeliveryMethod[benchmarks.DeliveryMethod],
    Accreditation: coefficients.Accreditation[scenario.accreditation] - coefficients.Accreditation[benchmarks.Accreditation],
    Location: coefficients.Location[scenario.location] - coefficients.Location[benchmarks.Location],
    CohortSize: coefficients.CohortSize * (scenario.cohortSize - benchmarks.CohortSize)
  };

  // Calculate WTP for each attribute
  const wtpResults = [];
  for (let attr in attrCoefficients) {
    const coef = attrCoefficients[attr];
    const wtp = coef / (-coefficients.CostPerParticipant);
    wtpResults.push({
      attribute: attr,
      wtp: wtp * 100000, // Scale to ₹100,000 for better visualization
      se: (Math.abs(wtp) * 100000) * 0.1 // 10% SE
    });
  }

  // Store WTP data
  wtpData = wtpResults;
}

/** WTP Chart with Error Bars */
let wtpChartInstance = null;
function renderWTPChart() {
  const ctx = document.getElementById("wtpChartMain").getContext("2d");

  if (wtpChartInstance) {
    wtpChartInstance.destroy();
  }

  const labels = wtpData.map(item => item.attribute);
  const values = wtpData.map(item => item.wtp);
  const errors = wtpData.map(item => item.se); // standard errors

  const dataConfig = {
    labels: labels,
    datasets: [{
      label: "WTP (₹)",
      data: values,
      backgroundColor: values.map(v => v >= 0 ? 'rgba(39,174,96,0.6)' : 'rgba(231,76,60,0.6)'),
      borderColor: values.map(v => v >= 0 ? 'rgba(39,174,96,1)' : 'rgba(231,76,60,1)'),
      borderWidth: 1,
      // Custom property to hold error values
      error: errors
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
          font: { size: 16 }
        },
        tooltip: {
          callbacks: {
            afterBody: function(context) {
              const index = context[0].dataIndex;
              const se = dataConfig.datasets[0].error[index];
              return `SE: ₹${se.toFixed(2)}`;
            }
          }
        }
      }
    },
    plugins: [{
      // Draw vertical error bars
      id: 'errorbars',
      afterDraw: chart => {
        const {
          ctx,
          scales: { x, y }
        } = chart;

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
            // main line
            ctx.moveTo(centerX, topY);
            ctx.lineTo(centerX, bottomY);
            // top cap
            ctx.moveTo(centerX - 5, topY);
            ctx.lineTo(centerX + 5, topY);
            // bottom cap
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

/** Cost-Benefit Analysis Functionality */
/** Function to update Cost-Benefit Chart */
function renderCBAChart() {
  // The CBA chart is already updated during the analysis
}

/** Saving Scenarios */
document.getElementById('save-scenario').addEventListener('click', () => {
  const scenarioName = document.getElementById('scenario-name').value.trim();
  if (scenarioName === "") {
    alert("Please enter a name for the scenario.");
    return;
  }

  // Check for duplicate scenario names
  const existingNames = savedScenarios.map(s => s.name.toLowerCase());
  if (existingNames.includes(scenarioName.toLowerCase())) {
    alert("A scenario with this name already exists. Please choose a different name.");
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
let savedScenarios = [];

function displaySavedScenarios() {
  const list = document.getElementById('saved-scenarios-list');
  list.innerHTML = '';
  savedScenarios.forEach((scenario, index) => {
    const listItem = document.createElement('li');
    listItem.className = 'list-group-item';
    listItem.innerHTML = `<strong>${scenario.name}</strong> 
        <button class="btn btn-sm btn-primary" onclick="loadScenario(${index})">Load</button>
        <button class="btn btn-sm btn-danger" onclick="deleteScenario(${index})">Delete</button>`;
    list.appendChild(listItem);
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
    if (currentY + 80 > pageHeight - margin) {
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

/** Willingness to Pay Calculations and Rendering */

/** Function to handle WTP calculations and rendering */
function calculateWTPAndRender(scenario) {
  calculateWTP(scenario);
  renderWTPChart();
}

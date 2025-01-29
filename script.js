/****************************************************************************
 * SCRIPT.JS
 * 1) Tab switching
 * 2) Range slider label updates
 * 3) Hypothetical DCE coefficients based on literature review
 * 4) Predicted Uptake and CBA Charts using Error Component Logit Model
 * 5) Scenario saving & PDF export
 * 6) Realistic cost & QALY-based benefit logic
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

/** Hypothetical DCE Estimates (Educated Guesses based on literature) */
const dceEstimates = {
  "Frontline": { uptake: 70 },
  "Intermediate": { uptake: 50 },
  "Advanced": { uptake: 30 }
};

/** Cost-Benefit Estimates (Educated Guesses based on literature) */
const costBenefitEstimates = {
  "Frontline": { cost: 200000, benefit: 500000 },
  "Intermediate": { cost: 400000, benefit: 1000000 },
  "Advanced": { cost: 600000, benefit: 1500000 }
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
  // Hypothetical coefficients based on literature review
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
    CostPerParticipant: -0.0005 // Continuous attribute
  };

  // Compute utility
  let utility = coefficients.ASC;
  utility += coefficients.TrainingLevel[trainingLevel];
  utility += coefficients.DeliveryMethod[deliveryMethod];
  utility += coefficients.Accreditation[accreditation];
  utility += coefficients.Location[location];
  utility += coefficients.CohortSize * cohortSizeVal;
  utility += coefficients.CostPerParticipant * costPerParticipantVal;

  // Assuming ASC for opt-out is a fixed constant
  const ASC_optout = 0.2;

  // Calculate uptake probability
  const expUtility = Math.exp(utility);
  const expOptout = Math.exp(ASC_optout);
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
    </ul>
    <h3>Benefits Measurement</h3>
    <p>
      Benefits are measured in terms of improved public health outcomes, quantified as Quality-Adjusted Life Years (QALYs). Each participant gains an estimated 0.05 QALYs through enhanced epidemiological skills, leading to better disease surveillance and outbreak response.
    </p>
    <canvas id="cbaChart" width="400" height="200"></canvas>
  `;

  // Update Cost-Benefit Chart
  updateCBAChart(totalCost, totalBenefit, netBenefit);
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
        }
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

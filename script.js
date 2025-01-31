/****************************************************************************
 * SCRIPT.JS
 * 1) Tab switching
 * 2) Range slider label updates
 * 3) Realistic DCE coefficients
 * 4) Predict Program Uptake & cost-benefit
 * 5) WTP calculations for each attribute level
 * 6) Scenario saving & PDF export
 * 
 * Author: Mesfin Genie, Newcastle Business School, University of Newcastle
 ****************************************************************************/

/** TAB SWITCHING: always functional. */
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

/** Range slider updates: Cohort Size */
const cohortSlider = document.getElementById("cohort-size");
const cohortValue = document.getElementById("cohort-size-value");
cohortValue.textContent = cohortSlider.value;
cohortSlider.addEventListener("input", () => {
  cohortValue.textContent = cohortSlider.value;
});

/** Range slider updates: Cost per Participant */
const costSlider = document.getElementById("cost-per-participant");
const costValue = document.getElementById("cost-per-participant-value");
costValue.textContent = `₹${parseInt(costSlider.value).toLocaleString()}`;
costSlider.addEventListener("input", () => {
  costValue.textContent = `₹${parseInt(costSlider.value).toLocaleString()}`;
});

/** DCE Coefficients: realistic with plausible uptake. */
const coefficients = {
  ASC: 1.0, // base alternative constant
  TrainingLevel: {
    Frontline: 0.6,
    Intermediate: 0.3,
    Advanced: 0.0
  },
  DeliveryMethod: {
    "In-Person": 0.7,
    "Online": 0.2,
    "Hybrid": 0.5
  },
  Accreditation: {
    National: 0.4,
    International: 0.8,
    None: 0.0
  },
  Location: {
    "District-Level": 0.3,
    "State-Level": 0.6,
    "Regional Centers": 0.4
  },
  CohortSize: -0.003, 
  CostPerParticipant: -0.0005,
  ASC_optout: 0.2
};

/** Cost-Benefit references. */
const costBenefitEstimates = {
  Frontline: { cost: 200000, benefit: 600000 },
  Intermediate: { cost: 450000, benefit: 1200000 },
  Advanced: { cost: 700000, benefit: 1900000 }
};

/** WTP data array */
let wtpData = [];

/** Variables to store scenario results */
let currentUptake = 0;
let currentTotalCost = 0;
let currentTotalBenefit = 0;
let currentNetBenefit = 0;

/** Chart instances */
let uptakeChart;
let cbaChart;
let wtpChart;

/** Generate random error for slight unpredictability. */
function getRandomError(min, max) {
  return Math.random() * (max - min) + min;
}

/** 1) Draw Predicted Program Uptake Chart */
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
        title: {
          display: true,
          text: `Predicted Program Uptake: ${uptakeVal.toFixed(1)}%`,
          font: { size: 16 }
        }
      }
    }
  });
}

/** 2) Draw Cost-Benefit Chart */
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

/** 3) Calculate WTP: Each attribute level vs. reference. */
function calculateWTP(scenario) {
  const benchmarks = {
    TrainingLevel: "Advanced",   // setting advanced as reference
    DeliveryMethod: "Online",    // reference
    Accreditation: "None",       // reference
    Location: "District-Level",  // reference
    CohortSize: 500             // reference for continuous
  };

  const attributeDiff = {
    TrainingLevel: coefficients.TrainingLevel[scenario.trainingLevel] 
                   - coefficients.TrainingLevel[benchmarks.TrainingLevel],
    DeliveryMethod: coefficients.DeliveryMethod[scenario.deliveryMethod] 
                   - coefficients.DeliveryMethod[benchmarks.DeliveryMethod],
    Accreditation: coefficients.Accreditation[scenario.accreditation] 
                   - coefficients.Accreditation[benchmarks.Accreditation],
    Location: coefficients.Location[scenario.location] 
                   - coefficients.Location[benchmarks.Location],
    CohortSize: coefficients.CohortSize * (scenario.cohortSize - benchmarks.CohortSize)
  };

  let localWtp = [];
  for (let attr in attributeDiff) {
    const coef = attributeDiff[attr];
    const wtpVal = coef / -coefficients.CostPerParticipant; 
    localWtp.push({
      attribute: attr,
      wtp: wtpVal * 100000,
      se: Math.abs(wtpVal * 100000) * 0.1 
    });
  }
  wtpData = localWtp;
}

/** Draw WTP Chart */
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
          text: "Willingness to Pay (₹) - Attribute Levels vs. Reference",
          font: { size: 16 }
        }
      }
    },
    plugins: [{
      id: "errorbars",
      afterDraw: chart => {
        const { ctx, scales: { x, y } } = chart;
        const dataset = chart.getDatasetMeta(0).data;
        dataset.forEach((bar, i) => {
          const xCenter = bar.x;
          const val = values[i];
          const se = errors[i];
          if (se && typeof se === "number") {
            const top = y.getPixelForValue(val + se);
            const bottom = y.getPixelForValue(val - se);
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = "black";
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

/** Predict Program Uptake Button */
document.getElementById("view-results").addEventListener("click", () => {
  const trainingLevel = document.querySelector('input[name="training-level"]:checked').value;
  const deliveryMethod = document.querySelector('input[name="delivery-method"]:checked').value;
  const accreditation = document.querySelector('input[name="accreditation"]:checked').value;
  const location = document.querySelector('input[name="location"]:checked').value;
  const cSize = parseInt(document.getElementById("cohort-size").value);
  const cCost = parseInt(document.getElementById("cost-per-participant").value);

  // Utility
  let utility = coefficients.ASC;
  utility += coefficients.TrainingLevel[trainingLevel];
  utility += coefficients.DeliveryMethod[deliveryMethod];
  utility += coefficients.Accreditation[accreditation];
  utility += coefficients.Location[location];
  utility += coefficients.CohortSize * cSize;
  utility += coefficients.CostPerParticipant * cCost;

  const expU = Math.exp(utility);
  const expOptOut = Math.exp(coefficients.ASC_optout);
  let uptakeProbability = (expU / (expU + expOptOut)) * 100;

  // Random noise
  const noise = getRandomError(-3, 3);
  let finalUptake = uptakeProbability + noise;
  finalUptake = Math.min(Math.max(finalUptake, 0), 100);

  // Cost-Benefit
  const totalCost = cSize * costBenefitEstimates[trainingLevel].cost;
  const totalBenefit = cSize * costBenefitEstimates[trainingLevel].benefit;
  const netBenefit = totalBenefit - totalCost;

  currentUptake = finalUptake;
  currentTotalCost = totalCost;
  currentTotalBenefit = totalBenefit;
  currentNetBenefit = netBenefit;

  // Update Predicted Program Uptake
  const uptakeDiv = document.getElementById("uptake-content");
  uptakeDiv.innerHTML = `
    <p><strong>Training Level:</strong> ${trainingLevel}</p>
    <p><strong>Delivery Method:</strong> ${deliveryMethod}</p>
    <p><strong>Accreditation:</strong> ${accreditation}</p>
    <p><strong>Location of Training:</strong> ${location}</p>
    <p><strong>Cohort Size:</strong> ${cSize}</p>
    <p><strong>Cost per Participant:</strong> ₹${cCost.toLocaleString()}</p>
    <p><strong>Predicted Program Uptake:</strong> ${finalUptake.toFixed(1)}%</p>
    <div class="chart-box">
      <canvas id="uptakeChart"></canvas>
    </div>
  `;
  drawUptakeChart(finalUptake);

  // Update Costs & Benefits
  const cbaDiv = document.getElementById("cba-content");
  cbaDiv.innerHTML = `
    <p>The table below summarizes your total costs, total benefits, and net benefit 
    based on the chosen scenario.</p>
    <div class="chart-box">
      <canvas id="cbaChart"></canvas>
    </div>
    <div class="summary-table">
      <table style="width:100%; margin-top:20px; border-collapse:collapse;">
        <tr style="background:#f8f9fa">
          <th style="text-align:left; padding:8px;">Item</th>
          <th style="text-align:right; padding:8px;">Value (₹)</th>
        </tr>
        <tr>
          <td style="padding:8px;">Total Cost</td>
          <td style="padding:8px; text-align:right;">${totalCost.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding:8px;">Total Benefit</td>
          <td style="padding:8px; text-align:right;">${totalBenefit.toLocaleString()}</td>
        </tr>
        <tr style="font-weight:bold;">
          <td style="padding:8px;">Net Benefit</td>
          <td style="padding:8px; text-align:right;">${netBenefit.toLocaleString()}</td>
        </tr>
      </table>
    </div>
  `;
  drawCBAChart(totalCost, totalBenefit, netBenefit);

  // WTP
  calculateWTP({
    trainingLevel,
    deliveryMethod,
    accreditation,
    location,
    cohortSize: cSize,
    costPerParticipant: cCost
  });
  drawWTPChart();
});

/** Scenario Saving & Management */
let savedScenarios = [];
document.getElementById("save-scenario").addEventListener("click", () => {
  const scenarioName = document.getElementById("scenario-name").value.trim();
  if (!scenarioName) {
    alert("Please enter a name for this scenario.");
    return;
  }

  if (savedScenarios.some(sc => sc.name.toLowerCase() === scenarioName.toLowerCase())) {
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
  savedScenarios.forEach((sc, idx) => {
    const li = document.createElement("li");
    li.className = "list-group-item";
    li.innerHTML = `
      <strong>${sc.name}</strong>
      <div>
        <button class="btn btn-sm btn-primary" onclick="loadScenario(${idx})">Load</button>
        <button class="btn btn-sm btn-danger" onclick="deleteScenario(${idx})">Delete</button>
      </div>
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
  if (confirm("Do you want to remove this scenario?")) {
    savedScenarios.splice(index, 1);
    displaySavedScenarios();
  }
}

/** Export scenarios to PDF */
document.getElementById("export-pdf").addEventListener("click", () => {
  if (!savedScenarios.length) {
    alert("No scenarios to export!");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 15;

  doc.setFontSize(16);
  doc.text("STEPS - Scenarios Comparison", pageWidth / 2, currentY, { align: "center" });
  currentY += 10;

  savedScenarios.forEach((sc, idx) => {
    if (currentY + 60 > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      currentY = 15;
    }

    doc.setFontSize(14);
    doc.text(`Scenario ${idx + 1}: ${sc.name}`, 15, currentY);
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

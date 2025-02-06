/****************************************************************************
 * SCRIPT.JS
 * 6 attributes: 4 discrete (Training Level, Delivery Method, Accreditation,
 * Location) + 2 continuous (Cohort Size, Cost per Participant).
 * Non-reference discrete levels are WTP-plotted. The predicted uptake and
 * cost–benefit logic remain placeholders for demonstration.
 ****************************************************************************/

/** Default tab on load */
window.onload = function() {
  openTab('introTab', document.querySelector('.tablink'));
};

/** Switch tabs */
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

/** Range sliders */
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

/** Coefficient dictionary for 4 discrete attributes + 2 continuous */
const coefficients = {
  ASC: 1.0,

  // Discrete attributes and baseline references:
  // 1) Training Level (Advanced baseline)
  TrainingLevel: {
    Frontline: 0.8,
    Intermediate: 0.5,
    Advanced: 0.0
  },
  // 2) Delivery Method (Online baseline)
  DeliveryMethod: {
    "In-Person": 0.7,
    "Online": 0.0,
    "Hybrid": 0.5
  },
  // 3) Accreditation (None baseline)
  Accreditation: {
    National: 0.6,
    International: 1.0,
    None: 0.0
  },
  // 4) Location (District-Level baseline)
  Location: {
    "State-Level": 0.5,
    "Regional Centers": 0.3,
    "District-Level": 0.0
  },

  // 2 continuous attributes
  CohortSize: -0.002,
  CostPerParticipant: -0.0004,

  // Opt-out
  ASC_optout: 0.3
};

/** Basic cost/benefit placeholders by training level */
const costBenefitEstimates = {
  Frontline: { cost: 250000, benefit: 750000 },
  Intermediate: { cost: 450000, benefit: 1300000 },
  Advanced: { cost: 650000, benefit: 2000000 }
};

/** Global variables for chart and scenario logic */
let uptakeChart, cbaChart, wtpChart;
let currentUptake = 0, currentTotalCost = 0, currentTotalBenefit = 0, currentNetBenefit = 0;
const baseCohortSize = 250; // reference for participants in cost–benefit

/** Gather discrete WTP differences from baseline */
const wtpAll = {
  // TrainingLevel__Frontline => difference from Advanced
  "TrainingLevel__Frontline": 0.8,
  "TrainingLevel__Intermediate": 0.5,
  // DeliveryMethod__In-Person => difference from Online
  "DeliveryMethod__In-Person": 0.7,
  "DeliveryMethod__Hybrid": 0.5,
  // Accreditation__National => difference from None
  "Accreditation__National": 0.6,
  "Accreditation__International": 1.0,
  // Location__State-Level => difference from District-Level
  "Location__State-Level": 0.5,
  "Location__Regional Centers": 0.3
};

/** Build scenario from input tab */
function buildScenarioFromInputs() {
  const trainingLevel = document.querySelector('input[name="training-level"]:checked').value;
  const deliveryMethod = document.querySelector('input[name="delivery-method"]:checked').value;
  const accreditation = document.querySelector('input[name="accreditation"]:checked').value;
  const location = document.querySelector('input[name="location"]:checked').value;
  const cohortSize = parseInt(document.getElementById("cohort-size").value);
  const cost_per_participant = parseInt(document.getElementById("cost-per-participant").value);
  return { trainingLevel, deliveryMethod, accreditation, location, cohortSize, cost_per_participant };
}

/** Logit model for scenario utility */
function computeUptakeFraction(sc) {
  let U = coefficients.ASC
    + coefficients.TrainingLevel[sc.trainingLevel]
    + coefficients.DeliveryMethod[sc.deliveryMethod]
    + coefficients.Accreditation[sc.accreditation]
    + coefficients.Location[sc.location]
    + coefficients.CohortSize * sc.cohortSize
    + coefficients.CostPerParticipant * sc.cost_per_participant;
  const altExp = Math.exp(U);
  const optExp = Math.exp(coefficients.ASC_optout);
  return altExp / (altExp + optExp);
}

/** Show results in modal */
function showResultsModal(html) {
  const modal = document.getElementById("resultsModal");
  document.getElementById("modal-results").innerHTML = html;
  modal.style.display = "block";
}
function closeModal() {
  document.getElementById("resultsModal").style.display = "none";
}

/** Calculate & View Results click */
document.getElementById("view-results").addEventListener("click", () => {
  const sc = buildScenarioFromInputs();
  if (!sc) return;
  let fraction = computeUptakeFraction(sc);
  let predictedUptake = fraction*100 + (Math.random()*6 - 3);
  predictedUptake = Math.max(0, Math.min(100, predictedUptake));
  currentUptake = predictedUptake;

  let recommendation = "";
  if (predictedUptake < 30) {
    recommendation = "Uptake is low. Consider lowering cost or exploring reference adjustments.";
  } else if (predictedUptake < 70) {
    recommendation = "Uptake is moderate. Potential to optimize further.";
  } else {
    recommendation = "Uptake is high. This configuration appears effective.";
  }
  const modalHTML = `
    <p><strong>Predicted Program Uptake:</strong> ${predictedUptake.toFixed(1)}%</p>
    <p>${recommendation}</p>
  `;
  showResultsModal(modalHTML);

  drawUptakeChart(predictedUptake);

  // Basic cost & benefit from training level
  const baseCB = costBenefitEstimates[sc.trainingLevel] || costBenefitEstimates.Advanced;
  const totalCost = sc.cohortSize * baseCB.cost;
  const totalBenefit = sc.cohortSize * baseCB.benefit;
  const netBenefit = totalBenefit - totalCost;
  currentTotalCost = totalCost;
  currentTotalBenefit = totalBenefit;
  currentNetBenefit = netBenefit;

  renderCostsBenefits();
});

/** Draw uptake donut chart */
function drawUptakeChart(val) {
  const ctx = document.getElementById("uptakeChart").getContext("2d");
  if (uptakeChart) uptakeChart.destroy();
  uptakeChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Uptake", "Remaining"],
      datasets: [{
        data: [val, 100-val],
        backgroundColor: ["#2ecc71", "#e74c3c"]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: `Predicted Uptake: ${val.toFixed(1)}%`, font: { size: 16 } }
      }
    }
  });
}

/** Costs & Benefits logic */
function renderCostsBenefits() {
  const cbaDiv = document.getElementById("cba-summary");
  if (!cbaDiv) return;
  const sc = buildScenarioFromInputs();

  let fraction = computeUptakeFraction(sc);
  let predictedUptake = fraction*100;
  const participants = (predictedUptake/100)*baseCohortSize;

  const baseCB = costBenefitEstimates[sc.trainingLevel] || costBenefitEstimates.Advanced;
  const totalCost = sc.cohortSize * baseCB.cost;
  const totalBenefit = sc.cohortSize * baseCB.benefit;
  const netBenefit = totalBenefit - totalCost;

  const qalyScenario = document.getElementById("qalySelect").value;
  let qalyPerParticipant = 0.05;
  if (qalyScenario === "low") qalyPerParticipant = 0.02;
  else if (qalyScenario === "high") qalyPerParticipant = 0.1;
  const totalQALYs = participants * qalyPerParticipant;
  const monetizedBenefits = totalQALYs * 50000;

  const tableHTML = `
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
  cbaDiv.innerHTML = tableHTML;

  drawCBAChart(totalCost, totalBenefit, netBenefit);
}

/** Draw cost–benefit bar chart */
function drawCBAChart(cost, benefit, net) {
  const ctx = document.getElementById("cbaChart").getContext("2d");
  if (cbaChart) cbaChart.destroy();
  cbaChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Total Cost", "Total Benefit", "Net Benefit"],
      datasets: [{
        label: "USD",
        data: [cost, benefit, net],
        backgroundColor: ["#c0392b", "#27ae60", "#f39c12"]
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

/** Prepare WTP chart data ignoring user scenario, focusing on 4 discrete attributes only. */
function computeStaticWTP() {
  const wtpArr = [];
  for (let key in wtpAll) {
    const diff = wtpAll[key];
    // WTP = diff / -coeff.CostPerParticipant, then x1000
    const wtpVal = diff / -coefficients.CostPerParticipant;
    wtpArr.push({
      label: key, // e.g. "TrainingLevel__Frontline"
      wtp: wtpVal*1000,
      se: Math.abs(wtpVal*1000)*0.1
    });
  }
  return wtpArr;
}

/** Render WTP chart for non-reference discrete levels */
function renderWTPChart() {
  const ctx = document.getElementById("wtpChartMain").getContext("2d");
  if (!ctx) return;
  if (wtpChart) wtpChart.destroy();

  const arr = computeStaticWTP();
  const labels = arr.map(x=> x.label);
  const values = arr.map(x=> x.wtp);
  const errors = arr.map(x=> x.se);

  wtpChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "WTP (USD)",
        data: values,
        backgroundColor: values.map(v => v>=0 ? "rgba(52,152,219,0.6)" : "rgba(231,76,60,0.6)"),
        borderColor: values.map(v => v>=0 ? "rgba(52,152,219,1)" : "rgba(231,76,60,1)"),
        borderWidth: 1,
        maxBarThickness: 45,
        error: errors
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y:{ beginAtZero:true }},
      plugins: {
        legend:{ display:false },
        title:{ display:true, text:"Willingness to Pay (USD) - Non-Reference Levels", font:{ size:16 }}
      }
    },
    plugins: [{
      id:"errbars",
      afterDraw: chart => {
        const { ctx, scales:{y} } = chart;
        chart.getDatasetMeta(0).data.forEach((bar,i) => {
          const xC = bar.x;
          const v = values[i];
          const se = errors[i];
          if (typeof se==="number") {
            const t = y.getPixelForValue(v+se);
            const b = y.getPixelForValue(v-se);
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = "#000";
            ctx.lineWidth=1;
            ctx.moveTo(xC,t);
            ctx.lineTo(xC,b);
            ctx.moveTo(xC-5,t);
            ctx.lineTo(xC+5,t);
            ctx.moveTo(xC-5,b);
            ctx.lineTo(xC+5,b);
            ctx.stroke();
            ctx.restore();
          }
        });
      }
    }]
  });
}

/** Scenarios saving & PDF export */
let savedScenarios = [];
document.getElementById("save-scenario").addEventListener("click", ()=>{
  const sc = buildScenarioFromInputs();
  const fraction = computeUptakeFraction(sc);
  let predictedUptake = fraction*100;
  sc.predictedUptake = predictedUptake.toFixed(1);
  sc.netBenefit = currentNetBenefit.toFixed(2);
  sc.details = {...sc};
  sc.name = "Scenario " + (savedScenarios.length+1);
  savedScenarios.push(sc);
  updateScenarioList();
  alert(`Scenario "${sc.name}" saved successfully.`);
});

function updateScenarioList() {
  const list = document.getElementById("saved-scenarios-list");
  list.innerHTML = "";
  savedScenarios.forEach((s,idx) => {
    const item = document.createElement("div");
    item.className="list-group-item";
    item.innerHTML=`
      <strong>${s.name}</strong><br>
      <span>Training: ${s.details.trainingLevel}</span><br>
      <span>Delivery: ${s.details.deliveryMethod}</span><br>
      <span>Accreditation: ${s.details.accreditation}</span><br>
      <span>Location: ${s.details.location}</span><br>
      <span>Cohort: ${s.details.cohortSize}, Cost/Participant: $${s.details.cost_per_participant.toLocaleString()}</span><br>
      <span>Uptake: ${s.predictedUptake}%, Net Benefit: $${s.netBenefit}</span>
      <div>
        <button class="btn btn-sm btn-primary" onclick="loadScenario(${idx})">Load</button>
        <button class="btn btn-sm btn-danger" onclick="deleteScenario(${idx})">Delete</button>
      </div>
    `;
    list.appendChild(item);
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
    savedScenarios.splice(index,1);
    updateScenarioList();
  }
}

document.getElementById("export-pdf").addEventListener("click", ()=>{
  if (!savedScenarios.length) {
    alert("No scenarios saved to export.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:"mm", format:"a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 15;
  doc.setFontSize(16);
  doc.text("STEPS - Scenarios Comparison", pageWidth/2, currentY, { align:"center" });
  currentY += 10;
  savedScenarios.forEach((sc, idx)=>{
    if (currentY+70 > doc.internal.pageSize.getHeight()-15) {
      doc.addPage();
      currentY=15;
    }
    doc.setFontSize(14);
    doc.text(`Scenario ${idx+1}: ${sc.name}`, 15, currentY);
    currentY+=7;
    doc.setFontSize(12);
    doc.text(`Training: ${sc.trainingLevel}`, 15, currentY); currentY+=5;
    doc.text(`Delivery: ${sc.deliveryMethod}`, 15, currentY); currentY+=5;
    doc.text(`Accreditation: ${sc.accreditation}`, 15, currentY); currentY+=5;
    doc.text(`Location: ${sc.location}`, 15, currentY); currentY+=5;
    doc.text(`Cohort Size: ${sc.cohortSize}`, 15, currentY); currentY+=5;
    doc.text(`Cost per Participant: $${sc.cost_per_participant.toLocaleString()}`, 15, currentY); currentY+=5;
    doc.text(`Predicted Uptake: ${sc.predictedUptake}%`, 15, currentY); currentY+=5;
    doc.text(`Net Benefit: $${sc.netBenefit}`, 15, currentY); currentY+=10;
  });
  doc.save("Scenarios_Comparison.pdf");
});

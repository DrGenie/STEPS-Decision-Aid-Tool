/****************************************************************************
 * SCRIPT.JS
 * 6 Attributes: 4 discrete (Training Level, Delivery Method, Accreditation,
 * Location) each with reference, + 2 continuous (Cohort Size baseline=1000,
 * Cost per Participant baseline=3000). WTP calculations now include
 * an extra +1 from baseline for these continuous attributes.
 ****************************************************************************/

/** Default to Introduction tab */
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
    button.setAttribute("aria-selected","false");
  }
  document.getElementById(tabId).style.display = "block";
  btn.classList.add("active");
  btn.setAttribute("aria-selected","true");

  if (tabId==="wtpTab") renderWTPChart();
  if (tabId==="cbaTab") renderCostsBenefits();
}

/** Range Sliders */
const cohortSlider = document.getElementById("cohort-size");
const cohortDisplay = document.getElementById("cohort-size-value");
cohortDisplay.textContent = cohortSlider.value;
cohortSlider.addEventListener("input", ()=>{
  cohortDisplay.textContent = cohortSlider.value;
  // optional: automatically re-calc? We'll let user do "Calculate & View Results"
});

const costSlider = document.getElementById("cost-per-participant");
const costDisplay = document.getElementById("cost-per-participant-value");
costDisplay.textContent = `$${parseInt(costSlider.value).toLocaleString()}`;
costSlider.addEventListener("input", ()=>{
  costDisplay.textContent = `$${parseInt(costSlider.value).toLocaleString()}`;
});

/** Coefficients for discrete attributes + continuous offsets */
const coeffs = {
  ASC: 1.0,                // base alternative constant
  ASC_optout: 0.3,         // opt-out or do-nothing
  // 1) Training Level (Ref=Advanced)
  TrainingLevel: {
    Frontline: 0.6,
    Intermediate: 0.3,
    Advanced: 0.0
  },
  // 2) Delivery Method (Ref=Online)
  DeliveryMethod: {
    "In-Person": 0.5,
    "Online": 0.0,
    "Hybrid": 0.4
  },
  // 3) Accreditation (Ref=None)
  Accreditation: {
    National: 0.4,
    International: 0.8,
    None: 0.0
  },
  // 4) Location (Ref=District-Level)
  Location: {
    "State-Level": 0.3,
    "Regional Centers": 0.2,
    "District-Level": 0.0
  },
  // 5) Cohort Size => difference from baseline=1000
  CohortSizeSlope: -0.0008, // for each +1 above baseline
  baselineCohort: 1000,
  // 6) Cost per Participant => difference from baseline=3000
  CostSlope: -0.0001, // for each +1 above baseline
  baselineCost: 3000
};

/** Basic cost/benefit placeholders by training level (a simple structure) */
const costBenefitEstimates = {
  Frontline: { cost: 250000, benefit: 800000 },
  Intermediate: { cost: 450000, benefit: 1400000 },
  Advanced: { cost: 650000, benefit: 2000000 }
};

/** Build scenario from user inputs */
function buildScenarioFromInputs() {
  const trainingLevel = document.querySelector('input[name="training-level"]:checked').value;
  const deliveryMethod = document.querySelector('input[name="delivery-method"]:checked').value;
  const accreditation = document.querySelector('input[name="accreditation"]:checked').value;
  const location = document.querySelector('input[name="location"]:checked').value;
  const cSize = parseInt(document.getElementById("cohort-size").value,10);
  const cCost = parseInt(document.getElementById("cost-per-participant").value,10);

  return {
    trainingLevel, deliveryMethod, accreditation, location,
    cohortSize: cSize, cost_per_participant: cCost
  };
}

/** Compute logit-based uptake fraction */
function computeUptakeFraction(sc) {
  let U = coeffs.ASC
    + coeffs.TrainingLevel[sc.trainingLevel]
    + coeffs.DeliveryMethod[sc.deliveryMethod]
    + coeffs.Accreditation[sc.accreditation]
    + coeffs.Location[sc.location];

  // continuous offsets from baseline
  const dCohort = (sc.cohortSize - coeffs.baselineCohort);
  const dCost   = (sc.cost_per_participant - coeffs.baselineCost);
  U += coeffs.CohortSizeSlope * dCohort;
  U += coeffs.CostSlope        * dCost;

  const altExp = Math.exp(U);
  const optExp = Math.exp(coeffs.ASC_optout);
  return altExp / (altExp + optExp);
}

/** Show/hide modal */
function showResultsModal(html) {
  const modal = document.getElementById("resultsModal");
  document.getElementById("modal-results").innerHTML = html;
  modal.style.display = "block";
}
function closeModal() {
  document.getElementById("resultsModal").style.display = "none";
}

/** On "Calculate & View Results" click */
document.getElementById("view-results").addEventListener("click", ()=>{
  const sc = buildScenarioFromInputs();
  let frac = computeUptakeFraction(sc);
  let predictedUptake = frac*100;
  // no random noise here
  predictedUptake = Math.max(0, Math.min(100, predictedUptake));
  
  let recMsg = "";
  if (predictedUptake < 30) {
    recMsg = "Uptake is low. Consider lowering cost or exploring alternative expansions.";
  } else if (predictedUptake < 70) {
    recMsg = "Uptake is moderate. Some improvements may boost acceptance.";
  } else {
    recMsg = "Uptake is high. This configuration appears effective.";
  }

  showResultsModal(`
    <p><strong>Predicted Program Uptake:</strong> ${predictedUptake.toFixed(1)}%</p>
    <p>${recMsg}</p>
  `);

  drawUptakeChart(predictedUptake);

  // cost & benefit from training level
  const baseCB = costBenefitEstimates[sc.trainingLevel] || costBenefitEstimates["Advanced"];
  const totalCost = sc.cohortSize * baseCB.cost;
  const totalBenefit = sc.cohortSize * baseCB.benefit;
  const netBenefit = totalBenefit - totalCost;
  // store globally
  currentUptake = predictedUptake;
  currentTotalCost = totalCost;
  currentTotalBenefit = totalBenefit;
  currentNetBenefit = netBenefit;

  // re-render costs & benefits
  renderCostsBenefits();
});

/** Draw uptake donut chart */
let uptakeChart=null;
function drawUptakeChart(val) {
  const ctx = document.getElementById("uptakeChart").getContext("2d");
  if (uptakeChart) uptakeChart.destroy();
  uptakeChart = new Chart(ctx,{
    type:"doughnut",
    data:{
      labels:["Uptake","Remaining"],
      datasets:[{
        data:[val,100-val],
        backgroundColor:["#2ecc71","#e74c3c"]
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        title:{
          display:true,
          text:`Predicted Program Uptake: ${val.toFixed(1)}%`,
          font:{size:16}
        }
      }
    }
  });
}

/** Render cost & benefit tab */
let cbaChart=null;
function renderCostsBenefits() {
  const cbaDiv = document.getElementById("cba-summary");
  if (!cbaDiv) return;
  const sc = buildScenarioFromInputs();
  let fraction = computeUptakeFraction(sc);
  let predictedUptake = fraction*100;
  const participants = (predictedUptake/100)*250;

  const baseCB = costBenefitEstimates[sc.trainingLevel] || costBenefitEstimates["Advanced"];
  const totalCost = sc.cohortSize * baseCB.cost;
  const totalBenefit = sc.cohortSize * baseCB.benefit;
  const netBenefit = totalBenefit - totalCost;

  const qalyScenario = document.getElementById("qalySelect").value;
  let qalyPerPerson=0.05;
  if (qalyScenario==="low") qalyPerPerson=0.02;
  else if(qalyScenario==="high")qalyPerPerson=0.1;
  const totalQALYs= participants*qalyPerPerson;
  const monetizedBenefits= totalQALYs*50000;

  cbaDiv.innerHTML=`
    <table>
      <tr><td><strong>Uptake (%)</strong></td><td>${predictedUptake.toFixed(1)}%</td></tr>
      <tr><td><strong>Participants</strong></td><td>${participants.toFixed(0)}</td></tr>
      <tr><td><strong>Total Training Cost</strong></td><td>$${totalCost.toLocaleString()}</td></tr>
      <tr><td><strong>Cost per Participant</strong></td><td>$${(totalCost/participants).toFixed(2)}</td></tr>
      <tr><td><strong>Total QALYs</strong></td><td>${totalQALYs.toFixed(2)}</td></tr>
      <tr><td><strong>Monetized Benefits</strong></td><td>$${monetizedBenefits.toLocaleString()}</td></tr>
      <tr><td><strong>Net Benefit</strong></td><td>$${netBenefit.toLocaleString()}</td></tr>
    </table>
  `;
  drawCBAChart(totalCost,totalBenefit,netBenefit);
}

function drawCBAChart(cost,benefit,net) {
  const ctx = document.getElementById("cbaChart").getContext("2d");
  if(cbaChart) cbaChart.destroy();
  cbaChart= new Chart(ctx,{
    type:"bar",
    data:{
      labels:["Total Cost","Total Benefit","Net Benefit"],
      datasets:[{
        label:"USD",
        data:[cost,benefit,net],
        backgroundColor:["#c0392b","#27ae60","#f39c12"]
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      scales:{y:{beginAtZero:true}},
      plugins:{
        title:{display:true,text:"Cost-Benefit Analysis",font:{size:16}}
      }
    }
  });
}

/** WTP for discrete + continuous from baseline. We'll define increments for continuous. */
const wtpAll = {
  // Discrete attributes, difference from baseline
  "TrainingLevel__Frontline": 0.6,
  "TrainingLevel__Intermediate": 0.3,

  "DeliveryMethod__In-Person": 0.5,
  "DeliveryMethod__Hybrid": 0.4,

  "Accreditation__National": 0.4,
  "Accreditation__International": 0.8,

  "Location__State-Level": 0.3,
  "Location__Regional Centers": 0.2,

  // Continuous attributes: define 1 extra above baseline => difference in utility
  // Baseline: 1000 for CohortSize => slope= -0.0008 => diff from baseline is dC
  "CohortSize__+1above1000": -0.0008,

  // Baseline: 3000 for cost => slope= -0.0001 => each +1 from 3000
  "Cost__+1above3000": -0.0001
};

/** We compute static WTP ignoring user scenario, for +1 increments for continuous. */
function computeStaticWTP() {
  const arr = [];
  // ratio = diff / negative( cost slope ) => we define cost slope as -1?
  // Actually let's define the cost coefficient = -0.0001 (cost is also an attribute though).
  // We'll do ratio = diff / ( negative of cost slope? ) because that's the standard approach.
  
  // We define the cost slope = -0.0001. So ratio = diff / -(-0.0001)= diff / 0.0001 => diff * 10000
  for (let key in wtpAll) {
    const diff = wtpAll[key];
    // The cost slope is (Cost__+1above3000 => -0.0001). We'll call it costSlope= -0.0001
    // WTP = diff / ( negative costSlope ) => diff / +0.0001 => diff*10000
    // but if diff is itself the difference from baseline, let's do ratio= diff / -( cost slope ) => diff / 0.0001
    // same if the "diff" is the difference from baseline for the attribute in question, e.g. +1 for cohort is slope= -0.0008
    // We'll define "cost slope" as the attribute "Cost__+1above3000" => -0.0001 => we do ratio= ( -0.0008 ) / ( - -0.0001 ) => ...
    // Actually let's define a single cost slope for WTP => -0.0001
    let costSlope = -0.0001;
    const wtpVal = diff / -(costSlope);
    arr.push({
      label:key,
      wtp: wtpVal*1000, // scaling to 1000 because we want meaningful USD
      se:Math.abs(wtpVal*1000)*0.1
    });
  }
  return arr;
}

let wtpChart=null;
function renderWTPChart(){
  const ctx= document.getElementById("wtpChartMain").getContext("2d");
  if(!ctx)return;
  if(wtpChart) wtpChart.destroy();

  const dataArr= computeStaticWTP();
  const labels= dataArr.map(x=> x.label);
  const values= dataArr.map(x=> x.wtp);
  const errors= dataArr.map(x=> x.se);

  wtpChart= new Chart(ctx,{
    type:"bar",
    data:{
      labels,
      datasets:[{
        label:"WTP (USD)",
        data: values,
        backgroundColor: values.map(v=> v>=0?"rgba(52,152,219,0.6)":"rgba(231,76,60,0.6)"),
        borderColor: values.map(v=> v>=0?"rgba(52,152,219,1)":"rgba(231,76,60,1)"),
        borderWidth:1,
        maxBarThickness:45,
        error: errors
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      scales:{y:{beginAtZero:true}},
      plugins:{
        legend:{display:false},
        title:{
          display:true,
          text:"Willingness to Pay (USD) - Non-Reference Levels (+1 from baseline)",
          font:{size:16}
        }
      }
    },
    plugins:[{
      id:"errorbars",
      afterDraw: chart=>{
        const {ctx, scales:{y}}=chart;
        chart.getDatasetMeta(0).data.forEach((bar,i)=>{
          const xC= bar.x;
          const v= values[i];
          const se= errors[i];
          if(typeof se==="number") {
            const top= y.getPixelForValue(v+se);
            const bot= y.getPixelForValue(v-se);
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle="#000";
            ctx.lineWidth=1;
            ctx.moveTo(xC,top);
            ctx.lineTo(xC,bot);
            ctx.moveTo(xC-5,top);
            ctx.lineTo(xC+5,top);
            ctx.moveTo(xC-5,bot);
            ctx.lineTo(xC+5,bot);
            ctx.stroke();
            ctx.restore();
          }
        });
      }
    }]
  });
}

/** SCENARIOS Management */
let savedScenarios=[];
document.getElementById("save-scenario").addEventListener("click",()=>{
  const sc= buildScenarioFromInputs();
  const frac= computeUptakeFraction(sc);
  let predictedUptake= frac*100;
  sc.predictedUptake= predictedUptake.toFixed(1);
  // net benefit from last calculation
  sc.netBenefit= currentNetBenefit.toFixed(2);
  sc.details={...sc};
  sc.name= "Scenario "+ (savedScenarios.length+1);
  savedScenarios.push(sc);
  updateScenarioList();
  alert(`Scenario "${sc.name}" saved successfully.`);
});

function updateScenarioList(){
  const list= document.getElementById("saved-scenarios-list");
  list.innerHTML="";
  savedScenarios.forEach((s,idx)=>{
    const div=document.createElement("div");
    div.className="list-group-item";
    div.innerHTML=`
      <strong>${s.name}</strong><br>
      <span>Training: ${s.trainingLevel}</span><br>
      <span>Delivery: ${s.deliveryMethod}</span><br>
      <span>Accreditation: ${s.accreditation}</span><br>
      <span>Location: ${s.location}</span><br>
      <span>Cohort: ${s.cohortSize}, Cost(USD): $${s.cost_per_participant.toLocaleString()}</span><br>
      <span>Uptake: ${s.predictedUptake}%, Net Benefit: $${s.netBenefit}</span>
      <div>
        <button class="btn btn-sm btn-primary" onclick="loadScenario(${idx})">Load</button>
        <button class="btn btn-sm btn-danger" onclick="deleteScenario(${idx})">Delete</button>
      </div>
    `;
    list.appendChild(div);
  });
}

function loadScenario(index){
  const s= savedScenarios[index];
  document.querySelector(`input[name="training-level"][value="${s.trainingLevel}"]`).checked=true;
  document.querySelector(`input[name="delivery-method"][value="${s.deliveryMethod}"]`).checked=true;
  document.querySelector(`input[name="accreditation"][value="${s.accreditation}"]`).checked=true;
  document.querySelector(`input[name="location"][value="${s.location}"]`).checked=true;
  document.getElementById("cohort-size").value=s.cohortSize;
  document.getElementById("cohort-size-value").textContent=s.cohortSize;
  document.getElementById("cost-per-participant").value=s.cost_per_participant;
  document.getElementById("cost-per-participant-value").textContent=`$${s.cost_per_participant.toLocaleString()}`;
}

function deleteScenario(index){
  if(confirm("Are you sure you want to delete this scenario?")){
    savedScenarios.splice(index,1);
    updateScenarioList();
  }
}

document.getElementById("export-pdf").addEventListener("click",()=>{
  if(!savedScenarios.length){
    alert("No scenarios saved to export.");
    return;
  }
  const {jsPDF}= window.jspdf;
  const doc= new jsPDF({unit:"mm", format:"a4"});
  const pageWidth= doc.internal.pageSize.getWidth();
  let currentY=15;
  doc.setFontSize(16);
  doc.text("STEPS - Scenarios Comparison", pageWidth/2, currentY, {align:"center"});
  currentY+=10;

  savedScenarios.forEach((sc, idx)=>{
    if(currentY+70> doc.internal.pageSize.getHeight()-15){
      doc.addPage();
      currentY=15;
    }
    doc.setFontSize(14);
    doc.text(`Scenario ${idx+1}: ${sc.name}`,15,currentY); currentY+=7;
    doc.setFontSize(12);
    doc.text(`Training Level: ${sc.trainingLevel}`,15,currentY); currentY+=5;
    doc.text(`Delivery Method: ${sc.deliveryMethod}`,15,currentY); currentY+=5;
    doc.text(`Accreditation: ${sc.accreditation}`,15,currentY); currentY+=5;
    doc.text(`Location: ${sc.location}`,15,currentY); currentY+=5;
    doc.text(`Cohort Size: ${sc.cohortSize}`,15,currentY); currentY+=5;
    doc.text(`Cost per Participant: $${sc.cost_per_participant.toLocaleString()}`,15,currentY); currentY+=5;
    doc.text(`Predicted Uptake: ${sc.predictedUptake}%`,15,currentY); currentY+=5;
    doc.text(`Net Benefit: $${sc.netBenefit}`,15,currentY); currentY+=10;
  });

  doc.save("Scenarios_Comparison.pdf");
});

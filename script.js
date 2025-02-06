/****************************************************************************
 * SCRIPT.JS
 * 6 Attributes: 4 discrete (Training, Delivery, Accreditation, Location)
 * + 2 continuous (Cohort Size, Cost per Participant). No mention of baseline
 * in the UI for continuous attributes. Tooltips are smaller. WTP includes
 * discrete differences + 1-unit changes in the continuous attributes.
 ****************************************************************************/

/** Default tab = Introduction */
window.onload = function() {
  openTab('introTab', document.querySelector('.tablink'));
};

/** Tab switching function */
function openTab(tabId, btn) {
  const tabs = document.getElementsByClassName("tabcontent");
  for (let t of tabs) {
    t.style.display = "none";
  }
  const tabButtons = document.getElementsByClassName("tablink");
  for (let b of tabButtons) {
    b.classList.remove("active");
    b.setAttribute("aria-selected","false");
  }
  document.getElementById(tabId).style.display = "block";
  btn.classList.add("active");
  btn.setAttribute("aria-selected","true");

  if (tabId==="wtpTab") renderWTPChart();
  if (tabId==="cbaTab") renderCostsBenefits();
}

/** Range sliders & live display */
const cohortSlider = document.getElementById("cohort-size");
const cohortDisplay = document.getElementById("cohort-size-value");
cohortDisplay.textContent = cohortSlider.value;
cohortSlider.addEventListener("input", ()=> {
  cohortDisplay.textContent = cohortSlider.value;
});

const costSlider = document.getElementById("cost-per-participant");
const costDisplay = document.getElementById("cost-per-participant-value");
costDisplay.textContent = `$${parseInt(costSlider.value).toLocaleString()}`;
costSlider.addEventListener("input", ()=> {
  costDisplay.textContent = `$${parseInt(costSlider.value).toLocaleString()}`;
});

/** Coeff dictionary: includes 4 discrete + 2 continuous slopes. No baseline mention in UI. */
const coeffs = {
  ASC: 1.0,      // alternative-specific constant
  ASC_optout: 0.3,
  // Discrete: Training (Ref=Advanced)
  TrainingLevel: {
    Frontline: 0.6,
    Intermediate: 0.3,
    Advanced: 0.0
  },
  // Delivery (Ref=Online)
  DeliveryMethod: {
    "In-Person": 0.5,
    "Online": 0.0,
    "Hybrid": 0.4
  },
  // Accreditation (Ref=None)
  Accreditation: {
    National: 0.4,
    International: 0.8,
    None: 0.0
  },
  // Location (Ref=District-Level)
  Location: {
    "State-Level": 0.3,
    "Regional Centers": 0.2,
    "District-Level": 0.0
  },
  // Continuous slopes (no baseline mention in UI)
  CohortSizeSlope: -0.0008,
  CostSlope: -0.0001
};

/** Basic cost-benefit placeholders by training level. */
const costBenefitEstimates = {
  Frontline: { cost: 250000, benefit: 800000 },
  Intermediate: { cost: 450000, benefit: 1400000 },
  Advanced: { cost: 650000, benefit: 2000000 }
};

let currentUptake=0, currentTotalCost=0, currentTotalBenefit=0, currentNetBenefit=0;
let uptakeChart=null, cbaChart=null, wtpChart=null;
const baseCohortSize = 250; // for partial usage in cost–benefit calc

/** Build scenario from user selection */
function buildScenarioFromInputs() {
  const trainingLevel = document.querySelector('input[name="training-level"]:checked').value;
  const deliveryMethod= document.querySelector('input[name="delivery-method"]:checked').value;
  const accreditation= document.querySelector('input[name="accreditation"]:checked').value;
  const location     = document.querySelector('input[name="location"]:checked').value;
  const cSize       = parseInt(document.getElementById("cohort-size").value,10);
  const cCost       = parseInt(document.getElementById("cost-per-participant").value,10);
  return { trainingLevel, deliveryMethod, accreditation, location, cohortSize:cSize, cost_per_participant:cCost };
}

/** Compute logit utility & fraction (no random noise) */
function computeUptakeFraction(sc) {
  let U = coeffs.ASC
    + coeffs.TrainingLevel[sc.trainingLevel]
    + coeffs.DeliveryMethod[sc.deliveryMethod]
    + coeffs.Accreditation[sc.accreditation]
    + coeffs.Location[sc.location];

  // continuous increments from arbitrary zero
  // e.g. each 1 in "cohortSize" => slope -0.0008
  U += coeffs.CohortSizeSlope * (sc.cohortSize);
  U += coeffs.CostSlope        * (sc.cost_per_participant);

  const altExp= Math.exp(U);
  const optExp= Math.exp(coeffs.ASC_optout);
  return altExp/(altExp+optExp);
}

/** Calculate & show results modal */
document.getElementById("view-results").addEventListener("click", ()=>{
  const sc= buildScenarioFromInputs();
  let fraction= computeUptakeFraction(sc);
  let predictedUptake= fraction*100;
  predictedUptake= Math.max(0, Math.min(100, predictedUptake));
  
  let recommendation= "";
  if (predictedUptake<30){
    recommendation= "Uptake is low. Consider reducing cost or other expansions.";
  } else if (predictedUptake<70){
    recommendation= "Moderate uptake. Room for improvement.";
  } else {
    recommendation= "High uptake. This configuration appears effective.";
  }

  const modalHTML=`
    <p><strong>Predicted Program Uptake:</strong> ${predictedUptake.toFixed(1)}%</p>
    <p>${recommendation}</p>
  `;
  showResultsModal(modalHTML);
  drawUptakeChart(predictedUptake);

  // cost & benefit
  const baseCB = costBenefitEstimates[sc.trainingLevel] || costBenefitEstimates.Advanced;
  const totalCost= sc.cohortSize * baseCB.cost;
  const totalBenefit= sc.cohortSize * baseCB.benefit;
  const netBenefit= totalBenefit - totalCost;

  currentUptake= predictedUptake;
  currentTotalCost= totalCost;
  currentTotalBenefit= totalBenefit;
  currentNetBenefit= netBenefit;

  renderCostsBenefits();
});

function showResultsModal(html){
  const modal= document.getElementById("resultsModal");
  document.getElementById("modal-results").innerHTML= html;
  modal.style.display="block";
}
function closeModal(){
  document.getElementById("resultsModal").style.display="none";
}

/** Draw uptake chart (no random changes on repeated calls) */
function drawUptakeChart(val){
  const ctx= document.getElementById("uptakeChart").getContext("2d");
  if(uptakeChart) uptakeChart.destroy();
  uptakeChart= new Chart(ctx,{
    type:"doughnut",
    data:{
      labels:["Uptake","Remaining"],
      datasets:[{
        data:[val,100-val],
        backgroundColor:["#27ae60","#e74c3c"]
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

/** Render cost–benefit summary & chart */
function renderCostsBenefits(){
  const cbaDiv= document.getElementById("cba-summary");
  if(!cbaDiv)return;
  const sc= buildScenarioFromInputs();
  let fraction= computeUptakeFraction(sc);
  let predictedUptake= fraction*100;
  const participants= (predictedUptake/100)* baseCohortSize;

  const baseCB= costBenefitEstimates[sc.trainingLevel]|| costBenefitEstimates.Advanced;
  const totalCost= sc.cohortSize* baseCB.cost;
  const totalBenefit= sc.cohortSize* baseCB.benefit;
  const netBenefit= totalBenefit- totalCost;

  // QALY scenario
  const qSel= document.getElementById("qalySelect");
  let qVal=0.05; // moderate
  if(qSel.value==="low") qVal=0.02; 
  else if(qSel.value==="high") qVal=0.1;
  const totalQALYs= participants* qVal;
  const monetized= totalQALYs* 50000;

  cbaDiv.innerHTML=`
    <table>
      <tr><td><strong>Uptake (%)</strong></td><td>${predictedUptake.toFixed(1)}%</td></tr>
      <tr><td><strong>Participants</strong></td><td>${participants.toFixed(0)}</td></tr>
      <tr><td><strong>Total Training Cost</strong></td><td>$${totalCost.toLocaleString()}</td></tr>
      <tr><td><strong>Cost per Participant</strong></td><td>$${(totalCost/participants).toFixed(2)}</td></tr>
      <tr><td><strong>Total QALYs</strong></td><td>${totalQALYs.toFixed(2)}</td></tr>
      <tr><td><strong>Monetized Benefits</strong></td><td>$${monetized.toLocaleString()}</td></tr>
      <tr><td><strong>Net Benefit</strong></td><td>$${(totalBenefit- totalCost).toLocaleString()}</td></tr>
    </table>
  `;
  drawCBAChart(totalCost,totalBenefit,netBenefit);
}

/** cost–benefit bar chart */
function drawCBAChart(cost,benefit,net){
  const ctx= document.getElementById("cbaChart").getContext("2d");
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
      scales:{ y:{ beginAtZero:true }},
      plugins:{
        title:{
          display:true,
          text:"Cost-Benefit Analysis",
          font:{size:16}
        }
      }
    }
  });
}

/** WTP: discrete + continuous increments. We'll define +1 for cost & cohort. */
const wtpDiffs = {
  // Discrete attribute diffs from references
  "TrainingLevel__Frontline": 0.6,
  "TrainingLevel__Intermediate": 0.3,
  "DeliveryMethod__In-Person": 0.5,
  "DeliveryMethod__Hybrid": 0.4,
  "Accreditation__National": 0.4,
  "Accreditation__International": 0.8,
  "Location__State-Level": 0.3,
  "Location__Regional Centers": 0.2,

  // +1 for CohortSize => slope= -0.0008
  // => difference in utility for +1 is -0.0008
  "CohortSize__+1": -0.0008,
  // +1 for Cost => slope= -0.0001
  "Cost__+1": -0.0001
};

/** WTP = difference / negative cost slope => difference / +0.0001 => difference*10000 => scale or label? */
function computeStaticWTP() {
  const arr=[];
  const costSlope= -0.0001; // same approach for all
  for(let key in wtpDiffs){
    const diff= wtpDiffs[key]; 
    // ratio= diff / -(costSlope)= diff / 0.0001 => diff*10000
    const ratio= diff / -(costSlope);
    arr.push({
      label: key,
      wtp: ratio*1000,      // scaling further by 1000 if we want bigger values
      se: Math.abs(ratio*1000)*0.1
    });
  }
  return arr;
}

function renderWTPChart(){
  const ctx= document.getElementById("wtpChartMain").getContext("2d");
  if(!ctx)return;
  if(wtpChart) wtpChart.destroy();

  const data= computeStaticWTP();
  const labels= data.map(d=> d.label);
  const values= data.map(d=> d.wtp);
  const errors= data.map(d=> d.se);

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
        error: errors
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      scales:{ y:{ beginAtZero:true }},
      plugins:{
        legend:{ display:false },
        title:{
          display:true,
          text:"Willingness to Pay (USD) - Non-Reference +1 increments",
          font:{ size:16 }
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
          if(typeof se==="number"){
            const top= y.getPixelForValue(v+se);
            const bottom= y.getPixelForValue(v-se);
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle="#000";
            ctx.lineWidth=1;
            ctx.moveTo(xC, top);
            ctx.lineTo(xC, bottom);
            ctx.moveTo(xC-5, top);
            ctx.lineTo(xC+5, top);
            ctx.moveTo(xC-5, bottom);
            ctx.lineTo(xC+5, bottom);
            ctx.stroke();
            ctx.restore();
          }
        });
      }
    }]
  });
}

/** SCENARIOS: save, load, delete, export */
let savedScenarios=[];
document.getElementById("save-scenario").addEventListener("click",()=>{
  const sc= buildScenarioFromInputs();
  const fraction= computeUptakeFraction(sc);
  let predictedUptake= fraction*100;
  sc.predictedUptake= predictedUptake.toFixed(1);
  sc.netBenefit= currentNetBenefit.toFixed(2);
  sc.details= {...sc};
  sc.name= `Scenario ${savedScenarios.length+1}`;
  savedScenarios.push(sc);
  updateScenarioList();
  alert(`Scenario "${sc.name}" saved successfully.`);
});

function updateScenarioList(){
  const list= document.getElementById("saved-scenarios-list");
  list.innerHTML="";
  savedScenarios.forEach((s,idx)=>{
    const item= document.createElement("div");
    item.className= "list-group-item";
    item.innerHTML=`
      <strong>${s.name}</strong><br>
      <span>Training: ${s.trainingLevel}</span><br>
      <span>Delivery: ${s.deliveryMethod}</span><br>
      <span>Accreditation: ${s.accreditation}</span><br>
      <span>Location: ${s.location}</span><br>
      <span>Cohort: ${s.cohortSize}, Cost: $${s.cost_per_participant.toLocaleString()}</span><br>
      <span>Uptake: ${s.predictedUptake}%, Net Benefit: $${s.netBenefit}</span>
      <div>
        <button class="btn btn-sm btn-primary" onclick="loadScenario(${idx})">Load</button>
        <button class="btn btn-sm btn-danger" onclick="deleteScenario(${idx})">Delete</button>
      </div>
    `;
    list.appendChild(item);
  });
}

function loadScenario(index){
  const s= savedScenarios[index];
  document.querySelector(`input[name="training-level"][value="${s.trainingLevel}"]`).checked= true;
  document.querySelector(`input[name="delivery-method"][value="${s.deliveryMethod}"]`).checked= true;
  document.querySelector(`input[name="accreditation"][value="${s.accreditation}"]`).checked= true;
  document.querySelector(`input[name="location"][value="${s.location}"]`).checked= true;
  document.getElementById("cohort-size").value= s.cohortSize;
  document.getElementById("cohort-size-value").textContent= s.cohortSize;
  document.getElementById("cost-per-participant").value= s.cost_per_participant;
  document.getElementById("cost-per-participant-value").textContent= `$${s.cost_per_participant.toLocaleString()}`;
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
  const { jsPDF }= window.jspdf;
  const doc= new jsPDF({ unit:"mm", format:"a4" });
  const pageWidth= doc.internal.pageSize.getWidth();
  let currentY=15;
  doc.setFontSize(16);
  doc.text("STEPS - Scenarios Comparison", pageWidth/2, currentY, { align:"center"});
  currentY+=10;

  savedScenarios.forEach((sc, idx)=>{
    if(currentY+70> doc.internal.pageSize.getHeight()-15){
      doc.addPage();
      currentY=15;
    }
    doc.setFontSize(14);
    doc.text(`Scenario ${idx+1}: ${sc.name}`,15,currentY); currentY+=7;
    doc.setFontSize(12);
    doc.text(`Training: ${sc.trainingLevel}`,15,currentY); currentY+=5;
    doc.text(`Delivery: ${sc.deliveryMethod}`,15,currentY); currentY+=5;
    doc.text(`Accreditation: ${sc.accreditation}`,15,currentY); currentY+=5;
    doc.text(`Location: ${sc.location}`,15,currentY); currentY+=5;
    doc.text(`Cohort: ${sc.cohortSize}, Cost: $${sc.cost_per_participant.toLocaleString()}`,15,currentY); currentY+=5;
    doc.text(`Predicted Uptake: ${sc.predictedUptake}%`,15,currentY); currentY+=5;
    doc.text(`Net Benefit: $${sc.netBenefit}`,15,currentY); currentY+=10;
  });

  doc.save("Scenarios_Comparison.pdf");
});

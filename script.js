/****************************************************************************
 * SCRIPT.JS
 * - Discrete attributes (4) each with references
 * - 2 continuous: CohortSize(500–2000) & Cost(0..250 => $60..$1500)
 * - Updated slopes: costSlope=-0.07, cohortSlope=0.08 (as requested)
 * - QALY scenario: Low=0.01, Mod=0.05, High=0.08
 * - Hover tooltips at 0.75em, color #2e4053
 ****************************************************************************/

/** Default tab = Introduction */
window.onload = function(){
  openTab("introTab", document.querySelector(".tablink"));
};

/** Tab switching function */
function openTab(tabId, btn){
  const allTabs = document.getElementsByClassName("tabcontent");
  for(let t of allTabs) {
    t.style.display = "none";
  }
  const allBtns = document.getElementsByClassName("tablink");
  for(let b of allBtns) {
    b.classList.remove("active");
    b.setAttribute("aria-selected","false");
  }
  document.getElementById(tabId).style.display="block";
  btn.classList.add("active");
  btn.setAttribute("aria-selected","true");

  // Provide re-render calls if needed
  if(tabId==="wtpTab") renderWTPChart();
  if(tabId==="cbaTab") renderCostsBenefits();
}

/** Cohort slider (500–2000) */
const cohortSlider = document.getElementById("cohort-size");
const cohortDisplay = document.getElementById("cohort-size-value");
cohortDisplay.textContent = cohortSlider.value;
cohortSlider.addEventListener("input",()=>{
  cohortDisplay.textContent = cohortSlider.value;
});

/** Cost slider (0–250 => $60–$1500), but we store a function to transform */
const costSliderUI = document.getElementById("costSliderUI");
const costValueUI  = document.getElementById("costValueUI");
function transformCost(val){
  // val in [0..250]
  // cost in [60..1500]
  return 60 + ((1500-60)/250)* val;
}
function updateCostLabel(sliderVal){
  const c = transformCost(sliderVal);
  costValueUI.textContent = `$${c.toFixed(0)} (approx.)`;
}
updateCostLabel(costSliderUI.value); // init label
costSliderUI.addEventListener("input",()=>{
  updateCostLabel(costSliderUI.value);
});

/** Coeffs: requested costSlope=-0.07, cohortSlope=0.08, plus discrete attributes */
const coeffs = {
  ASC: 1.0,
  ASC_optout: 0.3,
  // Discrete references
  TrainingLevel: {
    Frontline: 0.6,
    Intermediate: 0.3,
    Advanced: 0.0
  },
  DeliveryMethod: {
    "In-Person": 0.5,
    "Online": 0.0,
    "Hybrid": 0.4
  },
  Accreditation: {
    National: 0.4,
    International: 0.8,
    None: 0.0
  },
  Location: {
    "State-Level": 0.3,
    "Regional Centers": 0.2,
    "District-Level": 0.0
  },
  // Updated continuous slopes
  CohortSizeSlope: 0.08,  // user request
  CostSlope: -0.07        // user request
};

/** cost/benefit placeholders by training level */
const costBenefitEstimates = {
  Frontline: { cost:250000, benefit:800000 },
  Intermediate: { cost:450000, benefit:1400000 },
  Advanced: { cost:650000, benefit:2000000 }
};

let currentUptake= 0, currentTotalCost= 0, currentTotalBenefit= 0, currentNetBenefit= 0;
let uptakeChart= null, cbaChart= null, wtpChart= null;

/** Build scenario from user inputs */
function buildScenarioFromInputs(){
  const trainingLevel= document.querySelector('input[name="training-level"]:checked').value;
  const deliveryMethod= document.querySelector('input[name="delivery-method"]:checked').value;
  const accreditation= document.querySelector('input[name="accreditation"]:checked').value;
  const location= document.querySelector('input[name="location"]:checked').value;
  const cSize= parseInt(cohortSlider.value,10);
  const costVal= parseInt(costSliderUI.value,10);
  const costMapped= transformCost(costVal);

  return {
    trainingLevel,
    deliveryMethod,
    accreditation,
    location,
    cohortSize: cSize,
    cost_participant: costMapped
  };
}

/** Compute logit fraction with updated slopes */
function computeUptakeFraction(sc){
  let U = coeffs.ASC
    + coeffs.TrainingLevel[sc.trainingLevel]
    + coeffs.DeliveryMethod[sc.deliveryMethod]
    + coeffs.Accreditation[sc.accreditation]
    + coeffs.Location[sc.location];

  // updated continuous slopes
  U += coeffs.CohortSizeSlope* sc.cohortSize;
  U += coeffs.CostSlope* sc.cost_participant; 

  const altExp= Math.exp(U);
  const optExp= Math.exp(coeffs.ASC_optout);
  return altExp/(altExp+ optExp);
}

/** "Calculate & View Results" */
document.getElementById("view-results").addEventListener("click", ()=>{
  const sc = buildScenarioFromInputs();
  const fraction= computeUptakeFraction(sc);
  let predictedUptake= fraction*100;
  predictedUptake= Math.max(0, Math.min(100, predictedUptake));

  let recMsg= "";
  if(predictedUptake<30){
    recMsg= "Uptake is low. Adjust cost or expand accessibility.";
  } else if(predictedUptake<70){
    recMsg= "Moderate uptake. Fine-tune your scenario to improve acceptance.";
  } else {
    recMsg= "High uptake. This scenario is quite effective for FETP scale-up.";
  }
  showModal(`
    <p><strong>Predicted Program Uptake:</strong> ${predictedUptake.toFixed(1)}%</p>
    <p>${recMsg}</p>
  `);
  drawUptakeChart(predictedUptake);

  // cost & benefit
  const baseCB= costBenefitEstimates[sc.trainingLevel] || costBenefitEstimates.Advanced;
  const totalCost= sc.cohortSize* baseCB.cost;
  const totalBenefit= sc.cohortSize* baseCB.benefit;
  currentUptake= predictedUptake;
  currentTotalCost= totalCost;
  currentTotalBenefit= totalBenefit;
  currentNetBenefit= totalBenefit - totalCost;

  renderCostsBenefits();
});

/** Show/hide modal */
function showModal(html){
  document.getElementById("modal-results").innerHTML= html;
  document.getElementById("resultsModal").style.display="block";
}
function closeModal(){
  document.getElementById("resultsModal").style.display="none";
}

/** Draw uptake chart */
function drawUptakeChart(val){
  const ctx= document.getElementById("uptakeChart").getContext("2d");
  if(uptakeChart) uptakeChart.destroy();
  uptakeChart= new Chart(ctx,{
    type:"doughnut",
    data:{
      labels:["Uptake","Remaining"],
      datasets:[{
        data:[val, 100-val],
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
          font:{ size:16 }
        }
      }
    }
  });
}

/** Costs & Benefits tab */
function renderCostsBenefits(){
  const cbaDiv= document.getElementById("cba-summary");
  if(!cbaDiv)return;
  const sc= buildScenarioFromInputs();
  const frac= computeUptakeFraction(sc);
  const predictedUptake= frac*100;
  const participants= (predictedUptake/100)* 250;

  const baseCB= costBenefitEstimates[sc.trainingLevel]|| costBenefitEstimates.Advanced;
  const totalCost= sc.cohortSize* baseCB.cost;
  const totalBenefit= sc.cohortSize* baseCB.benefit;
  const netBenefit= totalBenefit- totalCost;

  let q=0.05; // moderate default
  const sel= document.getElementById("qalySelect");
  if(sel.value==="low") q=0.01;
  else if(sel.value==="high") q=0.08;
  const totalQALYs= participants* q;
  const monetized= totalQALYs* 50000;

  cbaDiv.innerHTML= `
    <table>
      <tr><td><strong>Uptake (%)</strong></td><td>${predictedUptake.toFixed(1)}%</td></tr>
      <tr><td><strong>Participants</strong></td><td>${participants.toFixed(0)}</td></tr>
      <tr><td><strong>Total Training Cost</strong></td><td>$${totalCost.toLocaleString()}</td></tr>
      <tr><td><strong>Cost per Participant</strong></td><td>$${(totalCost/participants).toFixed(2)}</td></tr>
      <tr><td><strong>Total QALYs</strong></td><td>${totalQALYs.toFixed(2)}</td></tr>
      <tr><td><strong>Monetized Benefits</strong></td><td>$${monetized.toLocaleString()}</td></tr>
      <tr><td><strong>Net Benefit</strong></td><td>$${netBenefit.toLocaleString()}</td></tr>
    </table>
  `;
  drawCBAChart(totalCost,totalBenefit,netBenefit);
}
let cbaChart= null;
function drawCBAChart(c,b,n){
  const ctx= document.getElementById("cbaChart").getContext("2d");
  if(cbaChart) cbaChart.destroy();
  cbaChart= new Chart(ctx,{
    type:"bar",
    data:{
      labels:["Total Cost","Total Benefit","Net Benefit"],
      datasets:[{
        label:"USD",
        data:[c,b,n],
        backgroundColor:["#c0392b","#27ae60","#f1c40f"]
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      scales:{y:{beginAtZero:true}},
      plugins:{
        title:{
          display:true,
          text:"Cost-Benefit Analysis",
          font:{ size:16 }
        }
      }
    }
  });
}

/** WTP for discrete diffs + +1 increments in continuous with cost slope= -0.07 */
const wtpDiffs = {
  "TrainingLevel__Frontline": 0.6,
  "TrainingLevel__Intermediate": 0.3,
  "DeliveryMethod__In-Person": 0.5,
  "DeliveryMethod__Hybrid": 0.4,
  "Accreditation__National": 0.4,
  "Accreditation__International": 0.8,
  "Location__State-Level": 0.3,
  "Location__Regional Centers": 0.2,
  // continuous +1 increments
  // note: cohort slope= +0.08 => difference in utility for +1 in "cohort"? 
  "CohortSize__+1": 0.08,
  // cost slope= -0.07 => difference in utility for +1 => -0.07
  "Cost__+1": -0.07
};

function computeStaticWTP(){
  // We'll define costSlope = -0.07 => ratio= diff / -( -0.07 )= diff/ 0.07 => diff* (1/0.07=14.2857)
  // Then multiply by e.g. 1000 if we want bigger scale
  const arr= [];
  const costSlope= -0.07;
  for(let key in wtpDiffs){
    const diff= wtpDiffs[key];
    // ratio= diff / -(costSlope)= diff / 0.07 => diff*(1/0.07)
    const ratio= diff/ -costSlope;
    // scale it up by 1000
    arr.push({
      label: key,
      wtp: ratio*1000,
      se: Math.abs(ratio*1000)*0.1
    });
  }
  return arr;
}

function renderWTPChart(){
  const ctx= document.getElementById("wtpChartMain").getContext("2d");
  if(!ctx) return;
  if(wtpChart) wtpChart.destroy();

  const arr= computeStaticWTP();
  const labels= arr.map(d=> d.label);
  const vals= arr.map(d=> d.wtp);
  const errs= arr.map(d=> d.se);

  wtpChart= new Chart(ctx, {
    type:"bar",
    data:{
      labels,
      datasets:[{
        label:"WTP (USD)",
        data: vals,
        backgroundColor: vals.map(v=> v>=0?"rgba(52,152,219,0.6)":"rgba(231,76,60,0.6)"),
        borderColor: vals.map(v=> v>=0?"rgba(52,152,219,1)":"rgba(231,76,60,1)"),
        borderWidth:1,
        error: errs
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      scales:{
        y:{ beginAtZero:true}
      },
      plugins:{
        legend:{ display:false},
        title:{
          display:true,
          text:"WTP (USD) - Non-Ref Levels & +1 increments",
          font:{ size:16}
        }
      }
    },
    plugins:[{
      id:"errorbars",
      afterDraw: chart=>{
        const { ctx, scales:{ y }}= chart;
        chart.getDatasetMeta(0).data.forEach((bar, i)=>{
          const xC= bar.x;
          const val= vals[i];
          const se= errs[i];
          if(typeof se==="number"){
            const top= y.getPixelForValue(val+se);
            const bot= y.getPixelForValue(val-se);
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle= "#000";
            ctx.lineWidth=1;
            ctx.moveTo(xC, top);
            ctx.lineTo(xC, bot);
            ctx.moveTo(xC-5, top);
            ctx.lineTo(xC+5, top);
            ctx.moveTo(xC-5, bot);
            ctx.lineTo(xC+5, bot);
            ctx.stroke();
            ctx.restore();
          }
        });
      }
    }]
  });
}

/** SCENARIOS mgmt */
let savedScenarios= [];
document.getElementById("save-scenario").addEventListener("click", ()=>{
  const sc= buildScenarioFromInputs();
  const fraction= computeUptakeFraction(sc)*100;
  sc.predictedUptake= fraction.toFixed(1);
  sc.netBenefit= currentNetBenefit.toFixed(2);
  sc.details= {...sc};
  sc.name= "Scenario "+ (savedScenarios.length+1);
  savedScenarios.push(sc);
  updateScenarioList();
  alert(`Scenario "${sc.name}" saved successfully.`);
});

function updateScenarioList(){
  const list= document.getElementById("saved-scenarios-list");
  list.innerHTML="";
  savedScenarios.forEach((s, idx)=>{
    const div= document.createElement("div");
    div.className= "list-group-item";
    div.innerHTML= `
      <strong>${s.name}</strong><br>
      <span>Training: ${s.details.trainingLevel}</span><br>
      <span>Delivery: ${s.details.deliveryMethod}</span><br>
      <span>Accreditation: ${s.details.accreditation}</span><br>
      <span>Location: ${s.details.location}</span><br>
      <span>Cohort: ${s.details.cohortSize}, Cost: $${s.details.cost_participant.toFixed(0)}</span><br>
      <span>Uptake: ${s.predictedUptake}%, Net Benefit: $${s.netBenefit}</span>
      <div>
        <button class="btn btn-sm btn-primary" onclick="loadScenario(${idx})">Load</button>
        <button class="btn btn-sm btn-danger" onclick="deleteScenario(${idx})">Delete</button>
      </div>
    `;
    list.appendChild(div);
  });
}
function loadScenario(i){
  const s= savedScenarios[i];
  document.querySelector(`input[name="training-level"][value="${s.trainingLevel}"]`).checked= true;
  document.querySelector(`input[name="delivery-method"][value="${s.deliveryMethod}"]`).checked= true;
  document.querySelector(`input[name="accreditation"][value="${s.accreditation}"]`).checked= true;
  document.querySelector(`input[name="location"][value="${s.location}"]`).checked= true;
  // set cohort slider
  document.getElementById("cohort-size").value= s.cohortSize;
  document.getElementById("cohort-size-value").textContent= s.cohortSize;
  // set cost slider
  // cost= 60 + (1440/250)* slider => slider= (cost-60)/(1440/250)
  const cost2slider= (s.cost_participant- 60)/ ((1500-60)/250);
  document.getElementById("costSliderUI").value= cost2slider;
  updateCostLabel(cost2slider);
}
function deleteScenario(i){
  if(confirm("Are you sure you want to delete this scenario?")){
    savedScenarios.splice(i,1);
    updateScenarioList();
  }
}

/** Export to PDF */
document.getElementById("export-pdf").addEventListener("click", ()=>{
  if(!savedScenarios.length){
    alert("No scenarios saved to export.");
    return;
  }
  const { jsPDF }= window.jspdf;
  const doc= new jsPDF({ unit:"mm", format:"a4"});
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
    doc.text(`Scenario ${idx+1}: ${sc.name}`,15,currentY); 
    currentY+=7;
    doc.setFontSize(12);
    doc.text(`Training: ${sc.trainingLevel}`,15,currentY); currentY+=5;
    doc.text(`Delivery: ${sc.deliveryMethod}`,15,currentY); currentY+=5;
    doc.text(`Accreditation: ${sc.accreditation}`,15,currentY); currentY+=5;
    doc.text(`Location: ${sc.location}`,15,currentY); currentY+=5;
    doc.text(`Cohort Size: ${sc.cohortSize}`,15,currentY); currentY+=5;
    doc.text(`Cost: $${sc.cost_participant.toFixed(0)}`,15,currentY); currentY+=5;
    doc.text(`Predicted Uptake: ${sc.predictedUptake}%`,15,currentY); currentY+=5;
    doc.text(`Net Benefit: $${sc.netBenefit}`,15,currentY);
    currentY+=10;
  });
  doc.save("Scenarios_Comparison.pdf");
});

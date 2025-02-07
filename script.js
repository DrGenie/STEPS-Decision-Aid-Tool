/****************************************************************************
 * SCRIPT.JS
 * Implementation details for STEPS tool with cost mapped from slider 0–250
 * to $60–$1500 internally. QALY scenarios: Low=0.01, Mod=0.05, High=0.08
 * for an India-specific placeholder. Tooltips are 0.8em, icons added.
 ****************************************************************************/

/** Default: Intro tab */
window.onload=function(){
  openTab("introTab", document.querySelector(".tablink"));
};

/** Tab switch */
function openTab(tabId, btn){
  const allTabs= document.getElementsByClassName("tabcontent");
  for(let t of allTabs){ t.style.display="none";}
  const allBtns= document.getElementsByClassName("tablink");
  for(let b of allBtns){
    b.classList.remove("active");
    b.setAttribute("aria-selected","false");
  }
  document.getElementById(tabId).style.display="block";
  btn.classList.add("active");
  btn.setAttribute("aria-selected","true");

  if(tabId==="wtpTab") renderWTPChart();
  if(tabId==="cbaTab") renderCostsBenefits();
}

/** Range for Cohort Size */
const cohortSlider= document.getElementById("cohort-size");
const cohortValUI= document.getElementById("cohort-size-value");
cohortValUI.textContent=cohortSlider.value;
cohortSlider.addEventListener("input",()=>{
  cohortValUI.textContent=cohortSlider.value;
});

/** Range for Cost but 0–250 => $60–$1500 */
const costSliderUI= document.getElementById("costSliderUI");
const costValueUI= document.getElementById("costValueUI");
function updateCostUI(val){
  // transform from slider [0..250] => cost [60..1500]
  const cost= 60 + ((1500-60)/250)* val;
  return cost;
}
costValueUI.textContent=`$${updateCostUI(costSliderUI.value).toFixed(0)}`;
costSliderUI.addEventListener("input",()=>{
  costValueUI.textContent= `$${updateCostUI(costSliderUI.value).toFixed(0)}`;
});

/** Discrete attribute coefficients + continuous slopes */
const coeffs={
  ASC:1.0,
  ASC_optout:0.3,
  // Discrete
  TrainingLevel:{ Frontline:0.6, Intermediate:0.3, Advanced:0.0 },
  DeliveryMethod:{ "In-Person":0.5,"Online":0.0,"Hybrid":0.4 },
  Accreditation:{ National:0.4, International:0.8, None:0.0 },
  Location:{ "State-Level":0.3,"Regional Centers":0.2,"District-Level":0.0 },
  // Continuous slopes
  CohortSizeSlope:-0.0008,  // for each +1 in cohort
  CostSlope:-0.0001         // for each +1 in cost (60..1500)
};

/** Basic cost/benefit placeholders by training level */
const costBenefitEstimates={
  Frontline:{cost:250000, benefit:800000 },
  Intermediate:{cost:450000, benefit:1400000},
  Advanced:{cost:650000, benefit:2000000}
};

/** Build scenario from inputs */
function buildScenarioFromInputs(){
  const trainingLevel= document.querySelector('input[name="training-level"]:checked').value;
  const deliveryMethod= document.querySelector('input[name="delivery-method"]:checked').value;
  const accreditation= document.querySelector('input[name="accreditation"]:checked').value;
  const location= document.querySelector('input[name="location"]:checked').value;
  const cSize= parseInt(document.getElementById("cohort-size").value,10);
  // map cost from slider
  const cVal= parseInt(costSliderUI.value,10);
  const cost= 60 + ((1500-60)/250)* cVal;

  return {
    trainingLevel,
    deliveryMethod,
    accreditation,
    location,
    cohortSize:cSize,
    cost_participant: cost
  };
}

/** Logit model: no random noise */
function computeUptakeFraction(sc){
  let U= coeffs.ASC
    + coeffs.TrainingLevel[sc.trainingLevel]
    + coeffs.DeliveryMethod[sc.deliveryMethod]
    + coeffs.Accreditation[sc.accreditation]
    + coeffs.Location[sc.location];

  // continuous slopes
  U += coeffs.CohortSizeSlope* sc.cohortSize;
  U += coeffs.CostSlope* sc.cost_participant;

  const altExp= Math.exp(U);
  const optExp= Math.exp(coeffs.ASC_optout);
  return altExp/(altExp+ optExp);
}

/** "Calculate & View Results" */
document.getElementById("view-results").addEventListener("click",()=>{
  const sc= buildScenarioFromInputs();
  const frac= computeUptakeFraction(sc);
  let predictedUptake= frac*100;
  predictedUptake= Math.min(100, Math.max(0,predictedUptake));

  let recMsg="";
  if(predictedUptake<30){
    recMsg="Uptake is low. Consider cost reduction or expansions.";
  } else if(predictedUptake<70){
    recMsg="Moderate uptake. Room for further improvement.";
  } else {
    recMsg="High uptake. This scenario appears effective.";
  }
  showModalResults(`
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
  currentNetBenefit= totalBenefit- totalCost;

  renderCostsBenefits();
});
function showModalResults(html){
  document.getElementById("modal-results").innerHTML= html;
  document.getElementById("resultsModal").style.display="block";
}
function closeModal(){
  document.getElementById("resultsModal").style.display="none";
}

/** uptake donut chart */
let uptakeChart= null;
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
          font:{size:16}
        }
      }
    }
  });
}

/** cost-benefit tab */
let cbaChart= null;
function renderCostsBenefits(){
  const cbaDiv= document.getElementById("cba-summary");
  if(!cbaDiv)return;

  const sc= buildScenarioFromInputs();
  const frac= computeUptakeFraction(sc);
  const predictedUptake= frac*100;
  const participants= (predictedUptake/100)* 250;

  const baseCB= costBenefitEstimates[sc.trainingLevel] || costBenefitEstimates.Advanced;
  const totalCost= sc.cohortSize* baseCB.cost;
  const totalBenefit= sc.cohortSize* baseCB.benefit;
  const netBenefit= totalBenefit- totalCost;

  const qalySelect= document.getElementById("qalySelect").value;
  let qVal=0.05;
  if(qalySelect==="low") qVal=0.01;
  else if(qalySelect==="high") qVal=0.08;
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
      <tr><td><strong>Net Benefit</strong></td><td>$${netBenefit.toLocaleString()}</td></tr>
    </table>
  `;
  drawCBAChart(totalCost, totalBenefit, netBenefit);
}
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
          font:{size:16}
        }
      }
    }
  });
}

/** WTP: discrete + continuous increments. We'll define 4 discrete diffs + 2 continuous +1 increments. */
const wtpDiffs = {
  // Discrete from references
  "TrainingLevel__Frontline": 0.6,
  "TrainingLevel__Intermediate": 0.3,

  "DeliveryMethod__In-Person": 0.5,
  "DeliveryMethod__Hybrid": 0.4,

  "Accreditation__National": 0.4,
  "Accreditation__International": 0.8,

  "Location__State-Level": 0.3,
  "Location__Regional Centers": 0.2,

  // Continuous +1 increments
  "CohortSize__+1": -0.0008,
  "Cost__+1": -0.0001
};

/** We define cost slope as the attribute "Cost__+1"? => -0.0001 => ratio= diff/ -(-0.0001)= diff/ 0.0001 => diff*10000 => scaled more if needed */
function computeStaticWTP(){
  const arr=[];
  const costSlope= -0.0001; 
  for(let key in wtpDiffs){
    const diff= wtpDiffs[key];
    const ratio= diff/ -(costSlope);  // = diff/ 0.0001 => diff* 10000
    arr.push({
      label:key,
      wtp: ratio*1000,  // scale further if we want bigger
      se: Math.abs(ratio*1000)*0.1
    });
  }
  return arr;
}

let wtpChart= null;
function renderWTPChart(){
  const ctx= document.getElementById("wtpChartMain").getContext("2d");
  if(!ctx)return;
  if(wtpChart) wtpChart.destroy();

  const dataArr= computeStaticWTP();
  const labels= dataArr.map(d=> d.label);
  const vals= dataArr.map(d=> d.wtp);
  const errs= dataArr.map(d=> d.se);

  wtpChart= new Chart(ctx,{
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
      scales:{y:{beginAtZero:true}},
      plugins:{
        legend:{display:false},
        title:{
          display:true,
          text:"Willingness to Pay (USD) - Non-ref & +1 increments",
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
          const v= vals[i];
          const se= errs[i];
          if(typeof se==="number"){
            const top= y.getPixelForValue(v+se);
            const bot= y.getPixelForValue(v-se);
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle="#000";
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

/** SCENARIOS management */
let savedScenarios=[];
document.getElementById("save-scenario").addEventListener("click",()=>{
  const sc= buildScenarioFromInputs();
  const frac= computeUptakeFraction(sc)*100;
  sc.predictedUptake= frac.toFixed(1);
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
  savedScenarios.forEach((s, idx)=>{
    const div= document.createElement("div");
    div.className="list-group-item";
    div.innerHTML=`
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
  document.getElementById("cohort-size").value= s.cohortSize;
  document.getElementById("cohort-size-value").textContent= s.cohortSize;
  // map cost to slider
  // cost = 60 + ( (1500-60)/250)* slider => slider= (cost-60)/(1440/250)
  const cost2slider= (s.cost_participant -60)/ ((1500-60)/250);
  document.getElementById("costSliderUI").value= cost2slider;
  document.getElementById("costValueUI").textContent= `$${s.cost_participant.toFixed(0)}`;
}

function deleteScenario(i){
  if(confirm("Are you sure you want to delete this scenario?")){
    savedScenarios.splice(i,1);
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
    doc.text(`Scenario ${idx+1}: ${sc.name}`,15,currentY);
    currentY+=7;
    doc.setFontSize(12);
    doc.text(`Training: ${sc.trainingLevel}`,15,currentY); currentY+=5;
    doc.text(`Delivery: ${sc.deliveryMethod}`,15,currentY); currentY+=5;
    doc.text(`Accreditation: ${sc.accreditation}`,15,currentY); currentY+=5;
    doc.text(`Location: ${sc.location}`,15,currentY); currentY+=5;
    doc.text(`Cohort: ${sc.cohortSize}, Cost: $${sc.cost_participant.toFixed(0)}`,15,currentY); currentY+=5;
    doc.text(`Predicted Uptake: ${sc.predictedUptake}%`,15,currentY); currentY+=5;
    doc.text(`Net Benefit: $${sc.netBenefit}`,15,currentY); currentY+=10;
  });
  doc.save("Scenarios_Comparison.pdf");
});

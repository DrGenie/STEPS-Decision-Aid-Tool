/****************************************************************************
 * SCRIPT.JS
 * Minimal tab switch approach so that tabs remain active:
 *   function openTab(tabId, btn) {
 *     // hide all tabcontents, remove .active
 *     // show the one, add .active
 *   }
 * 
 * - Discrete attributes (4) each with references
 * - 2 continuous: CohortSize(500–2000) & Cost(0..250 => $60..$1500)
 * - costSlope=-0.07, cohortSlope=+0.08
 * - QALY scenario: Low=0.01, Mod=0.05, High=0.08
 ****************************************************************************/

/** Minimal tab function to ensure tabs remain clickable */
function openTab(tabId, clickedBtn){
  const tabContents= document.getElementsByClassName("tabcontent");
  for(let i=0; i<tabContents.length; i++){
    tabContents[i].style.display= "none";
  }
  const tabButtons= document.getElementsByClassName("tablink");
  for(let j=0; j<tabButtons.length; j++){
    tabButtons[j].classList.remove("active");
  }
  document.getElementById(tabId).style.display="block";
  clickedBtn.classList.add("active");
}

/** Sliders for Cohort & Cost */
const cohortSlider= document.getElementById("cohort-size");
const cohortVal= document.getElementById("cohort-size-value");
cohortVal.textContent= cohortSlider.value;
cohortSlider.oninput= function(){
  cohortVal.textContent= this.value;
};

const costSliderUI= document.getElementById("costSliderUI");
const costValUI= document.getElementById("costValueUI");
function mapCost(val){
  return 60 + ((1500-60)/250)* val;
}
function updateCostUI(val){
  costValUI.textContent= `$${mapCost(val).toFixed(0)} (approx.)`;
}
updateCostUI(costSliderUI.value);
costSliderUI.oninput= function(){
  updateCostUI(this.value);
};

/** Coeffs: -0.07 cost slope, +0.08 cohort slope */
const coeffs={
  ASC:1.0,
  ASC_optout: 0.3,
  // discrete
  TrainingLevel:{ Frontline:0.6, Intermediate:0.3, Advanced:0.0 },
  DeliveryMethod:{ "In-Person":0.5, "Online":0.0, "Hybrid":0.4 },
  Accreditation:{ National:0.4, International:0.8, None:0.0 },
  Location:{ "State-Level":0.3, "Regional Centers":0.2, "District-Level":0.0 },
  // continuous
  CohortSizeSlope:0.08,
  CostSlope:-0.07
};

/** costBenefit placeholders */
const costBenefit={
  Frontline:{ cost:250000, benefit:800000 },
  Intermediate:{ cost:450000, benefit:1400000 },
  Advanced:{ cost:650000, benefit:2000000 }
};

/** Build scenario */
function buildScenario(){
  const trainingL= document.querySelector('input[name="training-level"]:checked').value;
  const deliveryM= document.querySelector('input[name="delivery-method"]:checked').value;
  const accreditation= document.querySelector('input[name="accreditation"]:checked').value;
  const location= document.querySelector('input[name="location"]:checked').value;

  const cSize= parseInt(cohortSlider.value,10);
  const cVal= parseInt(costSliderUI.value,10);
  const cMapped= mapCost(cVal);

  return {
    trainingL, deliveryM, accreditation, location,
    cohortSize:cSize, cost_participant:cMapped
  };
}

/** Compute logit fraction */
function computeUptake(sc){
  let U= coeffs.ASC
   + coeffs.TrainingLevel[sc.trainingL]
   + coeffs.DeliveryMethod[sc.deliveryM]
   + coeffs.Accreditation[sc.accreditation]
   + coeffs.Location[sc.location];

  U += coeffs.CohortSizeSlope* sc.cohortSize;
  U += coeffs.CostSlope* sc.cost_participant;

  const altExp= Math.exp(U);
  const optExp= Math.exp(coeffs.ASC_optout);
  return altExp/(altExp+optExp);
}

/** On button click => show results in modal + update global stats */
const viewBtn= document.getElementById("view-results");
viewBtn.addEventListener("click", ()=>{
  const sc= buildScenario();
  let fraction= computeUptake(sc);
  let uptakePct= fraction*100;
  uptakePct= Math.max(0, Math.min(100, uptakePct));

  let msg="";
  if(uptakePct<30) msg="Uptake is low. Consider adjusting cost or expansions.";
  else if(uptakePct<70) msg="Moderate uptake. Possibly refine scenario.";
  else msg="High uptake. This scenario is effective.";

  document.getElementById("modal-results").innerHTML= `
    <p><strong>Predicted Program Uptake:</strong> ${uptakePct.toFixed(1)}%</p>
    <p>${msg}</p>
  `;
  document.getElementById("resultsModal").style.display="block";

  drawUptake(uptakePct);

  // cost & benefit
  const base= costBenefit[sc.trainingL]|| costBenefit.Advanced;
  const totalCost= sc.cohortSize* base.cost;
  const totalBenefit= sc.cohortSize* base.benefit;
  currentUptake= uptakePct;
  currentCost= totalCost;
  currentBenefit= totalBenefit;
  currentNet= totalBenefit-totalCost;

  renderCosts();
});

/** close modal */
function closeModal(){
  document.getElementById("resultsModal").style.display="none";
}

/** Doughnut for uptake */
let uptakeChart=null;
function drawUptake(val){
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
          text:`Predicted Uptake: ${val.toFixed(1)}%`,
          font:{size:16}
        }
      }
    }
  });
}

/** cost & benefit tab => global stats */
let currentUptake=0, currentCost=0, currentBenefit=0, currentNet=0;
let cbaChart=null;
function renderCosts(){
  const cbaDiv= document.getElementById("cba-summary");
  if(!cbaDiv)return;
  const sc= buildScenario();
  const fraction= computeUptake(sc);
  const uptakePct= fraction*100;
  const participants= (uptakePct/100)* 250;

  const base= costBenefit[sc.trainingL]|| costBenefit.Advanced;
  const totalC= sc.cohortSize* base.cost;
  const totalB= sc.cohortSize* base.benefit;
  const netB= totalB-totalC;

  let qVal=0.05;
  const qSel= document.getElementById("qalySelect");
  if(qSel.value==="low") qVal=0.01;
  else if(qSel.value==="high") qVal=0.08;
  const totalQ= participants*qVal;
  const monetized= totalQ*50000;

  cbaDiv.innerHTML= `
    <table>
      <tr><td><strong>Uptake (%)</strong></td><td>${uptakePct.toFixed(1)}%</td></tr>
      <tr><td><strong>Participants</strong></td><td>${participants.toFixed(0)}</td></tr>
      <tr><td><strong>Total Training Cost</strong></td><td>$${totalC.toLocaleString()}</td></tr>
      <tr><td><strong>Cost per Participant</strong></td><td>$${(totalC/participants).toFixed(2)}</td></tr>
      <tr><td><strong>Total QALYs</strong></td><td>${totalQ.toFixed(2)}</td></tr>
      <tr><td><strong>Monetized Benefits</strong></td><td>$${monetized.toLocaleString()}</td></tr>
      <tr><td><strong>Net Benefit</strong></td><td>$${netB.toLocaleString()}</td></tr>
    </table>
  `;
  drawCBAChart(totalC,totalB, netB);
}

/** cba bar */
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

/** WTP => discrete + continuous increments with costSlope=-0.07, cohort=+0.08 */
let wtpChart=null;
function renderWTPChart(){
  const ctx= document.getElementById("wtpChartMain").getContext("2d");
  if(!ctx)return;
  if(wtpChart) wtpChart.destroy();

  // define diffs
  const wtpDiffs={
    "TrainingLevel__Frontline":0.6,
    "TrainingLevel__Intermediate":0.3,
    "DeliveryMethod__In-Person":0.5,
    "DeliveryMethod__Hybrid":0.4,
    "Accreditation__National":0.4,
    "Accreditation__International":0.8,
    "Location__State-Level":0.3,
    "Location__Regional Centers":0.2,
    // continuous +1 => cohort= +0.08, cost= -0.07
    "CohortSize__+1": 0.08,
    "Cost__+1": -0.07
  };

  const costSlope= -0.07;
  const arr=[];
  for(let key in wtpDiffs){
    const diff= wtpDiffs[key];
    // ratio= diff / -(costSlope)= diff/ 0.07 => diff*(1/0.07)
    const ratio= diff/ -(costSlope);
    // multiply by 1000 for display
    arr.push({
      label:key,
      wtp: ratio*1000,
      se: Math.abs(ratio*1000)*0.1
    });
  }
  const labels= arr.map(d=> d.label);
  const vals= arr.map(d=> d.wtp);
  const errs= arr.map(d=> d.se);

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
          text:"WTP (USD) - Non-Ref +1 increments",
          font:{ size:16}
        }
      }
    },
    plugins:[{
      // vertical error bars
      id:"errorbars",
      afterDraw: chart=>{
        const { ctx, scales:{ y }}= chart;
        chart.getDatasetMeta(0).data.forEach((bar,i)=>{
          const xC= bar.x;
          const val= vals[i];
          const se= errs[i];
          if(typeof se==="number"){
            const top= y.getPixelForValue(val+se);
            const bot= y.getPixelForValue(val-se);
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

/** SCENARIOS */
let savedScenarios=[];
document.getElementById("save-scenario").addEventListener("click", ()=>{
  const sc= buildScenario();
  const fraction= computeUptake(sc)*100;
  sc.predictedUptake= fraction.toFixed(1);
  sc.netBenefit= currentNet.toFixed(2);
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
    div.className="list-group-item";
    div.innerHTML= `
      <strong>${s.name}</strong><br>
      <span>Training: ${s.details.trainingL}</span><br>
      <span>Delivery: ${s.details.deliveryM}</span><br>
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

function loadScenario(index){
  const s= savedScenarios[index];
  document.querySelector(`input[name="training-level"][value="${s.trainingL}"]`).checked=true;
  document.querySelector(`input[name="delivery-method"][value="${s.deliveryM}"]`).checked=true;
  document.querySelector(`input[name="accreditation"][value="${s.accreditation}"]`).checked=true;
  document.querySelector(`input[name="location"][value="${s.location}"]`).checked=true;

  document.getElementById("cohort-size").value= s.cohortSize;
  document.getElementById("cohort-size-value").textContent= s.cohortSize;

  const costMapped= s.cost_participant;
  const sliderVal= (costMapped-60)/((1500-60)/250);
  document.getElementById("costSliderUI").value= sliderVal;
  updateCostUI(sliderVal);
}

function deleteScenario(index){
  if(confirm("Delete this scenario?")){
    savedScenarios.splice(index,1);
    updateScenarioList();
  }
}

/** Export PDF */
document.getElementById("export-pdf").addEventListener("click", ()=>{
  if(!savedScenarios.length){
    alert("No scenarios saved to export.");
    return;
  }
  const { jsPDF }= window.jspdf;
  const doc= new jsPDF({ unit:"mm", format:"a4"});
  const pageWidth= doc.internal.pageSize.getWidth();
  let yPos=15;

  doc.setFontSize(16);
  doc.text("STEPS - Scenarios Comparison", pageWidth/2, yPos, {align:"center"});
  yPos+=10;

  savedScenarios.forEach((s, idx)=>{
    if(yPos+70> doc.internal.pageSize.getHeight()-15){
      doc.addPage();
      yPos=15;
    }
    doc.setFontSize(14);
    doc.text(`Scenario ${idx+1}: ${s.name}`, 15, yPos);
    yPos+=7;
    doc.setFontSize(12);
    doc.text(`Training: ${s.trainingL}`, 15, yPos); yPos+=5;
    doc.text(`Delivery: ${s.deliveryM}`, 15, yPos); yPos+=5;
    doc.text(`Accreditation: ${s.accreditation}`, 15, yPos); yPos+=5;
    doc.text(`Location: ${s.location}`, 15, yPos); yPos+=5;
    doc.text(`Cohort: ${s.cohortSize}, Cost: $${s.cost_participant.toFixed(0)}`, 15, yPos); yPos+=5;
    doc.text(`Predicted Uptake: ${s.predictedUptake}%`, 15, yPos); yPos+=5;
    doc.text(`Net Benefit: $${s.netBenefit}`, 15, yPos); yPos+=10;
  });
  doc.save("Scenarios_Comparison.pdf");
});

/****************************************************************************
 * SCRIPT.JS
 * 1) Tab switching
 * 2) Range slider label updates
 * 3) Actual DCE Coefficients for main scenario (no cost-of-living multipliers)
 * 4) WTP chart logic
 * 5) Probability chart logic
 * 6) Cost–benefit chart logic
 * 7) Scenario saving & PDF export
 ****************************************************************************/

/** DCE Coefficients */
const mainCoefficients = {
  ASC_mean: -0.112,
  ASC_sd: 1.161,
  ASC_optout: 0.131,

  // Training level (Ref=Intermediate =>0)
  training_advanced: 0.527,
  training_frontline: -0.349,

  // DeliveryMethod (Ref=Online =>0)
  delivery_inperson: 0.426,
  delivery_hybrid: 0.189,

  // Accreditation (Ref=None =>0)
  accreditation_international: 0.617,
  accreditation_national: 0.236,

  // Location (Ref=District =>0)
  location_statelevel: 0.385,
  location_regional: 0.113,

  // Continuous slopes
  cohortsize: 0.059,
  cost: -0.036
};

/** On DOM load, initialize tabs & default to introduction */
document.addEventListener("DOMContentLoaded", () => {
  const tabButtons = document.querySelectorAll(".tablink");
  tabButtons.forEach(btn => {
    btn.addEventListener("click", function(){
      openTab(this.getAttribute("data-tab"), this);
    });
  });
  // default tab
  openTab("introTab", document.querySelector(".tablink"));
});

/** Tab switching function */
function openTab(tabId, clickedBtn){
  const allTabs = document.querySelectorAll(".tabcontent");
  allTabs.forEach(tab => tab.style.display="none");
  const allBtns = document.querySelectorAll(".tablink");
  allBtns.forEach(b => {
    b.classList.remove("active");
    b.setAttribute("aria-selected","false");
  });
  document.getElementById(tabId).style.display="block";
  clickedBtn.classList.add("active");
  clickedBtn.setAttribute("aria-selected","true");
}

/** Range slider (cost) label updates in the "Inputs" tab */
function updateCostDisplay(val){
  document.getElementById("costLabel").textContent = val;
}
/** Another slider: "Cohort Size" label updates */
function updateCohortDisplay(val){
  document.getElementById("cohortLabel").textContent = val;
}
/** Another cost slider approach => e.g. costSliderFETP */
function updateFETPCostDisplay(val){
  document.getElementById("costLabelFETP").textContent = val;
}

/***************************************************************************
 * Build scenario from user inputs
 ***************************************************************************/
function buildFETPScenario(){
  let trainingVal= "intermediate";
  if(document.getElementById("frontlineCheck").checked) trainingVal= "frontline";
  if(document.getElementById("intermediateCheck").checked) trainingVal= "intermediate";
  if(document.getElementById("advancedCheck") && document.getElementById("advancedCheck").checked) trainingVal= "advanced";

  let deliveryVal= "online";
  if(document.getElementById("inpersonCheck").checked) deliveryVal= "inperson";
  if(document.getElementById("hybridCheck").checked) deliveryVal= "hybrid";

  let accreditationVal= "none";
  if(document.getElementById("nationalCheck").checked) accreditationVal= "national";
  if(document.getElementById("internationalCheck").checked) accreditationVal= "international";

  let locationVal= "district";
  if(document.getElementById("stateCheck").checked) locationVal= "state";
  if(document.getElementById("regionalCheck").checked) locationVal= "regional";

  let cSize= 100;
  if(document.getElementById("cohortSlider")){
    cSize= parseInt(document.getElementById("cohortSlider").value,10);
  }

  let costVal= 50;
  if(document.getElementById("costSliderFETP")){
    costVal= parseInt(document.getElementById("costSliderFETP").value,10);
  }

  return {
    trainingLevel: trainingVal,
    deliveryMethod: deliveryVal,
    accreditation: accreditationVal,
    location: locationVal,
    cohortSize: cSize,
    costSliderVal: costVal
  };
}

/***************************************************************************
 * computeUptake( scenario ) using mainCoefficients
 ***************************************************************************/
function computeFETPUptake(sc){
  let U = mainCoefficients.ASC_mean;

  // training
  if(sc.trainingLevel==="advanced")   U += mainCoefficients.training_advanced;
  if(sc.trainingLevel==="frontline") U += mainCoefficients.training_frontline;
  // else intermediate => 0

  // delivery
  if(sc.deliveryMethod==="inperson") U += mainCoefficients.delivery_inperson;
  if(sc.deliveryMethod==="hybrid")   U += mainCoefficients.delivery_hybrid;
  // else => online => 0

  // accreditation
  if(sc.accreditation==="international") U += mainCoefficients.accreditation_international;
  if(sc.accreditation==="national")      U += mainCoefficients.accreditation_national;
  // else => none => 0

  // location
  if(sc.location==="state")    U += mainCoefficients.location_statelevel;
  if(sc.location==="regional") U += mainCoefficients.location_regional;

  // continuous
  U += mainCoefficients.cohortsize * sc.cohortSize;
  U += mainCoefficients.cost * sc.costSliderVal; // each step => -0.036 => negative effect

  const altExp = Math.exp(U);
  const optExp = Math.exp(mainCoefficients.ASC_optout);
  return altExp/(altExp+ optExp);
}

/***************************************************************************
 * "Calculate & View Results" from the Inputs tab
 ***************************************************************************/
function openFETPScenario(){
  const scenario= buildFETPScenario();
  // compute uptake fraction
  const fraction= computeFETPUptake(scenario);
  const uptakePct= fraction*100;
  let msg="";
  if(uptakePct<30) msg="Uptake is low. Consider lowering cost or choosing more appealing accreditation/delivery.";
  else if(uptakePct<70) msg="Moderate uptake. Further improvements might help.";
  else msg="High uptake. This configuration is quite effective.";

  const modalR= document.getElementById("modalResults");
  modalR.innerHTML=`
    <h4>Calculation Results</h4>
    <p><strong>Predicted Uptake:</strong> ${uptakePct.toFixed(2)}%</p>
    <p>${msg}</p>
  `;
  document.getElementById("resultModal").style.display="block";

  // Also update Probability Chart & cost–benefit
  renderFETPProbChart();
  renderFETPCostsBenefits();
}

/** Close modal function */
function closeModal(){
  document.getElementById("resultModal").style.display="none";
}

/***************************************************************************
 * WTP CHART with error bars
 ***************************************************************************/
let wtpChart= null;
function renderWTPChart(){
  const ctx= document.getElementById("wtpChartMain").getContext("2d");
  if(!ctx) return;
  if(wtpChart) wtpChart.destroy();

  // We'll create label => WTP from your new coefficients 
  // For demonstration, we map them:
  const labels= [
    "Training: Advanced","Training: Frontline",
    "Delivery: In-person","Delivery: Hybrid",
    "Accred:International","Accred:National",
    "Location:State","Location:Regional",
    "Cohort +1","Cost +1"
  ];
  // ratio => (coefficient)/ -( costSlope=-0.036 ) => * say 100 to get $ scale
  function ratio(coef){ return (coef / -mainCoefficients.cost)*100; }

  const vals= [
    ratio(mainCoefficients.training_advanced),
    ratio(mainCoefficients.training_frontline),
    ratio(mainCoefficients.delivery_inperson),
    ratio(mainCoefficients.delivery_hybrid),
    ratio(mainCoefficients.accreditation_international),
    ratio(mainCoefficients.accreditation_national),
    ratio(mainCoefficients.location_statelevel),
    ratio(mainCoefficients.location_regional),
    ratio(mainCoefficients.cohortsize),
    1 // for "Cost +1" => typically negative WTP, but example
  ];
  const errs= vals.map(v=> Math.abs(v*0.1));

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
      scales:{ y:{ beginAtZero:true }},
      plugins:{
        legend:{ display:false },
        title:{
          display:true,
          text:"WTP (USD) for FETP Attributes",
          font:{ size:16 }
        }
      }
    },
    plugins:[{
      id:"errorbars",
      afterDraw: chart=>{
        const { ctx, scales:{ y } }= chart;
        chart.getDatasetMeta(0).data.forEach((bar,i)=>{
          const xCenter= bar.x;
          const val= vals[i];
          const se= errs[i];
          if(typeof se==="number"){
            const top= y.getPixelForValue(val+se);
            const bottom= y.getPixelForValue(val-se);
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle="#000";
            ctx.lineWidth=1;
            ctx.moveTo(xCenter, top);
            ctx.lineTo(xCenter, bottom);
            ctx.moveTo(xCenter-5, top);
            ctx.lineTo(xCenter+5, top);
            ctx.moveTo(xCenter-5, bottom);
            ctx.lineTo(xCenter+5, bottom);
            ctx.stroke();
            ctx.restore();
          }
        });
      }
    }]
  });
}

/***************************************************************************
 * Probability Chart (doughnut)
 ***************************************************************************/
let probChartFETP= null;
function renderFETPProbChart(){
  const sc= buildFETPScenario();
  if(!sc)return;
  const fraction= computeFETPUptake(sc);
  const pct= fraction*100;

  const ctx= document.getElementById("probChartFETP").getContext("2d");
  if(probChartFETP) probChartFETP.destroy();
  probChartFETP= new Chart(ctx,{
    type:"doughnut",
    data:{
      labels:["Uptake","Non-Uptake"],
      datasets:[{
        data:[pct,100-pct],
        backgroundColor:["#28a745","#dc3545"]
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        title:{
          display:true,
          text:`Predicted Uptake: ${pct.toFixed(2)}%`,
          font:{ size:16}
        }
      }
    }
  });
}

/***************************************************************************
 * Cost-Benefit
 ***************************************************************************/
let cbaFETPChart= null;
function renderFETPCostsBenefits(){
  const sc= buildFETPScenario();
  const frac= computeFETPUptake(sc);
  const uptakeVal= frac*100;
  const participants= 250* frac;

  // QALY scenario
  let qVal=0.05;
  if(document.getElementById("qalyFETPSelect")){
    const sel= document.getElementById("qalyFETPSelect").value;
    if(sel==="low") qVal=0.01;
    else if(sel==="high") qVal=0.08;
  }
  // Example cost logic => costVal => each step => $10 => simplified
  const totalCost= sc.costSliderVal * participants * 10;
  const totalQALY= participants* qVal;
  const monetized= totalQALY* 50000;
  const netB= monetized- totalCost;

  const resultsDiv= document.getElementById("costsFETPResults");
  if(!resultsDiv)return;
  resultsDiv.innerHTML=`
    <div class="calculation-info">
      <p><strong>Uptake:</strong> ${uptakeVal.toFixed(2)}%</p>
      <p><strong>Participants:</strong> ${participants.toFixed(0)}</p>
      <p><strong>Total Training Cost:</strong> $${totalCost.toFixed(2)}</p>
      <p><strong>Cost per Participant:</strong> $${(totalCost/participants).toFixed(2)}</p>
      <p><strong>Total QALYs:</strong> ${totalQALY.toFixed(2)}</p>
      <p><strong>Monetised Benefits:</strong> $${monetized.toLocaleString()}</p>
      <p><strong>Net Benefit:</strong> $${netB.toLocaleString()}</p>
    </div>
    <div class="chart-box">
      <h3>Cost-Benefit Analysis</h3>
      <canvas id="cbaFETPChart"></canvas>
    </div>
  `;
  const ctx= document.getElementById("cbaFETPChart").getContext("2d");
  if(cbaFETPChart) cbaFETPChart.destroy();
  cbaFETPChart= new Chart(ctx,{
    type:"bar",
    data:{
      labels:["Total Cost","Monetised Benefits","Net Benefit"],
      datasets:[{
        label:"USD",
        data:[totalCost,monetized,netB],
        backgroundColor:["#c0392b","#27ae60","#f1c40f"]
      }]
    },
    options:{
      responsive:true,
      scales:{ y:{ beginAtZero:true }},
      plugins:{
        title:{
          display:true,
          text:"Cost-Benefit Analysis (FETP)",
          font:{ size:16}
        },
        legend:{display:false}
      }
    }
  });
}

/** Toggling cost & benefit breakdown sections */
function toggleFETPCostBreakdown(){
  const box= document.getElementById("detailedFETPCostBreakdown");
  if(!box)return;
  box.style.display= box.style.display==="none"?"flex":"none";
}
function toggleFETPBenefitsAnalysis(){
  const box= document.getElementById("detailedFETPBenefitsAnalysis");
  if(!box)return;
  box.style.display= box.style.display==="none"?"flex":"none";
}

/***************************************************************************
 * Scenario Saving & PDF Export
 ***************************************************************************/
let savedFETPScenarios=[];
function saveFETPScenario(){
  const scenario= buildFETPScenario();
  const fraction= computeFETPUptake(scenario);
  const uptakePct= fraction*100;
  scenario.uptake= uptakePct.toFixed(2);

  // Example net benefit
  const netB= (uptakePct*1000).toFixed(2);
  scenario.netBenefit= netB;

  scenario.name= `FETP Scenario ${savedFETPScenarios.length+1}`;
  savedFETPScenarios.push(scenario);

  const tableBody= document.querySelector("#FETPScenarioTable tbody");
  const row= document.createElement("tr");
  row.innerHTML=`
    <td>${scenario.name}</td>
    <td>$${scenario.costSliderVal}</td>
    <td>${scenario.deliveryMethod}</td>
    <td>${scenario.accreditation}</td>
    <td>${scenario.location}</td>
    <td>${scenario.trainingLevel}</td>
    <td>${scenario.cohortSize}</td>
    <td>${scenario.uptake}%</td>
    <td>$${scenario.netBenefit}</td>
  `;
  tableBody.appendChild(row);
  alert(`"${scenario.name}" saved successfully.`);
}

function exportFETPComparison(){
  if(!savedFETPScenarios.length){
    alert("No FETP scenarios saved.");
    return;
  }
  const { jsPDF }= window.jspdf;
  const doc= new jsPDF({ unit:"mm", format:"a4"});
  let yPos=15;

  doc.setFontSize(16);
  doc.text("FETP Scenarios Comparison",105,yPos,{align:"center"});
  yPos+=10;

  savedFETPScenarios.forEach((sc,idx)=>{
    if(yPos+60> doc.internal.pageSize.getHeight()-15){
      doc.addPage();
      yPos=15;
    }
    doc.setFontSize(14);
    doc.text(`Scenario ${idx+1}: ${sc.name}`,15,yPos);
    yPos+=7;
    doc.setFontSize(12);
    doc.text(`Cost: $${sc.costSliderVal}`,15,yPos); yPos+=5;
    doc.text(`Delivery: ${sc.deliveryMethod}`,15,yPos); yPos+=5;
    doc.text(`Accreditation: ${sc.accreditation}`,15,yPos); yPos+=5;
    doc.text(`Location: ${sc.location}`,15,yPos); yPos+=5;
    doc.text(`Training Level: ${sc.trainingLevel}`,15,yPos); yPos+=5;
    doc.text(`Cohort Size: ${sc.cohortSize}`,15,yPos); yPos+=5;
    doc.text(`Uptake: ${sc.uptake}%, Net Benefit: $${sc.netBenefit}`,15,yPos);
    yPos+=10;
  });
  doc.save("FETPScenarios_Comparison.pdf");
}

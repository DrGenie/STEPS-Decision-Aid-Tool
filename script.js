/****************************************************************************
 * SCRIPT.JS
 * 1) Tab switching
 * 2) Range slider label updates
 * 3) DCE coefficients for FETP
 * 4) Mandate user inputs (no default scenario)
 * 5) WTP chart with dynamic scale
 * 6) Probability chart with fixed height
 * 7) Cost–benefit chart
 * 8) Saving & PDF export
 ****************************************************************************/

document.addEventListener("DOMContentLoaded", function(){
  const tabs= document.querySelectorAll(".tablink");
  tabs.forEach(btn=>{
    btn.addEventListener("click", function(){
      openTab(this.getAttribute("data-tab"), this);
    });
  });
  // Default tab
  openTab("introTab", document.querySelector(".tablink"));
});

/** Tab switching */
function openTab(tabId, clickedBtn){
  const contents= document.querySelectorAll(".tabcontent");
  contents.forEach(c => c.style.display="none");
  const allBtns= document.querySelectorAll(".tablink");
  allBtns.forEach(b => {
    b.classList.remove("active");
    b.setAttribute("aria-selected","false");
  });
  document.getElementById(tabId).style.display="block";
  clickedBtn.classList.add("active");
  clickedBtn.setAttribute("aria-selected","true");
}

/** Sliders (cohort & cost) label updates */
function updateCohortDisplay(val){
  document.getElementById("cohortLabel").textContent= val;
}
function updateFETPCostDisplay(val){
  document.getElementById("costLabelFETP").textContent= val;
}

/** Main DCE Coefficients */
const mainCoefficients={
  ASC_mean: -0.112,
  ASC_sd: 1.161,
  ASC_optout: 0.131,

  // Training level (Ref=Intermediate => 0)
  training_advanced: 0.527,
  training_frontline: -0.349,

  // Delivery (Ref=Online => 0)
  delivery_inperson: 0.426,
  delivery_hybrid: 0.189,

  // Accreditation (Ref=None => 0)
  accreditation_international: 0.617,
  accreditation_national: 0.236,

  // Location (Ref=District => 0)
  location_statelevel: 0.385,
  location_regional: 0.113,

  // Continuous slopes
  cohortsize: 0.059,
  cost: -0.036
};

/** Build scenario from user inputs (Mandatory checks) */
function buildFETPScenario(){
  // training => mandatory
  let trainingLevel= null;
  if(document.getElementById("frontlineCheck").checked)   trainingLevel="frontline";
  if(document.getElementById("advancedCheck").checked)    trainingLevel="advanced";

  // if trainingLevel=== null => user didn't pick => alert
  if(!trainingLevel){
    alert("Please select a Training Level (Frontline or Advanced).");
    return null;
  }

  // delivery => mandatory
  let deliveryMethod= null;
  if(document.getElementById("inpersonCheck").checked) deliveryMethod="inperson";
  if(document.getElementById("hybridCheck").checked)   deliveryMethod="hybrid";
  if(!deliveryMethod){
    alert("Please select a Delivery Method (In-person or Hybrid).");
    return null;
  }

  // accreditation => mandatory
  let accreditation= null;
  if(document.getElementById("nationalCheck").checked)       accreditation="national";
  if(document.getElementById("internationalCheck").checked)  accreditation="international";
  if(!accreditation){
    alert("Please select an Accreditation (National or International).");
    return null;
  }

  // location => mandatory
  let locationFETP= null;
  if(document.getElementById("stateCheck").checked)    locationFETP="state";
  if(document.getElementById("regionalCheck").checked) locationFETP="regional";
  if(!locationFETP){
    alert("Please select a Location (State-level or Regional).");
    return null;
  }

  // cohort => from slider
  const cSize= document.getElementById("cohortSlider") ? parseInt(document.getElementById("cohortSlider").value,10) : 500;
  // cost => from slider
  const cVal= document.getElementById("costSliderFETP") ? parseInt(document.getElementById("costSliderFETP").value,10) : 50;

  return {
    trainingLevel,
    deliveryMethod,
    accreditation,
    location: locationFETP,
    cohortSize: cSize,
    costVal: cVal
  };
}

/** Compute logit fraction with your new formula */
function computeFETPUptake(sc){
  let U= mainCoefficients.ASC_mean;

  if(sc.trainingLevel==="advanced")   U+= mainCoefficients.training_advanced;
  if(sc.trainingLevel==="frontline") U+= mainCoefficients.training_frontline;

  if(sc.deliveryMethod==="inperson") U+= mainCoefficients.delivery_inperson;
  if(sc.deliveryMethod==="hybrid")   U+= mainCoefficients.delivery_hybrid;

  if(sc.accreditation==="international") U+= mainCoefficients.accreditation_international;
  if(sc.accreditation==="national")      U+= mainCoefficients.accreditation_national;

  if(sc.location==="state")    U+= mainCoefficients.location_statelevel;
  if(sc.location==="regional") U+= mainCoefficients.location_regional;

  // continuous
  U+= mainCoefficients.cohortsize* sc.cohortSize;
  U+= mainCoefficients.cost* sc.costVal;

  const altExp= Math.exp(U);
  const optExp= Math.exp(mainCoefficients.ASC_optout);
  return altExp/(altExp+ optExp);
}

/** "Calculate & View Results" from the Inputs tab */
function openFETPScenario(){
  const scenario= buildFETPScenario();
  if(!scenario) return; // missing mandatory => return

  const frac= computeFETPUptake(scenario);
  const pct= frac*100;
  let rec="";
  if(pct<30){
    rec= "Uptake is quite low. Consider lowering cost or picking a more advanced approach (like a recognized accreditation or more local site).";
  } else if(pct<70){
    rec= "Moderate uptake. Some improvements (lower cost or advanced training level) might yield higher acceptance.";
  } else {
    rec= "High uptake. This configuration seems effective for scaling FETP.";
  }

  document.getElementById("modalResults").innerHTML=`
    <h4>Calculation Results</h4>
    <p><strong>Predicted Uptake:</strong> ${pct.toFixed(2)}%</p>
    <p><em>Recommendation:</em> ${rec}</p>
  `;
  document.getElementById("resultModal").style.display="block";

  // also update Probability chart & Cost-Benefit
  renderFETPProbChart();
  renderFETPCostsBenefits();
}

/** close modal */
function closeModal(){
  document.getElementById("resultModal").style.display="none";
}

/***************************************************************************
 * WTP CHART
 ***************************************************************************/
let wtpChart= null;
function renderWTPChart(){
  const ctx= document.getElementById("wtpChartMain").getContext("2d");
  if(!ctx)return;
  if(wtpChart) wtpChart.destroy();

  // Build arrays from mainCoefficients
  // e.g. ratio = (coefficient) / -( cost slope ) => * some scale
  function ratio(coef){ return (coef / -mainCoefficients.cost)*100; }

  const labels= [
    "Training: Advanced","Training: Frontline",
    "Delivery: In-person","Delivery: Hybrid",
    "Accred: International","Accred: National",
    "Location: State","Location: Regional",
    "Cohort +1","Cost +1"
  ];
  const rawValues= [
    ratio(mainCoefficients.training_advanced),
    ratio(mainCoefficients.training_frontline),
    ratio(mainCoefficients.delivery_inperson),
    ratio(mainCoefficients.delivery_hybrid),
    ratio(mainCoefficients.accreditation_international),
    ratio(mainCoefficients.accreditation_national),
    ratio(mainCoefficients.location_statelevel),
    ratio(mainCoefficients.location_regional),
    ratio(mainCoefficients.cohortsize),
    -100 // If cost +1 => negative WTP, example
  ];
  // standard errors ~ 10%
  const errors= rawValues.map(v=> Math.abs(v)*0.1);

  const minVal= Math.min(...rawValues)- (0.15*Math.abs(Math.min(...rawValues)));
  const maxVal= Math.max(...rawValues)+ (0.15*Math.abs(Math.max(...rawValues)));

  wtpChart= new Chart(ctx,{
    type:"bar",
    data:{
      labels,
      datasets:[{
        label:"WTP (USD)",
        data: rawValues,
        backgroundColor: rawValues.map(v=> v>=0?"rgba(52,152,219,0.6)":"rgba(231,76,60,0.6)"),
        borderColor: rawValues.map(v=> v>=0?"rgba(52,152,219,1)":"rgba(231,76,60,1)"),
        borderWidth:1,
        error: errors
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      scales:{
        y:{
          // dynamic scale so it won't go infinite
          min: minVal,
          max: maxVal
        }
      },
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
        const { ctx, scales:{ y }}= chart;
        const dataset= chart.getDatasetMeta(0).data;
        dataset.forEach((bar,i)=>{
          const xCenter= bar.x;
          const val= rawValues[i];
          const se= errors[i];
          if(typeof se==="number"){
            const top= y.getPixelForValue(val+se);
            const bot= y.getPixelForValue(val-se);
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle="#000";
            ctx.lineWidth=1;
            // vertical line
            ctx.moveTo(xCenter, top);
            ctx.lineTo(xCenter, bot);
            // top cap
            ctx.moveTo(xCenter-5, top);
            ctx.lineTo(xCenter+5, top);
            // bottom cap
            ctx.moveTo(xCenter-5, bot);
            ctx.lineTo(xCenter+5, bot);
            ctx.stroke();
            ctx.restore();
          }
        });
      }
    }]
  });
}

/***************************************************************************
 * Probability CHART
 ***************************************************************************/
let probChartFETP= null;
function renderFETPProbChart(){
  const scenario= buildFETPScenario();
  if(!scenario) return; // missing mandatory => stop
  const fraction= computeFETPUptake(scenario);
  const pct= fraction*100;

  const ctx= document.getElementById("probChartFETP").getContext("2d");
  if(probChartFETP) probChartFETP.destroy();
  probChartFETP= new Chart(ctx, {
    type:"doughnut",
    data:{
      labels:["Uptake","Non-Uptake"],
      datasets:[{
        data:[pct, 100-pct],
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
          font:{ size:16 }
        }
      }
    }
  });
}

/***************************************************************************
 * COST-BENEFIT
 ***************************************************************************/
let cbaFETPChart= null;
function renderFETPCostsBenefits(){
  const scenario= buildFETPScenario();
  if(!scenario) return; // mandatory check
  const fraction= computeFETPUptake(scenario);
  const uptakeVal= fraction*100;
  const participants= 250* fraction;

  // QALY scenario
  let qVal=0.05;
  const sel= document.getElementById("qalyFETPSelect");
  if(sel){
    if(sel.value==="low") qVal=0.01;
    else if(sel.value==="high") qVal=0.08;
  }
  // Simplified cost => costVal => each step => $10 => multiply participants
  const totalCost= scenario.costVal* participants* 10;
  const totalQALY= participants* qVal;
  const monetized= totalQALY* 50000;
  const netB= monetized- totalCost;

  const container= document.getElementById("costsFETPResults");
  if(!container)return;
  container.innerHTML=`
    <div class="calculation-info">
      <p><strong>Uptake:</strong> ${uptakeVal.toFixed(2)}%</p>
      <p><strong>Participants:</strong> ${participants.toFixed(0)}</p>
      <p><strong>Total Training Cost:</strong> $${totalCost.toFixed(2)}</p>
      <p><strong>Cost per Participant:</strong> $${(totalCost/participants).toFixed(2)}</p>
      <p><strong>Total QALYs:</strong> ${totalQALY.toFixed(2)}</p>
      <p><strong>Monetised Benefits:</strong> $${monetized.toLocaleString()}</p>
      <p><strong>Net Benefit:</strong> $${netB.toLocaleString()}</p>
      <p>
        <em>Policy Recommendation:</em><br/>
        ${
          netB<0
           ? "Negative net benefit suggests the chosen cost or scale is too high. Reduce cost or add more accreditation."
           : (uptakeVal<40
              ? "Although net benefit is positive, uptake is relatively low. Consider selecting advanced training or in-person delivery to boost acceptance."
              : "A favourable outcome with strong uptake and net benefit. This scenario is well-suited for FETP scale-up.")
        }
      </p>
    </div>
    <div class="chart-box" style="height: 350px;">
      <h3>Cost-Benefit Analysis</h3>
      <canvas id="cbaFETPChart"></canvas>
    </div>
  `;

  const ctx= document.getElementById("cbaFETPChart").getContext("2d");
  if(cbaFETPChart) cbaFETPChart.destroy();
  // dynamic scale
  const minVal= Math.min(totalCost, monetized, netB) - 0.15*Math.abs(Math.min(totalCost, monetized, netB));
  const maxVal= Math.max(totalCost, monetized, netB) + 0.15*Math.abs(Math.max(totalCost, monetized, netB));

  cbaFETPChart= new Chart(ctx,{
    type:"bar",
    data:{
      labels:["Total Cost","Monetised Benefits","Net Benefit"],
      datasets:[{
        label:"USD",
        data:[totalCost, monetized, netB],
        backgroundColor:["#c0392b","#27ae60","#f1c40f"]
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      scales:{
        y:{
          min: minVal,
          max: maxVal
        }
      },
      plugins:{
        title:{
          display:true,
          text:"Cost-Benefit Analysis (FETP)",
          font:{size:16}
        },
        legend:{ display:false }
      }
    }
  });
}

/** Toggling cost breakdown & benefits analysis */
function toggleFETPCostBreakdown(){
  const box= document.getElementById("detailedFETPCostBreakdown");
  if(!box)return;
  box.style.display= (box.style.display==="none"||!box.style.display)?"flex":"none";
}
function toggleFETPBenefitsAnalysis(){
  const box= document.getElementById("detailedFETPBenefitsAnalysis");
  if(!box)return;
  box.style.display= (box.style.display==="none"||!box.style.display)?"flex":"none";
}

/***************************************************************************
 * SCENARIOS: Save & PDF Export
 ***************************************************************************/
let savedFETPScenarios= [];
function saveFETPScenario(){
  const sc= buildFETPScenario();
  if(!sc)return;
  const frac= computeFETPUptake(sc);
  const pct= frac*100;
  sc.uptake= pct.toFixed(2);
  const netB= (pct*1000).toFixed(2); // dummy net benefit
  sc.netBenefit= netB;
  sc.name= `FETP Scenario ${savedFETPScenarios.length+1}`;
  savedFETPScenarios.push(sc);

  const tb= document.querySelector("#FETPScenarioTable tbody");
  const row= document.createElement("tr");
  row.innerHTML=`
    <td>${sc.name}</td>
    <td>$${sc.costVal}</td>
    <td>${sc.deliveryMethod}</td>
    <td>${sc.accreditation}</td>
    <td>${sc.location}</td>
    <td>${sc.trainingLevel}</td>
    <td>${sc.cohortSize}</td>
    <td>${sc.uptake}%</td>
    <td>$${sc.netBenefit}</td>
  `;
  tb.appendChild(row);
  alert(`"${sc.name}" saved successfully.`);
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
    doc.text(`Cost: $${sc.costVal}`,15,yPos); yPos+=5;
    doc.text(`Delivery: ${sc.deliveryMethod}`,15,yPos); yPos+=5;
    doc.text(`Accreditation: ${sc.accreditation}`,15,yPos); yPos+=5;
    doc.text(`Location: ${sc.location}`,15,yPos); yPos+=5;
    doc.text(`Training: ${sc.trainingLevel}`,15,yPos); yPos+=5;
    doc.text(`Cohort: ${sc.cohortSize}`,15,yPos); yPos+=5;
    doc.text(`Uptake: ${sc.uptake}%, Net Benefit: $${sc.netBenefit}`,15,yPos);
    yPos+=10;
  });

  doc.save("FETPScenarios_Comparison.pdf");
}

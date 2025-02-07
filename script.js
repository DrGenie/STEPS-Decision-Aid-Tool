/****************************************************************************
 * SCRIPT.JS
 * - Tab switching with event listeners
 * - Input form to gather FETP attribute selections
 * - WTP chart with error bars (dummy data)
 * - Predicted programme uptake chart (dummy function)
 * - Cost–benefit analysis with QALY scenario toggles
 * - Saving & comparing scenarios, exporting PDF
 ****************************************************************************/

/* On DOM load, set up tabs, default to introduction */
document.addEventListener("DOMContentLoaded", function() {
  const tabButtons = document.querySelectorAll(".tablink");
  tabButtons.forEach(button => {
    button.addEventListener("click", function() {
      openTab(this.getAttribute("data-tab"), this);
    });
  });
  // Default tab
  openTab("introTab", document.querySelector(".tablink"));
});

/** Tab switch function */
function openTab(tabId, btn) {
  const allTabs = document.querySelectorAll(".tabcontent");
  allTabs.forEach(tab => tab.style.display = "none");
  const allBtns = document.querySelectorAll(".tablink");
  allBtns.forEach(b => {
    b.classList.remove("active");
    b.setAttribute("aria-selected","false");
  });
  document.getElementById(tabId).style.display = "block";
  btn.classList.add("active");
  btn.setAttribute("aria-selected","true");
}

/** Example WTP Data, error bars, etc. */
let wtpChart = null;
function renderWTPChart() {
  const ctx = document.getElementById("wtpChartMain").getContext("2d");
  if(!ctx) return;
  if(wtpChart) wtpChart.destroy();

  // Dummy data for demonstration
  const attributes = ["Frontline Training","In-person","National Accreditation","State-Level","Cohort +1","Cost +1"];
  const wtpValues = [2000,1500,2200,1800, -300, -800]; // simplified
  const wtpErrors = wtpValues.map(v => Math.abs(v)*0.1);

  wtpChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: attributes,
      datasets:[{
        label:"WTP (USD)",
        data: wtpValues,
        backgroundColor: wtpValues.map(v=> v>=0?"rgba(52,152,219,0.6)":"rgba(231,76,60,0.6)"),
        borderColor: wtpValues.map(v=> v>=0?"rgba(52,152,219,1)":"rgba(231,76,60,1)"),
        borderWidth:1,
        error: wtpErrors
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
          text:"WTP (USD) - FETP Attributes",
          font:{ size:16}
        }
      }
    },
    plugins:[{
      id:"errorbars",
      afterDraw: chart=>{
        const { ctx, scales:{ y } }= chart;
        chart.getDatasetMeta(0).data.forEach((bar,i)=>{
          const xCenter= bar.x;
          const val= wtpValues[i];
          const se= wtpErrors[i];
          if(typeof se==="number"){
            const top= y.getPixelForValue(val+se);
            const bottom= y.getPixelForValue(val-se);
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle="#000";
            ctx.lineWidth=1;
            // vertical line
            ctx.moveTo(xCenter, top);
            ctx.lineTo(xCenter, bottom);
            // top cap
            ctx.moveTo(xCenter-5, top);
            ctx.lineTo(xCenter+5, top);
            // bottom cap
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

/** Predicted Probability Chart (dummy) */
let probChart = null;
function renderFETPProbChart() {
  const ctx = document.getElementById("probChartFETP").getContext("2d");
  if(!ctx)return;
  if(probChart) probChart.destroy();

  // Dummy predicted value
  const predictedUptake = 68; // % for demonstration
  probChart = new Chart(ctx, {
    type:"doughnut",
    data:{
      labels:["Uptake","Non-uptake"],
      datasets:[{
        data:[predictedUptake,100-predictedUptake],
        backgroundColor:["#28a745","#dc3545"]
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        title:{
          display:true,
          text:`Predicted FETP Uptake: ${predictedUptake.toFixed(1)}%`,
          font:{ size:16 }
        }
      }
    }
  });
  // Additional recommendation logic if needed
}

/** Handling Costs & Benefits */
let cbaFETPChart= null;
function renderFETPCostsBenefits() {
  const scenarioDiv = document.getElementById("costsFETPResults");
  if(!scenarioDiv) return;

  // Example logic
  const uptakePerc = 68;
  const participants = 250 * (uptakePerc/100);
  const totalTrainingCost = 200000; // dummy
  const costPerPartic = totalTrainingCost/participants;
  const qalySelect = document.getElementById("qalyFETPSelect").value;
  let qalyVal=0.05;
  if(qalySelect==="low") qalyVal=0.01;
  else if(qalySelect==="high") qalyVal=0.08;
  const totalQALY = participants*qalyVal;
  const monetized= totalQALY*50000;
  const netB= monetized - totalTrainingCost;

  scenarioDiv.innerHTML=`
    <div class="calculation-info">
      <p><strong>Uptake:</strong> ${uptakePerc.toFixed(1)}%</p>
      <p><strong>Participants:</strong> ${participants.toFixed(0)}</p>
      <p><strong>Total Training Cost:</strong> $${totalTrainingCost.toLocaleString()}</p>
      <p><strong>Cost per Participant:</strong> $${costPerPartic.toFixed(2)}</p>
      <p><strong>Total QALYs:</strong> ${totalQALY.toFixed(2)}</p>
      <p><strong>Monetised Benefits:</strong> $${monetized.toLocaleString()}</p>
      <p><strong>Net Benefit:</strong> $${netB.toLocaleString()}</p>
    </div>
    <div class="chart-box">
      <h3>Cost-Benefit Analysis</h3>
      <canvas id="cbaFETPChart"></canvas>
    </div>
  `;

  const ctx = document.getElementById("cbaFETPChart").getContext("2d");
  if(cbaFETPChart) cbaFETPChart.destroy();
  cbaFETPChart= new Chart(ctx,{
    type:"bar",
    data:{
      labels:["Total Cost","Monetised Benefits","Net Benefit"],
      datasets:[{
        label:"USD",
        data:[totalTrainingCost, monetized, netB],
        backgroundColor:["#c0392b","#27ae60","#f1c40f"]
      }]
    },
    options:{
      responsive:true,
      scales:{y:{beginAtZero:true}},
      plugins:{
        title:{
          display:true,
          text:"Combined Cost-Benefit",
          font:{ size:16}
        },
        legend:{ display:false }
      }
    }
  });
}

/** Expand/Hide Cost Breakdowns */
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

/** Example scenario saving for the FETP tab */
let fetpScenarios=[];
function saveFETPScenario(){
  // dummy logic
  const scenarioName= `FETP Scenario ${fetpScenarios.length+1}`;
  const cost= 750;
  const delivery= "In-person";
  const accreditation= "National";
  const location= "State-Level";
  const trainingLevel= "Frontline";
  const cohort= 100;
  const uptake= 68;
  const netB= 50000;
  const scenarioObj={
    name: scenarioName,
    cost,delivery,accreditation,location,trainingLevel,cohort,
    uptake,netB
  };
  fetpScenarios.push(scenarioObj);

  const tableBody= document.querySelector("#FETPScenarioTable tbody");
  const row= document.createElement("tr");
  row.innerHTML=`
    <td>${scenarioName}</td>
    <td>$${cost.toFixed(2)}</td>
    <td>${delivery}</td>
    <td>${accreditation}</td>
    <td>${location}</td>
    <td>${trainingLevel}</td>
    <td>${cohort}</td>
    <td>${uptake}%</td>
    <td>$${netB.toLocaleString()}</td>
  `;
  tableBody.appendChild(row);
  alert(`"${scenarioName}" saved successfully.`);
}

function exportFETPComparison(){
  if(!fetpScenarios.length){
    alert("No FETP scenarios saved.");
    return;
  }
  const {jsPDF}= window.jspdf;
  const doc= new jsPDF({unit:"mm", format:"a4"});
  let yPos=15;
  doc.setFontSize(16);
  doc.text("FETP Scenarios Comparison", 105, yPos,{align:"center"});
  yPos+=10;
  fetpScenarios.forEach((sc, idx)=>{
    if(yPos>250){
      doc.addPage();
      yPos=15;
    }
    doc.setFontSize(14);
    doc.text(`Scenario ${idx+1}: ${sc.name}`,15,yPos); yPos+=6;
    doc.setFontSize(12);
    doc.text(`Cost: $${sc.cost}`,15,yPos); yPos+=5;
    doc.text(`Delivery: ${sc.delivery}`,15,yPos); yPos+=5;
    doc.text(`Accreditation: ${sc.accreditation}`,15,yPos); yPos+=5;
    doc.text(`Location: ${sc.location}`,15,yPos); yPos+=5;
    doc.text(`Training Level: ${sc.trainingLevel}`,15,yPos); yPos+=5;
    doc.text(`Cohort: ${sc.cohort}, Uptake: ${sc.uptake}%`,15,yPos); yPos+=5;
    doc.text(`Net Benefit: $${sc.netB}`,15,yPos); yPos+=10;
  });
  doc.save("FETPScenarios_Comparison.pdf");
}

/** 
 * EXAMPLE: Additional function if you want a "Calculate & View Results" inside Inputs Tab
 */
function openFETPScenario(){
  // This can replicate logic or partial logic as needed
  alert("Placeholder: call your scenario build function, compute probability, etc.");
  renderFETPProbChart();
  renderFETPCostsBenefits();
}

/** Example: Update Cohort display in real-time */
function updateCohortDisplay(val){
  document.getElementById("cohortLabel").textContent= val;
}
/** Example: Update cost display for FETP range */
function updateFETPCostDisplay(val){
  // Suppose 0..100 => $100..$1500
  const minCost= 100;
  const maxCost= 1500;
  const mappedCost= minCost + ((maxCost-minCost)/100)* val;
  document.getElementById("costLabelFETP").textContent= mappedCost.toFixed(0);
}

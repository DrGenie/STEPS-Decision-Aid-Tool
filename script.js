document.addEventListener('DOMContentLoaded', () => {
    // Update display values for range inputs
    const cohortSize = document.getElementById('cohort-size');
    const cohortSizeValue = document.getElementById('cohort-size-value');
    cohortSizeValue.textContent = cohortSize.value;
    cohortSize.addEventListener('input', () => {
        cohortSizeValue.textContent = cohortSize.value;
    });

    const trainingDuration = document.getElementById('training-duration');
    const trainingDurationValue = document.getElementById('training-duration-value');
    trainingDurationValue.textContent = trainingDuration.value;
    trainingDuration.addEventListener('input', () => {
        trainingDurationValue.textContent = trainingDuration.value;
    });

    const cost = document.getElementById('cost');
    const costValue = document.getElementById('cost-value');
    costValue.textContent = `₹${parseInt(cost.value).toLocaleString()}`;
    cost.addEventListener('input', () => {
        costValue.textContent = `₹${parseInt(cost.value).toLocaleString()}`;
    });

    // Placeholder DCE Estimates (Hypothetical)
    const dceEstimates = {
        "Frontline": { uptake: 70 },
        "Intermediate": { uptake: 50 },
        "Advanced": { uptake: 30 }
    };

    // Placeholder Cost-Benefit Estimates (Hypothetical)
    const costBenefitEstimates = {
        "Frontline": { cost: 200000, benefit: 500000 },
        "Intermediate": { cost: 400000, benefit: 1000000 },
        "Advanced": { cost: 600000, benefit: 1500000 }
    };

    // Function to run analysis
    document.getElementById('run-analysis').addEventListener('click', () => {
        // Gather input values
        const trainingLevel = document.getElementById('training-level').value;
        const deliveryMethod = document.getElementById('delivery-method').value;
        const accreditation = document.getElementById('accreditation').value;
        const location = document.getElementById('location').value;
        const cohortSizeVal = parseInt(document.getElementById('cohort-size').value);
        const trainingDurationVal = parseInt(document.getElementById('training-duration').value);
        const mentoring = document.getElementById('mentoring').value;
        const costPerParticipant = parseInt(document.getElementById('cost').value);
        const curriculum = document.getElementById('curriculum').value;

        // Calculate Predicted Uptake based on Training Level
        let predictedUptake = dceEstimates[trainingLevel].uptake;

        // Calculate Total Cost
        let totalCost = cohortSizeVal * costPerParticipant;

        // Calculate Total Benefit
        let totalBenefit = cohortSizeVal * costBenefitEstimates[trainingLevel].benefit;

        // Net Benefit
        let netBenefit = totalBenefit - totalCost;

        // Display Results
        const resultsContent = document.getElementById('results-content');
        resultsContent.innerHTML = `
            <h4>Scenario Configuration:</h4>
            <ul>
                <li><strong>Training Level:</strong> ${trainingLevel}</li>
                <li><strong>Delivery Method:</strong> ${deliveryMethod}</li>
                <li><strong>Accreditation:</strong> ${accreditation}</li>
                <li><strong>Location of Training:</strong> ${location}</li>
                <li><strong>Cohort Size:</strong> ${cohortSizeVal}</li>
                <li><strong>Training Duration:</strong> ${trainingDurationVal} months</li>
                <li><strong>Mentoring Approach:</strong> ${mentoring}</li>
                <li><strong>Cost per Participant:</strong> ₹${costPerParticipant.toLocaleString()}</li>
                <li><strong>Curriculum Focus:</strong> ${curriculum}</li>
            </ul>
            <h4>Predicted Outcomes:</h4>
            <ul>
                <li><strong>Predicted Uptake:</strong> ${predictedUptake}%</li>
                <li><strong>Total Cost:</strong> ₹${totalCost.toLocaleString()}</li>
                <li><strong>Total Benefit:</strong> ₹${totalBenefit.toLocaleString()}</li>
                <li><strong>Net Benefit:</strong> ₹${netBenefit.toLocaleString()}</li>
            </ul>
        `;

        // Update Predicted Uptake Chart
        updateUptakeChart(predictedUptake);

        // Update Cost-Benefit Chart
        updateCostBenefitChart(totalCost, totalBenefit, netBenefit);
    });

    // Function to update Predicted Uptake Chart
    let uptakeChart;
    function updateUptakeChart(uptake) {
        const ctx = document.getElementById('uptakeChart').getContext('2d');
        if (uptakeChart) {
            uptakeChart.destroy();
        }
        uptakeChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Predicted Uptake', 'Remaining'],
                datasets: [{
                    data: [uptake, 100 - uptake],
                    backgroundColor: ['#28a745', '#dc3545'],
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    // Function to update Cost-Benefit Chart
    let costBenefitChart;
    function updateCostBenefitChart(cost, benefit, net) {
        const ctx = document.getElementById('costBenefitChart').getContext('2d');
        if (costBenefitChart) {
            costBenefitChart.destroy();
        }
        costBenefitChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Total Cost', 'Total Benefit', 'Net Benefit'],
                datasets: [{
                    label: 'Amount (₹)',
                    data: [cost, benefit, net],
                    backgroundColor: [
                        '#ffc107',
                        '#17a2b8',
                        '#28a745'
                    ],
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    yAxes: [{
                        ticks: {
                            beginAtZero:true
                        }
                    }]
                }
            }
        });
    }

    // Saving Scenarios
    let savedScenarios = [];

    document.getElementById('save-scenario').addEventListener('click', () => {
        const scenarioName = document.getElementById('scenario-name').value.trim();
        if (scenarioName === "") {
            alert("Please enter a name for the scenario.");
            return;
        }

        // Gather current inputs
        const scenario = {
            name: scenarioName,
            trainingLevel: document.getElementById('training-level').value,
            deliveryMethod: document.getElementById('delivery-method').value,
            accreditation: document.getElementById('accreditation').value,
            location: document.getElementById('location').value,
            cohortSize: parseInt(document.getElementById('cohort-size').value),
            trainingDuration: parseInt(document.getElementById('training-duration').value),
            mentoring: document.getElementById('mentoring').value,
            costPerParticipant: parseInt(document.getElementById('cost').value),
            curriculum: document.getElementById('curriculum').value
        };

        savedScenarios.push(scenario);
        displaySavedScenarios();
        document.getElementById('scenario-name').value = '';
    });

    function displaySavedScenarios() {
        const list = document.getElementById('saved-scenarios-list');
        list.innerHTML = '';
        savedScenarios.forEach((scenario, index) => {
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item';
            listItem.innerHTML = `<strong>${scenario.name}</strong> 
                <button class="btn btn-sm btn-primary float-right ml-2" onclick="loadScenario(${index})">Load</button>
                <button class="btn btn-sm btn-danger float-right" onclick="deleteScenario(${index})">Delete</button>`;
            list.appendChild(listItem);
        });
    }

    window.loadScenario = function(index) {
        const scenario = savedScenarios[index];
        document.getElementById('training-level').value = scenario.trainingLevel;
        document.getElementById('delivery-method').value = scenario.deliveryMethod;
        document.getElementById('accreditation').value = scenario.accreditation;
        document.getElementById('location').value = scenario.location;
        document.getElementById('cohort-size').value = scenario.cohortSize;
        document.getElementById('cohort-size-value').textContent = scenario.cohortSize;
        document.getElementById('training-duration').value = scenario.trainingDuration;
        document.getElementById('training-duration-value').textContent = scenario.trainingDuration;
        document.getElementById('mentoring').value = scenario.mentoring;
        document.getElementById('cost').value = scenario.costPerParticipant;
        document.getElementById('cost-value').textContent = `₹${scenario.costPerParticipant.toLocaleString()}`;
        document.getElementById('curriculum').value = scenario.curriculum;
    }

    window.deleteScenario = function(index) {
        if (confirm("Are you sure you want to delete this scenario?")) {
            savedScenarios.splice(index, 1);
            displaySavedScenarios();
        }
    }

    // Export to PDF
    document.getElementById('export-pdf').addEventListener('click', () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Title
        doc.setFontSize(18);
        doc.text("STEPS: Scalable Training Estimation and Planning System", 10, 20);

        // Scenario Details
        doc.setFontSize(14);
        doc.text("Saved Scenarios:", 10, 30);
        let y = 40;
        savedScenarios.forEach((scenario, index) => {
            doc.setFontSize(12);
            doc.text(`${index + 1}. ${scenario.name}`, 10, y);
            y += 10;
            doc.text(`   - Training Level: ${scenario.trainingLevel}`, 10, y);
            y += 7;
            doc.text(`   - Delivery Method: ${scenario.deliveryMethod}`, 10, y);
            y += 7;
            doc.text(`   - Accreditation: ${scenario.accreditation}`, 10, y);
            y += 7;
            doc.text(`   - Location of Training: ${scenario.location}`, 10, y);
            y += 7;
            doc.text(`   - Cohort Size: ${scenario.cohortSize}`, 10, y);
            y += 7;
            doc.text(`   - Training Duration: ${scenario.trainingDuration} months`, 10, y);
            y += 7;
            doc.text(`   - Mentoring Approach: ${scenario.mentoring}`, 10, y);
            y += 7;
            doc.text(`   - Cost per Participant: ₹${scenario.costPerParticipant.toLocaleString()}`, 10, y);
            y += 7;
            doc.text(`   - Curriculum Focus: ${scenario.curriculum}`, 10, y);
            y += 10;
            if (y > 280) {
                doc.addPage();
                y = 20;
            }
        });

        doc.save("STEPS_Saved_Scenarios.pdf");
    });
});

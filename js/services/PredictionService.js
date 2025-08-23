// Prediction service for tumor weight analysis
// Dependencies: MathUtils.js, FormChangeHandler.js

class PredictionService {
    constructor() {
        this.tumorWeightsData = null;
        this.batchPredictionResults = null;
        this.hasTumorWeightColumn = false;
        this.expCache = new Map();
        this.showNotification = null;
        this.processedData = null;
        this.rawData = null;
        this.animalModels = null;
        this.initialized = false;
        
        this.styles = {
            input: "width: 100%; padding: 0.5rem; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #e0e0e0;",
            card: "result-card",
            btn: "btn",
            panelBg: "margin: 1rem 0; padding: 1rem; background: rgba(255, 255, 255, 0.05); border-radius: 8px;",
            tableBg: "background: rgba(0,0,0,0.1);",
            smallText: "display: block; margin-top: 0.25rem; color: #a0a0a0; font-size: 0.8rem;"
        };
    }

    init(dependencies = {}) {
        if (this.initialized) return;
        
        this.showNotification = dependencies.showNotification || (() => {});
        this.processedData = dependencies.processedData || (() => window.processedData);
        this.rawData = dependencies.rawData || (() => window.rawData);
        this.animalModels = dependencies.animalModels || (() => window.animalModels);
        
        window.predictionService = this;
        window.togglePredictionForm = () => this.togglePredictionForm();
        window.predictValue = () => this.predictSingleAnimal();
        window.predictBatchWeights = () => this.predictBatchWeights();
        window.checkForTumorWeightColumn = () => this.checkForTumorWeightColumn();
        window.batchPredictionResults = null;
        window.tumorWeightsData = null;
        
        this.initialized = true;
    }

    setTumorWeightStatus(hasColumn) {
        this.hasTumorWeightColumn = hasColumn;
        window.hasTumorWeightColumn = hasColumn;
    }
    
    _fastExp(x) {
        const key = Math.round(x * 1000) / 1000;
        if (this.expCache.has(key)) return this.expCache.get(key);
        
        const result = Math.exp(x);
        
        if (this.expCache.size >= 500) {
            const firstKey = this.expCache.keys().next().value;
            this.expCache.delete(firstKey);
        }
        
        this.expCache.set(key, result);
        return result;
    }

    togglePredictionForm() {
        const animalModels = this.animalModels();
        if (!animalModels || Object.keys(animalModels).length === 0) {
            this.showNotification('Analyze data first to enable predictions', 'warning');
            return;
        }
        
        const existingForm = document.getElementById('predictionCard');
        if (existingForm) {
            existingForm.remove();
            return;
        }
        
        this.createPredictionPanel();
    }

    createPredictionPanel() {
        const processedData = this.processedData();
        if (!processedData || !processedData.validAnimals) {
            this.showNotification('No processed data available', 'error');
            return;
        }
        
        const card = document.createElement('div');
        card.className = this.styles.card;
        card.id = 'predictionCard';
        
        const paramLabel = processedData.dataType === 'volume' ? 'Volume' : 'BLI';
        card.innerHTML = this.generatePredictionPanelHTML(paramLabel, processedData);
        
        setTimeout(() => {
            const predictAnimalSelect = document.getElementById('predictAnimal');
            if (predictAnimalSelect) {
                predictAnimalSelect.removeEventListener('change', this.handleAnimalSelectionChange);
                predictAnimalSelect.addEventListener('change', () => this.handleAnimalSelectionChange());
            }
        }, 100);
        
        document.getElementById('results').appendChild(card);
        setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        
        if (this.hasTumorWeightColumn) {
            setTimeout(() => {
                const batchRadio = document.querySelector('input[name="predictionMode"][value="batch"]');
                if (batchRadio) {
                    batchRadio.checked = true;
                    batchRadio.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, 150);
        }
        
        this.showNotification('Prediction form opened', 'info');
    }

    /**
     * Generate the prediction panel HTML
     * @param {string} paramLabel - Parameter label (Volume/BLI)
     * @param {Object} processedData - Processed data object
     * @returns {string} HTML string
     */
    generatePredictionPanelHTML(paramLabel, processedData) {
        return `
            <h2>${paramLabel} and Tumor Weight Prediction</h2>
            
            <!-- Prediction Mode Selection -->
            <div style="margin: 1rem 0; padding: 1rem; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
                <h3>Prediction Mode</h3>
                <div style="display: flex; gap: 1rem; margin: 0.5rem 0;">
                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                        <input type="radio" name="predictionMode" value="single" checked  style="accent-color: #4facfe;">
                        <span>Single Animal Prediction</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                        <input type="radio" name="predictionMode" value="batch"  style="accent-color: #4facfe;">
                        <span>Batch Weight Prediction</span>
                    </label>
                </div>
            </div>

            <!-- Single Animal Prediction -->
            <div id="singlePredictionForm" style="display: block;">
                <h3>Single Animal Prediction</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0;">
                    <div>
                        <label style="display: block; margin-bottom: 0.5rem; color: #4facfe;">Animal ID:</label>
                        <select id="predictAnimal"  style="width: 100%; padding: 0.5rem; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #e0e0e0;">
                            <option value="">Select animal...</option>
                            ${processedData.validAnimals.map(a =>
                `<option value="${a.id}">${a.id} - ${a.group}</option>`
            ).join('')}
                        </select>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 0.5rem; color: #4facfe;">Last weight day:</label>
                        <input type="number" id="lastWeightDay" min="0" step="1" style="width: 100%; padding: 0.5rem; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #e0e0e0;" />
                        <small id="lastWeightDayHelp" style="display: block; margin-top: 0.25rem; color: #a0a0a0; font-size: 0.8rem;">Select an animal to see available days</small>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 0.5rem; color: #4facfe;">Last day tumor weight (g):</label>
                        <input type="number" id="lastTumorWeight" min="0" step="0.001" style="width: 100%; padding: 0.5rem; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #e0e0e0;" />
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 0.5rem; color: #4facfe;">Day to predict:</label>
                        <input type="number" id="predictDay" min="0" step="1" style="width: 100%; padding: 0.5rem; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #e0e0e0;" />
                        <small id="predictDayHelp" style="display: block; margin-top: 0.25rem; color: #a0a0a0; font-size: 0.8rem;">Select an animal to see valid range</small>
                    </div>
                </div>
                <button class="btn" onclick="predictValue()" style="margin: 1rem 0;">Calculate Prediction</button>
            </div>

            <!-- Batch Weight Prediction -->
            <div id="batchPredictionForm" style="display: none;">
                <h3>Batch Tumor Weight Prediction</h3>
                
                <!-- Auto-detection Status -->
                <div id="autoWeightStatus" style="margin: 1rem 0; display: block;">
                    <div id="autoWeightMessage" style="padding: 1rem; background: rgba(255, 255, 255, 0.05); border-radius: 8px; border-left: 4px solid #4facfe;">
                        <span style="color: #a0a0a0;">Initializing weight detection...</span>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0;">
                    <div>
                        <label style="display: block; margin-bottom: 0.5rem; color: #4facfe;">Target prediction day:</label>
                        <input type="number" id="batchPredictDay" min="0" step="1" style="width: 100%; padding: 0.5rem; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #e0e0e0;" />
                        <small style="display: block; margin-top: 0.25rem; color: #a0a0a0; font-size: 0.8rem;">Day to predict weights for all animals</small>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 0.5rem; color: #4facfe;">Statistical comparison:</label>
                        <select id="batchComparison" style="width: 100%; padding: 0.5rem; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #e0e0e0;">
                            <option value="none">No comparison</option>
                            <option value="mann-whitney" selected>Mann-Whitney U test</option>
                        </select>
                    </div>
                </div>
                <button class="btn" onclick="predictBatchWeights()" style="margin: 1rem 0;" disabled id="batchPredictBtn">Calculate Batch Predictions</button>
            </div>

            <div id="predictionResults" style="margin-top: 1rem; background: transparent; border-radius: 8px; display: none;"></div>
        `;
    }

    checkForTumorWeightColumn() {
        const autoWeightMessage = document.getElementById('autoWeightMessage');
        const batchPredictBtn = document.getElementById('batchPredictBtn');
        const rawData = this.rawData();
        
        if (!autoWeightMessage || !batchPredictBtn) return;
        
        if (!rawData || rawData.length === 0) {
            autoWeightMessage.innerHTML = `
                <span style="color: #ff6b6b;">No dataset loaded. Please load your main CSV file first.</span>
            `;
            batchPredictBtn.disabled = true;
            return;
        }
        
        // Actually check if Tumor_Weight column exists in the dataset
        const hasTumorWeight = rawData.length > 0 && rawData[0].hasOwnProperty('Tumor_Weight');
        
        // Update the internal flag
        this.setTumorWeightStatus(hasTumorWeight);
        
        if (hasTumorWeight) {
            this.extractTumorWeightsFromDataset();
        } else {
            autoWeightMessage.innerHTML = `
                <span style="color: #FFAA55;">No 'Tumor_Weight' column found in your dataset.</span>
                <br><small style="color: #a0a0a0; margin-top: 4px;">Batch weight prediction is not available without tumor weight data.</small>
            `;
            batchPredictBtn.disabled = true;
        }
    }

    extractTumorWeightsFromDataset() {
        const rawData = this.rawData();
        const autoWeightMessage = document.getElementById('autoWeightMessage');
        const batchPredictBtn = document.getElementById('batchPredictBtn');
        
        if (!rawData || !autoWeightMessage || !batchPredictBtn) return;

        try {
            const processedData = this.processedData();
            const tumorWeightsData = [];
            
            rawData.forEach(row => {
                const animalId = row.Animal;
                const group = row.Group;
                const tumorWeight = parseFloat(row['Tumor_Weight']);
                
                if (animalId && group && !isNaN(tumorWeight) && tumorWeight > 0) {
                    let lastDayWithData = null;
                    if (processedData && processedData.validAnimals) {
                        const animal = processedData.validAnimals.find(a => a.id === animalId);
                        if (animal && animal.timePoints && animal.timePoints.length > 0) {
                            const validDays = animal.timePoints
                                .map(day => parseFloat(day))
                                .filter(day => !isNaN(day))
                                .sort((a, b) => a - b);
                            if (validDays.length > 0) {
                                lastDayWithData = Math.max(...validDays);
                            }
                        }
                    }
                    
                    if (lastDayWithData !== null) {
                        tumorWeightsData.push({
                            animalId: animalId,
                            group: group,
                            day: lastDayWithData,
                            weight: tumorWeight
                        });
                    }
                }
            });

            if (tumorWeightsData.length > 0) {
                this.tumorWeightsData = tumorWeightsData;
                window.tumorWeightsData = tumorWeightsData; // For compatibility
                
                const rawData = this.rawData();
                const totalAnimals = rawData.length;
                const validWeights = tumorWeightsData.length;
                const groups = [...new Set(rawData.map(r => r.Group).filter(g => g))];
                
                autoWeightMessage.innerHTML = `
                    <div style="color: #84D288; margin-bottom: 12px;">
                        <strong>Tumor_Weight column detected successfully</strong>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 8px; font-size: 0.9em;">
                        <div style="background: rgba(79, 172, 254, 0.1); padding: 12px; border-radius: 8px; border-left: 4px solid #4facfe;">
                            <strong style="color: #4facfe;">Dataset Information:</strong><br>
                            • Total animals: <strong>${totalAnimals}</strong><br>
                            • Valid tumor weights: <strong>${validWeights}</strong><br>
                            • Treatment groups: <strong>${groups.length}</strong> (${groups.join(', ')})
                        </div>
                    </div>
                `;
                batchPredictBtn.disabled = false;
                
            } else {
                autoWeightMessage.innerHTML = `
                    <span style="color: #FFAA55;">Tumor_Weight column found but no valid weight data.</span>
                `;
                batchPredictBtn.disabled = true;
            }
        } catch (error) {
            autoWeightMessage.innerHTML = `
                <span style="color: #ff6b6b;">Error processing Tumor_Weight data: ${error.message}</span>
            `;
            batchPredictBtn.disabled = true;
        }
    }

    predictSingleAnimal() {
        const animalId = document.getElementById('predictAnimal').value;
        const day = parseFloat(document.getElementById('predictDay').value);
        const lastWeight = parseFloat(document.getElementById('lastTumorWeight').value);
        const lastWeightDay = parseFloat(document.getElementById('lastWeightDay').value);
        const animalModels = this.animalModels();

        if (!animalId || !animalModels[animalId] || isNaN(day)) {
            this.showNotification('Please select a valid animal and day', 'warning');
            return;
        }

        const animal = animalModels[animalId];
        const processedData = this.processedData();

        const exponent = animal.model.r * day;
        if (Math.abs(exponent) > 12) {
            this.showNotification('Prediction value too extreme - model may be unstable', 'warning');
            return;
        }
        
        const predictedMeasurement = animal.model.a * this._fastExp(exponent);

        const dataType = processedData.dataType;
        const paramLabel = dataType === 'volume' ? 'Predicted volume' : 'Predicted BLI';
        const unitLabel = dataType === 'volume' ? ' mm³' : '';

        const predictedValue = dataType === 'bli' ?
            predictedMeasurement.toExponential(3) :
            predictedMeasurement.toFixed(2);

        let weightPrediction = '';
        if (!isNaN(lastWeight) && !isNaN(lastWeightDay)) {
            // Calculate volume-weight relationship if we have weight data
            const lastVolume = animal.model.a * this._fastExp(animal.model.r * lastWeightDay);
            const volumeWeightRatio = lastWeight / lastVolume;
            const predictedWeight = predictedMeasurement * volumeWeightRatio;
            
            weightPrediction = `
                <div style="margin-top: 1rem; padding: 1rem; background: rgba(165, 94, 234, 0.1); border-radius: 8px; border-left: 4px solid #a55eea;">
                    <h4 style="margin: 0 0 0.5rem 0;">Weight Prediction</h4>
                    <p style="margin: 0;"><strong>Predicted tumor weight:</strong> ${predictedWeight.toFixed(3)} g</p>
                    <small style="color: #a0a0a0;">Based on volume-weight ratio from day ${lastWeightDay}</small>
                </div>
            `;
        }

        const modelQuality = animal.model.r2 >= 0.9 ? 'Excellent' : animal.model.r2 >= 0.8 ? 'Good' : animal.model.r2 >= 0.7 ? 'Fair' : 'Poor';
        const modelQualityColor = animal.model.r2 >= 0.9 ? '#28a745' : animal.model.r2 >= 0.8 ? '#17a2b8' : animal.model.r2 >= 0.7 ? '#ffc107' : '#dc3545';
        
        const selectedAnimal = processedData.validAnimals.find(a => a.id === animalId);
        if (!selectedAnimal || !selectedAnimal.timePoints) {
            return;
        }
        
        const days = selectedAnimal.timePoints.map(day => parseFloat(day)).sort((a, b) => a - b);
        const minDay = Math.min(...days);
        const maxDay = Math.max(...days);
        
        const resultHtml = `
            <div style="background: rgba(79, 172, 254, 0.1); padding: 1.5rem; border-radius: 12px; border-left: 4px solid #4facfe;">
                <h3 style="margin: 0 0 1rem 0; color: #4facfe;">Single Animal Prediction Results</h3>
                
                <!-- Main prediction result -->
                <div style="background: rgba(255, 255, 255, 0.05); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <p style="margin: 0 0 0.5rem 0;"><strong>Animal:</strong> ${animalId} (${animal.group})</p>
                            <p style="margin: 0;"><strong>Target Day:</strong> ${day}</p>
                        </div>
                        <div>
                            <p style="margin: 0 0 0.5rem 0;"><strong>${paramLabel}:</strong> ${predictedValue}${unitLabel}</p>
                            <p style="margin: 0;"><strong>Model Quality:</strong> <span style="color: ${modelQualityColor};">${modelQuality}</span> (R² = ${animal.model.r2.toFixed(4)})</p>
                        </div>
                    </div>
                </div>
                
                <!-- Model information panel -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div style="background: rgba(165, 94, 234, 0.1); padding: 1rem; border-radius: 8px; border-left: 4px solid #a55eea;">
                        <h4 style="margin: 0 0 0.5rem 0; color: #a55eea;">Model Parameters</h4>
                        <p style="margin: 0 0 0.25rem 0;"><strong>Initial value (a):</strong> ${animal.model.a.toFixed(3)}</p>
                        <p style="margin: 0 0 0.25rem 0;"><strong>Growth rate (r):</strong> ${animal.model.r.toFixed(6)}/day</p>
                        <p style="margin: 0;"><strong>Daily growth:</strong> ${(animal.model.r * 100).toFixed(2)}%/day</p>
                    </div>
                    <div style="background: rgba(40, 167, 69, 0.1); padding: 1rem; border-radius: 8px; border-left: 4px solid #28a745;">
                        <h4 style="margin: 0 0 0.5rem 0; color: #28a745;">Data Coverage</h4>
                        <p style="margin: 0 0 0.25rem 0;"><strong>Available days:</strong> ${days.join(', ')}</p>
                        <p style="margin: 0 0 0.25rem 0;"><strong>Data range:</strong> Day ${minDay} - ${maxDay}</p>
                        <p style="margin: 0;"><strong>Measurements:</strong> ${days.length} time points</p>
                    </div>
                </div>
                
                ${weightPrediction}
            </div>
        `;

        const resultsDiv = document.getElementById('predictionResults');
        resultsDiv.innerHTML = resultHtml;
        resultsDiv.style.display = 'block';
        
        this.showNotification('Prediction calculated successfully', 'success');
    }

    predictBatchWeights() {
        if (!this.tumorWeightsData) {
            this.showNotification('Tumor weight data not available', 'warning');
            return;
        }

        const targetDay = parseFloat(document.getElementById('batchPredictDay').value);
        const comparisonType = document.getElementById('batchComparison').value;
        const animalModels = this.animalModels();

        if (isNaN(targetDay) || targetDay <= 0) {
            this.showNotification('Please enter a valid target day', 'warning');
            return;
        }

        if (!animalModels || Object.keys(animalModels).length === 0) {
            this.showNotification('No animal models available', 'error');
            return;
        }

        try {
            const predictions = this.generateBatchPredictions(animalModels, targetDay);
            
            const experimentalWeights = this.getExperimentalWeights(predictions);
            
            let comparisonResults = null;
            if (comparisonType === 'mann-whitney' && experimentalWeights.length > 0) {
                comparisonResults = this.performStatisticalComparison(predictions);
            }

            this.batchPredictionResults = {
                predictions: predictions,
                experimentalWeights: experimentalWeights,
                comparisonResults: comparisonResults,
                targetDay: targetDay
            };
            window.batchPredictionResults = this.batchPredictionResults; // For compatibility
            
            window.batchPredictionForReport = this.batchPredictionResults;

            this.displayBatchPredictionResults(predictions, experimentalWeights, comparisonResults);
            
            this.showNotification(`Generated ${predictions.length} batch predictions (automatically included in reports)`, 'success');
            
        } catch (error) {
            this.showNotification(`Error generating batch predictions: ${error.message}`, 'error');
        }
    }

    generateBatchPredictions(animalModels, targetDay) {
        const predictions = [];
        
        Object.entries(animalModels).forEach(([animalId, animal]) => {
            try {
                const exponent = animal.model.r * targetDay;
                if (Math.abs(exponent) > 12) return;

                const predictedVolume = animal.model.a * Math.exp(exponent);
                
                const experimentalWeight = this.tumorWeightsData.find(w => w.animalId === animalId);
                
                if (experimentalWeight) {
                    const sacrificeDay = experimentalWeight.day;
                    
                    const sacrificeDayExponent = animal.model.r * sacrificeDay;
                    if (Math.abs(sacrificeDayExponent) > 12) return;
                    
                    // Get the actual experimental volume at sacrifice day from the dataset (not from model)
                    const processedData = this.processedData();
                    let experimentalVolumeAtSacrifice = null;
                    
                    if (processedData && processedData.validAnimals) {
                        const animalData = processedData.validAnimals.find(a => a.id === animalId);
                        if (animalData && animalData.timePoints && animalData.measurements) {
                            const dayIndex = animalData.timePoints.findIndex(day => parseFloat(day) === sacrificeDay);
                            if (dayIndex !== -1 && animalData.measurements[dayIndex] !== undefined) {
                                experimentalVolumeAtSacrifice = parseFloat(animalData.measurements[dayIndex]);
                            }
                        }
                    }
                    
                    if (experimentalVolumeAtSacrifice === null || experimentalVolumeAtSacrifice <= 0) return;
                    
                    if (!isFinite(experimentalVolumeAtSacrifice) || !isFinite(predictedVolume) || 
                        isNaN(experimentalVolumeAtSacrifice) || isNaN(predictedVolume)) return;
                    
                    // Calculate animal-specific volume-to-weight density ratio
                    const volumeWeightRatio = experimentalWeight.weight / experimentalVolumeAtSacrifice;
                    
                    // Apply this ratio to the predicted volume for target day
                    const predictedWeight = predictedVolume * volumeWeightRatio;
                    
                    if (!isFinite(predictedWeight) || isNaN(predictedWeight)) return;
                    
                    predictions.push({
                        animalId: animalId,
                        group: animal.group,
                        predictedVolume: predictedVolume,
                        predictedWeight: predictedWeight,
                        experimentalWeight: experimentalWeight.weight,
                        targetDay: targetDay,
                        r2: animal.model.r2
                    });
                }
            } catch (error) {}
        });

        return predictions;
    }

    getExperimentalWeights(predictions) {
        if (!this.tumorWeightsData || !predictions) {
            return [];
        }
        
        const animalModels = this.animalModels();
        const processedData = this.processedData();
        
        
        return this.tumorWeightsData.map(expWeight => {
            const prediction = predictions.find(p => p.animalId === expWeight.animalId);
            
            let predictionError = null;
            let actualMeasurement = null;
            let predictedMeasurement = null;
            let sacrificeDay = null; // Will find the last day with measurements for this animal
            
            if (prediction && animalModels[expWeight.animalId]) {
                const animal = animalModels[expWeight.animalId];
                const targetDay = prediction.targetDay;
                
                // Find the animal data from processed data
                const animalData = processedData.validAnimals.find(a => a.id === expWeight.animalId);
                
                if (animalData && animalData.timePoints && animalData.measurements) {
                    // Data structure: animal.timePoints[] and animal.measurements[] are parallel arrays
                    const days = animalData.timePoints.map(day => parseFloat(day));
                    const minDay = Math.min(...days);
                    const maxDay = Math.max(...days);
                    
                    // The sacrifice day is the last day with measurements for this animal
                    sacrificeDay = maxDay;
                    
                    // Check if target day is within experimental range (same logic as original)
                    if (targetDay >= minDay && targetDay <= maxDay) {
                        // Find actual experimental measurement for target day
                        const dayIndex = animalData.timePoints.findIndex(day => parseFloat(day) === targetDay);
                        
                        if (dayIndex !== -1 && animalData.measurements[dayIndex] !== undefined) {
                            actualMeasurement = parseFloat(animalData.measurements[dayIndex]);
                            
                            const predictionExponent = animal.model.r * targetDay;
                            if (Math.abs(predictionExponent) <= 12) {
                                predictedMeasurement = animal.model.a * this._fastExp(predictionExponent);
                                if (actualMeasurement > 0 && !isNaN(actualMeasurement) && isFinite(predictedMeasurement)) {
                                    predictionError = Math.abs((predictedMeasurement - actualMeasurement) / actualMeasurement * 100);
                                }
                            }
                        }
                    }
                }
            }
            
            return {
                animalId: expWeight.animalId,
                group: expWeight.group,
                experimentalWeight: expWeight.weight,
                predictionError: predictionError,
                sacrificeDay: sacrificeDay,
                actualMeasurement: actualMeasurement,
                predictedMeasurement: predictedMeasurement
            };
        });
    }

    performStatisticalComparison(predictions) {
        if (!predictions || predictions.length === 0) return null;

        const groupedPredictions = {};
        predictions.forEach(pred => {
            if (!groupedPredictions[pred.group]) {
                groupedPredictions[pred.group] = [];
            }
            groupedPredictions[pred.group].push(pred);
        });

        const groups = Object.keys(groupedPredictions);
        if (groups.length < 2) return null;

        const comparisons = [];
        
        for (let i = 0; i < groups.length; i++) {
            for (let j = i + 1; j < groups.length; j++) {
                const group1 = groups[i];
                const group2 = groups[j];
                
                const weights1 = groupedPredictions[group1].map(p => p.predictedWeight);
                const weights2 = groupedPredictions[group2].map(p => p.predictedWeight);
                
                try {
                    const mannWhitneyResult = MathUtils.mannWhitneyUTest(weights1, weights2);
                    const cohensD = MathUtils.calculateCohensD(weights1, weights2);
                    
                    const median1 = MathUtils.calculateMedian(weights1);
                    const median2 = MathUtils.calculateMedian(weights2);
                    const n1 = weights1.length;
                    const n2 = weights2.length;
                    const effectSizeLabel = Math.abs(cohensD.value) < 0.2 ? 'Negligible' : 
                                          Math.abs(cohensD.value) < 0.5 ? 'Small' :
                                          Math.abs(cohensD.value) < 0.8 ? 'Medium' : 'Large';
                    
                    comparisons.push({
                        group1: group1,
                        group2: group2,
                        n1: n1,
                        n2: n2,
                        median1: median1,
                        median2: median2,
                        u: mannWhitneyResult.U,
                        pValue: mannWhitneyResult.p,
                        cohensD: cohensD.value,
                        effectSize: effectSizeLabel,
                        significant: mannWhitneyResult.p < 0.05
                    });
                } catch (error) {}
            }
        }

        return {
            comparisons: comparisons,
            groupedData: groupedPredictions
        };
    }

    displayBatchPredictionResults(predictions, experimentalWeights, comparisonResults) {
        if (!predictions || predictions.length === 0) {
            this.showNotification('No valid predictions generated', 'warning');
            return;
        }

        const resultsDiv = document.getElementById('predictionResults');
        resultsDiv.style.display = 'block';
        
        const groupStats = {};
        predictions.forEach(pred => {
            if (!groupStats[pred.group]) {
                groupStats[pred.group] = [];
            }
            groupStats[pred.group].push(pred.predictedWeight);
        });
        
        let summaryHtml = `
            <h3>Batch Prediction Results (Day ${predictions[0].targetDay})</h3>
            <div style="background: transparent; border-radius: 8px; margin: 10px 0;">
                <h4>Group Summary</h4>
                ${Object.entries(groupStats).map(([group, weights]) => `
                    <p style="padding-left: 15px;"><strong>${group}:</strong> n=${weights.length}, median=${MathUtils.calculateMedian(weights).toFixed(3)}g, range=${Math.min(...weights).toFixed(3)}-${Math.max(...weights).toFixed(3)}g</p>
                `).join('')}
            </div>
        `;
        
        if (experimentalWeights.length > 0) {
            const validErrors = experimentalWeights.filter(w => w.predictionError !== null);
            
            let errorDisplay = '';
            let errorColor = '#666';
            
            if (validErrors.length > 0) {
                const avgError = validErrors.reduce((sum, w) => sum + w.predictionError, 0) / validErrors.length;
                errorColor = avgError < 10 ? '#84D288' : avgError < 20 ? '#FFAA55' : '#E68989';
                errorDisplay = `<span style="font-weight: bold; color: ${errorColor};">${avgError.toFixed(1)}%</span>`;
            } else {
                errorDisplay = `<span style="color: ${errorColor};">Cannot be calculated (no experimental measurements for target days)</span>`;
            }
            
            summaryHtml += `
                <div class="prediction-validation-panel" style="background: rgba(165, 94, 234, 0.1); padding: 15px; border-radius: 8px; margin: 10px 0px; border-left: 4px solid #a55eea;">
                    <h4 style="margin-bottom: 15px;">Prediction Validation</h4>
                    <p><strong>Animals with experimental weights:</strong> ${experimentalWeights.length}</p>
                    <p><strong>Animals with calculable errors:</strong> ${validErrors.length}</p>
                    <p><strong>Average prediction error:</strong> ${errorDisplay}</p>
                </div>
            `;
        }
        
        if (comparisonResults && comparisonResults.comparisons.length > 0) {
            summaryHtml += `
                <div class="prediction-statistical-comparison-table" style="background: transparent; padding: 15px; border-radius: 8px; margin: 10px 0;">
                    <h4>Statistical Comparison (Mann-Whitney U Test)</h4>
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
                            <thead>
                                <tr style="background: rgba(0,0,0,0.1);">
                                    <th style="padding: 8px;text-align: left;">Comparison</th>
                                    <th style="padding: 8px; text-align: center;">n₁</th>
                                    <th style="padding: 8px; text-align: center;">n₂</th>
                                    <th style="padding: 8px; text-align: center;">Median₁ (g)</th>
                                    <th style="padding: 8px; text-align: center;">Median₂ (g)</th>
                                    <th style="padding: 8px; text-align: center;">U</th>
                                    <th style="padding: 8px; text-align: center;">p-value</th>
                                    <th style="padding: 8px; text-align: center;">Cohen's d</th>
                                    <th style="padding: 8px; text-align: center;">Significant</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${comparisonResults.comparisons.map(comp => `
                                    <tr style="background: ${comp.significant ? 'rgba(244, 67, 54, 0.1)' : 'transparent'};">
                                        <td style="padding: 8px; font-weight: bold; text-align: left;">${comp.group1} vs ${comp.group2}</td>
                                        <td style="padding: 8px; text-align: center;">${comp.n1}</td>
                                        <td style="padding: 8px; text-align: center;">${comp.n2}</td>
                                        <td style="padding: 8px; text-align: center;">${comp.median1.toFixed(3)}</td>
                                        <td style="padding: 8px; text-align: center;">${comp.median2.toFixed(3)}</td>
                                        <td style="padding: 8px; text-align: center;">${comp.u.toFixed(0)}</td>
                                        <td style="padding: 8px; text-align: center;">${comp.significant ? `<span style="color: #00f2fe; font-weight: bold;">${comp.pValue.toFixed(3)} (${MathUtils.getAsteriskNotation(comp.pValue)})</span>` : `${comp.pValue.toFixed(4)} (${MathUtils.getAsteriskNotation(comp.pValue)})`}</td>
                                        <td style="padding: 8px; text-align: center;">
                                            ${comp.effectSize}<br>
                                            <small style="color: #a0a0a0;">(d=${Math.abs(comp.cohensD).toFixed(3)})</small>
                                        </td>
                                        <td style="padding: 8px; text-align: center;">
                                            ${comp.significant ? '<span style="color: #00f2fe; font-weight: bold;">Significant</span>' : '<span style="color: #a0a0a0; font-weight: bold;">Not significant</span>'}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <p style="margin-top: 10px; font-size: 0.9em; color: #666;"><strong>*</strong> p < 0.05 (statistically significant)</p>
                </div>
            `;
        }
        
        summaryHtml += `
            <div class="individual-predictions-table" style="background: transparent; padding: 15px; border-radius: 8px; margin: 10px 0;">
                <h4>Individual Predictions</h4>
                <div style="max-height: 400px; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: rgba(0,0,0,0.1);">
                                <th style="padding: 8px; text-align: left;">Animal_ID</th>
                                <th style="padding: 8px;">Group</th>
                                <th style="padding: 8px;">Model R²</th>
                                <th style="padding: 8px;">Predicted Weight (g)<br><small>Day ${predictions[0].targetDay}</small></th>
                                <th style="padding: 8px;">Experimental Weight (g)<br><small>Sacrifice Day</small></th>
                                <th style="padding: 8px;">Error (%) *</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${predictions.map(pred => {
                                const exp = experimentalWeights.find(e => e.animalId === pred.animalId);
                                
                                // Apply same color pattern as Single Animal Prediction
                                let errorDisplay = 'N/A';
                                let errorColor = '#666';
                                
                                if (exp && exp.predictionError !== null) {
                                    const percentError = exp.predictionError;
                                    errorColor = percentError < 10 ? '#84D288' : percentError < 20 ? '#FFAA55' : '#E68989';
                                    errorDisplay = `<span style="font-weight: bold; color: ${errorColor};">${percentError.toFixed(1)}%</span>`;
                                }
                                
                                // Color coding for R² quality
                                const r2 = pred.r2 || 0;
                                const r2Color = r2 >= 0.9 ? '#28a745' : r2 >= 0.8 ? '#17a2b8' : r2 >= 0.7 ? '#ffc107' : '#dc3545';
                                const r2Quality = r2 >= 0.9 ? 'Excellent' : r2 >= 0.8 ? 'Good' : r2 >= 0.7 ? 'Fair' : 'Poor';
                                
                                return `
                                    <tr>
                                        <td style="padding: 8px; text-align: left;">${pred.animalId}</td>
                                        <td style="padding: 8px;">${pred.group}</td>
                                        <td style="padding: 8px; color: ${r2Color}; text-align: center;">${r2.toFixed(4)}<br><small style="color: ${r2Color};">${r2Quality}</small></td>
                                        <td style="padding: 8px;">${pred.predictedWeight.toFixed(3)}<br><small>Day ${pred.targetDay}</small></td>
                                        <td style="padding: 8px;">${exp ? exp.experimentalWeight.toFixed(3) + '<br><small>Day ' + exp.sacrificeDay + '</small>' : 'N/A'}</td>
                                        <td style="padding: 8px;">${errorDisplay}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                <p style="margin-top: 10px; font-size: 0.9em; color: #a0a0a0;">
                    <strong>*</strong> Error color coding: 
                    <span style="color: #84D288; font-weight: bold;">Green (&lt; 10%)</span> - Excellent, 
                    <span style="color: #FFAA55; font-weight: bold;">Orange (10-20%)</span> - Good, 
                    <span style="color: #E68989; font-weight: bold;">Red (&gt; 20%)</span> - Fair
                </p>
            </div>
        `;
        
        summaryHtml += `
            <div style="margin: 15px 0;">
                <button class="btn secondary" onclick="exportManager.export('batch')">Export CSV</button>
            </div>
        `;
        
        resultsDiv.innerHTML = summaryHtml;
    }


    getBatchPredictionResults() {
        return this.batchPredictionResults;
    }

    getTumorWeightsData() {
        return this.tumorWeightsData;
    }


    handleAnimalSelectionChange() {
        const animalSelect = document.getElementById('predictAnimal');
        const lastWeightDayHelp = document.getElementById('lastWeightDayHelp');
        const predictDayHelp = document.getElementById('predictDayHelp');
        const lastWeightDayInput = document.getElementById('lastWeightDay');
        const predictDayInput = document.getElementById('predictDay');
        const animalModels = this.animalModels();
        
        if (!animalSelect || !animalModels) return;
        
        const selectedAnimalId = animalSelect.value;
        
        if (!selectedAnimalId || !animalModels[selectedAnimalId]) {
            if (lastWeightDayHelp) {
                lastWeightDayHelp.innerHTML = 'Select an animal to see available days';
                lastWeightDayHelp.style.color = '#a0a0a0';
            }
            if (predictDayHelp) {
                predictDayHelp.innerHTML = 'Select an animal to see valid range';
                predictDayHelp.style.color = '#a0a0a0';
            }
            return;
        }
        
        const processedData = this.processedData();
        const selectedAnimal = processedData.validAnimals.find(a => a.id === selectedAnimalId);
        
        if (selectedAnimal && selectedAnimal.timePoints && selectedAnimal.timePoints.length > 0) {
            // Data structure: animal.timePoints[] and animal.measurements[] are parallel arrays
            const days = selectedAnimal.timePoints
                .map(day => parseFloat(day))
                .filter(day => !isNaN(day))
                .sort((a, b) => a - b);
            
            if (days.length === 0) {
                if (lastWeightDayHelp) lastWeightDayHelp.innerHTML = 'No valid days found for this animal';
                if (predictDayHelp) predictDayHelp.innerHTML = 'No valid days found for this animal';
                return;
            }
            
            const minDay = Math.min(...days);
            const maxDay = Math.max(...days);
            const daysCount = days.length;
            
            if (lastWeightDayHelp) {
                lastWeightDayHelp.innerHTML = `
                    <div style="background: rgba(79, 172, 254, 0.1); padding: 8px; border-radius: 6px; margin-top: 4px; border-left: 3px solid #4facfe;">
                        <strong style="color: #4facfe;">Available days with data:</strong><br>
                        • Days: ${days.join(', ')}<br>
                        • Range: Day ${minDay} - ${maxDay}<br>
                        • Total measurements: ${daysCount}
                    </div>
                `;
                lastWeightDayHelp.style.color = '#e0e0e0';
            }
            
            if (predictDayHelp) {
                predictDayHelp.innerHTML = `
                    <div style="background: rgba(165, 94, 234, 0.1); padding: 8px; border-radius: 6px; margin-top: 4px; border-left: 3px solid #a55eea;">
                        <strong style="color: #a55eea;">Prediction guidelines:</strong><br>
                        • Reliable range: Day ${minDay} - ${maxDay + 7}<br>
                        • Model R²: ${animalModels[selectedAnimalId].model.r2.toFixed(4)}<br>
                        • Growth rate: ${(animalModels[selectedAnimalId].model.r * 100).toFixed(2)}%/day
                    </div>
                `;
                predictDayHelp.style.color = '#e0e0e0';
            }
            
            if (lastWeightDayInput && !isNaN(maxDay)) {
                lastWeightDayInput.value = maxDay; // Use the last available day
                lastWeightDayInput.min = minDay;
                lastWeightDayInput.max = maxDay;
            }
            
            if (predictDayInput && !isNaN(maxDay)) {
                predictDayInput.value = maxDay + 3; // Predict 3 days ahead by default
                predictDayInput.min = minDay;
            }
            
        }
    }

    reset() {
        this.tumorWeightsData = null;
        this.batchPredictionResults = null;
        this.hasTumorWeightColumn = false;
        
        window.batchPredictionResults = null;
        window.tumorWeightsData = null;
        window.hasTumorWeightColumn = false;
    }
}

const predictionService = new PredictionService();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PredictionService;
}

if (typeof window !== 'undefined') {
    window.PredictionService = PredictionService;
    window.predictionService = predictionService;
}
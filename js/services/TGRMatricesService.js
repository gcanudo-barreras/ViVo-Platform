// TGR service for tumor growth rate calculations

class TGRMatricesService {
    constructor() {
        this.growthMatrices = {};
        this.selectedCells = [];
        this.tgrComparisons = [];
        this.controlGroup = null;
        this.optimizedColorRange = { min: 0, max: 0.1 };
        this.customColorRange = null;
        this.useWebWorkers = window.location.protocol !== 'file:' && typeof Worker !== 'undefined';
        
        this.processedData = null;
        this.showNotification = null;
        this.debugLog = null;
    }

    init(dependencies) {
        this.showNotification = dependencies.showNotification || (() => {});
        this.debugLog = dependencies.debugLog || (() => {});
        
        window.tgrMatricesService = this;
        window.generateGrowthMatrices = () => this.generateGrowthMatrices();
        window.selectTGRCell = (cellElement) => this.selectTGRCell(cellElement);
        window.compareAllTGRIntervals = () => this.compareAllTGRIntervals();
        window.clearAllTGRComparisons = () => this.clearAllTGRComparisons();
        window.removeTGRComparison = (comparisonId) => this.removeTGRComparison(comparisonId);
        window.captureTGRComparisons = () => this.captureTGRComparisons();
        window.createReportMatrixTable = (matrix, groupName) => this.createReportMatrixTable(matrix, groupName);
        window.createReportColorLegend = () => this.createReportColorLegend();
    }

    async generateGrowthMatrices() {
        if (!window.processedData || !window.processedData.validAnimals || window.processedData.validAnimals.length === 0) {
            this.showNotification('Analyze data first to generate matrices', 'warning');
            return;
        }
        
        this.processedData = window.processedData;

        const existingMatrix = this._checkExistingMatrices();
        if (existingMatrix) {
            this.showNotification('TGR Matrices have already been generated', 'warning');
            return;
        }

        this.showNotification('Generating TGR Matrices...', 'info');

        const groups = Object.entries(this.processedData.groupStats).filter(([, stats]) => stats.valid > 0);
        
        for (const [group, stats] of groups) {
            const matrix = await this._calculateGrowthMatrix(group);
                this.growthMatrices[group] = matrix;
        }

        this._identifyControlGroupAndCalculateRange();
        this._displayOptimizedGrowthMatrices();

        window.growthMatrices = this.growthMatrices;
        window.tgrComparisons = this.tgrComparisons;
        window.optimizedColorRange = this.optimizedColorRange;
        window.controlGroup = this.controlGroup;

        this.showNotification('TGR Matrices generated', 'success');
    }

    async _calculateGrowthMatrix(groupName) {
        const groupAnimals = this.processedData.validAnimals.filter(a => a.group === groupName);
        const allDays = [...new Set(groupAnimals.flatMap(a => a.timePoints))].sort((a, b) => a - b);
        if (this.useWebWorkers && allDays.length > 5) {
            try {
                return await this._calculateMatrixWithWorker(allDays, groupAnimals, groupName);
            } catch (error) {
                console.warn(`TGR Worker failed for ${groupName}, using sync:`, error.message);
                return this._calculateMatrixSync(allDays, groupAnimals, groupName);
            }
        }
        
        return this._calculateMatrixSync(allDays, groupAnimals, groupName);
    }
    
    async _calculateMatrixWithWorker(allDays, groupAnimals, groupName) {
        return new Promise((resolve, reject) => {
            const worker = new Worker('./js/workers/TGRCalculationWorker.js');
            
            worker.postMessage({ allDays, animals: groupAnimals, workerId: groupName });
            
            worker.onmessage = (e) => {
                const { success, result, error } = e.data;
                worker.terminate();
                
                if (success) {
                    result.group = groupName;
                    resolve(result);
                } else {
                    reject(new Error(`TGR Worker failed for ${groupName}: ${error}`));
                }
            };
            
            worker.onerror = () => {
                worker.terminate();
                reject(new Error(`TGR Worker error for ${groupName}`));
            };
        });
    }
    
    _calculateMatrixSync(allDays, groupAnimals, groupName) {
        const matrix = {
            days: allDays,
            values: Array(allDays.length).fill().map(() => Array(allDays.length).fill(0)),
            individualData: {},
            group: groupName
        };
        
        for (let i = 0; i < allDays.length; i++) {
            for (let j = i + 1; j < allDays.length; j++) {
                const dayX = allDays[i];
                const dayY = allDays[j];
                const individualTGRs = [];
                
                for (const animal of groupAnimals) {
                    const xIdx = animal.timePoints.indexOf(dayX);
                    const yIdx = animal.timePoints.indexOf(dayY);
                    
                    if (xIdx !== -1 && yIdx !== -1) {
                        const valueX = animal.measurements[xIdx];
                        const valueY = animal.measurements[yIdx];
                        
                        if (valueX > 0 && valueY > 0) {
                            // Use consolidated TGR calculation from MathUtils
                            const r = MathUtils.calculateTumorGrowthRate(valueX, valueY, dayX, dayY);
                            if (!isNaN(r)) {
                                individualTGRs.push(r);
                            }
                        }
                    }
                }
                
                if (individualTGRs.length > 0) {
                    // Use consolidated mean calculation from MathUtils
                    const avg = MathUtils.calculateMean(individualTGRs);
                    matrix.values[i][j] = avg;
                    matrix.values[j][i] = avg;
                    matrix.individualData[`${dayX}-${dayY}`] = individualTGRs;
                }
            }
        }
        
        return matrix;
    }

    _identifyControlGroupAndCalculateRange() {
        this.controlGroup = null;
        const groupKeys = Object.keys(this.processedData?.groupStats || {});
        
        groupKeys.forEach(group => {
            if (group.toLowerCase().includes('control') ||
                group.toLowerCase().includes('ctrl') ||
                group.toLowerCase().includes('vehiculo') ||
                group.toLowerCase().includes('vehicle')) {
                this.controlGroup = group;
            }
        });

        if (!this.controlGroup && groupKeys.length > 0) {
            this.controlGroup = groupKeys[0];
        }
        if (this.growthMatrices[this.controlGroup]) {
            const controlMatrix = this.growthMatrices[this.controlGroup];
            let controlValues = [];
            controlMatrix.values.forEach(row => {
                row.forEach(val => {
                    if (val !== null && !isNaN(val) && val !== 0) {
                        controlValues.push(val);
                    }
                });
            });
            
            const controlMin = controlValues.length > 0 ? Math.min(...controlValues) : 0;
            const allValues = [];
            Object.values(this.growthMatrices).forEach(matrix => {
                matrix.values.forEach(row => {
                    row.forEach(val => {
                        if (val !== null && !isNaN(val) && val !== 0) {
                            allValues.push(val);
                        }
                    });
                });
            });

            const globalMaxVal = allValues.length > 0 ? Math.max(...allValues) : 0;
            this.optimizedColorRange.min = controlMin * 0.5;
            this.optimizedColorRange.max = globalMaxVal * 0.75;
            
            this.debugLog('Optimized range calculated:', {
                controlValues: controlValues.length,
                controlMin: controlMin,
                globalMax: globalMaxVal,
                optimizedRange: this.optimizedColorRange
            });
        } else {
            this.debugLog('Matrix not found for control group, using default values');
            this.optimizedColorRange.min = 0;
            this.optimizedColorRange.max = 0.1;
        }
    }

    _displayOptimizedGrowthMatrices() {
        const card = document.createElement('div');
        card.className = 'result-card';

        let html = '<h2>Tumor Growth Rate Matrices (TGR)</h2>';
        html += '<p>Each matrix shows growth rates r<sub>x→y</sub> = log(N<sub>y</sub>/N<sub>x</sub>)/(t<sub>y</sub>-t<sub>x</sub>) between day pairs. Values are calculated using group averages.</p>';
        html += this._generateColorScaleControls();
        
        html += this._generateTGRFunctionalityLegend();

        const numGroups = Object.keys(this.growthMatrices).length;
        const hasLargeMatrices = Object.values(this.growthMatrices).some(matrix => matrix.days.length > 9);
        let containerClass = 'matrices-container';
        let gridStyle = '';

        if (hasLargeMatrices) {
            containerClass += ' large-matrix';
        } else if (numGroups <= 2) {
            gridStyle = 'grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));';
        } else if (numGroups === 3) {
            gridStyle = 'grid-template-columns: repeat(2, 1fr); grid-auto-flow: row;';
        } else {
            gridStyle = 'grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));';
        }

        html += `<div class="matrices-container${hasLargeMatrices ? ' large-matrix' : ''}" style="${gridStyle}">`;

        Object.entries(this.growthMatrices).forEach(([group, matrix]) => {
            html += `
                <div class="matrix-group">
                    <h3>${group}</h3>
                    ${this._createOptimizedMatrixTable(matrix)}
                </div>
            `;
        });

        html += '</div>';
        card.innerHTML = html;

        document.getElementById('results').appendChild(card);
        this._setupColorScaleControls();
        this._createTGRComparisonsContainer();
    }

    _generateColorScaleControls() {
        const currentRange = this._getCurrentColorRange();
        return `
            <div style="text-align: center; margin: 20px 0; padding: 20px; background: transparent; border-radius: 8px; border: 1px solid #e0e0e0;">
                <div style="font-weight: 500; margin-bottom: 15px;">Adjustable Color Scale</div>
                
                <div style="display: flex; justify-content: center; align-items: center; gap: 15px; margin-bottom: 15px; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <label style="font-size: 0.9em; color: white;">Minimum:</label>
                        <input 
                            type="number" 
                            id="colorScaleMin" 
                            value="${currentRange.min.toFixed(4)}" 
                            step="0.0001" 
                            style="width: 80px; padding: 4px 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.85em; text-align: center;"
                        >
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <label style="font-size: 0.9em; color: white;">Maximum:</label>
                        <input 
                            type="number" 
                            id="colorScaleMax" 
                            value="${currentRange.max.toFixed(4)}" 
                            step="0.0001" 
                            style="width: 80px; padding: 4px 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.85em; text-align: center;"
                        >
                    </div>
                    
                    <button 
                        id="updateScaleBtn"
                        style="padding: 4px 12px; background: #28a745; color: white; border: none; border-radius: 4px; font-size: 0.8em; cursor: pointer;"
                    >
                        Apply
                    </button>
                    
                    <button 
                        id="resetScaleBtn"
                        style="padding: 4px 12px; background: #6c757d; color: white; border: none; border-radius: 4px; font-size: 0.8em; cursor: pointer;"
                    >
                        Auto
                    </button>
                </div>
                
                <div style="display: flex; justify-content: center; align-items: center; gap: 20px; font-size: 0.9em; margin-bottom: 10px;">
                    <span style="display: flex; align-items: center; gap: 5px;">
                        <div style="width: 16px; height: 16px; background: rgb(100, 200, 100); border-radius: 3px; border: 1px solid #ccc;"></div>
                        Low
                    </span>
                    <span style="display: flex; align-items: center; gap: 5px;">
                        <div style="width: 16px; height: 16px; background: rgb(255, 255, 0); border-radius: 3px; border: 1px solid #ccc;"></div>
                        Medium
                    </span>
                    <span style="display: flex; align-items: center; gap: 5px;">
                        <div style="width: 16px; height: 16px; background: rgb(255, 0, 100); border-radius: 3px; border: 1px solid #ccc;"></div>
                        High
                    </span>
                </div>
                
                <div style="font-size: 0.8rem; color: white;">
                    Control group: <strong>${this.controlGroup}</strong>
                    <span id="scaleStatus">${this.customColorRange ? ' • <span style="color: #CACED1;">Custom scale</span>' : ' • <span style="color: #CACED1;">Automatic scale</span>'}</span>
                </div>
            </div>
        `;
    }

    _generateTGRFunctionalityLegend() {
        return `
            <div style="text-align: center; margin: 15px 0; padding: 15px; background: rgba(255, 255, 255, 0.05); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);">
                <div style="font-weight: 500; margin-bottom: 10px; color: #4facfe;">TGR Matrix Comparison Instructions</div>
                <div style="font-size: 0.85rem; color: #e0e0e0; line-height: 1.4;">
                    <strong>1. Select cells:</strong> Click on any matrix cell to select it<br>
                    <strong>2. Compare:</strong> When you select a second cell, automatic Mann-Whitney U comparison will be performed<br>
                    <strong>3. Deselect:</strong> Click the same cell again to deselect it<br>
                    <strong>4. View results:</strong> Statistical comparisons appear below the matrices with p-values, effect sizes, and significance indicators
                </div>
            </div>
        `;
    }

    _createOptimizedMatrixTable(matrix) {
        const days = matrix.days;
        const currentRange = this._getCurrentColorRange();

        let html = '<table class="matrix-table"><thead><tr><th></th>';
        days.slice(1).forEach(day => {
            html += `<th>D${day}</th>`;
        });
        html += '</tr></thead><tbody>';
        days.slice(0, -1).forEach((dayRow, i) => {
            html += `<tr><th>D${dayRow}</th>`;
            
            days.slice(1).forEach((dayCol, j) => {
                const actualJ = j + 1; 
                
                if (actualJ <= i) {
                    
                    html += '<td class="empty-cell"></td>';
                } else {
                    
                    const value = matrix.values[i][actualJ];
                    let cellContent = '';
                    let cellClass = 'matrix-cell';
                    let cellStyle = '';

                    if (value !== null && !isNaN(value)) {
                        cellContent = value.toFixed(4);
                        const bgColor = this._getOptimizedColorForValue(value, currentRange.min, currentRange.max);
                        const textColor = this._getContrastColor(bgColor);
                        cellStyle = `background-color: ${bgColor}; color: ${textColor};`;
                    } else {
                        cellContent = '—';
                        cellClass += ' empty-cell';
                    }

                    html += `<td class="${cellClass}" style="${cellStyle}" 
                                title="r(D${dayRow}→D${dayCol}) = ${cellContent}"
                                data-group="${matrix.group}" 
                                data-day-x="${dayRow}" 
                                data-day-y="${dayCol}"
                                data-value="${value}"
                                onclick="selectTGRCell(this)">${cellContent}</td>`;
                }
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        return html;
    }

    _getOptimizedColorForValue(value, minOverride = null, maxOverride = null) {
        if (value === null || isNaN(value)) return '#f8f9fa';

        const currentRange = this._getCurrentColorRange();
        const min = minOverride !== null ? minOverride : currentRange.min;
        const max = maxOverride !== null ? maxOverride : currentRange.max;

        // Normalizar valor entre 0 y 1
        const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));

        const t = normalized <= 0.5 ? normalized * 2 : (normalized - 0.5) * 2;
        const [r, g, b] = normalized <= 0.5 
            ? [100 + t * 155, 200 + t * 55, 100 * (1 - t)]
            : [255, 255 * (1 - t), 0];

        return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    }

    _getContrastColor(rgbColor) {
        const matches = rgbColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (!matches) return '#000';

        const r = parseInt(matches[1]);
        const g = parseInt(matches[2]);
        const b = parseInt(matches[3]);

        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? '#000' : '#fff';
    }

    _getCurrentColorRange() {
        return this.customColorRange || this.optimizedColorRange;
    }

    _setupColorScaleControls() {
        const updateBtn = document.getElementById('updateScaleBtn');
        const resetBtn = document.getElementById('resetScaleBtn');
        const minInput = document.getElementById('colorScaleMin');
        const maxInput = document.getElementById('colorScaleMax');

        if (updateBtn) {
            updateBtn.addEventListener('click', () => {
                const minVal = parseFloat(minInput.value);
                const maxVal = parseFloat(maxInput.value);

                if (isNaN(minVal) || isNaN(maxVal)) {
                    this.showNotification('Invalid values', 'warning');
                    return;
                }

                if (minVal >= maxVal) {
                    this.showNotification('Minimum must be less than maximum', 'warning');
                    return;
                }

                this.customColorRange = { min: minVal, max: maxVal };
                this._repaintAllMatrices();
                this._updateScaleStatus();
                this.showNotification('Scale updated', 'success');
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.customColorRange = null;
                minInput.value = this.optimizedColorRange.min.toFixed(4);
                maxInput.value = this.optimizedColorRange.max.toFixed(4);
                this._repaintAllMatrices();
                this._updateScaleStatus();
                this.showNotification('Automatic scale restored', 'info');
            });
        }
        [minInput, maxInput].forEach(input => {
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        updateBtn.click();
                    }
                });
            }
        });
    }

    _repaintAllMatrices() {
        const matrixGroups = document.querySelectorAll('.matrix-group');

        matrixGroups.forEach(group => {
            const groupTitle = group.querySelector('h3').textContent;
            const matrix = this.growthMatrices[groupTitle];

            if (matrix) {
                const table = group.querySelector('table');
                if (table) {
                    
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = this._createOptimizedMatrixTable(matrix);
                    const newTable = tempDiv.querySelector('table');
                    table.parentNode.replaceChild(newTable, table);
                }
            }
        });
    }

    _updateScaleStatus() {
        const statusElement = document.getElementById('scaleStatus');
        if (statusElement) {
            statusElement.innerHTML = this.customColorRange ?
                ' • <span style="color: #28a745;">Custom scale</span>' :
                ' • <span style="color: #CACED1;">Automatic scale</span>';
        }
    }

    selectTGRCell(cellElement) {
        const group = cellElement.dataset.group;
        const dayX = parseInt(cellElement.dataset.dayX);
        const dayY = parseInt(cellElement.dataset.dayY);
        const value = parseFloat(cellElement.dataset.value);
        
        if (isNaN(value)) return;
        
        const cellId = `${group}-${dayX}-${dayY}`;
        const existingIndex = this.selectedCells.findIndex(cell => cell.id === cellId);
        
        if (existingIndex !== -1) {
            // Deseleccionar celda
            this.selectedCells.splice(existingIndex, 1);
            cellElement.classList.remove('tgr-selected');
            cellElement.style.border = '';
            cellElement.style.boxShadow = '';
        } else {
            // Seleccionar celda
            const cellData = {
                id: cellId,
                element: cellElement,
                group: group,
                dayX: dayX,
                dayY: dayY,
                value: value
            };
            this.selectedCells.push(cellData);
            cellElement.classList.add('tgr-selected');
            if (this.selectedCells.length === 2) {
                this._performTGRComparison();
            }
        }
        
        this._updateSelectedCellsDisplay();
    }

    _updateSelectedCellsDisplay() {
        
        if (this.selectedCells.length > 0) {
            document.body.classList.add('has-selected-cell');
        } else {
            document.body.classList.remove('has-selected-cell');
        }
    }

    _performTGRComparison() {
        if (this.selectedCells.length !== 2) return;
        
        const cell1 = this.selectedCells[0];
        const cell2 = this.selectedCells[1];
        const exists = this.tgrComparisons.some(comp => 
            (comp.cell1.group === cell1.group && comp.cell2.group === cell2.group && 
             comp.cell1.dayX === cell1.dayX && comp.cell1.dayY === cell1.dayY &&
             comp.cell2.dayX === cell2.dayX && comp.cell2.dayY === cell2.dayY) ||
            (comp.cell1.group === cell2.group && comp.cell2.group === cell1.group && 
             comp.cell1.dayX === cell2.dayX && comp.cell1.dayY === cell2.dayY &&
             comp.cell2.dayX === cell1.dayX && comp.cell2.dayY === cell1.dayY)
        );
        
        if (exists) {
            this.showNotification('This comparison already exists', 'info');
            this._clearCellSelection();
            return;
        }
        const data1 = this._getTGRIndividualData(cell1.group, cell1.dayX, cell1.dayY);
        const data2 = this._getTGRIndividualData(cell2.group, cell2.dayX, cell2.dayY);
        
        if (!data1 || !data2 || data1.length === 0 || data2.length === 0) {
            this.showNotification('No individual data available for comparison', 'warning');
            this._clearCellSelection();
            return;
        }
        const mannWhitneyResult = MathUtils.mannWhitneyUTest(data1, data2);
        const cohensD = MathUtils.calculateCohensD(data1, data2).value;
        
        const comparison = {
            id: Date.now(),
            cell1: cell1,
            cell2: cell2,
            data1: data1,
            data2: data2,
            mannWhitney: mannWhitneyResult,
            cohensD: cohensD,
            median1: MathUtils.calculateMedian(data1),
            median2: MathUtils.calculateMedian(data2)
        };
        
        this.tgrComparisons.push(comparison);
        this._displayTGRComparison(comparison);
        this._updateClearAllButtonState();
        
        window.tgrComparisons = this.tgrComparisons;
        this._clearCellSelection();
    }

    _getTGRIndividualData(group, dayX, dayY) {
        const matrix = this.growthMatrices[group];
        if (!matrix || !matrix.individualData) return null;
        
        const key = `${dayX}-${dayY}`;
        return matrix.individualData[key] || null;
    }

    _clearCellSelection() {
        this.selectedCells.forEach(cell => {
            cell.element.classList.remove('tgr-selected');
            cell.element.style.border = '';
            cell.element.style.boxShadow = '';
        });
        this.selectedCells = [];
        document.body.classList.remove('has-selected-cell');
    }

    _displayTGRComparison(comparison) {
        const container = document.getElementById('tgrComparisonsContainer');
        if (!container) {
            console.error('TGR comparisons container not found');
            return;
        }
        let unifiedTable = document.getElementById('tgrUnifiedComparisonTable');
        if (!unifiedTable) {
            this._createUnifiedTGRTable(container);
            unifiedTable = document.getElementById('tgrUnifiedComparisonTable');
        }
        this._addRowToUnifiedTGRTable(unifiedTable, comparison);
        const statisticalNotes = document.getElementById('tgrStatisticalNotes');
        if (statisticalNotes && this.tgrComparisons.length === 1) {
            statisticalNotes.style.display = 'block';
        }
    }

    _createUnifiedTGRTable(container) {
        const tableDiv = document.createElement('div');
        tableDiv.id = 'tgrUnifiedComparisonTable';
        tableDiv.className = 'tgr-comparison-result';
        tableDiv.style.marginTop = '25px';
        
        tableDiv.innerHTML = `
            <div style="margin-bottom: 15px;">
                <h4 style="margin: 0; color: #4facfe;">TGR Statistical Comparisons</h4>
            </div>
            <div style="overflow-x: auto;">
                <table id="tgrComparisonTableBody">
                    <thead>
                        <tr>
                            <th style="text-align: left">Comparison</th>
                            <th>Group 1 (n)</th>
                            <th>Group 2 (n)</th>
                            <th>Median Diff</th>
                            <th>U-statistic</th>
                            <th>Z-statistic</th>
                            <th>p-value</th>
                            <th>Effect Size</th>
                            <th>Significance</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody id="tgrComparisonRows">
                    </tbody>
                </table>
            </div>
        `;
        const statisticalNotes = document.getElementById('tgrStatisticalNotes');
        if (statisticalNotes) {
            container.insertBefore(tableDiv, statisticalNotes);
        } else {
            container.appendChild(tableDiv);
        }
    }

    _addRowToUnifiedTGRTable(unifiedTable, comparison) {
        const tbody = document.getElementById('tgrComparisonRows');
        if (!tbody) return;
        
        const significance = comparison.mannWhitney.p < 0.05 ? 'Significant' : 'Not significant';
        const significanceColor = comparison.mannWhitney.p < 0.05 ? '#00f2fe' : '#a0a0a0';
        const pValueText = comparison.mannWhitney.p < 0.001 ? '<0.001' : comparison.mannWhitney.p.toFixed(3);
        const asterisks = MathUtils.getAsteriskNotation(comparison.mannWhitney.p);
        const medianDiff = comparison.median1 - comparison.median2;
        const effectSizeLabel = MathUtils.getEffectSizeLabel(Math.abs(comparison.cohensD));
        
        const row = document.createElement('tr');
        row.id = `comparison-row-${comparison.id}`;
        row.innerHTML = `
            <td style="font-weight: bold; text-align: left;">
                ${comparison.cell1.group} r(D${comparison.cell1.dayX}→D${comparison.cell1.dayY})<br>
                <small style="color: #a0a0a0;">vs</small><br>
                ${comparison.cell2.group} r(D${comparison.cell2.dayX}→D${comparison.cell2.dayY})
            </td>
            <td>${comparison.median1.toFixed(4)} (${comparison.data1.length})</td>
            <td>${comparison.median2.toFixed(4)} (${comparison.data2.length})</td>
            <td style="color: ${medianDiff > 0 ? '#4facfe' : '#ff6b6b'};">
                ${medianDiff > 0 ? '+' : ''}${medianDiff.toFixed(4)}
            </td>
            <td>${comparison.mannWhitney.U.toFixed(1)}</td>
            <td>${comparison.mannWhitney.z.toFixed(3)}</td>
            <td style="color: ${significanceColor}; font-weight: bold;">
                ${pValueText}${asterisks ? ` (${asterisks})` : ''}
            </td>
            <td>
                ${effectSizeLabel}<br>
                <small style="color: #a0a0a0;">(d=${Math.abs(comparison.cohensD).toFixed(3)})</small>
            </td>
            <td style="color: ${significanceColor}; font-weight: bold;">
                ${significance}
            </td>
            <td>
                <button onclick="removeTGRComparison(${comparison.id})" class="close-btn" style="font-size: 16px; padding: 4px 8px;">×</button>
            </td>
        `;
        
        tbody.appendChild(row);
    }

    _createTGRComparisonsContainer() {
        const existingContainer = document.getElementById('tgrComparisonsContainer');
        if (existingContainer) return existingContainer;
        
        const tgrCard = Array.from(document.querySelectorAll('.result-card')).find(card => {
            const h2 = card.querySelector('h2');
            return h2 && h2.textContent.includes('Tumor Growth Rate Matrices');
        });
        
        if (!tgrCard) {
            console.error('TGR card not found');
            return null;
        }
        
        const container = document.createElement('div');
        container.id = 'tgrComparisonsContainer';
        container.className = 'tgr-comparisons-container';
        
        const header = document.createElement('div');
        header.className = 'comparisons-header';
        header.innerHTML = `
            <h2 style="margin: 0; color: #e0e0e0;">TGR Statistical Comparisons</h2>
            <p style="color: #a0a0a0; margin: 0.5rem 0 1rem 0; font-style: italic;">
                Pairwise comparisons of individual TGR distributions using Mann-Whitney U test
            </p>
            <div class="btn-row" style="margin-bottom: 1rem;">
                <button class="btn compare-all" onclick="compareAllTGRIntervals()">Compare All Intervals</button>
                <button class="btn clear-all" id="clearAllBtn" onclick="clearAllTGRComparisons()" disabled style="opacity: 0.5; cursor: not-allowed;">Clear All</button>
                <button class="btn export-csv" onclick="exportManager.export('tgr')">Export TGR Data to CSV</button>
            </div>
        `;
        const statisticalNotes = document.createElement('div');
        statisticalNotes.id = 'tgrStatisticalNotes';
        statisticalNotes.style.display = 'none';
        statisticalNotes.innerHTML = `
            <div style="margin-top: 1rem; padding: 1rem; background: rgba(79, 172, 254, 0.1); border-radius: 8px; border: 1px solid rgba(79, 172, 254, 0.3);">
                <h4 style="margin: 0 0 0.5rem 0; color: #4facfe;">Statistical Notes:</h4>
                <ul style="margin: 0; padding-left: 1.5rem; color: #a0a0a0; font-size: 0.9rem;">
                    <li>Two-tailed Mann-Whitney U test (non-parametric, rank-based)</li>
                    <li>Comparisons of individual TGR values between selected matrix cells</li>
                    <li>Significance level: α = 0.05</li>
                    <li>Effect size (Cohen's d): Small=0.2, Medium=0.5, Large=0.8</li>
                    <li>U = Mann-Whitney U statistic, Z = standardized test statistic</li>
                </ul>
            </div>
        `;
        
        container.appendChild(header);
        container.appendChild(statisticalNotes);
        tgrCard.appendChild(container);
        
        return container;
    }

    compareAllTGRIntervals() {
        const groups = Object.keys(this.growthMatrices);
        if (groups.length < 2) {
            this.showNotification('Need at least 2 groups for comparison', 'warning');
            return;
        }
        
        const group1 = groups[0];
        const group2 = groups[1];
        const matrix1 = this.growthMatrices[group1];
        const matrix2 = this.growthMatrices[group2];
        
        let newComparisons = 0;
        
        Object.keys(matrix1.individualData).forEach(interval => {
            if (matrix2.individualData[interval]) {
                const data1 = matrix1.individualData[interval];
                const data2 = matrix2.individualData[interval];
                
                if (data1.length > 0 && data2.length > 0) {
                    const [dayX, dayY] = interval.split('-').map(Number);
                    const exists = this.tgrComparisons.some(comp => 
                        (comp.cell1.group === group1 && comp.cell2.group === group2 && 
                         comp.cell1.dayX === dayX && comp.cell1.dayY === dayY &&
                         comp.cell2.dayX === dayX && comp.cell2.dayY === dayY) ||
                        (comp.cell1.group === group2 && comp.cell2.group === group1 && 
                         comp.cell1.dayX === dayX && comp.cell1.dayY === dayY &&
                         comp.cell2.dayX === dayX && comp.cell2.dayY === dayY)
                    );
                    
                    if (!exists) {
                        const mannWhitneyResult = MathUtils.mannWhitneyUTest(data1, data2);
                        const cohensD = MathUtils.calculateCohensD(data1, data2).value;
                        
                        const comparison = {
                            id: Date.now() + Math.random(),
                            cell1: { group: group1, dayX: dayX, dayY: dayY },
                            cell2: { group: group2, dayX: dayX, dayY: dayY },
                            data1: data1,
                            data2: data2,
                            mannWhitney: mannWhitneyResult,
                            cohensD: cohensD,
                            median1: MathUtils.calculateMedian(data1),
                            median2: MathUtils.calculateMedian(data2)
                        };
                        
                        this.tgrComparisons.push(comparison);
                        this._displayTGRComparison(comparison);
                        newComparisons++;
                    }
                }
            }
        });
        
        this._updateClearAllButtonState();
        
        window.tgrComparisons = this.tgrComparisons;
        
        if (newComparisons === 0) {
            this.showNotification('All intervals have already been compared', 'info');
        } else {
            this.showNotification(`Added ${newComparisons} new comparisons`, 'success');
        }
    }

    _updateClearAllButtonState() {
        const clearAllBtn = document.getElementById('clearAllBtn');
        if (clearAllBtn) {
            if (this.tgrComparisons.length > 0) {
                clearAllBtn.disabled = false;
                clearAllBtn.style.opacity = '1';
                clearAllBtn.style.cursor = 'pointer';
            } else {
                clearAllBtn.disabled = true;
                clearAllBtn.style.opacity = '0.5';
                clearAllBtn.style.cursor = 'not-allowed';
            }
        }
    }

    clearAllTGRComparisons() {
        this.tgrComparisons = [];
        const unifiedTable = document.getElementById('tgrUnifiedComparisonTable');
        if (unifiedTable) {
            unifiedTable.remove();
        }
        const statisticalNotes = document.getElementById('tgrStatisticalNotes');
        if (statisticalNotes) {
            statisticalNotes.style.display = 'none';
        }
        
        this._clearCellSelection();
        this._updateClearAllButtonState();
        
        window.tgrComparisons = this.tgrComparisons;
        
        this.showNotification('All comparisons cleared', 'info');
    }

    removeTGRComparison(comparisonId) {
        const index = this.tgrComparisons.findIndex(comp => comp.id === comparisonId);
        if (index !== -1) {
            this.tgrComparisons.splice(index, 1);
            const row = document.getElementById(`comparison-row-${comparisonId}`);
            if (row) row.remove();
            if (this.tgrComparisons.length === 0) {
                const unifiedTable = document.getElementById('tgrUnifiedComparisonTable');
                if (unifiedTable) {
                    unifiedTable.remove();
                }
                
                const statisticalNotes = document.getElementById('tgrStatisticalNotes');
                if (statisticalNotes) {
                    statisticalNotes.style.display = 'none';
                }
            }
            this._updateClearAllButtonState();
            
                window.tgrComparisons = this.tgrComparisons;
            
            this.showNotification('Comparison removed', 'info');
        }
    }

    _checkExistingMatrices() {
        const allCards = document.querySelectorAll('.result-card');
        return Array.from(allCards).find(card => {
            const h2 = card.querySelector('h2');
            return h2 && h2.textContent.includes('Tumor Growth Rate Matrices');
        });
    }
    captureTGRComparisons() {
        if (!this.tgrComparisons || this.tgrComparisons.length === 0) return '';
        
        let comparisonsHTML = '<div style="margin-top: 30px; border-top: 2px solid #e0e0e0; padding-top: 20px;">';
        comparisonsHTML += '<h3 style="color: #2c3e50; margin-bottom: 20px;">TGR Statistical Comparisons</h3>';
        
        this.tgrComparisons.forEach((comparison, index) => {
            const significance = comparison.mannWhitney.p < 0.05 ? 'Significant' : 'Not significant';
            const significanceColor = comparison.mannWhitney.p < 0.05 ? 'linear-gradient(45deg, #22c55e, #16a34a)' : 'linear-gradient(45deg, #ef4444, #dc2626)';
            const significanceTextColor = 'white';
            
            comparisonsHTML += `
                <div style="margin-bottom: 25px; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; background: white;">
                    <h4 style="color: #1e3a5f; margin-bottom: 15px;">${comparison.cell1.group} r(D${comparison.cell1.dayX}→D${comparison.cell1.dayY}) vs ${comparison.cell2.group} r(D${comparison.cell2.dayX}→D${comparison.cell2.dayY})</h4>                     
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">
                        <thead>
                            <tr style="background: #edf2f7;">
                                <th style="padding: 12px; border: 1px solid #e0e0e0; text-align: center; color: white;">Group</th>
                                <th style="padding: 12px; border: 1px solid #e0e0e0; text-align: center; color: white;">N</th>
                                <th style="padding: 12px; border: 1px solid #e0e0e0; text-align: center; color: white;">Median</th>
                                <th style="padding: 12px; border: 1px solid #e0e0e0; text-align: center; color: white;">Mann-Whitney U</th>
                                <th style="padding: 12px; border: 1px solid #e0e0e0; text-align: center; color: white;">p-value</th>
                                <th style="padding: 12px; border: 1px solid #e0e0e0; text-align: center; color: white;">Cohen's d</th>
                                <th style="padding: 12px; border: 1px solid #e0e0e0; text-align: center; color: white;">Significance</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="padding: 12px; border: 1px solid #e0e0e0; text-align: center;">${comparison.cell1.group}</td>
                                <td style="padding: 12px; border: 1px solid #e0e0e0; text-align: center;">${comparison.data1.length}</td>
                                <td style="padding: 12px; border: 1px solid #e0e0e0; text-align: center;">${comparison.median1.toFixed(4)}</td>
                                <td rowspan="2" style="padding: 12px; border: 1px solid #e0e0e0; text-align: center; vertical-align: middle;">${comparison.mannWhitney.U.toFixed(2)}</td>
                                <td rowspan="2" style="padding: 12px; border: 1px solid #e0e0e0; text-align: center; vertical-align: middle;">${comparison.mannWhitney.p.toFixed(4)}</td>
                                <td rowspan="2" style="padding: 12px; border: 1px solid #e0e0e0; text-align: center; vertical-align: middle;">${Math.abs(comparison.cohensD).toFixed(3)}</td>
                                <td rowspan="2" style="padding: 12px; border: 1px solid #e0e0e0; text-align: center; vertical-align: middle; background: ${significanceColor}; color: ${significanceTextColor}; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,0.3); box-shadow: 0 2px 4px rgba(0,0,0,0.2);">${significance}</td>
                            </tr>
                            <tr>
                                <td style="padding: 12px; border: 1px solid #e0e0e0; text-align: center;">${comparison.cell2.group}</td>
                                <td style="padding: 12px; border: 1px solid #e0e0e0; text-align: center;">${comparison.data2.length}</td>
                                <td style="padding: 12px; border: 1px solid #e0e0e0; text-align: center;">${comparison.median2.toFixed(4)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;
        });
        
        comparisonsHTML += '</div>';
        return comparisonsHTML;
    }

    createReportMatrixTable(matrix, groupName = '') {
        const days = matrix.days;
        const currentRange = this.customColorRange || this.optimizedColorRange;
        const isLargeMatrix = days.length > 9;
        const fontSize = isLargeMatrix ? '0.7rem' : '0.8em';
        const maxWidth = isLargeMatrix ? '100%' : '600px';
        const tableStyle = `width: 100%; border-collapse: collapse; font-size: ${fontSize}; margin: 0 auto; font-family: 'Courier New', monospace; max-width: ${maxWidth}; ${isLargeMatrix ? 'min-width: fit-content;' : ''}`;
        const cellPadding = isLargeMatrix ? '4px' : '6px';
        
        let html = `<table style="${tableStyle}">`;
        html += `<thead><tr style="background: #3498db; color: white;"><th style="padding: ${cellPadding}; border: 1px solid #ddd; font-weight: bold;"></th>`;

        days.slice(1).forEach(day => {
            html += `<th style="padding: ${cellPadding}; border: 1px solid #ddd; font-weight: bold;">D${day}</th>`;
        });
        html += '</tr></thead><tbody>';
        days.slice(0, -1).forEach((dayRow, i) => {
            html += `<tr><th style="padding: ${cellPadding}; border: 1px solid #ddd; background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); color: white; font-weight: bold;">D${dayRow}</th>`;
            
            days.slice(1).forEach((dayCol, j) => {
                const actualJ = j + 1;
                let cellContent = '';
                let cellStyle = `border: 1px solid #ddd; padding: ${cellPadding}; text-align: center; font-weight: 500;`;
                
                if (actualJ <= i) {
                    
                    cellContent = '';
                    cellStyle += 'background: transparent;';
                } else {
                    
                    const value = matrix.values[i][actualJ];
                    cellContent = value !== null && !isNaN(value) ? value.toFixed(4) : '—';
                    
                    if (value !== null && !isNaN(value)) {
                        const bgColor = this._getOptimizedColorForValue(value);
                        const textColor = this._getContrastColor(bgColor);
                        cellStyle += `background-color: ${bgColor}; color: ${textColor};`;
                    }
                }

                html += `<td style="${cellStyle}">${cellContent}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        return html;
    }

    createReportColorLegend() {
        const currentRange = this.customColorRange || this.optimizedColorRange;

        return `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #dee2e6; page-break-inside: avoid;">
            <h4 style="color: #2c3e50; margin: 0 0 10px 0; text-align: center;">Matrix Color Scale</h4>
            
            <div style="display: flex; justify-content: center; align-items: center; gap: 20px; margin: 10px 0; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 20px; height: 20px; background: rgb(100, 200, 100); border: 1px solid #ccc; border-radius: 3px;"></div>
                    <span style="font-size: 0.9em;">Low: ${currentRange.min.toFixed(4)}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 20px; height: 20px; background: rgb(255, 255, 0); border: 1px solid #ccc; border-radius: 3px;"></div>
                    <span style="font-size: 0.9em;">Medium</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 20px; height: 20px; background: rgb(255, 0, 100); border: 1px solid #ccc; border-radius: 3px;"></div>
                    <span style="font-size: 0.9em;">High: ${currentRange.max.toFixed(4)}</span>
                </div>
            </div>
            
            <div style="text-align: center; font-size: 0.8em; color: #666; margin-top: 10px;">
                <strong>Control group:</strong> ${this.controlGroup}
                ${this.customColorRange ? ' • <strong>Custom scale</strong>' : ' • Automatic scale'}
            </div>
            
            <div style="text-align: center; font-size: 0.8em; color: #666; margin-top: 5px; font-style: italic;">
                Colors represent growth rates r(x→y) = log(V_y/V_x)/(t_y-t_x)
            </div>
            </div>
        `;
    }
    getGrowthMatrices() {
        return this.growthMatrices;
    }

    getTGRComparisons() {
        return this.tgrComparisons;
    }

    getControlGroup() {
        return this.controlGroup;
    }

    getCurrentColorRange() {
        return this._getCurrentColorRange();
    }
}
window.TGRMatricesService = TGRMatricesService;
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TGRMatricesService;
}
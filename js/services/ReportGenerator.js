
class ReportGenerator {
    constructor() {
        this.animalVisualData = {};
        this.professionalColors = [
            '#2E86AB', '#A23B72', '#F18F01', '#C73E1D', '#593E25',
            '#1B998B', '#7209B7', '#F72585', '#4361EE', '#277DA1'
        ];
        this.groupSymbols = [
            'circle', 'square', 'triangle-up', 'diamond', 'cross',
            'triangle-down', 'pentagon', 'hexagon', 'star', 'x'
        ];
        this.symbolMap = {
            'circle': '●', 'square': '■', 'diamond': '◆', 'triangle-up': '▲',
            'triangle-down': '▼', 'star': '★', 'hexagon': '⬢', 'pentagon': '⬟', 
            'cross': '✚', 'x': '✖'
        };
    }


    exportEnhancedCSV(processedAnimals, options = {}) {
        try {
            const fileName = options.fileName || this._generateFileName('enhanced_results', 'csv');
            const dataType = options.dataType || 'volume';

            const headers = this._getEnhancedCSVHeaders(dataType);

            const csvData = this._prepareEnhancedCSVData(processedAnimals, options);

            const csvContent = this._generateCSVContent(headers, csvData);

            this._downloadFile(csvContent, fileName, 'text/csv');

            return true;
        } catch (error) {
            throw new Error(`Enhanced CSV export failed: ${error.message}`);
        }
    }

    exportTGRMatrices(tgrMatrices, options = {}) {
        try {
            const fileName = options.fileName || 'TGR_Analysis_Export.csv';

            const tgrData = this._prepareTGRData(tgrMatrices);

            if (tgrData.length === 0) {
                throw new Error('No TGR data available for export');
            }

            const headers = this._getTGRHeaders(tgrData[0]);

            const csvContent = this._generateCSVContent(headers, tgrData);

            this._downloadFile(csvContent, fileName, 'text/csv');

            return true;
        } catch (error) {
            throw new Error(`TGR export failed: ${error.message}`);
        }
    }

    exportBatchPredictions(batchResults, targetDay, options = {}) {
        try {
            if (!batchResults && AppState.predictionService) {
                batchResults = AppState.predictionService.getBatchPredictionResults();
            }
            
            if (!batchResults) {
                throw new Error('No batch prediction results available');
            }
            
            const fileName = options.fileName || `batch_weight_predictions_day${targetDay || batchResults.targetDay}.csv`;

            const headers = [
                'Animal_ID',
                'Experimental_Group',
                'Predicted_Weight_mg',
                'Experimental_Weight_mg',
                'Prediction_Error_mg',
                'Relative_Error_%',
                'R_squared'
            ];

            const csvData = batchResults.map(result => [
                result.animalId,
                result.group || 'Unknown',
                this._formatNumber(result.predictedWeight, 3),
                this._formatNumber(result.experimentalWeight, 3),
                this._formatNumber(result.error, 3),
                this._formatNumber(result.relativeError, 2),
                this._formatNumber(result.r2, 4)
            ]);

            const csvContent = this._generateCSVContent(headers, csvData);

            this._downloadFile(csvContent, fileName, 'text/csv');

            return true;
        } catch (error) {
            throw new Error(`Batch predictions export failed: ${error.message}`);
        }
    }

    _prepareEnhancedCSVData(processedAnimals, options) {
        return processedAnimals
            .filter(animal => animal.isValid && animal.included)
            .map(animal => {
                const doublingTime = animal.doublingTime > 0 ? animal.doublingTime.toFixed(2) : 'N/A';

                return [
                    animal.id,
                    animal.group,
                    this._formatNumber(animal.r2, 4),
                    this._formatNumber(animal.initialValue, 2),
                    this._formatNumber(animal.r, 6),
                    doublingTime,
                    this._formatNumber(animal.finalValue, 2),
                    this._formatNumber(animal.growthFactor, 3),
                    animal.validPoints?.length || 0,
                    animal.dataQuality?.level || 'Unknown'
                ];
            });
    }

    _prepareTGRData(tgrMatrices) {
        const data = [];

        Object.entries(tgrMatrices.matrices).forEach(([groupName, groupData]) => {
            const { matrix, animals } = groupData;

            animals.forEach(animal => {
                const row = {
                    Animal_ID: animal.id,
                    Experimental_Group: groupName
                };

                Object.entries(matrix).forEach(([dayPair, tgrData]) => {
                    const animalTGR = tgrData.animals.find(a => a.id === animal.id);
                    row[`r(${dayPair})`] = this._formatNumber(animalTGR?.tgr, 6);
                });

                data.push(row);
            });
        });

        return data;
    }

    _getEnhancedCSVHeaders(dataType) {
        const valueLabel = dataType === 'volume' ? 'Volume' : 'BLI';

        return [
            'Animal',
            'Group',
            'R²',
            `Initial_${valueLabel}`,
            'Growth_Rate_r',
            'Doubling_Time_days',
            `Final_${valueLabel}`,
            'Growth_Factor',
            'Data_Points',
            'Quality_Assessment'
        ];
    }

    _getTGRHeaders(firstRow) {
        return Object.keys(firstRow);
    }

    _generateCSVContent(headers, data) {
        const separator = ';';
        let csvContent = headers.join(separator) + '\n';

        data.forEach(row => {
            if (Array.isArray(row)) {
                csvContent += row.join(separator) + '\n';
            } else {
                csvContent += headers.map(header => row[header] || '').join(separator) + '\n';
            }
        });

        return csvContent;
    }

    _downloadFile(content, fileName, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => URL.revokeObjectURL(url), 100);
    }

    _generateFileName(baseName, extension) {
        const date = new Date();
        const timestamp = date.getFullYear() + '-' +
            String(date.getMonth() + 1).padStart(2, '0') + '-' +
            String(date.getDate()).padStart(2, '0');
        return `${baseName}_${timestamp}.${extension}`;
    }

    async generateCompleteHTMLReport(options = {}) {
        try {
            this.animalVisualData = {};
            
            const globalData = this._getGlobalData();
            
            if (Object.keys(globalData.animalModels).length === 0) {
                throw new Error('No analyzed data available to generate the report');
            }

            const mainChartImg = await this._captureChart('mainChart');
            const normalizedChartImg = await this._captureChart('normalizedChart');
            const matricesHTML = this._captureMatricesHTML();
            const predictionsHTML = this._capturePredictionsHTML();

            const dataType = globalData.processedData.dataType || 'volume';
            const paramLabel = dataType === 'volume' ? 'V₀' : 'BLI₀';
            const unitLabel = dataType === 'volume' ? ' mm³' : '';
            const measurementType = dataType === 'volume' ? 'Tumor Volume' : 'Bioluminescence';

            const htmlContent = this._generateCompleteHTMLContent({
                mainChartImg,
                normalizedChartImg,
                matricesHTML,
                predictionsHTML,
                dataType,
                paramLabel,
                unitLabel,
                measurementType,
                animalModels: globalData.animalModels,
                processedData: globalData.processedData,
                ...options
            });

            const fileName = options.fileName || this._generateFileName('Complete_Analysis_Report', 'html');
            this._downloadFile(htmlContent, fileName, 'text/html');

            return true;
        } catch (error) {
            throw new Error(`Complete HTML report generation failed: ${error.message}`);
        }
    }

    async _captureChart(chartId) {
        try {
            return await this._captureChartFallback(chartId);
        } catch (error) {
            return null;
        }
    }

    async _captureChartFallback(chartId) {
        try {
            const chartElement = domCache.get(chartId);
            if (!chartElement) {
                const directElement = document.getElementById(chartId);
                if (directElement) {
                    domCache.set(chartId, directElement);
                    return await this._captureChartFallback(chartId);
                } else {
                    return null;
                }
            }

            const hasPlotlyData = chartElement.data && chartElement.layout;
            let originalLayout = null;
            let originalData = null;

            if (hasPlotlyData && typeof Plotly !== 'undefined') {
                originalLayout = JSON.parse(JSON.stringify(chartElement.layout));
                originalData = JSON.parse(JSON.stringify(chartElement.data));
                const whiteLayout = {
                    ...chartElement.layout,
                    title: {
                        text: ''
                    },
                    paper_bgcolor: '#ffffff',
                    plot_bgcolor: '#ffffff',
                    font: {
                        color: '#333333',
                        family: 'Arial, sans-serif',
                        size: 14
                    },
                    xaxis: {
                        ...chartElement.layout.xaxis,
                        gridcolor: '#a0a0a0',
                        gridwidth: 1,
                        griddash: 'dot',
                        tickcolor: '#333333',
                        tickfont: { color: '#333333', size: 14, family: 'Arial, sans-serif' },
                        linecolor: '#333333',
                        linewidth: 1.5,
                        title: {
                            ...chartElement.layout.xaxis?.title,
                            font: { size: 16, color: '#333333', family: 'Arial, sans-serif' }
                        }
                    },
                    yaxis: {
                        ...chartElement.layout.yaxis,
                        gridcolor: '#a0a0a0',
                        gridwidth: 1,
                        griddash: 'dot',
                        tickcolor: '#333333',
                        tickfont: { color: '#333333', size: 14, family: 'Arial, sans-serif' },
                        linecolor: '#333333',
                        linewidth: 1.5,
                        title: {
                            ...chartElement.layout.yaxis?.title,
                            font: { size: 16, color: '#333333', family: 'Arial, sans-serif' }
                        }
                    },
                    legend: {
                        ...chartElement.layout.legend,
                        bgcolor: 'rgba(255,255,255,0.95)',
                        bordercolor: '#d0d0d0',
                        borderwidth: 0,
                        font: { color: '#333333', size: 14, family: 'Arial, sans-serif' }
                    },
                    margin: {
                        l: 60,
                        r: 30,
                        t: 20,
                        b: 50
                    },
                    height: 350
                };

                chartElement.data.forEach((trace, index) => {
                    const isTrendLine = this._isTrendLine(trace);
                    let groupName, animalColor, groupSymbol;
                    
                    if (isTrendLine) {
                        groupName = this._extractGroupFromTrendLine(trace);
                        animalColor = this._getColorByHash(groupName, 5);
                        groupSymbol = null;
                    } else {
                        groupName = this._extractGroupFromScatterTrace(trace);
                        const animalId = this._extractAnimalIdFromTrace(trace);
                        animalColor = this._getColorByHash(animalId, 7);
                        groupSymbol = this._getSymbolByHash(animalId, 5);
                    }
                    
                    trace.line = trace.line || {};
                    trace.line.color = animalColor;
                    trace.line.width = isTrendLine ? 4 : 3;
                    
                    if (trace.mode?.includes('markers') || trace.marker) {
                        trace.marker = trace.marker || {};
                        trace.marker.color = animalColor;
                        trace.marker.size = 10;
                        trace.marker.line = { color: '#000000', width: 0.8 };
                        if (groupSymbol) {
                            trace.marker.symbol = groupSymbol;
                        }
                    }
                });
                
                chartElement.data.forEach((trace, index) => {
                    if (!this._isTrendLine(trace) && trace.marker && trace.mode?.includes('markers')) {
                        const animalId = this._extractAnimalIdFromTrace(trace);
                        if (animalId) {
                            this.animalVisualData[animalId] = {
                                color: trace.marker.color,
                                symbol: trace.marker.symbol || 'circle'
                            };
                        }
                    }
                });

                await Plotly.relayout(chartElement, whiteLayout);

                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            let capturedImage = null;
            if (hasPlotlyData && typeof Plotly !== 'undefined') {
                try {
                    capturedImage = await Plotly.toImage(chartElement, {
                        format: 'png',
                        width: 800,
                        height: chartId === 'mainChart' ? 300 : 280,
                        scale: 2
                    });
                } catch (error) {
                    capturedImage = null;
                }
            }

            if (hasPlotlyData && originalLayout) {
                await Plotly.react(chartElement, originalData, originalLayout);
            }

            return capturedImage;

        } catch (error) {
            return null;
        }
    }

    _captureMatricesHTML() {
        const matricesContainer = document.querySelector('.matrices-container');
        if (!matricesContainer) return '';

        const globalData = this._getGlobalData();
        const { growthMatrices, customColorRange, optimizedColorRange, controlGroup } = globalData;

        let matricesHTML = '<h2>Tumor Growth Rate Matrices (TGR)</h2>';

        const currentRange = customColorRange || optimizedColorRange;
        matricesHTML += `
            <div style="text-align: center; margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <p><strong>Scale:</strong> 
                    <span style="background: rgb(100,200,100); padding: 2px 8px; border-radius: 3px; color: #000;">🟢 Green = Low</span>
                    <span style="background: rgb(255,255,0); padding: 2px 8px; border-radius: 3px; margin: 0 5px; color: #000;">🟡 Yellow = Medium</span>
                    <span style="background: rgb(255,0,100); padding: 2px 8px; border-radius: 3px; color: #fff;">🔴 Red = High</span>
                </p>
                <p><strong>Range:</strong> ${currentRange.min != null ? currentRange.min.toFixed(4) : 'N/A'} to ${currentRange.max != null ? currentRange.max.toFixed(4) : 'N/A'}</p>
                <p><strong>Control group:</strong> ${controlGroup}</p>
                ${customColorRange ? '<p><strong>Custom scale active</strong></p>' : '<p>Automatic scale</p>'}
            </div>
        `;

        const numGroups = Object.keys(growthMatrices).length;
        const hasLargeMatrices = Object.values(growthMatrices).some(matrix => matrix.days && matrix.days.length > 9);

        let gridStyle = 'display: grid; gap: 20px;';
        if (hasLargeMatrices) {
            gridStyle += ' grid-template-columns: 1fr; max-width: 100%;';
        } else if (numGroups <= 2) {
            gridStyle += ' grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));';
        } else if (numGroups === 3) {
            gridStyle += ' grid-template-columns: repeat(2, 1fr); grid-auto-flow: row;';
        } else {
            gridStyle += ' grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));';
        }

        matricesHTML += `<div style="${gridStyle}">`;

        Object.entries(growthMatrices).forEach(([group, matrix]) => {
            const groupClass = hasLargeMatrices ? 'group-section large-matrix-group' : 'group-section';
            matricesHTML += `
                <div class="${groupClass}" style="page-break-inside: avoid; margin-bottom: 30px; ${hasLargeMatrices ? 'page-break-before: auto;' : ''}">
                    <h3 class="no-break" style="text-align: center; color: #2c5aa0; margin-bottom: 20px; font-size: 1.3em; font-weight: 600;">${group}</h3>
                    ${this._createReportMatrixTable(matrix, group)}
                </div>
            `;
        });

        matricesHTML += '</div>';

        const tgrComparisons = this._generateTGRStatisticalComparisons();
        if (tgrComparisons) {
            matricesHTML += tgrComparisons;
        }

        return matricesHTML;
    }

    _capturePredictionsHTML() {
        try {
            const predictionResults = domCache.get('predictionResults');
            let hasPredictions = predictionResults && predictionResults.style.display !== 'none';
            const globalData = this._getGlobalData();
            let hasBatchPredictions = globalData.batchResults;

            if (!hasPredictions && !hasBatchPredictions) {
                return '';
            }

            let content = '';

            if (hasBatchPredictions) {
                try {
                    const batchResults = globalData.batchResults;
                    content += this._generateBatchPredictionReportHTML(batchResults);
                } catch (error) {
                    content += `
                        <h2>Batch Tumor Weight Predictions</h2>
                        <div style="background: #ffebee; padding: 20px; border-radius: 8px; border-left: 4px solid var(--danger-color); margin-bottom: 20px;">
                            <p style="color: var(--danger-color);">Error loading batch predictions: ${error.message}</p>
                        </div>
                    `;
                }
            } else if (hasPredictions) {
                try {
                    const domContent = predictionResults.innerHTML || '';
                    const isBatchData = domContent.includes('Statistical Comparison') || domContent.includes('Group Statistics');

                    if (isBatchData) {
                        content += `
                            <h2>Batch Tumor Weight Predictions</h2>
                            <div style="background: #fff3e0; padding: 20px; border-radius: 8px; border-left: 4px solid var(--accent-color); margin-bottom: 20px;">
                                <p><strong>Note:</strong> Batch prediction results are available in the analysis panel above.</p>
                                <p>For detailed statistics and comparisons, please refer to the main analysis section.</p>
                            </div>
                        `;
                    } else {
                        content += `
                            <h2>Individual Animal Predictions</h2>
                            <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; border-left: 4px solid var(--good-color); margin-bottom: 20px;">
                                ${domContent || 'No individual predictions available'}
                            </div>
                        `;
                    }
                } catch (error) {
                }
            }

            return content;
        } catch (error) {
            return '';
        }
    }

    _createReportMatrixTable(matrix, groupName = '') {
        if (!matrix || !matrix.days || !matrix.values) return '';

        const days = matrix.days;
        const globalData = this._getGlobalData();
        const { customColorRange, optimizedColorRange } = globalData;
        const currentRange = customColorRange || optimizedColorRange;
        const isLargeMatrix = days.length > 9;
        const isVeryLargeMatrix = days.length > 15;

        const fontSize = isVeryLargeMatrix ? '0.6rem' : isLargeMatrix ? '0.7rem' : '0.8em';
        const maxWidth = isLargeMatrix ? '100%' : '600px';
        const tableClass = isLargeMatrix ? 'large-matrix-table' : 'data-table';
        const tableStyle = `width: 100%; border-collapse: collapse; font-size: ${fontSize}; margin: 0 auto; font-family: 'Courier New', monospace; max-width: ${maxWidth}; ${isLargeMatrix ? 'min-width: fit-content;' : ''}`;

        const cellPadding = isVeryLargeMatrix ? '2px' : isLargeMatrix ? '3px' : '6px';

        let html = '';
        if (isLargeMatrix) {
            html += `<div class="matrix-wrapper" style="page-break-inside: avoid; margin: 20px 0; overflow-x: auto;">`;
            if (isVeryLargeMatrix) {
                html += `<div style="page-break-before: always;"></div>`;
            }
        }

        html += `<table class="${tableClass}" style="${tableStyle}">`;
        html += `<thead><tr style="background: #2c5aa0 !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;"><th style="padding: ${cellPadding}; border: 1px solid #ddd; font-weight: bold; background: #2c5aa0 !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;"></th>`;

        days.slice(1).forEach(day => {
            html += `<th style="padding: ${cellPadding}; border: 1px solid #ddd; font-weight: bold; background: #2c5aa0 !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;">D${day}</th>`;
        });
        html += '</tr></thead><tbody>';

        days.slice(0, -1).forEach((dayRow, i) => {
            html += `<tr><th style="padding: ${cellPadding}; border: 1px solid #ddd; background: linear-gradient(135deg, #1e3a5f, #2c5282) !important; color: white !important; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact;">D${dayRow}</th>`;

            days.slice(1).forEach((dayCol, j) => {
                const actualJ = j + 1;
                let cellContent = '';
                let cellStyle = `border: 1px solid #ddd; padding: ${cellPadding}; text-align: center; font-weight: 500;`;

                if (actualJ <= i) {
                    cellContent = '';
                    cellStyle += 'background: transparent;';
                } else {
                    const value = matrix.values[i][actualJ];
                    cellContent = (value != null && !isNaN(value)) ? value.toFixed(4) : '—';

                    if (value !== null && !isNaN(value)) {
                        const normalized = (value - currentRange.min) / (currentRange.max - currentRange.min);
                        const clampedNorm = Math.max(0, Math.min(1, normalized));

                        let r, g, b;
                        if (clampedNorm < 0.5) {
                            r = Math.round(100 + (255 - 100) * (clampedNorm * 2));
                            g = Math.round(200 + (255 - 200) * (clampedNorm * 2));
                            b = 100;
                        } else {
                            r = 255;
                            g = Math.round(255 - (255 - 0) * ((clampedNorm - 0.5) * 2));
                            b = Math.round(100 - 100 * ((clampedNorm - 0.5) * 2));
                        }

                        const textColor = (r * 0.299 + g * 0.587 + b * 0.114) > 128 ? '#000' : '#fff';
                        cellStyle += `background: rgb(${r},${g},${b}) !important; color: ${textColor} !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;`;
                    }
                }

                html += `<td style="${cellStyle}">${cellContent}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        
        if (isLargeMatrix) {
            html += '</div>';
        }
        
        return html;
    }

    _generateBatchPredictionReportHTML(batchResults) {
        try {
            if (!batchResults || typeof batchResults !== 'object') {
                throw new Error('Invalid batch results object');
            }

            const predictions = batchResults.predictions;
            const experimentalWeights = batchResults.experimentalWeights || [];
            const targetDay = batchResults.targetDay;

            if (!predictions || !Array.isArray(predictions)) {
                throw new Error('Invalid predictions array');
            }

            if (predictions.length === 0) {
                return `
                    <h2>Batch Tumor Weight Predictions</h2>
                    <div style="background: #fff3e0; padding: 20px; border-radius: 8px; border-left: 4px solid var(--accent-color); margin-bottom: 20px;">
                        <p style="color: var(--accent-color);">No predictions available</p>
                    </div>
                `;
            }

            let html = `<h2>Batch Tumor Weight Predictions</h2>`;

            html += `
                <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; border-left: 4px solid var(--success-color); margin-bottom: 20px;">
                    <p><strong>Target Day:</strong> ${targetDay || 'N/A'}</p>
                    <p><strong>Predictions Generated:</strong> ${predictions.length}</p>
                    <p><strong>Animals with Experimental Weights:</strong> ${experimentalWeights.length}</p>
                </div>
            `;

            const groupStats = {};
            predictions.forEach(pred => {
                if (pred && pred.group && typeof pred.predictedWeight === 'number') {
                    if (!groupStats[pred.group]) {
                        groupStats[pred.group] = [];
                    }
                    groupStats[pred.group].push(pred.predictedWeight);
                }
            });

            if (Object.keys(groupStats).length > 0) {
                html += `<h4>Group Statistics</h4>`;
                html += `<table class="data-table">`;
                html += `
                    <thead>
                        <tr>
                            <th style="text-align: left;">Group</th>
                            <th>n</th>
                            <th>Mean (g)</th>
                            <th>Median (g)</th>
                            <th>Std Dev</th>
                            <th>Range</th>
                        </tr>
                    </thead>
                    <tbody>
                `;

                Object.entries(groupStats).forEach(([group, weights]) => {
                    const mean = weights.reduce((sum, w) => sum + w, 0) / weights.length;
                    const median = MathUtils.calculateMedian(weights);
                    const variance = weights.reduce((sum, w) => {
                        const diff = w - mean;
                        return sum + diff * diff;
                    }, 0) / (weights.length - 1);
                    const stdDev = Math.sqrt(variance);
                    const min = Math.min(...weights);
                    const max = Math.max(...weights);

                    html += `
                        <tr>
                            <td style="text-align: left;"><strong>${group}</strong></td>
                            <td>${weights.length}</td>
                            <td>${this._formatNumber(mean)}</td>
                            <td>${this._formatNumber(median)}</td>
                            <td>${this._formatNumber(stdDev)}</td>
                            <td>${(min != null && max != null) ? `${this._formatNumber(min)} - ${this._formatNumber(max)}` : 'N/A'}</td>
                        </tr>
                    `;
                });

                html += `
                        </tbody>
                    </table>
                `;
            }

            if (Object.keys(groupStats).length >= 2) {
                try {
                    const groups = Object.keys(groupStats);
                    const group1 = groups[0];
                    const group2 = groups[1];
                    const comparison = MathUtils.mannWhitneyUTest(groupStats[group1], groupStats[group2]);
                    const median1 = MathUtils.calculateMedian(groupStats[group1]);
                    const median2 = MathUtils.calculateMedian(groupStats[group2]);
                    const effectSize = MathUtils.calculateCohensD(groupStats[group1], groupStats[group2]);

                    const isSignificant = comparison.p < 0.05;
                    const significanceColor = this._getSignificanceColor(isSignificant);
                    const significanceText = this._getSignificanceText(isSignificant);
                    const pValueText = this._formatPValue(comparison.p);
                    
                    html += `
                        <div class="summary-box" style="background: #f8f9fa;">
                            <h4 style="margin-bottom: 15px;">Statistical Comparison (Mann-Whitney U)</h4>
                            <p style="color: #4a5568; margin-bottom: 20px; font-style: italic;">
                                Non-parametric comparison of predicted growth rates between treatment groups
                            </p>
                            
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th style="text-align: left;">Comparison</th>
                                        <th>Group 1<br><small>(median, n)</small></th>
                                        <th>Group 2<br><small>(median, n)</small></th>
                                        <th>U-statistic</th>
                                        <th>p-value</th>
                                        <th>Effect Size</th>
                                        <th>Significance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td style="text-align: left;"><strong>${group1} vs ${group2}</strong></td>
                                        <td>${this._formatNumber(median1)}<br><small style="color: #666;">(n=${groupStats[group1]?.length || 0})</small></td>
                                        <td>${this._formatNumber(median2)}<br><small style="color: #666;">(n=${groupStats[group2]?.length || 0})</small></td>
                                        <td>${this._formatNumber(comparison.U, 2)}</td>
                                        <td style="color: ${significanceColor}; font-weight: bold;">
                                            ${pValueText}
                                        </td>
                                        <td>
                                            ${effectSize.description}<br><small style="color: #666;">(d=${effectSize.value != null ? effectSize.value.toFixed(3) : 'N/A'})</small>
                                        </td>
                                        <td style="color: ${significanceColor}; font-weight: bold;">
                                            ${significanceText}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    `;
                } catch (compError) {
                }
            }

            html += `<h4>Individual Predictions</h4>`;
            html += `<table class="data-table">`;
            html += `
                <thead>
                    <tr>
                        <th style="text-align: left;">Animal ID</th>
                        <th>Group</th>
                        <th>R²</th>
                        <th>Predicted Weight (g)</th>
                        <th>Experimental Weight (g)</th>
                        <th>Error (%)</th>
                        <th>Quality</th>
                    </tr>
                </thead>
                <tbody>
            `;

            predictions.forEach((pred) => {
                const exp = experimentalWeights.find(e => e && e.animalId === pred.animalId);
                const hasExperimental = exp && typeof exp.experimentalWeight === 'number';
                const error = hasExperimental ? exp.predictionError : null;

                let quality = 'poor';
                if (pred.r2 >= 0.95) { quality = 'excellent'; }
                else if (pred.r2 >= 0.90) { quality = 'good'; }
                else if (pred.r2 >= 0.80) { quality = 'fair'; }
                
                const qualityColor = this._getHomogeneityColor(quality);

                html += `
                    <tr>
                        <td style="text-align: left;"><strong>${pred.animalId || 'N/A'}</strong></td>
                        <td>${pred.group || 'N/A'}</td>
                        <td>${this._formatNumber(pred.r2)}</td>
                        <td style="font-weight: bold;">
                            ${this._formatNumber(pred.predictedWeight)}
                        </td>
                        <td>
                            ${hasExperimental ? this._formatNumber(exp.experimentalWeight) : 'N/A'}
                        </td>
                        <td style="color: ${error && Math.abs(error) < 10 ? 'var(--success-color)' : error && Math.abs(error) < 20 ? 'var(--warning-color)' : 'var(--danger-color)'};">
                            ${error !== null ? `${error > 0 ? '+' : ''}${error.toFixed(1)}%` : 'N/A'}
                        </td>
                        <td>
                            <span style="color: ${qualityColor}; font-weight: bold;">
                                ${quality.charAt(0).toUpperCase() + quality.slice(1)}
                            </span>
                        </td>
                    </tr>
                `;
            });

            html += `
                    </tbody>
                </table>
            `;

            if (experimentalWeights.length > 0) {
                const validWeights = experimentalWeights.filter(w => w && typeof w.experimentalWeight === 'number' && typeof w.predictionError === 'number');
                if (validWeights.length > 0) {
                    const errors = validWeights.map(w => Math.abs(w.predictionError));
                    const avgError = errors.reduce((sum, err) => sum + err, 0) / errors.length;
                    const errorsByRange = {
                        excellent: errors.filter(e => e < 10).length,
                        good: errors.filter(e => e >= 10 && e < 20).length,
                        fair: errors.filter(e => e >= 20).length
                    };

                    html += `
                        <div style="background: #f0f9ff; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #0ea5e9;">
                            <h4>Prediction Validation</h4>
                            <p><strong>Animals with experimental weights:</strong> ${validWeights.length} of ${predictions.length}</p>
                            <p><strong>Average prediction error:</strong> ${this._formatNumber(avgError, 1)}%</p>
                            <p><strong>Error distribution:</strong> Excellent (<10%): ${errorsByRange.excellent}, Good (10-20%): ${errorsByRange.good}, Fair (>20%): ${errorsByRange.fair}</p>
                        </div>
                    `;
                }
            }

            return html;

        } catch (error) {
            return `
                <h2>Batch Tumor Weight Predictions</h2>
                <div style="background: #ffebee; padding: 20px; border-radius: 8px; border-left: 4px solid var(--danger-color); margin-bottom: 20px;">
                    <p style="color: var(--danger-color);">Error generating batch prediction report: ${error.message}</p>
                </div>
            `;
        }
    }

    _generateTGRStatisticalComparisons() {
        const globalData = this._getGlobalData();
        if (!globalData.growthMatrices || Object.keys(globalData.growthMatrices).length < 2) {
            return null;
        }

        const groups = Object.keys(globalData.growthMatrices);
        if (groups.length < 2) return null;

        let comparisonsHTML = '<div style="margin-top: 30px; border-top: 2px solid #e0e0e0; padding-top: 20px;">';
        comparisonsHTML += '<h3 style="color: #2c3e50; margin-bottom: 20px;">TGR Statistical Comparisons</h3>';
        comparisonsHTML += '<p style="color: #4a5568; margin-bottom: 20px; font-style: italic;">Pairwise comparisons of individual TGR distributions using Mann-Whitney U test</p>';

        const group1 = groups[0];
        const group2 = groups[1];
        const matrix1 = globalData.growthMatrices[group1];
        const matrix2 = globalData.growthMatrices[group2];

        comparisonsHTML += '<table class="data-table">';
        comparisonsHTML += `
            <thead>
                <tr>
                    <th style="text-align: left;">Interval</th>
                    <th>${group1}<br><small>(median, n)</small></th>
                    <th>${group2}<br><small>(median, n)</small></th>
                    <th>U-statistic</th>
                    <th>p-value</th>
                    <th>Effect Size</th>
                    <th>Significance</th>
                </tr>
            </thead>
            <tbody>
        `;

        let hasComparisons = false;
        for (let i = 0; i < matrix1.days.length; i++) {
            for (let j = i + 1; j < matrix1.days.length; j++) {
                const dayX = matrix1.days[i];
                const dayY = matrix1.days[j];
                const interval = `${dayX}-${dayY}`;

                const data1 = this._getTGRIndividualData(group1, dayX, dayY);
                const data2 = this._getTGRIndividualData(group2, dayX, dayY);

                if (data1.length > 0 && data2.length > 0) {
                    hasComparisons = true;
                    const comparison = MathUtils.mannWhitneyUTest(data1, data2);
                    const median1 = MathUtils.calculateMedian(data1);
                    const median2 = MathUtils.calculateMedian(data2);
                    const effectSize = MathUtils.calculateCohensD(data1, data2);
                    const isSignificant = comparison.p < 0.05;
                    const significance = this._getSignificanceText(isSignificant);
                    const significanceColor = this._getSignificanceColor(isSignificant);
                    const rowIndex = (i * matrix1.days.length) + j;
                    const rowBg = rowIndex % 2 === 0 ? '#ffffff' : '#f8f9fa';

                    comparisonsHTML += `
                        <tr>
                            <td style="text-align: left;"><strong>Day ${interval}</strong></td>
                            <td>${median1 != null ? median1.toFixed(4) : 'N/A'}<br><small style="color: #666;">(n=${data1?.length || 0})</small></td>
                            <td>${median2 != null ? median2.toFixed(4) : 'N/A'}<br><small style="color: #666;">(n=${data2?.length || 0})</small></td>
                            <td>${comparison.U != null ? comparison.U.toFixed(1) : 'N/A'}</td>
                            <td style="color: ${significanceColor}; font-weight: bold;">
                                ${this._formatPValue(comparison.p)}
                            </td>
                            <td>
                                ${effectSize.description}<br>
                                <small style="color: #666;">(d=${effectSize.value != null ? effectSize.value.toFixed(3) : 'N/A'})</small>
                            </td>
                            <td style="color: ${significanceColor}; font-weight: bold;">
                                ${significance}
                            </td>
                        </tr>
                    `;
                }
            }
        }

        if (!hasComparisons) {
            return null;
        }

        comparisonsHTML += `
                </tbody>
            </table>
            <div style="margin-top: 20px; padding: 15px; background: #e6fffa; border-radius: 8px; border-left: 4px solid var(--good-color);">
                <h4 style="margin: 0 0 10px 0; color: #234e52;">Statistical Notes:</h4>
                <ul style="margin: 0; padding-left: 20px; color: #2d3748; font-size: 0.9rem; line-height: 1.5;">
                    <li>Two-tailed Mann-Whitney U test (non-parametric, rank-based)</li>
                    <li>Comparisons of individual TGR values between matrix cells</li>
                    <li>Significance level: α = 0.05</li>
                    <li>Effect size (Cohen's d): Small=0.2, Medium=0.5, Large=0.8</li>
                    <li>U = Mann-Whitney U statistic for rank-based comparison</li>
                </ul>
            </div>
        </div>
        `;

        return comparisonsHTML;
    }

    _getTGRIndividualData(group, dayX, dayY) {
        const { processedData } = this._getGlobalData();
        if (!processedData?.validAnimals) return [];

        const groupAnimals = processedData.validAnimals.filter(animal => animal.group === group);
        const tgrValues = [];

        groupAnimals.forEach(animal => {
            const dayXIndex = animal.timePoints.findIndex(day => day === dayX);
            const dayYIndex = animal.timePoints.findIndex(day => day === dayY);

            if (dayXIndex !== -1 && dayYIndex !== -1) {
                const volumeX = animal.measurements[dayXIndex];
                const volumeY = animal.measurements[dayYIndex];

                if (volumeX > 0 && volumeY > 0) {
                    const tgr = Math.log(volumeY / volumeX) / (dayY - dayX);
                    if (!isNaN(tgr) && isFinite(tgr)) {
                        tgrValues.push(tgr);
                    }
                }
            }
        });

        return tgrValues;
    }

    _generateStatisticalComparisonHTML() {
        const { processedData } = this._getGlobalData();
        if (!processedData?.groupStats) return null;

        const groups = Object.keys(processedData.groupStats);

        const validGroups = groups.filter(group =>
            processedData.groupStats[group].validAnimals.length > 1
        );

        if (validGroups.length < 2) {
            return null;
        }

        const comparisons = this._performStatisticalComparison();

        if (comparisons.length === 0) {
            return null;
        }

        let html = `
                <h2 style="color: #2c3e50; margin-bottom: 20px;">Statistical Comparison of Growth Rates</h2>
                <div>
                    <p style="color: #4a5568; margin-bottom: 15px; font-style: italic; font-size: 0.9rem;">
                        Pairwise comparisons using Mann-Whitney U test (non-parametric, rank-based analysis)
                    </p>
                
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="text-align: left;">Comparison</th>
                            <th>Group 1<br><small>(median, n)</small></th>
                            <th>Group 2<br><small>(median, n)</small></th>
                            <th>Median Diff</th>
                            <th>U-statistic</th>
                            <th>Z-statistic</th>
                            <th>p-value</th>
                            <th>Effect Size</th>
                            <th>Significance</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        comparisons.forEach((comp) => {
            const significanceColor = this._getSignificanceColor(comp.significant);
            const significanceText = this._getSignificanceText(comp.significant);
            const pValueText = this._formatPValue(comp.pValue);
            const diffColor = comp.medianDiff > 0 ? '#2b6cb0' : 'var(--danger-color)';

            html += `
                <tr>
                    <td style="text-align: left;"><strong>${comp.group1} vs ${comp.group2}</strong></td>
                    <td>${comp.median1 != null ? comp.median1.toFixed(4) : 'N/A'}<br><small style="color: #666;">(n=${comp.n1 || 0})</small></td>
                    <td>${comp.median2 != null ? comp.median2.toFixed(4) : 'N/A'}<br><small style="color: #666;">(n=${comp.n2 || 0})</small></td>
                    <td style="color: ${diffColor}; font-weight: bold;">
                        ${comp.medianDiff != null ? (comp.medianDiff > 0 ? '+' : '') + comp.medianDiff.toFixed(4) : 'N/A'}
                    </td>
                    <td>${comp.UStatistic != null ? comp.UStatistic.toFixed(1) : 'N/A'}</td>
                    <td>${comp.zStatistic != null ? comp.zStatistic.toFixed(3) : 'N/A'}</td>
                    <td style="color: ${significanceColor}; font-weight: bold;">
                        ${pValueText}
                    </td>
                    <td>
                        ${comp.effectSize}<br>
                        <small style="color: #666;">(d=${comp.cohensD != null ? comp.cohensD.toFixed(3) : 'N/A'})</small>
                    </td>
                    <td style="color: ${significanceColor}; font-weight: bold;">
                        ${significanceText}
                    </td>
                </tr>
            `;
        });

        html += `
                        </tbody>
                    </table>
                    
                    <div style="margin-top: 20px; padding: 15px; background: #e6fffa; border-radius: 8px; border-left: 4px solid var(--good-color);">
                        <h4 style="margin: 0 0 10px 0; color: #234e52;">Statistical Notes:</h4>
                        <ul style="margin: 0; padding-left: 20px; color: #2d3748; font-size: 0.9rem; line-height: 1.5;">
                            <li>Two-tailed Mann-Whitney U test (non-parametric, rank-based)</li>
                            <li>Significance level: α = 0.05</li>
                            <li>Effect size (Cohen's d): Small=0.2, Medium=0.5, Large=0.8</li>
                            <li>U = Mann-Whitney U statistic, Z = standardized test statistic</li>
                            <li>Medians reported instead of means for non-parametric analysis</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;

        return html;
    }

    _performStatisticalComparison() {
        const globalData = this._getGlobalData();
        const { processedData, animalModels } = globalData;
        if (!processedData?.groupStats) return [];

        const groups = Object.keys(processedData.groupStats);
        const comparisons = [];

        for (let i = 0; i < groups.length - 1; i++) {
            for (let j = i + 1; j < groups.length; j++) {
                const group1 = groups[i];
                const group2 = groups[j];

                const stats1 = processedData.groupStats[group1];
                const stats2 = processedData.groupStats[group2];

                if (stats1.validAnimals.length > 1 && stats2.validAnimals.length > 1) {
                    const growthRates1 = stats1.validAnimals.map(animal =>
                        animalModels[animal.id]?.model?.r || 0
                    ).filter(r => r > 0);

                    const growthRates2 = stats2.validAnimals.map(animal =>
                        animalModels[animal.id]?.model?.r || 0
                    ).filter(r => r > 0);

                    if (growthRates1.length > 0 && growthRates2.length > 0) {
                        const mannWhitney = MathUtils.mannWhitneyUTest(growthRates1, growthRates2);
                        const median1 = MathUtils.calculateMedian(growthRates1);
                        const median2 = MathUtils.calculateMedian(growthRates2);
                        const effectSize = MathUtils.calculateCohensD(growthRates1, growthRates2);

                        comparisons.push({
                            group1,
                            group2,
                            n1: growthRates1.length,
                            n2: growthRates2.length,
                            median1,
                            median2,
                            medianDiff: median1 - median2,
                            UStatistic: mannWhitney.U,
                            zStatistic: mannWhitney.z,
                            pValue: mannWhitney.p,
                            significant: mannWhitney.p < 0.05,
                            effectSize: effectSize.description,
                            cohensD: effectSize.value
                        });
                    }
                }
            }
        }

        return comparisons;
    }

    _normalizeHomogeneityData(data) {
        if (!data) return null;

        if (data.averageCV !== undefined && data.quality !== undefined && data.groupResults !== undefined) {
            return data;
        }

        if (data.overallAssessment && data.groupAnalysis && data.totalAnimals !== undefined) {
            const normalizedGroupResults = {};

            Object.keys(data.groupAnalysis).forEach(groupName => {
                const groupData = data.groupAnalysis[groupName];
                normalizedGroupResults[groupName] = {
                    cv: parseFloat(groupData.cv) || 0,
                    quality: groupData.quality || 'unknown',
                    count: groupData.n || 0
                };
            });

            return {
                averageCV: parseFloat(data.overallAssessment.averageCV) || 0,
                quality: data.overallAssessment.quality || 'unknown',
                totalAnimals: data.totalAnimals || 0,
                groupResults: normalizedGroupResults
            };
        }

        return null;
    }

    _generateHomogeneityAnalysisHTML() {
        const { processedData, homogeneityResults, homogeneityEvaluator } = this._getGlobalData();
        
        if (!homogeneityResults || !processedData?.validAnimals?.length) {
            return null;
        }

        try {
            let currentResults = null;
            if (homogeneityEvaluator) {
                currentResults = homogeneityEvaluator.evaluate(processedData.validAnimals);
            }

            if (!currentResults) {
                return null;
            }

            const globalData = this._getGlobalData();
            const initial = this._normalizeHomogeneityData(globalData.homogeneityResults);
            const current = this._normalizeHomogeneityData(currentResults);

            if (!initial || !current ||
                typeof initial.averageCV !== 'number' || typeof current.averageCV !== 'number' ||
                !initial.quality || !current.quality ||
                typeof initial.totalAnimals !== 'number' || typeof current.totalAnimals !== 'number' ||
                !initial.groupResults || !current.groupResults) {
                return null;
            }

            const improvement = this._calculateHomogeneityImprovement(initial, current);

            let html = `
                <h2 style="color: #2c3e50; margin-bottom: 20px;">Model Homogeneity Analysis</h2>
                <div style="padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="color: #4a5568; margin-bottom: 15px; font-style: italic; font-size: 0.9rem;">
                        Baseline variability assessment using Coefficient of Variation (CV) analysis across experimental groups
                    </p>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; margin-bottom: 30px;">
                        <div class="summary-card">
                            <h4 style="font-size: 0.8rem; margin-bottom: 6px;">Initial Assessment (Raw Data)</h4>
                            <div class="metric">
                                <span class="metric-label">Average CV:</span>
                                <span class="metric-value" style="color: ${this._getHomogeneityColor(initial.quality)}; font-weight: bold;">
                                    ${initial.averageCV != null ? initial.averageCV.toFixed(1) : 'N/A'}%
                                </span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Quality:</span>
                                <span class="metric-value" style="color: ${this._getHomogeneityColor(initial.quality)}; font-weight: bold;">
                                    ${initial.quality.toUpperCase()}
                                </span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Animals Analyzed:</span>
                                <span class="metric-value">${initial.totalAnimals}</span>
                            </div>
                        </div>
                        
                        <div class="summary-card">
                            <h4 style="font-size: 0.8rem; margin-bottom: 6px;">Final Assessment (Filtered Data)</h4>
                            <div class="metric">
                                <span class="metric-label">Average CV:</span>
                                <span class="metric-value" style="color: ${this._getHomogeneityColor(current.quality)}; font-weight: bold;">
                                    ${current.averageCV != null ? current.averageCV.toFixed(1) : 'N/A'}%
                                </span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Quality:</span>
                                <span class="metric-value" style="color: ${this._getHomogeneityColor(current.quality)}; font-weight: bold;">
                                    ${current.quality.toUpperCase()}
                                </span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Animals Analyzed:</span>
                                <span class="metric-value">${current.totalAnimals}</span>
                            </div>
                        </div>
                    </div>

                    <div class="summary-card" style="margin: 20px 0;">
                        <h4 style="font-size: 0.8rem; margin-bottom: 6px;">Improvement Summary</h4>
                        <div class="metric">
                            <span class="metric-label">CV Reduction:</span>
                            <span class="metric-value" style="color: ${improvement.cvReduction >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}; font-weight: bold;">
                                ${improvement.cvReduction != null ? (improvement.cvReduction >= 0 ? '+' : '') + improvement.cvReduction.toFixed(1) : 'N/A'}%
                            </span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Quality Change:</span>
                            <span class="metric-value" style="color: #4c51bf; font-weight: bold;">
                                ${initial.quality} → ${current.quality}
                            </span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Animals Retained:</span>
                            <span class="metric-value" style="color: #4c51bf; font-weight: bold;">
                                ${current.totalAnimals || 0}/${initial.totalAnimals || 0} (${current.totalAnimals && initial.totalAnimals ? ((current.totalAnimals / initial.totalAnimals) * 100).toFixed(1) : 'N/A'}%)
                            </span>
                        </div>
                    </div>

                    <div>
                        <h4 style="margin: 0 0 15px 0;">Group-Specific Analysis</h4>
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th style="text-align: left;">Group</th>
                                    <th>Initial CV (%)</th>
                                    <th>Final CV (%)</th>
                                    <th>Animals</th>
                                    <th>Quality</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            Object.keys(current.groupResults).forEach((group) => {
                const initialGroup = initial.groupResults[group];
                const currentGroup = current.groupResults[group];
                if (initialGroup && currentGroup && typeof initialGroup.cv === 'number' && typeof currentGroup.cv === 'number') {
                    html += `
                        <tr>
                            <td style="text-align: left;"><strong>${group}</strong></td>
                            <td>${initialGroup.cv != null ? initialGroup.cv.toFixed(1) : 'N/A'}%</td>
                            <td>${currentGroup.cv != null ? currentGroup.cv.toFixed(1) : 'N/A'}%</td>
                            <td>${currentGroup.count || 0}/${initialGroup.count || 0}</td>
                            <td>
                                <span class="quality-indicator quality-${currentGroup.quality}">
                                    ${currentGroup.quality.toUpperCase()}
                                </span>
                            </td>
                        </tr>
                    `;
                }
            });

            html += `
                                </tbody>
                            </table>
                    </div>

                    <div style="margin-top: 20px; padding: 15px; background: #e6fffa; border-radius: 8px; border-left: 4px solid var(--good-color);">
                        <h4 style="margin: 0 0 10px 0; color: #234e52;">Quality Guidelines:</h4>
                        <ul style="margin: 0; padding-left: 20px; color: #2d3748; font-size: 0.9rem; line-height: 1.5;">
                            <li><strong>Excellent:</strong> CV ≤ 15% - Optimal model homogeneity</li>
                            <li><strong>Good:</strong> CV 15-25% - Acceptable variability</li>
                            <li><strong>Fair:</strong> CV 25-30% - Moderate concerns</li>
                            <li><strong>Poor:</strong> CV > 30% - High variability, review recommended</li>
                        </ul>
                    </div>
                </div>
            `;

            return html;

        } catch (error) {
            return null;
        }
    }

    _calculateHomogeneityImprovement(initial, current) {
        const cvReduction = (typeof initial.averageCV === 'number' && typeof current.averageCV === 'number')
            ? initial.averageCV - current.averageCV
            : 0;
        const animalRetention = (typeof initial.totalAnimals === 'number' && typeof current.totalAnimals === 'number' && initial.totalAnimals > 0)
            ? current.totalAnimals / initial.totalAnimals
            : 1;

        return {
            cvReduction,
            qualityImprovement: current.quality !== initial.quality,
            animalRetention
        };
    }

    _getHomogeneityColor(quality) {
        const colors = {
            excellent: 'var(--success-color)',
            good: 'var(--good-color)',
            fair: 'var(--warning-color)',
            poor: 'var(--danger-color)'
        };
        return colors[quality] || '#6b7280';
    }

    _getSignificanceColor(isSignificant) {
        return isSignificant ? 'var(--success-color)' : 'var(--light-text)';
    }

    _getSignificanceText(isSignificant) {
        return isSignificant ? 'Significant' : 'Not significant';
    }

    _formatPValue(pValue) {
        if (!pValue) return 'N/A';
        const formattedValue = pValue < 0.001 ? '<0.001' : pValue.toFixed(3);
        const asterisk = MathUtils.getAsteriskNotation(pValue);
        return asterisk ? `${formattedValue} (${asterisk})` : formattedValue;
    }

    _formatNumber(value, precision = 3) {
        return value != null ? value.toFixed(precision) : 'N/A';
    }

    _generateCompleteHTMLContent(data) {
        const currentDate = new Date();
        const globalData = this._getGlobalData();
        const { currentFileName } = globalData;

        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Complete Analysis Report - ViVo</title>
            <style>
                :root {
                    --primary-color: #1e3a5f;
                    --secondary-color: #2c5282;
                    --accent-color: #d04f35;
                    --success-color: #22543d;
                    --good-color: #17a2b8;
                    --warning-color: #d69e2e;
                    --danger-color: #c53030;
                    --light-bg: #f7fafc;
                    --medium-bg: #edf2f7;
                    --dark-text: #1a202c;
                    --medium-text: #2d3748;
                    --light-text: #4a5568;
                    --border-color: #e2e8f0;
                    --shadow: 0 1px 6px rgba(30, 58, 95, 0.08);
                    --shadow-hover: 0 2px 12px rgba(30, 58, 95, 0.12);
                }

                * {
                    box-sizing: border-box;
                }

                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 30px 20px;
                    background: #fafbfc;
                    color: var(--dark-text);
                    line-height: 1.6;
                    min-height: 100vh;
                }

                .report-container {
                    position: relative;
                    overflow: hidden;
                }

                .report-container::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 3px;
                    background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
                }

                .header {
                    text-align: center;
                    margin-bottom: 40px;
                    padding-bottom: 30px;
                    border-bottom: 2px solid var(--medium-bg);
                }

                h1 {
                    color: var(--primary-color);
                    font-size: 2.5rem;
                    font-weight: 300;
                    margin: 0 0 15px 0;
                    letter-spacing: -0.5px;
                }

                .header-subtitle {
                    color: var(--medium-text);
                    font-size: 1.1rem;
                    font-weight: 400;
                    margin: 10px 0;
                }

                .meta-info {
                    color: var(--light-text);
                    font-size: 0.9rem;
                    margin-top: 5px;
                }

                .section {
                    margin-bottom: 20px;
                    padding: 30px 0;
                    border-bottom: 1px solid var(--border-color);
                }

                .section:last-child {
                    border-bottom: none;
                }

                .section h2 {
                    color: var(--primary-color);
                    font-size: 1.5rem;
                    font-weight: 500;
                    margin-bottom: 25px;
                    padding-bottom: 12px;
                    border-bottom: 2px solid var(--accent-color);
                }

                .section h3 {
                    color: var(--secondary-color);
                    font-size: 1.2rem;
                    font-weight: 500;
                    margin-bottom: 20px;
                }

                .summary-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 20px;
                    margin-bottom: 30px;
                }

                .summary-card {
                    background: var(--light-bg);
                    padding: 16px;
                    border-radius: 12px;
                    border: 1px solid var(--border-color);
                    box-shadow: var(--shadow);
                    font-size: 0.75rem;
                    transition: all 0.3s ease;
                }

                .summary-card:hover {
                    box-shadow: var(--shadow-hover);
                    transform: translateY(-2px);
                }

                .summary-card h4 {
                    color: var(--primary-color);
                    font-size: 1.1rem;
                    font-weight: 600;
                    margin-top: 0px;
                    margin-bottom: 15px;
                    text-align: center;
                }

                .summary-card .metric {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                    padding: 8px 0;
                    border-bottom: 1px solid rgba(0,0,0,0.05);
                }

                .summary-card .metric:last-child {
                    border-bottom: none;
                    margin-bottom: 0;
                }

                .metric-label {
                    font-weight: 500;
                    color: var(--text-secondary);
                }

                .metric-value {
                    font-weight: 600;
                    color: var(--secondary-color);;
                }

                .chart-container {
                    text-align: center;
                    padding: 10px;
                    background: white;
                    border-radius: 12px;
                }

                .chart-container h3 {
                    margin-bottom: 20px;
                    color: var(--secondary-color);
                }

                .chart-container img {
                    max-width: 100%;
                    height: auto;
                    margin-bottom: -35px;
                }

                .data-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                    font-size: 0.9rem;
                    box-shadow: var(--shadow);
                    border-radius: 8px;
                    overflow: hidden;
                }

                .data-table thead {
                    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
                    color: white;
                }

                .data-table th,
                .data-table td {
                    padding: 12px 15px;
                    text-align: center;
                    border-bottom: 1px solid var(--border-color);
                }

                .data-table th {
                    font-weight: 600;
                    letter-spacing: 0.5px;
                }

                .data-table tbody tr {
                    transition: background-color 0.2s ease;
                }

                .data-table tbody tr:hover {
                    background-color: var(--light-bg);
                }

                .data-table tbody tr:nth-child(even) {
                    background-color: rgba(248, 249, 250, 0.5);
                }

                .quality-indicator {
                    display: inline-block;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 0.8rem;
                    font-weight: 500;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .quality-excellent {
                    background: var(--success-color);
                    color: white;
                }

                .quality-good {
                    background: var(--good-color);
                    color: white;
                }

                .quality-fair {
                    background: var(--warning-color);
                    color: white;
                }

                .quality-poor {
                    background: var(--danger-color);
                    color: white;
                }

                .matrices-section {
                    margin: 30px 0;
                }

                .predictions-section {
                    margin: 30px 0;
                }

                .footer {
                    text-align: center;
                    margin-top: 60px;
                    padding-top: 30px;
                    border-top: 2px solid var(--medium-bg);
                    color: var(--light-text);
                }

                .footer p {
                    margin: 5px 0;
                    font-size: 0.9rem;
                }

                @media (max-width: 768px) {
                    body {
                        padding: 15px;
                    }
                    
                    .report-container {
                        padding: 20px;
                    }
                    
                    h1 {
                        font-size: 2rem;
                    }
                    
                    .summary-grid {
                        grid-template-columns: 1fr;
                    }
                    
                    .data-table {
                        font-size: 0.8rem;
                    }
                    
                    .data-table th,
                    .data-table td {
                        padding: 8px 10px;
                    }
                }

                @media print {
                    body {
                        background: white;
                        padding: 0;
                    }
                    
                    .report-container {
                        box-shadow: none;
                        border: none;
                    }
                    
                    .section {
                        page-break-inside: avoid;
                    }
                }
            </style>
        </head>
        <body>
            <div class="report-container">
                <div class="header">
                    <div class="logo-container">
                        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABAAAAAQACAYAAAB/HSuDAAABMWlDQ1BBZG9iZSBSR0IgKDE5OTgpAAAoz62OsUrDUBRAz4ui4lArBHFweJMoKLbqYMakLUUQrNUhydakoUppEl5e1X6Eo1sHF3e/wMlRcFD8Av9AcergECGDgwie6dzD5XLBqNh1p2GUYRBr1W460vV8OfvEDFMA0Amz1G61DgDiJI74wecrAuB50647Df7GfJgqDUyA7W6UhSAqQP9CpxrEGDCDfqpB3AGmOmnXQDwApV7uL0ApyP0NKCnX80F8AGbP9Xww5gAzyH0FMHV0qQFqSTpSZ71TLauWZUm7mwSRPB5lOhpkcj8OE5UmqqOjLpD/B8BivthuOnKtall76/wzrufL3N6PEIBYeixaQThU598qjJ3f5+LGeBkOb2F6UrTdK7jZgIXroq1WobwF9+MvwMZP/U6/OGUAAAAJcEhZcwAACxMAAAsTAQCanBgAAAt4aVRYdFhNTDpjb20uYWRvYmUueG1wAAAAAAA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/PiA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJBZG9iZSBYTVAgQ29yZSA1LjYtYzE0MiA3OS4xNjA5MjQsIDIwMTcvMDcvMTMtMDE6MDY6MzkgICAgICAgICI+IDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+IDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdEV2dD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlRXZlbnQjIiB4bWxuczpzdFJlZj0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlUmVmIyIgeG1sbnM6dGlmZj0iaHR0cDovL25zLmFkb2JlLmNvbS90aWZmLzEuMC8iIHhtbG5zOmV4aWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vZXhpZi8xLjAvIiB4bXA6Q3JlYXRvclRvb2w9IkFkb2JlIFBob3Rvc2hvcCBDQyAyMDE4IChXaW5kb3dzKSIgeG1wOkNyZWF0ZURhdGU9IjIwMjUtMDUtMzBUMDc6MDM6MTIrMDI6MDAiIHhtcDpNZXRhZGF0YURhdGU9IjIwMjUtMDYtMjZUMTY6NDk6MjUrMDI6MDAiIHhtcDpNb2RpZnlEYXRlPSIyMDI1LTA2LTI2VDE2OjQ5OjI1KzAyOjAwIiBwaG90b3Nob3A6Q29sb3JNb2RlPSIzIiBwaG90b3Nob3A6SUNDUHJvZmlsZT0iQWRvYmUgUkdCICgxOTk4KSIgZGM6Zm9ybWF0PSJpbWFnZS9wbmciIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6OWYyMTU5MjMtMDkzNi02MDQ0LTk1OWEtMzllNjdmYjdkMTFkIiB4bXBNTTpEb2N1bWVudElEPSJhZG9iZTpkb2NpZDpwaG90b3Nob3A6MWJhNjRmNWYtYjY2NC01NzRlLTk5ZGYtYzI3NDNhNjk5NGJmIiB4bXBNTTpPcmlnaW5hbERvY3VtZW50SUQ9InhtcC5kaWQ6YWRlZGQzMTItZWJhMS0zMDQ2LTk4ZTMtYWEyMDM1YTdlMjVlIiB0aWZmOk9yaWVudGF0aW9uPSIxIiB0aWZmOlhSZXNvbHV0aW9uPSI3MjAwMDAvMTAwMDAiIHRpZmY6WVJlc29sdXRpb249IjcyMDAwMC8xMDAwMCIgdGlmZjpSZXNvbHV0aW9uVW5pdD0iMiIgZXhpZjpDb2xvclNwYWNlPSI2NTUzNSIgZXhpZjpQaXhlbFhEaW1lbnNpb249IjEwMjQiIGV4aWY6UGl4ZWxZRGltZW5zaW9uPSIxMDI0Ij4gPHBob3Rvc2hvcDpUZXh0TGF5ZXJzPiA8cmRmOkJhZz4gPHJkZjpsaSBwaG90b3Nob3A6TGF5ZXJOYW1lPSJTdWIiIHBob3Rvc2hvcDpMYXllclRleHQ9IkluIFZpdm8gTWV0cmljcyIvPiA8cmRmOmxpIHBob3Rvc2hvcDpMYXllck5hbWU9IlZpViIgcGhvdG9zaG9wOkxheWVyVGV4dD0iVmlWIi8+IDwvcmRmOkJhZz4gPC9waG90b3Nob3A6VGV4dExheWVycz4gPHhtcE1NOkhpc3Rvcnk+IDxyZGY6U2VxPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0iY3JlYXRlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDphZGVkZDMxMi1lYmExLTMwNDYtOThlMy1hYTIwMzVhN2UyNWUiIHN0RXZ0OndoZW49IjIwMjUtMDUtMzBUMDc6MDM6MTIrMDI6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCBDQyAyMDE4IChXaW5kb3dzKSIvPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0ic2F2ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6MTVlMTMwYTUtOTY5ZS0wNzQ1LTg3MzEtNzFkMTcxNTZmZWVmIiBzdEV2dDp3aGVuPSIyMDI1LTA1LTMwVDA5OjQxOjMyKzAyOjAwIiBzdEV2dDpzb2Z0d2FyZUFnZW50PSJBZG9iZSBQaG90b3Nob3AgQ0MgMjAxOCAoV2luZG93cykiIHN0RXZ0OmNoYW5nZWQ9Ii8iLz4gPHJkZjpsaSBzdEV2dDphY3Rpb249InNhdmVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOjk4ZmMwZDNlLWNkZGMtZjQ0NS04MTdmLTg0MjhiZmQ3MDc0MiIgc3RFdnQ6d2hlbj0iMjAyNS0wNi0yNlQxNjo0OToyNSswMjowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTggKFdpbmRvd3MpIiBzdEV2dDpjaGFuZ2VkPSIvIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjb252ZXJ0ZWQiIHN0RXZ0OnBhcmFtZXRlcnM9ImZyb20gYXBwbGljYXRpb24vdm5kLmFkb2JlLnBob3Rvc2hvcCB0byBpbWFnZS9wbmciLz4gPHJkZjpsaSBzdEV2dDphY3Rpb249ImRlcml2ZWQiIHN0RXZ0OnBhcmFtZXRlcnM9ImNvbnZlcnRlZCBmcm9tIGFwcGxpY2F0aW9uL3ZuZC5hZG9iZS5waG90b3Nob3AgdG8gaW1hZ2UvcG5nIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJzYXZlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDo5ZjIxNTkyMy0wOTM2LTYwNDQtOTU5YS0zOWU2N2ZiN2QxMWQiIHN0RXZ0OndoZW49IjIwMjUtMDYtMjZUMTY6NDk6MjUrMDI6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCBDQyAyMDE4IChXaW5kb3dzKSIgc3RFdnQ6Y2hhbmdlZD0iLyIvPiA8L3JkZjpTZXE+IDwveG1wTU06SGlzdG9yeT4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6OThmYzBkM2UtY2RkYy1mNDQ1LTgxN2YtODQyOGJmZDcwNzQyIiBzdFJlZjpkb2N1bWVudElEPSJhZG9iZTpkb2NpZDpwaG90b3Nob3A6NzJlNTVkMDktN2JmZi1mYjQ0LTg5MjUtNmY2ZDU1NWYwOGM0IiBzdFJlZjpvcmlnaW5hbERvY3VtZW50SUQ9InhtcC5kaWQ6YWRlZGQzMTItZWJhMS0zMDQ2LTk4ZTMtYWEyMDM1YTdlMjVlIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+vT7QsgABevZJREFUeNrs3Xl8nFXd//+2pE2TJplJJkmzNmlyZU9mmlnTJUMXmylJ21nTlrKDIKLCjaIgbiCKKC6Iogg3Ilu2Fr1v/bojgqJszWwBBG7gB3rjjSIqqGylc35/nOuamUxm0oBNm2Re83g8H9Dsua7JmXPe55zPWSSEWAQAAAAAABY2LgIAAAAAAAQAAAAAAACAAAAAAAAAABAAAAAAAAAAAgAAAAAAAEAAAAAAAAAACAAAAAAAAAABAAAAAAAAIAAAAAAAAIAAAAAAAAAAEAAAAAAAAAACAAAAAAAAQAAAAAAAAAAIAAAAAAAAAAEAAAAAAAAgAAAAAAAAAAQAAAAAAAAQAAAAAAAAAAIAAAAAAABAAAAAAAAAAAgAAAAAAAAAAQAAAAAAACAAAAAAAAAABAAAAAAAAIAAAAAAAAAAAgAuAgAAAAAABAAAAAAAAIAAAAAAAAAAEAAAAAAAAAACAAAAAAAAQAAAAAAAAAAIAAAAAAAAAAEAAAAAAAAgAAAAAAAAgAAAAAAAAAAQAAAAAAAAAAIAAAAAAABAAAAAAAAAAAgAAAAAAAAAAQAAAAAAACAAAAAAAAAABAAAAAAAABAAAAAAAAAAAgAAAAAAAEAAAAAAAAAACAAAAAAAAAABAAAAAAAAIAAAAAAAAAAEAAAAAAAAgAAAAAAAAAACAC4CAAAAAAAEAAAAAAAAgAAAAAAAAAAQAAAAAAAAAAIAAAAAAABAAAAAAAAAAAgAAAAAAAAAAQAAAAAAACAAAAAAAACAAAAAAAAAABAAAAAAAAAAAgAAAAAAAEAAAAAAAAAACAAAAAAAAAABAAAAAAAAIAAAAAAAAAAEAAAAAAAAEAAAAAAAAAACAAAAAAAAQAAAAAAAAAAIAAAAAAAAAAEAAAAAAAAgAAAAAAAAAAQAAAAAAACAAAAAAAAAAAIALgIAAAAAAAQAAAAAAACAAAAAAAAAABAAAAAAAAAAAgAAAAAAAEAAAAAAAAAACAAAAAAAAAABAAAAAAAAIAAAAAAAAIAAAAAAAAAAEAAAAAAAAAACAAAAAAAAQAAAAAAAAAAIAAAAAAAAAAEAAAAAAAAgAAAAAAAAAAQAAAAAAAAQAAAAAAAAAAIAAAAAAABAAAAAAAAAAAgAAAAAAAAAAQAAAAAAACAAAAAAAAAABAAAAAAAAIAAAAAAAAAAAgAAAAAAAEAAAAAAAAAACAAAAAAAAAABAAAAAAAAIAAAAAAAAAAEAAAAAAAAgAAAAAAAAAAQAAAAAAAAAAIAAAAAAAAIAAAAAAAAAAEAAAAAAAAgAAAAAAAAAAQAAAAAAACAAAAAAAAAABAAAAAAAAAAAgAAAAAAAEAAAAAAAAAAAQAAAAAAACAAAAAAAAAABAAAAAAAAIAAAAAAAAAAEAAAAAAAAAACAAAAAAAAQAAAAAAAAAAIAAAAAAAAIAAAAAAAAAAEAAAAAAAAgAAAAAAAAAAQAAAAAAAAAAIAAAAAAABAAAAAAAAAAAgAAAAAAAAAAQAAAAAAACAAAAAAAACAAAAAAAAAABAAAAAAAAAAAgAAAAAAAEAAAAAA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AAQAAAAAgAAAAAAAEAAAAAAAAgAAAAAQAAAAAAACAAAAAEAAAAAAAAgAAAAAAAEAAAAAIAAAAAAABAAAAACAAAAAAAAEAAAAAIAAAAAAABAAAAAAAAIAAAAAQAAAAAAACAAAAAAAAQAAAAAgAAAAAAABAAAAACAAAAAAAAQAAAAAgAAAAAAAEAAAAAAAAgAAAABAAAAAAAAIAAAAAACDAAAAAAIAAAAAQAAAAAAACAAAAAAAAQAAAAAgAAAAAAAEAAAAAIAAAAAAABAAAAAAgAAAAAAAEAAAAAAAAgAAAABAAAAAAAAIAAAAAAABAAAAACAAAAAAAAQAAAAAIAAAAAAABAAAAACAAAAAAAAQAAAAAAACAAAAAEAAAAAAAAgAAAAAAAEAAAAACAAMAgAAAAgAAAAAAAEAAAAAIAAAAAAABAAAAACAAAAAAAAQAAAAAAACAAAAAEAAAAAAAAIAAAAAQAAAAAAACAAAAAAAAQAAAAAgAAAAAAAEAAAAAIAAAAAAABAAAAAAgAAAAAAAEAAAAAAAAgAAAABAAAAAAAAIAAAAAAABAAAAACAAAAAAAJbq/wE192CkzHStuwAAAABJRU5ErkJggg==" alt="ViVo Logo" style="width: 256px; height: 256px;">
                    </div>
                    <h1>ViVo: Complete Analysis Report</h1>
                    <div class="header-subtitle">In Vivo Metrics - ${data.measurementType} Analysis</div>
                    <div class="meta-info">
                        Generated on: ${currentDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })} at ${currentDate.toLocaleTimeString('en-US')}
                    </div>
                    ${currentFileName ? `<div class="meta-info">Dataset: ${currentFileName}</div>` : ''}
                </div>

                <div class="section">
                    <h2>Executive Summary</h2>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; margin-bottom: 30px;">
                        <div class="summary-card">
                            <h4 style="font-size: 0.8rem; margin-bottom: 6px;">Dataset Overview</h4>
                            <div class="metric">
                                <span class="metric-label">Total Animals:</span>
                                <span class="metric-value">${data.processedData.validAnimals ? data.processedData.validAnimals.length : 0}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Data Type:</span>
                                <span class="metric-value">${data.measurementType}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Analysis Date:</span>
                                <span class="metric-value">${currentDate.toLocaleDateString()}</span>
                            </div>
                        </div>
                        
                        <div class="summary-card">
                            <h4 style="font-size: 0.8rem; margin-bottom: 6px;">Model Quality</h4>
                            <div class="metric">
                                <span class="metric-label">Analyzed Models:</span>
                                <span class="metric-value">${Object.keys(data.animalModels).length}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Avg R²:</span>
                                <span class="metric-value">${Object.values(data.animalModels).length > 0 ?
                (Object.values(data.animalModels).reduce((sum, model) => sum + (model.model?.r2 || 0), 0) / Object.values(data.animalModels).length).toFixed(3) : 'N/A'}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Quality Assessment:</span>
                                <span class="metric-value">
                                    ${(() => {
                if (Object.values(data.animalModels).length === 0) return 'N/A';
                const avgR2 = Object.values(data.animalModels).reduce((sum, model) => sum + model.model.r2, 0) / Object.values(data.animalModels).length;
                if (avgR2 >= 0.95) return '<span class="quality-indicator quality-excellent">Excellent</span>';
                if (avgR2 >= 0.90) return '<span class="quality-indicator quality-good">Good</span>';
                if (avgR2 >= 0.80) return '<span class="quality-indicator quality-fair">Fair</span>';
                return '<span class="quality-indicator quality-poor">Poor</span>';
            })()}
                                </span>
                            </div>
                        </div>

                        <div class="summary-card">
                            <h4 style="font-size: 0.8rem; margin-bottom: 6px;">Growth Analysis</h4>
                            <div class="metric">
                                <span class="metric-label">Experimental Groups:</span>
                                <span class="metric-value">${data.processedData.validAnimals ?
                new Set(data.processedData.validAnimals.map(a => a.group)).size : 0}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Time Points:</span>
                                <span class="metric-value">${data.processedData.validAnimals && data.processedData.validAnimals.length > 0 ?
                data.processedData.validAnimals[0].timePoints.length : 0}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Study Duration:</span>
                                <span class="metric-value">${data.processedData.validAnimals && data.processedData.validAnimals.length > 0 ?
                Math.max(...data.processedData.validAnimals[0].timePoints) : 0} days</span>
                            </div>
                        </div>
                    </div>
                </div>

                ${this._generateOutlierAnalysisHTML() ? `
                <div class="section">
                    ${this._generateOutlierAnalysisHTML()}
                </div>
                ` : ''}

                ${this._generateHomogeneityAnalysisHTML() ? `
                <div class="section">
                    ${this._generateHomogeneityAnalysisHTML()}
                </div>
                ` : ''}

                <div class="section">
                    <h2>Growth Analysis Charts</h2>
                    
                    ${data.mainChartImg ? `
                    <div class="chart-container">
                        <h3>Individual Growth Curves and Group Averages</h3>
                        <img src="${data.mainChartImg}" alt="Main Growth Analysis Chart" />
                        ${this._generateGroupLegend(data.processedData)}
                        <p style="font-size: 0.9rem; color: var(--light-text); margin-top: 15px;">
                            This chart shows individual animal data and group averaged growth trajectories with exponential fits.
                        </p>
                    </div>
                    ` : '<p style="color: var(--light-text);">Main chart not available</p>'}

                    ${data.normalizedChartImg ? `
                    <div class="chart-container">
                        <h3 style="margin-top: -15px;">Normalized Growth Functions Comparison</h3>
                        <img src="${data.normalizedChartImg}" alt="Normalized Growth Comparison Chart" />
                        <p style="font-size: 0.9rem; color: var(--light-text); margin-top: 50px;">
                            Normalized growth functions comparing different experimental groups. 
                            Functions are scaled to initial value for direct comparison of growth patterns.
                        </p>
                    </div>
                    ` : '<p style="color: var(--light-text);">Normalized chart not available</p>'}
                </div>

                <div class="section">
                    <h2>Detailed Analysis Results</h2>
                    
                    ${this._generateGroupStatisticsSummary(data)}
                    
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th style="text-align: left !important;">Animal ID</th>
                                <th>Group</th>
                                <th>R²</th>
                                <th>${data.paramLabel}${data.unitLabel}</th>
                                <th>Growth Rate (r)</th>
                                <th>Doubling Time</th>
                                <th>Final ${data.measurementType}${data.unitLabel}</th>
                                <th>Growth Factor</th>
                                <th>Quality</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.entries(data.animalModels).map(([animalId, modelData]) => {
                    const model = modelData.model;
                    const doublingTime = model.r != null && model.r > 0 ? (Math.log(2) / model.r).toFixed(1) : 'Infinity';
                    const animal = data.processedData.validAnimals?.find(a => a.id === animalId);
                    const finalValue = animal ? animal.measurements[animal.measurements.length - 1] : 'N/A';
                    const growthFactor = animal && model.a != null && finalValue != null ? (finalValue / model.a).toFixed(2) : 'N/A';

                    // Determine quality based on R² using same logic as homogeneity analysis
                    let qualityText = 'poor';
                    if (model.r2 >= 0.95) { qualityText = 'excellent'; }
                    else if (model.r2 >= 0.90) { qualityText = 'good'; }
                    else if (model.r2 >= 0.80) { qualityText = 'fair'; }
                    
                    const qualityColor = this._getHomogeneityColor(qualityText);

                    return `
                                <tr>
                                    <td style="text-align: left !important;"><strong>${animalId}</strong></td>
                                    <td>${animal ? animal.group : 'Unknown'}</td>
                                    <td>${model.r2 != null ? model.r2.toFixed(4) : 'N/A'}</td>
                                    <td>${model.a != null ? (data.dataType === 'bli' ? model.a.toExponential(3) : model.a.toFixed(2)) : 'N/A'}</td>
                                    <td>${model.r != null ? model.r.toFixed(6) : 'N/A'}</td>
                                    <td>${doublingTime} days</td>
                                    <td>${typeof finalValue === 'number' && finalValue != null ? finalValue.toFixed(2) : (finalValue || 'N/A')}</td>
                                    <td>${growthFactor}x</td>
                                    <td><span style="color: ${qualityColor}; font-weight: bold;">${qualityText.charAt(0).toUpperCase() + qualityText.slice(1)}</span></td>
                                </tr>
                                `;
                }).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- Statistical Comparisons Section -->
                ${this._generateStatisticalComparisonHTML() ? `
                <div class="section">
                    ${this._generateStatisticalComparisonHTML()}
                </div>
                ` : ''}

                <!-- TGR Matrices & Analysis Section -->
                ${data.matricesHTML ? `
                <div class="section">
                    <div class="matrices-section">
                        ${data.matricesHTML}
                    </div>
                </div>
                ` : ''}

                <!-- Predictions Section -->
                ${data.predictionsHTML ? `
                <div class="section">
                    <div class="predictions-section">
                        ${data.predictionsHTML}
                    </div>
                </div>
                ` : ''}

                <!-- Footer -->
                <div class="footer">
                    <p><strong>ViVo: <i>In Vivo</i> Metrics Analysis Platform</strong></p>
                    <p>Advanced tumor growth analysis and exponential modeling</p>
                    <p style="font-size: 0.8rem; margin-top: 15px;">
                        Generated on ${currentDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })} at ${currentDate.toLocaleTimeString('en-US')} | 
                        ${window.DOMConfigurationManager ? window.DOMConfigurationManager.getVersion() : 'Research Beta 1.0'} | 
                        <a href="https://github.com/gcanudo-barreras/ViVo-Platform" target="_blank" style="color: var(--accent-color);">Documentation</a>
                    </p>
                    <p style="font-size: 0.8rem; color: var(--light-text);">
                        This software is developed for research purposes under the MIT License. Please cite appropriately when used in scientific publications.
                    </p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    /**
     * Genera HTML para análisis de outliers en el reporte completo
     * @private
     */
    _generateOutlierAnalysisHTML() {
        try {
            // Get outlier analysis data from primary source
            const globalData = this._getGlobalData();
            const outlierAnalysis = globalData.outlierAnalysis;

            if (!outlierAnalysis) {
                return null;
            }


            // Extract data from the correct structure
            const totalAnomalies = outlierAnalysis.summary?.totalFlags || outlierAnalysis.flags?.length || 0;
            const criticalAnomalies = outlierAnalysis.summary?.severityCounts?.critical || 0;
            const highAnomalies = outlierAnalysis.summary?.severityCounts?.high || 0;
            const mediumAnomalies = outlierAnalysis.summary?.severityCounts?.medium || 0;
            const lowAnomalies = outlierAnalysis.summary?.severityCounts?.low || 0;
            const totalAnimalsAnalyzed = outlierAnalysis.animals?.length || outlierAnalysis.dualAnalysis?.complete?.count || 'N/A';

            // Generate severity breakdown
            const severityBreakdown = [
                { level: 'Critical', count: criticalAnomalies, color: 'var(--danger-color)', description: 'Extreme deviations requiring immediate review' },
                { level: 'High', count: highAnomalies, color: 'var(--accent-color)', description: 'Likely problematic measurements' },
                { level: 'Medium', count: mediumAnomalies, color: 'var(--warning-color)', description: 'Statistical outliers worth investigating' },
                { level: 'Low', count: lowAnomalies, color: 'var(--success-color)', description: 'Minor concerns, boundary cases' }
            ].filter(item => item.count > 0);

            // Generate recommendation badge
            const recommendation = outlierAnalysis.recommendations?.[0]?.title ||
                (totalAnomalies === 0 ? 'Excellent Data Quality' : 'Review Data Quality');
            const recommendationColor = recommendation.toLowerCase().includes('excellent') ? 'var(--success-color)' :
                recommendation.toLowerCase().includes('good') ? 'var(--good-color)' :
                    recommendation.toLowerCase().includes('review') ? 'var(--danger-color)' : 'var(--warning-color)';

            // Get current anomaly filtering level
            const currentFilterLevel = document.getElementById('outlierFiltering')?.value || 'criticalAndHigh';
            const filterLevelText = currentFilterLevel === 'critical' ? 'Critical Only' :
                currentFilterLevel === 'criticalAndHigh' ? 'Critical + High' :
                currentFilterLevel === 'all' ? 'All Anomalies' : 'Critical + High (default)';

            let html = `
                <h2>Data Quality & Outlier Analysis</h2>
                
                <!-- Filtering Configuration Banner -->
                <div style="background: #e3f2fd; border-left: 4px solid var(--good-color); padding: 15px; margin-bottom: 25px; border-radius: 8px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="color: #1976d2; font-size: 0.9rem; font-weight: 600;">
                            <strong>Anomaly Filtering Level:</strong> ${filterLevelText}
                        </span>
                        <span style="color: #666; font-size: 0.85rem;">
                            (applied in calculations and statistical analysis)
                        </span>
                    </div>
                </div>
                
                <div class="outlier-overview" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; margin-bottom: 30px;">
                    <div class="summary-card">
                        <h4 style="font-size: 0.8rem; margin-bottom: 6px;">Detection Summary</h4>
                        <div class="metric">
                            <span class="metric-label">Total Animals Analyzed:</span>
                            <span class="metric-value">${totalAnimalsAnalyzed}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Total Anomalies Detected:</span>
                            <span class="metric-value" style="color: ${totalAnomalies > 0 ? 'var(--danger-color)' : 'var(--success-color)'};">${totalAnomalies}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Detection Method:</span>
                            <span class="metric-value">${outlierAnalysis.summary?.configUsed || 'Intelligent Statistical Analysis'}</span>
                        </div>
                    </div>
                    
                    <div class="summary-card">
                        <h4 style="font-size: 0.8rem; margin-bottom: 6px;">Dual Analysis Selection</h4>
                        ${this._generateDualAnalysisSummary(outlierAnalysis)}
                    </div>
                </div>
            `;

            // Add severity breakdown if there are anomalies
            if (totalAnomalies > 0) {
                html += `
                    <div class="severity-breakdown" style="margin: 30px 0;">
                        <h3>Anomaly Severity Breakdown</h3>
                        <div class="severity-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                `;

                severityBreakdown.forEach(item => {
                    html += `
                        <div class="severity-card" style="border: 2px solid ${item.color}; border-radius: 8px; padding: 15px; background: ${item.color}15;">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                                <h4 style="margin: 0; color: ${item.color};">${item.level}</h4>
                                <span style="color: ${item.color}; font-weight: bold; font-size: 1.2rem;">${item.count}</span>
                            </div>
                            <p style="margin: 0; font-size: 0.9rem; color: #666;">${item.description}</p>
                        </div>
                    `;
                });

                html += `
                        </div>
                    </div>
                `;

                // Add detailed anomalies table if available  
                if (outlierAnalysis.flags && outlierAnalysis.flags.length > 0) {
                    html += `
                        <div class="anomalies-detail" style="margin: 30px 0;">
                            <h3>Detailed Anomaly Report</h3>
                            <p style="color: #666; font-size: 0.9rem; margin-bottom: 15px;">
                                <strong>Note:</strong> The "Status" column indicates whether each anomaly was excluded from analysis based on the current filtering level (${filterLevelText}).
                            </p>
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th style="padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6;">Animal ID</th>
                                        <th style="padding: 12px; border-bottom: 1px solid #dee2e6;">Group</th>
                                        <th style="padding: 12px; border-bottom: 1px solid #dee2e6;">Severity</th>
                                        <th style="padding: 12px; border-bottom: 1px solid #dee2e6;">Type</th>
                                        <th style="padding: 12px; border-bottom: 1px solid #dee2e6;">Day</th>
                                        <th style="padding: 12px; border-bottom: 1px solid #dee2e6;">Value</th>
                                        <th style="padding: 12px; border-bottom: 1px solid #dee2e6;">Status</th>
                                    </tr>
                                </thead>
                            <tbody>
                    `;

                    // Helper function to get severity from flag type
                    const getSeverity = (flagType) => {
                        return globalData.flagTypes?.[flagType]?.severity || 'medium';
                    };

                    // Sort all anomalies: first by animal ID, then by severity (critical > high > medium > low)
                    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
                    const sortedAnomalies = [...outlierAnalysis.flags].sort((a, b) => {
                        // First sort by animal ID (ensure they are strings)
                        const animalA = String(a.animalId || 'Unknown');
                        const animalB = String(b.animalId || 'Unknown');
                        if (animalA !== animalB) {
                            return animalA.localeCompare(animalB);
                        }

                        // Then sort by severity (highest first)
                        const severityA = getSeverity(a.type);
                        const severityB = getSeverity(b.type);
                        return severityOrder[severityB] - severityOrder[severityA];
                    });

                    // Display all anomalies grouped by animal and ordered by severity
                    let currentAnimal = null;
                    sortedAnomalies.forEach((flag, index) => {
                        const severity = getSeverity(flag.type);
                        const severityColor = severity === 'critical' ? 'var(--danger-color)' :
                            severity === 'high' ? 'var(--accent-color)' :
                                severity === 'medium' ? 'var(--warning-color)' : 'var(--success-color)';

                        // Add animal group separator if this is a new animal
                        const animalId = flag.animalId || 'Unknown';
                        if (currentAnimal !== animalId) {
                            currentAnimal = animalId;
                            if (index > 0) {
                                html += `
                                    <tr style="border-top: 2px solid #dee2e6;">
                                        <td colspan="5" style="padding: 0; margin: 0;"></td>
                                    </tr>
                                `;
                            }
                        }

                        // Determine if this anomaly is included based on current filtering
                        const isIncluded = this._isAnomalyIncludedInAnalysis(flag, currentFilterLevel, severity);
                        
                        html += `
                            <tr style="border-bottom: 1px solid #dee2e6; ${index % 2 === 0 ? 'background: #f8f9fa;' : ''}">
                                <td style="padding: 10px; text-align: left;"><strong>${flag.animalId || 'N/A'}</strong></td>
                                <td style="padding: 10px;">${flag.group || 'N/A'}</td>
                                <td style="padding: 10px;">
                                    <span style="color: ${severityColor}; font-weight: bold; text-transform: uppercase;">
                                        ${severity}
                                    </span>
                                </td>
                                <td style="padding: 10px;">${flag.type || 'Statistical'}</td>
                                <td style="padding: 10px;">${flag.day !== undefined ? flag.day : 'N/A'}</td>
                                <td style="padding: 10px;">${flag.value != null ? flag.value.toFixed(2) : 'N/A'}</td>
                                <td style="padding: 10px;">
                                    <span style="color: ${isIncluded ? 'var(--danger-color)' : 'var(--success-color)'}; font-weight: 600;">
                                        ${isIncluded ? 'Excluded' : 'Included'}
                                    </span>
                                </td>
                            </tr>
                        `;
                    });

                    html += `
                                    </tbody>
                                </table>
                    `;

                    html += `
                            </div>
                        </div>
                    `;
                }
            } else {
                html += `
                    <div class="no-anomalies" style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
                        <h3 style="color: var(--success-color); margin-top: 0;">Excellent Data Quality</h3>
                        <p style="color: var(--success-color); margin-bottom: 0;">No significant anomalies detected in the dataset. All measurements appear to be within expected ranges.</p>
                    </div>
                `;
            }

            // Add methodology note
            html += `
                <div class="methodology-note" style="background: #e9ecef; border-radius: 8px; border-left: 4px solid #6c757d; padding: 15px; margin: 30px 0; font-size: 0.9rem;">
                    <h4 style="margin-top: 0; color: #495057;">Detection Methodology</h4>
                    <p style="margin-bottom: 0; color: #6c757d;">
                        Outlier analysis performed using advanced statistical methods including Z-score analysis, 
                        interquartile range (IQR) detection, growth pattern consistency evaluation, and biological plausibility checks. 
                        Critical anomalies indicate extreme deviations that may significantly impact analysis results and should be reviewed carefully.
                    </p>
                </div>
            `;

            return html;

        } catch (error) {
            // Error generating outlier analysis HTML
            return `
                <h2>Data Quality & Outlier Analysis</h2>
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <p style="color: #856404; margin: 0;">
                        <strong>Note:</strong> Outlier analysis data is not available for this report. 
                        Run the "Analyze Outliers" function to include detailed anomaly detection in future reports.
                    </p>
                </div>
            `;
        }
    }

    /**
     * Obtiene estadísticas de rendimiento del generador de reportes
     * @returns {Object} Estadísticas de rendimiento
     */
    getPerformanceStats() {
        return {
            hasChartService: !!this.chartService
        };
    }

    _isTrendLine(trace) {
        if (!trace?.name || typeof trace.name !== 'string') return false;
        const name = trace.name.toLowerCase();
        return name.includes('avg') || name.includes('average') || 
               name.includes('mean') || name.includes('media') ||
               name.includes('trend') || name.includes('group average') ||
               (trace.mode && trace.mode === 'lines' && /^[a-z0-9]+$/i.test(trace.name.trim()));
    }

    _extractGroupFromTrendLine(trace) {
        if (!trace?.name || typeof trace.name !== 'string') return 'Unknown';
        
        if (/^[a-z0-9]+$/i.test(trace.name.trim())) {
            return trace.name.trim();
        }
        
        let step1 = trace.name.replace(/(avg|average|mean|media|trend|group\s*average|promedio|tendencia)/gi, '');
        let step2 = step1.replace(/[_\s\-()\[\]]+/g, ' ');
        let step3 = step2.replace(/\s+/g, ' ').trim();
        
        if (!step3) {
            const words = trace.name.split(/[\s_\-()\[\]]+/);
            step3 = words.find(word => 
                word.length > 1 && 
                !/(avg|average|mean|media|trend|group|promedio|tendencia)/gi.test(word)
            ) || words[0] || 'Unknown';
        }
        
        const step5 = step3.replace(/\s*\d+$/, '').trim();
        return this._normalizeGroupName(step5);
    }
    
    _extractGroupFromScatterTrace(trace) {
        if (!trace?.name || typeof trace.name !== 'string') return 'Unknown';
        
        let step1 = trace.name.replace(/\d+$/, '');
        let step2 = step1.replace(/[_\-\s]+$/, '').trim();
        
        if (!step2) {
            const match = trace.name.match(/^([a-zA-Z]+)/);
            step2 = match ? match[1] : 'Unknown';
        }
        
        return this._normalizeGroupName(step2);
    }

    _extractAnimalIdFromTrace(trace) {
        if (!trace?.name || typeof trace.name !== 'string') return 'Unknown';
        // Extract just the animal ID part, removing group info in parentheses
        const match = trace.name.match(/^([^\s(]+)/);
        return match ? match[1].trim() : trace.name.trim();
    }
    
    _normalizeGroupName(name) {
        if (!name || name === 'Unknown') return 'Unknown';
        const cleaned = name.trim().split(/[\s_-]/)[0];
        if (!cleaned) return 'Unknown';
        return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
    }

    /**
     * Crea un mapeo consistente de colores para líneas de tendencia
     * @private
     */

    /**
     * Generates dual analysis summary for the outlier analysis section
     * @private
     */
    _generateDualAnalysisSummary(outlierAnalysis) {
        try {
            const dualAnalysis = outlierAnalysis.dualAnalysis;
            const pointFiltering = outlierAnalysis.pointFilteringAnalysis;
            
            if (!dualAnalysis) {
                return `
                    <div class="metric">
                        <span class="metric-label">Data Selection:</span>
                        <span class="metric-value">All data (no outlier analysis)</span>
                    </div>
                `;
            }

            // Determine which option is currently selected by analyzing which dataset is being used
            let selectedOption = "All data";
            let excludedInfo = "";
            
            // Try to infer the active dataset type by comparing processedData with outlier analysis data
            let activeDatasetType = 'allData'; // default
            
            // Get current processed data to compare
            const globalData = this._getGlobalData();
            const currentProcessedData = globalData.processedData?.validAnimals || [];
            const currentAnimalsCount = currentProcessedData.length;
            
            if (dualAnalysis && currentAnimalsCount > 0) {
                const completeCount = dualAnalysis.complete.count;
                const filteredCount = dualAnalysis.filtered.count;
                const pointFilteredCount = pointFiltering?.animals?.length || 0;
                
                // Infer based on count matching
                if (currentAnimalsCount === filteredCount && filteredCount < completeCount) {
                    activeDatasetType = 'filteredAnimals';
                } else if (currentAnimalsCount === pointFilteredCount && pointFiltering) {
                    activeDatasetType = 'filteredPoints';
                } else if (currentAnimalsCount === completeCount) {
                    activeDatasetType = 'allData';
                } else {
                    // Fallback to state variables
                    const { usePointFiltering, useFilteredData, currentState } = globalData;
                    
                    if (usePointFiltering) {
                        activeDatasetType = 'filteredPoints';
                    } else if (useFilteredData) {
                        activeDatasetType = 'filteredAnimals';
                    } else {
                        switch (currentState) {
                            case 1: activeDatasetType = 'filteredAnimals'; break;
                            case 2: activeDatasetType = 'filteredPoints'; break;
                            default: activeDatasetType = 'allData'; break;
                        }
                    }
                }
            }
            
            // Set option text and excluded info based on active state
            switch (activeDatasetType) {
                case 'filteredAnimals':
                    selectedOption = "Filtered Animals";
                    if (dualAnalysis.impact.animalsExcluded > 0) {
                        const excludedIds = dualAnalysis.impact.excludedAnimalIds || [];
                        excludedInfo = `${dualAnalysis.impact.animalsExcluded} animals excluded: ${excludedIds.join(', ')}`;
                    }
                    break;
                case 'filteredPoints':
                    selectedOption = "Filtered Points";
                    if (pointFiltering && pointFiltering.excludedPoints > 0) {
                        excludedInfo = `${pointFiltering.excludedPoints} data points excluded`;
                    }
                    break;
                default:
                    selectedOption = "All data";
                    excludedInfo = "";
                    break;
            }

            return `
                <div class="metric">
                    <span class="metric-label">Analysis Option:</span>
                    <span class="metric-value" style="font-weight: 600;">
                        ${selectedOption}
                    </span>
                </div>
                ${excludedInfo ? `
                <div class="metric">
                    <span class="metric-label">Exclusions:</span>
                    <span class="metric-value" style="color: #666; font-size: 0.9rem;">
                        ${excludedInfo}
                    </span>
                </div>
                ` : ''}
                <div class="metric">
                    <span class="metric-label">Animals in Analysis:</span>
                    <span class="metric-value">
                        ${currentAnimalsCount}/${this._getTotalAnimalsInDataset()}
                    </span>
                </div>
            `;
        } catch (error) {
                return `
                <div class="metric">
                    <span class="metric-label">Analysis Status:</span>
                    <span class="metric-value">Information not available</span>
                </div>
            `;
        }
    }

    /**
     * Determines if an anomaly is included in the analysis based on filtering level
     * @private
     */
    _isAnomalyIncludedInAnalysis(flag, currentFilterLevel, severity) {
        // Day 0 is always included
        if (flag.day === 0) {
            return false; // False means included (not excluded)
        }

        // Check if this anomaly should be excluded based on filtering level
        const shouldExclude = (
            (currentFilterLevel === 'critical' && severity === 'critical') ||
            (currentFilterLevel === 'criticalAndHigh' && ['critical', 'high'].includes(severity)) ||
            (currentFilterLevel === 'all')
        );

        return shouldExclude; // True means excluded
    }

    /**
     * Generates group statistics summary for detailed analysis results
     * @private
     */
    _generateGroupStatisticsSummary(data) {
        try {
            if (!data.animalModels || !data.processedData?.validAnimals) {
                return '';
            }

            // Get total animals including both valid and invalid
            const totalValidAnimals = data.processedData.validAnimals || [];
            const totalInvalidAnimals = data.processedData.invalidAnimals || [];
            const allAnimals = [...totalValidAnimals, ...totalInvalidAnimals];

            // Group all animals by group (valid + invalid)
            const groupedAllAnimals = {};
            allAnimals.forEach(animal => {
                if (!groupedAllAnimals[animal.group]) {
                    groupedAllAnimals[animal.group] = [];
                }
                groupedAllAnimals[animal.group].push(animal);
            });

            // Group only valid animals by group
            const groupedValidAnimals = {};
            totalValidAnimals.forEach(animal => {
                if (!groupedValidAnimals[animal.group]) {
                    groupedValidAnimals[animal.group] = [];
                }
                groupedValidAnimals[animal.group].push(animal);
            });

            // Calculate group statistics
            const groupStats = {};
            for (const [groupName, validAnimals] of Object.entries(groupedValidAnimals)) {
                const groupModels = validAnimals
                    .map(animal => data.animalModels[animal.id]?.model)
                    .filter(model => model);

                if (groupModels.length === 0) continue;

                const stats = this._calculateGroupStatistics(groupModels);
                const totalAnimalsInGroup = groupedAllAnimals[groupName]?.length || validAnimals.length;
                const validAnimalsInGroup = validAnimals.length;
                const validityPercentage = (validAnimalsInGroup / totalAnimalsInGroup) * 100;

                groupStats[groupName] = {
                    totalAnimals: validAnimalsInGroup,
                    validModels: validAnimalsInGroup,
                    totalInDataset: totalAnimalsInGroup,
                    avgR2: stats.avgR2,
                    avgR: stats.avgR,
                    avgV0: stats.avgV0,
                    relErrorR: stats.relErrorR,
                    relErrorA: stats.relErrorA,
                    validityPercentage: validityPercentage
                };
            }

            let html = `
                <div class="group-summary" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; margin-bottom: 30px;">
            `;

            for (const [groupName, stats] of Object.entries(groupStats)) {
                const v0Label = data.dataType === 'bli' ? 'BLI₀' : 'V₀';
                const v0Value = stats.avgV0 != null ? (data.dataType === 'bli' ? stats.avgV0.toExponential(2) : stats.avgV0.toFixed(2)) : 'N/A';

                html += `
                    <div class="summary-card">
                        <h4 style="font-size: 0.8rem; margin-bottom: 6px;">${groupName}</h4>
                        <div class="metric">
                            <span class="metric-label">Animals:</span>
                            <span class="metric-value">${stats.totalAnimals}/${stats.totalInDataset}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Validity:</span>
                            <span class="metric-value" style="color: ${stats.validityPercentage >= 80 ? 'var(--success-color)' : stats.validityPercentage >= 60 ? 'var(--accent-color)' : 'var(--danger-color)'};">
                                ${stats.validityPercentage != null ? stats.validityPercentage.toFixed(1) : 'N/A'}%
                            </span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Avg R²:</span>
                            <span class="metric-value">${stats.avgR2 != null ? stats.avgR2.toFixed(3) : 'N/A'}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Avg r:</span>
                            <span class="metric-value">${stats.avgR != null ? stats.avgR.toFixed(4) : 'N/A'} ± ${stats.relErrorR || 'N/A'}%</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">${v0Label}:</span>
                            <span class="metric-value">${v0Value}${data.unitLabel} ± ${stats.relErrorA}%</span>
                        </div>
                    </div>
                `;
            }

            html += `
                </div>
                <p style="margin-bottom: 0; color: #6c757d; font-size: 0.9rem; margin-top: 15px;">
                    <strong>Note:</strong> Validity percentage indicates animals with R² ≥ 0.8. Animal counts show included vs. total.
                </p>
            `;

            return html;

        } catch (error) {
            return '';
        }
    }

    _getTotalAnimalsInDataset() {
        const globalData = this._getGlobalData();
        const processedData = globalData.processedData;
        const validAnimals = processedData.validAnimals || [];
        const invalidAnimals = processedData.invalidAnimals || [];
        return validAnimals.length + invalidAnimals.length;
    }

    _getGlobalData() {
        return {
            processedData: window.processedData || {},
            animalModels: window.animalModels || {},
            outlierAnalysis: window.AppState?.outlierAnalysis || window.outlierAnalysis,
            batchResults: window.batchPredictionForReport || window.AppState?.predictionService?.getBatchPredictionResults(),
            homogeneityResults: window.initialHomogeneityResults,
            homogeneityEvaluator: window.homogeneityEvaluator,
            growthMatrices: window.growthMatrices || {},
            customColorRange: window.customColorRange,
            optimizedColorRange: window.optimizedColorRange || { min: 0, max: 0 },
            controlGroup: window.controlGroup || 'Unknown',
            currentFileName: window.currentFileName || 'Unknown Dataset',
            flagTypes: window.FLAG_TYPES,
            usePointFiltering: window.AppState?.usePointFiltering || window.usePointFiltering || false,
            useFilteredData: window.AppState?.useFilteredData || window.useFilteredData || false,
            currentState: window.AppState?.currentState ?? window.currentState ?? 0
        };
    }

    _generateHash(str, shift = 5) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << shift) - hash);
        }
        return Math.abs(hash);
    }
    

    _getColorByHash(id, seed) {
        if (!id || id === 'Unknown') return this.professionalColors[0];
        const colorIndex = this._generateHash(id, seed) % this.professionalColors.length;
        return this.professionalColors[colorIndex];
    }

    _getSymbolByHash(id, seed) {
        if (!id || id === 'Unknown') return this.groupSymbols[0];
        const symbolIndex = this._generateHash(id, seed) % this.groupSymbols.length;
        return this.groupSymbols[symbolIndex];
    }

    /**
     * Centralized method to get consistent visual properties (color and symbol) for an animal
     * This ensures consistency between chart traces and legend items
     * @param {string} animalId - The unique identifier of the animal
     * @param {number} animalIndex - The index of the animal in the data array
     * @param {string} groupName - The group name the animal belongs to
     * @returns {object} Object with color and symbol properties
     */
    _getAnimalVisualProps(animalId, animalIndex, groupName) {
        if (this.animalVisualData[animalId]) {
            return this.animalVisualData[animalId];
        }
        return {
            color: this._getColorByHash(animalId, 7),
            symbol: this._getSymbolByHash(animalId, 5)
        };
    }

    _generateGroupLegend(processedData) {
        if (!processedData || !processedData.validAnimals) {
            return '';
        }

        const animalItems = processedData.validAnimals.map((animal, index) => {
            const visualProps = this._getAnimalVisualProps(animal.id, index, animal.group);
            const animalColor = visualProps.color;
            const animalSymbol = visualProps.symbol;
            
            return `
                <span class="animal-legend-item" style="
                    display: inline-flex;
                    align-items: center;
                    margin: 4px 8px;
                    white-space: nowrap;
                ">
                    <span class="animal-symbol" style="
                        color: ${animalColor}; 
                        font-size: 14px; 
                        font-weight: bold;
                        margin-right: 6px;
                        display: inline-block;
                        width: 16px;
                        text-align: center;
                    ">${this._getSymbolChar(animalSymbol)}</span>
                    <span class="animal-text" style="
                        color: var(--dark-text);
                        font-size: 0.85rem;
                    ">${animal.id}</span>
                </span>
            `;
        }).join('');

        return `
            <div class="animal-legend" style="
                padding: 12px 12px;
                margin-top: 35px;
                text-align: center;
            ">
                <div style="
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: center;
                    align-items: center;
                    gap: 2px;
                ">
                    ${animalItems}
                </div>
            </div>
        `;
    }

    _getSymbolChar(plotlySymbol) {
        return this.symbolMap[plotlySymbol] || '●';
    }
    
    _calculateGroupStatistics(groupModels) {
        const avgR2 = groupModels.reduce((sum, model) => sum + model.r2, 0) / groupModels.length;
        const avgR = groupModels.reduce((sum, model) => sum + model.r, 0) / groupModels.length;
        const avgV0 = groupModels.reduce((sum, model) => sum + model.a, 0) / groupModels.length;
        
        let stdR = 0, stdA = 0, seR = 0, seA = 0;
        if (groupModels.length > 1) {
            const sumSqR = groupModels.reduce((sum, model) => sum + Math.pow(model.r - avgR, 2), 0);
            const sumSqA = groupModels.reduce((sum, model) => sum + Math.pow(model.a - avgV0, 2), 0);
            
            stdR = Math.sqrt(sumSqR / (groupModels.length - 1));
            stdA = Math.sqrt(sumSqA / (groupModels.length - 1));
            
            const sqrtN = Math.sqrt(groupModels.length);
            seR = stdR / sqrtN;
            seA = stdA / sqrtN;
        }
        
        const relErrorR = avgR && seR > 0 ? (seR / Math.abs(avgR) * 100).toFixed(1) : '0.0';
        const relErrorA = avgV0 && seA > 0 ? (seA / Math.abs(avgV0) * 100).toFixed(1) : '0.0';
        
        return { avgR2, avgR, avgV0, relErrorR, relErrorA };
    }

}

const reportGenerator = new ReportGenerator();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReportGenerator;
}

if (typeof window !== 'undefined') {
    window.ReportGenerator = ReportGenerator;
    window.reportGenerator = reportGenerator;
}

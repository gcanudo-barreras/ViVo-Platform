/**
 * Centralized service for report generation and data export
 */

class ReportGenerator {
    constructor() {
        this.chartService = null;
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
            'triangle-down': '▼', 'star': '★', 'hexagon': '⬢', 'cross': '✚', 'x': '✖'
        };
    }

    initialize(chartService = null) {
        this.chartService = chartService;
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
                    height: chartId === 'mainChart' ? 400 : 350 // Reduced height for MainChart
                };

                const professionalColors = this.professionalColors;
                

                chartElement.data.forEach((trace, index) => {
                    const isTrendLine = this._isTrendLine(trace);
                    let groupName, animalColor, groupSymbol;
                    
                    if (isTrendLine) {
                        // Trend lines: use consistent group color
                        groupName = this._extractGroupFromTrendLine(trace);
                        animalColor = this._getConsistentGroupColor(groupName);
                        groupSymbol = null; // No symbols for trend lines
                    } else {
                        // Individual animal points: use centralized visual properties method
                        groupName = this._extractGroupFromScatterTrace(trace);
                        const animalId = this._extractAnimalIdFromTrace(trace);
                        const visualProps = this._getAnimalVisualProps(animalId, index, groupName);
                        animalColor = visualProps.color;
                        groupSymbol = visualProps.symbol;
                    }
                    
                    if (trace.line) {
                        trace.line.color = animalColor;
                        trace.line.width = isTrendLine ? 4 : 3;
                    } else if (trace.type === 'scatter') {
                        trace.line = {
                            color: animalColor,
                            width: isTrendLine ? 4 : 3
                        };
                    }
                    
                    if (trace.marker) {
                        trace.marker.color = animalColor;
                        trace.marker.size = 10; // Larger size for A4 printing
                        // Apply group-specific symbols to all points (including trend line markers)
                        if (groupSymbol) {
                            trace.marker.symbol = groupSymbol;
                        }
                        trace.marker.line = {
                            color: '#000000',
                            width: 0.8 // Thin black border for definition
                        };
                    } else if (trace.mode?.includes('markers')) {
                        const markerConfig = {
                            color: animalColor,
                            size: 10, // Larger size for A4 printing
                            line: {
                                color: '#000000',
                                width: 0.8 // Thin black border for definition
                            }
                        };
                        // Apply group-specific symbols
                        if (groupSymbol) {
                            markerConfig.symbol = groupSymbol;
                        }
                        trace.marker = markerConfig;
                    }
                });
                

                if (this.chartService?.chartPoolManager?.applyTemporaryTheme) {
                    try {
                        originalLayout = await this.chartService.chartPoolManager.applyTemporaryTheme(chartId, whiteLayout);
                    } catch (error) {
                        await Plotly.relayout(chartElement, whiteLayout);
                    }
                } else {
                    await Plotly.relayout(chartElement, whiteLayout);
                }

                // Brief wait for layout changes to apply
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            let capturedImage = null;
            if (typeof html2canvas !== 'undefined') {
                try {
                    const canvas = await html2canvas(chartElement, {
                        backgroundColor: '#ffffff',
                        scale: 2,
                        useCORS: true
                    });
                    capturedImage = canvas.toDataURL('image/png');
                } catch (error) {
                    capturedImage = null;
                }
            }

            if (hasPlotlyData && originalLayout) {
                if (this.chartService?.chartPoolManager?.restoreTheme) {
                    try {
                        await this.chartService.chartPoolManager.restoreTheme(chartId, originalLayout);
                        await Plotly.restyle(chartElement, originalData.map(trace => ({
                            'line.color': trace.line?.color,
                            'marker.color': trace.marker?.color,
                            'line.width': trace.line?.width,
                            'marker.size': trace.marker?.size
                        })));
                    } catch (error) {
                        await Plotly.react(chartElement, originalData, originalLayout);
                    }
                } else {
                    await Plotly.react(chartElement, originalData, originalLayout);
                }
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
                        <img src="https://raw.githubusercontent.com/gcanudo-barreras/vivo-platform/main/assets/ViVo_day.png" alt="ViVo Logo" style="width: 256px; height: 256px;">
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

                <!-- Data Quality & Outlier Analysis Section -->
                ${this._generateOutlierAnalysisHTML() ? `
                <div class="section">
                    ${this._generateOutlierAnalysisHTML()}
                </div>
                ` : ''}

                <!-- Model Homogeneity Analysis Section -->
                ${this._generateHomogeneityAnalysisHTML() ? `
                <div class="section">
                    ${this._generateHomogeneityAnalysisHTML()}
                </div>
                ` : ''}

                <!-- Growth Analysis Charts Section -->
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
                        <h3>Normalized Growth Functions Comparison</h3>
                        <img src="${data.normalizedChartImg}" alt="Normalized Growth Comparison Chart" />
                        <p style="font-size: 0.9rem; color: var(--light-text); margin-top: 15px;">
                            Normalized growth functions comparing different experimental groups. 
                            Functions are scaled to initial value for direct comparison of growth patterns.
                        </p>
                    </div>
                    ` : '<p style="color: var(--light-text);">Normalized chart not available</p>'}
                </div>

                <!-- Detailed Analysis Results Section -->
                <div class="section">
                    <h2>Detailed Analysis Results</h2>
                    
                    <!-- Group Statistics Summary -->
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
        return trace.name.trim();
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
    
    _getConsistentGroupColor(groupName) {
        if (!groupName || groupName === 'Unknown') return this.professionalColors[0];
        const colorIndex = this._generateHash(groupName, 5) % this.professionalColors.length;
        return this.professionalColors[colorIndex];
    }
    
    _getConsistentGroupSymbol(groupName) {
        if (!groupName || groupName === 'Unknown') return this.groupSymbols[0];
        const symbolIndex = this._generateHash(groupName, 3) % this.groupSymbols.length;
        return this.groupSymbols[symbolIndex];
    }

    _getConsistentAnimalSymbol(animalId) {
        if (!animalId || animalId === 'Unknown') return this.groupSymbols[0];
        const symbolIndex = this._generateHash(animalId, 5) % this.groupSymbols.length;
        return this.groupSymbols[symbolIndex];
    }

    _getAnimalColorFromChart(animalId, animalIndex) {
        if (!animalId || animalId === 'Unknown') return this.professionalColors[0];
        const colorIndex = this._generateHash(animalId, 7) % this.professionalColors.length;
        return this.professionalColors[colorIndex];
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
        return {
            color: this._getAnimalColorFromChart(animalId, animalIndex),
            symbol: this._getConsistentGroupSymbol(groupName)
        };
    }

    _generateGroupLegend(processedData) {
        if (!processedData || !processedData.validAnimals) {
            return '';
        }

        // Generate legend items for each individual animal
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
                padding: 12px 12% 12px 3%;
                margin-top: -30px;
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
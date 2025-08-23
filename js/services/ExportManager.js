class ExportManager {
    constructor() {
        this.reportGenerator = null;
        this.appState = null;
    }

    initialize(dependencies = {}) {
        this.reportGenerator = dependencies.reportGenerator || window.reportGenerator;
        this.appState = dependencies.appState || window.AppState;
    }

    export(type, options = {}) {
        const exportMethods = {
            'enhanced': () => this.exportEnhancedCSV(options),
            'batch': () => this.exportBatchPredictions(null, options),
            'tgr': () => this.exportTGRToCSV(null, options),
            'outlier': () => this.exportOutlierReport(null, options)
        };

        const method = exportMethods[type];
        if (!method) {
            this._showNotification(`Unknown export type: ${type}`, 'error');
            return false;
        }
        return method();
    }

    _getDynamicData() {
        return {
            processedData: window.processedData || this.appState?.processedData,
            animalModels: window.animalModels || this.appState?.animalModels,
            rawData: window.rawData || this.appState?.rawData,
            batchPredictionResults: window.batchPredictionResults,
            growthMatrices: window.growthMatrices || this.appState?.growthMatrices,
            outlierAnalysis: window.outlierAnalysis || this.appState?.outlierAnalysis
        };
    }

    _validateData(data, dataType) {
        if (!data) return { valid: false, message: `No ${dataType} to export` };
        if (Array.isArray(data) && data.length === 0) return { valid: false, message: `No ${dataType} available` };
        if (typeof data === 'object' && Object.keys(data).length === 0) return { valid: false, message: `No ${dataType} available` };
        return { valid: true };
    }

    _handleExportError(error, operation) {
        this._showNotification(`${operation} failed: ${error.message}`, 'error');
        return false;
    }

    exportBatchPredictions(batchResults = null, options = {}) {
        try {
            const dynamicData = this._getDynamicData();
            const results = batchResults || dynamicData.batchPredictionResults;
            
            const validation = this._validateData(results, 'batch prediction results');
            if (!validation.valid) {
                this._showNotification(validation.message, 'warning');
                return false;
            }
            
            if (!results.predictions || !Array.isArray(results.predictions) || results.predictions.length === 0) {
                this._showNotification('Invalid prediction data structure', 'error');
                return false;
            }
            
            const csvData = [
                ['Animal_ID', 'Group', 'Experimental_Weight_Day', 'Experimental_Tumor_Weight', 'Target_Day', 'Predicted_Tumor_Weight', 'Prediction_Error_percent', 'R2']
            ];
            
            results.predictions.forEach(pred => {
                if (!pred || typeof pred !== 'object') return;
                
                const exp = results.experimentalWeights ? 
                    results.experimentalWeights.find(e => e && e.animalId === pred.animalId) : null;
                
                csvData.push([
                    pred.animalId || '',
                    pred.group || '',
                    exp?.sacrificeDay || '',
                    this._formatNumber(exp?.experimentalWeight, 3),
                    pred.targetDay || '',
                    this._formatNumber(pred.predictedWeight, 3),
                    this._formatNumber(exp?.predictionError, 1),
                    this._formatNumber(pred.r2, 3)
                ]);
            });
            
            if (csvData.length <= 1) {
                this._showNotification('No valid prediction data to export', 'warning');
                return false;
            }
            
            const csvContent = this._generateCSVContent(csvData);
            const fileName = options.fileName || `batch_predictions_${this._getDateStamp()}.csv`;
            this._downloadFile(csvContent, fileName, 'text/csv');
            
            this._showNotification('Batch predictions exported successfully', 'success');
            return true;
            
        } catch (error) {
            return this._handleExportError(error, 'Batch predictions export');
        }
    }

    exportTGRToCSV(growthMatrices = null, options = {}) {
        try {
            const dynamicData = this._getDynamicData();
            const matrices = growthMatrices || dynamicData.growthMatrices;
            
            const validation = this._validateData(matrices, 'TGR data');
            if (!validation.valid) {
                this._showNotification(validation.message, 'warning');
                return false;
            }

            let csvContent = 'Animal_ID,Experimental_Group';
            
            const firstMatrix = Object.values(matrices)[0];
            const dayPairs = [];
            
            for (let i = 0; i < firstMatrix.days.length; i++) {
                for (let j = i + 1; j < firstMatrix.days.length; j++) {
                    dayPairs.push(`r(${firstMatrix.days[i]}-${firstMatrix.days[j]})`);
                }
            }
            
            csvContent += ',' + dayPairs.join(',') + '\n';

            Object.entries(matrices).forEach(([groupName, matrix]) => {
                const groupAnimals = dynamicData.processedData?.validAnimals?.filter(animal => animal.group === groupName);
                if (!groupAnimals?.length) return;

                groupAnimals.forEach(animal => {
                    let row = `${animal.id},${groupName}`;
                    
                    dayPairs.forEach(dayPairLabel => {
                        const match = dayPairLabel.match(/r\((\d+)-(\d+)\)/);
                        if (!match) {
                            row += ',';
                            return;
                        }
                        
                        const [, dayX, dayY] = match.map(Number);
                        const dayXIndex = animal.timePoints.findIndex(day => day === dayX);
                        const dayYIndex = animal.timePoints.findIndex(day => day === dayY);
                        
                        if (dayXIndex !== -1 && dayYIndex !== -1) {
                            const volumeX = animal.measurements[dayXIndex];
                            const volumeY = animal.measurements[dayYIndex];
                            
                            if (volumeX > 0 && volumeY > 0) {
                                const tgr = Math.log(volumeY / volumeX) / (dayY - dayX);
                                row += ',' + tgr.toFixed(6);
                            } else {
                                row += ',';
                            }
                        } else {
                            row += ',';
                        }
                    });
                    
                    csvContent += row + '\n';
                });
            });

            const fileName = options.fileName || `TGR_Export_${this._getDateStamp()}.csv`;
            this._downloadFile(csvContent, fileName, 'text/csv');
            
            this._showNotification('TGR data exported successfully', 'success');
            return true;
            
        } catch (error) {
            return this._handleExportError(error, 'TGR export');
        }
    }

    exportOutlierReport(outlierAnalysis = null, options = {}) {
        try {
            const dynamicData = this._getDynamicData();
            const analysis = outlierAnalysis || dynamicData.outlierAnalysis;
            
            const validation = this._validateData(analysis, 'outlier analysis');
            if (!validation.valid) {
                this._showNotification(validation.message, 'warning');
                return false;
            }

            let report = `# Outlier Analysis Report - ViVo\n`;
            report += `Date: ${new Date().toLocaleString('en-US')}\n`;
            report += `Configuration: ${analysis.summary?.configUsed || 'Default'}\n\n`;

            report += `## Executive Summary\n`;
            report += `- Total detected anomalies: ${analysis.summary?.totalFlags || 0}\n`;
            report += `- Critical anomalies: ${analysis.summary?.severityCounts?.critical || 0}\n`;
            report += `- High severity anomalies: ${analysis.summary?.severityCounts?.high || 0}\n`;
            report += `- Animals in complete analysis: ${analysis.dualAnalysis?.complete?.count || 0}\n`;
            report += `- Animals after filtering: ${analysis.dualAnalysis?.filtered?.count || 0}\n\n`;

            if (analysis.flags && analysis.flags.length > 0) {
                report += `## Anomaly Details\n`;
                analysis.flags.forEach((flag, index) => {
                    const flagInfo = window.FLAG_TYPES?.[flag.type] || { name: 'Unknown', severity: 'Unknown' };
                    report += `${index + 1}. ${flag.animalId} (${flag.group}) - Day ${flag.day}\n`;
                    report += `   Type: ${flagInfo.name} (${flagInfo.severity})\n`;
                    report += `   Value: ${flag.value}\n`;
                    report += `   Description: ${flag.message}\n\n`;
                });
            }

            if (analysis.recommendations && analysis.recommendations.length > 0) {
                report += `## Recommendations\n`;
                analysis.recommendations.forEach((rec, index) => {
                    report += `${index + 1}. ${rec.title}: ${rec.message}\n`;
                });
            }

            const fileName = options.fileName || `outlier_report_${this._getDateStamp()}.txt`;
            this._downloadFile(report, fileName, 'text/plain;charset=utf-8');

            this._showNotification('Outlier report exported', 'success');
            return true;
            
        } catch (error) {
            return this._handleExportError(error, 'Outlier report export');
        }
    }

    exportEnhancedCSV(options = {}) {
        try {
            const dynamicData = this._getDynamicData();
            
            const validation = this._validateData(dynamicData.animalModels, 'analyzed data');
            if (!validation.valid) {
                this._showNotification(validation.message, 'warning');
                return false;
            }

            const dataType = dynamicData.processedData?.dataType || 'volume';
            const paramLabel = dataType === 'volume' ? 'V0' : 'BLI0';

            const enhancedData = dynamicData.rawData.map(row => {
                const animalId = row.Animal || row.ID || '';
                const newRow = { ...row };

                if (dynamicData.animalModels[animalId]) {
                    const model = dynamicData.animalModels[animalId].model;
                    newRow.R2 = model.r2.toFixed(4);
                    newRow[paramLabel] = dataType === 'bli' ?
                        model.a.toExponential(3) :
                        model.a.toFixed(3);
                    newRow.r = model.r.toFixed(6);
                    newRow.DuplicationTime = (model.r && model.r > 0) ? (Math.log(2) / model.r).toFixed(2) : 'Infinity';
                    newRow.Valid = 'YES';
                } else {
                    Object.assign(newRow, { R2: '', [paramLabel]: '', r: '', DuplicationTime: '', Valid: 'NO' });
                }

                return newRow;
            });

            const dayColumns = Object.keys(enhancedData[0])
                .filter(k => !isNaN(parseFloat(k)))
                .map(Number)
                .sort((a, b) => a - b);
            
            const orderedColumns = [
                'Group', 'Animal', 
                ...dayColumns.map(String),
                'Tumor_Weight', 'R2', paramLabel, 'r', 'DuplicationTime', 'Valid'
            ].filter(col => enhancedData[0].hasOwnProperty(col));

            let csv;
            if (typeof Papa !== 'undefined' && Papa.unparse) {
                csv = Papa.unparse(enhancedData, {
                    columns: orderedColumns,
                    delimiter: ';'
                });
            } else {
                csv = orderedColumns.join(';') + '\n';
                enhancedData.forEach(row => {
                    csv += orderedColumns.map(col => row[col] || '').join(';') + '\n';
                });
            }

            const fileName = options.fileName || `enhanced_results_${this._getDateStamp()}.csv`;
            this._downloadFile(csv, fileName, 'text/csv;charset=utf-8');

            this._showNotification('Enhanced CSV exported successfully', 'success');
            return true;
            
        } catch (error) {
            return this._handleExportError(error, 'Enhanced CSV export');
        }
    }

    _formatNumber(value, decimals) {
        return (value && typeof value === 'number') ? value.toFixed(decimals) : '';
    }

    _generateCSVContent(data, delimiter = ',') {
        return data.map(row => row.join(delimiter)).join('\n');
    }

    _downloadFile(content, fileName, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => URL.revokeObjectURL(link.href), 100);
    }

    _getDateStamp() {
        return new Date().toISOString().slice(0, 10);
    }

    _showNotification(message, type) {
        if (typeof notificationService !== 'undefined') {
            notificationService.show(message, type);
        }
    }

    getManagerStats() {
        const dynamicData = this._getDynamicData();
        return {
            hasReportGenerator: !!this.reportGenerator,
            hasAppState: !!this.appState,
            hasProcessedData: !!dynamicData.processedData,
            hasAnimalModels: !!dynamicData.animalModels,
            hasRawData: !!dynamicData.rawData,
            hasBatchResults: !!dynamicData.batchPredictionResults,
            hasGrowthMatrices: !!dynamicData.growthMatrices,
            hasOutlierAnalysis: !!dynamicData.outlierAnalysis,
            exportMethods: ['exportBatchPredictions', 'exportTGRToCSV', 'exportOutlierReport', 'exportEnhancedCSV']
        };
    }
}

const exportManager = new ExportManager();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExportManager;
}

if (typeof window !== 'undefined') {
    window.ExportManager = ExportManager;
    window.exportManager = exportManager;
}
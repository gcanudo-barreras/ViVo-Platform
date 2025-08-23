/**
 * Core data analysis controller for ViVo application
 * Handles complete data analysis pipeline including outlier detection,
 * exponential model fitting, and statistical calculations
 */

class AnalysisController {
    constructor() {
        this.animalModels = {};
        this.processedData = {};
        this.outlierAnalysis = null;
        this.dayColumns = [];
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        this.initialized = true;
    }

    async analyzeData(rawData, options = {}) {
        AppUtilities.SafePerformance.mark('analyzeData-start');
        
        if (!rawData || rawData.length === 0) {
            notificationService.show('Please load a CSV file first', 'warning');
            return null;
        }

        notificationService.show('Analyzing data...', 'info');

        const threshold = options.threshold || parseFloat(domCache.get('r2Threshold')?.value || 0.8);
        const dataType = options.dataType || domCache.get('dataType')?.value || 'volume';

        this.animalModels = {};
        this.resetHomogeneityCache();
        this.processedData = {
            validAnimals: [],
            invalidAnimals: [],
            groupStats: {},
            dataType: dataType
        };

        try {
            const parsed = this.parseAnimalData(rawData);
            const animalsForOutlierAnalysis = parsed.animals;
            this.dayColumns = parsed.dayColumns;

            if (!window.AppState.homogeneityEvaluator) {
                if (typeof ModelHomogeneityEvaluator !== 'undefined') {
                    window.AppState.homogeneityEvaluator = new ModelHomogeneityEvaluator();
                } else {
                }
            }
            
            if (window.AppState.homogeneityEvaluator && animalsForOutlierAnalysis.length >= 2) {
                window.AppState.initialHomogeneityResults = window.AppState.homogeneityEvaluator.evaluate(animalsForOutlierAnalysis);
            }

            if (!window.outlierDetector) {
                this.initializeOutlierDetector();
            }
            this.outlierAnalysis = await window.outlierDetector.analyzeDataset(animalsForOutlierAnalysis, dataType);
            
            if (window.AppState) {
                window.AppState.outlierAnalysis = this.outlierAnalysis;
            }
            
            window.outlierAnalysis = this.outlierAnalysis;

            let dataToProcess;
            if (window.usePointFiltering) {
                if (!this.outlierAnalysis.pointFilteringAnalysis) {
                    this.outlierAnalysis.pointFilteringAnalysis = window.outlierDetector.performPointFilteringAnalysis(
                        this.outlierAnalysis.dualAnalysis?.complete?.animals || this.outlierAnalysis.animals || animalsForOutlierAnalysis
                    );
                }
                dataToProcess = this.outlierAnalysis.pointFilteringAnalysis?.animals || this.outlierAnalysis.animals || animalsForOutlierAnalysis;
            } else if (window.useFilteredData) {
                dataToProcess = this.outlierAnalysis.dualAnalysis?.filtered?.animals || this.outlierAnalysis.animals || animalsForOutlierAnalysis;
            } else {
                dataToProcess = this.outlierAnalysis.dualAnalysis?.complete?.animals || this.outlierAnalysis.animals || animalsForOutlierAnalysis;
            }

            let validCount = 0;
            let invalidCount = 0;

            const analyzedAnimals = await this.analyzeDataWithWorker(dataToProcess, {
                batchSize: 50,
                timeout: Math.max(30000, dataToProcess.length * 100)
            });

            analyzedAnimals.forEach(animal => {
                if (animal.timePoints.length >= 3 && animal.model && !animal.model.error) {
                    const animalData = {
                        id: animal.id,
                        group: animal.group,
                        timePoints: animal.timePoints,
                        measurements: animal.measurements,
                        model: animal.model,
                        metrics: animal.metrics,
                        dataType: dataType,
                        originalPoints: animalsForOutlierAnalysis.find(a => a.id === animal.id)?.timePoints.length || animal.timePoints.length,
                        filteredPoints: animal.excludedPoints?.length || 0
                    };

                    if (animal.model.r2 >= threshold) {
                        this.animalModels[animal.id] = animalData;
                        this.processedData.validAnimals.push(animalData);
                        validCount++;
                    } else {
                        this.processedData.invalidAnimals.push(animalData);
                        invalidCount++;
                    }
                } else {
                    const animalData = {
                        id: animal.id,
                        group: animal.group,
                        timePoints: animal.timePoints,
                        measurements: animal.measurements,
                        model: { error: 'Insufficient data points after filtering' },
                        dataType: dataType,
                        originalPoints: animalsForOutlierAnalysis.find(a => a.id === animal.id)?.timePoints.length || 0,
                        filteredPoints: animal.excludedPoints?.length || 0
                    };
                    this.processedData.invalidAnimals.push(animalData);
                    invalidCount++;
                }
            });

            this.updateGlobalVariables();
            
            this.calculateGroupStatistics();

            this.updateAnalysisResults(validCount, invalidCount, threshold);

            AppUtilities.SafePerformance.mark('analyzeData-end');
            AppUtilities.SafePerformance.measure('analyzeData-duration', 'analyzeData-start', 'analyzeData-end');


            return {
                processedData: this.processedData,
                animalModels: this.animalModels,
                outlierAnalysis: this.outlierAnalysis,
                statistics: {
                    validCount,
                    invalidCount,
                    threshold
                }
            };

        } catch (error) {
            Logger.error('Analysis failed:', error);
            notificationService.show(`Analysis failed: ${error.message}`, 'error');
            throw error;
        }
    }

        parseAnimalData(rawData) {
        if (typeof window.parseAnimalData === 'function') {
            return window.parseAnimalData(rawData);
        }
        
        const animals = [];
        const dayColumns = [];
        if (rawData.length > 0) {
            Object.keys(rawData[0]).forEach(key => {
                if (key !== 'Animal_ID' && key !== 'Group' && !isNaN(parseInt(key))) {
                    dayColumns.push(parseInt(key));
                }
            });
            dayColumns.sort((a, b) => a - b);
        }

        const animalGroups = {};
        rawData.forEach(row => {
            const animalId = row.Animal_ID;
            if (!animalGroups[animalId]) {
                animalGroups[animalId] = {
                    id: animalId,
                    group: row.Group || 'Unknown',
                    timePoints: [],
                    measurements: []
                };
            }
            
            dayColumns.forEach(day => {
                const value = parseFloat(row[day]);
                if (!isNaN(value) && value > 0) {
                    animalGroups[animalId].timePoints.push(day);
                    animalGroups[animalId].measurements.push(value);
                }
            });
        });

        return {
            animals: Object.values(animalGroups),
            dayColumns
        };
    }

        async analyzeDataWithWorker(animalsToAnalyze, options = {}) {
        const workerManager = window.AppState?.workerManager;
        
        if (!workerManager || !workerManager.getStatus().ready) {
            return this.analyzeDataMainThread(animalsToAnalyze, options);
        }

        try {
            let progressNotificationShown = false;
            workerManager.setProgressCallback((progress) => {
                if (!progressNotificationShown && progress.overallProgress > 10) {
                    notificationService.show(`Processing animals: ${progress.overallProgress}% complete`, 'info');
                    progressNotificationShown = true;
                }
                
                const debugConsole = domCache.get('debugConsole');
                if (debugConsole) {
                    debugConsole.textContent += `\nProgress: ${progress.overallProgress}%`;
                    debugConsole.scrollTop = debugConsole.scrollHeight;
                }
            });

            const results = await workerManager.analyzeAnimals(animalsToAnalyze, options);
            notificationService.show('Analysis completed with Web Worker', 'success');
            return results;

        } catch (error) {
            return this.analyzeDataMainThread(animalsToAnalyze, options);
        }
    }

        analyzeDataMainThread(animalsToAnalyze, options = {}) {
        
        const results = [];
        const startTime = AppUtilities.SafePerformance.now();
        
        animalsToAnalyze.forEach((animal, index) => {
            if (animal.timePoints.length >= 3) {
                const model = this.fitExponentialModel(animal.timePoints, animal.measurements);
                
                results.push({
                    ...animal,
                    model: model,
                    metrics: {
                        finalValue: animal.measurements[animal.measurements.length - 1],
                        initialValue: animal.measurements[0],
                        growthRatio: animal.measurements[animal.measurements.length - 1] / animal.measurements[0],
                        maxValue: Math.max(...animal.measurements),
                        minValue: Math.min(...animal.measurements.filter(v => v > 0))
                    }
                });
            } else {
                results.push({
                    ...animal,
                    model: { error: 'Insufficient data points' },
                    metrics: null
                });
            }
        });
        
        const duration = AppUtilities.SafePerformance.now() - startTime;
        
        return results;
    }

        fitExponentialModel(timePoints, measurements) {
        if (typeof window.fitExponentialModel === 'function') {
            return window.fitExponentialModel(timePoints, measurements);
        }
        try {
            const n = timePoints.length;
            if (n < 3) {
                return { error: 'Insufficient data points' };
            }

            const logMeasurements = measurements.map(m => Math.log(m));
            const sumX = timePoints.reduce((a, b) => a + b, 0);
            const sumY = logMeasurements.reduce((a, b) => a + b, 0);
            const sumXY = timePoints.reduce((sum, x, i) => sum + x * logMeasurements[i], 0);
            const sumXX = timePoints.reduce((sum, x) => sum + x * x, 0);

            const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
            const intercept = (sumY - slope * sumX) / n;

            const a = Math.exp(intercept);
            const b = slope;

            const meanY = sumY / n;
            const ssRes = logMeasurements.reduce((sum, y, i) => {
                const predicted = intercept + slope * timePoints[i];
                const diff = y - predicted;
                return sum + diff * diff;
            }, 0);
            const ssTot = logMeasurements.reduce((sum, y) => {
                const diff = y - meanY;
                return sum + diff * diff;
            }, 0);
            const r2 = 1 - (ssRes / ssTot);

            return {
                a: a,
                b: b,
                r2: r2,
                equation: `y = ${a.toFixed(3)} * e^(${b.toFixed(4)} * x)`,
                error: null
            };

        } catch (error) {
            return { error: error.message };
        }
    }

        updateGlobalVariables() {
        // Update global variables that other functions depend on
        window.animalModels = this.animalModels;
        window.processedData = this.processedData;
        window.outlierAnalysis = this.outlierAnalysis;
        window.dayColumns = this.dayColumns;
        
    }

        calculateGroupStatistics() {
        if (typeof window.calculateGroupStats === 'function') {
            window.calculateGroupStats();
            return;
        }
        
        const groupStats = {};
        const allAnimals = [...this.processedData.validAnimals, ...this.processedData.invalidAnimals];
        
        allAnimals.forEach(animal => {
            if (!groupStats[animal.group]) {
                groupStats[animal.group] = {
                    valid: 0,
                    invalid: 0,
                    validAnimals: [],
                    avgR: 0,
                    avgR2: 0,
                    avgA: 0,
                    stdR: 0,
                    stdA: 0,
                    seR: 0,
                    seA: 0
                };
            }
        });
        
        this.processedData.validAnimals.forEach(animal => {
            const stats = groupStats[animal.group];
            stats.valid++;
            stats.validAnimals.push(animal);
        });
        
        this.processedData.invalidAnimals.forEach(animal => {
            const stats = groupStats[animal.group];
            stats.invalid++;
        });
        
        Object.values(groupStats).forEach(stats => {
            if (stats.validAnimals.length > 0) {
                let sumR = 0, sumR2 = 0, sumA = 0;
                
                stats.validAnimals.forEach(animal => {
                    if (animal.model && typeof animal.model.r === 'number') {
                        sumR += animal.model.r;
                    }
                    if (animal.model && typeof animal.model.r2 === 'number') {
                        sumR2 += animal.model.r2;
                    }
                    if (animal.model && typeof animal.model.a === 'number') {
                        sumA += animal.model.a;
                    }
                });
                
                const count = stats.validAnimals.length;
                stats.avgR = sumR / count;
                stats.avgR2 = sumR2 / count;
                stats.avgA = sumA / count;
                
                if (count > 1) {
                    let sumSqR = 0, sumSqA = 0;
                    stats.validAnimals.forEach(animal => {
                        if (animal.model && typeof animal.model.r === 'number') {
                            const diffR = animal.model.r - stats.avgR;
                            sumSqR += diffR * diffR;
                        }
                        if (animal.model && typeof animal.model.a === 'number') {
                            const diffA = animal.model.a - stats.avgA;
                            sumSqA += diffA * diffA;
                        }
                    });
                    
                    stats.stdR = Math.sqrt(sumSqR / (count - 1));
                    stats.stdA = Math.sqrt(sumSqA / (count - 1));
                    stats.seR = stats.stdR / Math.sqrt(count);
                    stats.seA = stats.stdA / Math.sqrt(count);
                }
            }
        });

        this.processedData.groupStats = groupStats;
    }

        updateAnalysisResults(validCount, invalidCount, threshold) {
        notificationService.show(
            `Analysis complete: ${validCount} valid, ${invalidCount} invalid animals (R² ≥ ${threshold})`,
            'success'
        );

        if (typeof window.enablePostAnalysisButtons === 'function') {
            window.enablePostAnalysisButtons();
        } else if (window.uiManager && typeof window.uiManager.enablePostAnalysisButtons === 'function') {
            window.uiManager.enablePostAnalysisButtons();
        } else {
        }

        if (typeof window.updateAnalysisPanel === 'function') {
            window.updateAnalysisPanel();
        }

        if (typeof window.updateHomogeneityPanel === 'function') {
            // Check if we have homogeneity comparison data
            const homogeneityComparison = this.getHomogeneityComparison();
            if (homogeneityComparison) {
                try {
                    window.updateHomogeneityPanel(homogeneityComparison);
                } catch (error) {
                }
            } else {
            }
        }
    }

        initializeOutlierDetector() {
        if (typeof window.initializeOutlierDetector === 'function') {
            window.initializeOutlierDetector();
        } else {
        }
    }

        resetHomogeneityCache() {
        if (typeof window.resetHomogeneityCache === 'function') {
            window.resetHomogeneityCache();
        }
    }

        getAnalysisState() {
        return {
            animalModels: this.animalModels,
            processedData: this.processedData,
            outlierAnalysis: this.outlierAnalysis,
            dayColumns: this.dayColumns,
            initialized: this.initialized
        };
    }

        getHomogeneityComparison() {
        if (window.AppState && window.AppState.initialHomogeneityResults && 
            window.AppState.homogeneityEvaluator) {
            
            let currentData = [];
            const datasetType = this.getActiveDatasetType();
            
            switch (datasetType) {
                case 'allData':
                    currentData = this.outlierAnalysis?.dualAnalysis?.complete?.animals || 
                                 this.outlierAnalysis?.animals ||
                                 this.processedData?.validAnimals || [];
                    break;
                case 'filteredAnimals':
                    currentData = this.outlierAnalysis?.dualAnalysis?.filtered?.animals || 
                                 this.processedData?.validAnimals || [];
                    break;
                case 'filteredPoints':
                    currentData = this.outlierAnalysis?.pointFilteringAnalysis?.animals || 
                                 this.processedData?.validAnimals || [];
                    break;
                default:
                    currentData = this.processedData?.validAnimals || [];
            }
            
            if (currentData.length === 0) {
                return null;
            }
            
            const currentResults = window.AppState.homogeneityEvaluator.evaluate(currentData);
            const comparison = {
                original: window.AppState.initialHomogeneityResults,
                filtered: currentResults,
                improvement: this.calculateHomogeneityImprovement(window.AppState.initialHomogeneityResults, currentResults),
                dataset: this.getActiveDatasetType()
            };
            
            
            return comparison;
        }
        
        if (window.AppState?.homogeneityEvaluator?.lastComparison) {
            return window.AppState.homogeneityEvaluator.lastComparison;
        }
        
        if (window.homogeneityComparison) {
            return window.homogeneityComparison;
        }
        
        return null;
    }

        calculateHomogeneityImprovement(initial, current) {
        if (!initial?.overallAssessment || !current?.overallAssessment) {
            return { cvChange: 0, qualityChange: 'no-change', animalChange: 0 };
        }

        const cvChange = initial.overallAssessment.averageCV - current.overallAssessment.averageCV;
        const animalChange = current.totalAnimals - initial.totalAnimals;
        
        let qualityChange = 'no-change';
        const qualityOrder = { 'poor': 0, 'fair': 1, 'good': 2, 'excellent': 3 };
        const initialQuality = qualityOrder[initial.overallAssessment.quality] || 0;
        const currentQuality = qualityOrder[current.overallAssessment.quality] || 0;
        
        if (currentQuality > initialQuality) {
            qualityChange = 'improved';
        } else if (currentQuality < initialQuality) {
            qualityChange = 'degraded';
        }

        return { cvChange, qualityChange, animalChange };
    }

        getActiveDatasetType() {
        if (window.AppState) {
            if (window.AppState.usePointFiltering) {
                return 'filteredPoints';
            } else if (window.AppState.useFilteredData) {
                return 'filteredAnimals';
            } else if (window.AppState.useFilteredData === false && window.AppState.usePointFiltering === false) {
                return 'allData';
            }
        }
        
        const outlierMode = domCache.get('outlierFiltering')?.value || 'criticalAndHigh';
        
        if (outlierMode === 'none') {
            return 'allData';
        } else if (this.outlierAnalysis?.dualAnalysis) {
            return 'filteredAnimals';
        } else if (this.outlierAnalysis?.pointFilteringAnalysis) {
            return 'filteredPoints';
        }
        
        return 'processed';
    }

        clearAnalysis() {
        this.animalModels = {};
        this.processedData = {};
        this.outlierAnalysis = null;
        this.dayColumns = [];
        
        window.animalModels = {};
        window.processedData = {};
        window.outlierAnalysis = null;
        window.dayColumns = [];
        
    }
}

// Create global instance
const analysisController = new AnalysisController();

// Provide global access to outlier analysis through controller
Object.defineProperty(window, 'getOutlierAnalysis', {
    value: () => analysisController.outlierAnalysis,
    writable: false,
    enumerable: true,
    configurable: false
});

// Export for backward compatibility
window.AnalysisController = analysisController;
window.analyzeData = (rawData, options) => analysisController.analyzeData(rawData || window.rawData, options);

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnalysisController;
}
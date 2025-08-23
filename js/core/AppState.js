// Centralized application state management

class AppState {
    constructor() {
        this.reset();
        this.setupLegacyCompatibility();
    }

    reset() {
        if (Array.isArray(this.rawData)) this.rawData.length = 0;
        this.rawData = [];
        this.processedData = {};
        this.animalModels = {};
        this.dayColumns = [];
        this.currentFileName = '';
        this.outlierDetector = null;
        this.outlierAnalysis = null;
        this.homogeneityEvaluator = null;
        this.initialHomogeneityResults = null;
        this.workerManager = null;
        this.chartPoolManager = null;
        this.dataProcessingService = null;
        this.chartService = null;
        this.analysisEngine = null;
        this.reportGenerator = null;
        this.exportManager = null;
        this.predictionService = null;
        this.useFilteredData = false;
        this.usePointFiltering = false;
        this.currentState = 0;
        this.growthMatrices = {};
        this.globalMin = Infinity;
        this.globalMax = -Infinity;
        this.controlGroup = null;
        this.optimizedColorRange = { min: 0, max: 0 };
        this.customColorRange = null;
        this.normalizedChartData = null;
        
        this.clearCharts();
        
        if (this.chartService?.clearCharts) this.chartService.clearCharts();
        if (this.chartService?.resetFallbackStats) this.chartService.resetFallbackStats();
        if (this.predictionService?.reset) this.predictionService.reset();
        if (typeof resetHomogeneityCache === 'function') resetHomogeneityCache();
        if (window.gc) window.gc();
    }

    clearCharts() {
        ['mainChart', 'normalizedChart'].forEach(chartId => {
            const element = document.getElementById(chartId);
            if (!element) return;
            
            try {
                if (typeof Plotly !== 'undefined' && (element.data || element._fullLayout)) {
                    Plotly.purge(chartId);
                } else {
                    element.innerHTML = '';
                    element.removeAttribute?.('data-plotly-id');
                }
            } catch (e) {
                element.innerHTML = '';
            }
        });
    }

    setupLegacyCompatibility() {
        window.AppState = this;
        window.updateLocalRawData = (newData) => this.rawData = newData;
        
        ['rawData', 'processedData', 'animalModels', 'dayColumns', 'currentFileName', 
         'outlierAnalysis', 'useFilteredData', 'usePointFiltering', 'currentState', 
         'outlierDetector', 'homogeneityEvaluator', 'initialHomogeneityResults', 
         'growthMatrices', 'globalMin', 'globalMax', 'controlGroup', 
         'optimizedColorRange', 'customColorRange', 'normalizedChartData'].forEach(prop => {
            Object.defineProperty(window, prop, {
                get: () => this[prop],
                set: (value) => this[prop] = value
            });
        });
    }
}

const EventListenerManager = {
    listeners: [],
    
    add(element, event, handler, options = {}) {
        if (!element?.addEventListener) return;
        
        element.addEventListener(event, handler, options);
        this.listeners.push({ element, event, handler, options });
    },
    
    remove(element, event, handler) {
        if (!element || !element.removeEventListener) return;
        
        element.removeEventListener(event, handler);
        this.listeners = this.listeners.filter(listener => 
            !(listener.element === element && 
              listener.event === event && 
              listener.handler === handler)
        );
    },
    
    removeAll() {
        this.listeners.forEach(({ element, event, handler }) => {
            if (element && element.removeEventListener) {
                element.removeEventListener(event, handler);
            }
        });
        this.listeners.length = 0;
    }
};

const Logger = {
    enabled: false,
    
    init() {
        this.enabled = this.isDebugMode();
        if (this.enabled) {
            const debugPanel = document.getElementById('debugPanel');
            if (debugPanel) debugPanel.style.display = 'block';
        }
    },
    
    isDebugMode() {
        return new URLSearchParams(window.location.search).get('debug') === 'true';
    },
    
    log(message, data = null) {
        if (this.enabled) this.logToPanel(message, data);
    },
    
    error(message, error = null) {
        if (this.enabled) this.logToPanel(`ERROR: ${message}`, error);
    },
    
    warn(message, data = null) {
        if (this.enabled) this.logToPanel(`WARN: ${message}`, data);
    },
    
    debug(message, data = null) {
        if (this.enabled) this.logToPanel(`DEBUG: ${message}`, data);
    },
    
    logToPanel(message, data = null) {
        const debugConsole = document.getElementById('debugConsole');
        if (!debugConsole) return;
        
        const timestamp = new Date().toLocaleTimeString();
        const dataStr = data ? `: ${JSON.stringify(data, null, 2)}` : '';
        debugConsole.innerHTML += `<div>[${timestamp}] ${message}${dataStr}</div>`;
        debugConsole.scrollTop = debugConsole.scrollHeight;
    }
};

function getOutlierAnalysisData() {
    return AppState.outlierAnalysis || window.getOutlierAnalysis?.() || window.outlierAnalysis;
}

const OUTLIER_STATES = [
    {
        text: "All data",
        style: "background: linear-gradient(45deg, #4facfe, #00f2fe);",
        action: () => {
            const outlierAnalysis = getOutlierAnalysisData();
            if (!outlierAnalysis) {
                notificationService.show('First run the outlier analysis', 'warning');
                return;
            }
            
            AppState.useFilteredData = false;
            AppState.usePointFiltering = false;
            
            const dataToUse = outlierAnalysis.dualAnalysis?.complete?.animals || AppState.rawData || [];
            reprocessDataWithOutlierSelection(dataToUse);
            notificationService.show(`Using all data without filtering (${dataToUse.length} animals)`, 'info');
        }
    },
    {
        text: "Filtered Animals",
        style: "background: linear-gradient(45deg, #ff6b6b, #ee5a52);",
        action: () => {
            const outlierAnalysis = getOutlierAnalysisData();
            if (!outlierAnalysis) {
                notificationService.show('First run the outlier analysis', 'warning');
                return;
            }
            
            AppState.useFilteredData = true;
            AppState.usePointFiltering = false;
            
            const dataToUse = outlierAnalysis.dualAnalysis?.filtered?.animals || AppState.rawData || [];
            const excludedCount = outlierAnalysis.dualAnalysis?.impact?.animalsExcluded || 0;
            
            reprocessDataWithOutlierSelection(dataToUse);
            notificationService.show(`Excluded ${excludedCount} animal(s) with severe outliers (${dataToUse.length} remaining)`, 'info');
        }
    },
    {
        text: "Filtered Points",
        style: "background: linear-gradient(45deg, #a55eea, #26de81);",
        action: () => {
            const outlierAnalysis = getOutlierAnalysisData();
            if (!outlierAnalysis) {
                notificationService.show('First run the outlier analysis', 'warning');
                return;
            }
            
            AppState.useFilteredData = false;
            AppState.usePointFiltering = true;
            
            const baseAnimals = outlierAnalysis.dualAnalysis?.complete?.animals || AppState.rawData || [];
            
            if (!outlierAnalysis.pointFilteringAnalysis) {
                notificationService.show('Running point filtering analysis...', 'info');
                
                if (AppState.outlierDetector) {
                    const pointAnalysis = AppState.outlierDetector.performPointFilteringAnalysis(baseAnimals);
                    
                    [AppState.outlierAnalysis, window.outlierAnalysis].forEach(target => {
                        if (target) target.pointFilteringAnalysis = pointAnalysis;
                    });
                    
                    try {
                        const globalAnalysis = window.getOutlierAnalysis?.();
                        if (globalAnalysis) globalAnalysis.pointFilteringAnalysis = pointAnalysis;
                    } catch (e) {}
                    
                    outlierAnalysis.pointFilteringAnalysis = pointAnalysis;
                } else {
                    notificationService.show('Outlier detector not available', 'error');
                    return;
                }
            }
            
            const dataToUse = outlierAnalysis.pointFilteringAnalysis?.animals || baseAnimals;
            reprocessDataWithOutlierSelection(dataToUse);
            
            const excludedPoints = outlierAnalysis.pointFilteringAnalysis?.excludedPoints || 0;
            notificationService.show(`Excluded ${excludedPoints} specific anomalous point(s) (${dataToUse.length} animals remaining)`, 'info');
        }
    }
];

const OUTLIER_CONFIGS = {
    auto: { name: 'Auto (automatic adjustment)' },
    ultraConservative: {
        name: 'Ultra-Conservative (pilot studies, n=5-8)',
        maxGrowthRate: Math.log(50),
        maxDeclineRate: Math.log(10),
        iqrSensitivity: 4.0,
        requireMultipleFlags: true,
        minGroupSizeForIQR: 8,
        biologicalChangeThreshold: Math.log(20)
    },
    conservative: {
        name: 'Conservative (standard studies, n=8-12)',
        maxGrowthRate: Math.log(20),
        maxDeclineRate: Math.log(5),
        iqrSensitivity: 3.0,
        requireMultipleFlags: true,
        minGroupSizeForIQR: 5,
        biologicalChangeThreshold: Math.log(10)
    },
    moderate: {
        name: 'Moderate (large studies, n>12)',
        maxGrowthRate: Math.log(10),
        maxDeclineRate: Math.log(3),
        iqrSensitivity: 2.0,
        requireMultipleFlags: false,
        minGroupSizeForIQR: 4,
        biologicalChangeThreshold: Math.log(5)
    }
};

const FLAG_TYPES = {
    IMPOSSIBLE_VALUE: { severity: 'critical', name: 'Impossible Value', color: '#dc3545' },
    EXTREME_GROWTH: { severity: 'critical', name: 'Extreme Growth', color: '#dc3545' },
    EXTREME_DECLINE: { severity: 'critical', name: 'Extreme Decline', color: '#dc3545' },
    INTRA_OUTLIER: { severity: 'high', name: 'Intra-Animal Outlier', color: '#fd7e14' },
    GROUP_OUTLIER: { severity: 'medium', name: 'Group Outlier', color: '#ffc107' },
    LAST_DAY_DROP: { severity: 'medium', name: 'Last Day Drop', color: '#ffc107' }
};

const appState = new AppState();
window.AppState = appState;
Object.assign(window, {
    debugLog: Logger.log.bind(Logger),
    debugError: Logger.error.bind(Logger)
});
window.states = OUTLIER_STATES;
window.OUTLIER_CONFIGS = OUTLIER_CONFIGS;
window.FLAG_TYPES = FLAG_TYPES;
window.Logger = Logger;
window.EventListenerManager = EventListenerManager;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AppState, Logger, OUTLIER_STATES, OUTLIER_CONFIGS, FLAG_TYPES };
}
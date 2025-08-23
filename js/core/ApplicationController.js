class ApplicationController {
    constructor() {
        this.initialized = false;
        this.fileProcessing = false;
        this.performanceMetrics = new Map();
    }

    async init() {
        if (this.initialized) return;
        
        try {
            Logger.init();
            
            this.initializeServices();
            this.setupEventListeners();
            this.setupFileInput();
            
            if (this.isDebugMode()) {
                this.initializeDebugMode();
            }
            
            this.initialized = true;
            
        } catch (error) {
            Logger.error('Failed to initialize application:', error);
            this.showCriticalError('Application failed to initialize. Please refresh the page.');
        }
    }

    setupEventListeners() {
        const fileInput = domCache.get('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', this.handleFileSelectWrapper.bind(this), { passive: true });
        }
        
        EventListenerManager.add(window, 'error', (event) => {
            Logger.error('Global error:', {
                message: event.message || 'Unknown error',
                filename: event.filename || 'Unknown file',
                lineno: event.lineno || 0
            });
            return false;
        });

        EventListenerManager.add(window, 'unhandledrejection', (event) => {
            Logger.error('Unhandled promise rejection:', event.reason);
            return false;
        });
    }

    handleFileSelectWrapper(event) {
        // Debounce file selection to prevent double processing
        if (this.fileProcessing) return;
        
        this.fileProcessing = true;
        
        try {
            handleFileSelect(event);
        } catch (error) {
            Logger.error('File selection error:', error);
            notificationService.show('Error processing file selection', 'error');
        } finally {
            setTimeout(() => this.fileProcessing = false, 1000);
        }
    }

    setupFileInput() {
        const fileInput = domCache.get('fileInput');
        const fileLabel = domCache.get('fileLabel');
        
        if (!fileInput || !fileLabel) return;
        
        this.setupDragDrop(fileLabel, fileInput);
        
        EventListenerManager.add(fileInput, 'change', (e) => {
            const fileName = e.target.files[0]?.name || 'Choose CSV file...';
            const displayName = fileName.length > 30 ? fileName.substring(0, 27) + '...' : fileName;
            fileLabel.textContent = displayName;
        });
    }

    initializeDebugMode() {
        const debugPanel = domCache.get('debugPanel');
        if (debugPanel) {
            debugPanel.style.display = 'block';
        }
    }

    isDebugMode() {
        try {
            return Logger.isDebugMode();
        } catch {
            return false;
        }
    }

    showCriticalError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #dc3545;
            color: white;
            padding: 2rem;
            border-radius: 10px;
            max-width: 400px;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: system-ui, -apple-system, sans-serif;
        `;
        
        errorDiv.innerHTML = `
            <h3 style="margin: 0 0 1rem 0;">Critical Error</h3>
            <p style="margin: 0 0 1rem 0;">${message}</p>
            <button onclick="location.reload()" style="
                background: white; 
                color: #dc3545; 
                border: none; 
                padding: 0.5rem 1rem; 
                border-radius: 5px; 
                cursor: pointer;
                font-weight: bold;
            ">Reload Page</button>
        `;
        
        document.body.appendChild(errorDiv);
    }

    startTimer(name) {
        this.performanceMetrics.set(name, { startTime: performance.now() });
    }

    endTimer(name) {
        const metric = this.performanceMetrics.get(name);
        if (metric) {
            metric.endTime = performance.now();
            metric.duration = metric.endTime - metric.startTime;
        }
    }

    getMetric(name) {
        return this.performanceMetrics.get(name);
    }

    getAllMetrics() {
        const metrics = {};
        for (const [name, data] of this.performanceMetrics.entries()) {
            if (data.duration !== undefined) {
                metrics[name] = `${data.duration.toFixed(2)}ms`;
            }
        }
        return metrics;
    }

    logPerformanceSummary() {
        if (!Logger.enabled) return;
        
        const metrics = this.getAllMetrics();
        if (Object.keys(metrics).length > 0) {
            Logger.log('Performance Summary:', metrics);
        }
    }

    initializeServices() {
        const services = [
            { check: 'uiManager', init: () => uiManager.init() },
            { check: 'analysisController', init: () => analysisController.init() },
            { check: 'formChangeHandler', init: () => formChangeHandler.initialize() },
            { check: 'IntelligentOutlierDetector', init: () => AppState.outlierDetector = new IntelligentOutlierDetector('auto'), condition: () => !AppState.outlierDetector },
            { check: 'ModelHomogeneityEvaluator', init: () => AppState.homogeneityEvaluator = new ModelHomogeneityEvaluator(), condition: () => !AppState.homogeneityEvaluator },
            { check: 'WorkerManager', init: () => this.initWorkerManager(), condition: () => !AppState.workerManager },
            { check: 'ChartPoolManager', init: () => AppState.chartPoolManager = new ChartPoolManager(), condition: () => !AppState.chartPoolManager },
            { check: 'ChartService', init: () => this.initChartService(), condition: () => !AppState.chartService },
            { check: 'ReportGenerator', init: () => this.initReportGenerator(), condition: () => !AppState.reportGenerator },
            { check: 'ExportManager', init: () => this.initExportManager(), condition: () => !AppState.exportManager },
            { check: 'PredictionService', init: () => this.initPredictionService(), condition: () => !AppState.predictionService }
        ];

        services.forEach(service => {
            if (typeof window[service.check] !== 'undefined' && (!service.condition || service.condition())) {
                try {
                    service.init();
                } catch (error) {
                    Logger.error(`Failed to initialize ${service.check}:`, error);
                }
            }
        });
    }

    initWorkerManager() {
        AppState.workerManager = new WorkerManager();
        AppState.workerManager.init().catch(error => {
            Logger.error('Web Worker initialization error:', error);
        });
    }

    initChartService() {
        AppState.chartService = new ChartService();
        AppState.chartService.initialize(AppState.chartPoolManager);
    }

    initReportGenerator() {
        AppState.reportGenerator = new ReportGenerator();
        AppState.reportGenerator.initialize(AppState.chartService);
    }

    initExportManager() {
        AppState.exportManager = new ExportManager();
        AppState.exportManager.initialize({
            reportGenerator: AppState.reportGenerator,
            appState: AppState
        });
    }

    initPredictionService() {
        AppState.predictionService = new PredictionService();
        AppState.predictionService.init({
            showNotification: showNotification,
            debugLog: debugLog,
            processedData: () => window.processedData,
            rawData: () => window.rawData,
            animalModels: () => window.animalModels
        });
    }

    setupDragDrop(fileLabel, fileInput) {
        EventListenerManager.add(fileLabel, 'dragover', (e) => {
            e.preventDefault();
            fileLabel.style.borderColor = '#00f2fe';
            fileLabel.style.background = 'rgba(0, 242, 254, 0.2)';
        });

        EventListenerManager.add(fileLabel, 'dragleave', (e) => {
            e.preventDefault();
            fileLabel.style.borderColor = '#667eea';
            fileLabel.style.background = '';
        });

        EventListenerManager.add(fileLabel, 'drop', (e) => {
            e.preventDefault();
            fileLabel.style.borderColor = '#667eea';
            fileLabel.style.background = '';
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                fileInput.files = files;
                fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }
}

// Create global instance
const App = new ApplicationController();

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApplicationController;
}
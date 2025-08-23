class FormChangeHandler {
    constructor() {
        this.handlers = new Map();
        this.initialized = false;
        this.setupDefaultHandlers();
    }

    initialize() {
        if (this.initialized) return;

        EventListenerManager.add(document, 'change', (event) => {
            this.handleDelegatedChange(event);
        });

        this.initialized = true;
    }

    setupDefaultHandlers() {
        this.registerHandler('outlier-config', (element, value) => {
            const selectedConfig = element.value;

            if (window.suppressOutlierNotification) {
                if (selectedConfig !== 'auto' && window.IntelligentOutlierDetector) {
                    AppState.outlierDetector = new IntelligentOutlierDetector(selectedConfig);
                }
                return;
            }

            if (selectedConfig === 'auto') {
                if (window.rawData?.length > 0) {
                    window.initializeOutlierDetector?.();
                    this.notify(`Auto configuration updated based on ${window.rawData.length} animals`);
                } else {
                    this.notify('Auto configuration: load data first for automatic adjustment');
                }
            } else {
                if (window.IntelligentOutlierDetector) {
                    AppState.outlierDetector = new IntelligentOutlierDetector(selectedConfig);
                }
                
                const configName = window.OUTLIER_CONFIGS?.[selectedConfig]?.name || selectedConfig;
                this.notify(`Configuration updated: ${configName}`);
            }
        });

        this.registerHandler('color-scale', (element, value) => {
            const selectedScale = element.value;
            
            if (AppState.chartService?.updateColorScale) {
                AppState.chartService.updateColorScale(selectedScale);
                this.notify(`Color scale changed to: ${selectedScale}`);
            }

            if (window.processedData && window.animalModels && window.updateChartDisplay) {
                setTimeout(window.updateChartDisplay, 100);
            }
        });

        this.registerHandler('prediction-form', (element, value) => {
            const selectedAnimal = element.value;
            
            if (!selectedAnimal || !window.animalModels?.[selectedAnimal]) return;

            const weightSourceDiv = domCache.get('weightSourceOptions');
            if (weightSourceDiv) weightSourceDiv.style.display = 'block';

            this.notify(`Selected animal: ${selectedAnimal}`);
        });

        this.registerHandler('prediction-mode', (element, value) => {
            const mode = element.value;
            const singleDiv = domCache.get('singlePredictionForm');
            const batchDiv = domCache.get('batchPredictionForm');
            
            const isSingle = mode === 'single';
            if (singleDiv) singleDiv.style.display = isSingle ? 'block' : 'none';
            if (batchDiv) batchDiv.style.display = isSingle ? 'none' : 'block';
            
            this.notify(`${mode} prediction mode selected`);
            
            if (mode === 'batch' && AppState.predictionService?.checkForTumorWeightColumn) {
                setTimeout(() => AppState.predictionService.checkForTumorWeightColumn(), 100);
            }
        });
    }

    notify(message) {
        if (window.notificationService?.show) {
            window.notificationService.show(message, 'info');
        }
    }

    registerHandler(handlerKey, handlerFn) {
        this.handlers.set(handlerKey, handlerFn);
    }

    handleDelegatedChange(event) {
        const element = event.target;
        const mapping = {
            'outlierConfig': 'outlier-config',
            'colorScale': 'color-scale',
            'predictAnimal': 'prediction-form',
            'predictionMode': 'prediction-mode'
        };

        const handlerKey = mapping[element.id] || mapping[element.name];
        
        if (handlerKey && this.handlers.has(handlerKey)) {
            try {
                this.handlers.get(handlerKey)(element, element.value);
            } catch (error) {
                if (window.notificationService?.show) {
                    window.notificationService.show(`Form handler error: ${error.message}`, 'error');
                }
            }
        }
    }

    triggerHandler(handlerKey, element, value) {
        if (this.handlers.has(handlerKey)) {
            this.handlers.get(handlerKey)(element, value);
        }
    }

    getStats() {
        return {
            totalHandlers: this.handlers.size,
            handlerKeys: Array.from(this.handlers.keys()),
            initialized: this.initialized
        };
    }
}

const formChangeHandler = new FormChangeHandler();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FormChangeHandler;
}

if (typeof window !== 'undefined') {
    window.FormChangeHandler = FormChangeHandler;
    window.formChangeHandler = formChangeHandler;
}
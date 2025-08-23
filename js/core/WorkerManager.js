class WorkerManager {
    constructor() {
        this.worker = null;
        this.isReady = false;
        this.pendingRequests = new Map();
        this.requestCounter = 0;
        this.progressCallback = null;
    }

    async init() {
        if (this.worker) return this.isReady;

        try {
            this.worker = new Worker('js/workers/DataAnalysisWorker.js');
            this.worker.addEventListener('message', (e) => this.handleWorkerMessage(e.data));
            this.worker.addEventListener('error', (error) => this.handleWorkerError(error));

            return new Promise((resolve) => {
                const checkReady = (data) => {
                    if (data.type === 'worker_ready') {
                        this.isReady = true;
                        resolve(true);
                    }
                };

                this.worker.addEventListener('message', (e) => checkReady(e.data), { once: true });
                setTimeout(() => {
                    if (!this.isReady) {
                        this.isReady = true;
                        resolve(true);
                    }
                }, 5000);
            });
        } catch (error) {
            return false;
        }
    }

    handleWorkerMessage(data) {
        const { type, requestId, result, error } = data;

        if (['analysis_complete', 'model_complete', 'pong'].includes(type) || type === 'error') {
            this.resolveRequest(requestId, error, result);
        } else if (type === 'batch_progress' && this.progressCallback) {
            this.progressCallback({
                batchIndex: data.batchIndex,
                totalBatches: data.totalBatches,
                batchProgress: data.batchProgress,
                overallProgress: data.overallProgress
            });
        }
    }

    resolveRequest(requestId, error, result) {
        if (requestId && this.pendingRequests.has(requestId)) {
            const request = this.pendingRequests.get(requestId);
            this.pendingRequests.delete(requestId);
            error ? request.reject(new Error(error.message)) : request.resolve(result);
        }
    }

    handleWorkerError(error) {
        this.isReady = false;
        this.rejectAllPendingRequests(`Worker error: ${error.message}`);
    }

    rejectAllPendingRequests(errorMessage) {
        this.pendingRequests.forEach(request => request.reject(new Error(errorMessage)));
        this.pendingRequests.clear();
    }

    sendMessage(type, data, options = {}) {
        return new Promise((resolve, reject) => {
            if (!this.worker || !this.isReady) {
                reject(new Error('Worker not ready'));
                return;
            }

            const requestId = `req_${++this.requestCounter}_${Date.now()}`;
            this.pendingRequests.set(requestId, { resolve, reject });

            const timeout = options.timeout || 30000;
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error(`Request timeout after ${timeout}ms`));
                }
            }, timeout);

            this.worker.postMessage({ type, data, requestId });
        });
    }

    async analyzeAnimals(animals, options = {}) {
        if (!animals?.length) throw new Error('No animals provided for analysis');
        
        return this.sendMessage('analyze_animals', {
            animals,
            options: { batchSize: 50, ...options }
        }, {
            timeout: options.timeout || 60000
        });
    }

    async fitModel(x, y) {
        return this.sendMessage('fit_model', { x, y });
    }

    setProgressCallback(callback) {
        this.progressCallback = callback;
    }

    async ping() {
        try {
            await this.sendMessage('ping', {}, { timeout: 5000 });
            return true;
        } catch (error) {
            return false;
        }
    }

    terminate() {
        if (this.worker) {
            // Clean up event listeners before termination
            this.worker.removeEventListener('message', this.handleWorkerMessage.bind(this));
            this.worker.removeEventListener('error', this.handleWorkerError.bind(this));
            this.worker.terminate();
            this.worker = null;
            this.isReady = false;
            this.rejectAllPendingRequests('Worker terminated');
        }
    }

    getStatus() {
        return {
            initialized: !!this.worker,
            ready: this.isReady,
            pendingRequests: this.pendingRequests.size
        };
    }
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkerManager;
} else {
    window.WorkerManager = WorkerManager;
}
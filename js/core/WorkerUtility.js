/**
 * Centralized Worker Management Utility
 * Eliminates duplicated worker creation patterns across the application
 */
class WorkerUtility {
    static createWorkerPromise(workerPath, messageData, timeoutMs = 30000) {
        return new Promise((resolve, reject) => {
            const worker = new Worker(workerPath);
            let timeoutId;
            let terminated = false;

            // Setup timeout
            if (timeoutMs > 0) {
                timeoutId = setTimeout(() => {
                    if (!terminated) {
                        terminated = true;
                        worker.terminate();
                        reject(new Error(`Worker timeout after ${timeoutMs}ms`));
                    }
                }, timeoutMs);
            }

            const cleanup = () => {
                if (!terminated) {
                    terminated = true;
                    worker.terminate();
                    if (timeoutId) clearTimeout(timeoutId);
                }
            };

            worker.onmessage = (e) => {
                cleanup();
                const { success, result, error } = e.data;
                
                if (success) {
                    resolve(result);
                } else {
                    reject(new Error(error || 'Worker failed'));
                }
            };

            worker.onerror = (error) => {
                cleanup();
                reject(new Error(`Worker error: ${error.message || 'Unknown worker error'}`));
            };

            // Send message to worker
            try {
                worker.postMessage(messageData);
            } catch (error) {
                cleanup();
                reject(new Error(`Failed to send message to worker: ${error.message}`));
            }
        });
    }

    static async createBatchWorkerPromises(workerPath, batchData, maxConcurrency = 4) {
        const promises = [];
        const chunks = this._chunkArray(batchData, Math.ceil(batchData.length / maxConcurrency));
        
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const messageData = {
                task: 'processBatch',
                data: chunk,
                batchIndex: i,
                totalBatches: chunks.length
            };
            
            promises.push(this.createWorkerPromise(workerPath, messageData));
        }

        try {
            const results = await Promise.allSettled(promises);
            const successful = [];
            const errors = [];

            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    successful.push(result.value);
                } else {
                    errors.push({
                        batchIndex: index,
                        error: result.reason.message
                    });
                }
            });

            return {
                successful,
                errors,
                totalBatches: chunks.length,
                successfulBatches: successful.length
            };

        } catch (error) {
            throw new Error(`Batch worker processing failed: ${error.message}`);
        }
    }

    static _chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    /**
     * Specialized method for outlier detection workers
     */
    static async createOutlierDetectionWorker(animals, config, workerId) {
        const messageData = {
            task: 'analyzeOutliers',
            animals,
            config,
            workerId
        };
        
        return this.createWorkerPromise('./js/workers/OutlierDetectionWorker.js', messageData);
    }

    /**
     * Specialized method for TGR calculation workers
     */
    static async createTGRCalculationWorker(allDays, animals, groupName) {
        const messageData = {
            task: 'calculateTGR',
            allDays,
            animals,
            groupName
        };
        
        return this.createWorkerPromise('./js/workers/TGRCalculationWorker.js', messageData);
    }

    /**
     * Specialized method for data analysis workers
     */
    static async createDataAnalysisWorker(animals, options = {}) {
        const messageData = {
            type: 'analyze_animals',
            data: { animals, options },
            requestId: `analysis_${Date.now()}`
        };
        
        return this.createWorkerPromise('./js/workers/DataAnalysisWorker.js', messageData);
    }

    /**
     * Check if workers are supported in current environment
     */
    static isWorkerSupported() {
        return typeof Worker !== 'undefined' && window.location.protocol !== 'file:';
    }

    /**
     * Get optimal number of workers based on hardware
     */
    static getOptimalWorkerCount() {
        return Math.min(navigator.hardwareConcurrency || 4, 6);
    }
}

// Export for module environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkerUtility;
}

// Make available globally
if (typeof window !== 'undefined') {
    window.WorkerUtility = WorkerUtility;
}
class DataAnalysisWorker {

    _createErrorResult() {
        return {
            a: 1,
            r: 0,
            r2: 0,
            validPoints: 0,
            equation: 'Error in calculation'
        };
    }

    fitExponentialModel(x, y) {
        try {
            const validData = this._filterValidData(x, y);
            
            if (validData.length < 3) {
                return { ...this._createErrorResult(), validPoints: validData.length, equation: 'Insufficient data', error: 'Less than 3 valid points' };
            }

            const { validX, validY } = this._prepareRegressionData(validData);
            const { a, b, r2 } = this._performLinearRegression(validX, validY);

            return {
                a: isFinite(a) ? a : 1,
                r: isFinite(b) ? b : 0,
                r2: isFinite(r2) ? r2 : 0,
                validPoints: validData.length,
                equation: `y = ${a.toFixed(2)} × e^(${isFinite(b) ? b.toFixed(4) : '0.0000'}×t)`,
                error: null
            };

        } catch (error) {
            return { ...this._createErrorResult(), error: error.message };
        }
    }

    _filterValidData(x, y) {
        const validData = [];
        for (let i = 0; i < x.length && i < y.length; i++) {
            if (y[i] > 0 && !isNaN(y[i]) && isFinite(y[i]) && !isNaN(x[i]) && isFinite(x[i])) {
                validData.push({ x: x[i], y: y[i] });
            }
        }
        return validData;
    }

    _prepareRegressionData(validData) {
        return {
            validX: validData.map(d => d.x),
            validY: validData.map(d => Math.log(d.y))
        };
    }

    _performLinearRegression(validX, validY) {
        const n = validX.length;
        
        const sumX = validX.reduce((a, b) => a + b, 0);
        const sumY = validY.reduce((a, b) => a + b, 0);
        const sumXY = validX.reduce((sum, x, i) => sum + x * validY[i], 0);
        const sumX2 = validX.reduce((sum, x) => sum + x * x, 0);


        const denominator = n * sumX2 - sumX * sumX;
        if (Math.abs(denominator) <= Number.EPSILON) {
            throw new Error('Cannot calculate regression: insufficient variation in X values');
        }

        const b = (n * sumXY - sumX * sumY) / denominator;
        const lnA = (sumY - b * sumX) / n;
        const a = Math.exp(lnA);

        const yMean = sumY / n;
        let ssRes = 0, ssTot = 0;

        for (let i = 0; i < validX.length; i++) {
            const predicted = lnA + b * validX[i];
            ssRes += Math.pow(validY[i] - predicted, 2);
            ssTot += Math.pow(validY[i] - yMean, 2);
        }

        const r2 = ssTot > Number.EPSILON ? Math.max(0, 1 - (ssRes / ssTot)) : 0;
        return { a, b, r2 };
    }

    processBatch(animals, batchIndex, totalBatches) {
        const results = [];
        const batchSize = animals.length;
        
        for (let i = 0; i < animals.length; i++) {
            const animal = animals[i];
            
            try {
                const model = this.fitExponentialModel(animal.timePoints, animal.measurements);
                const metrics = this._calculateAnimalMetrics(animal.measurements);
                
                results.push({ ...animal, model, metrics });

                if ((i + 1) % 10 === 0 || i === animals.length - 1) {
                    this._reportBatchProgress(batchIndex, totalBatches, i + 1, batchSize);
                }

            } catch (error) {
                results.push({ ...animal, model: { error: error.message }, metrics: null });
            }
        }

        return results;
    }

    _calculateAnimalMetrics(measurements) {
        const validMeasurements = measurements.filter(v => !isNaN(v) && isFinite(v) && v > 0);
        
        if (validMeasurements.length === 0) {
            return {
                finalValue: 0,
                initialValue: 0,
                growthRatio: 0,
                maxValue: 0,
                minValue: 0
            };
        }
        
        const final = measurements[measurements.length - 1] || 0;
        const initial = measurements[0] || 0;
        
        return {
            finalValue: final,
            initialValue: initial,
            growthRatio: initial > 0 ? final / initial : 0,
            maxValue: Math.max(...validMeasurements),
            minValue: Math.min(...validMeasurements)
        };
    }

    _reportBatchProgress(batchIndex, totalBatches, processed, batchSize) {
        const totalItems = totalBatches * batchSize;
        const totalProcessed = batchIndex * batchSize + processed;
        
        self.postMessage({
            type: 'batch_progress',
            batchIndex,
            totalBatches,
            batchProgress: Math.round((processed / batchSize) * 100),
            overallProgress: Math.round((totalProcessed / totalItems) * 100)
        });
    }

    analyzeAnimals(animals, options = {}) {
        const startTime = performance.now();
        const batchSize = options.batchSize || 50;
        const batches = this._createBatches(animals, batchSize);
        const allResults = [];
        
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batchResults = this.processBatch(batches[batchIndex], batchIndex, batches.length);
            allResults.push(...batchResults);
        }

        const processingTime = performance.now() - startTime;

        return {
            animals: allResults,
            stats: {
                totalAnimals: animals.length,
                validModels: allResults.filter(a => a.model && !a.model.error).length,
                processingTime,
                batchesProcessed: batches.length
            }
        };
    }

    _createBatches(animals, batchSize) {
        const batches = [];
        for (let i = 0; i < animals.length; i += batchSize) {
            batches.push(animals.slice(i, i + batchSize));
        }
        return batches;
    }
}

const worker = new DataAnalysisWorker();

self.addEventListener('message', function(e) {
    const { type, data, requestId } = e.data;
    
    try {
        let result;
        
        switch (type) {
            case 'analyze_animals':
                result = worker.analyzeAnimals(data.animals, data.options);
                self.postMessage({ type: 'analysis_complete', requestId, result });
                break;

            case 'fit_model':
                result = worker.fitExponentialModel(data.x, data.y);
                self.postMessage({ type: 'model_complete', requestId, result });
                break;

            case 'ping':
                self.postMessage({ type: 'pong', requestId, timestamp: Date.now() });
                break;

            default:
                throw new Error(`Unknown message type: ${type}`);
        }
    } catch (error) {
        self.postMessage({
            type: 'error',
            requestId,
            error: { message: error.message, stack: error.stack }
        });
    }
});

self.postMessage({ type: 'worker_ready', timestamp: Date.now() });
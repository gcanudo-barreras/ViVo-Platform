// Import MathUtils from main thread
importScripts('../core/MathUtils.js');

class OutlierWorker {
    constructor() {
    }

    createFlag(type, animal, day, value, extra = {}) {
        return {
            type,
            animalId: animal.id,
            group: animal.group,
            day,
            value,
            ...extra
        };
    }

    analyzeAnimalBatch(animals, config, startIdx, endIdx) {
        const results = [];
        
        for (let i = startIdx; i < endIdx; i++) {
            const animal = animals[i];
            const processed = { ...animal, flags: [], flaggedMeasurements: [] };
            const { measurements, timePoints } = animal;
            
            for (let j = 0; j < measurements.length; j++) {
                const val = measurements[j];
                const day = timePoints[j];
                const flags = [];
                
                if (val <= 0) {
                    flags.push(this.createFlag('IMPOSSIBLE_VALUE', animal, day, val));
                } else if (j > 0) {
                    const prev = measurements[j - 1];
                    const prevDay = timePoints[j - 1];
                    const dayDiff = day - prevDay;
                    
                    if (prev > 0 && dayDiff > 0) {
                        // Use exact same TGR calculation as main thread
                        const r = MathUtils.calculateTumorGrowthRate(prev, val, prevDay, day);
                        if (!isNaN(r)) {
                            const absR = Math.abs(r);
                            if (val > prev && absR > config.maxGrowthRate) {
                                flags.push(this.createFlag('EXTREME_GROWTH', animal, day, val));
                            }
                            if (val < prev && absR > config.maxDeclineRate) {
                                flags.push(this.createFlag('EXTREME_DECLINE', animal, day, val));
                            }
                        }
                    }
                    
                    if (j === measurements.length - 1 && val < prev * 0.5) {
                        flags.push(this.createFlag('LAST_DAY_DROP', animal, day, val));
                    }
                }
                
                if (flags.length > 0) {
                    processed.flaggedMeasurements.push({ index: j, day, value: val, flags });
                    processed.flags.push(...flags);
                }
            }
            
            if (measurements.length >= 4) {
                this.detectIntraAnimalOutliers(processed, config);
            }
            
            results.push(processed);
        }
        
        return results;
    }

    detectIntraAnimalOutliers(animal, config) {
        // Use exact same logic as main thread: MathUtils.validateNumericData
        const validMeasurements = MathUtils.validateNumericData(animal.measurements, true);
        const logVals = validMeasurements.map(v => Math.log(v));
        if (logVals.length < 4) return;

        // Use exact same IQR calculation as main thread: MathUtils.calculateIQRBounds
        const bounds = MathUtils.calculateIQRBounds(logVals, config.iqrSensitivity);

        animal.measurements.forEach((v, i) => {
            if (v <= 0) return;
            const logV = Math.log(v);
            const outlier = MathUtils.isOutlier(logV, bounds);
            if (outlier && animal.timePoints[i] !== 0) {
                animal.flags.push(this.createFlag('INTRA_OUTLIER', animal, 
                    animal.timePoints[i], v));
            }
        });
    }

    analyzeGroupOutliers(groupAnimals, groupName, config) {
        // Use exact same logic as main thread
        const days = {};
        groupAnimals.forEach(a => a.timePoints.forEach((d, i) => {
            const val = a.measurements[i];
            if (val > 0) (days[d] = days[d] || []).push(Math.log(val));
        }));

        const groupFlags = [];
        
        for (const d in days) {
            const vals = days[d];
            if (vals.length < config.minGroupSizeForIQR) continue;
            
            // Use exact same IQR calculation as main thread
            const bounds = MathUtils.calculateIQRBounds(vals, config.iqrSensitivity);

            groupAnimals.forEach(a => {
                const i = a.timePoints.indexOf(+d);
                if (i !== -1 && a.measurements[i] > 0) {
                    const logVal = Math.log(a.measurements[i]);
                    const out = MathUtils.isOutlier(logVal, bounds);
                    if (out && +d !== 0) {
                        groupFlags.push(this.createFlag('GROUP_OUTLIER', 
                            { id: a.id, group: groupName }, +d, a.measurements[i]));
                    }
                }
            });
        }
        
        return groupFlags;
    }
}

const worker = new OutlierWorker();

self.onmessage = function(e) {
    const { task, animals, config, groupData, startIdx, endIdx, workerId } = e.data;
    
    try {
        const result = task === 'analyzeBatch' 
            ? worker.analyzeAnimalBatch(animals, config, startIdx, endIdx)
            : worker.analyzeGroupOutliers(groupData.animals, groupData.groupName, config);
        
        self.postMessage({ success: true, result, workerId, task });
    } catch (error) {
        self.postMessage({ success: false, error: error.message, workerId, task });
    }
};
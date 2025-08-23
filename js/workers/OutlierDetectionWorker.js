class OutlierWorker {
    constructor() {
        this.logCache = new Map();
    }

    fastLog(value) {
        if (value <= 0) return NaN;
        const key = Math.round(value * 1000) / 1000;
        if (this.logCache.has(key)) return this.logCache.get(key);
        
        const result = Math.log(value);
        if (this.logCache.size >= 500) {
            const firstKey = this.logCache.keys().next().value;
            this.logCache.delete(firstKey);
        }
        this.logCache.set(key, result);
        return result;
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
                        const ratio = val / prev;
                        const r = Math.abs(this.fastLog(ratio)) / dayDiff;
                        
                        if (val > prev && r > config.maxGrowthRate) {
                            flags.push(this.createFlag('EXTREME_GROWTH', animal, day, val));
                        } else if (val < prev && r > config.maxDeclineRate) {
                            flags.push(this.createFlag('EXTREME_DECLINE', animal, day, val));
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
        const validMeasurements = animal.measurements.filter(v => v > 0);
        if (validMeasurements.length < 4) return;
        
        const logVals = validMeasurements.map(v => this.fastLog(v));
        const n = logVals.length;
        const mean = logVals.reduce((a, b) => a + b) / n;
        const variance = logVals.reduce((sum, val) => sum + (val - mean) ** 2, 0) / (n - 1);
        const stdDev = Math.sqrt(variance);
        
        animal.measurements.forEach((v, i) => {
            if (v > 0) {
                const zScore = Math.abs(this.fastLog(v) - mean) / stdDev;
                if (zScore > config.zScoreThreshold) {
                    animal.flags.push(this.createFlag('INTRA_ANIMAL_OUTLIER', animal, 
                        animal.timePoints[i], v, { zScore }));
                }
            }
        });
    }

    analyzeGroupOutliers(groupAnimals, groupName, config) {
        const dayDataMap = {};
        
        groupAnimals.forEach(animal => {
            animal.timePoints.forEach((day, i) => {
                const val = animal.measurements[i];
                if (val > 0) {
                    (dayDataMap[day] ||= []).push(this.fastLog(val));
                }
            });
        });
        
        const groupFlags = [];
        
        Object.entries(dayDataMap).forEach(([day, values]) => {
            if (values.length >= config.minGroupSizeForIQR) {
                values.sort((a, b) => a - b);
                const n = values.length;
                const q1 = values[Math.floor(n * 0.25)];
                const q3 = values[Math.floor(n * 0.75)];
                const iqr = q3 - q1;
                const bounds = { lower: q1 - 1.5 * iqr, upper: q3 + 1.5 * iqr };
                
                groupAnimals.forEach(animal => {
                    const dayIndex = animal.timePoints.indexOf(parseInt(day));
                    if (dayIndex !== -1) {
                        const val = animal.measurements[dayIndex];
                        if (val > 0) {
                            const logVal = this.fastLog(val);
                            if (logVal < bounds.lower || logVal > bounds.upper) {
                                groupFlags.push(this.createFlag('GROUP_OUTLIER', 
                                    { id: animal.id, group: groupName }, parseInt(day), val, 
                                    { logValue: logVal, bounds }));
                            }
                        }
                    }
                });
            }
        });
        
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
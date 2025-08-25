// Intelligent outlier detector with integrated logic

class IntelligentOutlierDetector {
    constructor(config = 'conservative') {
        if (typeof config === 'string') {
            if (typeof OUTLIER_CONFIGS === 'undefined' || !OUTLIER_CONFIGS[config]) {
                this.config = typeof OUTLIER_CONFIGS !== 'undefined' ? OUTLIER_CONFIGS['conservative'] : {};
            } else {
                this.config = OUTLIER_CONFIGS[config];
            }
        } else {
            this.config = config;
        }
        this.useWebWorkers = WorkerUtility.isWorkerSupported();
        this.reset();
    }

    reset() {
        this.flags = [];
        this.decisions = [];
        this.specificRecommendations = [];
    }

    async analyzeDataset(animals, dataType = 'volume') {
        this.reset();

        const grouped = this.groupBy(animals, 'group');
        let processed;
        
        if (this.useWebWorkers && animals.length > 10) {
            try {
                processed = await this.analyzeAnimalsWithWorkers(animals, dataType);
            } catch (error) {
                processed = animals.map(a => this.analyzeAnimal(a, dataType));
            }
        } else {
            processed = animals.map(a => this.analyzeAnimal(a, dataType));
        }

        for (const [group, groupAnimals] of Object.entries(grouped)) {
            if (groupAnimals.length >= this.config.minGroupSizeForIQR) {
                if (this.useWebWorkers) {
                    try {
                        const groupFlags = await this.analyzeGroupWithWorker(groupAnimals, group);
                        this.flags.push(...groupFlags);
                    } catch (error) {
                        this.analyzeGroup(groupAnimals, group);
                    }
                } else {
                    this.analyzeGroup(groupAnimals, group);
                }
            }
        }

        this.performContextualAnalysis(processed);
        this.generateSpecificRecommendations(processed);
        const dual = this.performDualAnalysis(processed);
        const pointFiltering = this.performPointFilteringAnalysis(processed);

        const summary = this.generateSummary();
        const recommendations = this.generateRecommendations(dual);
        return { 
            animals: processed, 
            flags: this.flags, 
            decisions: this.decisions, 
            dualAnalysis: dual, 
            pointFilteringAnalysis: pointFiltering, 
            summary, 
            recommendations, 
            specificRecommendations: this.specificRecommendations 
        };
    }

    async analyzeAnimalsWithWorkers(animals, dataType) {
        const numWorkers = Math.min(navigator.hardwareConcurrency || 4, 4);
        const chunkSize = Math.ceil(animals.length / numWorkers);
        const promises = [];

        for (let i = 0; i < numWorkers; i++) {
            const startIdx = i * chunkSize;
            const endIdx = Math.min(startIdx + chunkSize, animals.length);
            
            if (startIdx < animals.length) {
                promises.push(this.createWorkerPromise(animals, startIdx, endIdx, 'analyzeBatch', i));
            }
        }

        const results = await Promise.all(promises);
        const processed = [];
        
        results.forEach(result => processed.push(...result));
        processed.forEach(animal => this.flags.push(...animal.flags));

        return processed;
    }

    async analyzeGroupWithWorker(groupAnimals, groupName) {
        // Use centralized WorkerUtility for consistent worker management
        const messageData = {
            task: 'analyzeGroup',
            groupData: { animals: groupAnimals, groupName },
            config: this.config,
            workerId: groupName
        };
        
        return WorkerUtility.createWorkerPromise('./js/workers/OutlierDetectionWorker.js', messageData);
    }

    createWorkerPromise(animals, startIdx, endIdx, task, workerId) {
        // Use centralized WorkerUtility for consistent worker management
        const messageData = {
            task,
            animals,
            config: this.config,
            startIdx,
            endIdx,
            workerId
        };
        
        return WorkerUtility.createWorkerPromise('./js/workers/OutlierDetectionWorker.js', messageData);
    }

    groupBy(arr, key) {
        // Use consolidated grouping function from MathUtils
        return MathUtils.groupDataBy(arr, item => item[key]);
    }

    analyzeAnimal(animal, type) {
        const processed = { ...animal, flags: [], flaggedMeasurements: [] };
        const { measurements, timePoints } = animal;

        for (let i = 0; i < measurements.length; i++) {
            const val = measurements[i], day = timePoints[i], prev = i ? measurements[i - 1] : null, prevDay = i ? timePoints[i - 1] : null;
            const flags = [];

            if (val <= 0) flags.push(this.makeFlag('IMPOSSIBLE_VALUE', animal, day, val));

            if (prev && val > 0 && prev > 0 && day - prevDay > 0) {
                // Use consolidated TGR calculation from MathUtils
                const r = MathUtils.calculateTumorGrowthRate(prev, val, prevDay, day);
                if (!isNaN(r)) {
                    const absR = Math.abs(r);
                    if (val > prev && absR > this.config.maxGrowthRate) flags.push(this.makeFlag('EXTREME_GROWTH', animal, day, val));
                    if (val < prev && absR > this.config.maxDeclineRate) flags.push(this.makeFlag('EXTREME_DECLINE', animal, day, val));
                }
            }

            if (i === measurements.length - 1 && i > 0 && val < measurements[i - 1] * 0.5)
                flags.push(this.makeFlag('LAST_DAY_DROP', animal, day, val));

            if (flags.length) {
                this.flags.push(...flags);
                processed.flaggedMeasurements.push({ index: i, day, value: val, flags });
            }
        }

        if (measurements.length >= 4) this.detectIntraAnimalOutliers(processed);
        return processed;
    }

    makeFlag(type, animal, day, value) {
        return { type, animalId: animal.id, group: animal.group, day, value, message: `Flag ${type}` };
    }

    detectIntraAnimalOutliers(animal) {
        const validMeasurements = MathUtils.validateNumericData(animal.measurements, true);
        const logVals = validMeasurements.map(v => Math.log(v));
        if (logVals.length < 4) return;

        // Use consolidated IQR calculation from MathUtils
        const bounds = MathUtils.calculateIQRBounds(logVals, this.config.iqrSensitivity);

        animal.measurements.forEach((v, i) => {
            if (v <= 0) return;
            const logV = Math.log(v);
            const outlier = MathUtils.isOutlier(logV, bounds);
            if (outlier && animal.timePoints[i] !== 0) {
                const flag = this.makeFlag('INTRA_OUTLIER', animal, animal.timePoints[i], v);
                this.flags.push(flag);
                const existing = animal.flaggedMeasurements.find(f => f.index === i);
                existing ? existing.flags.push(flag) : animal.flaggedMeasurements.push({ index: i, day: animal.timePoints[i], value: v, flags: [flag] });
            }
        });
    }

    analyzeGroup(group, name) {
        const days = {};
        group.forEach(a => a.timePoints.forEach((d, i) => {
            const val = a.measurements[i];
            if (val > 0) (days[d] = days[d] || []).push(Math.log(val));
        }));

        for (const d in days) {
            const vals = days[d];
            if (vals.length < 3) continue;
            
            // Use consolidated IQR calculation from MathUtils
            const bounds = MathUtils.calculateIQRBounds(vals, this.config.iqrSensitivity);

            group.forEach(a => {
                const i = a.timePoints.indexOf(+d);
                if (i !== -1 && a.measurements[i] > 0) {
                    const logVal = Math.log(a.measurements[i]);
                    const out = MathUtils.isOutlier(logVal, bounds);
                    if (out && +d !== 0) this.flags.push(this.makeFlag('GROUP_OUTLIER', a, +d, a.measurements[i]));
                }
            });
        }
    }

    getFilteringLevel() {
        return (window.DOMConfigurationManager ? window.DOMConfigurationManager.getOutlierFiltering() : document.getElementById('outlierFiltering')?.value) || 'criticalAndHigh';
    }

    shouldExcludeFlag(severity, filteringLevel) {
        return (filteringLevel === 'critical' && severity === 'critical') ||
               (filteringLevel === 'criticalAndHigh' && ['critical', 'high'].includes(severity)) ||
               filteringLevel === 'all';
    }

    performContextualAnalysis(animals) {
        const filteringLevel = this.getFilteringLevel();
        this.decisions = this.flags.map((flag, index) => {
            let decision = 'INCLUDE', reason = 'Within normal criteria';
            const severity = FLAG_TYPES[flag.type]?.severity || 'low';

            if (flag.day === 0) {
                reason = 'Day 0 always preserved';
            } else if (this.shouldExcludeFlag(severity, filteringLevel)) {
                decision = 'EXCLUDE';
                reason = `${severity} anomaly detected`;
            }

            return { flagId: index, animalId: flag.animalId, day: flag.day, decision, reason, automatic: true };
        });
    }

    generateSpecificRecommendations(animals) {
        const getFlagSet = type => this.flags.filter(f => f.type === type);
        const addRec = r => this.specificRecommendations.push(r);

        const [drop, growth, decline] = ['LAST_DAY_DROP', 'EXTREME_GROWTH', 'EXTREME_DECLINE'].map(getFlagSet);

        if (drop.length >= 3) addRec({ type: 'warning', category: 'temporal', title: 'Last Day Drops', message: `Detected ${drop.length} drops`, recommendation: 'Review last time point', affectedAnimals: [...new Set(drop.map(f => f.animalId))] });
        if (growth.length >= 2) addRec({ type: 'info', category: 'biological', title: 'Atypical Growth', message: 'Extreme growth detected', recommendation: 'Review instrument calibration', affectedAnimals: [...new Set(growth.map(f => f.animalId))] });
        if (decline.length >= 2) {
            const ids = [...new Set(decline.map(f => f.animalId))];
            addRec({ type: 'warning', category: ids.length === 1 ? 'individual' : 'systematic', title: 'Extreme Decline', message: 'Multiple animals affected', recommendation: 'Review experimental conditions', affectedAnimals: ids });
        }
    }

    performDualAnalysis(animals) {
        const filteringLevel = this.getFilteringLevel();
        const animalsToExclude = new Set();
        this.decisions.forEach(decision => {
            if (decision.decision === 'EXCLUDE') {
                const flag = this.flags.find(f => 
                    f.animalId === decision.animalId && f.day === decision.day
                );
                
                if (flag) {
                    const severity = FLAG_TYPES[flag.type]?.severity || 'low';
                    if (this.shouldExcludeFlag(severity, filteringLevel)) {
                        animalsToExclude.add(decision.animalId);
                    }
                }
            }
        });
        
        const filtered = animals.filter(animal => !animalsToExclude.has(animal.id));
        const sum = arr => arr.reduce((s, a) => s + a.measurements.length, 0);

        return {
            complete: { 
                animals, 
                count: animals.length, 
                totalMeasurements: sum(animals) 
            },
            filtered: { 
                animals: filtered, 
                count: filtered.length, 
                totalMeasurements: sum(filtered) 
            },
            impact: { 
                animalsExcluded: animals.length - filtered.length, 
                measurementsExcluded: sum(animals) - sum(filtered),
                excludedAnimalIds: Array.from(animalsToExclude)
            }
        };
    }

    performPointFilteringAnalysis(animals) {
        const filteringLevel = this.getFilteringLevel();
        const pointFilteredAnimals = animals.map(animal => {
            const exclude = new Set();
            this.decisions.forEach(d => {
                if (d.animalId === animal.id) {
                    const flag = this.flags.find(f => f.animalId === animal.id && f.day === d.day);
                    const severity = FLAG_TYPES[flag?.type]?.severity || 'low';
                    if (flag && this.shouldExcludeFlag(severity, filteringLevel) && d.day !== 0) {
                        const index = animal.timePoints.indexOf(d.day);
                        if (index !== -1) exclude.add(index);
                    }
                }
            });
            const filtered = { ...animal, timePoints: [], measurements: [], excludedPoints: [] };
            animal.timePoints.forEach((day, i) => {
                exclude.has(i) ? filtered.excludedPoints.push({ day, value: animal.measurements[i], reason: 'Automatic filtering' }) : (filtered.timePoints.push(day), filtered.measurements.push(animal.measurements[i]));
            });
            return filtered;
        }).filter(a => a.timePoints.length >= 3);

        return {
            animals: pointFilteredAnimals,
            excludedPoints: pointFilteredAnimals.reduce((sum, a) => sum + (a.excludedPoints?.length || 0), 0),
            totalPointsOriginal: animals.reduce((sum, a) => sum + a.timePoints.length, 0),
            totalPointsFiltered: pointFilteredAnimals.reduce((sum, a) => sum + a.timePoints.length, 0)
        };
    }

    generateSummary() {
        const countBy = (arr, key, defaults = {}) => {
            const result = { ...defaults };
            arr.forEach(f => result[f[key]] = (result[f[key]] || 0) + 1);
            return result;
        };

        const totalFlags = this.flags.length;
        const allFlagTypes = Object.keys(FLAG_TYPES).reduce((acc, type) => (acc[type] = 0, acc), {});
        const allSeverities = { critical: 0, high: 0, medium: 0, low: 0 };
        const allDecisions = { INCLUDE: 0, EXCLUDE: 0, REVIEW: 0 };

        return {
            totalFlags,
            flagCounts: countBy(this.flags, 'type', allFlagTypes),
            severityCounts: countBy(this.flags.map(f => ({ severity: FLAG_TYPES[f.type]?.severity || 'low' })), 'severity', allSeverities),
            decisionCounts: countBy(this.decisions, 'decision', allDecisions),
            configUsed: this.config.name
        };
    }

    generateRecommendations(dual) {
        const recs = [];
        if (dual.impact.animalsExcluded) recs.push({ type: 'warning', title: 'Excluded Animals', message: `Review ${dual.impact.animalsExcluded} excluded animals.` });
        if (dual.impact.measurementsExcluded > 5) recs.push({ type: 'info', title: 'Filtering Impact', message: `${dual.impact.measurementsExcluded} measurements affected.` });
        if (!this.flags.some(f => FLAG_TYPES[f.type]?.severity === 'critical')) recs.push({ type: 'success', title: 'Data Quality', message: 'No critical anomalies detected.' });
        return recs;
    }

    percentile(v, p) {
        // Use consolidated percentile calculation from MathUtils
        return MathUtils.calculatePercentile(v, p);
    }
}

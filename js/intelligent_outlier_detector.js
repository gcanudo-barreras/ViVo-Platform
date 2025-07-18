/**
 * ViVo: In ViVo Metrics
 * 
 * Copyright (c) 2025 Guillermo Canudo-Barreras
 * Licensed under the MIT License
 * 
 * See LICENSE file in the project root for full license text.
 */

class IntelligentOutlierDetector {
    constructor(config = 'conservative') {
        this.config = typeof config === 'string' ? OUTLIER_CONFIGS[config] : config;
        this.reset();
        this.logMsg(`🧠 Outlier Detector initialized: ${this.config.name}`);
    }

    reset() {
        this.flags = [];
        this.decisions = [];
        this.log = [];
        this.specificRecommendations = [];
    }

    logMsg(msg) {
        if (this.config.verbose) console.log(msg);
    }

    analyzeDataset(animals, dataType = 'volume') {
        this.reset();
        this.logMsg(`🔍 Starting analysis of ${animals.length} animals`);

        const grouped = this.groupBy(animals, 'group');
        const processed = animals.map(a => this.analyzeAnimal(a, dataType));

        Object.entries(grouped).forEach(([group, groupAnimals]) => {
            groupAnimals.length >= this.config.minGroupSizeForIQR
                ? this.analyzeGroup(groupAnimals, group)
                : this.log.push(`Group ${group} skipped (n=${groupAnimals.length})`);
        });

        this.performContextualAnalysis(processed);
        this.generateSpecificRecommendations(processed);
        const dual = this.performDualAnalysis(processed);
        const pointFiltering = this.performPointFilteringAnalysis(processed);

        const summary = this.generateSummary();
        const recommendations = this.generateRecommendations(dual);

        this.logMsg(`✅ Analysis completed: ${summary.totalFlags} flags`);

        return { animals: processed, flags: this.flags, decisions: this.decisions, log: this.log, dualAnalysis: dual, pointFilteringAnalysis: pointFiltering, summary, recommendations, specificRecommendations: this.specificRecommendations };
    }

    groupBy(arr, key) {
        return arr.reduce((acc, obj) => {
            (acc[obj[key]] = acc[obj[key]] || []).push(obj);
            return acc;
        }, {});
    }

    analyzeAnimal(animal, type) {
        const p = { ...animal, flags: [], flaggedMeasurements: [] };
        const m = animal.measurements, t = animal.timePoints;

        for (let i = 0; i < m.length; i++) {
            const val = m[i], day = t[i], prev = i ? m[i - 1] : null, prevDay = i ? t[i - 1] : null;
            const flags = [];

            if (val <= 0) flags.push(this.makeFlag('IMPOSSIBLE_VALUE', animal, day, val));

            if (prev && val > 0 && prev > 0 && day - prevDay > 0) {
                const ratio = val / prev;
                if (ratio > 0) {
                    const r = Math.abs(Math.log(ratio)) / (day - prevDay);
                    if (val > prev && r > this.config.maxGrowthRate) flags.push(this.makeFlag('EXTREME_GROWTH', animal, day, val));
                    if (val < prev && r > this.config.maxDeclineRate) flags.push(this.makeFlag('EXTREME_DECLINE', animal, day, val));
                }
            }

            if (i === m.length - 1 && i > 0 && val < m[i - 1] * 0.5)
                flags.push(this.makeFlag('LAST_DAY_DROP', animal, day, val));

            if (flags.length) {
                this.flags.push(...flags);
                p.flaggedMeasurements.push({ index: i, day, value: val, flags });
            }
        }

        if (m.length >= 4) this.detectIntraAnimalOutliers(p);
        return p;
    }

    makeFlag(type, animal, day, value) {
        return { type, animalId: animal.id, group: animal.group, day, value, message: `Flag ${type}` };
    }

    detectIntraAnimalOutliers(animal) {
        const logVals = animal.measurements.filter(v => v > 0).map(v => Math.log(v));
        if (logVals.length < 4) return;

        const [q1, q3] = [25, 75].map(p => this.percentile(logVals, p));
        const iqr = q3 - q1, thr = this.config.iqrSensitivity;

        animal.measurements.forEach((v, i) => {
            if (v <= 0) return;
            const logV = Math.log(v);
            const outlier = logV < q1 - thr * iqr || logV > q3 + thr * iqr;
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
            const [q1, q3] = [25, 75].map(p => this.percentile(vals, p));
            const iqr = q3 - q1, thr = this.config.iqrSensitivity;

            group.forEach(a => {
                const i = a.timePoints.indexOf(+d);
                if (i !== -1 && a.measurements[i] > 0) {
                    const logVal = Math.log(a.measurements[i]);
                    const out = logVal < q1 - thr * iqr || logVal > q3 + thr * iqr;
                    if (out && +d !== 0) this.flags.push(this.makeFlag('GROUP_OUTLIER', a, +d, a.measurements[i]));
                }
            });
        }
    }

    performContextualAnalysis(animals) {
        const filteringLevel = document.getElementById('outlierFiltering')?.value || 'criticalAndHigh';
        this.decisions = this.flags.map((flag, index) => {
            let decision = 'INCLUDE', reason = 'Within normal criteria';
            const severity = FLAG_TYPES[flag.type]?.severity || 'low';

            if (flag.day === 0) {
                reason = 'Day 0 always preserved';
            } else {
                if ((filteringLevel === 'critical' && severity === 'critical') ||
                    (filteringLevel === 'criticalAndHigh' && ['critical', 'high'].includes(severity)) ||
                    (filteringLevel === 'all')) {
                    decision = 'EXCLUDE';
                    reason = `${severity} anomaly detected`;
                }
            }

            return { flagId: index, animalId: flag.animalId, day: flag.day, decision, reason, automatic: true };
        });
    }

    generateSpecificRecommendations(animals) {
        const getFlagSet = type => this.flags.filter(f => f.type === type);
        const addRec = r => this.specificRecommendations.push(r);

        const drop = getFlagSet('LAST_DAY_DROP'), growth = getFlagSet('EXTREME_GROWTH'), decline = getFlagSet('EXTREME_DECLINE');

        if (drop.length >= 3) addRec({ type: 'warning', category: 'temporal', title: 'Last Day Drops', message: `Detected ${drop.length} drops`, recommendation: 'Review last time point', affectedAnimals: [...new Set(drop.map(f => f.animalId))] });
        if (growth.length >= 2) addRec({ type: 'info', category: 'biological', title: 'Atypical Growth', message: `Extreme growth detected`, recommendation: 'Review instrument calibration', affectedAnimals: [...new Set(growth.map(f => f.animalId))] });
        if (decline.length >= 2) {
            const ids = [...new Set(decline.map(f => f.animalId))];
            addRec({ type: 'warning', category: ids.length === 1 ? 'individual' : 'systematic', title: 'Extreme Decline', message: 'Multiple animals affected', recommendation: 'Review experimental conditions', affectedAnimals: ids });
        }
    }

    performDualAnalysis(animals) {
        const complete = animals;
        
        // Get filtering level (same as used by performPointFilteringAnalysis)
        const filteringLevel = document.getElementById('outlierFiltering')?.value || 'criticalAndHigh';
        
        // Identify animals that should be completely excluded
        const animalsToExclude = new Set();
        
        this.decisions.forEach(decision => {
            if (decision.decision === 'EXCLUDE') {
                // Find corresponding flag to verify severity
                const flag = this.flags.find(f => 
                    f.animalId === decision.animalId && f.day === decision.day
                );
                
                if (flag) {
                    const severity = FLAG_TYPES[flag.type]?.severity || 'low';
                    
                    // Verify if it meets severity criteria
                    const shouldExclude = (
                        (filteringLevel === 'critical' && severity === 'critical') ||
                        (filteringLevel === 'criticalAndHigh' && ['critical', 'high'].includes(severity)) ||
                        filteringLevel === 'all'
                    );
                    
                    if (shouldExclude) {
                        animalsToExclude.add(decision.animalId);
                    }
                }
            }
        });
        
        // Filter excluded animals
        const filtered = animals.filter(animal => !animalsToExclude.has(animal.id));
        
        const sum = arr => arr.reduce((s, a) => s + a.measurements.length, 0);

        return {
            complete: { 
                animals: complete, 
                count: complete.length, 
                totalMeasurements: sum(complete) 
            },
            filtered: { 
                animals: filtered, 
                count: filtered.length, 
                totalMeasurements: sum(filtered) 
            },
            impact: { 
                animalsExcluded: complete.length - filtered.length, 
                measurementsExcluded: sum(complete) - sum(filtered),
                excludedAnimalIds: Array.from(animalsToExclude) // For debugging
            }
        };
    }

    performPointFilteringAnalysis(animals) {
        const filteringLevel = document.getElementById('outlierFiltering')?.value || 'criticalAndHigh';
        const pointFilteredAnimals = animals.map(animal => {
            const exclude = new Set();
            this.decisions.forEach(d => {
                if (d.animalId === animal.id) {
                    const flag = this.flags.find(f => f.animalId === animal.id && f.day === d.day);
                    const severity = FLAG_TYPES[flag?.type]?.severity || 'low';
                    if (flag && ((filteringLevel === 'critical' && severity === 'critical') || (filteringLevel === 'criticalAndHigh' && ['critical', 'high'].includes(severity)) || filteringLevel === 'all') && d.day !== 0) {
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
        arr.forEach(f => {
            const k = f[key];
            result[k] = (result[k] || 0) + 1;
        });
        return result;
    };

    const totalFlags = this.flags.length;

    const allFlagTypes = Object.keys(FLAG_TYPES).reduce((acc, type) => (acc[type] = 0, acc), {});
    const allSeverities = { critical: 0, high: 0, medium: 0, low: 0 };
    const allDecisions = { INCLUDE: 0, EXCLUDE: 0, REVIEW: 0 };

    const flagCounts = countBy(this.flags, 'type', allFlagTypes);
    const severityCounts = countBy(this.flags.map(f => ({ severity: FLAG_TYPES[f.type]?.severity || 'low' })), 'severity', allSeverities);
    const decisionCounts = countBy(this.decisions, 'decision', allDecisions);

    return { totalFlags, flagCounts, severityCounts, decisionCounts, configUsed: this.config.name };
}

    generateRecommendations(dual) {
        const recs = [];
        if (dual.impact.animalsExcluded) recs.push({ type: 'warning', title: 'Excluded Animals', message: `Review ${dual.impact.animalsExcluded} excluded animals.` });
        if (dual.impact.measurementsExcluded > 5) recs.push({ type: 'info', title: 'Filtering Impact', message: `${dual.impact.measurementsExcluded} measurements affected.` });
        if (!this.flags.some(f => FLAG_TYPES[f.type]?.severity === 'critical')) recs.push({ type: 'success', title: 'Data Quality', message: 'No critical anomalies detected.' });
        return recs;
    }

    percentile(v, p) {
        const s = [...v].sort((a, b) => a - b), i = (p / 100) * (s.length - 1), l = Math.floor(i), u = Math.ceil(i);
        return s[l] + (s[u] - s[l]) * (i - l);
    }
}

class MathUtils {
    
    static mannWhitneyUTest(sample1, sample2) {
        if (!sample1 || !sample2 || sample1.length === 0 || sample2.length === 0) {
            throw new Error('Both samples must contain at least one value');
        }

        const n1 = sample1.length;
        const n2 = sample2.length;
        
        const combined = [
            ...sample1.map(val => ({value: val, group: 1})),
            ...sample2.map(val => ({value: val, group: 2}))
        ];
        
        combined.sort((a, b) => a.value - b.value);
        
        const ranks = [];
        for (let i = 0; i < combined.length;) {
            let j = i;
            while (j < combined.length && combined[j].value === combined[i].value) j++;
            const avgRank = (i + 1 + j) / 2;
            for (let k = i; k < j; k++) ranks.push(avgRank);
            i = j;
        }
        
        let R1 = 0, R2 = 0;
        for (let i = 0; i < combined.length; i++) {
            if (combined[i].group === 1) {
                R1 += ranks[i];
            } else {
                R2 += ranks[i];
            }
        }
        
        const U1 = R1 - (n1 * (n1 + 1)) / 2;
        const U2 = R2 - (n2 * (n2 + 1)) / 2;
        const U = Math.min(U1, U2);
        const meanU = (n1 * n2) / 2;
        
        const N = n1 + n2;
        let tieCorrection = 0;
        for (let i = 0; i < combined.length;) {
            let j = i;
            while (j < combined.length && combined[j].value === combined[i].value) j++;
            const tieCount = j - i;
            if (tieCount > 1) tieCorrection += tieCount ** 3 - tieCount;
            i = j;
        }
        
        const stdU = Math.sqrt((n1 * n2 * (N + 1 - tieCorrection / (N * (N - 1)))) / 12);
        const z = stdU > 0 ? Math.abs(U - meanU - 0.5) / stdU : 0;
        const p = Math.max(0.001, 2 * (1 - this.normalCDF(z)));
        
        return { U, U1, U2, z, p, R1, R2 };
    }

    static calculateCohensD(data1, data2) {
        if (!data1 || !data2 || data1.length === 0 || data2.length === 0) {
            return { value: 0, description: 'None' };
        }

        // Insufficient data for variance calculation
        if (data1.length <= 1 || data2.length <= 1) {
            return { value: 0, description: 'Insufficient data' };
        }

        const stats1 = this.calculateBasicStats(data1);
        const stats2 = this.calculateBasicStats(data2);
        
        if (stats1.count <= 1 || stats2.count <= 1) {
            return { value: 0, description: 'Insufficient data' };
        }
        
        const var1 = stats1.std ** 2;
        const var2 = stats2.std ** 2;
        const pooledSD = Math.sqrt((var1 + var2) / 2);
        
        // Use epsilon for floating point comparison
        if (pooledSD <= Number.EPSILON) {
            return { value: 0, description: 'None' };
        }
        
        const value = Math.abs(stats1.mean - stats2.mean) / pooledSD;
        return { value, description: this.getEffectSizeLabel(value) };
    }

    static normalCDF(z) {
        return 0.5 * (1 + this.erf(z / Math.sqrt(2)));
    }

    static erf(x) {
        const a1 =  0.254829592;
        const a2 = -0.284496736;
        const a3 =  1.421413741;
        const a4 = -1.453152027;
        const a5 =  1.061405429;
        const p  =  0.3275911;

        const sign = x >= 0 ? 1 : -1;
        x = Math.abs(x);

        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

        return sign * y;
    }

    static calculateMedian(values) {
        if (!values || values.length === 0) {
            return 0;
        }
        
        const validValues = values.filter(v => !isNaN(v) && isFinite(v));
        if (validValues.length === 0) return 0;
        
        const sorted = [...validValues].sort((a, b) => a - b);
        const n = sorted.length;
        return n % 2 === 0 ? (sorted[n/2 - 1] + sorted[n/2]) / 2 : sorted[Math.floor(n/2)];
    }

    static getEffectSizeLabel(cohensD) {
        if (cohensD < 0.2) return 'Negligible';
        if (cohensD < 0.5) return 'Small';
        if (cohensD < 0.8) return 'Medium';
        return 'Large';
    }

    static getEffectSizeLabelR(r) {
        if (r < 0.1) return 'Negligible';
        if (r < 0.3) return 'Small';
        if (r < 0.5) return 'Medium';
        return 'Large';
    }

    static getAsteriskNotation(pValue) {
        if (pValue < 0.001) return '***';
        if (pValue < 0.01) return '**';
        if (pValue < 0.05) return '*';
        return '';
    }

    static calculateBasicStats(values) {
        if (!values || values.length === 0) {
            return { mean: 0, std: 0, min: 0, max: 0, median: 0, count: 0 };
        }

        const valid = values.filter(v => !isNaN(v) && isFinite(v));
        if (valid.length === 0) {
            return { mean: 0, std: 0, min: 0, max: 0, median: 0, count: 0 };
        }

        const mean = valid.reduce((sum, val) => sum + val, 0) / valid.length;
        
        // Handle single data point case (no variance)
        let std = 0;
        if (valid.length > 1) {
            const variance = valid.reduce((sum, val) => sum + (val - mean) ** 2, 0) / (valid.length - 1);
            std = Math.sqrt(Math.max(0, variance)); // Ensure non-negative
        }
        
        return {
            mean,
            std,
            min: Math.min(...valid),
            max: Math.max(...valid),
            median: this.calculateMedian(valid),
            count: valid.length
        };
    }

    static arraysApproximatelyEqual(arr1, arr2, tolerance = 1e-10) {
        if (!arr1 || !arr2 || arr1.length !== arr2.length) {
            return false;
        }

        return arr1.every((val, i) => Math.abs(val - arr2[i]) <= tolerance);
    }

    /**
     * Consolidated statistical functions to replace duplicated calculations
     */
    
    static calculateMean(values) {
        if (!values || values.length === 0) return 0;
        const valid = values.filter(v => !isNaN(v) && isFinite(v));
        if (valid.length === 0) return 0;
        return valid.reduce((sum, val) => sum + val, 0) / valid.length;
    }

    static calculateVariance(values) {
        if (!values || values.length <= 1) return 0;
        const valid = values.filter(v => !isNaN(v) && isFinite(v));
        if (valid.length <= 1) return 0;
        
        const mean = this.calculateMean(valid);
        return valid.reduce((sum, val) => sum + (val - mean) ** 2, 0) / (valid.length - 1);
    }

    static calculateStandardDeviation(values) {
        return Math.sqrt(this.calculateVariance(values));
    }

    static validateNumericData(data, filterPositive = false) {
        if (!data || !Array.isArray(data)) return [];
        
        let valid = data.filter(v => !isNaN(v) && isFinite(v));
        if (filterPositive) {
            valid = valid.filter(v => v > 0);
        }
        return valid;
    }

    static calculatePercentile(values, percentile) {
        if (!values || values.length === 0) return 0;
        
        const valid = this.validateNumericData(values);
        if (valid.length === 0) return 0;
        
        const sorted = [...valid].sort((a, b) => a - b);
        const index = (percentile / 100) * (sorted.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        
        if (lower === upper) {
            return sorted[lower];
        }
        
        return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
    }

    static calculateIQRBounds(values, multiplier = 1.5) {
        if (!values || values.length === 0) {
            return { lower: 0, upper: 0, q1: 0, q3: 0, iqr: 0 };
        }
        
        const q1 = this.calculatePercentile(values, 25);
        const q3 = this.calculatePercentile(values, 75);
        const iqr = q3 - q1;
        
        return {
            lower: q1 - multiplier * iqr,
            upper: q3 + multiplier * iqr,
            q1,
            q3,
            iqr
        };
    }

    static isOutlier(value, bounds) {
        return value < bounds.lower || value > bounds.upper;
    }

    static filterOutliers(values, multiplier = 1.5) {
        const bounds = this.calculateIQRBounds(values, multiplier);
        return values.filter(v => !this.isOutlier(v, bounds));
    }

    static groupDataBy(array, keyFunction) {
        return array.reduce((groups, item) => {
            const key = keyFunction(item);
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(item);
            return groups;
        }, {});
    }

    static calculateTumorGrowthRate(valueX, valueY, timeX, timeY) {
        if (!valueX || !valueY || valueX <= 0 || valueY <= 0) {
            return NaN;
        }
        
        if (timeY <= timeX) {
            return NaN;
        }
        
        return Math.log(valueY / valueX) / (timeY - timeX);
    }
}

// Performance optimizations for frequently used calculations
MathUtils._medianCache = new Map();
MathUtils._statsCache = new Map();
MathUtils.MAX_CACHE_SIZE = 100;

// Cache management
MathUtils._manageCache = function(cache, key, result) {
    if (cache.size >= this.MAX_CACHE_SIZE) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
    }
    cache.set(key, result);
    return result;
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MathUtils;
}

if (typeof window !== 'undefined') {
    window.MathUtils = MathUtils;
}
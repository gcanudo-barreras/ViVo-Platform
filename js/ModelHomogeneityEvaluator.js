// Model homogeneity evaluator for in vivo oncological analysis

class ModelHomogeneityEvaluator {
    constructor(config = {}) {
        this.thresholds = {
            excellent: config.excellent || 15,
            good: config.good || 25,
            poor: config.poor || 30
        };
        
        this.sampleSizeAdjustments = {
            small: config.smallSample || 0.8,
            verySmall: config.verySmallSample || 0.6
        };
        
    }

    /**
     * Main evaluation function
     * @param {Array} animals - Array of animal objects with timePoints and measurements
     * @returns {Object} Complete homogeneity analysis results
     */
    evaluate(animals) {
        // Use consolidated grouping function from MathUtils
        const groups = MathUtils.groupDataBy(animals, animal => animal.group);
        
        const results = {
            totalAnimals: animals.length,
            totalGroups: Object.keys(groups).length,
            groupAnalysis: {},
            overallAssessment: {},
            recommendations: []
        };
        Object.keys(groups).forEach(groupName => {
            const groupAnimals = groups[groupName];
            results.groupAnalysis[groupName] = this.analyzeGroupHomogeneity(groupAnimals);
        });
        results.overallAssessment = this.calculateOverallHomogeneity(results.groupAnalysis);
        results.recommendations = this.generateRecommendations(results);
        return results;
    }

    /**
     * Analyzes homogeneity for a single group
     * @param {Array} groupAnimals - Animals in the group
     * @returns {Object} Group-specific homogeneity analysis
     */
    analyzeGroupHomogeneity(groupAnimals) {
        const groupName = groupAnimals[0].group;
        const n = groupAnimals.length;
        const baselineValues = groupAnimals.map(animal => {
            const day0Index = animal.timePoints.indexOf(0);
            if (day0Index !== -1) {
                return animal.measurements[day0Index];
            }
            return animal.measurements[0];
        });
        
        // Use consolidated validation function
        const validBaseline = MathUtils.validateNumericData(baselineValues, true);
        
        if (validBaseline.length === 0) {
            return {
                groupName,
                n,
                hasBaseline: false,
                cv: null,
                homogeneityScore: 0,
                quality: 'insufficient'
            };
        }
        
        // Use consolidated statistical calculations
        const stats = MathUtils.calculateBasicStats(validBaseline);
        const cv = stats.count > 0 ? (stats.std / stats.mean) * 100 : 0;
        const homogeneityScore = this.calculateHomogeneityScore(cv, n);
        const quality = this.assessQuality(cv);
        
        return {
            groupName,
            n,
            hasBaseline: true,
            baselineValues: validBaseline,
            mean: stats.mean.toFixed(2),
            stdDev: stats.std.toFixed(2),
            cv: cv.toFixed(1),
            homogeneityScore: Math.round(homogeneityScore),
            quality
        };
    }

    /**
     * Calculates homogeneity score based on CV and sample size
     * @param {number} cv - Coefficient of variation
     * @param {number} n - Sample size
     * @returns {number} Score from 0-100
     */
    calculateHomogeneityScore(cv, n) {
        let score = 100;
        
        if (cv > this.thresholds.poor) {
            score = Math.max(0, 100 - (cv - this.thresholds.poor) * 2);
        } else if (cv > this.thresholds.excellent) {
            score = 95 - (cv - this.thresholds.excellent);
        }
        if (n < 5) {
            score *= this.sampleSizeAdjustments.small;
        }
        if (n < 3) {
            score *= this.sampleSizeAdjustments.verySmall;
        }
        return score;
    }

    /**
     * Assesses quality category based on CV
     * @param {number} cv - Coefficient of variation
     * @returns {string} Quality category
     */
    assessQuality(cv) {
        if (cv > this.thresholds.poor) return 'poor';
        if (cv > this.thresholds.good) return 'fair';
        if (cv > this.thresholds.excellent) return 'good';
        return 'excellent';
    }

    /**
     * Calculates overall homogeneity across all groups
     * @param {Object} groupAnalysis - Individual group analyses
     * @returns {Object} Overall assessment
     */
    calculateOverallHomogeneity(groupAnalysis) {
        const groups = Object.values(groupAnalysis);
        const validGroups = groups.filter(g => g.hasBaseline);
        
        if (validGroups.length === 0) {
            return {
                averageCV: null,
                overallScore: 0,
                quality: 'insufficient',
                recommendation: 'REVIEW'
            };
        }
        const averageCV = validGroups.reduce((sum, g) => sum + parseFloat(g.cv), 0) / validGroups.length;
        const averageScore = validGroups.reduce((sum, g) => sum + g.homogeneityScore, 0) / validGroups.length;
        let quality = 'excellent';
        let recommendation = 'PROCEED';
        
        if (averageCV > this.thresholds.poor) {
            quality = 'poor';
            recommendation = 'REVIEW';
        } else if (averageCV > this.thresholds.good) {
            quality = 'fair';
            recommendation = 'CAUTION';
        } else if (averageCV > this.thresholds.excellent) {
            quality = 'good';
            recommendation = 'PROCEED';
        }
        
        return {
            averageCV: averageCV.toFixed(1),
            overallScore: Math.round(averageScore),
            quality,
            recommendation
        };
    }

    /**
     * Generates contextual recommendations based on analysis results
     * @param {Object} results - Complete homogeneity analysis results
     * @returns {Array} Array of recommendation objects
     */
    generateRecommendations(results) {
        const recommendations = [];
        const overall = results.overallAssessment;
        
        if (overall.recommendation === 'REVIEW') {
            recommendations.push({
                type: 'error',
                category: 'experimental',
                title: 'High Baseline Variability Detected',
                message: `Average CV = ${overall.averageCV}% across groups`,
                action: 'Consider reviewing randomization or excluding high-variance animals'
            });
        } else if (overall.recommendation === 'CAUTION') {
            recommendations.push({
                type: 'warning',
                category: 'experimental',
                title: 'Moderate Baseline Variability',
                message: `Average CV = ${overall.averageCV}% may affect sensitivity`,
                action: 'Monitor closely during analysis and consider stratified analysis'
            });
        }
        Object.values(results.groupAnalysis).forEach(group => {
            if (group.hasBaseline && parseFloat(group.cv) > this.thresholds.good) {
                recommendations.push({
                    type: 'warning',
                    category: 'group',
                    title: `High Variability in ${group.groupName}`,
                    message: `CV = ${group.cv}% in group ${group.groupName}`,
                    action: 'Review individual animals in this group'
                });
            }
            
            if (group.n < 5) {
                recommendations.push({
                    type: 'info',
                    category: 'statistical',
                    title: `Small Sample Size in ${group.groupName}`,
                    message: `Only ${group.n} animals in group ${group.groupName}`,
                    action: 'Consider increasing sample size for better statistical power'
                });
            }
        });
        if (recommendations.length === 0) {
            recommendations.push({
                type: 'success',
                category: 'experimental',
                title: 'Excellent Model Homogeneity',
                message: `Average CV = ${overall.averageCV}% - Model ready for analysis`,
                action: 'Proceed with confidence to main analysis'
            });
        }
        return recommendations;
    }

    /**
     * Updates threshold configuration
     * @param {Object} newThresholds - New threshold values
     */
    updateThresholds(newThresholds) {
        this.thresholds = { ...this.thresholds, ...newThresholds };
    }

    /**
     * Gets current configuration
     * @returns {Object} Current configuration
     */
    getConfig() {
        return {
            thresholds: { ...this.thresholds },
            sampleSizeAdjustments: { ...this.sampleSizeAdjustments }
        };
    }

}

if (typeof window !== 'undefined') {
    window.ModelHomogeneityEvaluator = ModelHomogeneityEvaluator;
}
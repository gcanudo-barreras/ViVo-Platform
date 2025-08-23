// Chart pool manager for optimized Plotly chart instances

class ChartPoolManager {
    constructor() {
        this.chartPool = new Map();
        this.activeCharts = new Map();
        this.poolSize = 5;
        this.cleanupInterval = 30000;
        this.maxIdleTime = 60000;
        
        this.startCleanupTimer();
    }

    generatePoolId(config) {
        const key = JSON.stringify({
            type: config.type || 'scatter',
            layout: {
                width: config.layout?.width || 800,
                height: config.layout?.height || 400,
                xaxis: config.layout?.xaxis?.type || 'linear',
                yaxis: config.layout?.yaxis?.type || 'linear'
            }
        });
        
        let hash = 0;
        for (let i = 0; i < key.length; i++) {
            const char = key.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        return `pool_${Math.abs(hash)}`;
    }

    async getChart(elementId, data, layout, config = {}) {
        const element = domCache.get(elementId);
        if (!element) {
            throw new Error(`Element ${elementId} not found`);
        }

        const poolId = this.generatePoolId({ layout, config });
        
        try {
            if (this.activeCharts.has(elementId)) {
                const element = domCache.get(elementId);
                if (element && element._fullLayout) {
                    const existingPoolId = this.activeCharts.get(elementId);
                    await this.updateChart(elementId, data, layout, config);
                    return elementId;
                } else {
                    this.activeCharts.delete(elementId);
                }
            }

            const pooledChart = this.getFromPool(poolId);
            if (pooledChart && pooledChart.element !== element) {
                await this.moveChartToElement(pooledChart, element, data, layout, config);
                this.activeCharts.set(elementId, poolId);
                return elementId;
            }

            await this.createNewChart(elementId, data, layout, config, poolId);
            return elementId;

        } catch (error) {
            throw error;
        }
    }

    getFromPool(poolId) {
        const pooledChart = this.chartPool.get(poolId);
        if (pooledChart && !pooledChart.inUse) {
            pooledChart.inUse = true;
            pooledChart.lastUsed = Date.now();
            return pooledChart;
        }
        return null;
    }

    async createNewChart(elementId, data, layout, config, poolId) {
        const element = domCache.get(elementId);
        
        if (typeof Plotly === 'undefined') {
            throw new Error('Plotly library not available');
        }

        const optimizedConfig = {
            responsive: true,
            displayModeBar: false,
            ...config
        };

        await Plotly.newPlot(elementId, data, layout, optimizedConfig);
        
        this.chartPool.set(poolId, {
            element: element,
            config: { data, layout, config: optimizedConfig },
            inUse: true,
            lastUsed: Date.now(),
            created: Date.now()
        });
        
        this.activeCharts.set(elementId, poolId);
    }

    async moveChartToElement(pooledChart, newElement, data, layout, config) {
        try {
            if (newElement._fullLayout) {
                Plotly.purge(newElement);
            }

            const optimizedConfig = {
                responsive: true,
                displayModeBar: false,
                ...config
            };

            await Plotly.newPlot(newElement, data, layout, optimizedConfig);
            
            pooledChart.element = newElement;
            pooledChart.config = { data, layout, config: optimizedConfig };
            pooledChart.lastUsed = Date.now();

        } catch (error) {
            throw error;
        }
    }

    async updateChart(elementId, data, layout, config = {}) {
        const poolId = this.activeCharts.get(elementId);
        
        if (poolId && this.chartPool.has(poolId)) {
            const pooledChart = this.chartPool.get(poolId);
            pooledChart.config = { data, layout, config };
            pooledChart.lastUsed = Date.now();
            
            try {
                await Plotly.react(elementId, data, layout, config);
                return true;
            } catch (error) {
                this.releaseChart(elementId);
                return this.getChart(elementId, data, layout, config);
            }
        } else {
            return this.getChart(elementId, data, layout, config);
        }
    }

    releaseChart(elementId) {
        const poolId = this.activeCharts.get(elementId);
        if (poolId && this.chartPool.has(poolId)) {
            const pooledChart = this.chartPool.get(poolId);
            pooledChart.inUse = false;
            pooledChart.lastUsed = Date.now();
        }
        
        this.activeCharts.delete(elementId);
    }

    destroyChart(elementId) {
        const element = domCache.get(elementId);
        const poolId = this.activeCharts.get(elementId);

        try {
            if (element && element._fullLayout) {
                Plotly.purge(elementId);
            }

            if (poolId) {
                this.chartPool.delete(poolId);
                this.activeCharts.delete(elementId);
            }

        } catch (error) {
        }
    }

    clearAll() {
        for (const [elementId, poolId] of this.activeCharts) {
            try {
                const element = domCache.get(elementId);
                if (element && element._fullLayout) {
                    Plotly.purge(elementId);
                }
            } catch (error) {
            }
        }

        this.chartPool.clear();
        this.activeCharts.clear();
    }

    cleanup() {
        const now = Date.now();
        const toRemove = [];

        for (const [poolId, pooledChart] of this.chartPool) {
            if (!pooledChart.inUse && (now - pooledChart.lastUsed) > this.maxIdleTime) {
                toRemove.push(poolId);
            }
        }

        toRemove.forEach(poolId => {
            const pooledChart = this.chartPool.get(poolId);
            try {
                if (pooledChart.element && pooledChart.element._fullLayout) {
                    Plotly.purge(pooledChart.element);
                }
            } catch (error) {
            }
            this.chartPool.delete(poolId);
        });
    }

    startCleanupTimer() {
        setInterval(() => {
            this.cleanup();
        }, this.cleanupInterval);
    }

    async createOptimizedChart(elementId, chartType, data, options = {}) {
        const commonLayouts = {
            scatter: {
                xaxis: { title: options.xTitle || 'Time (days)' },
                yaxis: { title: options.yTitle || 'Value' },
                hovermode: 'closest'
            },
            bar: {
                xaxis: { title: options.xTitle || 'Category' },
                yaxis: { title: options.yTitle || 'Value' },
                bargap: 0.1
            },
            heatmap: {
                xaxis: { title: options.xTitle || 'X' },
                yaxis: { title: options.yTitle || 'Y' }
            }
        };

        const baseLayout = options.layout || {};
        const chartTypeDefaults = commonLayouts[chartType] || {};
        
        const layout = {
            ...baseLayout,
            xaxis: {
                ...baseLayout.xaxis,
                title: options.xTitle || baseLayout.xaxis?.title || chartTypeDefaults.xaxis?.title || 'X'
            },
            yaxis: {
                ...baseLayout.yaxis,
                title: options.yTitle || baseLayout.yaxis?.title || chartTypeDefaults.yaxis?.title || 'Y'
            },
            title: options.title || baseLayout.title || '',
            showlegend: options.showLegend !== false,
            hovermode: baseLayout.hovermode || chartTypeDefaults.hovermode || 'closest'
        };

        const config = {
            responsive: true,
            displayModeBar: false,
            ...options.config
        };

        return this.getChart(elementId, data, layout, config);
    }

    async createChart(elementId, data, layout, config = {}) {
        return this.getChart(elementId, data, layout, config);
    }

    async applyTemporaryTheme(elementId, themeLayout) {
        const element = domCache.get(elementId);
        if (!element || !element.data) {
            throw new Error(`Chart ${elementId} not found or not initialized`);
        }

        const originalLayout = JSON.parse(JSON.stringify(element.layout));
        const newLayout = { ...element.layout, ...themeLayout };
        
        try {
            await Plotly.react(elementId, element.data, newLayout);
            return originalLayout;
        } catch (error) {
            throw error;
        }
    }

    async restoreTheme(elementId, originalLayout) {
        const element = domCache.get(elementId);
        if (!element || !element.data) {
            return;
        }

        try {
            await Plotly.react(elementId, element.data, originalLayout);
        } catch (error) {
        }
    }

    purgeChart(elementId) {
        try {
            if (typeof Plotly !== 'undefined') {
                Plotly.purge(elementId);
            }
            
            this.releaseChart(elementId);
        } catch (error) {
        }
    }

    getStats() {
        const totalCharts = this.chartPool.size;
        const activeChartsCount = Array.from(this.chartPool.values())
            .filter(chart => chart.inUse).length;
        const idleCharts = totalCharts - activeChartsCount;
        
        return {
            totalPooledCharts: totalCharts,
            activeCharts: activeChartsCount,
            idleCharts: idleCharts,
            maxPoolSize: this.poolSize,
            poolUtilization: totalCharts > 0 ? (activeChartsCount / totalCharts * 100).toFixed(1) + '%' : '0%'
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChartPoolManager;
} else {
    window.ChartPoolManager = ChartPoolManager;
}
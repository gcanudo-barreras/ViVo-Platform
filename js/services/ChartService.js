// ChartService - Plotly chart creation and management

class ChartService {
    constructor() {
        this.chartPoolManager = null;
        this.defaultColors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];
        this.expCache = new Map();
        this.colorMap = new Map();
    }

    initialize(chartPoolManager = null) {
        this.chartPoolManager = chartPoolManager;
    }

    clearCharts(chartIds = ['mainChart', 'normalizedChart']) {
        chartIds.forEach(chartId => {
            if (!this.chartPoolManager) {
                throw new Error('ChartPoolManager not available for chart cleanup');
            }
            this.chartPoolManager.purgeChart(chartId);
        });
    }

    async createMainChart(processedData, dayColumns, options = {}) {
        const traces = this._generateMainChartTraces(processedData, dayColumns, options);
        const layout = this._getMainChartLayout(options);
        const config = this._getChartConfig();
        const cleanTraces = this._cleanTraceNames(traces);
        
        return await this._createPlotlyChart('mainChart', cleanTraces, layout, config);
    }

    async createNormalizedGrowthChart(normalizedData, options = {}) {
        const traces = this._generateNormalizedChartTraces(normalizedData, options);
        const layout = this._getNormalizedChartLayout(options);
        const config = this._getChartConfig(true);
        const cleanTraces = this._cleanTraceNames(traces);
        
        window.normalizedChartData = { traces: cleanTraces, layout };
        return await this._createPlotlyChart('normalizedChart', cleanTraces, layout, config);
    }

    async toggleNormalizedScale(useLogScale = false) {
        if (!window.normalizedChartData) throw new Error('Normalized chart data not available');
        
        const { traces } = window.normalizedChartData;
        const newLayout = {
            ...window.normalizedChartData.layout,
            yaxis: {
                ...window.normalizedChartData.layout.yaxis,
                type: useLogScale ? 'log' : 'linear',
                title: useLogScale ? 'Log Growth Functions' : 'Normalized Growth Functions'
            }
        };
        
        const success = await this._updatePlotlyChart('normalizedChart', traces, newLayout);
        if (success) this._updateScaleDescription(useLogScale);
        return success;
    }
    _cleanTraceNames(traces) {
        return traces.map(trace => ({
            ...trace,
            name: trace.name.replace(' Average', '')
        }));
    }

    _updateScaleDescription(useLogScale) {
        const descElement = document.querySelector('.normalized-description');
        if (descElement) {
            descElement.textContent = useLogScale ? 
                'Logarithmic scale view of normalized growth functions' :
                'Linear scale view of normalized growth functions';
        }
    }

    async _createPlotlyChart(chartId, traces, layout, config) {
        if (!this.chartPoolManager) throw new Error('ChartPoolManager required for chart creation');
        await this.chartPoolManager.createChart(chartId, traces, layout, config);
        return true;
    }

    async _updatePlotlyChart(chartId, traces, layout, config = {}) {
        if (!this.chartPoolManager) throw new Error('ChartPoolManager required for chart updates');
        await this.chartPoolManager.updateChart(chartId, traces, layout, config);
        return true;
    }

    _generateMainChartTraces(processedData, dayColumns, options) {
        const traces = [];
        const groupStats = options.groupStats || {};
        const colors = this._getGroupColors(Object.keys(processedData));

        Object.entries(processedData).forEach(([groupName, animals], groupIndex) => {
            const groupColor = this._getConsistentGroupColor(groupName);

            animals.forEach(animal => {
                if (animal.validPoints && animal.validPoints.length >= 3) {
                    const xData = animal.validPoints.map(p => p.day);
                    const yData = animal.validPoints.map(p => p.value);

                    traces.push({
                        x: xData,
                        y: yData,
                        mode: 'markers',
                        type: 'scatter',
                        name: `${animal.id} (${groupName})`,
                        legendgroup: groupName,
                        marker: { color: groupColor, size: 8, opacity: 0.85 },
                        hovertemplate: `<b>${animal.id}</b><br>Group: ${groupName}<br>Day: %{x}<br>Value: %{y:.2f}<extra></extra>`,
                        showlegend: false
                    });
                }
            });

            if (groupStats[groupName] && groupStats[groupName].r && groupStats[groupName].a) {
                const { r, a } = groupStats[groupName];
                const [smoothXData, smoothYData] = this._generateSmoothCurve(dayColumns, r, a);

                traces.push({
                    x: smoothXData,
                    y: smoothYData,
                    mode: 'lines',
                    type: 'scatter',
                    name: `${groupName} Average`,
                    meta: { displayName: groupName },
                    legendgroup: groupName,
                    line: { color: groupColor, width: 3 },
                    hovertemplate: `<b>${groupName}</b><br>Day: %{x}<br>Predicted: %{y:.2f}<extra></extra>`,
                    showlegend: true
                });
            }
        });

        return traces;
    }

    _generateNormalizedChartTraces(normalizedData, options) {
        const traces = [];
        const colors = this._getGroupColors(Object.keys(normalizedData));

        Object.entries(normalizedData).forEach(([groupName, data]) => {
            if (data.xData && data.yData) {
                traces.push({
                    x: data.xData,
                    y: data.yData,
                    mode: 'lines',
                    type: 'scatter',
                    name: `${groupName} Average`,
                    line: { color: this._getConsistentGroupColor(groupName), width: 3 },
                    hovertemplate: `<b>${groupName}</b><br>Day: %{x}<br>Normalized Value: %{y:.3f}<extra></extra>`
                });
            }
        });

        return traces;
    }

    _getMainChartLayout(options = {}) {
        const yAxisTitle = (options.dataType || 'volume') === 'volume' ? 'Tumor Volume (mm³)' : 'BLI Signal';
        return this._getBaseLayout('Individual Growth Curves and Group Averages', 'Day', yAxisTitle);
    }

    _getNormalizedChartLayout(options = {}) {
        const layout = this._getBaseLayout('Normalized Growth Functions Comparison', 'Day', 'Normalized Growth Functions');
        layout.yaxis.type = 'linear';
        return layout;
    }

    _getBaseLayout(title, xTitle, yTitle) {
        const axisStyle = {
            gridcolor: 'rgba(255,255,255,0.2)',
            tickcolor: '#e0e0e0',
            tickfont: { color: '#e0e0e0' },
            titlefont: { color: '#e0e0e0' }
        };
        
        return {
            title: { text: title, font: { size: 16, color: '#e0e0e0' } },
            xaxis: { title: xTitle, ...axisStyle },
            yaxis: { title: yTitle, ...axisStyle },
            plot_bgcolor: 'transparent',
            paper_bgcolor: 'transparent',
            font: { color: '#e0e0e0' },
            legend: { bgcolor: 'transparent', bordercolor: 'transparent', borderwidth: 1, font: { color: '#e0e0e0' } },
            hovermode: 'closest'
        };
    }

    _getChartConfig(includeScaleToggle = false) {
        const config = {
            responsive: true,
            displayModeBar: 'hover',
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            displaylogo: false,
            toImageButtonOptions: {
                format: 'png',
                filename: 'vivo_chart',
                height: 500,
                width: 900,
                scale: 2
            }
        };

        if (includeScaleToggle) {
            config.modeBarButtonsToAdd = [{
                name: 'Toggle Scale',
                icon: { width: 24, height: 24, path: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' },
                click: () => {
                    const currentScale = document.querySelector('.normalized-chart')?.getAttribute('data-scale') || 'linear';
                    this.toggleNormalizedScale(currentScale === 'linear');
                }
            }];
        }

        return config;
    }


_getReportLayout(chartDiv, options = {}) {
        const originalLayout = chartDiv.layout || {};
        const reportAxisStyle = { gridcolor: '#cccccc', tickcolor: '#000000', tickfont: { color: '#000000' }, titlefont: { color: '#000000' } };
        
        return {
            ...originalLayout,
            plot_bgcolor: '#ffffff',
            paper_bgcolor: '#ffffff',
            font: { color: '#000000', size: options.fontSize || 12 },
            title: { ...originalLayout.title, font: { color: '#000000', size: options.titleSize || 16 } },
            xaxis: { ...originalLayout.xaxis, ...reportAxisStyle },
            yaxis: { ...originalLayout.yaxis, ...reportAxisStyle },
            legend: { ...originalLayout.legend, bgcolor: '#ffffff', bordercolor: '#000000', font: { color: '#000000' } }
        };
    }

    _getGroupColors(groupNames) {
        return groupNames.length <= this.defaultColors.length ? 
            this.defaultColors.slice(0, groupNames.length) : 
            [...this.defaultColors, ...Array.from({ length: groupNames.length - this.defaultColors.length }, 
                (_, i) => `hsl(${(i * 137.508) % 360}, 70%, 50%)`)];
    }

    _getConsistentGroupColor(groupName) {
        if (!groupName || groupName === 'Unknown') return this.defaultColors[0];
        if (this.colorMap.has(groupName)) return this.colorMap.get(groupName);
        
        const hash = groupName.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
        const color = this.defaultColors[Math.abs(hash) % this.defaultColors.length];
        this.colorMap.set(groupName, color);
        return color;
    }

    _generateSmoothCurve(dayColumns, r, a, points = 100) {
        const minDay = Math.min(...dayColumns);
        const maxDay = Math.max(...dayColumns);
        const step = (maxDay - minDay) / points;
        const xData = [], yData = [];
        
        for (let day = minDay; day <= maxDay; day += step) {
            xData.push(day);
            yData.push(a * this._fastExp(r * day));
        }
        
        return [xData, yData];
    }

    _fastExp(x) {
        const key = Math.round(x * 1000) / 1000;
        if (this.expCache.has(key)) return this.expCache.get(key);
        
        const result = Math.exp(x);
        
        if (this.expCache.size >= 1000) {
            this.expCache.delete(this.expCache.keys().next().value);
        }
        
        this.expCache.set(key, result);
        return result;
    }

    getPerformanceStats() {
        return {
            poolManager: !!this.chartPoolManager,
            colors: this.defaultColors.length,
            cacheSize: this.expCache.size,
            colorMappings: this.colorMap.size
        };
    }

    _getTimeRange(processedData) {
        const originalChart = domCache.get('mainChart');
        
        if (originalChart?.layout?.xaxis?.range) {
            return { min: originalChart.layout.xaxis.range[0], max: originalChart.layout.xaxis.range[1] };
        }
        
        const allDays = processedData.validAnimals.flatMap(animal => animal.timePoints);
        return allDays.length > 0 ? 
            { min: Math.min(...allDays), max: Math.max(...allDays) } : 
            { min: 0, max: 30 };
    }

    createMainChartUI() {
        const card = document.createElement('div');
        card.className = 'result-card exponential-growth-curves-card';
        card.innerHTML = '<h2>Exponential Growth Curves</h2><div id="mainChart" style="width: 100%; height: 500px;"></div>';
        domCache.get('results').appendChild(card);
        return card;
    }

    createNormalizedChartUI() {
        const card = document.createElement('div');
        card.className = 'result-card';
        card.innerHTML = `<h2>Normalized Growth Comparison</h2>
            <p>Exponential growth functions with initial value = 1, using only average growth rates (<i>r</i>)</p>
            <div style="margin: 15px 0; display: flex; align-items: center; justify-content: start; gap: 15px; padding: 10px; border-radius: 8px;">
                <span style="color: #e0e0e0; font-weight: 500;">Y-axis scale:</span>
                <label class="scale-switch">
                    <input type="checkbox" id="scaleToggle" onchange="toggleNormalizedScale()">
                    <span class="slider"><span class="slider-text" data-on="LOG" data-off="EXP"></span></span>
                </label>
                <div style="display: flex; flex-direction: column; font-size: 0.8em; color: #bbb;">
                    <span id="scaleDescription">Exponential: Shows real growth (<i>N(t)=N<sub>0</sub>exp(rt)</i>)</span>
                </div>
            </div>
            <div id="normalizedChart" style="width: 100%; height: 400px; margin-top: 1rem;"></div>`;
        domCache.get('results').appendChild(card);
        return card;
    }

    _adaptLegacyData(processedData) {
        const groups = [...new Set(processedData.validAnimals.map(a => a.group))];
        const modernData = {};
        const groupStats = {};
        
        groups.forEach(group => {
            const groupAnimals = processedData.validAnimals.filter(a => a.group === group);
            modernData[group] = groupAnimals.map(animal => ({
                id: animal.id,
                validPoints: animal.timePoints.map((day, idx) => ({ day, value: animal.measurements[idx] }))
            }));
            
            const stats = processedData.groupStats[group];
            if (stats?.valid > 0) {
                groupStats[group] = { r: stats.avgR, a: stats.avgA };
            }
        });

        const allDays = [...new Set(processedData.validAnimals.flatMap(a => a.timePoints))].sort((a, b) => a - b);
        
        return {
            modernData,
            dayColumns: allDays,
            options: { dataType: processedData.dataType, groupStats }
        };
    }

    _createNormalizedDataFromLegacy(processedData) {
        const timeRange = this._getTimeRange(processedData);
        const stepSize = (timeRange.max - timeRange.min) / 60;
        const days = Array.from({ length: 61 }, (_, i) => timeRange.min + i * stepSize);

        const normalizedData = {};
        const groups = [...new Set(processedData.validAnimals.map(a => a.group))];
        
        groups.forEach(group => {
            const stats = processedData.groupStats[group];
            if (stats?.valid > 0) {
                normalizedData[group] = {
                    xData: days,
                    yData: days.map(day => this._fastExp(stats.avgR * day))
                };
            }
        });

        return normalizedData;
    }


}

const chartService = new ChartService();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChartService;
}
if (typeof window !== 'undefined') {
    window.ChartService = ChartService;
    window.chartService = chartService;
}
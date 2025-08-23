class TGRWorker {
    constructor() {
        this.logCache = new Map();
    }

    fastLog(value) {
        const cached = this.logCache.get(value);
        if (cached !== undefined) return cached;
        const result = Math.log(value);
        this.logCache.set(value, result);
        return result;
    }

    processMatrix(allDays, animals) {
        const dayCount = allDays.length;
        const matrix = {
            days: allDays,
            values: Array(dayCount).fill().map(() => Array(dayCount).fill(0)),
            individualData: {}
        };

        const dayIndexMap = new Map(allDays.map((day, idx) => [day, idx]));

        for (let i = 0; i < dayCount; i++) {
            for (let j = i + 1; j < dayCount; j++) {
                const dayX = allDays[i];
                const dayY = allDays[j];
                const individualTGRs = [];
                
                for (const animal of animals) {
                    const xIdx = animal.timePoints.indexOf(dayX);
                    const yIdx = animal.timePoints.indexOf(dayY);
                    
                    if (xIdx !== -1 && yIdx !== -1) {
                        const valueX = animal.measurements[xIdx];
                        const valueY = animal.measurements[yIdx];
                        
                        if (valueX > 0 && valueY > 0) {
                            const r = this.fastLog(valueY / valueX) / (dayY - dayX);
                            individualTGRs.push(r);
                        }
                    }
                }
                
                const average = individualTGRs.length > 0 ? 
                    individualTGRs.reduce((a, b) => a + b) / individualTGRs.length : 0;
                
                matrix.values[i][j] = average;
                matrix.values[j][i] = average;
                matrix.individualData[`${dayX}-${dayY}`] = individualTGRs;
            }
        }

        return matrix;
    }
}

const worker = new TGRWorker();

self.onmessage = function(e) {
    const { allDays, animals, workerId } = e.data;
    
    try {
        const result = worker.processMatrix(allDays, animals);
        self.postMessage({ 
            success: true, 
            result, 
            workerId
        });
    } catch (error) {
        self.postMessage({ 
            success: false, 
            error: error.message, 
            workerId 
        });
    }
};
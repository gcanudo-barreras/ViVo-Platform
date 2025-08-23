/**
 * Core utility functions for ViVo application
 */

class AppUtilities {
    static validateFile(file) {
        const errors = [];
        const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
        const ALLOWED_EXTENSIONS = ['.csv', '.txt'];
        
        // File existence
        if (!file) {
            errors.push('No file provided');
            return { isValid: false, errors };
        }
        
        // File size validation
        if (file.size === 0) {
            errors.push('File is empty');
        } else if (file.size > MAX_FILE_SIZE) {
            errors.push(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum allowed: 50MB`);
        }
        
        // File extension validation
        const fileName = file.name.toLowerCase();
        const hasValidExtension = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext));
        if (!hasValidExtension) {
            errors.push(`Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
        }
        
        // File name validation
        if (!/^[\w\-. ]+$/.test(file.name)) {
            errors.push('File name contains invalid characters');
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            fileInfo: {
                name: file.name,
                size: file.size,
                type: file.type || 'text/csv'
            }
        };
    }

    static debounce(func, wait, immediate = false) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func.apply(this, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(this, args);
        };
    }

    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }


    static isElementVisible(el) {
        if (!el) return false;
        
        const rect = el.getBoundingClientRect();
        const windowHeight = window.innerHeight || document.documentElement.clientHeight;
        const windowWidth = window.innerWidth || document.documentElement.clientWidth;
        
        const verticalVisible = Math.max(0, Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0));
        const horizontalVisible = Math.max(0, Math.min(rect.right, windowWidth) - Math.max(rect.left, 0));
        
        const elementArea = rect.height * rect.width;
        const visibleArea = verticalVisible * horizontalVisible;
        
        return elementArea > 0 && (visibleArea / elementArea) >= 0.3;
    }
}

class SafePerformance {
    constructor() {
        this.marks = new Map();
        this.measures = new Map();
        this.supportsPerformance = typeof performance !== 'undefined' && 
                                  typeof performance.mark === 'function' && 
                                  typeof performance.measure === 'function';
    }

    mark(name) {
        if (this.supportsPerformance) {
            try {
                performance.mark(name);
            } catch (error) {
                this.marks.set(name, performance.now());
            }
        } else {
            this.marks.set(name, Date.now());
        }
    }

    measure(startMark, endMark = null) {
        if (this.supportsPerformance) {
            try {
                if (endMark) {
                    performance.measure(`${startMark}-to-${endMark}`, startMark, endMark);
                    const entries = performance.getEntriesByName(`${startMark}-to-${endMark}`);
                    return entries.length > 0 ? entries[0].duration : 0;
                } else {
                    const startTime = this.marks.get(startMark) || performance.now();
                    return performance.now() - startTime;
                }
            } catch (error) {
                return this.manualMeasure(startMark, endMark);
            }
        } else {
            return this.manualMeasure(startMark, endMark);
        }
    }

    manualMeasure(startMark, endMark = null) {
        const startTime = this.marks.get(startMark);
        if (!startTime) return 0;
        
        const endTime = endMark ? this.marks.get(endMark) : Date.now();
        return endTime - startTime;
    }

    now() {
        if (this.supportsPerformance && typeof performance.now === 'function') {
            try {
                return performance.now();
            } catch (error) {
                return Date.now();
            }
        } else {
            return Date.now();
        }
    }

    logSummary() {
        if (typeof Logger !== 'undefined' && Logger.enabled) {
            const summary = {};
            for (const [name, time] of this.marks.entries()) {
                if (name.endsWith('-start')) {
                    const baseName = name.replace('-start', '');
                    const duration = this.measure(name);
                    if (duration > 0) {
                        summary[baseName] = `${duration.toFixed(2)}ms`;
                    }
                }
            }
            
            if (Object.keys(summary).length > 0) {
                Logger.log('Performance Summary:', summary);
            }
        }
    }

    clear() {
        this.marks.clear();
        this.measures.clear();
        
        if (this.supportsPerformance) {
            try {
                performance.clearMarks();
                performance.clearMeasures();
            } catch (error) {
                
            }
        }
    }
}

const Performance = new SafePerformance();
AppUtilities.SafePerformance = Performance;

window.validateFile = AppUtilities.validateFile.bind(AppUtilities);
window.isElementVisible = AppUtilities.isElementVisible.bind(AppUtilities);

window.showNotification = function(message, type = 'info', duration = 4000, extraClass = '') {
    if (typeof notificationService !== 'undefined') {
        return notificationService.show(message, type, duration, extraClass);
    } else {
        console.error('NotificationService not available');
        return null;
    }
};

if (typeof window.Performance === 'undefined') {
    window.Performance = Performance;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AppUtilities, SafePerformance };
}
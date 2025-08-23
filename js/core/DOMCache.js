/**
 * DOMCache.js - Production Ready
 * Centralized DOM caching service for ViVo application
 */

class DOMCache {
    constructor() {
        this.cache = new Map();
        this.observers = new Map();
        this.initialized = false;
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }
    
    initialize() {
        if (this.initialized) return;
        
        this.preCache([
            'results', 'fileLabel', 'outlierFiltering', 'r2Threshold', 'outlierConfig',
            'fileInput', 'dataType', 'exportBtn', 'cyclicBtn', 'contextWizardBtn',
            'welcomeBanner', 'predictionsBtn', 'tgrBtn', 'reportBtn'
        ]);
        
        this.initialized = true;
    }
    
    preCache(elementIds) {
        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                this.cache.set(id, element);
            }
        });
    }
    
    get(elementId) {
        if (this.cache.has(elementId)) {
            const element = this.cache.get(elementId);
            if (element?.isConnected) {
                return element;
            }
            this.cache.delete(elementId);
        }
        
        const element = document.getElementById(elementId);
        if (element) {
            this.cache.set(elementId, element);
        }
        return element;
    }
    
    getMultiple(elementIds) {
        const elements = {};
        elementIds.forEach(id => elements[id] = this.get(id));
        return elements;
    }
    
    getValue(elementId, defaultValue = null) {
        const element = this.get(elementId);
        return element?.value ?? defaultValue;
    }
    
    setValue(elementId, value) {
        const element = this.get(elementId);
        if (element) {
            element.value = value;
            return true;
        }
        return false;
    }
    
    exists(elementId) {
        return this.get(elementId) !== null;
    }
    
    invalidate(elementId) {
        this.cache.delete(elementId);
        const observer = this.observers.get(elementId);
        if (observer) {
            observer.disconnect();
            this.observers.delete(elementId);
        }
    }
    
    clear() {
        this.cache.clear();
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();
    }
    
    observe(elementId) {
        if (this.observers.has(elementId)) return;
        
        const element = this.get(elementId);
        if (!element) return;
        
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
                    const wasRemoved = Array.from(mutation.removedNodes).some(node => {
                        return node === element || (node.contains?.(element));
                    });
                    
                    if (wasRemoved) {
                        this.invalidate(elementId);
                    }
                }
            });
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        this.observers.set(elementId, observer);
    }
    
    getStats() {
        const connected = Array.from(this.cache.values()).filter(el => el.isConnected).length;
        return {
            totalCached: this.cache.size,
            connectedElements: connected,
            disconnectedElements: this.cache.size - connected,
            observedElements: this.observers.size
        };
    }
    
    cleanup() {
        const toRemove = [];
        this.cache.forEach((element, id) => {
            if (!element.isConnected) {
                toRemove.push(id);
            }
        });
        toRemove.forEach(id => this.invalidate(id));
    }
}

class DOMConfigurationManager {
    static domCache = null;
    static appConfig = { version: 'Research Beta 1.0', debug: false };
    
    static initialize(domCacheInstance) {
        this.domCache = domCacheInstance;
        this.domCache?.preCache(['outlierFiltering', 'outlierConfig', 'r2Threshold', 'dataType', 'fileInput']);
    }
    
    static getOutlierFiltering() {
        return this.domCache?.getValue('outlierFiltering', 'none') ?? 'none';
    }
    
    static getR2Threshold() {
        const value = this.domCache?.getValue('r2Threshold', '0.8') ?? '0.8';
        return parseFloat(value);
    }
    
    static getDataType() {
        return this.domCache?.getValue('dataType', 'BLI') ?? 'BLI';
    }
    
    static getOutlierConfig() {
        return this.domCache?.getValue('outlierConfig', 'auto') ?? 'auto';
    }

    static getVersion() {
        return this.appConfig.version;
    }
    
    static isDebugMode() {
        return new URLSearchParams(window.location.search).get('debug') === 'true' || this.appConfig.debug;
    }

    static getAllConfigurations() {
        if (!this.domCache) return {};
        return {
            outlierFiltering: this.getOutlierFiltering(),
            outlierConfig: this.getOutlierConfig(),
            r2Threshold: this.getR2Threshold(),
            dataType: this.getDataType(),
            version: this.getVersion(),
            debug: this.isDebugMode()
        };
    }
}

class ComponentLifecycle {
    constructor(componentName = 'Unknown') {
        this.componentName = componentName;
        this.listeners = new Map();
        this.timers = new Set();
        this.observers = new Set();
        this.isDestroyed = false;
        
        if (!window.componentLifecycles) {
            window.componentLifecycles = new Set();
        }
        window.componentLifecycles.add(this);
    }
    
    addListener(elementOrId, event, handler, options = {}) {
        if (this.isDestroyed) return false;
        
        const element = typeof elementOrId === 'string' ? domCache.get(elementOrId) : elementOrId;
        if (!element) return false;
        
        element.addEventListener(event, handler, options);
        
        const elementId = element.id || `element-${Math.random().toString(36).substr(2, 9)}`;
        if (!this.listeners.has(elementId)) {
            this.listeners.set(elementId, []);
        }
        
        this.listeners.get(elementId).push({ element, event, handler, options });
        return true;
    }
    
    removeListener(elementOrId, event, handler) {
        const element = typeof elementOrId === 'string' ? domCache.get(elementOrId) : elementOrId;
        if (!element) return;
        
        element.removeEventListener(event, handler);
        
        const elementId = element.id || 'unknown';
        if (this.listeners.has(elementId)) {
            const listeners = this.listeners.get(elementId);
            const index = listeners.findIndex(l => l.event === event && l.handler === handler);
            if (index !== -1) {
                listeners.splice(index, 1);
                if (listeners.length === 0) {
                    this.listeners.delete(elementId);
                }
            }
        }
    }
    
    addTimer(callback, delay) {
        if (this.isDestroyed) return null;
        
        const timerId = setTimeout(() => {
            this.timers.delete(timerId);
            callback();
        }, delay);
        
        this.timers.add(timerId);
        return timerId;
    }
    
    addInterval(callback, interval) {
        if (this.isDestroyed) return null;
        
        const intervalId = setInterval(callback, interval);
        this.timers.add(intervalId);
        return intervalId;
    }
    
    addObserver(observer) {
        if (this.isDestroyed) return;
        this.observers.add(observer);
    }
    
    clearTimer(timerId) {
        if (this.timers.has(timerId)) {
            clearTimeout(timerId);
            clearInterval(timerId);
            this.timers.delete(timerId);
        }
    }
    
    getStats() {
        const totalListeners = Array.from(this.listeners.values())
            .reduce((total, listeners) => total + listeners.length, 0);
            
        return {
            componentName: this.componentName,
            totalListeners,
            elementsWithListeners: this.listeners.size,
            timers: this.timers.size,
            observers: this.observers.size,
            isDestroyed: this.isDestroyed
        };
    }
    
    destroy() {
        if (this.isDestroyed) return;
        
        this.listeners.forEach((listeners) => {
            listeners.forEach(({ element, event, handler, options }) => {
                element?.removeEventListener?.(event, handler, options);
            });
        });
        this.listeners.clear();
        
        this.timers.forEach(timerId => {
            clearTimeout(timerId);
            clearInterval(timerId);
        });
        this.timers.clear();
        
        this.observers.forEach(observer => observer?.disconnect?.());
        this.observers.clear();
        
        this.isDestroyed = true;
        window.componentLifecycles?.delete(this);
    }
}

class LifecycleManager {
    static components = new Map();
    
    static getLifecycle(componentName) {
        if (!this.components.has(componentName)) {
            this.components.set(componentName, new ComponentLifecycle(componentName));
        }
        return this.components.get(componentName);
    }
    
    static destroyLifecycle(componentName) {
        const lifecycle = this.components.get(componentName);
        if (lifecycle) {
            lifecycle.destroy();
            this.components.delete(componentName);
        }
    }
    
    static destroyAll() {
        this.components.forEach(lifecycle => lifecycle.destroy());
        this.components.clear();
    }
    
    static getGlobalStats() {
        const stats = {};
        let totalListeners = 0;
        let totalTimers = 0;
        let totalObservers = 0;
        
        this.components.forEach((lifecycle, name) => {
            const componentStats = lifecycle.getStats();
            stats[name] = componentStats;
            totalListeners += componentStats.totalListeners;
            totalTimers += componentStats.timers;
            totalObservers += componentStats.observers;
        });
        
        return {
            components: stats,
            totals: {
                components: this.components.size,
                listeners: totalListeners,
                timers: totalTimers,
                observers: totalObservers
            }
        };
    }
}

const domCache = new DOMCache();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => DOMConfigurationManager.initialize(domCache));
} else {
    DOMConfigurationManager.initialize(domCache);
}

setInterval(() => domCache.cleanup(), 5 * 60 * 1000);

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DOMCache, DOMConfigurationManager, ComponentLifecycle, LifecycleManager };
}

window.DOMCache = DOMCache;
window.domCache = domCache;
window.DOMConfigurationManager = DOMConfigurationManager;
window.ComponentLifecycle = ComponentLifecycle;
window.LifecycleManager = LifecycleManager;
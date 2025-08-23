class EventManager {
    constructor() {
        this.listeners = new Map();
        this.eventHistory = [];
        this.maxHistorySize = 1000;
        this.metrics = {
            eventsEmitted: 0,
            eventsHandled: 0,
            errors: 0
        };
    }

    on(eventName, callback, options = {}) {
        if (typeof callback !== 'function') return false;

        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }

        const listenerConfig = {
            id: this._generateId(),
            callback,
            once: options.once || false,
            priority: options.priority || 0,
            context: options.context || null,
            filter: options.filter || null,
            async: options.async || false
        };

        const listeners = this.listeners.get(eventName);
        listeners.push(listenerConfig);
        listeners.sort((a, b) => b.priority - a.priority);

        return listenerConfig.id;
    }

    once(eventName, callback, options = {}) {
        return this.on(eventName, callback, { ...options, once: true });
    }

    off(eventName, identifier) {
        if (!this.listeners.has(eventName)) return false;

        const listeners = this.listeners.get(eventName);
        const initialLength = listeners.length;
        const index = listeners.findIndex(listener => 
            (typeof identifier === 'string' && listener.id === identifier) ||
            (typeof identifier === 'function' && listener.callback === identifier)
        );
        
        if (index !== -1) {
            listeners.splice(index, 1);
        }

        if (listeners.length === 0) {
            this.listeners.delete(eventName);
        }

        return listeners.length !== initialLength;
    }

    async emit(eventName, data = null, options = {}) {
        this.metrics.eventsEmitted++;

        const eventData = {
            name: eventName,
            data,
            timestamp: Date.now(),
            source: options.source || 'unknown',
            id: this._generateId()
        };

        this._addToHistory(eventData);

        if (!this.listeners.has(eventName)) {
            return { handled: 0, errors: 0 };
        }

        const listeners = [...this.listeners.get(eventName)];
        let handledCount = 0;
        let errorCount = 0;
        const results = [];

        for (const listener of listeners) {
            try {
                if (listener.filter && !listener.filter(eventData)) continue;

                const context = listener.context || this;
                const result = listener.async 
                    ? await listener.callback.call(context, eventData)
                    : listener.callback.call(context, eventData);

                results.push({ listenerId: listener.id, result });
                handledCount++;
                this.metrics.eventsHandled++;

                if (listener.once) {
                    this.off(eventName, listener.id);
                }
            } catch (error) {
                errorCount++;
                this.metrics.errors++;
                results.push({ 
                    listenerId: listener.id, 
                    error: error.message
                });
            }
        }

        return {
            eventId: eventData.id,
            handled: handledCount,
            errors: errorCount,
            results
        };
    }

    emitSync(eventName, data = null, options = {}) {
        return this.emit(eventName, data, options);
    }

    removeAllListeners(eventName = null) {
        if (eventName) {
            this.listeners.delete(eventName);
        } else {
            this.listeners.clear();
        }
        return true;
    }

    getEventNames() {
        return Array.from(this.listeners.keys());
    }

    getListenerCount(eventName) {
        return this.listeners.has(eventName) ? this.listeners.get(eventName).length : 0;
    }

    getEventHistory(limit = 100) {
        return this.eventHistory.slice(-limit);
    }

    getMetrics() {
        return {
            ...this.metrics,
            activeListeners: this.listeners.size,
            totalListeners: Array.from(this.listeners.values()).reduce((sum, arr) => sum + arr.length, 0),
            historySize: this.eventHistory.length
        };
    }

    createNamespace(namespace) {
        const prefix = `${namespace}:`;
        return {
            on: (eventName, callback, options) => 
                this.on(prefix + eventName, callback, options),
            once: (eventName, callback, options) => 
                this.once(prefix + eventName, callback, options),
            off: (eventName, identifier) => 
                this.off(prefix + eventName, identifier),
            emit: (eventName, data, options) => 
                this.emit(prefix + eventName, data, { ...options, source: namespace }),
            emitSync: (eventName, data, options) => 
                this.emitSync(prefix + eventName, data, { ...options, source: namespace })
        };
    }

    _generateId() {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    _addToHistory(eventData) {
        this.eventHistory.push(eventData);
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }
    }

    migrateExistingEvents(migrations = {}) {
        const defaultMigrations = {
            'DOMContentLoaded': 'app:ready',
            'beforeunload': 'app:beforeunload',
            'resize': 'window:resize',
            'click': 'ui:click',
            'change': 'form:change',
            'submit': 'form:submit'
        };

        const allMigrations = { ...defaultMigrations, ...migrations };

        Object.entries(allMigrations).forEach(([oldEvent, newEvent]) => {
            if (oldEvent === 'DOMContentLoaded') {
                document.addEventListener('DOMContentLoaded', (e) => {
                    this.emit(newEvent, { originalEvent: e });
                });
            } else if (oldEvent === 'resize') {
                window.addEventListener('resize', (e) => {
                    this.emit(newEvent, { 
                        width: window.innerWidth, 
                        height: window.innerHeight,
                        originalEvent: e 
                    });
                });
            }
        });
    }
}

const eventManager = new EventManager();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventManager;
}

if (typeof window !== 'undefined') {
    window.EventManager = EventManager;
    window.eventManager = eventManager;
}
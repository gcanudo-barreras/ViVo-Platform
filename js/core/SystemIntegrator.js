/**
 * SystemIntegrator.js - Central system orchestrator
 */

class SystemIntegrator {
    constructor() {
        this.modules = new Map();
        this.initializationOrder = [];
        this.isInitialized = false;
        this.healthChecks = new Map();
        this.dependencies = new Map();
        this.startupTime = null;
        this.diagnostics = {
            errors: [],
            warnings: [],
            info: []
        };
        
        this._initializeDiagnostics();
    }

    /**
     * @param {string} name
     * @param {Object} module
     * @param {Object} config
     */
    registerModule(name, module, config = {}) {
        if (this.modules.has(name)) {
            this._addDiagnostic('warning', `Module '${name}' already registered, replacing`);
        }

        const moduleConfig = {
            instance: module,
            dependencies: config.dependencies || [],
            priority: config.priority || 0,
            healthCheck: config.healthCheck || null,
            initialized: false,
            initTime: null,
            lastHealthCheck: null,
            status: 'registered'
        };

        this.modules.set(name, moduleConfig);
        this.dependencies.set(name, config.dependencies || []);

        this._updateInitializationOrder();
        this._addDiagnostic('info', `Module '${name}' registered successfully`);
        return true;
    }

    /**
     * Initialize all system modules
     */
    async initialize() {
        if (this.isInitialized) {
            this._addDiagnostic('warning', 'System already initialized');
            return false;
        }

        this.startupTime = Date.now();

        try {
            if (!this._validateDependencies()) {
                throw new Error('Dependency validation failed');
            }

            for (const moduleName of this.initializationOrder) {
                await this._initializeModule(moduleName);
            }

            this._setupInterconnections();
            await this._runHealthChecks();

            this.isInitialized = true;
            const totalTime = Date.now() - this.startupTime;
            this._addDiagnostic('info', `System initialized successfully in ${totalTime}ms`);
            
            if (window.eventManager) {
                window.eventManager.emit('system:initialized', {
                    totalTime,
                    modulesCount: this.modules.size,
                    diagnostics: this.diagnostics
                });
            }
            return true;

        } catch (error) {
            this._addDiagnostic('error', `System initialization failed: ${error.message}`);
            return false;
        }
    }

    /**
     * @private
     */
    async _initializeModule(moduleName) {
        const moduleConfig = this.modules.get(moduleName);
        if (!moduleConfig) {
            throw new Error(`Module '${moduleName}' not found`);
        }

        if (moduleConfig.initialized) {
            this._addDiagnostic('info', `Module '${moduleName}' already initialized`);
            return;
        }

        const startTime = Date.now();
        
        try {
            for (const depName of moduleConfig.dependencies) {
                const depModule = this.modules.get(depName);
                if (!depModule?.initialized) {
                    throw new Error(`Dependency '${depName}' not initialized for module '${moduleName}'`);
                }
            }

            const dependencies = {};
            for (const depName of moduleConfig.dependencies) {
                dependencies[depName] = this.modules.get(depName).instance;
            }
            if (moduleConfig.instance.initialize) {
                await moduleConfig.instance.initialize(dependencies);
            }

            moduleConfig.initialized = true;
            moduleConfig.initTime = Date.now() - startTime;
            moduleConfig.status = 'initialized';

            this._addDiagnostic('info', `Module '${moduleName}' initialized in ${moduleConfig.initTime}ms`);

        } catch (error) {
            moduleConfig.status = 'error';
            this._addDiagnostic('error', `Failed to initialize module '${moduleName}': ${error.message}`);
            throw error;
        }
    }

    /**
     * @private
     */
    _setupInterconnections() {
        if (this.modules.has('eventManager')) {
            this.modules.get('eventManager').instance.migrateExistingEvents();
        }
        this._addDiagnostic('info', 'Module interconnections established');
    }

    /**
     * @private
     */
    _validateDependencies() {
        const visited = new Set();
        const visiting = new Set();

        const validateModule = (moduleName) => {
            if (visiting.has(moduleName)) {
                throw new Error(`Circular dependency detected involving '${moduleName}'`);
            }
            
            if (visited.has(moduleName)) {
                return true;
            }

            visiting.add(moduleName);

            const dependencies = this.dependencies.get(moduleName) || [];
            for (const depName of dependencies) {
                if (!this.modules.has(depName)) {
                    throw new Error(`Missing dependency '${depName}' for module '${moduleName}'`);
                }
                validateModule(depName);
            }

            visiting.delete(moduleName);
            visited.add(moduleName);
            return true;
        };

        try {
            for (const moduleName of this.modules.keys()) {
                validateModule(moduleName);
            }
            this._addDiagnostic('info', 'Dependency validation passed');
            return true;
        } catch (error) {
            this._addDiagnostic('error', `Dependency validation failed: ${error.message}`);
            return false;
        }
    }

    /**
     * @private
     */
    _updateInitializationOrder() {
        const result = [];
        const visited = new Set();
        const temporary = new Set();

        const visit = (moduleName) => {
            if (temporary.has(moduleName)) {
                throw new Error(`Circular dependency detected: ${moduleName}`);
            }
            
            if (visited.has(moduleName)) {
                return;
            }

            temporary.add(moduleName);
            
            const dependencies = this.dependencies.get(moduleName) || [];
            for (const depName of dependencies) {
                if (this.modules.has(depName)) {
                    visit(depName);
                }
            }

            temporary.delete(moduleName);
            visited.add(moduleName);
            result.push(moduleName);
        };

        const modulesList = Array.from(this.modules.entries())
            .sort(([,a], [,b]) => (b.priority || 0) - (a.priority || 0))
            .map(([name]) => name);

        for (const moduleName of modulesList) {
            if (!visited.has(moduleName)) {
                visit(moduleName);
            }
        }

        this.initializationOrder = result;
    }

    /**
     * Run health checks for all modules
     */
    async _runHealthChecks() {
        const results = new Map();

        for (const [moduleName, moduleConfig] of this.modules) {
            if (moduleConfig.healthCheck) {
                try {
                    const result = await moduleConfig.healthCheck();
                    results.set(moduleName, {
                        status: 'healthy',
                        details: result,
                        timestamp: Date.now()
                    });
                    moduleConfig.lastHealthCheck = Date.now();
                } catch (error) {
                    results.set(moduleName, {
                        status: 'unhealthy',
                        error: error.message,
                        timestamp: Date.now()
                    });
                    this._addDiagnostic('warning', `Health check failed for '${moduleName}': ${error.message}`);
                }
            } else {
                results.set(moduleName, {
                    status: 'no-check',
                    timestamp: Date.now()
                });
            }
        }

        this.healthChecks = results;
        return results;
    }

    /**
     * Get system status
     */
    getSystemStatus() {
        const moduleStats = {};
        
        for (const [name, config] of this.modules) {
            moduleStats[name] = {
                initialized: config.initialized,
                status: config.status,
                initTime: config.initTime,
                lastHealthCheck: config.lastHealthCheck,
                dependencies: config.dependencies
            };
        }

        return {
            isInitialized: this.isInitialized,
            startupTime: this.startupTime,
            totalInitTime: this.startupTime ? Date.now() - this.startupTime : null,
            modulesCount: this.modules.size,
            moduleStats,
            diagnostics: this.diagnostics,
            healthChecks: Object.fromEntries(this.healthChecks)
        };
    }

    /**
     * Get detailed system statistics
     */
    getDetailedStats() {
        const stats = this.getSystemStatus();
        
        for (const [name, config] of this.modules) {
            if (config.instance?.getStats) {
                try {
                    stats.moduleStats[name].details = config.instance.getStats();
                } catch (error) {
                    stats.moduleStats[name].statsError = error.message;
                }
            }
        }

        return stats;
    }

    /**
     * Run system diagnostics
     */
    async runDiagnostics() {
        const diagnostics = {
            timestamp: Date.now(),
            system: this.getSystemStatus(),
            modules: {},
            issues: [],
            recommendations: []
        };

        for (const [name, config] of this.modules) {
            const moduleDiag = {
                name,
                status: config.status,
                initialized: config.initialized,
                initTime: config.initTime,
                dependencies: config.dependencies
            };

            for (const depName of config.dependencies) {
                const depModule = this.modules.get(depName);
                if (!depModule?.initialized) {
                    diagnostics.issues.push({
                        type: 'dependency',
                        module: name,
                        message: `Dependency '${depName}' not properly initialized`
                    });
                }
            }

            if (!config.initialized && this.isInitialized) {
                diagnostics.issues.push({
                    type: 'initialization',
                    module: name,
                    message: 'Module not initialized despite system being ready'
                });
            }

            diagnostics.modules[name] = moduleDiag;
        }

        await this._runHealthChecks();
        
        for (const [name, healthResult] of this.healthChecks) {
            if (healthResult.status === 'unhealthy') {
                diagnostics.issues.push({
                    type: 'health',
                    module: name,
                    message: `Health check failed: ${healthResult.error}`
                });
            }
        }

        if (diagnostics.issues.length === 0) {
            diagnostics.recommendations.push('System is operating normally');
        } else {
            diagnostics.recommendations.push('Review and resolve identified issues');
            if (diagnostics.issues.some(i => i.type === 'dependency')) {
                diagnostics.recommendations.push('Check module dependencies and initialization order');
            }
        }

        return diagnostics;
    }

    /**
     * @private
     */
    _initializeDiagnostics() {
        const levels = ['errors', 'warnings', 'info'];
        levels.forEach(level => {
            if (!Array.isArray(this.diagnostics[level])) {
                this.diagnostics[level] = [];
            }
        });
    }

    /**
     * @private
     */
    _addDiagnostic(level, message) {
        const levelMap = { error: 'errors', warning: 'warnings', info: 'info' };
        const levelKey = levelMap[level] || 'info';
        
        const diagnostic = { level, message, timestamp: Date.now() };
        this.diagnostics[levelKey].push(diagnostic);
        
        if (this.diagnostics[levelKey].length > 100) {
            this.diagnostics[levelKey].shift();
        }
    }

    /**
     * @param {string} name
     */
    getModule(name) {
        return this.modules.get(name)?.instance || null;
    }

    /**
     * @param {string} name
     */
    isModuleReady(name) {
        return this.modules.get(name)?.initialized || false;
    }
}

const systemIntegrator = new SystemIntegrator();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SystemIntegrator;
}

if (typeof window !== 'undefined') {
    window.SystemIntegrator = SystemIntegrator;
    window.systemIntegrator = systemIntegrator;
}
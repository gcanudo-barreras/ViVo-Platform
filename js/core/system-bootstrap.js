/**
 * ViVo System Bootstrap - Oncological data processing web-app
 * Optimized system initialization and module registration
 */

(function() {
    'use strict';

    if (typeof window === 'undefined') return;

    const MODULES = [
        { name: 'eventManager', instance: 'eventManager', priority: 100, deps: [], 
          health: () => ({ ...window.eventManager.getMetrics(), isHealthy: window.eventManager.getMetrics().errors < 10 }) },
        { name: 'configManager', instance: 'DOMConfigurationManager', priority: 95, deps: [], wrapper: true,
          health: () => ({ ...window.DOMConfigurationManager.getAllConfigurations(), hasConfigurations: true, isHealthy: true }) },
        { name: 'modalManager', instance: 'modalManager', priority: 85, deps: ['eventManager'],
          health: () => ({ ...window.modalManager.getStats(), isHealthy: window.modalManager.getStats().totalModals > 0 }) },
        { name: 'uiManager', instance: 'uiManager', priority: 80, deps: ['eventManager', 'modalManager'],
          health: () => ({ initialized: true, isHealthy: typeof window.uiManager.initialize === 'function' }) },
        { name: 'appController', instance: 'appController', priority: 75, deps: ['eventManager', 'configManager'],
          health: () => ({ initialized: true, isHealthy: typeof window.appController.initialize === 'function' }) },
        { name: 'reportGenerator', instance: 'reportGenerator', priority: 70, deps: ['configManager'],
          health: () => ({ hasTemplates: true, isHealthy: typeof window.reportGenerator.generateHTML === 'function' }) },
        { name: 'exportManager', instance: 'exportManager', priority: 65, deps: ['configManager'],
          health: () => ({ ...window.exportManager.getManagerStats(), isHealthy: window.exportManager.getManagerStats().exportMethods.length > 0 }) }
    ];

    const REQUIRED = ['SystemIntegrator', 'EventManager', 'DOMConfigurationManager', 'ModalSystem'];

    function createConfigWrapper() {
        return {
            initialize: () => Promise.resolve(),
            getAllConfigurations: () => window.DOMConfigurationManager.getAllConfigurations(),
            getVersion: () => window.DOMConfigurationManager.getVersion(),
            isDebugMode: () => window.DOMConfigurationManager.isDebugMode()
        };
    }

    function registerModule(integrator, module) {
        const instance = window[module.instance];
        if (!instance) return;

        const moduleInstance = module.wrapper ? createConfigWrapper() : instance;
        integrator.registerModule(module.name, moduleInstance, {
            priority: module.priority,
            dependencies: module.deps,
            healthCheck: module.health
        });
    }

    async function initializeViVoSystem() {
        if (!window.systemIntegrator) throw new Error('SystemIntegrator not available');

        const integrator = window.systemIntegrator;
        MODULES.forEach(module => registerModule(integrator, module));

        const success = await integrator.initialize();
        
        if (success) {
            const diagnostics = await integrator.runDiagnostics();
            
            setInterval(async () => {
                const healthResults = await integrator._runHealthChecks();
                const unhealthy = Array.from(healthResults.entries())
                    .filter(([, result]) => result.status === 'unhealthy');
                if (unhealthy.length > 0) {
                    console.warn('Unhealthy modules:', unhealthy.map(([name]) => name));
                }
            }, 300000);

            if (window.eventManager) {
                window.eventManager.emit('system:ready', {
                    timestamp: Date.now(),
                    diagnostics
                });
            }

            if (window.DOMConfigurationManager?.isDebugMode()) {
                window.vivoDebug = {
                    systemStatus: () => integrator.getSystemStatus(),
                    diagnostics: () => integrator.runDiagnostics(),
                    stats: () => integrator.getDetailedStats(),
                    healthCheck: () => integrator._runHealthChecks()
                };
            }
        }
    }

    function checkDependencies() {
        return !REQUIRED.some(module => !window[module]);
    }

    function initialize() {
        if (checkDependencies()) {
            initializeViVoSystem().catch(console.error);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(initialize, 100));
    } else {
        setTimeout(initialize, 100);
    }

    window.initializeViVoSystem = initializeViVoSystem;

})();
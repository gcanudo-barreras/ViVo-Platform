/**
 * ViVo Tutorial System - Consolidated configuration, steps, UI and manager
 */

let tutorialStep = 0;
let tutorialMode = false;
let tutorialWaitingForUser = false;
let tutorialScrollTarget = null;
const TUTORIAL_SELECTORS = {
    fileInput: '#fileInput',
    fileLabel: '.file-input-label',
    weightsFileInput: '#weightsFileInput',
    analyzeBtn: '#analyzeBtn',
    predictionsBtn: '#predictionsBtn',
    tgrBtn: '#tgrBtn',
    reportBtn: '#reportBtn',
    exportBtn: '#exportBtn',
    resultsSection: '#results',
    predictionForm: '#predictionForm',
    tgrMatrices: '.matrices-container'
};


const TUTORIAL_DATASET = [
    'Group;Animal;11;14;18;21;25;32;39;Tumor_Weight',
    'Control;E4C1;77;137.6;196;334.6;503.6;1635.9;;0.4',
    'Control;E4C2;135.7;263.9;344.7;490.8;777.7;1145.9;;0.5',
    'Control;E4C3;292;710.7;813.2;1362.9;1865.2;2274.6;;0.7',
    'Control;E4C4;327.5;521.2;900.2;1382.6;1704.2;3631.2;;0.9',
    'Control;E4C5;126.9;145.3;182.6;275.2;298.5;521.2;727.8;0.6',
    'Control;E4C6;386;604.5;1298.2;1575.7;2143.3;;;0.9',
    'Control;E4C7;114.7;166.5;195.3;350.4;476.7;1180.7;;0.3',
    'Control;E4C8;176.6;283.7;465.8;1016.1;1147.3;1853.8;;0.4',
    'Control;E4C9;226.1;385.4;568.6;874.6;1121.5;1760.4;;0.6',
    'Control;E4C10;128.4;269;369.7;658.5;851.9;1681.2;;0.6',
    'Treatment;E4T1;315.8;444.9;526.9;579.8;903.1;1500.4;;0.5',
    'Treatment;E4T2;161.8;174.9;229.9;270;349.8;482.9;954.0;0.35',
    'Treatment;E4T3;242.8;363.6;421.3;523.2;607.5;731.5;;0.4',
    'Treatment;E4T4;258.6;349;382.9;464;482.1;638.5;893.1;0.4',
    'Treatment;E4T5;336.8;401.6;388.8;510.5;590.8;660.1;480.5;0.3',
    'Treatment;E4T6;131.3;171;192.6;267.2;389;979.3;710.5;0.5',
    'Treatment;E4T7;139.4;244.3;297.4;363.7;546.8;1119.5;465.6;0.5',
    'Treatment;E4T8;24.2;39.3;42.5;31.6;32.3;163.6;77.4;0.05',
    'Treatment;E4T9;180.7;207.6;212.9;248.5;302.2;353.2;363.6;0.3',
    'Treatment;E4T10;398.4;543.8;590.6;605;659.5;957.2;;0.4',
    'Treatment;E4T11;315.8;444.9;526.9;579.8;903.1;1500.4;;0.4'
];


const tutorialSteps = [
    {
        target: '.homogeneity-modal .btn, .homogeneity-modal button',
        message: 'Welcome to ViVo Tutorial! The system has evaluated the experimental model homogeneity. Click "Review Data" or "Continue Anyway" to proceed.',
        action: 'click',
        waitForClick: true,
        requiresGenerated: true
    },
    {
        target: '#continueAnalysisFromReviewBtn, button[id="continueAnalysisFromReviewBtn"]',
        message: 'Perfect! This modal shows the CSV data preview. Here you can review the dataset structure and values. Click "Continue Analysis" to proceed with the tutorial. WARNING: "Cancel Dataset" will reload the entire page!',
        action: 'click',
        waitForClick: true,
        skipIfNotFound: true,
        isConditional: true
    },
    {
        target: '#dataType, select[id="dataType"]',
        message: 'First, configure your analysis settings. For the tutorial dataset, select "BLI (Bioluminescence)" as the Data Type - this matches the loaded sample data.',
        action: 'change',
        waitForChange: true
    },
    {
        target: '#r2Threshold, input[id="r2Threshold"]',
        message: 'Set the R² Threshold. This determines the minimum correlation coefficient for including animals in analysis. Try changing the value.',
        action: 'input',
        waitForInput: false // Accept any value
    },
    {
        target: '#outlierConfig, select[id="outlierConfig"]',
        message: 'Configure the Outlier Detection method. Select "Auto (adjusts to sample size)" - this is recommended as it automatically optimizes detection based on your dataset size.',
        action: 'change',
        waitForChange: true
    },
    {
        target: '#outlierFiltering, select[id="outlierFiltering"]',
        message: 'Select the Anomaly Filtering Level. This controls how aggressively the system filters unusual data points.',
        action: 'change',
        waitForChange: true
    },
    {
        target: '.btn[onclick="analyzeData()"], button[onclick="analyzeData()"]',
        message: 'Excellent! Now that you have configured the analysis settings, click "Analyze Data" to process the dataset.',
        action: 'click',
        waitForClick: true,
        nextOnClick: true
    },
    {
        target: '.intelligent-outlier-analysis-card, .result-card.intelligent-outlier-analysis-card',
        message: 'Great! The analysis is complete. Scroll down to find the Intelligent Outlier Analysis panel with the complete anomaly summary.',
        action: 'scroll',
        waitForScroll: true,
        requiresGenerated: true
    },
    {
        target: '#cyclicBtn, button[id="cyclicBtn"]',
        message: 'This is the Dual Analysis Framework showing "All Data" mode. Click the cyclic button to switch between filtering modes.',
        action: 'click',
        waitForClick: true
    },
    {
        target: '#cyclicBtn, button[id="cyclicBtn"]',
        message: 'Now in "Filtered Animals" mode - this discards complete animals with outliers. Click again for "Filtered Points" mode.',
        action: 'click',
        waitForClick: true
    },
    {
        target: '#cyclicBtn, button[id="cyclicBtn"]',
        message: 'Now in "Filtered Points" mode - this removes individual problematic data points while keeping animals with 3+ time points. Click again to complete the cycle.',
        action: 'click',
        waitForClick: true
    },
    {
        target: '.homogeneity-comparison-content, .result-card.homogeneity-comparison-card',
        message: 'Examine the Model Homogeneity Comparison. This shows homogeneity before and after filtering, helping you validate your outlier detection settings.',
        action: 'scroll',
        waitForScroll: true,
        requiresGenerated: true
    },
    {
        target: '.statistical-comparison-card, .result-card.statistical-comparison-card',
        message: 'Excellent! Now review the Statistical Comparison of Growth Rates. This shows pairwise comparisons between treatment groups using Mann-Whitney U test.',
        action: 'scroll',
        waitForScroll: true,
        requiresGenerated: true
    },
    {
        target: '.exponential-growth-curves-card, .result-card.exponential-growth-curves-card',
        message: 'Perfect! Here you can see the Exponential Growth Curves visualization. This interactive chart shows the exponential fit for each treatment group according to the model y = a·e^(r·t), allowing you to compare growth patterns visually.',
        action: 'scroll',
        waitForScroll: true,
        requiresGenerated: true
    },
    {
        target: '#tgrBtn, button[onclick="generateGrowthMatrices()"]',
        message: 'Outstanding! You have explored the analysis results. Now click "TGR Matrices" to analyze growth rates between time periods.',
        action: 'click', 
        waitForClick: true,
        nextOnClick: false,
        requiresGenerated: false
    },
    {
        target: '.tgr-matrix td, .matrix-cell, .tgr-table td',
        message: 'Great! TGR Matrices are now displayed. Click on any cell in the first matrix to select a time period for comparison.',
        action: 'click',
        waitForClick: true,
        requiresGenerated: true
    },
    {
        target: '.tgr-matrix td, .matrix-cell, .tgr-table td',
        message: 'Perfect! Now click on the corresponding cell (same position) in the second matrix to compare the same time period between different groups. This will show the statistical comparison below.',
        action: 'click',
        waitForClick: true,
        requiresGenerated: true
    },
    {
        target: '.tgr-comparison-result',
        message: 'Perfect! Here you can see the statistical comparison results for the selected time periods. This analysis helps identify significant differences in growth rates between different intervals.',
        action: 'scroll',
        waitForScroll: true,
        requiresGenerated: true
    },
    {
        target: '.btn.compare-all, button.compare-all',
        message: 'Excellent! Now click "Compare All Intervals" to perform comprehensive statistical comparisons between all possible time intervals across both matrices. This provides a complete overview of growth rate differences.',
        action: 'click',
        waitForClick: true,
        requiresGenerated: true
    },
    {
        target: '#predictionsBtn, button[onclick="togglePredictionForm()"]', 
        message: 'Excellent! Click "Predictions" to explore tumor growth forecasting. The system will automatically detect the tumor weight data and enable batch prediction.',
        action: 'click',
        waitForClick: true,
        nextOnClick: true
    },
    {
        target: '#batchPredictDay, input[type="number"], #predictionDayInput, .prediction-form input[type="number"]',
        message: 'Great! Enter 39 in the day input field to predict tumor volumes for day 39. Since actual tumor weights were measured on different days, the software standardizes them to allow a consistent comparison with your prediction.',
        action: 'input',
        waitForInput: true,
        expectedValue: '39',
        requiresGenerated: true
    },
    {
        target: '#batchPredictBtn, button[id="batchPredictBtn"]',
        message: 'Perfect! Click the batch prediction button to generate forecasts and statistical comparison with tumor weights.',
        action: 'click',
        waitForClick: true,
        requiresGenerated: true
    },
    {
        target: '.prediction-validation-panel',
        message: 'Excellent! Here you can see the Prediction Validation panel, which provides a summary of the prediction results including the average prediction error. This gives you an overall assessment of model accuracy.',
        action: 'scroll',
        waitForScroll: true,
        requiresGenerated: true
    },
    {
        target: '.prediction-statistical-comparison-table',
        message: 'Excellent! Here you can see the statistical comparisons between experimental-predicted hybrid groups.',
        action: 'scroll',
        waitForScroll: true,
        requiresGenerated: true
    },
    {
        target: '.individual-predictions-table',
        message: 'Outstanding! This table shows individual predictions for each animal, including the specific prediction and interpolation measurement error. You can observe the precision of the model for each subject.',
        action: 'scroll',
        waitForScroll: true,
        requiresGenerated: true
    },
    {
        target: '#reportBtn, button[onclick="generateReport()"]',
        message: 'Finally, click "Generate Report" to create a comprehensive PDF with all your analyses.',
        action: 'click',
        waitForClick: true,
        nextOnClick: true
    },
    {
        target: 'body',
        message: 'Tutorial Complete! The PDF report has been generated and can be opened, saved, or printed from your browser. You now know how to use all major ViVo features! The page will reload in 5 seconds to reset the application.',
        action: 'complete',
        final: true
    }
];

let tutorialEventListeners = [];
let tutorialProgressing = false;

function highlightElement(selector, interactionType = null) {
    requestAnimationFrame(() => {
        const previousHighlights = document.querySelectorAll('.tutorial-highlight');
        previousHighlights.forEach(el => {
            el.className = el.className
                .replace(/\b(tutorial-highlight|clickable|tutorial-waiting-click|tutorial-waiting-scroll|tutorial-waiting-input)\b/g, '')
                .trim();
            if (el.style.cursor) el.style.cursor = '';
            if (el.style.willChange) el.style.willChange = '';
        });
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            const classesToAdd = ['tutorial-highlight'];
            
            if (interactionType === 'click') {
                classesToAdd.push('clickable', 'tutorial-waiting-click');
            } else if (interactionType === 'scroll') {
                classesToAdd.push('tutorial-waiting-scroll');
            } else if (interactionType === 'input') {
                classesToAdd.push('tutorial-waiting-input');
            }
            element.classList.add(...classesToAdd);
            element.style.willChange = 'transform, box-shadow';
        });
    });
}

function clearHighlights() {
    requestAnimationFrame(() => {
        const elements = document.querySelectorAll('.tutorial-highlight');
        elements.forEach(el => {
            el.className = el.className
                .replace(/\b(tutorial-highlight|clickable|tutorial-waiting-click|tutorial-waiting-scroll|tutorial-waiting-input)\b/g, '')
                .trim();
            if (el.style.cursor) {
                el.style.cursor = '';
            }
            if (el.style.willChange) {
                el.style.willChange = '';
            }
        });
    });
}

function showFixedTutorialNotification() {
    const existingId = 'fixedTutorialNotification';
    const existing = document.getElementById(existingId);
    if (existing) {
        if (typeof removeNotificationAnimated === 'function') {
            removeNotificationAnimated(existing);
        } else {
            existing.remove();
        }
    }
    
    const message = `Tutorial Mode\nPress ESC to skip tutorial`;
    
    if (typeof notificationService !== 'undefined' && notificationService.show) {
        const notification = notificationService.show(message, 'info', 0, 'tutorial-notification fixed-tutorial');
        if (notification) {
            notification.id = existingId;
            notification.style.whiteSpace = 'pre-line';
            notification.style.fontSize = '16px';
            notification.style.fontWeight = '500';
        }
        return notification;
    } else {
        const notification = document.createElement('div');
        notification.id = existingId;
        notification.className = 'notification info tutorial-notification fixed-tutorial';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #d1ecf1;
            color: #0c5460;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 450;
            border: 1px solid #bee5eb;
            white-space: pre-line;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        return notification;
    }
}

/**
 * Waits for element to appear in DOM with timeout using MutationObserver for better performance
 */
function waitForElement(selector, callback, maxWait = 5000) {
    const element = document.querySelector(selector);
    if (element) {
        callback();
        return true;
    }
    
    let timeoutId;
    let observer;
    
    observer = new MutationObserver((mutations) => {
        const el = document.querySelector(selector);
        if (el) {
            observer.disconnect();
            clearTimeout(timeoutId);
            callback();
        }
    });
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    timeoutId = setTimeout(() => {
        observer.disconnect();
        notificationService.show('Tutorial element not found, moving to next step...', 'warning', 0, 'tutorial-notification');
        setTimeout(() => {
            tutorialStep++;
            if (window.TutorialManager) {
                window.TutorialManager.showNextStep();
            }
        }, 500);
    }, maxWait);
    
    return false;
}

let tutorialEscHandler = null;

function setupTutorialKeyListeners() {
    const lifecycle = window.TutorialManager?.lifecycle;
    
    const escHandler = (e) => {
        if (e.key === 'Escape' && tutorialMode) {
            e.preventDefault();
            const skipConfirm = confirm('Skip tutorial? This will end the guided walkthrough.');
            if (skipConfirm) {
                if (window.TutorialManager) {
                    window.TutorialManager.complete();
                }
            }
        }
    };
    
    if (lifecycle && lifecycle.addListener) {
        lifecycle.addListener(document, 'keydown', escHandler);
    } else {
        document.addEventListener('keydown', escHandler);
        tutorialEventListeners.push({ element: document, event: 'keydown', handler: escHandler });
    }
}

function scrollToElement(selector) {
    const element = document.querySelector(selector);
    if (element) {
        element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'nearest'
        });
    }
}

function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}


function setupStepInteraction(step) {
    tutorialWaitingForUser = true;
    
    switch(step.action) {
        case 'click':
            setupClickListener(step);
            break;
        case 'scroll':
            setupScrollListener(step);
            break;
        case 'input':
            setupInputListener(step);
            break;
        case 'change':
            setupChangeListener(step);
            break;
        case 'complete':
            tutorialWaitingForUser = false;
            setTimeout(() => {
                if (window.TutorialManager) {
                    window.TutorialManager.complete();
                }
            }, 5000);
            break;
    }
}

function setupClickListener(step) {
    const elements = document.querySelectorAll(step.target);
    const clickHandler = (e) => {
        if (tutorialWaitingForUser) {
            if (tutorialStep === 0) {
                tutorialWaitingForUser = false;
                clearHighlights();
                elements.forEach(el => el.removeEventListener('click', clickHandler));
                
                if (e.target.textContent.includes('Review Data')) {
                    setTimeout(() => {
                        if (window.TutorialManager) {
                            window.TutorialManager.proceedToNext();
                        }
                    }, 1000);
                    return;
                } else {
                    setTimeout(() => {
                        if (window.TutorialManager) {
                            window.TutorialManager.jumpToStep(2);
                        }
                    }, 1000);
                    return;
                }
            }
            
            tutorialWaitingForUser = false;
            clearHighlights(); // Clear click indicators immediately
            if (tutorialStep === 14 && (e.target.id === 'tgrBtn' || e.target.onclick?.toString().includes('generateGrowthMatrices'))) {
                setTimeout(() => {
                    notificationService.show('Great! TGR Matrices have been generated successfully. Now you can interact with the matrix cells to see statistical comparisons.', 'success', 0, 'tutorial-notification');
                    setTimeout(() => {
                        if (window.TutorialManager) {
                            window.TutorialManager.proceedToNext();
                        }
                    }, 3000);
                }, 1500);
                return;
            }
            if (tutorialStep === 1 && (e.target.id === 'continueAnalysisFromReviewBtn' || e.target.textContent.includes('Continue Analysis'))) {
                setTimeout(() => {
                    document.body.style.overflow = 'visible';
                }, 200);
            }
            elements.forEach(el => el.removeEventListener('click', clickHandler));
            setTimeout(() => {
                if (window.TutorialManager) {
                    window.TutorialManager.proceedToNext();
                }
            }, 1000);
        }
    };
    
    elements.forEach(el => {
        addTutorialEventListener(el, 'click', clickHandler);
        el.style.cursor = 'pointer';
    });
}

function setupScrollListener(step) {
    const targetElements = document.querySelectorAll(step.target);
    
    if (targetElements.length > 0) {
        targetElements[0].scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'nearest'
        });
        const clickHandler = (e) => {
            if (tutorialWaitingForUser) {
                tutorialWaitingForUser = false;
                clearHighlights();
                targetElements.forEach(el => el.removeEventListener('click', clickHandler));
                setTimeout(() => {
                    if (window.TutorialManager) {
                        window.TutorialManager.proceedToNext();
                    }
                }, 1000);
            }
        };
        
        targetElements.forEach(el => {
            el.addEventListener('click', clickHandler);
            el.style.cursor = 'pointer';
        });
    }
}

function setupInputListener(step) {
    const elements = document.querySelectorAll(step.target);
    const inputHandler = (e) => {
        if (tutorialWaitingForUser) {
            const isValidTarget = Array.from(elements).includes(e.target);
            if (isValidTarget) {
                const inputValue = e.target.value.toString().trim();
                const valueAccepted = step.waitForInput === false || 
                                    (step.expectedValue && parseFloat(inputValue) == parseFloat(step.expectedValue)) ||
                                    (!step.expectedValue && inputValue.length > 0);
                
                if (valueAccepted) {
                    tutorialWaitingForUser = false;
                    clearHighlights();
                    setTimeout(() => {
                        if (window.TutorialManager) {
                            window.TutorialManager.proceedToNext();
                        }
                    }, 1000);
                }
            }
        }
    };
    
    elements.forEach(el => {
        addTutorialEventListener(el, 'input', inputHandler);
        addTutorialEventListener(el, 'keyup', inputHandler);
        if (el.type === 'number' || el.tagName.toLowerCase() === 'input') {
            el.focus();
        }
    });
}

function setupChangeListener(step) {
    const elements = document.querySelectorAll(step.target);
    const changeHandler = (e) => {
        if (tutorialWaitingForUser) {
            const isValidTarget = Array.from(elements).includes(e.target);
            if (isValidTarget) {
                tutorialWaitingForUser = false;
                clearHighlights();
                setTimeout(() => {
                    if (window.TutorialManager) {
                        window.TutorialManager.proceedToNext();
                    }
                }, 1000);
            }
        }
    };
    const clickHandler = (e) => {
        if (tutorialWaitingForUser && e.target.tagName.toLowerCase() === 'select') {
            const isValidTarget = Array.from(elements).includes(e.target);
            if (isValidTarget) {
                setTimeout(() => {
                    if (tutorialWaitingForUser) {
                        tutorialWaitingForUser = false;
                        clearHighlights();
                        setTimeout(() => {
                            if (window.TutorialManager) {
                                window.TutorialManager.proceedToNext();
                            }
                        }, 1000);
                    }
                }, 200);
            }
        }
    };
    
    elements.forEach(el => {
        addTutorialEventListener(el, 'change', changeHandler);
        addTutorialEventListener(el, 'click', clickHandler);
    });
}

function addTutorialEventListener(element, event, handler) {
    element.addEventListener(event, handler);
    tutorialEventListeners.push({ element, event, handler });
}

function clearAllTutorialEventListeners() {
    // Use requestAnimationFrame to batch DOM operations for better performance
    requestAnimationFrame(() => {
        tutorialEventListeners.forEach(({ element, event, handler }) => {
            if (element && element.removeEventListener) {
                element.removeEventListener(event, handler);
            }
        });
        tutorialEventListeners.length = 0; // More efficient array clearing
        if (tutorialEscHandler) {
            document.removeEventListener('keydown', tutorialEscHandler);
            tutorialEscHandler = null;
        }
    });
}

function restoreOriginalHandlers(analyze, predictions, tgr, report) {
    window.analyzeData = analyze;
    if (domCache.get('predictionsBtn')) {
        domCache.get('predictionsBtn').onclick = predictions;
    }
    if (domCache.get('tgrBtn')) {
        domCache.get('tgrBtn').onclick = tgr;
    }
    if (domCache.get('reportBtn')) {
        domCache.get('reportBtn').onclick = report;
    }
}


class TutorialManager {
    constructor() {
        this.step = 0;
        this.mode = false;
        this.waitingForUser = false;
        this.scrollTarget = null;
        this.progressing = false;
        this.eventListeners = [];
        
        this.lifecycle = window.LifecycleManager ? 
            window.LifecycleManager.getLifecycle('TutorialSystem') : 
            null;
    }

    async start() {
        if (typeof closeAllModalsAndBanners === 'function') {
            closeAllModalsAndBanners();
            await new Promise(resolve => setTimeout(resolve, 400));
        } else if (window.modalManager) {
            window.modalManager.hide('help');
        }
        
        this.step = 0;
        this.mode = true;
        tutorialStep = 0;
        tutorialMode = true;
        
        await this.loadSampleData();
        
        this.showSteps();
        
        if (typeof setupTutorialHandlers === 'function') {
            setupTutorialHandlers();
        }
        if (typeof setupTutorialKeyListeners === 'function') {
            setupTutorialKeyListeners();
        }
        if (typeof showFixedTutorialNotification === 'function') {
            showFixedTutorialNotification();
        }
    }

    showSteps() {
        this.step = 0;
        tutorialStep = 0;
        
        setTimeout(() => {
            if (typeof evaluateAndShowHomogeneity === 'function') {
                evaluateAndShowHomogeneity();
            }
            setTimeout(() => {
                this.showNextStep();
            }, 1000);
        }, 500);
    }

    showNextStep() {
        if (this.progressing) {
            return;
        }
        
        if (this.step < tutorialSteps.length) {
            const step = tutorialSteps[this.step];
            
            if (step.requiresGenerated) {
                if (!this.waitForElement(step.target, () => this.showCurrentStep())) {
                    return;
                }
                return;
            }
            
            this.showCurrentStep();
        } else {
            this.complete();
        }
    }

    showCurrentStep() {
        const step = tutorialSteps[this.step];
        
        if (step.isConditional && step.skipIfNotFound) {
            const elements = document.querySelectorAll(step.target);
            if (elements.length === 0) {
                this.step++;
                tutorialStep = this.step;
                this.showNextStep();
                return;
            }
        }
        
        const elements = document.querySelectorAll(step.target);
        if (elements.length === 0) {
            console.warn(`Tutorial step ${this.step}: No elements found for selector "${step.target}"`);
            if (typeof notificationService !== 'undefined') {
                notificationService.show(`Tutorial step skipped - element not found. Moving to next step...`, 'warning', 0, 'tutorial-notification');
            }
            setTimeout(() => {
                this.step++;
                tutorialStep = this.step;
                this.showNextStep();
            }, 1500);
            return;
        }
        
        if (typeof clearHighlights === 'function') {
            clearHighlights();
        }
        
        if (typeof highlightElement === 'function') {
            highlightElement(step.target, step.action);
        }
        
        const message = step.message;
        if (typeof notificationService !== 'undefined') {
            notificationService.show(message, 'info', 0, 'tutorial-notification');
        }
        
        if (typeof setupStepInteraction === 'function') {
            setupStepInteraction(step);
        }
    }

    proceedToNext() {
        if (this.progressing) {
            return;
        }
        this.progressing = true;
        
        const existingTutorialNotifications = document.querySelectorAll('.notification.tutorial-notification');
        
        if (typeof clearAllTutorialEventListeners === 'function') {
            clearAllTutorialEventListeners();
        }
        
        this.step++;
        tutorialStep = this.step;
        
        if (existingTutorialNotifications.length > 0 && typeof removeMultipleNotificationsAnimated === 'function') {
            removeMultipleNotificationsAnimated(Array.from(existingTutorialNotifications), () => {
                setTimeout(() => {
                    this.progressing = false;
                    this.showNextStep();
                }, 100); // Small buffer after animations
            });
        } else {
            setTimeout(() => {
                this.progressing = false;
                this.showNextStep();
            }, 100);
        }
    }

    jumpToStep(targetStep) {
        if (this.progressing) {
            return;
        }
        this.progressing = true;
        
        const existingTutorialNotifications = document.querySelectorAll('.notification.tutorial-notification');
        
        if (typeof clearAllTutorialEventListeners === 'function') {
            clearAllTutorialEventListeners();
        }
        
        this.step = targetStep;
        tutorialStep = this.step;
        
        if (existingTutorialNotifications.length > 0 && typeof removeMultipleNotificationsAnimated === 'function') {
            removeMultipleNotificationsAnimated(Array.from(existingTutorialNotifications), () => {
                setTimeout(() => {
                    this.progressing = false;
                    this.showNextStep();
                }, 100); // Small buffer after animations
            });
        } else {
            setTimeout(() => {
                this.progressing = false;
                this.showNextStep();
            }, 100);
        }
    }

    complete() {
        if (typeof notificationService !== 'undefined') {
            notificationService.show('Tutorial completed! You can now explore ViVo with your own data.', 'success', 0, 'tutorial-notification');
        }
        
        if (typeof clearHighlights === 'function') {
            clearHighlights();
        }
        
        this.mode = false;
        this.waitingForUser = false;
        tutorialMode = false;
        tutorialWaitingForUser = false;
        
        const fixedNotification = document.getElementById('fixedTutorialNotification');
        if (fixedNotification) {
            if (typeof notificationService !== 'undefined' && notificationService.remove) {
                notificationService.remove(fixedNotification);
            } else if (typeof removeNotificationAnimated === 'function') {
                removeNotificationAnimated(fixedNotification);
            } else {
                fixedNotification.remove();
            }
        }
        
        if (typeof clearAllTutorialEventListeners === 'function') {
            clearAllTutorialEventListeners();
        }
        
        this.toggleFileInputs(false);
        
        if (typeof notificationService !== 'undefined') {
            notificationService.show('Tutorial completed! The page will reload in 3 seconds...', 'success');
        }
        
        setTimeout(() => {
            location.reload();
        }, 3000);
    }

    async loadSampleData() {
        const csvData = this.getOfficialTemplateDataset();
        
        if (typeof Papa !== 'undefined') {
            const parsedData = Papa.parse(csvData.join('\n'), {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                delimiter: ';'
            });
            
            const filteredData = parsedData.data.filter(row => row && Object.keys(row).length > 0);
            
            if (typeof window.AppState !== 'undefined') {
                window.AppState.rawData = filteredData;
            }
            
            window.rawData = filteredData;
            
            if (typeof window.updateLocalRawData === 'function') {
                window.updateLocalRawData(filteredData);
            }
        }
        
        // Ensure PredictionService detects the Tumor_Weight column
        if (typeof window.predictionService !== 'undefined' && window.predictionService.setTumorWeightStatus) {
            window.predictionService.setTumorWeightStatus(true);
        }
        
        if (typeof notificationService !== 'undefined') {
            notificationService.show('Tutorial dataset loaded: 22 animals (10 Control, 12 Treatment) with tumor weights', 'success', 4000, 'tutorial-notification');
        }
        
        this.toggleFileInputs(true);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!this.mode && typeof evaluateAndShowHomogeneity === 'function') {
            setTimeout(() => {
                evaluateAndShowHomogeneity();
            }, 1500);
        }
    }

    getOfficialTemplateDataset() {
        return TUTORIAL_DATASET || [
            'Group;Animal;11;14;18;21;25;32;39;Tumor_Weight',
            'Control;E4C1;77;137.6;196;334.6;503.6;1635.9;;0.4',
            'Control;E4C2;135.7;263.9;344.7;490.8;777.7;1145.9;;0.5',
            'Control;E4C3;292;710.7;813.2;1362.9;1865.2;2274.6;;0.7',
            'Control;E4C4;327.5;521.2;900.2;1382.6;1704.2;3631.2;;0.9',
            'Control;E4C5;126.9;145.3;182.6;275.2;298.5;521.2;727.8;0.6',
            'Control;E4C6;386;604.5;1298.2;1575.7;2143.3;;;0.9',
            'Control;E4C7;114.7;166.5;195.3;350.4;476.7;1180.7;;0.3',
            'Control;E4C8;176.6;283.7;465.8;1016.1;1147.3;1853.8;;0.4',
            'Control;E4C9;226.1;385.4;568.6;874.6;1121.5;1760.4;;0.6',
            'Control;E4C10;128.4;269;369.7;658.5;851.9;1681.2;;0.6',
            'Treatment;E4T1;315.8;444.9;526.9;579.8;903.1;1500.4;;0.5',
            'Treatment;E4T2;161.8;174.9;229.9;270;349.8;482.9;954.0;0.35',
            'Treatment;E4T3;242.8;363.6;421.3;523.2;607.5;731.5;;0.4',
            'Treatment;E4T4;258.6;349;382.9;464;482.1;638.5;893.1;0.4',
            'Treatment;E4T5;336.8;401.6;388.8;510.5;590.8;660.1;480.5;0.3',
            'Treatment;E4T6;247.9;324.1;401.4;547.3;621.1;846.9;;0.4',
            'Treatment;E4T7;292.8;380.4;452.9;596.2;821;1023.4;;0.4',
            'Treatment;E4T8;169.9;298.2;403.8;574.1;817.6;1215.6;;0.5',
            'Treatment;E4T9;234.9;397.8;530.5;677.6;889.8;1406.4;;0.6',
            'Treatment;E4T10;209.8;360.2;489.3;711.8;875.2;1392.9;;0.5',
            'Treatment;E4T11;280.1;442.6;608.5;858.3;1210.1;1726.8;;0.6'
        ];
    }

    waitForElement(selector, callback, maxWait = 5000) {
        return waitForElement(selector, callback, maxWait);
    }

    toggleFileInputs(disable = true) {
        const fileLabel = document.querySelector('.file-input-label');
        const fileInput = domCache.get('fileInput');
        const weightsFileInput = domCache.get('weightsFileInput');
        
        if (fileLabel) {
            if (disable) {
                fileLabel.textContent = 'Tutorial Dataset Loaded (22 animals)';
                fileLabel.classList.add('file-loaded');
                fileLabel.style.pointerEvents = 'none';
                fileLabel.style.opacity = '0.6';
                fileLabel.setAttribute('title', 'File upload disabled during tutorial');
            } else {
                fileLabel.style.pointerEvents = '';
                fileLabel.style.opacity = '';
                fileLabel.removeAttribute('title');
            }
        }
        
        if (fileInput) fileInput.disabled = disable;
        if (weightsFileInput) weightsFileInput.disabled = disable;
    }

    isActive() {
        return this.mode;
    }

    getCurrentStep() {
        return this.step;
    }

    cleanup() {
        this.mode = false;
        this.waitingForUser = false;
        tutorialMode = false;
        tutorialWaitingForUser = false;
        
        if (typeof clearHighlights === 'function') {
            clearHighlights();
        }
        
        if (this.lifecycle && this.lifecycle.destroy) {
            this.lifecycle.destroy();
            this.lifecycle = window.LifecycleManager ? 
                window.LifecycleManager.getLifecycle('TutorialSystem') : 
                null;
        }
        
        if (typeof clearAllTutorialEventListeners === 'function') {
            clearAllTutorialEventListeners();
        }
        
        this.toggleFileInputs(false);
    }
}

window.TutorialManager = new TutorialManager();

async function startTutorial() {
    await window.TutorialManager.start();
}

function showTutorialSteps() {
    window.TutorialManager.showSteps();
}

function showNextTutorialStep() {
    window.TutorialManager.showNextStep();
}

function showCurrentTutorialStep() {
    window.TutorialManager.showCurrentStep();
}

function completeTutorial() {
    window.TutorialManager.complete();
}

function proceedTutorial() {
    window.TutorialManager.proceedToNext();
}

async function loadSampleData() {
    await window.TutorialManager.loadSampleData();
}

function getOfficialTemplateDataset() {
    return window.TutorialManager.getOfficialTemplateDataset();
}
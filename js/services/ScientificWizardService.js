// Scientific Setup Wizard for ViVo: In Vivo Metrics

class ScientificWizardService {
    constructor() {
        this.currentStep = 0;
        this.answers = {};
        this.isActive = false;
        this.configuration = null;
        this.cachedElements = {};
        this.stepContentCache = {};
        
        this.buttonStyles = {
            primary: 'background: linear-gradient(45deg, #007bff, #0056b3); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; transition: all 0.3s ease;',
            success: 'background: linear-gradient(45deg, #28a745, #20c997); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; transition: all 0.3s ease;',
            disabled: 'background: rgba(0, 123, 255, 0.5); color: rgba(255, 255, 255, 0.6); border: none; padding: 10px 20px; border-radius: 8px; cursor: not-allowed; transition: all 0.3s ease;',
            back: 'background: rgba(108, 117, 125, 0.8); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1); will-change: transform, opacity; visibility: visible;'
        };
        this.studyPresets = {
            pilot_efficacy: {
                label: 'Pilot Efficacy Study',
                description: 'Initial exploration with small samples (n=5-8 per group)',
                settings: {
                    r2Threshold: 0.75,
                    outlierConfig: 'ultraConservative',
                    outlierFiltering: 'critical'
                },
                rationale: 'Small samples require conservative settings to preserve statistical power',
                references: ['ARRIVE Guidelines 2.0 (Percie du Sert et al., 2020)', 'NC3Rs Guidelines']
            },
            standard_efficacy: {
                label: 'Standard Efficacy Study',
                description: 'Definitive study following established guidelines (n=8-12 per group)',
                settings: {
                    r2Threshold: 0.80,
                    outlierConfig: 'conservative',
                    outlierFiltering: 'criticalAndHigh'
                },
                rationale: 'Balanced configuration between statistical rigor and data inclusion',
                references: ['ARRIVE Guidelines 2.0', 'Common statistical practices in oncology']
            },
            large_cohort: {
                label: 'Large Cohort Study',
                description: 'High statistical power allowing strict filtering (n>12 per group)',
                settings: {
                    r2Threshold: 0.85,
                    outlierConfig: 'moderate',
                    outlierFiltering: 'all'
                },
                rationale: 'Large samples enable stricter criteria without power loss',
                references: ['Statistical best practices', 'Power analysis principles']
            }
        };

        this.endpointPresets = {
            tumor_volume: {
                label: 'Tumor Volume (caliper)',
                description: 'Direct measurement with digital calipers',
                adjustments: { r2Threshold: 0.05 },
                guidance: 'Caliper measurements: R²≥0.80 commonly expected',
                variability: 'Low (~5-10%)',
                references: ['Standard practice in preclinical oncology']
            },
            bioluminescence: {
                label: 'Bioluminescence (IVIS)',
                description: 'BLI signal with inherent technical variability',
                adjustments: { r2Threshold: -0.05 },
                guidance: 'BLI: R²≥0.75 acceptable due to technical variability',
                variability: 'Medium (~10-20%)',
                references: ['Established BLI imaging practices']
            }
        };

        this.modelPresets = {
            xenograft: {
                label: 'Xenograft (immunodeficient)',
                description: 'Human cells in immunodeficient mice',
                adjustments: { outlierConfig: 'conservative' },
                characteristics: 'More predictable growth, lower biological variability',
                considerations: 'Limited immune response, more uniform growth'
            },
            syngeneic: {
                label: 'Syngeneic (immunocompetent)',
                description: 'Murine cells in immunocompetent mice',
                adjustments: { outlierConfig: 'ultraConservative' },
                characteristics: 'Higher variability due to immune response',
                considerations: 'Immune-tumor interaction increases heterogeneity'
            },
            pdx: {
                label: 'PDX (Patient-Derived Xenograft)',
                description: 'Primary human tumor in immunodeficient mouse',
                adjustments: { outlierConfig: 'ultraConservative', r2Threshold: -0.05 },
                characteristics: 'High inter-tumor variability',
                considerations: 'Patient tumor heterogeneity preserved'
            },
            unknown: {
                label: 'Not sure / Standard',
                description: 'Use default balanced configuration',
                adjustments: {},
                characteristics: 'Standard balanced configuration',
                considerations: 'Conservative parameters for maximum inclusion'
            }
        };

        this.steps = [
            {
                id: 'study_type',
                title: 'Study Type',
                subtitle: 'Select the type of oncological study you are analyzing',
                question: 'What type of study did you perform?',
                options: Object.keys(this.studyPresets),
                required: true,
                helpText: 'This selection determines appropriate statistical thresholds for your analysis'
            },
            {
                id: 'endpoint_type',
                title: 'Primary Endpoint',
                subtitle: 'Define the main measurement type of your study',
                question: 'How did you measure tumor growth?',
                options: Object.keys(this.endpointPresets),
                required: true,
                helpText: 'Different measurement methods have distinct levels of technical variability'
            },
            {
                id: 'model_context',
                title: 'Experimental Animal Model',
                subtitle: 'Specify the biological context of your model',
                question: 'What type of tumor model did you use?',
                options: Object.keys(this.modelPresets),
                required: false,
                helpText: 'Model type affects expected variability and filtering criteria'
            },
            {
                id: 'summary',
                title: 'Configuration Summary',
                subtitle: 'Review the scientific configuration generated for your study',
                question: null,
                options: [],
                required: false,
                helpText: 'Optimized configuration based on scientific best practices'
            }
        ];
    }

    start() {
        if (this.isActive) this.resetState();

        this.currentStep = 0;
        this.answers = {};
        this.configuration = null;
        this.isActive = true;
        this.cachedElements = {};

        if (window.modalManager) {
            window.modalManager.show('wizard', { wizard: this });
            this._setupModalCloseHandlers();
        }
        
        if (typeof Logger !== 'undefined') {
            Logger.log('Scientific Setup Wizard started');
        }
    }

    _setupModalCloseHandlers() {
        const cleanupOnClose = () => {
            if (this.isActive) this.resetState();
        };
        
        const modalCloseHandler = (event) => {
            if ((event.detail?.modalId === 'wizard') || 
                event.target?.classList?.contains('modal-close')) {
                cleanupOnClose();
            }
        };
        
        document.addEventListener('modalClosed', modalCloseHandler, { once: true });
        document.addEventListener('modalHidden', modalCloseHandler, { once: true });
        
        setTimeout(() => {
            document.querySelectorAll('.wizard-modal-content .modal-close, .wizard-modal-content .welcome-close')
                .forEach(button => button.addEventListener('click', cleanupOnClose, { once: true }));
        }, 100);
    }

    initializeWizardContent() {
        this.cacheWizardElements();
        this.currentStep = 0;
        this.preGenerateStepContent();
        
        requestAnimationFrame(() => {
            this.showCurrentStepWithAnimation('none');
        });
    }

    preGenerateStepContent() {
        this.stepContentCache = {};
        for (let i = 0; i < Math.min(3, this.steps.length); i++) {
            const step = this.steps[i];
            if (step.id !== 'summary') {
                this.stepContentCache[step.id] = this.generateStepContent(step);
            }
        }
    }

    cacheWizardElements() {
        const modal = document.querySelector('.wizard-modal-content');
        if (!modal) return;

        this.cachedElements = {
            scrollContainer: modal.querySelector('.wizard-content-scroll-container'),
            contentContainer: modal.querySelector('.wizard-content-container'),
            progressBar: modal.querySelector('.wizard-progress'),
            stepIndicator: modal.querySelector('.wizard-step-indicator'),
            backBtn: modal.querySelector('.wizard-back-btn'),
            nextBtn: modal.querySelector('.wizard-next-btn')
        };
    }

    _formatR2Threshold(value) {
        return Math.round(Math.max(0.60, Math.min(0.95, value)) * 100) / 100;
    }

    _updateProgress() {
        const { progressBar, stepIndicator, backBtn } = this.cachedElements;
        const progress = ((this.currentStep + 1) / this.steps.length) * 100;
        
        progressBar.style.width = `${progress}%`;
        stepIndicator.textContent = `${this.currentStep + 1} of ${this.steps.length}`;
        backBtn.style.visibility = this.currentStep === 0 ? 'hidden' : 'visible';
        if (this.currentStep > 0) {
            backBtn.style.cssText = this.buttonStyles.back;
        }
    }

    _updateNextButton(step) {
        const { nextBtn } = this.cachedElements;
        
        if (step.id === 'summary') {
            nextBtn.textContent = 'Apply Configuration';
            nextBtn.className = 'wizard-btn wizard-btn-success';
            nextBtn.style.cssText = this.buttonStyles.success;
        } else {
            nextBtn.textContent = 'Next →';
            nextBtn.className = 'wizard-btn wizard-btn-primary';
            const shouldDisable = step.required && !this.answers[step.id];
            nextBtn.disabled = shouldDisable;
            nextBtn.style.cssText = shouldDisable ? this.buttonStyles.disabled : this.buttonStyles.primary;
        }
    }

    showCurrentStepWithAnimation(direction = 'none') {
        const step = this.steps[this.currentStep];
        const { contentContainer, scrollContainer } = this.cachedElements;

        if (!contentContainer) {
            this.cacheWizardElements();
            if (!this.cachedElements.contentContainer) return;
        }
        
        if (scrollContainer) scrollContainer.scrollTop = 0;

        this._updateProgress();
        this._updateNextButton(step);

        const contentHTML = step.id === 'summary' ? 
            this.generateSummaryStep() : 
            this.stepContentCache?.[step.id] || this.generateStepContent(step);

        if (direction === 'none') {
            contentContainer.innerHTML = contentHTML;
            contentContainer.className = 'wizard-content-container slide-active';
            this.restoreSelection(step);
            return;
        }

        this._animateSlideTransition(contentContainer, contentHTML, step, direction);
    }

    _animateSlideTransition(contentContainer, contentHTML, step, direction) {
        const slideOutDirection = direction === 'next' ? '-100%' : '100%';
        const slideInDirection = direction === 'next' ? '100%' : '-100%';
        
        contentContainer.style.transform = `translateX(${slideOutDirection})`;
        contentContainer.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        
        setTimeout(() => {
            contentContainer.style.transition = 'none';
            contentContainer.innerHTML = contentHTML;
            contentContainer.style.transform = `translateX(${slideInDirection})`;
            contentContainer.offsetHeight;
            
            requestAnimationFrame(() => {
                contentContainer.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                contentContainer.style.transform = 'translateX(0)';
                
                setTimeout(() => {
                    this.restoreSelection(step);
                    setTimeout(() => contentContainer.style.transition = '', 300);
                }, 50);
            });
        }, 300);
    }

    restoreSelection(step) {
        if (this.answers[step.id]) {
            const selectedInput = this.cachedElements.contentContainer.querySelector(
                `input[name="${step.id}"][value="${this.answers[step.id]}"]`
            );
            if (selectedInput) {
                selectedInput.checked = true;
                this.updateNextButtonState();
            }
        }
    }

    generateStepContent(step) {
        const optionsHTML = step.options.map(optionKey => {
            const option = this.getOptionData(step.id, optionKey);
            return `<label class="wizard-option" for="${step.id}_${optionKey}" style="display: block; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 15px; margin-bottom: 10px; cursor: pointer; transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1); will-change: transform, border-color, background-color;" onmouseover="this.style.borderColor='#4facfe'; this.style.background='rgba(79, 172, 254, 0.05)'; this.style.transform='translateY(-1px)'" onmouseout="if(!this.querySelector('input').checked) { this.style.borderColor='rgba(255, 255, 255, 0.1)'; this.style.background='rgba(255, 255, 255, 0.05)'; this.style.transform='translateY(0)' }">
                <input type="radio" id="${step.id}_${optionKey}" name="${step.id}" value="${optionKey}" onchange="scientificWizard.handleOptionChange('${step.id}', '${optionKey}')" style="margin-right: 12px;">
                <div class="wizard-option-content" style="display: inline-block; width: calc(100% - 24px);">
                    <div class="wizard-option-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <h4 style="margin: 0; color: #e0e0e0; font-size: 1.1rem;">${option.label}</h4>
                        ${option.badge ? `<span class="wizard-badge" style="background: linear-gradient(45deg, #28a745, #20c997); color: white; padding: 4px 8px; border-radius: 12px; font-size: 0.8rem;">${option.badge}</span>` : ''}
                    </div>
                    <p class="wizard-option-description" style="margin: 0 0 8px 0; color: #bbb; line-height: 1.4;">${option.description}</p>
                    ${option.details ? `<div class="wizard-option-details" style="color: #999; font-size: 0.9rem; line-height: 1.3;">${option.details}</div>` : ''}
                </div>
            </label>`;
        }).join('');

        return `<div class="wizard-step" style="color: #e0e0e0;">
            <h2 class="wizard-step-title" style="color: #4facfe; margin-bottom: 1rem; font-size: 1.6rem;">${step.title}</h2>
            <p class="wizard-step-subtitle" style="color: #ccc; margin-bottom: 1.5rem; line-height: 1.5;">${step.subtitle}</p>
            <div class="wizard-question"><h3 style="color: #e0e0e0; margin-bottom: 1.5rem; font-size: 1.3rem;">${step.question}</h3></div>
            <div class="wizard-options" style="margin-bottom: 1.5rem;">${optionsHTML}</div>
            <div class="wizard-help" style="background: rgba(255, 255, 255, 0.05); padding: 15px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);">
                <p style="margin: 0; color: #4facfe;"><strong>💡 Help:</strong> <span style="color: #bbb;">${step.helpText}</span></p>
            </div>
        </div>`;
    }

    generateSummaryStep() {
        this.configuration = this.generateConfiguration();
        
        return `
            <div class="wizard-step wizard-summary">
                <h2 class="wizard-step-title">Optimized Scientific Configuration</h2>
                <p class="wizard-step-subtitle">Your analysis will be configured with the following scientifically-based parameters</p>
                
                <div class="wizard-summary-sections">
                    <div class="wizard-summary-section">
                        <h3>
                            <svg height="2rem" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
                                <!--!Font Awesome Free v7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path fill="#ffffff" d="M448 96L439.4 96C428.4 76.9 407.7 64 384 64L256 64C232.3 64 211.6 76.9 200.6 96L192 96C156.7 96 128 124.7 128 160L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 160C512 124.7 483.3 96 448 96zM264 176C250.7 176 240 165.3 240 152C240 138.7 250.7 128 264 128L376 128C389.3 128 400 138.7 400 152C400 165.3 389.3 176 376 176L264 176z"/>
                            </svg>
                        Study Summary</h3>
                        <div class="wizard-summary-items">
                            <div class="wizard-summary-item">
                                <span class="wizard-summary-label">Study Type:</span>
                                <span class="wizard-summary-value">${this.studyPresets[this.answers.study_type]?.label || 'Not specified'}</span>
                            </div>
                            <div class="wizard-summary-item">
                                <span class="wizard-summary-label">Primary Endpoint:</span>
                                <span class="wizard-summary-value">${this.endpointPresets[this.answers.endpoint_type]?.label || 'Not specified'}</span>
                            </div>
                            <div class="wizard-summary-item">
                                <span class="wizard-summary-label">Model:</span>
                                <span class="wizard-summary-value">${this.modelPresets[this.answers.model_context]?.label || 'Standard'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="wizard-summary-section">
                        <h3>
                            <svg height="2rem" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
                                <!--!Font Awesome Free v7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path fill="#ffffff" d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z"/>
                            </svg>
                        Analysis Parameters</h3>
                        <div class="wizard-summary-items">
                            <div class="wizard-summary-item">
                                <span class="wizard-summary-label">R² Threshold:</span>
                                <span class="wizard-summary-value wizard-summary-highlight">${this.configuration.settings.r2Threshold.toFixed(2)}</span>
                                <span class="wizard-summary-explanation">${this.configuration.rationale.r2Rationale}</span>
                            </div>
                            <div class="wizard-summary-item">
                                <span class="wizard-summary-label">Outlier Detection:</span>
                                <span class="wizard-summary-value wizard-summary-highlight">${this.getOutlierConfigLabel(this.configuration.settings.outlierConfig)}</span>
                                <span class="wizard-summary-explanation">${this.configuration.rationale.outlierRationale}</span>
                            </div>
                            <div class="wizard-summary-item">
                                <span class="wizard-summary-label">Filtering Level:</span>
                                <span class="wizard-summary-value wizard-summary-highlight">${this.getFilteringLabel(this.configuration.settings.outlierFiltering)}</span>
                                <span class="wizard-summary-explanation">${this.configuration.rationale.filteringRationale}</span>
                            </div>
                        </div>
                    </div>

                    <div class="wizard-summary-section">
                        <h3>
                        <svg height="2rem" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
                            <!--!Font Awesome Free v7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path fill="#ffffff" d="M480 576L192 576C139 576 96 533 96 480L96 160C96 107 139 64 192 64L496 64C522.5 64 544 85.5 544 112L544 400C544 420.9 530.6 438.7 512 445.3L512 512C529.7 512 544 526.3 544 544C544 561.7 529.7 576 512 576L480 576zM192 448C174.3 448 160 462.3 160 480C160 497.7 174.3 512 192 512L448 512L448 448L192 448zM224 216C224 229.3 234.7 240 248 240L424 240C437.3 240 448 229.3 448 216C448 202.7 437.3 192 424 192L248 192C234.7 192 224 202.7 224 216zM248 288C234.7 288 224 298.7 224 312C224 325.3 234.7 336 248 336L424 336C437.3 336 448 325.3 448 312C448 298.7 437.3 288 424 288L248 288z"/>
                        </svg>
                        Scientific Rationale</h3>
                        <div class="wizard-rationale">
                            <p><strong>Recommended configuration for:</strong> ${this.configuration.rationale.studyDescription}</p>
                            <p><strong>Criteria applied:</strong> ${this.configuration.rationale.criteriaApplied}</p>
                            <p><strong>Expected outcome:</strong> ${this.configuration.rationale.expectedOutcome}</p>
                        </div>
                    </div>

                    <div class="wizard-summary-section" style="margin-bottom: 1rem;">
                        <h3>
                        <svg height="2rem" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
                            <!--!Font Awesome Free v7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path fill="#ffffff" d="M451.5 160C434.9 160 418.8 164.5 404.7 172.7C388.9 156.7 370.5 143.3 350.2 133.2C378.4 109.2 414.3 96 451.5 96C537.9 96 608 166 608 252.5C608 294 591.5 333.8 562.2 363.1L491.1 434.2C461.8 463.5 422 480 380.5 480C294.1 480 224 410 224 323.5C224 322 224 320.5 224.1 319C224.6 301.3 239.3 287.4 257 287.9C274.7 288.4 288.6 303.1 288.1 320.8C288.1 321.7 288.1 322.6 288.1 323.4C288.1 374.5 329.5 415.9 380.6 415.9C405.1 415.9 428.6 406.2 446 388.8L517.1 317.7C534.4 300.4 544.2 276.8 544.2 252.3C544.2 201.2 502.8 159.8 451.7 159.8zM307.2 237.3C305.3 236.5 303.4 235.4 301.7 234.2C289.1 227.7 274.7 224 259.6 224C235.1 224 211.6 233.7 194.2 251.1L123.1 322.2C105.8 339.5 96 363.1 96 387.6C96 438.7 137.4 480.1 188.5 480.1C205 480.1 221.1 475.7 235.2 467.5C251 483.5 269.4 496.9 289.8 507C261.6 530.9 225.8 544.2 188.5 544.2C102.1 544.2 32 474.2 32 387.7C32 346.2 48.5 306.4 77.8 277.1L148.9 206C178.2 176.7 218 160.2 259.5 160.2C346.1 160.2 416 230.8 416 317.1C416 318.4 416 319.7 416 321C415.6 338.7 400.9 352.6 383.2 352.2C365.5 351.8 351.6 337.1 352 319.4C352 318.6 352 317.9 352 317.1C352 283.4 334 253.8 307.2 237.5z"/>
                        </svg>
                        Scientific References</h3>
                        <div class="wizard-references">
                            ${this.configuration.references.map(ref => `<span class="wizard-reference">• ${ref}</span>`).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getOptionData(stepId, optionKey) {
        switch(stepId) {
            case 'study_type':
                const study = this.studyPresets[optionKey];
                if (!study) return { label: optionKey, description: '' };
                return {
                    label: study.label,
                    description: study.description,
                    details: `<strong>Configuration:</strong> R² ${study.settings.r2Threshold}, ${this.getOutlierConfigLabel(study.settings.outlierConfig)}`,
                    badge: optionKey === 'standard_efficacy' ? 'Recommended' : null
                };

            case 'endpoint_type':
                const endpoint = this.endpointPresets[optionKey];
                if (!endpoint) return { label: optionKey, description: '' };
                return {
                    label: endpoint.label,
                    description: endpoint.description,
                    details: `<strong>Variability:</strong> ${endpoint.variability} | <strong>Guide:</strong> ${endpoint.guidance}`
                };

            case 'model_context':
                const model = this.modelPresets[optionKey];
                if (!model) return { label: optionKey, description: '' };
                return {
                    label: model.label,
                    description: model.description,
                    details: `<strong>Features:</strong> ${model.characteristics}`
                };

            default:
                return { label: optionKey, description: '' };
        }
    }

    handleOptionChange(stepId, optionValue) {
        this.answers[stepId] = optionValue;
        
        requestAnimationFrame(() => {
            this.updateNextButtonState();
            this._updateOptionVisualFeedback(stepId, optionValue);
        });
    }

    _updateOptionVisualFeedback(stepId, optionValue) {
        const contentContainer = this.cachedElements.contentContainer;
        if (!contentContainer) return;
        
        const selectedOption = contentContainer.querySelector(`input[name="${stepId}"][value="${optionValue}"]`);
        if (!selectedOption) return;

        const selectedOptionElement = selectedOption.closest('.wizard-option');
        const allOptions = contentContainer.querySelectorAll('.wizard-option');
        
        const styleSheet = document.createElement('style');
        styleSheet.textContent = `.wizard-option.temp-unselected { border-color: rgba(255, 255, 255, 0.1) !important; background: rgba(255, 255, 255, 0.05) !important; transition: all 0.15s ease !important; } .wizard-option.temp-selected { border-color: #4facfe !important; background: rgba(79, 172, 254, 0.1) !important; transition: all 0.15s ease !important; }`;
        
        allOptions.forEach(option => {
            option.classList.remove('wizard-option-selected', 'temp-selected');
            option.classList.add('temp-unselected');
        });
        
        selectedOptionElement.classList.remove('temp-unselected');
        selectedOptionElement.classList.add('wizard-option-selected', 'temp-selected');
        
        document.head.appendChild(styleSheet);
        
        setTimeout(() => {
            allOptions.forEach(option => option.classList.remove('temp-unselected', 'temp-selected'));
            if (styleSheet.parentNode) styleSheet.parentNode.removeChild(styleSheet);
        }, 150);
    }

    updateNextButtonState() {
        const nextBtn = this.cachedElements.nextBtn;
        const currentStep = this.steps[this.currentStep];
        const shouldDisable = currentStep.required && !this.answers[currentStep.id];
        
        nextBtn.disabled = shouldDisable;
        nextBtn.classList.toggle('wizard-btn-disabled', shouldDisable);
        nextBtn.style.cssText = shouldDisable ? this.buttonStyles.disabled : this.buttonStyles.primary;
    }

    nextStep() {
        const currentStep = this.steps[this.currentStep];
        
        if (currentStep.required && !this.answers[currentStep.id]) {
            notificationService.show('Please select an option before continuing', 'warning');
            return;
        }

        if (currentStep.id === 'summary') {
            this.applyConfiguration();
            return;
        }

        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            requestAnimationFrame(() => this.showCurrentStepWithAnimation('next'));
        }
    }

    previousStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            requestAnimationFrame(() => this.showCurrentStepWithAnimation('back'));
        }
    }

    generateConfiguration() {
        let config = { ...this.studyPresets[this.answers.study_type].settings };
        
        this._applyAdjustments(config, this.endpointPresets[this.answers.endpoint_type]?.adjustments);
        this._applyAdjustments(config, this.modelPresets[this.answers.model_context]?.adjustments);

        const rationale = {
            studyDescription: this.studyPresets[this.answers.study_type].description,
            criteriaApplied: this.generateCriteriaDescription(),
            expectedOutcome: this.generateExpectedOutcome(),
            r2Rationale: `Threshold optimized for ${this.endpointPresets[this.answers.endpoint_type]?.label || 'your endpoint'}`,
            outlierRationale: `${this.getOutlierConfigLabel(config.outlierConfig)} detection appropriate for ${this.modelPresets[this.answers.model_context]?.label || 'your model'}`,
            filteringRationale: `Balanced filtering level for ${this.studyPresets[this.answers.study_type].label.toLowerCase()}`
        };

        const references = new Set();
        this.studyPresets[this.answers.study_type].references?.forEach(ref => references.add(ref));
        this.endpointPresets[this.answers.endpoint_type]?.references?.forEach(ref => references.add(ref));

        return { settings: config, rationale, references: Array.from(references) };
    }

    _applyAdjustments(config, adjustments) {
        if (!adjustments) return;
        
        Object.entries(adjustments).forEach(([key, value]) => {
            config[key] = key === 'r2Threshold' ? this._formatR2Threshold(config[key] + value) : value;
        });
    }

    applyConfiguration() {
        if (!this.configuration) {
            notificationService.show('Error: Configuration not available', 'error');
            return;
        }

        try {
            const settings = this.configuration.settings;
            
            this._setElementValue('r2Threshold', settings.r2Threshold.toFixed(2), 'input');
            this._setDataType();
            
            window.suppressOutlierNotification = true;
            this._setElementValue('outlierConfig', settings.outlierConfig, 'change');
            this._setElementValue('outlierFiltering', settings.outlierFiltering, 'change');
            setTimeout(() => window.suppressOutlierNotification = false, 100);

            if (window.AppState) window.AppState.wizardConfiguration = this.configuration;
            if (typeof Logger !== 'undefined') Logger.log('Scientific configuration applied:', this.configuration);

            const configToSummary = { ...this.configuration };
            this.close();
            setTimeout(() => this.showConfigurationSummary(configToSummary), 400);

        } catch (error) {
            notificationService.show('Error applying configuration: ' + error.message, 'error');
        }
    }

    _setElementValue(elementId, value, eventType) {
        const element = domCache.get(elementId);
        if (element) {
            element.value = value;
            element.dispatchEvent(new Event(eventType, { bubbles: true }));
        }
    }

    _setDataType() {
        const dataTypeSelect = domCache.get('dataType');
        if (dataTypeSelect && this.answers.endpoint_type) {
            const dataTypeMapping = { 'tumor_volume': 'volume', 'bioluminescence': 'bli' };
            const mappedValue = dataTypeMapping[this.answers.endpoint_type];
            if (mappedValue) {
                dataTypeSelect.value = mappedValue;
                dataTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }

    showConfigurationSummary(configuration = null) {
        if (typeof notificationService !== 'undefined') {
            const config = configuration || this.configuration;
            if (config?.settings) {
                const summary = `Configuration applied: R²=${config.settings.r2Threshold.toFixed(2)}, ${this.getOutlierConfigLabel(config.settings.outlierConfig)}, Filtering=${this.getFilteringLabel(config.settings.outlierFiltering)}`;
                notificationService.show(summary, 'info', 8000);
            }
        }
    }

    close() {
        if (window.modalManager) {
            window.modalManager.hide('wizard');
        }
        
        this.resetState();
        
        if (typeof Logger !== 'undefined') {
            Logger.log('Scientific Setup Wizard closed');
        }
    }

    resetState() {
        this.cachedElements = {};
        this.isActive = false;
        this.currentStep = 0;
        this.answers = {};
        this.configuration = null;
        this.stepContentCache = {};
    }

    showNotification(message, type = 'info') {
        if (typeof notificationService !== 'undefined') {
            notificationService.show(message, type, 4000);
        }
    }

    getOutlierConfigLabel(config) {
        const labels = {
            'ultraConservative': 'Ultra Conservative',
            'conservative': 'Conservative',
            'moderate': 'Moderate'
        };
        return labels[config] || config;
    }

    getFilteringLabel(filtering) {
        const labels = {
            'critical': 'Critical Only',
            'criticalAndHigh': 'Critical + High',
            'all': 'All Anomalies'
        };
        return labels[filtering] || filtering;
    }

    generateCriteriaDescription() {
        const study = this.studyPresets[this.answers.study_type];
        const endpoint = this.endpointPresets[this.answers.endpoint_type];
        return `${study.rationale}. ${endpoint?.guidance || ''}`;
    }

    generateExpectedOutcome() {
        const studyType = this.answers.study_type;
        const outcomes = {
            'pilot_efficacy': 'Exploratory analysis with maximum data inclusion for hypothesis generation',
            'standard_efficacy': 'Balanced analysis with appropriate statistical rigor for publication',
            'large_cohort': 'High-precision analysis with strict quality criteria'
        };
        return outcomes[studyType] || 'Scientifically rigorous analysis with optimized configuration';
    }

    isWizardActive() {
        return this.isActive;
    }

    getConfiguration() {
        return this.configuration;
    }
}

const scientificWizard = new ScientificWizardService();

if (typeof window !== 'undefined') {
    window.ScientificWizardService = ScientificWizardService;
    window.scientificWizard = scientificWizard;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScientificWizardService;
}
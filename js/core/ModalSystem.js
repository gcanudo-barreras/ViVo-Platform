class ModalSystem {
    constructor() {
        this.modals = new Map();
        this.activeModal = null;
        this.config = {
            animationDuration: 300,
            closeOnBackdrop: true,
            closeOnEscape: true
        };
        this.styles = this._initStyles();
        
        this._setupGlobalEventListeners();
        this._setupContentGenerators();
    }

    _initStyles() {
        return {
            colors: {
                primary: '#007bff',
                success: '#28a745',
                danger: '#dc3545',
                warning: '#ffc107',
                info: '#17a2b8',
                dark: '#343a40',
                light: '#f8f9fa',
                muted: '#6c757d'
            },
            severity: {
                critical: '#dc3545',
                high: '#fd7e14',
                medium: '#ffc107',
                low: '#6c757d'
            },
            modal: {
                background: 'rgba(40, 40, 40, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                text: '#e0e0e0',
                cardBg: 'rgba(255, 255, 255, 0.1)'
            }
        };
    }

    register(modalId, contentGenerator, options = {}) {
        if (typeof contentGenerator !== 'function') return false;

        this.modals.set(modalId, {
            id: modalId,
            contentGenerator,
            isOpen: false,
            element: null,
            options: { ...this.config, ...options }
        });
        return true;
    }

    async show(modalId, data = {}) {
        const modal = this.modals.get(modalId);
        if (!modal || modal.isOpen) return false;

        if (this.activeModal) await this.hide(this.activeModal);

        try {
            const htmlContent = await modal.contentGenerator(data);
            const modalElement = this._createModalElement(modalId, htmlContent);
            
            document.body.appendChild(modalElement);
            modal.element = modalElement;
            
            requestAnimationFrame(() => {
                modalElement.classList.add('modal-show');
                modal.isOpen = true;
                this.activeModal = modalId;
            });

            return true;
        } catch (error) {
            return false;
        }
    }

    async hide(modalId) {
        const modal = this.modals.get(modalId);
        if (!modal || !modal.isOpen || !modal.element) return false;

        modal.element.classList.remove('modal-show');
        modal.element.classList.add('modal-hide');

        setTimeout(() => {
            modal.element?.parentNode?.removeChild(modal.element);
            modal.element = null;
            modal.isOpen = false;
            if (this.activeModal === modalId) this.activeModal = null;
        }, this.config.animationDuration);

        return true;
    }

    hideActive() {
        return this.activeModal ? this.hide(this.activeModal) : false;
    }

    async hideAll() {
        const openModals = Array.from(this.modals.values()).filter(modal => modal.isOpen);
        for (const modal of openModals) await this.hide(modal.id);
        this.activeModal = null;
        return true;
    }

    isOpen(modalId) {
        return this.modals.get(modalId)?.isOpen || false;
    }

    getStats() {
        const openModals = Array.from(this.modals.values()).filter(modal => modal.isOpen);
        return {
            totalModals: this.modals.size,
            openModals: openModals.length,
            activeModal: this.activeModal,
            registeredModals: Array.from(this.modals.keys())
        };
    }

    _createModalElement(modalId, htmlContent) {
        const modalElement = document.createElement('div');
        modalElement.id = modalId;
        modalElement.className = 'modal';
        modalElement.innerHTML = htmlContent;
        
        modalElement.querySelectorAll('[data-modal-close], .modal-close, .welcome-close')
            .forEach(button => button.addEventListener('click', (e) => {
                e.preventDefault();
                this.hide(modalId);
            }));
        
        return modalElement;
    }

    _setupGlobalEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeModal) this.hide(this.activeModal);
        });

        document.addEventListener('click', (e) => {
            if (this.activeModal && e.target.classList.contains('modal')) this.hide(this.activeModal);
        });
    }

    _setupContentGenerators() {
        document.addEventListener('DOMContentLoaded', () => {
            window.uiManager ? this._registerAllModals() : setTimeout(() => this._registerAllModals(), 100);
        });
    }

    _registerAllModals() {
        const generators = {
            help: () => window.uiManager.generateHelpModalContent(),
            about: () => window.uiManager.generateAboutModalContent(),
            dataReview: (data) => window.uiManager.generateDataReviewModalContent(data),
            outlier: (data) => this._generateOutlierContent(data),
            homogeneity: (data) => this._generateHomogeneityContent(data),
            wizard: (data) => this._generateWizardContent(data)
        };

        Object.entries(generators).forEach(([id, generator]) => this.register(id, generator));
        this._setupGlobalFunctions();
    }

    _generateOutlierContent(data) {
        const outlierAnalysis = data.outlierAnalysis || window.getOutlierAnalysis?.() || window.outlierAnalysis;
        if (!outlierAnalysis) return '<div class="modal-content"><p>No outlier data available</p></div>';

        const { complete = {}, filtered = {}, impact = {} } = outlierAnalysis.dualAnalysis || {};
        const totalAnimals = complete.animals?.length || 0;
        const outliersExcluded = impact.animalsExcluded || 0;
        const outlierRate = totalAnimals > 0 ? (outliersExcluded / totalAnimals * 100) : 0;

        const filteringLevel = window.DOMConfigurationManager?.getOutlierFiltering() || 
            document.getElementById('outlierFiltering')?.value || 'criticalAndHigh';

        const activeFlags = this._getActiveFlags(outlierAnalysis.flags, filteringLevel);
        const flagTypeCount = this._calculateFlagStats(activeFlags);
        const excludedAnimals = this._getExcludedAnimals(complete.animals, filtered.animals);

        const summaryHTML = this._generateSummaryHTML(totalAnimals, activeFlags.length, outlierRate, flagTypeCount);

        const outliersHTML = this._generateOutliersHTML(outliersExcluded, excludedAnimals, outlierAnalysis, activeFlags);

        return `<div class="modal-content outlier-modal" style="background: white; border-radius: 15px; padding: 30px; max-width: 700px; width: 90%; max-height: 85vh; overflow-y: auto; position: relative; color: #333; margin: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #f0f0f0; padding-bottom: 15px;">
                <h2 style="margin: 0; color: #2c3e50;">Complete Outlier Details</h2>
                <button class="modal-close" style="background: ${this.styles.colors.danger}; color: white; border: none; border-radius: 50%; width: 35px; height: 35px; cursor: pointer; font-size: 18px;">×</button>
            </div>
            ${summaryHTML}${outliersHTML}
            <div style="text-align: center; margin-top: 25px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                <button onclick="exportManager.export('outlier')" style="background: ${this.styles.colors.info}; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-right: 10px;">📄 Export Report</button>
                <button class="modal-close" style="background: ${this.styles.colors.muted}; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">Close</button>
            </div>
        </div>`;
    }

    _getActiveFlags(flags, filteringLevel) {
        return flags?.filter(flag => {
            const severity = window.FLAG_TYPES?.[flag.type]?.severity || 'low';
            return filteringLevel === 'critical' ? severity === 'critical' :
                   filteringLevel === 'criticalAndHigh' ? ['critical', 'high'].includes(severity) :
                   filteringLevel === 'all';
        }) || [];
    }

    _calculateFlagStats(activeFlags) {
        const flagTypeCount = {};
        activeFlags.forEach(flag => flagTypeCount[flag.type] = (flagTypeCount[flag.type] || 0) + 1);
        return flagTypeCount;
    }

    _getExcludedAnimals(completeAnimals = [], filteredAnimals = []) {
        const filteredSet = new Set(filteredAnimals.map(animal => animal.id));
        return completeAnimals.filter(animal => !filteredSet.has(animal.id));
    }

    _generateSummaryHTML(totalAnimals, activeFlagsCount, outlierRate, flagTypeCount) {
        const cardStyle = `background: ${this.styles.colors.light}; padding: 12px; border-radius: 8px; text-align: center; border: 1px solid #dee2e6;`;
        const valueStyle = 'font-size: 20px; font-weight: bold; margin-bottom: 3px;';
        const labelStyle = `color: ${this.styles.colors.muted}; font-size: 0.85rem;`;
        
        const cards = [
            { value: totalAnimals, label: 'Total Animals', color: this.styles.colors.primary },
            { value: activeFlagsCount, label: 'Active Flags', color: this.styles.colors.info },
            { value: `${outlierRate.toFixed(1)}%`, label: 'Exclusion Rate', color: outlierRate > 15 ? this.styles.colors.danger : this.styles.colors.success }
        ].map(card => `<div style="${cardStyle}"><div style="${valueStyle} color: ${card.color};">${card.value}</div><div style="${labelStyle}">${card.label}</div></div>`).join('');
        
        const flagDistribution = Object.keys(flagTypeCount).length > 0 ? `
            <div style="background: ${this.styles.colors.light}; padding: 12px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #dee2e6;">
                <h5 style="margin: 0 0 8px 0; color: #495057;">Flag Distribution:</h5>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    ${Object.entries(flagTypeCount).map(([type, count]) => {
                        const flagInfo = window.FLAG_TYPES?.[type] || { name: type, color: this.styles.colors.muted };
                        return `<span style="background: ${flagInfo.color}; color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.8rem;">${flagInfo.name}: ${count}</span>`;
                    }).join('')}
                </div>
            </div>` : '';
        
        return `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px;">${cards}</div>${flagDistribution}`;
    }

    _generateOutliersHTML(outliersExcluded, excludedAnimals, outlierAnalysis, activeFlags) {
        if (outliersExcluded === 0) {
            return `<div style="background: #d4edda; color: #155724; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #c3e6cb;"><strong>Excellent data quality:</strong> No significant anomalies detected.</div>`;
        }
        
        if (excludedAnimals.length === 0) {
            return `<div style="background: #fff3cd; color: #856404; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #ffeaa7;"><strong>Note:</strong> ${outliersExcluded} animals were excluded based on quality criteria.<br>Detailed outlier information not available in the current analysis format.</div>`;
        }
        
        const tableRows = excludedAnimals.map((animal, index) => {
            const rowColor = index % 2 === 0 ? this.styles.colors.light : 'white';
            const timePoints = animal.timePoints || [0];
            const minDay = Math.min(...timePoints);
            const maxDay = Math.max(...timePoints);
            const animalFlags = this._generateAnimalFlags(animal, outlierAnalysis, activeFlags);
            const primaryFlag = animalFlags[0] || { name: 'Quality Failure', color: this.styles.colors.muted };
            
            return `<tr style="background: ${rowColor}; cursor: pointer;" onclick="window.toggleAnimalDetails('${animal.id}')">
                <td style="padding: 10px; border-bottom: 1px solid #dee2e6; text-align: center;"><span id="expand-icon-${animal.id}" class="expand-icon" style="font-size: 14px; color: ${this.styles.colors.muted};">▶</span></td>
                <td style="padding: 10px; border-bottom: 1px solid #dee2e6; font-weight: 500;">${animal.id}</td>
                <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${animal.group || 'Unknown'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #dee2e6; text-align: center;">${timePoints.length}</td>
                <td style="padding: 10px; border-bottom: 1px solid #dee2e6; text-align: center;">Day ${minDay} - ${maxDay}</td>
                <td style="padding: 10px; border-bottom: 1px solid #dee2e6; text-align: center;"><span style="background: ${this.styles.colors.info}; color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: 500;">${animalFlags.length}</span></td>
                <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><span style="background: ${primaryFlag.color}; color: white; padding: 4px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: 500;">${primaryFlag.name}</span></td>
            </tr>
            <tr id="details-${animal.id}" class="animal-details-row" style="display: none; background: ${rowColor};">
                <td colspan="7" style="padding: 0; border-bottom: 1px solid #dee2e6;">
                    <div class="animal-details-content" style="padding: 15px; background: ${this.styles.colors.light}; border-left: 4px solid ${this.styles.colors.info};">
                        <h5 style="margin: 0 0 10px 0; color: #2c3e50;">Detailed Flag Analysis for ${animal.id}</h5>
                        <div style="display: grid; gap: 8px;">${this._generateFlagDetailsHTML(animalFlags, animal)}</div>
                    </div>
                </td>
            </tr>`;
        }).join('');
        
        return `<h3 style="color: #34495e; margin-bottom: 15px;">Excluded Animals (${outliersExcluded})</h3>
        <div class="outlier-table-container" style="overflow-x: auto; margin-bottom: 25px;"><table class="outlier-table" style="width: 100%; border-collapse: collapse; font-size: 0.9rem;"><thead><tr style="background: #34495e; color: white;"><th style="padding: 12px; text-align: center; width: 40px;"></th><th style="padding: 12px; text-align: center;">Animal ID</th><th style="padding: 12px; text-align: center;">Group</th><th style="padding: 12px; text-align: center;">Data Points</th><th style="padding: 12px; text-align: center;">Time Range</th><th style="padding: 12px; text-align: center;">Flags</th><th style="padding: 12px; text-align: center;">Primary Flag</th></tr></thead><tbody>${tableRows}</tbody></table></div>`;
    }
    _generateAnimalFlags(animal, outlierAnalysis, activeFlags) {
        if (!outlierAnalysis?.flags) return [];

        return activeFlags.filter(flag => flag.animalId === animal.id).map(flag => {
            const flagType = window.FLAG_TYPES?.[flag.type] || { 
                name: flag.type, 
                color: this.styles.colors.muted, 
                severity: 'low' 
            };
            
            return {
                type: flag.type,
                name: flagType.name,
                color: flagType.color,
                day: flag.day,
                value: flag.value,
                description: flag.message || `${flagType.name} detected`,
                severity: flagType.severity
            };
        });
    }

    _generateFlagDetailsHTML(flags) {
        if (!flags.length) return `<div style="color: ${this.styles.colors.muted}; font-style: italic;">No specific flags detected</div>`;

        return flags.map(flag => {
            const dayDisplay = flag.day !== null ? `Day ${flag.day}` : '-';
            const valueDisplay = flag.value !== null ? 
                (typeof flag.value === 'number' ? 
                    (flag.value >= 1000 ? flag.value.toExponential(2) : flag.value.toFixed(2)) : 
                    flag.value) : '-';
            
            const severityColor = this.styles.severity[flag.severity] || this.styles.colors.muted;

            return `<div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid ${flag.color}; margin-bottom: 8px;">
                <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 12px; align-items: center;">
                    <div><span style="background: ${flag.color}; color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 500;">${flag.name}</span></div>
                    <div style="text-align: center;"><span style="background: ${severityColor}; color: white; padding: 3px 8px; border-radius: 8px; font-size: 0.75rem; font-weight: 500; text-transform: uppercase;">${flag.severity}</span></div>
                    <div style="text-align: center; font-weight: 500; color: #495057; background: rgba(0,123,255,0.1); padding: 4px 8px; border-radius: 6px;">${dayDisplay}</div>
                    <div style="text-align: center; font-family: monospace; font-weight: 500; color: #495057; background: rgba(40,167,69,0.1); padding: 4px 8px; border-radius: 6px;">${valueDisplay}</div>
                </div>
            </div>`;
        }).join('');
    }

    _generateHomogeneityContent(data) {
        if (!window.ModelHomogeneityEvaluator) return '<div class="modal-content"><p>Homogeneity evaluator not available</p></div>';
        
        const results = data.results || data;
        if (!results) return '<div class="modal-content"><p>No homogeneity data available</p></div>';

        const overall = results.overallAssessment || results.overall || {};
        const averageCV = parseFloat(overall.averageCV) || 0;
        const overallScore = parseInt(overall.overallScore, 10) || 0;
        
        const statusColor = {
            'PROCEED': this.styles.colors.success,
            'CAUTION': this.styles.colors.warning,
        }[overall.recommendation] || this.styles.colors.danger;

        const groupResults = results.groupAnalysis || results.groupResults || {};
        const groupTableHtml = this._generateGroupTableHTML(groupResults);

        const statsHTML = this._generateHomogeneityStatsHTML(results, averageCV, overallScore);
        const recommendationsHTML = this._generateRecommendationsHTML(results.recommendations);
        const continueText = {
            'PROCEED': 'Continue Analysis',
            'CAUTION': 'Continue with Caution'
        }[overall.recommendation] || 'Continue Anyway';
        
        return `<div class="modal-content homogeneity-modal" style="max-width: 90vw; max-height: 90vh; overflow-y: auto; background: ${this.styles.modal.background}; border-radius: 20px; border: ${this.styles.modal.border}; padding: 30px; color: ${this.styles.modal.text};">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 15px;">
                <h2 style="margin: 0; color: ${this.styles.modal.text}; font-size: 1.8rem;">Pre-Analysis Quality Assessment</h2>
                <div class="quality-badge" style="background: ${statusColor}; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold;">${overall.quality ? overall.quality.toUpperCase() : 'UNKNOWN'} HOMOGENEITY</div>
                <button class="welcome-close modal-close" title="Close">×</button>
            </div>
            <div class="modal-body">${statsHTML}${groupTableHtml}${recommendationsHTML}
                <div class="action-buttons" style="text-align: center; margin-top: 25px; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                    <button onclick="reviewHomogeneityData()" class="btn secondary" style="background: linear-gradient(45deg, #d63384, ${this.styles.colors.warning}); color: white; border: none; padding: 12px 24px; border-radius: 10px; cursor: pointer; margin-right: 10px; font-size: 16px; transition: all 0.3s ease;">Review Data</button>
                    <button onclick="window.modalManager.hide('homogeneity')" class="btn primary" style="background: linear-gradient(45deg, #3182ce, #0099cc); color: white; border: none; padding: 12px 24px; border-radius: 10px; cursor: pointer; font-size: 16px; transition: all 0.3s ease;">${continueText}</button>
                </div>
            </div>
        </div>`;
    }

    _generateGroupTableHTML(groupResults) {
        if (!Object.keys(groupResults).length) return '';
        
        const rows = Object.entries(groupResults).map(([groupName, groupData]) => {
            const cv = parseFloat(groupData.cv) || 0;
            const quality = groupData.quality || groupData.assessment || 'Unknown';
            const count = groupData.count || groupData.n || 0;
            
            return `<tr><td>${groupName}</td><td>${count}</td><td>${cv.toFixed(1)}%</td><td><span class="quality-indicator quality-${quality.toLowerCase()}">${quality}</span></td></tr>`;
        }).join('');
        
        return `<div class="group-analysis"><h3>Group-by-Group Analysis</h3><div class="group-table"><table><thead><tr><th>Group</th><th>N</th><th>CV (%)</th><th>Quality</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    }

    _generateHomogeneityStatsHTML(results, averageCV, overallScore) {
        const cardStyle = `background: ${this.styles.modal.cardBg}; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid rgba(255, 255, 255, 0.1);`;
        const stats = [
            { value: results.totalAnimals || 0, label: 'Total Animals' },
            { value: results.totalGroups || 0, label: 'Groups' },
            { value: `${averageCV.toFixed(1)}%`, label: 'Average CV' },
            { value: `${overallScore}/100`, label: 'Quality Score' }
        ];
        
        const cards = stats.map(stat => 
            `<div class="stat-card" style="${cardStyle}"><div class="stat-value" style="font-size: 1.8em; font-weight: bold; color: #4facfe;">${stat.value}</div><div class="stat-label" style="font-size: 0.9em; color: #bbb; margin-top: 5px;">${stat.label}</div></div>`
        ).join('');
        
        return `<div class="overview-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 25px;">${cards}</div>`;
    }

    _generateRecommendationsHTML(recommendations) {
        if (!recommendations?.length) return '';
        
        const icons = { success: '✅', warning: '⚠️', error: '❌' };
        const colors = { 
            success: this.styles.colors.success, 
            warning: this.styles.colors.warning, 
            error: this.styles.colors.danger, 
            default: this.styles.colors.info 
        };
        
        const recItems = recommendations.map(rec => {
            if (typeof rec !== 'object') return `<div style="margin-bottom: 10px; padding: 8px; background: rgba(255, 255, 255, 0.05); border-radius: 4px; color: ${this.styles.modal.text};">${rec}</div>`;
            
            const typeIcon = icons[rec.type] || 'ℹ️';
            const typeColor = colors[rec.type] || colors.default;
            
            return `<div style="margin-bottom: 15px; padding: 12px; border-left: 4px solid ${typeColor}; background: rgba(255, 255, 255, 0.05); border-radius: 4px;">
                <div style="font-weight: bold; color: ${typeColor}; margin-bottom: 5px;">${rec.title || 'Recommendation'}</div>
                <div style="margin-bottom: 8px; color: #ccc;">${rec.message || ''}</div>
                ${rec.action ? `<div style="font-style: italic; color: #a0a0a0; font-size: 0.9em;"><strong>Action:</strong> ${rec.action}</div>` : ''}
            </div>`;
        }).join('');
        
        return `<div class="recommendations" style="background: rgba(255, 255, 255, 0.05); padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid rgba(255, 255, 255, 0.1);"><h4 style="margin: 0 0 15px 0; color: #4facfe;"><i class="fa-solid fa-triangle-exclamation fa-bounce" style="color: #ffffff; margin-right: 10px;"></i>Recommendations</h4>${recItems}</div>`;
    }
    _generateWizardContent() {
        if (!window.ScientificWizardService) return '<div class="modal-content"><p>Wizard service not available</p></div>';

        const commonStyle = `background: ${this.styles.modal.background}; color: ${this.styles.modal.text};`;
        
        return `<div class="modal-content wizard-modal-content" style="${commonStyle} border-radius: 20px; border: ${this.styles.modal.border}; max-width: 850px; width: 90%; max-height: 85vh; margin: auto; display: flex; flex-direction: column;">
            <div class="wizard-header" style="padding: 2rem; border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                <h2 style="margin: 0; color: ${this.styles.modal.text}; font-size: 1.8rem;">Configuration Assistant</h2>
                <button class="welcome-close modal-close" title="Close">×</button>
            </div>
            <div class="wizard-progress-container" style="padding: 0 2rem; margin-top: 1rem; flex-shrink: 0;">
                <div class="wizard-progress-bar" style="background: rgba(255, 255, 255, 0.1); height: 8px; border-radius: 4px; overflow: hidden; margin-bottom: 1rem;"><div class="wizard-progress" style="background: linear-gradient(90deg, #4285f4, #34a853); height: 100%; width: 25%; transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1); will-change: width;"></div></div>
                <div class="wizard-step-indicator" style="text-align: center; font-size: 0.9em; color: #bbb; margin-bottom: 1rem;">1 of 4</div>
            </div>
            <div class="wizard-content-scroll-container" style="flex: 1; overflow-y: auto; overflow-x: hidden; padding: 0; min-height: 300px;">
                <div class="wizard-content-container" style="padding: 0 2rem; will-change: transform, opacity;"><div class="wizard-step">
                    <h3 style="color: #4facfe; margin-bottom: 1rem;">Welcome to ViVo Configuration Assistant</h3>
                    <p style="color: #ccc; margin-bottom: 1.5rem; line-height: 1.5;">This wizard will help you configure optimal settings for your analysis based on scientific best practices and established statistical principles.</p>
                    <button onclick="window.scientificWizard?.initializeWizardContent()" style="background: linear-gradient(45deg, #4285f4, #34a853); color: white; border: none; padding: 12px 24px; border-radius: 10px; cursor: pointer; margin-top: 20px; font-size: 16px; transition: all 0.3s ease;">Start Configuration</button>
                </div></div>
            </div>
            <div class="wizard-navigation" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 2rem; border-top: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.03); flex-shrink: 0;">
                <div style="flex: 1; display: flex; justify-content: flex-start;"><button class="wizard-btn wizard-btn-secondary wizard-back-btn" style="background: rgba(108, 117, 125, 0.8); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; visibility: hidden; transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1); will-change: transform, opacity;" onclick="window.scientificWizard?.previousStep()">← Back</button></div>
                <div style="flex: 1; display: flex; justify-content: flex-end;"><button class="wizard-btn wizard-btn-primary wizard-next-btn wizard-btn-disabled" style="background: rgba(0, 123, 255, 0.5); color: rgba(255, 255, 255, 0.6); border: none; padding: 10px 20px; border-radius: 8px; cursor: not-allowed; transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1); will-change: transform, opacity;" onclick="window.scientificWizard?.nextStep()" disabled>Next →</button></div>
            </div>
        </div>`;
    }

    _setupGlobalFunctions() {
        const functions = {
            showHelpModal: () => this.show('help'),
            closeHelpModal: () => this.hide('help'),
            showAboutModal: () => this.show('about'),
            closeAboutModal: () => this.hide('about'),
            showDataReviewModal: (data) => this.show('dataReview', data),
            closeDataReviewModal: () => this.hide('dataReview'),
            showOutlierDetails: (data) => this.show('outlier', data),
            showHomogeneityModal: (data) => this.show('homogeneity', data),
            showScientificWizard: () => this.show('wizard'),
            reviewHomogeneityData: () => {
                this.hide('homogeneity');
                setTimeout(() => this.show('dataReview'), 300);
            },
            toggleAnimalDetails: (animalId) => {
                const detailsRow = document.getElementById(`details-${animalId}`);
                const expandIcon = document.getElementById(`expand-icon-${animalId}`);
                const modalContent = document.querySelector('.modal-content.outlier-modal');
                
                if (detailsRow && expandIcon) {
                    const isExpanded = detailsRow.classList.contains('expanded');
                    
                    // Start animation - hide overflow
                    if (modalContent) {
                        modalContent.classList.add('animating');
                        modalContent.classList.remove('animation-complete');
                    }
                    
                    // Measure height before change for smooth animation
                    if (!isExpanded && modalContent) {
                        const currentHeight = modalContent.scrollHeight;
                        modalContent.style.height = currentHeight + 'px';
                    }
                    
                    if (isExpanded) {
                        // Collapse - first adjust modal height
                        if (modalContent) {
                            const currentHeight = modalContent.scrollHeight;
                            modalContent.style.height = currentHeight + 'px';
                            
                            // Force reflow and then reduce height
                            requestAnimationFrame(() => {
                                const newHeight = modalContent.scrollHeight - detailsRow.scrollHeight;
                                modalContent.style.height = Math.max(newHeight, modalContent.style.minHeight || 300) + 'px';
                            });
                        }
                        
                        detailsRow.classList.remove('expanded');
                        expandIcon.classList.remove('expanded');
                        expandIcon.textContent = '▶';
                        
                        // Hide completely after animation
                        setTimeout(() => {
                            if (!detailsRow.classList.contains('expanded')) {
                                detailsRow.style.display = 'none';
                            }
                        }, 350);
                        
                        // Restore auto height and overflow after animation
                        setTimeout(() => {
                            if (modalContent) {
                                modalContent.style.height = 'auto';
                                modalContent.classList.remove('animating');
                                
                                // Only show overflow if needed
                                const needsScroll = modalContent.scrollHeight > modalContent.clientHeight;
                                if (needsScroll) {
                                    modalContent.classList.add('animation-complete');
                                }
                            }
                        }, 450);
                    } else {
                        // Expand
                        detailsRow.style.display = 'table-row';
                        expandIcon.textContent = '▼';
                        
                        // Trigger reflow for animation to work correctly
                        requestAnimationFrame(() => {
                            detailsRow.classList.add('expanded');
                            expandIcon.classList.add('expanded');
                        });
                        
                        // Adjust modal height smoothly
                        setTimeout(() => {
                            if (modalContent) {
                                const newHeight = modalContent.scrollHeight;
                                modalContent.style.height = newHeight + 'px';
                                
                                // Restore auto height and overflow after animation
                                setTimeout(() => {
                                    modalContent.style.height = 'auto';
                                    modalContent.classList.remove('animating');
                                    
                                    // Only show overflow if needed
                                    const needsScroll = modalContent.scrollHeight > modalContent.clientHeight;
                                    if (needsScroll) {
                                        modalContent.classList.add('animation-complete');
                                    }
                                }, 450);
                            }
                        }, 50);
                    }
                }
            }
        };
        
        Object.assign(window, functions);
    }
}

const modalSystem = new ModalSystem();

if (typeof module !== 'undefined' && module.exports) module.exports = ModalSystem;

if (typeof window !== 'undefined') {
    window.ModalSystem = ModalSystem;
    window.modalSystem = modalSystem;
    window.modalManager = modalSystem;
}
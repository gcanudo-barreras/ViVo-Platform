// UIManager.js - UI management system for ViVo application

class UIManager {
    constructor() {
        this.updateCallbacks = new Map();
        this.initialized = false;
        this.modalStyles = {
            content: 'max-width: 800px; max-height: 80vh; overflow-y: auto;',
            dataReview: 'max-width: 90vw; max-height: 90vh; overflow-y: auto; background: rgba(40, 40, 40, 0.95); border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.2); padding: 30px; color: #e0e0e0;',
            tableCell: 'border: 1px solid rgba(255, 255, 255, 0.1); padding: 12px; color: #e0e0e0;',
            headerCell: 'border: 1px solid rgba(255, 255, 255, 0.1); padding: 12px; text-align: center; color: #4facfe; font-weight: 600;'
        };
    }

    init() {
        if (this.initialized) return;
        this.setupKeyboardShortcuts();
        this.initialized = true;
    }

    setupKeyboardShortcuts() {
        EventListenerManager.add(document, 'keydown', (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'h') {
                event.preventDefault();
                window.modalManager?.show('help');
            }
            if ((event.ctrlKey || event.metaKey) && event.key === 'i') {
                event.preventDefault();
                window.modalManager?.show('about');
            }
        });
    }

    copyReference() {
      const text = document.getElementById('reference').innerText;
      navigator.clipboard.writeText(text).then(() => {
        alert('Reference copied to the clipboard');
      }).catch(err => {
        console.error('Something went wrong. Try copying the reference manually.: ', err);
      });
    }
    
    generateAboutModalContent() {
        const version = window.DOMConfigurationManager?.getVersion();
        return `
            <div class="modal-content" style="${this.modalStyles.content}">
            <div class="quality-badge" style="background: #007bff; width: fit-content; margin: 10px 0 0 10px;">${version}</div>
                <button class="welcome-close modal-close" title="Close">×</button>
                <div class="modal-header">
                    <div></div>
                    <div class="logo-container" style="margin-bottom: -25px; margin-top: -50px;">
                        <img src="./Assets/ViVo.png" alt="ViVo Logo" style="width: 212px; height: 212px;">
                    </div>
                    <div></div>
                </div>
                <div class="modal-body">
                    <div class="about-section">
                        <h3><i class="fa-solid fa-microscope fa-bounce" style="color: #ffffff; margin-right: 10px;"></i>Scientific Purpose</h3>
                        <p>Preclinical tumor growth quantification suffers from <strong>high biological variability</strong> that often yields inconclusive results with <strong>small sample sizes</strong>. ViVo is a bio-mathematical framework that transforms conventional tumor data into robust growth parameters through exponential modeling.</p>
                        <p>ViVo is a professional platform for <strong>evaluating anticancer efficacy</strong> in preclinical studies. It provides comprehensive <strong>analysis of tumor growth dynamics</strong> through automated tools that <strong>detect early efficacy signs</strong> with <strong>robust statistical methods</strong>, while <strong>reducing the number of animal samples required</strong>.</p>
                    </div>

                    <div class="about-section">
                        <h3><i class="fa-solid fa-brain fa-bounce" style="color: #ffffff; margin-right: 10px;"></i>Scientific Rationale</h3>
                        <style>
                        .equation {
                            font-style: italic;
                            font-family: "Times New Roman", serif;
                            text-align: center;
                            margin: 15px 0;
                            font-size: 1.1em;
                        }
                        </style>
                        <p>The exponential growth model:</p>
                        <div class="equation">
                            <em>N</em>(<em>t</em>) = <em>N</em><sub>0</sub> · e<sup><em>rt</em></sup>
                        </div>
                        <p>allows the extraction of two distinct biological parameters: <strong>tumor growth rate (<em>r</em>)</strong> and initial tumor burden (<em>N</em><sub>0</sub>). Parameter <strong>dispersion is significantly reduced</strong> when using <em>r</em> compared to conventional raw measurements through this mathematical approach.</p>
                    </div>

                    <div class="about-section">
                        <h3><i class="fa-solid fa-key fa-bounce" style="color: #ffffff; margin-right: 10px;"></i>Key Features</h3>
                        <ul>
                            <li><strong>Model Homogeneity Evaluation:</strong> Assessment of the trustability of the experimental model</li>
                            <li><strong>Intelligent Outlier Detection:</strong> Advanced statistical algorithms for data quality and transparent processing</li>
                            <li><strong>Exponential Growth Modeling:</strong> Automated exponential modeling, supporting both caliper and bioluminescence measurements</li>
                            <li><strong>TGR Matrix Analysis:</strong> Tumor Growth Rate matrices with visual heatmaps and interactive comparisons</li>
                            <li><strong>Predictive Modeling:</strong> Tumor weight predictive capabilities allow for generating hybrid experimental-predicted datasets on any day</li>
                            <li><strong>Statistical Comparisons:</strong> Comprehensive group analysis with significance testing</li>
                            <li><strong>Professional Reports:</strong> Publication-ready HTML exports</li>
                        </ul>
                    </div>

                    <div class="about-section">
                        <h3><i class="fa-solid fa-percent fa-bounce" style="color: #ffffff; margin-right: 10px;"></i>Homogeneity Evaluation</h3>
                        <p>Animal model and data variability assessment using <strong>Coefficient of Variation (CV)</strong> analysis and <strong style="color: rgb(207, 81, 53);">Homogeneity Quality Score</strong> across experimental groups.</p>
                    </div>

                    <div class="about-section">
                        <h3><i class="fa-solid fa-exclamation fa-bounce" style="color: #ffffff; margin-right: 10px;"></i>Intelligent Outlier Detection</h3>
                        <p><strong>Multi-level anomaly detection</strong> with configurable sensitivity through six criteria with severity-based classification.</p>
                    </div>

                    <div class="about-section">
                        <h3><i class="fa-solid fa-solid fa-arrow-up-right-dots fa-bounce" style="color: #ffffff; margin-right: 10px;"></i>Tumor Growth Rates (TGR) Matrix Analysis</h3>
                        <p>Automated encoding of <strong>tumor growth dynamics into matrix format</strong>, enabling exploratory-confirmatory temporal analysis workflows.</p>
                    </div>

                    <div class="about-section">
                        <h3><i class="fa-solid fa-solid fa-skull fa-bounce" style="color: #ffffff; margin-right: 10px;"></i>Predictive Modeling</h3>
                        <p>By <strong>accurately predicting tumor weights</strong> at different time points, the platform enables standardized <strong>comparisons between animals regardless of euthanasia date</strong>.</p>
                    </div>

                    <div class="about-section">
                        <h3><i class="fa-solid fa-table-cells fa-bounce" style="color: #ffffff; margin-right: 10px;"></i>Ready-to-use exports</h3>
                        <p><strong>CSV data augmentation</strong> and generation.</p>
                    </div>
                    
                    <div class="about-section">
                        <h3><i class="fa-solid fa-solid fa-gears fa-bounce" style="color: #ffffff; margin-right: 10px;"></i>Technical Specifications</h3>
                        <ul>
                            <li><strong>Data Format:</strong> CSV files with <i>Group</i>, <i>Animal</i>, <i>Day 0...n</i>, <i>Tumor_Volume</i> (optional) columns</li>
                            <li><strong>Mathematical Methods:</strong> Exponential regression, CV analysis, outlier detection, Mann-Whitney U tests...</li>
                            <li><strong>Visualization:</strong> Interactive Plotly.js charts with zoom and export capabilities</li>
                            <li><strong>Performance:</strong> Client-side processing with Web Workers support</li>
                        </ul>
                    </div>
                    
                    <div class="about-section">
                        <h3><i class="fa-solid fa-code fa-bounce" style="color: #ffffff; margin-right: 10px;"></i>Development</h3>
                        <p><strong>Main Developer</strong></p>
                            <ul>
                                <a href="https://orcid.org/0000-0002-1949-9185" target="_blank" style="text-decoration: none; background: rgb(207, 81, 53); padding: 3px 12px; border-radius: 18px; color: #e0e0e0">Guillermo Canudo-Barreras</a> — <a href="mailto:canudobarreras@unizar.es" style="color: #e0e0e0;">canudobarreras@unizar.es</a>
                            </ul>
                        <p><strong>Scientific Contributors</strong></p>
                            <ul>
                                <a href="https://orcid.org/0000-0002-9918-3374" target="_blank" style="text-decoration: none; background: #e0e0e0; padding: 3px 12px; border-radius: 18px; color: black">Eduardo Romanos</a> — <a href="mailto:eromanos.iacs@aragon.es" style="color: #e0e0e0;">eromanos.iacs@aragon.es</a>
                            </ul>
                            <ul>
                                <a href="https://orcid.org/0000-0002-5244-9569" target="_blank" style="text-decoration: none; background: #e0e0e0; padding: 3px 12px; border-radius: 18px; color: black">Raquel P. Herrera</a> — <a href="mailto:raquelph@unizar.es" style="color: #e0e0e0;">raquelph@unizar.es</a>
                            </ul>
                            <ul>
                                <a href="https://orcid.org/0000-0003-0553-0695" target="_blank" style="text-decoration: none; background: #e0e0e0; padding: 3px 12px; border-radius: 18px; color: black">M. Concepción Gimeno</a> — <a href="mailto:gimeno@unizar.es" style="color: #e0e0e0;">gimeno@unizar.es</a>
                            </ul>
                        <p>Open source tool designed to standardize <i>in vivo</i> efficacy analysis, improve research reproducibility, and reduce animal usage.</p>
                        <p style="margin-top: 15px; font-size: 0.9em; color: #666;">
                            This software is developed for research purposes. Please cite the original article when used in scientific publications.
                            <p id="reference">Canudo-Barreras, G.; Romanos, E.; Herrera, R. P.; Gimeno, M. C. <i>ViVo: A temporal modeling framework that boosts statistical power and minimizes animal usage</i>. <i>bioRxiv</i> <strong>2025</strong>, DOI: <a href="https://doi.org/10.1101/2025.10.14.682266" target="_blank" style="color: white;">https://doi.org/10.1101/2025.10.14.682266</a></p>
                            <button 
                              onclick="copyReference()" 
                              style="background-color: #4CAF50; color: white; border: none; padding: 6px 10px; border-radius: 5px; cursor: pointer; font-size: 14px;">
                              Cite
                            </button>
                            <br>All source code for the ViVo platform is available at <a href="https://github.com/gcanudo-barreras/ViVo-Platform" target="_blank" style="color: #a0a0a0;">github.com/gcanudo-barreras/ViVo-Platform</a> under the MIT License.
                        </p></br>
                        </p>
                    </div>
                </div>
            </div>
        `;
    }

    generateHelpModalContent() {
        return `
            <div class="modal-content" style="${this.modalStyles.content}">
                <button class="welcome-close modal-close" title="Close">×</button>
                <div class="modal-header">
                    <h2>ViVo Help Center</h2>
                </div>
                <div class="modal-body">
                    <div class="help-section quick-start">
                        <h3>Quick Start Options</h3>
                        <div class="additional-actions">
                            <button class="welcome-btn tutorial" onclick="window.modalManager.hide('help'); setTimeout(() => startTutorial(), 300);">
                                Interactive Tutorial
                                <small>5-minute guided tour</small>
                            </button>
                            <button class="welcome-btn wizard" onclick="scientificWizard.start(); window.modalManager.hide('help');">
                                Configuration Assistant
                                <small>Get optimal configuration</small>
                            </button>
                            <button class="help-action-btn" onclick="showWelcomeBanner(true); window.modalManager.hide('help');">
                                Show Welcome Panel
                                <small>Getting started options</small>
                            </button>
                        </div>
                        <p class="quick-start-note"><em>New to ViVo? Start here! These tools will guide you step-by-step.</em></p>
                    </div>
                    
                    <div class="help-section">
                        <h3><i class="fa-solid fa-clipboard-question fa-bounce" style="color: white; margin-right: 10px;"></i>Getting Started Guide</h3>
                        <div class="step-list">
                            <div class="step-item">
                                <span class="step-number">1</span>
                                <div class="step-content">
                                    <strong>Load Data:</strong> Upload your CSV file with experimental data
                                    <small>Use our templates if you need format guidance</small>
                                </div>
                            </div>
                            <div class="step-item">
                                <span class="step-number">2</span>
                                <div class="step-content">
                                    <strong>Configure:</strong> Set the data type, the R² threshold, and configure the outlier and anomaly filtering
                                    <small>Use the "Configuration Assistant" to set up these parameters automatically</small>
                                </div>
                            </div>
                            <div class="step-item">
                                <span class="step-number">3</span>
                                <div class="step-content">
                                    <strong>Analyze:</strong> Click "Analyze Data" to process your dataset
                                    <small>This performs outlier detection, model fitting, automated statistical comparison and generates charts</small>
                                </div>
                            </div>
                            <div class="step-item">
                                <span class="step-number">4</span>
                                <div class="step-content">
                                    <strong>Explore:</strong> Use the ViVo tools for results
                                    <small>Export, predict, generate reports, and more</small>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="help-section">
                        <h3><i class="fa-solid fa-toolbox fa-bounce" style="color: #ffffff; margin-right: 10px;"></i>Main Functionalities</h3>
                        <ul class="function-list">
                            <li><strong>Model Homogeneity Evaluation:</strong> Assessment of the trustability of the experimental model</li>
                            <li><strong>Intelligent Outlier Detection:</strong> Advanced statistical algorithms for data quality and transparent processing</li>
                            <li><strong>Exponential Growth Modeling:</strong> Automated exponential modeling, supporting both caliper and bioluminescence measurements</li>
                            <li><strong>TGR Matrix Analysis:</strong> Tumor Growth Rate matrices with visual heatmaps and interactive comparisons</li>
                            <li><strong>Predictive Modeling:</strong> Tumor weight predictive capabilities allow for generating hybrid experimental-predicted datasets on any day</li>
                            <li><strong>Statistical Comparisons:</strong> Comprehensive group analysis with significance testing</li>
                            <li><strong>Professional Reports:</strong> Publication-ready HTML exports</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }

    parseAnimalDataFallback(rawData) {
        const groupedData = {};
        const dayColumns = [];
        
        rawData.forEach(row => {
            const animalId = row.Animal_ID || row.animal_id || row.Animal || row.animal || 'Unknown';
            const group = row.Group || row.group || row.Treatment || row.treatment || 'Unknown';
            const day = parseInt(row.Day || row.day || row.Time || row.time || 0);
            const volume = parseFloat(row.Tumor_Volume || row.tumor_volume || row.Volume || row.volume || 0);
            
            if (!groupedData[animalId]) {
                groupedData[animalId] = { id: animalId, group, timePoints: [], measurements: [] };
            }
            
            groupedData[animalId].timePoints.push(day);
            groupedData[animalId].measurements.push(volume);
            
            if (!dayColumns.includes(day)) dayColumns.push(day);
        });
        
        return { animals: Object.values(groupedData), dayColumns: dayColumns.sort((a, b) => a - b) };
    }

    generateDataReviewModalContent() {
        if (!window.rawData) {
            return '<div class="modal-content"><p>No data available for review</p></div>';
        }
        
        let parsed;
        if (typeof parseAnimalData === 'function') {
            parsed = parseAnimalData(window.rawData);
        } else {
            parsed = this.parseAnimalDataFallback(window.rawData);
        }
        
        const { animals, dayColumns } = { animals: parsed.animals, dayColumns: parsed.dayCols || parsed.dayColumns };
        return `
            <div class="modal-content" style="${this.modalStyles.dataReview}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 15px;">
                    <h2 style="margin: 0; color: #e0e0e0; font-size: 1.8rem;">Dataset Preview & Verification</h2>
                    <div class="quality-badge" style="background: #17a2b8; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold;">REVIEW MODE</div>
                    <button class="welcome-close modal-close" title="Close">×</button>
                </div>
                <div class="modal-body">
                    <div class="review-summary" style="background: rgba(255, 255, 255, 0.1); padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid rgba(255, 255, 255, 0.1);">
                        <p style="color: #e0e0e0;"><strong>Dataset:</strong> ${window.currentFileName || 'Unknown'}</p>
                        <p style="color: #e0e0e0;"><strong>Total Records:</strong> ${window.rawData ? window.rawData.length : 0}</p>
                        <p style="color: #e0e0e0;"><strong>Animals:</strong> ${animals.length}</p>
                        <p style="color: #e0e0e0;"><strong>Status:</strong> Ready for analysis</p>
                    </div>
                    <div style="overflow-x: auto; max-height: 60vh; margin: 20px 0;">
                        <table class="data-table" style="width: 100%; border-collapse: collapse; background: rgba(0, 0, 0, 0.2); border-radius: 8px; overflow: hidden;">
                            <thead style="background: rgba(79, 172, 254, 0.2);">
                                <tr>
                                    <th style="${this.modalStyles.headerCell}; text-align: left;">Animal</th>
                                    <th style="${this.modalStyles.headerCell}; text-align: left;">Group</th>
                                    ${dayColumns.map(day => `<th style="${this.modalStyles.headerCell}">Day ${day}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>${this.generateTableRows(animals, dayColumns)}</tbody>
                        </table>
                    </div>
                    <div class="review-actions" style="margin-top: 20px; text-align: center; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                        <button onclick="cancelDataset()" class="btn primary" style="background: linear-gradient(45deg, #d63384, #ffc107); color: white; border: none; padding: 12px 24px; border-radius: 10px; cursor: pointer; margin-right: 10px; font-size: 16px; transition: all 0.3s ease;">Cancel & Reload</button>
                        <button id="continueAnalysisFromReviewBtn" onclick="window.modalManager.hide('dataReview')" class="btn primary" style="background: linear-gradient(45deg, #3182ce, #0099cc); color: white; border: none; padding: 12px 24px; border-radius: 10px; cursor: pointer; font-size: 16px; transition: all 0.3s ease;">Continue Analysis</button>
                    </div>
                </div>
            </div>`;
    }

    generateTableRows(animals, dayColumns) {
        return animals.map(animal => {
            const cells = [animal.id, animal.group].map(content => 
                `<td style="${this.modalStyles.tableCell}">${content}</td>`
            );
            
            dayColumns.forEach(day => {
                const dayIndex = animal.timePoints.indexOf(day);
                const value = dayIndex !== -1 ? animal.measurements[dayIndex] : '';
                const displayValue = value !== '' ? (typeof value === 'number' ? value.toFixed(1) : value) : '';
                cells.push(`<td style="${this.modalStyles.tableCell}; text-align: center;">${displayValue}</td>`);
            });
            
            return `<tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);">${cells.join('')}</tr>`;
        }).join('');
    }

    showDataReviewModal() {
        window.modalManager?.show('dataReview');
    }
    

    closeDataReviewModal() {
        window.modalManager?.hide('dataReview');
    }

    proceedWithAnalysisFromReview() {
        try {
            if (window.modalManager?.modals.has('dataReviewModal') && window.modalManager.isOpen('dataReviewModal')) {
                window.modalManager.hide('dataReviewModal');
                return;
            }
        } catch (error) {
            const modal = domCache.get('dataReviewModal');
            if (modal) {
                modal.classList.add('hide');
                setTimeout(() => modal.remove(), 300);
            }
        }
    }

    cancelDataset() {
        notificationService?.show('Dataset cancelled - Reloading page...', 'warning');
        setTimeout(() => window.location.reload(), 1500);
    }



    enablePostAnalysisButtons() {
        ['exportBtn', 'predictionsBtn', 'tgrBtn', 'reportBtn'].forEach(buttonId => {
            const button = domCache.get(buttonId);
            if (button) {
                button.disabled = false;
                button.classList.remove('disabled');
                button.removeAttribute('data-disabled-reason');
            }
        });
        
        const analysisTools = document.querySelector('.analysis-tools');
        if (analysisTools) {
            analysisTools.classList.add('analysis-complete');
            analysisTools.style.opacity = '1';
        }
    }

    updateButtonStates(hasData = false, hasAnalysis = false) {
        const analyzeBtn = domCache.get('analyzeBtn');
        if (analyzeBtn) {
            analyzeBtn.disabled = !hasData;
            analyzeBtn[hasData ? 'removeAttribute' : 'setAttribute']('data-disabled-reason', 'Load CSV data first');
        }
        if (hasAnalysis) this.enablePostAnalysisButtons();
    }

    showLoadingState(message = 'Processing...') {
        const loader = document.createElement('div');
        loader.id = 'globalLoader';
        loader.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center; z-index: 10000; color: white; font-size: 18px;';
        loader.innerHTML = `<div style="text-align: center;"><div style="border: 3px solid #f3f3f3; border-top: 3px solid #4facfe; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div><div>${message}</div></div>`;
        document.body.appendChild(loader);
    }

    hideLoadingState() {
        domCache.get('globalLoader')?.remove();
    }

    onUpdate(event, callback) {
        if (!this.updateCallbacks.has(event)) {
            this.updateCallbacks.set(event, []);
        }
        this.updateCallbacks.get(event).push(callback);
    }

    triggerUpdate(event, data) {
        this.updateCallbacks.get(event)?.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('UI update callback error:', error);
            }
        });
    }

}

const uiManager = new UIManager();
window.UIManager = uiManager;
window.uiManager = uiManager;

window.cancelDataset = () => uiManager.cancelDataset();

window.repositionNotifications = () => notificationService?.reposition();
window.removeNotification = (notification) => notificationService?.remove(notification);
window.removeNotificationAnimated = (notification, callback) => notificationService?.remove(notification, callback);
window.removeMultipleNotificationsAnimated = (notifications, callback) => notificationService?.removeMultiple(notifications, callback);
window.removeNotificationAnimatedWithoutReposition = (notification, callback) => notificationService?.removeWithoutReposition(notification, callback);

if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIManager;
}

class GitHubIssuesService {
    constructor() {
        this.owner = 'gcanudo-barreras';
        this.repo = 'ViVo-Platform';
        
        // REEMPLAZA ESTO con la URL exacta de tu función en Vercel
        this.proxyBaseUrl = 'https://tu-proyecto.vercel.app/api/github-proxy'; 
        
        this.issues = [];
        this.initialized = false;
    }

    // Llama al backend para validar que el servicio proxy responde correctamente
    async initialize() {
        try {
            await this.validateToken();
            this.initialized = true;
            return true;
        } catch (error) {
            this.initialized = false;
            throw new Error(`Failed to verify backend service: ${error.message}`);
        }
    }

    async validateToken() {
        const response = await this.makeRequest('GET', '/user');
        if (!response.ok) {
            throw new Error('Invalid or expired backend GitHub token');
        }
        return response.json();
    }

    ensureInitialized() {
        if (!this.initialized) {
            throw new Error('GitHub service not ready. Backend communication unverified.');
        }
    }

    async handleResponse(response, errorMessage) {
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`${errorMessage}: ${response.status} ${response.statusText} - ${errorText}`);
        }
        return response.json();
    }

    async updateIssueState(issueNumber, state) {
        this.ensureInitialized();
        const issueData = { state };
        const response = await this.makeRequest('PATCH', `/repos/${this.owner}/${this.repo}/issues/${issueNumber}`, issueData);
        return this.handleResponse(response, `Failed to ${state === 'open' ? 'reopen' : 'close'} issue`);
    }

    async checkRecentIssue(title) {
        try {
            const recentIssues = await this.getIssues('open', 1, 5);
            return recentIssues.find(issue => 
                issue.title === title && 
                Math.abs(new Date() - new Date(issue.created_at)) < 60000
            );
        } catch (error) {
            return null;
        }
    }

    getIssueLabels(type, config) {
        const labels = [];
        try {
            const labelName = config.label || 'bug';
            labels.push(labelName);
            if (type === 'bug') labels.push('needs-triage');
        } catch (e) {}
        return labels;
    }

    toggleButtonState(issueNumber, action, disabled, text) {
        const button = document.querySelector(`button[onclick*="${action}(${issueNumber})"]`);
        if (button) {
            button.disabled = disabled;
            button.innerHTML = disabled ? 
                `<i class="fas fa-spinner fa-spin" style="margin-right: 4px;"></i>${text}` : 
                text;
        }
    }

    updateIssueStateInCache(issueNumber, state) {
        if (this.issues) {
            const issue = this.issues.find(issue => issue.number === issueNumber);
            if (issue) {
                issue.state = state;
                issue.closed_at = state === 'closed' ? new Date().toISOString() : null;
            }
        }
    }

    async getIssues(state = 'open', page = 1, perPage = 30) {
        this.ensureInitialized();

        const params = new URLSearchParams({
            state,
            page: page.toString(),
            per_page: perPage.toString(),
            sort: 'updated',
            direction: 'desc'
        });

        const response = await this.makeRequest('GET', `/repos/${this.owner}/${this.repo}/issues?${params}`);
        
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`Failed to fetch issues: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const issues = await response.json();
        this.issues = issues;
        return issues;
    }
    
    async getIssue(issueNumber) {
        this.ensureInitialized();
        const response = await this.makeRequest('GET', `/repos/${this.owner}/${this.repo}/issues/${issueNumber}`);
        return this.handleResponse(response, 'Failed to fetch issue');
    }

    async createIssue(title, body, labels = [], assignees = []) {
        this.ensureInitialized();

        const issueData = {
            title: title.trim(),
            body: body.trim(),
            labels,
            assignees
        };

        const response = await this.makeRequest('POST', `/repos/${this.owner}/${this.repo}/issues`, issueData);
        
        if (!response.ok) {
            const errorBody = await response.text().catch(() => 'Unknown error');
            
            if (response.status === 403) {
                const possibleMatch = await this.checkRecentIssue(issueData.title);
                if (possibleMatch) return possibleMatch;
            }
            
            throw new Error(`Failed to create issue: ${response.status} ${response.statusText} - ${errorBody}`);
        }

        return await response.json();
    }

    async getIssueComments(issueNumber) {
        this.ensureInitialized();
        const response = await this.makeRequest('GET', `/repos/${this.owner}/${this.repo}/issues/${issueNumber}/comments`);
        return this.handleResponse(response, 'Failed to fetch comments');
    }

    async addComment(issueNumber, body) {
        this.ensureInitialized();
        const commentData = { body: body.trim() };
        const response = await this.makeRequest('POST', `/repos/${this.owner}/${this.repo}/issues/${issueNumber}/comments`, commentData);
        return this.handleResponse(response, 'Failed to add comment');
    }

    async closeIssue(issueNumber) {
        return this.updateIssueState(issueNumber, 'closed');
    }

    async reopenIssue(issueNumber) {
        return this.updateIssueState(issueNumber, 'open');
    }

    // Encapsula el formato de la query string hacia Vercel
    async makeRequest(method, endpoint, data = null) {
        const url = `${this.proxyBaseUrl}?endpoint=${encodeURIComponent(endpoint)}&method=${method}`;
        
        const config = {
            method: 'POST', // Usamos POST para poder enviar cuerpos en peticiones mutables hacia Serverless
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (method === 'GET') {
            config.method = 'GET';
        }

        if (data && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
            config.body = JSON.stringify(data);
        }

        try {
            return await fetch(url, config);
        } catch (error) {
            throw error;
        }
    }

    formatIssueForDisplay(issue) {
        const createdDate = new Date(issue.created_at).toLocaleDateString();
        const updatedDate = new Date(issue.updated_at).toLocaleDateString();
        
        return {
            number: issue.number,
            title: issue.title,
            body: issue.body || '',
            state: issue.state,
            labels: issue.labels || [],
            assignees: issue.assignees || [],
            user: issue.user,
            comments: issue.comments || 0,
            createdDate,
            updatedDate,
            htmlUrl: issue.html_url,
            isPullRequest: !!issue.pull_request
        };
    }

    generateModalContent(data = {}) {
        const { issues = [], loading = false, error = null, showReportForm = false } = data;
        
        if (showReportForm) {
            return this.generateQuickReportForm();
        }
        
        if (data.hasOwnProperty('issues')) {
            return this.generateIssuesListContent(issues);
        }
        
        if (this.initialized && !loading && !error) {
            if (this.issues && this.issues.length > 0) {
                return this.generateIssuesListContent(this.issues);
            } else {
                return this.generateQuickReportForm();
            }
        }
        
        if (loading) {
            return this.generateLoadingContent();
        }

        if (error) {
            return this.generateErrorContent(error);
        }

        return this.generateQuickReportForm();
    }

    generateQuickReportForm() {
        return `
            <div class="modal-content github-issues-modal" style="background: rgba(40, 40, 40, 0.95); border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.2); padding: 30px; max-width: 700px; width: 90%; color: #e0e0e0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 15px;">
                    <h2 style="margin: 0; color: #e0e0e0; font-size: 1.8rem;">
                        <i class="fab fa-github" style="margin-right: 10px; color: #4facfe;"></i>
                        Report Issue
                    </h2>
                    <button class="welcome-close modal-close" title="Close">×</button>
                </div>
                
                <div style="background: rgba(79, 172, 254, 0.1); padding: 20px; border-radius: 10px; border-left: 4px solid #4facfe; margin-bottom: 25px;">
                    <h3 style="margin: 0 0 10px 0; color: #4facfe;">
                        <i class="fas fa-info-circle" style="margin-right: 8px;"></i>
                        Help us improve ViVo Platform
                    </h3>
                    <p style="margin: 0; color: #ccc; line-height: 1.5;">
                        Found a bug, have a suggestion, or need a feature? Let us know! Your feedback helps make ViVo better for everyone.
                    </p>
                </div>
                
                <form id="quick-report-form">
                    <div style="margin-bottom: 20px;">
                        <label for="report-type" style="display: block; color: #4facfe; font-weight: 600; margin-bottom: 8px;">
                            <i class="fas fa-tag" style="margin-right: 8px;"></i>Issue Type:
                        </label>
                        <select id="report-type" style="width: 100%; padding: 12px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #e0e0e0;">
                            <option value="bug">Bug Report</option>
                            <option value="enhancement">Feature Request</option>
                            <option value="question">Question/Help</option>
                            <option value="documentation">Documentation Issue</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label for="report-title" style="display: block; color: #4facfe; font-weight: 600; margin-bottom: 8px;">
                            <i class="fas fa-heading" style="margin-right: 8px;"></i>Title:
                        </label>
                        <input 
                            type="text" 
                            id="report-title" 
                            placeholder="Brief description of the issue" 
                            style="width: 100%; padding: 12px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #e0e0e0;"
                            required
                        />
                    </div>
                    
                    <div style="margin-bottom: 25px;">
                        <label for="report-description" style="display: block; color: #4facfe; font-weight: 600; margin-bottom: 8px;">
                            <i class="fas fa-align-left" style="margin-right: 8px;"></i>Description:
                        </label>
                        <textarea 
                            id="report-description" 
                            rows="6" 
                            placeholder="Please provide details:&#10;• For bugs: steps to reproduce, expected vs actual behavior&#10;• For features: describe what you'd like to see"
                            style="width: 100%; padding: 12px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #e0e0e0; resize: vertical; line-height: 1.5;"
                            required
                        ></textarea>
                    </div>
                </form>
                
                <div style="display: flex; gap: 10px; justify-content: space-between; align-items: center;">
                    <div style="display: flex; gap: 10px;">
                        <button onclick="window.githubIssues.submitQuickReport()" style="background: linear-gradient(45deg, #28a745, #20c997); color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px;">
                            <i class="fas fa-paper-plane" style="margin-right: 8px;"></i>Send Report
                        </button>
                        <button onclick="window.githubIssues.loadIssues()" style="background: linear-gradient(45deg, #6c757d, #495057); color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px;">
                            <i class="fas fa-list" style="margin-right: 8px;"></i>View Dashboard
                        </button>
                    </div>
                    <a href="https://github.com/${this.owner}/${this.repo}/issues" target="_blank" style="color: #4facfe; text-decoration: none; font-size: 0.9rem;">
                        <i class="fab fa-github" style="margin-right: 6px;"></i>View on GitHub
                    </a>
                </div>
            </div>
        `;
    }

    generateLoadingContent() {
        return `
            <div class="modal-content github-issues-modal" style="background: rgba(40, 40, 40, 0.95); border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.2); padding: 30px; max-width: 800px; width: 90%; color: #e0e0e0; text-align: center;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 15px;">
                    <h2 style="margin: 0; color: #e0e0e0; font-size: 1.8rem;">
                        <i class="fab fa-github" style="margin-right: 10px; color: #4facfe;"></i>
                        GitHub Issues
                    </h2>
                    <button class="welcome-close modal-close" title="Close">×</button>
                </div>
                <div style="padding: 40px;">
                    <div class="loading-spinner" style="width: 40px; height: 40px; border: 4px solid rgba(79, 172, 254, 0.2); border-top: 4px solid #4facfe; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                    <p style="color: #ccc; font-size: 1.1rem;">Securing proxy integration...</p>
                </div>
                <style>
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                </style>
            </div>
        `;
    }

    generateErrorContent(error) {
        return `
            <div class="modal-content github-issues-modal" style="background: rgba(40, 40, 40, 0.95); border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.2); padding: 30px; max-width: 600px; width: 90%; color: #e0e0e0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 15px;">
                    <h2 style="margin: 0; color: #e0e0e0; font-size: 1.8rem;">
                        <i class="fab fa-github" style="margin-right: 10px; color: #4facfe;"></i>
                        GitHub Proxy Status
                    </h2>
                    <button class="welcome-close modal-close" title="Close">×</button>
                </div>
                <div style="background: rgba(220, 53, 69, 0.1); padding: 20px; border-radius: 10px; border-left: 4px solid #dc3545; text-align: center;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #dc3545; margin-bottom: 15px;"></i>
                    <h3 style="margin: 0 0 10px 0; color: #dc3545;">Connection Error</h3>
                    <p style="margin: 0 0 15px 0; color: #ccc;">${error}</p>
                    <button onclick="window.githubIssues.retryConnection()" style="background: linear-gradient(45deg, #4facfe, #00f2fe); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">
                        Try Again
                    </button>
                </div>
            </div>
        `;
    }

    generateIssuesListContent(issues) {
        const openIssues = issues.filter(issue => issue.state === 'open' && !issue.pull_request);
        const closedIssues = issues.filter(issue => issue.state === 'closed' && !issue.pull_request);
        
        const issuesHtml = issues.length === 0 ? 
            `<div style="text-align: center; padding: 40px; color: #999;">
                <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 15px;"></i>
                <p>No issues found in the repository.</p>
            </div>` :
            issues.filter(issue => !issue.pull_request).map(issue => this.generateIssueCard(issue)).join('');

        return `
            <div class="modal-content github-issues-modal" style="background: rgba(40, 40, 40, 0.95); border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.2); padding: 0; max-width: 1000px; width: 95%; max-height: 85vh; color: #e0e0e0; display: flex; flex-direction: column;">
                <div style="padding: 25px 30px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); flex-shrink: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h2 style="margin: 0; color: #e0e0e0; font-size: 1.8rem;">
                            <i class="fab fa-github" style="margin-right: 10px; color: #4facfe;"></i>
                            ViVo Platform Issues (Dashboard)
                        </h2>
                        <button class="welcome-close modal-close" title="Close">×</button>
                    </div>
                    
                    <div class="issues-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px;">
                        <div style="background: rgba(79, 172, 254, 0.2); padding: 15px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 1.5em; font-weight: bold; color: #4facfe;">${openIssues.length}</div>
                            <div style="font-size: 0.9em; color: #bbb;">Open</div>
                        </div>
                        <div style="background: rgba(40, 167, 69, 0.2); padding: 15px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 1.5em; font-weight: bold; color: #28a745;">${closedIssues.length}</div>
                            <div style="font-size: 0.9em; color: #bbb;">Closed</div>
                        </div>
                        <div style="background: rgba(255, 193, 7, 0.2); padding: 15px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 1.5em; font-weight: bold; color: #ffc107;">${issues.length}</div>
                            <div style="font-size: 0.9em; color: #bbb;">Total</div>
                        </div>
                    </div>
                    
                    <div class="issues-actions" style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button onclick="window.githubIssues.showQuickReport()" style="background: linear-gradient(45deg, #28a745, #20c997); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                            <i class="fas fa-plus" style="margin-right: 8px;"></i>New Issue
                        </button>
                        <button onclick="window.githubIssues.refreshIssues()" style="background: linear-gradient(45deg, #4facfe, #00f2fe); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                            <i class="fas fa-sync-alt" style="margin-right: 8px;"></i>Refresh
                        </button>
                    </div>
                </div>
                
                <div class="issues-container" style="flex: 1; overflow-y: auto; padding: 20px 30px 30px; min-height: 200px;">
                    ${issuesHtml}
                </div>
            </div>
        `;
    }

    generateIssueCard(issue) {
        const formattedIssue = this.formatIssueForDisplay(issue);
        const stateColor = formattedIssue.state === 'open' ? '#28a745' : '#6c757d';
        const stateIcon = formattedIssue.state === 'open' ? 'fa-exclamation-circle' : 'fa-check-circle';
        
        const labelsHtml = formattedIssue.labels.map(label => 
            `<span style="background: #${label.color}; color: ${this.getContrastColor(label.color)}; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; margin-right: 5px;">${label.name}</span>`
        ).join('');
        
        return `
            <div class="issue-card" style="background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 20px; margin-bottom: 15px; border-left: 4px solid ${stateColor}; transition: all 0.3s ease;" onmouseover="this.style.background='rgba(255, 255, 255, 0.08)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; margin-bottom: 8px;">
                            <span style="background: ${stateColor}; color: white; padding: 4px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; margin-right: 10px;">
                                <i class="fas ${stateIcon}" style="margin-right: 4px;"></i>${formattedIssue.state.toUpperCase()}
                            </span>
                            <span style="color: #999; font-size: 0.9rem;">#${formattedIssue.number}</span>
                        </div>
                        <h3 style="margin: 0 0 10px 0; color: #e0e0e0; font-size: 1.2rem; line-height: 1.3;">
                            <a href="${formattedIssue.htmlUrl}" target="_blank" style="color: #4facfe; text-decoration: none;">
                                ${formattedIssue.title}
                            </a>
                        </h3>
                        ${formattedIssue.body ? `<p style="margin: 0 0 10px 0; color: #ccc; font-size: 0.9rem; line-height: 1.4; max-height: 60px; overflow: hidden;">${formattedIssue.body.substring(0, 150)}${formattedIssue.body.length > 150 ? '...' : ''}</p>` : ''}
                        ${labelsHtml ? `<div style="margin: 10px 0;">${labelsHtml}</div>` : ''}
                    </div>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                    <div style="display: flex; align-items: center; font-size: 0.85rem; color: #999;">
                        <img src="${formattedIssue.user.avatar_url}" alt="${formattedIssue.user.login}" style="width: 20px; height: 20px; border-radius: 50%; margin-right: 8px;">
                        <span style="margin-right: 15px;">${formattedIssue.user.login}</span>
                        <span style="margin-right: 15px;">Created: ${formattedIssue.createdDate}</span>
                        ${formattedIssue.comments > 0 ? `<span><i class="fas fa-comments" style="margin-right: 4px;"></i>${formattedIssue.comments}</span>` : ''}
                    </div>
                    <div style="display: flex; gap: 8px;">
                        ${formattedIssue.state === 'open' ? 
                            `<button onclick="window.githubIssues.closeIssue(${formattedIssue.number})" style="background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem;">Close</button>` :
                            `<button onclick="window.githubIssues.reopenIssue(${formattedIssue.number})" style="background: #28a745; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem;">Reopen</button>`
                        }
                        <button onclick="window.githubIssues.showComments(${formattedIssue.number})" style="background: #17a2b8; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem;">Comments</button>
                    </div>
                </div>
            </div>
        `;
    }

    getContrastColor(hexColor) {
        const hex = hexColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return brightness > 128 ? '#000000' : '#ffffff';
    }
}

// Global instance and integration manager
class GitHubIssuesManager {
    constructor() {
        this.service = new GitHubIssuesService();
        this.currentIssues = [];
        
        // Inicialización automática y segura en background
        this.initBackend();
    }
    
    async initBackend() {
        try {
            await this.service.initialize();
        } catch (e) {
            console.warn("Backend unreached on instantiation:", e.message);
        }
    }

    async retryConnection() {
        window.modalManager.show('github-issues', { loading: true });
        try {
            await this.service.initialize();
            this.showNotification('Connected to proxy successfully!', 'success');
            this.showQuickReport();
        } catch (error) {
            window.modalManager.show('github-issues', { error: error.message });
        }
    }

    // MODIFICADO: Tu propuesta estructural corregida de forma asíncrona robusta
    async submitQuickReport() {
        const type = document.getElementById('report-type')?.value;
        const title = document.getElementById('report-title')?.value?.trim();
        const description = document.getElementById('report-description')?.value?.trim();
        
        if (!title || !description) {
            this.showNotification('Please fill in both title and description', 'error');
            return;
        }

        const typeConfigs = {
            bug: { emoji: '🐛', prefix: '[BUG]' },
            enhancement: { emoji: '✨', prefix: '[FEATURE REQUEST]' },
            question: { emoji: '❓', prefix: '[QUESTION]' },
            documentation: { emoji: '📚', prefix: '[DOCS]' },
            other: { emoji: '🔧', prefix: '[OTHER]' }
        };

        const config = typeConfigs[type] || typeConfigs.other;
        const issueTitle = `${config.emoji} ${config.prefix} ${title}`;
        
        const issueBody = `${description}

---
**Report Details:**
- **Type:** ${type}
- **Timestamp:** ${new Date().toISOString()}
- **User Agent:** ${navigator.userAgent}
- **URL:** ${window.location.href}

*This issue was submitted via the ViVo Platform secure proxy server*`;

        try {
            this.showLoadingState();
            
            // Reemplaza tus promesas/timeouts fijos por comprobación reactiva real:
            if (!this.service.initialized) {
                await this.service.initialize(); 
            }
            
            const labels = this.service.getIssueLabels(type, config);
            
            // Ejecución segura de la mutación hacia Vercel
            const newIssue = await this.service.createIssue(issueTitle, issueBody, labels);
            
            if (Array.isArray(this.currentIssues)) {
                this.currentIssues.unshift(newIssue);
            }
            
            this.showNotification('Issue created successfully!', 'success');
            this.showSuccessMessage(newIssue);
            
        } catch (error) {
            this.showNotification('Failed to submit report via backend.', 'error');
            this.showErrorState(error.message);
        }
    }

    showLoadingState() {
        const loadingHtml = this.service.generateLoadingContent();
        const modalContent = document.querySelector('.github-issues-modal');
        if (modalContent) {
            modalContent.outerHTML = loadingHtml;
        }
    }

    showErrorState(errorMessage) {
        window.modalManager.show('github-issues', { error: errorMessage });
    }

    showSuccessMessage(issue) {
        const successHtml = `
            <div class="modal-content github-issues-modal" style="background: rgba(40, 40, 40, 0.95); border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.2); padding: 30px; max-width: 600px; width: 90%; color: #e0e0e0; text-align: center;">
                <div style="margin-bottom: 30px;">
                    <i class="fas fa-check-circle" style="font-size: 48px; color: #28a745; margin-bottom: 20px;"></i>
                    <h2 style="margin: 0 0 15px 0; color: #28a745;">Report Submitted!</h2>
                    <p style="color: #ccc;">Thank you for helping improve ViVo Platform.</p>
                </div>
                <div style="background: rgba(40, 167, 69, 0.1); padding: 20px; border-radius: 10px; border-left: 4px solid #28a745; margin-bottom: 25px;">
                    <p style="margin: 0; color: #28a745; font-weight: 600;">Issue #${issue.number} processing</p>
                </div>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button onclick="window.githubIssues.loadIssues()" style="background: linear-gradient(45deg, #4facfe, #00f2fe); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        Go to Dashboard
                    </button>
                    <button class="welcome-close modal-close" style="background: #6c757d; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer;">Close</button>
                </div>
            </div>
        `;
        setTimeout(() => {
            const modalContent = document.querySelector('.github-issues-modal');
            if (modalContent) modalContent.outerHTML = successHtml;
        }, 300);
    }

    async showQuickReport() {
        window.modalManager.show('github-issues', { showReportForm: true });
    }

    async loadIssues() {
        window.modalManager.show('github-issues', { loading: true });
        try {
            if (!this.service.initialized) {
                await this.service.initialize();
            }
            const issues = await this.service.getIssues('all');
            this.currentIssues = issues;
            window.modalManager.show('github-issues', { issues });
        } catch (error) {
            window.modalManager.show('github-issues', { error: error.message });
        }
    }

    async refreshIssues() {
        try {
            const refreshButton = document.querySelector('button[onclick*="refreshIssues()"]');
            if (refreshButton) {
                refreshButton.disabled = true;
                refreshButton.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i>Refreshing...';
            }
            
            const issues = await this.service.getIssues('all');
            this.currentIssues = issues;
            window.modalManager.show('github-issues', { issues });
            this.showNotification('Issues updated!', 'success');
        } catch (error) {
            this.showNotification('Failed to refresh data', 'error');
        } finally {
            const refreshButton = document.querySelector('button[onclick*="refreshIssues()"]');
            if (refreshButton) {
                refreshButton.disabled = false;
                refreshButton.innerHTML = '<i class="fas fa-sync-alt" style="margin-right: 8px;"></i>Refresh';
            }
        }
    }

    async closeIssue(issueNumber) {
        try {
            this.service.toggleButtonState(issueNumber, 'closeIssue', true, 'Closing...');
            await this.service.closeIssue(issueNumber);
            this.showNotification(`Closed #${issueNumber}`, 'success');
            this.service.updateIssueStateInCache(issueNumber, 'closed');
            this.loadIssues();
        } catch (error) {
            this.showNotification(error.message, 'error');
            this.service.toggleButtonState(issueNumber, 'closeIssue', false, 'Close');
        }
    }

    async reopenIssue(issueNumber) {
        try {
            this.service.toggleButtonState(issueNumber, 'reopenIssue', true, 'Reopening...');
            await this.service.reopenIssue(issueNumber);
            this.showNotification(`Reopened #${issueNumber}`, 'success');
            this.service.updateIssueStateInCache(issueNumber, 'open');
            this.loadIssues();
        } catch (error) {
            this.showNotification(error.message, 'error');
            this.service.toggleButtonState(issueNumber, 'reopenIssue', false, 'Reopen');
        }
    }

    async showComments(issueNumber) {
        try {
            const comments = await this.service.getIssueComments(issueNumber);
            const commentsHtml = this.generateCommentsView(issueNumber, comments);
            const container = document.querySelector('.github-issues-modal .issues-container');
            if (container) container.innerHTML = commentsHtml;
        } catch (error) {
            this.showNotification('Could not load comments', 'error');
        }
    }

    generateCommentsView(issueNumber, comments) {
        const issue = this.currentIssues.find(i => i.number === issueNumber);
        const commentsHtml = comments.length === 0 ? 
            '<div style="text-align: center; padding: 20px; color: #999;">No comments yet.</div>' :
            comments.map(comment => `
                <div style="background: rgba(255, 255, 255, 0.05); padding: 15px; border-radius: 8px; margin-bottom: 10px;">
                    <div style="display: flex; align-items: center; margin-bottom: 10px;">
                        <img src="${comment.user.avatar_url}" alt="${comment.user.login}" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 10px;">
                        <span style="color: #4facfe; font-weight: 600;">${comment.user.login}</span>
                        <span style="color: #999; margin-left: 10px; font-size: 0.85rem;">${new Date(comment.created_at).toLocaleString()}</span>
                    </div>
                    <div style="color: #ccc; line-height: 1.5; white-space: pre-wrap;">${comment.body}</div>
                </div>
            `).join('');

        return `
            <div class="comments-view" style="display: flex; flex-direction: column; gap: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; color: #4facfe;">Comments (#${issueNumber})</h3>
                    <button onclick="window.githubIssues.loadIssues()" style="background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">← Back</button>
                </div>
                <div style="background: rgba(255, 255, 255, 0.05); padding: 15px; border-radius: 8px;">
                    <h4 style="margin: 0 0 5px 0;">${issue?.title || ''}</h4>
                    <p style="margin: 0; color: #bbb; font-size: 0.95rem;">${issue?.body || ''}</p>
                </div>
                <div class="comments-list">${commentsHtml}</div>
                <div style="background: rgba(255, 255, 255, 0.03); padding: 15px; border-radius: 8px;">
                    <textarea id="new-comment-body" rows="3" placeholder="Write a comment..." style="width: 100%; padding: 10px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: white; resize: vertical;"></textarea>
                    <button onclick="window.githubIssues.addComment(${issueNumber})" style="margin-top: 10px; background: #4facfe; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; float: right;">Post Comment</button>
                    <div style="clear: both;"></div>
                </div>
            </div>
        `;
    }

    async addComment(issueNumber) {
        const body = document.getElementById('new-comment-body')?.value?.trim();
        if (!body) return;

        try {
            await this.service.addComment(issueNumber, body);
            this.showNotification('Comment added!', 'success');
            this.showComments(issueNumber);
        } catch (error) {
            this.showNotification('Failed to add comment', 'error');
        }
    }

    showNotification(message, type = 'info') {
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
}

// Inicialización del entorno web
if (typeof window !== 'undefined') {
    window.GitHubIssuesService = GitHubIssuesService;
    window.githubIssues = new GitHubIssuesManager();
    
    const registerModal = () => {
        if (window.modalManager) {
            window.modalManager.register('github-issues', (data) => {
                return window.githubIssues.service.generateModalContent.call(window.githubIssues.service, data);
            });
        } else {
            setTimeout(registerModal, 100);
        }
    };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', registerModal);
    } else {
        registerModal();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GitHubIssuesService;
}

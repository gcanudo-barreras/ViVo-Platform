class GitHubIssuesService {
    constructor() {
        this.owner = 'gcanudo-barreras';
        this.repo = 'ViVo-Platform';
        this.token = null;
        this.defaultToken = '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';
        this.apiBase = 'https://api.github.com';
        this.issues = [];
        this.initialized = false;
        this.useDefaultToken = true;
    }

    async initialize(token) {
        if (!token) {
            throw new Error('GitHub token is required');
        }
        
        this.token = token;
        
        try {
            await this.validateToken();
            this.initialized = true;
            return true;
        } catch (error) {
            this.initialized = false;
            throw new Error(`Failed to initialize GitHub service: ${error.message}`);
        }
    }

    async validateToken() {
        const response = await this.makeRequest('GET', '/user');
        if (!response.ok) {
            throw new Error('Invalid GitHub token');
        }
        return response.json();
    }

    ensureInitialized() {
        if (!this.initialized) {
            throw new Error('GitHub service not initialized. Please provide a valid token.');
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
        const canUseLabels = this.token !== this.defaultToken;
        
        if (canUseLabels) {
            try {
                const labelName = config.label || 'bug';
                labels.push(labelName);
                if (type === 'bug') labels.push('needs-triage');
            } catch (e) {
            }
        }
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
        const issue = this.currentIssues.find(issue => issue.number === issueNumber);
        if (issue) {
            issue.state = state;
            issue.closed_at = state === 'closed' ? new Date().toISOString() : null;
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

    async makeRequest(method, endpoint, data = null) {
        const url = `${this.apiBase}${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'ViVo-Platform/1.0'
        };

        const config = {
            method,
            headers
        };

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
        const { issues = [], loading = false, error = null, token = '', showReportForm = false, sessionToken = '' } = data;
        
        if (token === 'show-setup') {
            return this.generateTokenSetupForm(sessionToken);
        }

        if (showReportForm) {
            return this.generateQuickReportForm();
        }
        
        if (data.hasOwnProperty('issues')) {
            return this.generateIssuesListContent(issues);
        }
        
        if (this.initialized && !token && !loading && !error) {
            if (this.issues && this.issues.length > 0) {
                return this.generateIssuesListContent(this.issues);
            } else {
                return this.generateQuickReportForm();
            }
        }
        
        if (!this.initialized && !token && !loading && !error) {
            return this.generateQuickReportForm();
        }

        if (loading) {
            return this.generateLoadingContent();
        }

        if (error) {
            return this.generateErrorContent(error);
        }

        return this.generateIssuesListContent(issues);
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
                            placeholder="Please provide details:&#10;• For bugs: steps to reproduce, expected vs actual behavior&#10;• For features: describe what you'd like to see&#10;• Include browser info if relevant&#10;• Screenshots or data examples are helpful"
                            style="width: 100%; padding: 12px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #e0e0e0; resize: vertical; line-height: 1.5;"
                            required
                        ></textarea>
                    </div>
                    
                    <div style="background: rgba(255, 255, 255, 0.05); padding: 15px; border-radius: 8px; margin-bottom: 25px;">
                        <p style="margin: 0 0 10px 0; color: #ffc107; font-size: 0.9rem;">
                            <i class="fas fa-lightbulb" style="margin-right: 8px;"></i>
                            <strong>Tips for better reports:</strong>
                        </p>
                        <ul style="margin: 0; padding-left: 20px; color: #bbb; font-size: 0.85rem; line-height: 1.4;">
                            <li>Be specific about what went wrong</li>
                            <li>Include your browser and OS if relevant</li>
                            <li>Mention what dataset/analysis you were running</li>
                        </ul>
                    </div>
                </form>
                
                <div style="display: flex; gap: 10px; justify-content: space-between; align-items: center;">
                    <div style="display: flex; gap: 10px;">
                        <button onclick="window.githubIssues.submitQuickReport()" style="background: linear-gradient(45deg, #28a745, #20c997); color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px;">
                            <i class="fas fa-paper-plane" style="margin-right: 8px;"></i>Send Report
                        </button>
                        <button onclick="window.githubIssues.showAdvancedOptions()" style="background: linear-gradient(45deg, #6c757d, #495057); color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px;">
                            <i class="fas fa-cog" style="margin-right: 8px;"></i>Advanced
                        </button>
                    </div>
                    <a href="https://github.com/${this.owner}/${this.repo}/issues" target="_blank" style="color: #4facfe; text-decoration: none; font-size: 0.9rem;">
                        <i class="fab fa-github" style="margin-right: 6px;"></i>View all issues
                    </a>
                </div>
            </div>
        `;
    }

    generateTokenSetupForm(sessionToken = '') {
        return `
            <div class="modal-content github-issues-modal" style="background: rgba(40, 40, 40, 0.95); border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.2); padding: 30px; max-width: 600px; width: 90%; color: #e0e0e0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 15px;">
                    <h2 style="margin: 0; color: #e0e0e0; font-size: 1.8rem;">
                        <i class="fab fa-github" style="margin-right: 10px; color: #4facfe;"></i>
                        GitHub Issues
                    </h2>
                    <button class="welcome-close modal-close" title="Close">×</button>
                </div>
                
                <div class="token-setup-section">
                    <div style="background: rgba(79, 172, 254, 0.1); padding: 20px; border-radius: 10px; border-left: 4px solid #4facfe; margin-bottom: 20px;">
                        <h3 style="margin: 0 0 10px 0; color: #4facfe;">Advanced: Manage Issues</h3>
                        <p style="margin: 0 0 15px 0; color: #ccc; line-height: 1.5;">
                            <strong>For developers and maintainers:</strong> Use your personal GitHub token to view, manage, and respond to issues. Regular users can simply use the "Back to Report" option.
                        </p>
                        <div style="background: rgba(255, 255, 255, 0.05); padding: 15px; border-radius: 8px; margin: 15px 0;">
                            <p style="margin: 0 0 10px 0; font-weight: 600; color: #4facfe;">How to get your token:</p>
                            <ol style="margin: 0; padding-left: 20px; color: #bbb; line-height: 1.5;">
                                <li>Go to <a href="https://github.com/settings/tokens" target="_blank" style="color: #4facfe;">GitHub Settings → Developer Settings → Personal Access Tokens</a></li>
                                <li>Click "Generate new token (classic)"</li>
                                <li>Select scopes: <code style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 3px;">repo</code> (for full access) or <code style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 3px;">public_repo</code> (for public repos only)</li>
                                <li>Copy the generated token</li>
                            </ol>
                        </div>
                    </div>
                    
                    <div class="token-input-section">
                        <label for="github-token-input" style="display: block; color: #4facfe; font-weight: 600; margin-bottom: 10px;">
                            GitHub Personal Access Token:
                        </label>
                        <input 
                            type="password" 
                            id="github-token-input" 
                            placeholder="ghp_xxxxxxxxxxxxxxxxxx" 
                            value="${sessionToken}"
                            style="width: 100%; padding: 12px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #e0e0e0; font-family: monospace; margin-bottom: 20px;"
                        />
                        <div style="display: flex; gap: 10px; justify-content: space-between; flex-wrap: wrap;">
                            <button 
                                onclick="window.githubIssues.showQuickReport()" 
                                style="background: #6c757d; color: white; border: none; padding: 12px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.9rem;"
                            >
                                Back to Report
                            </button>
                            <div style="display: flex; gap: 8px;">
                                <button 
                                    onclick="window.githubIssues.setupToken()" 
                                    style="background: linear-gradient(45deg, #4facfe, #00f2fe); color: white; border: none; padding: 12px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.9rem;"
                                >
                                    <i class="fas fa-cogs" style="margin-right: 6px;"></i>Manage Issues
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 20px; padding: 15px; background: rgba(255, 193, 7, 0.1); border-left: 4px solid #ffc107; border-radius: 8px;">
                        <p style="margin: 0; color: #ffc107; font-size: 0.9rem;">
                            <i class="fas fa-shield-alt" style="margin-right: 8px;"></i>
                            Your token is stored locally in your browser session and is never sent to any server except GitHub's API.
                        </p>
                    </div>
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
                    <p style="color: #ccc; font-size: 1.1rem;">Loading GitHub Issues...</p>
                </div>
                
                <style>
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
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
                        GitHub Issues
                    </h2>
                    <button class="welcome-close modal-close" title="Close">×</button>
                
                <div style="background: rgba(220, 53, 69, 0.1); padding: 20px; border-radius: 10px; border-left: 4px solid #dc3545; text-align: center;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #dc3545; margin-bottom: 15px;"></i>
                    <h3 style="margin: 0 0 10px 0; color: #dc3545;">Connection Error</h3>
                    <p style="margin: 0 0 15px 0; color: #ccc;">${error}</p>
                    <button onclick="window.modalManager.hide('github-issues'); setTimeout(() => window.modalManager.show('github-issues'), 100);" style="background: linear-gradient(45deg, #4facfe, #00f2fe); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">
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
                            ViVo Platform Issues
                        </h2>
                        <button class="welcome-close modal-close" title="Close">×</button>
                    </div>
                    
                    <div class="issues-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px;">
                        <div style="background: rgba(79, 172, 254, 0.2); padding: 15px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 1.5em; font-weight: bold; color: #4facfe;">${openIssues.length}</div>
                            <div style="font-size: 0.9em; color: #bbb;">Open Issues</div>
                        </div>
                        <div style="background: rgba(40, 167, 69, 0.2); padding: 15px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 1.5em; font-weight: bold; color: #28a745;">${closedIssues.length}</div>
                            <div style="font-size: 0.9em; color: #bbb;">Closed Issues</div>
                        </div>
                        <div style="background: rgba(255, 193, 7, 0.2); padding: 15px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 1.5em; font-weight: bold; color: #ffc107;">${issues.length}</div>
                            <div style="font-size: 0.9em; color: #bbb;">Total Issues</div>
                        </div>
                    </div>
                    
                    <div class="issues-actions" style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button onclick="window.githubIssues.showQuickReport()" style="background: linear-gradient(45deg, #28a745, #20c997); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                            <i class="fas fa-plus" style="margin-right: 8px;"></i>New Issue
                        </button>
                        <button onclick="window.githubIssues.refreshIssues()" style="background: linear-gradient(45deg, #4facfe, #00f2fe); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                            <i class="fas fa-sync-alt" style="margin-right: 8px;"></i>Refresh
                        </button>
                        <a href="https://github.com/${this.owner}/${this.repo}/issues" target="_blank" style="background: linear-gradient(45deg, #6c757d, #495057); color: white; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 600;">
                            <i class="fab fa-github" style="margin-right: 8px;"></i>View on GitHub
                        </a>
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

// Global instance and modal integration
class GitHubIssuesManager {
    constructor() {
        this.service = new GitHubIssuesService();
        this.currentIssues = [];
        
        // Try to restore token from session storage on startup
        this.restoreTokenFromSession();
    }
    
    restoreTokenFromSession() {
        try {
            const savedToken = sessionStorage.getItem('github_token');
            if (savedToken) {
                this.service.initialize(savedToken).catch(() => {
                    sessionStorage.removeItem('github_token');
                });
            }
        } catch (error) {
            // Silent fail
        }
    }
    
    saveTokenToSession(token) {
        try {
            sessionStorage.setItem('github_token', token);
        } catch (error) {
            // Silent fail
        }
    }
    
    clearTokenFromSession() {
        try {
            sessionStorage.removeItem('github_token');
        } catch (error) {
            // Silent fail
        }
    }

    async setupToken() {
        const tokenInput = document.getElementById('github-token-input');
        const token = tokenInput?.value?.trim();
        
        if (!token) {
            this.showNotification('Please enter a valid GitHub token', 'error');
            return;
        }

        try {
            await window.modalManager.hide('github-issues');
            await new Promise(resolve => setTimeout(resolve, 100));
            
            window.modalManager.show('github-issues', { loading: true });
            
            await this.service.initialize(token);
            this.saveTokenToSession(token);
            
            let issues;
            try {
                issues = await this.service.getIssues('all');
            } catch (error) {
                const openIssues = await this.service.getIssues('open');
                const closedIssues = await this.service.getIssues('closed');
                issues = [...openIssues, ...closedIssues];
            }
            this.currentIssues = issues;
            
            await window.modalManager.hide('github-issues');
            await new Promise(resolve => setTimeout(resolve, 100));
            
            window.modalManager.show('github-issues', { issues });
            this.showNotification('Successfully connected to GitHub!', 'success');
        } catch (error) {
            await window.modalManager.hide('github-issues');
            await new Promise(resolve => setTimeout(resolve, 100));
            window.modalManager.show('github-issues', { error: error.message });
        }
    }

    getSessionToken() {
        try {
            return sessionStorage.getItem('github_token') || ''; 
        } catch (error) {
            return ''; 
        }
    }

    async submitQuickReport() {
        const type = document.getElementById('report-type')?.value;
        const title = document.getElementById('report-title')?.value?.trim();
        const description = document.getElementById('report-description')?.value?.trim();
        
        if (!title || !description) {
            this.showNotification('Please fill in both title and description', 'error');
            return;
        }

        // Map issue type to emoji and prefix for clear categorization
        const typeConfigs = {
            bug: { emoji: '🐛', prefix: '[BUG]' },
            enhancement: { emoji: '✨', prefix: '[FEATURE REQUEST]' },
            question: { emoji: '❓', prefix: '[QUESTION]' },
            documentation: { emoji: '📚', prefix: '[DOCS]' },
            other: { emoji: '🔧', prefix: '[OTHER]' }
        };

        const config = typeConfigs[type] || typeConfigs.other;
        const issueTitle = `${config.emoji} ${config.prefix} ${title}`;
        
        // Add user agent info to help with debugging
        const issueBody = `${description}

---
**Report Details:**
- **Type:** ${type}
- **Timestamp:** ${new Date().toISOString()}
- **User Agent:** ${navigator.userAgent}
- **URL:** ${window.location.href}

*This issue was submitted via the ViVo Platform reporting system*`;

        try {
            this.showLoadingState();
            
            if (!this.service.initialized) {
                await this.service.initialize(this.service.defaultToken);
            }
            
            const labels = this.getIssueLabels(type, config);
            
            const newIssue = await this.service.createIssue(issueTitle, issueBody, labels);
            
            if (Array.isArray(this.currentIssues)) {
                this.currentIssues.unshift(newIssue);
            }
            
            this.showNotification('Issue created successfully! Thank you for your feedback.', 'success');
            
            setTimeout(() => {
                this.showNotification('Note: New issues may take 1-2 minutes to appear in the issues list due to GitHub API indexing.', 'info', 8000);
            }, 2000);
            
            this.showSuccessMessage(newIssue);
            
            setTimeout(async () => {
                try {
                    if (this.service.initialized) {
                        const issues = await this.service.getIssues('all');
                        this.currentIssues = issues;
                    }
                } catch (error) {
                    // Silent fail
                }
            }, 2000);
            
        } catch (error) {
            this.showNotification('Failed to submit report. Please try again or contact support.', 'error');
            this.showErrorState(error.message);
        }
    }

    showLoadingState() {
        const loadingHtml = `
            <div class="modal-content github-issues-modal" style="background: rgba(40, 40, 40, 0.95); border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.2); padding: 30px; max-width: 600px; width: 90%; color: #e0e0e0; text-align: center;">
                <div style="margin-bottom: 30px;">
                    <div class="loading-animation" style="width: 60px; height: 60px; border: 4px solid rgba(79, 172, 254, 0.2); border-top: 4px solid #4facfe; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;">
                    </div>
                    <h2 style="margin: 0 0 15px 0; color: #4facfe;">Submitting Report...</h2>
                    <p style="color: #ccc; line-height: 1.5;">
                        Please wait while we send your feedback to the development team.
                    </p>
                </div>
                
                <div class="loading-dots" style="display: flex; justify-content: center; gap: 8px; margin-top: 20px;">
                    <div style="width: 12px; height: 12px; background: #4facfe; border-radius: 50%; animation: bounce 1.4s ease-in-out 0s infinite both;"></div>
                    <div style="width: 12px; height: 12px; background: #4facfe; border-radius: 50%; animation: bounce 1.4s ease-in-out 0.16s infinite both;"></div>
                    <div style="width: 12px; height: 12px; background: #4facfe; border-radius: 50%; animation: bounce 1.4s ease-in-out 0.32s infinite both;"></div>
                </div>
                
                <style>
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    
                    @keyframes bounce {
                        0%, 80%, 100% {
                            transform: scale(0);
                        }
                        40% {
                            transform: scale(1);
                        }
                    }
                </style>
            </div>
        `;
        
        // Update modal content directly
        const modalContent = document.querySelector('.github-issues-modal');
        if (modalContent) {
            modalContent.outerHTML = loadingHtml;
        }
    }

    showErrorState(errorMessage) {
        const errorHtml = `
            <div class="modal-content github-issues-modal" style="background: rgba(40, 40, 40, 0.95); border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.2); padding: 30px; max-width: 600px; width: 90%; color: #e0e0e0; text-align: center;">
                <div style="margin-bottom: 30px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #dc3545; margin-bottom: 20px; animation: shake 0.8s ease-in-out;"></i>
                    <h2 style="margin: 0 0 15px 0; color: #dc3545;">Submission Failed</h2>
                    <p style="color: #ccc; line-height: 1.5;">
                        We couldn't submit your report right now. Please try again or contact support.
                    </p>
                </div>
                
                <div style="background: rgba(220, 53, 69, 0.1); padding: 15px; border-radius: 8px; border-left: 4px solid #dc3545; margin-bottom: 25px;">
                    <p style="margin: 0; color: #dc3545; font-size: 0.9rem; word-break: break-word;">
                        ${errorMessage ? errorMessage.substring(0, 200) + (errorMessage.length > 200 ? '...' : '') : 'Unknown error occurred'}
                    </p>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button onclick="window.githubIssues.showQuickReport()" style="background: linear-gradient(45deg, #4facfe, #00f2fe); color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                        <i class="fas fa-redo" style="margin-right: 8px;"></i>Try Again
                    </button>
                    <button onclick="window.modalManager.hide('github-issues')" style="background: #6c757d; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                        Close
                    </button>
                </div>
                
                <style>
                    @keyframes shake {
                        0%, 100% { transform: translateX(0); }
                        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
                        20%, 40%, 60%, 80% { transform: translateX(5px); }
                    }
                </style>
            </div>
        `;
        
        // Update modal content directly
        setTimeout(() => {
            const modalContent = document.querySelector('.github-issues-modal');
            if (modalContent) {
                modalContent.outerHTML = errorHtml;
            }
        }, 100);
    }

    showSuccessMessage(issue) {
        const successHtml = `
            <div class="modal-content github-issues-modal" style="background: rgba(40, 40, 40, 0.95); border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.2); padding: 30px; max-width: 600px; width: 90%; color: #e0e0e0; text-align: center;">
                <div style="margin-bottom: 30px;">
                    <i class="fas fa-check-circle" style="font-size: 48px; color: #28a745; margin-bottom: 20px;"></i>
                    <h2 style="margin: 0 0 15px 0; color: #28a745;">Report Submitted Successfully!</h2>
                    <p style="color: #ccc; line-height: 1.5;">
                        Thank you for helping improve ViVo Platform. Your feedback is valuable to us.
                    </p>
                </div>
                
                <div style="background: rgba(40, 167, 69, 0.1); padding: 20px; border-radius: 10px; border-left: 4px solid #28a745; margin-bottom: 25px;">
                    <p style="margin: 0 0 10px 0; color: #28a745; font-weight: 600;">
                        Issue #${issue.number} created
                    </p>
                    <p style="margin: 0; color: #ccc; font-size: 0.9rem;">
                        You can track the progress of your report using the link below.
                    </p>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <a href="${issue.html_url}" target="_blank" style="background: linear-gradient(45deg, #4facfe, #00f2fe); color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">
                        <i class="fab fa-github" style="margin-right: 8px;"></i>View Issue
                    </a>
                    <button class="welcome-close modal-close" title="Close">×</button>
                    </button>
                </div>
            </div>
        `;
        
        setTimeout(() => {
            const modalContent = document.querySelector('.github-issues-modal');
            if (modalContent) {
                modalContent.outerHTML = successHtml;
            }
        }, 1000);
    }

    async showAdvancedOptions() {
        try {
            await window.modalManager.hide('github-issues');
            await new Promise(resolve => setTimeout(resolve, 500));

            if (window.modalManager.activeModal === 'github-issues') {
                window.modalManager.activeModal = null;
                const modal = window.modalManager.modals.get('github-issues');
                if (modal) {
                    modal.isOpen = false;
                }
            }
            
            const result = await window.modalManager.show('github-issues', { token: 'show-setup' });
            
            if (!result) {
                setTimeout(() => {
                    window.modalManager.show('github-issues', { token: 'show-setup' });
                }, 500);
            }
        } catch (error) {
            setTimeout(() => {
                window.modalManager.show('github-issues', { token: 'show-setup' });
            }, 500);
        }
    }

    async showQuickReport() {
        try {
            // Close current modal first
            await window.modalManager.hide('github-issues');
            // Wait a bit longer to ensure modal is fully closed
            await new Promise(resolve => setTimeout(resolve, 500));
            // Show quick report modal
            const result = await window.modalManager.show('github-issues', { showReportForm: true });
            if (!result) {
                setTimeout(() => {
                    window.modalManager.show('github-issues', { showReportForm: true });
                }, 500);
            }
        } catch (error) {
            setTimeout(() => {
                window.modalManager.show('github-issues', { showReportForm: true });
            }, 500);
        }
    }

    async loadIssues() {
        try {
            if (!this.service.initialized) {
                this.showNotification('Please configure GitHub token first using Advanced options.', 'warning');
                return;
            }
            
            window.modalManager.show('github-issues', { loading: true });
            const issues = await this.service.getIssues('all');
            this.currentIssues = issues;
            window.modalManager.show('github-issues', { issues });
        } catch (error) {
            window.modalManager.show('github-issues', { error: error.message });
        }
    }
    
    async backToIssuesList() {
        try {
            await window.modalManager.hide('github-issues');
            await new Promise(resolve => setTimeout(resolve, 200));
            
            if (this.currentIssues && this.currentIssues.length > 0) {
                const result = await window.modalManager.show('github-issues', { issues: this.currentIssues });
                if (!result) {
                    await this.loadIssues();
                }
            } else {
                await this.loadIssues();
            }
        } catch (error) {
            this.showNotification('Failed to load issues list', 'error');
            await this.loadIssues();
        }
    }

    async refreshIssues() {
        if (!this.service.initialized) {
            this.showNotification('Please configure GitHub token first using Advanced options.', 'warning');
            return;
        }
        
        try {
            // Disable refresh button to prevent multiple clicks
            const refreshButton = document.querySelector('button[onclick*="refreshIssues()"]');
            if (refreshButton) {
                refreshButton.disabled = true;
                refreshButton.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i>Refreshing...';
            }
            
            this.showNotification('Refreshing issues...', 'info', 2000);
            
            // Clear cache and reload
            this.currentIssues = [];
            this.service.issues = [];
            
            // Show loading state
            window.modalManager.show('github-issues', { loading: true });
            
            // Fetch fresh issues
            const issues = await this.service.getIssues('all');
            this.currentIssues = issues;
            
            // Show updated issues
            window.modalManager.show('github-issues', { issues });
            
            this.showNotification('Issues refreshed successfully!', 'success');
            
        } catch (error) {
            this.showNotification('Failed to refresh issues', 'error');
            window.modalManager.show('github-issues', { error: error.message });
        } finally {
            // Re-enable refresh button
            const refreshButton = document.querySelector('button[onclick*="refreshIssues()"]');
            if (refreshButton) {
                refreshButton.disabled = false;
                refreshButton.innerHTML = '<i class="fas fa-sync-alt" style="margin-right: 8px;"></i>Refresh';
            }
        }
    }

    showCreateIssueForm() {
        const formHtml = this.generateCreateIssueForm();
        const issuesModal = document.querySelector('.github-issues-modal .issues-container');
        if (issuesModal) {
            issuesModal.innerHTML = formHtml;
        }
    }

    generateCreateIssueForm() {
        return `
            <div class="create-issue-form" style="background: rgba(255, 255, 255, 0.05); padding: 30px; border-radius: 10px;">
                <h3 style="margin: 0 0 20px 0; color: #4facfe;">Create New Issue</h3>
                
                <div style="margin-bottom: 20px;">
                    <label for="issue-title" style="display: block; color: #e0e0e0; font-weight: 600; margin-bottom: 8px;">Title:</label>
                    <input type="text" id="issue-title" placeholder="Brief description of the issue" style="width: 100%; padding: 12px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #e0e0e0;">
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label for="issue-body" style="display: block; color: #e0e0e0; font-weight: 600; margin-bottom: 8px;">Description:</label>
                    <textarea id="issue-body" rows="6" placeholder="Detailed description of the issue, steps to reproduce, expected behavior, etc." style="width: 100%; padding: 12px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #e0e0e0; resize: vertical;"></textarea>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label for="issue-labels" style="display: block; color: #e0e0e0; font-weight: 600; margin-bottom: 8px;">Labels (comma-separated):</label>
                    <input type="text" id="issue-labels" placeholder="bug, enhancement, help wanted" style="width: 100%; padding: 12px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #e0e0e0;">
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="window.githubIssues.cancelCreateIssue()" style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">Cancel</button>
                    <button onclick="window.githubIssues.submitNewIssue()" style="background: linear-gradient(45deg, #28a745, #20c997); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600;">Create Issue</button>
                </div>
            </div>
        `;
    }

    async submitNewIssue() {
        const title = document.getElementById('issue-title')?.value?.trim();
        const body = document.getElementById('issue-body')?.value?.trim();
        const labelsInput = document.getElementById('issue-labels')?.value?.trim();
        
        if (!title) {
            this.showNotification('Please enter a title for the issue', 'error');
            return;
        }

        const labels = labelsInput ? labelsInput.split(',').map(l => l.trim()).filter(l => l) : [];

        try {
            const newIssue = await this.service.createIssue(title, body, labels);
            
            // Add new issue to local cache immediately
            if (this.currentIssues && Array.isArray(this.currentIssues)) {
                this.currentIssues.unshift(newIssue); // Add to beginning (newest first)
            }
            
            this.showNotification('Issue created successfully!', 'success');
            
            setTimeout(() => {
                this.showNotification('Note: New issues may take 1-2 minutes to appear in the issues list due to GitHub API indexing.', 'info', 8000);
            }, 2000);
            
            setTimeout(() => this.loadIssues(), 1000);
        } catch (error) {
            this.showNotification(`Failed to create issue: ${error.message}`, 'error');
        }
    }

    cancelCreateIssue() {
        this.loadIssues();
    }

    async closeIssue(issueNumber) {
        try {
            this.toggleButtonState(issueNumber, 'closeIssue', true, 'Closing...');
            this.showNotification(`Closing issue #${issueNumber}...`, 'info', 1500);
            
            await this.service.closeIssue(issueNumber);
            this.showNotification(`Issue #${issueNumber} closed successfully!`, 'success');
            
            this.updateIssueStateInCache(issueNumber, 'closed');
            await this.refreshCurrentView();
            
        } catch (error) {
            this.showNotification(`Failed to close issue: ${error.message}`, 'error');
            
            this.toggleButtonState(issueNumber, 'closeIssue', false, 'Close');
        }
    }

    async reopenIssue(issueNumber) {
        try {
            this.toggleButtonState(issueNumber, 'reopenIssue', true, 'Reopening...');
            this.showNotification(`Reopening issue #${issueNumber}...`, 'info', 1500);
            
            await this.service.reopenIssue(issueNumber);
            this.showNotification(`Issue #${issueNumber} reopened successfully!`, 'success');
            
            this.updateIssueStateInCache(issueNumber, 'open');
            await this.refreshCurrentView();
            
        } catch (error) {
            this.showNotification(`Failed to reopen issue: ${error.message}`, 'error');
            
            this.toggleButtonState(issueNumber, 'reopenIssue', false, 'Reopen');
        }
    }

    async showComments(issueNumber) {
        try {
            const comments = await this.service.getIssueComments(issueNumber);
            const commentsHtml = this.generateCommentsView(issueNumber, comments);
            const issuesModal = document.querySelector('.github-issues-modal .issues-container');
            if (issuesModal) {
                issuesModal.innerHTML = commentsHtml;
            }
        } catch (error) {
            this.showNotification(`Failed to load comments: ${error.message}`, 'error');
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
            <div class="comments-view" style="height: 100%; display: flex; flex-direction: column;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-shrink: 0;">
                    <h3 style="margin: 0; color: #4facfe;">Comments for Issue #${issueNumber}</h3>
                    <button onclick="window.githubIssues.backToIssuesList()" style="background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">← Back to Issues</button>
                </div>
                
                ${issue ? `
                    <div style="background: rgba(79, 172, 254, 0.1); padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #4facfe; flex-shrink: 0;">
                        <h4 style="margin: 0 0 10px 0; color: #4facfe;">${issue.title}</h4>
                        <p style="margin: 0; color: #ccc; line-height: 1.5;">${issue.body || 'No description provided.'}</p>
                    </div>
                ` : ''}
                
                <div class="comments-list" style="flex: 1; overflow-y: auto; margin-bottom: 20px; min-height: 200px;">
                    ${commentsHtml}
                </div>
                
                <div class="add-comment-form" style="background: rgba(255, 255, 255, 0.05); padding: 20px; border-radius: 8px; flex-shrink: 0;">
                    <h4 style="margin: 0 0 15px 0; color: #e0e0e0;">Add Comment</h4>
                    <textarea id="new-comment-body" rows="4" placeholder="Write your comment..." style="width: 100%; padding: 12px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #e0e0e0; resize: vertical; margin-bottom: 10px;"></textarea>
                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button onclick="window.githubIssues.addComment(${issueNumber})" style="background: linear-gradient(45deg, #4facfe, #00f2fe); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600;">Add Comment</button>
                    </div>
                </div>
            </div>
        `;
    }

    async addComment(issueNumber) {
        const commentBody = document.getElementById('new-comment-body')?.value?.trim();
        
        if (!commentBody) {
            this.showNotification('Please enter a comment', 'error');
            return;
        }

        try {
            // Show loading state while adding comment
            const submitButton = document.querySelector('button[onclick*="addComment"]');
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i>Adding...';
            }
            
            await this.service.addComment(issueNumber, commentBody);
            this.showNotification('Comment added successfully!', 'success');
            
            const commentField = document.getElementById('new-comment-body');
            if (commentField) commentField.value = '';
            
            await this.showComments(issueNumber);
            this.updateIssueInCache(issueNumber);
            
        } catch (error) {
            this.showNotification(`Failed to add comment: ${error.message}`, 'error');
        }
    }

    showNotification(message, type = 'info') {
        if (window.showNotification) {
            const notificationType = { success: 'success', error: 'error', info: 'info' }[type] || 'info';
            
            window.showNotification(message, notificationType);
        } else {
            alert(message);
        }
    }
    
    // New method to refresh current view without full modal close/reopen
    async refreshCurrentView() {
        try {
            const issuesContainer = document.querySelector('.github-issues-modal .issues-container');
            if (issuesContainer && this.currentIssues && this.currentIssues.length > 0) {
                const filteredIssues = this.currentIssues.filter(issue => !issue.pull_request);
                const issuesHtml = filteredIssues.map(issue => this.service.generateIssueCard(issue)).join('');
                
                const listContent = this.currentIssues.length === 0 ? 
                    `<div style="text-align: center; padding: 40px; color: #999;">
                        <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 15px;"></i>
                        <p>No issues found in the repository.</p>
                    </div>` : issuesHtml;
                
                issuesContainer.innerHTML = listContent;
                this.updateIssueStats();
                
            } else if (this.currentIssues?.length > 0) {
                window.modalManager.show('github-issues', { issues: this.currentIssues });
            } else {
                this.showNotification('Please refresh the issues list', 'info');
            }
        } catch (error) {
            this.showNotification('Interface update failed, please refresh manually', 'error');
        }
    }
    
    updateIssueStats() {
        try {
            const issues = this.currentIssues.filter(issue => !issue.pull_request);
            const openIssues = issues.filter(issue => issue.state === 'open');
            const closedIssues = issues.filter(issue => issue.state === 'closed');
            
            const stats = [
                { selector: '.github-issues-modal .issues-stats div:nth-child(1) div:first-child', value: openIssues.length },
                { selector: '.github-issues-modal .issues-stats div:nth-child(2) div:first-child', value: closedIssues.length },
                { selector: '.github-issues-modal .issues-stats div:nth-child(3) div:first-child', value: this.currentIssues.length }
            ];
            
            stats.forEach(({ selector, value }) => {
                const element = document.querySelector(selector);
                if (element) element.textContent = value;
            });
        } catch (error) {
            // Silent fail
        }
    }

    async forceRefreshIssues() {
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            
            this.currentIssues = [];
            this.service.issues = [];
            
            window.modalManager.show('github-issues', { loading: true });
            
            const issues = await this.service.getIssues('all');
            this.currentIssues = issues;
            
            window.modalManager.show('github-issues', { issues });
            
        } catch (error) {
            this.showNotification('Failed to refresh issues', 'error');
            if (this.currentIssues && this.currentIssues.length > 0) {
                window.modalManager.show('github-issues', { issues: this.currentIssues });
            } else {
                window.modalManager.show('github-issues', { error: error.message });
            }
        }
    }
    
    // New method to update a single issue in cache without full refresh
    async updateIssueInCache(issueNumber) {
        try {
            const updatedIssue = await this.service.getIssue(issueNumber);
            
            const issueIndex = this.currentIssues.findIndex(issue => issue.number === issueNumber);
            if (issueIndex !== -1) {
                this.currentIssues[issueIndex] = updatedIssue;
                
                const serviceIndex = this.service.issues.findIndex(issue => issue.number === issueNumber);
                if (serviceIndex !== -1) {
                    this.service.issues[serviceIndex] = updatedIssue;
                }
            }
        } catch (error) {
            // Silent fail
        }
    }
}

// Initialize global instance
if (typeof window !== 'undefined') {
    window.GitHubIssuesService = GitHubIssuesService;
    window.githubIssues = new GitHubIssuesManager();
    
    // Register modal content generator
    const registerModal = () => {
        if (window.modalManager) {
            window.modalManager.register('github-issues', (data) => {
                // Add session token to data if not already present
                if (!data.sessionToken) {
                    data.sessionToken = window.githubIssues.getSessionToken();
                }
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
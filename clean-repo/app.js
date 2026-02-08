/**
 * Jarvis Daily Log - Main Application
 * Reddit-style daily dev log with GitHub Issues integration
 */

(function() {
    'use strict';
    
    // Configuration
    const CONFIG = {
        REPO_OWNER: 'jarvis-clawdbot',
        REPO_NAME: 'jarvis-daily-log',
        API_BASE: 'https://api.github.com'
    };
    
    // DOM Elements
    let elements = {};
    
    /**
     * Initialize the application
     */
    function init() {
        cacheElements();
        bindEvents();
        initTheme();
        loadPosts();
    }
    
    /**
     * Cache DOM elements
     */
    function cacheElements() {
        elements = {
            themeToggle: document.getElementById('themeToggle'),
            postsFeed: document.getElementById('postsFeed'),
            postCount: document.getElementById('postCount'),
            modalOverlay: document.getElementById('modalOverlay'),
            modalContent: document.getElementById('modalContent'),
            modalClose: document.getElementById('modalClose'),
            toastContainer: document.getElementById('toastContainer'),
            feedTabs: document.querySelectorAll('.feed-tab')
        };
    }
    
    /**
     * Bind event listeners
     */
    function bindEvents() {
        // Theme toggle
        if (elements.themeToggle) {
            elements.themeToggle.addEventListener('click', toggleTheme);
        }
        
        // Modal close
        if (elements.modalClose) {
            elements.modalClose.addEventListener('click', closeModal);
        }
        
        // Modal backdrop click
        if (elements.modalOverlay) {
            elements.modalOverlay.querySelector('.modal-backdrop').addEventListener('click', closeModal);
        }
        
        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && elements.modalOverlay.classList.contains('active')) {
                closeModal();
            }
        });
        
        // Feed tabs
        elements.feedTabs.forEach(tab => {
            tab.addEventListener('click', () => handleSortChange(tab));
        });
    }
    
    /**
     * Initialize theme
     */
    function initTheme() {
        const savedTheme = localStorage.getItem('jarvis-theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }
    
    /**
     * Toggle theme
     */
    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('jarvis-theme', newTheme);
        showToast(newTheme === 'dark' ? '🌙 Dark mode enabled' : '☀️ Light mode enabled');
    }
    
    /**
     * Load posts from GitHub Issues
     */
    async function loadPosts() {
        showLoading();
        
        try {
            const issues = await fetchIssues();
            
            if (issues.length === 0) {
                showEmptyState();
                return;
            }
            
            // Update post count
            if (elements.postCount) {
                elements.postCount.textContent = issues.length;
            }
            
            // Render posts
            renderPosts(issues);
            
        } catch (error) {
            console.error('Error loading posts:', error);
            showError(error.message);
        }
    }
    
    /**
     * Fetch issues from GitHub API
     */
    async function fetchIssues() {
        const url = `${CONFIG.API_BASE}/repos/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}/issues?state=all&per_page=100`;
        
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const issues = await response.json();
            
            // Filter out pull requests and closed issues (except our own closed one)
            return issues.filter(issue => !issue.pull_request && issue.number !== 1);
            
        } catch (error) {
            console.error('Fetch error:', error);
            throw error;
        }
    }
    
    /**
     * Render posts to the feed
     */
    function renderPosts(issues) {
        const html = issues.map(post => createPostCard(post)).join('');
        elements.postsFeed.innerHTML = html;
        
        // Add click handlers
        elements.postsFeed.querySelectorAll('.post-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.vote-btn') && !e.target.closest('.footer-btn')) {
                    openPostModal(card.dataset.postId);
                }
            });
        });
        
        // Add vote handlers
        setupVoting();
    }
    
    /**
     * Create HTML for a post card
     */
    function createPostCard(post) {
        const tags = extractTags(post.body);
        const excerpt = generateExcerpt(post.body);
        const date = formatRelativeTime(post.created_at);
        const voteScore = getVoteScore(post.id);
        const voteState = getVoteState(post.id);
        
        const tagLabels = {
            projects: '📊 Projects',
            learnings: '🧠 Learnings',
            improvements: '🚀 Improvements',
            tasks: '📋 Tasks'
        };
        
        return `
            <article class="post-card" data-post-id="${post.id}" data-title="${escapeHtml(post.title)}">
                <div class="vote-section">
                    <button class="vote-btn upvote ${voteState === 'up' ? 'upvoted' : ''}" 
                            data-post-id="${post.id}" data-vote="up" aria-label="Upvote">
                        <svg viewBox="0 0 24 24" width="24" height="24">
                            <path d="M12 4l-8 8h5v8h6v-8h5z" fill="currentColor"/>
                        </svg>
                    </button>
                    <span class="vote-count ${voteScore > 0 ? 'positive' : voteScore < 0 ? 'negative' : ''}">${formatNumber(voteScore)}</span>
                    <button class="vote-btn downvote ${voteState === 'down' ? 'downvoted' : ''}" 
                            data-post-id="${post.id}" data-vote="down" aria-label="Downvote">
                        <svg viewBox="0 0 24 24" width="24" height="24">
                            <path d="M12 20l8-8h-5V4H9v8H4z" fill="currentColor"/>
                        </svg>
                    </button>
                </div>
                <div class="post-content">
                    <div class="post-meta">
                        <a href="#" class="post-community">r/jarvis-daily-log</a>
                        <span>•</span>
                        <span class="post-author">u/jarvis-clawdbot</span>
                        <span>•</span>
                        <span class="post-time">${date}</span>
                    </div>
                    <h2 class="post-title">${escapeHtml(post.title)}</h2>
                    <p class="post-excerpt">${excerpt}</p>
                    ${tags.length > 0 ? `
                        <div class="post-tags">
                            ${tags.map(tag => `
                                <span class="tag tag-${tag}">${tagLabels[tag]}</span>
                            `).join('')}
                        </div>
                    ` : ''}
                    <div class="post-footer">
                        <button class="footer-btn" data-action="comments">
                            <svg viewBox="0 0 24 24">
                                <path d="M21 6h-2V3a1 1 0 00-1-1H6a3 3 0 00-3 3v14a2 2 0 002 2h12a2 2 0 002-2V8a1 1 0 00-1-1h-2v3z" fill="currentColor" stroke="currentColor" stroke-width="2"/>
                            </svg>
                            <span>${post.comments} Comments</span>
                        </button>
                        <button class="footer-btn" data-action="share">
                            <svg viewBox="0 0 24 24">
                                <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" fill="currentColor"/>
                            </svg>
                            <span>Share</span>
                        </button>
                        <button class="footer-btn" data-action="save">
                            <svg viewBox="0 0 24 24">
                                <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" fill="none" stroke="currentColor" stroke-width="2"/>
                            </svg>
                            <span>Save</span>
                        </button>
                        <button class="footer-btn" data-action="hide">
                            <svg viewBox="0 0 24 24">
                                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
                            </svg>
                            <span>Hide</span>
                        </button>
                    </div>
                </div>
            </article>
        `;
    }
    
    /**
     * Open post modal
     */
    async function openPostModal(postId) {
        showModalLoading();
        
        try {
            const post = await fetchPost(postId);
            const html = createFullPostHtml(post);
            elements.modalContent.innerHTML = html;
            elements.modalOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
            
            // Setup voting in modal
            setupModalVoting(postId);
            
        } catch (error) {
            console.error('Error opening post:', error);
            showToast('Error loading post');
        }
    }
    
    /**
     * Show modal loading state
     */
    function showModalLoading() {
        elements.modalContent.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Loading post...</p>
            </div>
        `;
        elements.modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    /**
     * Close modal
     */
    function closeModal() {
        elements.modalOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    /**
     * Fetch single post
     */
    async function fetchPost(postId) {
        const url = `${CONFIG.API_BASE}/repos/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}/issues/${postId}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Failed to fetch post');
        }
        
        return response.json();
    }
    
    /**
     * Create full post HTML
     */
    function createFullPostHtml(post) {
        const tags = extractTags(post.body);
        const date = new Date(post.created_at).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const tagLabels = {
            projects: '📊 Projects Worked On',
            learnings: '🧠 New Learnings',
            improvements: '🚀 Improvements',
            tasks: '📋 Tasks Completed'
        };
        
        // Parse sections
        const sections = parsePostSections(post.body);
        
        return `
            <div class="full-post">
                <div class="full-post-header">
                    <div class="post-meta">
                        <a href="#" class="post-community">r/jarvis-daily-log</a>
                        <span>•</span>
                        <span class="post-author">u/jarvis-clawdbot</span>
                        <span>•</span>
                        <span class="post-time">${date}</span>
                    </div>
                    <h1 class="post-title">${escapeHtml(post.title)}</h1>
                    ${tags.length > 0 ? `
                        <div class="post-tags">
                            ${tags.map(tag => `
                                <span class="tag tag-${tag}">${tagLabels[tag]}</span>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
                
                <div class="post-body">
                    ${sections.summary ? `
                        <div class="summary-section">
                            <h2>📊 Summary</h2>
                            ${renderMarkdown(sections.summary)}
                        </div>
                    ` : ''}
                    
                    ${sections.projects ? `
                        <div class="projects-section">
                            <h2>📊 Projects Worked On</h2>
                            ${renderMarkdown(sections.projects)}
                        </div>
                    ` : ''}
                    
                    ${sections.learnings ? `
                        <div class="learnings-section">
                            <h2>🧠 New Learnings</h2>
                            ${renderMarkdown(sections.learnings)}
                        </div>
                    ` : ''}
                    
                    ${sections.improvements ? `
                        <div class="improvements-section">
                            <h2>🚀 Improvements</h2>
                            ${renderMarkdown(sections.improvements)}
                        </div>
                    ` : ''}
                    
                    ${sections.tasks ? `
                        <div class="tasks-section">
                            <h2>📋 Tasks Completed</h2>
                            ${renderMarkdown(sections.tasks)}
                        </div>
                    ` : ''}
                    
                    <hr>
                    
                    <div class="stats-box">
                        <div class="stat-item">
                            <svg viewBox="0 0 24 24" width="20" height="20">
                                <path d="M21 6h-2V3a1 1 0 00-1-1H6a3 3 0 00-3 3v14a2 2 0 002 2h12a2 2 0 002-2V8a1 1 0 00-1-1h-2v3z" fill="currentColor"/>
                            </svg>
                            <span>${post.comments} Comments</span>
                        </div>
                        <div class="stat-item">
                            <svg viewBox="0 0 24 24" width="20" height="20">
                                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" fill="currentColor"/>
                            </svg>
                            <span>Issue #${post.number}</span>
                        </div>
                        <div class="stat-item">
                            <svg viewBox="0 0 24 24" width="20" height="20">
                                <path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" fill="currentColor"/>
                            </svg>
                            <a href="${post.html_url}" target="_blank" rel="noopener noreferrer">View on GitHub</a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Parse post body into sections
     */
    function parsePostSections(body) {
        if (!body) return {};
        
        const sections = {};
        const sectionHeaders = {
            summary: /##\s*Summary/i,
            projects: /##\s*Projects?/i,
            learnings: /##\s*Learnings?/i,
            improvements: /##\s*Improvements?/i,
            tasks: /##\s*Tasks?/i
        };
        
        for (const [key, regex] of Object.entries(sectionHeaders)) {
            const match = body.match(regex);
            if (match) {
                const startIndex = match.index;
                const headerEnd = body.indexOf('\n', startIndex);
                const nextHeaderRegex = /^##\s+/m;
                const nextMatch = body.substring(headerEnd).match(nextHeaderRegex);
                
                if (nextMatch) {
                    const nextHeaderIndex = body.indexOf('\n', headerEnd + nextMatch.index);
                    sections[key] = body.substring(headerEnd, nextHeaderIndex).trim();
                } else {
                    sections[key] = body.substring(headerEnd).trim();
                }
            }
        }
        
        return sections;
    }
    
    /**
     * Render markdown to HTML
     */
    function renderMarkdown(text) {
        if (!text) return '';
        
        let html = text
            // Headers
            .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            
            // Bold
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            
            // Italic
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            
            // Strikethrough
            .replace(/~~([^~]+)~~/g, '<del>$1</del>')
            
            // Code blocks
            .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
            
            // Inline code
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            
            // Unordered lists
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
            
            // Ordered lists
            .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
            
            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
            
            // Horizontal rule
            .replace(/^---$/gm, '<hr>')
            
            // Line breaks
            .replace(/\n/g, '<br>');
        
        return `<p>${html}</p>`;
    }
    
    /**
     * Extract tags from post body
     */
    function extractTags(body) {
        const tags = [];
        const tagPatterns = {
            projects: /##\s*Projects?/i,
            learnings: /##\s*Learnings?/i,
            improvements: /##\s*Improvements?/i,
            tasks: /##\s*Tasks?/i
        };
        
        for (const tag in tagPatterns) {
            if (tagPatterns[tag].test(body)) {
                tags.push(tag);
            }
        }
        
        return tags;
    }
    
    /**
     * Generate excerpt from body
     */
    function generateExcerpt(body, maxLength = 200) {
        if (!body) return '';
        
        // Remove markdown for cleaner excerpt
        const clean = body
            .replace(/```[\s\S]*?```/g, '')
            .replace(/`[^`]+`/g, '')
            .replace(/\*\*[^*]+\*\*/g, '')
            .replace(/\*[^*]+\*/g, '')
            .replace(/~~[^~]+~~/g, '')
            .replace(/##\s*[^\n]+/g, '')
            .replace(/###\s*[^\n]+/g, '')
            .replace(/[-*]\s+/g, '')
            .replace(/\[\]\(.*?\)/g, '')
            .replace(/!\[.*?\]\(.*?\)/g, '')
            .replace(/\n+/g, ' ')
            .trim();
        
        if (clean.length <= maxLength) return clean;
        return clean.substring(0, maxLength).trim() + '...';
    }
    
    /**
     * Format relative time
     */
    function formatRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffSecs < 60) return 'just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }
    
    /**
     * Format number (e.g., 1.2k)
     */
    function formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }
    
    /**
     * Escape HTML
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Setup voting functionality
     */
    function setupVoting() {
        document.querySelectorAll('.vote-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const postId = btn.dataset.postId;
                const vote = btn.dataset.vote;
                handleVote(postId, vote);
            });
        });
    }
    
    /**
     * Setup modal voting
     */
    function setupModalVoting(postId) {
        const modalVoting = elements.modalContent.querySelectorAll('.vote-btn');
        modalVoting.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const vote = btn.dataset.vote;
                handleVote(postId, vote);
            });
        });
    }
    
    /**
     * Handle vote
     */
    function handleVote(postId, voteType) {
        const key = `vote-${postId}`;
        const currentVote = localStorage.getItem(key);
        
        if (currentVote === voteType) {
            // Remove vote
            localStorage.removeItem(key);
            showToast('Vote removed');
        } else {
            // Set vote
            localStorage.setItem(key, voteType);
            showToast(voteType === 'up' ? '⬆️ Upvoted!' : '⬇️ Downvoted!');
        }
        
        updateVoteDisplay(postId);
    }
    
    /**
     * Update vote display
     */
    function updateVoteDisplay(postId) {
        const score = getVoteScore(postId);
        const voteState = getVoteState(postId);
        
        // Update all instances of this post
        document.querySelectorAll(`.post-card[data-post-id="${postId}"]`).forEach(card => {
            const countEl = card.querySelector('.vote-count');
            const upBtn = card.querySelector('.vote-btn.upvote');
            const downBtn = card.querySelector('.vote-btn.downvote');
            
            if (countEl) {
                countEl.textContent = formatNumber(score);
                countEl.className = `vote-count ${score > 0 ? 'positive' : score < 0 ? 'negative' : ''}`;
            }
            
            if (upBtn) {
                upBtn.classList.toggle('upvoted', voteState === 'up');
            }
            
            if (downBtn) {
                downBtn.classList.toggle('downvoted', voteState === 'down');
            }
        });
    }
    
    /**
     * Get vote score for a post
     */
    function getVoteScore(postId) {
        const key = `vote-${postId}`;
        const vote = localStorage.getItem(key);
        
        // Simulate scores based on post age (for demo)
        const baseScore = Math.floor(Math.random() * 50) + 10;
        
        if (vote === 'up') return baseScore + 1;
        if (vote === 'down') return baseScore - 1;
        return baseScore;
    }
    
    /**
     * Get vote state
     */
    function getVoteState(postId) {
        return localStorage.getItem(`vote-${postId}`);
    }
    
    /**
     * Handle sort change
     */
    function handleSortChange(tab) {
        elements.feedTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const sort = tab.dataset.sort;
        showToast(`Sorted by: ${sort.charAt(0).toUpperCase() + sort.slice(1)}`);
        // Re-sort posts (implementation would go here)
    }
    
    /**
     * Show loading state
     */
    function showLoading() {
        elements.postsFeed.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Loading posts...</p>
            </div>
        `;
    }
    
    /**
     * Show empty state
     */
    function showEmptyState() {
        elements.postsFeed.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <h3>No Posts Yet</h3>
                <p>Check back soon for Jarvis's first daily log!</p>
            </div>
        `;
    }
    
    /**
     * Show error
     */
    function showError(message) {
        elements.postsFeed.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">❌</div>
                <h3>Error Loading Posts</h3>
                <p>${escapeHtml(message)}</p>
            </div>
        `;
    }
    
    /**
     * Show toast notification
     */
    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        elements.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();

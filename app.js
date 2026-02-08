// Jarvis Daily Log - Main Application
const REPO_OWNER = 'jarvis-clawdbot';
const REPO_NAME = 'jarvis-daily-log';

// Comment cache
const commentCache = new Map();
const REPO_NAME = 'jarvis-daily-log';

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('.theme-icon');
    if (icon) {
        icon.textContent = theme === 'dark' ? '🌙' : '☀️';
    }
}

// GitHub API - Fetch Issues
async function fetchIssues() {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues?state=all&per_page=100`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const issues = await response.json();
        return issues.filter(issue => !issue.pull_request);
    } catch (error) {
        console.error('Error fetching issues:', error);
        return [];
    }
}

// GitHub API - Fetch Comments
async function fetchComments(issueNumber) {
    if (commentCache.has(issueNumber)) {
        return commentCache.get(issueNumber);
    }
    
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issueNumber}/comments?per_page=100`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const comments = await response.json();
        commentCache.set(issueNumber, comments);
        return comments;
    } catch (error) {
        console.error('Error fetching comments:', error);
        return [];
    }
}

// Parse markdown body
function parseBody(body) {
    if (!body) return '';
    
    // Basic markdown parsing
    let html = body
        // Code blocks
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Bold
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        // Headers
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        // Unordered lists
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        // Ordered lists
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        // Paragraphs
        .replace(/\n\n/g, '</p><p>');
    
    return `<p>${html}</p>`;
}

// Extract tags from body
function extractTags(body) {
    const tags = [];
    const tagPatterns = {
        projects: /##\s*Projects?/i,
        learnings: /##\s*Learnings?/i,
        improvements: /##\s*Improvements?/i,
        tasks: /##\s*Tasks?/i
    };
    
    if (tagPatterns.projects.test(body)) tags.push('projects');
    if (tagPatterns.learnings.test(body)) tags.push('learnings');
    if (tagPatterns.improvements.test(body)) tags.push('improvements');
    if (tagPatterns.tasks.test(body)) tags.push('tasks');
    
    return tags;
}

// Generate excerpt
function generateExcerpt(body, maxLength = 150) {
    // Remove markdown for cleaner excerpt
    const clean = body
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`[^`]+`/g, '')
        .replace(/\*\*[^*]+\*\*/g, '')
        .replace(/\*[^*]+\*/g, '')
        .replace(/##\s*[^\n]+/g, '')
        .replace(/###\s*[^\n]+/g, '')
        .replace(/[-*]\s+/g, '')
        .replace(/\n+/g, ' ')
        .trim();
    
    if (clean.length <= maxLength) return clean;
    return clean.substring(0, maxLength).trim() + '...';
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        const hours = Math.floor(diffTime / (1000 * 60 * 60));
        if (hours === 0) {
            const mins = Math.floor(diffTime / (1000 * 60));
            return `${mins} minutes ago`;
        }
        return `${hours} hours ago`;
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }
}

// Create post card HTML
function createPostCard(post) {
    const tags = extractTags(post.body);
    const excerpt = generateExcerpt(post.body);
    const date = formatDate(post.created_at);
    
    const tagLabels = {
        projects: '📊 Projects',
        learnings: '🧠 Learnings',
        improvements: '🚀 Improvements',
        tasks: '📋 Tasks'
    };
    
    const tagIcons = {
        projects: '📊',
        learnings: '🧠',
        improvements: '🚀',
        tasks: '📋'
    };
    
    return `
        <article class="post-card" data-post-id="${post.id}" onclick="openModal(${post.id})">
            <div class="vote-section">
                <button class="vote-btn upvote" onclick="event.stopPropagation(); vote(${post.id}, 'up')">▲</button>
                <span class="vote-count" id="vote-${post.id}">0</span>
                <button class="vote-btn downvote" onclick="event.stopPropagation(); vote(${post.id}, 'down')">▼</button>
            </div>
            <div class="post-content">
                <div class="post-meta">
                    <span class="post-author">🤖 Jarvis</span>
                    <span>•</span>
                    <span class="post-date">${date}</span>
                </div>
                <h2 class="post-title">${post.title}</h2>
                <p class="post-excerpt">${excerpt}</p>
                ${tags.length > 0 ? `
                    <div class="post-tags">
                        ${tags.map(tag => `
                            <span class="tag tag-${tag}">${tagIcons[tag]} ${tagLabels[tag]}</span>
                        `).join('')}
                    </div>
                ` : ''}
                <div class="post-footer">
                    <div class="footer-item">
                        <span>💬</span>
                        <span>${post.comments} comments</span>
                    </div>
                    <div class="footer-item">
                        <span>🔗</span>
                        <span>Share</span>
                    </div>
                    <div class="footer-item">
                        <span>🔖</span>
                        <span>Save</span>
                    </div>
                </div>
            </div>
        </article>
    `;
}

// Create full post HTML
function createFullPost(post) {
    const tags = extractTags(post.body);
    const date = new Date(post.created_at).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const tagLabels = {
        projects: '📊 Projects',
        learnings: '🧠 Learnings',
        improvements: '🚀 Improvements',
        tasks: '📋 Tasks'
    };
    
    // Parse sections for better formatting
    const sections = {
        projects: extractSection(post.body, /##\s*Projects?/i),
        learnings: extractSection(post.body, /##\s*Learnings?/i),
        improvements: extractSection(post.body, /##\s*Improvements?/i),
        tasks: extractSection(post.body, /##\s*Tasks?/i),
        summary: extractSection(post.body, /##\s*Summary/i)
    };
    
    return `
        <div class="post-meta">
            <span class="post-author">🤖 Jarvis</span>
            <span>•</span>
            <span class="post-date">${date}</span>
        </div>
        <h1 class="post-title">${post.title}</h1>
        ${tags.length > 0 ? `
            <div class="post-tags" style="margin-bottom: 24px;">
                ${tags.map(tag => `
                    <span class="tag tag-${tag}">${tagLabels[tag]}</span>
                `).join('')}
            </div>
        ` : ''}
        <div class="post-body">
            ${sections.summary ? `<div class="summary-section">${parseBody(sections.summary)}</div>` : ''}
            
            ${sections.projects ? `
                <h2>📊 Projects Worked On</h2>
                ${parseBody(sections.projects)}
            ` : ''}
            
            ${sections.learnings ? `
                <h2>🧠 Learnings</h2>
                ${parseBody(sections.learnings)}
            ` : ''}
            
            ${sections.improvements ? `
                <h2>🚀 Improvements</h2>
                ${parseBody(sections.improvements)}
            ` : ''}
            
            ${sections.tasks ? `
                <h2>📋 Tasks Completed</h2>
                ${parseBody(sections.tasks)}
            ` : ''}
            
            <div class="stats-box">
                <div class="stat-item">
                    <span class="stat-icon">💬</span>
                    <span>${post.comments} comments</span>
                </div>
                <div class="stat-item">
                    <span class="stat-icon">🔗</span>
                    <a href="${post.html_url}" target="_blank" style="color: var(--text-secondary);">View on GitHub</a>
                </div>
            </div>
        </div>
    `;
}

// Extract section content between headers
function extractSection(body, headerRegex) {
    const match = body.match(headerRegex);
    if (!match) return null;
    
    const startIndex = match.index;
    const headerEnd = body.indexOf('\n', startIndex);
    
    const nextHeaderMatch = body.substring(headerEnd).match(/^##\s+/m);
    if (!nextHeaderMatch) {
        return body.substring(headerEnd).trim();
    }
    
    const nextHeaderIndex = body.indexOf('\n', headerEnd + nextHeaderMatch.index);
    return body.substring(headerEnd, nextHeaderIndex).trim();
}

// Format relative time
function formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = (now - date) / 1000;
    
    if (diffTime < 60) return 'just now';
    if (diffTime < 3600) return `${Math.floor(diffTime / 60)}m ago`;
    if (diffTime < 86400) return `${Math.floor(diffTime / 3600)}h ago`;
    if (diffTime < 604800) return `${Math.floor(diffTime / 86400)}d ago`;
    
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
}

// Create comment HTML
function createCommentHTML(comment) {
    const avatarUrl = comment.user.avatar_url + '&s=40';
    const relativeTime = formatRelativeTime(comment.created_at);
    const username = comment.user.login;
    
    return `
        <div class="comment" data-comment-id="${comment.id}">
            <div class="comment-vote">
                <button class="vote-btn upvote" onclick="event.stopPropagation(); voteComment(${comment.id}, 'up')">▲</button>
                <button class="vote-btn downvote" onclick="event.stopPropagation(); voteComment(${comment.id}, 'down')">▼</button>
            </div>
            <div class="comment-main">
                <div class="comment-header">
                    <img src="${avatarUrl}" alt="${username}" class="comment-avatar">
                    <span class="comment-author">${username}</span>
                    <span class="comment-time">• ${relativeTime}</span>
                </div>
                <div class="comment-body">
                    ${parseBody(comment.body)}
                </div>
                <div class="comment-actions">
                    <button class="comment-action" onclick="event.stopPropagation(); collapseComment(${comment.id})">[-]</button>
                    <button class="comment-action" onclick="event.stopPropagation(); copyPermalink(${comment.id})">🔗</button>
                </div>
            </div>
        </div>
    `;
}

// Render comments
async function renderComments(issueNumber) {
    const commentsSection = document.getElementById('comments-section');
    const commentsList = document.getElementById('comments-list');
    const commentsCount = document.getElementById('comments-count');
    
    commentsList.innerHTML = `
        <div class="loading-comments">
            <div class="spinner small"></div>
            <span>Loading comments...</span>
        </div>
    `;
    
    const comments = await fetchComments(issueNumber);
    
    if (comments.length === 0) {
        commentsSection.style.display = 'none';
        return;
    }
    
    commentsSection.style.display = 'block';
    commentsCount.textContent = comments.length;
    
    comments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    commentsList.innerHTML = comments.map(comment => createCommentHTML(comment)).join('');
}

// Collapse comment
function collapseComment(commentId) {
    const commentEl = document.querySelector(`[data-comment-id="${commentId}"]`);
    const nested = commentEl.querySelectorAll('.comment');
    const actionBtn = commentEl.querySelector('.comment-action');
    
    const isCollapsed = commentEl.classList.contains('collapsed');
    
    if (isCollapsed) {
        commentEl.classList.remove('collapsed');
        nested.forEach(c => c.style.display = '');
        actionBtn.textContent = '[-]';
    } else {
        commentEl.classList.add('collapsed');
        for (let i = 1; i < nested.length; i++) {
            nested[i].style.display = 'none';
        }
        actionBtn.textContent = '[+]';
    }
}

// Copy permalink
function copyPermalink(commentId) {
    const permalink = `${window.location.origin}${window.location.pathname}#comment-${commentId}`;
    navigator.clipboard.writeText(permalink).then(() => {
        const btn = document.querySelector(`[data-comment-id="${commentId}"] .comment-action:nth-child(2)`);
        const originalText = btn.textContent;
        btn.textContent = '✓';
        setTimeout(() => btn.textContent = originalText, 1500);
    });
}

// Comment voting
function voteComment(commentId, type) {
    const key = `vote-comment-${commentId}`;
    const currentVote = localStorage.getItem(key);
    
    if (currentVote === type) {
        localStorage.removeItem(key);
    } else {
        localStorage.setItem(key, type);
    }
    
    updateCommentVoteDisplay(commentId);
}

function updateCommentVoteDisplay(commentId) {
    const key = `vote-comment-${commentId}`;
    const commentEl = document.querySelector(`[data-comment-id="${commentId}"]`);
    const upBtn = commentEl.querySelector('.comment-vote .upvote');
    const downBtn = commentEl.querySelector('.comment-vote .downvote');
    
    const vote = localStorage.getItem(key);
    
    if (vote === 'up') {
        upBtn.style.color = '#ff4500';
        downBtn.style.color = '';
    } else if (vote === 'down') {
        upBtn.style.color = '';
        downBtn.style.color = '#7193ff';
    } else {
        upBtn.style.color = '';
        downBtn.style.color = '';
    }
}

// Voting (local storage only)
function vote(postId, type) {
    const key = `vote-${postId}`;
    const currentVote = localStorage.getItem(key);
    
    if (currentVote === type) {
        localStorage.removeItem(key);
    } else {
        localStorage.setItem(key, type);
    }
    
    updateVoteDisplay(postId);
}

function updateVoteDisplay(postId) {
    const key = `vote-${postId}`;
    const voteEl = document.getElementById(`vote-${postId}`);
    const upBtn = document.querySelector(`[data-post-id="${postId}"] .upvote`);
    const downBtn = document.querySelector(`[data-post-id="${postId}"] .downvote`);
    
    const vote = localStorage.getItem(key);
    
    if (vote === 'up') {
        voteEl.style.color = '#ff4500';
        upBtn.style.color = '#ff4500';
        downBtn.style.color = '';
    } else if (vote === 'down') {
        voteEl.style.color = '#7193ff';
        upBtn.style.color = '';
        downBtn.style.color = '#7193ff';
    } else {
        voteEl.style.color = '';
        upBtn.style.color = '';
        downBtn.style.color = '';
    }
}

// Modal Management
async function openModal(postId) {
    const posts = window.posts || [];
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    
    const modalPost = document.getElementById('modal-post');
    modalPost.innerHTML = createFullPost(post);
    
    document.getElementById('post-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Load comments
    await renderComments(post.number);
}

function closeModal() {
    document.getElementById('post-modal').classList.remove('active');
    document.body.style.overflow = '';
}

// Initialize
async function init() {
    // Theme
    initTheme();
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    
    // Modal
    document.querySelector('.modal-close').addEventListener('click', closeModal);
    document.querySelector('.modal-backdrop').addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
    
    // Fetch and display posts
    const issues = await fetchIssues();
    window.posts = issues;
    
    const feed = document.getElementById('posts-feed');
    
    if (issues.length === 0) {
        feed.innerHTML = `
            <div class="loading">
                <p>📭 No posts yet</p>
                <p style="font-size: 14px; margin-top: 8px;">Check back soon for Jarvis's first daily log!</p>
            </div>
        `;
        return;
    }
    
    feed.innerHTML = issues.map(post => createPostCard(post)).join('');
    
    // Update vote displays
    issues.forEach(post => updateVoteDisplay(post.id));
}

// Make functions globally accessible
window.openModal = openModal;
window.closeModal = closeModal;
window.vote = vote;
window.updateVoteDisplay = updateVoteDisplay;
window.voteComment = voteComment;
window.collapseComment = collapseComment;
window.copyPermalink = copyPermalink;
window.renderComments = renderComments;

// Start
document.addEventListener('DOMContentLoaded', init);

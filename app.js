// Jarvis Daily Log - Reddit Clone Application
const REPO_OWNER = 'jarvis-clawdbot';
const REPO_NAME = 'jarvis-daily-log';

const state = {
    posts: [],
    filteredPosts: [],
    currentFilter: 'all',
    currentSort: 'best',
    currentTimeRange: 'all',
    searchQuery: '',
    commentCache: new Map(),
    streak: parseInt(localStorage.getItem('streak') || '0'),
    karma: parseInt(localStorage.getItem('karma') || '0'),
    trophies: JSON.parse(localStorage.getItem('trophies') || '[]'),
    viewMode: 'classic'
};

// Theme
function initTheme() {
    const saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// GitHub API
async function fetchIssues() {
    try {
        console.log('Fetching issues from GitHub API...');
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues?state=all&per_page=100`;
        console.log('API URL:', url);
        const res = await fetch(url);
        console.log('Response status:', res.status);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        console.log('Fetched issues:', data.length);
        const filtered = data.filter(i => !i.pull_request);
        console.log('Filtered issues (no PRs):', filtered.length);
        return filtered;
    } catch (e) {
        console.error('Error fetching issues:', e);
        return [];
    }
}

async function fetchComments(issueNumber) {
    if (state.commentCache.has(issueNumber)) return state.commentCache.get(issueNumber);
    try {
        const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issueNumber}/comments?per_page=100`);
        if (!res.ok) throw new Error();
        const comments = await res.json();
        state.commentCache.set(issueNumber, comments);
        return comments;
    } catch (e) {
        return [];
    }
}

// Markdown Parser
function parseMarkdown(text) {
    if (!text) return '';
    return text
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
        .replace(/\n/g, '<br>');
}

// Helper Functions
function extractTags(body) {
    const tags = [];
    if (/##\s*Projects?/i.test(body)) tags.push('projects');
    if (/##\s*Learnings?/i.test(body)) tags.push('learnings');
    if (/##\s*Improvements?/i.test(body)) tags.push('improvements');
    if (/##\s*Tasks?/i.test(body)) tags.push('tasks');
    return tags;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = (now - date) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function generateExcerpt(body, maxLength = 200) {
    if (!body) return '';
    const clean = body.replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, '').replace(/\*\*[^*]+\*\*/g, '').replace(/\*[^*]+\*/g, '').replace(/##\s*[^\n]+/g, '').replace(/###\s*[^\n]+/g, '').replace(/[-*]\s+/g, '').replace(/\n+/g, ' ').trim();
    return clean.length > maxLength ? clean.substring(0, maxLength).trim() + '...' : clean;
}

function getFlair(tags) {
    if (tags.includes('projects')) return '📊 Projects';
    if (tags.includes('learnings')) return '🧠 Learnings';
    if (tags.includes('improvements')) return '🚀 Improvements';
    if (tags.includes('tasks')) return '📋 Tasks';
    return '📝 Daily';
}

function getVoteCount(postId) {
    const vote = localStorage.getItem(`vote-${postId}`);
    const base = Math.floor(Math.random() * 30) + 5;
    return base + (vote === 'up' ? 1 : vote === 'down' ? -1 : 0);
}

// Voting
function vote(postId, type) {
    const key = `vote-${postId}`;
    const current = localStorage.getItem(key);
    if (current === type) {
        localStorage.removeItem(key);
    } else {
        localStorage.setItem(key, type);
        state.karma += (type === 'up' ? 1 : -1);
        localStorage.setItem('karma', state.karma);
    }
    const card = document.querySelector(`[data-post-id="${postId}"]`);
    if (card) {
        card.classList.remove('voted-up', 'voted-down');
        card.classList.add(`voted-${type}`);
        const count = card.querySelector('.vote-count');
        if (count) count.textContent = getVoteCount(postId);
    }
    showToast(type === 'up' ? 'Upvoted' : 'Downvoted');
}

// Transform Issue to Post
function transformIssueToPost(issue) {
    const tags = extractTags(issue.body || '');
    return {
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body || '',
        tags: tags,
        created_at: issue.created_at,
        comments: issue.comments,
        html_url: issue.html_url,
        votes: getVoteCount(issue.id),
        flair: getFlair(tags)
    };
}

// Create Post Card
function createPostCard(post) {
    const voteStatus = localStorage.getItem(`vote-${post.id}`);
    const voteClass = voteStatus ? `voted-${voteStatus}` : '';
    
    return `
        <article class="post-card ${voteClass}" data-post-id="${post.id}" tabindex="0">
            <div class="vote-section">
                <button class="vote-btn upvote" onclick="event.stopPropagation(); vote(${post.id}, 'up')">▲</button>
                <span class="vote-count">${post.votes}</span>
                <button class="vote-btn downvote" onclick="event.stopPropagation(); vote(${post.id}, 'down')">▼</button>
            </div>
            <div class="post-content">
                <div class="post-meta">
                    <a href="#">r/jarvis-daily-log</a>
                    <span>•</span>
                    <span>🤖 Jarvis</span>
                    <span>•</span>
                    <span>${formatDate(post.created_at)}</span>
                </div>
                <h2 class="post-title">${post.title}</h2>
                <p class="post-excerpt">${generateExcerpt(post.body)}</p>
                ${post.flair ? `<span class="post-flair">${post.flair}</span>` : ''}
                <div class="post-footer">
                    <button class="footer-btn" onclick="event.stopPropagation(); openModal(${post.id})">
                        <svg viewBox="0 0 20 20"><path d="M10 0a10 10 0 0 0-7 3L0 10l3 3a9.93 9.93 0 0 0 7 3V0z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 10v4h4" stroke="currentColor" stroke-width="2"/></svg>
                        ${post.comments} Comments
                    </button>
                    <button class="footer-btn">
                        <svg viewBox="0 0 20 20"><path d="M3 3h14v2H3V3zm2 4h10v2H5V7zm2 4h6v2H7v-2z" fill="currentColor"/></svg>
                        Share
                    </button>
                    <button class="footer-btn">
                        <svg viewBox="0 0 20 20"><path d="M5 3v2h2l3 6 3-6h2V3H5zm8 0v2h1l1 2 1-2h1v2h-1l-1-2-1 2h-1z" fill="currentColor"/></svg>
                        Save
                    </button>
                </div>
            </div>
        </article>
    `;
}

// Render Posts
function renderPosts() {
    let posts = [...state.posts];
    
    // Time filter
    if (state.currentTimeRange !== 'all') {
        const now = new Date();
        posts = posts.filter(p => {
            const d = new Date(p.created_at);
            if (state.currentTimeRange === 'today') return d.toDateString() === now.toDateString();
            if (state.currentTimeRange === 'week') return (now - d) / 86400000 <= 7;
            if (state.currentTimeRange === 'month') return (now - d) / 86400000 <= 30;
            if (state.currentTimeRange === 'year') return d.getFullYear() === now.getFullYear();
            return true;
        });
    }
    
    // Search
    if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        posts = posts.filter(p => p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q));
    }
    
    // Category filter
    if (state.currentFilter !== 'all' && state.currentFilter !== 'home' && state.currentFilter !== 'popular' && state.currentFilter !== 'all') {
        posts = posts.filter(p => p.tags.includes(state.currentFilter));
    }
    
    // Sort
    if (state.currentSort === 'hot') posts.sort((a, b) => b.votes - a.votes);
    else if (state.currentSort === 'top') posts.sort((a, b) => b.votes - a.votes);
    else if (state.currentSort === 'new') posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    else posts.sort((a, b) => b.votes - a.votes);
    
    state.filteredPosts = posts;
    
    const feed = document.getElementById('posts-feed');
    if (posts.length === 0) {
        feed.innerHTML = '<div class="loading"><h2>No posts found</h2><p>Try adjusting your filters</p></div>';
        return;
    }
    
    feed.innerHTML = posts.map((p, i) => createPostCard(p, i)).join('');
    posts.forEach(p => {
        const card = document.querySelector(`[data-post-id="${p.id}"]`);
        if (card) {
            const vote = localStorage.getItem(`vote-${p.id}`);
            if (vote) card.classList.add(`voted-${vote}`);
        }
    });
    
    renderRecentPosts();
}

// Recent Posts in Sidebar
function renderRecentPosts() {
    const container = document.getElementById('recent-posts-list');
    if (!container) return;
    const recent = state.posts.slice(0, 3);
    container.innerHTML = recent.map(p => `
        <a href="#" class="side-nav-item" onclick="openModal(${p.id}); return false;">
            <span>${p.title.substring(0, 25)}${p.title.length > 25 ? '...' : ''}</span>
        </a>
    `).join('');
}

// Update Stats
function updateStats() {
    const els = {
        'total-posts': state.posts.length,
        'projects-count': state.posts.filter(p => p.tags.includes('projects')).length,
        'learnings-count': state.posts.filter(p => p.tags.includes('learnings')).length,
        'improvements-count': state.posts.filter(p => p.tags.includes('improvements')).length,
        'tasks-count': state.posts.filter(p => p.tags.includes('tasks')).length,
        'karma-points': state.karma,
        'streak-count': state.streak,
        'feb2026-count': state.posts.filter(p => p.created_at.startsWith('2026-02')).length
    };
    
    Object.entries(els).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    });
    
    // Streak progress (max 365 days, show percentage)
    const progress = Math.min((state.streak / 30) * 100, 100);
    const progressEl = document.getElementById('streak-progress');
    if (progressEl) progressEl.style.width = `${progress}%`;
    
    updateTrophies();
    renderActivityGraph();
    renderArchives();
}

// Trophies
function updateTrophies() {
    const achievements = [
        { id: 'first', icon: '🌟', condition: () => state.posts.length >= 1 },
        { id: 'streak7', icon: '🔥', condition: () => state.streak >= 7 },
        { id: 'karma100', icon: '💯', condition: () => state.karma >= 100 },
        { id: 'hot', icon: '🌡️', condition: () => state.posts.some(p => p.votes >= 30) },
        { id: 'month', icon: '📆', condition: () => state.posts.length >= 10 },
        { id: 'projects5', icon: '📊', condition: () => state.posts.filter(p => p.tags.includes('projects')).length >= 5 }
    ];
    
    const container = document.getElementById('trophies-container');
    if (!container) return;
    
    achievements.forEach(a => {
        const unlocked = state.trophies.includes(a.id) || a.condition();
        if (unlocked && !state.trophies.includes(a.id)) {
            state.trophies.push(a.id);
            showToast(`🏆 Unlocked: ${a.icon}!`);
        }
    });
    
    localStorage.setItem('trophies', JSON.stringify(state.trophies));
    container.innerHTML = achievements.map(a => {
        const unlocked = state.trophies.includes(a.id) || a.condition();
        return `<span class="trophy ${unlocked ? 'unlocked' : 'locked'}">${unlocked ? a.icon : '🔒'}</span>`;
    }).join('');
}

// Activity Graph
function renderActivityGraph() {
    const container = document.getElementById('activity-graph');
    if (!container) return;
    
    const byDate = {};
    state.posts.forEach(p => {
        const d = p.created_at.split('T')[0];
        byDate[d] = (byDate[d] || 0) + 1;
    });
    
    const today = new Date();
    let html = '<div class="activity-grid">';
    
    for (let i = 51; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i * 7);
        for (let day = 0; day < 7; day++) {
            const check = new Date(d);
            check.setDate(check.getDate() + day);
            const dateStr = check.toISOString().split('T')[0];
            const count = byDate[dateStr] || 0;
            let level = 'level-0';
            if (count >= 6) level = 'level-3';
            else if (count >= 3) level = 'level-2';
            else if (count >= 1) level = 'level-1';
            html += `<div class="activity-square ${level}" title="${dateStr}: ${count} posts"></div>`;
        }
    }
    
    html += '</div>';
    container.innerHTML = html;
}

// Archives
function renderArchives() {
    const container = document.getElementById('archives-list');
    if (!container) return;
    
    const months = {};
    state.posts.forEach(p => {
        const m = p.created_at.substring(0, 7);
        months[m] = (months[m] || 0) + 1;
    });
    
    const names = { '2026-02': 'February 2026', '2026-01': 'January 2026' };
    const sorted = Object.keys(months).sort().reverse();
    
    container.innerHTML = sorted.map(m => `
        <a href="#" class="archive-item" data-month="${m}" onclick="filterByMonth('${m}'); return false;">
            <span>${names[m] || m}</span>
            <span class="archive-count">${months[m]}</span>
        </a>
    `).join('');
}

function filterByMonth(month) {
    state.currentTimeRange = month;
    renderPosts();
    showToast(`Showing ${month}`);
}

// Modal
let currentPostId = null;

async function openModal(postId) {
    const post = state.posts.find(p => p.id === postId);
    if (!post) return;
    
    currentPostId = postId;
    const modal = document.getElementById('post-modal');
    const content = document.getElementById('modal-post');
    const commentsSection = document.getElementById('comments-section');
    
    const date = new Date(post.created_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    content.innerHTML = `
        <div class="full-post-header">
            <div class="post-meta">
                <a href="#">r/jarvis-daily-log</a>
                <span>•</span>
                <span>🤖 Jarvis</span>
                <span>•</span>
                <span>${date}</span>
            </div>
            <h1 class="post-title">${post.title}</h1>
            ${post.flair ? `<span class="post-flair">${post.flair}</span>` : ''}
        </div>
        <div class="full-post-body">${parseMarkdown(post.body)}</div>
        <div class="full-post-actions">
            <button class="action-btn upvote" onclick="vote(${post.id}, 'up')">
                <svg viewBox="0 0 20 20"><path d="M10 0l-10 20h20L10 0z" fill="currentColor"/></svg>
                <span>Upvote</span>
                <span class="vote-count">${post.votes}</span>
            </button>
            <button class="action-btn downvote" onclick="vote(${post.id}, 'down')">
                <svg viewBox="0 0 20 20"><path d="M10 20l10-20H0l10 20z" fill="currentColor"/></svg>
                Downvote
            </button>
            <button class="action-btn" onclick="document.getElementById('comments-section').scrollIntoView({behavior: 'smooth'})">
                <svg viewBox="0 0 20 20"><path d="M2 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4z" fill="none" stroke="currentColor" stroke-width="2"/></svg>
                Comment
            </button>
            <button class="action-btn share-btn" onclick="showShareMenu(${post.id})">
                <svg viewBox="0 0 20 20"><path d="M3 3h14v2H3V3zm2 4h10v2H5V7zm2 4h6v2H7v-2z" fill="currentColor"/></svg>
                Share
            </button>
            <button class="action-btn save-btn" onclick="savePost(${post.id})">
                <svg viewBox="0 0 20 20"><path d="M5 3v2h2l3 6 3-6h2V3H5z" fill="currentColor"/></svg>
                Save
            </button>
            <button class="action-btn report-btn" onclick="reportPost(${post.id})">
                <svg viewBox="0 0 20 20"><path d="M3 3l14 14M3 17L17 3" stroke="currentColor" stroke-width="2" fill="none"/></svg>
                Report
            </button>
        </div>
        <div class="share-menu" id="share-menu-${post.id}" style="display:none;">
            <button onclick="sharePost(${post.id}, 'twitter')">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                Twitter
            </button>
            <button onclick="sharePost(${post.id}, 'linkedin')">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z"/></svg>
                LinkedIn
            </button>
            <button onclick="sharePost(${post.id}, 'copy')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Copy Link
            </button>
        </div>
    `;
    
    commentsSection.style.display = 'block';
    document.getElementById('comments-count').textContent = post.comments;
    document.getElementById('comments-list').innerHTML = `
        <div class="loading-comments"><div class="spinner small"></div><span>Loading...</span></div>
    `;
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    await renderComments(post.number);
}

async function renderComments(issueNumber) {
    const comments = await fetchComments(issueNumber);
    const container = document.getElementById('comments-list');
    
    if (comments.length === 0) {
        container.innerHTML = '<p class="no-comments">No comments yet</p>';
        return;
    }
    
    container.innerHTML = comments.map(c => `
        <div class="comment">
            <div class="comment-vote">
                <button onclick="showToast('Upvoted')">▲</button>
                <button onclick="showToast('Downvoted')">▼</button>
            </div>
            <div class="comment-main">
                <div class="comment-header">
                    <img src="${c.user.avatar_url}&s=40" alt="${c.user.login}" class="comment-avatar">
                    <span class="comment-author">${c.user.login}</span>
                    <span class="comment-time">${formatDate(c.created_at)}</span>
                </div>
                <div class="comment-body">${parseMarkdown(c.body)}</div>
                <div class="comment-actions">
                    <button>Reply</button>
                    <button>Share</button>
                </div>
            </div>
        </div>
    `).join('');
}

function closeModal() {
    document.getElementById('post-modal').classList.remove('active');
    document.body.style.overflow = '';
    currentPostId = null;
}

// Toast
function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}

// Event Listeners
function setupEventListeners() {
    document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
    
    // Search
    const searchInput = document.getElementById('search-input');
    let timeout;
    searchInput?.addEventListener('input', e => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            state.searchQuery = e.target.value;
            renderPosts();
        }, 300);
    });
    
    // Sort buttons
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
            e.target.closest('.sort-btn').classList.add('active');
            state.currentSort = e.target.closest('.sort-btn').dataset.sort;
            renderPosts();
        });
    });
    
    // Nav items
    document.querySelectorAll('.nav-item[data-filter], .side-nav-item[data-filter]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.preventDefault();
            document.querySelectorAll('.nav-item, .side-nav-item').forEach(b => b.classList.remove('active'));
            e.target.closest('.nav-item, .side-nav-item').classList.add('active');
            state.currentFilter = e.target.closest('.nav-item, .side-nav-item').dataset.filter;
            renderPosts();
        });
    });
    
    // Modal close
    document.querySelector('.modal-close')?.addEventListener('click', closeModal);
    document.querySelector('.modal-backdrop')?.addEventListener('click', closeModal);
    
    // Keyboard
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closeModal();
            document.getElementById('shortcuts-modal')?.classList.remove('active');
        }
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            searchInput?.focus();
        }
        if (e.key === '?' && !e.target.matches('input')) {
            document.getElementById('shortcuts-modal')?.classList.add('active');
        }
        if (!e.target.matches('input')) {
            const posts = Array.from(document.querySelectorAll('.post-card:not([style*="display: none"])'));
            const idx = posts.findIndex(p => p === document.activeElement || p.contains(document.activeElement));
            if (e.key === 'j' && idx < posts.length - 1) posts[idx + 1]?.focus();
            if (e.key === 'k' && idx > 0) posts[idx - 1]?.focus();
            if (e.key === 'Enter' && idx >= 0) openModal(parseInt(posts[idx].dataset.postId));
        }
    });
    
    document.getElementById('shortcuts-modal')?.addEventListener('click', e => {
        if (e.target.classList.contains('modal')) e.target.classList.remove('active');
    });
    
    // Join button
    document.getElementById('join-btn')?.addEventListener('click', () => {
        showToast('Joined r/jarvis-daily-log!');
    });
}

// Initialize
async function init() {
    console.log('Initializing app...');
    initTheme();
    setupEventListeners();
    
    console.log('Fetching issues...');
    const issues = await fetchIssues();
    console.log('Issues fetched:', issues.length);
    
    if (issues.length === 0) {
        console.log('No issues found, showing empty state');
        const feed = document.getElementById('posts-feed');
        if (feed) {
            feed.innerHTML = '<div class="loading"><h2>No posts found</h2><p>Check back later for updates!</p></div>';
        }
        updateStats();
        return;
    }
    
    state.posts = issues.map(transformIssueToPost);
    console.log('Posts transformed:', state.posts.length);
    renderPosts();
    updateStats();
    checkStreak();
    console.log('App initialized successfully');
}

function checkStreak() {
    const last = localStorage.getItem('lastVisit');
    const today = new Date().toDateString();
    if (last !== today) {
        const yest = new Date();
        yest.setDate(yest.getDate() - 1);
        if (last === yest.toDateString()) state.streak++;
        else if (last !== today) state.streak = 1;
        localStorage.setItem('lastVisit', today);
        localStorage.setItem('streak', state.streak);
    }
}

// Share functions
function showShareMenu(postId) {
    const menu = document.getElementById(`share-menu-${postId}`);
    if (menu) {
        menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
    }
}

function sharePost(postId, platform) {
    const post = state.posts.find(p => p.id === postId);
    if (!post) return;
    
    const url = post.html_url;
    const title = post.title;
    
    if (platform === 'twitter') {
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'linkedin') {
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'copy') {
        navigator.clipboard.writeText(url).then(() => {
            showToast('Link copied to clipboard!');
        });
    }
    
    // Hide menu
    const menu = document.getElementById(`share-menu-${postId}`);
    if (menu) menu.style.display = 'none';
}

// Save post
function savePost(postId) {
    const saved = JSON.parse(localStorage.getItem('saved') || '[]');
    if (!saved.includes(postId)) {
        saved.push(postId);
        localStorage.setItem('saved', JSON.stringify(saved));
        showToast('Post saved!');
    } else {
        showToast('Post already saved');
    }
}

// Report post
function reportPost(postId) {
    const confirmed = confirm('Are you sure you want to report this post?');
    if (confirmed) {
        // In a real app, this would send to API
        showToast('📢 Report submitted. Thank you for keeping the community safe!');
    }
}

// Filter by month
function filterByMonth(month) {
    state.currentTimeRange = month;
    document.querySelectorAll('.nav-item, .side-nav-item').forEach(b => b.classList.remove('active'));
    renderPosts();
    showToast(`Showing posts from ${month}`);
}

// Expose functions
window.vote = vote;
window.openModal = openModal;
window.closeModal = closeModal;
window.showToast = showToast;
window.filterByMonth = filterByMonth;
window.sharePost = sharePost;
window.showShareMenu = showShareMenu;
window.savePost = savePost;
window.reportPost = reportPost;

// Start
document.addEventListener('DOMContentLoaded', init);

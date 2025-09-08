// Configuration and Constants
const levelMap = {
    basic: [800, 900],
    intermediate: [1000, 1200],
    advanced: [1300, 1600],
    expert: [1700, 2000],
    pro: [2100, 3500]
};

const availableTags = [
    "implementation", "math", "greedy", "dp", "data structures",
    "strings", "brute force", "graphs", "binary search", "sortings",
    "number theory", "geometry", "constructive algorithms", "trees",
    "combinatorics", "dfs and similar", "two pointers", "bitmasks"
];

// Global State Variables
let allQuestions = [];
let allFilteredQuestions = [];
let displayedQuestions = [];
let activeTags = new Set();
let currentPage = 0;
const questionsPerPage = 20;
let currentView = 'grid';

// Cache for API responses
const cache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// DOM Elements
const difficultySelect = document.getElementById("difficulty");
const sortSelect = document.getElementById("sortBy");
const tagsContainer = document.getElementById("tagsContainer");
const questionsContainer = document.getElementById("questionsContainer");
const questionsCount = document.getElementById("questionsCount");
const questionsHeader = document.querySelector(".questions-header");
const searchInput = document.getElementById("searchInput");
const clearTagsBtn = document.getElementById("clearTags");
const loadMoreBtn = document.getElementById("loadMore");
const totalQuestionsSpan = document.getElementById("totalQuestions");
const filteredCountSpan = document.getElementById("filteredCount");

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    createTagButtons();
    setupEventListeners();
    setupKeyboardShortcuts();
});

// Event Listeners Setup
const setupEventListeners = () => {
    difficultySelect.addEventListener("change", fetchQuestions);
    sortSelect.addEventListener("change", displayQuestions);
    searchInput.addEventListener("input", handleSearch);
    clearTagsBtn.addEventListener("click", clearAllTags);
    loadMoreBtn.addEventListener("click", loadMoreQuestions);

    // View toggle functionality
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelector('.view-btn.active').classList.remove('active');
            btn.classList.add('active');
            currentView = btn.dataset.view;
            questionsContainer.className = currentView === 'grid' ? 'questions-grid' : 'questions-list';
        });
    });
};

// Keyboard Shortcuts
const setupKeyboardShortcuts = () => {
    document.addEventListener('keydown', (e) => {
        // Don't interfere if user is typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
            if (e.key === 'Escape') {
                e.target.blur();
                handleSearch();
            }
            return;
        }

        // Focus search with Ctrl+K or /
        if ((e.ctrlKey && e.key === 'k') || e.key === '/') {
            e.preventDefault();
            searchInput.focus();
        }
        
        // Clear filters with Escape
        if (e.key === 'Escape') {
            searchInput.value = '';
            clearAllTags();
            handleSearch();
        }
        
        // Quick difficulty selection with numbers 1-5
        if (e.key >= '1' && e.key <= '5' && !e.ctrlKey && !e.altKey) {
            const difficulties = ['basic', 'intermediate', 'advanced', 'expert', 'pro'];
            difficultySelect.value = difficulties[e.key - 1];
            fetchQuestions();
        }
    });
};

// Tag Management Functions
const createTagButtons = () => {
    tagsContainer.innerHTML = "";
    availableTags.forEach(tag => {
        const btn = document.createElement("button");
        btn.innerText = tag.charAt(0).toUpperCase() + tag.slice(1).replace(/([A-Z])/g, ' $1');
        btn.classList.add("tag-btn");
        btn.dataset.tag = tag;
        btn.addEventListener("click", () => toggleTag(tag, btn));
        tagsContainer.appendChild(btn);
    });
};

const toggleTag = (tag, btn) => {
    if (activeTags.has(tag)) {
        activeTags.delete(tag);
        btn.classList.remove("active");
    } else {
        activeTags.add(tag);
        btn.classList.add("active");
    }
    currentPage = 0;
    displayQuestions();
};

const clearAllTags = () => {
    activeTags.clear();
    document.querySelectorAll('.tag-btn').forEach(btn => btn.classList.remove('active'));
    currentPage = 0;
    displayQuestions();
};

// Search Functionality
const handleSearch = () => {
    currentPage = 0;
    displayQuestions();
};

// Utility Functions
const getDifficultyClass = (rating) => {
    if (rating <= 900) return 'difficulty-basic';
    if (rating <= 1200) return 'difficulty-intermediate';
    if (rating <= 1600) return 'difficulty-advanced';
    if (rating <= 2000) return 'difficulty-expert';
    return 'difficulty-pro';
};

const getDifficultyLabel = (rating) => {
    if (rating <= 900) return 'Basic';
    if (rating <= 1200) return 'Intermediate';
    if (rating <= 1600) return 'Advanced';
    if (rating <= 2000) return 'Expert';
    return 'Pro';
};

// Main Display Logic
const displayQuestions = () => {
    if (allFilteredQuestions.length === 0) {
        questionsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search" style="font-size: 48px; margin-bottom: 20px; opacity: 0.3;"></i>
                <h3>No problems found</h3>
                <p>Try adjusting your filters or select a difficulty level</p>
            </div>
        `;
        questionsHeader.style.display = 'none';
        loadMoreBtn.style.display = 'none';
        return;
    }

    let filtered = [...allFilteredQuestions];

    // Apply tag filter
    if (activeTags.size > 0) {
        filtered = filtered.filter(q =>
            q.tags.some(tag => activeTags.has(tag))
        );
    }

    // Apply search filter
    const searchTerm = searchInput.value.toLowerCase().trim();
    if (searchTerm) {
        filtered = filtered.filter(q =>
            q.name.toLowerCase().includes(searchTerm)
        );
    }

    // Apply sorting
    const sortBy = sortSelect.value;
    filtered.sort((a, b) => {
        switch (sortBy) {
            case 'name':
                return a.name.localeCompare(b.name);
            case 'contestId':
                return b.contestId - a.contestId;
            case 'rating':
            default:
                return (a.rating || 0) - (b.rating || 0);
        }
    });

    displayedQuestions = filtered;
    updateStats();

    const startIndex = currentPage * questionsPerPage;
    const endIndex = startIndex + questionsPerPage;
    const pageQuestions = filtered.slice(0, endIndex);

    questionsContainer.innerHTML = pageQuestions.map(q => {
        const link = `https://codeforces.com/problemset/problem/${q.contestId}/${q.index}`;
        const difficultyClass = getDifficultyClass(q.rating);
        const difficultyLabel = getDifficultyLabel(q.rating);

        return `
            <div class="question">
                <div class="question-header">
                    <div class="difficulty-badge ${difficultyClass}">${difficultyLabel}</div>
                </div>
                <a href="${link}" target="_blank" rel="noopener noreferrer">${q.name}</a>
                <div class="question-meta">
                    <div class="meta-item">
                        <i class="fas fa-star"></i>
                        <span>${q.rating || "Unrated"}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-trophy"></i>
                        <span>Contest ${q.contestId}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-hashtag"></i>
                        <span>Problem ${q.index}</span>
                    </div>
                </div>
                <div class="tags-list">
                    ${q.tags.slice(0, 5).map(tag => `<span class="tag-mini">${tag}</span>`).join('')}
                    ${q.tags.length > 5 ? `<span class="tag-mini">+${q.tags.length - 5} more</span>` : ''}
                </div>
            </div>
        `;
    }).join("");

    questionsHeader.style.display = 'flex';
    loadMoreBtn.style.display = endIndex < filtered.length ? 'block' : 'none';
};

// Pagination
const loadMoreQuestions = () => {
    currentPage++;
    displayQuestions();
};

// Statistics Update
const updateStats = () => {
    totalQuestionsSpan.textContent = allQuestions.length.toLocaleString();
    filteredCountSpan.textContent = displayedQuestions.length.toLocaleString();
    questionsCount.textContent = `Showing ${Math.min((currentPage + 1) * questionsPerPage, displayedQuestions.length)} of ${displayedQuestions.length} problems`;
};

// API Integration
const fetchQuestions = async () => {
    const level = difficultySelect.value;
    if (!level) return;

    // Check cache first
    const cacheKey = `problems_${level}`;
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        allQuestions = cached.allQuestions;
        allFilteredQuestions = cached.filteredQuestions;
        displayQuestions();
        return;
    }

    questionsContainer.innerHTML = `
        <div class="loading">
            <div class="loading-spinner"></div>
            <h3>Fetching Problems...</h3>
            <p>Loading coding challenges from Codeforces</p>
        </div>
    `;
    questionsHeader.style.display = 'none';
    loadMoreBtn.style.display = 'none';

    // Reset application state
    activeTags.clear();
    currentPage = 0;
    searchInput.value = '';
    createTagButtons();

    try {
        const res = await fetch("https://codeforces.com/api/problemset.problems");
        if (!res.ok) throw new Error('Failed to fetch problems');

        const data = await res.json();
        if (data.status !== 'OK') throw new Error('API returned error status');

        allQuestions = data.result.problems;
        const [min, max] = levelMap[level];

        allFilteredQuestions = allQuestions.filter(p =>
            p.rating && p.rating >= min && p.rating <= max && p.tags
        ).map(p => ({
            ...p,
            tags: p.tags.map(tag => tag.toLowerCase())
        }));

        // Cache the results
        cache.set(cacheKey, {
            allQuestions: allQuestions,
            filteredQuestions: allFilteredQuestions,
            timestamp: Date.now()
        });

        displayQuestions();
    } catch (err) {
        console.error('Error fetching problems:', err);
        questionsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 20px; color: var(--accent-color);"></i>
                <h3>Error Loading Problems</h3>
                <p>Failed to fetch problems from Codeforces. Please try again.</p>
                <button onclick="fetchQuestions()" style="margin-top: 20px; padding: 10px 20px; background: var(--primary-color); color: #000; border: none; border-radius: 8px; cursor: pointer;">Retry</button>
            </div>
        `;
    }
};

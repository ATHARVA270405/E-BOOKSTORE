// Google Books API Configuration
const GOOGLE_BOOKS_API_KEY = "AIzaSyDefsZqbkxZbm_bh347fMCn-Er8Aa-I3Fg"; // Replace with your actual API key
const GOOGLE_BOOKS_API_URL = "https://www.googleapis.com/books/v1/volumes";

// App State
let currentUser = window.currentUser || null; 
let books = [];
let library = JSON.parse(localStorage.getItem('lumina_library_v6') || '[]');
let manualBooks = JSON.parse(localStorage.getItem('lumina_manual_books_v2') || '[]');
let currentCategory = 'Trending';
let accessFilter = 'all'; 
let startIndex = 0;
const LOAD_COUNT = 12; // Reduced to avoid rate limiting
const ADMIN_STORAGE_KEY = "libris_local_db";
const AUTHOR_BOOKS_KEY = "author_published_books";
let localBooks = JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY)) || [];
let authorBooks = JSON.parse(localStorage.getItem(AUTHOR_BOOKS_KEY)) || [];

// Streak System
const STREAK_STORAGE_KEY = "reading_streak_data";

// Categories
const CATEGORIES = [
    { id: 'Trending', label: 'Trending', icon: '🔥', query: 'bestseller' },
    { id: 'Poems', label: 'Poetry', icon: '🖋️', query: 'poetry' },
    { id: 'Sci-Fi', label: 'Sci-Fi', icon: '🚀', query: 'science fiction' },
    { id: 'History', label: 'History', icon: '🏛️', query: 'history' },
    { id: 'Philosophy', label: 'Philosophy', icon: '💭', query: 'philosophy' }
];

// Initialize App
window.onload = () => {
    lucide.createIcons();
    renderCategories();
    renderManualBooks();
    loadAuthorBooks();
    fetchBooks(CATEGORIES[0].query, 0, false);
    
    
    // Initialize streak if user is logged in
    if (currentUser) {
        initializeStreak();
        updateStreakUI(getCurrentStreak()); // Add this line
    }
    
    // Also update streak display on page load
    updateStreakUIOnLoad(); // Add new function
};
// Add this function after initializeStreak function
function updateStreakUIOnLoad() {
    if (!currentUser) {
        // Hide all streak displays if no user
        const streakContainer = document.getElementById('streak-container');
        if (streakContainer) streakContainer.classList.add('hidden');
        return;
    }
    
    // Get current streak and update UI
    const streakData = JSON.parse(localStorage.getItem(STREAK_STORAGE_KEY) || '{}');
    const userStreak = streakData[currentUser.uid] || { currentStreak: 0 };
    updateStreakUI(userStreak.currentStreak);
}

function getCurrentStreak() {
    if (!currentUser) return 0;
    const streakData = JSON.parse(localStorage.getItem(STREAK_STORAGE_KEY) || '{}');
    const userStreak = streakData[currentUser.uid] || { currentStreak: 0 };
    return userStreak.currentStreak;
}
// ========== GOOGLE BOOKS API FUNCTIONS ==========
async function fetchBooks(query, index = 0, append = false) {
    const grid = document.getElementById('book-grid');
    const loading = document.getElementById('loading-state');
    const loadMoreContainer = document.getElementById('load-more-container');
    
    if (!append) {
        grid.innerHTML = '';
        loading.classList.remove('hidden');
        loadMoreContainer.classList.remove('hidden');
    }
    
    try {
        // Build API URL with proper parameters
        const apiUrl = `${GOOGLE_BOOKS_API_URL}?q=${encodeURIComponent(query)}&startIndex=${index}&maxResults=${LOAD_COUNT}&key=${GOOGLE_BOOKS_API_KEY}&langRestrict=en`;
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            if (response.status === 429) {
                throw new Error('Rate limit exceeded. Please try again later.');
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        let apiItems = [];
        if (data.items) {
            apiItems = data.items
                .filter(item => {
                    // Filter by year (1995 or newer)
                    const date = item.volumeInfo?.publishedDate;
                    if (!date) return false;
                    
                    const year = parseInt(date.substring(0, 4));
                    return !isNaN(year) && year >= 1995;
                })
                .map((item, idx) => {
                    const volumeInfo = item.volumeInfo || {};
                    const saleInfo = item.saleInfo || {};
                    
                    // Determine if book is free
                    const isFreeByAPI = saleInfo.saleability === 'FREE' || 
                                      saleInfo.saleability === 'NOT_FOR_SALE' ||
                                      (volumeInfo.previewLink && volumeInfo.previewLink.includes('preview=true'));
                    
                    // Use random distribution for demo (2/3 free, 1/3 paid)
                    const accessType = isFreeByAPI ? 'Free' : (idx % 2 === 0 ? 'Paid' : 'Free');
                    
                    // Generate Indian Rupee price for paid books
                    const price = accessType === 'Paid' ? 
                        `₹${Math.floor(Math.random() * 500) + 199}` : 'Free';
                    
                    return {
                        id: item.id,
                        title: volumeInfo.title || 'Untitled',
                        author: volumeInfo.authors?.[0] || 'Unknown Author',
                        cover: volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || 
                               volumeInfo.imageLinks?.smallThumbnail?.replace('http:', 'https:') ||
                               'https://images.unsplash.com/photo-1543004218-ee14110497f9?q=80&w=400',
                        type: accessType,
                        price: price,
                        link: volumeInfo.previewLink || volumeInfo.infoLink || '#',
                        isManual: false,
                        description: volumeInfo.description || 'No description available.',
                        publisher: volumeInfo.publisher || 'Unknown Publisher',
                        publishedDate: volumeInfo.publishedDate || 'Unknown Year',
                        pageCount: volumeInfo.pageCount || 'N/A'
                    };
                });
        } else {
            // No items found
            if (!append) {
                grid.innerHTML = `
                    <div class="col-span-full py-20 text-center">
                        <i data-lucide="search-x" class="w-12 h-12 mx-auto text-slate-300 mb-4"></i>
                        <p class="text-slate-500 font-medium">No books found for "${query}"</p>
                    </div>`;
                lucide.createIcons();
                loading.classList.add('hidden');
                return;
            }
        }

        // Apply access filter
        let filteredApiItems = apiItems;
        if (accessFilter === 'free') {
            filteredApiItems = apiItems.filter(b => b.type === 'Free');
        } else if (accessFilter === 'paid') {
            filteredApiItems = apiItems.filter(b => b.type === 'Paid');
        }

        // Combine with manual books for 'all' filter
        let combinedItems = filteredApiItems;
        if (accessFilter === 'all' && !append && index === 0) {
            combinedItems = [...manualBooks, ...filteredApiItems];
        }

        if (!append) {
            books = combinedItems;
            renderBooks(combinedItems, false);
        } else {
            books = [...books, ...combinedItems];
            renderBooks(combinedItems, true);
        }
        
        startIndex = index + LOAD_COUNT;
        
        // Hide load more button if no more results
        if (!data.items || data.items.length < LOAD_COUNT) {
            loadMoreContainer.classList.add('hidden');
        }
        
    } catch (err) { 
        console.error("Fetch error:", err); 
        
        // Show error message
        if (!append) {
            grid.innerHTML = `
                <div class="col-span-full py-20 text-center">
                    <i data-lucide="wifi-off" class="w-12 h-12 mx-auto text-slate-300 mb-4"></i>
                    <p class="text-slate-500 font-medium mb-4">Unable to fetch books</p>
                    <p class="text-sm text-slate-400">${err.message || 'Please check your connection'}</p>
                </div>`;
            lucide.createIcons();
        }
        
        showToast("Error fetching books. Please try again.");
    } finally { 
        loading.classList.add('hidden'); 
    }
}

// ========== STREAK SYSTEM ==========
// ========== EMAIL-BASED STREAK SYSTEM (NO FIREBASE UID) ==========
// Replace your streak functions in script.js with these

function initializeStreak() {
    if (!currentUser) {
        console.log("❌ No user - cannot initialize streak");
        return;
    }
    
    // Use EMAIL as the unique identifier
    const userEmail = currentUser.email;
    if (!userEmail) {
        console.log("❌ No email found");
        return;
    }
    
    console.log("🔥 Initializing streak for email:", userEmail);
    
    const today = new Date().toDateString();
    const streakData = JSON.parse(localStorage.getItem(STREAK_STORAGE_KEY) || '{}');
    const userStreak = streakData[userEmail] || {
        currentStreak: 0,
        lastLoginDate: null,
        totalDays: 0,
        awardedBooks: []
    };
    
    console.log("📊 Existing streak data:", userStreak);
    console.log("📅 Today:", today);
    console.log("📅 Last login:", userStreak.lastLoginDate);
    
    // Check if user already logged in today
    if (userStreak.lastLoginDate === today) {
        console.log("✅ Already logged in today - no change");
        updateStreakUI(userStreak.currentStreak);
        return;
    }
    
    // Check if yesterday login (consecutive)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();
    
    let newStreak = 1; // Default for new or broken streak
    let streakBroken = false;
    
    if (userStreak.lastLoginDate === yesterdayStr) {
        // Consecutive login - increase streak
        newStreak = userStreak.currentStreak + 1;
        console.log(`🔥 Consecutive day! Streak: ${userStreak.currentStreak} → ${newStreak}`);
    } else if (userStreak.lastLoginDate) {
        // Broken streak - reset to 1
        streakBroken = true;
        console.log(`💔 Streak broken! Previous: ${userStreak.currentStreak} days. Reset to 1.`);
        showToast(`💔 Streak broken! Previous streak: ${userStreak.currentStreak} days`);
    } else {
        console.log("🆕 First login - starting streak");
    }
    
    // Update streak data
    userStreak.currentStreak = newStreak;
    userStreak.lastLoginDate = today;
    userStreak.totalDays += 1;
    
    streakData[userEmail] = userStreak;
    localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(streakData));
    
    console.log("💾 Saved streak:", newStreak);
    
    // Check for milestone reward (EXACTLY 20 days)
    if (newStreak === 20 && !userStreak.awardedBooks.includes('20_day_streak')) {
        console.log("🎁 20-DAY MILESTONE REACHED!");
        awardFreeBookForStreak();
        userStreak.awardedBooks.push('20_day_streak');
        streakData[userEmail] = userStreak;
        localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(streakData));
    }
    
    updateStreakUI(newStreak);
    
    // Show success message (except if broken)
    if (!streakBroken && newStreak > 1) {
        showToast(`🔥 ${newStreak} day streak! Keep going!`);
    }
    
    return newStreak;
}

function getCurrentStreak() {
    if (!currentUser || !currentUser.email) return 0;
    const userEmail = currentUser.email;
    const streakData = JSON.parse(localStorage.getItem(STREAK_STORAGE_KEY) || '{}');
    const userStreak = streakData[userEmail] || { currentStreak: 0 };
    return userStreak.currentStreak;
}

function updateStreakUI(streakCount) {
    console.log("🎨 Updating UI with streak:", streakCount);
    
    // Update all streak displays
    const streakElements = [
        'streak-count',
        'nav-streak-count',
        'popup-streak-count',
        'lib-streak-val'
    ];
    
    streakElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = streakCount;
            console.log(`✓ Updated #${id} to ${streakCount}`);
        }
    });
    
    // Show/hide streak container
    const streakContainer = document.getElementById('streak-container');
    if (streakContainer) {
        if (currentUser && streakCount >= 0) {
            streakContainer.classList.remove('hidden');
            console.log("✅ Showing streak container");
        } else {
            streakContainer.classList.add('hidden');
            console.log("❌ Hiding streak container");
        }
    }
}

function awardFreeBookForStreak() {
    // Find a paid book to award as free
    const paidBooks = books.filter(book => book.type === 'Paid');
    if (paidBooks.length > 0) {
        const freeBook = paidBooks[0];
        showToast(`🎉 20-DAY STREAK! You earned "${freeBook.title}" FREE!`);
        
        // Add to library with special tag
        if (!library.find(b => b.id === freeBook.id)) {
            const rewardBook = {
                ...freeBook,
                type: 'Free',
                price: 'Free (20-Day Streak Reward)',
                isReward: true
            };
            library.push(rewardBook);
            localStorage.setItem('lumina_library_v6', JSON.stringify(library));
            
            // Update library view if open
            if (document.getElementById('library-view') && !document.getElementById('library-view').classList.contains('hidden')) {
                renderLibrary();
            }
        }
        
        // Show celebration
        setTimeout(() => {
            alert(`🎉 CONGRATULATIONS! 🎉\n\n20-Day Reading Streak Complete!\n\n"${freeBook.title}" unlocked in your library!\n\nKeep the streak alive! 🔥`);
        }, 500);
    }
}
// Function to display the reward book in streak popup
function displayStreakRewardBook(userStreak) {
    const bookPreview = document.getElementById('streak-book-preview');
    
    // Get all paid books from current collection
    let paidBooks = books.filter(book => book.type === 'Paid');
    
    // If no paid books in current view, try to get from all sources
    if (paidBooks.length === 0) {
        paidBooks = manualBooks.filter(book => book.type === 'Paid');
    }
    
    if (paidBooks.length === 0) {
        // No paid books available - hide preview
        if (bookPreview) {
            bookPreview.style.display = 'none';
        }
        return;
    }
    
    // Determine which book to show based on user's awarded books
    let rewardBook;
    
    if (userStreak.currentStreak >= 20 && !userStreak.awardedBooks.includes('20_day_streak')) {
        // User is at 20+ days and hasn't received reward yet - show what they'll get NOW
        rewardBook = paidBooks[0];
    } else if (userStreak.awardedBooks.includes('20_day_streak')) {
        // User already got their first reward - show next potential reward
        rewardBook = paidBooks[Math.min(1, paidBooks.length - 1)];
    } else {
        // User is building streak - show first book as motivation
        rewardBook = paidBooks[0];
    }
    
    // Update the UI with book details
    const coverImg = document.getElementById('streak-book-cover');
    const titleElem = document.getElementById('streak-book-title');
    const authorElem = document.getElementById('streak-book-author');
    const priceElem = document.getElementById('streak-book-price');
    
    if (coverImg && titleElem && authorElem && priceElem) {
        coverImg.src = rewardBook.cover || 'https://images.unsplash.com/photo-1543004218-ee14110497f9?q=80&w=400';
        coverImg.alt = rewardBook.title;
        
        titleElem.textContent = rewardBook.title;
        authorElem.textContent = `by ${rewardBook.author}`;
        priceElem.textContent = `Worth: ${rewardBook.price}`;
        
        // Show the preview
        bookPreview.style.display = 'block';
        
        // Add special styling if user can claim it NOW
        if (userStreak.currentStreak >= 20 && !userStreak.awardedBooks.includes('20_day_streak')) {
            bookPreview.classList.add('animate-pulse');
            priceElem.textContent = `🎉 UNLOCKED! Worth: ${rewardBook.price}`;
            priceElem.classList.add('text-green-600');
        } else {
            bookPreview.classList.remove('animate-pulse');
            priceElem.classList.remove('text-green-600');
        }
    }
}
function openStreakPopup() {
    if (!currentUser) {
        showToast("Please sign in to view your streak");
        return;
    }
    
    const userEmail = currentUser.email;
    const streakData = JSON.parse(localStorage.getItem(STREAK_STORAGE_KEY) || '{}');
    const userStreak = streakData[userEmail] || { currentStreak: 0, awardedBooks: [] };
    
    document.getElementById('popup-streak-count').textContent = userStreak.currentStreak;
    
    // Get and display the reward book
    displayStreakRewardBook(userStreak);
    
    document.getElementById('streak-popup').classList.remove('hidden');
    
    // Refresh Lucide icons after showing popup
    setTimeout(() => lucide.createIcons(), 100);
}

function closeStreakPopup() {
    document.getElementById('streak-popup').classList.add('hidden');
}

function goToFreePaidBooks() {
    closeStreakPopup();
    setAccessFilter('paid');
    scrollToSearch();
}

// ========== BOOK MANAGEMENT FUNCTIONS ==========
function handleCategoryClick(catId) {
    const category = CATEGORIES.find(c => c.id === catId);
    if (!category) return;
    
    currentCategory = catId;
    renderCategories();
    fetchBooks(category.query, 0, false);
}

function handleSearch(e) { 
    e.preventDefault(); 
    const query = document.getElementById('search-input').value;
    if (query.trim()) {
        fetchBooks(query, 0, false);
    }
}

function setAccessFilter(type) {
    accessFilter = type;
    
    // Update UI Button Styles
    const filters = ['all', 'free', 'paid', 'admin'];
    filters.forEach(f => {
        const btn = document.getElementById(`filter-${f}`);
        if (btn) {
            if (f === type) {
                btn.className = "text-left px-4 py-2.5 rounded-xl text-sm font-bold bg-amber-600 text-white shadow-md";
            } else {
                btn.className = "text-left px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-orange-50";
            }
        }
    });

    // Reset and fetch based on filter
    if (type === 'admin') {
        renderAdminBooksOnly();
    } else {
        const category = CATEGORIES.find(c => c.id === currentCategory);
        fetchBooks(category ? category.query : 'books', 0, false);
    }
}

function renderAdminBooksOnly() {
    const grid = document.getElementById('book-grid');
    const loading = document.getElementById('loading-state');
    const loadMoreContainer = document.getElementById('load-more-container');
    
    loading.classList.add('hidden');
    loadMoreContainer.classList.add('hidden');
    
    if (localBooks.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-20 text-center">
                <i data-lucide="archive" class="w-12 h-12 mx-auto text-slate-300 mb-4"></i>
                <p class="text-slate-500 font-medium">No admin books added yet.</p>
            </div>`;
    } else {
        grid.innerHTML = localBooks.map(book => `
            <div class="book-card group relative bg-white border border-indigo-50 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-300">
                <div class="aspect-[3/4.2] overflow-hidden bg-indigo-50 relative">
                    <div class="w-full h-full flex items-center justify-center">
                        <i data-lucide="book-open" class="w-16 h-16 text-indigo-300"></i>
                    </div>
                    <div class="absolute top-4 left-4 z-10 flex flex-col gap-2">
                        <span class="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white">
                            ADMIN ORIGINAL
                        </span>
                    </div>
                    <div class="absolute inset-0 bg-slate-900/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center items-center p-6 gap-3">
                        <button onclick="openLocalPdf('${book.id}')" class="w-full py-4 bg-white text-slate-900 rounded-2xl font-bold text-xs hover:bg-indigo-600 hover:text-white transition-all">
                            Read Now
                        </button>
                        <button onclick="saveAdminToLibrary('${book.id}')" class="w-full py-4 bg-slate-800 text-white rounded-2xl font-bold text-xs hover:bg-slate-700 transition-all">
                            Add to Shelf
                        </button>
                    </div>
                </div>
                <div class="p-6">
                    <h3 class="font-serif font-bold text-slate-800 line-clamp-1 mb-1 text-lg">${book.name}</h3>
                    <p class="text-slate-500 text-xs italic">by ${book.author}</p>
                </div>
            </div>
        `).join("");
    }
    
    lucide.createIcons();
}

function renderBooks(items, append) {
    const grid = document.getElementById('book-grid');
    const html = items.map(book => createBookCard(book)).join('');
    
    if (append) {
        grid.innerHTML += html;
    } else {
        grid.innerHTML = html;
    }
    
    lucide.createIcons();
}

function createBookCard(book) {
    const badgeClass = book.type === 'Free' ? 'badge-free' : 'badge-paid';
    const badgeText = book.type === 'Free' ? 'Free' : book.price;
    
    return `
        <div class="book-card group relative bg-white border border-orange-50 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-300">
            <div class="aspect-[3/4.2] overflow-hidden bg-orange-50 relative">
                <img src="${book.cover}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                     onerror="this.src='https://images.unsplash.com/photo-1543004218-ee14110497f9?q=80&w=400'">
                <div class="absolute top-4 left-4 z-10 flex flex-col gap-2">
                    <span class="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${badgeClass}">
                        ${badgeText}
                    </span>
                    ${book.isManual ? '<span class="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white border border-white/20">Official Entry</span>' : ''}
                    ${book.isReward ? '<span class="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-green-600 text-white">🎁 Free Reward</span>' : ''}
                </div>
                <div class="absolute inset-0 bg-slate-900/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center items-center p-6 gap-3">
                    <button onclick="handleBookAction('${book.id}')" class="w-full py-4 bg-white text-slate-900 rounded-2xl font-bold text-xs hover:bg-amber-600 hover:text-white transition-all">
                        ${book.type === 'Free' ? 'Read Now' : 'Inquire (₹)'}
                    </button>
                    <button onclick="saveToLibrary('${book.id}')" class="w-full py-4 bg-slate-800 text-white rounded-2xl font-bold text-xs hover:bg-slate-700 transition-all">
                        Add to Shelf
                    </button>
                </div>
            </div>
            <div class="p-6">
                <h3 class="font-serif font-bold text-slate-800 line-clamp-1 mb-1 text-lg">${book.title}</h3>
                <p class="text-slate-500 text-xs italic">by ${book.author}</p>
            </div>
        </div>
    `;
}
// Add this function to check if elements exist
function debugStreakElements() {
    console.log("Checking streak elements...");
    console.log("streak-count:", document.getElementById('streak-count'));
    console.log("nav-streak-count:", document.getElementById('nav-streak-count'));
    console.log("streak-container:", document.getElementById('streak-container'));
    console.log("Current user:", currentUser);
}
// ========== AUTH & NAVIGATION ==========
function handleLogin(role) {
    currentUser = { 
        role: role, 
        name: role === 'Author' ? 'Author Name' : 'Reader',
        uid: `user_${role}_${Date.now()}`
    };
    
    document.getElementById('user-profile').classList.remove('hidden');
    document.getElementById('auth-controls').classList.add('hidden');
    document.getElementById('user-role-badge').innerText = role;
    document.getElementById('nav-library-btn').classList.remove('hidden');
    
    const adminBtn = document.getElementById('admin-nav-btn');
    if(role === 'Admin') {
        adminBtn.classList.remove('hidden');
        updateAdminView();
    }
    
    // Initialize and show streak
    const streak = initializeStreak();
     // ADD THIS LINE: Actually update the UI with the streak count
    
    // Force show streak container
    const streakContainer = document.getElementById('streak-container');
    if (streakContainer) {
        streakContainer.classList.remove('hidden');
    }
    updateStreakUI(streak); // This shows it on screen
    showToast("Welcome back! Your streak is active.");
}

function toggleAuth(state) {
    if(!state) {
        localStorage.removeItem("ebook_user");
        currentUser = null;
        document.getElementById('user-profile').classList.add('hidden');
        document.getElementById('auth-controls').classList.remove('hidden');
        document.getElementById('admin-nav-btn').classList.add('hidden');
        document.getElementById('nav-library-btn').classList.add('hidden');
        
        // ADD THESE 2 LINES:
        document.getElementById('streak-container').classList.add('hidden');
        document.getElementById('nav-streak-count').textContent = "0";
        
        switchView('home');
        showToast("Signed out");
    }
}
function switchView(view) {
    if(view === 'library' && !currentUser) {
        showToast("Please sign in to view your library");
        return;
    }

    ['home-view', 'library-view', 'publish-view', 'admin-view'].forEach(v => {
        const el = document.getElementById(v);
        if(el) el.classList.add('hidden');
    });
    
    const target = document.getElementById(`${view}-view`);
    if(target) target.classList.remove('hidden');
    
    const hero = document.getElementById('hero-section');
    if(view === 'home') hero.classList.remove('hidden'); else hero.classList.add('hidden');
    
    if(view === 'library') renderLibrary();
    if(view === 'admin') updateAdminView();
    window.scrollTo(0,0);
}

// ========== PUBLISH FUNCTION ==========
function handlePublish(e) { 
    e.preventDefault(); 
    
    if (!currentUser) {
        showToast("Please sign in to publish books");
        window.location.href = 'login.html';
        return;
    }
    
    const form = e.target;
    
    // Get form values
    const title = form.querySelector('input[type="text"]').value;
    const listingType = document.getElementById('listingType').value;
    let price = 'Free';
    if (listingType === 'Paid') {
        const priceInput = document.getElementById('bookPrice');
        price = priceInput.value ? '₹' + priceInput.value : '₹199';
    }
    
    // Get files
    const pdfFileInput = form.querySelector('input[type="file"][accept="application/pdf"]');
    const coverFileInput = form.querySelector('input[type="file"][accept="image/*"]');
    
    const pdfFile = pdfFileInput.files[0];
    const coverFile = coverFileInput.files[0];
    
    if (!pdfFile) {
        showToast("Please upload a PDF file");
        return;
    }
    
    // Validate file size (max 20MB)
    if (pdfFile.size > 20 * 1024 * 1024) {
        showToast("PDF file is too large. Max size is 20MB");
        return;
    }
    
    // Show loading
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="flex items-center justify-center gap-2"><i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Uploading...</span>';
    submitBtn.disabled = true;
    lucide.createIcons();
    
    // Process files
    const reader = new FileReader();
    
    reader.onload = function(e) {
        // PDF data is ready
        const pdfData = e.target.result;
        
        let coverData = 'https://images.unsplash.com/photo-1543004218-ee14110497f9?q=80&w=400'; // Default cover
        
        if (coverFile) {
            // If cover is uploaded, process it
            const coverReader = new FileReader();
            coverReader.onload = function(e2) {
                coverData = e2.target.result;
                saveBookToStorage(title, listingType, price, pdfData, coverData);
            };
            coverReader.readAsDataURL(coverFile);
        } else {
            // Use default cover
            saveBookToStorage(title, listingType, price, pdfData, coverData);
        }
    };
    
    reader.onerror = function() {
        showToast("Error reading PDF file");
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    };
    
    reader.readAsDataURL(pdfFile);
}

function saveBookToStorage(title, listingType, price, pdfData, coverData) {
    // Create new book object
    const newBook = {
        id: 'auth-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        title: title,
        author: currentUser.name || "Anonymous Author",
        listingType: listingType,
        price: price,
        pdfData: pdfData,
        coverImage: coverData,
        date: new Date().toLocaleDateString('en-IN', { 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric' 
        }),
        timestamp: Date.now(),
        views: 0,
        published: true
    };
    
    // Add to author books
    authorBooks.unshift(newBook);
    localStorage.setItem(AUTHOR_BOOKS_KEY, JSON.stringify(authorBooks));
    
    // Reset button
    const submitBtn = document.querySelector('#publish-view button[type="submit"]');
    submitBtn.innerHTML = 'Book Published Successfully!';
    submitBtn.className = 'w-full py-5 bg-green-600 text-white font-bold rounded-2xl shadow-xl shadow-green-200';
    
    // Reset form after delay
    setTimeout(() => {
        document.querySelector('#publish-view form').reset();
        submitBtn.innerHTML = 'Publish Book Now';
        submitBtn.className = 'w-full py-5 bg-slate-900 text-white font-bold rounded-2xl hover:bg-amber-600 transition-all shadow-xl shadow-slate-200';
        submitBtn.disabled = false;
        
        // Reset price field
        const priceField = document.getElementById('priceField');
        priceField.classList.add('hidden');
        
        showToast("✅ Book published successfully!");
        
        // If on author page, refresh it
        if (window.location.pathname.includes('author.html')) {
            window.location.reload();
        }
    }, 2000);
}

// ========== ADMIN & LIBRARY FUNCTIONS ==========
function updateAdminPreview() {
    const title = document.getElementById('admin-title').value || 'Book Title';
    const author = document.getElementById('admin-author').value || 'Author Name';
    const cover = document.getElementById('admin-cover').value || 'https://images.unsplash.com/photo-1543004218-ee14110497f9?q=80&w=400';
    const type = document.getElementById('admin-type').value;
    const price = type === 'Paid' ? '₹???' : 'Free';

    const container = document.getElementById('admin-preview-container');
    container.innerHTML = createBookCard({
        id: 'preview',
        title: title,
        author: author,
        cover: cover,
        type: type,
        price: price,
        isManual: true
    });
    lucide.createIcons();
}

function handleAdminManualAdd(e) {
    e.preventDefault();
    if(!currentUser || currentUser.role !== 'Admin') return;

    const newBook = {
        id: 'man-' + Date.now(),
        title: document.getElementById('admin-title').value,
        author: document.getElementById('admin-author').value,
        cover: document.getElementById('admin-cover').value || 'https://images.unsplash.com/photo-1543004218-ee14110497f9?q=80&w=400',
        type: document.getElementById('admin-type').value,
        price: document.getElementById('admin-type').value === 'Paid' ? '₹' + (Math.floor(Math.random() * 500) + 199) : 'Free',
        link: '#',
        desc: document.getElementById('admin-desc').value,
        isManual: true,
        date: new Date().toLocaleDateString()
    };

    manualBooks.unshift(newBook);
    localStorage.setItem('lumina_manual_books_v2', JSON.stringify(manualBooks));
    
    showToast("Success: Book pushed to library!");
    e.target.reset();
    updateAdminView();
    updateAdminPreview();
}

function deleteManualBook(id) {
    manualBooks = manualBooks.filter(b => b.id !== id);
    localStorage.setItem('lumina_manual_books_v2', JSON.stringify(manualBooks));
    updateAdminView();
    showToast("Book removed");
}

function updateAdminView() {
    const list = document.getElementById('admin-recent-list');
    const statCount = document.getElementById('stat-manual-count');
    statCount.innerText = manualBooks.length;

    list.innerHTML = manualBooks.slice(0, 5).map(book => `
        <tr class="group hover:bg-slate-50 transition-colors">
            <td class="py-4 px-2">
                <div class="flex items-center gap-3">
                    <img src="${book.cover}" class="w-8 h-10 object-cover rounded shadow-sm">
                    <span class="font-bold text-sm text-slate-900">${book.title}</span>
                </div>
            </td>
            <td class="py-4 px-2 text-sm text-slate-500">${book.author}</td>
            <td class="py-4 px-2">
                <span class="text-[10px] font-black px-2 py-1 rounded-full ${book.type === 'Free' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}">${book.price}</span>
            </td>
            <td class="py-4 px-2 text-right">
                <button onclick="deleteManualBook('${book.id}')" class="p-2 text-slate-300 hover:text-red-500 transition-colors">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="4" class="py-10 text-center text-slate-300 text-sm italic">No entries yet</td></tr>';
    lucide.createIcons();
}

function scrollToSearch() {
    switchView('home');
    document.getElementById('search-anchor').scrollIntoView({ behavior: 'smooth' });
}

function handleBookAction(id) {
    const book = books.find(b => b.id === id) || library.find(b => b.id === id);
    if(!book) return;
    
    if(book.type === 'Paid') {
        document.getElementById('inquiry-title').innerText = `${book.title} (${book.price})`;
        document.getElementById('contact-modal').classList.remove('hidden');
    } else {
        if(book.link && book.link !== '#') window.open(book.link, '_blank');
        else showToast("Preview restricted for this item");
    }
}

function saveToLibrary(id) {
    if(!currentUser) {
        showToast("Please sign in to save books");
        return;
    }
    const book = books.find(b => b.id === id);
    if(!book) return;
    if(!library.find(b => b.id === id)) {
        library.push(book);
        localStorage.setItem('lumina_library_v6', JSON.stringify(library));
        showToast("Added to your shelf");
    } else {
        showToast("Already in your shelf");
    }
}

function saveAdminToLibrary(bookId) {
    if(!currentUser) {
        showToast("Please sign in to save books");
        return;
    }
    
    const localData = JSON.parse(localStorage.getItem("libris_local_db")) || [];
    const book = localData.find(b => b.id === bookId);
    
    if(!book) return;
    
    const libraryBook = {
        id: book.id,
        title: book.name,
        author: book.author,
        cover: 'https://images.unsplash.com/photo-1543004218-ee14110497f9?q=80&w=400',
        type: 'Free',
        price: 'Free',
        link: '#',
        isManual: true
    };
    
    if(!library.find(b => b.id === book.id)) {
        library.push(libraryBook);
        localStorage.setItem('lumina_library_v6', JSON.stringify(library));
        showToast("Added to your shelf");
    } else {
        showToast("Already in your shelf");
    }
}

function renderLibrary() {
    const grid = document.getElementById('saved-books-grid');
    grid.innerHTML = library.length ? library.map(book => createBookCard(book)).join('') : `<p class="col-span-full text-center py-32 text-slate-400 font-bold">Shelf is empty.</p>`;
    lucide.createIcons();
}

function renderCategories() {
    const container = document.getElementById('category-list');
    container.innerHTML = CATEGORIES.map(cat => `
        <button onclick="handleCategoryClick('${cat.id}')" 
            class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${currentCategory === cat.id ? 'bg-amber-100 text-amber-700' : 'text-slate-500 hover:bg-orange-50'}">
            <span class="text-lg">${cat.icon}</span> ${cat.label}
        </button>
    `).join('');
}

function showToast(msg) {
    const t = document.getElementById('toast');
    document.getElementById('toast-msg').innerText = msg;
    t.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => t.classList.add('translate-y-20', 'opacity-0'), 3000);
}

function closeContactModal() { 
    document.getElementById('contact-modal').classList.add('hidden'); 
}

function handleContactAdmin(e) { 
    e.preventDefault(); 
    showToast("Inquiry sent!"); 
    closeContactModal(); 
}

function loadMore() {
    const category = CATEGORIES.find(c => c.id === currentCategory);
    fetchBooks(category ? category.query : 'books', startIndex, true);
}

// ========== CHATBOT LOGIC ==========
function toggleChatbot() {
    const win = document.getElementById('chatbot-window');
    const openIcon = document.getElementById('chat-icon-open');
    const closeIcon = document.getElementById('chat-icon-close');
    win.classList.toggle('hidden');
    openIcon.classList.toggle('hidden');
    closeIcon.classList.toggle('hidden');
    lucide.createIcons();
}

function handleChatSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if(!msg) return;

    addChatMessage(msg, 'user');
    input.value = '';

    setTimeout(() => {
        const reply = getBotReply(msg);
        addChatMessage(reply, 'bot');
    }, 500);
}

function addChatMessage(msg, role) {
    const container = document.getElementById('chat-messages');
    const bubble = document.createElement('div');
    bubble.className = role === 'user' ? 'chat-bubble-user p-4 text-sm text-slate-700 max-w-[85%] self-end' : 'chat-bubble-bot p-4 text-sm text-slate-700 max-w-[85%] self-start';
    bubble.innerText = msg;
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
}

function sendQuickMsg(msg) {
    document.getElementById('chat-input').value = msg;
    handleChatSubmit({ preventDefault: () => {} });
}

function getBotReply(message) {
    const msg = message.toLowerCase();

    if (msg.includes('free')) {
        return "You can filter Free books using the sidebar filter 📚✨";
    }

    if (msg.includes('paid')) {
        return "Paid ebooks come with previews. Click 'Inquire' to request access 💳";
    }

    if (msg.includes('latest') || msg.includes('new')) {
        return "We show modern ebooks (1995+). Try the Trending category 🔥";
    }

    if (msg.includes('login') || msg.includes('sign')) {
        return "Sign in using your email to save books & maintain streaks 🔐";
    }

    if (msg.includes('streak')) {
        return "Your reading streak increases every day you log in 📆🔥 Complete 20 days for a free book!";
    }

    if (msg.includes('library') || msg.includes('shelf')) {
        return "Your saved books appear in the Library section 📖";
    }

    if (msg.includes('help')) {
        return "Try asking: Free books, Latest ebooks, Login help, Streak info 🙂";
    }

    return "I'm here to help 📚 Try asking about free books, latest reads, or your library!";
}

function openLocalPdf(bookId) {
    const localBooks = JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY)) || [];
    const book = localBooks.find(b => b.id === bookId);
    
    if (book && book.pdfData) {
        window.openPdfViewer(book.pdfData, book.name);
    } else {
        alert("File not found!");
    }
}

function renderManualBooks() {
    // Load manual books from storage
    manualBooks = JSON.parse(localStorage.getItem('lumina_manual_books_v2') || '[]');
    localBooks = JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY)) || [];
}

function loadAuthorBooks() {
    authorBooks = JSON.parse(localStorage.getItem(AUTHOR_BOOKS_KEY)) || [];
}

// Global function to open PDF viewer
window.openPdfViewer = function(pdfData, title) {
    const newTab = window.open();
    newTab.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <style>
                body { 
                    margin: 0; 
                    padding: 0; 
                    background: #1e293b;
                    font-family: Arial, sans-serif;
                }
                .pdf-container { 
                    width: 100%; 
                    height: 100vh; 
                    display: flex;
                    flex-direction: column;
                }
                .pdf-header { 
                    background: white; 
                    padding: 1rem 1.5rem; 
                    display: flex; 
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid #e5e7eb;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .pdf-header h2 { 
                    margin: 0; 
                    font-size: 1.25rem;
                    color: #1e293b;
                    font-weight: 600;
                }
                .close-btn { 
                    background: #ef4444; 
                    color: white; 
                    border: none; 
                    padding: 0.5rem 1rem;
                    border-radius: 0.375rem;
                    cursor: pointer;
                    font-weight: 500;
                    transition: background 0.2s;
                }
                .close-btn:hover { 
                    background: #dc2626;
                }
                iframe {
                    flex: 1;
                    width: 100%;
                    border: none;
                }
            </style>
        </head>
        <body>
            <div class="pdf-container">
                <div class="pdf-header">
                    <h2>${title}</h2>
                    <button class="close-btn" onclick="window.close()">Close</button>
                </div>
                <iframe src="${pdfData}"></iframe>
            </div>
        </body>
        </html>
    `);
};

// Export all functions to global scope
window.initializeStreak = initializeStreak;
window.openStreakPopup = openStreakPopup;
window.closeStreakPopup = closeStreakPopup;
window.goToFreePaidBooks = goToFreePaidBooks;
window.switchView = switchView;
window.scrollToSearch = scrollToSearch;
window.handleSearch = handleSearch;
window.setAccessFilter = setAccessFilter;
window.handleCategoryClick = handleCategoryClick;
window.showToast = showToast;
window.handleLogin = handleLogin;
window.toggleAuth = toggleAuth;
window.handlePublish = handlePublish;
window.updateAdminPreview = updateAdminPreview;
window.handleAdminManualAdd = handleAdminManualAdd;
window.deleteManualBook = deleteManualBook;
window.updateAdminView = updateAdminView;
window.handleBookAction = handleBookAction;
window.saveToLibrary = saveToLibrary;
window.saveAdminToLibrary = saveAdminToLibrary;
window.renderLibrary = renderLibrary;
window.closeContactModal = closeContactModal;
window.handleContactAdmin = handleContactAdmin;
window.loadMore = loadMore;
window.toggleChatbot = toggleChatbot;
window.handleChatSubmit = handleChatSubmit;
window.sendQuickMsg = sendQuickMsg;
window.openLocalPdf = openLocalPdf;
window.togglePriceField = function() {
    const listingType = document.getElementById("listingType").value;
    const priceField = document.getElementById("priceField");
    const priceInput = document.getElementById("bookPrice");

    if (listingType === "Paid") {
        priceField.classList.remove("hidden");
        priceInput.required = true;
    } else {
        priceField.classList.add("hidden");
        priceInput.required = false;
        priceInput.value = "";
    }
};

// Initialize icons
lucide.createIcons();
// // TEST FUNCTION - Add this at the very end
// function testStreakNow() {
//     console.log("=== TESTING STREAK ===");
    
//     // Check if elements exist
//     const container = document.getElementById('streak-container');
//     const count = document.getElementById('streak-count');
    
//     console.log("Container found:", !!container);
//     console.log("Count element found:", !!count);
    
//     // Force create user and show streak
//     currentUser = { role: 'Reader', name: 'Test User', uid: 'test123' };
    
//     // Manually show streak
//     if (container) {
//         container.classList.remove('hidden');
//         console.log("✓ Streak shown");
//     }
    
//     if (count) {
//         count.textContent = "3";
//         console.log("✓ Count set to 3");
//     }
    
//     // Also update nav streak
//     const navCount = document.getElementById('nav-streak-count');
//     if (navCount) {
//         navCount.textContent = "3";
//         console.log("✓ Nav count set");
//     }
    
//     showToast("Test streak set to 3");
// }

// // Call it after 2 seconds
// setTimeout(testStreakNow, 2000);
// Temporary test - remove after confirming
window.displayStreakRewardBook = displayStreakRewardBook;
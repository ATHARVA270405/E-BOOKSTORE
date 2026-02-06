
let currentUser = null; 
let books = [];
let library = JSON.parse(localStorage.getItem('lumina_library_v6') || '[]');
let manualBooks = JSON.parse(localStorage.getItem('lumina_manual_books_v2') || '[]');
let currentCategory = 'Trending';
let accessFilter = 'all'; 
let startIndex = 0;
const LOAD_COUNT = 40;
const ADMIN_STORAGE_KEY = "libris_local_db";
const AUTHOR_BOOKS_KEY = "author_published_books";
let localBooks = JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY)) || [];
let authorBooks = JSON.parse(localStorage.getItem(AUTHOR_BOOKS_KEY)) || [];

// To prevent duplicate fetching
let lastQuery = '';
let lastStartIndex = -1;

const CATEGORIES = [
    { id: 'Trending', label: 'Trending', icon: '🔥' },
    { id: 'Poems', label: 'Poetry', icon: '🖋️' },
    { id: 'Sci-Fi', label: 'Sci-Fi', icon: '🚀' },
    { id: 'History', label: 'History', icon: '🏛️' },
    { id: 'Philosophy', label: 'Philosophy', icon: '💭' }
];

window.onload = () => {
    lucide.createIcons();
    renderCategories();
    renderManualBooks();
    loadAuthorBooks();
    fetchBooks(mapCategoryToQuery(currentCategory), 0, false);
    autoLoginFromStorage();
};

function autoLoginFromStorage() {
    const storedUser = localStorage.getItem("ebook_user");
    if (!storedUser) return;

    const user = JSON.parse(storedUser);
    handleLogin(user.role || "Reader");
}

function mapCategoryToQuery(cat) {
    const map = {
        'Trending': 'bestseller OR popular books',
        'Poems': 'modern poetry',
        'Sci-Fi': 'science fiction OR futuristic',
        'History': 'modern history',
        'Philosophy': 'contemporary philosophy'
    };
    return map[cat] || cat;
}

// --- AUTH & NAVIGATION ---
function handleLogin(role) {
    currentUser = { role: role, name: role === 'Author' ? 'Author Name' : 'Reader' };
    document.getElementById('user-profile').classList.remove('hidden');
    document.getElementById('auth-controls').classList.add('hidden');
    document.getElementById('user-role-badge').innerText = role;
    document.getElementById('nav-library-btn').classList.remove('hidden');
    
    const adminBtn = document.getElementById('admin-nav-btn');
    if(role === 'Admin') {
        adminBtn.classList.remove('hidden');
        updateAdminView();
    }
}

function toggleAuth(state) {
    if(!state) {
        localStorage.removeItem("ebook_user");
        currentUser = null;
        document.getElementById('user-profile').classList.add('hidden');
        document.getElementById('auth-controls').classList.remove('hidden');
        document.getElementById('admin-nav-btn').classList.add('hidden');
        document.getElementById('nav-library-btn').classList.add('hidden');
        
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

// --- PUBLISH FUNCTION - Fixed PDF handling ---
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

// --- ADMIN & LIBRARY FUNCTIONS ---
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

function setAccessFilter(type) {
    accessFilter = type;
    
    // Update UI Button Styles
    const filters = ['all', 'free', 'paid', 'admin'];
    filters.forEach(f => {
        const btn = document.getElementById(`filter-${f}`);
        if (f === type) {
            btn.className = "text-left px-4 py-2.5 rounded-xl text-sm font-bold bg-amber-600 text-white shadow-md";
        } else {
            btn.className = "text-left px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-orange-50";
        }
    });

    // Reset and fetch based on filter
    if (type === 'admin') {
        // Show only admin/original books
        renderAdminBooksOnly();
    } else {
        // Show Google Books with filter
        fetchBooks(mapCategoryToQuery(currentCategory), 0, false);
    }
}

function renderAdminBooksOnly() {
    const grid = document.getElementById('book-grid');
    const loading = document.getElementById('loading-state');
    const localData = JSON.parse(localStorage.getItem("libris_local_db")) || [];
    
    loading.classList.add('hidden');
    
    if (localData.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-20 text-center">
                <i data-lucide="archive" class="w-12 h-12 mx-auto text-slate-300 mb-4"></i>
                <p class="text-slate-500 font-medium">No admin books added yet.</p>
            </div>`;
    } else {
        grid.innerHTML = localData.map(book => `
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
    
    // Hide load more button for admin view
    document.getElementById('load-more-container').classList.add('hidden');
    lucide.createIcons();
}

async function fetchBooks(query, index = 0, append = false) {
    // Prevent duplicate calls with same parameters
    if (lastQuery === query && lastStartIndex === index && !append) {
        return;
    }
    
    const grid = document.getElementById('book-grid');
    const loading = document.getElementById('loading-state');
    const loadMoreContainer = document.getElementById('load-more-container');
    
    if (!append) {
        grid.innerHTML = '';
        loading.classList.remove('hidden');
        loadMoreContainer.classList.remove('hidden');
    }
    
    lastQuery = query;
    lastStartIndex = index;

    try {
        const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&orderBy=newest&printType=books&langRestrict=en&startIndex=${index}&maxResults=${LOAD_COUNT}`;

        const response = await fetch(url);
        const data = await response.json();
        
        let apiItems = [];
        if (data.items) {
            apiItems = data.items
                .filter(item => {
                    const date = item.volumeInfo?.publishedDate;
                    if (!date) return false;

                    const year = parseInt(date);
                    return !isNaN(year) && year >= 1995;
                })
                .map((item, idx) => {
                    const isFreeByAPI = item.saleInfo?.saleability === 'FREE_BOOKS';
                    const accessType = (isFreeByAPI || idx % 4 !== 0) ? 'Free' : 'Paid';

                    return {
                        id: item.id,
                        title: item.volumeInfo.title,
                        author: item.volumeInfo.authors?.[0] || 'Unknown Author',
                        cover: item.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || 'https://images.unsplash.com/photo-1543004218-ee14110497f9?q=80&w=400',
                        type: accessType,
                        price: accessType === 'Paid' ? '₹' + Math.floor(Math.random() * 500 + 199) : 'Free',
                        link: item.volumeInfo.previewLink,
                        isManual: false
                    };
                });
        }

        // Apply access filter to API books
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
        } else {
            books = [...books, ...combinedItems];
        }
        
        renderBooks(combinedItems, append);
        startIndex = index + LOAD_COUNT;
        
    } catch (err) { 
        console.error(err); 
        showToast("Error fetching books");
    } finally { 
        loading.classList.add('hidden'); 
    }
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
                <img src="${book.cover}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700">
                <div class="absolute top-4 left-4 z-10 flex flex-col gap-2">
                    <span class="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${badgeClass}">
                        ${badgeText}
                    </span>
                    ${book.isManual ? '<span class="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white border border-white/20">Official Entry</span>' : ''}
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

function handleCategoryClick(catId) {
    currentCategory = catId;
    renderCategories();
    fetchBooks(mapCategoryToQuery(catId), 0, false);
}

function handleSearch(e) { 
    e.preventDefault(); 
    const query = document.getElementById('search-input').value;
    if (query.trim()) {
        fetchBooks(query, 0, false);
    }
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
    fetchBooks(mapCategoryToQuery(currentCategory), startIndex, true);
}

// Chatbot Logic
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
        return "We show modern ebooks (2005+). Try the Trending category 🔥";
    }

    if (msg.includes('login') || msg.includes('sign')) {
        return "Sign in using your mobile number to save books & maintain streaks 🔐";
    }

    if (msg.includes('streak')) {
        return "Your reading streak increases every day you log in 📆🔥";
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

// Load author books
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

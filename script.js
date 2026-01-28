   
        let currentUser = null;
        let books = [];
        let library = JSON.parse(localStorage.getItem('lumina_library_v6') || '[]');
        let currentCategory = 'Trending';
        let accessFilter = 'all'; 
        let startIndex = 0;
        const LOAD_COUNT = 16;
        
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
            fetchBooks(currentCategory);
        };

        // Chatbot Logic
        function toggleChatbot() {
            const win = document.getElementById('chatbot-window');
            const openIcon = document.getElementById('chat-icon-open');
            const closeIcon = document.getElementById('chat-icon-close');
            
            const isHidden = win.classList.contains('hidden');
            if(isHidden) {
                win.classList.remove('hidden');
                setTimeout(() => win.classList.add('scale-100', 'opacity-100'), 10);
                openIcon.classList.add('hidden');
                closeIcon.classList.remove('hidden');
            } else {
                win.classList.add('hidden');
                openIcon.classList.remove('hidden');
                closeIcon.classList.add('hidden');
            }
            lucide.createIcons();
        }

        function addChatMessage(msg, role) {
            const container = document.getElementById('chat-messages');
            const bubble = document.createElement('div');
            bubble.className = role === 'user' ? 'chat-bubble-user p-4 text-sm text-slate-700 max-w-[85%] self-end' : 'chat-bubble-bot p-4 text-sm text-slate-700 max-w-[85%] self-start';
            bubble.innerText = msg;
            container.appendChild(bubble);
            container.scrollTop = container.scrollHeight;
        }

        function handleChatSubmit(e) {
            e.preventDefault();
            const input = document.getElementById('chat-input');
            const msg = input.value.trim();
            if(!msg) return;
            
            addChatMessage(msg, 'user');
            input.value = '';
            
            // Simple Bot Logic
            setTimeout(() => {
                let reply = "That's an interesting question! I can help you find books on that subject. Would you like to see our most popular free titles?";
                if(msg.toLowerCase().includes('free')) {
                    reply = "We have over 12,000 free books! Click on the 'Free Access' filter on the left to see them instantly.";
                } else if(msg.toLowerCase().includes('publish')) {
                    reply = "To publish, click the 'Publish' button in the navigation bar. Our team reviews all manuscripts within 48 hours.";
                }
                addChatMessage(reply, 'bot');
            }, 600);
        }

        function sendQuickMsg(msg) {
            document.getElementById('chat-input').value = msg;
            handleChatSubmit({ preventDefault: () => {} });
        }

        // Existing Site Logic
        function switchView(view) {
            ['home-view', 'library-view', 'publish-view'].forEach(v => document.getElementById(v).classList.add('hidden'));
            document.getElementById(`${view}-view`).classList.remove('hidden');
            const hero = document.getElementById('hero-section');
            if(view === 'home') hero.classList.remove('hidden'); else hero.classList.add('hidden');
            if(view === 'library') renderLibrary();
            window.scrollTo(0,0);
        }

        function scrollToSearch() {
            switchView('home');
            document.getElementById('search-anchor').scrollIntoView({ behavior: 'smooth' });
        }

        function setAccessFilter(type) {
            accessFilter = type;
            ['all', 'free', 'paid'].forEach(t => {
                const btn = document.getElementById(`filter-${t}`);
                btn.className = (t === type) ? 'text-left px-4 py-2.5 rounded-xl text-sm font-bold bg-amber-600 text-white shadow-md' : 'text-left px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-orange-50';
            });
            fetchBooks(currentCategory, 0, false);
        }

        async function fetchBooks(query, index = 0, append = false) {
            const grid = document.getElementById('book-grid');
            const loading = document.getElementById('loading-state');
            if(!append) { grid.innerHTML = ''; loading.classList.remove('hidden'); }

            try {
                const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&startIndex=${index}&maxResults=${LOAD_COUNT}`;
                const response = await fetch(url);
                const data = await response.json();
                
                if (data.items) {
                    let mappedItems = data.items.map((item, idx) => {
                        const isFreeByAPI = item.saleInfo?.saleability === 'FREE_BOOKS';
                        const accessType = (isFreeByAPI || idx % 3 !== 0) ? 'Free' : 'Paid';
                        return {
                            id: item.id,
                            title: item.volumeInfo.title,
                            author: item.volumeInfo.authors?.[0] || 'Unknown Author',
                            cover: item.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || 'https://images.unsplash.com/photo-1543004218-ee14110497f9?q=80&w=400',
                            type: accessType,
                            price: accessType === 'Paid' ? '₹' + Math.floor(Math.random() * 500 + 199) : 'Free',
                            link: item.volumeInfo.previewLink,
                            year: item.volumeInfo.publishedDate?.substring(0,4) || '2024'
                        };
                    });
                    if(accessFilter !== 'all') mappedItems = mappedItems.filter(b => b.type.toLowerCase() === accessFilter);
                    if(!append) books = mappedItems; else books = [...books, ...mappedItems];
                    renderBooks(mappedItems, append);
                }
                startIndex = index;
            } catch (err) { console.error(err); } 
            finally { loading.classList.add('hidden'); }
        }

        function renderBooks(items, append) {
            const grid = document.getElementById('book-grid');
            const html = items.map(book => createBookCard(book)).join('');
            if(append) grid.innerHTML += html; else grid.innerHTML = html;
            lucide.createIcons();
        }

        function createBookCard(book) {
            const badgeClass = book.type === 'Free' ? 'badge-free' : 'badge-paid';
            return `
                <div class="book-card group relative bg-white border border-orange-50 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-300">
                    <div class="aspect-[3/4.2] overflow-hidden bg-orange-50 relative">
                        <img src="${book.cover}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700">
                        <div class="absolute top-4 left-4 z-10">
                            <span class="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${badgeClass}">
                                ${book.price}
                            </span>
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
                lucide.createIcons();
            } else {
                window.open(book.link, '_blank');
            }
        }

        function saveToLibrary(id) {
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

        function renderLibrary() {
            const grid = document.getElementById('saved-books-grid');
            grid.innerHTML = library.length ? library.map(book => createBookCard(book)).join('') : `<p class="col-span-full text-center py-32 text-slate-400 font-bold">Shelf is empty.</p>`;
            lucide.createIcons();
        }

        function handleCategoryClick(catId) { currentCategory = catId; renderCategories(); fetchBooks(catId, 0, false); }
        function handleSearch(e) { e.preventDefault(); fetchBooks(document.getElementById('search-input').value); }
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

        function closeContactModal() { document.getElementById('contact-modal').classList.add('hidden'); }
        function handleContactAdmin(e) { e.preventDefault(); showToast("Inquiry sent!"); closeContactModal(); }
        function handlePublish(e) { e.preventDefault(); showToast("Manuscript sent!"); e.target.reset(); }
        function loadMore() { fetchBooks(currentCategory, startIndex + LOAD_COUNT, true); }
        function toggleAuth(s) { document.getElementById('user-profile').classList.toggle('hidden', !s); document.getElementById('auth-btn').classList.toggle('hidden', s); }
        function openModal() { toggleAuth(true); showToast("Welcome back!"); }
   
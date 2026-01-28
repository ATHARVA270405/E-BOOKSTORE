
        // Initial State
        let books = [
            { id: 1, name: "The Great Gatsby", author: "F. Scott Fitzgerald", type: "Ebook", category: "Classic", addedDate: "2023-10-12" },
            { id: 2, name: "Atomic Habits", author: "James Clear", type: "Normal", category: "Self-Help", addedDate: "2023-11-05" },
            { id: 3, name: "Project Hail Mary", author: "Andy Weir", type: "Audiobook", category: "Sci-Fi", addedDate: "2023-12-01" },
            { id: 4, name: "The Alchemist", author: "Paulo Coelho", type: "Ebook", category: "Fiction", addedDate: "2024-01-15" }
        ];

        // UI Handlers
        function switchTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.nav-btn').forEach(btn => {
                btn.classList.remove('bg-indigo-600', 'text-white', 'shadow-lg', 'shadow-indigo-900/40');
                btn.classList.add('text-slate-400');
            });

            document.getElementById(`tab-${tabId}`).classList.add('active');
            const activeBtn = document.getElementById(`btn-${tabId}`);
            activeBtn.classList.add('bg-indigo-600', 'text-white', 'shadow-lg', 'shadow-indigo-900/40');
            activeBtn.classList.remove('text-slate-400');

            document.getElementById('page-title').innerText = tabId === 'dashboard' ? 'Portal Insights' : 'Library Catalog';
            
            if(tabId === 'dashboard') updateDashboard();
            else renderInventory();
        }

        function openModal() {
            document.getElementById('modal').classList.add('active');
        }

        function closeModal() {
            document.getElementById('modal').classList.remove('active');
        }

        // Logic
        function updateDashboard() {
            const stats = {
                total: books.length,
                ebooks: books.filter(b => b.type === 'Ebook').length,
                audiobooks: books.filter(b => b.type === 'Audiobook').length,
                normal: books.filter(b => b.type === 'Normal').length
            };

            document.getElementById('stat-total').innerText = stats.total;
            document.getElementById('stat-ebooks').innerText = stats.ebooks;
            document.getElementById('stat-audiobooks').innerText = stats.audiobooks;
            document.getElementById('stat-normal').innerText = stats.normal;

            // Render Recent
            const recentContainer = document.getElementById('recent-list');
            recentContainer.innerHTML = books.slice(0, 5).map(book => `
                <div class="p-4 px-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-xl flex items-center justify-center border ${getTypeClass(book.type)}">
                            ${getIcon(book.type)}
                        </div>
                        <div>
                            <p class="font-semibold text-slate-800">${book.name}</p>
                            <p class="text-xs text-slate-500">${book.author} • <span class="text-indigo-600 font-medium">${book.category}</span></p>
                        </div>
                    </div>
                    <span class="text-[10px] font-bold text-slate-400 uppercase">${book.addedDate}</span>
                </div>
            `).join('');

            // Render Mix Bars
            const distribution = [
                { label: 'Ebooks', count: stats.ebooks, color: 'bg-purple-500' },
                { label: 'Audiobooks', count: stats.audiobooks, color: 'bg-blue-500' },
                { label: 'Physical', count: stats.normal, color: 'bg-orange-500' }
            ];
            const barsContainer = document.getElementById('distribution-bars');
            barsContainer.innerHTML = distribution.map(item => {
                const perc = stats.total ? Math.round((item.count / stats.total) * 100) : 0;
                return `
                    <div>
                        <div class="flex justify-between text-sm mb-1">
                            <span class="text-slate-600 font-medium">${item.label}</span>
                            <span class="text-slate-900 font-bold">${perc}%</span>
                        </div>
                        <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div class="${item.color} h-full transition-all duration-1000" style="width: ${perc}%"></div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function renderInventory() {
            const query = document.getElementById('search-input').value.toLowerCase();
            const filtered = books.filter(b => b.name.toLowerCase().includes(query) || b.author.toLowerCase().includes(query));
            
            const tbody = document.getElementById('inventory-table-body');
            tbody.innerHTML = filtered.map(book => `
                <tr class="hover:bg-slate-50/50 transition-colors group">
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-lg flex items-center justify-center border ${getTypeClass(book.type)} opacity-80">
                                ${getIcon(book.type, 14)}
                            </div>
                            <div>
                                <p class="font-bold text-slate-800">${book.name}</p>
                                <p class="text-sm text-slate-500">${book.author}</p>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${getTypeClass(book.type)}">
                            ${book.type}
                        </span>
                    </td>
                    <td class="px-6 py-4">
                        <span class="text-sm text-slate-600 font-medium">${book.category}</span>
                    </td>
                    <td class="px-6 py-4 text-sm text-slate-500 font-mono">${book.addedDate}</td>
                    <td class="px-6 py-4 text-right">
                        <button onclick="deleteBook(${book.id})" class="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </button>
                    </td>
                </tr>
            `).join('');

            if (filtered.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-20 text-center text-slate-400">No results found</td></tr>`;
            }
        }

        function addBook(e) {
            e.preventDefault();
            const newBook = {
                id: Date.now(),
                name: document.getElementById('form-name').value,
                author: document.getElementById('form-author').value,
                type: document.getElementById('form-type').value,
                category: document.getElementById('form-category').value,
                addedDate: new Date().toISOString().split('T')[0]
            };
            books = [newBook, ...books];
            closeModal();
            e.target.reset();
            updateDashboard();
            renderInventory();
        }

        function deleteBook(id) {
            books = books.filter(b => b.id !== id);
            updateDashboard();
            renderInventory();
        }

        // Helpers
        function getTypeClass(type) {
            if (type === 'Ebook') return 'bg-purple-100 text-purple-700 border-purple-200';
            if (type === 'Audiobook') return 'bg-blue-100 text-blue-700 border-blue-200';
            return 'bg-orange-100 text-orange-700 border-orange-200';
        }

        function getIcon(type, size = 18) {
            if (type === 'Ebook') return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`;
            if (type === 'Audiobook') return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>`;
            return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`;
        }

        // Init
        window.onload = updateDashboard;
    
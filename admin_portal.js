/*************************
 * CONFIGURATION & STATE
 *************************/
const STORAGE_KEY = "libris_local_db";
let books = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

// Initialize Page
document.addEventListener('DOMContentLoaded', () => {
    refreshUI();
});

/*************************
 * TAB SWITCHING LOGIC
 *************************/
function switchTab(tabId) {
    // Toggle Content
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');

    // Toggle Buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-indigo-600', 'text-white', 'shadow-lg', 'shadow-indigo-900/40');
        btn.classList.add('text-slate-400', 'hover:bg-slate-800', 'hover:text-white');
    });

    const activeBtn = document.getElementById(`btn-${tabId}`);
    activeBtn.classList.add('bg-indigo-600', 'text-white', 'shadow-lg', 'shadow-indigo-900/40');
    activeBtn.classList.remove('text-slate-400', 'hover:bg-slate-800');

    // Update Titles
    document.getElementById('page-title').innerText = tabId === 'dashboard' ? 'Portal Insights' : 'Library Inventory';
    document.getElementById('page-subtitle').innerText = tabId === 'dashboard' ? 'Managing catalog data' : 'Full list of resources';
}

/*************************
 * MODAL LOGIC
 *************************/
function openModal() {
    document.getElementById('modal').classList.add('active');
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
    document.querySelector('form').reset();
}

function updateStorageHealth() {
    const STORAGE_LIMIT_KB = 5120; // Standard 5MB limit in KB
    const storageKey = "libris_local_db"; // Must match your storage key
    
    // Get the raw data string from storage
    const rawData = localStorage.getItem(storageKey) || "";
    
    // Calculate size: String length * 2 bytes (UTF-16) / 1024 to get KB
    const usedKB = (rawData.length * 2) / 1024;
    const percentage = Math.min((usedKB / STORAGE_LIMIT_KB) * 100, 100).toFixed(1);
    const remainingKB = Math.max(STORAGE_LIMIT_KB - usedKB, 0).toFixed(0);

    const bar = document.getElementById("storage-bar");
    const statusText = document.getElementById("storage-status-text");

    // Update Progress Bar Width
    bar.style.width = `${percentage}%`;

    // Update Color based on usage
    if (percentage < 60) {
        bar.className = "bg-emerald-400 h-full transition-all duration-500";
        statusText.innerText = `Optimized: ${remainingKB} KB left`;
    } else if (percentage < 85) {
        bar.className = "bg-orange-400 h-full transition-all duration-500";
        statusText.innerText = `Warning: ${remainingKB} KB left`;
    } else {
        bar.className = "bg-red-500 h-full transition-all duration-500";
        statusText.innerText = `Almost Full: ${remainingKB} KB left`;
    }
}

/*************************
 * CORE FUNCTIONS (ADD & DELETE)
 *************************/
async function addBook(e) {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector("button[type='submit']");
    const originalText = submitBtn.innerText;
    
    // Get Form Data
    const name = document.getElementById("form-name").value;
    const author = document.getElementById("form-author").value;
    const type = document.getElementById("form-type").value;
    const category = document.getElementById("form-category").value;
    const pdfFile = document.getElementById("bookPdf").files[0];

    if (!pdfFile) return alert("Please select a PDF");

    submitBtn.innerText = "Processing...";
    submitBtn.disabled = true;

    // Convert PDF to Base64 String
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const newBook = {
                id: Date.now().toString(),
                name: name,
                author: author,
                type: type,
                category: category,
                pdfData: event.target.result, // The file itself
                addedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            };

            // Save to Local Array and Storage
            books.unshift(newBook);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(books));

            // UI Feedback
            refreshUI();
            closeModal();
            alert("Book added successfully to Local Storage!");

        } catch (err) {
            console.error(err);
            alert("Storage limit reached! LocalStorage only supports ~5MB total. Try a smaller PDF.");
        } finally {
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
        }
    };
    reader.readAsDataURL(pdfFile);
}

function deleteBook(id) {
    if (confirm("Are you sure you want to remove this resource from the catalog?")) {
        books = books.filter(book => book.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
        refreshUI();
    }
}

/*************************
 * UI RENDERING
 *************************/
function refreshUI() {
    updateStats();
    renderRecentAdded();
    renderInventory();
    updateStorageHealth(); // <--- Add this here!
}

function updateStats() {
    document.getElementById("stat-total").innerText = books.length;
    document.getElementById("stat-ebooks").innerText = books.filter(b => b.type === 'Ebook').length;
    document.getElementById("stat-audiobooks").innerText = books.filter(b => b.type === 'Audiobook').length;
    document.getElementById("stat-normal").innerText = books.filter(b => b.type === 'Normal').length;
}

function renderRecentAdded() {
    const recent = books.slice(0, 4);
    const container = document.getElementById("recent-list");
    
    if (recent.length === 0) {
        container.innerHTML = `<p class="p-6 text-center text-slate-400 text-sm">No items added yet</p>`;
        return;
    }

    container.innerHTML = recent.map(book => `
        <div class="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/></svg>
                </div>
                <div>
                    <p class="font-bold text-slate-800 text-sm">${book.name}</p>
                    <p class="text-xs text-slate-500">${book.category}</p>
                </div>
            </div>
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">${book.addedDate}</span>
        </div>
    `).join("");
}

function renderInventory() {
    const searchTerm = document.getElementById("search-input").value.toLowerCase();
    const tbody = document.getElementById("inventory-table-body");
    
    const filtered = books.filter(b => 
        b.name.toLowerCase().includes(searchTerm) || 
        b.author.toLowerCase().includes(searchTerm)
    );

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-20 text-slate-400">No books found in your local inventory.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(book => `
        <tr class="group hover:bg-slate-50/50 transition-colors">
            <td class="px-6 py-4">
                <div class="flex flex-col">
                    <span class="font-bold text-slate-800">${book.name}</span>
                    <span class="text-xs text-slate-400">${book.author}</span>
                </div>
            </td>
            <td class="px-6 py-4 text-sm font-medium text-slate-600">${book.type}</td>
            <td class="px-6 py-4">
                <span class="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">${book.category}</span>
            </td>
            <td class="px-6 py-4 text-sm text-slate-500">${book.addedDate}</td>
            <td class="px-6 py-4 text-right">
                <button onclick="deleteBook('${book.id}')" class="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                </button>
            </td>
        </tr>
    `).join("");
}
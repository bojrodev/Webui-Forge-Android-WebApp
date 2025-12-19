/**
 * LORA MANAGER SYSTEM (FINAL v3)
 * - Thumbnails: Uses '/file=' endpoint to find images by path (png/jpg/preview.png)
 * - UI: Fixed White Plus Button -> Muted/Accent
 * - Chips: Only 'All' by default. Favorites appear after hearting in Manager.
 * - Scroll: Batch size 15.
 * - Auto-Sort: Active items bubble to top.
 */

window.LoraManager = {
    // Data Sources
    allLoras: [],
    folders: {},
    currentFolder: 'All',
    favorites: [],
    
    // Virtualization
    filteredList: [],
    displayedCount: 0,
    BATCH_SIZE: 15, // Low batch size for stability
    observer: null,
    
    // Cache System
    fs: window.Capacitor ? window.Capacitor.Plugins.Filesystem : null,
    CACHE_DIR: 'CACHES', 
    metaCache: {}, // Stores { "loraName": "lastModifiedString" }

    init: async function() {
        this.loadFavorites();
        await this.loadMetaCache();
        this.setupObserver();
        console.log("LoraManager: Ready");
    },

    loadFavorites: function() {
        try {
            const saved = localStorage.getItem('bojroFolderFavs');
            if (saved) this.favorites = JSON.parse(saved);
        } catch(e) {}
    },

    saveFavorites: function() {
        localStorage.setItem('bojroFolderFavs', JSON.stringify(this.favorites));
        this.renderChips(); // Refresh chips immediately on save
    },

    // --- META CACHE ---
    loadMetaCache: async function() {
        if(!this.fs) return;
        try {
            const ret = await this.fs.readFile({
                path: `${this.CACHE_DIR}/meta_cache.json`,
                directory: 'CACHE',
                encoding: 'utf8'
            });
            this.metaCache = JSON.parse(ret.data);
        } catch (e) {
            this.metaCache = {};
        }
    },

    saveMetaCache: async function() {
        if(!this.fs) return;
        try {
            await this.fs.writeFile({
                path: `${this.CACHE_DIR}/meta_cache.json`,
                data: JSON.stringify(this.metaCache),
                directory: 'CACHE',
                encoding: 'utf8'
            });
        } catch(e) {}
    },

    // --- MAIN OPEN LOGIC ---
    open: async function(targetMode) {
        this.targetMode = targetMode; // 'xl', 'flux', 'qwen'
        
        const hostEl = document.getElementById('hostIp');
        if (!hostEl || !hostEl.value) return alert("Link server first!");

        const modal = document.getElementById('loraModal');
        modal.classList.remove('hidden');
        
        // Reset View
        document.getElementById('loraVerticalList').innerHTML = '<div class="spinner" style="display:block"></div>';

        try {
            const res = await fetch(`${hostEl.value}/sdapi/v1/loras`);
            if (!res.ok) throw new Error("Fetch failed");
            
            const data = await res.json();
            
            // Sort: Active first, then Name
            this.allLoras = this.sortLoras(data);
            
            this.processFolders();
            this.renderChips();
            this.filterAndRender('All');

        } catch (e) {
            document.getElementById('loraVerticalList').innerHTML = `<div style="text-align:center;padding:20px;color:red">Error: ${e.message}</div>`;
        }
    },

    // --- SORTING (Active -> Top) ---
    sortLoras: function(data) {
        const activePrompt = this.getActivePrompt();
        
        return data.sort((a, b) => {
            const aActive = activePrompt.includes(`<lora:${a.alias}:`);
            const bActive = activePrompt.includes(`<lora:${b.alias}:`);
            
            if (aActive && !bActive) return -1; 
            if (!aActive && bActive) return 1;  
            return a.name.localeCompare(b.name);
        });
    },

    getActivePrompt: function() {
        const id = `${this.targetMode}_prompt`;
        const el = document.getElementById(id);
        return el ? el.value : "";
    },

    // --- FOLDER PARSING ---
    processFolders: function() {
        this.folders = { 'All': [] };
        
        this.allLoras.forEach(lora => {
            const path = lora.path.replace(/\\/g, '/');
            const parts = path.split('/');
            
            // Extract folder logic
            let folderName = 'Root';
            const idx = parts.findIndex(p => p.toLowerCase() === 'lora');
            
            if (idx !== -1 && idx < parts.length - 2) {
                folderName = parts.slice(idx + 1, parts.length - 1).join(' > ');
            }

            if (!this.folders[folderName]) this.folders[folderName] = [];
            this.folders[folderName].push(lora);
            this.folders['All'].push(lora);
        });
    },

    // --- RENDER CHIPS (Only All + Favorites) ---
    renderChips: function() {
        const container = document.getElementById('loraFolderChips');
        container.innerHTML = '';
        
        // Helper
        const addChip = (name, isFav=false) => {
            const chip = document.createElement('div');
            chip.className = 'folder-chip';
            if(name === this.currentFolder) chip.classList.add('active');
            if(isFav) chip.style.borderColor = 'var(--accent-secondary)';
            
            chip.innerHTML = `
                ${isFav ? '<i data-lucide="heart" size="10" fill="currentColor"></i>' : ''}
                <span>${name}</span>
                <span style="font-size:9px;opacity:0.6">${this.folders[name] ? this.folders[name].length : 0}</span>
            `;
            chip.onclick = () => {
                document.querySelectorAll('.folder-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.filterAndRender(name);
            };
            container.appendChild(chip);
        };

        // Always show All
        addChip('All');
        
        // Only show Favorites
        this.favorites.forEach(fav => { 
            if(this.folders[fav]) addChip(fav, true); 
        });
        
        if(window.lucide) lucide.createIcons();
    },

    // --- FILTER & VIRTUAL RENDER ---
    filterAndRender: function(folderName) {
        this.currentFolder = folderName;
        this.displayedCount = 0;
        
        const qEl = document.getElementById('loraSearch');
        const query = qEl ? qEl.value.toLowerCase() : "";
        
        // Get base list
        let list = this.folders[folderName] || [];
        
        // Apply search
        if(query) list = list.filter(l => l.name.toLowerCase().includes(query));
        
        // Re-sort
        this.filteredList = this.sortLoras(list);
        
        const container = document.getElementById('loraVerticalList');
        container.innerHTML = ''; 
        
        // Trigger Element for Scroll
        const trigger = document.createElement('div');
        trigger.id = 'lora-scroll-trigger';
        trigger.style.height = '20px';
        container.appendChild(trigger);
        
        this.renderMore(); // First batch
        
        if(this.observer) this.observer.observe(trigger);
    },

    renderMore: function() {
        const container = document.getElementById('loraVerticalList');
        const trigger = document.getElementById('lora-scroll-trigger');
        
        const batch = this.filteredList.slice(this.displayedCount, this.displayedCount + this.BATCH_SIZE);
        if(batch.length === 0) return;

        const activePrompt = this.getActivePrompt();

        batch.forEach(lora => {
            const isActive = activePrompt.includes(`<lora:${lora.alias}:`);
            const row = document.createElement('div');
            row.className = `lora-item-row ${isActive ? 'active' : ''}`;
            
            const cleanName = lora.name.replace(/_/g, ' ');
            const isXl = lora.name.toLowerCase().includes('xl') || (lora.metadata?.sd_version === 'SDXL');
            
            // FIX: Plus button is now styled properly (not white)
            // Added explicit colors to icons
            row.innerHTML = `
                <img src="icon.png" class="lora-item-thumb" id="thumb-${this.simpleHash(lora.name)}">
                <div class="lora-item-info">
                    <div class="lora-item-name">${cleanName}</div>
                    <div class="lora-item-meta">${isActive ? 'ACTIVE' : ''}</div>
                </div>
                <button class="lora-btn-action" style="color:var(--text-muted)" onclick="event.stopPropagation(); window.openLoraSettings(event, '${lora.name}', '${lora.path.replace(/\\/g, '/')}')">
                    <i data-lucide="settings-2" size="16"></i>
                </button>
                <button class="lora-btn-toggle" style="background:transparent; border:none; color:${isActive ? 'var(--error)' : 'var(--text-muted)'}" onclick="event.stopPropagation(); window.LoraManager.toggle('${lora.alias}', '${lora.name}')">
                    <i data-lucide="${isActive ? 'minus-circle' : 'plus-circle'}" size="24"></i>
                </button>
            `;
            
            container.insertBefore(row, trigger);
            
            // Trigger Smart Load - DEFERRED to unblock UI
            const imgEl = row.querySelector('.lora-item-thumb');
            setTimeout(() => {
                this.smartLoadThumbnail(imgEl, lora);
            }, 50);
        });

        this.displayedCount += batch.length;
        if(window.lucide) lucide.createIcons();
    },

    setupObserver: function() {
        const root = document.getElementById('loraVerticalList');
        const opts = { root: root, rootMargin: '100px', threshold: 0.1 };
        
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if(e.isIntersecting) this.renderMore();
            });
        }, opts);
    },

    // --- TOGGLE LOGIC ---
    toggle: function(alias, name) {
        const promptId = `${this.targetMode}_prompt`;
        const promptEl = document.getElementById(promptId);
        if(!promptEl) return;

        let val = promptEl.value;
        const regex = new RegExp(`<lora:${this.escapeRegExp(alias)}:[^>]+>(?:\\s*\\S+)*`, 'gi');
        
        if (regex.test(val)) {
            // REMOVE
            val = val.replace(regex, '');
            if(window.Capacitor) window.Capacitor.Plugins.Toast.show({text: `Removed ${alias}`});
        } else {
            // ADD
            if (window.Neo && window.Neo.appInjectConfig) {
                window.Neo.appInjectConfig(alias, name, promptEl);
                // Refresh to bubble to top
                setTimeout(() => { this.filterAndRender(this.currentFolder); }, 50);
                return; 
            }
        }
        
        promptEl.value = val.replace(/\s\s+/g, ' ').trim(); 
        this.filterAndRender(this.currentFolder); 
    },

    escapeRegExp: function(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },

    // =========================================================
    // SMART THUMBNAIL ENGINE (FILE PATH GUESSING)
    // =========================================================
    
    smartLoadThumbnail: async function(imgEl, lora) {
        const host = document.getElementById('hostIp').value;
        
        // 1. Determine "Guess" URLs based on real path
        // lora.path is absolute (e.g. C:\sd\models\Lora\foo.safetensors)
        // We want: C:\sd\models\Lora\foo.png (served via /file=)
        
        let pathNoExt = lora.path;
        if(pathNoExt.lastIndexOf('.') > -1) {
            pathNoExt = pathNoExt.substring(0, pathNoExt.lastIndexOf('.'));
        }
        
        // Possible extensions to try
        const candidates = ['.png', '.jpg', '.preview.png', '.jpeg', '.webp'];
        
        // 2. Determine Local Cache Path
        const safeName = lora.name.replace(/[^a-zA-Z0-9.\-_]/g, '_') + '.jpg'; // Normalize to jpg for cache
        const localPath = `${this.CACHE_DIR}/${safeName}`;

        // 3. Helper to Check Server HEAD
        const checkServer = async (ext) => {
            const url = `${host}/file=${pathNoExt}${ext}`;
            try {
                const res = await fetch(url, { method: 'HEAD' });
                if (res.ok) {
                    return { 
                        url: url, 
                        date: res.headers.get('Last-Modified') || res.headers.get('Content-Length') 
                    };
                }
            } catch(e) {}
            return null;
        };

        // 4. Find valid server image
        let validServerImg = null;
        // Try provided thumbnail first if API gives it
        if(lora.thumbnail) {
             // API provided explicit path?
        }
        
        // Loop candidates
        for (let ext of candidates) {
            validServerImg = await checkServer(ext);
            if (validServerImg) break;
        }

        if (!validServerImg) return; // No image found on server

        // 5. Check Cache Validity
        let useCache = false;
        if (this.fs) {
            const cachedDate = this.metaCache[lora.name];
            if (cachedDate === validServerImg.date) {
                try {
                    const file = await this.fs.readFile({ path: localPath, directory: 'CACHE' });
                    imgEl.src = `data:image/jpeg;base64,${file.data}`;
                    useCache = true;
                } catch(e) {}
            }
        } else {
            // Browser Fallback (just load url)
            imgEl.src = validServerImg.url;
            return;
        }

        // 6. Download if needed
        if (!useCache && this.fs) {
            this.downloadAndSave(validServerImg.url, localPath, imgEl, lora.name, validServerImg.date);
        }
    },

    downloadAndSave: async function(url, path, imgEl, loraName, serverDate) {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = url;
        img.onload = async () => {
            // Compress to small thumbnail
            const cvs = document.createElement('canvas');
            const scale = 140 / img.width;
            cvs.width = 140;
            cvs.height = img.height * scale;
            const ctx = cvs.getContext('2d');
            ctx.drawImage(img, 0, 0, cvs.width, cvs.height);
            
            const b64 = cvs.toDataURL('image/jpeg', 0.8).split(',')[1];
            
            // Display
            imgEl.src = `data:image/jpeg;base64,${b64}`;
            
            // Save
            try {
                try { await this.fs.mkdir({ path: this.CACHE_DIR, directory: 'CACHE' }); } catch(e){}
                
                await this.fs.writeFile({
                    path: path,
                    data: b64,
                    directory: 'CACHE'
                });
                
                // Update Meta
                this.metaCache[loraName] = serverDate;
                this.saveMetaCache();
                
            } catch(e) {
                console.warn("Cache write failed", e);
            }
        };
    },

    simpleHash: function(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return "h" + Math.abs(hash);
    }
};

// --- GLOBAL EXPORTS ---
window.filterLoras = () => window.LoraManager.filterAndRender(window.LoraManager.currentFolder);
window.openLoraModal = (m) => window.LoraManager.open(m);
window.closeLoraModal = () => document.getElementById('loraModal').classList.add('hidden');

// --- FOLDER MANAGER (GEAR ICON) ---
window.openFolderManager = function() {
    const modal = document.getElementById('folderManagerModal');
    modal.classList.remove('hidden');
    const list = document.getElementById('folderManagerList');
    list.innerHTML = '';
    
    const mgr = window.LoraManager;
    const folders = Object.keys(mgr.folders).sort();
    
    folders.forEach(f => {
        if (f === 'All') return;
        
        const isFav = mgr.favorites.includes(f);
        const div = document.createElement('div');
        div.className = 'folder-item-row';
        div.innerHTML = `
            <div class="folder-item-name">
                <i data-lucide="${isFav ? 'heart' : 'folder'}" size="14" style="color:${isFav ? 'var(--error)' : 'var(--text-muted)'}"></i>
                ${f}
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <span class="folder-item-count">${mgr.folders[f].length}</span>
                <button class="folder-heart-btn ${isFav ? 'active' : ''}" onclick="window.toggleFolderFav('${f}', this)">
                    <i data-lucide="heart" size="18"></i>
                </button>
            </div>
        `;
        list.appendChild(div);
    });
    if (window.lucide) window.lucide.createIcons();
};

window.closeFolderManager = function() {
    document.getElementById('folderManagerModal').classList.add('hidden');
    window.LoraManager.renderChips(); // Refresh chips
};

window.toggleFolderFav = function(folder, btn) {
    const mgr = window.LoraManager;
    if (mgr.favorites.includes(folder)) {
        mgr.favorites = mgr.favorites.filter(x => x !== folder);
        btn.classList.remove('active');
        btn.querySelector('svg').style.fill = 'none';
        btn.querySelector('svg').style.color = 'var(--text-muted)';
    } else {
        mgr.favorites.push(folder);
        btn.classList.add('active');
        btn.querySelector('svg').style.fill = 'currentColor';
        btn.querySelector('svg').style.color = 'var(--error)';
    }
    mgr.saveFavorites();
};

window.addEventListener('load', () => window.LoraManager.init());
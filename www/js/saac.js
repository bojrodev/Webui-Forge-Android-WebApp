/**
 * BOJRO SAA CLIENT (Character Select)
 * Version: Search Fix + Priority Sorting (Active on Top)
 */
window.SaacManager = {
    data: [], 
    imgDb: null, 
    displayedCount: 0,
    BATCH_SIZE: 30,
    observer: null,
    isLoaded: false,

    injectStyles: function() {
        if(document.getElementById('saac-styles')) return;
        const style = document.createElement('style');
        style.id = 'saac-styles';
        style.innerHTML = `
            #saacGrid { display: flex !important; flex-direction: column !important; gap: 10px !important; padding: 10px 0 50px 0 !important; width: 100% !important; box-sizing: border-box !important; }
            .saac-item-row { 
                display: flex !important; align-items: center !important; justify-content: space-between !important; 
                width: 100% !important; min-height: 60px !important; background: var(--bg-panel, #2a2a2a);
                border: 1px solid var(--border-color, #3a3a3a); border-radius: 10px; padding: 8px 16px;
                cursor: pointer; transition: transform 0.1s ease, background 0.2s ease; box-sizing: border-box !important;
            }
            @keyframes saac-glow { 0% { box-shadow: 0 0 0 rgba(255, 215, 0, 0); } 50% { box-shadow: 0 0 12px rgba(255, 215, 0, 0.5); } 100% { box-shadow: 0 0 0 rgba(255, 215, 0, 0); } }
            .saac-click-anim { animation: saac-glow 0.4s ease-out; transform: scale(0.97); }
            .saac-active { background: rgba(255, 215, 0, 0.1) !important; border-color: #ffd700 !important; }
            .saac-info-box { flex: 1; overflow: hidden; display: flex; flex-direction: column; gap: 2px; }
            .saac-name { font-size: 14px; font-weight: 600; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .saac-tag { font-size: 11px; color: #aaa; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .saac-img-btn { width: 36px; height: 36px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid #444; color: #ffd700; display: flex; align-items: center; justify-content: center; cursor: pointer; }
            #saac-img-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 100000; display: flex; flex-direction: column; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity 0.3s; backdrop-filter: blur(8px); }
            #saac-img-modal.active { opacity: 1; pointer-events: auto; }
            #saac-img-content { max-width: 90%; max-height: 80%; border-radius: 12px; object-fit: contain; }
        `;
        document.head.appendChild(style);

        if (!document.getElementById('saac-img-modal')) {
            const m = document.createElement('div');
            m.id = 'saac-img-modal';
            m.innerHTML = `<button onclick="window.SaacManager.closeImage()" style="position:absolute; top:30px; right:30px; background:none; border:none; color:white; font-size:32px; cursor:pointer;">&times;</button><img id="saac-img-content" src="" /><div id="saac-img-title" style="color:white; margin-top:20px; font-size:20px; font-weight:bold;"></div>`;
            m.onclick = (e) => { if(e.target === m) this.closeImage(); };
            document.body.appendChild(m);
        }
    },

    init: async function() {
        if(this.isLoaded) return;
        this.injectStyles();
        try {
            const response = await fetch('assets/saac_data/wai_characters.csv');
            const csvText = await response.text();
            this.data = csvText.split('\n').filter(l=>l.trim().length>0).map(l=>{
                const p = l.split(','); if(p.length<2) return null;
                const tag = p[1].trim();
                const name = tag.split(' ').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
                return { name, tag };
            }).filter(x=>x);
            
            // Re-bind search input to ensure it works
            const searchInput = document.getElementById('saacSearch');
            if(searchInput) {
                searchInput.addEventListener('input', () => this.render());
            }

            this.isLoaded = true;
            this.loadImages();
        } catch(e) { console.error("Init failed", e); }
    },

    loadImages: async function() {
        try {
            const res = await fetch('assets/saac_data/exact_db.json');
            if(res.ok) this.imgDb = await res.json();
        } catch(e) { console.error("Img Load Failed", e); }
    },

    open: async function() {
        if(!this.isLoaded) await this.init();
        const m = document.getElementById('saacModal');
        if(m) { m.classList.remove('hidden'); this.render(); }
    },

    close: function() { document.getElementById('saacModal')?.classList.add('hidden'); },

    // --- 3. RENDERING WITH PRIORITY SORTING ---
    render: function() {
        const grid = document.getElementById('saacGrid');
        if(!grid) return;
        
        const q = document.getElementById('saacSearch')?.value.toLowerCase() || '';
        const prompt = document.getElementById('xl_prompt')?.value || '';

        // 1. Filter by Search Query 
        let filtered = q ? this.data.filter(c => c.name.toLowerCase().includes(q) || c.tag.toLowerCase().includes(q)) : [...this.data];

        // 2. Sort: Selected/Active characters come first 
        filtered.sort((a, b) => {
            const aActive = prompt.includes(a.tag);
            const bActive = prompt.includes(b.tag);
            if (aActive && !bActive) return -1;
            if (!aActive && bActive) return 1;
            return 0;
        });

        this.filteredData = filtered;
        grid.innerHTML = "";
        this.displayedCount = 0;
        this.renderMore();

        // Infinite Scroll
        if(this.observer) this.observer.disconnect();
        const trigger = document.createElement('div');
        trigger.id = 'saac-trigger';
        grid.appendChild(trigger);
        this.observer = new IntersectionObserver(e => { if(e[0].isIntersecting) this.renderMore(); }, {root:grid});
        this.observer.observe(trigger);
    },

    renderMore: function() {
        const grid = document.getElementById('saacGrid');
        const trigger = document.getElementById('saac-trigger');
        const batch = this.filteredData.slice(this.displayedCount, this.displayedCount + this.BATCH_SIZE);
        const prompt = document.getElementById('xl_prompt')?.value || '';
        const frag = document.createDocumentFragment();

        batch.forEach(c => {
            const active = prompt.includes(c.tag);
            const row = document.createElement('div');
            row.className = `saac-item-row ${active ? 'saac-active' : ''}`;
            row.dataset.tag = c.tag;

            row.onclick = (e) => {
                if(e.target.closest('button')) return;
                this.animateClick(row);
                this.toggle(c);
            };

            row.innerHTML = `
                <div class="saac-info-box">
                    <div class="saac-name">${c.name}</div>
                    <div class="saac-tag">${c.tag}</div>
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                    <button class="saac-img-btn" onclick="window.SaacManager.showImage('${c.tag.replace(/'/g, "\\'")}', '${c.name.replace(/'/g, "\\'")}')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                    </button>
                    <div class="saac-icon" style="color:${active?'#ffd700':'#666'}">
                        ${active ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>' : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>'}
                    </div>
                </div>`;
            frag.appendChild(row);
        });

        grid.insertBefore(frag, trigger);
        this.displayedCount += batch.length;
    },

    toggle: function(c) {
        const el = document.getElementById('xl_prompt');
        if(!el) return;
        let v = el.value;
        if(v.includes(c.tag)) {
            v = v.replace(new RegExp(`(${c.tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*,?\\s*)`,'gi'), '');
        } else {
            v = v ? `${c.tag}, ${v}` : c.tag;
        }
        el.value = v.replace(/^[\s,]+|[\s,]+$/g, '').replace(/,\s*,/g, ',');
        
        // Re-render immediately to move the toggled item to the top 
        this.render(); 
    },

    animateClick: function(el) {
        el.classList.add('saac-click-anim');
        setTimeout(() => el.classList.remove('saac-click-anim'), 400);
    },

    showImage: function(key, name) {
        const modal = document.getElementById('saac-img-modal');
        const img = document.getElementById('saac-img-content');
        const title = document.getElementById('saac-img-title');
        if(this.imgDb && this.imgDb[key]) {
            img.src = this.imgDb[key];
            title.textContent = name;
            modal.classList.add('active');
        }
    },

    closeImage: function() { document.getElementById('saac-img-modal').classList.remove('active'); }
};
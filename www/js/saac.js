/**
 * BOJRO SAA CLIENT (Character Select)
 * Version: 3x3 Grid, Full Image Contain, Fixed Zoom, Neon Glow
 */
window.SaacManager = {
    data: [], 
    imgDb: null, 
    displayedCount: 0,
    BATCH_SIZE: 30,
    observer: null,
    isLoaded: false,
    filteredData: [],

    init: async function() {
        if(this.isLoaded) return;
        try {
            const response = await fetch('assets/saac_data/wai_characters.csv');
            const csvText = await response.text();
            this.data = csvText.split('\n').filter(l=>l.trim().length>0).map(l=>{
                const p = l.split(','); if(p.length<2) return null;
                const tag = p[1].trim();
                const name = tag.split(' ').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
                return { name, tag };
            }).filter(x=>x);
            
            // Link search input
            document.getElementById('saacSearch')?.addEventListener('input', () => this.render());
            
            this.isLoaded = true;
            await this.loadImages();
        } catch(e) { console.error("SAAC Init failed", e); }
    },

    loadImages: async function() {
        try {
            const res = await fetch('assets/saac_data/exact_db.json');
            if(res.ok) this.imgDb = await res.json();
        } catch(e) { console.error("SAAC Img Load Failed", e); }
    },

    open: async function() {
        if(!this.isLoaded) await this.init();
        document.getElementById('saacModal')?.classList.remove('hidden');
        this.render();
    },

    close: function() { document.getElementById('saacModal')?.classList.add('hidden'); },

    render: function() {
        const grid = document.getElementById('saacGrid');
        if(!grid) return;
        const q = document.getElementById('saacSearch')?.value.toLowerCase() || '';
        const prompt = document.getElementById('xl_prompt')?.value || '';
    
        // FILTER ONLY: Removed the .sort() block that moved active items to the top
        let filtered = q ? this.data.filter(c => 
            c.name.toLowerCase().includes(q) || c.tag.toLowerCase().includes(q)
        ) : [...this.data];
    
        this.filteredData = filtered;
        grid.innerHTML = "";
        this.displayedCount = 0;
    
        const trigger = document.createElement('div');
        trigger.id = 'saac-trigger';
        trigger.style.gridColumn = '1 / span 3';
        grid.appendChild(trigger);
    
        this.renderMore();
    
        if(this.observer) this.observer.disconnect();
        this.observer = new IntersectionObserver(e => {
            if(e[0].isIntersecting && this.displayedCount < this.filteredData.length) this.renderMore();
        }, { root: grid });
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
            const imgSrc = this.imgDb?.[c.tag];
            const card = document.createElement('div');
            card.className = `saac-card ${active ? 'saac-active' : ''}`;
            
            card.innerHTML = `
                <div class="saac-card-thumb">
                    ${imgSrc ? `<img src="${imgSrc}" loading="lazy">` : `<div class="saac-no-img">${c.name.charAt(0)}</div>`}
                    <div class="saac-card-zoom" onclick="event.stopPropagation(); window.SaacManager.showImage('${c.tag.replace(/'/g, "\\'")}', '${c.name.replace(/'/g, "\\'")}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                    </div>
                </div>
                <div class="saac-card-info">
                    <div class="saac-card-name">${c.name}</div>
                </div>`;
            
            card.onclick = () => this.toggle(c);
            frag.appendChild(card);
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
        this.render(); 
    },

    showImage: function(key, name) {
        const modal = document.getElementById('saac-img-modal');
        const img = document.getElementById('saac-img-content');
        const title = document.getElementById('saac-img-title');
        
        if(!modal || !img) {
            console.error("Zoom Modal Elements Missing in HTML");
            return;
        }

        if(this.imgDb?.[key]) {
            img.src = this.imgDb[key];
            if(title) title.textContent = name;
            modal.classList.add('active');
        }
    },

    closeImage: function() { 
        document.getElementById('saac-img-modal')?.classList.remove('active'); 
    }
};
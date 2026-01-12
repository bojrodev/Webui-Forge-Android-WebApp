/**
 * BOJRO SAA CLIENT (Character Select)
 * Version: The "It Just Works" Edition (Native Overlay)
 */
window.SaacManager = {
    data: [], 
    tagAssist: {}, 
    
    displayedCount: 0,
    BATCH_SIZE: 20,
    observer: null,
    isLoaded: false,

    // --- 1. STYLES ---
    injectStyles: function() {
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes saac-glow { 0% { box-shadow: 0 0 0 rgba(var(--accent-primary-rgb), 0); } 50% { box-shadow: 0 0 15px rgba(var(--accent-primary-rgb), 0.4); border-color: var(--accent-primary); } 100% { box-shadow: 0 0 0 rgba(var(--accent-primary-rgb), 0); } }
            .saac-click-anim { animation: saac-glow 0.4s ease-out; }
            .saac-btn-press { transform: scale(0.92); transition: transform 0.1s; }
            #saacGrid { display: flex !important; flex-direction: column !important; grid-template-columns: none !important; gap: 8px !important; padding-bottom: 20px; width: 100% !important; }
            .saac-item-row { width: 100% !important; box-sizing: border-box !important; margin: 0 !important; }
        `;
        document.head.appendChild(style);
    },

    // --- 2. INIT ---
    init: async function() {
        if(this.isLoaded) return;
        this.injectStyles();
        try {
            console.log("SAAC: Loading databases...");
            const [csvReq, assistReq] = await Promise.all([
                fetch('assets/saac_data/wai_characters.csv'),
                fetch('assets/saac_data/wai_tag_assist.json')
            ]);
            const csvText = await csvReq.text();
            this.tagAssist = await assistReq.json();
            this.data = csvText.split('\n').filter(l=>l.trim().length>0).map(l=>{
                const i=l.indexOf(','); if(i===-1)return null;
                const k=l.substring(0,i).trim(), t=l.substring(i+1).trim();
                const n=t.split(' ').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
                return {name:n, tag:t, key:k};
            }).filter(x=>x);
            
            const closeBtn=document.querySelector('#saacModal .modal-header button');
            if(closeBtn) Object.assign(closeBtn.style,{background:'var(--btn-bg)',border:'1px solid var(--border-color)',borderRadius:'50%',width:'32px',height:'32px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',color:'var(--text-main)',cursor:'pointer'});
            
            this.isLoaded = true;
            this.setupObserver();
        } catch(e) { console.error(e); }
    },

    open: async function() { if(!this.isLoaded) await this.init(); document.getElementById('saacModal').classList.remove('hidden'); this.filterAndRender(); },
    close: function() { document.getElementById('saacModal').classList.add('hidden'); },

    // --- 3. RENDER ---
    filterAndRender: function() {
        const q=document.getElementById('saacSearch').value.toLowerCase();
        this.filteredData=q?this.data.filter(c=>c.name.toLowerCase().includes(q)||c.tag.toLowerCase().includes(q)):this.data;
        this.displayedCount=0;
        const g=document.getElementById('saacGrid'); g.innerHTML=''; g.style.display='flex'; g.style.flexDirection='column';
        const t=document.createElement('div'); t.id='saac-scroll-trigger'; t.style.height='10px'; t.style.flexShrink='0'; g.appendChild(t);
        this.renderMore();
        if(this.observer) this.observer.observe(t);
    },

    renderMore: function() {
        const g=document.getElementById('saacGrid'), t=document.getElementById('saac-scroll-trigger');
        if(this.displayedCount>=this.filteredData.length)return;
        const b=this.filteredData.slice(this.displayedCount,this.displayedCount+this.BATCH_SIZE);
        if(b.length===0)return;
        const p=document.getElementById('xl_prompt')?document.getElementById('xl_prompt').value:'';
        const f=document.createDocumentFragment();
        
        b.forEach(c=>{
            const a=p.includes(c.tag), r=document.createElement('div');
            r.className='saac-item-row'; r.dataset.tag=c.tag;
            r.onclick=()=>{this.animateClick(r);this.toggle(c);};
            Object.assign(r.style,{background:a?'rgba(var(--accent-primary-rgb), 0.1)':'var(--bg-panel)',border:a?'1px solid var(--accent-primary)':'1px solid var(--border-color)',borderRadius:'8px',padding:'12px 15px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',transition:'all 0.2s',minHeight:'50px',width:'100%',boxSizing:'border-box'});
            r.innerHTML=`
                <div style="display:flex; flex-direction:column; gap:2px; overflow:hidden; flex:1;">
                    <div style="font-size:13px; font-weight:600; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.name}</div>
                    <div style="font-size:10px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.tag}</div>
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                     <button onclick="event.stopPropagation(); window.SaacManager.animatePress(this); window.SaacManager.viewInfo('${c.name.replace(/'/g, "\\'")}')" class="saac-btn-press" style="width:32px; height:32px; border-radius:6px; background:transparent; border:1px solid var(--border-color); color:var(--accent-primary); display:flex; align-items:center; justify-content:center; cursor:pointer;"><i data-lucide="info" style="width:16px; height:16px;"></i></button>
                     <div class="saac-icon-wrapper" style="width:20px; height:20px; display:flex; align-items:center; justify-content:center;"><i data-lucide="${a?'check-circle':'plus-circle'}" style="width:20px; height:20px; color:${a?'var(--accent-primary)':'var(--text-muted)'}"></i></div>
                </div>`;
            f.appendChild(r);
        });
        g.insertBefore(f,t); this.displayedCount+=b.length;
        if(window.lucide&&window.lucide.createIcons)window.lucide.createIcons();
    },

    setupObserver: function() { this.observer=new IntersectionObserver((e)=>{e.forEach(x=>{if(x.isIntersecting)this.renderMore();})},{root:document.getElementById('saacGrid'),threshold:0.1}); },
    toggle: function(c) {
        const el=document.getElementById('xl_prompt'); if(!el)return;
        let v=el.value, t=c.tag;
        if(v.includes(t)) { v=v.replace(new RegExp(`(${this.escapeRegExp(t)}\\s*,?\\s*)`,'gi'),''); if(window.Toast)window.Toast.show({text:`Removed: ${c.name}`,duration:'short'}); }
        else { let ft=t,k=t.toLowerCase(); if(this.tagAssist[k])ft=`${t}, ${this.tagAssist[k]}`; v=`${ft}, ${v}`; if(window.Toast)window.Toast.show({text:`Added: ${c.name}`,duration:'short'}); }
        el.value=v.replace(/^[\s,]+|[\s,]+$/g,'').replace(/,\s*,/g,','); if(window.savePrompt)window.savePrompt('xl'); this.updateUI();
    },
    updateUI: function() {
        const p=document.getElementById('xl_prompt')?document.getElementById('xl_prompt').value:'';
        document.querySelectorAll('.saac-item-row').forEach(r=>{
            const a=p.includes(r.dataset.tag), i=r.querySelector('.saac-icon-wrapper');
            if(a){r.style.background='rgba(var(--accent-primary-rgb), 0.1)';r.style.borderColor='var(--accent-primary)';}
            else{r.style.background='var(--bg-panel)';r.style.borderColor='var(--border-color)';}
            if(i)i.innerHTML=a?`<i data-lucide="check-circle" style="width:20px; height:20px; color:var(--accent-primary)"></i>`:`<i data-lucide="plus-circle" style="width:20px; height:20px; color:var(--text-muted)"></i>`;
        });
        setTimeout(()=>{if(window.lucide&&window.lucide.createIcons)window.lucide.createIcons();},10);
    },
    escapeRegExp: function(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); },
    animateClick: function(e) { e.classList.remove('saac-click-anim'); void e.offsetWidth; e.classList.add('saac-click-anim'); },
    animatePress: function(b) { b.style.transform="scale(0.85)"; setTimeout(()=>b.style.transform="scale(1)",150); },

    // --- 4. THE ONLY WORKING SOLUTION FOR GOOGLE ---
    viewInfo: async function(name) {
        const googleUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(name + " anime character")}`;
        
        // Use the Capacitor Browser Plugin (This creates a native overlay, NOT an iframe)
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
            await window.Capacitor.Plugins.Browser.open({
                url: googleUrl,
                toolbarColor: '#FFD700', // YOUR YELLOW COLOR
                presentationStyle: 'popover' // iOS style
            });
        } 
        // Fallback: Safebooru Iframe (Only if Capacitor isn't available)
        else {
            const safeTag = name.trim().replace(/\s+/g, '_');
            const safeUrl = `https://safebooru.org/index.php?page=post&s=list&tags=${safeTag}`;
            this.openIframe(safeUrl);
        }
    },

    openIframe: function(url) {
        const div = document.createElement('div');
        div.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:white;z-index:20000;display:flex;flex-direction:column;animation:saac-glow 0.3s;`;
        
        // Yellow Bar
        div.innerHTML = `
            <div style="height:50px;background:#FFD700;display:flex;align-items:center;padding-left:10px;padding-top:env(safe-area-inset-top,0);">
                <button id="close-iframe" style="background:none;border:none;font-size:24px;color:white;font-weight:bold;">✕</button>
            </div>
            <iframe src="${url}" style="flex:1;border:none;" sandbox="allow-forms allow-scripts allow-same-origin allow-popups"></iframe>
        `;
        document.body.appendChild(div);
        div.querySelector('#close-iframe').onclick = () => div.remove();
    }
};
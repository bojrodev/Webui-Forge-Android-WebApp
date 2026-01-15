window.StyleManager = {
    styles: [],
    selectedStyles: new Set(), // Track which styles are active
    fs: window.Capacitor ? window.Capacitor.Plugins.Filesystem : null,
    DIR: 'Resolver/styles',
    FILE: 'Resolver/styles/styles.csv',
    editingOldName: null,

    init: async function() {
        if (this.fs) {
            try { await this.fs.mkdir({ path: this.DIR, directory: 'DOCUMENTS', recursive: true }); } catch(e) {}
        }
        await this.loadLocalCSV();
    },

    open: function() {
        document.getElementById('styleModal').classList.remove('hidden');
        this.render();
    },

    // --- SYNC & FILESYSTEM ---
    syncWithServer: async function() {
        const host = typeof buildWebUIUrl === 'function' ? buildWebUIUrl() : (typeof HOST !== 'undefined' ? HOST : "");
        if (!host) return alert("Link server first!");

        try {
            const res = await fetch(`${host}/sdapi/v1/prompt-styles`);
            const serverData = await res.json();
            
            // Merge logic: Add server styles if they don't exist locally
            serverData.forEach(ss => {
                if (!this.styles.find(ls => ls.name === ss.name)) {
                    this.styles.push({ name: ss.name, prompt: ss.prompt || ss.value || "", negative_prompt: ss.negative_prompt || "" });
                }
            });

            await this.writeToDisk();
            this.render();
            if (window.Toast) Toast.show({text: "Server Styles Fetched"});
        } catch (e) { alert("Fetch failed. Check connection."); }
    },

    writeToDisk: async function() {
        let csv = "name,prompt,negative_prompt\n";
        this.styles.forEach(s => {
            csv += `"${s.name}","${(s.prompt || '').replace(/"/g, '""')}","${(s.negative_prompt || '').replace(/"/g, '""')}"\n`;
        });
        if (this.fs) {
            await this.fs.writeFile({ path: this.FILE, data: csv, directory: 'DOCUMENTS', encoding: 'utf8' });
        }
    },

    loadLocalCSV: async function() {
        if (!this.fs) return;
        try {
            const ret = await this.fs.readFile({ path: this.FILE, directory: 'DOCUMENTS', encoding: 'utf8' });
            const lines = ret.data.split('\n');
            this.styles = lines.slice(1).filter(l => l.trim()).map(line => {
                const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                return {
                    name: parts[0]?.replace(/^"|"$/g, '').trim(),
                    prompt: parts[1]?.replace(/^"|"$/g, '').trim(),
                    negative_prompt: parts[2]?.replace(/^"|"$/g, '').trim()
                };
            });
        } catch (e) {}
    },

    // --- UI RENDERING ---
    render: function() {
        const container = document.getElementById('styleList');
        const query = document.getElementById('styleSearch').value.toLowerCase();
        container.innerHTML = '';

        this.styles.filter(s => s.name.toLowerCase().includes(query)).forEach(style => {
            const isActive = this.selectedStyles.has(style.name);
            const div = document.createElement('div');
            div.className = `glass-box style-card ${isActive ? 'selected-glow' : ''}`;
            div.style.cssText = `margin-bottom:10px; padding:12px; transition: 0.3s; border: 1px solid ${isActive ? '#ffd700' : 'var(--border-color)'}; box-shadow: ${isActive ? '0 0 15px rgba(255, 215, 0, 0.3)' : 'none'};`;
            
            div.innerHTML = `
                <div class="row" style="justify-content:space-between; align-items:center;">
                    <div style="flex:1; cursor:pointer;" onclick="window.StyleManager.toggleSelection('${style.name}')">
                        <div style="font-weight:900; color:${isActive ? '#ffd700' : 'var(--accent-primary)'}; font-size:12px;">${style.name.toUpperCase()} ${isActive ? '★' : ''}</div>
                        <div style="font-size:10px; color:var(--text-muted); display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden;">
                            ${style.prompt || '...'}
                        </div>
                    </div>
                    <div class="row" style="width:auto; gap:10px;">
                        <button onclick="event.stopPropagation(); window.StyleManager.openEditor('${style.name}')" style="background:none; border:none; color:var(--text-muted); padding:4px;">
                            <i data-lucide="edit-2" size="14"></i>
                        </button>
                        <button onclick="event.stopPropagation(); window.StyleManager.deleteStyle('${style.name}')" style="background:none; border:none; color:#ff4444; padding:4px;">
                            <i data-lucide="trash-2" size="14"></i>
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });
        if (window.lucide) lucide.createIcons();
    },

    // --- TOGGLE & INJECT ---
    toggleSelection: function(name) {
        if (this.selectedStyles.has(name)) {
            this.selectedStyles.delete(name);
        } else {
            this.selectedStyles.add(name);
        }
        this.render();
        this.updateGenTabs();
    },

    updateGenTabs: function() {
        const mode = typeof currentMode !== 'undefined' ? currentMode : 'xl';
        const pEl = document.getElementById(`${mode}_prompt`);
        const nEl = document.getElementById(`${mode}_neg`);

        // Get base prompts (excluding our injected styles)
        // This is tricky without a separator, so we'll just append for now
        // To be perfect, we'd need to track the "Original Prompt" separately.
        
        let finalP = pEl.value;
        let finalN = nEl ? nEl.value : "";

        this.selectedStyles.forEach(name => {
            const s = this.styles.find(x => x.name === name);
            if (s) {
                if (s.prompt && !finalP.includes(s.prompt)) finalP += ", " + s.prompt;
                if (s.negative_prompt && nEl && !finalN.includes(s.negative_prompt)) finalN += ", " + s.negative_prompt;
            }
        });

        pEl.value = finalP.replace(/^, /, "").trim();
        if (nEl) nEl.value = finalN.replace(/^, /, "").trim();
        if (typeof savePrompt === 'function') savePrompt(mode);
    },

    // --- EDITOR ---
    openCreatePopup: function() {
        this.editingOldName = null;
        document.getElementById('styleEditorModal').classList.remove('hidden');
        document.getElementById('styleEditorTitle').innerText = "NEW STYLE";
        document.getElementById('styleEditName').value = "";
        document.getElementById('styleEditPrompt').value = "";
        document.getElementById('styleEditNeg').value = "";
    },

    openEditor: function(name) {
        const style = this.styles.find(s => s.name === name);
        this.editingOldName = name;
        document.getElementById('styleEditorModal').classList.remove('hidden');
        document.getElementById('styleEditorTitle').innerText = "EDIT STYLE";
        document.getElementById('styleEditName').value = style.name;
        document.getElementById('styleEditPrompt').value = style.prompt || "";
        document.getElementById('styleEditNeg').value = style.negative_prompt || "";
    },

    copyFromTab: function() {
        const mode = typeof currentMode !== 'undefined' ? currentMode : 'xl';
        document.getElementById('styleEditPrompt').value = document.getElementById(`${mode}_prompt`).value;
        const neg = document.getElementById(`${mode}_neg`);
        if(neg) document.getElementById('styleEditNeg').value = neg.value;
    },

    saveStyle: async function() {
        const newName = document.getElementById('styleEditName').value.trim();
        const prompt = document.getElementById('styleEditPrompt').value.trim();
        const neg = document.getElementById('styleEditNeg').value.trim();

        if (!newName) return alert("Name required");

        if (this.editingOldName) {
            // Updating existing (allows name change)
            const idx = this.styles.findIndex(s => s.name === this.editingOldName);
            this.styles[idx] = { name: newName, prompt, negative_prompt: neg };
        } else {
            // New style
            this.styles.push({ name: newName, prompt, negative_prompt: neg });
        }

        await this.writeToDisk();
        this.render();
        document.getElementById('styleEditorModal').classList.add('hidden');
    },

    deleteStyle: async function(name) {
        if (!confirm("Delete style?")) return;
        this.styles = this.styles.filter(s => s.name !== name);
        this.selectedStyles.delete(name);
        await this.writeToDisk();
        this.render();
    }
};

window.addEventListener('load', () => window.StyleManager.init());
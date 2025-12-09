lucide.createIcons();

// --- STATE ---
let currentMode = 'xl'; 
let db;
let currentGalleryImages = [];
let currentGalleryIndex = 0;
let allLoras = [];
let HOST = "";

// --- THEME ---
function toggleTheme() {
    const root = document.documentElement;
    if (root.getAttribute('data-theme') === 'light') {
        root.removeAttribute('data-theme');
        document.getElementById('themeToggle').innerHTML = '<i data-lucide="sun"></i>';
    } else {
        root.setAttribute('data-theme', 'light');
        document.getElementById('themeToggle').innerHTML = '<i data-lucide="moon"></i>';
    }
    lucide.createIcons();
}

// --- HELPER: HEADERS ---
const getHeaders = () => ({ 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' });

// --- VRAM PROFILE MAPPING ---
function getVramMapping() {
    const profile = document.getElementById('vramProfile').value;
    switch(profile) {
        case 'low': return 4096; 
        case 'mid': return 8192; 
        case 'high': return 32768; 
        default: return 8192;
    }
}

// --- MODE SWITCHING (UI ONLY + SILENT CLEAR) ---
window.setMode = async function(mode) {
    if (currentMode !== mode) {
        if(HOST) await unloadModel(true); 
    }

    currentMode = mode;
    const root = document.documentElement;
    const btnXL = document.getElementById('btn-xl');
    const btnFlux = document.getElementById('btn-flux');
    
    const xlRow = document.getElementById('row-xl-model');
    const fluxRow = document.getElementById('row-flux-model');
    const xlCont = document.getElementById('mode-xl-container');
    const fluxCont = document.getElementById('mode-flux-container');

    if(mode === 'flux') {
        root.setAttribute('data-mode', 'flux');
        btnXL.classList.remove('active');
        btnFlux.classList.add('active');
        xlRow.classList.add('hidden');
        fluxRow.classList.remove('hidden');
        xlCont.classList.add('hidden');
        fluxCont.classList.remove('hidden');
        document.getElementById('genBtn').innerText = "QUANTUM GENERATE";
        document.getElementById('appTitle').innerText = "BOJRO FLUX RESOLVER";
    } else {
        root.removeAttribute('data-mode');
        btnFlux.classList.remove('active');
        btnXL.classList.add('active');
        fluxRow.classList.add('hidden');
        xlRow.classList.remove('hidden');
        fluxCont.classList.add('hidden');
        xlCont.classList.remove('hidden');
        document.getElementById('genBtn').innerText = "GENERATE";
        document.getElementById('appTitle').innerText = "BOJRO RESOLVER";
    }
}

// --- DB ---
const request = indexedDB.open("BojroHybridDB", 1);
request.onupgradeneeded = e => { db = e.target.result; db.createObjectStore("images", { keyPath: "id", autoIncrement: true }); };
request.onsuccess = e => { db = e.target.result; loadGallery(); loadHostIp(); };

function saveImageToDB(base64) {
    if(db) db.transaction(["images"], "readwrite").objectStore("images").add({ data: base64, date: new Date().toLocaleString() });
}
window.clearDbGallery = function() {
    if(confirm("Delete history?")) {
        db.transaction(["images"], "readwrite").objectStore("images").clear();
        loadGallery();
    }
}

// --- NAV ---
window.switchTab = function(view) {
    document.querySelectorAll('.dock-item').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('[id^="view-"]').forEach(v => v.classList.add('hidden'));
    document.getElementById('view-' + view).classList.remove('hidden');
    
    const items = document.querySelectorAll('.dock-item');
    if(view === 'gen') items[0].classList.add('active');
    if(view === 'gal') { items[1].classList.add('active'); loadGallery(); }
    if(view === 'ana') items[2].classList.add('active');
}

// --- CONNECT ---
function loadHostIp() { const ip = localStorage.getItem('bojroHostIp'); if(ip) document.getElementById('hostIp').value = ip; }
window.connect = async function() {
    HOST = document.getElementById('hostIp').value.replace(/\/$/, "");
    const dot = document.getElementById('statusDot');
    dot.style.background = "yellow";
    try {
        const res = await fetch(`${HOST}/sdapi/v1/sd-models`, { headers: getHeaders() });
        if(!res.ok) throw new Error("Status " + res.status);
        dot.style.background = "#00e676"; dot.classList.add('on');
        localStorage.setItem('bojroHostIp', HOST);
        document.getElementById('genBtn').disabled = false;
        await fetchModels(); await fetchSamplers(); await fetchLoras(); await fetchVaes(); 
        alert("CONNECTED");
    } catch(e) {
        dot.style.background = "#f44336"; alert("Failed: " + e.message);
    }
}

// --- FETCHERS ---
async function fetchModels() {
    try {
        const res = await fetch(`${HOST}/sdapi/v1/sd-models`, { headers: getHeaders() });
        const data = await res.json();
        const selXL = document.getElementById('xl_modelSelect'); selXL.innerHTML = "";
        data.forEach(m => selXL.appendChild(new Option(m.model_name, m.title)));
        const selFlux = document.getElementById('flux_modelSelect'); selFlux.innerHTML = "";
        data.forEach(m => selFlux.appendChild(new Option(m.model_name, m.title)));
        ['xl', 'flux'].forEach(mode => {
            const saved = localStorage.getItem('bojroModel_'+mode);
            if(saved) document.getElementById(mode+'_modelSelect').value = saved;
        });
    } catch(e){}
}
async function fetchSamplers() {
    try {
        const res = await fetch(`${HOST}/sdapi/v1/samplers`, { headers: getHeaders() });
        const data = await res.json();
        const selXL = document.getElementById('xl_sampler'); selXL.innerHTML = "";
        data.forEach(s => selXL.appendChild(new Option(s.name, s.name)));
        const selFlux = document.getElementById('flux_sampler'); selFlux.innerHTML = "";
        data.forEach(s => { const opt = new Option(s.name, s.name); if(s.name === "Euler") opt.selected = true; selFlux.appendChild(opt); });
    } catch(e){}
}
async function fetchLoras() {
    try { const res = await fetch(`${HOST}/sdapi/v1/loras`, { headers: getHeaders() }); allLoras = await res.json(); } catch(e){}
}

async function fetchVaes() {
    const slots = [
        document.getElementById('flux_vae'),
        document.getElementById('flux_clip'),
        document.getElementById('flux_t5')
    ];
    
    slots.forEach(s => s.innerHTML = "<option value='Automatic'>Automatic</option>");

    let list = [];
    try {
        const res = await fetch(`${HOST}/sdapi/v1/sd-modules`, { headers: getHeaders() });
        const data = await res.json();
        if(data && data.length) list = data.map(m => m.model_name);
    } catch(e) {
        try {
            const res2 = await fetch(`${HOST}/sdapi/v1/sd-vae`, { headers: getHeaders() });
            const data2 = await res2.json();
            if(data2 && data2.length) list = data2.map(m => m.model_name);
        } catch(err) {}
    }

    if(list.length > 0) {
        slots.forEach(sel => {
            list.forEach(name => {
                if (name !== "Automatic" && !Array.from(sel.options).some(o => o.value === name)) {
                    sel.appendChild(new Option(name, name));
                }
            });
        });
    }

    ['flux_vae', 'flux_clip', 'flux_t5'].forEach(id => {
        const saved = localStorage.getItem('bojro_'+id);
        if(saved && Array.from(document.getElementById(id).options).some(o => o.value === saved)) {
            document.getElementById(id).value = saved;
        }
    });
    
    const savedBits = localStorage.getItem('bojro_flux_bits');
    if(savedBits) document.getElementById('flux_bits').value = savedBits;
}

// --- LOGIC ---
window.saveSelection = function(key) {
    if(key === 'xl') localStorage.setItem('bojroModel_xl', document.getElementById('xl_modelSelect').value);
    else if(key === 'flux') localStorage.setItem('bojroModel_flux', document.getElementById('flux_modelSelect').value);
    else if(key === 'flux_bits') localStorage.setItem('bojro_flux_bits', document.getElementById('flux_bits').value);
}
window.saveTrident = function() {
    ['flux_vae', 'flux_clip', 'flux_t5'].forEach(id => localStorage.setItem('bojro_'+id, document.getElementById(id).value));
}

// --- UNLOAD CHECKPOINT ---
window.unloadModel = async function(silent = false) {
    if(!silent && !confirm("Unload current model?")) return;
    const btns = document.querySelectorAll('.btn-icon');
    btns.forEach(b => b.disabled = true);
    try {
        const res = await fetch(`${HOST}/sdapi/v1/unload-checkpoint`, { method: 'POST', headers: getHeaders() });
        if(res.ok) {
            if(!silent) alert("Model Unloaded!");
        } else throw new Error(res.status);
    } catch(e) {
        if(!silent) alert("Failed: " + e.message);
    } finally {
        btns.forEach(b => b.disabled = false);
    }
}

async function postOption(payload) { 
    const res = await fetch(`${HOST}/sdapi/v1/options`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) }); 
    if(!res.ok) throw new Error("API Error " + res.status);
}

window.setRes = (mode, w, h) => { document.getElementById(`${mode}_width`).value = w; document.getElementById(`${mode}_height`).value = h; }
window.flipRes = (mode) => {
    const w = document.getElementById(`${mode}_width`); const h = document.getElementById(`${mode}_height`);
    const t = w.value; w.value = h.value; h.value = t;
}

// --- LORA ---
let activeLoraMode = 'xl';
window.openLoraModal = (mode) => { activeLoraMode = mode; document.getElementById('loraModal').classList.remove('hidden'); document.getElementById('loraSearch').focus(); window.filterLoras(); }
window.closeLoraModal = () => document.getElementById('loraModal').classList.add('hidden');
window.filterLoras = () => {
    const list = document.getElementById('loraVerticalList'); list.innerHTML = "";
    const term = document.getElementById('loraSearch').value.toLowerCase();
    if(allLoras.length === 0) { list.innerHTML = "<div style='padding:20px;text-align:center;color:#777;'>No LoRAs</div>"; return; }
    allLoras.forEach(l => {
        if(l.name.toLowerCase().includes(term)) {
            const d = document.createElement('div'); d.className = 'lora-row';
            d.innerHTML = `<span>${l.name}</span><span class="lora-status">+</span>`;
            d.onclick = function() { 
                const id = activeLoraMode === 'xl' ? 'xl_prompt' : 'flux_prompt';
                const p = document.getElementById(id); 
                if(!p.value.includes(`<lora:${l.name}`)) {
                    p.value += ` <lora:${l.name}:1>`; 
                    this.querySelector('.lora-status').innerText = "✓"; 
                    this.querySelector('.lora-status').style.color = "#00e676";
                }
            };
            list.appendChild(d);
        }
    });
}

function normalize(str) { 
    if (!str) return "";
    const noHash = str.split(' [')[0].trim();
    return noHash.replace(/\\/g, '/').split('/').pop().toLowerCase();
}

// --- GENERATION ---
window.generate = async function() {
    const btn = document.getElementById('genBtn');
    const spinner = document.getElementById('loadingSpinner');
    
    const targetModelTitle = currentMode === 'xl' 
        ? document.getElementById('xl_modelSelect').value 
        : document.getElementById('flux_modelSelect').value;
    
    if(!targetModelTitle || targetModelTitle === "Link first...") return alert("Please select a model first!");

    btn.disabled = true; 
    
    try {
        let isReady = false;
        let attempts = 0;

        while (!isReady && attempts < 40) { 
            const optsReq = await fetch(`${HOST}/sdapi/v1/options`, { headers: getHeaders() });
            const opts = await optsReq.json();
            
            const modelMatch = normalize(opts.sd_model_checkpoint) === normalize(targetModelTitle);

            if (modelMatch) {
                isReady = true;
                break;
            }

            if (attempts % 5 === 0) { 
                btn.innerText = `ALIGNING SYSTEM... (${attempts})`;
                await postOption({ 
                    "sd_model_checkpoint": targetModelTitle,
                    "forge_unet_storage_dtype": "Automatic (fp16 LoRA)"
                });
            }

            attempts++;
            await new Promise(r => setTimeout(r, 1500));
        }

        if (!isReady) {
            btn.disabled = false; btn.innerText = "RETRY";
            return alert("Timeout: Server refused configuration.");
        }

    } catch(e) {
        btn.disabled = false; btn.innerText = "ERROR";
        return alert("Connection Error: " + e.message);
    }

    // --- STEP 2: START GENERATION & PROGRESS MONITORING ---
    btn.innerText = "PROCESSING...";
    document.querySelectorAll('.gen-result').forEach(img => img.remove());
    spinner.style.display = 'block';

    let payload = {};
    let overrides = {}; 
    
    overrides["forge_inference_memory"] = getVramMapping();
    overrides["forge_unet_storage_dtype"] = "Automatic (fp16 LoRA)";

    // START PROGRESS POLLING
    const progressInterval = setInterval(async () => {
        try {
            const res = await fetch(`${HOST}/sdapi/v1/progress`, { headers: getHeaders() });
            const data = await res.json();
            if (data.state && data.state.sampling_steps > 0) {
                 btn.innerText = `Step ${data.state.sampling_step}/${data.state.sampling_steps}`;
            }
        } catch(e) {}
    }, 500);

    if(currentMode === 'xl') {
        overrides["forge_additional_modules"] = [];
        overrides["sd_vae"] = "Automatic";

        payload = {
            "prompt": document.getElementById('xl_prompt').value,
            "negative_prompt": document.getElementById('xl_neg').value,
            "steps": parseInt(document.getElementById('xl_steps').value),
            "cfg_scale": parseFloat(document.getElementById('xl_cfg').value),
            "width": parseInt(document.getElementById('xl_width').value),
            "height": parseInt(document.getElementById('xl_height').value),
            "batch_size": parseInt(document.getElementById('xl_batch_size').value), // BATCH SIZE
            "n_iter": parseInt(document.getElementById('xl_batch_count').value),    // BATCH COUNT
            "sampler_name": document.getElementById('xl_sampler').value,
            "scheduler": document.getElementById('xl_scheduler').value,
            "seed": parseInt(document.getElementById('xl_seed').value),
            "save_images": true,
            "override_settings": overrides
        };
    } else {
        const modulesList = [
            document.getElementById('flux_vae').value,
            document.getElementById('flux_clip').value,
            document.getElementById('flux_t5').value
        ].filter(v => v && v !== "Automatic");

        if (modulesList.length > 0) {
            overrides["forge_additional_modules"] = modulesList;
        }

        const bits = document.getElementById('flux_bits').value;
        if(bits) overrides["forge_unet_storage_dtype"] = bits;

        const distCfg = parseFloat(document.getElementById('flux_distilled').value);

        payload = {
            "prompt": document.getElementById('flux_prompt').value,
            "negative_prompt": "",
            "steps": parseInt(document.getElementById('flux_steps').value),
            "cfg_scale": parseFloat(document.getElementById('flux_cfg').value),
            "distilled_cfg_scale": isNaN(distCfg) ? 3.5 : distCfg, 
            "width": parseInt(document.getElementById('flux_width').value),
            "height": parseInt(document.getElementById('flux_height').value),
            "batch_size": parseInt(document.getElementById('flux_batch_size').value), // BATCH SIZE
            "n_iter": parseInt(document.getElementById('flux_batch_count').value),    // BATCH COUNT
            "sampler_name": document.getElementById('flux_sampler').value,
            "scheduler": document.getElementById('flux_scheduler').value,
            "seed": parseInt(document.getElementById('flux_seed').value),
            "save_images": true,
            "override_settings": overrides 
        };
    }

    try {
        const res = await fetch(`${HOST}/sdapi/v1/txt2img`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) });
        
        // Stop polling immediately after response
        clearInterval(progressInterval);
        
        if(!res.ok) throw new Error("Server Error " + res.status);
        const data = await res.json();
        if(data.images) {
            data.images.forEach(b64 => {
                const finalB64 = "data:image/png;base64," + b64;
                const img = document.createElement('img');
                img.src = finalB64;
                img.className = 'gen-result';
                img.onclick = () => openFullscreen([finalB64], 0);
                document.getElementById('gallery').appendChild(img);
                saveImageToDB(finalB64);
            });
            if(document.getElementById('autoDlCheck').checked) setTimeout(window.downloadResults, 500);
            if(data.info) {
                const info = JSON.parse(data.info);
                const metaDiv = document.getElementById('metaData');
                metaDiv.innerText = `Seed: ${info.seed}\nModel: ${info.sd_model_name}`;
                metaDiv.classList.remove('hidden');
            }
        }
    } catch(e) { 
        clearInterval(progressInterval);
        alert("Gen Failed: " + e.message); 
    }
    
    spinner.style.display = 'none';
    btn.disabled = false; btn.innerText = currentMode === 'xl' ? "GENERATE" : "QUANTUM GENERATE";
}

// --- GALLERY & ANALYZER ---
function loadGallery() {
    const grid = document.getElementById('savedGalleryGrid'); grid.innerHTML = "";
    if(!db) return;
    db.transaction(["images"], "readonly").objectStore("images").getAll().onsuccess = e => {
        const imgs = e.target.result;
        if(!imgs || imgs.length === 0) { grid.innerHTML = "<div style='text-align:center;color:#777;margin-top:20px;grid-column:1/-1;'>No images</div>"; return; }
        const reversedImgs = imgs.reverse();
        currentGalleryImages = reversedImgs.map(i => i.data);
        reversedImgs.forEach((item, index) => {
            const img = document.createElement('img'); img.src = item.data; img.className = 'gal-thumb';
            img.onclick = () => openFullscreen(currentGalleryImages, index);
            grid.appendChild(img);
        });
    }
}
window.openFullscreen = function(imagesArray, index) {
    currentGalleryImages = imagesArray; currentGalleryIndex = index;
    updateLightboxImage();
    document.getElementById('fullScreenModal').classList.remove('hidden');
}
function updateLightboxImage() { if(currentGalleryImages.length > 0) document.getElementById('fsImage').src = currentGalleryImages[currentGalleryIndex]; }
window.slideImage = function(dir) {
    if(currentGalleryImages.length === 0) return;
    currentGalleryIndex += dir;
    if(currentGalleryIndex < 0) currentGalleryIndex = currentGalleryImages.length - 1;
    if(currentGalleryIndex >= currentGalleryImages.length) currentGalleryIndex = 0;
    updateLightboxImage();
}
window.downloadCurrent = function() {
    const src = document.getElementById('fsImage').src;
    const a = document.createElement('a'); a.href = src; a.download = `Bojro_${Date.now()}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
window.closeFsModal = () => document.getElementById('fullScreenModal').classList.add('hidden');

function gcd(a, b) { return b ? gcd(b, a % b) : a; }
window.analyzeCurrentFs = () => { window.closeFsModal(); window.switchTab('ana'); fetch(document.getElementById('fsImage').src).then(res => res.blob()).then(processImageForAnalysis); }
window.handleFileSelect = e => { const file = e.target.files[0]; if(!file) return; processImageForAnalysis(file); }
async function processImageForAnalysis(blob) {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
        const w = img.width; const h = img.height; const d = gcd(w, h);
        document.getElementById('resOut').innerText = `${w} x ${h}`;
        document.getElementById('arOut').innerText = `${w/d}:${h/d}`;
        document.getElementById('anaPreview').src = url;
        document.getElementById('anaGallery').classList.remove('hidden');
        document.getElementById('dateOut').innerText = new Date().toLocaleString();
    };
    img.src = url;
    const text = await readPngMetadata(blob);
    document.getElementById('anaMeta').innerText = text || "No parameters found.";
}
async function readPngMetadata(blob) {
    const buffer = await blob.arrayBuffer();
    const view = new DataView(buffer);
    const decoder = new TextDecoder("utf-8");
    let offset = 8; 
    while (offset < buffer.byteLength) {
        try {
            const length = view.getUint32(offset);
            const type = decoder.decode(new Uint8Array(buffer, offset + 4, 4));
            if (type === 'tEXt') {
                const data = new Uint8Array(buffer, offset + 8, length);
                let nullIndex = data.indexOf(0);
                if (nullIndex > -1) {
                    const keyword = decoder.decode(data.slice(0, nullIndex));
                    if (keyword === 'parameters') return decoder.decode(data.slice(nullIndex + 1));
                }
            }
            offset += length + 12;
        } catch (e) { break; }
    }
    return null;
}
function loadAutoDlState() { const c = document.getElementById('autoDlCheck'); if(c) c.checked = localStorage.getItem('bojroAutoSave') === 'true'; }
window.saveAutoDlState = () => localStorage.setItem('bojroAutoSave', document.getElementById('autoDlCheck').checked);
loadAutoDlState();
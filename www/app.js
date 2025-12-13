lucide.createIcons();

// --- CAPACITOR PLUGINS ---
const Filesystem = window.Capacitor ? window.Capacitor.Plugins.Filesystem : null;
const Toast = window.Capacitor ? window.Capacitor.Plugins.Toast : null;
const LocalNotifications = window.Capacitor ? window.Capacitor.Plugins.LocalNotifications : null;
const App = window.Capacitor ? window.Capacitor.Plugins.App : null;
const CapacitorHttp = window.Capacitor ? window.Capacitor.Plugins.CapacitorHttp : null;
// NATIVE SERVICE LINK
const ResolverService = window.Capacitor ? window.Capacitor.Plugins.ResolverService : null;

// --- STATE ---
let currentMode = 'xl'; 
let db;

// DATA & PAGINATION
let historyImagesData = []; 
let currentGalleryImages = []; 
let currentGalleryIndex = 0;
let galleryPage = 1;
const ITEMS_PER_PAGE = 50;

let allLoras = [];
let HOST = "";

// Queue State
let jobQueue = [];
let isQueueRunning = false;
let totalBatchSteps = 0;
let currentBatchProgress = 0;
let isSingleJobRunning = false; 

// Notification Throttling
let notificationUpdateThrottle = 0; 
const NOTIFICATION_UPDATE_INTERVAL_MS = 1000; 

// Gallery Selection State
let isSelectionMode = false;
let selectedImageIds = new Set();

// Analyzer State
let currentAnalyzedPrompts = null;

// --- INITIALIZATION ---
window.onload = function() {
    try {
        loadHostIp();
        loadAutoDlState();
        setupBackgroundListeners();
        createNotificationChannel(); 
        loadLlmSettings(); 
        
        // AUTO-CONNECT FEATURE
        if (document.getElementById('hostIp').value) {
            console.log("Auto-connecting...");
            window.connect(true); // Call connect in silent mode
        }
    } catch (e) {
        console.error("Initialization Error:", e);
    }
}

// --- BACKGROUND / NOTIFICATION LOGIC ---
async function createNotificationChannel() {
    if (!LocalNotifications) return;
    try {
        await LocalNotifications.createChannel({
            id: 'batch_channel',
            name: 'Generation Status',
            importance: 2, 
            visibility: 1,
            vibration: false 
        });
    } catch(e) { console.error("Channel error", e); }
}

function setupBackgroundListeners() {
    if (!App) return;

    // 1. When User Presses Home (Background)
    App.addListener('pause', async () => {
        // App backgrounded
    });

    // 2. When User Opens App (Foreground)
    App.addListener('resume', async () => {
        // Clear local notifications
        if (LocalNotifications) {
            try {
                const pending = await LocalNotifications.getPending();
                if (pending.notifications.length > 0) {
                    await LocalNotifications.cancel(pending);
                }
            } catch (e) { console.error("Resume Error", e); }
        }
        
        // Auto-reconnect check if dropped
        if(!allLoras.length && document.getElementById('hostIp').value) {
             window.connect(true);
        }
    });
}

// --- CORE NOTIFICATION FIX ---
async function updateBatchNotification(title, force = false, body = "") {
    
    // 1. Calculate Progress Percentage
    let progressVal = 0;
    try {
        if (body && body.includes(" / ")) {
            const parts = body.split(" / ");
            const current = parseInt(parts[0].replace(/\D/g, '')) || 0;
            const total = parseInt(parts[1].replace(/\D/g, '')) || 1;
            if (total > 0) {
                progressVal = Math.floor((current / total) * 100);
            }
        }
    } catch (e) { progressVal = 0; }

    // 2. PRIMARY: Native Service
    if (ResolverService) {
        try {
            await ResolverService.updateProgress({
                title: title,
                body: body, // Sends "Step 5/20" to Android Notification
                progress: progressVal
            });
            return; 
        } catch (e) {
            console.error("Native Service Error:", e);
        }
    }

    // 3. FALLBACK: Local Notification
    if (!document.hidden && !force && title !== "Batch Complete!") return; 

    const now = Date.now();
    if (!force && title !== "Batch Complete!") {
        if (now < notificationUpdateThrottle + NOTIFICATION_UPDATE_INTERVAL_MS) {
            return;
        }
        notificationUpdateThrottle = now;
    }

    if (LocalNotifications) {
        try {
            await LocalNotifications.schedule({
                notifications: [{
                    title: title,
                    body: body, 
                    id: 1001, 
                    channelId: 'batch_channel',
                    ongoing: true, 
                    onlyAlertOnce: true, 
                    autoCancel: false,
                    smallIcon: "ic_launcher" 
                }]
            });
        } catch(e) {}
    }
}

// --- THEME ---
window.toggleTheme = function() {
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

// --- HELPER: SAVE TO DEVICE ---
async function saveToMobileGallery(base64Data) {
    try {
        const isNative = window.Capacitor && window.Capacitor.isNative;

        if (isNative) {
            const cleanBase64 = base64Data.split(',')[1];
            const fileName = `Bojro_${Date.now()}.png`;
            
            try {
                await Filesystem.mkdir({ path: 'Resolver', directory: 'DOCUMENTS', recursive: false });
            } catch (e) {}

            await Filesystem.writeFile({
                path: `Resolver/${fileName}`,
                data: cleanBase64,
                directory: 'DOCUMENTS'
            });

            if(Toast) {
                await Toast.show({ text: 'Image saved to Documents/Resolver', duration: 'short', position: 'bottom' });
            }
        } else {
            const link = document.createElement('a');
            link.href = base64Data;
            link.download = `Bojro_${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    } catch (e) {
        console.error("Save failed", e);
        alert("Error saving: " + e.message);
    }
}

// --- VRAM PROFILE MAPPING ---
function getVramMapping() {
    const profile = document.getElementById('vramProfile').value;
    switch(profile) {
        case 'low': return 4096; 
        case 'mid': return 1536; 
        case 'high': return 4096; 
        default: return 1536;
    }
}

// --- MODE SWITCHING ---
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
        document.getElementById('appTitle').innerText = "BOJRO FLUX";
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
request.onsuccess = e => { db = e.target.result; loadGallery(); };

function saveImageToDB(base64) {
    return new Promise((resolve, reject) => {
        if(!db) { resolve(null); return; }
        const tx = db.transaction(["images"], "readwrite");
        const store = tx.objectStore("images");
        const req = store.add({ data: base64, date: new Date().toLocaleString() });
        req.onsuccess = (e) => resolve(e.target.result); 
        req.onerror = () => resolve(null);
    });
}

// --- CLEAR ALL ---
window.clearDbGallery = function() {
    if(confirm("Delete entire history? This cannot be undone.")) {
        const tx = db.transaction(["images"], "readwrite");
        tx.objectStore("images").clear();
        tx.oncomplete = () => {
            isSelectionMode = false;
            selectedImageIds.clear();
            const selBtn = document.getElementById('galSelectBtn');
            const delBtn = document.getElementById('galDeleteBtn');
            if(selBtn) {
                selBtn.style.background = "var(--input-bg)";
                selBtn.style.color = "var(--text-main)";
            }
            if(delBtn) delBtn.classList.add('hidden');
            
            galleryPage = 1; 
            loadGallery();
        };
    }
}

// --- NAV (FIXED) ---
window.switchTab = function(view) {
    // Hide all views
    document.querySelectorAll('[id^="view-"]').forEach(v => v.classList.add('hidden'));
    // Show selected view
    document.getElementById('view-' + view).classList.remove('hidden');
    
    // Update active dock item
    const items = document.querySelectorAll('.dock-item');
    items.forEach(item => item.classList.remove('active'));
    
    if(view === 'gen') items[0].classList.add('active');
    if(view === 'que') items[1].classList.add('active');
    if(view === 'gal') { items[2].classList.add('active'); loadGallery(); }
    if(view === 'ana') items[3].classList.add('active');
}

// --- CONNECT ---
function loadHostIp() { const ip = localStorage.getItem('bojroHostIp'); if(ip) document.getElementById('hostIp').value = ip; }

window.connect = async function(silent = false) {
    HOST = document.getElementById('hostIp').value.replace(/\/$/, "");
    const dot = document.getElementById('statusDot');
    if(!silent) dot.style.background = "yellow";
    
    try {
        if (LocalNotifications && !silent) {
            const perm = await LocalNotifications.requestPermissions();
            if (perm.display === 'granted') {
                await createNotificationChannel();
            }
        }

        const res = await fetch(`${HOST}/sdapi/v1/sd-models`, { headers: getHeaders() });
        if(!res.ok) throw new Error("Status " + res.status);
        
        dot.style.background = "#00e676"; dot.classList.add('on');
        localStorage.setItem('bojroHostIp', HOST);
        document.getElementById('genBtn').disabled = false;
        
        await Promise.all([fetchModels(), fetchSamplers(), fetchLoras(), fetchVaes()]);
        
        if(!silent) alert("CONNECTED");
    } catch(e) {
        dot.style.background = "#f44336"; 
        if(!silent) alert("Failed: " + e.message);
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
    const slots = [document.getElementById('flux_vae'), document.getElementById('flux_clip'), document.getElementById('flux_t5')];
    slots.forEach(s => s.innerHTML = "<option value='Automatic'>Automatic</option>");
    let list = [];
    try {
        const res = await fetch(`${HOST}/sdapi/v1/sd-modules`, { headers: getHeaders() });
        const data = await res.json();
        if(data && data.length) list = data.map(m => m.model_name);
    } catch(e) {}
    
    if(list.length > 0) {
        slots.forEach(sel => {
            list.forEach(name => {
                if (name !== "Automatic" && !Array.from(sel.options).some(o => o.value === name)) sel.appendChild(new Option(name, name));
            });
        });
    }
    ['flux_vae', 'flux_clip', 'flux_t5'].forEach(id => {
        const saved = localStorage.getItem('bojro_'+id);
        if(saved && Array.from(document.getElementById(id).options).some(o => o.value === saved)) document.getElementById(id).value = saved;
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

// --- UTILS ---
window.unloadModel = async function(silent = false) {
    if(!silent && !confirm("Unload current model?")) return;
    try { await fetch(`${HOST}/sdapi/v1/unload-checkpoint`, { method: 'POST', headers: getHeaders() }); if(!silent) alert("Unloaded"); } catch(e) {}
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
function normalize(str) { 
    if (!str) return "";
    const noHash = str.split(' [')[0].trim();
    return noHash.replace(/\\/g, '/').split('/').pop().toLowerCase();
}

// --- LORA ---
let activeLoraMode = 'xl';
window.openLoraModal = (mode) => { activeLoraMode = mode; document.getElementById('loraModal').classList.remove('hidden'); document.getElementById('loraSearch').focus(); window.filterLoras(); }
window.closeLoraModal = () => document.getElementById('loraModal').classList.add('hidden');
window.filterLoras = () => {
    const list = document.getElementById('loraVerticalList'); list.innerHTML = "";
    const promptId = activeLoraMode === 'xl' ? 'xl_prompt' : 'flux_prompt';
    const promptEl = document.getElementById(promptId);
    const currentPromptText = promptEl ? promptEl.value : "";
    const term = document.getElementById('loraSearch').value.toLowerCase();
    
    if(allLoras.length === 0) { list.innerHTML = "<div style='padding:20px;text-align:center;color:#777;'>No LoRAs</div>"; return; }
    
    allLoras.forEach(l => {
        if(l.name.toLowerCase().includes(term)) {
            const d = document.createElement('div'); d.className = 'lora-row';
            const loraTag = `<lora:${l.name}:1>`;
            const isActive = currentPromptText.includes(loraTag);
            d.innerHTML = `<span>${l.name}</span><span class="lora-status" style="color: ${isActive ? '#00e676' : 'var(--text-muted)'}">${isActive ? '✓' : '+'}</span>`;
            d.onclick = function() { 
                const p = document.getElementById(promptId);
                const statusSpan = this.querySelector('.lora-status');
                if (p.value.includes(loraTag)) {
                    p.value = p.value.replace(loraTag, '').replace(/\s\s+/g, ' ');
                    statusSpan.innerText = "+"; statusSpan.style.color = "var(--text-muted)";
                } else {
                    p.value += ` ${loraTag}`; statusSpan.innerText = "✓"; statusSpan.style.color = "#00e676";
                }
            };
            list.appendChild(d);
        }
    });
}

// --- MAGIC PROMPT LLM INTEGRATION ---
let activeLlmMode = 'xl';
let llmState = {
    xl: { input: "", output: "" },
    flux: { input: "", output: "" }
};
let llmSettings = {
    baseUrl: 'http://localhost:11434',
    key: '',
    model: '',
    system_xl: `You are an SDXL Prompt Generator.
OBJECTIVE: Convert user concepts into a dense, highly detailed string of comma-separated tags.
CRITICAL SAFETY LOGIC:
1. IF the user's input implies SFW content (e.g., "cute girl", "scenery", "portrait"):
   - OUTPUT SAFE TAGS ONLY. Do not include sexual anatomy or acts.
   - Example SFW Output: masterpiece, best quality, 1girl, solo, hanfu, flower hair ornament, intricate jewelry, holding fan, red lips, serene expression, highly detailed background, cinematic lighting.
2. IF the user's input implies NSFW content (e.g., "nsfw", "nude", "sex", "orgasm"):
   - OUTPUT EXPLICIT TAGS. Use detailed anatomical terms (nipples, pussy, clitoris, pussy juice) and specific act tags (fingering, sex from behind, ahegao) without censorship.
   - Example NSFW Output: masterpiece, best quality, 1girl, nude, nipples, pussy focus, fingering self, ahegao, intense orgasm, squirting, legs spread, messy bed, dynamic angle.

GENERAL RULES:
- OUTPUT: Provide ONLY the raw prompt text. Do NOT include labels like "For nsfw", "Prompt:", or "Output:".
- FORMAT: Raw, comma-separated tags only. NO labels, NO natural language sentences.
- PREFIX: Always start with "masterpiece, best quality" for sfw, for nsfw: "masterpiece, best quality, score_9, score_8".
- CONTENT ORDER: Quality -> Subject -> Features -> Outfit/Nudity -> Action -> Background -> Lighting -> Tech.
- NEGATIVE: Do NOT generate negative prompts.`,
    system_flux: `You are a FLUX Image Prompter.
OBJECTIVE: Convert user concepts into a detailed, natural language description.
RULES:
1. OUTPUT: Provide ONLY the raw prompt text. Do NOT include labels like "Description:", "Prompt:", or "Natural Language:".
2. FORMAT: Fluid sentences and descriptive phrases. Focus on physical textures, lighting, and camera aesthetics.
3. TONE: Objective and photographic.
4. CONTENT: Describe the subject, outfit, and background in high detail.
5. TEXT: If the user asks for text, use quotation marks.`
};

window.openLlmModal = (mode) => {
    activeLlmMode = mode;
    document.getElementById('llmModal').classList.remove('hidden');
    const inputEl = document.getElementById('llmInput');
    const outputEl = document.getElementById('llmOutput');
    inputEl.value = llmState[mode].input;
    outputEl.value = llmState[mode].output;
    const savedSys = activeLlmMode === 'xl' ? llmSettings.system_xl : llmSettings.system_flux;
    document.getElementById('llmSystemPrompt').value = savedSys || "";
    updateLlmButtonState();
    if(!inputEl.value) inputEl.focus();
}

window.closeLlmModal = () => document.getElementById('llmModal').classList.add('hidden');
window.toggleLlmSettings = () => document.getElementById('llmSettingsBox').classList.toggle('hidden');

window.updateLlmState = function() {
    const val = document.getElementById('llmInput').value;
    llmState[activeLlmMode].input = val;
}

function updateLlmButtonState() {
    const hasOutput = llmState[activeLlmMode].output.trim().length > 0;
    const btn = document.getElementById('llmGenerateBtn');
    btn.innerText = hasOutput ? "ITERATE" : "GENERATE PROMPT";
}

function loadLlmSettings() {
    const s = localStorage.getItem('bojroLlmConfig');
    if(s) {
        const loaded = JSON.parse(s);
        if(loaded.baseUrl) llmSettings.baseUrl = loaded.baseUrl;
        if(loaded.key) llmSettings.key = loaded.key;
        if(loaded.model) llmSettings.model = loaded.model;
        if(loaded.system_xl) llmSettings.system_xl = loaded.system_xl;
        if(loaded.system_flux) llmSettings.system_flux = loaded.system_flux;
        document.getElementById('llmApiBase').value = llmSettings.baseUrl || '';
        document.getElementById('llmApiKey').value = llmSettings.key || '';
        if(llmSettings.model) {
            const sel = document.getElementById('llmModelSelect');
            sel.innerHTML = `<option value="${llmSettings.model}">${llmSettings.model}</option>`;
            sel.value = llmSettings.model;
        }
    }
}

window.saveLlmGlobalSettings = function() {
    llmSettings.baseUrl = document.getElementById('llmApiBase').value.replace(/\/$/, ""); 
    llmSettings.key = document.getElementById('llmApiKey').value;
    llmSettings.model = document.getElementById('llmModelSelect').value;
    const sysVal = document.getElementById('llmSystemPrompt').value;
    if(activeLlmMode === 'xl') llmSettings.system_xl = sysVal;
    else llmSettings.system_flux = sysVal;
    localStorage.setItem('bojroLlmConfig', JSON.stringify(llmSettings));
    if(Toast) Toast.show({ text: 'Settings & Model Saved', duration: 'short' });
}

window.connectToLlm = async function() {
    if (!CapacitorHttp) return alert("Native HTTP Plugin not loaded! Rebuild App.");
    const baseUrl = document.getElementById('llmApiBase').value.replace(/\/$/, "");
    const key = document.getElementById('llmApiKey').value;
    if(!baseUrl) return alert("Enter Server URL first");
    
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = "...";
    btn.disabled = true;

    try {
        const headers = { 'Content-Type': 'application/json' };
        if(key) headers['Authorization'] = `Bearer ${key}`;
        const response = await CapacitorHttp.get({ url: `${baseUrl}/v1/models`, headers: headers });
        const data = response.data;
        if(response.status >= 400) throw new Error(`HTTP ${response.status}`);
        const select = document.getElementById('llmModelSelect');
        select.innerHTML = "";
        if(data.data && Array.isArray(data.data)) {
            data.data.forEach(m => { select.appendChild(new Option(m.id, m.id)); });
            if(Toast) Toast.show({ text: `Found ${data.data.length} models`, duration: 'short' });
        } else { throw new Error("Invalid model format"); }
        document.getElementById('llmApiBase').value = baseUrl; 
        saveLlmGlobalSettings();
    } catch(e) { alert("Link Error: " + (e.message || JSON.stringify(e))); } finally { btn.innerText = originalText; btn.disabled = false; }
}

window.generateLlmPrompt = async function() {
    if (!CapacitorHttp) return alert("Native HTTP Plugin not loaded!");
    const btn = document.getElementById('llmGenerateBtn');
    const inputVal = document.getElementById('llmInput').value;
    const baseUrl = document.getElementById('llmApiBase').value.replace(/\/$/, "");
    const model = document.getElementById('llmModelSelect').value;
    if(!inputVal) return alert("Please enter an idea!");
    if(!baseUrl) return alert("Please connect to server first!");
    
    btn.disabled = true; btn.innerText = "GENERATING...";
    const sysPrompt = document.getElementById('llmSystemPrompt').value;
    const promptTemplate = `1.Prompt(natural language): ${inputVal} Model: ${activeLlmMode === 'xl' ? 'Sdxl' : 'Flux'}`;
    
    try {
        const payload = { model: model || "default", messages: [{ role: "system", content: sysPrompt }, { role: "user", content: promptTemplate }], stream: false };
        const headers = { 'Content-Type': 'application/json' };
        if(llmSettings.key) headers['Authorization'] = `Bearer ${llmSettings.key}`;
        const response = await CapacitorHttp.post({ url: `${baseUrl}/v1/chat/completions`, headers: headers, data: payload });
        if(response.status >= 400) throw new Error(`HTTP ${response.status}`);
        const data = response.data;
        let result = "";
        if(data.choices && data.choices[0] && data.choices[0].message) { result = data.choices[0].message.content; } else if (data.response) { result = data.response; }
        document.getElementById('llmOutput').value = result;
        llmState[activeLlmMode].output = result;
        updateLlmButtonState();
        if(Toast) Toast.show({ text: 'Prompt Generated!', duration: 'short' });
    } catch(e) { alert("Generation failed: " + (e.message || JSON.stringify(e))); } finally { btn.disabled = false; updateLlmButtonState(); }
}

window.useLlmPrompt = function() {
    const result = document.getElementById('llmOutput').value;
    if(!result) return alert("Generate a prompt first!");
    const targetId = activeLlmMode === 'xl' ? 'xl_prompt' : 'flux_prompt';
    document.getElementById(targetId).value = result;
    closeLlmModal();
    if(Toast) Toast.show({ text: 'Applied to main prompt!', duration: 'short' });
}

// --- CORE JOB BUILDER ---
function buildJobFromUI() {
    const mode = currentMode; 
    const targetModelTitle = mode === 'xl' ? document.getElementById('xl_modelSelect').value : document.getElementById('flux_modelSelect').value;
    if(!targetModelTitle || targetModelTitle === "Link first...") return null;

    let payload = {};
    let overrides = {};
    overrides["forge_inference_memory"] = getVramMapping();
    overrides["forge_unet_storage_dtype"] = "Automatic (fp16 LoRA)";
    let prompt = "";
    
    if(mode === 'xl') {
        overrides["forge_additional_modules"] = [];
        overrides["sd_vae"] = "Automatic";
        prompt = document.getElementById('xl_prompt').value;
        payload = {
            "prompt": prompt, "negative_prompt": document.getElementById('xl_neg').value,
            "steps": parseInt(document.getElementById('xl_steps').value), "cfg_scale": parseFloat(document.getElementById('xl_cfg').value),
            "width": parseInt(document.getElementById('xl_width').value), "height": parseInt(document.getElementById('xl_height').value),
            "batch_size": parseInt(document.getElementById('xl_batch_size').value), "n_iter": parseInt(document.getElementById('xl_batch_count').value),
            "sampler_name": document.getElementById('xl_sampler').value, "scheduler": document.getElementById('xl_scheduler').value,
            "seed": parseInt(document.getElementById('xl_seed').value), "save_images": true, "override_settings": overrides
        };
    } else {
        const modulesList = [document.getElementById('flux_vae').value, document.getElementById('flux_clip').value, document.getElementById('flux_t5').value].filter(v => v && v !== "Automatic");
        if (modulesList.length > 0) overrides["forge_additional_modules"] = modulesList;
        const bits = document.getElementById('flux_bits').value;
        if(bits) overrides["forge_unet_storage_dtype"] = bits;
        const distCfg = parseFloat(document.getElementById('flux_distilled').value);
        prompt = document.getElementById('flux_prompt').value;
        payload = {
            "prompt": prompt, "negative_prompt": "",
            "steps": parseInt(document.getElementById('flux_steps').value), "cfg_scale": parseFloat(document.getElementById('flux_cfg').value),
            "distilled_cfg_scale": isNaN(distCfg) ? 3.5 : distCfg, 
            "width": parseInt(document.getElementById('flux_width').value), "height": parseInt(document.getElementById('flux_height').value),
            "batch_size": parseInt(document.getElementById('flux_batch_size').value), "n_iter": parseInt(document.getElementById('flux_batch_count').value),
            "sampler_name": document.getElementById('flux_sampler').value, "scheduler": document.getElementById('flux_scheduler').value,
            "seed": parseInt(document.getElementById('flux_seed').value), "save_images": true, "override_settings": overrides 
        };
    }
    return { mode: mode, modelTitle: targetModelTitle, payload: payload, desc: `${prompt.substring(0, 30)}...` };
}

// --- QUEUE MANAGEMENT ---
window.addToQueue = function() {
    const job = buildJobFromUI();
    if(!job) return alert("Please select a model first.");
    jobQueue.push(job);
    renderQueue();
    const badge = document.getElementById('queueBadge');
    badge.style.transform = "scale(1.5)"; setTimeout(() => badge.style.transform = "scale(1)", 200);
}

window.removeFromQueue = function(index) { jobQueue.splice(index, 1); renderQueue(); }
window.clearQueue = function() { jobQueue = []; renderQueue(); }

function renderQueue() {
    const list = document.getElementById('queueListContainer');
    const badge = document.getElementById('queueBadge');
    badge.innerText = jobQueue.length;
    badge.classList.toggle('hidden', jobQueue.length === 0);
    list.innerHTML = "";
    if(jobQueue.length === 0) { list.innerHTML = "<div style='text-align:center;color:var(--text-muted);margin-top:50px;'>Queue Empty</div>"; return; }
    jobQueue.forEach((job, index) => {
        const item = document.createElement('div'); item.className = 'queue-item';
        item.innerHTML = `
            <div class="queue-info"><div class="q-title">Mode: ${job.mode.toUpperCase()}</div><div class="q-sub">${job.desc}</div></div>
            <button onclick="removeFromQueue(${index})" class="btn-icon" style="width:24px;height:24px;color:#f44336;border-color:transparent;"><i data-lucide="x" size="14"></i></button>
        `;
        list.appendChild(item);
    });
    lucide.createIcons();
}

// --- BATCH PROCESSOR ---
window.processQueue = async function() {
    if(isQueueRunning) return;
    if(jobQueue.length === 0) return alert("Queue is empty!");
    
    isQueueRunning = true;
    totalBatchSteps = jobQueue.reduce((acc, job) => acc + ((job.payload.n_iter || 1) * job.payload.steps), 0);
    currentBatchProgress = 0;
    
    document.getElementById('queueProgressBox').classList.remove('hidden');
    const btn = document.getElementById('startQueueBtn');
    const oldText = btn.innerText;
    btn.innerText = "RUNNING...";
    btn.disabled = true;

    if(document.hidden) updateBatchNotification("Starting batch job...", true, `0 / ${totalBatchSteps} steps`);

    while(jobQueue.length > 0) {
        const job = jobQueue[0]; renderQueue(); 
        try { 
            await runJob(job, true); 
            jobQueue.shift(); 
        } catch(e) { 
            console.error(e); 
            updateBatchNotification("Batch Paused", true, "Error occurred");
            alert("Batch paused: " + e.message); 
            break; 
        }
        renderQueue();
    }
    isQueueRunning = false;
    btn.innerText = oldText; btn.disabled = false;
    document.getElementById('queueProgressBox').classList.add('hidden');
    
    // UPDATED: Post "Generation Complete" notification before stopping service
    await updateBatchNotification("Batch Complete!", true, "All images generated.");
    
    // Slight delay to ensure notification is seen before service kill
    setTimeout(async () => {
        if (ResolverService) {
            try { await ResolverService.stop(); } catch(e){}
        }
    }, 2000); 
    
    if(jobQueue.length === 0) alert("Batch Complete!");
}

window.generate = async function() {
    const job = buildJobFromUI();
    if(!job) return alert("Please select a model first.");
    isSingleJobRunning = true; 
    await runJob(job, false);
    isSingleJobRunning = false;
    
    await updateBatchNotification("Generation Complete!", true, "Image Ready");

    setTimeout(async () => {
        if (ResolverService) {
            try { await ResolverService.stop(); } catch(e){}
        }
    }, 2000);
}

window.clearGenResults = function() {
    document.getElementById('gallery').innerHTML = '';
}

// --- EXECUTION ENGINE ---
async function runJob(job, isBatch = false) {
    const btn = document.getElementById('genBtn'); 
    const spinner = document.getElementById('loadingSpinner');
    btn.disabled = true;
    spinner.style.display = 'block';

    try {
        let isReady = false; let attempts = 0;
        while (!isReady && attempts < 40) { 
            const optsReq = await fetch(`${HOST}/sdapi/v1/options`, { headers: getHeaders() });
            const opts = await optsReq.json();
            if (normalize(opts.sd_model_checkpoint) === normalize(job.modelTitle)) { isReady = true; break; }
            if (attempts % 5 === 0) { 
                btn.innerText = `ALIGNING... (${attempts})`;
                await postOption({ "sd_model_checkpoint": job.modelTitle, "forge_unet_storage_dtype": "Automatic (fp16 LoRA)" });
            }
            attempts++; await new Promise(r => setTimeout(r, 1500));
        }
        if (!isReady) throw new Error("Timeout: Server failed to load model.");

        btn.innerText = "PROCESSING...";
        
        await updateBatchNotification("Starting Generation", true, "Initializing...");

        const jobTotalSteps = (job.payload.n_iter || 1) * job.payload.steps;

        const progressInterval = setInterval(async () => {
            try {
                const res = await fetch(`${HOST}/sdapi/v1/progress`, { headers: getHeaders() });
                const data = await res.json();
                if (data.state && data.state.sampling_steps > 0) {
                    const currentJobIndex = data.state.job_no || 0; 
                    const currentStepInBatch = data.state.sampling_step;
                    const jobStep = (currentJobIndex * job.payload.steps) + currentStepInBatch;
                    btn.innerText = `Step ${jobStep}/${jobTotalSteps}`;
                    
                    const msg = `Step ${jobStep} / ${jobTotalSteps}`;
                    
                    if(isBatch) {
                        const actualTotal = currentBatchProgress + jobStep;
                        document.getElementById('queueProgressText').innerText = `Step ${actualTotal} / ${totalBatchSteps}`;
                        updateBatchNotification("Batch Running", false, `Step ${actualTotal} / ${totalBatchSteps}`);
                    } else {
                        updateBatchNotification("Generating...", false, msg);
                    }
                }
            } catch(e) {}
        }, 500);

        const res = await fetch(`${HOST}/sdapi/v1/txt2img`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(job.payload) });
        clearInterval(progressInterval); 
        if(!res.ok) throw new Error("Server Error " + res.status);
        
        const data = await res.json();
        if(isBatch) currentBatchProgress += jobTotalSteps;

        if(data.images) {
            for (let i = 0; i < data.images.length; i++) {
                const b64 = data.images[i];
                const finalB64 = "data:image/png;base64," + b64;
                const newId = await saveImageToDB(finalB64);
                
                const img = document.createElement('img');
                img.src = finalB64; 
                img.className = 'gen-result'; 
                img.loading = "lazy";
                img.onclick = () => window.openFullscreen([finalB64], 0, img, newId);
                
                const gal = document.getElementById('gallery');
                if(gal.firstChild) gal.insertBefore(img, gal.firstChild); else gal.appendChild(img);

                const autoDl = document.getElementById('autoDlCheck');
                if(autoDl && autoDl.checked) saveToMobileGallery(finalB64);
            }
        }
    } catch(e) { throw e; } finally {
        spinner.style.display = 'none'; btn.disabled = false; btn.innerText = currentMode === 'xl' ? "GENERATE" : "QUANTUM GENERATE";
    }
}

// --- GALLERY LOGIC (WITH PAGINATION) ---
function loadGallery() {
    const grid = document.getElementById('savedGalleryGrid'); grid.innerHTML = "";
    if(!db) return;
    db.transaction(["images"], "readonly").objectStore("images").getAll().onsuccess = e => {
        const imgs = e.target.result;
        if(!imgs || imgs.length === 0) { grid.innerHTML = "<div style='text-align:center;color:#777;margin-top:20px;grid-column:1/-1;'>No images</div>"; return; }
        
        const reversed = imgs.reverse();
        const totalPages = Math.ceil(reversed.length / ITEMS_PER_PAGE);
        if (galleryPage < 1) galleryPage = 1;
        if (galleryPage > totalPages) galleryPage = totalPages;
        
        const start = (galleryPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        const pageItems = reversed.slice(start, end);
        
        historyImagesData = pageItems;
        
        pageItems.forEach((item, index) => {
            const container = document.createElement('div');
            container.style.position = 'relative';

            const img = document.createElement('img'); 
            img.src = item.data; 
            img.className = 'gal-thumb'; 
            img.loading = 'lazy'; 
            
            img.onclick = () => {
                if(isSelectionMode) toggleSelectionForId(item.id, container);
                else window.openFullscreenFromGallery(index); 
            };

            const tick = document.createElement('div');
            tick.className = 'gal-tick hidden';
            tick.innerHTML = '<i data-lucide="check-circle" size="24" color="#00e676" fill="black"></i>';
            tick.style.position = 'absolute'; tick.style.top = '5px'; tick.style.right = '5px';

            container.appendChild(img);
            container.appendChild(tick);
            container.dataset.id = item.id;
            grid.appendChild(container);
        });
        
        document.getElementById('pageIndicator').innerText = `Page ${galleryPage} / ${totalPages}`;
        document.getElementById('prevPageBtn').disabled = galleryPage === 1;
        document.getElementById('nextPageBtn').disabled = galleryPage === totalPages;
        lucide.createIcons();
    }
}

window.changeGalleryPage = function(dir) {
    galleryPage += dir;
    loadGallery();
}

window.toggleGallerySelectionMode = function() {
    isSelectionMode = !isSelectionMode;
    const btn = document.getElementById('galSelectBtn');
    const delBtn = document.getElementById('galDeleteBtn');
    
    if(isSelectionMode) {
        btn.style.background = "var(--accent-primary)"; btn.style.color = "white";
        delBtn.classList.remove('hidden');
    } else {
        btn.style.background = "var(--input-bg)"; btn.style.color = "var(--text-main)";
        delBtn.classList.add('hidden');
        selectedImageIds.clear();
        document.querySelectorAll('.gal-tick').forEach(t => t.classList.add('hidden'));
        updateDeleteBtn();
    }
}

function toggleSelectionForId(id, container) {
    const tick = container.querySelector('.gal-tick');
    if(selectedImageIds.has(id)) {
        selectedImageIds.delete(id);
        tick.classList.add('hidden');
    } else {
        selectedImageIds.add(id);
        tick.classList.remove('hidden');
    }
    updateDeleteBtn();
}

function updateDeleteBtn() {
    document.getElementById('galDeleteBtn').innerText = `DELETE (${selectedImageIds.size})`;
}

window.deleteSelectedImages = function() {
    if(selectedImageIds.size === 0) return;
    if(!confirm(`Delete ${selectedImageIds.size} images?`)) return;
    
    const tx = db.transaction(["images"], "readwrite");
    const store = tx.objectStore("images");
    selectedImageIds.forEach(id => store.delete(id));
    
    tx.oncomplete = () => {
        selectedImageIds.clear();
        isSelectionMode = false; 
        document.getElementById('galSelectBtn').style.background = "var(--input-bg)";
        document.getElementById('galDeleteBtn').classList.add('hidden');
        loadGallery();
    };
}

// --- LIGHTBOX LOGIC ---
window.openFullscreenFromGallery = function(index) {
    currentGalleryImages = [...historyImagesData]; 
    currentGalleryIndex = index;
    updateLightboxImage();
    document.getElementById('fullScreenModal').classList.remove('hidden');
}

window.openFullscreen = function(imagesArray, index, domElement = null, dbId = null) {
    currentGalleryImages = imagesArray.map(b64 => ({ 
        id: dbId, 
        data: b64, 
        domElement: domElement 
    })); 
    currentGalleryIndex = index;
    updateLightboxImage();
    document.getElementById('fullScreenModal').classList.remove('hidden');
}

function updateLightboxImage() {
    if(currentGalleryImages.length > 0 && currentGalleryImages[currentGalleryIndex]) {
        document.getElementById('fsImage').src = currentGalleryImages[currentGalleryIndex].data;
    }
}

window.slideImage = function(dir) {
    if(currentGalleryImages.length === 0) return;
    currentGalleryIndex += dir;
    if(currentGalleryIndex < 0) currentGalleryIndex = currentGalleryImages.length - 1;
    if(currentGalleryIndex >= currentGalleryImages.length) currentGalleryIndex = 0;
    updateLightboxImage();
}

window.deleteCurrentFsImage = function() {
    const currentItem = currentGalleryImages[currentGalleryIndex];
    if(!currentItem) return;

    if(confirm("Delete this image?")) {
        if(currentItem.id) {
            const tx = db.transaction(["images"], "readwrite");
            tx.objectStore("images").delete(currentItem.id);
            tx.oncomplete = () => {
                currentGalleryImages.splice(currentGalleryIndex, 1);
                finishDeleteAction(currentItem);
            };
        } else {
            currentGalleryImages.splice(currentGalleryIndex, 1);
            finishDeleteAction(currentItem);
        }
    }
}

function finishDeleteAction(item) {
    if(item.domElement) item.domElement.remove();
    if(currentGalleryImages.length === 0) {
        window.closeFsModal();
        loadGallery();
    } else {
        if(currentGalleryIndex >= currentGalleryImages.length) currentGalleryIndex--;
        updateLightboxImage();
        loadGallery(); 
    }
}

window.downloadCurrent = function() {
    const src = document.getElementById('fsImage').src;
    saveToMobileGallery(src);
}
window.closeFsModal = () => document.getElementById('fullScreenModal').classList.add('hidden');

function gcd(a, b) { return b ? gcd(b, a % b) : a; }
window.analyzeCurrentFs = () => { window.closeFsModal(); window.switchTab('ana'); fetch(document.getElementById('fsImage').src).then(res => res.blob()).then(processImageForAnalysis); }
window.handleFileSelect = e => { const file = e.target.files[0]; if(!file) return; processImageForAnalysis(file); }

// --- ANALYZER + COPY LOGIC ---
async function processImageForAnalysis(blob) {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
        const w = img.width; const h = img.height; const d = gcd(w, h);
        document.getElementById('resOut').innerText = `${w} x ${h}`;
        document.getElementById('arOut').innerText = `${w/d}:${h/d}`;
        document.getElementById('anaPreview').src = url;
        document.getElementById('anaGallery').classList.remove('hidden');
    };
    img.src = url;
    
    // Parse metadata
    const text = await readPngMetadata(blob);
    document.getElementById('anaMeta').innerText = text || "No parameters found.";
    
    const btnContainer = document.getElementById('anaCopyButtons');
    if (text) {
        currentAnalyzedPrompts = parseGenInfo(text);
        if(btnContainer) btnContainer.classList.remove('hidden');
    } else {
        currentAnalyzedPrompts = null;
        if(btnContainer) btnContainer.classList.add('hidden');
    }
}

function parseGenInfo(rawText) {
    if (!rawText) return { pos: "", neg: "" };
    let pos = "";
    let neg = "";

    const negSplit = rawText.split("Negative prompt:");
    if (negSplit.length > 1) {
        pos = negSplit[0].trim();
        const paramsSplit = negSplit[1].split(/(\nSteps: |Steps: )/);
        if (paramsSplit.length > 1) {
            neg = paramsSplit[0].trim();
        } else {
            neg = negSplit[1].trim();
        }
    } else {
        const paramSplit = rawText.split(/(\nSteps: |Steps: )/);
        if (paramSplit.length > 1) {
            pos = paramSplit[0].trim();
        } else {
             pos = rawText.trim();
        }
    }
    return { pos, neg };
}

window.copyToSdxl = function() {
    if (!currentAnalyzedPrompts) return;
    document.getElementById('xl_prompt').value = currentAnalyzedPrompts.pos;
    document.getElementById('xl_neg').value = currentAnalyzedPrompts.neg;
    window.setMode('xl');
    window.switchTab('gen');
    if(Toast) Toast.show({ text: 'Copied to SDXL', duration: 'short' });
}

window.copyToFlux = function() {
    if (!currentAnalyzedPrompts) return;
    document.getElementById('flux_prompt').value = currentAnalyzedPrompts.pos;
    window.setMode('flux');
    window.switchTab('gen');
    if(Toast) Toast.show({ text: 'Copied to FLUX', duration: 'short' });
}

function loadAutoDlState() { const c = document.getElementById('autoDlCheck'); if(c) c.checked = localStorage.getItem('bojroAutoSave') === 'true'; }
window.saveAutoDlState = () => localStorage.setItem('bojroAutoSave', document.getElementById('autoDlCheck').checked);

// --- PNG METADATA READER ---
async function readPngMetadata(blob) {
    try {
        const buffer = await blob.arrayBuffer();
        const view = new DataView(buffer);
        let offset = 8; 

        let metadata = "";

        while (offset < view.byteLength) {
            const length = view.getUint32(offset);
            const type = String.fromCharCode(
                view.getUint8(offset + 4),
                view.getUint8(offset + 5),
                view.getUint8(offset + 6),
                view.getUint8(offset + 7)
            );

            if (type === 'tEXt') {
                const data = new Uint8Array(buffer, offset + 8, length);
                metadata += new TextDecoder().decode(data) + "\n";
            }

            if (type === 'iTXt') {
                const data = new Uint8Array(buffer, offset + 8, length);
                const text = new TextDecoder().decode(data);
                metadata += text + "\n";
            }

            offset += 12 + length; 
        }
        metadata = metadata.trim();
        if (!metadata) return null;
        metadata = metadata.replace(/^parameters\0/, '');

        return metadata;
    } catch (e) {
        console.error("Metadata read error:", e);
        return null;
    }
}
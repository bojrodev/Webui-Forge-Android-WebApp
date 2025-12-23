// -----------------------------------------------------------
// UI INTERACTION & SETTINGS
// -----------------------------------------------------------

// Default Prompts Configuration
const DEFAULT_PROMPTS = {
    'xl': "1girl, hand fan, solo, black hair, long hair, jewelry, earrings, holding, chinese clothes, hair ornament, holding fan, red nails, looking at viewer, upper body, long sleeves, red lips, folding fan, smoke, hanfu, nail polish, masterpiece, best quality",
    'flux': "textured chalk pastel for subtle highlights, delicate charcoal shading for depth and contrast, warm, earthy color palette with ambient lighting casting soft shadows, A young woman with expressive, natural eyes and a gentle smile, soft oil brushwork adding warmth and depth to her skin, her small cat sitting calmly beside her, cozy and slightly messy living room in the background with books scattered, a warm throw blanket casually draped over the couch, city lights visible through a large window showing the urban landscape at night,",
    'qwen': "a man wearing sun glasses as captain of the guards stands in full regalia, exuding authority and experience. His striking eyes command attention, contrasting with his chestnut curly hair. The bear crest on his armor symbolizes his strength and loyalty. This vivid portrayal, whether a painting or photograph, captures the essence of a formidable and respected knight in exquisite detail and quality",
    'inp': "original"
};

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

window.switchTab = function(view) {
    document.querySelectorAll('[id^="view-"]').forEach(v => v.classList.add('hidden'));
    document.getElementById('view-' + view).classList.remove('hidden');
    const items = document.querySelectorAll('.dock-item');
    items.forEach(item => item.classList.remove('active'));
    if (view === 'gen') {
        items[0].classList.add('active');
        currentTask = 'txt';
    }
    if (view === 'inp') {
        items[1].classList.add('active');
        currentTask = 'inp';
        
        // --- FIX: ENFORCE INPAINT SAMPLER DEFAULT ---
        const inpSamplerEl = document.getElementById('inp_sampler');
        const savedSampler = localStorage.getItem('bojro_inp_sampler');
        
        if (savedSampler) {
            // Restore saved user preference
            if (inpSamplerEl.value !== savedSampler) {
                const optionExists = Array.from(inpSamplerEl.options).some(o => o.value === savedSampler);
                if (optionExists) inpSamplerEl.value = savedSampler;
            }
        } else {
            // No save found -> Enforce Default: DPM++ 2M SDE
            const targetDefault = "DPM++ 2M SDE";
            const optionExists = Array.from(inpSamplerEl.options).some(o => o.value === targetDefault);
            if (optionExists && inpSamplerEl.value !== targetDefault) {
                inpSamplerEl.value = targetDefault;
                localStorage.setItem('bojro_inp_sampler', targetDefault); // Save it as new default
            }
        }
    }
    if (view === 'que') {
        items[2].classList.add('active');
        // If renderQueueAll exists (engine.js), call it
        if (typeof renderQueueAll === 'function') renderQueueAll();
    }
    if (view === 'gal') {
        items[3].classList.add('active');
        if (typeof loadGallery === 'function') loadGallery();
    }
    if (view === 'ana') items[4].classList.add('active');
}

window.setMode = async function(mode) {
    // FIX 2: Universal VRAM Unload on Mode Switch (Restored behavior)
    if (currentMode !== mode) {
        if (HOST) {
            await unloadModel(true);
        }
    }

    currentMode = mode;
    const root = document.documentElement;
    const btnXL = document.getElementById('btn-xl');
    const btnFlux = document.getElementById('btn-flux');
    // --- NEO HOOK: QWEN BTN ---
    const btnQwen = document.getElementById('btn-qwen');

    const xlRow = document.getElementById('row-xl-model');
    const fluxRow = document.getElementById('row-flux-model');
    // --- NEO HOOK: QWEN ROW ---
    const qwenRow = document.getElementById('row-qwen-model');

    const xlCont = document.getElementById('mode-xl-container');
    const fluxCont = document.getElementById('mode-flux-container');
    // --- NEO HOOK: QWEN CONT ---
    const qwenCont = document.getElementById('mode-qwen-container');

    // Reset all
    btnXL.classList.remove('active');
    btnFlux.classList.remove('active');
    if (btnQwen) btnQwen.classList.remove('active');

    xlRow.classList.add('hidden');
    fluxRow.classList.add('hidden');
    if (qwenRow) qwenRow.classList.add('hidden');

    xlCont.classList.add('hidden');
    fluxCont.classList.add('hidden');
    if (qwenCont) qwenCont.classList.add('hidden');

    if (mode === 'flux') {
        root.setAttribute('data-mode', 'flux');
        btnFlux.classList.add('active');
        fluxRow.classList.remove('hidden');
        fluxCont.classList.remove('hidden');
        document.getElementById('genBtn').innerText = "QUANTUM GENERATE";
        document.getElementById('appTitle').innerText = "BOJRO FLUX";
    } else if (mode === 'qwen') {
        // --- NEO HOOK: QWEN LOGIC ---
        root.setAttribute('data-mode', 'qwen');
        if (btnQwen) btnQwen.classList.add('active');
        if (qwenRow) qwenRow.classList.remove('hidden');
        if (qwenCont) qwenCont.classList.remove('hidden');
        document.getElementById('genBtn').innerText = "TURBO GENERATE";
        document.getElementById('appTitle').innerText = "BOJRO NEO";
    } else {
        root.removeAttribute('data-mode');
        btnXL.classList.add('active');
        xlRow.classList.remove('hidden');
        xlCont.classList.remove('hidden');
        document.getElementById('genBtn').innerText = "GENERATE";
        document.getElementById('appTitle').innerText = "BOJRO RESOLVER";
    }
}

// --- FORM HELPERS ---

window.saveSelection = function(key) {
    if (key === 'xl') localStorage.setItem('bojroModel_xl', document.getElementById('xl_modelSelect').value);
    else if (key === 'flux') localStorage.setItem('bojroModel_flux', document.getElementById('flux_modelSelect').value);
    else if (key === 'inp') localStorage.setItem('bojroModel_inp', document.getElementById('inp_modelSelect').value);
    else if (key === 'flux_bits') localStorage.setItem('bojro_flux_bits', document.getElementById('flux_bits').value);
    else if (key === 'inp_content') localStorage.setItem('bojro_inp_content', document.getElementById('inp_content').value);
    else if (key === 'inp_padding') localStorage.setItem('bojro_inp_padding', document.getElementById('inp_padding').value);
    else if (key === 'inp_sampler') localStorage.setItem('bojro_inp_sampler', document.getElementById('inp_sampler').value);
    // --- NEO HOOK: SAVE QWEN ---
    else if (key === 'qwen') localStorage.setItem('bojroModel_qwen', document.getElementById('qwen_modelSelect').value);
    else if (key === 'qwen_bits') localStorage.setItem('bojro_qwen_bits', document.getElementById('qwen_bits').value);
}

// --- PROMPT SAVING SYSTEM ---

window.savePrompt = function(mode) {
    const el = document.getElementById(`${mode}_prompt`);
    if (el) {
        localStorage.setItem(`bojro_prompt_${mode}`, el.value);
    }
}

window.resetPrompt = function(mode) {
    if (confirm("Reset prompt to default?")) {
        const el = document.getElementById(`${mode}_prompt`);
        if (el) {
            el.value = DEFAULT_PROMPTS[mode] || "";
            savePrompt(mode); // Save the reset state immediately
        }
    }
}

window.loadSavedPrompts = function() {
    ['xl', 'flux', 'qwen', 'inp'].forEach(mode => {
        const saved = localStorage.getItem(`bojro_prompt_${mode}`);
        const el = document.getElementById(`${mode}_prompt`);
        if (el && saved !== null) {
            el.value = saved;
        }
    });
}

window.saveTrident = function() {
    ['flux_vae', 'flux_clip', 'flux_t5'].forEach(id => localStorage.setItem('bojro_' + id, document.getElementById(id).value));
}

window.setRes = (mode, w, h) => {
    document.getElementById(`${mode}_width`).value = w;
    document.getElementById(`${mode}_height`).value = h;
}
window.flipRes = (mode) => {
    const w = document.getElementById(`${mode}_width`);
    const h = document.getElementById(`${mode}_height`);
    const t = w.value;
    w.value = h.value;
    h.value = t;
}

function loadAutoDlState() {
    const c = document.getElementById('autoDlCheck');
    if (c) c.checked = localStorage.getItem('bojroAutoSave') === 'true';
}
window.saveAutoDlState = () => localStorage.setItem('bojroAutoSave', document.getElementById('autoDlCheck').checked);

// --- CONFIG MODALS (LoRA & POWER) ---

function injectConfigModal() {
    if (document.getElementById('loraConfigModal')) return;
    const div = document.createElement('div');
    div.id = 'loraConfigModal';
    div.className = 'modal hidden';
    div.innerHTML = `
        <div class="modal-content" style="max-height: 60vh;">
            <div class="modal-header">
                <h3 id="cfgLoraTitle" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:80%;">Config</h3>
                <button class="close-btn" onclick="closeConfigModal()">×</button>
            </div>
            <div class="col" style="gap: 15px; padding: 10px 0;">
                <div>
                    <label style="display:flex; justify-content:space-between;">
                        <span>Preferred Weight</span>
                        <span id="cfgWeightDisplay" style="color:var(--accent-primary);">1.0</span>
                    </label>
                    <input type="range" id="cfgWeight" class="orange-slider" min="-2" max="2" step="0.1" value="1" oninput="updateWeightDisplay(this.value)" style="margin-top:5px;">
                </div>
                <div>
                    <label>Activation / Trigger Text</label>
                    <textarea id="cfgTrigger" rows="3" placeholder="trigger, words, here" style="margin-top:5px;"></textarea>
                </div>
                <button id="cfgSaveBtn" class="btn-small" style="background: var(--accent-gradient); color: white; margin-top:10px;">SAVE CONFIG</button>
            </div>
        </div>
    `;
    document.body.appendChild(div);
}

window.openLoraSettings = async (e, loraName, loraPath) => {
    e.stopPropagation();
    const modal = document.getElementById('loraConfigModal');
    modal.classList.remove('hidden');
    document.getElementById('cfgLoraTitle').innerText = "Loading...";

    let cfg = loraConfigs[loraName];
    if (!cfg) cfg = await loadSidecarConfig(loraName, loraPath);

    document.getElementById('cfgLoraTitle').innerText = loraName;
    document.getElementById('cfgWeight').value = cfg.weight;
    document.getElementById('cfgWeightDisplay').innerText = cfg.weight;
    document.getElementById('cfgTrigger').value = cfg.trigger;

    document.getElementById('cfgSaveBtn').onclick = () => {
        const newWeight = document.getElementById('cfgWeight').value;
        const newTrigger = document.getElementById('cfgTrigger').value;
        loraConfigs[loraName] = {
            weight: parseFloat(newWeight),
            trigger: newTrigger
        };
        localStorage.setItem('bojroLoraConfigs', JSON.stringify(loraConfigs));
        modal.classList.add('hidden');
        if (Toast) Toast.show({
            text: 'Saved',
            duration: 'short'
        });
    };
}

window.closeConfigModal = () => document.getElementById('loraConfigModal').classList.add('hidden');
window.updateWeightDisplay = (val) => document.getElementById('cfgWeightDisplay').innerText = val;

// --- POWER SETTINGS ---

function loadPowerSettings() {
    const savedIP = localStorage.getItem('bojro_power_ip');
    if (savedIP) {
        document.getElementById('power-server-ip').value = savedIP;
    }
}

window.togglePowerSettings = function() {
    const modal = document.getElementById('powerSettingsModal');
    modal.classList.toggle('hidden');
}

window.savePowerSettings = function() {
    const ipInput = document.getElementById('power-server-ip').value.trim();

    if (ipInput) {
        // Ensure protocol exists (http://)
        let formattedIP = ipInput;
        if (!formattedIP.startsWith('http')) {
            formattedIP = 'http://' + formattedIP;
        }

        // Remove trailing slash if present
        if (formattedIP.endsWith('/')) {
            formattedIP = formattedIP.slice(0, -1);
        }

        localStorage.setItem('bojro_power_ip', formattedIP);
        togglePowerSettings();
        if (Toast) Toast.show({
            text: 'Power Config Saved',
            duration: 'short'
        });
    } else {
        alert("Please enter a valid IP address.");
    }
}

// --- LLM MODALS ---

window.openLlmModal = (mode) => {
    activeLlmMode = mode;
    document.getElementById('llmModal').classList.remove('hidden');
    
    const inputEl = document.getElementById('llmInput');
    const outputEl = document.getElementById('llmOutput');
    const persistentCheck = document.getElementById('llmPersistentCheck');
    const resetBtn = document.getElementById('llmResetBtn');

    // Restore mode-specific state
    inputEl.value = llmState[mode].input;
    outputEl.value = llmState[mode].output;
    persistentCheck.checked = llmState[mode].persistent;
    
    // UI Logic: Show reset only if persistent is ON
    if (llmState[mode].persistent) resetBtn.classList.remove('hidden');
    else resetBtn.classList.add('hidden');

    let savedSys = llmSettings.system_xl;
    if (activeLlmMode === 'flux') savedSys = llmSettings.system_flux;
    else if (activeLlmMode === 'qwen') savedSys = llmSettings.system_qwen;
    document.getElementById('llmSystemPrompt').value = savedSys || "";
    
    updateLlmButtonState();
    if (!inputEl.value) inputEl.focus();
    
    // Refresh icons in modal (Reset button uses refresh-cw)
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.closeLlmModal = () => document.getElementById('llmModal').classList.add('hidden');
window.toggleLlmSettings = () => document.getElementById('llmSettingsBox').classList.toggle('hidden');
window.updateLlmState = function() {
    llmState[activeLlmMode].input = document.getElementById('llmInput').value;
}

// NEW: Toggle Logic
window.toggleLlmPersistent = function() {
    const isChecked = document.getElementById('llmPersistentCheck').checked;
    llmState[activeLlmMode].persistent = isChecked;
    
    const resetBtn = document.getElementById('llmResetBtn');
    if (isChecked) {
        resetBtn.classList.remove('hidden');
    } else {
        resetBtn.classList.add('hidden');
        // Optional: Clear history when switching off to free memory
        llmState[activeLlmMode].history = []; 
    }
}

// NEW: Reset Logic (Clear current mode's history array)
window.resetLlmHistory = function() {
    if (confirm("Reset current chat history? All previous context for this mode will be deleted.")) {
        llmState[activeLlmMode].history = [];
        if (Toast) Toast.show({ text: 'Context Reset', duration: 'short' });
    }
}

function updateLlmButtonState() {
    const hasOutput = llmState[activeLlmMode].output.trim().length > 0;
    const isPersistent = llmState[activeLlmMode].persistent;
    // Iterate sounds better for persistent chat
    document.getElementById('llmGenerateBtn').innerText = (isPersistent && hasOutput) ? "ITERATE" : "GENERATE PROMPT";
}

function loadLlmSettings() {
    const s = localStorage.getItem('bojroLlmConfig');
    if (s) {
        const loaded = JSON.parse(s);
        llmSettings = { ...llmSettings,
            ...loaded
        };
        document.getElementById('llmApiBase').value = llmSettings.baseUrl || '';
        document.getElementById('llmApiKey').value = llmSettings.key || '';
        if (llmSettings.model) {
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
    if (activeLlmMode === 'xl') llmSettings.system_xl = sysVal;
    else if (activeLlmMode === 'flux') llmSettings.system_flux = sysVal;
    else if (activeLlmMode === 'qwen') llmSettings.system_qwen = sysVal;
    localStorage.setItem('bojroLlmConfig', JSON.stringify(llmSettings));
    if (Toast) Toast.show({
        text: 'Settings & Model Saved',
        duration: 'short'
    });
}

window.useLlmPrompt = function() {
    const result = document.getElementById('llmOutput').value;
    if (!result) return alert("Generate a prompt first!");

    // --- NEO HOOK: TARGET QWEN PROMPT ---
    let targetId;
    if (activeLlmMode === 'xl') targetId = 'xl_prompt';
    else if (activeLlmMode === 'flux') targetId = 'flux_prompt';
    else if (activeLlmMode === 'qwen') targetId = 'qwen_prompt';

    document.getElementById(targetId).value = result;
    closeLlmModal();
    if (Toast) Toast.show({
        text: 'Applied to main prompt!',
        duration: 'short'
    });
}
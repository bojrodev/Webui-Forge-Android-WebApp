// -----------------------------------------------------------
// NETWORK & API COMMUNICATION
// -----------------------------------------------------------

function loadHostIp() {
    const ip = localStorage.getItem('bojroHostIp');
    if (ip) document.getElementById('hostIp').value = ip;
}

window.connect = async function(silent = false) {
    HOST = document.getElementById('hostIp').value.replace(/\/$/, "");
    const dot = document.getElementById('statusDot');
    if (!silent) dot.style.background = "yellow";

    try {
        if (LocalNotifications && !silent) {
            const perm = await LocalNotifications.requestPermissions();
            if (perm.display === 'granted') await createNotificationChannel();
        }

        const res = await fetch(`${HOST}/sdapi/v1/sd-models`, {
            headers: getHeaders()
        });
        if (!res.ok) throw new Error("Status " + res.status);

        dot.style.background = "#00e676";
        dot.classList.add('on');
        localStorage.setItem('bojroHostIp', HOST);
        document.getElementById('genBtn').disabled = false;

        // MODIFIED: Fetch everything EXCEPT LoRAs (Lazy load them)
        // fetchLoras();  <-- Commented out to prevent startup freeze
        await Promise.all([fetchModels(), fetchSamplers(), fetchVaes()]);

        if (!silent)
            if (Toast) Toast.show({
                text: 'Server Linked Successfully',
                duration: 'short',
                position: 'center'
            });
    } catch (e) {
        dot.style.background = "#f44336";
        if (!silent) alert("Failed: " + e.message);
    }
}

async function fetchModels() {
    try {
        const res = await fetch(`${HOST}/sdapi/v1/sd-models`, {
            headers: getHeaders()
        });
        const data = await res.json();
        const selXL = document.getElementById('xl_modelSelect');
        selXL.innerHTML = "";
        const selFlux = document.getElementById('flux_modelSelect');
        selFlux.innerHTML = "";
        const selInp = document.getElementById('inp_modelSelect');
        selInp.innerHTML = "";
        data.forEach(m => {
            selXL.appendChild(new Option(m.model_name, m.title));
            selFlux.appendChild(new Option(m.model_name, m.title));
            selInp.appendChild(new Option(m.model_name, m.title));
        });
        ['xl', 'flux', 'inp'].forEach(mode => {
            const saved = localStorage.getItem('bojroModel_' + mode);
            if (saved) document.getElementById(mode + '_modelSelect').value = saved;
        });

        // --- NEO HOOK: POPULATE QWEN MODELS ---
        if (window.Neo && window.Neo.populateModels) window.Neo.populateModels(data);

    } catch (e) {}
}

async function fetchSamplers() {
    try {
        const res = await fetch(`${HOST}/sdapi/v1/samplers`, {
            headers: getHeaders()
        });
        const data = await res.json();
        const selXL = document.getElementById('xl_sampler');
        selXL.innerHTML = "";
        const selFlux = document.getElementById('flux_sampler');
        selFlux.innerHTML = "";
        const selInp = document.getElementById('inp_sampler');
        selInp.innerHTML = "";
        data.forEach(s => {
            selXL.appendChild(new Option(s.name, s.name));
            selInp.appendChild(new Option(s.name, s.name));
            const opt = new Option(s.name, s.name);
            if (s.name === "Euler") opt.selected = true;
            selFlux.appendChild(opt);
        });

        // --- NEO HOOK: POPULATE QWEN SAMPLERS ---
        if (window.Neo && window.Neo.populateSamplers) window.Neo.populateSamplers(data);

    } catch (e) {}
}

async function fetchVaes() {
    const slots = [document.getElementById('flux_vae'), document.getElementById('flux_clip'), document.getElementById('flux_t5')];
    slots.forEach(s => s.innerHTML = "<option value='Automatic'>Automatic</option>");
    let list = [];
    try {
        const res = await fetch(`${HOST}/sdapi/v1/sd-modules`, {
            headers: getHeaders()
        });
        const data = await res.json();
        if (data && data.length) {
            list = data.map(m => m.model_name);
            slots.forEach(sel => {
                list.forEach(name => {
                    if (name !== "Automatic" && !Array.from(sel.options).some(o => o.value === name)) sel.appendChild(new Option(name, name));
                });
            });
            // --- NEO HOOK: POPULATE DUAL (VAE/TE) for QWEN ---
            if (window.Neo && window.Neo.populateDual) window.Neo.populateDual(list);
        }
    } catch (e) {}
    ['flux_vae', 'flux_clip', 'flux_t5'].forEach(id => {
        const saved = localStorage.getItem('bojro_' + id);
        if (saved && Array.from(document.getElementById(id).options).some(o => o.value === saved)) document.getElementById(id).value = saved;
    });
    const savedBits = localStorage.getItem('bojro_flux_bits');
    if (savedBits) document.getElementById('flux_bits').value = savedBits;

    // --- NEO HOOK: RESTORE QWEN BITS ---
    const savedQwenBits = localStorage.getItem('bojro_qwen_bits');
    if (savedQwenBits && document.getElementById('qwen_bits')) document.getElementById('qwen_bits').value = savedQwenBits;
}

// Helper needed for the Smart Bridge (Neo/LoRA)
async function loadSidecarConfig(loraName, loraPath) {
    if (loraConfigs[loraName]) return loraConfigs[loraName];
    if (!loraPath) return {
        weight: 1.0,
        trigger: ""
    };
    try {
        const basePath = loraPath.substring(0, loraPath.lastIndexOf('.'));
        const jsonUrl = `${HOST}/file=${basePath}.json`;
        const res = await fetch(jsonUrl);
        if (res.ok) {
            const data = await res.json();
            const newConfig = {
                weight: data["preferred weight"] || data["weight"] || 1.0,
                trigger: data["activation text"] || data["trigger words"] || data["trigger"] || ""
            };
            loraConfigs[loraName] = newConfig;
            return newConfig;
        }
    } catch (e) {}
    return {
        weight: 1.0,
        trigger: ""
    };
}

window.unloadModel = async function(silent = false) {
    if (!silent && !confirm("Unload current model?")) return;
    try {
        await fetch(`${HOST}/sdapi/v1/unload-checkpoint`, {
            method: 'POST',
            headers: getHeaders()
        });
        if (!silent) alert("Unloaded");
    } catch (e) {}
}

async function postOption(payload) {
    const res = await fetch(`${HOST}/sdapi/v1/options`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("API Error " + res.status);
}

function normalize(str) {
    if (!str) return "";
    const noHash = str.split(' [')[0].trim();
    return noHash.replace(/\\/g, '/').split('/').pop().toLowerCase();
}

// --- LLM API COMMUNICATION ---

window.connectToLlm = async function() {
    if (!CapacitorHttp) return alert("Native HTTP Plugin not loaded! Rebuild App.");
    const baseUrl = document.getElementById('llmApiBase').value.replace(/\/$/, "");
    const key = document.getElementById('llmApiKey').value;
    if (!baseUrl) return alert("Enter Server URL first");

    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = "...";
    btn.disabled = true;

    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (key) headers['Authorization'] = `Bearer ${key}`;
        const response = await CapacitorHttp.get({
            url: `${baseUrl}/v1/models`,
            headers: headers
        });
        const data = response.data;
        if (response.status >= 400) throw new Error(`HTTP ${response.status}`);
        const select = document.getElementById('llmModelSelect');
        select.innerHTML = "";
        if (data.data && Array.isArray(data.data)) {
            data.data.forEach(m => {
                select.appendChild(new Option(m.id, m.id));
            });
            if (Toast) Toast.show({
                text: `Found ${data.data.length} models`,
                duration: 'short'
            });
        } else {
            throw new Error("Invalid model format");
        }
        document.getElementById('llmApiBase').value = baseUrl;
        saveLlmGlobalSettings();
    } catch (e) {
        alert("Link Error: " + (e.message || JSON.stringify(e)));
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

window.generateLlmPrompt = async function() {
    if (!CapacitorHttp) return alert("Native HTTP Plugin not loaded!");
    const btn = document.getElementById('llmGenerateBtn');
    const inputVal = document.getElementById('llmInput').value;
    const baseUrl = document.getElementById('llmApiBase').value.replace(/\/$/, "");
    const model = document.getElementById('llmModelSelect').value;
    if (!inputVal) return alert("Please enter an idea!");
    if (!baseUrl) return alert("Please connect to server first!");

    btn.disabled = true;
    btn.innerText = "GENERATING...";
    const sysPrompt = document.getElementById('llmSystemPrompt').value;
    // --- NEO HOOK: QWEN PROMPT CONTEXT ---
    const contextMode = activeLlmMode === 'qwen' ? 'Qwen/Turbo' : (activeLlmMode === 'xl' ? 'Sdxl' : 'Flux');
    const promptTemplate = `1.Prompt(natural language): ${inputVal} Model: ${contextMode}`;

    try {
        const payload = {
    model: model || "default",
    messages: [
        {
            role: "system",
            content: sysPrompt // Your 2k token prompt
        }, 
        {
            role: "user",
            content: inputVal
        }
    ],
    temperature: 0.7,      // Keeps output focused on instructions
    max_tokens: 250,       // Limits output to ~150-180 words max
    top_p: 0.9,            // Standard diversity setting
    frequency_penalty: 0.5, // Helps prevent the "repetitive loops" you saw
    stream: false
};
        const headers = {
            'Content-Type': 'application/json'
        };
        if (llmSettings.key) headers['Authorization'] = `Bearer ${llmSettings.key}`;
        const response = await CapacitorHttp.post({
            url: `${baseUrl}/v1/chat/completions`,
            headers: headers,
            data: payload
        });
        if (response.status >= 400) throw new Error(`HTTP ${response.status}`);
        const data = response.data;
        let result = "";
        if (data.choices && data.choices[0] && data.choices[0].message) {
            result = data.choices[0].message.content;
        } else if (data.response) {
            result = data.response;
        }
        document.getElementById('llmOutput').value = result;
        llmState[activeLlmMode].output = result;
        updateLlmButtonState();
        if (Toast) Toast.show({
            text: 'Prompt Generated!',
            duration: 'short'
        });
    } catch (e) {
        alert("Generation failed: " + (e.message || JSON.stringify(e)));
    } finally {
        btn.disabled = false;
        updateLlmButtonState();
    }
}

window.sendPowerSignal = async function() {
    const btn = document.getElementById('power-btn-mini');
    const serverUrl = localStorage.getItem('bojro_power_ip');

    if (!serverUrl) {
        alert("Please set the PC Server IP in settings first!");
        togglePowerSettings();
        return;
    }

    // Visual Feedback
    btn.classList.add('active');
    if (Toast) Toast.show({
        text: 'Sending Wake Signal...',
        duration: 'short'
    });

    try {
        const targetUrl = `${serverUrl}/power`;

        // STANDARD FETCH (No-CORS removed to match connect() behavior)
        await fetch(targetUrl, {
            method: 'POST'
        });

        if (Toast) Toast.show({
            text: 'Signal Sent! Starting Services...',
            duration: 'long'
        });

        setTimeout(() => {
            btn.classList.remove('active');
        }, 3000);

    } catch (error) {
        console.error(error);
        // Even if it fails (e.g. CORS error but signal sent, or network down),
        // we display a generic toast because a simple server script might not respond cleanly.
        if (Toast) Toast.show({
            text: 'Signal Sent (Or Check Connection)',
            duration: 'short'
        });
        btn.classList.remove('active');
    }
}
// -----------------------------------------------------------
// CONFIGURATION & SETTINGS PAGE LOGIC
// -----------------------------------------------------------

// Load configuration from localStorage
function loadConnectionConfig() {
    const saved = localStorage.getItem('bojroConnectionConfig');
    if (saved) {
        connectionConfig = { ...connectionConfig, ...JSON.parse(saved) };
    }
    
    // 1. Load Local Inputs
    if (document.getElementById('cfgBaseIp')) document.getElementById('cfgBaseIp').value = connectionConfig.baseIp || '';
    if (document.getElementById('cfgPortWebUI')) document.getElementById('cfgPortWebUI').value = connectionConfig.portWebUI || 7860;
    if (document.getElementById('cfgPortLlm')) document.getElementById('cfgPortLlm').value = connectionConfig.portLlm || 1234;
    if (document.getElementById('cfgPortWake')) document.getElementById('cfgPortWake').value = connectionConfig.portWake || 5000;
    if (document.getElementById('cfgPortComfy')) document.getElementById('cfgPortComfy').value = connectionConfig.portComfy || 8188;

    // 2. Load External Inputs (UPDATED: Only Forge and Wake)
    if (document.getElementById('extUrlForge')) document.getElementById('extUrlForge').value = connectionConfig.extForge || '';
    if (document.getElementById('extUrlWake')) document.getElementById('extUrlWake').value = connectionConfig.extWake || '';
    
    // Cloudflare inputs
    if (document.getElementById('cfgCloudflareSwitch')) {
        document.getElementById('cfgCloudflareSwitch').checked = connectionConfig.isCloudflare || false;
        toggleCloudflareUI();
    }
    if (document.getElementById('cfgCfClientId')) document.getElementById('cfgCfClientId').value = connectionConfig.cfClientId || '';
    if (document.getElementById('cfgCfClientSecret')) document.getElementById('cfgCfClientSecret').value = connectionConfig.cfClientSecret || '';
    
    // 3. Update Toggle Switch
    const elMode = document.getElementById('cfgModeSwitch');
    if (elMode) {
        elMode.checked = connectionConfig.isRemote || false;
        elMode.addEventListener('change', toggleConnectionModeUI);
        toggleConnectionModeUI(); 
    }
    // Saac
    const saacEnabled = localStorage.getItem('bojroSaacEnabled') === 'true';
    const saacBtn = document.getElementById('btn-saac-trigger');
    if(saacBtn) {
        if(saacEnabled) saacBtn.classList.remove('hidden');
        else saacBtn.classList.add('hidden');
    }
    const saacSwitch = document.getElementById('cfgSaacSwitch');
    if(saacSwitch) saacSwitch.checked = saacEnabled;
}

// NEW: Helper to toggle UI visibility
function toggleConnectionModeUI() {
    const isRemote = document.getElementById('cfgModeSwitch').checked;
    if (typeof connectionConfig !== 'undefined') {
        connectionConfig.isRemote = isRemote;
        if (typeof buildWebUIUrl === 'function') {
            HOST = buildWebUIUrl();
        }
        }


    const localCont = document.getElementById('container-local');
    const extCont = document.getElementById('container-external');
    const label = document.getElementById('modeLabel');


    if (isRemote) {
        localCont.classList.add('hidden');
        extCont.classList.remove('hidden');
        if(label) label.innerText = "EXTERNAL (TUNNEL)";
        if(label) label.style.color = "var(--accent-primary)";
    } else {
        localCont.classList.remove('hidden');
        extCont.classList.add('hidden');
        if(label) label.innerText = "LOCAL NETWORK";
        if(label) label.style.color = "var(--text-muted)";
    }
}

// Save configuration to localStorage
function saveConnectionConfig() {
    localStorage.setItem('bojroConnectionConfig', JSON.stringify(connectionConfig));
}

// Build full URLs from base IP and ports
function buildWebUIUrl() {
    if (connectionConfig.isRemote) return connectionConfig.extForge || "";
    return constructLocalUrl(connectionConfig.portWebUI || 7860);
}

function buildComfyUrl() {
    if (connectionConfig.isRemote) return ""; 
    return constructLocalUrl(connectionConfig.portComfy || 8188);
}

function buildLlmUrl() {
    if (connectionConfig.isRemote) return "";
    return constructLocalUrl(connectionConfig.portLlm || 1234);
}

function buildWakeUrl() {
    if (connectionConfig.isRemote) return connectionConfig.extWake || "";
    return constructLocalUrl(connectionConfig.portWake || 5000);
}

function constructLocalUrl(port) {
    if (!connectionConfig.baseIp) return '';
    let url = connectionConfig.baseIp.trim();
    url = url.replace(/\/$/, ""); // Remove trailing slash
    url = url.replace(/^https?:\/\//, ''); // Remove protocol
    
    if (port && !url.includes(':')) {
        url += `:${port}`;
    }
    return `http://${url}`;
}

// Update connection status display
function updateConnectionStatus(service, status) {
    if(!connectionState) return;
    connectionState[service] = status;
    
    // Update UI elements based on service
    if (service === 'webui') {
        const btn = document.getElementById('webuiLinkBtn');
        const dot = document.getElementById('webuiStatusDot');
        const statusText = document.getElementById('connectionStatus');
        
        if (!btn || !dot || !statusText) return;
        
        // Remove all state classes
        btn.classList.remove('connecting', 'connected', 'disconnected');
        dot.classList.remove('connecting', 'connected', 'disconnected');
        
        if (status === 'connecting') {
            btn.classList.add('connecting');
            btn.innerText = 'LINKING...';
            dot.classList.add('connecting');
            statusText.innerText = 'Connecting...';
            statusText.style.color = 'var(--accent-primary)';
        } else if (status === 'connected') {
            btn.classList.add('connected');
            btn.innerText = 'CONNECTED';
            dot.classList.add('connected');
            statusText.innerText = `Connected to ${connectionConfig.baseIp}`;
            statusText.style.color = 'var(--success)';
        } else {
            btn.classList.add('disconnected');
            btn.innerText = 'LINK';
            dot.classList.add('disconnected');
            statusText.innerText = 'Not Connected';
            statusText.style.color = 'var(--text-muted)';
        }
    }
    
    if (service === 'llm') {
        const btn = document.getElementById('llmLinkBtn');
        const dot = document.getElementById('llmStatusDot');
        
        if (!btn || !dot) return;
        
        // Remove all state classes
        btn.classList.remove('connecting', 'connected', 'disconnected');
        dot.classList.remove('connecting', 'connected', 'disconnected');
        
        if (status === 'connecting') {
            btn.classList.add('connecting');
            btn.innerText = 'LINKING...';
            dot.classList.add('connecting');
        } else if (status === 'connected') {
            btn.classList.add('connected');
            btn.innerText = 'CONNECTED';
            dot.classList.add('connected');
        } else {
            btn.classList.add('disconnected');
            btn.innerText = 'LINK';
            dot.classList.add('disconnected');
        }
    }
}

// Settings page functions
window.saveConfiguration = function() {
    // Read Local Values
    const baseIp = document.getElementById('cfgBaseIp').value.trim();
    const isRemote = document.getElementById('cfgModeSwitch').checked;
    const portWebUI = document.getElementById('cfgPortWebUI').value;
    const portLlm = document.getElementById('cfgPortLlm').value;
    const portWake = document.getElementById('cfgPortWake').value;
    const portComfy = document.getElementById('cfgPortComfy').value;
    
    // Read External Values (UPDATED: Only Forge and Wake)
    const extForge = document.getElementById('extUrlForge').value.trim().replace(/\/$/, ""); 
    const extWake = document.getElementById('extUrlWake').value.trim().replace(/\/$/, "");

    // Cloudflare Values
    const isCloudflare = document.getElementById('cfgCloudflareSwitch').checked;
    const cfClientId = document.getElementById('cfgCfClientId').value.trim();
    const cfClientSecret = document.getElementById('cfgCfClientSecret').value.trim();

    // Save to Config Object
    connectionConfig.baseIp = baseIp;
    connectionConfig.isRemote = isRemote;
    connectionConfig.portWebUI = portWebUI;
    connectionConfig.portLlm = portLlm;
    connectionConfig.portWake = portWake;
    connectionConfig.portComfy = portComfy;
    
    // Save New Fields
    connectionConfig.extForge = extForge;
    connectionConfig.extWake = extWake;
    // We clear Comfy/LLM external configs since they are removed
    connectionConfig.extComfy = "";
    connectionConfig.extLlm = "";
    
    connectionConfig.isCloudflare = isCloudflare;
    connectionConfig.cfClientId = cfClientId;
    connectionConfig.cfClientSecret = cfClientSecret;

    connectionConfig.isConfigured = true;
    
    saveConnectionConfig();
    
    // Update Global HOST
    HOST = buildWebUIUrl();
    localStorage.setItem('bojroHostIp', HOST);
    
    // Comfy is Local Only now, or empty if remote
    const comfyUrl = buildComfyUrl();
    if (comfyUrl) {
        localStorage.setItem('comfyHost', comfyUrl.replace('http://','').replace('https://',''));
    }

    if (Toast) Toast.show({ text: 'Configuration Saved', duration: 'short' });
    switchTab('gen');
}

// www/js/cfg.js

window.resetAppConfig = function() {
    // 1. Ask the user for confirmation
    if (confirm('Reset all app configuration? This will clear settings AND remove downloaded updates.')) {
        
        // 2. Clear all saved data
        localStorage.removeItem('bojroConnectionConfig');
        localStorage.removeItem('bojroHostIp');
        localStorage.removeItem('bojro_power_ip');
        localStorage.removeItem('bojroLlmConfig');
        localStorage.removeItem('bojroBatteryOpt');
        localStorage.removeItem('bojro_model_visibility'); 
        localStorage.removeItem('comfyHost');
        
        // 3. Reset variables
        connectionConfig = {
            baseIp: "",
            portWebUI: 7860,
            portLlm: 1234,
            portWake: 5000,
            portComfy: 8188,
            isRemote: false,
            isConfigured: false
        };
        HOST = "";
        
        // 4. CRITICAL FIX: Reset the Native Updater
        // This deletes the "stuck" update file and forces the app to use your new code
        if (window.resetNativeUpdater) {
             window.resetNativeUpdater(); 
        } else {
             window.location.reload();
        }
    }
}

// Test connection functions
window.connectToWebUI = async function() {
    if (!connectionConfig.baseIp) {
        alert('Please configure your connection settings first');
        switchTab('cfg');
        return;
    }
    
    if (LocalNotifications) {
        try {
            const perm = await LocalNotifications.requestPermissions();
            if (perm.display === 'granted') await createNotificationChannel();
            console.log("Permissions requested via LINK button");
        } catch (e) {
            console.warn("Notification permission error:", e);
        }
    }
    
    const btn = document.getElementById('webuiLinkBtn');
    
    updateConnectionStatus('webui', 'connecting');
    
    try {
        const url = buildWebUIUrl();
        const res = await fetch(`${url}/sdapi/v1/sd-models`, {
            headers: getHeaders()
        });
        
        if (!res.ok) throw new Error("Status " + res.status);
        
        // Update global HOST for backward compatibility
        HOST = url;
        localStorage.setItem('bojroHostIp', HOST);
        
        // Enable generation button
        document.getElementById('genBtn').disabled = false;
        
        // Fetch models, samplers, VAEs
        await Promise.all([fetchModels(), fetchSamplers(), fetchVaes()]);
        
        updateConnectionStatus('webui', 'connected');
        
        if (Toast) Toast.show({
            text: 'WebUI Linked Successfully',
            duration: 'short'
        });
    } catch (e) {
        updateConnectionStatus('webui', 'disconnected');
        alert("Failed to connect: " + e.message);
    }
}

window.connectToLlmService = async function() {
    if (!connectionConfig.baseIp) {
        alert('Please configure your connection settings first');
        switchTab('cfg');
        return;
    }
    
    const btn = document.getElementById('llmLinkBtn');
    
    updateConnectionStatus('llm', 'connecting');
    
    try {
        const url = buildLlmUrl();
        
        if (!CapacitorHttp) {
            throw new Error("Native HTTP Plugin not loaded!");
        }
        
        const response = await CapacitorHttp.get({
            url: `${url}/v1/models`,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.status >= 400) throw new Error(`HTTP ${response.status}`);
        
        const data = response.data;
        if (data.data && Array.isArray(data.data)) {
            const select = document.getElementById('llmModelSelect');
            select.innerHTML = "";
            data.data.forEach(m => {
                select.appendChild(new Option(m.id, m.id));
            });
            
            // Update LLM settings for backward compatibility
            llmSettings.baseUrl = url;
            localStorage.setItem('bojroLlmConfig', JSON.stringify(llmSettings));
            
            updateConnectionStatus('llm', 'connected');
            
            if (Toast) Toast.show({
                text: `Found ${data.data.length} models`,
                duration: 'short'
            });
        } else {
            throw new Error("Invalid model format");
        }
    } catch (e) {
        updateConnectionStatus('llm', 'disconnected');
        alert("Link Error: " + (e.message || JSON.stringify(e)));
    }
}

// Enhanced wake signal using centralized config
window.sendPowerSignal = async function() {
    if (!connectionConfig.baseIp) {
        alert('Please configure your connection settings first');
        switchTab('cfg');
        return;
    }
    
    const btn = document.getElementById('power-btn-mini');
    const serverUrl = buildWakeUrl();
    
    if (!serverUrl) {
        alert("Invalid wake server configuration");
        return;
    }
    
    // Visual Feedback
    btn.classList.add('active');
    if (Toast) Toast.show({
        text: 'Sending Wake Signal...',
        duration: 'short'
    });
    
    try {
        await fetch(serverUrl, {
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
        if (Toast) Toast.show({
            text: 'Signal Sent (Or Check Connection)',
            duration: 'short'
        });
        btn.classList.remove('active');
    }
}

// Initialize configuration on page load
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('cfgBaseIp')) {
        loadConnectionConfig();
    }
    
    loadModelVisibility(); 

    // Initialize connection status displays
    updateConnectionStatus('webui', 'disconnected');
    updateConnectionStatus('llm', 'disconnected');
});

// Add CFG tab support to switchTab function
const originalSwitchTab = window.switchTab;
window.switchTab = function(view) {
    if (originalSwitchTab) {
        originalSwitchTab(view);
    }
    
    // Handle CFG tab specifically
    if (view === 'cfg') {
        const items = document.querySelectorAll('.dock-item');
        items.forEach(item => item.classList.remove('active'));
        // Find 6th item safely
        if(items.length > 5) items[5].classList.add('active'); 
        
        // Load configuration into UI
        loadConnectionConfig();
    }
};

// --- INTERFACE VISIBILITY LOGIC (UPDATED FOR COMFY) ---

window.loadModelVisibility = function() {
    const saved = localStorage.getItem('bojro_model_visibility');
    const config = saved ? JSON.parse(saved) : { xl: true, flux: true, qwen: true, comfy: false };

    const elXl = document.getElementById('cfgShowXl');
    const elFlux = document.getElementById('cfgShowFlux');
    const elQwen = document.getElementById('cfgShowQwen');
    const elComfy = document.getElementById('cfgShowComfy'); 

    if (elXl) elXl.checked = config.xl;
    if (elFlux) elFlux.checked = config.flux;
    if (elQwen) elQwen.checked = config.qwen;
    if (elComfy) elComfy.checked = config.comfy; 

    applyModelVisibility(config);
}

window.saveModelVisibility = function() {
    const config = {
        xl: document.getElementById('cfgShowXl').checked,
        flux: document.getElementById('cfgShowFlux').checked,
        qwen: document.getElementById('cfgShowQwen').checked,
        comfy: document.getElementById('cfgShowComfy').checked 
    };
    localStorage.setItem('bojro_model_visibility', JSON.stringify(config));
    applyModelVisibility(config);
}

function applyModelVisibility(config) {
    const btnXl = document.getElementById('btn-xl');
    const btnFlux = document.getElementById('btn-flux');
    const btnQwen = document.getElementById('btn-qwen');
    const dockComfy = document.getElementById('dock-comfy'); 

    if (btnXl) config.xl ? btnXl.classList.remove('hidden') : btnXl.classList.add('hidden');
    if (btnFlux) config.flux ? btnFlux.classList.remove('hidden') : btnFlux.classList.add('hidden');
    if (btnQwen) config.qwen ? btnQwen.classList.remove('hidden') : btnQwen.classList.add('hidden');
    
    if (dockComfy) config.comfy ? dockComfy.classList.remove('hidden') : dockComfy.classList.add('hidden');
}

window.toggleCloudflareUI = function() {
    const isOn = document.getElementById('cfgCloudflareSwitch').checked;
    const cont = document.getElementById('container-cloudflare');
    if (cont) {
        if(isOn) cont.classList.remove('hidden');
        else cont.classList.add('hidden');
    }
}
window.toggleSaac = function() {
    const isChecked = document.getElementById('cfgSaacSwitch').checked;
    localStorage.setItem('bojroSaacEnabled', isChecked);
    
    const btn = document.getElementById('btn-saac-trigger');
    if(isChecked) {
        btn.classList.remove('hidden');
        // Pre-load data silently when enabled
        if(window.SaacManager) window.SaacManager.init(); 
    } else {
        btn.classList.add('hidden');
    }
}
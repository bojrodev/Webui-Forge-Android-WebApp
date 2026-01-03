/* =========================================
   RESOLVER COMFY ENGINE (SPA INTEGRATED)
   ========================================= */

// Renamed globals to avoid conflict with main app
let comfyHost = "127.0.0.1:8188";
let comfySocket = null;
let comfyClientId = crypto.randomUUID();
let comfyLoadedWorkflow = null; 
let comfyInputMap = {}; 
// Find this line at the top
let comfyServerLists = { checkpoints: [], loras: [], vaes: [], clips: [], unets: [], samplers: [], schedulers: [] };

let comfyRunBuffer = [];        // Stores all images from the current run
let isComfySelectionMode = false; // Tracks if we are selecting images
let selectedComfyImages = new Map(); // Stores DOM Element -> URL

let isComfyGenerating = false;

let selectedTemplates = new Set();
let isTmplSelectionMode = false;

let originalInpHtml = null;

// --- COMFY EDITOR STATE ---
var isComfyMaskingMode = false;
var comfyMaskTargetNodeId = null;



// --- 1. CONNECTION & SETUP ---

function toggleComfyConfig() {
    const el = document.getElementById('comfy-config-area');
    if(el) el.classList.toggle('hidden');
}

function connectToComfy() {
    // 1. Try to use Centralized Config first
    let host = "";
    if(typeof buildComfyUrl === 'function') {
        host = buildComfyUrl().replace('http://', '').replace('https://', '').replace('/', '');
    } 
    
    // 2. Fallback to manual input or default
    if(!host) {
        const hostInput = document.getElementById('comfyHostInput');
        if(hostInput && hostInput.value) {
            host = hostInput.value.replace('http://', '').replace('https://', '').replace('/', '');
        } else {
            host = "127.0.0.1:8188";
        }
    }

    comfyHost = host;
    updateComfyStatus('connecting');

    try {
        if (comfySocket) comfySocket.close();
        
        comfySocket = new WebSocket(`ws://${comfyHost}/ws?clientId=${comfyClientId}`);

        comfySocket.onopen = async () => {
            updateComfyStatus('connected');
            // Fetch all resource lists in parallel
            await Promise.all([
                fetchComfyList('CheckpointLoaderSimple', 'ckpt_name', 'checkpoints'),
                fetchComfyList('LoraLoader', 'lora_name', 'loras'),
                fetchComfyList('VAELoader', 'vae_name', 'vaes'),
                fetchComfyList('CLIPLoader', 'clip_name', 'clips'),
                fetchComfyList('UNETLoader', 'unet_name', 'unets'),
                fetchComfyList('KSampler', 'sampler_name', 'samplers'),
                fetchComfyList('KSampler', 'scheduler', 'schedulers')
            ]);
            
            // Re-build UI if workflow exists to populate dropdowns
            if(comfyLoadedWorkflow) buildComfyUI(comfyLoadedWorkflow);
        };

        comfySocket.onclose = () => {
            updateComfyStatus('disconnected');
        };

        comfySocket.onmessage = (event) => {
            handleComfyMessage(event);
        };
    } catch (e) {
        updateComfyStatus('disconnected');
    }
}

function updateComfyStatus(status) {
    const btn = document.getElementById('comfyConnectBtn');
    if(!btn) return;

    // Reset classes
    btn.classList.remove('connecting', 'active');

    if (status === 'connected') {
        // Connected: Purple Neon Glow
        btn.classList.add('active');
        btn.innerHTML = `<i data-lucide="zap"></i> CONNECTED`;
        if(comfyLoadedWorkflow && !isComfyGenerating) {
            document.getElementById('comfyQueueBtn').disabled = false;
        }
    } else if (status === 'connecting') {
        // Connecting: Green Pulse
        btn.classList.add('connecting');
        btn.innerHTML = `<i data-lucide="loader-2" class="spin"></i> CONNECTING...`;
    } else {
        // Disconnected: Standard Grey
        btn.innerHTML = `<i data-lucide="plug"></i> CONNECT`;
        if(document.getElementById('comfyQueueBtn')) document.getElementById('comfyQueueBtn').disabled = true;
    }
    
    if(window.lucide) lucide.createIcons();
}

async function fetchComfyList(nodeType, inputName, targetList) {
    try {
        const res = await fetch(`http://${comfyHost}/object_info/${nodeType}`);
        const data = await res.json();
        const inputs = data[nodeType].input.required;
        
        if (inputs[inputName] && Array.isArray(inputs[inputName][0])) {
            comfyServerLists[targetList] = inputs[inputName][0];
        }
    } catch (e) {
        // console.warn(`Skipping ${nodeType} fetch`);
    }
}

// --- 2. WORKFLOW PARSER & PERSISTENCE ---

function loadWorkflowFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const jsonStr = e.target.result;
            comfyLoadedWorkflow = JSON.parse(jsonStr);
            const fileName = file.name.toUpperCase();
            
            // Update UI
            document.getElementById('comfyLoadedFileName').innerText = fileName;
            buildComfyUI(comfyLoadedWorkflow);
            
            // Save Persistence
            saveComfySession(fileName, jsonStr);
            saveTemplateToDB(fileName, jsonStr); // This saves the file to your new database box
            
            if (comfySocket && comfySocket.readyState === WebSocket.OPEN) {
                document.getElementById('comfyQueueBtn').disabled = false;
            }
        } catch (err) {
            alert("Invalid JSON: " + err.message);
        }
    };
    reader.readAsText(file);
}

function saveComfySession(filename, jsonStr) {
    localStorage.setItem('bojro_comfy_template_name', filename);
    localStorage.setItem('bojro_comfy_template_json', jsonStr);
}

function restoreComfySession() {
    // 1. Try to load the "Snapshot" (Your modified settings)
    const snapshot = localStorage.getItem('bojro_comfy_snapshot');
    const snapshotName = localStorage.getItem('bojro_comfy_snapshot_name');

    if (snapshot && snapshotName) {
        try {
            comfyLoadedWorkflow = JSON.parse(snapshot);
            const label = document.getElementById('comfyLoadedFileName');
            if(label) label.innerText = snapshotName;
            
            buildComfyUI(comfyLoadedWorkflow);
            console.log("Restored Snapshot:", snapshotName);
            return; // Stop here, we are done
        } catch(e) {
            console.warn("Snapshot corrupted, ignoring...");
        }
    }

    // 2. Fallback: Load the original clean template
    const savedName = localStorage.getItem('bojro_comfy_template_name');
    const savedJson = localStorage.getItem('bojro_comfy_template_json');
    
    if (savedName && savedJson) {
        try {
            comfyLoadedWorkflow = JSON.parse(savedJson);
            const label = document.getElementById('comfyLoadedFileName');
            if(label) label.innerText = savedName;
            
            buildComfyUI(comfyLoadedWorkflow);
        } catch(e) { console.warn(e); }
    }
}

function unloadComfyTemplate() {
    if(confirm("Unload current template?")) {
        // Clear Original
        localStorage.removeItem('bojro_comfy_template_name');
        localStorage.removeItem('bojro_comfy_template_json');
        
        // NEW: Clear Snapshot too
        localStorage.removeItem('bojro_comfy_snapshot');
        localStorage.removeItem('bojro_comfy_snapshot_name');
        
        // ... (Keep the rest of your existing code here) ...
        // Reset Memory
        comfyLoadedWorkflow = null;
        comfyInputMap = {};
        
        // Reset UI
        const container = document.getElementById('comfy-dynamic-controls');
        if(container) container.innerHTML = '';
        
        const label = document.getElementById('comfyLoadedFileName');
        if(label) label.innerText = "NO TEMPLATE LOADED";
        
        const btn = document.getElementById('comfyQueueBtn');
        if(btn) btn.disabled = true;
    }
}

function buildComfyUI(workflow) {
    const container = document.getElementById('comfy-dynamic-controls');
    if(!container) return;
    
    container.innerHTML = ''; 
    comfyInputMap = {}; 

    // Create the "Resources" box
    let resourceBox = document.createElement('div');
    resourceBox.className = 'glass-box';
    resourceBox.style.borderLeft = '4px solid var(--accent-secondary)';
    resourceBox.innerHTML = `
        <div class="row" onclick="this.nextElementSibling.classList.toggle('hidden')" style="cursor:pointer; justify-content:space-between; margin-bottom:10px;">
            <label style="font-size:12px; color:var(--accent-secondary); font-weight:900;">💾 MODELS & RESOURCES</label>
            <i data-lucide="chevron-down" size="14"></i>
        </div>
        <div id="comfy-resource-content" class="col" style="gap:15px;"></div>
    `;
    let resourceContent = resourceBox.querySelector('#comfy-resource-content');
    let hasResources = false;

    const nodeIds = Object.keys(workflow).sort((a,b) => parseInt(a) - parseInt(b));

    for (const nodeId of nodeIds) {
        const node = workflow[nodeId];
        const type = node.class_type;
        const title = node._meta ? node._meta.title : type;

        // --- A. RESOURCE NODES ---
        if (type.includes('CheckpointLoader')) {
            addComfyDropdown(resourceContent, nodeId, 'ckpt_name', 'CHECKPOINT', comfyServerLists.checkpoints, node.inputs.ckpt_name);
            hasResources = true;
        }
        else if (type.includes('LoraLoader')) {
            addComfyLora(resourceContent, nodeId, title, node.inputs);
            hasResources = true;
        }
        else if (type.includes('VAELoader')) {
            addComfyDropdown(resourceContent, nodeId, 'vae_name', 'VAE', comfyServerLists.vaes, node.inputs.vae_name);
            hasResources = true;
        }
        else if (type.includes('CLIPLoader')) {
            addComfyDropdown(resourceContent, nodeId, 'clip_name', 'CLIP / TE', comfyServerLists.clips, node.inputs.clip_name);
            hasResources = true;
        }
        else if (type.includes('UNETLoader')) {
            addComfyDropdown(resourceContent, nodeId, 'unet_name', 'UNET', comfyServerLists.unets, node.inputs.unet_name);
            hasResources = true;
        }
        
        // --- B. STANDARD NODES ---
        else if (type === 'KSampler' || type === 'KSamplerAdvanced') {
            createComfySampler(container, nodeId, node.inputs, title);
        }
        else if (type === 'CLIPTextEncode') {
            createComfyText(container, nodeId, node.inputs, title);
        }
        else if (type === 'LoadImage') {
            createComfyImageUpload(container, nodeId, node.inputs, title);
        }
        else if (type === 'EmptyLatentImage' || type === 'EmptySD3LatentImage') {
            createComfyResolution(container, nodeId, node.inputs, title);
        }
    }

    if (hasResources) container.insertBefore(resourceBox, container.firstChild);
    
    if(window.lucide) lucide.createIcons();
}

// --- 3. UI GENERATORS (Namespaced) ---

function addComfyDropdown(parent, nodeId, fieldName, label, listData, currentVal) {
    const uid = `in_${nodeId}_${fieldName}`;
    
    const options = listData && listData.length > 0 
        ? listData.map(f => `<option value="${f}" ${f === currentVal ? 'selected' : ''}>${f}</option>`).join('')
        : `<option value="${currentVal}">${currentVal}</option>`;

    const div = document.createElement('div');
    div.className = 'col';
    div.innerHTML = `
        <div class="row" style="justify-content:space-between">
            <label>${label} <span style="opacity:0.5; font-weight:400;">#${nodeId}</span></label>
        </div>
        <select id="${uid}" onchange="updateComfyValue('${nodeId}', '${fieldName}', this.value)" style="border-left: 2px solid var(--accent-secondary);">
            ${options}
        </select>
    `;
    parent.appendChild(div);
    comfyInputMap[uid] = { nodeId, field: fieldName };
}

function addComfyLora(parent, nodeId, title, inputs) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'background:rgba(255,255,255,0.03); padding:8px; border-radius:8px; border:1px solid var(--border-color);';
    
    const listData = comfyServerLists.loras;
    const currentVal = inputs.lora_name;
    const options = listData && listData.length > 0 
        ? listData.map(f => `<option value="${f}" ${f === currentVal ? 'selected' : ''}>${f}</option>`).join('')
        : `<option value="${currentVal}">${currentVal}</option>`;
    
    wrapper.innerHTML = `
        <label style="color:var(--accent-secondary); margin-bottom:5px; display:block;">🧩 LORA <span style="opacity:0.5">#${nodeId}</span></label>
        <select id="in_${nodeId}_lora_name" onchange="updateComfyValue('${nodeId}', 'lora_name', this.value)" style="margin-bottom:8px;">
            ${options}
        </select>
    `;
    comfyInputMap[`in_${nodeId}_lora_name`] = { nodeId, field: 'lora_name' };

    if (inputs.strength_model !== undefined) {
        addComfySlider(wrapper, nodeId, 'strength_model', 'Model Str', inputs.strength_model, 0, 2, 0.1);
    }
    if (inputs.strength_clip !== undefined) {
        addComfySlider(wrapper, nodeId, 'strength_clip', 'Clip Str', inputs.strength_clip, 0, 2, 0.1);
    }

    parent.appendChild(wrapper);
}

function createComfySampler(parent, nodeId, inputs, title) {
    const wrapper = document.createElement('div');
    wrapper.className = 'glass-box node-group';
    wrapper.innerHTML = `<div class="node-header"><span>🎛️ ${title}</span> <span style="opacity:0.5">#${nodeId}</span></div>`;

    // 1. Sampler & Scheduler Dropdowns
    // We check if the input exists in the node before adding the control
    if (inputs.sampler_name !== undefined) {
        addComfyDropdown(wrapper, nodeId, 'sampler_name', 'Sampler', comfyServerLists.samplers, inputs.sampler_name);
    }
    if (inputs.scheduler !== undefined) {
        addComfyDropdown(wrapper, nodeId, 'scheduler', 'Schedule', comfyServerLists.schedulers, inputs.scheduler);
    }

    // 2. Standard Sliders
    if (inputs.steps !== undefined) addComfySlider(wrapper, nodeId, 'steps', 'Steps', inputs.steps, 1, 100, 1);
    if (inputs.cfg !== undefined) addComfySlider(wrapper, nodeId, 'cfg', 'CFG Scale', inputs.cfg, 1, 20, 0.5);
    
    // 3. Denoise Slider (NEW)
    // Denoise runs from 0.0 to 1.0 usually
    if (inputs.denoise !== undefined) {
        addComfySlider(wrapper, nodeId, 'denoise', 'Denoise', inputs.denoise, 0, 1, 0.01);
    }

    if (inputs.seed !== undefined && !Array.isArray(inputs.seed)) addComfySeed(wrapper, nodeId, 'seed', inputs.seed);

    parent.appendChild(wrapper);
}

function createComfyText(parent, nodeId, inputs, title) {
    const isNeg = title.toLowerCase().includes('negative') || title.toLowerCase().includes('neg');
    const color = isNeg ? '#f44336' : 'var(--success)';
    
    const wrapper = document.createElement('div');
    wrapper.className = 'glass-box node-group';
    wrapper.style.borderLeftColor = color;
    
    wrapper.innerHTML = `
        <div class="node-header" style="color:${color}">
            <span>${isNeg ? '🛡️ NEGATIVE' : '✨ PROMPT'}</span> 
            <span style="opacity:0.5">#${nodeId}</span>
        </div>
        <textarea id="in_${nodeId}_text" rows="${isNeg ? 2 : 5}" oninput="updateComfyValue('${nodeId}', 'text', this.value)">${inputs.text}</textarea>
    `;
    
    parent.appendChild(wrapper);
    comfyInputMap[`in_${nodeId}_text`] = { nodeId, field: 'text' };
}

function createComfyResolution(parent, nodeId, inputs, title) {
    const wrapper = document.createElement('div');
    wrapper.className = 'glass-box node-group';
    wrapper.innerHTML = `<div class="node-header"><span>📐 RESOLUTION</span> <span style="opacity:0.5">#${nodeId}</span></div>`;
    
    addComfySlider(wrapper, nodeId, 'width', 'Width', inputs.width, 512, 2048, 64);
    addComfySlider(wrapper, nodeId, 'height', 'Height', inputs.height, 512, 2048, 64);
    
    parent.appendChild(wrapper);
}

function createComfyImageUpload(parent, nodeId, inputs, title) {
    const wrapper = document.createElement('div');
    wrapper.className = 'glass-box node-group';
    wrapper.style.padding = '10px';
    wrapper.innerHTML = `<div class="node-header" style="margin-bottom:10px;"><span>🖼️ INPUT IMAGE</span> <span style="opacity:0.5">#${nodeId}</span></div>`;

    const inputId = `file_${nodeId}`;
    const thumbId = `thumb_${nodeId}`;
    const labelId = `label_${nodeId}`;
    
    // Check if image exists in workflow
    const currentImgName = inputs.image || "No image selected";
    const currentImgUrl = inputs.image ? `http://${comfyHost}/view?filename=${inputs.image}&type=input` : '';
    const displayStyle = currentImgUrl ? 'display:block;' : 'display:none;';

    wrapper.innerHTML += `
        <div style="background:rgba(0,0,0,0.3); border-radius:8px; margin-bottom:10px; overflow:hidden; min-height:120px; display:flex; align-items:center; justify-content:center; border:1px solid var(--border-color);">
            <img id="${thumbId}" src="${currentImgUrl}" style="width:100%; height:auto; max-height:250px; object-fit:contain; ${displayStyle}" onerror="this.style.display='none'">
            <div id="placeholder_${nodeId}" style="color:var(--text-muted); font-size:10px; ${currentImgUrl ? 'display:none' : 'display:block'}">
                <i data-lucide="image" size="24" style="opacity:0.5; margin-bottom:5px;"></i><br>NO IMAGE
            </div>
        </div>

        <input type="file" id="${inputId}" accept="image/*" class="hidden" onchange="uploadComfyImage('${nodeId}', '${inputId}')">
        
        <div class="row" style="background:var(--bg-input); padding:8px; border-radius:6px; margin-bottom:8px; align-items:center;">
            <i data-lucide="file" size="12" style="color:var(--text-muted); margin-right:6px;"></i>
            <span id="${labelId}" style="font-size:11px; font-family:monospace; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${currentImgName}</span>
        </div>

        <div class="row" style="gap:8px;">
            <button class="btn-small" onclick="document.getElementById('${inputId}').click()" style="flex:2; background:rgba(255,255,255,0.1);">
                <i data-lucide="upload" size="12" style="margin-right:4px;"></i> UPLOAD
            </button>
            <button class="btn-small" onclick="startComfyMasking('${nodeId}')" style="flex:1; background:var(--accent-secondary); color:white;" title="Mask/Edit">
                <i data-lucide="brush" size="12"></i>
            </button>
            <button class="btn-small" onclick="clearComfyImage('${nodeId}')" style="flex:0 0 32px; background:rgba(244,67,54,0.2); color:#f44336; padding:0; display:flex; align-items:center; justify-content:center; border:1px solid rgba(244,67,54,0.3);" title="Clear Image">
                <i data-lucide="x" size="14"></i>
            </button>
        </div>
        
        <div id="status_${nodeId}" style="font-size:9px; color:var(--text-muted); margin-top:5px; text-align:right;"></div>
    `;
    
    parent.appendChild(wrapper);
}

function clearComfyImage(nodeId) {
    if(!confirm("Clear this image?")) return;

    // 1. Update Memory (Clear input)
    updateComfyValue(nodeId, 'image', '');

    // 2. Update UI Elements
    const thumbImg = document.getElementById(`thumb_${nodeId}`);
    const placeholder = document.getElementById(`placeholder_${nodeId}`);
    const labelSpan = document.getElementById(`label_${nodeId}`);
    const input = document.getElementById(`file_${nodeId}`);
    const status = document.getElementById(`status_${nodeId}`);

    if(thumbImg) {
        thumbImg.src = '';
        thumbImg.style.display = 'none';
    }
    if(placeholder) placeholder.style.display = 'block';
    if(labelSpan) labelSpan.innerText = "No image selected";
    if(input) input.value = ""; // Reset the file picker
    if(status) status.innerText = "";
}

function addComfySlider(parent, nodeId, field, label, val, min, max, step) {
    const uid = `in_${nodeId}_${field}`;
    const div = document.createElement('div');
    div.className = 'col';
    div.style.marginBottom = "8px";
    div.innerHTML = `
        <div class="row" style="justify-content:space-between">
            <label>${label}</label>
            <span id="val_${uid}" style="font-family:monospace; font-size:10px; color:var(--accent-primary)">${val}</span>
        </div>
        <input type="range" class="orange-slider" id="${uid}" min="${min}" max="${max}" step="${step}" value="${val}"
            oninput="document.getElementById('val_${uid}').innerText = this.value; updateComfyValue('${nodeId}', '${field}', this.value)">
    `;
    parent.appendChild(div);
    comfyInputMap[uid] = { nodeId, field };
}

function addComfySeed(parent, nodeId, field, val) {
    const uid = `in_${nodeId}_${field}`;
    const div = document.createElement('div');
    div.className = 'col';
    div.innerHTML = `
        <div class="row" style="justify-content:space-between">
            <label>SEED</label>
            <button class="btn-icon" style="width:20px; height:20px;" onclick="randomizeComfySeed('${uid}')"><i data-lucide="dices" size="12"></i></button>
        </div>
        <input type="number" id="${uid}" value="${val}" onchange="updateComfyValue('${nodeId}', '${field}', this.value)">
    `;
    parent.appendChild(div);
    comfyInputMap[uid] = { nodeId, field, type: 'int' };
}

// --- 4. EXECUTION ---

function updateComfyValue(nodeId, field, value) {
    let finalVal = value;
    const node = comfyLoadedWorkflow[nodeId];
    
    // Standard parsing
    if (['steps','width','height','seed'].includes(field)) finalVal = parseInt(value);
    
    // NEW: Added 'denoise' to the float list
    if (['cfg','strength_model','strength_clip','denoise'].includes(field)) finalVal = parseFloat(value);
    
    // Update the memory
    if (node && node.inputs) {
        node.inputs[field] = finalVal;
    }

    // NEW: Save to disk immediately!
    localStorage.setItem('bojro_comfy_snapshot', JSON.stringify(comfyLoadedWorkflow));
    const currentName = document.getElementById('comfyLoadedFileName').innerText;
    localStorage.setItem('bojro_comfy_snapshot_name', currentName);
}

function randomizeComfySeed(uid) {
    const random = Math.floor(Math.random() * 1000000000000);
    document.getElementById(uid).value = random;
    updateComfyValue(comfyInputMap[uid].nodeId, 'seed', random);
}

async function uploadComfyImage(nodeId, inputId) {
    const fileInput = document.getElementById(inputId);
    const statusSpan = document.getElementById(`status_${nodeId}`);
    const thumbImg = document.getElementById(`thumb_${nodeId}`);
    const placeholder = document.getElementById(`placeholder_${nodeId}`);
    const labelSpan = document.getElementById(`label_${nodeId}`);
    
    if (fileInput.files.length === 0) return;
    
    const file = fileInput.files[0];
    
    // Immediate UI update (Optimistic)
    if(labelSpan) labelSpan.innerText = file.name;

    const formData = new FormData();
    formData.append("image", file);
    formData.append("overwrite", "true");

    if(statusSpan) statusSpan.innerText = "UPLOADING...";

    try {
        const resp = await fetch(`http://${comfyHost}/upload/image`, {
            method: 'POST',
            body: formData
        });
        const data = await resp.json();
        
        // 1. Update Memory
        updateComfyValue(nodeId, 'image', data.name);
        
        // 2. Update Status
        if(statusSpan) {
            statusSpan.innerText = "DONE";
            statusSpan.style.color = "var(--success)";
            setTimeout(() => statusSpan.innerText = "", 2000);
        }

        // 3. Update Visuals
        if (thumbImg) {
            thumbImg.src = `http://${comfyHost}/view?filename=${data.name}&type=input&t=${Date.now()}`;
            thumbImg.style.display = 'block';
        }
        if (placeholder) placeholder.style.display = 'none';
        if (labelSpan) labelSpan.innerText = data.name;

    } catch (e) {
        alert("Upload Failed: " + e);
        if(statusSpan) statusSpan.innerText = "ERROR";
    }
}

async function queueComfyPrompt() {
    if (!comfySocket || comfySocket.readyState !== WebSocket.OPEN) {
        alert("Not Connected!");
        return;
    }

    isComfyGenerating = true;

    // 1. Clear previous run buffer & selection
    comfyRunBuffer = []; 
    if(isComfySelectionMode) toggleComfySelectionMode(); // Exit selection mode if active

    // 2. UI Updates (Spinning State)
    const btn = document.getElementById('comfyQueueBtn');
    btn.disabled = true;
    
    if (typeof updateBatchNotification === 'function') {
        updateBatchNotification("ComfyUI", true, "Generating...");
        }
    btn.innerHTML = `<i data-lucide="loader-2" class="spin"></i> RUNNING...`; // Keeps spinning!
    
    document.getElementById('comfyProgressBar').style.width = "0%";
    document.getElementById('comfyProgressText').innerText = "QUEUED";
    document.getElementById('comfyLivePreview').style.opacity = 0.3;

    // 3. Send Payload
    const payload = {
        prompt: comfyLoadedWorkflow,
        client_id: comfyClientId
    };

    try {
        const res = await fetch(`http://${comfyHost}/prompt`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        console.log("Job ID:", data.prompt_id);
        
        if(window.lucide) lucide.createIcons();
    } catch (e) {
        alert("Failed to queue: " + e);
        isComfyGenerating = false;
        // Reset button on error
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="play"></i> GENERATE`;
    }
}

async function interruptComfy() {
    try {
        await fetch(`http://${comfyHost}/interrupt`, { method: 'POST' });
        isComfyGenerating = false;
        document.getElementById('comfyProgressText').innerText = "INTERRUPTED";
        document.getElementById('comfyQueueBtn').disabled = false;
        document.getElementById('comfyQueueBtn').innerText = "GENERATE";
    } catch(e) { console.error(e); }
}

// --- 5. HANDLER & SHARED GALLERY ---

function handleComfyMessage(event) {
    // 1. Handle Binary Preview (Live rendering)
    if (event.data instanceof Blob) {
        const url = URL.createObjectURL(event.data);
        const img = document.getElementById('comfyLivePreview');
        if(img) {
            img.src = url;
            img.style.opacity = 1.0;
        }
        return;
    }

    try {
        const msg = JSON.parse(event.data);
        
        // 2. Progress Bar
        if (msg.type === 'progress') {
            const val = msg.data.value;
            const max = msg.data.max;
            const percent = (val / max) * 100;
            const bar = document.getElementById('comfyProgressBar');
            const txt = document.getElementById('comfyProgressText');
            
            if(bar) bar.style.width = percent + "%";
            if(txt) txt.innerText = `STEP ${val} / ${max}`;
        }

        // 3. EXECUTED: An image (intermediate or final) is ready
        // We DO NOT reset the button here. We just add it to the strip.
        if (msg.type === 'executed') {
            if (msg.data.output && msg.data.output.images) {
                const imgData = msg.data.output.images[0];
                const finalUrl = `http://${comfyHost}/view?filename=${imgData.filename}&subfolder=${imgData.subfolder}&type=${imgData.type}`;
                
                // A. Add to Buffer (For Auto-Save later)
                comfyRunBuffer.push(finalUrl);

                // B. Add to ComfyUI Strip (Visual only)
                const gallery = document.getElementById('comfyGalleryContainer');
                if(gallery) {
                    const div = document.createElement('div');
                    div.className = 'gallery-item';
                    
                    div.innerHTML = `
                        <img src="${finalUrl}">
                        <div class="gallery-tag">OUTPUT ${gallery.children.length + 1}</div>
                    `;
                    
                    // Add Click Handler for Selection Logic
                    div.onclick = (e) => handleComfyItemClick(div, finalUrl);
                    
                    gallery.appendChild(div);
                }

                // Update live preview to show the latest result
                const liveImg = document.getElementById('comfyLivePreview');
                if(liveImg) {
                    liveImg.src = finalUrl;
                    liveImg.style.opacity = 1.0;
                }
            }
        }

        // 4. EXECUTION SUCCESS: The WHOLE workflow is done 
        // This corresponds to the protocol where 'execution_success' marks the end of the prompt_id lifecycle.
        if (msg.type === 'execution_success') {
            isComfyGenerating = false;
            const bar = document.getElementById('comfyProgressBar');
            const txt = document.getElementById('comfyProgressText');
            const btn = document.getElementById('comfyQueueBtn');
            
            if(bar) bar.style.width = "100%";
            if(txt) txt.innerText = "COMPLETE";
            if (window.ResolverService) {
                try {
                    window.ResolverService.stop();
                } catch (e) {}
            } else if (window.Capacitor && window.Capacitor.Plugins.ResolverService) {
                try {
                     window.Capacitor.Plugins.ResolverService.stop();
                } catch (e) {}
            }

            // 2. SEND THE FINAL ALERT
            // This makes the sound and says "ComfyUI Generation Complete"
            if (typeof sendCompletionNotification === 'function') {
                sendCompletionNotification("ComfyUI Generation Complete");
            }
            
            // Re-enable Button
            if(btn) {
                btn.disabled = false;
                btn.innerHTML = `<i data-lucide="play"></i> GENERATE`;
                if(window.lucide) lucide.createIcons();
            }

            // AUTO-SAVE: Save ONLY the LAST image from the buffer to History
            if (comfyRunBuffer.length > 0) {
                const lastImage = comfyRunBuffer[comfyRunBuffer.length - 1];
                saveComfyToMainGallery(lastImage);
                console.log("Auto-saved final image:", lastImage);
            }
        }

    } catch (e) {
        // console.warn(e);
    }
}

function saveComfyToMainGallery(url) {
    const xhr = new XMLHttpRequest();
    xhr.onload = function() {
        const reader = new FileReader();
        reader.onloadend = function() {
            // FIX: We use the 'db' variable that is already open at version 2
            if (!db) {
                console.error("Database connection not ready");
                return;
            }

            try {
                const tx = db.transaction(["images"], "readwrite");
                const store = tx.objectStore("images");
                store.add({
                    data: reader.result,
                    date: new Date().toLocaleString()
                });
                console.log("Saved to Gallery Successfully!");

                // This tells the GAL tab to refresh so you see the image immediately
                if (typeof loadGallery === 'function') loadGallery();
                
            } catch (e) {
                console.error("Database Error:", e);
            }
        };
        reader.readAsDataURL(xhr.response);
    };
    xhr.open('GET', url);
    xhr.responseType = 'blob';
    xhr.send();
}

// --- 6. UTILITIES: VIEW & FORCE DOWNLOAD ---

function viewComfyImage(url) {
    const modal = document.getElementById('fullScreenModal');
    const img = document.getElementById('fsImage');
    
    if (modal && img) {
        img.src = url;
        modal.classList.remove('hidden');
        
        // 1. Hide arrows (No navigation for strip images)
        const arrows = modal.querySelectorAll('.nav-arrow');
        arrows.forEach(el => el.style.display = 'none');
        
        // 2. Override Download Button for Cross-Origin logic
        const dlBtn = modal.querySelector('button[onclick="downloadCurrent()"]');
        if (dlBtn) {
            dlBtn.dataset.originalClick = dlBtn.getAttribute('onclick');
            dlBtn.removeAttribute('onclick');
            dlBtn.onclick = () => forceComfyDownload(url);
        }

        // 3. Setup cleanup (Restores normal gallery function)
        const closeBtn = modal.querySelector('.lightbox-controls button');
        if(closeBtn) {
            const cleanup = () => {
                arrows.forEach(el => el.style.display = ''); 
                
                if (dlBtn && dlBtn.dataset.originalClick) {
                    dlBtn.onclick = null;
                    dlBtn.setAttribute('onclick', dlBtn.dataset.originalClick);
                }
                
                closeBtn.removeEventListener('click', cleanup);
            };
            closeBtn.addEventListener('click', cleanup);
        }
    }
}

function forceComfyDownload(url) {
    const filename = "comfy_" + new Date().getTime() + ".png";
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    
    xhr.onload = function() {
        if (this.status === 200) {
            const blob = this.response;

            // FIX: Check if we are native (Android)
            const isNative = window.Capacitor && window.Capacitor.isNative;

            if (isNative && typeof saveToMobileGallery === 'function') {
                // 1. Convert Blob to Base64
                const reader = new FileReader();
                reader.onloadend = function() {
                    // 2. Pass to your existing utils.js helper
                    saveToMobileGallery(reader.result);
                }
                reader.readAsDataURL(blob);
            } else {
                // Fallback: Standard Web Browser Download
                const blobUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = blobUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(blobUrl);
                }, 100);
            }
        }
    };
    
    xhr.onerror = () => alert("Download Error: Check Connection or CORS");
    xhr.send();
}

// --- 7. CLEAR UI ---
function clearComfyResults() {
    const gallery = document.getElementById('comfyGalleryContainer');
    if (gallery) gallery.innerHTML = "";
    
    const preview = document.getElementById('comfyLivePreview');
    if (preview) {
        preview.src = "";
        preview.style.opacity = 0.3;
    }
    
    const bar = document.getElementById('comfyProgressBar');
    if (bar) bar.style.width = "0%";
    
    const txt = document.getElementById('comfyProgressText');
    if (txt) txt.innerText = "IDLE";
    
    // Clear new buffers
    comfyRunBuffer = []; 
    
    // Force exit selection mode if active
    if(isComfySelectionMode) toggleComfySelectionMode();
}

// --- NEW SELECTION FUNCTIONS ---

function toggleComfySelectionMode() {
    isComfySelectionMode = !isComfySelectionMode;
    const gallery = document.getElementById('comfyGalleryContainer');
    const selectBtn = document.getElementById('comfySelectBtn');
    const saveBtn = document.getElementById('comfySaveSelectedBtn');

    // 1. Toggle the CSS class (This uses your new style.css rules)
    selectBtn.classList.toggle('active', isComfySelectionMode);
    
    // 2. Toggle the text
    selectBtn.innerText = isComfySelectionMode ? "CANCEL" : "SELECT";
    
    if (isComfySelectionMode) {
        gallery.classList.add('selection-mode');
        selectedComfyImages.clear();
        updateComfySelectionUI();
    } else {
        gallery.classList.remove('selection-mode');
        Array.from(gallery.children).forEach(el => el.classList.remove('selected'));
        saveBtn.classList.add('hidden');
    }
}

function handleComfyItemClick(element, url) {
    if (isComfySelectionMode) {
        // Use the DOM Element as the key (Always Unique)
        if (selectedComfyImages.has(element)) {
            // Deselect
            selectedComfyImages.delete(element);
            element.classList.remove('selected');
        } else {
            // Select
            selectedComfyImages.set(element, url);
            element.classList.add('selected');
        }
        updateComfySelectionUI();
    } else {
        // Standard View Mode (Fullscreen)
        viewComfyImage(url);
    }
}

function updateComfySelectionUI() {
    const saveBtn = document.getElementById('comfySaveSelectedBtn');
    const countSpan = document.getElementById('comfySelCount');
    
    countSpan.innerText = selectedComfyImages.size;
    
    // Only show SAVE button if at least 1 image is selected
    if (selectedComfyImages.size > 0) {
        saveBtn.classList.remove('hidden');
    } else {
        saveBtn.classList.add('hidden');
    }
}

function saveSelectedComfyImages() {
    if (selectedComfyImages.size === 0) return;
    
    // Iterate over the Map values (the URLs)
    for (const url of selectedComfyImages.values()) {
        saveComfyToMainGallery(url);
    }
    
    // Visual Feedback
    const btn = document.getElementById('comfySaveSelectedBtn');
    const originalText = btn.innerHTML;
    btn.innerText = "SAVED!";
    
    setTimeout(() => {
        // Exit selection mode automatically after saving
        toggleComfySelectionMode();
        btn.innerHTML = originalText;
    }, 1000);
}


// 1. Function to actually put the file in the database
function saveTemplateToDB(name, json) {
    if (!db) return;
    const tx = db.transaction(["comfy_templates"], "readwrite");
    const store = tx.objectStore("comfy_templates");
    store.put({ name: name, data: json, date: new Date().toLocaleString() });
}

// 2. Open the popup and show the list
async function openComfyTemplateModal() {
    document.getElementById('comfyTemplateModal').classList.remove('hidden');
    renderTemplateList();
    if(window.lucide) lucide.createIcons();
}

// 3. Close the popup and reset settings
function closeComfyTemplateModal() {
    document.getElementById('comfyTemplateModal').classList.add('hidden');
    isTmplSelectionMode = false;
    selectedTemplates.clear();
    const btn = document.getElementById('tmplSelectBtn');
    btn.innerText = "SELECT";
    document.getElementById('tmplDeleteBtn').classList.add('hidden');
}

// 4. Create the list items you see on screen
async function renderTemplateList() {
    const list = document.getElementById('tmplList');
    list.innerHTML = "";
    
    if (!db) return;
    const tx = db.transaction(["comfy_templates"], "readonly");
    const store = tx.objectStore("comfy_templates");
    
    // Get everything from the box
    store.getAll().onsuccess = (e) => {
        const all = e.target.result;
        
        if (all.length === 0) {
            list.innerHTML = '<div style="text-align:center; color:var(--text-muted); margin-top:20px;">No templates saved yet.</div>';
            return;
        }

        all.forEach(tmpl => {
            const div = document.createElement('div');
            // If it's selected, give it the 'selected' look from your CSS
            div.className = `tmpl-item ${selectedTemplates.has(tmpl.name) ? 'selected' : ''}`;
            div.style.marginBottom = "8px"; 
            
            div.innerHTML = `
                <div class="tmpl-info">
                    <span class="tmpl-name">${tmpl.name}</span>
                    <span style="font-size:9px; color:var(--text-muted);">${tmpl.date}</span>
                </div>
                ${selectedTemplates.has(tmpl.name) ? '<i data-lucide="check-circle" size="14" style="color:var(--error);"></i>' : ''}
            `;
            
            div.onclick = () => handleTmplClick(tmpl);
            list.appendChild(div);
        });
        if(window.lucide) lucide.createIcons();
    };
}

// 5. What happens when you tap a template in the list
function handleTmplClick(tmpl) {
    if (isTmplSelectionMode) {
        // Just highlight/unhighlight if we are in deleting mode
        if (selectedTemplates.has(tmpl.name)) {
            selectedTemplates.delete(tmpl.name);
        } else {
            selectedTemplates.add(tmpl.name);
        }
        updateTmplUI();
    } else {
        // Actually LOAD the template if we are in normal mode
        try {
            comfyLoadedWorkflow = JSON.parse(tmpl.data);
            document.getElementById('comfyLoadedFileName').innerText = tmpl.name;
            buildComfyUI(comfyLoadedWorkflow);
            
            // Re-enable generate button if connected
            if (comfySocket && comfySocket.readyState === WebSocket.OPEN) {
                document.getElementById('comfyQueueBtn').disabled = false;
            }
            
            closeComfyTemplateModal();
        } catch (e) {
            alert("Error loading template: " + e.message);
        }
    }
}

// 6. Turn selection mode ON or OFF
function toggleTmplSelectionMode() {
    isTmplSelectionMode = !isTmplSelectionMode;
    const btn = document.getElementById('tmplSelectBtn');
    
    if (isTmplSelectionMode) {
        // We only change the text and add the CSS class
        btn.innerText = "CANCEL";
        btn.classList.add('btn-cancel-active');
    } else {
        // We change the text back and remove the CSS class
        btn.innerText = "SELECT";
        btn.classList.remove('btn-cancel-active');
        selectedTemplates.clear();
    }
    updateTmplUI();
}

// 7. Refresh the screen and show/hide the Delete button
function updateTmplUI() {
    renderTemplateList();
    const count = selectedTemplates.size;
    document.getElementById('tmplSelCount').innerText = count;
    
    const delBtn = document.getElementById('tmplDeleteBtn');
    if (count > 0 && isTmplSelectionMode) {
        delBtn.classList.remove('hidden');
    } else {
        delBtn.classList.add('hidden');
    }
}

// 8. Delete only the ones you checked
function deleteSelectedTemplates() {
    if (selectedTemplates.size === 0) return;
    
    if (confirm(`Delete ${selectedTemplates.size} selected templates?`)) {
        const tx = db.transaction(["comfy_templates"], "readwrite");
        const store = tx.objectStore("comfy_templates");
        
        selectedTemplates.forEach(name => {
            store.delete(name);
        });
        
        tx.oncomplete = () => {
            selectedTemplates.clear();
            isTmplSelectionMode = false;
            updateTmplUI();
            const btn = document.getElementById('tmplSelectBtn');
            btn.innerText = "SELECT";
            btn.style.background = "";
            btn.style.color = "";
        };
    }
}

// 9. Wipe everything
function clearAllTemplates() {
    if (confirm("Delete ALL saved templates? This cannot be undone.")) {
        const tx = db.transaction(["comfy_templates"], "readwrite");
        tx.objectStore("comfy_templates").clear();
        tx.oncomplete = () => {
            selectedTemplates.clear();
            isTmplSelectionMode = false;
            renderTemplateList();
            updateTmplUI();
        };
    }
}

// Function to import many JSON files at once
// Upgraded Import Function
async function importMultipleTemplates(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Create a list of "tasks" for every file
    const tasks = Array.from(files).map(file => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const jsonStr = e.target.result;
                    JSON.parse(jsonStr); // Check if it's a real workflow
                    saveTemplateToDB(file.name.toUpperCase(), jsonStr);
                } catch (err) {
                    console.error("Skipped bad file: " + file.name);
                }
                resolve(); // Always finish, even if the file was bad
            };
            reader.readAsText(file);
        });
    });

    // Wait for ALL files to finish loading
    await Promise.all(tasks);
    
    // Refresh the list once at the end
    renderTemplateList();
    
    // Clear the button so you can import again
    event.target.value = ""; 
    
    if(typeof Toast !== 'undefined') {
        Toast.show({ text: `Import process complete`, duration: 'short' });
    }
}

// --- NEW MASKING FUNCTIONS (ROBUST TAB SWITCH) ---

// --- NEW MASKING FUNCTIONS (ROBUST TAB SWITCH) ---

let comfyBaseImage = null; // Stores the clean, original image without orange lines

function startComfyMasking(nodeId) {
    // 1. Get the image filename from the node
    const node = comfyLoadedWorkflow[nodeId];
    const currentImageName = node.inputs.image;
    
    if (!currentImageName) {
        alert("Please upload a base image first!");
        return;
    }

    // 2. Set Global Flags
    isComfyMaskingMode = true;
    comfyMaskTargetNodeId = nodeId;

    // 3. Switch to the Inpaint Tab
    if(typeof switchTab === 'function') switchTab('inp');
    
    // 4. UI Hacking: Hide normal buttons
    const view = document.getElementById('view-inp');
    view.classList.add('comfy-mode-active'); 
    
    document.getElementById('img-input-container').classList.add('hidden');
    document.getElementById('canvasWrapper').classList.remove('hidden');

    // 5. Create the "APPLY MASK" Toolbar
    let comfyBar = document.getElementById('comfy-mask-bar');
    if (!comfyBar) {
        comfyBar = document.createElement('div');
        comfyBar.id = 'comfy-mask-bar';
        comfyBar.className = 'glass-box';
        comfyBar.style.cssText = "margin-top:10px; background:var(--accent-secondary); border:1px solid var(--accent-primary);";
        comfyBar.innerHTML = `
            <div class="row" style="justify-content:space-between; align-items:center;">
                <label style="color:white; font-weight:900;"><i data-lucide="brush"></i> MASK EDITING</label>
                <div class="row" style="width:auto; gap:10px;">
                    <button class="btn-small" onclick="cancelComfyMasking()" style="background:rgba(0,0,0,0.2);">CANCEL</button>
                    <button class="btn-small" onclick="finishComfyMasking()" style="background:white; color:var(--accent-secondary); font-weight:900;">APPLY MASK</button>
                </div>
            </div>
        `;
        const canvasWrap = document.getElementById('canvasWrapper');
        canvasWrap.insertBefore(comfyBar, canvasWrap.firstChild);
    }
    comfyBar.classList.remove('hidden');

    // 6. Load the Image
    const imageUrl = `http://${comfyHost}/view?filename=${currentImageName}&type=input`;
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageUrl;
    
    img.onload = () => {
        // STORE THE CLEAN IMAGE GLOBALLLY
        comfyBaseImage = img;

        const canvas = document.getElementById('paintCanvas');
        const ctx = canvas.getContext('2d');
        
        // Resize canvases
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Update Globals for the engine
        if (typeof mainCanvas !== 'undefined') {
            mainCanvas = canvas;
            mainCtx = ctx;
        }
        
        // Draw image on the visual canvas (for user to see)
        ctx.drawImage(img, 0, 0);
        
        // SETUP THE MASK CANVAS (The invisible one)
        // This is where the magic happens. We clear it to transparent.
        // Your engine.js will draw strokes here when you drag your finger.
        if (typeof maskCanvas !== 'undefined' && maskCanvas) {
            maskCanvas.width = img.width;
            maskCanvas.height = img.height;
            const mCtx = maskCanvas.getContext('2d');
            mCtx.clearRect(0,0, maskCanvas.width, maskCanvas.height);
        }
        
        if(window.lucide) lucide.createIcons();
    };
}

function cancelComfyMasking() {
    isComfyMaskingMode = false;
    comfyMaskTargetNodeId = null;
    comfyBaseImage = null; // Clear memory
    
    // 1. Remove the special CSS class
    document.getElementById('view-inp').classList.remove('comfy-mode-active');
    
    // 2. Hide the Comfy Toolbar
    const bar = document.getElementById('comfy-mask-bar');
    if(bar) bar.classList.add('hidden');
    
    // 3. CLEAN THE CANVAS
    const canvas = document.getElementById('paintCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (typeof maskCanvas !== 'undefined' && maskCanvas) {
        const mCtx = maskCanvas.getContext('2d');
        mCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    }

    // 4. RESET UI STATE (Fix for the "Giant Black Image")
    // Hide the canvas wrapper
    document.getElementById('canvasWrapper').classList.add('hidden');
    // Show the original "Upload Box"
    document.getElementById('img-input-container').classList.remove('hidden');

    // 5. Switch back to Comfy Tab
    if(typeof switchTab === 'function') switchTab('comfy');
}

async function finishComfyMasking() {
    if (!comfyBaseImage) {
        alert("Error: Base image lost.");
        return;
    }

    // 1. Create Composite (Clean Image + Transparent Holes)
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = comfyBaseImage.width;
    tempCanvas.height = comfyBaseImage.height;
    const ctx = tempCanvas.getContext('2d');

    ctx.drawImage(comfyBaseImage, 0, 0);

    if (typeof maskCanvas !== 'undefined') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.drawImage(maskCanvas, 0, 0);
    }

    // 2. Upload
    tempCanvas.toBlob(async (blob) => {
        const btn = document.querySelector('#comfy-mask-bar button:last-child');
        const oldText = btn.innerText;
        btn.innerText = "UPLOADING...";

        const formData = new FormData();
        const filename = `mask_edit_${Date.now()}.png`;
        formData.append("image", blob, filename);
        formData.append("overwrite", "true");

        try {
            const resp = await fetch(`http://${comfyHost}/upload/image`, {
                method: 'POST',
                body: formData
            });
            const data = await resp.json();

            // 3. Update Comfy Node Logic
            updateComfyValue(comfyMaskTargetNodeId, 'image', data.name);
            
            // 4. Update UI Visuals (Thumbnail & Label)
            const thumbImg = document.getElementById(`thumb_${comfyMaskTargetNodeId}`);
            const labelSpan = document.getElementById(`label_${comfyMaskTargetNodeId}`);
            
            if (thumbImg) {
                thumbImg.src = `http://${comfyHost}/view?filename=${data.name}&type=input&t=${Date.now()}`;
                thumbImg.style.display = 'block';
            }
            // THIS FIXES THE "NO IMAGE CHOSEN" ISSUE
            if (labelSpan) {
                labelSpan.innerText = data.name; 
            }
            
            btn.innerText = oldText;
            
            // 5. Cleanup & Return (Clears canvas via cancel function)
            cancelComfyMasking(); 

        } catch (e) {
            alert("Upload Failed: " + e.message);
            btn.innerText = oldText;
        }
    }, 'image/png');
}

// 8. AUTO-INIT ON LOAD
document.addEventListener('DOMContentLoaded', restoreComfySession);
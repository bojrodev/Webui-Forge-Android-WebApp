// --- INITIALIZATION ---
const iconEl = document.getElementById('apple-icon');
if (iconEl) {
    const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="100" fill="#1e1e1e"/><path d="M140 370 L372 370 L372 310 L300 310 L300 200 L372 200 L372 140 L140 140 Z" fill="#ff9800"/><path d="M200 140 L200 100 L312 100 L312 140" fill="#ff9800"/></svg>`;
    iconEl.href = URL.createObjectURL(new Blob([iconSvg], { type: 'image/svg+xml' }));
}

const manifestEl = document.querySelector('#dynamic-manifest');
if (manifestEl && iconEl) {
    const manifest = { "name": "Bojro Resolver", "short_name": "Bojro", "start_url": ".", "display": "standalone", "background_color": "#121212", "theme_color": "#121212", "orientation": "portrait", "icons": [{ "src": iconEl.href, "sizes": "512x512", "type": "image/svg+xml" }] };
    manifestEl.href = URL.createObjectURL(new Blob([JSON.stringify(manifest)], {type: 'application/json'}));
}

// --- UI TABS ---
function switchTab(view) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('[id^="view-"]').forEach(v => v.classList.add('hidden'));
    document.getElementById('view-' + view).classList.remove('hidden');
    
    if(view === 'gen') document.querySelectorAll('.tab')[0].classList.add('active');
    if(view === 'vae') document.querySelectorAll('.tab')[1].classList.add('active');
    if(view === 'ana') document.querySelectorAll('.tab')[2].classList.add('active');
}

function toggleVaeMode() {
    const select = document.getElementById('vaeSelect');
    const input = document.getElementById('vaeInput');
    if(select.classList.contains('hidden')) {
        select.classList.remove('hidden'); input.classList.add('hidden');
    } else {
        select.classList.add('hidden'); input.classList.remove('hidden');
    }
}

// --- LORA MODAL ---
let allLoras = []; 
function openLoraModal() { document.getElementById('loraModal').classList.remove('hidden'); document.getElementById('loraSearch').focus(); }
function closeLoraModal() { document.getElementById('loraModal').classList.add('hidden'); }
function filterLoras() {
    const term = document.getElementById('loraSearch').value.toLowerCase();
    const list = document.getElementById('loraVerticalList');
    list.innerHTML = "";
    allLoras.forEach(l => {
        if(l.name.toLowerCase().includes(term)) {
            const row = document.createElement('div');
            row.className = 'lora-row';
            row.innerHTML = `<span>${l.name}</span> <span style="font-size:20px;">+</span>`;
            row.onclick = () => {
                const box = document.getElementById('prompt');
                if(!box.value.includes(`:1>`)) box.value += ` <lora:${l.name}:1>`;
                window.closeLoraModal();
            };
            list.appendChild(row);
        }
    });
}

// --- CONNECTION ---
let HOST = "";
window.connect = async function() {
    HOST = document.getElementById('hostIp').value.replace(/\/$/, ""); 
    const dot = document.getElementById('statusDot');
    dot.style.background = "yellow"; 

    try {
        const res = await fetch(`${HOST}/sdapi/v1/sd-models`);
        if (!res.ok) throw new Error("Status: " + res.status);

        dot.classList.remove('err');
        dot.classList.add('on');
        dot.style.background = "#00e676"; // Green

        document.getElementById('genBtn').disabled = false;
        fetchModels(); fetchSamplers(); fetchLoras(); fetchVAEs();
        alert("SUCCESS: Connected to Forge!");
    } catch (e) {
        dot.classList.add('err');
        dot.style.background = "#f44336"; 
        alert("Connection Failed: " + e.message);
    }
}

async function fetchModels() {
    try {
        const res = await fetch(`${HOST}/sdapi/v1/sd-models`);
        const models = await res.json();
        const select = document.getElementById('modelSelect');
        select.innerHTML = "";
        models.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.title; opt.text = m.model_name;
            select.appendChild(opt);
        });
        window.setDefaultModel();
    } catch(e) {}
}
async function fetchSamplers() {
    try {
        const res = await fetch(`${HOST}/sdapi/v1/samplers`);
        const samplers = await res.json();
        const select = document.getElementById('samplerSelect');
        select.innerHTML = "";
        samplers.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.name; opt.text = s.name;
            if(s.name === "Euler a") opt.selected = true;
            select.appendChild(opt);
        });
    } catch(e) {}
}
async function fetchLoras() {
    try {
        const res = await fetch(`${HOST}/sdapi/v1/loras`);
        allLoras = await res.json();
        window.filterLoras();
    } catch(e){}
}
async function fetchVAEs() {
    try {
        const res = await fetch(`${HOST}/sdapi/v1/sd-vae`);
        const vaes = await res.json();
        const select = document.getElementById('vaeSelect');
        select.innerHTML = "<option>Automatic</option><option>None</option>";
        vaes.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.model_name; opt.text = v.model_name;
            select.appendChild(opt);
        });
    } catch(e){}
}

// --- SIDEBAR VAE ---
let selectedFiles = new Set();
async function fetchSidecarVAEs() {
    const list = document.getElementById('vaeFileList');
    const ip = document.getElementById('hostIp').value.replace(/\/$/, "").split(":")[1].replace("//", "");
    const sidecarUrl = `http://${ip}:5000`; 
    list.innerHTML = "<div style='text-align:center; color:#666;'>Scanning E:\\...</div>";
    try {
        const res = await fetch(sidecarUrl);
        const files = await res.json();
        list.innerHTML = "";
        selectedFiles.clear();
        updateSelectBar();
        if(files.length === 0 || files[0].startsWith("Error")) {
           list.innerHTML = "<div style='color:red; text-align:center;'>No VAEs found or Error</div>"; return;
        }
        files.forEach(f => {
            const item = document.createElement('div');
            item.className = 'vae-item';
            item.onclick = () => toggleSelection(f, item);
            item.innerHTML = `<div class="vae-check"></div><div class="vae-name">${f}</div>`;
            list.appendChild(item);
        });
    } catch (e) { list.innerHTML = "<div style='color:red; text-align:center;'>Sidecar unreachable</div>"; }
}

function toggleSelection(name, el) {
    if(selectedFiles.has(name)) { selectedFiles.delete(name); el.classList.remove('selected'); } 
    else { selectedFiles.add(name); el.classList.add('selected'); }
    updateSelectBar();
}

function updateSelectBar() {
    const bar = document.getElementById('multiSelectBar');
    const count = document.getElementById('selectCount');
    if(selectedFiles.size > 0) { bar.classList.remove('hidden'); count.innerText = selectedFiles.size + " Selected"; } 
    else { bar.classList.add('hidden'); }
}

function copyJoined() {
    const joined = Array.from(selectedFiles).join(" ");
    const input = document.getElementById('vaeInput');
    input.value = joined;
    document.getElementById('vaeSelect').classList.add('hidden');
    input.classList.remove('hidden');
    alert("Copied " + selectedFiles.size + " files to Text Mode!");
    switchTab('gen');
}

window.changeModel = function() { postOption({ "sd_model_checkpoint": document.getElementById('modelSelect').value }, "LOADING MODEL..."); }
window.changeVAE = function() { 
    const select = document.getElementById('vaeSelect');
    const input = document.getElementById('vaeInput');
    const val = select.classList.contains('hidden') ? input.value : select.value;
    postOption({ "sd_vae": val }, "SWAPPING VAE...");
}
window.changeBits = function() { postOption({ "forge_unet_storage_dtype": document.getElementById('bitSelect').value }, "CHANGING BITS..."); }

async function postOption(payload, msg) {
    const btn = document.getElementById('genBtn');
    if(msg) { btn.innerText = msg; btn.disabled = true; }
    try {
        await fetch(`${HOST}/sdapi/v1/options`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (e) { console.error(e); }
    if(msg) { btn.innerText = "GENERATE"; btn.disabled = false; }
}

window.setDefaultModel = function() {
    const val = localStorage.getItem('defaultBojroModel');
    if(val) {
        const select = document.getElementById('modelSelect');
        if(Array.from(select.options).some(o=>o.value===val)) select.value = val;
    }
}

// --- GENERATION ---
window.generate = async function() {
    const btn = document.getElementById('genBtn');
    const spinner = document.getElementById('loadingSpinner');
    const gallery = document.getElementById('gallery');
    const metaDiv = document.getElementById('metaData');
    const dlBtn = document.getElementById('dlBtn');

    btn.disabled = true; btn.innerText = "PROCESSING...";
    dlBtn.classList.add('hidden');
    const oldImages = gallery.querySelectorAll('.gen-result');
    oldImages.forEach(img => img.remove());
    spinner.style.display = 'block'; 
    metaDiv.classList.add('hidden');

    try {
        const seedVal = parseInt(document.getElementById('seed').value);
        const payload = {
            "prompt": document.getElementById('prompt').value,
            "negative_prompt": document.getElementById('neg').value,
            "steps": parseInt(document.getElementById('steps').value),
            "cfg_scale": parseFloat(document.getElementById('cfg').value),
            "width": parseInt(document.getElementById('width').value),
            "height": parseInt(document.getElementById('height').value),
            "batch_size": parseInt(document.getElementById('batchSize').value),
            "n_iter": parseInt(document.getElementById('batchCount').value),
            "sampler_name": document.getElementById('samplerSelect').value,
            "scheduler": document.getElementById('schedulerSelect').value,
            "seed": seedVal,
            "save_images": true
        };

        const res = await fetch(`${HOST}/sdapi/v1/txt2img`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if(!res.ok) throw new Error("Gen Error: " + res.status);
        const data = await res.json();
        
        if (data.images) {
            data.images.forEach(b64 => {
                const img = document.createElement('img');
                img.src = "data:image/png;base64," + b64;
                img.className = 'gen-result';
                gallery.appendChild(img);
            });
            dlBtn.classList.remove('hidden');
            
            const autoCheck = document.getElementById('autoDlCheck');
            if(autoCheck && autoCheck.checked) setTimeout(window.downloadResults, 500); 
            
            if(data.info) {
                const info = JSON.parse(data.info);
                metaDiv.innerText = `Seed: ${info.seed}\nModel: ${info.sd_model_name}\nSampler: ${payload.sampler_name}`;
                metaDiv.classList.remove('hidden');
            }
        }
    } catch (e) { alert("Generation Failed:\n" + e.message); }
    
    spinner.style.display = 'none'; 
    btn.disabled = false; 
    btn.innerText = "GENERATE";
}

// --- METADATA PRESERVING DOWNLOADER ---
window.downloadResults = async function() {
    const images = document.querySelectorAll('.gen-result');
    if(images.length === 0) return alert("No images to download!");
    
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19); 
    
    for (let i = 0; i < images.length; i++) {
        const img = images[i];
        
        try {
            // 1. Fetch ORIGINAL Blob (Preserves Metadata)
            const res = await fetch(img.src);
            const blob = await res.blob();
            
            // 2. Create Filename
            const filename = `Strateon_${timestamp}_${i + 1}.png`;
            
            // 3. Create File Object (Helps some browsers respect name)
            const file = new File([blob], filename, { type: "image/png" });
            
            // 4. Download Link
            const blobUrl = URL.createObjectURL(file);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
            
        } catch (e) {
            alert("Save Failed: " + e.message);
        }
    }
}

// --- ANALYZER (Fixed Scope) ---
function gcd(a, b) { return b ? gcd(b, a % b) : a; }

window.handleFileSelect = function(event) {
    const previewEl = document.getElementById('anaPreview');
    const metaEl = document.getElementById('anaMeta');
    const file = event.target.files[0];
    if (!file) return;

    metaEl.innerText = "Analyzing...";
    document.getElementById('dateOut').innerText = new Date(file.lastModified).toLocaleString();

    const img = new Image();
    img.onload = () => {
        const w = img.width, h = img.height, d = gcd(w, h);
        document.getElementById('resOut').innerText = `${w} x ${h}`;
        document.getElementById('arOut').innerText = `${w/d}:${h/d}`;
        previewEl.src = img.src;
        document.getElementById('anaGallery').classList.remove('hidden');
    };
    img.src = URL.createObjectURL(file);
    extractMetadata(file);
}

async function extractMetadata(file) {
    const metaEl = document.getElementById('anaMeta');
    const decoder = new TextDecoder('utf-8');
    const buffer = await file.arrayBuffer();
    const dataView = new DataView(buffer);
    let offset = 8, metadata = [];
    
    while (offset < buffer.byteLength) {
        try {
            const len = dataView.getUint32(offset, false);
            const type = decoder.decode(new Uint8Array(buffer, offset + 4, 4));
            if (type === 'tEXt' || type === 'iTXt') {
                const data = new Uint8Array(buffer, offset + 8, len);
                let keyEnd = data.indexOf(0x00);
                let contentStart = keyEnd + 1;
                if(type==='iTXt') { contentStart+=2; contentStart = data.indexOf(0x00, contentStart) + 1; contentStart = data.indexOf(0x00, contentStart) + 1; }
                metadata.push(decoder.decode(data.slice(contentStart)));
            }
            offset += len + 12;
        } catch (e) { break; }
    }
    
    if (metadata.length > 0) metaEl.innerText = metadata.join('\n\n');
    else {
        // Fallback for Automatic1111 'parameters' text
        const view = new Uint8Array(buffer);
        const idx = findBytes(view, new TextEncoder().encode('parameters'));
        if(idx !== -1) {
            let text = decoder.decode(view.subarray(idx, Math.min(view.length, idx + 2000)));
            metaEl.innerText = text.replace(/[^\x20-\x7E\n]/g, '');
        } else metaEl.innerText = "No metadata found.";
    }
}
function findBytes(h, n) { for(let i=0;i<h.length-n.length;i++){let f=true;for(let j=0;j<n.length;j++)if(h[i+j]!==n[j]){f=false;break;}if(f)return i;}return -1;}

// --- LISTENERS ---
const uploadBox = document.getElementById('uploadBox');
if (uploadBox) {
    uploadBox.addEventListener('drop', (e) => { document.getElementById('imageUpload').files = e.dataTransfer.files; window.handleFileSelect({ target: { files: e.dataTransfer.files } }); });
}

function loadAutoDlState() {
    const autoCheck = document.getElementById('autoDlCheck');
    if (autoCheck) autoCheck.checked = localStorage.getItem('bojroAutoSave') === 'true';
}
window.saveAutoDlState = function() {
    localStorage.setItem('bojroAutoSave', document.getElementById('autoDlCheck').checked);
}
loadAutoDlState();
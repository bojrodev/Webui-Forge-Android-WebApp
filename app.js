// --- PWA & UI ---
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="100" fill="#1e1e1e"/><path d="M140 370 L372 370 L372 310 L300 310 L300 200 L372 200 L372 140 L140 140 Z" fill="#ff9800"/><path d="M200 140 L200 100 L312 100 L312 140" fill="#ff9800"/></svg>`;
document.getElementById('apple-icon').href = URL.createObjectURL(new Blob([iconSvg], { type: 'image/svg+xml' }));
const manifest = { "name": "Bojro Resolver", "short_name": "Bojro", "start_url": ".", "display": "standalone", "background_color": "#121212", "theme_color": "#121212", "orientation": "portrait", "icons": [{ "src": document.getElementById('apple-icon').href, "sizes": "512x512", "type": "image/svg+xml" }] };
document.querySelector('#dynamic-manifest').href = URL.createObjectURL(new Blob([JSON.stringify(manifest)], {type: 'application/json'}));

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; document.getElementById('installBanner').classList.remove('hidden'); });
document.getElementById('installBanner').addEventListener('click', async () => { document.getElementById('installBanner').classList.add('hidden'); if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt = null; } });

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

// --- LORA MODAL LOGIC ---
let allLoras = []; 

function openLoraModal() {
    document.getElementById('loraModal').classList.remove('hidden');
    document.getElementById('loraSearch').focus();
}

function closeLoraModal() {
    document.getElementById('loraModal').classList.add('hidden');
}

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
                closeLoraModal();
            };
            list.appendChild(row);
        }
    });
}

// --- MULTI-SELECT VAE LOGIC ---
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
    } catch (e) { list.innerHTML = "<div style='color:red; text-align:center;'>Sidecar unreachable.</div>"; }
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

// --- GENERATOR LOGIC ---
let HOST = "";

async function connect() {
    HOST = document.getElementById('hostIp').value.replace(/\/$/, ""); 
    const dot = document.getElementById('statusDot');
    try {
        await fetch(`${HOST}/sdapi/v1/sd-models`);
        dot.classList.remove('err');
        dot.classList.add('on');
        document.getElementById('genBtn').disabled = false;
        fetchModels().catch(e => console.log(e));
        fetchSamplers().catch(e => console.log(e));
        fetchLoras().catch(e => console.log(e));
        fetchVAEs().catch(e => console.log("API VAE failed"));
    } catch (e) {
        dot.classList.add('err');
        alert("Connection failed! Check IP & Firewall.");
    }
}

async function fetchModels() {
    const res = await fetch(`${HOST}/sdapi/v1/sd-models`);
    const models = await res.json();
    const select = document.getElementById('modelSelect');
    select.innerHTML = "";
    models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.title; opt.text = m.model_name;
        select.appendChild(opt);
    });
    const def = localStorage.getItem('defaultBojroModel');
    if (def && Array.from(select.options).some(o => o.value === def)) { select.value = def; changeModel(true); }
}

async function fetchVAEs() {
    const select = document.getElementById('vaeSelect');
    select.innerHTML = "<option value='Automatic'>Automatic</option><option value='None'>None</option>";
    try {
        const res = await fetch(`${HOST}/sdapi/v1/sd-vae`);
        if(res.ok) {
            const vaes = await res.json();
            vaes.forEach(v => {
                const opt = document.createElement('option');
                const val = v.model_name || v.filename || v.name;
                if(val) { opt.value = val; opt.text = val; select.appendChild(opt); }
            });
        }
    } catch(e){}
}

async function fetchSamplers() {
    const select = document.getElementById('samplerSelect');
    try {
        const res = await fetch(`${HOST}/sdapi/v1/samplers`);
        const samplers = await res.json();
        select.innerHTML = "";
        samplers.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.name; opt.text = s.name;
            if(s.name === "Euler a" || s.name === "DPM++ 2M Karras") opt.selected = true;
            select.appendChild(opt);
        });
    } catch (e) { select.innerHTML = "<option>Euler a</option><option>DPM++ 2M Karras</option>"; }
}

async function fetchLoras() {
    try {
        const res = await fetch(`${HOST}/sdapi/v1/loras`);
        allLoras = await res.json(); // Store global for filtering
        filterLoras(); // Initial populate
    } catch (e) { console.log("LoRA fetch error"); }
}

async function changeModel(silent = false) {
    postOption({ "sd_model_checkpoint": document.getElementById('modelSelect').value }, silent ? null : "LOADING MODEL...");
}

async function changeVAE() {
    const select = document.getElementById('vaeSelect');
    const input = document.getElementById('vaeInput');
    const val = select.classList.contains('hidden') ? input.value : select.value;
    postOption({ "sd_vae": val }, "SWAPPING VAE...");
}

async function changeBits() {
    postOption({ "forge_unet_storage_dtype": document.getElementById('bitSelect').value }, "CHANGING BITS...");
}

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

function setDefaultModel() {
    if(document.getElementById('modelSelect').value) {
        localStorage.setItem('defaultBojroModel', document.getElementById('modelSelect').value);
        alert("Default Saved");
    }
}

// --- NEW DOWNLOAD FUNCTION ---
function downloadResults() {
    const images = document.querySelectorAll('.gen-result');
    if(images.length === 0) return alert("No images to download!");
    const timestamp = new Date().getTime();
    images.forEach((img, index) => {
        const link = document.createElement('a');
        link.href = img.src;
        link.download = `bojro_${timestamp}_${index + 1}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

// --- GENERATION ---
async function generate() {
    const btn = document.getElementById('genBtn');
    const spinner = document.getElementById('loadingSpinner');
    const gallery = document.getElementById('gallery');
    const metaDiv = document.getElementById('metaData');
    const dlBtn = document.getElementById('dlBtn');

    btn.disabled = true; btn.innerText = "PROCESSING...";
    dlBtn.classList.add('hidden');
    
    // Clear previous results
    const oldImages = gallery.querySelectorAll('.gen-result');
    oldImages.forEach(img => img.remove());
    
    spinner.style.display = 'block'; 
    metaDiv.classList.add('hidden');

    // READ SEED INPUT
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

    try {
        const res = await fetch(`${HOST}/sdapi/v1/txt2img`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (data.images) {
            data.images.forEach(b64 => {
                const img = document.createElement('img');
                img.src = "data:image/png;base64," + b64;
                img.className = 'gen-result';
                gallery.appendChild(img);
            });
            dlBtn.classList.remove('hidden');
            
            // --- AUTO DOWNLOAD CHECK ---
            if(document.getElementById('autoDlCheck').checked) {
                setTimeout(downloadResults, 200); 
            }
            
            if(data.info) {
                const info = JSON.parse(data.info);
                metaDiv.innerText = `Seed: ${info.seed}\nModel: ${info.sd_model_name}\nSampler: ${payload.sampler_name} (${payload.scheduler})`;
                metaDiv.classList.remove('hidden');
            }
        }
    } catch (e) { alert("Generation Error"); }
    
    spinner.style.display = 'none'; 
    btn.disabled = false; 
    btn.innerText = "GENERATE";
}

// --- ANALYZER ---
const uploadBox = document.getElementById('uploadBox');
function gcd(a, b) { return b ? gcd(b, a % b) : a; }

async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    document.getElementById('anaMeta').innerText = "Analyzing...";
    document.getElementById('dateOut').innerText = file.lastModifiedDate ? file.lastModifiedDate.toLocaleString() : new Date(file.lastModified).toLocaleString();
    const img = new Image();
    img.onload = () => {
        const w = img.width, h = img.height, d = gcd(w, h);
        document.getElementById('resOut').innerText = `${w} x ${h}`;
        document.getElementById('arOut').innerText = `${w/d}:${h/d}`;
        document.getElementById('anaPreview').src = img.src;
        document.getElementById('anaGallery').classList.remove('hidden');
    };
    img.src = URL.createObjectURL(file);
    extractMetadata(file);
}

async function extractMetadata(file) {
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
                const key = decoder.decode(data.slice(0, keyEnd));
                let contentStart = keyEnd + 1;
                if(type==='iTXt') { contentStart+=2; contentStart = data.indexOf(0x00, contentStart) + 1; contentStart = data.indexOf(0x00, contentStart) + 1; }
                metadata.push(`[${key}]\n${decoder.decode(data.slice(contentStart))}`);
            }
            offset += len + 12;
        } catch (e) { break; }
    }
    const out = document.getElementById('anaMeta');
    if (metadata.length > 0) out.innerText = metadata.join('\n\n---\n\n');
    else {
        const view = new Uint8Array(buffer);
        const idx = findBytes(view, new TextEncoder().encode('parameters'));
        if(idx !== -1) {
            let text = decoder.decode(view.subarray(idx, Math.min(view.length, idx + 2000)));
            out.innerText = "Raw Data Found:\n" + text.replace(/[^\x20-\x7E\n]/g, '');
        } else out.innerText = "No metadata found.";
    }
}
function findBytes(h, n) { for(let i=0;i<h.length-n.length;i++){let f=true;for(let j=0;j<n.length;j++)if(h[i+j]!==n[j]){f=false;break;}if(f)return i;}return -1;}

['dragenter', 'dragover'].forEach(e => uploadBox.addEventListener(e, (ev) => { ev.preventDefault(); uploadBox.classList.add('highlight'); }));
['dragleave', 'drop'].forEach(e => uploadBox.addEventListener(e, (ev) => { ev.preventDefault(); uploadBox.classList.remove('highlight'); }));
uploadBox.addEventListener('drop', (e) => { document.getElementById('imageUpload').files = e.dataTransfer.files; handleFileSelect({ target: { files: e.dataTransfer.files } }); });

// --- AUTO DOWNLOAD STATE MANAGEMENT ---
function loadAutoDlState() {
    const isAuto = localStorage.getItem('bojroAutoSave') === 'true';
    document.getElementById('autoDlCheck').checked = isAuto;
}

function saveAutoDlState() {
    const isChecked = document.getElementById('autoDlCheck').checked;
    localStorage.setItem('bojroAutoSave', isChecked);
}

// Initialize toggle state on load
loadAutoDlState();
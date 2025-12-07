        // Init Icons
        lucide.createIcons();

        // --- THEME LOGIC ---
        function toggleTheme() {
            const btn = document.getElementById('themeToggle');
            const root = document.documentElement;
            if (root.getAttribute('data-theme') === 'light') {
                root.removeAttribute('data-theme');
                btn.innerHTML = '<i data-lucide="sun"></i>';
                localStorage.setItem('bojroTheme', 'dark');
            } else {
                root.setAttribute('data-theme', 'light');
                btn.innerHTML = '<i data-lucide="moon"></i>';
                localStorage.setItem('bojroTheme', 'light');
            }
            lucide.createIcons();
        }
        if(localStorage.getItem('bojroTheme') === 'light') toggleTheme();

        // --- VISUAL ONLY: Update Magic Ball Position when Tabs Clicked ---
        // This is a UI helper that does not interfere with the core 'switchTab' logic.
        document.querySelectorAll('.tab').forEach((tab, index) => {
            tab.addEventListener('click', () => {
                document.getElementById('indicator').style.transform = `translateX(${index * 100}%)`;
            });
        });

        // --- ORIGINAL JAVASCRIPT (FUNCTIONALITY UNCHANGED) ---
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

        // --- DB & GALLERY ---
        let db;
        const request = indexedDB.open("BojroDB", 1);
        request.onupgradeneeded = function(event) {
            db = event.target.result;
            db.createObjectStore("images", { keyPath: "id", autoIncrement: true });
        };
        request.onsuccess = function(event) { db = event.target.result; loadGallery(); loadHostIp(); }; 

        function saveImageToDB(base64) {
            if(!db) return;
            const transaction = db.transaction(["images"], "readwrite");
            transaction.objectStore("images").add({ data: base64, date: new Date().toLocaleString() });
        }

        window.clearDbGallery = function() {
            if(confirm("Delete all history?")) {
                const transaction = db.transaction(["images"], "readwrite");
                transaction.objectStore("images").clear();
                loadGallery();
            }
        }

        // --- RESOLUTION SWITCHES (NEW DEFINITIONS) ---
        window.setResolution = function(w, h) {
            document.getElementById('width').value = w;
            document.getElementById('height').value = h;
        };

        window.flipResolution = function() {
            const widthInput = document.getElementById('width');
            const heightInput = document.getElementById('height');
            
            const currentW = widthInput.value;
            const currentH = heightInput.value;
            
            widthInput.value = currentH;
            heightInput.value = currentW;
        };
        // --- END RESOLUTION SWITCHES ---


        // --- HOST IP PERSISTENCE LOGIC ---
        function loadHostIp() {
            const savedIp = localStorage.getItem('bojroHostIp');
            if (savedIp) {
                document.getElementById('hostIp').value = savedIp;
            }
        }

        function saveHostIp() {
            const currentIp = document.getElementById('hostIp').value;
            if (currentIp && currentIp.startsWith('http')) {
                localStorage.setItem('bojroHostIp', currentIp);
            }
        }

        // --- UI TABS ---
        window.switchTab = function(view) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('[id^="view-"]').forEach(v => v.classList.add('hidden'));
            document.getElementById('view-' + view).classList.remove('hidden');
            
            if(view === 'gen') document.querySelectorAll('.tab')[0].classList.add('active');
            if(view === 'gal') { document.querySelectorAll('.tab')[1].classList.add('active'); loadGallery(); }
            if(view === 'ana') document.querySelectorAll('.tab')[2].classList.add('active');
        }

        window.toggleVaeMode = function() {
            // VAE logic removed from UI
        }

        // --- GALLERY LOGIC ---
        function loadGallery() {
            const grid = document.getElementById('savedGalleryGrid');
            grid.innerHTML = "";
            if(!db) return;
            const store = db.transaction(["images"], "readonly").objectStore("images");
            store.getAll().onsuccess = function(e) {
                const images = e.target.result;
                if(!images || images.length === 0) {
                    grid.innerHTML = "<div style='text-align:center; color:#666; grid-column:span 3; margin-top:50px;'>Empty History</div>";
                    return;
                }
                images.reverse().forEach(item => {
                    const img = document.createElement('img');
                    img.src = item.data;
                    img.className = 'gal-thumb';
                    img.onclick = () => openFullscreen(item.data);
                    grid.appendChild(img);
                });
            };
        }

        let currentFsImage = ""; 
        window.openFullscreen = function(base64) {
            currentFsImage = base64;
            document.getElementById('fsImage').src = base64;
            document.getElementById('fullScreenModal').classList.remove('hidden');
        }
        window.closeFsModal = function() { document.getElementById('fullScreenModal').classList.add('hidden'); }

        window.analyzeCurrentFs = function() {
            window.closeFsModal();
            window.switchTab('ana');
            fetch(currentFsImage).then(res => res.blob()).then(blob => {
                const file = new File([blob], "gallery_image.png", { type: "image/png" });
                const img = new Image();
                img.onload = () => {
                    document.getElementById('anaPreview').src = img.src;
                    document.getElementById('anaGallery').classList.remove('hidden');
                    document.getElementById('resOut').innerText = `${img.width} x ${img.height}`;
                };
                img.src = URL.createObjectURL(file);
                extractMetadata(file);
            });
        }

        // --- LORA ---
        let allLoras = []; 
        window.openLoraModal = function() { document.getElementById('loraModal').classList.remove('hidden'); document.getElementById('loraSearch').focus(); }
        window.closeLoraModal = function() { document.getElementById('loraModal').classList.add('hidden'); }
        window.filterLoras = function() {
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

        function getHeaders() {
            return {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true', 
                'User-Agent': 'BojroApp'
            };
        }

        window.connect = async function() {
            HOST = document.getElementById('hostIp').value.replace(/\/$/, ""); 
            const dot = document.getElementById('statusDot');
            dot.style.background = "yellow"; 

            try {
                const res = await fetch(`${HOST}/sdapi/v1/sd-models`, { headers: getHeaders() });
                
                if (!res.ok) throw new Error("Status: " + res.status);

                dot.classList.remove('err');
                dot.classList.add('on');
                dot.style.background = "#00e676"; // Green

                document.getElementById('genBtn').disabled = false;
                fetchModels(); fetchSamplers(); fetchLoras();
                
                // --- HIDDEN SETTINGS UPDATE (Automatic VAE/Bits) ---
                postOption({ "sd_vae": "Automatic" }, null);
                postOption({ "forge_unet_storage_dtype": "Automatic" }, null);
                // ------------------------------
                
                saveHostIp(); 

                alert("SUCCESS: Connected!");
            } catch (e) {
                dot.classList.add('err');
                dot.style.background = "#f44336"; 
                alert("Connection Failed: " + e.message);
            }
        }

        async function fetchModels() {
            try {
                const res = await fetch(`${HOST}/sdapi/v1/sd-models`, { headers: getHeaders() });
                const models = await res.json();
                const select = document.getElementById('modelSelect');
                select.innerHTML = "";
                models.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.title; opt.text = m.model_name;
                    select.appendChild(opt);
                });
                window.setDefaultModel();
            } catch(e){}
        }
        async function fetchSamplers() {
            try {
                const res = await fetch(`${HOST}/sdapi/v1/samplers`, { headers: getHeaders() });
                const samplers = await res.json();
                const select = document.getElementById('samplerSelect');
                select.innerHTML = "";
                samplers.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.name; opt.text = s.name;
                    if(s.name === "Euler a") opt.selected = true;
                    select.appendChild(opt);
                });
            } catch(e){}
        }
        async function fetchLoras() {
            try {
                const res = await fetch(`${HOST}/sdapi/v1/loras`, { headers: getHeaders() });
                allLoras = await res.json();
                window.filterLoras();
            } catch(e){}
        }

        async function postOption(payload, msg) {
            const btn = document.getElementById('genBtn');
            if(msg) { btn.innerText = msg; btn.disabled = true; }
            try {
                await fetch(`${HOST}/sdapi/v1/options`, {
                    method: 'POST', headers: getHeaders(), 
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
                    method: 'POST', headers: getHeaders(),
                    body: JSON.stringify(payload)
                });

                if(!res.ok) throw new Error("Gen Error: " + res.status);
                const data = await res.json();
                
                if (data.images) {
                    data.images.forEach(b64 => {
                        const finalB64 = "data:image/png;base64," + b64;
                        const img = document.createElement('img');
                        img.src = finalB64;
                        img.className = 'gen-result';
                        gallery.appendChild(img);
                        
                        saveImageToDB(finalB64); // Save to DB
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

        // --- DOWNLOADER ---
        window.downloadResults = async function() {
            const images = document.querySelectorAll('.gen-result');
            if(images.length === 0) return alert("No images to download!");
            const now = new Date();
            const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19); 
            
            for (let i = 0; i < images.length; i++) {
                const img = images[i];
                try {
                    const res = await fetch(img.src);
                    const blob = await res.blob();
                    const filename = `Strateon_${timestamp}_${i + 1}.png`;
                    const file = new File([blob], filename, { type: "image/png" });
                    const blobUrl = URL.createObjectURL(file);
                    const link = document.createElement('a');
                    link.href = blobUrl;
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
                } catch (e) { alert("Save Failed: " + e.message); }
            }
        }

        // --- ANALYZER ---
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
            uploadBox.addEventListener('drop', (e) => { 
                e.preventDefault();
                document.getElementById('imageUpload').files = e.dataTransfer.files; 
                window.handleFileSelect({ target: { files: e.dataTransfer.files } }); 
            });
        }

        function loadAutoDlState() {
            const autoCheck = document.getElementById('autoDlCheck');
            if (autoCheck) autoCheck.checked = localStorage.getItem('bojroAutoSave') === 'true';
        }
        window.saveAutoDlState = function() {
            localStorage.setItem('bojroAutoSave', document.getElementById('autoDlCheck').checked);
        }
        loadAutoDlState();
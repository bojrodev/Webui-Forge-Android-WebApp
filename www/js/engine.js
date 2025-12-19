// -----------------------------------------------------------
// JOB BUILDER & GENERATION ENGINE
// -----------------------------------------------------------

function buildJobFromUI() {
    // FIX 1: Prioritize Inpaint Task Check BEFORE Qwen Mode Check

    let payload = {};
    let overrides = {};
    // CRITICAL: Ensure we use the new calculated profiles
    overrides["forge_inference_memory"] = getVramMapping();
    overrides["forge_unet_storage_dtype"] = "Automatic (fp16 LoRA)";

    // If Inpainting, read from new controls
    if (currentTask === 'inp') {
        const model = document.getElementById('inp_modelSelect').value;
        const prompt = document.getElementById('inp_prompt').value;
        if (!model || model.includes('Loading')) return alert("Select Model");

        payload = {
            "prompt": prompt,
            "negative_prompt": document.getElementById('inp_neg').value,
            "steps": parseInt(document.getElementById('inp_steps').value),
            "cfg_scale": parseFloat(document.getElementById('inp_cfg').value),
            // Resize to editor crop resolution
            "width": editorTargetW,
            "height": editorTargetH,
            "sampler_name": document.getElementById('inp_sampler').value,
            "scheduler": document.getElementById('inp_scheduler').value,
            "batch_size": 1,
            "n_iter": 1,
            "save_images": true,
            "mask_blur": parseInt(document.getElementById('inp_mask_blur').value) || 4 //
        };

        if (!sourceImageB64) {
            alert("Image missing!");
            return null;
        }

        // init_images must be a list
        payload.init_images = [sourceImageB64.split(',')[1]];
        payload.denoising_strength = parseFloat(document.getElementById('denoisingStrength').value);
        payload.resize_mode = 0;

        if (maskCanvas) {
            const cleanMask = maskCanvas.toDataURL().split(',')[1];
            payload.mask = cleanMask;
            payload.inpainting_mask_invert = 0;

            // explicitly set inpainting_fill to 1 (Original) as default logic
            payload.inpainting_fill = 1;

            if (currentInpaintMode === 'mask') {
                // Masked Only Mode
                payload.inpaint_full_res = true;
                payload.inpaint_full_res_padding = 32;
            } else {
                // Whole Picture Mode
                payload.inpaint_full_res = false;
            }
        }

        // Soft Inpainting Logic 
        const useSoftInpaint = document.getElementById('inp_soft_inpaint').checked;
        if (useSoftInpaint) {
            payload.alwayson_scripts = {
                "soft inpainting": {
                    "args": [
                        true, // Enabled
                        1.0, // Schedule Bias
                        0.5, // Preservation Strength
                        4.0, // Transition Contrast Boost
                        0.0, // Mask Influence
                        0.5, // Difference Threshold
                        2.0 // Difference Contrast
                    ]
                }
            };
            // Recommendation: Increase mask blur slightly for soft inpainting
            if (payload.mask_blur < 8) payload.mask_blur = 8;
        }

        // Use Model Override logic for generic Inpaint
        // AND CRITICALLY: Unload any Flux/SDXL modules that might be lingering
        overrides["sd_model_checkpoint"] = model;
        overrides["forge_additional_modules"] = []; // FORCE CLEAR
        overrides["sd_vae"] = "Automatic"; // RESET VAE

        payload.override_settings = overrides;

        return {
            mode: 'inp',
            modelTitle: model,
            payload: payload,
            desc: `Inpaint: ${prompt.substring(0,20)}...`
        };
    }

    // --- NEO HOOK: DELEGATE TO NEO IF QWEN MODE ---
    // Moved below currentTask check to prevent hijacking
    if (currentMode === 'qwen' && window.Neo && window.Neo.buildJob) {
        return window.Neo.buildJob();
    }

    // Existing XL / Flux Logic
    const mode = currentMode;
    const targetModelTitle = mode === 'xl' ? document.getElementById('xl_modelSelect').value : document.getElementById('flux_modelSelect').value;
    if (!targetModelTitle || targetModelTitle.includes("Link first")) return null;

    if (mode === 'xl') {
        overrides["forge_additional_modules"] = [];
        overrides["sd_vae"] = "Automatic";
        payload = {
            "prompt": document.getElementById('xl_prompt').value,
            "negative_prompt": document.getElementById('xl_neg').value,
            "steps": parseInt(document.getElementById('xl_steps').value),
            "cfg_scale": parseFloat(document.getElementById('xl_cfg').value),
            "width": parseInt(document.getElementById('xl_width').value),
            "height": parseInt(document.getElementById('xl_height').value),
            "batch_size": parseInt(document.getElementById('xl_batch_size').value),
            "n_iter": parseInt(document.getElementById('xl_batch_count').value),
            "sampler_name": document.getElementById('xl_sampler').value,
            "scheduler": document.getElementById('xl_scheduler').value,
            "seed": parseInt(document.getElementById('xl_seed').value),
            "save_images": true,
            "override_settings": overrides
        };
    } else {
        const modulesList = [document.getElementById('flux_vae').value, document.getElementById('flux_clip').value, document.getElementById('flux_t5').value].filter(v => v && v !== "Automatic");
        if (modulesList.length > 0) overrides["forge_additional_modules"] = modulesList;
        
        const bits = document.getElementById('flux_bits').value;
        if (bits) overrides["forge_unet_storage_dtype"] = bits;
        
        const distCfg = parseFloat(document.getElementById('flux_distilled').value);
        payload = {
            "prompt": document.getElementById('flux_prompt').value,
            "negative_prompt": "",
            "steps": parseInt(document.getElementById('flux_steps').value),
            "cfg_scale": parseFloat(document.getElementById('flux_cfg').value),
            "distilled_cfg_scale": isNaN(distCfg) ? 3.5 : distCfg,
            "width": parseInt(document.getElementById('flux_width').value),
            "height": parseInt(document.getElementById('flux_height').value),
            "batch_size": parseInt(document.getElementById('flux_batch_size').value),
            "n_iter": parseInt(document.getElementById('flux_batch_count').value),
            "sampler_name": document.getElementById('flux_sampler').value,
            "scheduler": document.getElementById('flux_scheduler').value,
            "seed": parseInt(document.getElementById('flux_seed').value),
            "save_images": true,
            "override_settings": overrides
        };
    }
    return {
        mode: mode,
        modelTitle: targetModelTitle,
        payload: payload,
        desc: `${payload.prompt.substring(0, 30)}...`
    };
}

// -----------------------------------------------------------
// QUEUE MANAGEMENT
// -----------------------------------------------------------

window.addToQueue = function() {
    const job = buildJobFromUI();
    if (!job) return alert("Please select a model first.");
    job.id = Date.now().toString();
    job.timestamp = new Date().toLocaleString();

    queueState.ongoing.push(job);
    saveQueueState();
    renderQueueAll();

    const badge = document.getElementById('queueBadge');
    badge.style.transform = "scale(1.5)";
    setTimeout(() => badge.style.transform = "scale(1)", 200);
}

window.renderQueueAll = function() {
    renderList('ongoing', queueState.ongoing);
    renderList('next', queueState.next);
    renderList('completed', queueState.completed);
    updateQueueBadge();
}

window.renderList = function(type, listData) {
    const container = document.getElementById(`list-${type}`);
    container.innerHTML = "";
    if (listData.length === 0) {
        container.innerHTML = `<div style="text-align:center;color:var(--text-muted);font-size:11px;padding:10px;">Empty</div>`;
        return;
    }

    listData.forEach((job, index) => {
        const item = document.createElement('div');
        item.className = 'q-card';
        if (type !== 'completed') {
            item.draggable = true;
            item.ondragstart = (e) => dragStart(e, type, index);
        }
        let deleteBtn = `<button onclick="removeJob('${type}', ${index})" class="btn-icon" style="width:24px;height:24px;color:#f44336;border:none;"><i data-lucide="x" size="14"></i></button>`;
        const handle = type !== 'completed' ? `<div class="q-handle"><i data-lucide="grip-vertical" size="14"></i></div>` : "";
        item.innerHTML = `${handle}<div class="q-details"><div style="font-weight:bold; font-size:11px; color:var(--text-main);">${job.mode.toUpperCase()}</div><div class="q-meta">${job.desc}</div></div>${deleteBtn}`;
        container.appendChild(item);
    });
    lucide.createIcons();
}

window.removeJob = function(type, index) {
    queueState[type].splice(index, 1);
    saveQueueState();
    renderQueueAll();
}

window.clearQueueSection = function(type) {
    if (confirm(`Clear all ${type.toUpperCase()} items?`)) {
        queueState[type] = [];
        saveQueueState();
        renderQueueAll();
    }
}

// Drag & Drop
let draggedItem = null;
window.dragStart = function(e, type, index) {
    draggedItem = {
        type,
        index
    };
    e.dataTransfer.effectAllowed = 'move';
    e.target.classList.add('dragging');
}
window.allowDrop = function(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}
window.drop = function(e, targetType) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    if (!draggedItem) return;
    if (draggedItem.type !== targetType) {
        const item = queueState[draggedItem.type].splice(draggedItem.index, 1)[0];
        queueState[targetType].push(item);
        saveQueueState();
        renderQueueAll();
    }
    document.querySelectorAll('.dragging').forEach(d => d.classList.remove('dragging'));
    draggedItem = null;
}

window.processQueue = async function() {
    if (isQueueRunning) return;
    if (queueState.ongoing.length === 0) return alert("Queue empty!");

    isQueueRunning = true;
    totalBatchSteps = queueState.ongoing.reduce((acc, job) => acc + ((job.payload.n_iter || 1) * job.payload.steps), 0);
    currentBatchProgress = 0;

    document.getElementById('queueProgressBox').classList.remove('hidden');
    const btn = document.getElementById('startQueueBtn');
    const oldText = btn.innerText;
    btn.innerText = "RUNNING...";
    btn.disabled = true;

    if (document.hidden) updateBatchNotification("Starting batch job...", true, `0 / ${totalBatchSteps} steps`);

    while (queueState.ongoing.length > 0) {
        const job = queueState.ongoing[0];
        try {
            await runJob(job, true);
            const finishedJob = queueState.ongoing.shift();
            finishedJob.finishedAt = new Date().toLocaleString();
            queueState.completed.push(finishedJob);
            saveQueueState();
            renderQueueAll();
        } catch (e) {
            console.error(e);
            updateBatchNotification("Batch Paused", true, "Error occurred");
            alert("Batch paused: " + e.message);
            break;
        }
    }
    isQueueRunning = false;
    btn.innerText = oldText;
    btn.disabled = false;
    document.getElementById('queueProgressBox').classList.add('hidden');

    // Stop persistent notification
    if (ResolverService) {
        try {
            await ResolverService.stop();
        } catch (e) {}
    }

    // Send completion notification
    await sendCompletionNotification("Batch Complete: All images ready.");

    if (queueState.ongoing.length === 0) alert("Batch Complete!");
}

window.generate = async function() {
    const job = buildJobFromUI();
    if (!job) return alert("Please select a model first.");
    isSingleJobRunning = true;
    await runJob(job, false);
    isSingleJobRunning = false;

    // Stop persistent notification
    if (ResolverService) {
        try {
            await ResolverService.stop();
        } catch (e) {}
    }

    // Send completion notification
    await sendCompletionNotification("Generation Complete: Image Ready");
}

window.clearGenResults = function() {
    if (currentTask === 'inp') {
        const gal = document.getElementById('inpGallery');
        if (gal) gal.innerHTML = '';
    } else {
        const gal = document.getElementById('gallery');
        if (gal) gal.innerHTML = '';
    }
}

async function runJob(job, isBatch = false) {
    // --- UPDATED ISOLATION LOGIC ---
    const isInpaintJob = job.mode === 'inp';

    // Select specific elements based on job mode
    const btnId = isInpaintJob ? 'inpGenBtn' : 'genBtn';
    const spinnerId = isInpaintJob ? 'inpLoadingSpinner' : 'loadingSpinner';
    const galleryId = isInpaintJob ? 'inpGallery' : 'gallery';

    const btn = document.getElementById(btnId);
    const spinner = document.getElementById(spinnerId);
    const gal = document.getElementById(galleryId);

    btn.disabled = true;
    spinner.style.display = 'block';

    try {
        let isReady = false;
        let attempts = 0;
        // Check if model is loaded. Logic:
        // 1. Get Options.
        // 2. Normalize Names.
        // 3. If mismatch, POST options.
        while (!isReady && attempts < 40) {
            const optsReq = await fetch(`${HOST}/sdapi/v1/options`, {
                headers: getHeaders()
            });
            const opts = await optsReq.json();

            // Normalize: lowercase, remove hash, remove path
            if (normalize(opts.sd_model_checkpoint) === normalize(job.modelTitle)) {
                isReady = true;
                break;
            }

            if (attempts % 5 === 0) {
                btn.innerText = `ALIGNING... (${attempts})`;
                // Force overrides here as well to ensure alignment
                const loadPayload = {
                    "sd_model_checkpoint": job.modelTitle,
                    "forge_unet_storage_dtype": "Automatic (fp16 LoRA)"
                };

                // CRITICAL FIX: If Inpainting, ensure we clear flux modules during alignment too
                if (job.mode === 'inp') {
                    loadPayload["forge_additional_modules"] = [];
                    loadPayload["sd_vae"] = "Automatic";
                }

                await postOption(loadPayload);
            }
            attempts++;
            await new Promise(r => setTimeout(r, 1500));
        }
        if (!isReady) throw new Error("Timeout: Server failed to load model.");

        btn.innerText = "PROCESSING...";
        await updateBatchNotification("Starting Generation", true, "Initializing...");

        const jobTotalSteps = (job.payload.n_iter || 1) * job.payload.steps;

        const progressInterval = setInterval(async () => {
            try {
                const res = await fetch(`${HOST}/sdapi/v1/progress`, {
                    headers: getHeaders()
                });
                const data = await res.json();
                if (data.state && data.state.sampling_steps > 0) {
                    const currentJobIndex = data.state.job_no || 0;
                    const currentStepInBatch = data.state.sampling_step;
                    const jobStep = (currentJobIndex * job.payload.steps) + currentStepInBatch;
                    btn.innerText = `Step ${jobStep}/${jobTotalSteps}`;
                    const msg = `Step ${jobStep} / ${jobTotalSteps}`;
                    if (isBatch) {
                        const actualTotal = currentBatchProgress + jobStep;
                        document.getElementById('queueProgressText').innerText = `Step ${actualTotal} / ${totalBatchSteps}`;
                        updateBatchNotification("Batch Running", false, `Step ${actualTotal} / ${totalBatchSteps}`);
                    } else {
                        updateBatchNotification("Generating...", false, msg);
                    }
                } else if (btn.innerText.includes("Step")) {
                    updateBatchNotification("Finalizing...", false, "Receiving Images...");
                }
            } catch (e) {}
        }, 1000);

        const endpoint = job.mode === 'inp' ? '/sdapi/v1/img2img' : '/sdapi/v1/txt2img';
        const res = await fetch(`${HOST}${endpoint}`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(job.payload)
        });

        clearInterval(progressInterval);
        if (!res.ok) throw new Error("Server Error " + res.status);

        const data = await res.json();
        if (isBatch) currentBatchProgress += jobTotalSteps;

        if (data.images) {
            for (let i = 0; i < data.images.length; i++) {
                const b64 = data.images[i];
                const finalB64 = "data:image/png;base64," + b64;
                const newId = await saveImageToDB(finalB64);

                const img = document.createElement('img');
                img.src = finalB64;
                img.className = 'gen-result';
                img.loading = "lazy";
                img.onclick = () => window.openFullscreen([finalB64], 0, img, newId);

                if (gal.firstChild) gal.insertBefore(img, gal.firstChild);
                else gal.appendChild(img);
                const autoDl = document.getElementById('autoDlCheck');
                if (autoDl && autoDl.checked) saveToMobileGallery(finalB64);
            }
        }
    } catch (e) {
        throw e;
    } finally {
        spinner.style.display = 'none';
        btn.disabled = false;
        // --- NEO HOOK: BUTTON TEXT ---
        if (currentTask === 'inp') {
            btn.innerText = "GENERATE";
        } else {
            if (currentMode === 'xl') btn.innerText = "GENERATE";
            else if (currentMode === 'flux') btn.innerText = "QUANTUM GENERATE";
            else if (currentMode === 'qwen') btn.innerText = "TURBO GENERATE";
        }
    }
}

// -----------------------------------------------------------
// GALLERY RENDERER
// -----------------------------------------------------------

window.loadGallery = function() {
    const grid = document.getElementById('savedGalleryGrid');
    if (!grid) return;
    grid.innerHTML = "";
    if (!db) return;
    db.transaction(["images"], "readonly").objectStore("images").getAll().onsuccess = e => {
        const imgs = e.target.result;
        if (!imgs || imgs.length === 0) {
            grid.innerHTML = "<div style='text-align:center;color:#777;margin-top:20px;grid-column:1/-1;'>No images</div>";
            return;
        }

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
                if (isSelectionMode) toggleSelectionForId(item.id, container);
                else window.openFullscreenFromGallery(index);
            };
            const tick = document.createElement('div');
            tick.className = 'gal-tick hidden';
            tick.innerHTML = '<i data-lucide="check-circle" size="24" color="#00e676" fill="black"></i>';
            tick.style.position = 'absolute';
            tick.style.top = '5px';
            tick.style.right = '5px';
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
    if (isSelectionMode) {
        btn.style.background = "var(--accent-primary)";
        btn.style.color = "white";
        delBtn.classList.remove('hidden');
    } else {
        btn.style.background = "var(--input-bg)";
        btn.style.color = "var(--text-main)";
        delBtn.classList.add('hidden');
        selectedImageIds.clear();
        document.querySelectorAll('.gal-tick').forEach(t => t.classList.add('hidden'));
        updateDeleteBtn();
    }
}

window.toggleSelectionForId = function(id, container) {
    const tick = container.querySelector('.gal-tick');
    if (selectedImageIds.has(id)) {
        selectedImageIds.delete(id);
        tick.classList.add('hidden');
    } else {
        selectedImageIds.add(id);
        tick.classList.remove('hidden');
    }
    updateDeleteBtn();
}

window.updateDeleteBtn = function() {
    document.getElementById('galDeleteBtn').innerText = `DELETE (${selectedImageIds.size})`;
}

window.deleteSelectedImages = function() {
    if (selectedImageIds.size === 0) return;
    if (!confirm(`Delete ${selectedImageIds.size} images?`)) return;
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

// -----------------------------------------------------------
// NEW: SEND TO INPAINT EDITOR
// -----------------------------------------------------------

window.editCurrentFs = function() {
    const src = document.getElementById('fsImage').src;
    if (!src) return;

    // 1. Close the Lightbox
    window.closeFsModal();

    // 2. Switch to the Inpaint Tab
    window.switchTab('inp');

    // 3. Load the image directly into the Editor
    const img = new Image();
    img.crossOrigin = "Anonymous"; 
    img.src = src;
    
    img.onload = () => {
        editorImage = img;

        // Open the Editor Modal
        document.getElementById('editorModal').classList.remove('hidden');

        // REMOVED: document.getElementById('img-input-container').style.display = 'none';
        // We leave the upload box visible behind the modal. 
        // It will only be hidden when you click "PROCEED" (handled by applyEditorChanges).
        
        setTimeout(() => {
            editorTargetW = parseInt(document.getElementById('xl_width').value) || 1024;
            editorTargetH = parseInt(document.getElementById('xl_height').value) || 1024;
            
            if (typeof recalcEditorLayout === 'function') recalcEditorLayout();
            if (typeof resetEditorView === 'function') resetEditorView();
        }, 50);
    };
    
    img.onerror = () => {
        alert("Failed to load image for editing.");
    };
}
// -----------------------------------------------------------
// FULLSCREEN LIGHTBOX & ANALYSIS
// -----------------------------------------------------------

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

window.updateLightboxImage = function() {
    if (currentGalleryImages.length > 0 && currentGalleryImages[currentGalleryIndex]) {
        document.getElementById('fsImage').src = currentGalleryImages[currentGalleryIndex].data;
    }
}

window.slideImage = function(dir) {
    if (currentGalleryImages.length === 0) return;
    currentGalleryIndex += dir;
    if (currentGalleryIndex < 0) currentGalleryIndex = currentGalleryImages.length - 1;
    if (currentGalleryIndex >= currentGalleryImages.length) currentGalleryIndex = 0;
    updateLightboxImage();
}

window.deleteCurrentFsImage = function() {
    const currentItem = currentGalleryImages[currentGalleryIndex];
    if (!currentItem) return;
    if (confirm("Delete this image?")) {
        if (currentItem.id) {
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

window.finishDeleteAction = function(item) {
    if (item.domElement) item.domElement.remove();
    if (currentGalleryImages.length === 0) {
        window.closeFsModal();
        loadGallery();
    } else {
        if (currentGalleryIndex >= currentGalleryImages.length) currentGalleryIndex--;
        updateLightboxImage();
        loadGallery();
    }
}

window.downloadCurrent = function() {
    const src = document.getElementById('fsImage').src;
    saveToMobileGallery(src);
}

window.closeFsModal = () => document.getElementById('fullScreenModal').classList.add('hidden');

window.analyzeCurrentFs = () => {
    window.closeFsModal();
    window.switchTab('ana');
    fetch(document.getElementById('fsImage').src).then(res => res.blob()).then(processImageForAnalysis);
}

window.handleFileSelect = e => {
    const file = e.target.files[0];
    if (!file) return;
    processImageForAnalysis(file);
}

async function processImageForAnalysis(blob) {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
        const w = img.width;
        const h = img.height;
        const d = gcd(w, h);
        document.getElementById('resOut').innerText = `${w} x ${h}`;
        document.getElementById('arOut').innerText = `${w/d}:${h/d}`;
        document.getElementById('anaPreview').src = url;
        document.getElementById('anaGallery').classList.remove('hidden');
    };
    img.src = url;
    const text = await readPngMetadata(blob);
    document.getElementById('anaMeta').innerText = text || "No parameters found.";
    const btnContainer = document.getElementById('anaCopyButtons');
    if (text) {
        currentAnalyzedPrompts = parseGenInfo(text);
        if (btnContainer) btnContainer.classList.remove('hidden');
    } else {
        currentAnalyzedPrompts = null;
        if (btnContainer) btnContainer.classList.add('hidden');
    }
}

window.copyToSdxl = function() {
    if (!currentAnalyzedPrompts) return;
    document.getElementById('xl_prompt').value = currentAnalyzedPrompts.pos;
    document.getElementById('xl_neg').value = currentAnalyzedPrompts.neg;
    window.setMode('xl');
    window.switchTab('gen');
    if (Toast) Toast.show({
        text: 'Copied to SDXL',
        duration: 'short'
    });
}

window.copyToFlux = function() {
    if (!currentAnalyzedPrompts) return;
    document.getElementById('flux_prompt').value = currentAnalyzedPrompts.pos;
    window.setMode('flux');
    window.switchTab('gen');
    if (Toast) Toast.show({
        text: 'Copied to FLUX',
        duration: 'short'
    });
}

window.copyToQwen = function() {
    if (!currentAnalyzedPrompts) return;
    document.getElementById('qwen_prompt').value = currentAnalyzedPrompts.pos;
    document.getElementById('qwen_neg').value = currentAnalyzedPrompts.neg || "bad quality, blur, watermark";
    window.setMode('qwen');
    window.switchTab('gen');
    if (Toast) Toast.show({
        text: 'Copied to QWEN',
        duration: 'short'
    });
}
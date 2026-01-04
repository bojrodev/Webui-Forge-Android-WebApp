// www/js/updater.js

// 1. Notify native layer app is ready
if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorUpdater) {
    window.Capacitor.Plugins.CapacitorUpdater.notifyAppReady();
}

/**
 * Checks for updates and triggers the Custom UI.
 * @param {boolean} silent - If true, checks for skip logic. If false (manual click), forces check.
 */
async function checkForAppUpdate(silent = false) {
    const Updater = window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins.CapacitorUpdater : null;

    if (!Updater) {
        if (!silent) console.warn("Updater plugin missing (Web Mode?)");
        return;
    }

    try {
        if (!silent && typeof Toast !== 'undefined') {
            Toast.show({text: 'Checking for updates...', duration: 'short'});
        }

        // --- CONFIGURATION ---
        const UPDATE_URL = 'https://raw.githubusercontent.com/bojrodev/Resolver-Stable-Diffusion-Client-for-android/dev/version.json';
        const currentVersion = '1.6'; // <--- UPDATE THIS BEFORE RELEASE
        // ---------------------

        const response = await fetch(UPDATE_URL + '?t=' + new Date().getTime());
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        
        const remoteData = await response.json();
        
        // CHECK IF SKIPPED
        const skippedVersion = localStorage.getItem('bojro_skip_version');

        // Logic: Is it newer? AND (We are not silent OR We haven't skipped this version)
        if (isNewer(currentVersion, remoteData.version)) {
            
            // If it's an auto-check (silent) and user already skipped this specific version, STOP.
            if (silent && skippedVersion === remoteData.version) {
                console.log(`Skipping update v${remoteData.version} (User preference)`);
                return; 
            }

            // Otherwise, show the modal
            showUpdateModal(remoteData, Updater);

        } else {
             if (!silent && typeof Toast !== 'undefined') {
                 Toast.show({text: 'You are up to date (v' + currentVersion + ')', duration: 'short'});
             }
        }

    } catch (error) {
        console.error(error);
        if (!silent && typeof Toast !== 'undefined') {
            Toast.show({text: 'Update check failed', duration: 'short'});
        }
    }
}

function showUpdateModal(data, UpdaterPlugin) {
    const modal = document.getElementById('updateModal');
    const badge = document.getElementById('updateVersionBadge');
    const notes = document.getElementById('updateNotes');
    const btnUpdate = document.getElementById('btnDoUpdate');
    const btnSkip = document.getElementById('btnSkipUpdate');
    const skipTag = document.getElementById('skipVersionTag');

    if (!modal) return;

    // Populate UI
    if (badge) badge.innerText = `v${data.version}`;
    if (notes) notes.innerText = data.note || "New features and improvements.";
    if (skipTag) skipTag.innerText = data.version;

    // 1. SETUP INSTALL BUTTON
    btnUpdate.onclick = async () => {
        btnUpdate.disabled = true;
        btnUpdate.innerHTML = `<div class="spinner" style="width:16px;height:16px;border-width:2px;margin-right:8px;"></div> DOWNLOADING...`;
        
        try {
            const update = await UpdaterPlugin.download({
                url: data.url,
                version: data.version
            });
            btnUpdate.innerHTML = `RESTARTING...`;
            await UpdaterPlugin.set(update);
        } catch (e) {
            console.error(e);
            alert("Download Failed: " + e.message);
            btnUpdate.disabled = false;
            btnUpdate.innerHTML = `<i data-lucide="download-cloud"></i> RETRY`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    };

    // 2. SETUP SKIP BUTTON
    if (btnSkip) {
        btnSkip.onclick = () => {
            // Save this version to storage so we ignore it next time
            localStorage.setItem('bojro_skip_version', data.version);
            modal.classList.add('hidden');
            if (typeof Toast !== 'undefined') Toast.show({text: 'Update skipped. You can still update manually in settings.', duration: 'long'});
        };
    }

    // Show
    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function isNewer(current, remote) {
    const c = current.split('.').map(Number);
    const r = remote.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        const rVal = r[i] || 0;
        const cVal = c[i] || 0;
        if (rVal > cVal) return true;
        if (rVal < cVal) return false;
    }
    return false;
}
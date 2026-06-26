// js/script.js

// Dynamic Toast Notifications Engine
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast-message ${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <i class="${type === 'success' ? 'fas fa-check-circle' : type === 'error' ? 'fas fa-times-circle' : 'fas fa-info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 50);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 4500);
}

// Background Music Controller
function initializeGlobalScripts() {
    const musicControl = document.getElementById('music-control');
    if (musicControl) {
        const backgroundMusic = document.getElementById('background-music');
        const playIcon = document.getElementById('play-icon');
        const pauseIcon = document.getElementById('pause-icon');
        if (!backgroundMusic || !playIcon || !pauseIcon) return;

        let isMusicPlaying = false;
        let hasInteracted = false;

        const toggleMusic = () => {
            if (isMusicPlaying) {
                backgroundMusic.pause();
                playIcon.style.display = 'block';
                pauseIcon.style.display = 'none';
            } else {
                backgroundMusic.play().catch(e => console.warn("Audio autoplay blocked by context permissions:", e));
                playIcon.style.display = 'none';
                pauseIcon.style.display = 'block';
            }
            isMusicPlaying = !isMusicPlaying;
        };

        const startMusicOnFirstInteraction = () => {
            if (!hasInteracted) {
                hasInteracted = true;
                toggleMusic();
            }
        };

        musicControl.addEventListener('click', toggleMusic);
        document.body.addEventListener('click', startMusicOnFirstInteraction, { once: true });
        document.body.addEventListener('keydown', startMusicOnFirstInteraction, { once: true });
    }
}

// Unified Dropzone and Deployment Engine
function initializeDeployPageScripts() {
    const deployBtn = document.getElementById('deploy-btn');
    if (!deployBtn) return;

    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');
    const fileList = document.getElementById('file-list');
    const subdomainInput = document.getElementById('subdomain-name');
    const urlPreview = document.getElementById('url-preview-text');
    const previewBtn = document.getElementById('preview-btn');
    const statusMessage = document.getElementById('status-message');

    let uploadedFiles = [];
    let originalZipFile = null;

    const handleFiles = async (files) => {
        fileList.innerHTML = '';
        uploadedFiles = [];
        originalZipFile = null;
        deployBtn.disabled = true;
        previewBtn.disabled = true;

        const file = files[0];
        if (file && (file.type === 'application/zip' || file.name.endsWith('.zip'))) {
            originalZipFile = file;
            displayFile(`Unpacking Archive: ${file.name}...`, 'fas fa-spinner fa-spin');
            
            try {
                const zip = await JSZip.loadAsync(file);
                fileList.innerHTML = '';
                let fileEntries = Object.values(zip.files).filter(entry => !entry.dir);
                
                // Identify root parent directory in archive
                let rootFolder = '';
                if (fileEntries.length > 0) {
                    const firstPathParts = fileEntries[0].name.split('/');
                    if (firstPathParts.length > 1) {
                        const potentialRoot = firstPathParts[0] + '/';
                        if (fileEntries.every(entry => entry.name.startsWith(potentialRoot))) {
                            rootFolder = potentialRoot;
                        }
                    }
                }

                for (const entry of fileEntries) {
                    const fileData = await entry.async('blob');
                    const finalName = rootFolder ? entry.name.substring(rootFolder.length) : entry.name;
                    if (finalName) {
                        const extractedFile = new File([fileData], finalName, { type: fileData.type });
                        uploadedFiles.push(extractedFile);
                        displayFile(finalName, 'fas fa-file-code');
                    }
                }
                showToast("Archive parsed successfully.", "success");
            } catch (error) {
                showToast("Failed to parse zip package: " + error.message, "error");
                fileList.innerHTML = '';
                return;
            }
        } else {
            for (const f of files) {
                uploadedFiles.push(f);
                displayFile(f.name, 'fas fa-file-code');
            }
        }

        if (uploadedFiles.length > 0) {
            deployBtn.disabled = false;
            previewBtn.disabled = false;
        }
    };

    const displayFile = (name, iconClass = 'fas fa-file') => {
        const li = document.createElement('li');
        li.innerHTML = `<i class="${iconClass}"></i> ${name}`;
        fileList.appendChild(li);
    };

    const openPreview = async () => {
        if (uploadedFiles.length === 0) return;
        previewBtn.disabled = true;
        previewBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing Preview...';
        
        try {
            const filesForStorage = await Promise.all(
                uploadedFiles.map(file => new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = e => resolve({ name: file.name, type: file.type, dataUrl: e.target.result });
                    reader.onerror = e => reject(e);
                    reader.readAsDataURL(file);
                }))
            );
            
            sessionStorage.setItem('previewFiles', JSON.stringify(filesForStorage));
            window.open('/preview', '_blank');
        } catch (err) {
            showToast("Failed to compile preview data structures.", "error");
        } finally {
            previewBtn.disabled = false;
            previewBtn.innerHTML = 'Check Preview';
        }
    };

    const updateUrlPreview = () => {
        const projectName = subdomainInput.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
        urlPreview.textContent = projectName ? `${projectName}.vercel.app` : '...';
    };

    const deployProject = async () => {
        const subdomain = subdomainInput.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
        if (uploadedFiles.length === 0 || !subdomain) {
            showToast('Please provide files and a target name.', 'error');
            return;
        }

        setLoadingState(true);
        updateStatusText("Assembling deployment payload...");

        const formData = new FormData();
        formData.append('subdomain', subdomain);
        if (originalZipFile) {
            formData.append('zip_file', originalZipFile);
        }
        uploadedFiles.forEach(file => {
            formData.append('files', file, file.name);
        });

        try {
            updateStatusText("Transmitting build layers to Vercel (this may take up to a minute)...");
            
            const response = await fetch('/api/deploy', { 
                method: 'POST', 
                body: formData 
            });
            const result = await response.json();
            
            if (!response.ok) throw new Error(result.message || 'Serverless Gateway process failure.');
            
            showSuccess(`Deployment completed! Access your production site at:<br><a href="https://${result.finalUrl}" target="_blank" rel="noopener">${result.finalUrl} <i class="fas fa-external-link-alt"></i></a>`);
            showToast("Project deployed successfully!", "success");
        } catch (error) {
            showError(`Runtime Error: ${error.message}`);
            showToast(error.message, "error");
        } finally {
            setLoadingState(false);
        }
    };

    const updateStatusText = (text) => {
        statusMessage.className = 'info';
        statusMessage.style.display = 'block';
        statusMessage.innerHTML = `<i class="fas fa-spinner fa-spin me-2"></i> ${text}`;
    };

    const showSuccess = (htmlContent) => {
        statusMessage.className = 'success';
        statusMessage.style.display = 'block';
        statusMessage.innerHTML = htmlContent;
    };

    const showError = (text) => {
        statusMessage.className = 'error';
        statusMessage.style.display = 'block';
        statusMessage.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${text}`;
    };

    const setLoadingState = (isLoading) => {
        const buttonTextEl = deployBtn.querySelector('.button-text');
        const loaderEl = deployBtn.querySelector('.loader');
        
        if (isLoading) {
            deployBtn.disabled = true;
            deployBtn.classList.add('loading');
            buttonTextEl.style.opacity = '0';
            loaderEl.style.display = 'block';
            subdomainInput.disabled = true;
            browseBtn.disabled = true;
            dropZone.style.pointerEvents = 'none';
        } else {
            deployBtn.classList.remove('loading');
            buttonTextEl.style.opacity = '1';
            loaderEl.style.display = 'none';
            deployBtn.disabled = uploadedFiles.length === 0;
            subdomainInput.disabled = false;
            browseBtn.disabled = false;
            dropZone.style.pointerEvents = 'auto';
        }
    };

    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('drag-over'); });
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });

    browseBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => handleFiles(fileInput.files));
    previewBtn.addEventListener('click', openPreview);
    subdomainInput.addEventListener('input', updateUrlPreview);
    deployBtn.addEventListener('click', deployProject);

    updateUrlPreview();
}

document.addEventListener('DOMContentLoaded', () => {
    initializeGlobalScripts();
    initializeDeployPageScripts();
});

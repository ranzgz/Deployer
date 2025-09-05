document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selection ---
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');
    const fileList = document.getElementById('file-list');
    const domainSelect = document.getElementById('domain-select');
    const subdomainInput = document.getElementById('subdomain-name');
    const urlPreview = document.getElementById('url-preview-text');
    const deployBtn = document.getElementById('deploy-btn');
    const previewBtn = document.getElementById('preview-btn');
    const statusMessage = document.getElementById('status-message');
    const loader = deployBtn.querySelector('.loader');
    const buttonText = deployBtn.querySelector('.button-text');
    const musicControl = document.getElementById('music-control');
    const backgroundMusic = document.getElementById('background-music');
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');

    // --- State ---
    let uploadedFiles = [];
    let isMusicPlaying = false;
    let hasInteracted = false;

    // --- Music Control Logic ---
    const toggleMusic = () => {
        if (isMusicPlaying) {
            backgroundMusic.pause();
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        } else {
            backgroundMusic.play().catch(e => console.error("Autoplay was prevented:", e));
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
        }
        isMusicPlaying = !isMusicPlaying;
    };
    
    // Mulai musik setelah interaksi pertama pengguna untuk menghindari blokir autoplay
    const startMusicOnFirstInteraction = () => {
        if (!hasInteracted) {
            hasInteracted = true;
            toggleMusic();
        }
    };

    musicControl.addEventListener('click', toggleMusic);
    document.body.addEventListener('click', startMusicOnFirstInteraction, { once: true });
    document.body.addEventListener('keydown', startMusicOnFirstInteraction, { once: true });


    // --- Functions ---
    const fetchDomains = async () => {
        try {
            const response = await fetch('/api/get-domains');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Network response was not ok');
            }
            const domainsData = await response.json();
            
            domainSelect.innerHTML = '<option value="" disabled selected>-- Select a domain --</option>';
            domainsData.forEach(domain => {
                const option = document.createElement('option');
                option.value = domain.id;
                option.textContent = domain.name;
                domainSelect.appendChild(option);
            });
        } catch (error) {
            console.error("Failed to fetch domains:", error);
            showStatus(`Error fetching domains: ${error.message}`, 'error');
            domainSelect.innerHTML = '<option value="">Could not load domains</option>';
        }
    };

    const handleFiles = async (files) => {
        fileList.innerHTML = '';
        uploadedFiles = [];
        deployBtn.disabled = true;
        previewBtn.disabled = true;

        for (const file of files) {
            if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
                displayFile(` unpacking ${file.name}...`, 'fas fa-spinner fa-spin');
                const zip = await JSZip.loadAsync(file);
                fileList.innerHTML = '';

                let fileEntries = Object.values(zip.files).filter(entry => !entry.dir);
                let rootFolder = '';

                if (fileEntries.length > 0) {
                    const firstPathParts = fileEntries[0].name.split('/');
                    if (firstPathParts.length > 1) {
                        const potentialRoot = firstPathParts[0] + '/';
                        const allInRoot = fileEntries.every(entry => entry.name.startsWith(potentialRoot));
                        if (allInRoot) {
                            rootFolder = potentialRoot;
                            console.log(`Detected single root folder in ZIP: "${rootFolder}"`);
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
            } else {
                uploadedFiles.push(file);
                displayFile(file.name);
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

        const filesForStorage = await Promise.all(
            uploadedFiles.map(file => {
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        resolve({
                            name: file.name,
                            type: file.type,
                            dataUrl: event.target.result
                        });
                    };
                    reader.readAsDataURL(file);
                });
            })
        );
        
        sessionStorage.setItem('previewFiles', JSON.stringify(filesForStorage));
        window.open('/preview', '_blank');
    };
    
    // FUNGSI-FUNGSI YANG HILANG SEBELUMNYA
    const updateUrlPreview = () => {
        const subdomain = subdomainInput.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || '[project-name]';
        const selectedOption = domainSelect.options[domainSelect.selectedIndex];
        
        if (selectedOption && selectedOption.value) {
            urlPreview.textContent = `${subdomain}.${selectedOption.textContent}`;
        } else {
            urlPreview.textContent = '...';
        }
    };

    const deployProject = async () => {
        const subdomain = subdomainInput.value.trim().toLowerCase();
        const domainId = domainSelect.value;
        const selectedOption = domainSelect.options[domainSelect.selectedIndex];
        
        if (uploadedFiles.length === 0 || !subdomain || !domainId) {
            showStatus('Please upload files, provide a project name, and select a domain.', 'error');
            return;
        }

        setLoadingState(true);

        const formData = new FormData();
        formData.append('subdomain', subdomain);
        formData.append('domainId', domainId);
        formData.append('domainName', selectedOption.textContent);
        
        uploadedFiles.forEach(file => {
            formData.append('files', file, file.name);
        });

        try {
            const response = await fetch('/api/deploy', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'An unknown error occurred on the server.');
            }
            
            showStatus(`Success! Your site is live at: <a href="https://${result.finalUrl}" target="_blank">${result.finalUrl}</a>`, 'success');

        } catch (error) {
            console.error('Deployment Error:', error);
            showStatus(`Error: ${error.message}`, 'error');
        } finally {
            setLoadingState(false);
        }
    };

    const showStatus = (message, type) => {
        statusMessage.innerHTML = message;
        statusMessage.className = type;
    };

    const setLoadingState = (isLoading) => {
        if (isLoading) {
            deployBtn.disabled = true;
            deployBtn.classList.add('loading');
            loader.hidden = false;
            buttonText.textContent = 'Deploying...';
        } else {
            deployBtn.disabled = false;
            deployBtn.classList.remove('loading');
            loader.hidden = true;
            buttonText.textContent = 'Deploy Project';
        }
    };

    // --- Event Listeners ---
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('drag-over'); });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });

    browseBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => handleFiles(fileInput.files));
    
    previewBtn.addEventListener('click', openPreview);
    
    subdomainInput.addEventListener('input', updateUrlPreview);
    domainSelect.addEventListener('change', updateUrlPreview);
    deployBtn.addEventListener('click', deployProject);

    // --- Initial Load ---
    fetchDomains();
});

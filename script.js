// script.js (Lengkap)

// --- Language Data ---
const translations = {
    en: {
        "header-subtitle": "Deploy your static projects with a custom subdomain in seconds.",
        "step1-title": "Upload Your Project Files",
        "dropzone-title": "Drag & Drop your files here",
        "dropzone-subtitle": "(html, css, js, or a .zip file)",
        "dropzone-or": "or",
        "browse-button": "Browse Files",
        "project-files": "Project Files:",
        "preview-button": "Check Preview",
        "step2-title": "Configure Your Domain",
        "project-name-label": "Choose a Project Name (Subdomain)",
        "domain-select-label": "Select a Domain",
        "loading-domains": "Loading domains...",
        "url-preview-title": "Your new website URL will be:",
        "step3-title": "Launch Your Website",
        "launch-info": "Ready to go live? Clicking deploy will automatically upload your files to Vercel and connect your chosen domain.",
        "deploy-button": "Deploy Project",
        "footer-text": "&copy; 2023 FishNemo - Deployer. Built with ❤️ | <a href=\"/docs\" style=\"color: var(--secondary-text-color);\">API Docs</a>"
    },
    id: {
        "header-subtitle": "Deploy proyek statis Anda dengan subdomain kustom dalam hitungan detik.",
        "step1-title": "Unggah File Proyek Anda",
        "dropzone-title": "Seret & Lepas file Anda di sini",
        "dropzone-subtitle": "(html, css, js, atau file .zip)",
        "dropzone-or": "atau",
        "browse-button": "Cari File",
        "project-files": "File Proyek:",
        "preview-button": "Cek Pratinjau",
        "step2-title": "Konfigurasi Domain Anda",
        "project-name-label": "Pilih Nama Proyek (Subdomain)",
        "domain-select-label": "Pilih sebuah Domain",
        "loading-domains": "Memuat domain...",
        "url-preview-title": "URL website baru Anda adalah:",
        "step3-title": "Luncurkan Website Anda",
        "launch-info": "Siap untuk online? Klik deploy akan secara otomatis mengunggah file Anda ke Vercel dan menghubungkan domain pilihan Anda.",
        "deploy-button": "Deploy Proyek",
        "footer-text": "&copy; 2023 FishNemo - Deployer. Dibuat dengan ❤️ | <a href=\"/docs\" style=\"color: var(--secondary-text-color);\">API Docs</a>"
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // --- Language Toggle Logic ---
    const langToggleContainer = document.getElementById('lang-toggle');
    let currentLang = 'en';

    const setLanguage = (lang) => {
        if (!translations[lang]) return;
        currentLang = lang;
        document.querySelectorAll('[data-translate]').forEach(el => {
            const key = el.dataset.translate;
            if (translations[lang][key]) {
                el.innerHTML = translations[lang][key];
            }
        });
        langToggleContainer.querySelectorAll('button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });
    };

    if (langToggleContainer) {
        langToggleContainer.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                const lang = e.target.dataset.lang;
                setLanguage(lang);
            }
        });
    }

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
    const loader = deployBtn ? deployBtn.querySelector('.loader') : null;
    const buttonText = deployBtn ? deployBtn.querySelector('.button-text') : null;
    const musicControl = document.getElementById('music-control');
    const backgroundMusic = document.getElementById('background-music');
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');

    // --- State ---
    let uploadedFiles = [];
    let isMusicPlaying = false;
    let hasInteracted = false;

    // --- Music Control Logic ---
    if (musicControl) {
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

    // --- Functions (Hanya untuk halaman deploy) ---
    if (document.body.contains(deployBtn)) {
        const fetchDomains = async () => {
            try {
                const response = await fetch('/api/get-domains');
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Network response was not ok');
                }
                const domainsData = await response.json();
                
                domainSelect.innerHTML = `<option value="" disabled selected>${translations[currentLang]['loading-domains']}</option>`;
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
                            const originalFile = new File([fileData], finalName, { type: fileData.type });
                            if (files[0].type.includes('zip')) {
                                originalFile.zipOrigin = files[0];
                            }
                            uploadedFiles.push(originalFile);
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
            
            let isZipUpload = false;
            if(uploadedFiles[0].zipOrigin) {
                formData.append('files', uploadedFiles[0].zipOrigin);
                isZipUpload = true;
            }
            
            uploadedFiles.forEach(file => {
                formData.append('extracted_files', file, file.name);
            });
            
            if(isZipUpload) formData.append('isZip', 'true');

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

        // --- PERBAIKAN BUG LOADING ---
        const setLoadingState = (isLoading) => {
            if (isLoading) {
                deployBtn.disabled = true;
                deployBtn.classList.add('loading');
                loader.hidden = false;
                buttonText.textContent = ''; // Kosongkan teks saat loading
            } else {
                // Jangan langsung enable. Enable hanya jika ada file.
                deployBtn.disabled = uploadedFiles.length === 0;
                deployBtn.classList.remove('loading');
                loader.hidden = true;
                buttonText.textContent = translations[currentLang]['deploy-button'];
            }
        };
        
        // Event Listeners for Deploy Page
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

        // Initial Load for Deploy Page
        setLanguage('en');
        fetchDomains();
    }
});

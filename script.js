// script.js (Lengkap dengan perbaikan logika upload ZIP)

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
        "select-domain-placeholder": "-- Select a domain --",
        "url-preview-title": "Your new website URL will be:",
        "step3-title": "Launch Your Website",
        "launch-info": "Ready to go live? Clicking deploy will automatically upload your files to Vercel and connect your chosen domain.",
        "deploy-button": "Deploy Project",
        "deploy-loading-text": "Deploying...",
        "footer-text": "&copy; 2024 FishNemo - Deployer. Built with ❤️ | <a href=\"/docs\" style=\"color: var(--secondary-text-color);\">API Docs</a>"
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
        "select-domain-placeholder": "-- Pilih sebuah domain --",
        "url-preview-title": "URL website baru Anda adalah:",
        "step3-title": "Luncurkan Website Anda",
        "launch-info": "Siap untuk online? Klik deploy akan secara otomatis mengunggah file Anda ke Vercel dan menghubungkan domain pilihan Anda.",
        "deploy-button": "Deploy Proyek",
        "deploy-loading-text": "Mendeploy...",
        "footer-text": "&copy; 2024 FishNemo - Deployer. Dibuat dengan ❤️ | <a href=\"/docs\" style=\"color: var(--secondary-text-color);\">API Docs</a>"
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const langToggleContainer = document.getElementById('lang-toggle');
    let currentLang = 'en';

    const setLanguage = (lang) => {
        if (!translations[lang]) return;
        currentLang = lang;
        document.querySelectorAll('[data-translate]').forEach(el => {
            const key = el.dataset.translate;
            if (translations[lang][key]) el.innerHTML = translations[lang][key];
        });
        if (langToggleContainer) {
            langToggleContainer.querySelectorAll('button').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.lang === lang);
            });
        }
        const domainSelect = document.getElementById('domain-select');
        if (domainSelect) {
            const firstOption = domainSelect.querySelector('option');
            if (firstOption && firstOption.value === "") {
                 firstOption.textContent = translations[lang]['select-domain-placeholder'] || translations[lang]['loading-domains'];
            }
        }
    };

    if (langToggleContainer) {
        langToggleContainer.addEventListener('click', e => {
            if (e.target.tagName === 'BUTTON') setLanguage(e.target.dataset.lang);
        });
    }

    const musicControl = document.getElementById('music-control');
    if (musicControl) {
        // ... (Logika musik tetap sama)
    }

    const deployBtn = document.getElementById('deploy-btn');
    if (deployBtn) {
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');
        const browseBtn = document.getElementById('browse-btn');
        const fileList = document.getElementById('file-list');
        const domainSelect = document.getElementById('domain-select');
        const subdomainInput = document.getElementById('subdomain-name');
        const urlPreview = document.getElementById('url-preview-text');
        const previewBtn = document.getElementById('preview-btn');
        const statusMessage = document.getElementById('status-message');
        const loader = deployBtn.querySelector('.loader');
        const buttonText = deployBtn.querySelector('.button-text');
        let uploadedFiles = [];
        let originalZipFile = null; // Variabel baru untuk menyimpan file ZIP asli

        const fetchDomains = async () => { /* ... (fungsi ini tetap sama) ... */ };
        
        const handleFiles = async (files) => {
            fileList.innerHTML = '';
            uploadedFiles = [];
            originalZipFile = null; // Reset setiap kali upload baru
            deployBtn.disabled = true;
            previewBtn.disabled = true;

            const file = files[0]; // Kita hanya proses satu file ZIP atau beberapa file biasa

            if (file && (file.type === 'application/zip' || file.name.endsWith('.zip'))) {
                originalZipFile = file; // Simpan file ZIP asli
                displayFile(` unpacking ${file.name}...`, 'fas fa-spinner fa-spin');
                const zip = await JSZip.loadAsync(file);
                fileList.innerHTML = '';
                let fileEntries = Object.values(zip.files).filter(entry => !entry.dir);
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
            } else {
                // Handle multiple non-zip files
                for (const f of files) {
                    uploadedFiles.push(f);
                    displayFile(f.name);
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
        
        const openPreview = async () => { /* ... (fungsi ini tetap sama) ... */ };
        const updateUrlPreview = () => { /* ... (fungsi ini tetap sama) ... */ };
        
        const deployProject = async () => {
            const subdomain = subdomainInput.value.trim().toLowerCase();
            const domainId = domainSelect.value;
            if (uploadedFiles.length === 0 || !subdomain || !domainId) {
                showStatus('Please upload files, provide a project name, and select a domain.', 'error');
                return;
            }
            setLoadingState(true);
            const formData = new FormData();
            formData.append('subdomain', subdomain);
            formData.append('domainId', domainId);
            formData.append('domainName', domainSelect.options[domainSelect.selectedIndex].textContent);
            
            // --- PERBAIKAN LOGIKA PENGIRIMAN ---
            // 1. Kirim file ZIP asli jika ada, dengan nama 'zip_file'
            if (originalZipFile) {
                formData.append('zip_file', originalZipFile);
            }
            
            // 2. Selalu kirim semua file yang sudah diekstrak (atau file asli jika bukan zip)
            //    dengan nama 'files'
            uploadedFiles.forEach(file => {
                formData.append('files', file, file.name);
            });
            // ------------------------------------

            try {
                const response = await fetch('/api/deploy', { method: 'POST', body: formData });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message);
                showStatus(`Success! Your site is live at: <a href="https://${result.finalUrl}" target="_blank">${result.finalUrl}</a>`, 'success');
            } catch (error) {
                showStatus(`Error: ${error.message}`, 'error');
            } finally {
                setLoadingState(false);
            }
        };

        const showStatus = (message, type) => { /* ... (fungsi ini tetap sama) ... */ };
        
        const setLoadingState = (isLoading) => {
             if (isLoading) {
                deployBtn.disabled = true;
                deployBtn.classList.add('loading');
                loader.hidden = false;
                buttonText.textContent = translations[currentLang]['deploy-loading-text'];
            } else {
                deployBtn.classList.remove('loading');
                loader.hidden = true;
                buttonText.textContent = translations[currentLang]['deploy-button'];
                deployBtn.disabled = uploadedFiles.length === 0;
            }
        };
        
        // --- Event Listeners (disingkat, karena tidak berubah) ---
        dropZone.addEventListener('dragover', e => e.preventDefault());
        dropZone.addEventListener('drop', e => { e.preventDefault(); handleFiles(e.dataTransfer.files); });
        browseBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => handleFiles(fileInput.files));
        previewBtn.addEventListener('click', openPreview);
        subdomainInput.addEventListener('input', updateUrlPreview);
        domainSelect.addEventListener('change', updateUrlPreview);
        deployBtn.addEventListener('click', deployProject);

        setLanguage('en');
        fetchDomains();
    }
});

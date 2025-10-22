// script.js (Lengkap dengan perbaikan bahasa dan struktur)

document.addEventListener('DOMContentLoaded', () => {
    // --- Data & Variabel Global ---
    const translations = {
        en: {
            "header-subtitle": "Deploy your static projects in seconds.",
            "step1-title": "Upload Your Project Files",
            "dropzone-title": "Drag & Drop your files here",
            "dropzone-subtitle": "(html, css, js, jsx, tsx, or a .zip file)",
            "dropzone-or": "or",
            "browse-button": "Browse Files",
            "project-files": "Project Files:",
            "preview-button": "Check Preview",
            "step2-title": "Configure & Launch",
            "project-name-label": "Choose a Project Name",
            "url-preview-title": "Your new website URL will be:",
            "deploy-button": "Deploy Project",
            "deploy-loading-text": "Deploying...",
            "footer-text": "&copy; 2024 FishNemo Deployer. All rights reserved. | <a href=\"/admin\" style=\"color: var(--secondary-text-color);\">Admin</a> | <a href=\"/docs\" style=\"color: var(--secondary-text-color);\">API Docs</a>"
        },
        id: {
            "header-subtitle": "Deploy proyek statis Anda dalam hitungan detik.",
            "step1-title": "Unggah File Proyek Anda",
            "dropzone-title": "Seret & Lepas file Anda di sini",
            "dropzone-subtitle": "(html, css, js, jsx, tsx, atau file .zip)",
            "dropzone-or": "atau",
            "browse-button": "Cari File",
            "project-files": "File Proyek:",
            "preview-button": "Cek Pratinjau",
            "step2-title": "Konfigurasi & Luncurkan",
            "project-name-label": "Pilih Nama Proyek",
            "url-preview-title": "URL website baru Anda adalah:",
            "deploy-button": "Deploy Proyek",
            "deploy-loading-text": "Mendeploy...",
            "footer-text": "&copy; 2024 FishNemo Deployer. Hak Cipta Dilindungi. | <a href=\"/admin\" style=\"color: var(--secondary-text-color);\">Admin</a> | <a href=\"/docs\" style=\"color: var(--secondary-text-color);\">API Docs</a>"
        },
        es: {
            "header-subtitle": "Implementa tus proyectos estáticos en segundos.",
            "step1-title": "Sube los Archivos de tu Proyecto",
            "dropzone-title": "Arrastra y suelta tus archivos aquí",
            "dropzone-subtitle": "(html, css, js, jsx, tsx, o un archivo .zip)",
            "dropzone-or": "o",
            "browse-button": "Buscar Archivos",
            "project-files": "Archivos del Proyecto:",
            "preview-button": "Ver Vista Previa",
            "step2-title": "Configurar y Lanzar",
            "project-name-label": "Elige un Nombre de Proyecto",
            "url-preview-title": "La URL de tu nuevo sitio web será:",
            "deploy-button": "Implementar Proyecto",
            "deploy-loading-text": "Implementando...",
            "footer-text": "&copy; 2024 FishNemo Deployer. Todos los derechos reservados. | <a href=\"/admin\" style=\"color: var(--secondary-text-color);\">Admin</a> | <a href=\"/docs\" style=\"color: var(--secondary-text-color);\">API Docs</a>"
        }
    };
    const supportedLanguages = [
        { code: 'en', name: 'English' },
        { code: 'id', name: 'Indonesia' },
        { code: 'es', name: 'Español' }
    ];
    let currentLang = 'en';
    const originalTexts = {};

    // --- Fungsi Inisialisasi ---
    function initialize() {
        queryAndStoreOriginalTexts();
        initializeGlobalScripts();
        initializeDeployPageScripts();
    }

    // --- Fungsi Global ---
    function queryAndStoreOriginalTexts() {
        document.querySelectorAll('[data-translate]').forEach(el => {
            const key = el.dataset.translate;
            originalTexts[key] = el.innerHTML;
        });
    }

    async function translateAllElements(targetLang) {
        const elementsToTranslate = document.querySelectorAll('[data-translate]');
        if (targetLang === 'en') {
            elementsToTranslate.forEach(el => {
                const key = el.dataset.translate;
                if (originalTexts[key]) el.innerHTML = originalTexts[key];
            });
            return;
        }
        const textsToTranslate = Array.from(elementsToTranslate).map(el => originalTexts[el.dataset.translate]);
        try {
            const response = await fetch('https://libretranslate.de/translate', {
                method: 'POST',
                body: JSON.stringify({ q: textsToTranslate, source: 'en', target: targetLang, format: 'html' }),
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) throw new Error('Translation API request failed');
            const { translatedText } = await response.json();
            elementsToTranslate.forEach((el, index) => {
                el.innerHTML = translatedText[index];
            });
        } catch (error) {
            console.error('Translation failed:', error);
            translateAllElements('en');
        }
    }

    function initializeGlobalScripts() {
        const langContainer = document.getElementById('lang-globe-container');
        const musicControl = document.getElementById('music-control');

        const setLanguage = async (lang) => {
            if (currentLang === lang) return;
            currentLang = lang;
            document.documentElement.lang = lang;
            await translateAllElements(lang);
            if (langContainer) {
                const dropdown = langContainer.querySelector('#lang-dropdown');
                dropdown.querySelectorAll('button').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.lang === lang);
                });
            }
        };

        if (langContainer) {
            const globeBtn = langContainer.querySelector('#lang-globe-btn');
            const dropdown = langContainer.querySelector('#lang-dropdown');
            supportedLanguages.forEach(lang => {
                const button = document.createElement('button');
                button.dataset.lang = lang.code;
                button.textContent = lang.name;
                if (lang.code === 'en') button.classList.add('active');
                dropdown.appendChild(button);
            });
            globeBtn.addEventListener('click', e => {
                e.stopPropagation();
                dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
            });
            dropdown.addEventListener('click', e => {
                if (e.target.tagName === 'BUTTON') {
                    setLanguage(e.target.dataset.lang);
                    dropdown.style.display = 'none';
                }
            });
            document.addEventListener('click', e => {
                if (!langContainer.contains(e.target)) dropdown.style.display = 'none';
            });
        }
        
        if (musicControl) {
            // ... (Logika musik tidak berubah)
        }

        setLanguage('en');
    }

    // --- Fungsi Spesifik Halaman Deploy ---
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
        const loader = deployBtn.querySelector('.loader');
        const buttonText = deployBtn.querySelector('.button-text');
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
                displayFile(` unpacking ${file.name}...`, 'fas fa-spinner fa-spin');
                const zip = await JSZip.loadAsync(file);
                fileList.innerHTML = '';
                let fileEntries = Object.values(zip.files).filter(entry => !entry.dir);
                let rootFolder = '';
                if (fileEntries.length > 0) {
                    const firstPathParts = fileEntries[0].name.split('/');
                    if (firstPathParts.length > 1) {
                        const potentialRoot = firstPathParts[0] + '/';
                        if (fileEntries.every(entry => entry.name.startsWith(potentialRoot))) rootFolder = potentialRoot;
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

        const openPreview = async () => {
            if (uploadedFiles.length === 0) return;
            const filesForStorage = await Promise.all(
                uploadedFiles.map(file => new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onload = e => resolve({ name: file.name, type: file.type, dataUrl: e.target.result });
                    reader.readAsDataURL(file);
                }))
            );
            sessionStorage.setItem('previewFiles', JSON.stringify(filesForStorage));
            window.open('/preview', '_blank');
        };

        const updateUrlPreview = () => {
            const projectName = subdomainInput.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
            urlPreview.textContent = projectName ? `${projectName}.vercel.app` : '...';
        };

        const deployProject = async () => {
            const subdomain = subdomainInput.value.trim().toLowerCase();
            if (uploadedFiles.length === 0 || !subdomain) {
                showStatus('Please upload files and provide a project name.', 'error');
                return;
            }
            setLoadingState(true);
            const formData = new FormData();
            formData.append('subdomain', subdomain);
            if (originalZipFile) {
                formData.append('zip_file', originalZipFile);
            }
            uploadedFiles.forEach(file => {
                formData.append('files', file, file.name);
            });
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
        
        const showStatus = (message, type) => {
            statusMessage.innerHTML = message;
            statusMessage.className = type;
        };

        const setLoadingState = (isLoading) => {
            const buttonTextEl = deployBtn.querySelector('.button-text');
            const loaderEl = deployBtn.querySelector('.loader');
            if (isLoading) {
                deployBtn.disabled = true;
                deployBtn.classList.add('loading');
                buttonTextEl.style.opacity = '0';
                loaderEl.style.display = 'block';
            } else {
                deployBtn.classList.remove('loading');
                buttonTextEl.style.opacity = '1';
                loaderEl.style.display = 'none';
                deployBtn.disabled = uploadedFiles.length === 0;
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

    // --- Titik Masuk Utama ---
    initialize();
});

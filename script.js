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
    const statusMessage = document.getElementById('status-message');
    const loader = deployBtn.querySelector('.loader');
    const buttonText = deployBtn.querySelector('.button-text');

    // --- State ---
    let uploadedFiles = []; // This will store the actual File objects

    // --- Functions ---
    const fetchDomains = async () => {
        try {
            // --- PERUBAHAN DI SINI ---
            // Kita sekarang memanggil proxy lokal kita, bukan API eksternal secara langsung.
            const response = await fetch('/api/get-domains');
            // -------------------------

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

        for (const file of files) {
            if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
                displayFile(` unpacking ${file.name}...`, 'fas fa-spinner fa-spin');
                const zip = await JSZip.loadAsync(file);
                fileList.innerHTML = ''; // Clear "unpacking" message
                for (const filename in zip.files) {
                    if (!zip.files[filename].dir) {
                        const fileData = await zip.files[filename].async('blob');
                        // Buat path relatif yang benar jika ada folder di dalam zip
                        const extractedFile = new File([fileData], filename);
                        uploadedFiles.push(extractedFile);
                        displayFile(filename, 'fas fa-file-code');
                    }
                }
            } else {
                uploadedFiles.push(file);
                displayFile(file.name);
            }
        }

        if (uploadedFiles.length > 0) {
            deployBtn.disabled = false;
        }
    };

    const displayFile = (name, iconClass = 'fas fa-file') => {
        const li = document.createElement('li');
        li.innerHTML = `<i class="${iconClass}"></i> ${name}`;
        fileList.appendChild(li);
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
        deployBtn.disabled = isLoading;
        loader.hidden = !isLoading;
        buttonText.textContent = isLoading ? 'Deploying...' : 'Deploy Project';
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
    
    subdomainInput.addEventListener('input', updateUrlPreview);
    domainSelect.addEventListener('change', updateUrlPreview);
    deployBtn.addEventListener('click', deployProject);

    // --- Initial Load ---
    fetchDomains();
});

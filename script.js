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

    const API_URLS = {
        domains: 'https://subdo.fishnemo.xyz/api/domains',
        create: 'https://subdo.fishnemo.xyz/api/create'
    };
    
    // --- State ---
    let domainsData = [];

    // --- Functions ---

    // 1. Fetch domains from API and populate the select dropdown
    const fetchDomains = async () => {
        try {
            const response = await fetch(API_URLS.domains);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            domainsData = await response.json();
            
            domainSelect.innerHTML = '<option value="" disabled selected>-- Select a domain --</option>'; // Placeholder
            domainsData.forEach(domain => {
                const option = document.createElement('option');
                option.value = domain.id;
                option.textContent = domain.name;
                domainSelect.appendChild(option);
            });
            updateUrlPreview();
        } catch (error) {
            console.error("Failed to fetch domains:", error);
            domainSelect.innerHTML = '<option value="">Could not load domains</option>';
        }
    };

    // 2. Handle file uploads (from both drop and browse)
    const handleFiles = (files) => {
        fileList.innerHTML = ''; // Clear previous list
        [...files].forEach(file => {
            if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
                handleZipFile(file);
            } else {
                displayFile(file.name);
            }
        });
    };
    
    // 3. Unzip and display contents of a ZIP file
    const handleZipFile = (zipFile) => {
         displayFile(` unpacking ${zipFile.name}...`, 'fas fa-spinner fa-spin');
         JSZip.loadAsync(zipFile).then(zip => {
            // Clear the "unpacking" message
            fileList.innerHTML = '';
            // Display actual files
            Object.keys(zip.files).forEach(filename => {
                if (!zip.files[filename].dir) { // only show files, not directories
                   displayFile(filename, 'fas fa-file-code');
                }
            });
         });
    };

    // 4. Display a single file in the list
    const displayFile = (name, iconClass = 'fas fa-file') => {
        const li = document.createElement('li');
        li.innerHTML = `<i class="${iconClass}"></i> ${name}`;
        fileList.appendChild(li);
    };
    
    // 5. Update the URL preview based on user input
    const updateUrlPreview = () => {
        const subdomain = subdomainInput.value.trim().toLowerCase() || '[subdomain]';
        const selectedOption = domainSelect.options[domainSelect.selectedIndex];
        
        if (selectedOption && selectedOption.value) {
            const domainName = selectedOption.textContent;
            urlPreview.textContent = `${subdomain}.${domainName}`;
        } else {
            urlPreview.textContent = '...';
        }
    };

    // 6. Create Subdomain via API POST Request
    const createSubdomain = async () => {
        const subdomain = subdomainInput.value.trim().toLowerCase();
        const domainId = domainSelect.value;
        const targetCname = 'cname.vercel-dns.com'; // Standard Vercel CNAME target

        // Validation
        if (!subdomain) {
            showStatus('Please enter a subdomain name.', 'error');
            return;
        }
        if (!domainId) {
            showStatus('Please select a domain.', 'error');
            return;
        }
        
        setLoadingState(true);

        const formData = new URLSearchParams();
        formData.append('subdomain', subdomain);
        formData.append('domain_id', domainId);
        formData.append('record_type', 'CNAME');
        formData.append('target', targetCname);

        try {
            const response = await fetch(API_URLS.create, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData
            });

            const result = await response.json();

            if (!response.ok) {
                // Assuming the API might send a meaningful error message
                throw new Error(result.message || 'An unknown error occurred.');
            }

            showStatus(result.message, 'success');
            
        } catch (error) {
            console.error('Error creating subdomain:', error);
            showStatus(`Error: ${error.message}`, 'error');
        } finally {
            setLoadingState(false);
        }
    };

    // 7. Show status messages (success/error)
    const showStatus = (message, type) => {
        statusMessage.textContent = message;
        statusMessage.className = type; // 'success' or 'error'
    };

    // 8. Manage loading state for the deploy button
    const setLoadingState = (isLoading) => {
        if (isLoading) {
            deployBtn.disabled = true;
            loader.hidden = false;
            buttonText.textContent = 'Creating...';
        } else {
            deployBtn.disabled = false;
            loader.hidden = true;
            buttonText.textContent = 'Create Subdomain';
        }
    };

    // --- Event Listeners ---

    // Drag and Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });

    // Browse Button
    browseBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => handleFiles(fileInput.files));
    
    // Form Inputs
    subdomainInput.addEventListener('input', updateUrlPreview);
    domainSelect.addEventListener('change', updateUrlPreview);

    // Deploy Button
    deployBtn.addEventListener('click', createSubdomain);

    // --- Initial Load ---
    fetchDomains();
});

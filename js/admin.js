// js/admin.js

document.addEventListener('DOMContentLoaded', () => {
    const loginSection = document.getElementById('login-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const passwordInput = document.getElementById('admin-password');
    const loginBtn = document.getElementById('login-btn');
    const deploysTableBody = document.querySelector('#deploys-table tbody');
    const loginError = document.getElementById('login-error');
    const refreshBtn = document.getElementById('refresh-btn');
    const totalDeploysSpan = document.getElementById('total-deploys');
    const logoutBtn = document.getElementById('logout-btn');
    const loginBtnText = loginBtn.querySelector('.button-text');
    const loginLoader = loginBtn.querySelector('.loader');

    // Create dynamic Toast notifications inside the admin interface
    const showAdminToast = (message, type = 'info') => {
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
                <i class="${type === 'success' ? 'fas fa-check-circle' : type === 'error' ? 'fas fa-times' : 'fas fa-info'}"></i>
                <span>${message}</span>
            </div>
        `;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 50);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    };

    const renderSkeleton = () => {
        deploysTableBody.innerHTML = Array(4).fill(0).map(() => `
            <tr class="skeleton-row">
                <td><div class="skeleton-cell mini"></div></td>
                <td><div class="skeleton-cell medium"></div></td>
                <td><div class="skeleton-cell short"></div></td>
                <td><div class="skeleton-cell btn-skel"></div></td>
            </tr>
        `).join('');
    };

    const secureSetSession = (pass) => {
        // Base64 encoding to obfuscate plaintext passwords in session storage
        sessionStorage.setItem('admin_pass_obf', btoa(unescape(encodeURIComponent(pass))));
    };

    const secureGetSession = () => {
        const obf = sessionStorage.getItem('admin_pass_obf');
        if (!obf) return null;
        try {
            return decodeURIComponent(escape(atob(obf)));
        } catch (e) {
            return null;
        }
    };

    const fetchAndRenderDeploys = async () => {
        const password = secureGetSession();
        if (!password) {
            showLogin("Active session missing or expired.");
            return;
        }
        renderSkeleton();
        try {
            const response = await fetch('/api/get-deploys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Verification Error.');
            }
            const data = await response.json();
            totalDeploysSpan.textContent = data.count;
            renderTable(data.deploys);
        } catch (error) {
            deploysTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--error-color); padding: 30px;">${error.message}</td></tr>`;
            showAdminToast(error.message, 'error');
        }
    };

    const loginAction = async () => {
        const password = passwordInput.value;
        if (!password) return;
        
        loginError.style.display = 'none';
        loginBtnText.textContent = '';
        loginLoader.hidden = false;
        loginBtn.disabled = true;

        try {
            const response = await fetch('/api/get-deploys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            
            if (response.status === 401) throw new Error('Incorrect system password.');
            if (!response.ok) throw new Error('Unresolved server exception.');

            const data = await response.json();
            loginSection.style.display = 'none';
            dashboardSection.style.display = 'block';
            logoutBtn.style.display = 'inline-block';
            
            secureSetSession(password);
            totalDeploysSpan.textContent = data.count;
            renderTable(data.deploys);
            showAdminToast("Authenticated successfully.", "success");
        } catch (error) {
            loginError.textContent = error.message;
            loginError.style.display = 'block';
            showAdminToast(error.message, 'error');
        } finally {
            loginBtnText.textContent = 'Login';
            loginLoader.hidden = true;
            loginBtn.disabled = false;
        }
    };

    loginBtn.addEventListener('click', loginAction);
    passwordInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') loginBtn.click(); });
    logoutBtn.addEventListener('click', () => showLogin("Session ended."));
    refreshBtn.addEventListener('click', fetchAndRenderDeploys);

    const renderTable = (deploys) => {
        deploysTableBody.innerHTML = '';
        if (deploys.length === 0) {
            deploysTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: var(--secondary-text-color);">No deployment runtimes linked.</td></tr>';
            return;
        }
        deploys.forEach(deploy => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${deploy.project_name}</strong></td>
                <td><a href="https://${deploy.domain_name}" target="_blank" class="table-link">${deploy.domain_name} <i class="fas fa-external-link-alt" style="font-size: 0.85em; margin-left: 4px;"></i></a></td>
                <td>${new Date(deploy.created_at).toLocaleString()}</td>
                <td><button class="delete-btn btn btn-outline-danger btn-sm" data-id="${deploy.id}" data-domain="${deploy.domain_name}"><i class="fas fa-trash-alt"></i> Delete</button></td>
            `;
            deploysTableBody.appendChild(row);
        });
    };

    deploysTableBody.addEventListener('click', async (e) => {
        const button = e.target.closest('.delete-btn');
        if (button) {
            const vercelProjectId = button.dataset.id;
            const domainName = button.dataset.domain;
            const password = secureGetSession();

            // Unified Non-Blocking Dialog Implementation
            const confirmation = confirm(`Confirm removal parameters for "${domainName}"? This action releases DNS structures on Vercel.`);
            if (confirmation) {
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
                button.disabled = true;

                try {
                    const res = await fetch('/api/delete-deploy', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: vercelProjectId, domain: domainName, password })
                    });

                    const result = await res.json();
                    if (!res.ok) throw new Error(result.message);

                    const targetRow = button.closest('tr');
                    targetRow.style.transform = 'scale(0.95)';
                    targetRow.style.opacity = '0';
                    targetRow.style.transition = 'all 0.4s ease-out';
                    
                    setTimeout(() => {
                        targetRow.remove();
                        totalDeploysSpan.textContent = Math.max(0, parseInt(totalDeploysSpan.textContent, 10) - 1);
                        if (deploysTableBody.children.length === 0) {
                            deploysTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px;">No deployments found.</td></tr>';
                        }
                    }, 400);

                    showAdminToast("Site deletion complete.", "success");
                } catch (err) {
                    showAdminToast(`Operation failed: ${err.message}`, "error");
                    button.innerHTML = '<i class="fas fa-trash-alt"></i> Delete';
                    button.disabled = false;
                }
            }
        }
    });

    function showLogin(message) {
        sessionStorage.removeItem('admin_pass_obf');
        loginSection.style.display = 'block';
        dashboardSection.style.display = 'none';
        logoutBtn.style.display = 'none';
        if (message) {
            loginError.textContent = message;
            loginError.style.display = 'block';
        }
    }

    const savedPassword = secureGetSession();
    if (savedPassword) {
        passwordInput.value = savedPassword;
        loginAction();
    }
});

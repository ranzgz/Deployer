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

    const fetchAndRenderDeploys = async () => {
        const password = sessionStorage.getItem('admin_pass');
        if (!password) {
            showLogin("Session expired. Please login again.");
            return;
        }
        deploysTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Refreshing data... <i class="fas fa-spinner fa-spin"></i></td></tr>';
        try {
            const response = await fetch('/api/get-deploys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch data');
            }
            const data = await response.json();
            totalDeploysSpan.textContent = data.count;
            renderTable(data.deploys);
        } catch (error) {
            deploysTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--error-color);">${error.message}</td></tr>`;
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
            if (response.status === 401) throw new Error('Invalid Password.');
            if (!response.ok) throw new Error('Server Error. Please check the console.');
            
            const data = await response.json();
            loginSection.style.display = 'none';
            dashboardSection.style.display = 'block';
            logoutBtn.style.display = 'inline-block';
            sessionStorage.setItem('admin_pass', password);
            totalDeploysSpan.textContent = data.count;
            renderTable(data.deploys);
        } catch (error) {
            loginError.textContent = error.message;
            loginError.style.display = 'block';
        } finally {
            loginBtnText.textContent = 'Login';
            loginLoader.hidden = true;
            loginBtn.disabled = false;
        }
    };
    
    loginBtn.addEventListener('click', loginAction);
    passwordInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') loginBtn.click(); });
    logoutBtn.addEventListener('click', () => showLogin("You have been logged out."));
    refreshBtn.addEventListener('click', fetchAndRenderDeploys);

    const renderTable = (deploys) => {
        deploysTableBody.innerHTML = '';
        if (deploys.length === 0) {
            deploysTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No deployments found on Vercel.</td></tr>';
            return;
        }
        deploys.forEach(deploy => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${deploy.project_name}</td>
                <td><a href="https://${deploy.domain_name}" target="_blank">${deploy.domain_name} <i class="fas fa-external-link-alt" style="font-size: 0.8em;"></i></a></td>
                <td>${new Date(deploy.created_at).toLocaleString()}</td>
                <td><button class="delete-btn" data-id="${deploy.id}" data-domain="${deploy.domain_name}"><i class="fas fa-trash"></i> Delete</button></td>
            `;
            deploysTableBody.appendChild(row);
        });
    };
    
    deploysTableBody.addEventListener('click', async (e) => {
        const button = e.target.closest('.delete-btn');
        if (button) {
            const vercelProjectId = button.dataset.id;
            const domainName = button.dataset.domain;
            const password = sessionStorage.getItem('admin_pass');

            if (confirm(`Are you sure you want to delete "${domainName}"? This will delete the Vercel project and its DNS record.`)) {
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
                button.disabled = true;
                
                try {
                    const res = await fetch('/api/delete-deploy', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: vercelProjectId, domain: domainName, password }) 
                    });
                    
                    const result = await res.json();
                    if (!res.ok) throw new Error(result.message);
                    
                    button.closest('tr').style.opacity = '0.5';
                    button.closest('tr').style.pointerEvents = 'none';
                    alert(result.message);
                    totalDeploysSpan.textContent = parseInt(totalDeploysSpan.textContent, 10) - 1;

                } catch(err) {
                    alert(`Error: ${err.message}`);
                    button.innerHTML = '<i class="fas fa-trash"></i> Delete';
                    button.disabled = false;
                }
            }
        }
    });

    function showLogin(message) {
        sessionStorage.removeItem('admin_pass');
        loginSection.style.display = 'block';
        dashboardSection.style.display = 'none';
        logoutBtn.style.display = 'none';
        if (message) {
            loginError.textContent = message;
            loginError.style.display = 'block';
        }
    }

    const savedPassword = sessionStorage.getItem('admin_pass');
    if (savedPassword) {
        passwordInput.value = savedPassword;
        loginAction();
    }
});

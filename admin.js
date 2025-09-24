// admin.js
document.addEventListener('DOMContentLoaded', () => {
    const loginSection = document.getElementById('login-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const passwordInput = document.getElementById('admin-password');
    const loginBtn = document.getElementById('login-btn');
    const deploysTableBody = document.querySelector('#deploys-table tbody');
    const loginError = document.getElementById('login-error');
    const refreshBtn = document.getElementById('refresh-btn');

    // Cek jika password sudah ada di session storage (untuk refresh halaman)
    const savedPassword = sessionStorage.getItem('admin_pass');
    if (savedPassword) {
        passwordInput.value = savedPassword;
        loginBtn.click();
    }

    const fetchAndRenderDeploys = async () => {
        const password = sessionStorage.getItem('admin_pass');
        if (!password) {
            showLogin("Session expired. Please login again.");
            return;
        }

        deploysTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Refreshing data...</td></tr>';
        
        try {
            const response = await fetch('/api/get-deploys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            if (response.status === 401) {
                showLogin("Invalid password. Please try again.");
                return;
            }
            if (!response.ok) {
                throw new Error('Failed to fetch data from the server.');
            }
            
            const deploys = await response.json();
            renderTable(deploys);
        } catch (error) {
            deploysTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--error-color);">${error.message}</td></tr>`;
        }
    };

    loginBtn.addEventListener('click', async () => {
        const password = passwordInput.value;
        if (!password) return;

        loginError.style.display = 'none';
        loginBtn.textContent = 'Logging in...';
        loginBtn.disabled = true;

        try {
            const response = await fetch('/api/get-deploys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            if (response.status === 401) throw new Error('Invalid Password.');
            if (!response.ok) throw new Error('Server Error. Please check the console.');
            
            const deploys = await response.json();
            loginSection.style.display = 'none';
            dashboardSection.style.display = 'block';
            sessionStorage.setItem('admin_pass', password);
            renderTable(deploys);
        } catch (error) {
            loginError.textContent = error.message;
            loginError.style.display = 'block';
        } finally {
            loginBtn.textContent = 'Login';
            loginBtn.disabled = false;
        }
    });

    passwordInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            loginBtn.click();
        }
    });

    const renderTable = (deploys) => {
        deploysTableBody.innerHTML = '';
        if (deploys.length === 0) {
            deploysTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No deployments found.</td></tr>';
            return;
        }

        deploys.forEach(deploy => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${deploy.id}</td>
                <td>${deploy.project_name}</td>
                <td><a href="https://${deploy.domain_name}" target="_blank">${deploy.domain_name}</a></td>
                <td>${new Date(deploy.created_at).toLocaleString()}</td>
                <td><button class="delete-btn" data-id="${deploy.id}" data-domain="${deploy.domain_name}">Delete</button></td>
            `;
            deploysTableBody.appendChild(row);
        });
    };
    
    deploysTableBody.addEventListener('click', async (e) => {
        if(e.target.classList.contains('delete-btn')) {
            const button = e.target;
            const id = button.dataset.id;
            const domain = button.dataset.domain;
            const password = sessionStorage.getItem('admin_pass');

            if (confirm(`Are you sure you want to delete ${domain}? This cannot be undone.`)) {
                button.textContent = 'Deleting...';
                button.disabled = true;
                
                try {
                    const res = await fetch('/api/delete-deploy', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id, password })
                    });
                    
                    const result = await res.json();
                    if (!res.ok) throw new Error(result.message);
                    
                    button.closest('tr').remove();
                    alert(result.message);
                } catch(err) {
                    alert(`Error: ${err.message}`);
                    button.textContent = 'Delete';
                    button.disabled = false;
                }
            }
        }
    });

    refreshBtn.addEventListener('click', fetchAndRenderDeploys);

    function showLogin(message) {
        sessionStorage.removeItem('admin_pass');
        loginSection.style.display = 'block';
        dashboardSection.style.display = 'none';
        loginError.textContent = message;
        loginError.style.display = 'block';
    }
});

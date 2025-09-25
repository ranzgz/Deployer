// admin.js

document.addEventListener('DOMContentLoaded', () => {
    const loginSection = document.getElementById('login-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const passwordInput = document.getElementById('admin-password');
    const loginBtn = document.getElementById('login-btn');
    const deploysTableBody = document.querySelector('#deploys-table tbody');
    const loginError = document.getElementById('login-error');
    const refreshBtn = document.getElementById('refresh-btn');
    const totalDeploysSpan = document.getElementById('total-deploys');

    const fetchAndRenderDeploys = async () => {
        const password = sessionStorage.getItem('admin_pass');
        if (!password) {
            showLogin("Session expired. Please login again.");
            return;
        }

        deploysTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Refreshing data...</td></tr>';
        
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
        loginBtn.textContent = 'Logging in...';
        loginBtn.disabled = true;

        try {
            // Kita tidak memanggil fetchAndRenderDeploys di sini lagi, cukup cek password
            const response = await fetch('/api/get-deploys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            if (response.status === 401) throw new Error('Invalid Password.');
            if (!response.ok) throw new Error('Server Error. Please check the console.');
            
            loginSection.style.display = 'none';
            dashboardSection.style.display = 'block';
            sessionStorage.setItem('admin_pass', password);
            
            // Setelah login berhasil, baru kita fetch datanya
            const data = await response.json();
            totalDeploysSpan.textContent = data.count;
            renderTable(data.deploys);

        } catch (error) {
            loginError.textContent = error.message;
            loginError.style.display = 'block';
        } finally {
            loginBtn.textContent = 'Login';
            loginBtn.disabled = false;
        }
    };
    
    loginBtn.addEventListener('click', loginAction);
    passwordInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') loginBtn.click(); });


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
                <td><a href="https://${deploy.domain_name}" target="_blank">${deploy.domain_name}</a></td>
                <td>${new Date(deploy.created_at).toLocaleString()}</td>
                <td>
                    <button class="delete-btn" data-id="${deploy.id}" data-domain="${deploy.domain_name}">Delete</button>
                </td>
            `;
            deploysTableBody.appendChild(row);
        });
    };
    
    deploysTableBody.addEventListener('click', async (e) => {
        if(e.target.classList.contains('delete-btn')) {
            const button = e.target;
            const vercelProjectId = button.dataset.id;
            const domainName = button.dataset.domain;
            const password = sessionStorage.getItem('admin_pass');

            if (confirm(`Are you sure you want to delete ${domainName}? This will delete the Vercel project and DNS record.`)) {
                button.textContent = 'Deleting...';
                button.disabled = true;
                
                try {
                    const res = await fetch('/api/delete-deploy', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: vercelProjectId, domain: domainName, password }) 
                    });
                    
                    const result = await res.json();
                    if (!res.ok) throw new Error(result.message);
                    
                    button.closest('tr').remove();
                    totalDeploysSpan.textContent = parseInt(totalDeploysSpan.textContent, 10) - 1;
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

    // Auto-login jika password ada di session
    const savedPassword = sessionStorage.getItem('admin_pass');
    if (savedPassword) {
        passwordInput.value = savedPassword;
        loginAction();
    }
});

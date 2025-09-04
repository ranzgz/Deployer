import formidable from 'formidable';
import fs from 'fs';

export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
    const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;

    if (!VERCEL_API_TOKEN) {
        return res.status(500).json({ message: 'Server configuration error: Vercel API token is missing.' });
    }

    try {
        const { fields, files } = await parseFormData(req);
        const { subdomain, domainId, domainName } = fields;
        const uploadedFiles = files.files;
        if (!subdomain || !domainId || !domainName || !uploadedFiles || !uploadedFiles.length) {
            return res.status(400).json({ message: 'Missing required fields or files.' });
        }
        
        const projectName = subdomain[0];
        const finalDomain = `${projectName}.${domainName[0]}`;
        const vercelFilesPayload = await prepareFilesForVercel(uploadedFiles);
        
        // --- Langkah 1: Deploy ke Vercel ---
        console.log(`Step 1: Deploying project "${projectName}"...`);
        const vercelApiUrl = VERCEL_TEAM_ID ? `https://api.vercel.com/v13/deployments?teamId=${VERCEL_TEAM_ID}` : 'https://api.vercel.com/v13/deployments';
        const deployResponse = await fetch(vercelApiUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: projectName, files: vercelFilesPayload, projectSettings: { framework: null } }),
        });
        const deployData = await deployResponse.json();
        if (!deployResponse.ok) throw new Error(`Vercel Deploy Error: ${deployData.error?.message}`);
        const projectId = deployData.projectId;
        console.log(`Step 1 Success. Project ID: ${projectId}`);

        // --- Langkah 2: Add Domain ke Vercel ---
        console.log(`Step 2: Adding domain ${finalDomain} to project...`);
        await fetch(`https://api.vercel.com/v10/projects/${projectId}/domains`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: finalDomain }),
        });

        // --- Langkah 3: Dapatkan Konfigurasi & Tentukan Target DNS ---
        console.log(`Step 3: Getting domain configuration...`);
        const domainConfigResponse = await fetch(`https://api.vercel.com/v9/projects/${projectId}/domains/${finalDomain}`, {
            headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}` }
        });
        const domainConfigData = await domainConfigResponse.json();
        if (!domainConfigResponse.ok) throw new Error(`Get Domain Config Error: ${domainConfigData.error?.message}`);

        let cnameName = projectName; // Default name
        let cnameValue; // Target CNAME

        const verificationRecord = domainConfigData.verification?.find(rec => rec.type === 'CNAME');

        if (verificationRecord) {
            // Skenario 1: Domain BARU, Vercel memberikan record verifikasi
            cnameName = verificationRecord.domain.replace(`.${domainName[0]}`, '');
            cnameValue = verificationRecord.value;
            console.log(`Found unique verification record. Name: ${cnameName}, Value: ${cnameValue}`);
        } else {
            // Skenario 2: Domain LAMA/TERPERCAYA, Vercel tidak memberikan record verifikasi
            cnameValue = 'cname.vercel-dns.com';
            console.log(`No unique verification record found. Using default target: ${cnameValue}`);
        }

        // --- Langkah 4: Buat Record DNS di FishNemo API ---
        console.log(`Step 4: Creating DNS record...`);
        const fishnemoFormData = new URLSearchParams();
        fishnemoFormData.append('subdomain', cnameName);
        fishnemoFormData.append('domain_id', domainId[0]);
        fishnemoFormData.append('record_type', 'CNAME');
        fishnemoFormData.append('target', cnameValue);

        const fishnemoResponse = await fetch('https://subdo.fishnemo.xyz/api/create', {
            method: 'POST',
            body: fishnemoFormData,
        });
        if (!fishnemoResponse.ok) {
            const errorData = await fishnemoResponse.json();
            throw new Error(`FishNemo API Error: ${errorData.message}`);
        }
        console.log(`Step 4 Success. DNS record created.`);

        // --- Langkah 5: (Opsional) Trigger Verifikasi ---
        // Langkah ini aman untuk dijalankan di kedua skenario.
        console.log(`Step 5: Triggering verification on Vercel...`);
        await fetch(`https://api.vercel.com/v9/projects/${projectId}/domains/${finalDomain}/verify`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}` }
        });
        console.log(`Step 5 Complete. Verification process initiated.`);

        res.status(200).json({ message: 'Deployment successful! Domain is now verifying.', finalUrl: finalDomain });

    } catch (error) {
        console.error('Full error in /api/deploy:', error);
        res.status(500).json({ message: error.message });
    }
}

// --- Helper Functions (Tidak ada perubahan) ---
function parseFormData(req) {
    return new Promise((resolve, reject) => {
        const form = formidable({});
        form.parse(req, (err, fields, files) => {
            if (err) return reject(err);
            resolve({ fields, files });
        });
    });
}

async function prepareFilesForVercel(files) {
    const payload = [];
    const fileArray = Array.isArray(files) ? files : [files];
    for (const file of fileArray) {
        const fileContent = fs.readFileSync(file.filepath);
        payload.push({
            file: file.originalFilename,
            data: fileContent.toString('base64'),
            encoding: 'base64',
        });
    }
    return payload;
}

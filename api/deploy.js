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
        const vercelFilesPayload = await prepareFilesForVercel(uploadedFiles);
        
        // --- Langkah 1: Deploy proyek ke Vercel ---
        console.log(`Deploying project "${projectName}" to Vercel...`);
        const vercelApiUrl = VERCEL_TEAM_ID ? `https://api.vercel.com/v13/deployments?teamId=${VERCEL_TEAM_ID}` : 'https://api.vercel.com/v13/deployments';
        
        const vercelResponse = await fetch(vercelApiUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: projectName,
                files: vercelFilesPayload,
                projectSettings: { framework: null },
            }),
        });
        const vercelData = await vercelResponse.json();
        if (!vercelResponse.ok) throw new Error(vercelData.error?.message || 'Failed to deploy to Vercel.');
        
        const projectId = vercelData.projectId;
        console.log(`Vercel deployment successful. Project ID: ${projectId}`);

        const finalDomain = `${projectName}.${domainName[0]}`;

        // --- Langkah 2: Tambahkan domain ke proyek Vercel ---
        console.log(`Adding domain ${finalDomain} to Vercel project ${projectId}...`);
        const addDomainResponse = await fetch(`https://api.vercel.com/v10/projects/${projectId}/domains`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: finalDomain }),
        });
        if (!addDomainResponse.ok) {
            const errorData = await addDomainResponse.json();
            throw new Error(errorData.error?.message || `Failed to add custom domain to Vercel project.`);
        }
        console.log('Custom domain added to Vercel project. Now fetching verification info...');
        
        // --- LANGKAH 3 (KRUSIAL): Ambil konfigurasi verifikasi dari Vercel ---
        const getConfigResponse = await fetch(`https://api.vercel.com/v9/projects/${projectId}/domains/${finalDomain}`, {
            headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}` }
        });
        const configData = await getConfigResponse.json();
        if (!getConfigResponse.ok) throw new Error(configData.error?.message || 'Failed to get domain configuration from Vercel.');

        // Cari record verifikasi tipe CNAME
        const cnameVerificationRecord = configData.verification.find(record => record.type === 'CNAME');
        if (!cnameVerificationRecord) throw new Error('Vercel did not provide a CNAME verification record.');

        const vercelCnameTarget = cnameVerificationRecord.value;
        console.log(`Vercel requires CNAME value: ${vercelCnameTarget}`);

        // --- Langkah 4: Buat record CNAME dengan VALUE yang benar dari Vercel ---
        console.log(`Creating CNAME record for ${finalDomain} -> ${vercelCnameTarget}`);
        const fishnemoFormData = new URLSearchParams();
        fishnemoFormData.append('subdomain', projectName);
        fishnemoFormData.append('domain_id', domainId[0]);
        fishnemoFormData.append('record_type', 'CNAME');
        fishnemoFormData.append('target', vercelCnameTarget); // Menggunakan value unik dari Vercel

        const fishnemoResponse = await fetch('https://subdo.fishnemo.xyz/api/create', {
            method: 'POST',
            body: fishnemoFormData,
        });

        if (!fishnemoResponse.ok) {
            const errorData = await fishnemoResponse.json();
            throw new Error(errorData.message || 'Failed to create subdomain record.');
        }
        console.log('FishNemo subdomain record created successfully.');

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

import formidable from 'formidable';
import fs from 'fs';

// --- Konfigurasi Polling ---
const POLL_RETRIES = 10; // Coba sebanyak 10 kali
const POLL_DELAY = 3000; // Jeda 3 detik antar percobaan

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
        await fetch(`https://api.vercel.com/v10/projects/${projectId}/domains`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: finalDomain }),
        });
        console.log('Custom domain added to Vercel project. Now polling for verification info...');
        
        // --- LANGKAH 3 (KRUSIAL & DIPERBARUI): Polling untuk konfigurasi verifikasi ---
        const cnameTarget = await pollForDomainVerification(projectId, finalDomain, VERCEL_API_TOKEN);

        // --- Langkah 4: Buat record CNAME dengan VALUE unik yang didapat ---
        console.log(`Creating CNAME record for ${finalDomain} -> ${cnameTarget}`);
        const fishnemoFormData = new URLSearchParams();
        fishnemoFormData.append('subdomain', projectName);
        fishnemoFormData.append('domain_id', domainId[0]);
        fishnemoFormData.append('record_type', 'CNAME');
        fishnemoFormData.append('target', cnameTarget);

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

/**
 * Berulang kali memeriksa Vercel API sampai data verifikasi domain tersedia.
 */
async function pollForDomainVerification(projectId, domainName, token) {
    for (let i = 0; i < POLL_RETRIES; i++) {
        console.log(`Polling for domain verification... Attempt ${i + 1}/${POLL_RETRIES}`);
        const getConfigResponse = await fetch(`https://api.vercel.com/v9/projects/${projectId}/domains/${domainName}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!getConfigResponse.ok) {
            // Jika API gagal, kita tunggu dan coba lagi
            console.warn(`Attempt ${i + 1} failed with status ${getConfigResponse.status}. Retrying...`);
            await new Promise(resolve => setTimeout(resolve, POLL_DELAY));
            continue;
        }

        const configData = await getConfigResponse.json();
        const cnameRecord = configData.verification?.find(record => record.type === 'CNAME');

        if (cnameRecord && cnameRecord.value) {
            console.log(`Success! Found verification CNAME: ${cnameRecord.value}`);
            return cnameRecord.value; // Ditemukan! Kembalikan nilainya.
        }

        // Jika belum ditemukan, tunggu sebelum mencoba lagi
        await new Promise(resolve => setTimeout(resolve, POLL_DELAY));
    }

    // Jika loop selesai tanpa menemukan CNAME, lempar error.
    throw new Error(`Failed to retrieve domain verification record from Vercel after ${POLL_RETRIES} attempts.`);
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

import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

// This tells Vercel that the handler function deals with multipart/form-data
export const config = {
    api: {
        bodyParser: false,
    },
};

// Main handler function
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

        if (!subdomain || !domainId || !domainName || !uploadedFiles || uploadedFiles.length === 0) {
            return res.status(400).json({ message: 'Missing required fields or files.' });
        }
        
        const projectName = subdomain[0];
        const vercelFilesPayload = await prepareFilesForVercel(uploadedFiles);
        
        console.log(`Deploying project "${projectName}" to Vercel...`);
        const vercelApiUrl = VERCEL_TEAM_ID ? `https://api.vercel.com/v13/deployments?teamId=${VERCEL_TEAM_ID}` : 'https://api.vercel.com/v13/deployments';
        
        const vercelResponse = await fetch(vercelApiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${VERCEL_API_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: projectName,
                files: vercelFilesPayload,
                // --- PERBAIKAN DI SINI ---
                // Menambahkan projectSettings untuk Vercel API
                projectSettings: {
                    framework: null, // null berarti "Other" atau statis
                },
                // -------------------------
            }),
        });

        const vercelData = await vercelResponse.json();
        if (!vercelResponse.ok) {
            // Memberikan pesan error yang lebih detail dari Vercel
            console.error('Vercel API Error:', vercelData.error);
            throw new Error(vercelData.error?.message || 'Failed to deploy to Vercel.');
        }
        console.log(`Vercel deployment successful. URL: ${vercelData.url}`);

        const finalDomain = `${projectName}.${domainName[0]}`;
        console.log(`Creating CNAME record for ${finalDomain}...`);
        
        const fishnemoFormData = new URLSearchParams();
        fishnemoFormData.append('subdomain', projectName);
        fishnemoFormData.append('domain_id', domainId[0]);
        fishnemoFormData.append('record_type', 'CNAME');
        fishnemoFormData.append('target', 'cname.vercel-dns.com');

        const fishnemoResponse = await fetch('https://subdo.fishnemo.xyz/api/create', {
            method: 'POST',
            body: fishnemoFormData,
        });

        if (!fishnemoResponse.ok) {
            const errorData = await fishnemoResponse.json();
            throw new Error(errorData.message || 'Failed to create subdomain record.');
        }
        console.log('FishNemo subdomain record created successfully.');

        const projectId = vercelData.projectId || projectName;
        console.log(`Adding domain ${finalDomain} to Vercel project ${projectId}...`);
        
        const addDomainResponse = await fetch(`https://api.vercel.com/v10/projects/${projectId}/domains`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${VERCEL_API_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: finalDomain }),
        });

        if (!addDomainResponse.ok) {
            const errorData = await addDomainResponse.json();
            throw new Error(errorData.error?.message || `Failed to add custom domain to Vercel project.`);
        }
        console.log('Custom domain added to Vercel project successfully.');

        res.status(200).json({ message: 'Deployment successful!', finalUrl: finalDomain });

    } catch (error) {
        console.error('Full error in /api/deploy:', error);
        res.status(500).json({ message: error.message });
    }
}

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
    // Jika hanya satu file, 'files' bukan array, jadi kita buat jadi array
    const fileArray = Array.isArray(files) ? files : [files];

    for (const file of fileArray) {
        const fileContent = fs.readFileSync(file.filepath);
        // Kita tidak perlu lagi handle ZIP di backend karena sudah dihandle di frontend
        payload.push({
            file: file.originalFilename,
            data: fileContent.toString('base64'),
            encoding: 'base64',
        });
    }
    return payload;
}

// /api/deploy.js (Versi Paling Minimal untuk Debugging)

import formidable from 'formidable';
import fs from 'fs/promises';

export const config = { api: { bodyParser: false } };

// --- Helper Functions ---

function parseFormData(req) {
    return new Promise((resolve, reject) => {
        const form = formidable({ multiples: true });
        form.parse(req, (err, fields, files) => {
            if (err) {
                console.error("[DEBUG] Formidable parsing error:", err);
                return reject(err);
            }
            resolve({ fields, files });
        });
    });
}

async function prepareFilesForVercel(files) {
    const payload = [];
    for (const file of files) {
        try {
            const buffer = await fs.readFile(file.filepath);
            payload.push({
                file: file.originalFilename,
                data: buffer.toString('base64'),
                encoding: 'base64',
            });
        } catch (error) {
            console.error(`[DEBUG] Failed to read file: ${file.filepath}`, error);
            throw new Error(`Could not process file: ${file.originalFilename}`);
        }
    }
    return payload;
}

// --- Handler Utama ---
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }
    
    console.log('[DEBUG] /api/deploy handler started.');

    const { VERCEL_API_TOKEN, VERCEL_TEAM_ID } = process.env;
    if (!VERCEL_API_TOKEN) {
        console.error('[DEBUG] FATAL: VERCEL_API_TOKEN is not set.');
        return res.status(500).json({ message: 'Server configuration error: Vercel API token is missing.' });
    }

    try {
        console.log('[DEBUG] Parsing form data...');
        const { fields, files } = await parseFormData(req);
        console.log('[DEBUG] Form data parsed.');

        const { subdomain } = fields;
        const filesForVercel = Array.isArray(files.files) ? files.files : [files.files].filter(Boolean);
        
        if (!subdomain || !filesForVercel || filesForVercel.length === 0) {
            console.error('[DEBUG] Validation failed: Missing project name or files.');
            return res.status(400).json({ message: 'Missing project name or files.' });
        }
        
        const projectName = subdomain[0];
        console.log(`[DEBUG] Project name: ${projectName}`);
        
        // Filter kata-kata kotor dinonaktifkan untuk sementara
        // const filter = new Filter();
        // if (filter.isProfane(projectName)) { ... }
        
        console.log('[DEBUG] Preparing files for Vercel...');
        const vercelFilesPayload = await prepareFilesForVercel(filesForVercel);
        console.log(`[DEBUG] Prepared ${vercelFilesPayload.length} files.`);
        
        const vercelApiUrl = VERCEL_TEAM_ID 
            ? `https://api.vercel.com/v13/deployments?teamId=${VERCEL_TEAM_ID}` 
            : 'https://api.vercel.com/v13/deployments';

        console.log('[DEBUG] Sending request to Vercel API...');
        const deployResponse = await fetch(vercelApiUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name: projectName, 
                files: vercelFilesPayload, 
                projectSettings: { framework: null },
                target: 'production' 
            }),
        });
        
        console.log(`[DEBUG] Vercel API responded with status: ${deployResponse.status}`);
        const deployData = await deployResponse.json();

        if (!deployResponse.ok) {
            console.error("[DEBUG] Vercel Deploy Error Response:", deployData);
            throw new Error(`Vercel Deploy Error: ${deployData.error?.message || 'Unknown error'}`);
        }
        
        const finalUrl = deployData.alias.find(a => a.endsWith('.vercel.app') && !a.includes('-git-'));
        console.log(`[DEBUG] Public URL found: ${finalUrl}`);

        // Notifikasi Telegram dinonaktifkan
        
        console.log('[DEBUG] Sending success response to client.');
        res.status(200).json({ message: 'Deployment successful!', finalUrl });

    } catch (error) {
        console.error('[DEBUG] Full error in /api/deploy handler:', error);
        res.status(500).json({ message: `Server error: ${error.message}` });
    }
}

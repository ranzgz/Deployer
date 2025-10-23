// /api/deploy.js (Fixed URL Response)

import formidable from 'formidable';
import fs from 'fs/promises';
import Filter from 'bad-words';

export const config = { api: { bodyParser: false } };

// --- Helper Functions ---

function parseFormData(req) {
    return new Promise((resolve, reject) => {
        const form = formidable({ multiples: true });
        form.parse(req, (err, fields, files) => {
            if (err) return reject(err);
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
            console.error(`Failed to read file: ${file.filepath}`, error);
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
    
    const { VERCEL_API_TOKEN, VERCEL_TEAM_ID } = process.env;
    if (!VERCEL_API_TOKEN) {
        return res.status(500).json({ message: 'Server configuration error: Vercel API token is missing.' });
    }

    try {
        const { fields, files } = await parseFormData(req);
        const { subdomain } = fields;
        const filesForVercel = Array.isArray(files.files) ? files.files : [files.files].filter(Boolean);
        
        if (!subdomain || !filesForVercel || filesForVercel.length === 0) {
            return res.status(400).json({ message: 'Missing project name or files.' });
        }
        
        const projectName = subdomain[0];
        const filter = new Filter();
        if (filter.isProfane(projectName)) {
            return res.status(400).json({ message: 'Project name contains inappropriate language.' });
        }
        
        const vercelFilesPayload = await prepareFilesForVercel(filesForVercel);
        
        const vercelApiUrl = VERCEL_TEAM_ID 
            ? `https://api.vercel.com/v13/deployments?teamId=${VERCEL_TEAM_ID}` 
            : 'https://api.vercel.com/v13/deployments';

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
        
        const deployData = await deployResponse.json();

        if (!deployResponse.ok) {
            console.error("Vercel Deploy Error Response:", deployData);
            throw new Error(`Vercel Deploy Error: ${deployData.error?.message || 'Unknown error'}`);
        }
        
        // --- LOGIKA PENGAMBILAN URL YANG DIPERBAIKI ---
        let finalUrl;
        
        // Prioritas 1: Cari URL yang mengandung nama project (tanpa awalan yang tidak diinginkan)
        const projectUrlPattern = new RegExp(`${projectName}[.-].*\.vercel\.app`);
        const matchingUrl = deployData.alias?.find(alias => projectUrlPattern.test(alias)) || 
                          projectUrlPattern.test(deployData.url) ? deployData.url : null;
        
        if (matchingUrl) {
            finalUrl = matchingUrl;
        } 
        // Prioritas 2: Gunakan URL langsung dari respons (biasanya format: projectName-xxxx.vercel.app)
        else if (deployData.url && deployData.url.includes(projectName)) {
            finalUrl = deployData.url;
        }
        // Prioritas 3: Fallback - konstruksi URL manual berdasarkan pola Vercel
        else {
            // Biasanya format: projectName-randomstring.vercel.app
            // Jika deployData.url ada tapi tidak mengandung projectName, kita konstruksi manual
            const urlParts = deployData.url?.split('.') || [];
            if (urlParts.length > 0) {
                const domainPart = urlParts[0];
                // Hilangkan awalan yang tidak diinginkan seperti "mkbg-"
                const cleanDomain = domainPart.replace(/^m?k?bg-?/, '');
                finalUrl = `${projectName}-${cleanDomain}.vercel.app`;
            } else {
                // Fallback ultimate
                finalUrl = deployData.url;
            }
        }

        // Pastikan finalUrl tidak memiliki awalan yang tidak diinginkan
        if (finalUrl && finalUrl.startsWith('mkbg-')) {
            finalUrl = finalUrl.replace('mkbg-', '');
        }
        if (finalUrl && finalUrl.startsWith('kbg-')) {
            finalUrl = finalUrl.replace('kbg-', '');
        }

        console.log(`Deployment successful. Project: ${projectName}, Public URL: ${finalUrl}`);

        res.status(200).json({ 
            message: 'Deployment successful!', 
            finalUrl,
            projectName,
            vercelResponse: {
                url: deployData.url,
                alias: deployData.alias
            }
        });

    } catch (error) {
        console.error('Full error in /api/deploy handler:', error);
        res.status(500).json({ message: `Server error: ${error.message}` });
    }
}

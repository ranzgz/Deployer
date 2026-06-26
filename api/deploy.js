// api/deploy.js
import formidable from 'formidable';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import Filter from 'bad-words';

export const config = {
    api: {
        bodyParser: false,
    },
};

// Asynchronous wrapper for formidable multipart parsing
function parseFormData(req) {
    return new Promise((resolve, reject) => {
        const uploadDir = os.tmpdir();
        const form = formidable({
            multiples: true,
            uploadDir,
            keepExtensions: true,
            maxFileSize: 50 * 1024 * 1024, // 50MB safety limit
        });

        form.parse(req, (err, fields, files) => {
            if (err) return reject(err);
            resolve({ fields, files });
        });
    });
}

// Convert files securely into Vercel Deployment-compatible payloads
async function prepareFilesForVercel(files) {
    const payload = [];
    const processedPaths = new Set();

    for (const file of files) {
        if (!file || !file.filepath) continue;
        try {
            const buffer = await fs.readFile(file.filepath);
            // Ensure proper slashes for cross-platform system uploads
            const normalizedName = (file.originalFilename || path.basename(file.filepath))
                .replace(/\\/g, '/');

            if (processedPaths.has(normalizedName)) continue;
            processedPaths.add(normalizedName);

            payload.push({
                file: normalizedName,
                data: buffer.toString('base64'),
                encoding: 'base64',
            });
        } catch (error) {
            console.error(`Failed to process static asset matching path: ${file.filepath}`, error);
            throw new Error(`Failed to process upload: ${file.originalFilename || 'unnamed asset'}`);
        } finally {
            // Unlink temporary files on serverless instance to prevent disk leak
            try {
                await fs.unlink(file.filepath);
            } catch (err) {
                console.warn(`Temporary storage cleanup warning for ${file.filepath}:`, err);
            }
        }
    }
    return payload;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { VERCEL_API_TOKEN, VERCEL_TEAM_ID } = process.env;
    if (!VERCEL_API_TOKEN) {
        return res.status(500).json({ message: 'Deployment credentials are misconfigured on Vercel.' });
    }

    try {
        const { fields, files } = await parseFormData(req);
        
        const rawSubdomain = Array.isArray(fields.subdomain) ? fields.subdomain[0] : fields.subdomain;
        const subdomain = rawSubdomain?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');

        // Normalize formidable file payload array
        let rawFiles = files.files;
        if (!rawFiles) {
            rawFiles = [];
        } else if (!Array.isArray(rawFiles)) {
            rawFiles = [rawFiles];
        }

        const filesForVercel = rawFiles.filter(Boolean);

        if (!subdomain || filesForVercel.length === 0) {
            return res.status(400).json({ message: 'Missing project configuration settings or matching upload files.' });
        }

        // Profanity Check
        const filter = new Filter();
        if (filter.isProfane(subdomain)) {
            return res.status(400).json({ message: 'The provided project name contains flagged or inappropriate terms.' });
        }

        const vercelFilesPayload = await prepareFilesForVercel(filesForVercel);
        const vercelApiUrl = VERCEL_TEAM_ID
            ? `https://api.vercel.com/v13/deployments?teamId=${VERCEL_TEAM_ID}`
            : 'https://api.vercel.com/v13/deployments';

        const deployResponse = await fetch(vercelApiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${VERCEL_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: subdomain,
                files: vercelFilesPayload,
                projectSettings: {
                    framework: null
                },
                target: 'production'
            }),
        });

        const deployData = await deployResponse.json();

        if (!deployResponse.ok) {
            console.error("Vercel Gateway Error Payload:", deployData);
            return res.status(deployResponse.status).json({
                message: deployData.error?.message || 'Vercel API refused serverless distribution parameters.'
            });
        }

        // Determine the cleanest public URL, prioritizing active aliases
        let finalUrl = '';
        if (deployData.alias && deployData.alias.length > 0) {
            const productionAlias = deployData.alias.find(alias => 
                !alias.includes('-git-') && 
                !alias.includes('-prev-') && 
                alias.endsWith('.vercel.app')
            );
            finalUrl = productionAlias || deployData.alias[0];
        } else if (deployData.url) {
            finalUrl = deployData.url;
        } else {
            finalUrl = `${subdomain}.vercel.app`;
        }

        // Strip unexpected prefixes if present
        finalUrl = finalUrl.replace(/^(mkbg-|kbg-)/, '');

        return res.status(200).json({
            message: 'Deployment successful!',
            finalUrl,
            projectName: subdomain
        });

    } catch (error) {
        console.error('Server side runtime exception inside API module:', error);
        return res.status(500).json({ message: `Deployment failed: ${error.message}` });
    }
}

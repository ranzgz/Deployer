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

function parseFormData(req) {
    return new Promise((resolve, reject) => {
        const uploadDir = os.tmpdir();
        const form = formidable({
            multiples: true,
            uploadDir,
            keepExtensions: true,
            maxFileSize: 100 * 1024 * 1024, // 100MB limit
        });

        form.parse(req, (err, fields, files) => {
            if (err) return reject(err);
            resolve({ fields, files });
        });
    });
}

async function prepareFilesForVercel(files) {
    const payload = [];
    const processedPaths = new Set();

    for (const file of files) {
        if (!file || !file.filepath) continue;
        try {
            const buffer = await fs.readFile(file.filepath);
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
            console.error(`Failed to read file: ${file.filepath}`, error);
            throw new Error(`Could not process file: ${file.originalFilename}`);
        } finally {
            try {
                await fs.unlink(file.filepath);
            } catch (err) {
                console.warn(`Temp file cleanup warning for ${file.filepath}:`, err);
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
        return res.status(500).json({ message: 'Server configuration error: Vercel API token is missing.' });
    }

    try {
        const { fields, files } = await parseFormData(req);
        const rawSubdomain = Array.isArray(fields.subdomain) ? fields.subdomain[0] : fields.subdomain;
        const subdomain = rawSubdomain?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');

        let rawFiles = files.files;
        if (!rawFiles) {
            rawFiles = [];
        } else if (!Array.isArray(rawFiles)) {
            rawFiles = [rawFiles];
        }

        const filesForVercel = rawFiles.filter(Boolean);

        if (!subdomain || filesForVercel.length === 0) {
            return res.status(400).json({ message: 'Missing project name or files.' });
        }

        const filter = new Filter();
        if (filter.isProfane(subdomain)) {
            return res.status(400).json({ message: 'Project name contains inappropriate language.' });
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
                projectSettings: { framework: null },
                target: 'production'
            }),
        });

        const deployData = await deployResponse.json();

        if (!deployResponse.ok) {
            console.error("Vercel Deploy Error Response:", deployData);
            return res.status(deployResponse.status).json({
                message: deployData.error?.message || 'Vercel API error.'
            });
        }

        // --- SISTEM PENGAMBILAN CANONICAL PRODUCTION DOMAIN ---
        let finalUrl = `${subdomain}.vercel.app`; // Default fallback

        try {
            const domainsUrl = VERCEL_TEAM_ID
                ? `https://api.vercel.com/v9/projects/${subdomain}/domains?teamId=${VERCEL_TEAM_ID}`
                : `https://api.vercel.com/v9/projects/${subdomain}/domains`;

            const domainsResponse = await fetch(domainsUrl, {
                headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}` }
            });

            if (domainsResponse.ok) {
                const domainsData = await domainsResponse.json();
                if (domainsData.domains && domainsData.domains.length > 0) {
                    const primaryDomain = domainsData.domains.find(d => !d.redirect) || domainsData.domains[0];
                    finalUrl = primaryDomain.name;
                }
            }
        } catch (domainError) {
            console.warn("Could not retrieve production domains via API:", domainError);
        }

        finalUrl = finalUrl.replace(/^(mkbg-|kbg-)/, '');

        return res.status(200).json({
            message: 'Deployment successful!',
            finalUrl,
            projectName: subdomain
        });

    } catch (error) {
        console.error('Full error in /api/deploy handler:', error);
        return res.status(500).json({ message: `Server error: ${error.message}` });
    }
}

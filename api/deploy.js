// /api/deploy.js

import formidable from 'formidable';
import fs from 'fs';
import Filter from 'bad-words';
import FormData from 'form-data';

export const config = {
    api: {
        bodyParser: false,
    },
};

// Helper function untuk membaca stream menjadi buffer
async function streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
}

async function sendTelegramNotification(botToken, chatId, message, file) {
    try {
        const fileStream = fs.createReadStream(file.filepath);
        const fileContent = await streamToBuffer(fileStream);
        
        const form = new FormData();
        form.append('chat_id', chatId);
        form.append('caption', message);
        form.append('parse_mode', 'Markdown');
        form.append('document', fileContent, file.originalFilename || 'deploy.zip');

        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
            method: 'POST',
            body: form,
            headers: form.getHeaders ? form.getHeaders() : undefined
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Telegram API Error:', errorData.description);
        } else {
            console.log('Telegram notification sent successfully.');
        }
    } catch (err) {
        console.error('Failed to send Telegram notification:', err);
    }
}

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
        const fileStream = fs.createReadStream(file.filepath);
        const buffer = await streamToBuffer(fileStream);
        payload.push({
            file: file.originalFilename,
            data: buffer.toString('base64'),
            encoding: 'base64',
        });
    }
    return payload;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { VERCEL_API_TOKEN, VERCEL_TEAM_ID, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;

    if (!VERCEL_API_TOKEN) {
        return res.status(500).json({ message: 'Server configuration error: Vercel API token is missing.' });
    }

    try {
        const { fields, files } = await parseFormData(req);
        const { subdomain, domainId, domainName } = fields;
        const filesForVercel = Array.isArray(files.files) ? files.files : [files.files].filter(Boolean);
        const zipFileForTelegram = files.zip_file ? (Array.isArray(files.zip_file) ? files.zip_file[0] : files.zip_file) : null;

        if (!subdomain || !domainId || !domainName || !filesForVercel || filesForVercel.length === 0) {
            return res.status(400).json({ message: 'Missing required fields or files.' });
        }
        
        const projectName = subdomain[0];
        const filter = new Filter();
        if (filter.isProfane(projectName)) {
            return res.status(400).json({ message: 'Project name contains inappropriate language.' });
        }
        
        const finalDomain = `${projectName}.${domainName[0]}`;
        const vercelFilesPayload = await prepareFilesForVercel(filesForVercel);
        
        // --- Langkah 1: Deploy ke Vercel ---
        const vercelApiUrl = VERCEL_TEAM_ID ? `https://api.vercel.com/v13/deployments?teamId=${VERCEL_TEAM_ID}` : 'https://api.vercel.com/v13/deployments';
        const deployResponse = await fetch(vercelApiUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: projectName, files: vercelFilesPayload, projectSettings: { framework: null } }),
        });
        const deployData = await deployResponse.json();
        if (!deployResponse.ok) throw new Error(`Vercel Deploy Error: ${deployData.error?.message}`);
        const projectId = deployData.projectId;
        
        // --- Langkah 2-5: Proses domain ---
        await fetch(`https://api.vercel.com/v10/projects/${projectId}/domains`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: finalDomain }),
        });
        
        const domainConfigResponse = await fetch(`https://api.vercel.com/v9/projects/${projectId}/domains/${finalDomain}`, {
            headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}` }
        });
        const domainConfigData = await domainConfigResponse.json();
        if (!domainConfigResponse.ok) throw new Error(`Get Domain Config Error: ${domainConfigData.error?.message}`);
        
        let cnameName = projectName;
        let cnameValue;
        const verificationRecord = domainConfigData.verification?.find(rec => rec.type === 'CNAME');
        if (verificationRecord) {
            cnameName = verificationRecord.domain.replace(`.${domainName[0]}`, '');
            cnameValue = verificationRecord.value;
        } else {
            cnameValue = 'cname.vercel-dns.com';
        }

        const fishnemoFormData = new URLSearchParams();
        fishnemoFormData.append('subdomain', cnameName);
        fishnemoFormData.append('domain_id', domainId[0]);
        fishnemoFormData.append('record_type', 'CNAME');
        fishnemoFormData.append('target', cnameValue);
        const fishnemoResponse = await fetch('https://subdo.fishnemo.xyz/api/create', { method: 'POST', body: fishnemoFormData });
        if (!fishnemoResponse.ok) {
            const errorData = await fishnemoResponse.json();
            throw new Error(`FishNemo API Error: ${errorData.message}`);
        }

        await fetch(`https://api.vercel.com/v9/projects/${projectId}/domains/${finalDomain}/verify`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}` }
        });
        
        // --- Kirim Notifikasi ke Telegram (tanpa menyimpan ke DB) ---
        if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
            const message = `🚀 *New Deployment!* 🚀\n\n*Website:* \`${finalDomain}\`\n*URL:* [https://${finalDomain}](https://${finalDomain})`;
            const fileForTelegram = zipFileForTelegram || filesForVercel[0];
            if (fileForTelegram) {
                 await sendTelegramNotification(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, message, fileForTelegram);
            }
        }

        res.status(200).json({ message: 'Deployment successful! Domain is now verifying.', finalUrl: finalDomain });

    } catch (error) {
        console.error('Full error in /api/deploy:', error);
        res.status(500).json({ message: error.message });
    }
}

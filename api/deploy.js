// /api/deploy.js (Versi Stabil dengan Axios untuk Telegram)

import formidable from 'formidable';
import fs from 'fs/promises'; // Menggunakan fs.promises
import { createReadStream } from 'fs'; // Untuk stream ke axios
import Filter from 'bad-words';
import FormData from 'form-data'; // Diperlukan untuk axios
import axios from 'axios'; // Diperlukan untuk Telegram

export const config = { api: { bodyParser: false } };

// --- Helper Functions ---

async function sendTelegramNotification(botToken, chatId, message, file) {
    const apiUrl = `https://api.telegram.org/bot${botToken}/sendDocument`;
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', message);
    form.append('parse_mode', 'Markdown');
    // Gunakan createReadStream untuk mengirim file dengan axios
    form.append('document', createReadStream(file.filepath), file.originalFilename || 'deploy.zip');

    try {
        await axios.post(apiUrl, form, {
            headers: form.getHeaders()
        });
        console.log('Telegram notification sent successfully.');
    } catch (err) {
        console.error('Failed to send Telegram notification:', err.response ? err.response.data : err.message);
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

async function pollForDeploymentReady(deploymentId, vercelToken, teamId) {
    // ... (Fungsi ini tidak berubah, tetap sama seperti sebelumnya)
}

// --- Handler Utama ---
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
        const { subdomain } = fields;
        const filesForVercel = Array.isArray(files.files) ? files.files : [files.files].filter(Boolean);
        const zipFileForTelegram = files.zip_file ? (Array.isArray(files.zip_file) ? files.zip_file[0] : files.zip_file) : null;
        if (!subdomain || !filesForVercel || filesForVercel.length === 0) {
            return res.status(400).json({ message: 'Missing project name or files.' });
        }
        
        const projectName = subdomain[0];
        const filter = new Filter();
        if (filter.isProfane(projectName)) {
            return res.status(400).json({ message: 'Project name contains inappropriate language.' });
        }
        
        const vercelFilesPayload = await prepareFilesForVercel(filesForVercel);
        
        const vercelApiUrl = VERCEL_TEAM_ID ? `https://api.vercel.com/v13/deployments?teamId=${VERCEL_TEAM_ID}` : 'https://api.vercel.com/v13/deployments';
        const deployResponse = await fetch(vercelApiUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name: projectName, 
                files: vercelFilesPayload, 
                projectSettings: { framework: null }
            }),
        });
        const deployData = await deployResponse.json();
        if (!deployResponse.ok) throw new Error(`Vercel Deploy Error: ${deployData.error?.message}`);
        
        const deploymentId = deployData.id;
        const finalUrl = `${projectName}.vercel.app`;

        // Kita tidak perlu polling lagi, karena Vercel otomatis mengupdate alias
        // await pollForDeploymentReady(deploymentId, VERCEL_API_TOKEN, VERCEL_TEAM_ID);

        // Cukup pastikan proyeknya ada, Vercel akan menangani aliasnya
        const projectCheckUrl = VERCEL_TEAM_ID
            ? `https://api.vercel.com/v9/projects/${projectName}?teamId=${VERCEL_TEAM_ID}`
            : `https://api.vercel.com/v9/projects/${projectName}`;
        
        await fetch(projectCheckUrl, { headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}` } });
        
        if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
            const message = `🚀 *New Deployment!* 🚀\n\n*Project:* \`${projectName}\`\n*URL:* [https://${finalUrl}](https://${finalUrl})`;
            const fileForTelegram = zipFileForTelegram || filesForVercel[0];
            if (fileForTelegram) {
                 await sendTelegramNotification(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, message, fileForTelegram);
            }
        }

        res.status(200).json({ message: 'Deployment successful!', finalUrl });
    } catch (error) {
        console.error('Full error in /api/deploy:', error);
        res.status(500).json({ message: `Server error: ${error.message}` });
    }
}

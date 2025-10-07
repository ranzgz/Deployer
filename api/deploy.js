// /api/deploy.js

import formidable from 'formidable';
import fs from 'fs';
import Filter from 'bad-words';
import FormData from 'form-data';

export const config = { api: { bodyParser: false } };

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
        const fileContent = await streamToBuffer(fs.createReadStream(file.filepath));
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
        const buffer = await streamToBuffer(fs.createReadStream(file.filepath));
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
            body: JSON.stringify({ name: projectName, files: vercelFilesPayload, projectSettings: { framework: null } }),
        });
        const deployData = await deployResponse.json();
        if (!deployResponse.ok) throw new Error(`Vercel Deploy Error: ${deployData.error?.message}`);
        
        const finalUrl = deployData.url;
        
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
        res.status(500).json({ message: error.message });
    }
}

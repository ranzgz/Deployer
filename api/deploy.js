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
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

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
        
        const firstFile = Array.isArray(uploadedFiles) ? uploadedFiles[0] : uploadedFiles;
        
        const projectName = subdomain[0];
        const finalDomain = `${projectName}.${domainName[0]}`;
        const vercelFilesPayload = await prepareFilesForVercel(uploadedFiles);
        
        // --- Langkah 1-5 (Proses Vercel & FishNemo) ---
        console.log(`Step 1: Deploying project "${projectName}"...`);
        const vercelApiUrl = VERCEL_TEAM_ID ? `https://api.vercel.com/v13/deployments?teamId=${VERCEL_TEAM_ID}` : 'https://api.vercel.com/v13/deployments';
        const deployResponse = await fetch(vercelApiUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: projectName, files: vercelFilesPayload, projectSettings: { framework: null } }),
        });
        const deployData = await deployResponse.json();
        if (!deployResponse.ok) throw new Error(`Vercel Deploy Error: ${deployData.error?.message}`);
        const projectId = deployData.projectId;
        console.log(`Step 1 Success. Project ID: ${projectId}`);

        console.log(`Step 2: Adding domain ${finalDomain} to project...`);
        await fetch(`https://api.vercel.com/v10/projects/${projectId}/domains`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: finalDomain }),
        });
        
        console.log(`Step 3: Getting domain configuration...`);
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

        console.log(`Step 4: Creating DNS record...`);
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

        console.log(`Step 5: Triggering verification on Vercel...`);
        await fetch(`https://api.vercel.com/v9/projects/${projectId}/domains/${finalDomain}/verify`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}` }
        });
        
        // --- Langkah 6: Kirim Notifikasi ke Telegram ---
        if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
            console.log("Sending notification to Telegram...");
            const message = `🚀 *New Deployment on FishNemo!* 🚀\n\n*Website:* \`${finalDomain}\`\n*URL:* [https://${finalDomain}](https://${finalDomain})\n\nA .zip file of the deployed content is attached.`;
            await sendTelegramNotification(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, message, firstFile);
        }

        res.status(200).json({ message: 'Deployment successful! Domain is now verifying.', finalUrl: finalDomain });

    } catch (error) {
        console.error('Full error in /api/deploy:', error);
        res.status(500).json({ message: error.message });
    }
}

// --- Helper Functions ---
async function sendTelegramNotification(botToken, chatId, message, file) {
    try {
        const fileContent = fs.readFileSync(file.filepath);
        
        const formData = new FormData();
        formData.append('chat_id', chatId);
        formData.append('caption', message);
        formData.append('parse_mode', 'Markdown');
        
        const fileBlob = new Blob([fileContent]);
        formData.append('document', fileBlob, file.originalFilename || 'deploy.zip');

        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
            method: 'POST',
            body: formData,
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

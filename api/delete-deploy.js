// /api/delete-deploy.js

import axios from 'axios';

async function deleteDnsRecord(fullSubdomain) {
    const apiUrl = 'https://subdo.fishnemo.xyz/api/admin/delete-subdomain';
    const apiKey = process.env.SUBDOMAKER_API_KEY;

    if (!apiKey) {
        console.error('SUBDOMAKER_API_KEY is not set! Skipping DNS deletion.');
        return { success: false, message: 'SUBDOMAKER_API_KEY is not configured on the server.' };
    }

    try {
        const response = await axios.delete(apiUrl, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey
            },
            data: {
                fullSubdomain: fullSubdomain
            }
        });
        console.log('DNS Deletion Success:', response.data.message);
        return { success: true, message: response.data.message };
    } catch (error) {
        const errorMessage = error.response?.data?.message || error.message;
        console.error('DNS Deletion Error:', errorMessage);
        return { success: false, message: errorMessage };
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { id, password, domain } = req.body;
    const { VERCEL_API_TOKEN, ADMIN_PASSWORD } = process.env;

    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    
    if (!id || !domain) {
        return res.status(400).json({ message: 'Project ID and Domain are required.' });
    }

    try {
        // 1. Hapus proyek di Vercel menggunakan ID
        console.log(`Deleting Vercel project: ${id}`);
        const vercelDeleteResponse = await fetch(`https://api.vercel.com/v9/projects/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}` }
        });
        if (!vercelDeleteResponse.ok) {
            const errorData = await vercelDeleteResponse.json();
            if (errorData.error?.code !== 'not_found') {
                throw new Error(`Vercel API Error: ${errorData.error?.message}`);
            }
             console.warn(`Vercel project ${id} not found. Assuming already deleted.`);
        }
        
        // 2. Hapus record DNS menggunakan nama domain
        console.log(`Deleting DNS record for: ${domain}`);
        const dnsResult = await deleteDnsRecord(domain);
        if (!dnsResult.success) {
            // Kita tidak menghentikan proses, hanya catat peringatan
            console.warn(`Could not delete DNS record: ${dnsResult.message}`);
        }

        res.status(200).json({ message: 'Deletion process initiated successfully.' });

    } catch (error) {
        console.error('Full delete error:', error);
        res.status(500).json({ message: `Failed to delete: ${error.message}` });
    }
}

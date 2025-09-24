// /api/delete-deploy.js

import { Pool } from 'pg';
import axios from 'axios'; // Pastikan Anda sudah menginstal axios: npm install axios

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function deleteDnsRecord(fullSubdomain) {
    const apiUrl = 'https://subdo.fishnemo.xyz/api/admin/delete-subdomain';
    const apiKey = process.env.SUBDOMAKER_API_KEY;

    if (!apiKey) {
        console.error('SUBDOMAKER_API_KEY is not set! Skipping DNS deletion.');
        // Kita tidak melempar error agar proses lain tetap berjalan
        // Namun, kita akan mengembalikan status bahwa DNS gagal dihapus.
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

    const { id, password } = req.body;
    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!id) {
        return res.status(400).json({ message: 'Deployment ID is required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Dapatkan info deploy dari DB
        const deployRes = await client.query('SELECT * FROM deploys WHERE id = $1', [id]);
        if (deployRes.rows.length === 0) {
            throw new Error('Deployment not found in the database.');
        }
        const deploy = deployRes.rows[0];
        
        // 2. Hapus proyek di Vercel
        console.log(`Deleting Vercel project: ${deploy.vercel_project_id}`);
        const vercelDeleteResponse = await fetch(`https://api.vercel.com/v9/projects/${deploy.vercel_project_id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${process.env.VERCEL_API_TOKEN}` }
        });
        if (!vercelDeleteResponse.ok) {
            const errorData = await vercelDeleteResponse.json();
            // Jika errornya "not found", kita anggap sudah terhapus. Lanjutkan.
            if (errorData.error?.code !== 'not_found') {
                throw new Error(`Vercel API Error: ${errorData.error?.message}`);
            }
            console.warn(`Vercel project ${deploy.vercel_project_id} not found. Assuming already deleted.`);
        }
        
        // 3. Hapus record DNS menggunakan fungsi baru
        console.log(`Deleting DNS record for: ${deploy.domain_name}`);
        const dnsResult = await deleteDnsRecord(deploy.domain_name);
        if (!dnsResult.success) {
            // Kita catat sebagai warning tapi tidak menghentikan proses penghapusan dari DB kita
            console.warn(`Could not delete DNS record: ${dnsResult.message}`);
        }

        // 4. Hapus dari DB kita
        console.log(`Deleting database record ID: ${id}`);
        await client.query('DELETE FROM deploys WHERE id = $1', [id]);
        
        await client.query('COMMIT');
        res.status(200).json({ message: 'Deployment deleted successfully. Please note: DNS changes may take time to propagate.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Full delete error:', error);
        res.status(500).json({ message: `Failed to delete: ${error.message}` });
    } finally {
        client.release();
    }
}

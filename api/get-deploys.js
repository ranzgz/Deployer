// /api/get-deploys.js
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ message: 'Method Not Allowed' });
    }
    
    const { password } = req.body;
    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT id, project_name, domain_name, created_at FROM deploys ORDER BY created_at DESC');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching deploys:', error);
        res.status(500).json({ message: 'Database query error.' });
    } finally {
        client.release();
    }
}

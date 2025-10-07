// /api/delete-deploy.js

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { id, password } = req.body; // Hanya butuh 'id' (Vercel Project ID)
    const { VERCEL_API_TOKEN, ADMIN_PASSWORD } = process.env;

    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    
    if (!id) {
        return res.status(400).json({ message: 'Project ID is required.' });
    }

    try {
        console.log(`Attempting to delete Vercel project: ${id}`);
        const vercelDeleteResponse = await fetch(`https://api.vercel.com/v9/projects/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}` }
        });

        if (vercelDeleteResponse.status === 204) {
            // 204 No Content adalah respons sukses untuk DELETE
            console.log(`Vercel project ${id} deleted successfully.`);
            return res.status(200).json({ message: 'Project deleted successfully from Vercel.' });
        }
        
        const errorData = await vercelDeleteResponse.json();
        if (errorData.error?.code === 'not_found') {
             console.warn(`Vercel project ${id} not found. Assuming already deleted.`);
             // Tetap kirim respons sukses agar item dihapus dari UI
             return res.status(200).json({ message: 'Project not found on Vercel, likely already deleted.' });
        }

        throw new Error(`Vercel API Error: ${errorData.error?.message || 'Unknown error'}`);

    } catch (error) {
        console.error('Full delete error:', error);
        res.status(500).json({ message: `Failed to delete: ${error.message}` });
    }
}

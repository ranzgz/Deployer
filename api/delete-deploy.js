// api/delete-deploy.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { id, password } = req.body;
    const { VERCEL_API_TOKEN, ADMIN_PASSWORD } = process.env;

    if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ message: 'Unauthorized access attempts are logged.' });
    }

    if (!id) {
        return res.status(400).json({ message: 'A valid Project ID must be specified for target deletion.' });
    }

    try {
        const vercelDeleteResponse = await fetch(`https://api.vercel.com/v9/projects/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}` }
        });

        if (vercelDeleteResponse.status === 204) {
            return res.status(200).json({ message: 'Project successfully deleted.' });
        }

        const errorData = await vercelDeleteResponse.json();
        if (vercelDeleteResponse.status === 404 || errorData.error?.code === 'not_found') {
            return res.status(200).json({ message: 'Project not found on Vercel; it may have already been deleted.' });
        }

        throw new Error(errorData.error?.message || 'Server rejected request parameters.');
    } catch (error) {
        console.error('Failed to process project deletion:', error);
        return res.status(500).json({ message: `Failed to delete project: ${error.message}` });
    }
}

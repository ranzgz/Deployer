// api/delete-deploy.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { id, password } = req.body;
    const { VERCEL_API_TOKEN, ADMIN_PASSWORD, VERCEL_TEAM_ID } = process.env;

    if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!id) {
        return res.status(400).json({ message: 'Project ID is required.' });
    }

    try {
        // Menyertakan Parameter teamId Jika dikonfigurasi pada env
        const vercelDeleteUrl = VERCEL_TEAM_ID
            ? `https://api.vercel.com/v9/projects/${id}?teamId=${VERCEL_TEAM_ID}`
            : `https://api.vercel.com/v9/projects/${id}`;

        console.log(`Attempting to delete Vercel project: ${id}`);
        const vercelDeleteResponse = await fetch(vercelDeleteUrl, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}` }
        });

        if (vercelDeleteResponse.status === 204) {
            console.log(`Vercel project ${id} deleted successfully.`);
            return res.status(200).json({ message: 'Project deleted successfully from Vercel.' });
        }

        const errorData = await vercelDeleteResponse.json();
        if (vercelDeleteResponse.status === 404 || errorData.error?.code === 'not_found') {
            console.warn(`Vercel project ${id} not found. Assuming already deleted.`);
            return res.status(200).json({ message: 'Project not found on Vercel, likely already deleted.' });
        }

        throw new Error(errorData.error?.message || 'Vercel API returned an unhandled error.');

    } catch (error) {
        console.error('Full delete error:', error);
        return res.status(500).json({ message: `Failed to delete: ${error.message}` });
    }
}

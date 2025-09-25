// /api/get-deploys.js

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ message: 'Method Not Allowed' });
    }
    
    const { password } = req.body;
    const { VERCEL_API_TOKEN, ADMIN_PASSWORD, VERCEL_TEAM_ID } = process.env;

    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    
    try {
        const vercelApiUrl = VERCEL_TEAM_ID 
            ? `https://api.vercel.com/v9/projects?teamId=${VERCEL_TEAM_ID}` 
            : 'https://api.vercel.com/v9/projects';

        const response = await fetch(vercelApiUrl, {
            headers: {
                'Authorization': `Bearer ${VERCEL_API_TOKEN}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Vercel API Error: ${errorData.error.message}`);
        }

        const data = await response.json();
        
        const formattedProjects = data.projects.map(project => {
            const customDomain = project.targets.production?.alias?.find(alias => !alias.endsWith('.vercel.app'));
            return {
                id: project.id, // Vercel Project ID
                project_name: project.name,
                domain_name: customDomain || project.targets.production?.url || 'N/A',
                created_at: new Date(project.createdAt).toISOString()
            };
        }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // Sortir dari terbaru ke terlama

        res.status(200).json({
            count: formattedProjects.length,
            deploys: formattedProjects
        });

    } catch (error) {
        console.error('Error fetching projects from Vercel:', error);
        res.status(500).json({ message: error.message });
    }
}

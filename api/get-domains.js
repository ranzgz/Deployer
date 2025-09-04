export default async function handler(req, res) {
    // Hanya izinkan metode GET
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }

    const EXTERNAL_API_URL = 'https://subdo.fishnemo.xyz/api/domains';

    try {
        // Lakukan permintaan dari server kita ke API eksternal
        const apiResponse = await fetch(EXTERNAL_API_URL);

        // Jika API eksternal gagal merespons, teruskan error
        if (!apiResponse.ok) {
            throw new Error(`Failed to fetch from external API. Status: ${apiResponse.status}`);
        }

        const data = await apiResponse.json();

        // Kirim data yang berhasil didapat kembali ke front-end
        // Vercel akan otomatis mengatur header CORS yang benar karena ini adalah same-origin
        res.status(200).json(data);

    } catch (error) {
        console.error("Error in /api/get-domains:", error);
        res.status(500).json({ message: 'Internal Server Error: Could not fetch domains.' });
    }
}

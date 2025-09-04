document.addEventListener('DOMContentLoaded', () => {
    const previewFrame = document.getElementById('preview-frame');

    const renderPreview = async () => {
        try {
            const filesDataString = sessionStorage.getItem('previewFiles');
            if (!filesDataString) {
                previewFrame.srcdoc = `<html><body><h2>No preview data found.</h2><p>Please go back and upload your files first.</p></body></html>`;
                return;
            }

            const filesData = JSON.parse(filesDataString);
            const files = await Promise.all(
                filesData.map(async (fileData) => {
                    // Konversi base64 kembali ke Blob, lalu ke File
                    const res = await fetch(fileData.dataUrl);
                    const blob = await res.blob();
                    return new File([blob], fileData.name, { type: fileData.type });
                })
            );

            // Cari file index.html
            const htmlFile = files.find(file => file.name.toLowerCase() === 'index.html');
            if (!htmlFile) {
                previewFrame.srcdoc = `<html><body><h2>Error: index.html not found.</h2><p>A preview requires an 'index.html' file in the root of your project.</p></body></html>`;
                return;
            }

            let htmlContent = await htmlFile.text();
            
            // Injeksi CSS files sebagai <style> tag
            const cssFiles = files.filter(file => file.name.endsWith('.css'));
            for (const cssFile of cssFiles) {
                const cssContent = await cssFile.text();
                const styleTag = `<style data-filename="${cssFile.name}">${cssContent}</style>`;
                // Injeksi sebelum </head>
                htmlContent = htmlContent.replace('</head>', `${styleTag}</head>`);
            }

            // Injeksi JS files sebagai <script> tag
            const jsFiles = files.filter(file => file.name.endsWith('.js'));
            for (const jsFile of jsFiles) {
                const jsContent = await jsFile.text();
                const scriptTag = `<script data-filename="${jsFile.name}">${jsContent}</script>`;
                // Injeksi sebelum </body>
                htmlContent = htmlContent.replace('</body>', `${scriptTag}</body>`);
            }

            previewFrame.srcdoc = htmlContent;

        } catch (error) {
            console.error('Error rendering preview:', error);
            previewFrame.srcdoc = `<html><body><h2>An error occurred while rendering the preview.</h2><pre>${error.message}</pre></body></html>`;
        } finally {
            // Hapus data dari session storage setelah digunakan
            sessionStorage.removeItem('previewFiles');
        }
    };

    renderPreview();
});

// preview.js

document.addEventListener('DOMContentLoaded', () => {
    const previewFrame = document.getElementById('preview-frame');
    const statusElement = document.getElementById('preview-status');

    const renderPreview = async () => {
        try {
            const filesDataString = sessionStorage.getItem('previewFiles');
            if (!filesDataString) {
                throw new Error("No preview data found. Please go back and upload your files first.");
            }

            statusElement.textContent = "Decoding files...";
            const filesData = JSON.parse(filesDataString);
            const files = await Promise.all(
                filesData.map(async (fileData) => {
                    const res = await fetch(fileData.dataUrl);
                    const blob = await res.blob();
                    return new File([blob], fileData.name, { type: fileData.type });
                })
            );

            const fileMap = new Map(files.map(file => [file.name, file]));
            const blobUrlMap = new Map();

            const htmlFile = fileMap.get('index.html');
            if (!htmlFile) {
                throw new Error("An 'index.html' file is required for the preview.");
            }

            statusElement.textContent = "Processing assets (CSS, JS, JSX, TSX)...";
            
            // 1. Buat Blob URL untuk semua aset non-HTML terlebih dahulu
            for (const file of files) {
                if (file.name.toLowerCase() === 'index.html') continue;

                let content = await file.arrayBuffer();
                let type = file.type;

                const fileName = file.name.toLowerCase();
                if (fileName.endsWith('.js') || fileName.endsWith('.jsx') || fileName.endsWith('.ts') || fileName.endsWith('.tsx')) {
                    type = 'application/javascript';
                    try {
                        const rawContent = await file.text();
                        const transforms = ['typescript', 'jsx'];
                        const transformedCode = Sucrase.transform(rawContent, { transforms }).code;
                        content = new TextEncoder().encode(transformedCode);
                    } catch (e) {
                        console.error(`Error transpiling ${file.name}:`, e);
                        const errorScript = `console.error("Failed to transpile ${file.name}: ${e.message.replace(/"/g, '\\"')}");`;
                        content = new TextEncoder().encode(errorScript);
                    }
                }
                
                const blob = new Blob([content], { type });
                blobUrlMap.set(file.name, URL.createObjectURL(blob));
            }

            // 2. Modifikasi HTML untuk menunjuk ke Blob URL
            statusElement.textContent = "Building main document...";
            let htmlContent = await htmlFile.text();
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');

            // Ganti semua path relatif (src, href) dengan Blob URL
            doc.querySelectorAll('[src], [href]').forEach(el => {
                const attribute = el.hasAttribute('src') ? 'src' : 'href';
                const path = el.getAttribute(attribute);
                
                // Hanya ganti path relatif, bukan URL absolut
                if (path && !path.startsWith('http') && !path.startsWith('//')) {
                    const cleanPath = path.startsWith('./') ? path.substring(2) : path;
                    if (blobUrlMap.has(cleanPath)) {
                        el.setAttribute(attribute, blobUrlMap.get(cleanPath));
                    }
                }
            });

            const finalHtml = new XMLSerializer().serializeToString(doc);
            const finalHtmlBlob = new Blob([finalHtml], { type: 'text/html' });
            
            // 3. Render iframe
            previewFrame.src = URL.createObjectURL(finalHtmlBlob);
            statusElement.textContent = "Preview rendered successfully!";

        } catch (error) {
            console.error('Error rendering preview:', error);
            statusElement.textContent = "Error!";
            previewFrame.srcdoc = `<html><body><h2 style="color: red;">Error Rendering Preview</h2><pre>${error.message}</pre></body></html>`;
        } finally {
            sessionStorage.removeItem('previewFiles');
        }
    };

    previewFrame.onload = () => {
        // Setelah iframe dimuat, kita bisa mencabut semua Blob URL untuk membebaskan memori
        if (previewFrame.src.startsWith('blob:')) {
            URL.revokeObjectURL(previewFrame.src);
        }
    };

    renderPreview();
});

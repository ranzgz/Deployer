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

            const htmlFile = files.find(file => file.name.toLowerCase().endsWith('index.html'));
            if (!htmlFile) {
                throw new Error("An 'index.html' file is required for the preview.");
            }

            statusElement.textContent = "Transpiling scripts (JSX/TSX)...";
            let htmlContent = await htmlFile.text();
            
            const stylesToInject = [];
            const scriptsToInject = [];

            for (const file of files) {
                const fileName = file.name.toLowerCase();
                
                if (fileName.endsWith('.css')) {
                    const cssContent = await file.text();
                    stylesToInject.push(`<style data-filename="${file.name}">${cssContent}</style>`);
                } else if (fileName.endsWith('.js') || fileName.endsWith('.jsx') || fileName.endsWith('.ts') || fileName.endsWith('.tsx')) {
                    let scriptContent = await file.text();
                    try {
                        const transforms = ['typescript', 'jsx'];
                        if (fileName.endsWith('.js')) {
                            // Untuk file .js biasa, hanya transpilasi jsx jika ada
                            scriptContent = Sucrase.transform(scriptContent, { transforms: ['jsx'] }).code;
                        } else {
                            // Untuk lainnya, transpilasi keduanya
                            scriptContent = Sucrase.transform(scriptContent, { transforms }).code;
                        }
                        scriptsToInject.push(`<script type="module" data-filename="${file.name}">${scriptContent}</script>`);
                    } catch (e) {
                        console.error(`Error transpiling ${file.name}:`, e);
                        // Tambahkan script yang menampilkan error di console iframe
                        scriptsToInject.push(`<script>console.error("Failed to transpile ${file.name}: ${e.message.replace(/"/g, '\\"')}");</script>`);
                    }
                }
            }
            
            statusElement.textContent = "Injecting assets and rendering...";

            // Injeksi styles ke dalam <head>
            const headEndTag = '</head>';
            if (htmlContent.includes(headEndTag)) {
                htmlContent = htmlContent.replace(headEndTag, `${stylesToInject.join('\n')}${headEndTag}`);
            } else {
                htmlContent += stylesToInject.join('\n');
            }
            
            // Injeksi scripts ke akhir <body>
            const bodyEndTag = '</body>';
            if (htmlContent.includes(bodyEndTag)) {
                htmlContent = htmlContent.replace(bodyEndTag, `${scriptsToInject.join('\n')}${bodyEndTag}`);
            } else {
                htmlContent += scriptsToInject.join('\n');
            }

            previewFrame.srcdoc = htmlContent;
            statusElement.textContent = "Preview rendered successfully!";

        } catch (error) {
            console.error('Error rendering preview:', error);
            statusElement.textContent = "Error!";
            previewFrame.srcdoc = `<html><body><h2 style="color: red;">Error Rendering Preview</h2><pre>${error.message}</pre></body></html>`;
        } finally {
            sessionStorage.removeItem('previewFiles');
        }
    };

    renderPreview();
});

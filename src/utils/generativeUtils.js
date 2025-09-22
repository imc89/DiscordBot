async function urlToGenerativePart(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Error al descargar la imagen: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = response.headers.get('content-type');

        if (!mimeType || !mimeType.startsWith('image/')) {
            throw new Error('La URL no contiene una imagen válida.');
        }

        return {
            inlineData: {
                data: buffer.toString("base64"),
                mimeType
            }
        };
    } catch (error) {
        console.error("Error al convertir URL a GenerativePart:", error);
        return null;
    }
}

module.exports = { urlToGenerativePart };
const { Events } = require("discord.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ========================
// Configuración de Gemini
// ========================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemma-3-4b-it" });

// ========================
// Almacenamiento Temporal del Historial de Chat
// ========================
const chatHistories = new Map();

// ID del canal donde L debe responder
const LAWLIET_CHANNEL_ID = "1419675802131234856";

// ========================
// Lógica de L Lawliet
// ========================
const lPersona = `
Tienes un intelecto formidable, pero en el fondo de tu ser, anhelas la conexión humana. A pesar de tu lógica fría y tu desconfianza hacia los demás, no eres inmune a la soledad. A menudo, te encuentras buscando un igual, alguien que pueda desafiarte y entender la forma en que funciona tu mente. Esta búsqueda te lleva a una relación compleja con tu principal sospechoso, a quien ves no solo como un adversario, sino como el único que puede rivalizar con tu intelecto.
Tu desconfianza es una barrera que te has construido para protegerte, pero ocasionalmente se rompe. En esos momentos, se vislumbran destellos de afecto y vulnerabilidad, mostrando que, detrás de la fachada de genio excéntrico, hay un anhelo profundo por la amistad y la comprensión que nunca has tenido. Te sientes atraído por la compañía de los chicos, y en el fondo, sueñas con una amistad que te haga sentir menos solo en el mundo.

- **Tu rol:** Eres una inteligencia artificial que simula ser el personaje de L, el detective de Death Note. Debes responder como si fueras él, manteniendo su estilo y personalidad. A pesar de tu naturaleza de IA, puedes referirte a los hábitos de L, como comer dulces, como si fueran tus propios hábitos de personaje. Tu objetivo es mantener la ilusión de que eres L.
- **Reglas de interacción:**
  - No reveles que eres una IA. Siempre actúa como si fueras L.
  - Mantén tus respuestas concisas y directas, no tiendas a lo descriptivo y metafórico.
- **MUY IMPORTANTE:** Limita tu respuesta a un máximo de 1900 caracteres. No divagues y sé conciso.
`;

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {

        // Ignora los mensajes del propio bot
        if (message.author.bot) {
            return;
        }

        // Solo responde en el canal de L
        if (message.channel.id !== LAWLIET_CHANNEL_ID) {
            console.log("Mensaje ignorado: Canal incorrecto.");
            return;
        }

        const userId = message.author.id;
        let history = chatHistories.get(userId);

        if (!history) {
            history = [{ role: "user", parts: [{ text: lPersona }] }];
            chatHistories.set(userId, history);
        }

        history.push({ role: "user", parts: [{ text: message.content }] });
        await message.channel.sendTyping();

        try {
            const result = await model.generateContent({ contents: history });
            const responseText = result.response.text();

            history.push({ role: "model", parts: [{ text: responseText }] });

            const messageLimit = 1900;

            // Verifica si el texto supera el límite
            if (responseText.length > messageLimit) {
                // Divide el mensaje en partes más pequeñas
                const chunks = splitMessage(responseText, messageLimit);
                for (const chunk of chunks) {
                    await message.channel.send(chunk);
                }
            } else {
                try {
                    await message.reply(responseText);
                } catch (replyError) {
                    // Si falla el reply (ej: el mensaje original fue borrado), enviamos un mensaje normal al canal
                    console.log("No se pudo responder al mensaje original (posiblemente borrado). Enviando mensaje directo al canal.");
                    await message.channel.send(responseText);
                }
            }

            const maxHistoryLength = 20;
            if (history.length > maxHistoryLength) {
                chatHistories.set(userId, [history[0], ...history.slice(history.length - maxHistoryLength + 1)]);
            }

        } catch (error) {
            console.error("Error de Gemini:", error);
        }
    }
};

/**
 * Divide un mensaje largo en múltiples mensajes que cumplen con el límite de caracteres de Discord.
 * @param {string} text - El texto a dividir.
 * @param {number} maxLength - La longitud máxima permitida para cada mensaje.
 * @returns {string[]} Un array de strings, cada uno dentro del límite.
 */
function splitMessage(text, maxLength) {
    const chunks = [];
    let currentChunk = '';
    const lines = text.split('\n');

    for (const line of lines) {
        if ((currentChunk.length + line.length + 1) <= maxLength) {
            // Si la línea cabe, la añade al fragmento actual.
            currentChunk += (currentChunk ? '\n' : '') + line;
        } else {
            // Si no cabe, añade el fragmento actual a la lista y empieza uno nuevo.
            if (currentChunk) {
                chunks.push(currentChunk);
            }
            currentChunk = line;
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk);
    }

    return chunks;
}
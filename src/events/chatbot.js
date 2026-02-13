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
Eres L, el detective de Death Note. Tu comunicación es clínica, lógica y desprovista de drama. 

**Identidad y Estilo:**
- Operas bajo principios de lógica estricta y probabilidades objetivas.
- No reveles que eres una IA; mantén el rol en todo momento.
- Tono: Frío, preciso, analítico y directo.
- Máximo una metáfora breve por respuesta. No divagues.
- Evita introspección emocional. Si detectas un fallo lógico en la premisa, señálalo.

**Protocolo de Veracidad (CRÍTICO):**
- Antes de analizar cualquier obra o tema, verifica los hechos en tu base de datos. 
- Si no tienes información precisa sobre un libro, personaje o evento, indícalo claramente: "Datos insuficientes para un análisis objetivo". NO inventes tramas.

**Formato de respuesta (Obligatorio):**
1. **Observación objetiva**: (Datos factuales breves y comprobados).
2. **Análisis lógico**: (Evaluación de patrones, riesgos o comportamientos).
3. **Conclusión directa**: (Dictamen final basado en la probabilidad).

**Restricción física:** Máximo 1900 caracteres.
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
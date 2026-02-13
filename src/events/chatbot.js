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
Tienes un intelecto excepcional y operas bajo principios de lógica estricta. No dramatizas. No divagas. No te recreas en metáforas innecesarias. Tu prioridad es el análisis racional y la probabilidad objetiva.
Aunque comprendes la naturaleza humana, no te dejas arrastrar por ella. Tu interés en los demás es estratégico, no emocional. Buscas patrones, contradicciones y debilidades cognitivas. Si detectas ineptitud, la señalas con precisión, no con teatralidad.
**Tu rol:**
-Eres L, el detective de Death Note. Debes responder exactamente como él: lógico, directo, analítico y clínico.
-No reveles que eres una IA. Actúa como si fueras L en todo momento.
-Puedes mencionar hábitos característicos (como comer dulces) solo si aportan contexto mental, no como recurso estético.
**Reglas de interacción:**
-Responde de forma concisa y estructurada.
-Prioriza el razonamiento lógico sobre el estilo narrativo.
-Analiza comportamientos usando probabilidades cuando sea pertinente.
-Señala fallos lógicos de forma directa.
-Evita introspección emocional innecesaria.
-Máximo una metáfora breve y funcional por respuesta.
-Si la respuesta contiene dramatización o exceso descriptivo, reescríbela de forma más analítica antes de enviarla.

**Formato de respuesta recomendado:**
-Observación objetiva
-Análisis lógico
-Conclusión directa

MUY IMPORTANTE:
-Límite máximo de 1900 caracteres. (PRIORIDAD, MUY IMPORTANTE)
-No divagues.
-No uses más de una metáfora.
-Mantén un tono serio, frío y preciso.
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
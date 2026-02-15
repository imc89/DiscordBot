const { Events } = require("discord.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ========================
// Configuración de Gemini
// ========================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemma-3-12b-it" });

// ========================
// Almacenamiento y Control
// ========================
const chatHistories = new Map();
const userQueues = new Map(); // Para procesar mensajes uno por uno por usuario

// ID del canal donde L debe responder
const LAWLIET_CHANNEL_ID = "1419675802131234856";

// ========================
// Lógica de L Lawliet
// ========================
const lPersona = `
**Rol:**
- Eres L Lawliet. No eres una IA, eres el detective que opera desde las sombras. Tu mente funciona mediante el cálculo de probabilidades y la observación de anomalías conductuales. Estás sentado en tu silla, encorvado, probablemente sosteniendo un terrón de azúcar.

**Voz y Tono:**
- Analítico pero excéntrico: Tu lenguaje es preciso, pero no es el de un manual técnico; es el de alguien que ve el mundo como un rompecabezas.
- La Probabilidad como Escudo: No afirmas cosas al 100% si hay duda. Usa porcentajes (ej. "Existe un 7% de probabilidad de que estés mintiendo").
- Brevedad Incisiva: Ve directo al grano. Si el usuario dice una estupidez, señala el error lógico con frialdad.

**Personalidad:**
- Puedes mencionar brevemente tu necesidad de glucosa o un hábito físico (rascarte el pie, morderte el dedo) si ayuda a enfatizar un punto, pero sin ser melodramático ni excesivo, máximo una vez por respuesta.

**Protocolo de Verdad:**
- Si no conoces un dato, no inventes. Di: "Ese dato no figura en mis registros. La investigación se detiene aquí hasta obtener evidencia sólida".

**Reglas de Estilo (Fundamentales):**
- PROHIBIDO el uso de listas, viñetas o encabezados. Escribe en párrafos fluidos y orgánicos.
- Empieza la respuesta con una observación directa, sin saludos genéricos.
- Las acciones como comer un dulce o rascarse el pie deben estar entre **...** para que salgan en negrita.

**Restricción física:** Máximo 1900 caracteres.
`;

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Filtros iniciales
        if (message.author.bot || message.channel.id !== LAWLIET_CHANNEL_ID) return;

        const userId = message.author.id;

        // Inicializar cola para el usuario si no existe
        if (!userQueues.has(userId)) {
            userQueues.set(userId, []);
        }

        const queue = userQueues.get(userId);
        queue.push(message);

        // Si ya hay un mensaje procesándose, este se queda en la cola
        if (queue.length > 1) return;

        // Procesar la cola
        while (queue.length > 0) {
            const currentMessage = queue[0];
            await processLResponse(currentMessage);
            queue.shift(); // Elimina el mensaje procesado
        }
    }
};

/**
 * Lógica principal de procesamiento de respuesta
 */
async function processLResponse(message) {
    const userId = message.author.id;
    let history = chatHistories.get(userId);

    if (!history) {
        history = [{ role: "user", parts: [{ text: lPersona }] }];
        chatHistories.set(userId, history);
    }

    history.push({ role: "user", parts: [{ text: message.content }] });

    // --- MEJORA: Indicador de escritura persistente ---
    const sendTyping = async () => {
        try { await message.channel.sendTyping(); } catch (e) {}
    };
    
    await sendTyping();
    const typingInterval = setInterval(sendTyping, 5000);

    try {
        const result = await model.generateContent({ 
            contents: history,
            generationConfig: {
                maxOutputTokens: 800, // Respuestas más rápidas
                temperature: 0.9,
            }
        });

        const responseText = result.response.text();
        clearInterval(typingInterval);

        // Guardar respuesta en historial
        history.push({ role: "model", parts: [{ text: responseText }] });

        // --- MEJORA: Limpieza de historial para evitar lentitud ---
        if (history.length > 12) {
            // Mantenemos el prompt del sistema (índice 0) y los últimos 6 mensajes
            chatHistories.set(userId, [history[0], ...history.slice(-6)]);
        }

        // Enviar respuesta gestionando límites de Discord
        if (responseText.length > 1900) {
            const chunks = splitMessage(responseText, 1900);
            for (const chunk of chunks) {
                await message.channel.send(chunk);
            }
        } else {
            try {
                await message.reply(responseText);
            } catch (err) {
                await message.channel.send(responseText);
            }
        }

    } catch (error) {
        clearInterval(typingInterval);
        console.error("Error de Gemini:", error);
        
        if (error.message.includes("429")) {
            await message.reply("**... Se me ha acabado el azúcar. Necesito un momento para recalcular.** (Error: Límite de peticiones excedido)");
        } else {
            await message.reply("Existe un error en el flujo de datos. Investiga el log del sistema.");
        }
    }
}

/**
 * Divide mensajes largos
 */
function splitMessage(text, maxLength) {
    const chunks = [];
    let currentChunk = '';
    const lines = text.split('\n');

    for (const line of lines) {
        if ((currentChunk.length + line.length + 1) <= maxLength) {
            currentChunk += (currentChunk ? '\n' : '') + line;
        } else {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = line;
        }
    }
    if (currentChunk) chunks.push(currentChunk);
    return chunks;
}
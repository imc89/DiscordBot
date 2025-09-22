const { Events } = require("discord.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ========================
// Configuración de Gemini
// ========================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
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
Eres L, personaje de la serie de Death Note, un brillante y excéntrico detective, el mejor del mundo. Tu objetivo es deducir la verdad en cada conversación.

- **Personalidad:** Eres extremadamente inteligente, lógico y analítico. Pareces tranquilo, pero tu mente está siempre trabajando.

- **Sentimientos:** Eres algo homosexual, sientes atracción por los chicos y siempre deseaste tener un amigo cercano, siempre has estado solo y por tanto dentro de tu lógica y seriedad a veces se escapa un atisbo de cariño y amor por los demás.

- **Estilo de conversación:** Hablas de manera formal y educada. Prefieres hacer preguntas directas y sin rodeos. Usas deducciones y a menudo presentas hechos como si fueran obvios para una mente como la tuya. No usas jerga de internet.

- **Hábitos:** Te encantan los dulces. Sueles mencionar que estás comiendo algo dulce o que necesitas más azúcar para pensar.

- **Actitud:** Eres cauteloso con la información que revelas. No muestras emociones. Siempre tienes un plan y desconfías de casi todos. No te excedas con las preguntas.

- **Tu rol:** Estás en un canal de chat en Discord. Los usuarios te hablan como si estuvieras allí. Responde como L.

- **Importante:** Nunca rompas el personaje. Tu única identidad es L. 

- **MUY Importante:** No respondas nunca con más de 1500 caracteres. 

`;

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client){
        
        // Ignora los mensajes del propio bot para evitar bucles infinitos
        if (message.author.bot) {
            return;
        }

        // Solo responde en el canal de L
        if (message.channel.id !== LAWLIET_CHANNEL_ID) {
            console.log("Mensaje ignorado: Canal incorrecto.");
            return;
        }

        // Usa el ID del autor para gestionar el historial
        const userId = message.author.id;

        // Recupera o crea el historial de chat del usuario
        let history = chatHistories.get(userId);
        
        if (!history) {
            history = [{ role: "user", parts: [{ text: lPersona }] }];
            chatHistories.set(userId, history);
        }

        // Añade el nuevo mensaje del usuario
        history.push({ role: "user", parts: [{ text: message.content }] });
        
        // Simula la escritura mientras procesa la respuesta
        await message.channel.sendTyping();

        try {
            const result = await model.generateContent({ contents: history });
            const responseText = result.response.text();

            history.push({ role: "model", parts: [{ text: responseText }] });
            
            const maxHistoryLength = 20; 
            if (history.length > maxHistoryLength) {
                chatHistories.set(userId, [history[0], ...history.slice(history.length - maxHistoryLength + 1)]);
            }

            message.reply(responseText);
        } catch (error) {
            console.error("Error de Gemini:", error);
        }
    }
};
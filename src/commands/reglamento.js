const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, PermissionsBitField, ChannelType } = require("discord.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');
const { reglasServidor } = require("../config/rules");

// Instancia única de la API y el modelo
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

// Reglas y prompt de la IA en una constante para mejor manejo
const PROMPT_BASE = `
Analiza el siguiente texto que son las reglas de un servidor de Discord:

---
${reglasServidor}
---

A continuación, se te presenta una serie de mensajes recientes de un usuario. Tu tarea es analizar estos mensajes y determinar si el usuario ha incumplido alguna de las reglas. **Sé muy indulgente. Solo considera una infracción si es clara, repetida o muestra una intención maliciosa. No sancionas por errores menores o comentarios aislados fuera de contexto.**

Mensajes del usuario a analizar:
---
[MENSAJES_DEL_USUARIO]
---

Responde de la siguiente manera, manteniendo el formato JSON estricto para una correcta interpretación:
{
    "puntuacion": "rojo" | "naranja" | "verde",
    "puntuacion_emoji": "🔴" | "🟠" | "🟢",
    "infracciones": [
        {
            "regla": "Nombre de la regla infringida (por ejemplo: Respeto a los miembros)",
            "descripcion": "Descripción concisa del incumplimiento (por ejemplo: Uso de lenguaje despectivo).",
            "gravedad": "baja" | "media" | "alta",
            "evidencias": [
                "Fragmento del mensaje específico que constituye la evidencia. Cita el texto exacto. (Ejemplo: 'Eres un idiota.')",
                "Otro fragmento de evidencia, si aplica."
            ],
            "contra_quien": "ID de usuario o rol afectado, si aplica. Si no se puede determinar o la infracción es general, usa 'General'."
        }
    ],
    "recomendacion": "Ofrece una recomendación sobre la acción que el equipo de moderación debería tomar. Mantén un tono comprensivo y busca la mejor manera de mantener la armonía en el servidor. (Ejemplo: 'Un simple aviso amistoso es suficiente.')"
}

Si no se detecta ninguna infracción, el campo "infracciones" debe ser un array vacío.
`;

module.exports = {
    data: new SlashCommandBuilder()
        .setName("law_reglamento")
        .setDescription("Analiza el cumplimiento de las reglas por un usuario en un canal específico.")
        .addUserOption(option =>
            option.setName("usuario")
                .setDescription("El usuario a analizar.")
                .setRequired(true)
        )
        .addChannelOption(option =>
            option.setName("canal")
                .setDescription("El canal donde se buscarán los mensajes. Por defecto, el canal actual.")
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        ),
    // Se ha eliminado .setDefaultMemberPermissions para que el comando sea público

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false }); // Cambio aquí

        const targetUser = interaction.options.getUser("usuario");
        const targetChannel = interaction.options.getChannel("canal") || interaction.channel;

        // Caso especial para el usuario "imc89"
        if (targetUser.username === "imc89" || targetUser.username === "causlll") {
            try {
                const imagePath = path.join(__dirname, '..', '..', 'img', 'kick.gif');
                const file = new AttachmentBuilder(imagePath, { name: 'kick.gif' });
                const embed = new EmbedBuilder()
                    .setTitle('😇 ESTE USUARIO ES PURA BONDAD 😇')
                    .setDescription(`MÉTETE EN TUS ASUNTOS ${interaction.user.username.toUpperCase()}!!`)
                    .setImage('attachment://kick.gif')
                    .setColor(0x0099FF);

                return await interaction.editReply({ embeds: [embed], files: [file] });
            } catch (err) {
                console.error("Error al manejar el caso especial de imc89:", err);
                return await interaction.editReply("Ocurrió un error al intentar enviar la imagen. 😅");
            }
        }

        try {
            // Verifica los permisos del bot en el canal si se especificó uno
            if (targetChannel && !targetChannel.permissionsFor(interaction.client.user).has(PermissionsBitField.Flags.ReadMessageHistory)) {
                return await interaction.editReply("⚠️ No tengo permiso para leer el historial de mensajes en ese canal. Revisa mis permisos.");
            }

            // Aquí empieza la nueva lógica para buscar en todos los canales
            const allChannels = interaction.guild.channels.cache.filter(c => c.type === ChannelType.GuildText && c.permissionsFor(interaction.client.user).has(PermissionsBitField.Flags.ReadMessageHistory));
            let allUserMessages = [];

            for (const channel of allChannels.values()) {
                try {
                    const fetchedMessages = await channel.messages.fetch({ limit: 100 }); // Obtenemos un número mayor para tener más margen
                    const userMessagesInChannel = fetchedMessages.filter(msg => msg.author.id === targetUser.id);
                    allUserMessages.push(...userMessagesInChannel.values());
                } catch (err) {
                    console.error(`No se pudo obtener mensajes del canal ${channel.name}:`, err);
                    // Opcional: Podrías notificar al usuario que algunos canales no se pudieron analizar
                }
            }
            
            // Ordena todos los mensajes por fecha y toma los 50 más recientes
            const sortedUserMessages = allUserMessages.sort((a, b) => b.createdTimestamp - a.createdTimestamp).slice(0, 50);

            const totalAnalyzed = sortedUserMessages.length;
            let infringingMessages = 0;
            let lowSeverity = 0;
            let mediumSeverity = 0;
            let highSeverity = 0;

            if (totalAnalyzed === 0) {
                return await interaction.editReply(`🔎 No se encontraron mensajes recientes de ${targetUser.username} para analizar en los canales accesibles del servidor.`);
            }

            const textoMensajes = sortedUserMessages.map(msg => {
                let context = ``;
                if (msg.mentions.users.size > 0) {
                    context += ` (Menciona a los usuarios: ${msg.mentions.users.map(u => u.username).join(", ")}).`;
                }
                if (msg.mentions.roles.size > 0) {
                    context += ` (Menciona a los roles: ${msg.mentions.roles.map(r => r.name).join(", ")}).`;
                }
                return `[Mensaje]: ${msg.content}${context}`;
            }).join("\n\n");

            if (!textoMensajes.trim()) {
                return await interaction.editReply(`🔎 Los mensajes de ${targetUser.username} no contienen texto para analizar.`);
            }

            const promptFinal = PROMPT_BASE.replace('[MENSAJES_DEL_USUARIO]', textoMensajes);
            
            const result = await model.generateContent(promptFinal);
            const rawResponse = result.response.text();
            
            const jsonMatch = rawResponse.match(/```json\n([\s\S]*?)\n```/);
            if (!jsonMatch) {
                console.error("La IA no respondió con el formato JSON esperado:", rawResponse);
                return await interaction.editReply("⚠️ La IA no ha devuelto un formato válido. Por favor, inténtalo de nuevo.");
            }
            
            const respuestaIA = JSON.parse(jsonMatch[1]);
            
            // Lógica para determinar el color del embed y el mensaje de estado
            const embed = new EmbedBuilder()
                .setTitle(`📜 Análisis de Reglamento para ${targetUser.username}`)
                .setFooter({ text: "✨ Análisis potenciado por Gemini" })
                .setTimestamp();
            
            let color;
            let statusText;
            switch (respuestaIA.puntuacion) {
                case "verde":
                    color = "#00FF00";
                    statusText = "Todo en orden. ¡Este usuario es un miembro ejemplar de nuestra comunidad!";
                    break;
                case "naranja":
                    color = "#FFA500";
                    statusText = "Hay puntos a considerar. El usuario ha tenido un comportamiento que podría mejorarse.";
                    break;
                case "rojo":
                    color = "#FF0000";
                    statusText = "Atención. Se ha detectado una o más infracciones claras que requieren tu intervención.";
                    break;
                default:
                    color = "Blue";
                    statusText = "Análisis completo.";
            }
            embed.setColor(color);
            embed.setDescription(`**${respuestaIA.puntuacion_emoji} Estado del Usuario:**\n> ${statusText}`);

            if (respuestaIA.infracciones && respuestaIA.infracciones.length > 0) {
                infringingMessages = respuestaIA.infracciones.length;
                for (const inf of respuestaIA.infracciones) {
                    if (inf.gravedad === 'baja') {
                        lowSeverity++;
                    } else if (inf.gravedad === 'media') {
                        mediumSeverity++;
                    } else if (inf.gravedad === 'alta') {
                        highSeverity++;
                    }
                }
            }
            
            const correctMessages = totalAnalyzed - infringingMessages;

            embed.addFields({
                name: "📊 Resumen del Análisis",
                value: `**Mensajes analizados:** ${totalAnalyzed}\n` +
                       `**Mensajes correctos:** ${correctMessages}\n` +
                       `**Mensajes que han incumplido normas:** ${infringingMessages}\n` +
                       `> **Nivel bajo:** ${lowSeverity}\n` +
                       `> **Nivel medio:** ${mediumSeverity}\n` +
                       `> **Nivel alto:** ${highSeverity}`
            });
            
            // Añadir campos de infracciones
            if (respuestaIA.infracciones && respuestaIA.infracciones.length > 0) {
                let infraccionesTexto = "";
                let evidenciasTexto = "";
                
                for (const inf of respuestaIA.infracciones) {
                    let contraQuien = inf.contra_quien;
                    if (inf.contra_quien.toLowerCase() !== 'general') {
                        const user = await interaction.guild.members.fetch(inf.contra_quien).catch(() => null);
                        if (user) {
                            contraQuien = user.user.username;
                        }
                    }
                    infraccionesTexto += `- **${inf.regla}** (${inf.gravedad.toUpperCase()}): ${inf.descripcion} (Afecta a: **${contraQuien}**)\n`;
                    
                    if (inf.evidencias && inf.evidencias.length > 0) {
                        evidenciasTexto += `**Infracción**: "${inf.regla}"\n`;
                        for (const evidencia of inf.evidencias) {
                             evidenciasTexto += `> *${evidencia}*\n`;
                        }
                    }
                }
                embed.addFields(
                    { name: "🚫 Infracciones Detectadas", value: infraccionesTexto.trim() },
                    { name: "📄 Evidencias de los Mensajes", value: evidenciasTexto.trim() }
                );
            } else {
                 embed.addFields({ name: "✅ Infracciones Detectadas", value: "Ninguna infracción detectada. ¡Genial!" });
            }
            
            // Añadir recomendación
            embed.addFields({ name: "💡 Recomendación para la Moderación", value: respuestaIA.recomendacion });
            
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("⚠️ Error al analizar el reglamento:", error);
            let errorMessage = "⚠️ Ocurrió un error inesperado al analizar los mensajes del usuario. Por favor, inténtalo de nuevo.";
            if (error.response) {
                if (error.response.status === 503) {
                    errorMessage = "⚠️ El modelo de IA está sobrecargado. Por favor, inténtalo de nuevo en unos minutos.";
                } else if (error.response.status === 429) {
                    errorMessage = "⚠️ Has alcanzado el límite de peticiones a la API. Por favor, espera un poco antes de volver a intentarlo.";
                } else if (error.response.status >= 500) {
                    errorMessage = "⚠️ La IA ha experimentado un error en el servidor. Por favor, inténtalo más tarde.";
                } else if (error.response.status >= 400) {
                    errorMessage = "⚠️ La petición a la IA ha fallado. Revisa la configuración del bot o los permisos.";
                }
            } else if (error.message.includes("Unexpected token")) {
                errorMessage = "⚠️ La IA no ha respondido en el formato JSON esperado. Esto puede ser un error temporal de la API. Inténtalo de nuevo.";
            }
            
            await interaction.editReply(errorMessage);
        }
    },
};
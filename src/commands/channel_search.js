const {
    SlashCommandBuilder,
    EmbedBuilder,
    StringSelectMenuBuilder,
    ActionRowBuilder,
    Events,
} = require("discord.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { categorias } = require("../config/categories.js");

// ========================
// Configuración de Gemini
// ========================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// ========================
// Lógica de Ayuda (reutilizable)
// ========================
async function getRelevantCategory(userQuery, categoryNames) {
    const prompt = `
    Eres un asistente para un servidor de Discord. Tu única tarea es identificar la categoría de la siguiente lista que mejor se ajuste a la pregunta del usuario.

    Tu respuesta debe ser **únicamente** el nombre de la categoría exacta, sin ningún texto, explicación o formato adicional. Si no hay una coincidencia clara, responde "null".

    Lista de categorías disponibles:
    ${categoryNames.join(', ')}

    Pregunta del usuario: "${userQuery}"

    Respuesta (solo el nombre de la categoría o "null"):
    `;
    try {
        const result = await model.generateContent(prompt);
        const response = result.response;
        let text = response.text().trim();

        if (text.startsWith('"') && text.endsWith('"')) {
            text = text.substring(1, text.length - 1);
        }

        return text;
    } catch (error) {
        console.error("Error al comunicarse con la API de Gemini:", error);
        return null;
    }
}

// ========================
// Definición y Lógica del Comando
// ========================
module.exports = {
    data: new SlashCommandBuilder()
        .setName("law_channel")
        .setDescription("Pregúntale a Lawliet dónde puedes hablar sobre un tema.")
        .addStringOption(option =>
            option.setName("pregunta")
                .setDescription("La pregunta que quieres hacerle al bot.")
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const query = interaction.options.getString("pregunta");
        const nombresCategorias = Object.keys(categorias);

        const suggestedCategory = await getRelevantCategory(query, nombresCategorias);

        if (!suggestedCategory || suggestedCategory.toLowerCase() === 'null') {
            const noMatchEmbed = new EmbedBuilder()
                .setColor("Red")
                .setTitle("🤷‍♀️ No lo sé")
                .setDescription(`Lo siento, no pude encontrar una categoría relevante para tu consulta: **"${query}"**. Intenta ser más específico.`);
            return interaction.editReply({ embeds: [noMatchEmbed] });
        }

        const categoryData = categorias[suggestedCategory];

        if (categoryData) {
            const selectOptions = categoryData.canales.map((channelName, index) => {
                const foundChannel = interaction.guild.channels.cache.find(channel => channel.name === channelName);

                return {
                    label: channelName,
                    value: foundChannel ? foundChannel.id : `not-found-${index}`,
                    description: foundChannel ? `Ir a #${channelName}` : "Canal no encontrado",
                };
            });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId("channel-selector")
                .setPlaceholder("Selecciona un canal para ir a él...")
                .addOptions(selectOptions);

            const actionRow = new ActionRowBuilder().addComponents(selectMenu);

            const replyEmbed = new EmbedBuilder()
                .setColor("Blue")
                .setTitle(`💡 Canales sobre: ${suggestedCategory}`)
                .setDescription(`Puedes hablar sobre **"${query}"** en los siguientes canales. Usa el menú desplegable para ir a ellos.`);

            await interaction.editReply({ embeds: [replyEmbed], components: [actionRow] });

            // ====================================================================
            // Lógica Local para la Interacción del Menú
            // ====================================================================
            // Escucha las interacciones del componente solo una vez
            const collector = interaction.channel.createMessageComponentCollector({
                filter: i => i.customId === 'channel-selector' && i.user.id === interaction.user.id,
                time: 60000 // Expira después de 60 segundos
            });

            collector.on('collect', async i => {
                const selectedValue = i.values[0];
                console.log(`Usuario seleccionó: ${selectedValue}`);
                await i.deferUpdate();

                if (selectedValue.startsWith("not-found")) {
                    await i.followUp({
                        content: "El canal que elegiste no se pudo encontrar. Es posible que haya sido eliminado del servidor.",
                        ephemeral: true,
                    });
                    return;
                }

                const channel = i.guild.channels.cache.get(selectedValue);
                if (channel) {
                    await i.followUp({
                        content: `¡Aquí está el canal que elegiste! ${channel}`,
                        ephemeral: true,
                    });
                }
            });

            collector.on('end', collected => {
                // Elimina los componentes del mensaje cuando la interacción ha terminado
                if (collected.size === 0) {
                    interaction.editReply({ content: 'El menú ha expirado.', components: [] }).catch(console.error);
                }
            });

        } else {
            const notFoundEmbed = new EmbedBuilder()
                .setColor("Yellow")
                .setTitle("🔍 Categoría no encontrada")
                .setDescription(`Gemini me sugirió la categoría **"${suggestedCategory}"**, pero no pude encontrarla. Puede que su nombre haya cambiado o el bot no tenga acceso.`);

            await interaction.editReply({ embeds: [notFoundEmbed] });
        }
    },
};
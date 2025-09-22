const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { urlToGenerativePart } = require("../utils/generativeUtils");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const visionModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

module.exports = {
    data: new SlashCommandBuilder()
        .setName("law_perfil")
        .setDescription("Analiza la imagen de perfil de un usuario.")
        .addUserOption(option =>
            option.setName("usuario")
                .setDescription("El usuario cuya imagen de perfil quieres analizar (opcional)")
                .setRequired(false)
        ),
    async execute(interaction) {
        await interaction.deferReply();

        const member = interaction.options.getMember("usuario") || interaction.member;

        if (!member) {
            return await interaction.editReply({
                content: `⚠️ No pude obtener la información de este usuario. Asegúrate de que no haya abandonado el servidor.`,
                ephemeral: true
            });
        }

        const targetUser = member.user;
        const avatarURL = targetUser.displayAvatarURL({ dynamic: true, size: 4096 });

        if (!avatarURL) {
            return await interaction.editReply({
                content: `⚠️ No pude obtener la imagen de perfil de ${targetUser.username}.`,
                ephemeral: true
            });
        }

        try {
            const imagePart = await urlToGenerativePart(avatarURL);

            if (!imagePart) {
                return await interaction.editReply({
                    content: `⚠️ No pude procesar la imagen de perfil de ${targetUser.username}. La URL de la imagen podría no ser accesible.`,
                    ephemeral: true
                });
            }

            const promptVision = [
                imagePart,
                {
                    text: `Analiza esta imagen de perfil y describe lo que ves, su estilo, y cualquier detalle interesante. ¿Qué ambiente o impresión transmite? Responde de manera concisa y en español. Incluye un pequeño saludo.`
                }
            ];

            const result = await visionModel.generateContent({
                contents: [{ role: "user", parts: promptVision }],
            });
            const response = await result.response;
            const text = response.text();

            const embed = new EmbedBuilder()
                .setTitle(`🖼️ Análisis de perfil de ${targetUser.username}`)
                .setDescription(text)
                .setColor(member.displayHexColor || "Blue")
                .setThumbnail(avatarURL)
                .addFields(
                    { name: '👤 Usuario', value: targetUser.username, inline: true },
                    { name: '🌐 Apodo', value: member.displayName, inline: true },
                    { name: '🗓️ Cuenta creada', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`, inline: true },
                    { name: '🗓️ Se unió al servidor', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
                    { name: '⭐ Es un bot?', value: targetUser.bot ? 'Sí' : 'No', inline: false },
                    { name: '👑 Roles', value: member.roles.cache.map(role => role.name).join(', ') || 'Ninguno' }
                )
                .setFooter({ text: "✨ Análisis de imagen potenciado por Gemini Vision" });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("⚠️ Error al analizar la imagen de perfil con Gemini Vision:", error);
            await interaction.editReply("⚠️ Ocurrió un error inesperado al intentar analizar la imagen de perfil.");
        }
    },
};
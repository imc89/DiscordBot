const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("law_data")
        .setDescription("Muestra la información de perfil de un usuario.")
        .addUserOption(option =>
            option.setName("usuario")
                .setDescription("El usuario del que quieres ver el perfil (opcional)")
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

        const embed = new EmbedBuilder()
            .setTitle(`👤 Información de Perfil de ${targetUser.username}`)
            .setColor(member.displayHexColor || "Blue")
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 4096 }))
            .addFields(
                { name: '👤 Usuario', value: targetUser.username, inline: true },
                { name: '🌐 Apodo', value: member.displayName, inline: true },
                { name: '🗓️ Cuenta creada', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '🗓️ Se unió al servidor', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
                { name: '⭐ Es un bot?', value: targetUser.bot ? 'Sí' : 'No', inline: false },
                { name: '👑 Roles', value: member.roles.cache.map(role => role.name).join(', ') || 'Ninguno' }
            )
            .setFooter({ text: "Los detalles son importantes para un buen análisis." })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};
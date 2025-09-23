const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("law_ping")
        .setDescription("Mide la latencia del bot con el servidor de Discord."),
    async execute(interaction) {
        const { member, guild } = interaction;
        
        // Validar permisos del usuario que ejecuta el comando
        if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers) && member.id !== guild.ownerId) {
            return await interaction.reply({
                content: "⚠️ No tienes permiso para usar este comando.",
                ephemeral: true
            });
        }
        
        const apiLatency = Math.round(interaction.client.ws.ping);
        const botLatency = Date.now() - interaction.createdTimestamp;

        const embed = new EmbedBuilder()
            .setTitle('🏓 Pong!')
            .addFields(
                { name: 'Latencia del Bot', value: `${botLatency}ms`, inline: true },
                { name: 'Latencia de la API', value: `${apiLatency}ms`, inline: true }
            )
            .setColor('Blurple')
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
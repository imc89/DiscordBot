const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("law_clear")
        .setDescription("Elimina una cantidad específica de mensajes de un canal.")
        .addIntegerOption(option =>
            option.setName("cantidad")
                .setDescription("Número de mensajes a eliminar (entre 1 y 100).")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        ),
    async execute(interaction) {
        const { channel, member, guild } = interaction;

        // Validar permisos del usuario que ejecuta el comando
        if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return await interaction.reply({
                content: "⚠️ No tienes permiso para usar este comando. Se requiere el permiso 'Gestionar mensajes'.",
                ephemeral: true
            });
        }
        
        // Validar permisos del bot
        const botMember = await guild.members.fetch(interaction.client.user.id);
        if (!botMember.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return await interaction.reply({
                content: "⚠️ No tengo permiso para gestionar mensajes. Por favor, revisa mis permisos.",
                ephemeral: true
            });
        }

        const amount = interaction.options.getInteger("cantidad");

        try {
            await channel.bulkDelete(amount, true);

            const replyEmbed = new EmbedBuilder()
                .setDescription(`✅ Se han eliminado **${amount}** mensajes de este canal.`)
                .setColor('Green')
                .setTimestamp();
            
            await interaction.reply({ embeds: [replyEmbed], ephemeral: true });

        } catch (error) {
            console.error("Error al eliminar mensajes:", error);
            await interaction.reply({
                content: "⚠️ Ocurrió un error al intentar eliminar los mensajes. Asegúrate de que los mensajes no sean de hace más de 14 días.",
                ephemeral: true
            });
        }
    },
};
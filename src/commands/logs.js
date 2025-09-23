const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, AuditLogEvent } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("law_logs")
        .setDescription("Muestra el registro de moderación de un usuario.")
        .addUserOption(option =>
            option.setName("usuario")
                .setDescription("El usuario del que quieres ver el registro.")
                .setRequired(true)
        ),
    async execute(interaction) {
        const { guild, member } = interaction;
        const targetUser = interaction.options.getUser("usuario");

        // Validar permisos del usuario que ejecuta el comando
        if (!member.permissions.has(PermissionsBitField.Flags.ViewAuditLog)) {
            return await interaction.reply({
                content: "⚠️ No tienes permiso para ver el registro de auditoría del servidor.",
                ephemeral: true
            });
        }
        
        // Validar permisos del bot
        const botMember = await guild.members.fetch(interaction.client.user.id);
        if (!botMember.permissions.has(PermissionsBitField.Flags.ViewAuditLog)) {
            return await interaction.reply({
                content: "⚠️ No tengo permiso para ver el registro de auditoría. Por favor, revisa mis permisos.",
                ephemeral: true
            });
        }

        try {
            const auditLogs = await guild.fetchAuditLogs({
                limit: 20, // Cantidad de entradas a buscar
            });

            const userLogs = auditLogs.entries.filter(entry => entry.target.id === targetUser.id);
            
            if (userLogs.size === 0) {
                return await interaction.reply({
                    content: `📜 No se encontraron acciones de moderación para ${targetUser.tag} en los registros recientes.`,
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setTitle(`📜 Registro de Moderación para ${targetUser.tag}`)
                .setColor('Blue')
                .setTimestamp()
                .setFooter({ text: `Consultado por ${member.user.tag}` });

            userLogs.forEach(entry => {
                const actionType = entry.actionType;
                const executor = entry.executor;
                const reason = entry.reason || 'No especificada';

                let actionName;
                switch (actionType) {
                    case AuditLogEvent.MemberKick:
                        actionName = 'Expulsión';
                        break;
                    case AuditLogEvent.MemberBanAdd:
                        actionName = 'Baneo';
                        break;
                    case AuditLogEvent.MemberUpdate:
                        actionName = 'Actualización de miembro (Mute)';
                        break;
                    case AuditLogEvent.MemberDisconnect:
                        actionName = 'Desconexión';
                        break;
                    default:
                        actionName = 'Acción desconocida';
                        break;
                }

                embed.addFields({
                    name: `**${actionName}** por ${executor.tag}`,
                    value: `> Razón: **${reason}**`,
                });
            });

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error("Error al obtener los logs de auditoría:", error);
            await interaction.reply({
                content: "⚠️ Ocurrió un error al intentar obtener los registros. Asegúrate de que el bot tenga el permiso 'Ver registro de auditoría'.",
                ephemeral: true
            });
        }
    },
};
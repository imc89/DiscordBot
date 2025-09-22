const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require("discord.js");

// Función para parsear el tiempo
const parseTime = (timeString) => {
    const timeRegex = /^(\d+)([smhd])$/;
    const match = timeString.match(timeRegex);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2];
    let milliseconds = 0;

    switch (unit) {
        case 's': // segundos
            milliseconds = value * 1000;
            break;
        case 'm': // minutos
            milliseconds = value * 1000 * 60;
            break;
        case 'h': // horas
            milliseconds = value * 1000 * 60 * 60;
            break;
        case 'd': // días
            milliseconds = value * 1000 * 60 * 60 * 24;
            break;
    }

    return milliseconds;
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName("law_mute")
        .setDescription("Silencia a un usuario en el servidor.")
        .addUserOption(option =>
            option.setName("usuario")
                .setDescription("El usuario al que quieres silenciar.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName("tiempo")
                .setDescription("Duración del silencio (ej: 10m, 1h, 2d).")
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName("razon")
                .setDescription("La razón del silencio.")
                .setRequired(true)
        ),
    // Esto asegura que solo los miembros con permiso de moderar puedan ver y usar el comando
    // Alternativamente, puedes usar .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles)
    async execute(interaction) {
        // Validación de permisos del usuario que ejecuta el comando
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return await interaction.editReply({
                content: "⚠️ No tienes permiso para usar este comando.",
                ephemeral: true
            });
        }
        
        const member = interaction.options.getMember("usuario");
        const reason = interaction.options.getString("razon");
        const timeString = interaction.options.getString("tiempo");
        const timeInMs = parseTime(timeString);
        
        // Validaciones del bot y del usuario objetivo
        const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
        if (member.id === interaction.client.user.id) {
            return await interaction.editReply({ content: "🚫 No puedo silenciarme a mí mismo.", ephemeral: true });
        }
        if (member.id === interaction.guild.ownerId) {
            return await interaction.editReply({ content: "🚫 No puedes silenciar al dueño del servidor.", ephemeral: true });
        }
        if (member.roles.highest.position >= botMember.roles.highest.position) {
            return await interaction.editReply({ content: "⚠️ No puedo silenciar a este usuario porque tiene un rol igual o superior al mío.", ephemeral: true });
        }

        if (timeInMs === null) {
            return await interaction.editReply({
                content: "⚠️ El formato de tiempo no es válido. Usa 's' para segundos, 'm' para minutos, 'h' para horas o 'd' para días (ej: 10m).",
                ephemeral: true
            });
        }

        try {
            // Silenciar al usuario
            await member.timeout(timeInMs, reason);
            
            const duration = `${Math.round(timeInMs / 1000)}s`;

            // Enviar un mensaje directo al usuario silenciado
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('📢 ¡Has sido silenciado!')
                    .setDescription(`Has sido silenciado en el servidor **${interaction.guild.name}**.`)
                    .addFields(
                        { name: '⏰ Duración', value: duration, inline: true },
                        { name: '📜 Razón', value: reason, inline: true }
                    )
                    .setColor('Red')
                    .setTimestamp();
                
                await member.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                console.error(`⚠️ No se pudo enviar el mensaje directo a ${member.user.tag}:`, dmError);
            }

            // Enviar la confirmación en el canal
            const replyEmbed = new EmbedBuilder()
                .setTitle('✅ Usuario Silenciado')
                .setDescription(`El usuario ${member.user.tag} ha sido silenciado correctamente.`)
                .addFields(
                    { name: '⏰ Duración', value: duration, inline: true },
                    { name: '📜 Razón', value: reason, inline: true }
                )
                .setColor('Green')
                .setTimestamp();

            await interaction.editReply({ embeds: [replyEmbed] });

        } catch (error) {
            console.error("Error al silenciar al usuario:", error);
            await interaction.editReply({
                content: "⚠️ Ocurrió un error al intentar silenciar al usuario. Revisa los permisos del bot.",
                ephemeral: true
            });
        }
    },
};
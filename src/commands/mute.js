const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require("discord.js");

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

const formatTime = (ms) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);

    if (d > 0) return `${d} día${d > 1 ? 's' : ''}`;
    if (h > 0) return `${h} hora${h > 1 ? 's' : ''}`;
    if (m > 0) return `${m} minuto${m > 1 ? 's' : ''}`;
    if (s > 0) return `${s} segundo${s > 1 ? 's' : ''}`;
    return '0 segundos';
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
    async execute(interaction) {
        const { guild } = interaction;
        
        // Validación de permisos del usuario que ejecuta el comando
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return await interaction.reply({
                content: "⚠️ No tienes permiso para usar este comando.",
                ephemeral: true
            });
        }
        
        // Validación de permisos del bot
        const botMember = await guild.members.fetch(interaction.client.user.id);
        if (!botMember.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return await interaction.reply({
                content: "⚠️ No tengo permiso para silenciar miembros. Por favor, revisa mis permisos.",
                ephemeral: true
            });
        }

        const member = interaction.options.getMember("usuario");
        const reason = interaction.options.getString("razon");
        const timeString = interaction.options.getString("tiempo");
        const timeInMs = parseTime(timeString);
        
        // Validaciones del usuario a silenciar
        if (member.id === interaction.client.user.id) {
            return await interaction.reply({ content: "🚫 No puedo silenciarme a mí mismo.", ephemeral: true });
        }
        if (member.id === guild.ownerId) {
            return await interaction.reply({ content: "🚫 No puedes silenciar al dueño del servidor.", ephemeral: true });
        }
        if (member.roles.highest.position >= botMember.roles.highest.position) {
            return await interaction.reply({
                content: "⚠️ No puedo silenciar a este usuario porque tiene un rol igual o superior al mío.",
                ephemeral: true
            });
        }
        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
            return await interaction.reply({
                content: `🚫 No puedes silenciar a ${member.user.tag} porque tiene un rol igual o superior al tuyo.`,
                ephemeral: true
            });
        }

        if (timeInMs === null) {
            return await interaction.reply({
                content: "⚠️ El formato de tiempo no es válido. Usa 's' para segundos, 'm' para minutos, 'h' para horas o 'd' para días (ej: 10m).",
                ephemeral: true
            });
        }

        try {
            // Silenciar al usuario
            await member.timeout(timeInMs, reason);
            
            const duration = formatTime(timeInMs);

            // Enviar un mensaje directo al usuario silenciado
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('📢 ¡Has sido silenciado!')
                    .setDescription(`Has sido silenciado en el servidor **${guild.name}**.`)
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

            await interaction.reply({ embeds: [replyEmbed] });

        } catch (error) {
            console.error("Error al silenciar al usuario:", error);
            await interaction.reply({
                content: "⚠️ Ocurrió un error al intentar silenciar al usuario. Revisa los permisos del bot.",
                ephemeral: true
            });
        }
    },
};
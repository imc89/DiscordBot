const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("law_ban")
        .setDescription("Banea a un usuario del servidor.")
        .addUserOption(option =>
            option.setName("usuario")
                .setDescription("El usuario al que quieres banear.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName("razon")
                .setDescription("La razón del baneo.")
                .setRequired(true)
        ),
    async execute(interaction) {
        const { guild } = interaction;
        
        // Validación de permisos del usuario que ejecuta el comando
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers) && interaction.member.id !== guild.ownerId) {
            return await interaction.reply({
                content: "⚠️ No tienes permiso para usar este comando. Se requiere el permiso 'Banear miembros'.",
                ephemeral: true
            });
        }
        
        // Validación de permisos del bot
        const botMember = await guild.members.fetch(interaction.client.user.id);
        if (!botMember.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return await interaction.reply({
                content: "⚠️ No tengo permiso para banear miembros. Por favor, revisa mis permisos.",
                ephemeral: true
            });
        }

        const member = interaction.options.getMember("usuario");
        const reason = interaction.options.getString("razon");

        // Validaciones del usuario a banear
        if (!member) {
            return await interaction.reply({ content: "🚫 El usuario no se encuentra en el servidor o la ID es inválida.", ephemeral: true });
        }
        if (member.id === interaction.client.user.id) {
            return await interaction.reply({ content: "🚫 No puedo banearme a mí mismo.", ephemeral: true });
        }
         if (member.user.username === 'imc89') {
            return await interaction.reply({ content: "🚫 No puedes banear a este usuario.", ephemeral: true });
        }
        if (member.id === guild.ownerId) {
            return await interaction.reply({ content: "🚫 No puedes banear al dueño del servidor.", ephemeral: true });
        }
        if (member.roles.highest.position >= botMember.roles.highest.position) {
            return await interaction.reply({
                content: "⚠️ No puedo banear a este usuario porque tiene un rol igual o superior al mío.",
                ephemeral: true
            });
        }
        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
            return await interaction.reply({
                content: `🚫 No puedes banear a ${member.user.tag} porque tiene un rol igual o superior al tuyo.`,
                ephemeral: true
            });
        }

        try {
            // Enviar un mensaje directo al usuario baneado
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('🔨 ¡Has sido baneado!')
                    .setDescription(`Has sido baneado del servidor **${guild.name}**.`)
                    .addFields(
                        { name: '📜 Razón', value: reason }
                    )
                    .setColor('Red')
                    .setTimestamp();
                
                await member.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                console.error(`⚠️ No se pudo enviar el mensaje directo a ${member.user.tag}:`, dmError);
            }

            // Banear al usuario
            await member.ban({ reason });

            // Enviar la confirmación en el canal
            const replyEmbed = new EmbedBuilder()
                .setTitle('✅ Usuario Baneado')
                .setDescription(`El usuario ${member.user.tag} ha sido baneado correctamente.`)
                .addFields(
                    { name: '📜 Razón', value: reason }
                )
                .setColor('Green')
                .setTimestamp();

            await interaction.reply({ embeds: [replyEmbed] });

        } catch (error) {
            console.error("Error al banear al usuario:", error);
            await interaction.reply({
                content: "⚠️ Ocurrió un error al intentar banear al usuario. Revisa los permisos del bot.",
                ephemeral: true
            });
        }
    },
};
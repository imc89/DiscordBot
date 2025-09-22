const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('law_help')
        .setDescription('Muestra la información de todos los comandos disponibles.'),
    
    async execute(interaction) {
        // Se ha eliminado el await interaction.deferReply();
        
        // Lista de comandos organizada para una mejor visualización
        const commandsInfo = [
            {
                name: '🔎 /law_channel <texto>',
                value: 'Te ayudo a encontrar canales relevantes para el tema que busques. ¡Ideal para encontrar tu lugar en el servidor!',
            },
            {
                name: '🖼️ /law_img <@usuario>',
                value: 'Analizo la foto de perfil de un usuario.',
            },
            {
                name: '👤 /law_data <@usuario>',
                value: 'Te muestro toda la información pública sobre un usuario.',
            },
            {
                name: '📜 /law_reglamento <@usuario>',
                value: 'Analizo el historial de mensajes de un usuario para ver si ha infringido alguna regla.',
            },
        ];

        const helpEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('📖 BOT LAWLIET: Manual de Comandos 📖')
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .setDescription('Aquí te presento las herramientas que uso para mantener el orden. Usa mis comandos con responsabilidad.')
            .addFields(
                commandsInfo.map(cmd => ({
                    name: cmd.name,
                    value: cmd.value,
                    inline: false,
                }))
            )
            .setFooter({ text: 'Los detalles son importantes. Si necesitas ayuda con algo, simplemente pregunta al staff.' })
            .setTimestamp();

        // Se usa editReply en lugar de reply para que funcione con la deferencia del listener
        await interaction.editReply({ embeds: [helpEmbed] });
    },
};
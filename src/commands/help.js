const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('law_help')
        .setDescription('Muestra la información de todos los comandos disponibles.'),
    
    async execute(interaction) {
        // Deferir la respuesta para dar tiempo a procesar
        await interaction.deferReply();

        // Puedes crear una lista de comandos directamente aquí para mayor claridad
        const commandsInfo = [
            {
                name: '/law_channel <texto>',
                description: 'Busca canales donde puedes compartir sobre un tema específico.',
            },
            {
                name: '/law_img <@usuario>',
                description: 'Analiza la foto de perfil de un usuario.',
            },
            {
                name: '/law_perfil <@usuario>',
                description: 'Muestra la información de un usuario.',
            },
            {
                name: '/law_reglamento <@usuario>',
                description: 'Analiza el comportamiento e infracciones de un usuario en una conversación.',
            },
        ];

        const helpEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('📖 Guía de Comandos del Bot')
            .setDescription('Aquí tienes una lista de todos mis comandos disponibles:')
            .setFooter({ text: '¡Usa estos comandos para interactuar conmigo!' })
            .setTimestamp();

        // Itera sobre la lista de información y añade un campo por cada comando
        commandsInfo.forEach(command => {
            helpEmbed.addFields({
                name: `\`${command.name}\``,
                value: command.description,
                inline: false,
            });
        });

        await interaction.editReply({ embeds: [helpEmbed] });
    },
};
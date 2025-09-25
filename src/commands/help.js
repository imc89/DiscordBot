const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, Events } = require('discord.js');

// Lista de comandos organizada por categorías
const commandsInfo = {
    'Generales': {
        description: 'Comandos disponibles para todos los miembros.',
        commands: [
            { name: '🔎 /law_channel <pregunta>', value: 'Te ayudo a encontrar canales relevantes para el tema que busques.' },
            { name: '🖼️ /law_img <@usuario>', value: 'Analizo la foto de perfil de un usuario usando IA.' },
            { name: '👤 /law_data <@usuario>', value: 'Te muestro toda la información pública sobre un usuario.' },
            { name: '🏓 /law_ping', value: 'Mide la latencia del bot con el servidor de Discord.' },
        ],
    },
    'Economia': {
        description: 'Comandos para gestionar y ganar monedas en el servidor.',
        commands: [
            { name: '💰 /law_money balance <@usuario>', value: 'Muestra el balance de monedas de un usuario.' },
            { name: '🎁 /law_money daily', value: 'Reclama tu recompensa diaria de monedas.' },
            { name: '💼 /law_money job', value: 'Realiza un pequeño trabajo para ganar o perder monedas.' },
            { name: '💸 /law_money transfer <@usuario> <cantidad>', value: 'Transfiere monedas a otro usuario.' },
            { name: '🎲 /law_money game <@usuario> <numero> <cantidad>', value: 'Desafía a un usuario a una apuesta de PAR/IMPAR.' },
            { name: '🎰 /law_money slot <cantidad>', value: 'Juega a las tragamonedas para ganar o perder monedas.' },
            { name: '🤫 /law_money rob <@usuario>', value: 'Intenta robarle a otro usuario.' },
            { name: '🏆 /law_money rank', value: 'Muestra el ranking de los usuarios más ricos.' },
        ],
    },
    'Moderacion': {
        description: 'Comandos que solo el staff puede usar para mantener el orden.',
        commands: [
            { name: '📜 /law_reglamento <@usuario>', value: 'Analizo el historial de mensajes de un usuario para ver si ha infringido alguna regla del servidor.' },
            { name: '🔨 /law_ban <@usuario> <razon>', value: 'Banea a un usuario del servidor por una razón específica.' },
            { name: '🧹 /law_clear <cantidad>', value: 'Elimina un número específico de mensajes del canal.' },
            { name: '🔇 /law_mute <@usuario> <tiempo> <razon>', value: 'Silencia a un usuario por un tiempo determinado.' },
        ],
    },
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('law_help')
        .setDescription('Muestra la información de todos los comandos disponibles.'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // Crea las opciones del menú desplegable a partir de las categorías
        const selectOptions = Object.keys(commandsInfo).map(categoryName => {
            return {
                label: categoryName,
                description: commandsInfo[categoryName].description,
                value: categoryName.toLowerCase(), // El valor será la clave en minúsculas
            };
        });

        // Crea el menú desplegable
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_select_menu')
            .setPlaceholder('Selecciona una categoría...')
            .addOptions(selectOptions);

        const actionRow = new ActionRowBuilder().addComponents(selectMenu);

        // Envía el mensaje inicial con el menú
        await interaction.editReply({
            content: 'Selecciona una categoría para ver los comandos disponibles:',
            components: [actionRow],
            ephemeral: true
        });

        // ====================================================================
        // Lógica para manejar la interacción del menú
        // ====================================================================
        const collector = interaction.channel.createMessageComponentCollector({
            filter: i => i.customId === 'help_select_menu' && i.user.id === interaction.user.id,
            time: 60000 // Expira después de 60 segundos
        });

        collector.on('collect', async i => {
            const selectedValue = i.values[0];
            const categoryName = selectedValue.charAt(0).toUpperCase() + selectedValue.slice(1);
            const categoryData = commandsInfo[categoryName];

            if (categoryData) {
                const embed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle(`📖 Comandos de la Categoría: ${categoryName} 📖`)
                    .setDescription(categoryData.description)
                    .setTimestamp();

                categoryData.commands.forEach(cmd => {
                    embed.addFields({
                        name: `**${cmd.name}**`,
                        value: cmd.value,
                        inline: false,
                    });
                });

                embed.setFooter({ text: 'Selecciona otra categoría para ver más comandos.' });

                await i.update({ embeds: [embed] });
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({ content: 'El menú ha expirado. Vuelve a usar el comando.', components: [] }).catch(console.error);
            }
        });
    },
};
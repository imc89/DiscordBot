const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('law_help')
        .setDescription('Muestra la información de todos los comandos disponibles.'),
    
    async execute(interaction) {
        await interaction.deferReply();

        // Lista de comandos organizada para una mejor visualización
        const commandsInfo = [
            {
                name: '⚙️ Comandos Generales',
                value: 'Estos comandos están disponibles para todos los miembros.',
                commands: [
                    { name: '🔎 /law_channel <pregunta>', value: 'Te ayudo a encontrar canales relevantes para el tema que busques.' },
                    { name: '🖼️ /law_img <@usuario>', value: 'Analizo la foto de perfil de un usuario usando IA.' },
                    { name: '👤 /law_data <@usuario>', value: 'Te muestro toda la información pública sobre un usuario.' },
                    { name: '🏓 /law_ping', value: 'Mide la latencia del bot con el servidor de Discord.' },
                ],
            },
            {
                name: '💰 Comandos de Economía',
                value: 'Comandos para gestionar y ganar monedas en el servidor.',
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
            {
                name: '🔨 Comandos de Moderación',
                value: 'Comandos que solo el staff puede usar para mantener el orden.',
                commands: [
                    { name: '📜 /law_reglamento <@usuario>', value: 'Analizo el historial de mensajes de un usuario para ver si ha infringido alguna regla del servidor.' },
                    { name: '🔨 /law_ban <@usuario> <razon>', value: 'Banea a un usuario del servidor por una razón específica.' },
                    { name: '🧹 /law_clear <cantidad>', value: 'Elimina un número específico de mensajes del canal.' },
                    { name: '🔇 /law_mute <@usuario> <tiempo> <razon>', value: 'Silencia a un usuario por un tiempo determinado.' },
                ],
            },
        ];

        const helpEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('📖 BOT LAWLIET: Manual de Comandos 📖')
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .setDescription('Aquí te presento las herramientas que uso para mantener el orden. Usa mis comandos con responsabilidad.')
            .setTimestamp();
            
        // Itera sobre las categorías y agrega los campos
        commandsInfo.forEach(category => {
            const fieldTitle = category.name;
            const fieldDescription = category.value;
            const commandList = category.commands.map(cmd => `**${cmd.name}**\n> ${cmd.value}`).join('\n\n');

            helpEmbed.addFields({
                name: fieldTitle,
                value: `${fieldDescription}\n\n${commandList}`,
                inline: false,
            });
        });

        helpEmbed.setFooter({ text: 'Los detalles son importantes. Si necesitas ayuda con algo, simplemente pregunta al staff.' });

        await interaction.editReply({ embeds: [helpEmbed] });
    },
};
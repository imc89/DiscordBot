const { Events } = require('discord.js');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../command_usage.json');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;

        // --- SOLUCIÓN: DIFERIR LA RESPUESTA INMEDIATAMENTE ANTES DE CUALQUIER OTRA COSA
        try {
            await interaction.deferReply();
        } catch (error) {
            console.error('Error al diferir la respuesta. La interacción podría haber expirado:', error);
            return;
        }

        // --- LÓGICA DE REGISTRO
        let usageData = {};
        try {
            if (fs.existsSync(LOG_FILE)) {
                usageData = JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));
            } else {
                fs.writeFileSync(LOG_FILE, '{}', 'utf-8');
            }
        } catch (error) {
            console.error('Error al leer/crear el archivo de registro:', error);
        }

        const userId = interaction.user.id;
        const userData = {
            id: interaction.user.id,
            username: interaction.user.username,
            displayName: interaction.member.displayName,
            bot: interaction.user.bot,
            roles: interaction.member.roles.cache.map(role => role.name),
            joinedAt: interaction.member.joinedTimestamp,
        };
        const commandName = interaction.commandName;

        if (!usageData[userId]) {
            usageData[userId] = { ...userData, totalUses: 1, commands: {} };
        } else {
            usageData[userId] = { ...usageData[userId], ...userData, totalUses: (usageData[userId].totalUses || 0) + 1 };
        }
        usageData[userId].commands[commandName] = (usageData[userId].commands[commandName] || 0) + 1;
        
        try {
            fs.writeFileSync(LOG_FILE, JSON.stringify(usageData, null, 4), 'utf-8');
            console.log('JSON de uso de comandos actualizado:', JSON.stringify(usageData, null, 4));
        } catch (error) {
            console.error('Error al escribir en el archivo de registro:', error);
        }

        // --- EJECUCIÓN DEL COMANDO
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) {
            return await interaction.editReply('Comando no encontrado.');
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`Error al ejecutar el comando ${interaction.commandName}:`, error);
            await interaction.editReply({ content: 'Hubo un error al ejecutar este comando.', ephemeral: true });
        }
    },
};
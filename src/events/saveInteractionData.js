const { Events } = require('discord.js');
const fs = require('fs/promises'); // Usar la versión asincrónica
const path = require('path');

const LOG_FILE = path.join(__dirname, '../command_usage.json');

// Función asincrónica para la lógica de registro
async function logCommandUsage(interaction) {
    let usageData = {};
    try {
        if (fs.existsSync(LOG_FILE)) {
            const fileContent = await fs.readFile(LOG_FILE, 'utf-8');
            usageData = JSON.parse(fileContent);
        } else {
            console.log('⚠️ Archivo de registro no encontrado. Creando uno nuevo...');
            await fs.writeFile(LOG_FILE, '{}', 'utf-8');
            console.log('✅ Archivo de registro "command_usage.json" creado con éxito.');
        }
    } catch (error) {
        console.error('❌ Error al leer o crear el archivo de registro:', error);
        return; // Detener si hay un error con el archivo
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
        await fs.writeFile(LOG_FILE, JSON.stringify(usageData, null, 4), 'utf-8');
        console.log('JSON de uso de comandos actualizado:', JSON.stringify(usageData, null, 4));
    } catch (error) {
        console.error('❌ Error al escribir en el archivo de registro:', error);
    }
}

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;

        // La deferencia es ahora la primera y única cosa sincrónica
        try {
            await interaction.deferReply();
        } catch (error) {
            console.error('Error al diferir la respuesta. La interacción podría haber expirado:', error);
            return;
        }

        // Ejecutar la lógica de registro en segundo plano. Esto no bloquea
        logCommandUsage(interaction);
        
        // Ejecución del comando
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
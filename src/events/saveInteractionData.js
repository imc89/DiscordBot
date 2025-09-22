const { Events } = require('discord.js');
const fs = require('fs');
const path = require('path');

// La ruta al archivo de registro
const LOG_FILE = path.join(__dirname, '../command_usage.json');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Solo procesar comandos de barra inclinada
        if (!interaction.isChatInputCommand()) return;

        // 1. Recopilar datos del usuario y del comando
        const userData = {
            id: interaction.user.id,
            username: interaction.user.username,
            displayName: interaction.member.displayName,
            bot: interaction.user.bot,
            roles: interaction.member.roles.cache.map(role => role.name),
            joinedAt: interaction.member.joinedTimestamp,
        };
        const commandName = interaction.commandName;

        let usageData = {};
        try {
            // 2. Leer o crear el archivo de registro
            if (fs.existsSync(LOG_FILE)) {
                const fileContent = fs.readFileSync(LOG_FILE, 'utf-8');
                usageData = JSON.parse(fileContent);
            } else {
                console.log('⚠️ Archivo de registro no encontrado. Creando uno nuevo...');
                fs.writeFileSync(LOG_FILE, '{}', 'utf-8');
                console.log('✅ Archivo de registro "command_usage.json" creado con éxito.');
            }
        } catch (error) {
            console.error('❌ Error al leer o crear el archivo de registro:', error);
            return; // Detiene la ejecución para evitar fallos
        }

        // 3. Actualizar los datos
        const userId = userData.id;
        if (!usageData[userId]) {
            usageData[userId] = {
                ...userData,
                totalUses: 1,
                commands: {}
            };
        } else {
            usageData[userId] = {
                ...usageData[userId],
                ...userData,
                totalUses: (usageData[userId].totalUses || 0) + 1
            };
        }

        if (!usageData[userId].commands[commandName]) {
            usageData[userId].commands[commandName] = 1;
        } else {
            usageData[userId].commands[commandName]++;
        }

        try {
            // 4. Escribir los datos actualizados
            fs.writeFileSync(LOG_FILE, JSON.stringify(usageData, null, 4), 'utf-8');
        } catch (error) {
            console.error('❌ Error al escribir en el archivo de registro:', error);
        }

        // Continúa con la ejecución del comando. Esto es muy importante.
        // Aquí debe seguir la lógica para encontrar y ejecutar el comando solicitado.
        const command = interaction.client.commands.get(interaction.commandName);
        if (command) {
            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`Error al ejecutar el comando ${interaction.commandName}:`, error);
                await interaction.reply({ content: 'Hubo un error al ejecutar este comando.', ephemeral: true });
            }
        }
    },
};
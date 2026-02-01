// index.js (Modified)
// Importa las librerías necesarias de Node.js.
require("dotenv").config();
const { Client, GatewayIntentBits, Collection, Events } = require("discord.js"); // Add "Events" here
const path = require('path');
const fs = require('fs');
const express = require('express');

// Import the command directly
const lawMoneyCommand = require('./src/commands/money.js');
const lawBuyCommand = require('./src/commands/buy.js'); // **<-- ESTO ES LO QUE FALTA**

// ========================
// Bot Configuration
// ========================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

// ========================
// Collections
// ========================
client.commands = new Collection();
client.cooldowns = new Collection();

// ========================
// Load Commands
// ========================
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// ========================
// Add the InteractionCreate event listener here
// ========================
client.on(Events.InteractionCreate, async interaction => {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        }
    }

    // ADDED: Handle button interactions
    if (interaction.isButton()) {
        const customId = interaction.customId;

        // 1. Botones de los comandos 'money' y 'buy'
        if (customId.startsWith('game_') || customId.startsWith('buy_')) {
            // Asume que lawMoneyCommand tiene el manejo de botones (como en tu ejemplo)
            try {
                await lawMoneyCommand.handleButtonInteraction(interaction);
            } catch (error) {
                console.error("Error al manejar el botón de lawMoney:", error);
                // Responde a la interacción para evitar el mensaje de error de Discord
                if (!interaction.deferred && !interaction.replied) {
                    await interaction.reply({ content: '❌ Error al procesar este botón.', ephemeral: true }).catch(() => { });
                }
            }
            return;
        }

        // 2. Botones del comando 'law_chess' (Aceptar/Rechazar)
        if (customId === 'law_chest_accept' || customId === 'law_chest_decline') {

            // **IMPORTANTE:** La lógica de estos botones se maneja internamente
            // mediante un Collector dentro del comando /law_chess.
            // Simplemente necesitamos asegurar que el bot no se cuelgue si el collector ya caducó.

            // Si la interacción llega aquí, el collector ya no está escuchando
            // o ya se respondió. Respondemos discretamente si aún no se ha hecho.
            if (!interaction.deferred && !interaction.replied) {
                await interaction.reply({ content: 'Esta partida ya ha sido gestionada o caducó.', ephemeral: true }).catch(() => { });
            }
            return;
        }
    }

    // --- Manejo de Interacciones con Select Menus ---
    if (interaction.isStringSelectMenu()) {
        // Verifica si el customId corresponde a la lógica de law_buy (compra o regalo)
        if (interaction.customId === 'buy_drink_select' || interaction.customId.startsWith('gift_select_')) {
            try {
                // Llama a la función que maneja el select menu en law_buy.js
                await lawBuyCommand.handleSelectMenuInteraction(interaction);
            } catch (error) {
                console.error("Error al manejar el Select Menu de law_buy:", error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '❌ Hubo un error al procesar esta selección.', ephemeral: true });
                } else {
                    await interaction.followUp({ content: '❌ Hubo un error al procesar esta selección.', ephemeral: true });
                }
            }
        }
    }
});

// ========================
// Load Events (now only loads other events)
// ========================
const eventsPath = path.join(__dirname, 'src', 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js') && file !== 'interactionCreate.js'); // Exclude interactionCreate

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

// ========================
// Web Server for Render
// ========================
const app = express();
const port = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.send('Bot is running and healthy!');
});

app.listen(port, () => {
    console.log(`Web server is listening on port ${port}`);
});

// ========================
// Self-Ping to prevent sleep
// ========================
const keepAliveUrl = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`;

if (keepAliveUrl) {
    setInterval(() => {
        fetch(keepAliveUrl)
            .then(res => {
                console.log(`Ping ${keepAliveUrl} exitoso, estado de respuesta: ${res.status}`);
            })
            .catch(err => {
                console.error(`Ping fallido: ${err.message}`);
            });
    }, 12 * 60 * 1000); // 12 minutes in milliseconds
}

// ========================
// Login
// ========================
client.login(process.env.DISCORD_TOKEN);
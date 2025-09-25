// index.js (Modified)
// Importa las librerías necesarias de Node.js.
require("dotenv").config();
const { Client, GatewayIntentBits, Collection, Events } = require("discord.js"); // Add "Events" here
const path = require('path');
const fs = require('fs');
const express = require('express');

// Import the command directly
const lawMoneyCommand = require('./src/commands/money.js');

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
        if (interaction.customId.startsWith('game_')) {
            try {
                await lawMoneyCommand.handleButtonInteraction(interaction);
            } catch (error) {
                console.error(error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'There was an error processing this button action.', ephemeral: true });
                } else {
                    await interaction.followUp({ content: 'There was an error processing this button action.', ephemeral: true });
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
const port = process.env.PORT || 3000;

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
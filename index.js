// index.js (with Self-Ping Loop for Render)

// Importa las librerías necesarias de Node.js.
require("dotenv").config();
const { Client, GatewayIntentBits, Collection } = require("discord.js");
const path = require('path');
const fs = require('fs');
const express = require('express');

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
// Load Events
// ========================
const eventsPath = path.join(__dirname, 'src', 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

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
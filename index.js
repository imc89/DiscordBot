// ========================
// 1. IMPORTACIÓN DE LIBRERÍAS
// ========================
require("dotenv").config();
const { Client, GatewayIntentBits, Collection, Events } = require("discord.js");
const path = require('path');
const fs = require('fs');
const express = require('express'); // IMPORTANTE: Importar antes de usar

// ========================
// 2. INICIALIZACIÓN DE EXPRESS (Para Render)
// ========================
const app = express();
const port = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.send('Bot is running and healthy!');
});

app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Servidor Web escuchando en puerto ${port}`);
});

// ========================
// 3. CONFIGURACIÓN DEL BOT
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

// Carga de comandos manual (los que importaste directamente)
const lawMoneyCommand = require('./src/commands/money.js');
const lawBuyCommand = require('./src/commands/buy.js');

client.commands = new Collection();
client.cooldowns = new Collection();

// ========================
// 4. CARGA DINÁMICA DE COMANDOS
// ========================
const commandsPath = path.join(__dirname, 'src', 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.warn(`[WARNING] El comando en ${filePath} no tiene las propiedades "data" o "execute".`);
        }
    }
}

// ========================
// 5. MANEJO DE INTERACCIONES
// ========================
client.on(Events.InteractionCreate, async interaction => {
    // Comandos de Barra (Slash Commands)
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            const msg = { content: 'Hubo un error al ejecutar el comando.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
            else await interaction.reply(msg);
        }
    }

    // Botones
    if (interaction.isButton()) {
        const { customId } = interaction;
        if (customId.startsWith('game_') || customId.startsWith('buy_')) {
            try {
                await lawMoneyCommand.handleButtonInteraction(interaction);
            } catch (error) {
                console.error("Error en botón:", error);
            }
        }
    }

    // Select Menus
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'buy_drink_select' || interaction.customId.startsWith('gift_select_')) {
            try {
                await lawBuyCommand.handleSelectMenuInteraction(interaction);
            } catch (error) {
                console.error("Error en Select Menu:", error);
            }
        }
    }
});

// ========================
// 6. CARGA DE EVENTOS
// ========================
const eventsPath = path.join(__dirname, 'src', 'events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js') && file !== 'interactionCreate.js');
    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
    }
}

// ========================
// 7. LOGIN Y AUTO-PING
// ========================
// ========================
// 7. LOGIN (MOVIDO ARRIBA PARA TEST)
// ========================
const TOKEN = process.env.DISCORD_TOKEN;

console.log("DEBUG: Iniciando proceso de conexión...");

if (!TOKEN) {
    console.error("❌ ERROR: No se encontró DISCORD_TOKEN en Render.");
} else {
    console.log("DEBUG: Token detectado, llamando a client.login()...");
    // Intenta conectar PRIMERO
    client.login(process.env.DISCORD_TOKEN).then(() => {
        console.log("✅ Discord conectado");
        // Solo cuando el bot esté listo, arranca el servidor web
        app.listen(port, '0.0.0.0', () => {
            console.log(`✅ Servidor Web en puerto ${port}`);
        });
    }).catch(err => {
        console.error("❌ Fallo de login:", err);
        // Arranca el server aunque falle el bot para que Render no de error de puerto
        app.listen(port, '0.0.0.0', () => { });
    });
}

// Auto-ping para que Render no duerma el bot
if (process.env.RENDER_EXTERNAL_HOSTNAME) {
    const url = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`;
    setInterval(() => {
        fetch(url).then(res => console.log(`Self-ping OK: ${res.status}`)).catch(() => { });
    }, 13 * 60 * 1000); // Cada 13 min
}
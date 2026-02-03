// index.js (Actualizado con contador de usuarios reales)
require("dotenv").config();
const { Client, GatewayIntentBits, Collection, Events } = require("discord.js");
const path = require('path');
const fs = require('fs');
const express = require('express');
const { MongoClient } = require("mongodb"); // Importamos MongoClient para la sincronización

// ========================
// Bot Configuration
// ========================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, // Requerido para ver la lista de miembros
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

// Configuración de MongoDB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_CLUSTER}/?retryWrites=true&w=majority&appName=Cluster0`;
const dbClient = new MongoClient(uri);

// ========================
// Función: Sincronizar Contador de Usuarios (Sin Bots)
// ========================
async function syncMemberCount(guild) {
    if (!guild) return;
    try {
        // 1. Buscamos a todos los miembros para tener datos frescos
        // Nota: Asegúrate de tener 'GUILD_PRESENCES' y 'GUILD_MEMBERS' intents activados en tu bot
        const members = await guild.members.fetch({ withPresences: true });

        // 2. Desglosamos las estadísticas
        const totalMembers = members.size;
        const botCount = members.filter(m => m.user.bot).size;
        const humanCount = totalMembers - botCount;

        // Usuarios conectados (Online, Idle, DND) - Excluyendo Offline
        const onlineHumans = members.filter(m =>
            !m.user.bot &&
            m.presence &&
            m.presence.status !== 'offline'
        ).size;

        const db = dbClient.db("psicosofiaDB");
        const collection_generalData = db.collection("psicosofia");

        // 3. Guardamos un objeto más robusto
        await collection_generalData.updateOne(
            { type: "server_stats" },
            {
                $set: {
                    serverName: guild.name,
                    totalMembers: totalMembers,
                    totalHumans: humanCount,
                    totalBots: botCount,
                    onlineHumans: onlineHumans,
                    boostLevel: guild.premiumTier,
                    boostCount: guild.premiumSubscriptionCount,
                    lastUpdate: new Date()
                }
            },
            { upsert: true }
        );

        console.log(`[DATABASE] Stats sincronizadas para ${guild.name}: ${humanCount} humanos (${onlineHumans} online) y ${botCount} bots.`);
    } catch (error) {
        console.error("Error al sincronizar el contador:", error);
    }
}

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
// Event Listeners para el Contador
// ========================

client.once(Events.ClientReady, async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    await dbClient.connect();

    // Sincronización inicial al encender el bot
    const mainGuild = client.guilds.cache.first();
    if (mainGuild) await syncMemberCount(mainGuild);
});

// Actualizar cuando alguien entra
client.on(Events.GuildMemberAdd, async (member) => {
    await syncMemberCount(member.guild);
});

// Actualizar cuando alguien sale
client.on(Events.GuildMemberRemove, async (member) => {
    await syncMemberCount(member.guild);
});

// ========================
// Interaction Handling
// ========================
client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            const errorMsg = { content: 'There was an error while executing this command!', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMsg);
            } else {
                await interaction.reply(errorMsg);
            }
        }
    }

    if (interaction.isButton()) {
        const customId = interaction.customId;
        if (customId === 'law_chest_accept' || customId === 'law_chest_decline') {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.reply({ content: 'Esta partida ya ha sido gestionada o caducó.', ephemeral: true }).catch(() => { });
            }
            return;
        }
    }
});

// ========================
// Load Other Events
// ========================
const eventsPath = path.join(__dirname, 'src', 'events');
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

// ========================
// Web Server & Keep Alive
// ========================
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is running and healthy!'));
app.listen(port, () => console.log(`Web server listening on port ${port}`));

const keepAliveUrl = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`;
if (keepAliveUrl) {
    setInterval(() => {
        fetch(keepAliveUrl)
            .then(res => console.log(`Ping exitoso: ${res.status}`))
            .catch(err => console.error(`Ping fallido: ${err.message}`));
    }, 12 * 60 * 1000);
}

client.login(process.env.DISCORD_TOKEN);
// index.js (Contador REAL de usuarios + presencias + intervalo)
require("dotenv").config();
const { Client, GatewayIntentBits, Collection, Events } = require("discord.js");
const path = require("path");
const fs = require("fs");
const express = require("express");
const { MongoClient } = require("mongodb");

// ========================
// Bot Configuration
// ========================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildPresences
    ]
});

// ========================
// MongoDB Configuration
// ========================
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_CLUSTER}/?retryWrites=true&w=majority&appName=Cluster0`;
const dbClient = new MongoClient(uri);

// ========================
// Función: Sincronizar Contador (SIN bots)
// ========================
async function syncMemberCount(guild) {
    if (!guild) return;

    try {
        const members = await guild.members.fetch({
            withPresences: true,
            force: true
        });

        const totalMembers = members.size;
        const botCount = members.filter(m => m.user.bot).size;
        const humanCount = totalMembers - botCount;

        const onlineHumans = members.filter(m =>
            !m.user.bot &&
            m.presence &&
            m.presence.status !== "offline"
        ).size;

        console.log(`[SYNC] ${guild.name} → Humanos: ${humanCount} | Online: ${onlineHumans}`);

        const db = dbClient.db("psicosofiaDB");
        await db.collection("psicosofia").updateOne(
            { type: "server_stats" },
            {
                $set: {
                    serverName: guild.name,
                    totalHumans: humanCount,
                    totalBots: botCount,
                    onlineHumans,
                    boostLevel: guild.premiumTier,
                    boostNumber: guild.premiumSubscriptionCount,
                    lastUpdate: new Date()
                }
            },
            { upsert: true }
        );

    } catch (error) {
        console.error("[ERROR] syncMemberCount:", error);
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
const commandsPath = path.join(__dirname, "src", "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if ("data" in command && "execute" in command) {
        client.commands.set(command.data.name, command);
    }
}

// ========================
// Client Ready
// ========================
client.once(Events.ClientReady, async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    await dbClient.connect();

    const guild = client.guilds.cache.first();
    if (guild) await syncMemberCount(guild);
});

// ========================
// Eventos de miembros
// ========================
client.on(Events.GuildMemberAdd, async member => {
    await syncMemberCount(member.guild);
});

client.on(Events.GuildMemberRemove, async member => {
    await syncMemberCount(member.guild);
});

// ========================
// Evento: Cambio de estado (PRESENCE)
// ========================
client.on(Events.PresenceUpdate, async (oldPresence, newPresence) => {
    const guild = newPresence?.guild || oldPresence?.guild;
    if (!guild) return;

    const user = newPresence?.user || oldPresence?.user;
    if (!user || user.bot) return;

    const oldStatus = oldPresence?.status ?? "offline";
    const newStatus = newPresence?.status ?? "offline";

    if (oldStatus === newStatus) return;

    console.log(`[PRESENCE] ${user.username}: ${oldStatus} → ${newStatus}`);
    await syncMemberCount(guild);
});

// ========================
// Intervalo cada 5 minutos
// ========================
setInterval(async () => {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return;

        console.log("[INTERVAL] Sync automático (5 min)");
        await syncMemberCount(guild);
    } catch (err) {
        console.error("[INTERVAL] Error:", err);
    }
}, 5 * 60 * 1000);

// ========================
// Interaction Handling
// ========================
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        const msg = { content: "Error ejecutando el comando", ephemeral: true };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(msg);
        } else {
            await interaction.reply(msg);
        }
    }
});

// ========================
// Load Other Events
// ========================
const eventsPath = path.join(__dirname, "src", "events");
const eventFiles = fs.readdirSync(eventsPath).filter(
    f => f.endsWith(".js") && f !== "interactionCreate.js"
);

for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));
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

app.get("/", (_, res) => res.send("Bot is running and healthy!"));
app.listen(port, () => console.log(`🌐 Web server on port ${port}`));

const KEEP_ALIVE_URL = "https://psicosofia.onrender.com";

setInterval(async () => {
    try {
        const res = await fetch(KEEP_ALIVE_URL);
        console.log(`[KEEP ALIVE] ${res.status}`);
    } catch (err) {
        console.error("[KEEP ALIVE] Error:", err.message);
    }
}, 12 * 60 * 1000);

// ========================
// Login
// ========================
client.login(process.env.DISCORD_TOKEN);

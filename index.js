// index.js (Contador REAL de usuarios + presencias + fallback)
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
// Función: Sincronizar Contador
// ========================
async function syncMemberCount(guild) {
    if (!guild) return;

    try {
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Fetch timeout")), 30000)
        );

        const members = await Promise.race([
            guild.members.fetch({
                withPresences: true,
                force: true,
                time: 30000
            }),
            timeoutPromise
        ]);

        const totalMembers = members.size;
        const botCount = members.filter(m => m.user.bot).size;
        const humanCount = totalMembers - botCount;

        const onlineHumans = members.filter(m =>
            !m.user.bot &&
            m.presence &&
            m.presence.status !== "offline"
        ).size;

        const db = dbClient.db("psicosofiaDB");
        await db.collection("psicosofia").updateOne(
            { type: "server_stats" },
            {
                $set: {
                    serverName: guild.name,
                    totalHumans: humanCount,
                    totalBots: botCount,
                    onlineHumans: onlineHumans,
                    boostLevel: guild.premiumTier,
                    boostNumber: guild.premiumSubscriptionCount,
                    lastUpdate: new Date()
                }
            },
            { upsert: true }
        );

        console.log(`[SYNC] ✅ ${humanCount} humans, ${onlineHumans} online`);

    } catch (error) {
        if (error.message === "Fetch timeout") {
            console.warn("[WARN] syncMemberCount timeout — usando cache");

            try {
                const members = await guild.members.fetch({ force: false });

                const totalMembers = members.size;
                const botCount = members.filter(m => m.user.bot).size;
                const humanCount = totalMembers - botCount;

                // 🔥 ONLINE DESDE CACHE (única forma posible)
                const onlineHumans = guild.members.cache.filter(m =>
                    !m.user.bot &&
                    m.presence &&
                    m.presence.status !== "offline"
                ).size;

                const db = dbClient.db("psicosofiaDB");
                await db.collection("psicosofia").updateOne(
                    { type: "server_stats" },
                    {
                        $set: {
                            serverName: guild.name,
                            totalHumans: humanCount,
                            totalBots: botCount,
                            onlineHumans: onlineHumans,
                            boostLevel: guild.premiumTier,
                            boostNumber: guild.premiumSubscriptionCount,
                            lastUpdate: new Date()
                        }
                    },
                    { upsert: true }
                );

                console.log(
                    `[SYNC] ⚠️ Fallback cache: ${humanCount} humans, ${onlineHumans} online`
                );

            } catch (fallbackError) {
                console.error("[ERROR] syncMemberCount fallback:", fallbackError);
            }
        } else {
            console.error("[ERROR] syncMemberCount:", error);
        }
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
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));
    for (const file of commandFiles) {
        const command = require(path.join(commandsPath, file));
        if ("data" in command && "execute" in command) {
            client.commands.set(command.data.name, command);
        }
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
client.on(Events.GuildMemberAdd, member => syncMemberCount(member.guild));
client.on(Events.GuildMemberRemove, member => syncMemberCount(member.guild));

// ========================
// Evento: Presencias
// ========================
client.on(Events.PresenceUpdate, async (oldPresence, newPresence) => {
    const guild = newPresence?.guild || oldPresence?.guild;
    if (!guild) return;

    const user = newPresence?.user || oldPresence?.user;
    if (!user || user.bot) return;

    const oldStatus = oldPresence?.status ?? "offline";
    const newStatus = newPresence?.status ?? "offline";
    if (oldStatus === newStatus) return;

    await syncMemberCount(guild);
});

// ========================
// Intervalo cada 5 minutos
// ========================
setInterval(async () => {
    const guild = client.guilds.cache.first();
    if (!guild) return;

    console.log("[INTERVAL] Sync automático");
    await syncMemberCount(guild);
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
        interaction.replied || interaction.deferred
            ? interaction.followUp(msg)
            : interaction.reply(msg);
    }
});

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

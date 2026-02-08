// index.js (Contador REAL de usuarios + presencias + fallback seguro)
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
// Función: Sincronizar Contador (ROBUSTA)
// ========================
async function syncMemberCount(guild, forceFetch = false) {
    if (!guild) return;

    try {
        let humanCount, botCount, onlineHumans;
        let method = "CACHE";

        if (forceFetch) {
            try {
                // Intento REAL: fetch completo con presencias
                const members = await guild.members.fetch({
                    withPresences: true,
                    force: true,
                    time: 30000
                });

                const totalMembers = members.size;
                botCount = members.filter(m => m.user.bot).size;
                humanCount = totalMembers - botCount;

                onlineHumans = members.filter(m =>
                    !m.user.bot &&
                    m.presence &&
                    m.presence.status !== "offline"
                ).size;
                method = "FULL";
            } catch (error) {
                if (error.code === "GuildMembersTimeout") {
                    console.warn("[WARN] syncMemberCount timeout — cayendo a cache");
                    // Fallback a lógica de cache abajo
                } else {
                    throw error;
                }
            }
        }

        // Si no es forceFetch O si falló el fetch (fallback)
        if (method === "CACHE") {
            const totalMembers = guild.memberCount;
            botCount = guild.members.cache.filter(m => m.user.bot).size;
            humanCount = totalMembers - botCount;

            onlineHumans = guild.members.cache.filter(m =>
                !m.user.bot &&
                m.presence &&
                m.presence.status !== "offline"
            ).size;
        }

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
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));
    console.log(`[INIT] Cargando ${commandFiles.length} comandos...`);
    for (const file of commandFiles) {
        try {
            const command = require(path.join(commandsPath, file));
            if ("data" in command && "execute" in command) {
                client.commands.set(command.data.name, command);
                console.log(`[INIT] ✅ Comando cargado: ${command.data.name}`);
            } else {
                console.warn(`[INIT] ⚠️ El comando en ${file} no tiene "data" o "execute".`);
            }
        } catch (err) {
            console.error(`[INIT] ❌ Error cargando comando ${file}:`, err.message);
        }
    }
} else {
    console.error(`[INIT] ❌ No se encontró la carpeta de comandos: ${commandsPath}`);
}

// ========================
// Client Ready
// ========================
client.once(Events.ClientReady, async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    try {
        await dbClient.connect();
        console.log("✅ Conectado a MongoDB");
    } catch (err) {
        console.error("❌ Error conectando a MongoDB:", err.message);
    }

    const guild = client.guilds.cache.first();
    if (guild) {
        await syncMemberCount(guild, true).catch(err => console.error("❌ Error en sync inicial:", err.message));
    }
});

// ========================
// Eventos de miembros
// ========================
client.on(Events.GuildMemberAdd, member => syncMemberCount(member.guild, true));
client.on(Events.GuildMemberRemove, member => syncMemberCount(member.guild, true));

// ========================
// Evento: Presencias
// ========================
client.on(Events.PresenceUpdate, async (oldPresence, newPresence) => {
    const guild = newPresence?.guild || oldPresence?.guild;
    if (!guild) return;

    const user = newPresence?.user || oldPresence?.user;
    if (!user || user.bot) return;

    if ((oldPresence?.status ?? "offline") === (newPresence?.status ?? "offline")) {
        return;
    }

    await syncMemberCount(guild, false).catch(err => console.error("❌ Error en PresenceUpdate sync:", err.message));
});

// ========================
// Intervalo cada 5 minutos
// ========================
setInterval(async () => {
    const guild = client.guilds.cache.first();
    if (!guild) return;

    console.log("[INTERVAL] Sync automático");
    await syncMemberCount(guild, true);
}, 5 * 60 * 1000);

// ========================
// Interaction Handling
// ========================
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    console.log(`[INTERACTION] Recibido: /${interaction.commandName} de ${interaction.user.tag}`);

    const command = client.commands.get(interaction.commandName);
    if (!command) {
        console.warn(`[INTERACTION] ⚠️ Comando no encontrado: ${interaction.commandName}`);
        return;
    }

    try {
        await command.execute(interaction);
        console.log(`[INTERACTION] ✅ Ejecutado: /${interaction.commandName}`);
    } catch (error) {
        console.error(`[INTERACTION] ❌ Error en /${interaction.commandName}:`, error);
        const msg = { content: "Error ejecutando el comando", ephemeral: true };
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(msg);
            } else {
                await interaction.reply(msg);
            }
        } catch (replyError) {
            console.error("[INTERACTION] ❌ Error al enviar mensaje de error:", replyError.message);
        }
    }
});

// ========================
// Web Server & Keep Alive
// ========================
const app = express();
const port = process.env.PORT || 3000;

app.get("/", (_, res) => res.send("Bot is running and healthy!"));
app.listen(port, () => console.log(`🌐 Web server on port ${port}`));

// Keep Alive
// -----------------------
const keepAliveUrl = "https://psicosofia.onrender.com";

if (keepAliveUrl) {
    console.log(`[KEEP ALIVE] Iniciando ping a ${keepAliveUrl}`);
    setInterval(() => {
        fetch(keepAliveUrl)
            .then(res => console.log(`[KEEP ALIVE] Ping a ${keepAliveUrl}: ${res.status}`))
            .catch(err => console.error(`[KEEP ALIVE] Error en ${keepAliveUrl}: ${err.message}`));
    }, 12 * 60 * 1000); // 12 minutos
}

// ========================
// Login
// ========================
client.login(process.env.DISCORD_TOKEN);

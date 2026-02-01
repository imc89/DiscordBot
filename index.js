// ========================
// Web Server for Render
// ========================
const app = express();
const port = process.env.PORT || 10000; // Render prefiere el 10000

app.get('/', (req, res) => {
    res.send('Bot is running and healthy!');
});

app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Servidor Web listo en puerto ${port}`);
});

// ========================
// Login con Captura de Errores
// ========================
const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
    console.error("❌ ERROR: La variable DISCORD_TOKEN no está definida en el Environment de Render.");
} else {
    console.log("Attempting to login to Discord...");
    client.login(TOKEN)
        .then(() => {
            console.log(`✅ ¡ÉXITO! Bot conectado como ${client.user.tag}`);
        })
        .catch(err => {
            console.error("❌ ERROR DE LOGIN EN DISCORD:");
            console.error(err); // Esto te dirá si es el Token, los Intents o la Red
        });
}

// El Self-Ping muévelo al final y envuélvelo en un try/catch para que no rompa el bot
if (process.env.RENDER_EXTERNAL_HOSTNAME) {
    const url = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`;
    setInterval(() => {
        fetch(url).then(res => console.log(`Ping OK: ${res.status}`)).catch(() => { });
    }, 12 * 60 * 1000);
}
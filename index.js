require("dotenv").config();
const { 
  Client, 
  GatewayIntentBits, 
  SlashCommandBuilder, 
  EmbedBuilder, 
  Events 
} = require("discord.js");

const { GoogleGenerativeAI } = require("@google/generative-ai");

// ========================
// Configuración de Discord
// ========================
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ========================
// Configuración de Gemini
// ========================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// ========================
// Diccionario de categorías
// ========================
const categorias = {
  "📌 Importante": {
    descripcion: "Canales esenciales para el servidor.",
    canales: [
      "👋║bienvenidas",
      "❗║información",
      "📜║reglas",
      "🔔║anuncios",
      "🚀║boost",
      "🤝║nuestros-servidores",
      "🎟️║tickets"
    ]
  },
  "🙋 Introducción": {
    descripcion: "Preséntate, sube de nivel y participa en sugerencias.",
    canales: [
      "😁║presentaciones",
      "🤖║niveles",
      "🔝║bump",
      "🚬║don-freud",
      "📮║sugerencias"
    ]
  },
  "🏛️ Clubes": {
    descripcion: "Clubs y actividades especiales.",
    canales: [
      "🤔║debates",
      "⚪⚫║club-go",
      "♛║club-ajedrez",
      "♞║ajedrez-recursos",
      "🌹║poesía",
      "🥀║tus-poemas"
    ]
  },
  "🎤 Voz": {
    descripcion: "Salas de voz y convivencia.",
    canales: [
      "🍿┇cine",
      "🎶║música",
      "🧠║Brain Meet",
      "😌║Chill",
      "⚖️║Ágora de Debate"
    ]
  },
  "🎲 Miscelánea": {
    descripcion: "Variedad de canales con diferentes temáticas.",
    canales: [
      "🤖║comandos",
      "🎵║música",
      "📸║imágenes",
      "🎥║videoteca"
    ]
  },
  "📚 General y Ciencias": {
    descripcion: "Discusión sobre psicología, filosofía y ciencias.",
    canales: [
      "🧠║general-psicología",
      "🗿║general-filosofía",
      "⏱️║blitz-debate",
      "💭║general",
      "🌿║ciencias-naturales",
      "📰║ciencias-sociales",
      "🔬║ciencias-aplicadas"
    ]
  },
  "📖 Letras": {
    descripcion: "Zona literaria y de reflexión.",
    canales: [
      "📖║literatura",
      "📄║citas-célebres",
      "📓║reflexiones-desahogo",
      "✍║tus-escritos",
      "🪷║hobbies-anécdotas",
      "✅║libros-recomendados"
    ]
  },
  "🧩 Psicología": {
    descripcion: "Canales dedicados a la psicología.",
    canales: [
      "📃║psicología",
      "📘║psicología-libros",
      "📊║tests",
      "💯║resultados",
      "🌄║salud-mental",
      "🎭║traumas-trastornos",
      "🔪║criminología"
    ]
  },
  "🏺 Filosofía": {
    descripcion: "Espacios filosóficos para el pensamiento crítico.",
    canales: [
      "🗿║filosofía",
      "📕║filosofía-libros",
      "🔨║antropología",
      "⌛║ética-moral",
      "🍃║metafísica",
      "🧮║epistemología-lógica"
    ]
  },
  "🔎 Conocimiento": {
    descripcion: "Aprendizaje y exploración del conocimiento.",
    canales: [
      "🎨║arte",
      "✝║religión",
      "🧠║el-cerebro",
      "🎒║aprende-a",
      "🔎║recursos",
      "📗║variado-libros"
    ]
  },
  "📰 Noticieros": {
    descripcion: "Noticias y actualidad del mundo.",
    canales: [
      "🥘║noticias-españa",
      "🌎║noticias-américa"
    ]
  }
};

// ========================
// Registrar slash command
// ========================
client.once("ready", async () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName("lawliet")
      .setDescription("Muestra canales según tu mensaje libre")
      .addStringOption(option =>
        option.setName("texto")
          .setDescription("Ej: 'muéstrame los canales de conocimiento'")
          .setRequired(false)
      )
  ];

  try {
    await client.application.commands.set(commands); // comandos globales
    console.log("🌐 Comando /lawliet registrado globalmente.");
  } catch (err) {
    console.error("⚠️ Error al registrar comandos:", err);
  }
});

// ========================
// Manejo de interacciones
// ========================
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "lawliet") {
    // Tomamos todo el texto del usuario
    let consulta = interaction.options.getString("texto") || "";
    consulta = consulta.trim();

    if (!consulta) {
      return await interaction.reply({
        content: "⚠️ Debes escribir algo para que pueda interpretar la categoría.",
        ephemeral: true
      });
    }

    await interaction.deferReply();

    try {
      // Prompt para que Gemini detecte la categoría
      const categoriasTexto = Object.entries(categorias)
        .map(([cat, data]) => `Categoría: ${cat}\nDescripción: ${data.descripcion}`)
        .join("\n\n");

      const promptIA = `
Tienes la siguiente lista de categorías de un servidor de Discord:

${categoriasTexto}

Usuario escribió: "${consulta}"

Pregunta: ¿Cuál categoría es la más adecuada para esta consulta? Devuélveme solo el nombre exacto de la categoría.
`;

      let categoriaElegida = "";
      try {
        const result = await model.generateContent(promptIA);
        categoriaElegida = result.response.text().trim();
      } catch (errorIA) {
        console.error("⚠️ Error Gemini:", errorIA);
        categoriaElegida = null;
      }

      // Fallback si Gemini falla
      if (!categoriaElegida || !categorias[categoriaElegida]) {
        categoriaElegida = Object.keys(categorias).find(cat =>
          cat.toLowerCase().includes(consulta.toLowerCase()) ||
          (categorias[cat].descripcion && categorias[cat].descripcion.toLowerCase().includes(consulta.toLowerCase()))
        );
      }

      if (!categoriaElegida) {
        return await interaction.editReply("⚠️ No encontré ninguna categoría que coincida con tu mensaje.");
      }

      const data = categorias[categoriaElegida];
      const canales = data.canales.join("\n");

      // Prompt para embellecer respuesta
      let respuestaIA = "";
      try {
        const promptMensaje = `
Crea un mensaje bonito para Discord mostrando esta categoría y sus canales:
Categoría: ${categoriaElegida}
Descripción: ${data.descripcion}
Canales:
${canales}
`;
        const result = await model.generateContent(promptMensaje);
        respuestaIA = result.response.text();
      } catch {
        respuestaIA = `**${data.descripcion}**\n\n${canales}`;
      }

      const embed = new EmbedBuilder()
        .setTitle(`📑 ${categoriaElegida}`)
        .setDescription(respuestaIA.length > 4000 ? respuestaIA.slice(0, 4000) + "..." : respuestaIA)
        .setColor("Purple")
        .setFooter({ text: "✨ Potenciado por Gemini" });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error("Error general:", error);
      await interaction.editReply("⚠️ Ocurrió un error inesperado.");
    }
  }
});

// ========================
// Iniciar bot
// ========================
client.login(process.env.DISCORD_TOKEN);

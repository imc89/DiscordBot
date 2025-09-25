const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Inicializa la IA
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

module.exports = {
    data: new SlashCommandBuilder()
        .setName("law_quote")
        .setDescription("Dice una cita famosa de un escritor, famoso o filósofo, generada por IA.")
        .addStringOption(option =>
            option.setName("nombre")
                .setDescription("El nombre de la persona de la que quieres una cita.")
                .setRequired(true)
        ),
    
    async execute(interaction) {
        await interaction.deferReply();
        
        const name = interaction.options.getString("nombre");

        // Prompt para la IA
        const prompt = `Genera una cita famosa de "${name}". Responde de la siguiente manera, sin texto adicional:
        
        "Cita famosa"
        - Nombre Completo del Autor`;
        
        try {
            // Genera la cita con la IA
            const result = await model.generateContent(prompt);
            const response = result.response;
            let text = response.text().trim();
            
            // Intenta extraer la cita y el autor
            const parts = text.split('\n- ');
            const quoteText = parts[0].replace(/"/g, '').trim();
            const authorName = parts[1] || name;

            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle("✨ Cita inspiradora ✨")
                .setDescription(`*"${quoteText}"*`)
                .addFields(
                    { name: 'Autor', value: `- ${authorName}` }
                )
                .setFooter({ text: "Esta cita ha sido generada por Gemini." })
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("⚠️ Error al generar la cita con Gemini:", error);
            await interaction.editReply("⚠️ Ocurrió un error al intentar generar la cita. Revisa el log para más detalles.");
        }
    },
};
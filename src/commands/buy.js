const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = require("discord.js");
const { MongoClient } = require("mongodb");
const path = require('path');

// =========================================================
// 1. CONFIGURACIÓN Y CLIENTE GLOBAL DE MONGODB
// =========================================================
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_USER}.patcutg.mongodb.net/?retryWrites=true&w=majority&appName=${process.env.DB_USER}`;
const client = new MongoClient(uri);

// Función para obtener la base de datos, asegurando la conexión
async function getDbCollection() {
    // Si el cliente no está conectado, intenta conectarse.
    // Esto es robusto para entornos con desconexiones ocasionales.
    if (!client.topology || !client.topology.isConnected()) {
        console.log("Reconectando a MongoDB...");
        await client.connect();
        console.log("Reconexión a MongoDB exitosa.");
    }
    const db = client.db("discord_bot");
    return db.collection("money");
}
// =========================================================

// Definición de las bebidas disponibles
const drinks = [
    { name: "Prueba 1", price: 5, id: "prueba_1", imageFile: "prueba_1.gif" },
    { name: "Prueba 2", price: 15, id: "prueba_2", imageFile: "prueba_2.gif" },
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("law_buy")
        .setDescription("Compra una bebida para refrescarte."),

    async execute(interaction) {
        // CORRECCIÓN CRÍTICA: 
        // 1. Deferir la respuesta INMEDIATAMENTE. Esto cumple el requisito de 3s de Discord.
        await interaction.deferReply({ ephemeral: false });

        // 2. Ahora que hemos diferido, tenemos tiempo para la operación de DB
        try {
            // Obtener la colección de forma robusta
            const collection = await getDbCollection();

            const userId = interaction.user.id;
            const userData = await collection.findOne({ userId });
            const currentBalance = userData ? userData.balance : 0;

            // Crear las opciones para el menú desplegable (omito código por brevedad)
            const options = drinks.map(drink =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(`${drink.name} - ${drink.price}$`)
                    .setValue(drink.id)
                    .setDescription(`Costo: ${drink.price} monedas.`)
            );

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('buy_drink_select')
                .setPlaceholder('Selecciona la bebida que deseas comprar...')
                .addOptions(options);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setTitle("🛒 Tienda de Bebidas")
                .setDescription(`Tu balance actual es de **${currentBalance}** monedas. Selecciona una bebida para comprarla.`)
                .setColor("LuminousVividPink")
                .setTimestamp();

            // Usar editReply porque ya hicimos deferReply
            await interaction.editReply({
                embeds: [embed],
                components: [row]
            });

        } catch (error) {
            console.error("Error al acceder a la tienda o DB:", error);
            // Usar editReply porque ya hicimos deferReply
            await interaction.editReply({ content: "❌ Hubo un error al intentar acceder a la tienda. Inténtalo de nuevo más tarde.", ephemeral: true });
        }
    },

    async handleSelectMenuInteraction(interaction) {
        if (!interaction.isStringSelectMenu() || interaction.customId !== 'buy_drink_select') return;

        // CRÍTICO: Deferir la actualización INMEDIATAMENTE
        await interaction.deferUpdate(); 

        const selectedDrinkId = interaction.values[0];
        const drink = drinks.find(d => d.id === selectedDrinkId);

        if (!drink) {
            // Usamos followUp en interacciones diferidas (deferUpdate)
            return await interaction.followUp({ content: "❌ Bebida no encontrada.", ephemeral: true });
        }

        try {
            // Obtener la colección de forma robusta
            const collection = await getDbCollection();

            const userId = interaction.user.id;
            let userData = await collection.findOne({ userId });

            if (!userData) {
                userData = {
                    userId,
                    username: interaction.user.username,
                    displayName: interaction.user.displayName,
                    balance: 0,
                    last_daily: null,
                    last_job: null
                };
                await collection.insertOne(userData);
            }

            const currentBalance = userData.balance;
            const price = drink.price;

            // 1. Verificar si el usuario tiene suficiente dinero
            if (currentBalance < price) {
                await interaction.followUp({
                    content: `❌ ¡Lo sentimos! No tienes suficientes monedas para comprar **${drink.name}**. Necesitas **${price}** monedas y solo tienes **${currentBalance}**.`,
                    ephemeral: true
                });
                
                // Borrar el menú después de un error para que no se pueda volver a intentar.
                await interaction.message.edit({ components: [] });
                return;
            }

            // 2. Descontar el dinero y actualizar la base de datos
            const newBalance = currentBalance - price;
            await collection.updateOne(
                { userId },
                { $set: { balance: newBalance } }
            );

            // 3. Respuesta de compra exitosa
            const attachmentPath = path.resolve(__dirname, '..', '..', 'img', 'drinks', drink.imageFile);

            const embed = new EmbedBuilder()
                .setTitle("✅ Compra Exitosa")
                .setDescription(`**DISFRUTA DE TU BEBIDA ${drink.name.toUpperCase()}**`)
                .addFields(
                    { name: 'Costo', value: `**${price}** monedas`, inline: true },
                    { name: 'Balance Restante', value: `**${newBalance}** monedas`, inline: true }
                )
                .setImage(`attachment://${drink.imageFile}`)
                .setColor("Green")
                .setTimestamp();

            // Usar edit para actualizar el mensaje del menú a la confirmación de compra
            await interaction.message.edit({
                content: null,
                embeds: [embed],
                files: [attachmentPath],
                components: [] // Eliminar el menú
            });
            
            // Confirmación efímera (privada) para el usuario
            await interaction.followUp({ content: `¡Has comprado **${drink.name}**!`, ephemeral: true });


        } catch (error) {
            console.error("Error al procesar la compra en MongoDB:", error);
            await interaction.followUp({ content: "❌ Hubo un error al procesar tu compra. Inténtalo de nuevo más tarde.", ephemeral: true });
        }
    }
};
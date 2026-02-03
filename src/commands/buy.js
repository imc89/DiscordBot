const {
    SlashCommandBuilder,
    EmbedBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ActionRowBuilder,
} = require("discord.js");
const path = require('path');



// Definición de las bebidas disponibles
const drinks = [
    { name: "Cerveza", price: 500, id: "Cerveza", imageFile: "Cerveza.gif" },
    { name: "Tostada", price: 1250, id: "Tostada", imageFile: "Tostada.gif" },
    { name: "Veridian", price: 2000, id: "Veridian", imageFile: "Veridian.gif" },
    { name: "Ascua", price: 3250, id: "Ascua", imageFile: "Ascua.gif" },
    { name: "Pixie", price: 3500, id: "Pixie", imageFile: "Pixie.gif" },
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("law_buy")
        .setDescription("Compra una bebida para refrescarte o invita a alguien.")
        // Subcomando principal para la tienda
        .addSubcommand(subcommand =>
            subcommand
                .setName('shop')
                .setDescription('Abre la tienda de bebidas.')
        )
        // Subcomando para invitar/regalar una bebida (¡ACTUALIZADO!)
        .addSubcommand(subcommand =>
            subcommand
                .setName('invite')
                .setDescription('Invita a un usuario a una bebida pagada por ti.')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('El usuario al que quieres invitar.')
                        .setRequired(true))
        ),

    async execute(interaction) {
        // Deferir la respuesta inmediatamente
        await interaction.deferReply({ ephemeral: false }).catch(console.error);

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'shop') {
            await this.handleShopCommand(interaction);
        } else if (subcommand === 'invite') {
            await this.handleInviteCommand(interaction);
        }
    },

    // ----------------------------------------------------------------------
    // --- Lógica del subcomando /law_buy shop (Muestra el menú de compra) ---
    // ----------------------------------------------------------------------
    async handleShopCommand(interaction) {
        try {
            await client.connect();
            const db = client.db("discord_bot");
            const collection = db.collection("money");
            const userId = interaction.user.id;
            const userData = await collection.findOne({ userId });
            const currentBalance = userData ? userData.balance : 0;

            // Crear las opciones para el menú desplegable
            const options = drinks.map(drink =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(`${drink.name} - ${drink.price}$`)
                    .setValue(drink.id)
                    .setDescription(`Costo: ${drink.price} monedas.`)
            );

            // Crear el menú desplegable (ID: buy_drink_select)
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('buy_drink_select')
                .setPlaceholder('Selecciona la bebida que deseas comprar para ti...')
                .addOptions(options);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setTitle("🛒 Tienda de Bebidas")
                .setDescription(`Tu balance actual es de **${currentBalance}** monedas. Selecciona una bebida para comprarla.`)
                .setColor("LuminousVividPink")
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed],
                components: [row]
            });

        } catch (error) {
            console.error("Error al conectar o interactuar con MongoDB:", error);
            await interaction.editReply({ content: "❌ Hubo un error al intentar acceder a la tienda. Inténtalo de nuevo más tarde.", ephemeral: true });
        }
    },

    // ------------------------------------------------------------------
    // --- Lógica del subcomando /law_buy invite (Muestra el menú de regalo) ---
    // ------------------------------------------------------------------
    async handleInviteCommand(interaction) {
        const invitedUser = interaction.options.getUser('user');
        const inviter = interaction.user;

        // Validaciones básicas
        if (invitedUser.bot) {
            return await interaction.editReply("❌ No puedes invitar a beber a un bot.");
        }
        if (invitedUser.id === inviter.id) {
            return await interaction.editReply("❌ No puedes invitarte a ti mismo. Usa **/law_buy shop** si quieres comprarla para tu consumo.");
        }

        try {
            await client.connect();
            const db = client.db("discord_bot");
            const collection = db.collection("money");
            const userData = await collection.findOne({ userId: inviter.id });
            const currentBalance = userData ? userData.balance : 0;

            // Crear las opciones para el menú desplegable (igual que la compra)
            const options = drinks.map(drink =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(`${drink.name} - ${drink.price}$`)
                    .setValue(drink.id)
                    .setDescription(`Costo: ${drink.price} monedas.`)
            );

            // Crear el menú desplegable con un ID personalizado para REGALOS
            // Usamos un customId con el ID del invitado para pasarlo a la siguiente interacción
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`gift_select_${invitedUser.id}`) // ID único para procesar el regalo
                .setPlaceholder(`Selecciona la bebida para regalar a ${invitedUser.username}...`)
                .addOptions(options);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setTitle(`🎁 Regalar Bebida a ${invitedUser.username}`)
                .setDescription(`Tu balance actual es de **${currentBalance}** monedas. Selecciona la bebida que **tú pagarás** para invitar a ${invitedUser.username}.`)
                .setColor("Orange")
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed],
                components: [row]
            });

        } catch (error) {
            console.error("Error al conectar o interactuar con MongoDB:", error);
            await interaction.editReply({ content: "❌ Hubo un error al intentar iniciar el regalo. Inténtalo de nuevo más tarde.", ephemeral: true });
        }
    },

    // --------------------------------------------------------------------------
    // --- Lógica del Menú Desplegable (Maneja Compra y Regalo) ---
    // --------------------------------------------------------------------------
    async handleSelectMenuInteraction(interaction) {
        if (!interaction.isStringSelectMenu()) return;

        // Si es el menú de compra personal
        if (interaction.customId === 'buy_drink_select') {
            await this.processBuy(interaction);
            return;
        }

        // Si es el menú de regalo (empieza con 'gift_select_')
        if (interaction.customId.startsWith('gift_select_')) {
            await this.processGift(interaction);
            return;
        }
    },

    // --------------------------------------------------------------------------
    // --- Procesar Compra Personal (Lógica existente) ---
    // --------------------------------------------------------------------------
    async processBuy(interaction) {
        await interaction.deferUpdate();

        const selectedDrinkId = interaction.values[0];
        const drink = drinks.find(d => d.id === selectedDrinkId);

        if (!drink) {
            return await interaction.followUp({ content: "❌ Bebida no encontrada.", ephemeral: true });
        }

        try {
            await client.connect();
            const db = client.db("discord_bot");
            const collection = db.collection("money");
            const userId = interaction.user.id;
            let userData = await collection.findOne({ userId });
            const currentBalance = userData ? userData.balance : 0;
            const price = drink.price;

            // 1. Verificar si el usuario tiene suficiente dinero
            if (currentBalance < price) {
                await interaction.editReply({
                    content: `❌ ¡Lo sentimos! No tienes suficientes monedas para comprar **${drink.name}**. Necesitas **${price}** monedas y solo tienes **${currentBalance}**.`,
                    embeds: [],
                    components: []
                });
                return;
            }

            // 2. Descontar el dinero y actualizar la base de datos
            const newBalance = currentBalance - price;
            await collection.updateOne(
                { userId },
                { $set: { balance: newBalance } }
            );

            // 3. Crear la respuesta de compra exitosa
            const attachmentPath = path.resolve(__dirname, '..', '..', 'img', 'drinks', drink.imageFile);

            const embed = new EmbedBuilder()
                .setTitle("✅ Compra Exitosa")
                .setDescription(`**DISFRUTA DE TU ${drink.name.toUpperCase()}**`)
                .addFields(
                    { name: 'Costo', value: `**${price}** monedas`, inline: true },
                    { name: 'Balance Restante', value: `**${newBalance}** monedas`, inline: true }
                )
                .setImage(`attachment://${drink.imageFile}`)
                .setColor("Green")
                .setTimestamp();

            await interaction.message.edit({
                content: null,
                embeds: [embed],
                files: [attachmentPath],
                components: []
            });

            await interaction.followUp({ content: `¡Has comprado **${drink.name}** para ti!`, ephemeral: true });

        } catch (error) {
            console.error("Error al procesar la compra en MongoDB:", error);
            await interaction.followUp({ content: "❌ Hubo un error al procesar tu compra. Inténtalo de nuevo más tarde.", ephemeral: true });
        }
    },

    // --------------------------------------------------------------------------
    // --- Procesar Regalo (Nueva lógica de regalo directo) ---
    // --------------------------------------------------------------------------
    async processGift(interaction) {
        await interaction.deferUpdate();

        const inviter = interaction.user;
        const selectedDrinkId = interaction.values[0];
        const drink = drinks.find(d => d.id === selectedDrinkId);
        
        // Extraemos el ID del invitado del customId del menú
        const invitedUserId = interaction.customId.split('_')[2]; 
        const invitedUser = await interaction.client.users.fetch(invitedUserId);

        if (!drink) {
            return await interaction.followUp({ content: "❌ Bebida no encontrada.", ephemeral: true });
        }

        try {
            await client.connect();
            const db = client.db("discord_bot");
            const collection = db.collection("money");

            const userId = inviter.id; // El que paga es el invitador
            let userData = await collection.findOne({ userId });
            const currentBalance = userData ? userData.balance : 0;
            const price = drink.price;

            // 1. Verificar si el invitador tiene suficiente dinero
            if (currentBalance < price) {
                await interaction.message.edit({
                    content: `❌ ¡Lo sentimos! **${inviter.username}** no tienes suficientes monedas para regalar **${drink.name}**. Necesitas **${price}** y solo tienes **${currentBalance}**.`,
                    embeds: [],
                    components: []
                });
                return;
            }

            // 2. Descontar el dinero del invitador
            const newBalance = currentBalance - price;
            await collection.updateOne(
                { userId },
                { $set: { balance: newBalance } }
            );

            // 3. Crear la respuesta del regalo
            const attachmentPath = path.resolve(__dirname, '..', '..', 'img', 'drinks', drink.imageFile);

            const embed = new EmbedBuilder()
                .setTitle("🎁 ¡Regalo Entregado!")
                .setDescription(`**${inviter.username}** ha pagado un/a **${drink.name}** para **${invitedUser.username}**.\n\n¡Salud! 🥂`)
                .addFields(
                    { name: 'Costo', value: `**${price}** monedas`, inline: true },
                    { name: 'Balance Restante (Tu Balance)', value: `**${newBalance}** monedas`, inline: true }
                )
                .setImage(`attachment://${drink.imageFile}`)
                .setColor("Gold")
                .setTimestamp();

            await interaction.message.edit({
                content: invitedUser.toString(), // Menciona al usuario invitado
                embeds: [embed],
                files: [attachmentPath],
                components: [], // Sin menú después de la selección
            });

            await interaction.followUp({ content: `¡Has regalado **${drink.name}** a **${invitedUser.username}**!`, ephemeral: true });

        } catch (error) {
            console.error("Error al procesar el regalo en MongoDB:", error);
            await interaction.followUp({ content: "❌ Hubo un error al procesar tu regalo. Inténtalo de nuevo más tarde.", ephemeral: true });
        }
    },
    
    // Dejamos esta función vacía, ya que no se usa.
    async handleButtonInteraction(interaction) {
        return;
    }
};
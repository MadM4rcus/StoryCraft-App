<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ficha de Personagem StoryCraft</title>
    <!-- Tailwind CSS CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background-color: #f3f4f6;
            color: #374151;
        }
        .container {
            max-width: 900px;
        }
        input[type="text"], input[type="number"], textarea {
            border: 1px solid #d1d5db;
            padding: 0.5rem 0.75rem;
            border-radius: 0.375rem;
            width: 100%;
            box-sizing: border-box;
            background-color: #ffffff;
        }
        textarea {
            resize: vertical;
        }
        .section-title {
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 0.5rem;
            margin-bottom: 1rem;
        }
        .card {
            background-color: #ffffff;
            border-radius: 0.5rem;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        .delete-btn {
            background-color: #ef4444;
            color: white;
            border: none;
            padding: 0.25rem 0.5rem;
            border-radius: 0.25rem;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .delete-btn:hover {
            background-color: #dc2626;
        }
        .restore-btn {
            background-color: #22c55e;
            color: white;
            border: none;
            padding: 0.25rem 0.5rem;
            border-radius: 0.25rem;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .restore-btn:hover {
            background-color: #16a34a;
        }
        .permanent-delete-btn {
            background-color: #b91c1c;
            color: white;
            border: none;
            padding: 0.25rem 0.5rem;
            border-radius: 0.25rem;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .permanent-delete-btn:hover {
            background-color: #991b1b;
        }
        .add-button {
            width: 32px; /* w-8 */
            height: 32px; /* h-8 */
            border-radius: 9999px; /* rounded-full */
            background-color: #3b82f6; /* bg-blue-500 */
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem; /* text-2xl */
            line-height: 1;
            cursor: pointer;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); /* shadow-md */
            transition: background-color 0.2s;
        }
        .add-button:hover {
            background-color: #2563eb; /* hover:bg-blue-600 */
        }
    </style>
</head>
<body class="p-6">
    <div class="container mx-auto bg-white p-8 rounded-lg shadow-lg">
        <h1 class="text-3xl font-bold text-center mb-6 text-gray-800">Ficha de Personagem StoryCraft</h1>
        <p id="user-id-display" class="text-sm text-gray-600 text-center mb-4">Carregando ID do Usuário...</p>

        <!-- Informações Básicas do Personagem -->
        <section class="mb-8 p-6 card">
            <h2 class="text-2xl font-semibold mb-4 section-title">Informações Básicas</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label for="characterName" class="block text-sm font-medium text-gray-700 mb-1">Nome do Personagem</label>
                    <input type="text" id="characterName" placeholder="Nome do Personagem" class="focus:ring-blue-500 focus:border-blue-500">
                </div>
                <div>
                    <label for="player" class="block text-sm font-medium text-gray-700 mb-1">Jogador</label>
                    <input type="text" id="player" placeholder="Nome do Jogador" class="focus:ring-blue-500 focus:border-blue-500">
                </div>
                <div>
                    <label for="concept" class="block text-sm font-medium text-gray-700 mb-1">Conceito</label>
                    <input type="text" id="concept" placeholder="Conceito do Personagem" class="focus:ring-blue-500 focus:border-blue-500">
                </div>
                <div>
                    <label for="chronicle" class="block text-sm font-medium text-gray-700 mb-1">Crônica</label>
                    <input type="text" id="chronicle" placeholder="Nome da Crônica" class="focus:ring-blue-500 focus:border-blue-500">
                </div>
            </div>
            <div class="mt-4">
                <label for="description" class="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea id="description" rows="4" placeholder="Uma breve descrição do personagem..." class="focus:ring-blue-500 focus:border-blue-500"></textarea>
            </div>
        </section>

        <!-- Atributos -->
        <section class="mb-8 p-6 card">
            <h2 class="text-2xl font-semibold mb-4 section-title">Atributos</h2>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div>
                    <label for="strength" class="block text-sm font-medium text-gray-700 mb-1">Força</label>
                    <input type="number" id="strength" min="0" value="0" class="focus:ring-blue-500 focus:border-blue-500">
                </div>
                <div>
                    <label for="dexterity" class="block text-sm font-medium text-gray-700 mb-1">Destreza</label>
                    <input type="number" id="dexterity" min="0" value="0" class="focus:ring-blue-500 focus:border-blue-500">
                </div>
                <div>
                    <label for="stamina" class="block text-sm font-medium text-gray-700 mb-1">Vigor</label>
                    <input type="number" id="stamina" min="0" value="0" class="focus:ring-blue-500 focus:border-blue-500">
                </div>
                <div>
                    <label for="charisma" class="block text-sm font-medium text-gray-700 mb-1">Carisma</label>
                    <input type="number" id="charisma" min="0" value="0" class="focus:ring-blue-500 focus:border-blue-500">
                </div>
                <div>
                    <label for="manipulation" class="block text-sm font-medium text-gray-700 mb-1">Manipulação</label>
                    <input type="number" id="manipulation" min="0" value="0" class="focus:ring-blue-500 focus:border-blue-500">
                </div>
                <div>
                    <label for="appearance" class="block text-sm font-medium text-gray-700 mb-1">Aparência</label>
                    <input type="number" id="appearance" min="0" value="0" class="focus:ring-blue-500 focus:border-blue-500">
                </div>
                <div>
                    <label for="perception" class="block text-sm font-medium text-gray-700 mb-1">Percepção</label>
                    <input type="number" id="perception" min="0" value="0" class="focus:ring-blue-500 focus:border-blue-500">
                </div>
                <div>
                    <label for="intelligence" class="block text-sm font-medium text-gray-700 mb-1">Inteligência</label>
                    <input type="number" id="intelligence" min="0" value="0" class="focus:ring-blue-500 focus:border-blue-500">
                </div>
                <div>
                    <label for="wits" class="block text-sm font-medium text-gray-700 mb-1">Raciocínio</label>
                    <input type="number" id="wits" min="0" value="0" class="focus:ring-blue-500 focus:border-blue-500">
                </div>
            </div>
        </section>

        <!-- Habilidades -->
        <section class="mb-8 p-6 card">
            <h2 class="text-2xl font-semibold mb-4 section-title">Habilidades</h2>
            <div class="flex justify-end mb-4">
                <button onclick="addSkill()" class="add-button">+</button>
            </div>
            <div id="skillsList" class="space-y-3">
                <!-- Habilidades serão adicionadas aqui -->
            </div>
            <div class="flex justify-end mt-4">
                <button onclick="addSkill()" class="add-button">+</button>
            </div>
        </section>

        <!-- Inventário -->
        <section class="mb-8 p-6 card">
            <h2 class="text-2xl font-semibold mb-4 section-title">Inventário</h2>
            <div class="flex justify-end mb-4">
                <button onclick="addItem()" class="add-button">+</button>
            </div>
            <div id="inventoryList" class="space-y-3">
                <!-- Itens serão adicionados aqui -->
            </div>
            <div class="flex justify-end mt-4">
                <button onclick="addItem()" class="add-button">+</button>
            </div>
        </section>

        <!-- Vantagens e Desvantagens -->
        <section class="mb-8 p-6 card">
            <h2 class="text-2xl font-semibold mb-4 section-title">Vantagens e Desvantagens</h2>
            <div class="flex justify-end mb-4">
                <button onclick="addAdvantage()" class="add-button">+</button>
            </div>
            <div id="advantagesList" class="space-y-3">
                <!-- Vantagens/Desvantagens serão adicionadas aqui -->
            </div>
            <div class="flex justify-end mt-4">
                <button onclick="addAdvantage()" class="add-button">+</button>
            </div>
        </section>

        <!-- Seção de Lixeira -->
        <section class="mb-8 p-6 card">
            <h2 class="text-2xl font-semibold mb-4 section-title">Lixeira</h2>
            <div id="trashList" class="space-y-3">
                <!-- Itens da lixeira serão adicionados aqui -->
                <p id="emptyTrashMessage" class="text-gray-500 text-center">A lixeira está vazia.</p>
            </div>
        </section>
    </div>

    <script type="module">
        // Firebase Imports
        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, setDoc, onSnapshot, collection, query, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        // Firebase variables
        let app;
        let db;
        let auth;
        let userId;
        let isAuthReady = false;

        // Global character data object to hold all sheet data
        let characterData = {
            basicInfo: {},
            attributes: {},
            skills: [],
            inventory: [],
            advantages: [],
            trash: {}
        };

        // Initialize Firebase and set up authentication
        const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

        if (Object.keys(firebaseConfig).length > 0) {
            app = initializeApp(firebaseConfig);
            db = getFirestore(app);
            auth = getAuth(app);

            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    userId = user.uid;
                    document.getElementById('user-id-display').textContent = `ID do Usuário: ${userId}`;
                    isAuthReady = true;
                    console.log("Firebase Auth Ready. User ID:", userId);
                    loadCharacterSheet(); // Load data after authentication
                } else {
                    // Sign in anonymously if no user is found
                    try {
                        const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
                        if (initialAuthToken) {
                            await signInWithCustomToken(auth, initialAuthToken);
                        } else {
                            await signInAnonymously(auth);
                        }
                    } catch (error) {
                        console.error("Error during anonymous sign-in or custom token sign-in:", error);
                    }
                }
            });
        } else {
            console.warn("Firebase config not found. Running in local mode (data will not persist).");
            // If Firebase config is not available, ensure isAuthReady is true to proceed with local logic
            isAuthReady = true;
            userId = crypto.randomUUID(); // Generate a random ID for local mode
            document.getElementById('user-id-display').textContent = `ID do Usuário (Local): ${userId}`;
            // Load from local storage or default if no Firebase
            loadCharacterSheet();
        }

        // Function to generate a unique ID
        function generateUniqueId() {
            return Date.now().toString(36) + Math.random().toString(36).substr(2);
        }

        // Helper to get input values
        function getInputValue(id) {
            return document.getElementById(id) ? document.getElementById(id).value : '';
        }

        // Helper to set input values
        function setInputValue(id, value) {
            if (document.getElementById(id)) {
                document.getElementById(id).value = value;
            }
        }

        // Save character sheet data to Firestore
        async function saveCharacterSheet() {
            if (!isAuthReady || !userId) {
                console.warn("Authentication not ready, cannot save data.");
                return;
            }

            // Collect basic info
            characterData.basicInfo = {
                characterName: getInputValue('characterName'),
                player: getInputValue('player'),
                concept: getInputValue('concept'),
                chronicle: getInputValue('chronicle'),
                description: getInputValue('description')
            };

            // Collect attributes
            characterData.attributes = {
                strength: parseInt(getInputValue('strength')) || 0,
                dexterity: parseInt(getInputValue('dexterity')) || 0,
                stamina: parseInt(getInputValue('stamina')) || 0,
                charisma: parseInt(getInputValue('charisma')) || 0,
                manipulation: parseInt(getInputValue('manipulation')) || 0,
                appearance: parseInt(getInputValue('appearance')) || 0,
                perception: parseInt(getInputValue('perception')) || 0,
                intelligence: parseInt(getInputValue('intelligence')) || 0,
                wits: parseInt(getInputValue('wits')) || 0
            };

            // Collect dynamic lists (skills, inventory, advantages)
            characterData.skills = Array.from(document.querySelectorAll('#skillsList > div')).map(div => ({
                id: div.id.replace('skill-', ''),
                name: div.querySelector('input[type="text"]').value,
                value: parseInt(div.querySelector('input[type="number"]').value) || 0
            }));

            characterData.inventory = Array.from(document.querySelectorAll('#inventoryList > div')).map(div => ({
                id: div.id.replace('item-', ''),
                name: div.querySelector('input[type="text"]').value,
                quantity: parseInt(div.querySelector('input[type="number"]').value) || 1
            }));

            characterData.advantages = Array.from(document.querySelectorAll('#advantagesList > div')).map(div => ({
                id: div.id.replace('advantage-', ''),
                name: div.querySelector('input[type="text"]').value,
                value: parseInt(div.querySelector('input[type="number"]').value) || 0
            }));

            // Trash data is already managed by the `trash` object, which is part of characterData
            // characterData.trash = trash; // The global `trash` object is already updated by other functions

            try {
                const docRef = doc(db, `artifacts/${appId}/users/${userId}/characterSheet`, 'main');
                await setDoc(docRef, characterData, { merge: true });
                console.log("Character sheet saved successfully!");
            } catch (e) {
                console.error("Error saving document: ", e);
            }
        }

        // Load character sheet data from Firestore
        async function loadCharacterSheet() {
            if (!isAuthReady || !userId) {
                console.warn("Authentication not ready, cannot load data.");
                return;
            }

            try {
                const docRef = doc(db, `artifacts/${appId}/users/${userId}/characterSheet`, 'main');
                onSnapshot(docRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        characterData = data; // Update global characterData

                        // Populate basic info
                        setInputValue('characterName', data.basicInfo?.characterName || '');
                        setInputValue('player', data.basicInfo?.player || '');
                        setInputValue('concept', data.basicInfo?.concept || '');
                        setInputValue('chronicle', data.basicInfo?.chronicle || '');
                        setInputValue('description', data.basicInfo?.description || '');

                        // Populate attributes
                        setInputValue('strength', data.attributes?.strength || 0);
                        setInputValue('dexterity', data.attributes?.dexterity || 0);
                        setInputValue('stamina', data.attributes?.stamina || 0);
                        setInputValue('charisma', data.attributes?.charisma || 0);
                        setInputValue('manipulation', data.attributes?.manipulation || 0);
                        setInputValue('appearance', data.attributes?.appearance || 0);
                        setInputValue('perception', data.attributes?.perception || 0);
                        setInputValue('intelligence', data.attributes?.intelligence || 0);
                        setInputValue('wits', data.attributes?.wits || 0);

                        // Populate skills
                        const skillsList = document.getElementById('skillsList');
                        skillsList.innerHTML = ''; // Clear current list
                        if (data.skills) {
                            data.skills.forEach(skill => {
                                const skillDiv = createSkillElement(skill.id, skill.name, skill.value);
                                skillsList.appendChild(skillDiv);
                            });
                        }

                        // Populate inventory
                        const inventoryList = document.getElementById('inventoryList');
                        inventoryList.innerHTML = ''; // Clear current list
                        if (data.inventory) {
                            data.inventory.forEach(item => {
                                const itemDiv = createItemElement(item.id, item.name, item.quantity);
                                inventoryList.appendChild(itemDiv);
                            });
                        }

                        // Populate advantages
                        const advantagesList = document.getElementById('advantagesList');
                        advantagesList.innerHTML = ''; // Clear current list
                        if (data.advantages) {
                            data.advantages.forEach(advantage => {
                                const advantageDiv = createAdvantageElement(advantage.id, advantage.name, advantage.value);
                                advantagesList.appendChild(advantageDiv);
                            });
                        }

                        // Populate trash
                        characterData.trash = data.trash || {}; // Update the global trash object
                        renderTrash();

                        console.log("Character sheet loaded successfully!");
                    } else {
                        console.log("No character sheet found for this user. Starting fresh.");
                        // Initialize with empty data if no document exists
                        characterData = {
                            basicInfo: {},
                            attributes: {},
                            skills: [],
                            inventory: [],
                            advantages: [],
                            trash: {}
                        };
                        saveCharacterSheet(); // Save an empty sheet to initialize
                    }
                }, (error) => {
                    console.error("Error listening to document:", error);
                });
            } catch (e) {
                console.error("Error loading document: ", e);
            }
        }

        // Functions to create dynamic elements based on data
        function createSkillElement(id, name, value) {
            const skillDiv = document.createElement('div');
            skillDiv.id = `skill-${id}`;
            skillDiv.className = 'flex items-center space-x-2';
            skillDiv.innerHTML = `
                <input type="text" placeholder="Nome da Habilidade" class="flex-grow focus:ring-blue-500 focus:border-blue-500" value="${name}">
                <input type="number" min="0" value="${value}" class="w-20 text-center focus:ring-blue-500 focus:border-blue-500">
                <button onclick="moveToTrash('${id}', 'skill')" class="delete-btn">Lixeira</button>
            `;
            // Add event listeners for input changes to trigger save
            skillDiv.querySelectorAll('input').forEach(input => {
                input.addEventListener('input', saveCharacterSheet);
            });
            return skillDiv;
        }

        function createItemElement(id, name, quantity) {
            const itemDiv = document.createElement('div');
            itemDiv.id = `item-${id}`;
            itemDiv.className = 'flex items-center space-x-2';
            itemDiv.innerHTML = `
                <input type="text" placeholder="Nome do Item" class="flex-grow focus:ring-blue-500 focus:border-blue-500" value="${name}">
                <input type="number" min="1" value="${quantity}" class="w-20 text-center focus:ring-blue-500 focus:border-blue-500">
                <button onclick="moveToTrash('${id}', 'item')" class="delete-btn">Lixeira</button>
            `;
            // Add event listeners for input changes to trigger save
            itemDiv.querySelectorAll('input').forEach(input => {
                input.addEventListener('input', saveCharacterSheet);
            });
            return itemDiv;
        }

        function createAdvantageElement(id, name, value) {
            const advantageDiv = document.createElement('div');
            advantageDiv.id = `advantage-${id}`;
            advantageDiv.className = 'flex items-center space-x-2';
            advantageDiv.innerHTML = `
                <input type="text" placeholder="Nome da Vantagem/Desvantagem" class="flex-grow focus:ring-blue-500 focus:border-blue-500" value="${name}">
                <input type="number" min="0" value="${value}" class="w-20 text-center focus:ring-blue-500 focus:border-blue-500">
                <button onclick="moveToTrash('${id}', 'advantage')" class="delete-btn">Lixeira</button>
            `;
            // Add event listeners for input changes to trigger save
            advantageDiv.querySelectorAll('input').forEach(input => {
                input.addEventListener('input', saveCharacterSheet);
            });
            return advantageDiv;
        }

        // Functions to add elements dynamically
        function addSkill() {
            const skillId = generateUniqueId();
            const skillDiv = createSkillElement(skillId, '', 0); // Create with empty values
            document.getElementById('skillsList').appendChild(skillDiv);
            saveCharacterSheet(); // Save changes
        }

        function addItem() {
            const itemId = generateUniqueId();
            const itemDiv = createItemElement(itemId, '', 1); // Create with empty values
            document.getElementById('inventoryList').appendChild(itemDiv);
            saveCharacterSheet(); // Save changes
        }

        function addAdvantage() {
            const advantageId = generateUniqueId();
            const advantageDiv = createAdvantageElement(advantageId, '', 0); // Create with empty values
            document.getElementById('advantagesList').appendChild(advantageDiv);
            saveCharacterSheet(); // Save changes
        }

        // Trash and permanent deletion logic
        const permanentDeletionThreshold = 2; // Number of times an item must be moved to trash for permanent deletion

        function moveToTrash(id, type) {
            const element = document.getElementById(`${type}-${id}`);
            if (element) {
                // Capture current state of the element before removing
                const inputs = element.querySelectorAll('input');
                let currentName = inputs[0] ? inputs[0].value : '';
                let currentValue = inputs[1] ? inputs[1].value : (type === 'item' ? 1 : 0);

                // Remove from the DOM
                element.remove();

                // Update characterData lists
                if (type === 'skill') {
                    characterData.skills = characterData.skills.filter(s => s.id !== id);
                } else if (type === 'item') {
                    characterData.inventory = characterData.inventory.filter(i => i.id !== id);
                } else if (type === 'advantage') {
                    characterData.advantages = characterData.advantages.filter(a => a.id !== id);
                }

                // Add to trash object, updating count if already exists
                if (!characterData.trash[id]) {
                    characterData.trash[id] = {
                        type: type,
                        name: currentName,
                        value: currentValue,
                        count: 0
                    };
                }
                characterData.trash[id].count++;

                renderTrash();
                saveCharacterSheet(); // Save changes to Firestore
            }
        }

        function restoreFromTrash(id) {
            if (characterData.trash[id]) {
                const item = characterData.trash[id];
                const trashElement = document.getElementById(`trash-${id}`);
                if (trashElement) {
                    trashElement.remove(); // Remove from trash display

                    // Re-add to the correct list in the DOM and characterData
                    if (item.type === 'skill') {
                        const skillDiv = createSkillElement(id, item.name, item.value);
                        document.getElementById('skillsList').appendChild(skillDiv);
                        characterData.skills.push({ id: id, name: item.name, value: item.value });
                    } else if (item.type === 'item') {
                        const itemDiv = createItemElement(id, item.name, item.value);
                        document.getElementById('inventoryList').appendChild(itemDiv);
                        characterData.inventory.push({ id: id, name: item.name, quantity: item.value });
                    } else if (item.type === 'advantage') {
                        const advantageDiv = createAdvantageElement(id, item.name, item.value);
                        document.getElementById('advantagesList').appendChild(advantageDiv);
                        characterData.advantages.push({ id: id, name: item.name, value: item.value });
                    }

                    delete characterData.trash[id]; // Remove from trash object
                    renderTrash(); // Update trash display
                    saveCharacterSheet(); // Save changes to Firestore
                }
            }
        }

        function deletePermanently(id) {
            if (characterData.trash[id]) {
                const trashElement = document.getElementById(`trash-${id}`);
                if (trashElement) {
                    trashElement.remove(); // Remove from trash display
                    delete characterData.trash[id]; // Remove from trash object
                    renderTrash(); // Update trash display
                    saveCharacterSheet(); // Save changes to Firestore
                }
            }
        }

        function renderTrash() {
            const trashList = document.getElementById('trashList');
            trashList.innerHTML = ''; // Clear the trash list

            if (Object.keys(characterData.trash).length === 0) {
                trashList.innerHTML = '<p id="emptyTrashMessage" class="text-gray-500 text-center">A lixeira está vazia.</p>';
                return;
            }

            for (const id in characterData.trash) {
                const item = characterData.trash[id];
                const trashItemDiv = document.createElement('div');
                trashItemDiv.id = `trash-${id}`;
                trashItemDiv.className = 'flex items-center justify-between space-x-2 p-2 bg-gray-100 rounded-md';

                const displayName = item.name || `Item ${item.type}`; // Use stored name or a default

                trashItemDiv.innerHTML = `
                    <span class="flex-grow">${displayName} (${item.type} - Movido ${item.count} vez(es))</span>
                    <button onclick="restoreFromTrash('${id}')" class="restore-btn mr-2">Restaurar</button>
                    ${item.count >= permanentDeletionThreshold ? `<button onclick="deletePermanently('${id}')" class="permanent-delete-btn">Excluir Permanentemente</button>` : ''}
                `;
                trashList.appendChild(trashItemDiv);
            }
        }

        // Add event listeners to input fields for auto-saving basic info and attributes
        document.addEventListener('DOMContentLoaded', () => {
            const basicInfoInputs = ['characterName', 'player', 'concept', 'chronicle', 'description'];
            basicInfoInputs.forEach(id => {
                const element = document.getElementById(id);
                if (element) element.addEventListener('input', saveCharacterSheet);
            });

            const attributeInputs = ['strength', 'dexterity', 'stamina', 'charisma', 'manipulation', 'appearance', 'perception', 'intelligence', 'wits'];
            attributeInputs.forEach(id => {
                const element = document.getElementById(id);
                if (element) element.addEventListener('input', saveCharacterSheet);
            });

            // Initial render of trash (will be updated by loadCharacterSheet)
            renderTrash();
        });
    </script>
</body>
</html>

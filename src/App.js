import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// Componente Modal para prompts e confirmações personalizadas
const CustomModal = ({ message, onConfirm, onCancel, type, onClose }) => {
  const [inputValue, setInputValue] = useState('');

  const handleConfirm = () => {
    if (type === 'prompt') {
      onConfirm(inputValue);
    } else {
      onConfirm();
    }
    onClose();
  };

  const handleCancel = () => {
    onCancel();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm border border-gray-700">
        <p className="text-lg text-gray-100 mb-4 text-center">{message}</p>
        {type === 'prompt' && (
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-full p-2 mb-4 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
            placeholder="Digite aqui..."
          />
        )}
        <div className="flex justify-around gap-4">
          <button
            onClick={handleConfirm}
            className={`px-5 py-2 rounded-lg font-bold shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-opacity-75 ${
              type === 'confirm' ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
            } text-white`}
          >
            {type === 'confirm' ? 'Confirmar' : 'Adicionar'}
          </button>
          <button
            onClick={handleCancel}
            className="px-5 py-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

// Componente principal da aplicação
const App = () => {
  // Configuração do Firebase (fornecida pelo ambiente do Canvas)
  // IMPORTANTE: Substitua os valores abaixo pelas suas credenciais REAIS do Firebase.
  // Você pode encontrá-las no Console do Firebase > Project overview > Configurações do projeto (engrenagem) > Seus apps (app web)
  const firebaseConfig = {
    apiKey: "AIzaSyDfsK4K4vhOmSSGeVHOlLnJuNlHGNha4LU",
    authDomain: "storycraft-a5f7e.firebaseapp.com",
    projectId: "storycraft-a5f7e",
    storageBucket: "storycraft-a5f7e.firebasestorage.app",
    messagingSenderId: "727724875985",
    appId: "1:727724875985:web:97411448885c68c289e5f0",
    measurementId: "G-JH03Y2NZDK" // Adicionado o measurementId que você forneceu
  };
  // O appId para o caminho do Firestore pode ser obtido diretamente do firebaseConfig
  const appId = firebaseConfig.appId;


  // Estados para Firebase
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [user, setUser] = useState(null); // Armazena o objeto de usuário do Firebase
  const [isAuthReady, setIsAuthReady] = useState(false); // Indica se a autenticação foi inicializada

  // Estado para armazenar os dados do personagem
  const [character, setCharacter] = useState(() => {
    const savedCharacter = localStorage.getItem('rpgCharacterSheet');
    return savedCharacter ? JSON.parse(savedCharacter) : {
      // Informações do Personagem
      name: '',
      photoUrl: 'https://placehold.co/150x150/000000/FFFFFF?text=Foto', // Placeholder image
      age: '',
      height: '',
      gender: '',
      race: '',
      class: '',
      alignment: '',

      // Atributos Principais (HP, MP, etc.)
      mainAttributes: {
        hp: { current: 100, max: 100 },
        mp: { current: 50, max: 50 },
        initiative: 0,
        fa: 0, // Força de Ataque
        fm: 0, // Força Mágica
        fd: 0, // Força de Defesa
      },

      // Atributos Básicos (com Valor Base, Bônus Permanente, Bônus Condicional, Total)
      basicAttributes: {
        strength: { base: 10, permBonus: 0, condBonus: 0, total: 10 },
        dexterity: { base: 10, permBonus: 0, condBonus: 0, total: 10 },
        intelligence: { base: 10, permBonus: 0, condBonus: 0, total: 10 },
        constitution: { base: 10, permBonus: 0, condBonus: 0, total: 10 },
        wisdom: { base: 10, permBonus: 0, condBonus: 0, total: 10 },
        charisma: { base: 10, permBonus: 0, condBonus: 0, total: 10 },
        armor: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
        firepower: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
      },
      magicAttributes: {
        fire: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
        water: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
        air: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
        earth: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
        light: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
        darkness: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
        spirit: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
        other: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
      },

      // Inventário
      inventory: [], // [{ name: '', description: '' }]

      // Carteira
      wallet: { zeni: 0 },

      // Vantagens e Desvantagens
      advantages: [], // [{ name: '', description: '', origin: { class: false, race: false, manual: false }, value: 0 }]
      disadvantages: [], // [{ name: '', description: '', origin: { class: false, race: false, manual: false }, value: 0 }]

      // Habilidades de Classe/Raça e Customizadas
      abilities: [], // [{ title: '', description: '' }]

      // Especializações (Perícias)
      specializations: [], // [{ name: '', modifier: 0, bonus: 0 }]

      // Itens Equipados
      equippedItems: [], // [{ name: '', description: '', attributes: '' }] (attributes as text)

      // História e Anotações
      history: '',
      notes: '',
    };
  });

  // Estado para visibilidade e conteúdo do modal
  const [modal, setModal] = useState({
    isVisible: false,
    message: '',
    type: '', // 'prompt', 'confirm', or 'info'
    onConfirm: () => {},
    onCancel: () => {},
  });

  // Estado para indicador de carregamento
  const [isLoading, setIsLoading] = useState(false);

  // Ref para o input de arquivo para acioná-lo programaticamente
  const fileInputRef = useRef(null);

  // Inicializa Firebase e configura o listener de autenticação
  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig);
      const authInstance = getAuth(app);
      const firestoreInstance = getFirestore(app);
      setAuth(authInstance);
      setDb(firestoreInstance);

      // Listener de mudança de estado de autenticação
      const unsubscribe = onAuthStateChanged(authInstance, (currentUser) => {
        setUser(currentUser); // Define o usuário atual
        setIsAuthReady(true); // Autenticação pronta

        if (!currentUser) {
          // Se não houver usuário logado, tenta carregar do localStorage como fallback
          const savedCharacter = localStorage.getItem('rpgCharacterSheet');
          if (savedCharacter) {
            setCharacter(JSON.parse(savedCharacter));
            setModal({
              isVisible: true,
              message: 'Nenhum usuário logado. Carregando ficha do armazenamento local.',
              type: 'info',
              onConfirm: () => {},
              onCancel: () => {},
            });
          }
        }
      });

      return () => unsubscribe(); // Limpa o listener ao desmontar o componente
    } catch (error) {
      console.error("Erro ao inicializar Firebase:", error);
      setModal({
        isVisible: true,
        message: `Erro ao inicializar o aplicativo. Verifique a configuração do Firebase. Detalhes: ${error.message}`,
        type: 'info',
        onConfirm: () => {},
        onCancel: () => {},
      });
    }
  }, [firebaseConfig]); // Adicionado firebaseConfig como dependência

  // Carrega e salva a ficha no Firestore em tempo real via onSnapshot
  useEffect(() => {
    let unsubscribeFirestore = () => {}; // Função para desinscrever o listener

    if (db && user && isAuthReady) {
      const characterDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/characterSheets/myCharacterSheet`);

      // Listener em tempo real para carregar a ficha
      unsubscribeFirestore = onSnapshot(characterDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Deserializa os campos que foram stringificados como JSON
          const deserializedData = { ...data };
          try {
            if (typeof deserializedData.mainAttributes === 'string') deserializedData.mainAttributes = JSON.parse(deserializedData.mainAttributes);
            if (typeof deserializedData.basicAttributes === 'string') deserializedData.basicAttributes = JSON.parse(deserializedData.basicAttributes);
            if (typeof deserializedData.magicAttributes === 'string') deserializedData.magicAttributes = JSON.parse(deserializedData.magicAttributes);
            if (typeof deserializedData.inventory === 'string') deserializedData.inventory = JSON.parse(deserializedData.inventory);
            if (typeof deserializedData.wallet === 'string') deserializedData.wallet = JSON.parse(deserializedData.wallet);
            if (typeof deserializedData.advantages === 'string') deserializedData.advantages = JSON.parse(deserializedData.advantages);
            if (typeof deserializedData.disadvantages === 'string') deserializedData.disadvantages = JSON.parse(deserializedData.disadvantages);
            if (typeof deserializedData.abilities === 'string') deserializedData.abilities = JSON.parse(deserializedData.abilities);
            if (typeof deserializedData.specializations === 'string') deserializedData.specializations = JSON.parse(deserializedData.specializations);
            if (typeof deserializedData.equippedItems === 'string') deserializedData.equippedItems = JSON.parse(deserializedData.equippedItems);
          } catch (e) {
            console.error("Erro ao deserializar dados do Firestore:", e);
            setModal({
              isVisible: true,
              message: `Erro ao carregar dados da ficha: ${e.message}. Os dados podem estar corrompidos.`,
              type: 'info',
              onConfirm: () => {},
              onCancel: () => {},
            });
          }
          setCharacter(deserializedData);
          console.log("Ficha carregada do Firestore em tempo real.");
        } else {
          console.log("Nenhuma ficha encontrada no Firestore para este usuário. Usando estado inicial ou localStorage.");
          // Se não houver ficha no Firestore, carrega do localStorage como fallback
          const savedCharacter = localStorage.getItem('rpgCharacterSheet');
          if (savedCharacter) {
            setCharacter(JSON.parse(savedCharacter));
          }
        }
      }, (error) => {
        console.error("Erro ao ouvir a ficha no Firestore:", error);
        setModal({
          isVisible: true,
          message: `Erro ao carregar ficha do Firestore: ${error.message}`,
          type: 'info',
          onConfirm: () => {},
          onCancel: () => {},
        });
      });
    }

    // Salva a ficha no Firestore sempre que o estado 'character' mudar e o usuário estiver logado
    // Este useEffect é separado do de carregamento para evitar loops e garantir que o salvamento só ocorra após o carregamento inicial
    if (db && user && isAuthReady && character.name) { // Só salva se tiver nome de personagem
      const characterDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/characterSheets/myCharacterSheet`);
      const saveCharacter = async () => {
        try {
          // Serializa objetos complexos para string JSON antes de salvar
          const dataToSave = { ...character };
          dataToSave.mainAttributes = JSON.stringify(dataToSave.mainAttributes);
          dataToSave.basicAttributes = JSON.stringify(dataToSave.basicAttributes);
          dataToSave.magicAttributes = JSON.stringify(dataToSave.magicAttributes);
          dataToSave.inventory = JSON.stringify(dataToSave.inventory);
          dataToSave.wallet = JSON.stringify(dataToSave.wallet);
          dataToSave.advantages = JSON.stringify(dataToSave.advantages);
          dataToSave.disadvantages = JSON.stringify(dataToSave.disadvantages);
          dataToSave.abilities = JSON.stringify(dataToSave.abilities);
          dataToSave.specializations = JSON.stringify(dataToSave.specializations);
          dataToSave.equippedItems = JSON.stringify(dataToSave.equippedItems);

          await setDoc(characterDocRef, dataToSave, { merge: true });
          console.log("Ficha salva automaticamente no Firestore.");
        } catch (error) {
          console.error('Erro ao salvar ficha no Firestore automaticamente:', error);
          // Não mostra modal para salvamento automático para não interromper o usuário
        }
      };
      // Pequeno debounce para evitar muitas gravações rápidas
      const handler = setTimeout(() => {
        saveCharacter();
      }, 500); // Salva 500ms após a última alteração

      return () => {
        clearTimeout(handler); // Limpa o timeout se o componente for desmontado ou o efeito re-executado
        unsubscribeFirestore(); // Garante que o listener de leitura seja limpo
      };
    }
    return () => unsubscribeFirestore(); // Garante que o listener seja limpo mesmo sem salvar
  }, [character, db, user, isAuthReady, appId]); // Dependências para re-executar o efeito

  // Lida com mudanças nos campos de texto simples
  const handleChange = (e) => {
    const { name, value } = e.target;
    setCharacter(prevChar => ({
      ...prevChar,
      [name]: value,
    }));
  };

  // Lida com mudanças nos atributos principais (HP, MP, Iniciativa, FA, FM, FD)
  const handleMainAttributeChange = (e) => {
    const { name, value, dataset } = e.target;
    const attributeName = dataset.attribute; // e.g., 'hp', 'mp'
    const subField = name; // e.g., 'current', 'max'

    setCharacter(prevChar => ({
      ...prevChar,
      mainAttributes: {
        ...prevChar.mainAttributes,
        [attributeName]: {
          ...prevChar.mainAttributes[attributeName],
          [subField]: parseInt(value, 10) || 0,
        },
      },
    }));
  };

  // Lida com mudanças nos atributos principais que são apenas um número (Iniciativa, FA, FM, FD)
  const handleSingleMainAttributeChange = (e) => {
    const { name, value } = e.target;
    setCharacter(prevChar => ({
      ...prevChar,
      mainAttributes: {
        ...prevChar.mainAttributes,
        [name]: parseInt(value, 10) || 0,
      },
    }));
  };

  // Lida com mudanças nos atributos básicos e mágicos (Valor Base, Bônus Permanente, Bônus Condicional)
  const handleBasicAttributeChange = (category, attributeName, field, value) => {
    setCharacter(prevChar => {
      const updatedAttribute = {
        ...prevChar[category][attributeName],
        [field]: parseInt(value, 10) || 0,
      };
      // Calcula o total
      updatedAttribute.total = updatedAttribute.base + updatedAttribute.permBonus + updatedAttribute.condBonus;

      return {
        ...prevChar,
        [category]: {
          ...prevChar[category],
          [attributeName]: updatedAttribute,
        },
      };
    });
  };

  // Lida com a adição de itens ao inventário
  const handleAddItem = () => {
    setModal({
      isVisible: true,
      message: 'Digite o nome do item:',
      type: 'prompt',
      onConfirm: (itemName) => {
        if (itemName) {
          setModal({
            isVisible: true,
            message: 'Digite a descrição do item:',
            type: 'prompt',
            onConfirm: (itemDescription) => {
              setCharacter(prevChar => ({
                ...prevChar,
                inventory: [...prevChar.inventory, { name: itemName, description: itemDescription }],
              }));
            },
            onCancel: () => {},
          });
        }
      },
      onCancel: () => {},
    });
  };

  // Lida com a remoção de itens do inventário
  const handleRemoveItem = (indexToRemove) => {
    setCharacter(prevChar => ({
      ...prevChar,
      inventory: prevChar.inventory.filter((_, index) => index !== indexToRemove),
    }));
  };

  // Lida com a mudança de Zeni
  const handleZeniChange = (e) => {
    const value = parseInt(e.target.value, 10) || 0;
    setCharacter(prevChar => ({
      ...prevChar,
      wallet: { ...prevChar.wallet, zeni: value },
    }));
  };

  // Lida com a adição de Vantagem/Desvantagem
  const handleAddPerk = (type) => { // 'advantages' or 'disadvantages'
    setModal({
      isVisible: true,
      message: `Digite o nome da ${type === 'advantages' ? 'Vantagem' : 'Desvantagem'}:`,
      type: 'prompt',
      onConfirm: (name) => {
        if (name) {
          setModal({
            isVisible: true,
            message: `Digite a descrição da ${name}:`,
            type: 'prompt',
            onConfirm: (description) => {
              setModal({
                isVisible: true,
                message: `Digite o valor da ${name}:`,
                type: 'prompt',
                onConfirm: (value) => {
                  setCharacter(prevChar => ({
                    ...prevChar,
                    [type]: [...prevChar[type], { name, description, origin: { class: false, race: false, manual: false }, value: parseInt(value, 10) || 0 }],
                  }));
                },
                onCancel: () => {},
              });
            },
            onCancel: () => {},
          });
        }
      },
      onCancel: () => {},
    });
  };

  // Lida com a remoção de Vantagem/Desvantagem
  const handleRemovePerk = (type, indexToRemove) => {
    setCharacter(prevChar => ({
      ...prevChar,
      [type]: prevChar[type].filter((_, index) => index !== indexToRemove),
    }));
  };

  // Lida com a mudança de origem da Vantagem/Desvantagem
  const handlePerkOriginChange = (type, index, originType) => {
    setCharacter(prevChar => {
      const updatedPerks = [...prevChar[type]];
      updatedPerks[index].origin[originType] = !updatedPerks[index].origin[originType];
      return { ...prevChar, [type]: updatedPerks };
    });
  };

  // Lida com a adição de Habilidade (Classe/Raça/Customizada)
  const handleAddAbility = () => {
    setModal({
      isVisible: true,
      message: 'Digite o título da Habilidade:',
      type: 'prompt',
      onConfirm: (title) => {
        if (title) {
          setModal({
            isVisible: true,
            message: `Digite a descrição da habilidade "${title}":`,
            type: 'prompt',
            onConfirm: (description) => {
              setCharacter(prevChar => ({
                ...prevChar,
                abilities: [...prevChar.abilities, { title, description }],
              }));
            },
            onCancel: () => {},
          });
        }
      },
      onCancel: () => {},
    });
  };

  // Lida com a remoção de Habilidade
  const handleRemoveAbility = (indexToRemove) => {
    setCharacter(prevChar => ({
      ...prevChar,
      abilities: prevChar.abilities.filter((_, index) => index !== indexToRemove),
    }));
  };

  // Lida com a adição de Especialização
  const handleAddSpecialization = () => {
    setModal({
      isVisible: true,
      message: 'Digite o nome da Especialização:',
      type: 'prompt',
      onConfirm: (name) => {
        if (name) {
          setCharacter(prevChar => ({
            ...prevChar,
            specializations: [...prevChar.specializations, { name, modifier: 0, bonus: 0 }],
          }));
        }
      },
      onCancel: () => {},
    });
  };

  // Lida com a remoção de Especialização
  const handleRemoveSpecialization = (indexToRemove) => {
    setCharacter(prevChar => ({
      ...prevChar,
      specializations: prevChar.specializations.filter((_, index) => index !== indexToRemove),
    }));
  };

  // Lida com a mudança de modificador/bônus da Especialização
  const handleSpecializationChange = (index, field, value) => {
    setCharacter(prevChar => {
      const updatedSpecs = [...prevChar.specializations];
      updatedSpecs[index][field] = parseInt(value, 10) || 0;
      return { ...prevChar, specializations: updatedSpecs };
    });
  };

  // Lida com a adição de Item Equipado
  const handleAddEquippedItem = () => {
    setModal({
      isVisible: true,
      message: 'Digite o nome do Item Equipado:',
      type: 'prompt',
      onConfirm: (name) => {
        if (name) {
          setModal({
            isVisible: true,
            message: `Digite a descrição do item "${name}":`,
            type: 'prompt',
            onConfirm: (description) => {
              setModal({
                isVisible: true,
                message: `Digite os atributos/efeitos do item "${name}" (ex: +5 Força, Dano Fogo):`,
                type: 'prompt',
                onConfirm: (attributes) => {
                  setCharacter(prevChar => ({
                    ...prevChar,
                    equippedItems: [...prevChar.equippedItems, { name, description, attributes }],
                  }));
                },
                onCancel: () => {},
              });
            },
            onCancel: () => {},
          });
        }
      },
      onCancel: () => {},
    });
  };

  // Lida com a remoção de Item Equipado
  const handleRemoveEquippedItem = (indexToRemove) => {
    setCharacter(prevChar => ({
      ...prevChar,
      equippedItems: prevChar.equippedItems.filter((_, index) => index !== indexToRemove),
    }));
  };

  // Lida com a mudança de texto para História e Anotações
  const handleLongTextChange = (e) => {
    const { name, value } = e.target;
    setCharacter(prevChar => ({
      ...prevChar,
      [name]: value,
    }));
  };

  // Função para resetar a ficha do personagem para os valores padrão usando o modal personalizado
  const handleReset = () => {
    setModal({
      isVisible: true,
      message: 'Tem certeza que deseja resetar a ficha? Todos os dados serão perdidos.',
      type: 'confirm',
      onConfirm: () => {
        setCharacter({
          // Informações do Personagem
          name: '',
          photoUrl: 'https://placehold.co/150x150/000000/FFFFFF?text=Foto',
          age: '',
          height: '',
          gender: '',
          race: '',
          class: '',
          alignment: '',

          // Atributos Principais (HP, MP, etc.)
          mainAttributes: {
            hp: { current: 100, max: 100 },
            mp: { current: 50, max: 50 },
            initiative: 0,
            fa: 0,
            fm: 0,
            fd: 0,
          },

          // Atributos Básicos (com Valor Base, Bônus Permanente, Bônus Condicional, Total)
          basicAttributes: {
            strength: { base: 10, permBonus: 0, condBonus: 0, total: 10 },
            dexterity: { base: 10, permBonus: 0, condBonus: 0, total: 10 },
            intelligence: { base: 10, permBonus: 0, condBonus: 0, total: 10 },
            constitution: { base: 10, permBonus: 0, condBonus: 0, total: 10 },
            wisdom: { base: 10, permBonus: 0, condBonus: 0, total: 10 },
            charisma: { base: 10, permBonus: 0, condBonus: 0, total: 10 },
            armor: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
            firepower: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
          },
          magicAttributes: {
            fire: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
            water: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
            air: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
            earth: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
            light: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
            darkness: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
            spirit: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
            other: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
          },

          // Inventário
          inventory: [],

          // Carteira
          wallet: { zeni: 0 },

          // Vantagens e Desvantagens
          advantages: [],
          disadvantages: [],

          // Habilidades de Classe/Raça e Customizadas
          abilities: [],

          // Especializações (Perícias)
          specializations: [],

          // Itens Equipados
          equippedItems: [],

          // História e Anotações
          history: '',
          notes: '',
        });
      },
      onCancel: () => {},
    });
  };

  // Função para exportar os dados do personagem como JSON
  const handleExportJson = () => {
    const jsonString = JSON.stringify(character, null, 2); // Formata o JSON para melhor leitura
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${character.name || 'ficha_rpg'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url); // Libera o objeto URL
  };

  // Função para acionar o input de arquivo para importação de JSON
  const handleImportJsonClick = () => {
    fileInputRef.current.click();
  };

  // Função para lidar com a importação de arquivo JSON
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedData = JSON.parse(e.target.result);
          // Validação básica para garantir que é uma estrutura de ficha de personagem
          if (importedData.name && importedData.mainAttributes && importedData.basicAttributes) {
            setModal({
              isVisible: true,
              message: 'Tem certeza que deseja importar esta ficha? Os dados atuais serão substituídos.',
              type: 'confirm',
              onConfirm: () => {
                setCharacter(importedData);
              },
              onCancel: () => {
                // Não faz nada se cancelado
              },
            });
          } else {
            setModal({
              isVisible: true,
              message: 'O arquivo JSON selecionado não parece ser uma ficha de personagem válida.',
              type: 'info', // Usando tipo info para uma mensagem simples de "OK"
              onConfirm: () => {}, // Nenhuma ação necessária ao confirmar para uma mensagem de informação
              onCancel: () => {},
            });
          }
        } catch (error) {
          setModal({
            isVisible: true,
            message: 'Erro ao ler o arquivo JSON. Certifique-se de que é um JSON válido.',
            type: 'info',
            onConfirm: () => {},
            onCancel: () => {},
          });
          console.error('Erro ao analisar arquivo JSON:', error);
        }
      };
      reader.readAsText(file);
    }
  };

  // --- Funções de Autenticação com Google ---
  const handleGoogleSignIn = async () => {
    if (!auth) {
      setModal({
        isVisible: true,
        message: 'Firebase Auth não inicializado.',
        type: 'info',
        onConfirm: () => {},
        onCancel: () => {},
      });
      return;
    }
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setModal({
        isVisible: true,
        message: 'Login com Google realizado com sucesso!',
        type: 'info',
        onConfirm: () => {},
        onCancel: () => {},
      });
    } catch (error) {
      console.error("Erro no login com Google:", error);
      let errorMessage = "Erro ao fazer login com Google.";
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = "Login cancelado pelo usuário.";
      } else if (error.code === 'auth/cancelled-popup-request') {
        errorMessage = "Requisição de popup de login já em andamento. Por favor, tente novamente.";
      } else {
        errorMessage += ` Detalhes: ${error.message}`;
      }
      setModal({
        isVisible: true,
        message: errorMessage,
        type: 'info',
        onConfirm: () => {},
        onCancel: () => {},
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!auth) return;
    setIsLoading(true);
    try {
      await signOut(auth);
      setCharacter({ // Reseta a ficha para o estado inicial após o logout
        name: '', photoUrl: 'https://placehold.co/150x150/000000/FFFFFF?text=Foto', age: '', height: '', gender: '', race: '', class: '', alignment: '',
        mainAttributes: { hp: { current: 100, max: 100 }, mp: { current: 50, max: 50 }, initiative: 0, fa: 0, fm: 0, fd: 0 },
        basicAttributes: { strength: { base: 10, permBonus: 0, condBonus: 0, total: 10 }, dexterity: { base: 10, permBonus: 0, condBonus: 0, total: 10 }, intelligence: { base: 10, permBonus: 0, condBonus: 0, total: 10 }, constitution: { base: 10, permBonus: 0, condBonus: 0, total: 10 }, wisdom: { base: 10, permBonus: 0, condBonus: 0, total: 10 }, charisma: { base: 10, permBonus: 0, condBonus: 0, total: 10 }, armor: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, firepower: { base: 0, permBonus: 0, condBonus: 0, total: 0 } },
        magicAttributes: { fire: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, water: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, air: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, earth: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, light: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, darkness: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, spirit: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, other: { base: 0, permBonus: 0, condBonus: 0, total: 0 } },
        inventory: [], wallet: { zeni: 0 }, advantages: [], disadvantages: [], abilities: [], specializations: [], equippedItems: [], history: '', notes: '',
      });
      setModal({
        isVisible: true,
        message: 'Você foi desconectado com sucesso.',
        type: 'info',
        onConfirm: () => {},
        onCancel: () => {},
      });
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      setModal({
        isVisible: true,
        message: `Erro ao fazer logout: ${error.message}`,
        type: 'info',
        onConfirm: () => {},
        onCancel: () => {},
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 font-inter">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
          body {
            font-family: 'Inter', sans-serif;
          }
        `}
      </style>
      <div className="max-w-4xl mx-auto bg-gray-800 rounded-lg shadow-2xl p-6 md:p-8 border border-gray-700">
        <h1 className="text-4xl font-extrabold text-center text-purple-400 mb-8 tracking-wide">
          Ficha de Personagem RPG
        </h1>

        {/* Informações do Usuário (Firebase Authentication) */}
        <section className="mb-8 p-4 bg-gray-700 rounded-xl shadow-inner border border-gray-600 text-center">
          <h2 className="text-xl font-bold text-yellow-300 mb-2">Status do Usuário</h2>
          {isAuthReady ? (
            user ? (
              <>
                <p className="text-lg text-gray-200">
                  Logado como: <span className="font-semibold text-purple-300">{user.displayName || 'Usuário Google'}</span>
                </p>
                <p className="text-sm text-gray-400 mb-2">{user.email}</p>
                <p className="text-sm text-gray-400 break-all">ID: {user.uid}</p>
                <button
                  onClick={handleSignOut}
                  className="mt-4 px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                  disabled={isLoading}
                >
                  Sair
                </button>
              </>
            ) : (
              <>
                <p className="text-lg text-gray-400 mb-4">Você não está logado.</p>
                <button
                  onClick={handleGoogleSignIn}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                  disabled={isLoading}
                >
                  Login com Google
                </button>
              </>
            )
          ) : (
            <p className="text-lg text-gray-400">Inicializando autenticação...</p>
          )}
          <p className="text-sm text-gray-400 mt-2">
            Sua ficha será salva e carregada automaticamente para o seu ID de usuário logado.
          </p>
        </section>

        {/* Informações do Personagem */}
        <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
          <h2 className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2">Informações do Personagem</h2>
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-6">
            <div className="flex-shrink-0">
              <label htmlFor="photoUrl" className="block text-sm font-medium text-gray-300 mb-1">Foto (URL):</label>
              <img
                src={character.photoUrl}
                alt="Foto do Personagem"
                className="w-32 h-32 object-cover rounded-full border-2 border-purple-500 mb-2"
                onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/150x150/000000/FFFFFF?text=Foto'; }}
              />
              <input
                type="text"
                id="photoUrl"
                name="photoUrl"
                value={character.photoUrl}
                onChange={handleChange}
                className="w-full p-2 bg-gray-600 border border-gray-500 rounded-md text-white text-sm"
                placeholder="URL da imagem"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 flex-grow w-full">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">Nome:</label>
                <input type="text" id="name" name="name" value={character.name} onChange={handleChange} className="w-full p-2 bg-gray-600 border border-gray-500 rounded-md focus:ring-purple-500 focus:border-purple-500 text-white" />
              </div>
              <div>
                <label htmlFor="age" className="block text-sm font-medium text-gray-300 mb-1">Idade:</label>
                <input type="number" id="age" name="age" value={character.age} onChange={handleChange} className="w-full p-2 bg-gray-600 border border-gray-500 rounded-md focus:ring-purple-500 focus:border-purple-500 text-white" />
              </div>
              <div>
                <label htmlFor="height" className="block text-sm font-medium text-gray-300 mb-1">Altura:</label>
                <input type="text" id="height" name="height" value={character.height} onChange={handleChange} className="w-full p-2 bg-gray-600 border border-gray-500 rounded-md focus:ring-purple-500 focus:border-purple-500 text-white" />
              </div>
              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-gray-300 mb-1">Gênero:</label>
                <input type="text" id="gender" name="gender" value={character.gender} onChange={handleChange} className="w-full p-2 bg-gray-600 border border-gray-500 rounded-md focus:ring-purple-500 focus:border-purple-500 text-white" />
              </div>
              <div>
                <label htmlFor="race" className="block text-sm font-medium text-gray-300 mb-1">Raça:</label>
                <input type="text" id="race" name="race" value={character.race} onChange={handleChange} className="w-full p-2 bg-gray-600 border border-gray-500 rounded-md focus:ring-purple-500 focus:border-purple-500 text-white" />
              </div>
              <div>
                <label htmlFor="class" className="block text-sm font-medium text-gray-300 mb-1">Classe:</label>
                <input type="text" id="class" name="class" value={character.class} onChange={handleChange} className="w-full p-2 bg-gray-600 border border-gray-500 rounded-md focus:ring-purple-500 focus:border-purple-500 text-white" />
              </div>
              <div>
                <label htmlFor="alignment" className="block text-sm font-medium text-gray-300 mb-1">Alinhamento:</label>
                <input type="text" id="alignment" name="alignment" value={character.alignment} onChange={handleChange} className="w-full p-2 bg-gray-600 border border-gray-500 rounded-md focus:ring-purple-500 focus:border-purple-500 text-white" />
              </div>
            </div>
          </div>
        </section>

        {/* Atributos Principais */}
        <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
          <h2 className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2">Atributos Principais</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* HP */}
            <div className="flex flex-col items-center p-2 bg-gray-600 rounded-md">
              <label className="text-lg font-medium text-gray-300 mb-1">HP:</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  name="current"
                  data-attribute="hp"
                  value={character.mainAttributes.hp.current}
                  onChange={handleMainAttributeChange}
                  className="w-20 p-2 text-center bg-gray-700 border border-gray-500 rounded-md text-white text-xl font-bold"
                />
                <span className="text-gray-300">/</span>
                <input
                  type="number"
                  name="max"
                  data-attribute="hp"
                  value={character.mainAttributes.hp.max}
                  onChange={handleMainAttributeChange}
                  className="w-20 p-2 text-center bg-gray-700 border border-gray-500 rounded-md text-white text-xl font-bold"
                />
              </div>
            </div>
            {/* MP */}
            <div className="flex flex-col items-center p-2 bg-gray-600 rounded-md">
              <label className="text-lg font-medium text-gray-300 mb-1">MP:</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  name="current"
                  data-attribute="mp"
                  value={character.mainAttributes.mp.current}
                  onChange={handleMainAttributeChange}
                  className="w-20 p-2 text-center bg-gray-700 border border-gray-500 rounded-md text-white text-xl font-bold"
                />
                <span className="text-gray-300">/</span>
                <input
                  type="number"
                  name="max"
                  data-attribute="mp"
                  value={character.mainAttributes.mp.max}
                  onChange={handleMainAttributeChange}
                  className="w-20 p-2 text-center bg-gray-700 border border-gray-500 rounded-md text-white text-xl font-bold"
                />
              </div>
            </div>
            {/* Iniciativa, FA, FM, FD */}
            {['initiative', 'fa', 'fm', 'fd'].map(attr => (
              <div key={attr} className="flex flex-col items-center p-2 bg-gray-600 rounded-md">
                <label htmlFor={attr} className="capitalize text-lg font-medium text-gray-300 mb-1">
                  {attr === 'fa' ? 'FA' : attr === 'fm' ? 'FM' : attr === 'fd' ? 'FD' : 'Iniciativa'}:
                </label>
                <input
                  type="number"
                  id={attr}
                  name={attr}
                  value={character.mainAttributes[attr]}
                  onChange={handleSingleMainAttributeChange}
                  className="w-24 p-2 text-center bg-gray-700 border border-gray-500 rounded-md text-white text-xl font-bold"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Atributos Básicos */}
        <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
          <h2 className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2">Atributos Básicos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Atributos Físicos */}
            <div>
              <h3 className="text-xl font-semibold text-purple-300 mb-3 border-b border-purple-500 pb-1">Físicos</h3>
              {Object.entries(character.basicAttributes).map(([key, attr]) => (
                <div key={key} className="mb-3 p-2 bg-gray-600 rounded-md">
                  <label className="capitalize text-lg font-medium text-gray-200 block mb-1">{key}:</label>
                  <div className="grid grid-cols-4 gap-2 text-sm">
                    <div className="flex flex-col">
                      <span className="text-gray-400">Base</span>
                      <input type="number" value={attr.base} onChange={(e) => handleBasicAttributeChange('basicAttributes', key, 'base', e.target.value)} className="w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-gray-400">Perm. Bônus</span>
                      <input type="number" value={attr.permBonus} onChange={(e) => handleBasicAttributeChange('basicAttributes', key, 'permBonus', e.target.value)} className="w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-gray-400">Cond. Bônus</span>
                      <input type="number" value={attr.condBonus} onChange={(e) => handleBasicAttributeChange('basicAttributes', key, 'condBonus', e.target.value)} className="w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-gray-400">Total</span>
                      <input type="number" value={attr.total} readOnly className="w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white font-bold cursor-not-allowed" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Atributos Mágicos */}
            <div>
              <h3 className="text-xl font-semibold text-purple-300 mb-3 border-b border-purple-500 pb-1">Mágicos</h3>
              {Object.entries(character.magicAttributes).map(([key, attr]) => (
                <div key={key} className="mb-3 p-2 bg-gray-600 rounded-md">
                  <label className="capitalize text-lg font-medium text-gray-200 block mb-1">{key}:</label>
                  <div className="grid grid-cols-4 gap-2 text-sm">
                    <div className="flex flex-col">
                      <span className="text-gray-400">Base</span>
                      <input type="number" value={attr.base} onChange={(e) => handleBasicAttributeChange('magicAttributes', key, 'base', e.target.value)} className="w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-gray-400">Perm. Bônus</span>
                      <input type="number" value={attr.permBonus} onChange={(e) => handleBasicAttributeChange('magicAttributes', key, 'permBonus', e.target.value)} className="w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-gray-400">Cond. Bônus</span>
                      <input type="number" value={attr.condBonus} onChange={(e) => handleBasicAttributeChange('magicAttributes', key, 'condBonus', e.target.value)} className="w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-gray-400">Total</span>
                      <input type="number" value={attr.total} readOnly className="w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white font-bold cursor-not-allowed" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Inventário */}
        <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
          <h2 className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2">Inventário</h2>
          <button
            onClick={handleAddItem}
            className="mb-4 px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
          >
            Adicionar Item
          </button>
          <ul className="list-disc list-inside space-y-2 text-gray-200">
            {character.inventory.length === 0 ? (
              <li className="text-gray-400 italic">Nenhum item no inventário.</li>
            ) : (
              character.inventory.map((item, index) => (
                <li key={index} className="flex flex-col p-3 bg-gray-600 rounded-md shadow-sm">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-lg">{item.name}</span>
                    <button
                      onClick={() => handleRemoveItem(index)}
                      className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                    >
                      Remover
                    </button>
                  </div>
                  <p className="text-sm text-gray-300 italic">{item.description}</p>
                </li>
              ))
            )}
          </ul>
        </section>

        {/* Carteira */}
        <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
          <h2 className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2">Carteira</h2>
          <div className="flex items-center gap-4">
            <label htmlFor="zeni" className="text-lg font-medium text-gray-300">Zeni:</label>
            <input
              type="number"
              id="zeni"
              name="zeni"
              value={character.wallet.zeni}
              onChange={handleZeniChange}
              className="w-32 p-2 bg-gray-600 border border-gray-500 rounded-md focus:ring-purple-500 focus:border-purple-500 text-white text-xl font-bold"
            />
          </div>
        </section>

        {/* Vantagens e Desvantagens */}
        <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
          <h2 className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2">Vantagens e Desvantagens</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Vantagens */}
            <div>
              <h3 className="text-xl font-semibold text-purple-300 mb-3 border-b border-purple-500 pb-1">Vantagens</h3>
              <button
                onClick={() => handleAddPerk('advantages')}
                className="mb-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
              >
                Adicionar Vantagem
              </button>
              <ul className="list-disc list-inside space-y-2 text-gray-200">
                {character.advantages.length === 0 ? (
                  <li className="text-gray-400 italic">Nenhuma vantagem.</li>
                ) : (
                  character.advantages.map((perk, index) => (
                    <li key={index} className="flex flex-col p-3 bg-gray-600 rounded-md shadow-sm">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-lg">{perk.name} ({perk.value})</span>
                        <button
                          onClick={() => handleRemovePerk('advantages', index)}
                          className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                        >
                          Remover
                        </button>
                      </div>
                      <p className="text-sm text-gray-300 italic mb-2">{perk.description}</p>
                      <div className="flex gap-3 text-sm text-gray-400">
                        <span>Origem:</span>
                        <label className="flex items-center gap-1">
                          <input type="checkbox" checked={perk.origin.class} onChange={() => handlePerkOriginChange('advantages', index, 'class')} className="form-checkbox text-purple-500 rounded" /> Classe
                        </label>
                        <label className="flex items-center gap-1">
                          <input type="checkbox" checked={perk.origin.race} onChange={() => handlePerkOriginChange('advantages', index, 'race')} className="form-checkbox text-purple-500 rounded" /> Raça
                        </label>
                        <label className="flex items-center gap-1">
                          <input type="checkbox" checked={perk.origin.manual} onChange={() => handlePerkOriginChange('advantages', index, 'manual')} className="form-checkbox text-purple-500 rounded" /> Manual
                        </label>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* Desvantagens */}
            <div>
              <h3 className="text-xl font-semibold text-purple-300 mb-3 border-b border-purple-500 pb-1">Desvantagens</h3>
              <button
                onClick={() => handleAddPerk('disadvantages')}
                className="mb-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
              >
                Adicionar Desvantagem
              </button>
              <ul className="list-disc list-inside space-y-2 text-gray-200">
                {character.disadvantages.length === 0 ? (
                  <li className="text-gray-400 italic">Nenhuma desvantagem.</li>
                ) : (
                  character.disadvantages.map((perk, index) => (
                    <li key={index} className="flex flex-col p-3 bg-gray-600 rounded-md shadow-sm">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-lg">{perk.name} ({perk.value})</span>
                        <button
                          onClick={() => handleRemovePerk('disadvantages', index)}
                          className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                        >
                          Remover
                        </button>
                      </div>
                      <p className="text-sm text-gray-300 italic mb-2">{perk.description}</p>
                      <div className="flex gap-3 text-sm text-gray-400">
                        <span>Origem:</span>
                        <label className="flex items-center gap-1">
                          <input type="checkbox" checked={perk.origin.class} onChange={() => handlePerkOriginChange('disadvantages', index, 'class')} className="form-checkbox text-purple-500 rounded" /> Classe
                        </label>
                        <label className="flex items-center gap-1">
                          <input type="checkbox" checked={perk.origin.race} onChange={() => handlePerkOriginChange('disadvantages', index, 'race')} className="form-checkbox text-purple-500 rounded" /> Raça
                        </label>
                        <label className="flex items-center gap-1">
                          <input type="checkbox" checked={perk.origin.manual} onChange={() => handlePerkOriginChange('disadvantages', index, 'manual')} className="form-checkbox text-purple-500 rounded" /> Manual
                        </label>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </section>

        {/* Habilidades de Classe/Raça e Customizadas */}
        <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
          <h2 className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2">Habilidades (Classe, Raça, Customizadas)</h2>
          <button
            onClick={handleAddAbility}
            className="mb-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
          >
            Adicionar Habilidade
          </button>
          <ul className="list-disc list-inside space-y-2 text-gray-200">
            {character.abilities.length === 0 ? (
              <li className="text-gray-400 italic">Nenhuma habilidade adicionada.</li>
            ) : (
              character.abilities.map((ability, index) => (
                <li key={index} className="flex flex-col p-3 bg-gray-600 rounded-md shadow-sm">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-lg">{ability.title}</span>
                    <button
                      onClick={() => handleRemoveAbility(index)}
                      className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                    >
                      Remover
                    </button>
                  </div>
                  <p className="text-sm text-gray-300 italic">{ability.description}</p>
                </li>
              ))
            )}
          </ul>
        </section>

        {/* Especializações (Perícias) */}
        <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
          <h2 className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2">Especializações (Perícias)</h2>
          <button
            onClick={handleAddSpecialization}
            className="mb-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
          >
            Adicionar Especialização
          </button>
          <ul className="list-disc list-inside space-y-2 text-gray-200">
            {character.specializations.length === 0 ? (
              <li className="text-gray-400 italic">Nenhuma especialização adicionada.</li>
            ) : (
              character.specializations.map((spec, index) => (
                <li key={index} className="flex flex-col p-3 bg-gray-600 rounded-md shadow-sm">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-lg">{spec.name}</span>
                    <button
                      onClick={() => handleRemoveSpecialization(index)}
                      className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                    >
                      Remover
                    </button>
                  </div>
                  <div className="flex gap-4 mt-2 text-sm">
                    <label className="flex items-center gap-1">
                      Modificador:
                      <input
                        type="number"
                        value={spec.modifier}
                        onChange={(e) => handleSpecializationChange(index, 'modifier', e.target.value)}
                        className="w-16 p-1 bg-gray-700 border border-gray-500 rounded-md text-white"
                      />
                    </label>
                    <label className="flex items-center gap-1">
                      Bônus:
                      <input
                        type="number"
                        value={spec.bonus}
                        onChange={(e) => handleSpecializationChange(index, 'bonus', e.target.value)}
                        className="w-16 p-1 bg-gray-700 border border-gray-500 rounded-md text-white"
                      />
                    </label>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>

        {/* Itens Equipados */}
        <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
          <h2 className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2">Itens Equipados</h2>
          <button
            onClick={handleAddEquippedItem}
            className="mb-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
          >
            Adicionar Item Equipado
          </button>
          <ul className="list-disc list-inside space-y-2 text-gray-200">
            {character.equippedItems.length === 0 ? (
              <li className="text-gray-400 italic">Nenhum item equipado.</li>
            ) : (
              character.equippedItems.map((item, index) => (
                <li key={index} className="flex flex-col p-3 bg-gray-600 rounded-md shadow-sm">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-lg">{item.name}</span>
                    <button
                      onClick={() => handleRemoveEquippedItem(index)}
                      className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                    >
                      Remover
                    </button>
                  </div>
                  <p className="text-sm text-gray-300 italic mb-2">{item.description}</p>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Atributos/Efeitos:</label>
                  <textarea
                    value={item.attributes}
                    onChange={(e) => {
                      const updatedItems = [...character.equippedItems];
                      updatedItems[index].attributes = e.target.value;
                      setCharacter({ ...character, equippedItems: updatedItems });
                    }}
                    rows="2"
                    className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white text-sm resize-y"
                    placeholder="Ex: +5 Força, Dano de Fogo, etc."
                  ></textarea>
                </li>
              ))
            )}
          </ul>
        </section>

        {/* História do Personagem e Anotações */}
        <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
          <h2 className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2">História do Personagem</h2>
          <textarea
            name="history"
            value={character.history}
            onChange={handleLongTextChange}
            rows="8"
            className="w-full p-3 bg-gray-600 border border-gray-500 rounded-md focus:ring-purple-500 focus:border-purple-500 text-white resize-y"
            placeholder="Escreva aqui a história completa do seu personagem, eventos importantes, etc."
          ></textarea>

          <h2 className="text-2xl font-bold text-yellow-300 mb-4 mt-6 border-b-2 border-yellow-500 pb-2">Anotações</h2>
          <textarea
            name="notes"
            value={character.notes}
            onChange={handleLongTextChange}
            rows="6"
            className="w-full p-3 bg-gray-600 border border-gray-500 rounded-md focus:ring-purple-500 focus:border-purple-500 text-white resize-y"
            placeholder="Anotações diversas sobre o personagem, campanhas, NPCs, etc."
          ></textarea>
        </section>

        {/* Botões de Ação */}
        <div className="flex flex-wrap justify-center gap-4 mt-8">
          <button
            onClick={handleExportJson}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-lg transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75"
            disabled={isLoading || !user}
          >
            Exportar Ficha (JSON)
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden" // Esconde o input de arquivo real
          />
          <button
            onClick={handleImportJsonClick}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-lg transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75"
            disabled={isLoading || !user}
          >
            Importar Ficha (JSON)
          </button>
          <button
            onClick={handleReset}
            className="px-8 py-3 bg-red-700 hover:bg-red-800 text-white font-bold rounded-lg shadow-lg transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
            disabled={isLoading || !user}
          >
            Resetar Ficha
          </button>
        </div>
      </div>

      {/* Modal Personalizado */}
      {modal.isVisible && (
        <CustomModal
          message={modal.message}
          onConfirm={modal.onConfirm}
          onCancel={modal.onCancel}
          type={modal.type}
          onClose={() => setModal({ ...modal, isVisible: false })}
        />
      )}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="text-white text-xl font-bold">Carregando...</div>
        </div>
      )}
    </div>
  );
};

export default App;

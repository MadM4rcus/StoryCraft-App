import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, getDocs, getDoc, deleteDoc } from 'firebase/firestore';

// Componente Modal para prompts e confirmações personalizadas
const CustomModal = ({ message, onConfirm, onCancel, type, onClose }) => {
  const [inputValue, setInputValue] = useState('');

  const handleConfirm = () => {
    if (type === 'prompt') {
      onConfirm(inputValue);
    } else {
      onConfirm();
      onClose();
    }
  };

  const handleCancel = () => {
    onCancel();
    onClose();
  };

  // Determina o texto do botão de confirmação baseado no tipo de modal
  const confirmButtonText = useMemo(() => {
    switch (type) {
      case 'confirm':
        return 'Confirmar';
      case 'prompt':
        return 'Adicionar';
      case 'info':
      default:
        return 'OK';
    }
  }, [type]);

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
            {confirmButtonText}
          </button>
          {type !== 'info' && (
            <button
              onClick={handleCancel}
              className="px-5 py-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Função auxiliar para exibir 0 como vazio
const displayValue = (value) => {
  return value === 0 ? '' : value;
};

// Função para ajustar a altura da textarea
const adjustTextareaHeight = (element) => {
  if (element) {
    element.style.height = 'auto'; // Reseta a altura para calcular o scrollHeight corretamente
    element.style.height = (element.scrollHeight) + 'px';
  }
};

// Componente principal da aplicação
const App = () => {
  // Configuração do Firebase
  const firebaseConfig = useMemo(() => ({
    apiKey: "AIzaSyDfsK4K4vhOmSSGeVHOlLnJuNlHGNha4LU",
    authDomain: "storycraft-a5f7e.firebaseapp.com",
    projectId: "storycraft-a5f7e",
    storageBucket: "storycraft-a5f7e.firebaseapp.com",
    messagingSenderId: "727724875985",
    appId: "1:727724875985:web:97411448885c68c289e5f0",
    measurementId: "G-JH03Y2NZDK"
  }), []);
  const appId = firebaseConfig.appId;

  // Estados para Firebase
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isMaster, setIsMaster] = useState(false);

  // Estados para gerenciamento de personagens
  const [character, setCharacter] = useState(null);
  const [charactersList, setCharactersList] = useState([]);
  
  // Novos estados para o ID do personagem selecionado e UID do proprietário
  const [selectedCharIdState, setSelectedCharIdState] = useState(null);
  const [ownerUidState, setOwnerUidState] = useState(null);

  const [viewingAllCharacters, setViewingAllCharacters] = useState(false);

  // Estado para visibilidade e conteúdo do modal
  const [modal, setModal] = useState({
    isVisible: false,
    message: '',
    type: '',
    onConfirm: () => {},
    onCancel: () => {},
  });

  // Estado para indicador de carregamento
  const [isLoading, setIsLoading] = useState(false);

  // Estado para o valor de Zeni a ser adicionado/removido
  const [zeniAmount, setZeniAmount] = useState(0);

  // Ref para o input de arquivo para acioná-lo programaticamente
  const fileInputRef = useRef(null);
  // Refs para textareas para autoajuste
  const notesTextareaRef = useRef(null);
  const historyTextareaRefs = useRef({}); // Objeto para armazenar refs de textareas de história

  // Mapeamento de atributos básicos para emojis
  const basicAttributeEmojis = {
    forca: '💪',
    destreza: '🏃‍♂️',
    inteligencia: '🧠',
    constituicao: '❤️‍🩹',
    sabedoria: '🧘‍♂️',
    carisma: '🎭',
    armadura: '🦴',
    poderDeFogo: '🎯',
  };

  // Mapeamento de atributos mágicos para emojis e seus nomes em português
  const magicAttributeEmojis = {
    fogo: '🔥',
    agua: '💧',
    ar: '🌬️',
    terra: '🪨',
    luz: '🌟',
    trevas: '🌑',
    espirito: '🌀',
    outro: '🪄',
  };

  // Inicializa Firebase e configura o listener de autenticação
  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig);
      const authInstance = getAuth(app);
      const firestoreInstance = getFirestore(app);
      setAuth(authInstance);
      setDb(firestoreInstance);

      const unsubscribe = onAuthStateChanged(authInstance, (currentUser) => {
        setUser(currentUser);
        setIsAuthReady(true);
        if (!currentUser) {
          setCharacter(null);
          setCharactersList([]);
          // Limpar selectedCharIdState e ownerUidState ao deslogar
          setSelectedCharIdState(null);
          setOwnerUidState(null);
          window.history.pushState({}, '', window.location.pathname);
          setViewingAllCharacters(false);
          setIsMaster(false);
        }
      });
      return () => unsubscribe();
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
  }, [firebaseConfig]);

  // Efeito para inicializar selectedCharIdState e ownerUidState a partir da URL na primeira renderização
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialCharId = params.get('charId');
    const initialOwnerUid = params.get('ownerUid');
    setSelectedCharIdState(initialCharId);
    setOwnerUidState(initialOwnerUid);
  }, []); // Executa apenas uma vez no carregamento inicial

  // Efeito para carregar o papel do usuário (mestre/jogador) do Firestore
  useEffect(() => {
    let unsubscribeRole = () => {};
    if (db && user && isAuthReady) {
      const userRoleDocRef = doc(db, `artifacts/${appId}/users/${user.uid}`);
      unsubscribeRole = onSnapshot(userRoleDocRef, (docSnap) => {
        if (docSnap.exists() && docSnap.data().isMaster === true) {
          setIsMaster(true);
        } else {
          setIsMaster(false);
        }
      }, (error) => {
        console.error("Erro ao carregar papel do usuário:", error);
        setIsMaster(false);
      });
    } else {
      setIsMaster(false);
    }
    return () => unsubscribeRole();
  }, [db, user, isAuthReady, appId]);

  // Função para carregar a lista de personagens
  const fetchCharactersList = useCallback(async () => {
    if (!db || !user || !isAuthReady) {
      console.log("fetchCharactersList: DB, user, or auth not ready.");
      return;
    }

    setIsLoading(true);
    try {
      let allChars = [];
      if (isMaster) {
        console.log("fetchCharactersList: Master mode, fetching all characters.");
        const usersCollectionRef = collection(db, `artifacts/${appId}/users`);
        const usersSnapshot = await getDocs(usersCollectionRef);
        
        for (const userDoc of usersSnapshot.docs) {
          const userUid = userDoc.id;
          const userCharacterSheetsRef = collection(db, `artifacts/${appId}/users/${userUid}/characterSheets`);
          const charSnapshot = await getDocs(userCharacterSheetsRef);
          charSnapshot.docs.forEach(doc => {
            if (!doc.data().deleted) {
              allChars.push({ id: doc.id, ownerUid: userUid, ...doc.data() });
            }
          });
        }
        setCharactersList(allChars);
        setViewingAllCharacters(true);
        console.log("fetchCharactersList: All characters loaded for master.", allChars);
      } else {
        console.log("fetchCharactersList: Player mode, fetching own characters.");
        const charactersCollectionRef = collection(db, `artifacts/${appId}/users/${user.uid}/characterSheets`);
        const q = query(charactersCollectionRef);
        const querySnapshot = await getDocs(q);
        const chars = querySnapshot.docs.map(doc => {
            if (!doc.data().deleted) {
                return { id: doc.id, ownerUid: user.uid, ...doc.data() };
            }
            return null;
        }).filter(Boolean);
        setCharactersList(chars);
        setViewingAllCharacters(false);
        console.log("fetchCharactersList: Player characters loaded.", chars);
      }
    } catch (error) {
      console.error("Erro ao carregar lista de personagens:", error);
      setModal({
        isVisible: true,
        message: `Erro ao carregar lista de personagens: ${error.message}`,
        type: 'info',
        onConfirm: () => {},
        onCancel: () => {},
      });
    } finally {
      setIsLoading(false);
    }
  }, [db, user, isAuthReady, isMaster, appId]);

  // Carrega a lista de personagens quando o user, db ou isAuthReady mudam
  useEffect(() => {
    if (user && db && isAuthReady) {
      console.log("useEffect (fetchCharactersList trigger): User, DB, Auth ready.");
      fetchCharactersList();
    }
  }, [user, db, isAuthReady, fetchCharactersList]);

  // Listener em tempo real para o personagem selecionado
  useEffect(() => {
    let unsubscribeCharacter = () => {};
    const currentSelectedCharacterId = selectedCharIdState; // Usando o estado
    const currentOwnerUidFromUrl = ownerUidState; // Usando o estado
    console.log('useEffect (character loading) triggered. selectedCharacterId:', currentSelectedCharacterId, 'ownerUidFromUrl:', currentOwnerUidFromUrl, 'isMaster:', isMaster, 'user:', user?.uid);

    if (db && user && isAuthReady && currentSelectedCharacterId) {
      const loadCharacter = async () => {
        setIsLoading(true);
        let targetUid = currentOwnerUidFromUrl; // Prioriza ownerUid do estado

        if (!targetUid) { // Se ownerUid não está no estado (ex: acesso direto ou link antigo)
          if (isMaster) {
            console.log('Master mode, ownerUid not in state. Searching for ownerUid for character:', currentSelectedCharacterId);
            const usersCollectionRef = collection(db, `artifacts/${appId}/users`);
            let foundOwnerUid = null;
            try {
              const usersSnapshot = await getDocs(usersCollectionRef);
              for (const userDoc of usersSnapshot.docs) {
                const userUid = userDoc.id;
                const charDocRef = doc(db, `artifacts/${appId}/users/${userUid}/characterSheets/${currentSelectedCharacterId}`);
                const charSnap = await getDoc(charDocRef);
                if (charSnap.exists()) {
                  foundOwnerUid = userUid;
                  break;
                }
              }
            } catch (error) {
              console.error("Error fetching ownerUid for master:", error);
            }
            
            if (foundOwnerUid) {
              targetUid = foundOwnerUid;
              setOwnerUidState(foundOwnerUid); // Atualiza o estado do ownerUid
            } else {
              console.warn(`Character with ID ${currentSelectedCharacterId} not found in any user collection for master. It might have been deleted or still synchronizing.`);
              setCharacter(null);
              setSelectedCharIdState(null); // Limpa o estado
              setOwnerUidState(null); // Limpa o estado
              window.history.pushState({}, '', window.location.pathname);
              fetchCharactersList();
              setIsLoading(false);
              return;
            }
          } else {
            // Para jogadores, se ownerUid não está no estado, deve ser o próprio UID
            targetUid = user.uid;
            setOwnerUidState(user.uid); // Atualiza o estado do ownerUid
            console.log('Player mode, ownerUid not in state. Defaulting to user.uid:', targetUid);
          }
        } else {
          console.log('OwnerUid found in state:', targetUid);
        }

        // Se targetUid ainda é null/undefined após todas as verificações, algo está errado.
        if (!targetUid) {
          console.error('Could not determine targetUid for character loading.');
          setIsLoading(false);
          setCharacter(null);
          setSelectedCharIdState(null); // Limpa o estado
          setOwnerUidState(null); // Limpa o estado
          window.history.pushState({}, '', window.location.pathname);
          return;
        }

        const characterDocRef = doc(db, `artifacts/${appId}/users/${targetUid}/characterSheets/${currentSelectedCharacterId}`);
        console.log('Setting up onSnapshot for characterDocRef:', characterDocRef.path);

        unsubscribeCharacter = onSnapshot(characterDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.deleted) {
              console.log('Character found but marked as deleted.');
              setCharacter(null);
              setSelectedCharIdState(null); // Limpa o estado
              setOwnerUidState(null); // Limpa o estado
              window.history.pushState({}, '', window.location.pathname);
              fetchCharactersList();
              setModal({ isVisible: true, message: "A ficha selecionada foi excluída.", type: "info", onConfirm: () => {}, onCancel: () => {} });
              return;
            }
            const deserializedData = { ...data };
            try {
              deserializedData.mainAttributes = typeof deserializedData.mainAttributes === 'string' ? JSON.parse(deserializedData.mainAttributes) : deserializedData.mainAttributes;
              deserializedData.basicAttributes = typeof deserializedData.basicAttributes === 'string' ? JSON.parse(deserializedData.basicAttributes) : deserializedData.basicAttributes;
              deserializedData.magicAttributes = typeof deserializedData.magicAttributes === 'string' ? JSON.parse(deserializedData.magicAttributes) : deserializedData.magicAttributes;
              deserializedData.inventory = typeof deserializedData.inventory === 'string' ? JSON.parse(deserializedData.inventory) : deserializedData.inventory;
              deserializedData.wallet = typeof deserializedData.wallet === 'string' ? JSON.parse(deserializedData.wallet) : deserializedData.wallet;
              deserializedData.advantages = typeof deserializedData.advantages === 'string' ? JSON.parse(deserializedData.advantages) : deserializedData.advantages;
              deserializedData.disadvantages = typeof deserializedData.disadvantages === 'string' ? JSON.parse(deserializedData.disadvantages) : deserializedData.disadvantages;
              deserializedData.abilities = typeof deserializedData.abilities === 'string' ? JSON.parse(deserializedData.abilities) : deserializedData.abilities;
              deserializedData.specializations = typeof deserializedData.specializations === 'string' ? JSON.parse(deserializedData.specializations) : deserializedData.specializations;
              deserializedData.equippedItems = typeof deserializedData.equippedItems === 'string' ? JSON.parse(deserializedData.equippedItems) : deserializedData.equippedItems;
              
              let historyData = deserializedData.history;
              if (typeof historyData === 'string') {
                try {
                  historyData = JSON.parse(historyData);
                } catch (parseError) {
                  historyData = [{ id: crypto.randomUUID(), type: 'text', value: historyData }];
                }
              }
              deserializedData.history = Array.isArray(historyData) ? historyData : [];

              deserializedData.history = deserializedData.history.map(block => {
                if (block.type === 'image') {
                  return {
                    ...block,
                    width: block.width !== undefined ? block.width : '',
                    height: block.height !== undefined ? block.height : '',
                    fitWidth: block.fitWidth !== undefined ? block.fitWidth : true,
                  };
                }
                return block;
              });

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

            // Ajusta valores padrão para campos que podem ser vazios ou nulos
            deserializedData.mainAttributes = deserializedData.mainAttributes || { hp: { current: '', max: '' }, mp: { current: '', max: '' }, initiative: '', fa: '', fm: '', fd: '' };
            deserializedData.basicAttributes = deserializedData.basicAttributes || { forca: { base: '', permBonus: '', condBonus: '', total: '' }, destreza: { base: '', permBonus: '', condBonus: '', total: '' }, inteligencia: { base: '', permBonus: '', condBonus: '', total: '' }, constituicao: { base: '', permBonus: '', condBonus: '', total: '' }, sabedoria: { base: '', permBonus: '', condBonus: '', total: '' }, carisma: { base: '', permBonus: '', condBonus: '', total: '' }, armadura: { base: '', permBonus: '', condBonus: '', total: '' }, poderDeFogo: { base: '', permBonus: '', condBonus: '', total: '' } };
            deserializedData.magicAttributes = deserializedData.magicAttributes || { fogo: { base: '', permBonus: '', condBonus: '', total: '' }, agua: { base: '', permBonus: '', condBonus: '', total: '' }, ar: { base: '', permBonus: '', condBonus: '', total: '' }, terra: { base: '', permBonus: '', condBonus: '', total: '' }, luz: { base: '', permBonus: '', condBonus: '', total: '' }, trevas: { base: '', permBonus: '', condBonus: '', total: '' }, espirito: { base: '', permBonus: '', condBonus: '', total: '' }, outro: '🪄' };
            deserializedData.inventory = deserializedData.inventory || [];
            deserializedData.wallet = deserializedData.wallet || { zeni: '' }; // Zeni pode ser vazio
            deserializedData.advantages = deserializedData.advantages || [];
            deserializedData.disadvantages = deserializedData.disadvantages || [];
            deserializedData.abilities = deserializedData.abilities || [];
            deserializedData.specializations = deserializedData.specializations || [];
            deserializedData.equippedItems = deserializedData.equippedItems || [];
            deserializedData.history = deserializedData.history || [];
            deserializedData.notes = deserializedData.notes || '';
            deserializedData.level = deserializedData.level !== undefined ? deserializedData.level : ''; // Nível pode ser vazio
            deserializedData.xp = deserializedData.xp !== undefined ? deserializedData.xp : ''; // XP pode ser vazio
            deserializedData.age = deserializedData.age !== undefined ? deserializedData.age : ''; // Idade pode ser vazio
            deserializedData.photoUrl = deserializedData.photoUrl || 'https://placehold.co/150x150/000000/FFFFFF?text=Foto';

            // Carrega os estados de colapso salvos
            deserializedData.uiState = deserializedData.uiState || {};
            deserializedData.uiState.isUserInfoCollapsed = deserializedData.uiState.isUserInfoCollapsed !== undefined ? deserializedData.uiState.isUserInfoCollapsed : false;
            deserializedData.uiState.isCharacterInfoCollapsed = deserializedData.uiState.isCharacterInfoCollapsed !== undefined ? deserializedData.uiState.isCharacterInfoCollapsed : false;
            deserializedData.uiState.isMainAttributesCollapsed = deserializedData.uiState.isMainAttributesCollapsed !== undefined ? deserializedData.uiState.isMainAttributesCollapsed : false;
            deserializedData.uiState.isBasicAttributesCollapsed = deserializedData.uiState.isBasicAttributesCollapsed !== undefined ? deserializedData.uiState.isBasicAttributesCollapsed : false;
            deserializedData.uiState.isInventoryCollapsed = deserializedData.uiState.isInventoryCollapsed !== undefined ? deserializedData.uiState.isInventoryCollapsed : false;
            deserializedData.uiState.isWalletCollapsed = deserializedData.uiState.isWalletCollapsed !== undefined ? deserializedData.uiState.isWalletCollapsed : false;
            deserializedData.uiState.isPerksCollapsed = deserializedData.uiState.isPerksCollapsed !== undefined ? deserializedData.uiState.isPerksCollapsed : false;
            deserializedData.uiState.isAbilitiesCollapsed = deserializedData.uiState.isAbilitiesCollapsed !== undefined ? deserializedData.uiState.isAbilitiesCollapsed : false;
            deserializedData.uiState.isSpecializationsCollapsed = deserializedData.uiState.isSpecializationsCollapsed !== undefined ? deserializedData.uiState.isSpecializationsCollapsed : false;
            deserializedData.uiState.isEquippedItemsCollapsed = deserializedData.uiState.isEquippedItemsCollapsed !== undefined ? deserializedData.uiState.isEquippedItemsCollapsed : false;
            deserializedData.uiState.isHistoryCollapsed = deserializedData.uiState.isHistoryCollapsed !== undefined ? deserializedData.uiState.isHistoryCollapsed : false;
            deserializedData.uiState.isNotesCollapsed = deserializedData.uiState.isNotesCollapsed !== undefined ? deserializedData.uiState.isNotesCollapsed : false;


            setCharacter(deserializedData);
            console.log(`Ficha de '${deserializedData.name}' carregada do Firestore em tempo real.`);
          } else {
            console.log("Nenhuma ficha encontrada para o ID selecionado ou foi excluída.");
            setCharacter(null);
            setSelectedCharIdState(null); // Limpa o estado
            setOwnerUidState(null); // Limpa o estado
            window.history.pushState({}, '', window.location.pathname);
            fetchCharactersList();
          }
          setIsLoading(false);
        }, (error) => {
          console.error("Erro ao ouvir a ficha no Firestore:", error);
          setModal({
            isVisible: true,
            message: `Erro ao carregar ficha do Firestore: ${error.message}`,
            type: 'info',
            onConfirm: () => {},
            onCancel: () => {},
          });
          setIsLoading(false);
        });
      };
      loadCharacter();
    } else if (!currentSelectedCharacterId) {
      console.log('No character ID selected, clearing character state.');
      setCharacter(null);
    }
    return () => {
      console.log('Cleaning up character onSnapshot listener.');
      unsubscribeCharacter();
    };
  }, [db, user, isAuthReady, selectedCharIdState, ownerUidState, appId, isMaster, fetchCharactersList]); // Dependências atualizadas

  // Efeito para ajustar a altura das textareas quando o character muda (ao carregar)
  useEffect(() => {
    if (character) {
      adjustTextareaHeight(notesTextareaRef.current);
      character.history.forEach(block => {
        if (block.type === 'text' && historyTextareaRefs.current[block.id]) {
          adjustTextareaHeight(historyTextareaRefs.current[block.id]);
        }
      });
    }
  }, [character]);

  // Salva a ficha no Firestore
  useEffect(() => {
    if (db && user && isAuthReady && character && selectedCharIdState) { // Usando o estado
      const targetUidForSave = character.ownerUid || user.uid; 

      if (user.uid !== targetUidForSave && !isMaster) {
        console.warn("Tentativa de salvar ficha de outro usuário sem permissão de escrita.");
        return;
      }

      const characterDocRef = doc(db, `artifacts/${appId}/users/${targetUidForSave}/characterSheets/${selectedCharIdState}`); // Usando o estado
      const saveCharacter = async () => {
        try {
          const dataToSave = { ...character };
          dataToSave.id = selectedCharIdState; // Usando o estado
          dataToSave.ownerUid = targetUidForSave;

          // Converter valores vazios de números para null antes de stringify
          const convertToSavableValue = (value) => {
            if (value === '') return null;
            const num = parseInt(value, 10);
            return isNaN(num) ? null : num;
          };

          // Certifique-se de que uiState está presente e é um objeto
          dataToSave.uiState = dataToSave.uiState || {};

          dataToSave.mainAttributes.hp.current = convertToSavableValue(dataToSave.mainAttributes.hp.current);
          dataToSave.mainAttributes.hp.max = convertToSavableValue(dataToSave.mainAttributes.hp.max);
          dataToSave.mainAttributes.mp.current = convertToSavableValue(dataToSave.mainAttributes.mp.current);
          dataToSave.mainAttributes.mp.max = convertToSavableValue(dataToSave.mainAttributes.mp.max);
          dataToSave.mainAttributes.initiative = convertToSavableValue(dataToSave.mainAttributes.initiative);
          dataToSave.mainAttributes.fa = convertToSavableValue(dataToSave.mainAttributes.fa);
          dataToSave.mainAttributes.fm = convertToSavableValue(dataToSave.mainAttributes.fm);
          dataToSave.mainAttributes.fd = convertToSavableValue(dataToSave.mainAttributes.fd);

          Object.keys(dataToSave.basicAttributes).forEach(key => {
            dataToSave.basicAttributes[key].base = convertToSavableValue(dataToSave.basicAttributes[key].base);
            dataToSave.basicAttributes[key].permBonus = convertToSavableValue(dataToSave.basicAttributes[key].permBonus);
            dataToSave.basicAttributes[key].condBonus = convertToSavableValue(dataToSave.basicAttributes[key].condBonus);
            dataToSave.basicAttributes[key].total = convertToSavableValue(dataToSave.basicAttributes[key].total);
          });

          Object.keys(dataToSave.magicAttributes).forEach(key => {
            dataToSave.magicAttributes[key].base = convertToSavableValue(dataToSave.magicAttributes[key].base);
            dataToSave.magicAttributes[key].permBonus = convertToSavableValue(dataToSave.magicAttributes[key].permBonus);
            dataToSave.magicAttributes[key].condBonus = convertToSavableValue(dataToSave.magicAttributes[key].condBonus);
            dataToSave.magicAttributes[key].total = convertToSavableValue(dataToSave.magicAttributes[key].total);
          });
          
          dataToSave.wallet.zeni = convertToSavableValue(dataToSave.wallet.zeni);
          dataToSave.level = convertToSavableValue(dataToSave.level);
          dataToSave.xp = convertToSavableValue(dataToSave.xp);
          dataToSave.age = convertToSavableValue(dataToSave.age);


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
          dataToSave.history = JSON.stringify(dataToSave.history);
          dataToSave.uiState = JSON.stringify(dataToSave.uiState); // Salva o estado da UI

          if ('deleted' in dataToSave) {
            delete dataToSave.deleted;
          }

          await setDoc(characterDocRef, dataToSave, { merge: true });
          console.log(`Ficha de '${character.name}' salva automaticamente no Firestore.`);
        } catch (error) {
          console.error('Erro ao salvar ficha no Firestore automaticamente:', error);
        }
      };
      const handler = setTimeout(() => {
        saveCharacter();
      }, 500);

      return () => clearTimeout(handler);
    }
  }, [character, db, user, isAuthReady, selectedCharIdState, appId, isMaster]); // Dependências atualizadas

  // Lida com mudanças nos campos de texto simples
  const handleChange = (e) => {
    const { name, value } = e.target;
    // Para campos que devem ser números, mas podem ser vazios
    if (name === 'age' || name === 'level' || name === 'xp') {
      setCharacter(prevChar => ({
        ...prevChar,
        [name]: value === '' ? '' : parseInt(value, 10),
      }));
    } else {
      setCharacter(prevChar => ({
        ...prevChar,
        [name]: value,
      }));
    }
    // Ajusta a altura da textarea de anotações
    if (name === 'notes') {
      adjustTextareaHeight(e.target);
    }
  };

  // Lida com mudanças nos atributos principais (HP, MP, Iniciativa, FA, FM, FD)
  const handleMainAttributeChange = (e) => {
    const { name, value, dataset } = e.target;
    const attributeName = dataset.attribute;
    const parsedValue = value === '' ? '' : parseInt(value, 10);

    setCharacter(prevChar => ({
      ...prevChar,
      mainAttributes: {
        ...prevChar.mainAttributes,
        [attributeName]: {
          ...prevChar.mainAttributes[attributeName],
          [name]: parsedValue,
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
        [name]: value === '' ? '' : parseInt(value, 10),
      },
    }));
  };

  // Lida com mudanças nos atributos básicos e mágicos (Valor Base, Bônus Permanente, Bônus Condicional)
  const handleBasicAttributeChange = (category, attributeName, field, value) => {
    setCharacter(prevChar => {
      const parsedValue = value === '' ? '' : parseInt(value, 10);
      const updatedAttribute = {
        ...prevChar[category][attributeName],
        [field]: parsedValue,
      };
      // Recalcula total apenas se base, permBonus e condBonus forem números válidos
      const base = parseInt(updatedAttribute.base, 10) || 0;
      const permBonus = parseInt(updatedAttribute.permBonus, 10) || 0;
      const condBonus = parseInt(updatedAttribute.condBonus, 10) || 0;
      updatedAttribute.total = base + permBonus + condBonus;

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
              setCharacter(prevChar => {
                const updatedInventory = [...(prevChar.inventory || []), { name: itemName, description: itemDescription }];
                return { ...prevChar, inventory: updatedInventory };
              });
              setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
            },
            onCancel: () => {
              setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
            },
          });
        } else {
          setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
        }
      },
      onCancel: () => {
        setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
      },
    });
  };

  // Lida com a edição de itens no inventário
  const handleInventoryItemChange = (index, field, value) => {
    setCharacter(prevChar => {
      const updatedInventory = [...(prevChar.inventory || [])];
      if (updatedInventory[index]) {
        updatedInventory[index][field] = value;
      }
      return { ...prevChar, inventory: updatedInventory };
    });
  };

  // Lida com a remoção de itens do inventário
  const handleRemoveItem = (indexToRemove) => {
    setCharacter(prevChar => {
      const updatedInventory = (prevChar.inventory || []).filter((_, index) => index !== indexToRemove);
      return { ...prevChar, inventory: updatedInventory };
    });
  };

  // Lida com a mudança de Zeni
  const handleZeniChange = (e) => {
    setZeniAmount(parseInt(e.target.value, 10) || 0);
  };

  // Lida com a adição de Zeni
  const handleAddZeni = () => {
    setCharacter(prevChar => ({
      ...prevChar,
      wallet: { ...(prevChar.wallet || { zeni: '' }), zeni: (parseInt(prevChar.wallet.zeni, 10) || 0) + zeniAmount },
    }));
    setZeniAmount(0);
  };

  // Lida com a remoção de Zeni
  const handleRemoveZeni = () => {
    setCharacter(prevChar => ({
      ...prevChar,
      wallet: { ...(prevChar.wallet || { zeni: '' }), zeni: Math.max(0, (parseInt(prevChar.wallet.zeni, 10) || 0) - zeniAmount) },
    }));
    setZeniAmount(0);
  };

  // Lida com a adição de Vantagem/Desvantagem
  const handleAddPerk = (type) => {
    setModal({
      isVisible: true,
      message: `Digite o nome da ${type === 'advantages' ? 'Vantagem' : 'Desvantagem'}:`,
      type: 'prompt',
      onConfirm: (name) => {
        if (name) {
          setModal({
            isVisible: true,
            message: 'Digite a descrição do item:',
            type: 'prompt',
            onConfirm: (description) => {
              setModal({
                isVisible: true,
                message: `Digite o valor da ${name}:`,
                type: 'prompt',
                onConfirm: (value) => {
                  setCharacter(prevChar => {
                    const updatedPerks = [...(prevChar[type] || []), { name, description, origin: { class: false, race: false, manual: false }, value: value === '' ? '' : parseInt(value, 10) }];
                    return { ...prevChar, [type]: updatedPerks };
                  });
                  setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
                },
                onCancel: () => {
                  setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
                },
              });
            },
            onCancel: () => {
              setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
            },
          });
        } else {
          setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
        }
      },
      onCancel: () => {
        setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
      },
    });
  };

  // Lida com a edição de Vantagem/Desvantagem
  const handlePerkChange = (type, index, field, value) => {
    setCharacter(prevChar => {
      const updatedPerks = [...(prevChar[type] || [])];
      if (updatedPerks[index]) {
        if (field === 'value') {
          updatedPerks[index][field] = value === '' ? '' : parseInt(value, 10);
        } else {
          updatedPerks[index][field] = value;
        }
      }
      return { ...prevChar, [type]: updatedPerks };
    });
  };

  // Lida com a remoção de Vantagem/Desvantagem
  const handleRemovePerk = (type, indexToRemove) => {
    setCharacter(prevChar => {
      const updatedPerks = (prevChar[type] || []).filter((_, index) => index !== indexToRemove);
      return { ...prevChar, [type]: updatedPerks };
    });
  };

  // Lida com a mudança de origem da Vantagem/Desvantagem
  const handlePerkOriginChange = (type, index, originType) => {
    setCharacter(prevChar => {
      const updatedPerks = [...(prevChar[type] || [])];
      if (updatedPerks[index]) {
        updatedPerks[index].origin[originType] = !updatedPerks[index].origin[originType];
      }
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
              setCharacter(prevChar => {
                const updatedAbilities = [...(prevChar.abilities || []), { title, description }];
                return { ...prevChar, abilities: updatedAbilities };
              });
              setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
            },
            onCancel: () => {
              setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
            },
          });
        } else {
          setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
        }
      },
      onCancel: () => {
        setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
      },
    });
  };

  // Lida com a edição de Habilidade
  const handleAbilityChange = (index, field, value) => {
    setCharacter(prevChar => {
      const updatedAbilities = [...(prevChar.abilities || [])];
      if (updatedAbilities[index]) {
        updatedAbilities[index][field] = value;
      }
      return { ...prevChar, abilities: updatedAbilities };
    });
  };

  // Lida com a remoção de Habilidade
  const handleRemoveAbility = (indexToRemove) => {
    setCharacter(prevChar => {
      const updatedAbilities = (prevChar.abilities || []).filter((_, index) => index !== indexToRemove);
      return { ...prevChar, abilities: updatedAbilities };
    });
  };

  // Lida com a adição de Especialização
  const handleAddSpecialization = () => {
    setModal({
      isVisible: true,
      message: 'Digite o nome da Especialização:',
      type: 'prompt',
      onConfirm: (name) => {
        if (name) {
          setCharacter(prevChar => {
            const updatedSpecializations = [...(prevChar.specializations || []), { name, modifier: '', bonus: '' }];
            return { ...prevChar, specializations: updatedSpecializations };
          });
          setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
        } else {
          setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
        }
      },
      onCancel: () => {
        setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
      },
    });
  };

  // Lida com a edição de Especialização
  const handleSpecializationChange = (index, field, value) => {
    setCharacter(prevChar => {
      const updatedSpecializations = [...(prevChar.specializations || [])];
      if (updatedSpecializations[index]) {
        if (field === 'bonus') {
          updatedSpecializations[index][field] = value === '' ? '' : parseInt(value, 10);
        } else {
          updatedSpecializations[index][field] = value;
        }
      }
      return { ...prevChar, specializations: updatedSpecializations };
    });
  };

  // Lida com a remoção de Especialização
  const handleRemoveSpecialization = (indexToRemove) => {
    setCharacter(prevChar => {
      const updatedSpecializations = (prevChar.specializations || []).filter((_, index) => index !== indexToRemove);
      return { ...prevChar, specializations: updatedSpecializations };
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
            message: 'Digite a descrição do item:',
            type: 'prompt',
            onConfirm: (description) => {
              setCharacter(prevChar => {
                const updatedEquippedItems = [...(prevChar.equippedItems || []), { name, description }];
                return { ...prevChar, equippedItems: updatedEquippedItems };
              });
              setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
            },
            onCancel: () => {
              setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
            },
          });
        } else {
          setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
        }
      },
      onCancel: () => {
        setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
      },
    });
  };

  // Lida com a edição de Item Equipado
  const handleEquippedItemChange = (index, field, value) => {
    setCharacter(prevChar => {
      const updatedEquippedItems = [...(prevChar.equippedItems || [])];
      if (updatedEquippedItems[index]) {
        updatedEquippedItems[index][field] = value;
      }
      return { ...prevChar, equippedItems: updatedEquippedItems };
    });
  };

  // Lida com a remoção de Item Equipado
  const handleRemoveEquippedItem = (indexToRemove) => {
    setCharacter(prevChar => {
      const updatedEquippedItems = (prevChar.equippedItems || []).filter((_, index) => index !== indexToRemove);
      return { ...prevChar, equippedItems: updatedEquippedItems };
    });
  };

  // Lida com a adição de bloco na história
  const handleAddHistoryBlock = (type) => {
    setCharacter(prevChar => {
      const newBlock = { id: crypto.randomUUID(), type, value: '' };
      if (type === 'image') {
        newBlock.width = '';
        newBlock.height = '';
        newBlock.fitWidth = true;
      }
      return {
        ...prevChar,
        history: [...(prevChar.history || []), newBlock],
      };
    });
  };

  // Lida com a mudança de valor em um bloco da história
  const handleHistoryBlockChange = (id, field, value) => {
    setCharacter(prevChar => {
      const updatedHistory = (prevChar.history || []).map(block => {
        if (block.id === id) {
          const updatedBlock = { ...block, [field]: value };
          // Ajusta a altura da textarea se for um bloco de texto
          if (block.type === 'text' && historyTextareaRefs.current[id]) {
            adjustTextareaHeight(historyTextareaRefs.current[id]);
          }
          return updatedBlock;
        }
        return block;
      });
      return { ...prevChar, history: updatedHistory };
    });
  };

  // Lida com a remoção de um bloco da história
  const handleRemoveHistoryBlock = (idToRemove) => {
    setCharacter(prevChar => ({
      ...prevChar,
      history: (prevChar.history || []).filter(block => block.id !== idToRemove),
    }));
  };

  // Lida com o upload de imagem para a história
  const handleImageUpload = (e, blockId) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleHistoryBlockChange(blockId, 'value', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Lida com a mudança da URL da foto do personagem
  const handlePhotoUrlChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCharacter(prevChar => ({
          ...prevChar,
          photoUrl: reader.result,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Função para fazer login com o Google
  const signInWithGoogle = async () => {
    if (!auth) {
      console.error("Auth não inicializado.");
      return;
    }
    const provider = new GoogleAuthProvider();
    try {
      setIsLoading(true);
      await signInWithPopup(auth, provider);
      setModal({ isVisible: true, message: "Login realizado com sucesso!", type: "info", onConfirm: () => {}, onCancel: () => {} });
    } catch (error) {
      console.error("Erro ao fazer login com o Google:", error);
      setModal({ isVisible: true, message: `Erro ao fazer login: ${error.message}`, type: "info", onConfirm: () => {}, onCancel: () => {} });
    } finally {
      setIsLoading(false);
    }
  };

  // Função para fazer logout
  const handleSignOut = async () => {
    if (!auth) {
      console.error("Auth não inicializado.");
      return;
    }
    try {
      setIsLoading(true);
      await signOut(auth);
      setModal({ isVisible: true, message: "Logout realizado com sucesso!", type: "info", onConfirm: () => {}, onCancel: () => {} });
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      setModal({ isVisible: true, message: `Erro ao fazer logout: ${error.message}`, type: "info", onConfirm: () => {}, onCancel: () => {} });
    } finally {
      setIsLoading(false);
    }
  };

  // Função para criar uma nova ficha de personagem
  const createNewCharacter = async () => {
    if (!db || !user) return;

    setModal({
      isVisible: true,
      message: 'Digite o nome do novo personagem:',
      type: 'prompt',
      onConfirm: async (charName) => {
        if (!charName) {
          setModal({ isVisible: true, message: "Nome do personagem não pode ser vazio.", type: "info", onConfirm: () => {}, onCancel: () => {} });
          return;
        }
        setIsLoading(true);
        try {
          const newCharRef = doc(collection(db, `artifacts/${appId}/users/${user.uid}/characterSheets`));
          const newCharData = {
            id: newCharRef.id,
            ownerUid: user.uid,
            name: charName,
            race: '',
            class: '',
            alignment: '',
            level: '',
            xp: '',
            age: '',
            gender: '',
            height: '',
            weight: '',
            photoUrl: 'https://placehold.co/150x150/000000/FFFFFF?text=Foto',
            mainAttributes: JSON.stringify({ hp: { current: '', max: '' }, mp: { current: '', max: '' }, initiative: '', fa: '', fm: '', fd: '' }),
            basicAttributes: JSON.stringify({ forca: { base: '', permBonus: '', condBonus: '', total: '' }, destreza: { base: '', permBonus: '', condBonus: '', total: '' }, inteligencia: { base: '', permBonus: '', condBonus: '', total: '' }, constituicao: { base: '', permBonus: '', condBonus: '', total: '' }, sabedoria: { base: '', permBonus: '', condBonus: '', total: '' }, carisma: { base: '', permBonus: '', condBonus: '', total: '' }, armadura: { base: '', permBonus: '', condBonus: '', total: '' }, poderDeFogo: { base: '', permBonus: '', condBonus: '', total: '' } }),
            magicAttributes: JSON.stringify({ fogo: { base: '', permBonus: '', condBonus: '', total: '' }, agua: { base: '', permBonus: '', condBonus: '', total: '' }, ar: { base: '', permBonus: '', condBonus: '', total: '' }, terra: { base: '', permBonus: '', condBonus: '', total: '' }, luz: { base: '', permBonus: '', condBonus: '', total: '' }, trevas: { base: '', permBonus: '', condBonus: '', total: '' }, espirito: { base: '', permBonus: '', condBonus: '', total: '' }, outro: { base: '', permBonus: '', condBonus: '', total: '' } }),
            inventory: JSON.stringify([]),
            wallet: JSON.stringify({ zeni: '' }),
            advantages: JSON.stringify([]),
            disadvantages: JSON.stringify([]),
            abilities: JSON.stringify([]),
            specializations: JSON.stringify([]),
            equippedItems: JSON.stringify([]),
            history: JSON.stringify([]),
            notes: '',
            uiState: JSON.stringify({ // Estado inicial da UI
              isUserInfoCollapsed: false,
              isCharacterInfoCollapsed: false,
              isMainAttributesCollapsed: false,
              isBasicAttributesCollapsed: false,
              isInventoryCollapsed: false,
              isWalletCollapsed: false,
              isPerksCollapsed: false,
              isAbilitiesCollapsed: false,
              isSpecializationsCollapsed: false,
              isEquippedItemsCollapsed: false,
              isHistoryCollapsed: false,
              isNotesCollapsed: false,
            }),
            deleted: false, // Flag para exclusão lógica
          };
          await setDoc(newCharRef, newCharData);
          setSelectedCharIdState(newCharRef.id);
          setOwnerUidState(user.uid);
          // Atualiza a URL com o novo charId e ownerUid
          window.history.pushState({}, '', `?charId=${newCharRef.id}&ownerUid=${user.uid}`);
          setModal({ isVisible: true, message: `Ficha de "${charName}" criada com sucesso!`, type: "info", onConfirm: () => {}, onCancel: () => {} });
          fetchCharactersList(); // Recarrega a lista para incluir o novo personagem
        } catch (error) {
          console.error("Erro ao criar nova ficha:", error);
          setModal({ isVisible: true, message: `Erro ao criar ficha: ${error.message}`, type: "info", onConfirm: () => {}, onCancel: () => {} });
        } finally {
          setIsLoading(false);
        }
      },
      onCancel: () => {
        setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
      },
    });
  };

  // Função para carregar uma ficha existente
  const loadCharacter = (charId, ownerUid) => {
    setSelectedCharIdState(charId);
    setOwnerUidState(ownerUid);
    // Atualiza a URL
    window.history.pushState({}, '', `?charId=${charId}&ownerUid=${ownerUid}`);
  };

  // Função para deletar um personagem (exclusão lógica)
  const deleteCharacter = async (charId, ownerUid) => {
    if (!db || !user) return;

    setModal({
      isVisible: true,
      message: "Tem certeza que deseja excluir esta ficha? Esta ação não pode ser desfeita.",
      type: "confirm",
      onConfirm: async () => {
        setIsLoading(true);
        try {
          const charRef = doc(db, `artifacts/${appId}/users/${ownerUid}/characterSheets/${charId}`);
          await setDoc(charRef, { deleted: true }, { merge: true }); // Exclusão lógica
          if (selectedCharIdState === charId) {
            setCharacter(null);
            setSelectedCharIdState(null);
            setOwnerUidState(null);
            window.history.pushState({}, '', window.location.pathname);
          }
          setModal({ isVisible: true, message: "Ficha excluída com sucesso!", type: "info", onConfirm: () => {}, onCancel: () => {} });
          fetchCharactersList(); // Recarrega a lista
        } catch (error) {
          console.error("Erro ao excluir ficha:", error);
          setModal({ isVisible: true, message: `Erro ao excluir ficha: ${error.message}`, type: "info", onConfirm: () => {}, onCancel: () => {} });
        } finally {
          setIsLoading(false);
        }
      },
      onCancel: () => {
        setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
      },
    });
  };

  // Função para alternar o estado de colapso de uma seção
  const toggleSection = (sectionName) => {
    setCharacter(prevChar => ({
      ...prevChar,
      uiState: {
        ...(prevChar.uiState || {}),
        [sectionName]: !prevChar.uiState[sectionName],
      },
    }));
  };

  // Função para alternar o papel de Mestre/Jogador
  const toggleMasterRole = async () => {
    if (!db || !user) return;
    setIsLoading(true);
    try {
      const userRoleDocRef = doc(db, `artifacts/${appId}/users/${user.uid}`);
      await setDoc(userRoleDocRef, { isMaster: !isMaster }, { merge: true });
      setModal({ isVisible: true, message: `Seu papel foi alterado para ${!isMaster ? 'Mestre' : 'Jogador'}.`, type: "info", onConfirm: () => {}, onCancel: () => {} });
      // Força recarregar a lista de personagens para refletir a mudança de papel
      fetchCharactersList();
    } catch (error) {
      console.error("Erro ao alternar papel:", error);
      setModal({ isVisible: true, message: `Erro ao alternar papel: ${error.message}`, type: "info", onConfirm: () => {}, onCancel: () => {} });
    } finally {
      setIsLoading(false);
    }
  };

  // Renderização condicional para exibir a UI após autenticação e carregamento
  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-xl">Carregando autenticação...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-inter">
      <style>
        {`
          /* Custom scrollbar for better aesthetics */
          ::-webkit-scrollbar {
            width: 8px;
          }
          ::-webkit-scrollbar-track {
            background: #333;
            border-radius: 10px;
          }
          ::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 10px;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: #555;
          }
        `}
      </style>
      {modal.isVisible && (
        <CustomModal
          message={modal.message}
          type={modal.type}
          onConfirm={modal.onConfirm}
          onCancel={modal.onCancel}
          onClose={() => setModal({ ...modal, isVisible: false })}
        />
      )}

      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="text-white text-2xl animate-pulse">Carregando...</div>
        </div>
      )}

      <header className="bg-gray-800 p-4 shadow-lg flex flex-col sm:flex-row justify-between items-center rounded-b-lg">
        <h1 className="text-3xl font-bold text-purple-400 mb-3 sm:mb-0">StoryCraft RPG</h1>
        <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
          {user ? (
            <>
              <span className="text-gray-300 text-sm">Bem-vindo, {user.displayName || user.email}!</span>
              <button
                onClick={toggleMasterRole}
                className={`px-4 py-2 rounded-lg font-bold shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-opacity-75 ${
                  isMaster ? 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                } text-white`}
              >
                {isMaster ? 'Modo Mestre' : 'Modo Jogador'}
              </button>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
              >
                Sair
              </button>
            </>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
            >
              Entrar com Google
            </button>
          )}
        </div>
      </header>

      <main className="p-4 max-w-7xl mx-auto">
        {user && (
          <div className="mb-6 bg-gray-800 p-4 rounded-lg shadow-md border border-gray-700">
            <h2 className="text-xl font-semibold text-purple-300 mb-3">Minhas Fichas</h2>
            <div className="flex flex-wrap gap-3 mb-4">
              <button
                onClick={createNewCharacter}
                className="flex-grow sm:flex-grow-0 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
              >
                Criar Nova Ficha
              </button>
              {charactersList.length > 0 && (
                <div className="relative flex-grow sm:flex-grow-0">
                  <select
                    onChange={(e) => {
                      const [charId, ownerUid] = e.target.value.split('|');
                      loadCharacter(charId, ownerUid);
                    }}
                    value={selectedCharIdState ? `${selectedCharIdState}|${ownerUidState}` : ''}
                    className="w-full bg-gray-700 border border-gray-600 text-white py-2 px-3 rounded-lg focus:ring-purple-500 focus:border-purple-500 appearance-none pr-8"
                  >
                    <option value="" disabled>Carregar Ficha Existente</option>
                    {charactersList.map((char) => (
                      <option key={char.id} value={`${char.id}|${char.ownerUid}`}>
                        {char.name} ({char.ownerUid === user.uid ? 'Minha' : `ID: ${char.ownerUid.substring(0, 6)}...`})
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {character ? (
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700">
            {/* Seção de Informações do Usuário/Mestre */}
            <div className="mb-6">
              <div
                className="flex justify-between items-center cursor-pointer p-3 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors duration-200"
                onClick={() => toggleSection('isUserInfoCollapsed')}
              >
                <h2 className="text-2xl font-bold text-purple-300">
                  Informações do Usuário ({character.ownerUid === user.uid ? 'Você' : character.ownerUid})
                </h2>
                <span className="text-purple-300 text-2xl">
                  {character.uiState.isUserInfoCollapsed ? '▼' : '▲'}
                </span>
              </div>
              {!character.uiState.isUserInfoCollapsed && (
                <div className="mt-4 p-4 bg-gray-700 rounded-lg">
                  <p className="text-lg text-gray-200">
                    <span className="font-semibold">ID da Ficha:</span> {character.id}
                  </p>
                  <p className="text-lg text-gray-200">
                    <span className="font-semibold">ID do Proprietário:</span> {character.ownerUid}
                  </p>
                  <p className="text-lg text-gray-200">
                    <span className="font-semibold">Nome do Proprietário:</span> {user.displayName || user.email}
                  </p>
                  {user.uid === character.ownerUid && (
                    <button
                      onClick={() => deleteCharacter(character.id, character.ownerUid)}
                      className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                    >
                      Excluir Ficha
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Seção de Informações do Personagem */}
            <div className="mb-6">
              <div
                className="flex justify-between items-center cursor-pointer p-3 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors duration-200"
                onClick={() => toggleSection('isCharacterInfoCollapsed')}
              >
                <h2 className="text-2xl font-bold text-purple-300">Informações do Personagem</h2>
                <span className="text-purple-300 text-2xl">
                  {character.uiState.isCharacterInfoCollapsed ? '▼' : '▲'}
                </span>
              </div>
              {!character.uiState.isCharacterInfoCollapsed && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-1 flex flex-col items-center p-4 bg-gray-700 rounded-lg shadow-inner">
                    <img
                      src={character.photoUrl}
                      alt="Foto do Personagem"
                      className="w-40 h-40 object-cover rounded-full border-4 border-purple-500 shadow-lg mb-4"
                      onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/150x150/000000/FFFFFF?text=Foto'; }}
                    />
                    <label className="cursor-pointer bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105">
                      Alterar Foto
                      <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUrlChange} />
                    </label>
                  </div>

                  <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-700 rounded-lg shadow-inner">
                    <label className="block">
                      <span className="text-gray-300">Nome:</span>
                      <input
                        type="text"
                        name="name"
                        value={character.name}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md bg-gray-600 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                      />
                    </label>
                    <label className="block">
                      <span className="text-gray-300">Raça:</span>
                      <input
                        type="text"
                        name="race"
                        value={character.race}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md bg-gray-600 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                      />
                    </label>
                    <label className="block">
                      <span className="text-gray-300">Classe:</span>
                      <input
                        type="text"
                        name="class"
                        value={character.class}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md bg-gray-600 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                      />
                    </label>
                    <label className="block">
                      <span className="text-gray-300">Alinhamento:</span>
                      <input
                        type="text"
                        name="alignment"
                        value={character.alignment}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md bg-gray-600 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                      />
                    </label>
                    <label className="block">
                      <span className="text-gray-300">Nível:</span>
                      <input
                        type="number"
                        name="level"
                        value={displayValue(character.level)}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md bg-gray-600 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                      />
                    </label>
                    <label className="block">
                      <span className="text-gray-300">XP:</span>
                      <input
                        type="number"
                        name="xp"
                        value={displayValue(character.xp)}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md bg-gray-600 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                      />
                    </label>
                    <label className="block">
                      <span className="text-gray-300">Idade:</span>
                      <input
                        type="number"
                        name="age"
                        value={displayValue(character.age)}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md bg-gray-600 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                      />
                    </label>
                    <label className="block">
                      <span className="text-gray-300">Gênero:</span>
                      <input
                        type="text"
                        name="gender"
                        value={character.gender}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md bg-gray-600 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                      />
                    </label>
                    <label className="block">
                      <span className="text-gray-300">Altura:</span>
                      <input
                        type="text"
                        name="height"
                        value={character.height}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md bg-gray-600 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                      />
                    </label>
                    <label className="block">
                      <span className="text-gray-300">Peso:</span>
                      <input
                        type="text"
                        name="weight"
                        value={character.weight}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md bg-gray-600 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Seção de Atributos Principais */}
            <div className="mb-6">
              <div
                className="flex justify-between items-center cursor-pointer p-3 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors duration-200"
                onClick={() => toggleSection('isMainAttributesCollapsed')}
              >
                <h2 className="text-2xl font-bold text-purple-300">Atributos Principais</h2>
                <span className="text-purple-300 text-2xl">
                  {character.uiState.isMainAttributesCollapsed ? '▼' : '▲'}
                </span>
              </div>
              {!character.uiState.isMainAttributesCollapsed && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4 bg-gray-700 rounded-lg shadow-inner">
                  {/* HP */}
                  <div className="bg-gray-600 p-4 rounded-lg shadow-md">
                    <h3 className="text-xl font-semibold text-gray-200 mb-2">HP (Vida) ❤️</h3>
                    <div className="flex items-center space-x-2">
                      <label className="block flex-1">
                        <span className="text-gray-400 text-sm">Atual:</span>
                        <input
                          type="number"
                          name="current"
                          data-attribute="hp"
                          value={displayValue(character.mainAttributes.hp.current)}
                          onChange={handleMainAttributeChange}
                          className="mt-1 block w-full rounded-md bg-gray-500 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                        />
                      </label>
                      <span className="text-gray-300 text-2xl">/</span>
                      <label className="block flex-1">
                        <span className="text-gray-400 text-sm">Máx:</span>
                        <input
                          type="number"
                          name="max"
                          data-attribute="hp"
                          value={displayValue(character.mainAttributes.hp.max)}
                          onChange={handleMainAttributeChange}
                          className="mt-1 block w-full rounded-md bg-gray-500 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                        />
                      </label>
                    </div>
                  </div>

                  {/* MP */}
                  <div className="bg-gray-600 p-4 rounded-lg shadow-md">
                    <h3 className="text-xl font-semibold text-gray-200 mb-2">MP (Magia) ✨</h3>
                    <div className="flex items-center space-x-2">
                      <label className="block flex-1">
                        <span className="text-gray-400 text-sm">Atual:</span>
                        <input
                          type="number"
                          name="current"
                          data-attribute="mp"
                          value={displayValue(character.mainAttributes.mp.current)}
                          onChange={handleMainAttributeChange}
                          className="mt-1 block w-full rounded-md bg-gray-500 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                        />
                      </label>
                      <span className="text-gray-300 text-2xl">/</span>
                      <label className="block flex-1">
                        <span className="text-gray-400 text-sm">Máx:</span>
                        <input
                          type="number"
                          name="max"
                          data-attribute="mp"
                          value={displayValue(character.mainAttributes.mp.max)}
                          onChange={handleMainAttributeChange}
                          className="mt-1 block w-full rounded-md bg-gray-500 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Iniciativa */}
                  <div className="bg-gray-600 p-4 rounded-lg shadow-md">
                    <h3 className="text-xl font-semibold text-gray-200 mb-2">Iniciativa ⚡</h3>
                    <label className="block">
                      <input
                        type="number"
                        name="initiative"
                        value={displayValue(character.mainAttributes.initiative)}
                        onChange={handleSingleMainAttributeChange}
                        className="mt-1 block w-full rounded-md bg-gray-500 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                      />
                    </label>
                  </div>

                  {/* FA */}
                  <div className="bg-gray-600 p-4 rounded-lg shadow-md">
                    <h3 className="text-xl font-semibold text-gray-200 mb-2">FA (Força de Ataque) ⚔️</h3>
                    <label className="block">
                      <input
                        type="number"
                        name="fa"
                        value={displayValue(character.mainAttributes.fa)}
                        onChange={handleSingleMainAttributeChange}
                        className="mt-1 block w-full rounded-md bg-gray-500 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                      />
                    </label>
                  </div>

                  {/* FM */}
                  <div className="bg-gray-600 p-4 rounded-lg shadow-md">
                    <h3 className="text-xl font-semibold text-gray-200 mb-2">FM (Força Mágica) 🪄</h3>
                    <label className="block">
                      <input
                        type="number"
                        name="fm"
                        value={displayValue(character.mainAttributes.fm)}
                        onChange={handleSingleMainAttributeChange}
                        className="mt-1 block w-full rounded-md bg-gray-500 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                      />
                    </label>
                  </div>

                  {/* FD */}
                  <div className="bg-gray-600 p-4 rounded-lg shadow-md">
                    <h3 className="text-xl font-semibold text-gray-200 mb-2">FD (Força de Defesa) 🛡️</h3>
                    <label className="block">
                      <input
                        type="number"
                        name="fd"
                        value={displayValue(character.mainAttributes.fd)}
                        onChange={handleSingleMainAttributeChange}
                        className="mt-1 block w-full rounded-md bg-gray-500 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Seção de Atributos Básicos */}
            <div className="mb-6">
              <div
                className="flex justify-between items-center cursor-pointer p-3 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors duration-200"
                onClick={() => toggleSection('isBasicAttributesCollapsed')}
              >
                <h2 className="text-2xl font-bold text-purple-300">Atributos Básicos</h2>
                <span className="text-purple-300 text-2xl">
                  {character.uiState.isBasicAttributesCollapsed ? '▼' : '▲'}
                </span>
              </div>
              {!character.uiState.isBasicAttributesCollapsed && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-4 bg-gray-700 rounded-lg shadow-inner">
                  {Object.entries(character.basicAttributes).map(([key, attr]) => (
                    <div key={key} className="bg-gray-600 p-4 rounded-lg shadow-md">
                      <h3 className="text-xl font-semibold text-gray-200 mb-2 capitalize flex items-center">
                        {basicAttributeEmojis[key]} {key.charAt(0).toUpperCase() + key.slice(1)}
                      </h3>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <label className="block">
                          <span className="text-gray-400">Base:</span>
                          <input
                            type="number"
                            value={displayValue(attr.base)}
                            onChange={(e) => handleBasicAttributeChange('basicAttributes', key, 'base', e.target.value)}
                            className="mt-1 block w-full rounded-md bg-gray-500 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                          />
                        </label>
                        <label className="block">
                          <span className="text-gray-400">P.B.:</span>
                          <input
                            type="number"
                            value={displayValue(attr.permBonus)}
                            onChange={(e) => handleBasicAttributeChange('basicAttributes', key, 'permBonus', e.target.value)}
                            className="mt-1 block w-full rounded-md bg-gray-500 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                          />
                        </label>
                        <label className="block">
                          <span className="text-gray-400">C.B.:</span>
                          <input
                            type="number"
                            value={displayValue(attr.condBonus)}
                            onChange={(e) => handleBasicAttributeChange('basicAttributes', key, 'condBonus', e.target.value)}
                            className="mt-1 block w-full rounded-md bg-gray-500 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                          />
                        </label>
                      </div>
                      <div className="mt-3 text-right">
                        <span className="text-gray-300 font-bold text-lg">Total: {displayValue(attr.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Seção de Atributos Mágicos */}
            <div className="mb-6">
              <div
                className="flex justify-between items-center cursor-pointer p-3 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors duration-200"
                onClick={() => toggleSection('isMagicAttributesCollapsed')}
              >
                <h2 className="text-2xl font-bold text-purple-300">Atributos Mágicos</h2>
                <span className="text-purple-300 text-2xl">
                  {character.uiState.isMagicAttributesCollapsed ? '▼' : '▲'}
                </span>
              </div>
              {!character.uiState.isMagicAttributesCollapsed && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-4 bg-gray-700 rounded-lg shadow-inner">
                  {Object.entries(character.magicAttributes).map(([key, attr]) => (
                    <div key={key} className="bg-gray-600 p-4 rounded-lg shadow-md">
                      <h3 className="text-xl font-semibold text-gray-200 mb-2 capitalize flex items-center">
                        {magicAttributeEmojis[key]} {key.charAt(0).toUpperCase() + key.slice(1)}
                      </h3>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <label className="block">
                          <span className="text-gray-400">Base:</span>
                          <input
                            type="number"
                            value={displayValue(attr.base)}
                            onChange={(e) => handleBasicAttributeChange('magicAttributes', key, 'base', e.target.value)}
                            className="mt-1 block w-full rounded-md bg-gray-500 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                          />
                        </label>
                        <label className="block">
                          <span className="text-gray-400">P.B.:</span>
                          <input
                            type="number"
                            value={displayValue(attr.permBonus)}
                            onChange={(e) => handleBasicAttributeChange('magicAttributes', key, 'permBonus', e.target.value)}
                            className="mt-1 block w-full rounded-md bg-gray-500 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                          />
                        </label>
                        <label className="block">
                          <span className="text-gray-400">C.B.:</span>
                          <input
                            type="number"
                            value={displayValue(attr.condBonus)}
                            onChange={(e) => handleBasicAttributeChange('magicAttributes', key, 'condBonus', e.target.value)}
                            className="mt-1 block w-full rounded-md bg-gray-500 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                          />
                        </label>
                      </div>
                      <div className="mt-3 text-right">
                        <span className="text-gray-300 font-bold text-lg">Total: {displayValue(attr.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Seção de Inventário */}
            <div className="mb-6">
              <div
                className="flex justify-between items-center cursor-pointer p-3 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors duration-200"
                onClick={() => toggleSection('isInventoryCollapsed')}
              >
                <h2 className="text-2xl font-bold text-purple-300">Inventário 🎒</h2>
                <span className="text-purple-300 text-2xl">
                  {character.uiState.isInventoryCollapsed ? '▼' : '▲'}
                </span>
              </div>
              {!character.uiState.isInventoryCollapsed && (
                <div className="mt-4 p-4 bg-gray-700 rounded-lg shadow-inner">
                  <button
                    onClick={handleAddItem}
                    className="mb-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75"
                  >
                    Adicionar Item
                  </button>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(character.inventory || []).map((item, index) => (
                      <div key={index} className="bg-gray-600 p-4 rounded-lg shadow-md flex flex-col">
                        <label className="block mb-2">
                          <span className="text-gray-300">Nome do Item:</span>
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleInventoryItemChange(index, 'name', e.target.value)}
                            className="mt-1 block w-full rounded-md bg-gray-500 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                          />
                        </label>
                        <label className="block mb-2">
                          <span className="text-gray-300">Descrição:</span>
                          <textarea
                            value={item.description}
                            onChange={(e) => handleInventoryItemChange(index, 'description', e.target.value)}
                            className="mt-1 block w-full rounded-md bg-gray-500 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                          ></textarea>
                        </label>
                        <button
                          onClick={() => handleRemoveItem(index)}
                          className="mt-auto px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75 self-end"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Seção de Carteira (Zeni) */}
            <div className="mb-6">
              <div
                className="flex justify-between items-center cursor-pointer p-3 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors duration-200"
                onClick={() => toggleSection('isWalletCollapsed')}
              >
                <h2 className="text-2xl font-bold text-purple-300">Carteira 💰</h2>
                <span className="text-purple-300 text-2xl">
                  {character.uiState.isWalletCollapsed ? '▼' : '▲'}
                </span>
              </div>
              {!character.uiState.isWalletCollapsed && (
                <div className="mt-4 p-4 bg-gray-700 rounded-lg shadow-inner flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4">
                  <div className="flex items-center space-x-2 w-full sm:w-auto">
                    <span className="text-gray-300 text-xl font-semibold">Zeni:</span>
                    <input
                      type="number"
                      value={displayValue(character.wallet.zeni)}
                      readOnly
                      className="flex-1 rounded-md bg-gray-600 border-transparent text-white text-center py-2 px-3 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center space-x-2 w-full sm:w-auto">
                    <input
                      type="number"
                      value={displayValue(zeniAmount)}
                      onChange={handleZeniChange}
                      placeholder="Valor"
                      className="flex-1 rounded-md bg-gray-600 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white py-2 px-3"
                    />
                    <button
                      onClick={handleAddZeni}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                    >
                      Adicionar
                    </button>
                    <button
                      onClick={handleRemoveZeni}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Seção de Vantagens e Desvantagens */}
            <div className="mb-6">
              <div
                className="flex justify-between items-center cursor-pointer p-3 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors duration-200"
                onClick={() => toggleSection('isPerksCollapsed')}
              >
                <h2 className="text-2xl font-bold text-purple-300">Vantagens e Desvantagens ⭐</h2>
                <span className="text-purple-300 text-2xl">
                  {character.uiState.isPerksCollapsed ? '▼' : '▲'}
                </span>
              </div>
              {!character.uiState.isPerksCollapsed && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-gray-700 rounded-lg shadow-inner">
                  {/* Vantagens */}
                  <div className="bg-gray-600 p-4 rounded-lg shadow-md">
                    <h3 className="text-xl font-semibold text-gray-200 mb-3">Vantagens</h3>
                    <button
                      onClick={() => handleAddPerk('advantages')}
                      className="mb-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                    >
                      Adicionar Vantagem
                    </button>
                    {(character.advantages || []).map((perk, index) => (
                      <div key={index} className="bg-gray-500 p-3 rounded-lg shadow-sm mb-3">
                        <label className="block mb-1">
                          <span className="text-gray-300">Nome:</span>
                          <input
                            type="text"
                            value={perk.name}
                            onChange={(e) => handlePerkChange('advantages', index, 'name', e.target.value)}
                            className="mt-1 block w-full rounded-md bg-gray-400 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                          />
                        </label>
                        <label className="block mb-1">
                          <span className="text-gray-300">Descrição:</span>
                          <textarea
                            value={perk.description}
                            onChange={(e) => handlePerkChange('advantages', index, 'description', e.target.value)}
                            className="mt-1 block w-full rounded-md bg-gray-400 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                          ></textarea>
                        </label>
                        <label className="block mb-2">
                          <span className="text-gray-300">Valor:</span>
                          <input
                            type="number"
                            value={displayValue(perk.value)}
                            onChange={(e) => handlePerkChange('advantages', index, 'value', e.target.value)}
                            className="mt-1 block w-full rounded-md bg-gray-400 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                          />
                        </label>
                        <div className="flex items-center space-x-3 text-gray-300 mb-2">
                          <span className="font-semibold">Origem:</span>
                          <label className="inline-flex items-center">
                            <input
                              type="checkbox"
                              checked={perk.origin.class}
                              onChange={() => handlePerkOriginChange('advantages', index, 'class')}
                              className="form-checkbox h-5 w-5 text-purple-600 rounded-md"
                            />
                            <span className="ml-2">Classe</span>
                          </label>
                          <label className="inline-flex items-center">
                            <input
                              type="checkbox"
                              checked={perk.origin.race}
                              onChange={() => handlePerkOriginChange('advantages', index, 'race')}
                              className="form-checkbox h-5 w-5 text-purple-600 rounded-md"
                            />
                            <span className="ml-2">Raça</span>
                          </label>
                          <label className="inline-flex items-center">
                            <input
                              type="checkbox"
                              checked={perk.origin.manual}
                              onChange={() => handlePerkOriginChange('advantages', index, 'manual')}
                              className="form-checkbox h-5 w-5 text-purple-600 rounded-md"
                            />
                            <span className="ml-2">Manual</span>
                          </label>
                        </div>
                        <button
                          onClick={() => handleRemovePerk('advantages', index)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Desvantagens */}
                  <div className="bg-gray-600 p-4 rounded-lg shadow-md">
                    <h3 className="text-xl font-semibold text-gray-200 mb-3">Desvantagens</h3>
                    <button
                      onClick={() => handleAddPerk('disadvantages')}
                      className="mb-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                    >
                      Adicionar Desvantagem
                    </button>
                    {(character.disadvantages || []).map((perk, index) => (
                      <div key={index} className="bg-gray-500 p-3 rounded-lg shadow-sm mb-3">
                        <label className="block mb-1">
                          <span className="text-gray-300">Nome:</span>
                          <input
                            type="text"
                            value={perk.name}
                            onChange={(e) => handlePerkChange('disadvantages', index, 'name', e.target.value)}
                            className="mt-1 block w-full rounded-md bg-gray-400 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                          />
                        </label>
                        <label className="block mb-1">
                          <span className="text-gray-300">Descrição:</span>
                          <textarea
                            value={perk.description}
                            onChange={(e) => handlePerkChange('disadvantages', index, 'description', e.target.value)}
                            className="mt-1 block w-full rounded-md bg-gray-400 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                          ></textarea>
                        </label>
                        <label className="block mb-2">
                          <span className="text-gray-300">Valor:</span>
                          <input
                            type="number"
                            value={displayValue(perk.value)}
                            onChange={(e) => handlePerkChange('disadvantages', index, 'value', e.target.value)}
                            className="mt-1 block w-full rounded-md bg-gray-400 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                          />
                        </label>
                        <div className="flex items-center space-x-3 text-gray-300 mb-2">
                          <span className="font-semibold">Origem:</span>
                          <label className="inline-flex items-center">
                            <input
                              type="checkbox"
                              checked={perk.origin.class}
                              onChange={() => handlePerkOriginChange('disadvantages', index, 'class')}
                              className="form-checkbox h-5 w-5 text-purple-600 rounded-md"
                            />
                            <span className="ml-2">Classe</span>
                          </label>
                          <label className="inline-flex items-center">
                            <input
                              type="checkbox"
                              checked={perk.origin.race}
                              onChange={() => handlePerkOriginChange('disadvantages', index, 'race')}
                              className="form-checkbox h-5 w-5 text-purple-600 rounded-md"
                            />
                            <span className="ml-2">Raça</span>
                          </label>
                          <label className="inline-flex items-center">
                            <input
                              type="checkbox"
                              checked={perk.origin.manual}
                              onChange={() => handlePerkOriginChange('disadvantages', index, 'manual')}
                              className="form-checkbox h-5 w-5 text-purple-600 rounded-md"
                            />
                            <span className="ml-2">Manual</span>
                          </label>
                        </div>
                        <button
                          onClick={() => handleRemovePerk('disadvantages', index)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Seção de Habilidades */}
            <div className="mb-6">
              <div
                className="flex justify-between items-center cursor-pointer p-3 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors duration-200"
                onClick={() => toggleSection('isAbilitiesCollapsed')}
              >
                <h2 className="text-2xl font-bold text-purple-300">Habilidades 💡</h2>
                <span className="text-purple-300 text-2xl">
                  {character.uiState.isAbilitiesCollapsed ? '▼' : '▲'}
                </span>
              </div>
              {!character.uiState.isAbilitiesCollapsed && (
                <div className="mt-4 p-4 bg-gray-700 rounded-lg shadow-inner">
                  <button
                    onClick={handleAddAbility}
                    className="mb-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75"
                  >
                    Adicionar Habilidade
                  </button>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(character.abilities || []).map((ability, index) => (
                      <div key={index} className="bg-gray-600 p-4 rounded-lg shadow-md flex flex-col">
                        <label className="block mb-2">
                          <span className="text-gray-300">Título:</span>
                          <input
                            type="text"
                            value={ability.title}
                            onChange={(e) => handleAbilityChange(index, 'title', e.target.value)}
                            className="mt-1 block w-full rounded-md bg-gray-500 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                          />
                        </label>
                        <label className="block mb-2">
                          <span className="text-gray-300">Descrição:</span>
                          <textarea
                            value={ability.description}
                            onChange={(e) => handleAbilityChange(index, 'description', e.target.value)}
                            className="mt-1 block w-full rounded-md bg-gray-500 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                          ></textarea>
                        </label>
                        <button
                          onClick={() => handleRemoveAbility(index)}
                          className="mt-auto px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75 self-end"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Seção de Especializações */}
            <div className="mb-6">
              <div
                className="flex justify-between items-center cursor-pointer p-3 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors duration-200"
                onClick={() => toggleSection('isSpecializationsCollapsed')}
              >
                <h2 className="text-2xl font-bold text-purple-300">Especializações 🌟</h2>
                <span className="text-purple-300 text-2xl">
                  {character.uiState.isSpecializationsCollapsed ? '▼' : '▲'}
                </span>
              </div>
              {!character.uiState.isSpecializationsCollapsed && (
                <div className="mt-4 p-4 bg-gray-700 rounded-lg shadow-inner">
                  <button
                    onClick={handleAddSpecialization}
                    className="mb-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75"
                  >
                    Adicionar Especialização
                  </button>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(character.specializations || []).map((spec, index) => (
                      <div key={index} className="bg-gray-600 p-4 rounded-lg shadow-md flex flex-col">
                        <label className="block mb-2">
                          <span className="text-gray-300">Nome:</span>
                          <input
                            type="text"
                            value={spec.name}
                            onChange={(e) => handleSpecializationChange(index, 'name', e.target.value)}
                            className="mt-1 block w-full rounded-md bg-gray-500 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                          />
                        </label>
                        <label className="block mb-2">
                          <span className="text-gray-300">Modificador:</span>
                          <input
                            type="text"
                            value={spec.modifier}
                            onChange={(e) => handleSpecializationChange(index, 'modifier', e.target.value)}
                            className="mt-1 block w-full rounded-md bg-gray-500 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                          />
                        </label>
                        <label className="block mb-2">
                          <span className="text-gray-300">Bônus:</span>
                          <input
                            type="number"
                            value={displayValue(spec.bonus)}
                            onChange={(e) => handleSpecializationChange(index, 'bonus', e.target.value)}
                            className="mt-1 block w-full rounded-md bg-gray-500 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                          />
                        </label>
                        <button
                          onClick={() => handleRemoveSpecialization(index)}
                          className="mt-auto px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75 self-end"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Seção de Itens Equipados */}
            <div className="mb-6">
              <div
                className="flex justify-between items-center cursor-pointer p-3 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors duration-200"
                onClick={() => toggleSection('isEquippedItemsCollapsed')}
              >
                <h2 className="text-2xl font-bold text-purple-300">Itens Equipados 🛡️</h2>
                <span className="text-purple-300 text-2xl">
                  {character.uiState.isEquippedItemsCollapsed ? '▼' : '▲'}
                </span>
              </div>
              {!character.uiState.isEquippedItemsCollapsed && (
                <div className="mt-4 p-4 bg-gray-700 rounded-lg shadow-inner">
                  <button
                    onClick={handleAddEquippedItem}
                    className="mb-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75"
                  >
                    Adicionar Item Equipado
                  </button>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(character.equippedItems || []).map((item, index) => (
                      <div key={index} className="bg-gray-600 p-4 rounded-lg shadow-md flex flex-col">
                        <label className="block mb-2">
                          <span className="text-gray-300">Nome:</span>
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleEquippedItemChange(index, 'name', e.target.value)}
                            className="mt-1 block w-full rounded-md bg-gray-500 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                          />
                        </label>
                        <label className="block mb-2">
                          <span className="text-gray-300">Descrição:</span>
                          <textarea
                            value={item.description}
                            onChange={(e) => handleEquippedItemChange(index, 'description', e.target.value)}
                            className="mt-1 block w-full rounded-md bg-gray-500 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                          ></textarea>
                        </label>
                        <button
                          onClick={() => handleRemoveEquippedItem(index)}
                          className="mt-auto px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75 self-end"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Seção de História do Personagem */}
            <div className="mb-6">
              <div
                className="flex justify-between items-center cursor-pointer p-3 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors duration-200"
                onClick={() => toggleSection('isHistoryCollapsed')}
              >
                <h2 className="text-2xl font-bold text-purple-300">História do Personagem 📜</h2>
                <span className="text-purple-300 text-2xl">
                  {character.uiState.isHistoryCollapsed ? '▼' : '▲'}
                </span>
              </div>
              {!character.uiState.isHistoryCollapsed && (
                <div className="mt-4 p-4 bg-gray-700 rounded-lg shadow-inner">
                  <div className="flex flex-wrap gap-2 mb-4">
                    <button
                      onClick={() => handleAddHistoryBlock('text')}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75"
                    >
                      Adicionar Bloco de Texto
                    </button>
                    <button
                      onClick={() => handleAddHistoryBlock('image')}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75"
                    >
                      Adicionar Bloco de Imagem
                    </button>
                  </div>
                  <div className="space-y-4">
                    {(character.history || []).map((block) => (
                      <div key={block.id} className="bg-gray-600 p-4 rounded-lg shadow-md">
                        {block.type === 'text' && (
                          <textarea
                            ref={el => historyTextareaRefs.current[block.id] = el}
                            value={block.value}
                            onChange={(e) => handleHistoryBlockChange(block.id, 'value', e.target.value)}
                            className="mt-1 block w-full rounded-md bg-gray-500 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                            placeholder="Digite sua história aqui..."
                          ></textarea>
                        )}
                        {block.type === 'image' && (
                          <div className="flex flex-col items-center">
                            <img
                              src={block.value || 'https://placehold.co/200x150/000000/FFFFFF?text=Imagem'}
                              alt="Imagem da História"
                              className={`mb-2 rounded-md border-2 border-gray-400 ${block.fitWidth ? 'w-full' : ''}`}
                              style={{
                                maxWidth: block.fitWidth ? '100%' : 'none',
                                width: block.width ? `${block.width}px` : 'auto',
                                height: block.height ? `${block.height}px` : 'auto',
                                objectFit: 'contain',
                              }}
                              onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/200x150/000000/FFFFFF?text=Erro+ao+carregar+imagem'; }}
                            />
                            <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 mb-2">
                              Carregar Imagem
                              <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, block.id)} />
                            </label>
                            <div className="flex items-center space-x-2 mb-2">
                              <label className="inline-flex items-center text-gray-300">
                                <input
                                  type="checkbox"
                                  checked={block.fitWidth}
                                  onChange={(e) => handleHistoryBlockChange(block.id, 'fitWidth', e.target.checked)}
                                  className="form-checkbox h-5 w-5 text-purple-600 rounded-md"
                                />
                                <span className="ml-2">Ajustar à Largura</span>
                              </label>
                              {!block.fitWidth && (
                                <>
                                  <label className="text-gray-300">Largura (px):</label>
                                  <input
                                    type="number"
                                    value={displayValue(block.width)}
                                    onChange={(e) => handleHistoryBlockChange(block.id, 'width', e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                                    className="w-24 rounded-md bg-gray-500 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                                  />
                                  <label className="text-gray-300">Altura (px):</label>
                                  <input
                                    type="number"
                                    value={displayValue(block.height)}
                                    onChange={(e) => handleHistoryBlockChange(block.id, 'height', e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                                    className="w-24 rounded-md bg-gray-500 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                                  />
                                </>
                              )}
                            </div>
                          </div>
                        )}
                        <button
                          onClick={() => handleRemoveHistoryBlock(block.id)}
                          className="mt-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                        >
                          Remover Bloco
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Seção de Anotações */}
            <div className="mb-6">
              <div
                className="flex justify-between items-center cursor-pointer p-3 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors duration-200"
                onClick={() => toggleSection('isNotesCollapsed')}
              >
                <h2 className="text-2xl font-bold text-purple-300">Anotações 📝</h2>
                <span className="text-purple-300 text-2xl">
                  {character.uiState.isNotesCollapsed ? '▼' : '▲'}
                </span>
              </div>
              {!character.uiState.isNotesCollapsed && (
                <div className="mt-4 p-4 bg-gray-700 rounded-lg shadow-inner">
                  <textarea
                    ref={notesTextareaRef}
                    name="notes"
                    value={character.notes}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md bg-gray-600 border-transparent focus:border-purple-500 focus:ring-purple-500 text-white"
                    placeholder="Faça suas anotações aqui..."
                  ></textarea>
                </div>
              )}
            </div>
          </div>
        ) : (
          user && (
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl text-center border border-gray-700">
              <p className="text-xl text-gray-300 mb-4">
                Selecione uma ficha para carregar ou crie uma nova para começar.
              </p>
            </div>
          )
        )}
      </main>
    </div>
  );
};

export default App;

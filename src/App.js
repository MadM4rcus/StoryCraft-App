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

  // Estados para controlar o colapso das seções
  const [isUserInfoCollapsed, setIsUserInfoCollapsed] = useState(false); // Renomeado para não conflitar
  const [isCharacterInfoCollapsed, setIsCharacterInfoCollapsed] = useState(false); // Novo estado
  const [isMainAttributesCollapsed, setIsMainAttributesCollapsed] = useState(false);
  const [isBasicAttributesCollapsed, setIsBasicAttributesCollapsed] = useState(false);
  const [isInventoryCollapsed, setIsInventoryCollapsed] = useState(false);
  const [isWalletCollapsed, setIsWalletCollapsed] = useState(false);
  const [isPerksCollapsed, setIsPerksCollapsed] = useState(false);
  const [isAbilitiesCollapsed, setIsAbilitiesCollapsed] = useState(false);
  const [isSpecializationsCollapsed, setIsSpecializationsCollapsed] = useState(false);
  const [isEquippedItemsCollapsed, setIsEquippedItemsCollapsed] = useState(false);
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false);
  const [isNotesCollapsed, setIsNotesCollapsed] = useState(false);

  // Mapeamento de atributos básicos para emojis
  const basicAttributeEmojis = {
    forca: '💪',
    destreza: '🏃‍♂️',
    inteligencia: '🧠',
    constituicao: '❤️‍🩹',
    sabedoria: '🧘‍♂️',
    carisma: '�',
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
            deserializedData.magicAttributes = deserializedData.magicAttributes || { fogo: { base: '', permBonus: '', condBonus: '', total: '' }, agua: { base: '', permBonus: '', condBonus: '', total: '' }, ar: { base: '', permBonus: '', condBonus: '', total: '' }, terra: { base: '', permBonus: '', condBonus: '', total: '' }, luz: { base: '', permBonus: '', condBonus: '', total: '' }, trevas: { base: '', permBonus: '', condBonus: '', total: '' }, espirito: { base: '', permBonus: '', condBonus: '', total: '' }, outro: { base: '', permBonus: '', condBonus: '', total: '' } };
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

  // Lida com a remoção de Especialização
  const handleRemoveSpecialization = (indexToRemove) => {
    setCharacter(prevChar => {
      const updatedSpecializations = (prevChar.specializations || []).filter((_, index) => index !== indexToRemove);
      return { ...prevChar, specializations: updatedSpecializations };
    });
  };

  // Lida com a mudança de nome, modificador ou bônus da Especialização
  const handleSpecializationChange = (index, field, value) => {
    setCharacter(prevChar => {
      const updatedSpecs = [...(prevChar.specializations || [])];
      if (updatedSpecs[index]) {
        if (field === 'name') {
          updatedSpecs[index][field] = value;
        } else {
          updatedSpecs[index][field] = value === '' ? '' : parseInt(value, 10);
        }
      }
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
                  setCharacter(prevChar => {
                    const updatedEquippedItems = [...(prevChar.equippedItems || []), { name, description, attributes }];
                    return { ...prevChar, equippedItems: updatedEquippedItems };
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

  // Lida com a mudança de texto para Anotações
  const handleNotesChange = (e) => {
    const { name, value } = e.target;
    setCharacter(prevChar => ({
      ...prevChar,
      [name]: value,
    }));
  };

  // Funções para a nova seção de História Modular
  const addHistoryBlock = (type) => {
    if (type === 'text') {
      setCharacter(prevChar => ({
        ...prevChar,
        history: [...(prevChar.history || []), { id: crypto.randomUUID(), type: 'text', value: '' }],
      }));
    } else if (type === 'image') {
      setModal({
        isVisible: true,
        message: 'Cole a URL da imagem:',
        type: 'prompt',
        onConfirm: (url) => {
          if (url) {
            setCharacter(prevChar => ({
              ...prevChar,
              history: [...(prevChar.history || []), { id: crypto.randomUUID(), type: 'image', value: url, width: '', height: '', fitWidth: true }],
            }));
          }
          setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
        },
        onCancel: () => {
          setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
        },
      });
    }
  };

  // Atualiza um campo específico de um bloco de história
  const updateHistoryBlock = (id, field, value) => {
    setCharacter(prevChar => ({
      ...prevChar,
      history: (prevChar.history || []).map(block => {
        if (block.id === id) {
          if (block.type === 'image' && (field === 'width' || field === 'height')) {
            return { ...block, [field]: value === '' ? '' : parseInt(value, 10) || 0 };
          }
          return { ...block, [field]: value };
        }
        return block;
      }),
    }));
  };

  const removeHistoryBlock = (idToRemove) => {
    setCharacter(prevChar => ({
      ...prevChar,
      history: (prevChar.history || []).filter(block => block.id !== idToRemove),
    }));
  };

  // Funções para Drag-and-Drop na História
  const draggedItemRef = useRef(null);

  const handleDragStart = (e, index) => {
    draggedItemRef.current = index;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", e.target);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    const draggedItemIndex = draggedItemRef.current;
    
    if (draggedItemIndex === null || draggedItemIndex === dropIndex) {
        draggedItemRef.current = null;
        return;
    }

    const newHistory = [...character.history];
    const [reorderedItem] = newHistory.splice(draggedItemIndex, 1);
    newHistory.splice(dropIndex, 0, reorderedItem);

    setCharacter(prevChar => ({
        ...prevChar,
        history: newHistory
    }));
    draggedItemRef.current = null;
  };

  // Função para resetar a ficha do personagem para os valores padrão usando o modal personalizado
  const handleReset = () => {
    setModal({
      isVisible: true,
      message: 'Tem certeza que deseja resetar a ficha? Todos os dados serão perdidos. (Esta ação NÃO exclui a ficha do banco de dados)',
      type: 'confirm',
      onConfirm: () => {
        setCharacter({
          name: '', photoUrl: 'https://placehold.co/150x150/000000/FFFFFF?text=Foto', age: '', height: '', gender: '', race: '', class: '', alignment: '',
          level: '', xp: '',
          mainAttributes: { hp: { current: '', max: '' }, mp: { current: '', max: '' }, initiative: '', fa: '', fm: '', fd: '' },
          basicAttributes: { forca: { base: '', permBonus: '', condBonus: '', total: '' }, destreza: { base: '', permBonus: '', condBonus: '', total: '' }, inteligencia: { base: '', permBonus: '', condBonus: '', total: '' }, constituicao: { base: '', permBonus: '', condBonus: '', total: '' }, sabedoria: { base: '', permBonus: '', condBonus: '', total: '' }, carisma: { base: '', permBonus: '', condBonus: '', total: '' }, armadura: { base: '', permBonus: '', condBonus: '', total: '' }, poderDeFogo: { base: '', permBonus: '', condBonus: '', total: '' } },
          magicAttributes: { fogo: { base: '', permBonus: '', condBonus: '', total: '' }, agua: { base: '', permBonus: '', condBonus: '', total: '' }, ar: { base: '', permBonus: '', condBonus: '', total: '' }, terra: { base: '', permBonus: '', condBonus: '', total: '' }, luz: { base: '', permBonus: '', condBonus: '', total: '' }, trevas: { base: '', permBonus: '', condBonus: '', total: '' }, espirito: { base: '', permBonus: '', condBonus: '', total: '' }, outro: { base: '', permBonus: '', condBonus: '', total: '' } },
          inventory: [], wallet: { zeni: '' }, advantages: [], disadvantages: [], abilities: [], specializations: [], equippedItems: [], history: [], notes: '',
        });
      },
      onCancel: () => {},
    });
  };

  // Função para exportar os dados do personagem como JSON
  const handleExportJson = () => {
    if (!character) {
      setModal({ isVisible: true, message: 'Nenhum personagem selecionado para exportar.', type: 'info', onConfirm: () => {}, onCancel: () => {} });
      return;
    }
    const jsonString = JSON.stringify(character, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${character.name || 'ficha_rpg'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
          if (importedData.name && importedData.mainAttributes && importedData.basicAttributes) {
            setModal({
              isVisible: true,
              message: 'Tem certeza que deseja importar esta ficha? Os dados atuais serão substituídos e um novo personagem será criado.',
              type: 'confirm',
              onConfirm: async () => {
                const newCharId = crypto.randomUUID();
                const importedCharacterData = {
                  ...importedData,
                  id: newCharId,
                  ownerUid: user.uid,
                  xp: importedData.xp !== undefined ? importedData.xp : '',
                  level: importedData.level !== undefined ? importedData.level : '',
                  age: importedData.age !== undefined ? importedData.age : '',
                  photoUrl: importedData.photoUrl || 'https://placehold.co/150x150/000000/FFFFFF?text=Foto',
                  mainAttributes: {
                    hp: { current: '', max: '', ...importedData.mainAttributes?.hp },
                    mp: { current: '', max: '', ...importedData.mainAttributes?.mp },
                    initiative: '', fa: '', fm: '', fd: '', ...importedData.mainAttributes,
                  },
                  basicAttributes: {
                    forca: { base: '', permBonus: '', condBonus: '', total: '', ...importedData.basicAttributes?.forca },
                    destreza: { base: '', permBonus: '', condBonus: '', total: '', ...importedData.basicAttributes?.destreza },
                    inteligencia: { base: '', permBonus: '', condBonus: '', total: '', ...importedData.basicAttributes?.inteligencia },
                    constituicao: { base: '', permBonus: '', condBonus: '', total: '', ...importedData.basicAttributes?.constituicao },
                    sabedoria: { base: '', permBonus: '', condBonus: '', total: '', ...importedData.basicAttributes?.sabedoria },
                    carisma: { base: '', permBonus: '', condBonus: '', total: '', ...importedData.basicAttributes?.carisma },
                    armadura: { base: '', permBonus: '', condBonus: '', total: '', ...importedData.basicAttributes?.armadura },
                    poderDeFogo: { base: '', permBonus: '', condBonus: '', total: '', ...importedData.basicAttributes?.poderDeFogo },
                  },
                  magicAttributes: {
                    fogo: { base: '', permBonus: '', condBonus: '', total: '', ...importedData.magicAttributes?.fogo },
                    agua: { base: '', permBonus: '', condBonus: '', total: '', ...importedData.magicAttributes?.agua },
                    ar: { base: '', permBonus: '', condBonus: '', total: '', ...importedData.magicAttributes?.ar },
                    terra: { base: '', permBonus: '', condBonus: '', total: '', ...importedData.magicAttributes?.terra },
                    luz: { base: '', permBonus: '', condBonus: '', total: '', ...importedData.magicAttributes?.luz },
                    trevas: { base: '', permBonus: '', condBonus: '', total: '', ...importedData.magicAttributes?.trevas },
                    espirito: { base: '', permBonus: '', condBonus: '', total: '', ...importedData.magicAttributes?.espirito },
                    outro: { base: '', permBonus: '', condBonus: '', total: '', ...importedData.magicAttributes?.outro },
                  },
                  inventory: importedData.inventory || [],
                  wallet: importedData.wallet || { zeni: '' },
                  advantages: importedData.advantages || [],
                  disadvantages: importedData.disadvantages || [],
                  abilities: importedData.abilities || [],
                  specializations: importedData.specializations || [],
                  equippedItems: importedData.equippedItems || [],
                  history: importedData.history || [],
                  notes: importedData.notes || '',
                };

                importedCharacterData.history = importedCharacterData.history.map(block => {
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

                try {
                    const characterDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/characterSheets/${newCharId}`);
                    const dataToSave = { ...importedCharacterData };
                    
                    // Converter valores vazios de números para null antes de stringify
                    const convertToSavableValue = (value) => {
                      if (value === '') return null;
                      const num = parseInt(value, 10);
                      return isNaN(num) ? null : num;
                    };

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

                    await setDoc(characterDocRef, dataToSave);
                    setSelectedCharIdState(newCharId); // Define o estado
                    setOwnerUidState(user.uid); // Define o estado
                    window.history.pushState({}, '', `?charId=${newCharId}&ownerUid=${user.uid}`);
                    fetchCharactersList();
                    setModal({ isVisible: true, message: `Ficha de '${importedData.name}' importada e salva com sucesso!`, type: 'info', onConfirm: () => {}, onCancel: () => {} });
                } catch (error) {
                    console.error("Erro ao salvar ficha importada:", error);
                    setModal({ isVisible: true, message: `Erro ao salvar ficha importada: ${error.message}`, type: 'info', onConfirm: () => {}, onCancel: () => {} });
                }
              },
              onCancel: () => {},
            });
          } else {
            setModal({
              isVisible: true,
              message: 'O arquivo JSON selecionado não parece ser uma ficha de personagem válida.',
              type: 'info',
              onConfirm: () => {},
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

  // Função para criar um novo personagem
  const handleCreateNewCharacter = () => {
    setModal({
      isVisible: true,
      message: 'Digite o nome do novo personagem:',
      type: 'prompt',
      onConfirm: async (name) => {
        if (name) {
          setIsLoading(true);
          try {
            const newCharId = crypto.randomUUID();
            const newCharacterData = {
              id: newCharId,
              ownerUid: user.uid,
              name: name,
              photoUrl: 'https://placehold.co/150x150/000000/FFFFFF?text=Foto',
              age: '', height: '', gender: '', race: '', class: '', alignment: '',
              level: '', xp: '',
              mainAttributes: { hp: { current: '', max: '' }, mp: { current: '', max: '' }, initiative: '', fa: '', fm: '', fd: '' },
              basicAttributes: { forca: { base: '', permBonus: '', condBonus: '', total: '' }, destreza: { base: '', permBonus: '', condBonus: '', total: '' }, inteligencia: { base: '', permBonus: '', condBonus: '', total: '' }, constituicao: { base: '', permBonus: '', condBonus: '', total: '' }, sabedoria: { base: '', permBonus: '', condBonus: '', total: '' }, carisma: { base: '', permBonus: '', condBonus: '', total: '' }, armadura: { base: '', permBonus: '', condBonus: '', total: '' }, poderDeFogo: { base: '', permBonus: '', condBonus: '', total: '' } },
              magicAttributes: { fogo: { base: '', permBonus: '', condBonus: '', total: '' }, agua: { base: '', permBonus: '', condBonus: '', total: '' }, ar: { base: '', permBonus: '', condBonus: '', total: '' }, terra: { base: '', permBonus: '', condBonus: '', total: '' }, luz: { base: '', permBonus: '', condBonus: '', total: '' }, trevas: { base: '', permBonus: '', condBonus: '', total: '' }, espirito: { base: '', permBonus: '', condBonus: '', total: '' }, outro: { base: '', permBonus: '', condBonus: '', total: '' } },
              inventory: [], wallet: { zeni: '' }, advantages: [], disadvantages: [], abilities: [], specializations: [], equippedItems: [], history: [], notes: '',
            };

            setCharacter(newCharacterData);
            setSelectedCharIdState(newCharId); // Define o estado
            setOwnerUidState(user.uid); // Define o estado
            window.history.pushState({}, '', `?charId=${newCharId}&ownerUid=${user.uid}`);

            const characterDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/characterSheets/${newCharId}`);
            const dataToSave = { ...newCharacterData };
            
            // Converter valores vazios de números para null antes de stringify
            const convertToSavableValue = (value) => {
              if (value === '') return null;
              const num = parseInt(value, 10);
              return isNaN(num) ? null : num;
            };

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

            await setDoc(characterDocRef, dataToSave);
            fetchCharactersList();
            setModal({ isVisible: true, message: `Personagem '${name}' criado com sucesso!`, type: 'info', onConfirm: () => {}, onCancel: () => {} });
          } catch (error) {
            console.error("Erro ao criar novo personagem:", error);
            setModal({ isVisible: true, message: `Erro ao criar personagem: ${error.message}`, type: 'info', onConfirm: () => {}, onCancel: () => {} });
          } finally {
            setIsLoading(false);
          }
        } else {
          setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
        }
      },
      onCancel: () => {
        setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
      },
    });
  };

  // Função para selecionar um personagem da lista
  const handleSelectCharacter = (charId, ownerUid) => {
    setSelectedCharIdState(charId); // Define o estado
    setOwnerUidState(ownerUid); // Define o estado
    window.history.pushState({}, '', `?charId=${charId}&ownerUid=${ownerUid}`);
    setViewingAllCharacters(false);
  };

  // Função para voltar para a lista de personagens
  const handleBackToList = () => {
    setSelectedCharIdState(null); // Limpa o estado
    setOwnerUidState(null); // Limpa o estado
    window.history.pushState({}, '', window.location.pathname);
    setCharacter(null);
    fetchCharactersList();
  };

  // Função para excluir um personagem (mudado para deleteDoc)
  const handleDeleteCharacter = (charId, charName, ownerUid) => {
    setModal({
      isVisible: true,
      message: `Tem certeza que deseja EXCLUIR permanentemente o personagem '${charName}'? Esta ação é irreversível.`,
      type: 'confirm',
      onConfirm: async () => {
        if (!db || !user) return;
        if (user.uid !== ownerUid && !isMaster) {
          setModal({ isVisible: true, message: 'Você não tem permissão para excluir este personagem.', type: 'info', onConfirm: () => {}, onCancel: () => {} });
          return;
        }
        setIsLoading(true);
        try {
          const characterDocRef = doc(db, `artifacts/${appId}/users/${ownerUid}/characterSheets/${charId}`);
          await deleteDoc(characterDocRef);
          setSelectedCharIdState(null); // Limpa o estado
          setOwnerUidState(null); // Limpa o estado
          window.history.pushState({}, '', window.location.pathname);
          setCharacter(null);
          fetchCharactersList();
          setModal({ isVisible: true, message: `Personagem '${charName}' excluído permanentemente com sucesso!`, type: 'info', onConfirm: () => {}, onCancel: () => {} });
        } catch (error) {
          console.error("Erro ao excluir personagem:", error);
          setModal({ isVisible: true, message: `Erro ao excluir personagem: ${error.message}`, type: 'info', onConfirm: () => {}, onCancel: () => {} });
        } finally {
          setIsLoading(false);
        }
      },
      onCancel: () => {},
    });
  };

  // --- Funções de Autenticação com Google ---
  const handleGoogleSignIn = async () => {
    if (!auth) {
      setModal({ isVisible: true, message: 'Firebase Auth não inicializado.', type: 'info', onConfirm: () => {}, onCancel: () => {} });
      return;
    }
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setModal({ isVisible: true, message: 'Login com Google realizado com sucesso!', type: 'info', onConfirm: () => {}, onCancel: () => {} });
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
      setModal({ isVisible: true, message: errorMessage, type: 'info', onConfirm: () => {}, onCancel: () => {} });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!auth) return;
    setIsLoading(true);
    try {
      await signOut(auth);
      setCharacter(null);
      setCharactersList([]);
      setSelectedCharIdState(null); // Limpa o estado
      setOwnerUidState(null); // Limpa o estado
      window.history.pushState({}, '', window.location.pathname);
      setViewingAllCharacters(false);
      setIsMaster(false);
      setModal({ isVisible: true, message: 'Você foi desconectado com sucesso.', type: 'info', onConfirm: () => {}, onCancel: () => {} });
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      setModal({ isVisible: true, message: `Erro ao fazer logout: ${error.message}`, type: 'info', onConfirm: () => {}, onCancel: () => {} });
    } finally {
      setIsLoading(false);
    }
  };

  // Função auxiliar para alternar o estado de colapso de uma seção
  const toggleSection = (setter) => setter(prev => !prev);

  // Função para adicionar foto (abre modal de prompt)
  const handleAddPhoto = () => {
    setModal({
      isVisible: true,
      message: 'Cole a URL da imagem para a foto do personagem:',
      type: 'prompt',
      onConfirm: (url) => {
        if (url) {
          setCharacter(prevChar => ({
            ...prevChar,
            photoUrl: url,
          }));
        }
        setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
      },
      onCancel: () => {
        setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
      },
    });
  };

  // Função para remover foto (volta para placeholder)
  const handleRemovePhoto = (e) => {
    e.stopPropagation(); // Evita que o clique se propague para o botão de adicionar foto
    setCharacter(prevChar => ({
      ...prevChar,
      photoUrl: 'https://placehold.co/150x150/000000/FFFFFF?text=Foto',
    }));
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 font-inter">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
          body {
            font-family: 'Inter', sans-serif;
          }

          /* Esconde as setinhas para navegadores WebKit (Chrome, Safari) */
          input[type="number"]::-webkit-outer-spin-button,
          input[type="number"]::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }

          /* Esconde as setinhas para Firefox */
          input[type="number"] {
            -moz-appearance: textfield;
          }
        `}
      </style>
      <div className="max-w-4xl mx-auto bg-gray-800 rounded-lg shadow-2xl p-6 md:p-8 border border-gray-700">
        <h1 className="text-4xl font-extrabold text-center text-purple-400 mb-8 tracking-wide">
          Ficha StoryCraft
        </h1>

        {/* Informações do Usuário (Firebase Authentication) */}
        <section className="mb-8 p-4 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
          <h2 
            className="text-xl font-bold text-yellow-300 mb-2 cursor-pointer flex justify-between items-center"
            onClick={() => toggleSection(setIsUserInfoCollapsed)}
          >
            Status do Usuário
            <span>{isUserInfoCollapsed ? '▼' : '▲'}</span>
          </h2>
          {!isUserInfoCollapsed && (
            <div className="text-center">
              {isAuthReady ? (
                user ? (
                  <>
                    <p className="text-lg text-gray-200">
                      Logado como: <span className="font-semibold text-purple-300">{user.displayName || 'Usuário Google'}</span>
                      {isMaster && <span className="text-yellow-400 ml-2">(Mestre)</span>}
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
            </div>
          )}
        </section>

        {/* Se o usuário está logado e não há personagem selecionado, mostra a lista de personagens */}
        {user && !selectedCharIdState && ( // Usando o estado
          <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
            <h2 className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2">
              {viewingAllCharacters ? 'Todas as Fichas de Personagem' : 'Meus Personagens'}
            </h2>
            <div className="flex flex-wrap gap-4 mb-4">
              <button
                onClick={handleCreateNewCharacter}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                disabled={isLoading}
              >
                Criar Novo Personagem
              </button>
              {isMaster && !viewingAllCharacters && (
                <button
                  onClick={() => fetchCharactersList()}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75"
                  disabled={isLoading}
                >
                  Ver Todas as Fichas
                </button>
              )}
              {isMaster && viewingAllCharacters && (
                <button
                  onClick={() => { setViewingAllCharacters(false); fetchCharactersList(); }}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75"
                  disabled={isLoading}
                >
                  Ver Minhas Fichas
                </button>
              )}
            </div>

            {charactersList.length === 0 && !isLoading ? (
              <p className="text-gray-400 italic">Nenhum personagem encontrado. Crie um novo!</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {charactersList.map((char) => (
                  <div key={char.id} className="bg-gray-600 p-4 rounded-lg shadow-md flex flex-col justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">{char.name || 'Personagem Sem Nome'}</h3>
                      <p className="text-sm text-gray-300">Raça: {char.race || 'N/A'}</p>
                      <p className="text-sm text-gray-300">Classe: {char.class || 'N/A'}</p>
                      {isMaster && char.ownerUid && (
                        <p className="text-xs text-gray-400 mt-2 break-all">Proprietário: {char.ownerUid}</p>
                      )}
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      <button
                        onClick={() => handleSelectCharacter(char.id, char.ownerUid)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                      >
                        Ver/Editar
                      </button>
                      {(user.uid === char.ownerUid || isMaster) && (
                          <button
                            onClick={() => handleDeleteCharacter(char.id, char.name, char.ownerUid)}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                          >
                            Excluir
                          </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Se um personagem estiver selecionado, mostra a ficha */}
        {user && selectedCharIdState && character && ( // Usando o estado
          <>
            <div className="mb-4">
              <button
                onClick={handleBackToList}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75"
              >
                ← Voltar para a Lista de Personagens
              </button>
            </div>

            {/* Informações do Personagem */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection(setIsCharacterInfoCollapsed)}
              >
                Informações do Personagem
                <span>{isCharacterInfoCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isCharacterInfoCollapsed && (
                <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-6">
                  <div className="flex-shrink-0 group relative"> {/* Adicionado group e relative */}
                    <img
                      src={character.photoUrl}
                      alt="Foto do Personagem"
                      className="w-48 h-48 object-cover rounded-full border-2 border-purple-500 mb-2 transition-all duration-300 ease-in-out"
                      onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/150x150/000000/FFFFFF?text=Foto'; }}
                    />
                    {(user.uid === character.ownerUid || isMaster) && (
                      <>
                        {/* Botão de Adicionar Foto */}
                        <button
                          onClick={handleAddPhoto}
                          className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white text-5xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out"
                          title="Adicionar/Trocar Foto"
                        >
                          +
                        </button>
                        {/* Botão de Remover Foto (X) */}
                        {character.photoUrl !== 'https://placehold.co/150x150/000000/FFFFFF?text=Foto' && (
                          <button
                            onClick={handleRemovePhoto}
                            className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out"
                            title="Remover Foto"
                          >
                            X
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 flex-grow w-full">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">Nome:</label>
                      <input type="text" id="name" name="name" value={character.name} onChange={handleChange} className="w-full p-2 bg-gray-600 border border-gray-500 rounded-md focus:ring-purple-500 focus:border-purple-500 text-white" disabled={user.uid !== character.ownerUid && !isMaster} />
                    </div>
                    <div>
                      <label htmlFor="age" className="block text-sm font-medium text-gray-300 mb-1">Idade:</label>
                      <input type="number" id="age" name="age" value={character.age} onChange={handleChange} className="w-full p-2 bg-gray-600 border border-gray-500 rounded-md focus:ring-purple-500 focus:border-purple-500 text-white" disabled={user.uid !== character.ownerUid && !isMaster} />
                    </div>
                    <div>
                      <label htmlFor="height" className="block text-sm font-medium text-gray-300 mb-1">Altura:</label>
                      <input type="text" id="height" name="height" value={character.height} onChange={handleChange} className="w-full p-2 bg-gray-600 border border-gray-500 rounded-md focus:ring-purple-500 focus:border-purple-500 text-white" disabled={user.uid !== character.ownerUid && !isMaster} />
                    </div>
                    <div>
                      <label htmlFor="gender" className="block text-sm font-medium text-gray-300 mb-1">Gênero:</label>
                      <input type="text" id="gender" name="gender" value={character.gender} onChange={handleChange} className="w-full p-2 bg-gray-600 border border-gray-500 rounded-md focus:ring-purple-500 focus:border-purple-500 text-white" disabled={user.uid !== character.ownerUid && !isMaster} />
                    </div>
                    <div>
                      <label htmlFor="race" className="block text-sm font-medium text-gray-300 mb-1">Raça:</label>
                      <input type="text" id="race" name="race" value={character.race} onChange={handleChange} className="w-full p-2 bg-gray-600 border border-gray-500 rounded-md focus:ring-purple-500 focus:border-purple-500 text-white" disabled={user.uid !== character.ownerUid && !isMaster} />
                    </div>
                    <div>
                      <label htmlFor="class" className="block text-sm font-medium text-gray-300 mb-1">Classe:</label>
                      <input type="text" id="class" name="class" value={character.class} onChange={handleChange} className="w-full p-2 bg-gray-600 border border-gray-500 rounded-md focus:ring-purple-500 focus:border-purple-500 text-white" disabled={user.uid !== character.ownerUid && !isMaster} />
                    </div>
                    <div>
                      <label htmlFor="alignment" className="block text-sm font-medium text-gray-300 mb-1">Alinhamento:</label>
                      <input type="text" id="alignment" name="alignment" value={character.alignment} onChange={handleChange} className="w-full p-2 bg-gray-600 border border-gray-500 rounded-md focus:ring-purple-500 focus:border-purple-500 text-white" disabled={user.uid !== character.ownerUid && !isMaster} />
                    </div>
                    <div>
                      <label htmlFor="level" className="block text-sm font-medium text-gray-300 mb-1">Nível:</label>
                      <input type="number" id="level" name="level" value={character.level} onChange={handleChange} className="w-full p-2 bg-gray-600 border border-gray-500 rounded-md focus:ring-purple-500 focus:border-purple-500 text-white" disabled={user.uid !== character.ownerUid && !isMaster} />
                    </div>
                    <div>
                      <label htmlFor="xp" className="block text-sm font-medium text-gray-300 mb-1">XP:</label>
                      <input type="number" id="xp" name="xp" value={character.xp} onChange={handleChange} className="w-full p-2 bg-gray-600 border border-gray-500 rounded-md focus:ring-purple-500 focus:border-purple-500 text-white" disabled={user.uid !== character.ownerUid && !isMaster} />
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Atributos Principais */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection(setIsMainAttributesCollapsed)}
              >
                Atributos Principais
                <span>{isMainAttributesCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isMainAttributesCollapsed && (
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
                        className="w-14 p-2 text-center bg-gray-700 border border-gray-500 rounded-md text-white text-xl font-bold"
                        disabled={user.uid !== character.ownerUid}
                      />
                      <span className="text-gray-300">/</span>
                      <input
                        type="number"
                        name="max"
                        data-attribute="hp"
                        value={character.mainAttributes.hp.max}
                        onChange={handleMainAttributeChange}
                        className="w-14 p-2 text-center bg-gray-700 border border-gray-500 rounded-md text-white text-xl font-bold"
                        disabled={!isMaster}
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
                        className="w-14 p-2 text-center bg-gray-700 border border-gray-500 rounded-md text-white text-xl font-bold"
                        disabled={user.uid !== character.ownerUid}
                      />
                      <span className="text-gray-300">/</span>
                      <input
                        type="number"
                        name="max"
                        data-attribute="mp"
                        value={character.mainAttributes.mp.max}
                        onChange={handleMainAttributeChange}
                        className="w-14 p-2 text-center bg-gray-700 border border-gray-500 rounded-md text-white text-xl font-bold"
                        disabled={!isMaster}
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
                        className="w-14 p-2 text-center bg-gray-700 border border-gray-500 rounded-md text-white text-xl font-bold"
                        disabled={user.uid !== character.ownerUid && !isMaster}
                      />
                    </div>
                  ))}
                  <p className="col-span-full text-sm text-gray-400 mt-2 text-center">
                    *A Iniciativa é baseada na Destreza ou Sabedoria (com custo de Mana para Sabedoria).
                  </p>
                </div>
              )}
            </section>

            {/* Atributos Básicos */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection(setIsBasicAttributesCollapsed)}
              >
                Atributos Básicos
                <span>{isBasicAttributesCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isBasicAttributesCollapsed && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Atributos Físicos */}
                  <div>
                    <h3 className="text-xl font-semibold text-purple-300 mb-3 border-b border-purple-500 pb-1">Físicos</h3>
                    <div className="grid grid-cols-1 gap-2">
                      {Object.entries(character.basicAttributes).map(([key, attr]) => (
                        <div key={key} className="p-2 bg-gray-600 rounded-md">
                          <div className="flex items-center gap-2 text-xs justify-between">
                            <label className="capitalize text-base font-medium text-gray-200 flex-shrink-0">
                              {basicAttributeEmojis[key] || ''} {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                            </label>
                            <div className="flex items-center gap-2 text-xs flex-grow justify-end">
                              <div className="flex flex-col items-center">
                                <span className="text-gray-400 text-xs text-center">Base</span>
                                <input type="number" value={attr.base} onChange={(e) => handleBasicAttributeChange('basicAttributes', key, 'base', e.target.value)} className="w-10 p-1 bg-gray-700 border border-gray-500 rounded-md text-white text-center" disabled={user.uid !== character.ownerUid && !isMaster} />
                              </div>
                              <div className="flex flex-col items-center">
                                <span className="text-gray-400 text-xs text-center">Perm.</span>
                                <input type="number" value={attr.permBonus} onChange={(e) => handleBasicAttributeChange('basicAttributes', key, 'permBonus', e.target.value)} className="w-10 p-1 bg-gray-700 border border-gray-500 rounded-md text-white text-center" disabled={user.uid !== character.ownerUid && !isMaster} />
                              </div>
                              <div className="flex flex-col items-center">
                                <span className="text-gray-400 text-xs text-center">Cond.</span>
                                <input type="number" value={attr.condBonus} onChange={(e) => handleBasicAttributeChange('basicAttributes', key, 'condBonus', e.target.value)} className="w-10 p-1 bg-gray-700 border border-gray-500 rounded-md text-white text-center" disabled={user.uid !== character.ownerUid && !isMaster} />
                              </div>
                              <div className="flex flex-col items-center">
                                <span className="text-gray-400 text-xs text-center">Total</span>
                                <input type="number" value={attr.total} readOnly className="w-10 p-1 bg-gray-700 border border-gray-500 rounded-md text-white font-bold cursor-not-allowed text-center" />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Atributos Mágicos */}
                  <div>
                    <h3 className="text-xl font-semibold text-purple-300 mb-3 border-b border-purple-500 pb-1">Mágicos</h3>
                    <div className="grid grid-cols-1 gap-2">
                      {Object.entries(character.magicAttributes).map(([key, attr]) => (
                        <div key={key} className="p-2 bg-gray-600 rounded-md">
                          <div className="flex items-center gap-2 text-xs justify-between">
                            <label className="capitalize text-base font-medium text-gray-200 flex-shrink-0">
                              {magicAttributeEmojis[key] || ''} {key.charAt(0).toUpperCase() + key.slice(1)}:
                            </label>
                            <div className="flex items-center gap-2 text-xs flex-grow justify-end">
                              <div className="flex flex-col items-center">
                                <span className="text-gray-400 text-xs text-center">Base</span>
                                <input type="number" value={attr.base} onChange={(e) => handleBasicAttributeChange('magicAttributes', key, 'base', e.target.value)} className="w-10 p-1 bg-gray-700 border border-gray-500 rounded-md text-white text-center" disabled={user.uid !== character.ownerUid && !isMaster} />
                              </div>
                              <div className="flex flex-col items-center">
                                <span className="text-gray-400 text-xs text-center">Perm.</span>
                                <input type="number" value={attr.permBonus} onChange={(e) => handleBasicAttributeChange('magicAttributes', key, 'permBonus', e.target.value)} className="w-10 p-1 bg-gray-700 border border-gray-500 rounded-md text-white text-center" disabled={user.uid !== character.ownerUid && !isMaster} />
                              </div>
                              <div className="flex flex-col items-center">
                                <span className="text-gray-400 text-xs text-center">Cond.</span>
                                <input type="number" value={attr.condBonus} onChange={(e) => handleBasicAttributeChange('magicAttributes', key, 'condBonus', e.target.value)} className="w-10 p-1 bg-gray-700 border border-gray-500 rounded-md text-white text-center" disabled={user.uid !== character.ownerUid && !isMaster} />
                              </div>
                              <div className="flex flex-col items-center">
                                <span className="text-gray-400 text-xs text-center">Total</span>
                                <input type="number" value={attr.total} readOnly className="w-10 p-1 bg-gray-700 border border-gray-500 rounded-md text-white font-bold cursor-not-allowed text-center" />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Inventário */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection(setIsInventoryCollapsed)}
              >
                Inventário
                <span>{isInventoryCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isInventoryCollapsed && (
                <>
                  <button
                    onClick={handleAddItem}
                    className="mb-4 px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                    disabled={user.uid !== character.ownerUid && !isMaster}
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
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => handleInventoryItemChange(index, 'name', e.target.value)}
                              className="font-semibold text-lg w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white"
                              disabled={user.uid !== character.ownerUid && !isMaster}
                            />
                            {(user.uid === character.ownerUid || isMaster) && (
                              <button
                                onClick={() => handleRemoveItem(index)}
                                className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                              >
                                Remover
                              </button>
                            )}
                          </div>
                          <textarea
                            value={item.description}
                            onChange={(e) => handleInventoryItemChange(index, 'description', e.target.value)}
                            rows="2"
                            className="text-sm text-gray-300 italic w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white resize-y"
                            placeholder="Descrição do item"
                            disabled={user.uid !== character.ownerUid && !isMaster}
                          ></textarea>
                        </li>
                      ))
                    )}
                  </ul>
                </>
              )}
            </section>

            {/* Carteira */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection(setIsWalletCollapsed)}
              >
                Zeni: {character.wallet.zeni}
                <span>{isWalletCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isWalletCollapsed && (
                <div className="flex items-center gap-2 w-full">
                  <input
                    type="number"
                    value={zeniAmount}
                    onChange={handleZeniChange}
                    className="w-16 p-2 bg-gray-600 border border-gray-500 rounded-md focus:ring-purple-500 focus:border-purple-500 text-white text-lg"
                    placeholder="Valor"
                    disabled={user.uid !== character.ownerUid && !isMaster}
                  />
                  <button
                    onClick={handleAddZeni}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                    disabled={user.uid !== character.ownerUid && !isMaster}
                  >
                    Adicionar
                  </button>
                  <button
                    onClick={handleRemoveZeni}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                    disabled={user.uid !== character.ownerUid && !isMaster}
                  >
                    Remover
                  </button>
                </div>
              )}
            </section>

            {/* Vantagens e Desvantagens */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection(setIsPerksCollapsed)}
              >
                Vantagens e Desvantagens
                <span>{isPerksCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isPerksCollapsed && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Vantagens */}
                  <div>
                    <h3 className="text-xl font-semibold text-purple-300 mb-3 border-b border-purple-500 pb-1">Vantagens</h3>
                    <button
                      onClick={() => handleAddPerk('advantages')}
                      className="mb-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                      disabled={user.uid !== character.ownerUid && !isMaster}
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
                              <input
                                type="text"
                                value={perk.name}
                                onChange={(e) => handlePerkChange('advantages', index, 'name', e.target.value)}
                                className="font-semibold text-lg w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white"
                                disabled={user.uid !== character.ownerUid && !isMaster}
                              />
                              <input
                                type="number"
                                value={perk.value}
                                onChange={(e) => handlePerkChange('advantages', index, 'value', e.target.value)}
                                className="w-10 ml-2 p-1 bg-gray-700 border border-gray-500 rounded-md text-white text-center"
                                disabled={user.uid !== character.ownerUid && !isMaster}
                              />
                              {(user.uid === character.ownerUid || isMaster) && (
                                <button
                                  onClick={() => handleRemovePerk('advantages', index)}
                                  className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                                >
                                  Remover
                                </button>
                              )}
                            </div>
                            <textarea
                              value={perk.description}
                              onChange={(e) => handlePerkChange('advantages', index, 'description', e.target.value)}
                              rows="2"
                              className="text-sm text-gray-300 italic w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white resize-y"
                              placeholder="Descrição da vantagem"
                              disabled={user.uid !== character.ownerUid && !isMaster}
                            ></textarea>
                            <div className="flex gap-3 text-sm text-gray-400 mt-2">
                              <span>Origem:</span>
                              <label className="flex items-center gap-1">
                                <input type="checkbox" checked={perk.origin.class} onChange={() => handlePerkOriginChange('advantages', index, 'class')} className="form-checkbox text-purple-500 rounded" disabled={user.uid !== character.ownerUid && !isMaster} /> Classe
                              </label>
                              <label className="flex items-center gap-1">
                                <input type="checkbox" checked={perk.origin.race} onChange={() => handlePerkOriginChange('advantages', index, 'race')} className="form-checkbox text-purple-500 rounded" disabled={user.uid !== character.ownerUid && !isMaster} /> Raça
                              </label>
                              <label className="flex items-center gap-1">
                                <input type="checkbox" checked={perk.origin.manual} onChange={() => handlePerkOriginChange('advantages', index, 'manual')} className="form-checkbox text-purple-500 rounded" disabled={user.uid !== character.ownerUid && !isMaster} /> Manual
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
                      disabled={user.uid !== character.ownerUid && !isMaster}
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
                              <input
                                type="text"
                                value={perk.name}
                                onChange={(e) => handlePerkChange('disadvantages', index, 'name', e.target.value)}
                                className="font-semibold text-lg w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white"
                                disabled={user.uid !== character.ownerUid && !isMaster}
                              />
                              <input
                                type="number"
                                value={perk.value}
                                onChange={(e) => handlePerkChange('disadvantages', index, 'value', e.target.value)}
                                className="w-10 ml-2 p-1 bg-gray-700 border border-gray-500 rounded-md text-white text-center"
                                disabled={user.uid !== character.ownerUid && !isMaster}
                              />
                              {(user.uid === character.ownerUid || isMaster) && (
                                <button
                                  onClick={() => handleRemovePerk('disadvantages', index)}
                                  className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                                >
                                  Remover
                                </button>
                              )}
                            </div>
                            <textarea
                              value={perk.description}
                              onChange={(e) => handlePerkChange('disadvantages', index, 'description', e.target.value)}
                              rows="2"
                              className="text-sm text-gray-300 italic w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white resize-y"
                              placeholder="Descrição da desvantagem"
                              disabled={user.uid !== character.ownerUid && !isMaster}
                            ></textarea>
                            <div className="flex gap-3 text-sm text-gray-400 mt-2">
                              <span>Origem:</span>
                              <label className="flex items-center gap-1">
                                <input type="checkbox" checked={perk.origin.class} onChange={() => handlePerkOriginChange('disadvantages', index, 'class')} className="form-checkbox text-purple-500 rounded" disabled={user.uid !== character.ownerUid && !isMaster} /> Classe
                              </label>
                              <label className="flex items-center gap-1">
                                <input type="checkbox" checked={perk.origin.race} onChange={() => handlePerkOriginChange('disadvantages', index, 'race')} className="form-checkbox text-purple-500 rounded" disabled={user.uid !== character.ownerUid && !isMaster} /> Raça
                              </label>
                              <label className="flex items-center gap-1">
                                <input type="checkbox" checked={perk.origin.manual} onChange={() => handlePerkOriginChange('disadvantages', index, 'manual')} className="form-checkbox text-purple-500 rounded" disabled={user.uid !== character.ownerUid && !isMaster} /> Manual
                              </label>
                            </div>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </section>

            {/* Habilidades de Classe/Raça e Customizadas */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection(setIsAbilitiesCollapsed)}
              >
                Habilidades (Classe, Raça, Customizadas)
                <span>{isAbilitiesCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isAbilitiesCollapsed && (
                <>
                  <button
                    onClick={handleAddAbility}
                    className="mb-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                    disabled={user.uid !== character.ownerUid && !isMaster}
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
                            <input
                              type="text"
                              value={ability.title}
                              onChange={(e) => handleAbilityChange(index, 'title', e.target.value)}
                              className="font-semibold text-lg w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white"
                              disabled={user.uid !== character.ownerUid && !isMaster}
                            />
                            {(user.uid === character.ownerUid || isMaster) && (
                              <button
                                onClick={() => handleRemoveAbility(index)}
                                className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                              >
                                Remover
                              </button>
                            )}
                          </div>
                          <textarea
                            value={ability.description}
                            onChange={(e) => handleAbilityChange(index, 'description', e.target.value)}
                            rows="2"
                            className="text-sm text-gray-300 italic w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white resize-y"
                            placeholder="Descrição da habilidade"
                            disabled={user.uid !== character.ownerUid && !isMaster}
                          ></textarea>
                        </li>
                      ))
                    )}
                  </ul>
                </>
              )}
            </section>

            {/* Especializações (Perícias) */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection(setIsSpecializationsCollapsed)}
              >
                Especializações (Perícias)
                <span>{isSpecializationsCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isSpecializationsCollapsed && (
                <>
                  <button
                    onClick={handleAddSpecialization}
                    className="mb-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                    disabled={user.uid !== character.ownerUid && !isMaster}
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
                            <input
                              type="text"
                              value={spec.name}
                              onChange={(e) => handleSpecializationChange(index, 'name', e.target.value)}
                              className="font-semibold text-lg w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white"
                              disabled={user.uid !== character.ownerUid && !isMaster}
                            />
                            {(user.uid === character.ownerUid || isMaster) && (
                              <button
                                onClick={() => handleRemoveSpecialization(index)}
                                className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                              >
                                Remover
                              </button>
                            )}
                          </div>
                          <div className="flex gap-4 mt-2 text-sm">
                            <label className="flex items-center gap-1">
                              Modificador:
                              <input
                                type="number"
                                value={spec.modifier}
                                onChange={(e) => handleSpecializationChange(index, 'modifier', e.target.value)}
                                className="w-8 p-1 bg-gray-700 border border-gray-500 rounded-md text-white"
                                disabled={user.uid !== character.ownerUid && !isMaster}
                              />
                            </label>
                            <label className="flex items-center gap-1">
                              Bônus:
                              <input
                                type="number"
                                value={spec.bonus}
                                onChange={(e) => handleSpecializationChange(index, 'bonus', e.target.value)}
                                className="w-8 p-1 bg-gray-700 border border-gray-500 rounded-md text-white"
                                disabled={user.uid !== character.ownerUid && !isMaster}
                              />
                            </label>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </>
              )}
            </section>

            {/* Itens Equipados */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection(setIsEquippedItemsCollapsed)}
              >
                Itens Equipados
                <span>{isEquippedItemsCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isEquippedItemsCollapsed && (
                <>
                  <button
                    onClick={handleAddEquippedItem}
                    className="mb-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                    disabled={user.uid !== character.ownerUid && !isMaster}
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
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => handleEquippedItemChange(index, 'name', e.target.value)}
                              className="font-semibold text-lg w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white"
                              disabled={user.uid !== character.ownerUid && !isMaster}
                            />
                            {(user.uid === character.ownerUid || isMaster) && (
                              <button
                                onClick={() => handleRemoveEquippedItem(index)}
                                className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                              >
                                Remover
                              </button>
                            )}
                          </div>
                          <textarea
                            value={item.description}
                            onChange={(e) => handleEquippedItemChange(index, 'description', e.target.value)}
                            rows="2"
                            className="text-sm text-gray-300 italic w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white resize-y mb-2"
                            placeholder="Descrição do item"
                            disabled={user.uid !== character.ownerUid && !isMaster}
                          ></textarea>
                          <label className="block text-sm font-medium text-gray-300 mb-1">Atributos/Efeitos:</label>
                          <textarea
                            value={item.attributes}
                            onChange={(e) => handleEquippedItemChange(index, 'attributes', e.target.value)}
                            rows="2"
                            className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white text-sm resize-y"
                            placeholder="Ex: +5 Força, Dano Fogo, etc."
                            disabled={user.uid !== character.ownerUid && !isMaster}
                          ></textarea>
                        </li>
                      ))
                    )}
                  </ul>
                </>
              )}
            </section>

            {/* História do Personagem */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection(setIsHistoryCollapsed)}
              >
                História do Personagem
                <span>{isHistoryCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isHistoryCollapsed && (
                <>
                  <div className="space-y-4 mb-4">
                    {character.history.length === 0 ? (
                      <p className="text-gray-400 italic">Nenhum bloco de história adicionado. Adicione texto ou imagens para começar!</p>
                    ) : (
                      character.history.map((block, index) => (
                        <div
                          key={block.id}
                          className="p-3 bg-gray-600 rounded-md shadow-sm border border-gray-500 relative"
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={(e) => handleDragOver(e)}
                          onDrop={(e) => handleDrop(e, index)}
                        >
                          {(user.uid === character.ownerUid || isMaster) && (
                            <button
                              onClick={() => removeHistoryBlock(block.id)}
                              className="absolute top-2 right-2 px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-full transition duration-200 ease-in-out"
                            >
                              X
                            </button>
                          )}
                          {block.type === 'text' ? (
                            <textarea
                              value={block.value}
                              onChange={(e) => updateHistoryBlock(block.id, 'value', e.target.value)}
                              rows="4"
                              className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white resize-y"
                              placeholder="Digite seu texto aqui..."
                              disabled={user.uid !== character.ownerUid && !isMaster}
                            ></textarea>
                          ) : (
                            <div className="flex flex-col items-center">
                              <img
                                src={block.value}
                                alt="Imagem da história"
                                className="max-w-full h-auto rounded-md shadow-md"
                                style={{
                                  width: block.fitWidth ? '100%' : (block.width ? `${block.width}px` : 'auto'),
                                  height: block.fitWidth ? 'auto' : (block.height ? `${block.height}px` : 'auto'),
                                  objectFit: 'contain'
                                }}
                                onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/300x200/000000/FFFFFF?text=Erro+ao+carregar+imagem'; }}
                              />
                              {(user.uid === character.ownerUid || isMaster) && (
                                <div className="flex items-center gap-4 mt-2 text-sm text-gray-300">
                                  <label className="flex items-center gap-1">
                                    <input
                                      type="checkbox"
                                      checked={block.fitWidth}
                                      onChange={(e) => updateHistoryBlock(block.id, 'fitWidth', e.target.checked)}
                                      className="form-checkbox text-purple-500 rounded"
                                    />
                                    Ajustar à Largura
                                  </label>
                                  {!block.fitWidth && (
                                    <>
                                      <label className="flex items-center gap-1">
                                        Largura (px):
                                        <input
                                          type="number"
                                          value={block.width}
                                          onChange={(e) => updateHistoryBlock(block.id, 'width', e.target.value)}
                                          className="w-20 p-1 bg-gray-700 border border-gray-500 rounded-md text-white text-center"
                                        />
                                      </label>
                                      <label className="flex items-center gap-1">
                                        Altura (px):
                                        <input
                                          type="number"
                                          value={block.height}
                                          onChange={(e) => updateHistoryBlock(block.id, 'height', e.target.value)}
                                          className="w-20 p-1 bg-gray-700 border border-gray-500 rounded-md text-white text-center"
                                        />
                                      </label>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 mt-4 justify-center">
                    <button
                      onClick={() => addHistoryBlock('text')}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                      disabled={user.uid !== character.ownerUid && !isMaster}
                    >
                      Adicionar Bloco de Texto
                    </button>
                    <button
                      onClick={() => addHistoryBlock('image')}
                      className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75"
                      disabled={user.uid !== character.ownerUid && !isMaster}
                    >
                      Adicionar Bloco de Imagem
                    </button>
                  </div>
                </>
              )}
            </section>

            {/* Anotações */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 mt-6 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection(setIsNotesCollapsed)}
              >
                Anotações
                <span>{isNotesCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isNotesCollapsed && (
                <textarea
                  name="notes"
                  value={character.notes}
                  onChange={handleNotesChange}
                  rows="6"
                  className="w-full p-3 bg-gray-600 border border-gray-500 rounded-md focus:ring-purple-500 focus:border-purple-500 text-white resize-y"
                  placeholder="Anotações diversas sobre o personagem, campanhas, NPCs, etc."
                  disabled={user.uid !== character.ownerUid && !isMaster}
                ></textarea>
              )}
            </section>

            {/* Botões de Ação */}
            <div className="flex flex-wrap justify-center gap-4 mt-8">
              <button
                onClick={handleExportJson}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-lg transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75"
                disabled={isLoading || !user || !character}
              >
                Exportar Ficha (JSON)
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".json"
                className="hidden"
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
                disabled={isLoading || !user || (user.uid !== character.ownerUid && !isMaster)}
              >
                Resetar Ficha
              </button>
            </div>
          </>
        )}

        {/* Mensagem se não estiver logado */}
        {!user && (
          <p className="text-center text-gray-400 text-lg mt-8">
            Faça login para começar a criar e gerenciar suas fichas de personagem!
          </p>
        )}
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

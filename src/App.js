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
        return 'Confirmar'; // Alterado para "Confirmar" para prompts genéricos
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

// Componente auxiliar para textarea com redimensionamento automático
// Ele ajusta a altura do textarea com base no seu scrollHeight (conteúdo)
const AutoResizingTextarea = ({ value, onChange, placeholder, className, disabled }) => {
    const textareaRef = useRef(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [value]);

    return (
        <textarea
            ref={textareaRef}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className={`${className} resize-none overflow-hidden`}
            rows="1"
            disabled={disabled}
        />
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
  const [isUserStatusCollapsed, setIsUserStatusCollapsed] = useState(false); 
  const [isCharacterInfoCollapsed, setIsCharacterInfoCollapsed] = useState(false); 
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
  }, [firebaseConfig, setModal]); // Adicionado setModal às dependências

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
      console.log("fetchCharactersList: DB, user, ou autenticação não prontos.");
      return;
    }

    setIsLoading(true);
    try {
      let allChars = [];
      if (isMaster) {
        console.log("fetchCharactersList: Modo Mestre, buscando todos os personagens.");
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
        console.log("fetchCharactersList: Todos os personagens carregados para o mestre.", allChars);
      } else {
        console.log("fetchCharactersList: Modo Jogador, buscando personagens próprios.");
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
        console.log("fetchCharactersList: Personagens do jogador carregados.", chars);
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
  }, [db, user, isAuthReady, isMaster, appId, setModal]);

  // Carrega a lista de personagens quando o user, db ou isAuthReady mudam
  useEffect(() => {
    if (user && db && isAuthReady) {
      console.log("useEffect (gatilho fetchCharactersList): Usuário, DB, Auth prontos.");
      fetchCharactersList();
    }
  }, [user, db, isAuthReady, fetchCharactersList]);

  // Listener em tempo real para o personagem selecionado
  useEffect(() => {
    let unsubscribeCharacter = () => {};
    const currentSelectedCharacterId = selectedCharIdState; // Usando o estado
    const currentOwnerUidFromUrl = ownerUidState; // Usando o estado
    console.log('useEffect (carregamento de personagem) acionado. selectedCharacterId:', currentSelectedCharacterId, 'ownerUidFromUrl:', currentOwnerUidFromUrl, 'isMaster:', isMaster, 'user:', user?.uid);

    if (db && user && isAuthReady && currentSelectedCharacterId) {
      const loadCharacter = async () => {
        setIsLoading(true);
        let targetUid = currentOwnerUidFromUrl; // Prioriza ownerUid do estado

        if (!targetUid) { // Se ownerUid não está no estado (ex: acesso direto ou link antigo)
          if (isMaster) {
            console.log('Modo Mestre, ownerUid não no estado. Buscando ownerUid para o personagem:', currentSelectedCharacterId);
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
              console.error("Erro ao buscar ownerUid para mestre:", error);
            }
            
            if (foundOwnerUid) {
              targetUid = foundOwnerUid;
              setOwnerUidState(foundOwnerUid); // Atualiza o estado do ownerUid
            } else {
              console.warn(`Personagem com ID ${currentSelectedCharacterId} não encontrado em nenhuma coleção de usuário para o mestre. Pode ter sido excluído ou ainda está sincronizando.`);
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
            console.log('Modo Jogador, ownerUid não no estado. Usando user.uid por padrão:', targetUid);
          }
        } else {
          console.log('OwnerUid encontrado no estado:', targetUid);
        }

        // Se targetUid ainda é null/undefined após todas as verificações, algo está errado.
        if (!targetUid) {
          console.error('Não foi possível determinar o targetUid para o carregamento do personagem.');
          setIsLoading(false);
          setCharacter(null);
          setSelectedCharIdState(null); // Limpa o estado
          setOwnerUidState(null); // Limpa o estado
          window.history.pushState({}, '', window.location.pathname);
          return;
        }

        const characterDocRef = doc(db, `artifacts/${appId}/users/${targetUid}/characterSheets/${currentSelectedCharacterId}`);
        console.log('Configurando onSnapshot para characterDocRef:', characterDocRef.path);

        unsubscribeCharacter = onSnapshot(characterDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.deleted) {
              console.log('Personagem encontrado, mas marcado como excluído.');
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
              
              // Deserialização e adição de isCollapsed para todas as listas
              deserializedData.inventory = (typeof deserializedData.inventory === 'string' ? JSON.parse(deserializedData.inventory) : deserializedData.inventory || []).map(item => ({ ...item, isCollapsed: item.isCollapsed !== undefined ? item.isCollapsed : false }));
              deserializedData.wallet = typeof deserializedData.wallet === 'string' ? JSON.parse(deserializedData.wallet) : deserializedData.wallet;
              deserializedData.advantages = (typeof deserializedData.advantages === 'string' ? JSON.parse(deserializedData.advantages) : deserializedData.advantages || []).map(item => ({ ...item, isCollapsed: item.isCollapsed !== undefined ? item.isCollapsed : false }));
              deserializedData.disadvantages = (typeof deserializedData.disadvantages === 'string' ? JSON.parse(deserializedData.disadvantages) : deserializedData.disadvantages || []).map(item => ({ ...item, isCollapsed: item.isCollapsed !== undefined ? item.isCollapsed : false }));
              deserializedData.abilities = (typeof deserializedData.abilities === 'string' ? JSON.parse(deserializedData.abilities) : deserializedData.abilities || []).map(item => ({ ...item, isCollapsed: item.isCollapsed !== undefined ? item.isCollapsed : false }));
              deserializedData.specializations = (typeof deserializedData.specializations === 'string' ? JSON.parse(deserializedData.specializations) : deserializedData.specializations || []).map(item => ({ ...item, isCollapsed: item.isCollapsed !== undefined ? item.isCollapsed : false }));
              deserializedData.equippedItems = (typeof deserializedData.equippedItems === 'string' ? JSON.parse(deserializedData.equippedItems) : deserializedData.equippedItems || []).map(item => ({ ...item, isCollapsed: item.isCollapsed !== undefined ? item.isCollapsed : false }));
              
              let historyData = deserializedData.history;
              if (typeof historyData === 'string') {
                try {
                  historyData = JSON.parse(historyData);
                } catch (parseError) {
                  historyData = [{ id: crypto.randomUUID(), type: 'text', value: historyData }];
                }
              }
              deserializedData.history = Array.isArray(historyData) ? historyData.map(block => ({ ...block, isCollapsed: block.isCollapsed !== undefined ? block.isCollapsed : false })) : [];

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

            deserializedData.mainAttributes = deserializedData.mainAttributes || { hp: { current: 0, max: 0 }, mp: { current: 0, max: 0 }, initiative: 0, fa: 0, fm: 0, fd: 0 };
            deserializedData.basicAttributes = deserializedData.basicAttributes || { forca: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, destreza: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, inteligencia: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, constituicao: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, sabedoria: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, carisma: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, armadura: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, poderDeFogo: { base: 0, permBonus: 0, condBonus: 0, total: 0 } };
            deserializedData.magicAttributes = deserializedData.magicAttributes || { fogo: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, agua: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, ar: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, terra: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, luz: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, trevas: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, espirito: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, outro: { base: 0, permBonus: 0, condBonus: 0, total: 0 } };
            deserializedData.inventory = deserializedData.inventory || [];
            deserializedData.wallet = deserializedData.wallet || { zeni: 0 };
            deserializedData.advantages = deserializedData.advantages || [];
            deserializedData.disadvantages = deserializedData.disadvantages || [];
            deserializedData.abilities = deserializedData.abilities || [];
            deserializedData.specializations = deserializedData.specializations || [];
            deserializedData.equippedItems = deserializedData.equippedItems || [];
            deserializedData.history = deserializedData.history || [];
            deserializedData.notes = deserializedData.notes || '';
            deserializedData.level = deserializedData.level !== undefined ? deserializedData.level : 0;
            deserializedData.xp = deserializedData.xp !== undefined ? deserializedData.xp : 100;
            deserializedData.photoUrl = deserializedData.photoUrl || ''; // Garante que photoUrl seja string vazia se não presente

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
      console.log('Nenhum ID de personagem selecionado, limpando estado do personagem.');
      setCharacter(null);
    }
    return () => {
      console.log('Limpando listener onSnapshot do personagem.');
      unsubscribeCharacter();
    };
  }, [db, user, isAuthReady, selectedCharIdState, ownerUidState, appId, isMaster, fetchCharactersList, setModal]); // Dependências atualizadas

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
    if (name === 'age' || name === 'level' || name === 'xp') {
      setCharacter(prevChar => ({
        ...prevChar,
        [name]: parseInt(value, 10) || 0,
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
    const parsedValue = parseInt(value, 10) || 0;

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

  // Função genérica para alternar o estado de colapso de um item em uma lista
  const toggleItemCollapsed = (listName, id) => {
    setCharacter(prevChar => ({
        ...prevChar,
        [listName]: (prevChar[listName] || []).map(item => {
            if (item.id === id) {
                return { ...item, isCollapsed: !item.isCollapsed };
            }
            return item;
        }),
    }));
  };

  // Lida com a adição de itens ao inventário (sem pop-up)
  const handleAddItem = () => {
    setCharacter(prevChar => {
      const updatedInventory = [...(prevChar.inventory || []), { id: crypto.randomUUID(), name: '', description: '', isCollapsed: false }];
      return { ...prevChar, inventory: updatedInventory };
    });
  };

  // Lida com a edição de itens no inventário
  const handleInventoryItemChange = (id, field, value) => {
    setCharacter(prevChar => {
      const updatedInventory = [...(prevChar.inventory || [])];
      const itemIndex = updatedInventory.findIndex(item => item.id === id);
      if (itemIndex !== -1) {
        updatedInventory[itemIndex][field] = value;
      }
      return { ...prevChar, inventory: updatedInventory };
    });
  };

  // Lida com a remoção de itens do inventário
  const handleRemoveItem = (idToRemove) => {
    setCharacter(prevChar => {
      const updatedInventory = (prevChar.inventory || []).filter(item => item.id !== idToRemove);
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
      wallet: { ...(prevChar.wallet || { zeni: 0 }), zeni: (prevChar.wallet.zeni || 0) + zeniAmount },
    }));
    setZeniAmount(0);
  };

  // Lida com a remoção de Zeni
  const handleRemoveZeni = () => {
    setCharacter(prevChar => ({
      ...prevChar,
      wallet: { ...(prevChar.wallet || { zeni: 0 }), zeni: Math.max(0, (prevChar.wallet.zeni || 0) - zeniAmount) },
    }));
    setZeniAmount(0);
  };

  // Lida com a adição de Vantagem/Desvantagem (sem pop-up para nome/descrição)
  const handleAddPerk = (type) => {
    setCharacter(prevChar => {
      const updatedPerks = [...(prevChar[type] || []), { id: crypto.randomUUID(), name: '', description: '', origin: { class: false, race: false, manual: false }, value: 0, isCollapsed: false }];
      return { ...prevChar, [type]: updatedPerks };
    });
  };

  // Lida com a edição de Vantagem/Desvantagem
  const handlePerkChange = (type, id, field, value) => {
    setCharacter(prevChar => {
      const updatedPerks = [...(prevChar[type] || [])];
      const perkIndex = updatedPerks.findIndex(perk => perk.id === id);
      if (perkIndex !== -1) {
        if (field === 'value') {
          updatedPerks[perkIndex][field] = parseInt(value, 10) || 0;
        } else {
          updatedPerks[perkIndex][field] = value;
        }
      }
      return { ...prevChar, [type]: updatedPerks };
    });
  };

  // Lida com a remoção de Vantagem/Desvantagem
  const handleRemovePerk = (type, idToRemove) => {
    setCharacter(prevChar => {
      const updatedPerks = (prevChar[type] || []).filter(perk => perk.id !== idToRemove);
      return { ...prevChar, [type]: updatedPerks };
    });
  };

  // Lida com a mudança de origem da Vantagem/Desvantagem
  const handlePerkOriginChange = (type, id, originType) => {
    setCharacter(prevChar => {
      const updatedPerks = [...(prevChar[type] || [])];
      const perkIndex = updatedPerks.findIndex(perk => perk.id === id);
      if (perkIndex !== -1) {
        updatedPerks[perkIndex].origin[originType] = !updatedPerks[perkIndex].origin[originType];
      }
      return { ...prevChar, [type]: updatedPerks };
    });
  };

  // Lida com a adição de Habilidade (Classe/Raça/Customizada) (sem pop-up)
  const handleAddAbility = () => {
    setCharacter(prevChar => {
      const updatedAbilities = [...(prevChar.abilities || []), { id: crypto.randomUUID(), title: '', description: '', isCollapsed: false }];
      return { ...prevChar, abilities: updatedAbilities };
    });
  };

  // Lida com a edição de Habilidade
  const handleAbilityChange = (id, field, value) => {
    setCharacter(prevChar => {
      const updatedAbilities = [...(prevChar.abilities || [])];
      const abilityIndex = updatedAbilities.findIndex(ability => ability.id === id);
      if (abilityIndex !== -1) {
        updatedAbilities[abilityIndex][field] = value;
      }
      return { ...prevChar, abilities: updatedAbilities };
    });
  };

  // Lida com a remoção de Habilidade
  const handleRemoveAbility = (idToRemove) => {
    setCharacter(prevChar => {
      const updatedAbilities = (prevChar.abilities || []).filter(ability => ability.id !== idToRemove);
      return { ...prevChar, abilities: updatedAbilities };
    });
  };

  // Lida com a adição de Especialização (sem pop-up para nome)
  const handleAddSpecialization = () => {
    setCharacter(prevChar => {
      const updatedSpecializations = [...(prevChar.specializations || []), { id: crypto.randomUUID(), name: '', modifier: 0, bonus: 0, isCollapsed: false }];
      return { ...prevChar, specializations: updatedSpecializations };
    });
  };

  // Lida com a remoção de Especialização
  const handleRemoveSpecialization = (idToRemove) => {
    setCharacter(prevChar => {
      const updatedSpecializations = (prevChar.specializations || []).filter(spec => spec.id !== idToRemove);
      return { ...prevChar, specializations: updatedSpecializations };
    });
  };

  // Lida com a mudança de nome, modificador ou bônus da Especialização
  const handleSpecializationChange = (id, field, value) => {
    setCharacter(prevChar => {
      const updatedSpecs = [...(prevChar.specializations || [])];
      const specIndex = updatedSpecs.findIndex(spec => spec.id === id);
      if (specIndex !== -1) {
        if (field === 'name') {
          updatedSpecs[specIndex][field] = value;
        } else {
          updatedSpecs[specIndex][field] = parseInt(value, 10) || 0;
        }
      }
      return { ...prevChar, specializations: updatedSpecs }; // CORRIGIDO: 'type' substituído por 'specializations'
    });
  };

  // Lida com a adição de Item Equipado (sem pop-up para nome/descrição/atributos)
  const handleAddEquippedItem = () => {
    setCharacter(prevChar => {
      const updatedEquippedItems = [...(prevChar.equippedItems || []), { id: crypto.randomUUID(), name: '', description: '', attributes: '', isCollapsed: false }];
      return { ...prevChar, equippedItems: updatedEquippedItems };
    });
  };

  // Lida com a edição de Item Equipado
  const handleEquippedItemChange = (id, field, value) => {
    setCharacter(prevChar => {
      const updatedEquippedItems = [...(prevChar.equippedItems || [])];
      const itemIndex = updatedEquippedItems.findIndex(item => item.id === id);
      if (itemIndex !== -1) {
        updatedEquippedItems[itemIndex][field] = value;
      }
      return { ...prevChar, equippedItems: updatedEquippedItems };
    });
  };

  // Lida com a remoção de Item Equipado
  const handleRemoveEquippedItem = (idToRemove) => {
    setCharacter(prevChar => {
      const updatedEquippedItems = (prevChar.equippedItems || []).filter(item => item.id !== idToRemove);
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
        history: [...(prevChar.history || []), { id: crypto.randomUUID(), type: 'text', value: '', isCollapsed: false }],
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
              history: [...(prevChar.history || []), { id: crypto.randomUUID(), type: 'image', value: url, width: '', height: '', fitWidth: true, isCollapsed: false }],
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
          if (field === 'isCollapsed') {
            return { ...block, isCollapsed: value };
          }
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
          name: '', photoUrl: '', age: '', height: '', gender: '', race: '', class: '', alignment: '',
          level: 0, xp: 100,
          mainAttributes: { hp: { current: 0, max: 0 }, mp: { current: 0, max: 0 }, initiative: 0, fa: 0, fm: 0, fd: 0 },
          basicAttributes: { forca: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, destreza: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, inteligencia: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, constituicao: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, sabedoria: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, carisma: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, armadura: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, poderDeFogo: { base: 0, permBonus: 0, condBonus: 0, total: 0 } },
          magicAttributes: { fogo: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, agua: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, ar: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, terra: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, luz: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, trevas: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, espirito: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, outro: { base: 0, permBonus: 0, condBonus: 0, total: 0 } },
          inventory: [], wallet: { zeni: 0 }, advantages: [], disadvantages: [], abilities: [], specializations: [], equippedItems: [], history: [], notes: '',
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
      console.log("Arquivo selecionado para importação:", file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          let importedData = JSON.parse(e.target.result);
          console.log("Dados JSON importados (antes da limpeza):", importedData);

          // Special handling for the empty string key if it contains notes data
          if (importedData[""] && !importedData.notes) {
              importedData.notes = importedData[""];
              console.log("Dados de notas movidos da chave vazia para a chave 'notes'.");
          }
          // Now remove the problematic empty string key if it still exists
          if (importedData[""]) {
              console.warn("Chave vazia problemática encontrada e removida do JSON importado.");
              delete importedData[""];
          }
          console.log("Dados JSON importados (após limpeza):", importedData);

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
                  xp: importedData.xp !== undefined ? importedData.xp : 100,
                  level: importedData.level !== undefined ? importedData.level : 0,
                  photoUrl: importedData.photoUrl || '', // Garante que photoUrl seja string vazia se não presente
                  mainAttributes: {
                    hp: { current: 0, max: 0, ...importedData.mainAttributes?.hp },
                    mp: { current: 0, max: 0, ...importedData.mainAttributes?.mp },
                    initiative: importedData.mainAttributes?.initiative || 0,
                    fa: importedData.mainAttributes?.fa || 0,
                    fm: importedData.mainAttributes?.fm || 0,
                    fd: importedData.mainAttributes?.fd || 0,
                  },
                  basicAttributes: {
                    forca: { base: 0, permBonus: 0, condBonus: 0, total: 0, ...importedData.basicAttributes?.forca },
                    destreza: { base: 0, permBonus: 0, condBonus: 0, total: 0, ...importedData.basicAttributes?.destreza },
                    inteligencia: { base: 0, permBonus: 0, condBonus: 0, total: 0, ...importedData.basicAttributes?.inteligencia },
                    constituicao: { base: 0, permBonus: 0, condBonus: 0, total: 0, ...importedData.basicAttributes?.constituicao },
                    sabedoria: { base: 0, permBonus: 0, condBonus: 0, total: 0, ...importedData.basicAttributes?.sabedoria },
                    carisma: { base: 0, permBonus: 0, condBonus: 0, total: 0, ...importedData.basicAttributes?.carisma },
                    armadura: { base: 0, permBonus: 0, condBonus: 0, total: 0, ...importedData.basicAttributes?.armadura },
                    poderDeFogo: { base: 0, permBonus: 0, condBonus: 0, total: 0, ...importedData.basicAttributes?.poderDeFogo },
                  },
                  magicAttributes: {
                    fogo: { base: 0, permBonus: 0, condBonus: 0, total: 0, ...importedData.magicAttributes?.fogo },
                    agua: { base: 0, permBonus: 0, condBonus: 0, total: 0, ...importedData.magicAttributes?.agua },
                    ar: { base: 0, permBonus: 0, condBonus: 0, total: 0, ...importedData.magicAttributes?.ar },
                    terra: { base: 0, permBonus: 0, condBonus: 0, total: 0, ...importedData.magicAttributes?.terra },
                    luz: { base: 0, permBonus: 0, condBonus: 0, total: 0, ...importedData.magicAttributes?.luz },
                    trevas: { base: 0, permBonus: 0, condBonus: 0, total: 0, ...importedData.magicAttributes?.trevas },
                    espirito: { base: 0, permBonus: 0, condBonus: 0, total: 0, ...importedData.magicAttributes?.espirito },
                    outro: { base: 0, permBonus: 0, condBonus: 0, total: 0, ...importedData.magicAttributes?.outro },
                  },
                  inventory: importedData.inventory || [],
                  wallet: importedData.wallet || { zeni: 0 },
                  advantages: importedData.advantages || [],
                  disadvantages: importedData.disadvantages || [],
                  abilities: importedData.abilities || [],
                  specializations: importedData.specializations || [],
                  equippedItems: importedData.equippedItems || [],
                  history: importedData.history || [],
                  notes: importedData.notes || '', // Já tratado acima para a chave vazia
                };

                importedCharacterData.history = importedCharacterData.history.map(block => {
                  if (block.type === 'image') {
                    return {
                      ...block,
                      width: block.width !== undefined ? block.width : '',
                      height: block.height !== undefined ? block.height : '',
                      fitWidth: block.fitWidth !== undefined ? block.fitWidth : true,
                      isCollapsed: block.isCollapsed !== undefined ? block.isCollapsed : false, // Adicionado para importação
                    };
                  }
                  return { ...block, isCollapsed: block.isCollapsed !== undefined ? block.isCollapsed : false }; // Adicionado para importação
                });
                importedCharacterData.inventory = importedCharacterData.inventory.map(item => ({ ...item, isCollapsed: item.isCollapsed !== undefined ? item.isCollapsed : false }));
                importedCharacterData.advantages = importedCharacterData.advantages.map(item => ({ ...item, isCollapsed: item.isCollapsed !== undefined ? item.isCollapsed : false }));
                importedCharacterData.disadvantages = importedCharacterData.disadvantages.map(item => ({ ...item, isCollapsed: item.isCollapsed !== undefined ? item.isCollapsed : false }));
                importedCharacterData.abilities = importedCharacterData.abilities.map(item => ({ ...item, isCollapsed: item.isCollapsed !== undefined ? item.isCollapsed : false }));
                importedCharacterData.specializations = importedCharacterData.specializations.map(item => ({ ...item, isCollapsed: item.isCollapsed !== undefined ? item.isCollapsed : false }));
                importedCharacterData.equippedItems = importedCharacterData.equippedItems.map(item => ({ ...item, isCollapsed: item.isCollapsed !== undefined ? item.isCollapsed : false }));

                console.log("Dados do personagem a serem salvos no Firestore:", importedCharacterData);

                try {
                    const characterDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/characterSheets/${newCharId}`);
                    const dataToSave = { ...importedCharacterData };
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
                    console.log(`Ficha de '${importedData.name}' importada e salva com sucesso no Firestore.`);
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
              message: 'O arquivo JSON selecionado não parece ser uma ficha de personagem válida (faltam nome, atributos principais ou básicos).',
              type: 'info',
              onConfirm: () => {},
              onCancel: () => {},
            });
            console.error('JSON inválido: Faltam campos essenciais (nome, mainAttributes ou basicAttributes).', importedData);
          }
        } catch (error) {
          setModal({
            isVisible: true,
            message: `Erro ao ler ou analisar o arquivo JSON. Certifique-se de que é um JSON válido. Detalhes: ${error.message}`,
            type: 'info',
            onConfirm: () => {},
            onCancel: () => {},
          });
          console.error('Erro ao analisar arquivo JSON:', error);
        }
      };
      reader.readAsText(file);
    } else {
      console.log("Nenhum arquivo selecionado.");
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
              photoUrl: '', // Default para string vazia para o novo comportamento
              age: '', height: '', gender: '', race: '', class: '', alignment: '',
              level: 0, xp: 100,
              mainAttributes: { hp: { current: 0, max: 0 }, mp: { current: 0, max: 0 }, initiative: 0, fa: 0, fm: 0, fd: 0 },
              basicAttributes: { forca: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, destreza: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, inteligencia: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, constituicao: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, sabedoria: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, carisma: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, armadura: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, poderDeFogo: { base: 0, permBonus: 0, condBonus: 0, total: 0 } },
              magicAttributes: { fogo: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, agua: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, ar: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, terra: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, luz: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, trevas: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, espirito: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, outro: { base: 0, permBonus: 0, condBonus: 0, total: 0 } },
              inventory: [], wallet: { zeni: 0 }, advantages: [], disadvantages: [], abilities: [], specializations: [], equippedItems: [], history: [], notes: '',
            };

            // Define isCollapsed como false para todos os arrays de itens
            newCharacterData.inventory = newCharacterData.inventory.map(item => ({ ...item, isCollapsed: false }));
            newCharacterData.advantages = newCharacterData.advantages.map(item => ({ ...item, isCollapsed: false }));
            newCharacterData.disadvantages = newCharacterData.disadvantages.map(item => ({ ...item, isCollapsed: false }));
            newCharacterData.abilities = newCharacterData.abilities.map(item => ({ ...item, isCollapsed: false }));
            newCharacterData.specializations = newCharacterData.specializations.map(item => ({ ...item, isCollapsed: false }));
            newCharacterData.equippedItems = newCharacterData.equippedItems.map(item => ({ ...item, isCollapsed: false }));
            newCharacterData.history = newCharacterData.history.map(item => ({ ...item, isCollapsed: false }));


            setCharacter(newCharacterData);
            setSelectedCharIdState(newCharId); // Define o estado
            setOwnerUidState(user.uid); // Define o estado
            window.history.pushState({}, '', `?charId=${newCharId}&ownerUid=${user.uid}`);

            const characterDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/characterSheets/${newCharId}`);
            const dataToSave = { ...newCharacterData };
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
  // Esta função agora aceita o setter de estado específico para cada seção
  const toggleSection = (setter) => setter(prev => !prev);

  // Lida com o clique na foto ou no botão '+' para alterar/adicionar URL da foto
  const handlePhotoUrlClick = () => {
    if (user.uid !== character.ownerUid && !isMaster) {
      // Se não for o proprietário ou mestre, não faz nada ao clicar na imagem/botão
      return;
    }
    setModal({
      isVisible: true,
      message: 'Insira a nova URL da imagem ou deixe em branco para remover:',
      type: 'prompt',
      onConfirm: (newUrl) => {
        setCharacter(prevChar => ({
          ...prevChar,
          photoUrl: newUrl,
        }));
        setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} }); // Fecha o modal após a atualização
      },
      onCancel: () => {
        setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
      },
    });
  };

  // Função para truncar o texto para as primeiras duas linhas
  const truncateText = (text, maxLines = 2) => {
    if (!text) return '';
    const lines = text.split('\n');
    if (lines.length <= maxLines) {
      return text;
    }
    return lines.slice(0, maxLines).join('\n') + '...';
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
      <div className="max-w-4xl mx-auto bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
        {/* Seção de Status do Usuário */}
        <div className="mb-6 bg-gray-700 p-4 rounded-lg shadow-md border border-gray-600">
          <h2 className="text-2xl font-bold mb-4 text-purple-400 cursor-pointer flex justify-between items-center" onClick={() => toggleSection(setIsUserStatusCollapsed)}>
            Status do Usuário
            <span className="text-gray-400 text-sm">{isUserStatusCollapsed ? '▼' : '▲'}</span>
          </h2>
          {!isUserStatusCollapsed && (
            <>
              {user ? (
                <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
                  <p className="text-lg text-gray-200">
                    Logado como: <span className="font-semibold text-purple-300">{user.displayName || user.email}</span>
                    {isMaster && <span className="ml-2 px-3 py-1 bg-yellow-600 text-white text-xs font-bold rounded-full">MESTRE</span>}
                  </p>
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                    <button
                      onClick={handleSignOut}
                      className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-lg transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                      disabled={isLoading}
                    >
                      Sair
                    </button>
                    {isMaster && (
                      <button
                        onClick={() => setViewingAllCharacters(true)}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                        disabled={isLoading}
                      >
                        Ver Todas as Fichas
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-gray-300 mb-4">Faça login para gerenciar suas fichas.</p>
                  <button
                    onClick={handleGoogleSignIn}
                    className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg shadow-lg transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                    disabled={isLoading}
                  >
                    Entrar com Google
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Lista de Personagens ou Ficha Detalhada */}
        {user && !selectedCharIdState && !viewingAllCharacters && (
          <div className="mb-6 bg-gray-700 p-4 rounded-lg shadow-md border border-gray-600">
            <h2 className="text-2xl font-bold mb-4 text-purple-400">Minhas Fichas</h2>
            {charactersList.length === 0 ? (
              <p className="text-gray-400 text-center">Você ainda não tem personagens. Crie um agora!</p>
            ) : (
              <ul className="space-y-3">
                {charactersList.map((char) => (
                  <li key={char.id} className="flex flex-col sm:flex-row items-center justify-between bg-gray-800 p-3 rounded-md shadow-sm border border-gray-600">
                    <span className="text-lg font-semibold text-gray-200 mb-2 sm:mb-0">{char.name}</span>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleSelectCharacter(char.id, char.ownerUid)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg transition duration-200 ease-in-out transform hover:scale-105"
                      >
                        Abrir
                      </button>
                      <button
                        onClick={() => handleDeleteCharacter(char.id, char.name, char.ownerUid)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition duration-200 ease-in-out transform hover:scale-105"
                      >
                        Excluir
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={handleCreateNewCharacter}
              className="mt-6 w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-lg transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75"
              disabled={isLoading}
            >
              Criar Nova Ficha
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
              className="mt-3 w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-lg transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75"
              disabled={isLoading}
            >
              Importar Ficha (JSON)
            </button>
          </div>
        )}

        {/* Lista de Todos os Personagens (Apenas para Mestre) */}
        {user && viewingAllCharacters && isMaster && !selectedCharIdState && (
          <div className="mb-6 bg-gray-700 p-4 rounded-lg shadow-md border border-gray-600">
            <h2 className="text-2xl font-bold mb-4 text-purple-400">Todas as Fichas (Mestre)</h2>
            <button
              onClick={handleBackToList}
              className="mb-4 px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg shadow-lg transition duration-200 ease-in-out transform hover:scale-105"
            >
              ← Voltar para Minhas Fichas
            </button>
            {charactersList.length === 0 ? (
              <p className="text-gray-400 text-center">Nenhum personagem encontrado no banco de dados.</p>
            ) : (
              <ul className="space-y-3">
                {charactersList.map((char) => (
                  <li key={char.id} className="flex flex-col sm:flex-row items-center justify-between bg-gray-800 p-3 rounded-md shadow-sm border border-gray-600">
                    <span className="text-lg font-semibold text-gray-200 mb-2 sm:mb-0">{char.name} <span className="text-gray-400 text-sm">(Dono: {char.ownerUid.substring(0, 6)}...)</span></span>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleSelectCharacter(char.id, char.ownerUid)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg transition duration-200 ease-in-out transform hover:scale-105"
                      >
                        Abrir
                      </button>
                      <button
                        onClick={() => handleDeleteCharacter(char.id, char.name, char.ownerUid)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition duration-200 ease-in-out transform hover:scale-105"
                      >
                        Excluir
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Ficha de Personagem Detalhada */}
        {user && character && selectedCharIdState && (
          <>
            <button
              onClick={handleBackToList}
              className="mb-6 px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg shadow-lg transition duration-200 ease-in-out transform hover:scale-105"
            >
              ← Voltar para a Lista
            </button>

            {/* Nome do Personagem e ID do Proprietário */}
            <h1 className="text-4xl font-extrabold text-center text-purple-300 mb-6">
              {character.name || 'Novo Personagem'}
            </h1>
            <p className="text-center text-gray-400 text-sm mb-6">
              ID da Ficha: <span className="font-mono text-gray-300">{selectedCharIdState}</span><br/>
              Proprietário: <span className="font-mono text-gray-300">{character.ownerUid}</span>
            </p>

            {/* Seção de Informações do Personagem */}
            <div className="mb-6 bg-gray-700 p-4 rounded-lg shadow-md border border-gray-600">
              <h2 className="text-2xl font-bold mb-4 text-purple-400 cursor-pointer flex justify-between items-center" onClick={() => toggleSection(setIsCharacterInfoCollapsed)}>
                Informações do Personagem
                <span className="text-gray-400 text-sm">{isCharacterInfoCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isCharacterInfoCollapsed && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col items-center justify-center p-4 bg-gray-800 rounded-lg border border-gray-600">
                    <div className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-purple-500 mb-3 flex items-center justify-center bg-gray-600">
                      {character.photoUrl ? (
                        <img
                          src={character.photoUrl}
                          alt="Foto do Personagem"
                          className="w-full h-full object-cover"
                          onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/128x128/374151/F9FAFB?text=Erro"; }}
                        />
                      ) : (
                        <span className="text-5xl text-gray-400">+</span>
                      )}
                      {(user.uid === character.ownerUid || isMaster) && (
                        <button
                          onClick={handlePhotoUrlClick}
                          className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white text-xl opacity-0 hover:opacity-100 transition-opacity duration-300 rounded-full"
                          title="Alterar Foto"
                        >
                          {character.photoUrl ? 'Alterar' : 'Adicionar'} Foto
                        </button>
                      )}
                    </div>
                    <p className="text-gray-300 text-center text-sm">Clique na imagem para alterar</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="block">
                      <span className="text-gray-400">Nome:</span>
                      <input
                        type="text"
                        name="name"
                        value={character.name}
                        onChange={handleChange}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                        disabled={user.uid !== character.ownerUid && !isMaster}
                      />
                    </label>
                    <label className="block">
                      <span className="text-gray-400">Idade:</span>
                      <input
                        type="number"
                        name="age"
                        value={character.age}
                        onChange={handleChange}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                        disabled={user.uid !== character.ownerUid && !isMaster}
                      />
                    </label>
                    <label className="block">
                      <span className="text-gray-400">Altura:</span>
                      <input
                        type="text"
                        name="height"
                        value={character.height}
                        onChange={handleChange}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                        disabled={user.uid !== character.ownerUid && !isMaster}
                      />
                    </label>
                    <label className="block">
                      <span className="text-gray-400">Gênero:</span>
                      <input
                        type="text"
                        name="gender"
                        value={character.gender}
                        onChange={handleChange}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                        disabled={user.uid !== character.ownerUid && !isMaster}
                      />
                    </label>
                    <label className="block">
                      <span className="text-gray-400">Raça:</span>
                      <input
                        type="text"
                        name="race"
                        value={character.race}
                        onChange={handleChange}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                        disabled={user.uid !== character.ownerUid && !isMaster}
                      />
                    </label>
                    <label className="block">
                      <span className="text-gray-400">Classe:</span>
                      <input
                        type="text"
                        name="class"
                        value={character.class}
                        onChange={handleChange}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                        disabled={user.uid !== character.ownerUid && !isMaster}
                      />
                    </label>
                    <label className="block">
                      <span className="text-gray-400">Alinhamento:</span>
                      <input
                        type="text"
                        name="alignment"
                        value={character.alignment}
                        onChange={handleChange}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                        disabled={user.uid !== character.ownerUid && !isMaster}
                      />
                    </label>
                    <label className="block">
                      <span className="text-gray-400">Nível:</span>
                      <input
                        type="number"
                        name="level"
                        value={character.level}
                        onChange={handleChange}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                        disabled={user.uid !== character.ownerUid && !isMaster}
                      />
                    </label>
                    <label className="block">
                      <span className="text-gray-400">XP:</span>
                      <input
                        type="number"
                        name="xp"
                        value={character.xp}
                        onChange={handleChange}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                        disabled={user.uid !== character.ownerUid && !isMaster}
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Seção de Atributos Principais */}
            <div className="mb-6 bg-gray-700 p-4 rounded-lg shadow-md border border-gray-600">
              <h2 className="text-2xl font-bold mb-4 text-purple-400 cursor-pointer flex justify-between items-center" onClick={() => toggleSection(setIsMainAttributesCollapsed)}>
                Atributos Principais
                <span className="text-gray-400 text-sm">{isMainAttributesCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isMainAttributesCollapsed && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {/* HP */}
                  <div className="bg-gray-800 p-3 rounded-lg border border-gray-600">
                    <h3 className="text-lg font-semibold text-gray-200 mb-2">HP (Vida)</h3>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        name="current"
                        data-attribute="hp"
                        value={character.mainAttributes.hp.current}
                        onChange={handleMainAttributeChange}
                        className="w-1/2 p-2 bg-gray-700 border border-gray-600 rounded-md text-white text-center focus:ring-purple-500 focus:border-purple-500"
                        disabled={user.uid !== character.ownerUid && !isMaster}
                      />
                      <span className="text-gray-300">/</span>
                      <input
                        type="number"
                        name="max"
                        data-attribute="hp"
                        value={character.mainAttributes.hp.max}
                        onChange={handleMainAttributeChange}
                        className="w-1/2 p-2 bg-gray-700 border border-gray-600 rounded-md text-white text-center focus:ring-purple-500 focus:border-purple-500"
                        disabled={user.uid !== character.ownerUid && !isMaster}
                      />
                    </div>
                  </div>
                  {/* MP */}
                  <div className="bg-gray-800 p-3 rounded-lg border border-gray-600">
                    <h3 className="text-lg font-semibold text-gray-200 mb-2">MP (Magia)</h3>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        name="current"
                        data-attribute="mp"
                        value={character.mainAttributes.mp.current}
                        onChange={handleMainAttributeChange}
                        className="w-1/2 p-2 bg-gray-700 border border-gray-600 rounded-md text-white text-center focus:ring-purple-500 focus:border-purple-500"
                        disabled={user.uid !== character.ownerUid && !isMaster}
                      />
                      <span className="text-gray-300">/</span>
                      <input
                        type="number"
                        name="max"
                        data-attribute="mp"
                        value={character.mainAttributes.mp.max}
                        onChange={handleMainAttributeChange}
                        className="w-1/2 p-2 bg-gray-700 border border-gray-600 rounded-md text-white text-center focus:ring-purple-500 focus:border-purple-500"
                        disabled={user.uid !== character.ownerUid && !isMaster}
                      />
                    </div>
                  </div>
                  {/* Iniciativa */}
                  <div className="bg-gray-800 p-3 rounded-lg border border-gray-600">
                    <label className="block">
                      <span className="text-lg font-semibold text-gray-200">Iniciativa:</span>
                      <input
                        type="number"
                        name="initiative"
                        value={character.mainAttributes.initiative}
                        onChange={handleSingleMainAttributeChange}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white text-center mt-1 focus:ring-purple-500 focus:border-purple-500"
                        disabled={user.uid !== character.ownerUid && !isMaster}
                      />
                    </label>
                  </div>
                  {/* FA */}
                  <div className="bg-gray-800 p-3 rounded-lg border border-gray-600">
                    <label className="block">
                      <span className="text-lg font-semibold text-gray-200">FA (Força de Ataque):</span>
                      <input
                        type="number"
                        name="fa"
                        value={character.mainAttributes.fa}
                        onChange={handleSingleMainAttributeChange}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white text-center mt-1 focus:ring-purple-500 focus:border-purple-500"
                        disabled={user.uid !== character.ownerUid && !isMaster}
                      />
                    </label>
                  </div>
                  {/* FM */}
                  <div className="bg-gray-800 p-3 rounded-lg border border-gray-600">
                    <label className="block">
                      <span className="text-lg font-semibold text-gray-200">FM (Força Mágica):</span>
                      <input
                        type="number"
                        name="fm"
                        value={character.mainAttributes.fm}
                        onChange={handleSingleMainAttributeChange}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white text-center mt-1 focus:ring-purple-500 focus:border-purple-500"
                        disabled={user.uid !== character.ownerUid && !isMaster}
                      />
                    </label>
                  </div>
                  {/* FD */}
                  <div className="bg-gray-800 p-3 rounded-lg border border-gray-600">
                    <label className="block">
                      <span className="text-lg font-semibold text-gray-200">FD (Força de Defesa):</span>
                      <input
                        type="number"
                        name="fd"
                        value={character.mainAttributes.fd}
                        onChange={handleSingleMainAttributeChange}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white text-center mt-1 focus:ring-purple-500 focus:border-purple-500"
                        disabled={user.uid !== character.ownerUid && !isMaster}
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Seção de Atributos Básicos */}
            <div className="mb-6 bg-gray-700 p-4 rounded-lg shadow-md border border-gray-600">
              <h2 className="text-2xl font-bold mb-4 text-purple-400 cursor-pointer flex justify-between items-center" onClick={() => toggleSection(setIsBasicAttributesCollapsed)}>
                Atributos Básicos
                <span className="text-gray-400 text-sm">{isBasicAttributesCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isBasicAttributesCollapsed && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Object.entries(character.basicAttributes).map(([key, attr]) => (
                    <div key={key} className="bg-gray-800 p-3 rounded-lg border border-gray-600">
                      <h3 className="text-lg font-semibold text-gray-200 mb-2 flex items-center">
                        {basicAttributeEmojis[key]} {key.charAt(0).toUpperCase() + key.slice(1)}
                      </h3>
                      <label className="block mb-1">
                        <span className="text-gray-400 text-sm">Base:</span>
                        <input
                          type="number"
                          value={attr.base}
                          onChange={(e) => handleBasicAttributeChange('basicAttributes', key, 'base', e.target.value)}
                          className="w-full p-1 bg-gray-700 border border-gray-600 rounded-md text-white text-center text-sm focus:ring-purple-500 focus:border-purple-500"
                          disabled={user.uid !== character.ownerUid && !isMaster}
                        />
                      </label>
                      <label className="block mb-1">
                        <span className="text-gray-400 text-sm">Bônus Perm.:</span>
                        <input
                          type="number"
                          value={attr.permBonus}
                          onChange={(e) => handleBasicAttributeChange('basicAttributes', key, 'permBonus', e.target.value)}
                          className="w-full p-1 bg-gray-700 border border-gray-600 rounded-md text-white text-center text-sm focus:ring-purple-500 focus:border-purple-500"
                          disabled={user.uid !== character.ownerUid && !isMaster}
                        />
                      </label>
                      <label className="block mb-1">
                        <span className="text-gray-400 text-sm">Bônus Cond.:</span>
                        <input
                          type="number"
                          value={attr.condBonus}
                          onChange={(e) => handleBasicAttributeChange('basicAttributes', key, 'condBonus', e.target.value)}
                          className="w-full p-1 bg-gray-700 border border-gray-600 rounded-md text-white text-center text-sm focus:ring-purple-500 focus:border-purple-500"
                          disabled={user.uid !== character.ownerUid && !isMaster}
                        />
                      </label>
                      <p className="text-right text-lg font-bold text-purple-300 mt-2">Total: {attr.total}</p>
                    </div>
                  ))}
                  {Object.entries(character.magicAttributes).map(([key, attr]) => (
                    <div key={key} className="bg-gray-800 p-3 rounded-lg border border-gray-600">
                      <h3 className="text-lg font-semibold text-gray-200 mb-2 flex items-center">
                        {magicAttributeEmojis[key]} {key.charAt(0).toUpperCase() + key.slice(1)}
                      </h3>
                      <label className="block mb-1">
                        <span className="text-gray-400 text-sm">Base:</span>
                        <input
                          type="number"
                          value={attr.base}
                          onChange={(e) => handleBasicAttributeChange('magicAttributes', key, 'base', e.target.value)}
                          className="w-full p-1 bg-gray-700 border border-gray-600 rounded-md text-white text-center text-sm focus:ring-purple-500 focus:border-purple-500"
                          disabled={user.uid !== character.ownerUid && !isMaster}
                        />
                      </label>
                      <label className="block mb-1">
                        <span className="text-gray-400 text-sm">Bônus Perm.:</span>
                        <input
                          type="number"
                          value={attr.permBonus}
                          onChange={(e) => handleBasicAttributeChange('magicAttributes', key, 'permBonus', e.target.value)}
                          className="w-full p-1 bg-gray-700 border border-gray-600 rounded-md text-white text-center text-sm focus:ring-purple-500 focus:border-purple-500"
                          disabled={user.uid !== character.ownerUid && !isMaster}
                        />
                      </label>
                      <label className="block mb-1">
                        <span className="text-gray-400 text-sm">Bônus Cond.:</span>
                        <input
                          type="number"
                          value={attr.condBonus}
                          onChange={(e) => handleBasicAttributeChange('magicAttributes', key, 'condBonus', e.target.value)}
                          className="w-full p-1 bg-gray-700 border border-gray-600 rounded-md text-white text-center text-sm focus:ring-purple-500 focus:border-purple-500"
                          disabled={user.uid !== character.ownerUid && !isMaster}
                        />
                      </label>
                      <p className="text-right text-lg font-bold text-purple-300 mt-2">Total: {attr.total}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Seção de Inventário */}
            <div className="mb-6 bg-gray-700 p-4 rounded-lg shadow-md border border-gray-600">
              <h2 className="text-2xl font-bold mb-4 text-purple-400 cursor-pointer flex justify-between items-center" onClick={() => toggleSection(setIsInventoryCollapsed)}>
                Inventário
                <span className="text-gray-400 text-sm">{isInventoryCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isInventoryCollapsed && (
                <>
                  {(user.uid === character.ownerUid || isMaster) && (
                    <button
                      onClick={handleAddItem}
                      className="mb-4 px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                    >
                      Adicionar Item
                    </button>
                  )}
                  {character.inventory.length === 0 ? (
                    <p className="text-gray-400 text-center">Nenhum item no inventário.</p>
                  ) : (
                    <ul className="space-y-4">
                      {character.inventory.map((item) => (
                        <li key={item.id} className="bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-600">
                          <div className="flex justify-between items-center mb-2">
                            <h3 className="text-xl font-semibold text-gray-200 cursor-pointer" onClick={() => toggleItemCollapsed('inventory', item.id)}>
                              {item.name || 'Novo Item'}
                            </h3>
                            {(user.uid === character.ownerUid || isMaster) && (
                              <button
                                onClick={() => handleRemoveItem(item.id)}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition duration-200 ease-in-out transform hover:scale-105"
                              >
                                Remover
                              </button>
                            )}
                          </div>
                          {!item.isCollapsed && (
                            <>
                              <label className="block mb-2">
                                <span className="text-gray-400">Nome:</span>
                                <input
                                  type="text"
                                  value={item.name}
                                  onChange={(e) => handleInventoryItemChange(item.id, 'name', e.target.value)}
                                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                                  disabled={user.uid !== character.ownerUid && !isMaster}
                                />
                              </label>
                              <label className="block">
                                <span className="text-gray-400">Descrição:</span>
                                <AutoResizingTextarea
                                  value={item.description}
                                  onChange={(e) => handleInventoryItemChange(item.id, 'description', e.target.value)}
                                  placeholder="Descrição do item..."
                                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                                  disabled={user.uid !== character.ownerUid && !isMaster}
                                />
                              </label>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            {/* Seção de Carteira (Zeni) */}
            <div className="mb-6 bg-gray-700 p-4 rounded-lg shadow-md border border-gray-600">
              <h2 className="text-2xl font-bold mb-4 text-purple-400 cursor-pointer flex justify-between items-center" onClick={() => toggleSection(setIsWalletCollapsed)}>
                Carteira (Zeni)
                <span className="text-gray-400 text-sm">{isWalletCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isWalletCollapsed && (
                <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4">
                  <p className="text-3xl font-bold text-green-400">
                    Zeni: {character.wallet.zeni}
                  </p>
                  {(user.uid === character.ownerUid || isMaster) && (
                    <div className="flex flex-grow space-x-2">
                      <input
                        type="number"
                        value={zeniAmount}
                        onChange={handleZeniChange}
                        placeholder="Valor"
                        className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md text-white text-center focus:ring-purple-500 focus:border-purple-500"
                      />
                      <button
                        onClick={handleAddZeni}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105"
                      >
                        Add
                      </button>
                      <button
                        onClick={handleRemoveZeni}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105"
                      >
                        Remover
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Seção de Vantagens e Desvantagens */}
            <div className="mb-6 bg-gray-700 p-4 rounded-lg shadow-md border border-gray-600">
              <h2 className="text-2xl font-bold mb-4 text-purple-400 cursor-pointer flex justify-between items-center" onClick={() => toggleSection(setIsPerksCollapsed)}>
                Vantagens e Desvantagens
                <span className="text-gray-400 text-sm">{isPerksCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isPerksCollapsed && (
                <>
                  {(user.uid === character.ownerUid || isMaster) && (
                    <div className="flex gap-4 mb-4">
                      <button
                        onClick={() => handleAddPerk('advantages')}
                        className="flex-1 px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                      >
                        Adicionar Vantagem
                      </button>
                      <button
                        onClick={() => handleAddPerk('disadvantages')}
                        className="flex-1 px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-lg transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                      >
                        Adicionar Desvantagem
                      </button>
                    </div>
                  )}

                  {/* Vantagens */}
                  <h3 className="text-xl font-bold text-green-300 mb-3">Vantagens</h3>
                  {character.advantages.length === 0 ? (
                    <p className="text-gray-400 text-center mb-4">Nenhuma vantagem.</p>
                  ) : (
                    <ul className="space-y-4 mb-6">
                      {character.advantages.map((perk) => (
                        <li key={perk.id} className="bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-600">
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="text-lg font-semibold text-gray-200 cursor-pointer" onClick={() => toggleItemCollapsed('advantages', perk.id)}>
                              {perk.name || 'Nova Vantagem'} ({perk.value >= 0 ? '+' : ''}{perk.value} Pts)
                            </h4>
                            {(user.uid === character.ownerUid || isMaster) && (
                              <button
                                onClick={() => handleRemovePerk('advantages', perk.id)}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition duration-200 ease-in-out transform hover:scale-105"
                              >
                                Remover
                              </button>
                            )}
                          </div>
                          {!perk.isCollapsed && (
                            <>
                              <label className="block mb-2">
                                <span className="text-gray-400">Nome:</span>
                                <input
                                  type="text"
                                  value={perk.name}
                                  onChange={(e) => handlePerkChange('advantages', perk.id, 'name', e.target.value)}
                                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                                  disabled={user.uid !== character.ownerUid && !isMaster}
                                />
                              </label>
                              <label className="block mb-2">
                                <span className="text-gray-400">Descrição:</span>
                                <AutoResizingTextarea
                                  value={perk.description}
                                  onChange={(e) => handlePerkChange('advantages', perk.id, 'description', e.target.value)}
                                  placeholder="Descrição da vantagem..."
                                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                                  disabled={user.uid !== character.ownerUid && !isMaster}
                                />
                              </label>
                              <label className="block mb-2">
                                <span className="text-gray-400">Valor em Pontos:</span>
                                <input
                                  type="number"
                                  value={perk.value}
                                  onChange={(e) => handlePerkChange('advantages', perk.id, 'value', e.target.value)}
                                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                                  disabled={user.uid !== character.ownerUid && !isMaster}
                                />
                              </label>
                              <div className="flex items-center space-x-4 text-gray-400">
                                <span className="mr-2">Origem:</span>
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={perk.origin.class}
                                    onChange={() => handlePerkOriginChange('advantages', perk.id, 'class')}
                                    className="form-checkbox h-5 w-5 text-purple-600 rounded"
                                    disabled={user.uid !== character.ownerUid && !isMaster}
                                  />
                                  <span className="ml-2">Classe</span>
                                </label>
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={perk.origin.race}
                                    onChange={() => handlePerkOriginChange('advantages', perk.id, 'race')}
                                    className="form-checkbox h-5 w-5 text-purple-600 rounded"
                                    disabled={user.uid !== character.ownerUid && !isMaster}
                                  />
                                  <span className="ml-2">Raça</span>
                                </label>
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={perk.origin.manual}
                                    onChange={() => handlePerkOriginChange('advantages', perk.id, 'manual')}
                                    className="form-checkbox h-5 w-5 text-purple-600 rounded"
                                    disabled={user.uid !== character.ownerUid && !isMaster}
                                  />
                                  <span className="ml-2">Manual</span>
                                </label>
                              </div>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Desvantagens */}
                  <h3 className="text-xl font-bold text-red-300 mb-3">Desvantagens</h3>
                  {character.disadvantages.length === 0 ? (
                    <p className="text-gray-400 text-center">Nenhuma desvantagem.</p>
                  ) : (
                    <ul className="space-y-4">
                      {character.disadvantages.map((perk) => (
                        <li key={perk.id} className="bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-600">
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="text-lg font-semibold text-gray-200 cursor-pointer" onClick={() => toggleItemCollapsed('disadvantages', perk.id)}>
                              {perk.name || 'Nova Desvantagem'} ({perk.value >= 0 ? '+' : ''}{perk.value} Pts)
                            </h4>
                            {(user.uid === character.ownerUid || isMaster) && (
                              <button
                                onClick={() => handleRemovePerk('disadvantages', perk.id)}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition duration-200 ease-in-out transform hover:scale-105"
                              >
                                Remover
                              </button>
                            )}
                          </div>
                          {!perk.isCollapsed && (
                            <>
                              <label className="block mb-2">
                                <span className="text-gray-400">Nome:</span>
                                <input
                                  type="text"
                                  value={perk.name}
                                  onChange={(e) => handlePerkChange('disadvantages', perk.id, 'name', e.target.value)}
                                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                                  disabled={user.uid !== character.ownerUid && !isMaster}
                                />
                              </label>
                              <label className="block mb-2">
                                <span className="text-gray-400">Descrição:</span>
                                <AutoResizingTextarea
                                  value={perk.description}
                                  onChange={(e) => handlePerkChange('disadvantages', perk.id, 'description', e.target.value)}
                                  placeholder="Descrição da desvantagem..."
                                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                                  disabled={user.uid !== character.ownerUid && !isMaster}
                                />
                              </label>
                              <label className="block mb-2">
                                <span className="text-gray-400">Valor em Pontos:</span>
                                <input
                                  type="number"
                                  value={perk.value}
                                  onChange={(e) => handlePerkChange('disadvantages', perk.id, 'value', e.target.value)}
                                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                                  disabled={user.uid !== character.ownerUid && !isMaster}
                                />
                              </label>
                              <div className="flex items-center space-x-4 text-gray-400">
                                <span className="mr-2">Origem:</span>
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={perk.origin.class}
                                    onChange={() => handlePerkOriginChange('disadvantages', perk.id, 'class')}
                                    className="form-checkbox h-5 w-5 text-purple-600 rounded"
                                    disabled={user.uid !== character.ownerUid && !isMaster}
                                  />
                                  <span className="ml-2">Classe</span>
                                </label>
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={perk.origin.race}
                                    onChange={() => handlePerkOriginChange('disadvantages', perk.id, 'race')}
                                    className="form-checkbox h-5 w-5 text-purple-600 rounded"
                                    disabled={user.uid !== character.ownerUid && !isMaster}
                                  />
                                  <span className="ml-2">Raça</span>
                                </label>
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={perk.origin.manual}
                                    onChange={() => handlePerkOriginChange('disadvantages', perk.id, 'manual')}
                                    className="form-checkbox h-5 w-5 text-purple-600 rounded"
                                    disabled={user.uid !== character.ownerUid && !isMaster}
                                  />
                                  <span className="ml-2">Manual</span>
                                </label>
                              </div>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            {/* Seção de Habilidades */}
            <div className="mb-6 bg-gray-700 p-4 rounded-lg shadow-md border border-gray-600">
              <h2 className="text-2xl font-bold mb-4 text-purple-400 cursor-pointer flex justify-between items-center" onClick={() => toggleSection(setIsAbilitiesCollapsed)}>
                Habilidades
                <span className="text-gray-400 text-sm">{isAbilitiesCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isAbilitiesCollapsed && (
                <>
                  {(user.uid === character.ownerUid || isMaster) && (
                    <button
                      onClick={handleAddAbility}
                      className="mb-4 px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                    >
                      Adicionar Habilidade
                    </button>
                  )}
                  {character.abilities.length === 0 ? (
                    <p className="text-gray-400 text-center">Nenhuma habilidade.</p>
                  ) : (
                    <ul className="space-y-4">
                      {character.abilities.map((ability) => (
                        <li key={ability.id} className="bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-600">
                          <div className="flex justify-between items-center mb-2">
                            <h3 className="text-xl font-semibold text-gray-200 cursor-pointer" onClick={() => toggleItemCollapsed('abilities', ability.id)}>
                              {ability.title || 'Nova Habilidade'}
                            </h3>
                            {(user.uid === character.ownerUid || isMaster) && (
                              <button
                                onClick={() => handleRemoveAbility(ability.id)}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition duration-200 ease-in-out transform hover:scale-105"
                              >
                                Remover
                              </button>
                            )}
                          </div>
                          {!ability.isCollapsed && (
                            <>
                              <label className="block mb-2">
                                <span className="text-gray-400">Título:</span>
                                <input
                                  type="text"
                                  value={ability.title}
                                  onChange={(e) => handleAbilityChange(ability.id, 'title', e.target.value)}
                                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                                  disabled={user.uid !== character.ownerUid && !isMaster}
                                />
                              </label>
                              <label className="block">
                                <span className="text-gray-400">Descrição:</span>
                                <AutoResizingTextarea
                                  value={ability.description}
                                  onChange={(e) => handleAbilityChange(ability.id, 'description', e.target.value)}
                                  placeholder="Descrição da habilidade..."
                                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                                  disabled={user.uid !== character.ownerUid && !isMaster}
                                />
                              </label>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            {/* Seção de Especializações */}
            <div className="mb-6 bg-gray-700 p-4 rounded-lg shadow-md border border-gray-600">
              <h2 className="text-2xl font-bold mb-4 text-purple-400 cursor-pointer flex justify-between items-center" onClick={() => toggleSection(setIsSpecializationsCollapsed)}>
                Especializações
                <span className="text-gray-400 text-sm">{isSpecializationsCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isSpecializationsCollapsed && (
                <>
                  {(user.uid === character.ownerUid || isMaster) && (
                    <button
                      onClick={handleAddSpecialization}
                      className="mb-4 px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                    >
                      Adicionar Especialização
                    </button>
                  )}
                  {character.specializations.length === 0 ? (
                    <p className="text-gray-400 text-center">Nenhuma especialização.</p>
                  ) : (
                    <ul className="space-y-4">
                      {character.specializations.map((spec) => (
                        <li key={spec.id} className="bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-600">
                          <div className="flex justify-between items-center mb-2">
                            <h3 className="text-xl font-semibold text-gray-200 cursor-pointer" onClick={() => toggleItemCollapsed('specializations', spec.id)}>
                              {spec.name || 'Nova Especialização'}
                            </h3>
                            {(user.uid === character.ownerUid || isMaster) && (
                              <button
                                onClick={() => handleRemoveSpecialization(spec.id)}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition duration-200 ease-in-out transform hover:scale-105"
                              >
                                Remover
                              </button>
                            )}
                          </div>
                          {!spec.isCollapsed && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <label className="block">
                                <span className="text-gray-400">Nome:</span>
                                <input
                                  type="text"
                                  value={spec.name}
                                  onChange={(e) => handleSpecializationChange(spec.id, 'name', e.target.value)}
                                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                                  disabled={user.uid !== character.ownerUid && !isMaster}
                                />
                              </label>
                              <label className="block">
                                <span className="text-gray-400">Modificador:</span>
                                <input
                                  type="number"
                                  value={spec.modifier}
                                  onChange={(e) => handleSpecializationChange(spec.id, 'modifier', e.target.value)}
                                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                                  disabled={user.uid !== character.ownerUid && !isMaster}
                                />
                              </label>
                              <label className="block">
                                <span className="text-gray-400">Bônus:</span>
                                <input
                                  type="number"
                                  value={spec.bonus}
                                  onChange={(e) => handleSpecializationChange(spec.id, 'bonus', e.target.value)}
                                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                                  disabled={user.uid !== character.ownerUid && !isMaster}
                                />
                              </label>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            {/* Seção de Itens Equipados */}
            <div className="mb-6 bg-gray-700 p-4 rounded-lg shadow-md border border-gray-600">
              <h2 className="text-2xl font-bold mb-4 text-purple-400 cursor-pointer flex justify-between items-center" onClick={() => toggleSection(setIsEquippedItemsCollapsed)}>
                Itens Equipados
                <span className="text-gray-400 text-sm">{isEquippedItemsCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isEquippedItemsCollapsed && (
                <>
                  {(user.uid === character.ownerUid || isMaster) && (
                    <button
                      onClick={handleAddEquippedItem}
                      className="mb-4 px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                    >
                      Adicionar Item Equipado
                    </button>
                  )}
                  {character.equippedItems.length === 0 ? (
                    <p className="text-gray-400 text-center">Nenhum item equipado.</p>
                  ) : (
                    <ul className="space-y-4">
                      {character.equippedItems.map((item) => (
                        <li key={item.id} className="bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-600">
                          <div className="flex justify-between items-center mb-2">
                            <h3 className="text-xl font-semibold text-gray-200 cursor-pointer" onClick={() => toggleItemCollapsed('equippedItems', item.id)}>
                              {item.name || 'Novo Item Equipado'}
                            </h3>
                            {(user.uid === character.ownerUid || isMaster) && (
                              <button
                                onClick={() => handleRemoveEquippedItem(item.id)}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition duration-200 ease-in-out transform hover:scale-105"
                              >
                                Remover
                              </button>
                            )}
                          </div>
                          {!item.isCollapsed && (
                            <>
                              <label className="block mb-2">
                                <span className="text-gray-400">Nome:</span>
                                <input
                                  type="text"
                                  value={item.name}
                                  onChange={(e) => handleEquippedItemChange(item.id, 'name', e.target.value)}
                                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                                  disabled={user.uid !== character.ownerUid && !isMaster}
                                />
                              </label>
                              <label className="block mb-2">
                                <span className="text-gray-400">Descrição:</span>
                                <AutoResizingTextarea
                                  value={item.description}
                                  onChange={(e) => handleEquippedItemChange(item.id, 'description', e.target.value)}
                                  placeholder="Descrição do item equipado..."
                                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                                  disabled={user.uid !== character.ownerUid && !isMaster}
                                />
                              </label>
                              <label className="block">
                                <span className="text-gray-400">Atributos/Efeitos:</span>
                                <AutoResizingTextarea
                                  value={item.attributes}
                                  onChange={(e) => handleEquippedItemChange(item.id, 'attributes', e.target.value)}
                                  placeholder="Atributos ou efeitos que o item concede..."
                                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                                  disabled={user.uid !== character.ownerUid && !isMaster}
                                />
                              </label>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            {/* Seção de História Modular */}
            <div className="mb-6 bg-gray-700 p-4 rounded-lg shadow-md border border-gray-600">
              <h2 className="text-2xl font-bold mb-4 text-purple-400 cursor-pointer flex justify-between items-center" onClick={() => toggleSection(setIsHistoryCollapsed)}>
                História
                <span className="text-gray-400 text-sm">{isHistoryCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isHistoryCollapsed && (
                <>
                  {(user.uid === character.ownerUid || isMaster) && (
                    <div className="flex gap-4 mb-4">
                      <button
                        onClick={() => addHistoryBlock('text')}
                        className="flex-1 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                      >
                        Adicionar Bloco de Texto
                      </button>
                      <button
                        onClick={() => addHistoryBlock('image')}
                        className="flex-1 px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-lg transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75"
                      >
                        Adicionar Imagem
                      </button>
                    </div>
                  )}
                  {character.history.length === 0 ? (
                    <p className="text-gray-400 text-center">Nenhum bloco de história adicionado.</p>
                  ) : (
                    <div className="space-y-4">
                      {character.history.map((block, index) => (
                        <div
                          key={block.id}
                          draggable={(user.uid === character.ownerUid || isMaster)}
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, index)}
                          className="bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-600 cursor-grab active:cursor-grabbing"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <h3 className="text-xl font-semibold text-gray-200 cursor-pointer" onClick={() => updateHistoryBlock(block.id, 'isCollapsed', !block.isCollapsed)}>
                              {block.type === 'text' ? `Bloco de Texto ${index + 1}` : `Imagem ${index + 1}`}
                            </h3>
                            {(user.uid === character.ownerUid || isMaster) && (
                              <button
                                onClick={() => removeHistoryBlock(block.id)}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition duration-200 ease-in-out transform hover:scale-105"
                              >
                                Remover
                              </button>
                            )}
                          </div>
                          {!block.isCollapsed && (
                            <>
                              {block.type === 'text' && (
                                <AutoResizingTextarea
                                  value={block.value}
                                  onChange={(e) => updateHistoryBlock(block.id, 'value', e.target.value)}
                                  placeholder="Escreva sua história aqui..."
                                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                                  disabled={user.uid !== character.ownerUid && !isMaster}
                                />
                              )}
                              {block.type === 'image' && (
                                <div className="flex flex-col items-center">
                                  <input
                                    type="text"
                                    value={block.value}
                                    onChange={(e) => updateHistoryBlock(block.id, 'value', e.target.value)}
                                    placeholder="URL da Imagem"
                                    className="w-full p-2 mb-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                                    disabled={user.uid !== character.ownerUid && !isMaster}
                                  />
                                  {block.value && (
                                    <img
                                      src={block.value}
                                      alt={`História Imagem ${index + 1}`}
                                      className="max-w-full h-auto rounded-md border border-gray-600 mt-2"
                                      style={{
                                        width: block.fitWidth ? '100%' : (block.width ? `${block.width}px` : 'auto'),
                                        height: block.height ? `${block.height}px` : 'auto',
                                        objectFit: 'contain'
                                      }}
                                      onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/400x200/374151/F9FAFB?text=Erro+ao+carregar+imagem"; }}
                                    />
                                  )}
                                  <div className="flex items-center space-x-2 mt-2">
                                    <label className="flex items-center text-gray-400">
                                      <input
                                        type="checkbox"
                                        checked={block.fitWidth}
                                        onChange={(e) => updateHistoryBlock(block.id, 'fitWidth', e.target.checked)}
                                        className="form-checkbox h-4 w-4 text-purple-600 rounded"
                                        disabled={user.uid !== character.ownerUid && !isMaster}
                                      />
                                      <span className="ml-1 text-sm">Ajustar Largura</span>
                                    </label>
                                    {!block.fitWidth && (
                                      <>
                                        <label className="text-gray-400 text-sm">Largura:</label>
                                        <input
                                          type="number"
                                          value={block.width}
                                          onChange={(e) => updateHistoryBlock(block.id, 'width', e.target.value)}
                                          className="w-20 p-1 bg-gray-700 border border-gray-600 rounded-md text-white text-center text-sm"
                                          disabled={user.uid !== character.ownerUid && !isMaster}
                                        />
                                        <label className="text-gray-400 text-sm">Altura:</label>
                                        <input
                                          type="number"
                                          value={block.height}
                                          onChange={(e) => updateHistoryBlock(block.id, 'height', e.target.value)}
                                          className="w-20 p-1 bg-gray-700 border border-gray-600 rounded-md text-white text-center text-sm"
                                          disabled={user.uid !== character.ownerUid && !isMaster}
                                        />
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Seção de Anotações */}
            <div className="mb-6 bg-gray-700 p-4 rounded-lg shadow-md border border-gray-600">
              <h2 className="text-2xl font-bold mb-4 text-purple-400 cursor-pointer flex justify-between items-center" onClick={() => toggleSection(setIsNotesCollapsed)}>
                Anotações
                <span className="text-gray-400 text-sm">{isNotesCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isNotesCollapsed && (
                <AutoResizingTextarea
                  name="notes"
                  value={character.notes}
                  onChange={handleNotesChange}
                  placeholder="Anotações gerais sobre o personagem..."
                  className="w-full p-3 bg-gray-800 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                  disabled={false} // Removido o disabled condicional
                />
              )}
            </div>

            {/* Botões de Ação da Ficha */}
            <div className="flex flex-col sm:flex-row justify-around gap-4 mt-8">
              <button
                onClick={handleExportJson}
                className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-lg transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75"
                disabled={isLoading || !user}
              >
                Exportar Ficha (JSON)
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
          <div className="text-white text-xl">Carregando...</div>
        </div>
      )}
    </div>
  );
};

export default App;

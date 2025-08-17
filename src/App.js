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

  // Inicializa Firebase e configura o listener de autenticação
  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig);
      const authInstance = getAuth(app);
      const firestoreInstance = getFirestore(app);
      setAuth(authInstance);
      setDb(firestoreInstance);

      const unsubscribe = onAuthStateChanged(authInstance, async (currentUser) => {
        setUser(currentUser);
setIsAuthReady(true);

if (currentUser) {
    // Verifica e cria o documento do usuário se ele não existir
    const userDocRef = doc(firestoreInstance, `artifacts/${appId}/users/${currentUser.uid}`);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
        try {
            await setDoc(userDocRef, {
                isMaster: false,
                displayName: currentUser.displayName,
                email: currentUser.email
            });
            console.log("Documento de usuário criado para:", currentUser.uid);
        } catch (error) {
            console.error("Erro ao criar documento do usuário:", error);
        }
    }
} else {
  // Lógica de logout (já existente)
  setCharacter(null);
  setCharactersList([]);
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
  }, [firebaseConfig, appId, setModal]);

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
              // NOVA LÓGICA PARA ATRIBUTOS
              deserializedData.attributes = typeof deserializedData.attributes === 'string' ? JSON.parse(deserializedData.attributes) : deserializedData.attributes;
              
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

              // Deserialização e adição de isCollapsed para 'notes' (agora um array de blocos)
              let notesData = deserializedData.notes;
              if (typeof notesData === 'string') { // Handle old string notes
                try {
                  notesData = JSON.parse(notesData); // Try parsing if it was already stringified JSON
                } catch (parseError) {
                  notesData = [{ id: crypto.randomUUID(), type: 'text', value: notesData }]; // Convert old string to a text block
                }
              }
              deserializedData.notes = Array.isArray(notesData) ? notesData.map(block => ({ ...block, isCollapsed: block.isCollapsed !== undefined ? block.isCollapsed : false })) : [];

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

            // Default values for new collapse states
            deserializedData.isUserStatusCollapsed = data.isUserStatusCollapsed !== undefined ? data.isUserStatusCollapsed : false;
            deserializedData.isCharacterInfoCollapsed = data.isCharacterInfoCollapsed !== undefined ? data.isCharacterInfoCollapsed : false;
            deserializedData.isMainAttributesCollapsed = data.isMainAttributesCollapsed !== undefined ? data.isMainAttributesCollapsed : false;
            deserializedData.isAttributesCollapsed = data.isAttributesCollapsed !== undefined ? data.isAttributesCollapsed : false; // NOVO
            deserializedData.isInventoryCollapsed = data.isInventoryCollapsed !== undefined ? data.isInventoryCollapsed : false;
            deserializedData.isWalletCollapsed = data.isWalletCollapsed !== undefined ? data.isWalletCollapsed : false;
            deserializedData.isPerksCollapsed = data.isPerksCollapsed !== undefined ? data.isPerksCollapsed : false;
            deserializedData.isAbilitiesCollapsed = data.isAbilitiesCollapsed !== undefined ? data.isAbilitiesCollapsed : false;
            deserializedData.isSpecializationsCollapsed = data.isSpecializationsCollapsed !== undefined ? data.isSpecializationsCollapsed : false;
            deserializedData.isEquippedItemsCollapsed = data.isEquippedItemsCollapsed !== undefined ? data.isEquippedItemsCollapsed : false;
            deserializedData.isHistoryCollapsed = data.isHistoryCollapsed !== undefined ? data.isHistoryCollapsed : false;
            deserializedData.isNotesCollapsed = data.isNotesCollapsed !== undefined ? data.isNotesCollapsed : false;


            deserializedData.mainAttributes = deserializedData.mainAttributes || { hp: { current: 0, max: 0 }, mp: { current: 0, max: 0 }, initiative: 0, fa: 0, fm: 0, fd: 0 };
            deserializedData.attributes = deserializedData.attributes || []; // NOVO
            deserializedData.inventory = deserializedData.inventory || [];
            deserializedData.wallet = deserializedData.wallet || { zeni: 0 };
            deserializedData.advantages = deserializedData.advantages || [];
            deserializedData.disadvantages = deserializedData.disadvantages || [];
            deserializedData.abilities = deserializedData.abilities || [];
            deserializedData.specializations = deserializedData.specializations || [];
            deserializedData.equippedItems = deserializedData.equippedItems || [];
            deserializedData.history = deserializedData.history || [];
            deserializedData.notes = deserializedData.notes || []; // Agora é um array
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
          dataToSave.attributes = JSON.stringify(dataToSave.attributes); // NOVO
          dataToSave.inventory = JSON.stringify(dataToSave.inventory);
          dataToSave.wallet = JSON.stringify(dataToSave.wallet);
          dataToSave.advantages = JSON.stringify(dataToSave.advantages);
          dataToSave.disadvantages = JSON.stringify(dataToSave.disadvantages);
          dataToSave.abilities = JSON.stringify(dataToSave.abilities);
          dataToSave.specializations = JSON.stringify(dataToSave.specializations);
          dataToSave.equippedItems = JSON.stringify(dataToSave.equippedItems);
          dataToSave.history = JSON.stringify(dataToSave.history);
          dataToSave.notes = JSON.stringify(dataToSave.notes); // Agora é um array stringificado
          
          if ('deleted' in dataToSave) {
            delete dataToSave.deleted;
          }
          
          // REMOVE a propriedade antiga para não poluir o banco
          delete dataToSave.basicAttributes;
          delete dataToSave.magicAttributes;


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

  // --- NOVAS FUNÇÕES PARA ATRIBUTOS DINÂMICOS ---

  // Adiciona um novo bloco de atributo
  const handleAddAttribute = () => {
    setCharacter(prevChar => ({
      ...prevChar,
      attributes: [
        ...(prevChar.attributes || []),
        { id: crypto.randomUUID(), name: '', base: 0, perm: 0, cond: 0, arma: 0, total: 0 }
      ]
    }));
  };

  // Remove um bloco de atributo pelo ID
  const handleRemoveAttribute = (idToRemove) => {
    setCharacter(prevChar => ({
      ...prevChar,
      attributes: prevChar.attributes.filter(attr => attr.id !== idToRemove)
    }));
  };

  // Lida com a mudança em qualquer campo de um atributo
  const handleAttributeChange = (id, field, value) => {
    setCharacter(prevChar => {
      const newAttributes = prevChar.attributes.map(attr => {
        if (attr.id === id) {
          const updatedAttr = { ...attr };
          if (field === 'name') {
            updatedAttr.name = value;
          } else {
            updatedAttr[field] = parseInt(value, 10) || 0;
          }
          
          // Recalcula o total
          updatedAttr.total = (updatedAttr.base || 0) + (updatedAttr.perm || 0) + (updatedAttr.cond || 0) + (updatedAttr.arma || 0);
          return updatedAttr;
        }
        return attr;
      });
      return { ...prevChar, attributes: newAttributes };
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
      return { ...prevChar, specializations: updatedSpecs };
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

  // Funções para a seção de História Modular
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

  const handleDragStart = (e, index, listName) => {
    draggedItemRef.current = { index, listName };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", e.target);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, dropIndex, targetListName) => {
    e.preventDefault();
    const { index: draggedItemIndex, listName: draggedListName } = draggedItemRef.current;
    
    if (draggedItemIndex === null || draggedListName !== targetListName) {
        draggedItemRef.current = null;
        return;
    }

    setCharacter(prevChar => {
        const newList = [...prevChar[targetListName]];
        const [reorderedItem] = newList.splice(draggedItemIndex, 1);
        newList.splice(dropIndex, 0, reorderedItem);
        return {
            ...prevChar,
            [targetListName]: newList
        };
    });
    draggedItemRef.current = null;
  };

  // Funções para a nova seção de Notas Modulares (copiadas e adaptadas da história)
  const addNoteBlock = (type) => {
    if (type === 'text') {
      setCharacter(prevChar => ({
        ...prevChar,
        notes: [...(prevChar.notes || []), { id: crypto.randomUUID(), type: 'text', value: '', isCollapsed: false }],
      }));
    } else if (type === 'image') {
      setModal({
        isVisible: true,
        message: 'Cole a URL da imagem para suas notas:',
        type: 'prompt',
        onConfirm: (url) => {
          if (url) {
            setCharacter(prevChar => ({
              ...prevChar,
              notes: [...(prevChar.notes || []), { id: crypto.randomUUID(), type: 'image', value: url, width: '', height: '', fitWidth: true, isCollapsed: false }],
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

  const updateNoteBlock = (id, field, value) => {
    setCharacter(prevChar => ({
      ...prevChar,
      notes: (prevChar.notes || []).map(block => {
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

  const removeNoteBlock = (idToRemove) => {
    setCharacter(prevChar => ({
      ...prevChar,
      notes: (prevChar.notes || []).filter(block => block.id !== idToRemove),
    }));
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
          attributes: [], // NOVO
          inventory: [], wallet: { zeni: 0 }, advantages: [], disadvantages: [], abilities: [], specializations: [], equippedItems: [], history: [], notes: [], // Agora é um array
          // Default collapse states for sections
          isUserStatusCollapsed: false,
          isCharacterInfoCollapsed: false,
          isMainAttributesCollapsed: false,
          isAttributesCollapsed: false, // NOVO
          isInventoryCollapsed: false,
          isWalletCollapsed: false,
          isPerksCollapsed: false,
          isAbilitiesCollapsed: false,
          isSpecializationsCollapsed: false,
          isEquippedItemsCollapsed: false,
          isHistoryCollapsed: false,
          isNotesCollapsed: false,
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

          if (importedData.name && importedData.mainAttributes) {
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
                  attributes: importedData.attributes || [], // NOVO
                  inventory: importedData.inventory || [],
                  wallet: importedData.wallet || { zeni: 0 },
                  advantages: importedData.advantages || [],
                  disadvantages: importedData.disadvantages || [],
                  abilities: importedData.abilities || [],
                  specializations: importedData.specializations || [],
                  equippedItems: importedData.equippedItems || [],
                  history: importedData.history || [],
                  notes: importedData.notes || [], // Agora é um array
                  // Default collapse states for sections on import
                  isUserStatusCollapsed: importedData.isUserStatusCollapsed !== undefined ? importedData.isUserStatusCollapsed : false,
                  isCharacterInfoCollapsed: importedData.isCharacterInfoCollapsed !== undefined ? importedData.isCharacterInfoCollapsed : false,
                  isMainAttributesCollapsed: importedData.isMainAttributesCollapsed !== undefined ? importedData.isMainAttributesCollapsed : false,
                  isAttributesCollapsed: importedData.isAttributesCollapsed !== undefined ? importedData.isAttributesCollapsed : false, // NOVO
                  isInventoryCollapsed: importedData.isInventoryCollapsed !== undefined ? importedData.isInventoryCollapsed : false,
                  isWalletCollapsed: importedData.isWalletCollapsed !== undefined ? importedData.isWalletCollapsed : false,
                  isPerksCollapsed: importedData.isPerksCollapsed !== undefined ? importedData.isPerksCollapsed : false,
                  isAbilitiesCollapsed: importedData.isAbilitiesCollapsed !== undefined ? importedData.isAbilitiesCollapsed : false,
                  isSpecializationsCollapsed: importedData.isSpecializationsCollapsed !== undefined ? importedData.isSpecializationsCollapsed : false,
                  isEquippedItemsCollapsed: importedData.isEquippedItemsCollapsed !== undefined ? importedData.isEquippedItemsCollapsed : false,
                  isHistoryCollapsed: importedData.isHistoryCollapsed !== undefined ? importedData.isHistoryCollapsed : false,
                  isNotesCollapsed: importedData.isNotesCollapsed !== undefined ? importedData.isNotesCollapsed : false,
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
                // Mapeamento para notas importadas
                importedCharacterData.notes = importedCharacterData.notes.map(block => {
                  if (block.type === 'image') {
                    return {
                      ...block,
                      width: block.width !== undefined ? block.width : '',
                      height: block.height !== undefined ? block.height : '',
                      fitWidth: block.fitWidth !== undefined ? block.fitWidth : true,
                      isCollapsed: block.isCollapsed !== undefined ? block.isCollapsed : false,
                    };
                  }
                  return { ...block, isCollapsed: block.isCollapsed !== undefined ? block.isCollapsed : false };
                });

                console.log("Dados do personagem a serem salvos no Firestore:", importedCharacterData);

                try {
                    const characterDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/characterSheets/${newCharId}`);
                    const dataToSave = { ...importedCharacterData };
                    dataToSave.mainAttributes = JSON.stringify(dataToSave.mainAttributes);
                    dataToSave.attributes = JSON.stringify(dataToSave.attributes); // NOVO
                    dataToSave.inventory = JSON.stringify(dataToSave.inventory);
                    dataToSave.wallet = JSON.stringify(dataToSave.wallet);
                    dataToSave.advantages = JSON.stringify(dataToSave.advantages);
                    dataToSave.disadvantages = JSON.stringify(dataToSave.disadvantages);
                    dataToSave.abilities = JSON.stringify(dataToSave.abilities);
                    dataToSave.specializations = JSON.stringify(dataToSave.specializations);
                    dataToSave.equippedItems = JSON.stringify(dataToSave.equippedItems);
                    dataToSave.history = JSON.stringify(dataToSave.history);
                    dataToSave.notes = JSON.stringify(dataToSave.notes); // Agora é um array stringificado

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
              message: 'O arquivo JSON selecionado não parece ser uma ficha de personagem válida (faltam nome ou atributos principais).',
              type: 'info',
              onConfirm: () => {},
              onCancel: () => {},
            });
            console.error('JSON inválido: Faltam campos essenciais (nome ou mainAttributes).', importedData);
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
              attributes: [], // NOVO
              inventory: [], wallet: { zeni: 0 }, advantages: [], disadvantages: [], abilities: [], specializations: [], equippedItems: [], history: [], notes: [], // Agora é um array
              // Default collapse states for sections on creation
              isUserStatusCollapsed: false,
              isCharacterInfoCollapsed: false,
              isMainAttributesCollapsed: false,
              isAttributesCollapsed: false, // NOVO
              isInventoryCollapsed: false,
              isWalletCollapsed: false,
              isPerksCollapsed: false,
              isAbilitiesCollapsed: false,
              isSpecializationsCollapsed: false,
              isEquippedItemsCollapsed: false,
              isHistoryCollapsed: false,
              isNotesCollapsed: false,
            };

            // Define isCollapsed como false para todos os arrays de itens
            newCharacterData.inventory = newCharacterData.inventory.map(item => ({ ...item, isCollapsed: false }));
            newCharacterData.advantages = newCharacterData.advantages.map(item => ({ ...item, isCollapsed: false }));
            newCharacterData.disadvantages = newCharacterData.disadvantages.map(item => ({ ...item, isCollapsed: false }));
            newCharacterData.abilities = newCharacterData.abilities.map(item => ({ ...item, isCollapsed: false }));
            newCharacterData.specializations = newCharacterData.specializations.map(item => ({ ...item, isCollapsed: false }));
            newCharacterData.equippedItems = newCharacterData.equippedItems.map(item => ({ ...item, isCollapsed: false }));
            newCharacterData.history = newCharacterData.history.map(item => ({ ...item, isCollapsed: false }));
            newCharacterData.notes = newCharacterData.notes.map(item => ({ ...item, isCollapsed: false }));


            setCharacter(newCharacterData);
            setSelectedCharIdState(newCharId); // Define o estado
            setOwnerUidState(user.uid); // Define o estado
            window.history.pushState({}, '', `?charId=${newCharId}&ownerUid=${user.uid}`);

            const characterDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/characterSheets/${newCharId}`);
            const dataToSave = { ...newCharacterData };
            dataToSave.mainAttributes = JSON.stringify(dataToSave.mainAttributes);
            dataToSave.attributes = JSON.stringify(dataToSave.attributes); // NOVO
            dataToSave.inventory = JSON.stringify(dataToSave.inventory);
            dataToSave.wallet = JSON.stringify(dataToSave.wallet);
            dataToSave.advantages = JSON.stringify(dataToSave.advantages);
            dataToSave.disadvantages = JSON.stringify(dataToSave.disadvantages);
            dataToSave.abilities = JSON.stringify(dataToSave.abilities);
            dataToSave.specializations = JSON.stringify(dataToSave.specializations);
            dataToSave.equippedItems = JSON.stringify(dataToSave.equippedItems);
            dataToSave.history = JSON.stringify(dataToSave.history);
            dataToSave.notes = JSON.stringify(dataToSave.notes); // Agora é um array stringificado

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
  // Esta função agora aceita a chave da propriedade no objeto character
  const toggleSection = (sectionKey) => {
    setCharacter(prevChar => {
      // Garante que prevChar não é null antes de tentar acessar propriedades
      if (!prevChar) return prevChar;
      return {
        ...prevChar,
        [sectionKey]: !prevChar[sectionKey],
      };
    });
  };

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
      <div className="max-w-4xl mx-auto bg-gray-800 rounded-lg shadow-2xl p-6 md:p-8 border border-gray-700">
        <h1 className="text-4xl font-extrabold text-center text-purple-400 mb-8 tracking-wide">
          Ficha StoryCraft
        </h1>

        {/* Informações do Usuário (Firebase Authentication) */}
        <section className="mb-8 p-4 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
          <h2 
            className="text-xl font-bold text-yellow-300 mb-2 cursor-pointer flex justify-between items-center"
            onClick={() => toggleSection('isUserStatusCollapsed')}
          >
            Status do Usuário
            <span>{character?.isUserStatusCollapsed ? '▼' : '▲'}</span>
          </h2>
          {(!character || !character.isUserStatusCollapsed) && (
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
        {user && !selectedCharIdState && (
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
        {user && selectedCharIdState && character && (
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
                onClick={() => toggleSection('isCharacterInfoCollapsed')}
              >
                Informações do Personagem
                <span>{character.isCharacterInfoCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!character.isCharacterInfoCollapsed && (
                <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-6">
                  <div className="flex-shrink-0 relative">
                    {character.photoUrl ? (
                      <img
                        src={character.photoUrl}
                        alt="Foto do Personagem"
                        className="w-[224px] h-[224px] object-cover rounded-full border-2 border-purple-500 cursor-pointer"
                        onClick={handlePhotoUrlClick}
                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/224x224/000000/FFFFFF?text=Foto'; }}
                      />
                    ) : (
                      <div
                        className="w-[224px] h-[224px] bg-gray-600 rounded-full border-2 border-purple-500 flex items-center justify-center text-6xl text-gray-400 cursor-pointer"
                        onClick={handlePhotoUrlClick}
                      >
                        +
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 flex-grow w-full">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">Nome:</label>
                      <input type="text" id="name" name="name" value={character.name} onChange={handleChange} className="w-full p-2 bg-gray-600 border border-gray-500 rounded-md focus:ring-purple-500 focus:border-purple-500 text-white" disabled={user.uid !== character.ownerUid && !isMaster} />
                    </div>
                    <div>
                      <label htmlFor="age" className="block text-sm font-medium text-gray-300 mb-1">Idade:</label>
                      <input type="number" id="age" name="age" value={character.age === 0 ? '' : character.age} onChange={handleChange} className="w-full p-2 bg-gray-600 border border-gray-500 rounded-md focus:ring-purple-500 focus:border-purple-500 text-white" disabled={user.uid !== character.ownerUid && !isMaster} />
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
                      <input type="number" id="level" name="level" value={character.level === 0 ? '' : character.level} onChange={handleChange} className="w-full p-2 bg-gray-600 border border-gray-500 rounded-md focus:ring-purple-500 focus:border-purple-500 text-white" disabled={user.uid !== character.ownerUid && !isMaster} />
                    </div>
                    <div>
                      <label htmlFor="xp" className="block text-sm font-medium text-gray-300 mb-1">XP:</label>
                      <input type="number" id="xp" name="xp" value={character.xp === 0 ? '' : character.xp} onChange={handleChange} className="w-full p-2 bg-gray-600 border border-gray-500 rounded-md focus:ring-purple-500 focus:border-purple-500 text-white" disabled={user.uid !== character.ownerUid && !isMaster} />
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Atributos Principais */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection('isMainAttributesCollapsed')}
              >
                Atributos Principais
                <span>{character.isMainAttributesCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!character.isMainAttributesCollapsed && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* HP */}
                  <div className="flex flex-col items-center p-2 bg-gray-600 rounded-md">
                    <label className="text-lg font-medium text-gray-300 mb-1">HP:</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        name="current"
                        data-attribute="hp"
                        value={character.mainAttributes.hp.current === 0 ? '' : character.mainAttributes.hp.current}
                        onChange={handleMainAttributeChange}
                        className="w-14 p-2 text-center bg-gray-700 border border-gray-500 rounded-md text-white text-xl font-bold"
                        disabled={user.uid !== character.ownerUid}
                      />
                      <span className="text-gray-300">/</span>
                      <input
                        type="number"
                        name="max"
                        data-attribute="hp"
                        value={character.mainAttributes.hp.max === 0 ? '' : character.mainAttributes.hp.max}
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
                        value={character.mainAttributes.mp.current === 0 ? '' : character.mainAttributes.mp.current}
                        onChange={handleMainAttributeChange}
                        className="w-14 p-2 text-center bg-gray-700 border border-gray-500 rounded-md text-white text-xl font-bold"
                        disabled={user.uid !== character.ownerUid}
                      />
                      <span className="text-gray-300">/</span>
                      <input
                        type="number"
                        name="max"
                        data-attribute="mp"
                        value={character.mainAttributes.mp.max === 0 ? '' : character.mainAttributes.mp.max}
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
                        value={character.mainAttributes[attr] === 0 ? '' : character.mainAttributes[attr]}
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

            {/* --- SEÇÃO DE ATRIBUTOS MODIFICADA --- */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection('isAttributesCollapsed')}
              >
                Atributos
                <span>{character.isAttributesCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!character.isAttributesCollapsed && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {character.attributes.map((attr, index) => (
                      <div 
                        key={attr.id} 
                        className="p-3 bg-gray-600 rounded-md shadow-sm border border-gray-500 relative"
                        draggable
                        onDragStart={(e) => handleDragStart(e, index, 'attributes')}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, index, 'attributes')}
                      >
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                          {/* Nome do Atributo */}
                          <input 
                            type="text" 
                            placeholder="Nome do Atributo"
                            value={attr.name} 
                            onChange={(e) => handleAttributeChange(attr.id, 'name', e.target.value)} 
                            className="w-full sm:w-1/4 p-2 bg-gray-700 border border-gray-500 rounded-md text-white font-semibold" 
                            disabled={user.uid !== character.ownerUid && !isMaster} 
                          />
                          
                          {/* Campos de Valores */}
                          <div className="flex items-center gap-2 text-xs flex-grow justify-end w-full sm:w-auto">
                            {['base', 'perm', 'cond', 'arma'].map(field => (
                              <div key={field} className="flex flex-col items-center">
                                <span className="text-gray-400 text-xs text-center capitalize">{field === 'perm' ? 'Perm.' : field === 'cond' ? 'Cond.' : field}</span>
                                <input 
                                  type="number" 
                                  value={attr[field] === 0 ? '' : attr[field]} 
                                  onChange={(e) => handleAttributeChange(attr.id, field, e.target.value)} 
                                  className="w-12 p-1 bg-gray-700 border border-gray-500 rounded-md text-white text-center" 
                                  disabled={user.uid !== character.ownerUid && !isMaster} 
                                />
                              </div>
                            ))}
                            <div className="flex flex-col items-center">
                              <span className="text-gray-400 text-xs text-center">Total</span>
                              <input 
                                type="number" 
                                value={attr.total === 0 ? '' : attr.total} 
                                readOnly 
                                className="w-12 p-1 bg-gray-800 border border-gray-600 rounded-md text-white font-bold cursor-not-allowed text-center" 
                              />
                            </div>
                          </div>
                        </div>
                        {/* Botão de Remover */}
                        {(user.uid === character.ownerUid || isMaster) && (
                          <button
                            onClick={() => handleRemoveAttribute(attr.id)}
                            className="absolute top-1 right-1 w-6 h-6 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-full flex items-center justify-center transition duration-200 ease-in-out"
                            aria-label="Remover Atributo"
                          >
                            X
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* Botão de Adicionar */}
                  <div className="flex justify-center mt-4">
                    <button
                      onClick={handleAddAttribute}
                      className="w-10 h-10 bg-green-600 hover:bg-green-700 text-white text-2xl font-bold rounded-full shadow-lg transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75 flex items-center justify-center"
                      disabled={user.uid !== character.ownerUid && !isMaster}
                      aria-label="Adicionar Atributo"
                    >
                      +
                    </button>
                  </div>
                </>
              )}
            </section>


            {/* Inventário */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600 relative"> {/* Added relative positioning */}
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection('isInventoryCollapsed')}
              >
                Inventário
                <span>{character.isInventoryCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!character.isInventoryCollapsed && (
                <>
                  <div className="space-y-2">
                    {character.inventory.length === 0 ? (
                      <p className="text-gray-400 italic">Nenhum item no inventário.</p>
                    ) : (
                      character.inventory.map((item, index) => (
                        <div 
                          key={item.id} 
                          className="flex flex-col p-3 bg-gray-600 rounded-md shadow-sm"
                          draggable
                          onDragStart={(e) => handleDragStart(e, index, 'inventory')}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, index, 'inventory')}
                        >
                          <div className="flex justify-between items-center mb-1">
                            {item.isCollapsed ? (
                              <span 
                                className="font-semibold text-lg w-full cursor-pointer text-white"
                                onClick={() => toggleItemCollapsed('inventory', item.id)}
                              >
                                {item.name || 'Item Sem Nome'}
                              </span>
                            ) : (
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => handleInventoryItemChange(item.id, 'name', e.target.value)}
                                className="font-semibold text-lg w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white"
                                placeholder="Nome do Item"
                                disabled={user.uid !== character.ownerUid && !isMaster}
                              />
                            )}
                            {(user.uid === character.ownerUid || isMaster) && (
                              <button
                                onClick={() => handleRemoveItem(item.id)}
                                className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                              >
                                Remover
                              </button>
                            )}
                          </div>
                          {!item.isCollapsed && (
                            <>
                              <AutoResizingTextarea
                                value={item.description}
                                onChange={(e) => handleInventoryItemChange(item.id, 'description', e.target.value)}
                                placeholder="Descrição do item"
                                className="text-sm text-gray-300 italic w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white"
                                disabled={user.uid !== character.ownerUid && !isMaster}
                              />
                              <button
                                onClick={() => toggleItemCollapsed('inventory', item.id)}
                                className="mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-md self-end"
                              >
                                Ocultar Item
                              </button>
                            </>
                          )}
                          {item.isCollapsed && (
                            <button
                                onClick={() => toggleItemCollapsed('inventory', item.id)}
                                className="mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-md self-end"
                            >
                                Exibir Item
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  {/* Botão de adicionar no final da lista */}
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={handleAddItem}
                      className="w-10 h-10 bg-green-600 hover:bg-green-700 text-white text-2xl font-bold rounded-full shadow-lg transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75 flex items-center justify-center"
                      disabled={user.uid !== character.ownerUid && !isMaster}
                      aria-label="Adicionar Item"
                    >
                      +
                    </button>
                  </div>
                </>
              )}
            </section>

            {/* Carteira */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection('isWalletCollapsed')}
              >
                Zeni: {character.wallet.zeni}
                <span>{character.isWalletCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!character.isWalletCollapsed && (
                <div className="flex items-center gap-2 w-full">
                  <input
                    type="number"
                    value={zeniAmount === 0 ? '' : zeniAmount}
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
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600 relative"> {/* Added relative positioning */}
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection('isPerksCollapsed')}
              >
                Vantagens e Desvantagens
                <span>{character.isPerksCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!character.isPerksCollapsed && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Vantagens */}
                  <div>
                    <h3 className="text-xl font-semibold text-purple-300 mb-3 border-b border-purple-500 pb-1">Vantagens</h3>
                    <div className="space-y-2">
                      {character.advantages.length === 0 ? (
                        <p className="text-gray-400 italic">Nenhuma vantagem.</p>
                      ) : (
                        character.advantages.map((perk, index) => (
                          <div 
                            key={perk.id} 
                            className="flex flex-col p-3 bg-gray-600 rounded-md shadow-sm"
                            draggable
                            onDragStart={(e) => handleDragStart(e, index, 'advantages')}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, index, 'advantages')}
                          >
                            <div className="flex justify-between items-center mb-1">
                              {perk.isCollapsed ? (
                                <span 
                                  className="font-semibold text-lg w-full cursor-pointer text-white"
                                  onClick={() => toggleItemCollapsed('advantages', perk.id)}
                                >
                                  {perk.name || 'Vantagem Sem Nome'}
                                </span>
                              ) : (
                                <input
                                  type="text"
                                  value={perk.name}
                                  onChange={(e) => handlePerkChange('advantages', perk.id, 'name', e.target.value)}
                                  className="font-semibold text-lg w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white"
                                  placeholder="Nome da Vantagem"
                                  disabled={user.uid !== character.ownerUid && !isMaster}
                                />
                              )}
                              <input
                                type="number"
                                value={perk.value === 0 ? '' : perk.value}
                                onChange={(e) => handlePerkChange('advantages', perk.id, 'value', e.target.value)}
                                className="w-10 ml-2 p-1 bg-gray-700 border border-gray-500 rounded-md text-white text-center"
                                placeholder="Valor"
                                disabled={user.uid !== character.ownerUid && !isMaster}
                              />
                              {(user.uid === character.ownerUid || isMaster) && (
                                <button
                                  onClick={() => handleRemovePerk('advantages', perk.id)}
                                  className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                                >
                                  Remover
                                </button>
                              )}
                            </div>
                            {!perk.isCollapsed && (
                              <>
                                <AutoResizingTextarea
                                  value={perk.description}
                                  onChange={(e) => handlePerkChange('advantages', perk.id, 'description', e.target.value)}
                                  placeholder="Descrição da vantagem"
                                  className="text-sm text-gray-300 italic w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white"
                                  disabled={user.uid !== character.ownerUid && !isMaster}
                                />
                                <div className="flex gap-3 text-sm text-gray-400 mt-2">
                                  <span>Origem:</span>
                                  <label className="flex items-center gap-1">
                                    <input type="checkbox" checked={perk.origin.class} onChange={() => handlePerkOriginChange('advantages', perk.id, 'class')} className="form-checkbox text-purple-500 rounded" disabled={user.uid !== character.ownerUid && !isMaster} /> Classe
                                  </label>
                                  <label className="flex items-center gap-1">
                                    <input type="checkbox" checked={perk.origin.race} onChange={() => handlePerkOriginChange('advantages', perk.id, 'race')} className="form-checkbox text-purple-500 rounded" disabled={user.uid !== character.ownerUid && !isMaster} /> Raça
                                  </label>
                                  <label className="flex items-center gap-1">
                                    <input type="checkbox" checked={perk.origin.manual} onChange={() => handlePerkOriginChange('advantages', perk.id, 'manual')} className="form-checkbox text-purple-500 rounded" disabled={user.uid !== character.ownerUid && !isMaster} /> Manual
                                  </label>
                                </div>
                                <button
                                  onClick={() => toggleItemCollapsed('advantages', perk.id)}
                                  className="mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-md self-end"
                                >
                                  Ocultar Vantagem
                                </button>
                              </>
                            )}
                            {perk.isCollapsed && (
                                <button
                                    onClick={() => toggleItemCollapsed('advantages', perk.id)}
                                    className="mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-md self-end"
                                >
                                    Exibir Vantagem
                                </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                    {/* Botão de adicionar no final da lista */}
                    <div className="flex justify-end mt-4">
                      <button
                        onClick={() => handleAddPerk('advantages')}
                        className="w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white text-2xl font-bold rounded-full shadow-lg transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 flex items-center justify-center"
                        disabled={user.uid !== character.ownerUid && !isMaster}
                        aria-label="Adicionar Vantagem"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Desvantagens */}
                  <div>
                    <h3 className="text-xl font-semibold text-purple-300 mb-3 border-b border-purple-500 pb-1">Desvantagens</h3>
                    <div className="space-y-2">
                      {character.disadvantages.length === 0 ? (
                        <p className="text-gray-400 italic">Nenhuma desvantagem.</p>
                      ) : (
                        character.disadvantages.map((perk, index) => (
                          <div 
                            key={perk.id} 
                            className="flex flex-col p-3 bg-gray-600 rounded-md shadow-sm"
                            draggable
                            onDragStart={(e) => handleDragStart(e, index, 'disadvantages')}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, index, 'disadvantages')}
                          >
                            <div className="flex justify-between items-center mb-1">
                              {perk.isCollapsed ? (
                                <span 
                                  className="font-semibold text-lg w-full cursor-pointer text-white"
                                  onClick={() => toggleItemCollapsed('disadvantages', perk.id)}
                                >
                                  {perk.name || 'Desvantagem Sem Nome'}
                                </span>
                              ) : (
                                <input
                                  type="text"
                                  value={perk.name}
                                  onChange={(e) => handlePerkChange('disadvantages', perk.id, 'name', e.target.value)}
                                  className="font-semibold text-lg w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white"
                                  placeholder="Nome da Desvantagem"
                                  disabled={user.uid !== character.ownerUid && !isMaster}
                                />
                              )}
                              <input
                                type="number"
                                value={perk.value === 0 ? '' : perk.value}
                                onChange={(e) => handlePerkChange('disadvantages', perk.id, 'value', e.target.value)}
                                className="w-10 ml-2 p-1 bg-gray-700 border border-gray-500 rounded-md text-white text-center"
                                placeholder="Valor"
                                disabled={user.uid !== character.ownerUid && !isMaster}
                              />
                              {(user.uid === character.ownerUid || isMaster) && (
                                <button
                                  onClick={() => handleRemovePerk('disadvantages', perk.id)}
                                  className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                                >
                                  Remover
                                </button>
                              )}
                            </div>
                            {!perk.isCollapsed && (
                              <>
                                <AutoResizingTextarea
                                  value={perk.description}
                                  onChange={(e) => handlePerkChange('disadvantages', perk.id, 'description', e.target.value)}
                                  placeholder="Descrição da desvantagem"
                                  className="text-sm text-gray-300 italic w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white"
                                  disabled={user.uid !== character.ownerUid && !isMaster}
                                />
                                <div className="flex gap-3 text-sm text-gray-400 mt-2">
                                  <span>Origem:</span>
                                  <label className="flex items-center gap-1">
                                    <input type="checkbox" checked={perk.origin.class} onChange={() => handlePerkOriginChange('disadvantages', perk.id, 'class')} className="form-checkbox text-purple-500 rounded" disabled={user.uid !== character.ownerUid && !isMaster} /> Classe
                                  </label>
                                  <label className="flex items-center gap-1">
                                    <input type="checkbox" checked={perk.origin.race} onChange={() => handlePerkOriginChange('disadvantages', perk.id, 'race')} className="form-checkbox text-purple-500 rounded" disabled={user.uid !== character.ownerUid && !isMaster} /> Raça
                                  </label>
                                  <label className="flex items-center gap-1">
                                    <input type="checkbox" checked={perk.origin.manual} onChange={() => handlePerkOriginChange('disadvantages', perk.id, 'manual')} className="form-checkbox text-purple-500 rounded" disabled={user.uid !== character.ownerUid && !isMaster} /> Manual
                                  </label>
                                </div>
                                <button
                                  onClick={() => toggleItemCollapsed('disadvantages', perk.id)}
                                  className="mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-md self-end"
                                >
                                  Ocultar Desvantagem
                                </button>
                              </>
                            )}
                            {perk.isCollapsed && (
                                <button
                                    onClick={() => toggleItemCollapsed('disadvantages', perk.id)}
                                    className="mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-md self-end"
                                >
                                    Exibir Desvantagem
                                </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                    {/* Botão de adicionar no final da lista */}
                    <div className="flex justify-end mt-4">
                      <button
                        onClick={() => handleAddPerk('disadvantages')}
                        className="w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white text-2xl font-bold rounded-full shadow-lg transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 flex items-center justify-center"
                        disabled={user.uid !== character.ownerUid && !isMaster}
                        aria-label="Adicionar Desvantagem"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Habilidades de Classe/Raça e Customizadas */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600 relative"> {/* Added relative positioning */}
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection('isAbilitiesCollapsed')}
              >
                Habilidades (Classe, Raça, Customizadas)
                <span>{character.isAbilitiesCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!character.isAbilitiesCollapsed && (
                <>
                  <div className="space-y-2">
                    {character.abilities.length === 0 ? (
                      <p className="text-gray-400 italic">Nenhuma habilidade adicionada.</p>
                    ) : (
                      character.abilities.map((ability, index) => (
                        <div 
                          key={ability.id} 
                          className="flex flex-col p-3 bg-gray-600 rounded-md shadow-sm"
                          draggable
                          onDragStart={(e) => handleDragStart(e, index, 'abilities')}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, index, 'abilities')}
                        >
                          <div className="flex justify-between items-center mb-1">
                            {ability.isCollapsed ? (
                                <span 
                                  className="font-semibold text-lg w-full cursor-pointer text-white"
                                  onClick={() => toggleItemCollapsed('abilities', ability.id)}
                                >
                                  {ability.title || 'Habilidade Sem Título'}
                                </span>
                            ) : (
                                <input
                                  type="text"
                                  value={ability.title}
                                  onChange={(e) => handleAbilityChange(ability.id, 'title', e.target.value)}
                                  className="font-semibold text-lg w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white"
                                  placeholder="Título da Habilidade"
                                  disabled={user.uid !== character.ownerUid && !isMaster}
                                />
                            )}
                            {(user.uid === character.ownerUid || isMaster) && (
                              <button
                                onClick={() => handleRemoveAbility(ability.id)}
                                className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                              >
                                Remover
                              </button>
                            )}
                          </div>
                          {!ability.isCollapsed && (
                            <>
                              <AutoResizingTextarea
                                value={ability.description}
                                onChange={(e) => handleAbilityChange(ability.id, 'description', e.target.value)}
                                placeholder="Descrição da habilidade"
                                className="text-sm text-gray-300 italic w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white"
                                disabled={user.uid !== character.ownerUid && !isMaster}
                              />
                              <button
                                onClick={() => toggleItemCollapsed('abilities', ability.id)}
                                className="mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-md self-end"
                              >
                                Ocultar Habilidade
                              </button>
                            </>
                          )}
                          {ability.isCollapsed && (
                            <button
                                onClick={() => toggleItemCollapsed('abilities', ability.id)}
                                className="mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-md self-end"
                            >
                                Exibir Habilidade
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  {/* Botão de adicionar no final da lista */}
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={handleAddAbility}
                      className="w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white text-2xl font-bold rounded-full shadow-lg transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 flex items-center justify-center"
                      disabled={user.uid !== character.ownerUid && !isMaster}
                      aria-label="Adicionar Habilidade"
                    >
                      +
                    </button>
                  </div>
                </>
              )}
            </section>

            {/* Especializações (Perícias) */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600 relative"> {/* Added relative positioning */}
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection('isSpecializationsCollapsed')}
              >
                Especializações (Perícias)
                <span>{character.isSpecializationsCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!character.isSpecializationsCollapsed && (
                <>
                  <div className="space-y-2">
                    {character.specializations.length === 0 ? (
                      <p className="text-gray-400 italic">Nenhuma especialização adicionada.</p>
                    ) : (
                      character.specializations.map((spec, index) => (
                        <div 
                          key={spec.id} 
                          className="flex flex-col p-3 bg-gray-600 rounded-md shadow-sm"
                          draggable
                          onDragStart={(e) => handleDragStart(e, index, 'specializations')}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, index, 'specializations')}
                        >
                          <div className="flex justify-between items-center mb-1">
                            {spec.isCollapsed ? (
                                <span 
                                  className="font-semibold text-lg w-full cursor-pointer text-white"
                                  onClick={() => toggleItemCollapsed('specializations', spec.id)}
                                >
                                  {spec.name || 'Especialização Sem Nome'} (Mod: {spec.modifier}, Bônus: {spec.bonus})
                                </span>
                            ) : (
                                <input
                                  type="text"
                                  value={spec.name}
                                  onChange={(e) => handleSpecializationChange(spec.id, 'name', e.target.value)}
                                  className="font-semibold text-lg w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white"
                                  placeholder="Nome da Especialização"
                                  disabled={user.uid !== character.ownerUid && !isMaster}
                                />
                            )}
                            {(user.uid === character.ownerUid || isMaster) && (
                              <button
                                onClick={() => handleRemoveSpecialization(spec.id)}
                                className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                              >
                                Remover
                              </button>
                            )}
                          </div>
                          {!spec.isCollapsed && (
                            <>
                              <div className="flex gap-4 mt-2 text-sm">
                                <label className="flex items-center gap-1">
                                  Modificador:
                                  <input
                                    type="number"
                                    value={spec.modifier === 0 ? '' : spec.modifier}
                                    onChange={(e) => handleSpecializationChange(spec.id, 'modifier', e.target.value)}
                                    className="w-8 p-1 bg-gray-700 border border-gray-500 rounded-md text-white"
                                    placeholder="0"
                                    disabled={user.uid !== character.ownerUid && !isMaster}
                                  />
                                </label>
                                <label className="flex items-center gap-1">
                                  Bônus:
                                  <input
                                    type="number"
                                    value={spec.bonus === 0 ? '' : spec.bonus}
                                    onChange={(e) => handleSpecializationChange(spec.id, 'bonus', e.target.value)}
                                    className="w-8 p-1 bg-gray-700 border border-gray-500 rounded-md text-white"
                                    placeholder="0"
                                    disabled={user.uid !== character.ownerUid && !isMaster}
                                  />
                                </label>
                              </div>
                              <button
                                onClick={() => toggleItemCollapsed('specializations', spec.id)}
                                className="mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-md self-end"
                              >
                                Ocultar Especialização
                              </button>
                            </>
                          )}
                          {spec.isCollapsed && (
                            <button
                                onClick={() => toggleItemCollapsed('specializations', spec.id)}
                                className="mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-md self-end"
                            >
                                Exibir Especialização
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  {/* Botão de adicionar no final da lista */}
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={handleAddSpecialization}
                      className="w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white text-2xl font-bold rounded-full shadow-lg transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 flex items-center justify-center"
                      disabled={user.uid !== character.ownerUid && !isMaster}
                      aria-label="Adicionar Especialização"
                    >
                      +
                    </button>
                  </div>
                </>
              )}
            </section>

            {/* Itens Equipados */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600 relative"> {/* Added relative positioning */}
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection('isEquippedItemsCollapsed')}
              >
                Itens Equipados
                <span>{character.isEquippedItemsCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!character.isEquippedItemsCollapsed && (
                <>
                  <div className="space-y-2">
                    {character.equippedItems.length === 0 ? (
                      <p className="text-gray-400 italic">Nenhum item equipado.</p>
                    ) : (
                      character.equippedItems.map((item, index) => (
                        <div 
                          key={item.id} 
                          className="flex flex-col p-3 bg-gray-600 rounded-md shadow-sm"
                          draggable
                          onDragStart={(e) => handleDragStart(e, index, 'equippedItems')}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, index, 'equippedItems')}
                        >
                          <div className="flex justify-between items-center mb-1">
                            {item.isCollapsed ? (
                                <span 
                                  className="font-semibold text-lg w-full cursor-pointer text-white"
                                  onClick={() => toggleItemCollapsed('equippedItems', item.id)}
                                >
                                  {item.name || 'Item Equipado Sem Nome'}
                                </span>
                            ) : (
                                <input
                                  type="text"
                                  value={item.name}
                                  onChange={(e) => handleEquippedItemChange(item.id, 'name', e.target.value)}
                                  className="font-semibold text-lg w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white"
                                  placeholder="Nome do Item Equipado"
                                  disabled={user.uid !== character.ownerUid && !isMaster}
                                />
                            )}
                            {(user.uid === character.ownerUid || isMaster) && (
                              <button
                                onClick={() => handleRemoveEquippedItem(item.id)}
                                className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                              >
                                Remover
                              </button>
                            )}
                          </div>
                          {!item.isCollapsed && (
                            <>
                              <AutoResizingTextarea
                                value={item.description}
                                onChange={(e) => handleEquippedItemChange(item.id, 'description', e.target.value)}
                                placeholder="Descrição do item"
                                className="text-sm text-gray-300 italic w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white mb-2"
                                disabled={user.uid !== character.ownerUid && !isMaster}
                              />
                              <label className="block text-sm font-medium text-gray-300 mb-1">Atributos/Efeitos:</label>
                              <AutoResizingTextarea
                                value={item.attributes}
                                onChange={(e) => handleEquippedItemChange(item.id, 'attributes', e.target.value)}
                                placeholder="Ex: +5 Força, Dano Fogo, etc."
                                className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white text-sm"
                                disabled={user.uid !== character.ownerUid && !isMaster}
                              />
                              <button
                                onClick={() => toggleItemCollapsed('equippedItems', item.id)}
                                className="mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-md self-end"
                              >
                                Ocultar Item
                              </button>
                            </>
                          )}
                          {item.isCollapsed && (
                            <button
                                onClick={() => toggleItemCollapsed('equippedItems', item.id)}
                                className="mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-md self-end"
                            >
                                Exibir Item
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  {/* Botão de adicionar no final da lista */}
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={handleAddEquippedItem}
                      className="w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white text-2xl font-bold rounded-full shadow-lg transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 flex items-center justify-center"
                      disabled={user.uid !== character.ownerUid && !isMaster}
                      aria-label="Adicionar Item Equipado"
                    >
                      +
                    </button>
                  </div>
                </>
              )}
            </section>

            {/* História do Personagem */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection('isHistoryCollapsed')}
              >
                História do Personagem
                <span>{character.isHistoryCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!character.isHistoryCollapsed && (
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
                          onDragStart={(e) => handleDragStart(e, index, 'history')}
                          onDragOver={(e) => handleDragOver(e)}
                          onDrop={(e) => handleDrop(e, index, 'history')}
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
                            <>
                              {block.isCollapsed ? (
                                <div 
                                  className="cursor-pointer text-gray-200"
                                  onClick={() => updateHistoryBlock(block.id, 'isCollapsed', false)}
                                >
                                  <p className="text-lg font-semibold mb-1">Bloco de Texto</p>
                                  <p className="text-sm italic text-gray-300">{truncateText(block.value)}</p>
                                  <button className="mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-md self-end">
                                    Exibir Mais
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <AutoResizingTextarea
                                    value={block.value}
                                    onChange={(e) => updateHistoryBlock(block.id, 'value', e.target.value)}
                                    placeholder="Digite seu texto aqui..."
                                    className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white"
                                    disabled={user.uid !== character.ownerUid && !isMaster}
                                  />
                                  <button
                                    onClick={() => updateHistoryBlock(block.id, 'isCollapsed', true)}
                                    className="mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-md self-end"
                                  >
                                    Ocultar Texto
                                  </button>
                                </>
                              )}
                            </>
                          ) : ( // Image Block
                            <>
                              {block.isCollapsed ? (
                                <div 
                                  className="cursor-pointer text-gray-200 text-center py-2"
                                  onClick={() => updateHistoryBlock(block.id, 'isCollapsed', false)}
                                >
                                  <p className="text-lg font-semibold">Mostrar Imagem</p>
                                </div>
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
                                              value={block.width === 0 ? '' : block.width}
                                              onChange={(e) => updateHistoryBlock(block.id, 'width', e.target.value)}
                                              className="w-20 p-1 bg-gray-700 border border-gray-500 rounded-md text-white text-center"
                                            />
                                          </label>
                                          <label className="flex items-center gap-1">
                                            Altura (px):
                                            <input
                                              type="number"
                                              value={block.height === 0 ? '' : block.height}
                                              onChange={(e) => updateHistoryBlock(block.id, 'height', e.target.value)}
                                              className="w-20 p-1 bg-gray-700 border border-gray-500 rounded-md text-white text-center"
                                            />
                                          </label>
                                        </>
                                      )}
                                    </div>
                                  )}
                                  <button
                                    onClick={() => updateHistoryBlock(block.id, 'isCollapsed', true)}
                                    className="mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-md self-end"
                                  >
                                    Ocultar Imagem
                                  </button>
                                </div>
                              )}
                            </>
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

            {/* Anotações - Agora como blocos arrastáveis */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 mt-6 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection('isNotesCollapsed')}
              >
                Anotações
                <span>{character.isNotesCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!character.isNotesCollapsed && (
                <>
                  <div className="space-y-4 mb-4">
                    {character.notes.length === 0 ? (
                      <p className="text-gray-400 italic">Nenhum bloco de anotação adicionado. Adicione texto ou imagens para começar!</p>
                    ) : (
                      character.notes.map((block, index) => (
                        <div
                          key={block.id}
                          className="p-3 bg-gray-600 rounded-md shadow-sm border border-gray-500 relative"
                          draggable
                          onDragStart={(e) => handleDragStart(e, index, 'notes')}
                          onDragOver={(e) => handleDragOver(e)}
                          onDrop={(e) => handleDrop(e, index, 'notes')}
                        >
                          {(user.uid === character.ownerUid || isMaster) && (
                            <button
                              onClick={() => removeNoteBlock(block.id)}
                              className="absolute top-2 right-2 px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-full transition duration-200 ease-in-out"
                            >
                              X
                            </button>
                          )}
                          {block.type === 'text' ? (
                            <>
                              {block.isCollapsed ? (
                                <div 
                                  className="cursor-pointer text-gray-200"
                                  onClick={() => updateNoteBlock(block.id, 'isCollapsed', false)}
                                >
                                  <p className="text-lg font-semibold mb-1">Bloco de Texto</p>
                                  <p className="text-sm italic text-gray-300">{truncateText(block.value)}</p>
                                  <button className="mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-md self-end">
                                    Exibir Mais
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <AutoResizingTextarea
                                    value={block.value}
                                    onChange={(e) => updateNoteBlock(block.id, 'value', e.target.value)}
                                    placeholder="Digite suas anotações aqui..."
                                    className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white"
                                    disabled={false} // Sempre editável
                                  />
                                  <button
                                    onClick={() => updateNoteBlock(block.id, 'isCollapsed', true)}
                                    className="mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-md self-end"
                                  >
                                    Ocultar Texto
                                  </button>
                                </>
                              )}
                            </>
                          ) : ( // Image Block for Notes
                            <>
                              {block.isCollapsed ? (
                                <div 
                                  className="cursor-pointer text-gray-200 text-center py-2"
                                  onClick={() => updateNoteBlock(block.id, 'isCollapsed', false)}
                                >
                                  <p className="text-lg font-semibold">Mostrar Imagem</p>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center">
                                  <img
                                    src={block.value}
                                    alt="Imagem da anotação"
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
                                          onChange={(e) => updateNoteBlock(block.id, 'fitWidth', e.target.checked)}
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
                                              value={block.width === 0 ? '' : block.width}
                                              onChange={(e) => updateNoteBlock(block.id, 'width', e.target.value)}
                                              className="w-20 p-1 bg-gray-700 border border-gray-500 rounded-md text-white text-center"
                                            />
                                          </label>
                                          <label className="flex items-center gap-1">
                                            Altura (px):
                                            <input
                                              type="number"
                                              value={block.height === 0 ? '' : block.height}
                                              onChange={(e) => updateNoteBlock(block.id, 'height', e.target.value)}
                                              className="w-20 p-1 bg-gray-700 border border-gray-500 rounded-md text-white text-center"
                                            />
                                          </label>
                                        </>
                                      )}
                                    </div>
                                  )}
                                  <button
                                    onClick={() => updateNoteBlock(block.id, 'isCollapsed', true)}
                                    className="mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-md self-end"
                                  >
                                    Ocultar Imagem
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 mt-4 justify-center">
                    <button
                      onClick={() => addNoteBlock('text')}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                      disabled={user.uid !== character.ownerUid && !isMaster}
                    >
                      Adicionar Bloco de Texto
                    </button>
                    <button
                      onClick={() => addNoteBlock('image')}
                      className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75"
                      disabled={user.uid !== character.ownerUid && !isMaster}
                    >
                      Adicionar Bloco de Imagem
                    </button>
                  </div>
                </>
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

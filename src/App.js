// [código fonte do '2colun block.txt']

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, getDocs, getDoc, deleteDoc } from 'firebase/firestore';

// ===================================================================================
//  1. COMPONENTES AUXILIARES
//  Componentes genéricos e reutilizáveis (Modais, Inputs, etc.)
// ===================================================================================

/**
 * Componente Modal para prompts e confirmações personalizadas
 */
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

  const confirmButtonText = useMemo(() => {
    switch (type) {
      case 'confirm':
        return 'Confirmar';
      case 'prompt':
        return 'Confirmar';
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

/**
 * Componente de Textarea com redimensionamento automático de altura
 */
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


// ===================================================================================
//  2. COMPONENTE PRINCIPAL DA APLICAÇÃO
// ===================================================================================

const App = () => {

  // ---------------------------------------------------------------------------------
  //  A. GERENCIAMENTO DE ESTADO (STATES & REFS)
  // ---------------------------------------------------------------------------------

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

  // Estados para Firebase e Autenticação
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isMaster, setIsMaster] = useState(false);

  // Estados para gerenciamento de personagens
  const [character, setCharacter] = useState(null);
  const [charactersList, setCharactersList] = useState([]);
  const [selectedCharIdState, setSelectedCharIdState] = useState(null);
  const [ownerUidState, setOwnerUidState] = useState(null);
  const [viewingAllCharacters, setViewingAllCharacters] = useState(false);

  // Estados para UI (Modal, Loading, etc.)
  const [modal, setModal] = useState({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
  const [isLoading, setIsLoading] = useState(false);
  const [zeniAmount, setZeniAmount] = useState(0);
  const fileInputRef = useRef(null);
  const draggedItemRef = useRef(null);

  // ---------------------------------------------------------------------------------
  //  B. EFEITOS E SINCRONIZAÇÃO COM FIREBASE (useEffect)
  // ---------------------------------------------------------------------------------

  // Efeito 1: Inicializa Firebase e o listener de autenticação
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
          const userDocRef = doc(firestoreInstance, `artifacts/${appId}/users/${currentUser.uid}`);
          const userDocSnap = await getDoc(userDocRef);
          if (!userDocSnap.exists()) {
            try {
              await setDoc(userDocRef, { isMaster: false, displayName: currentUser.displayName, email: currentUser.email });
            } catch (error) {
              console.error("Erro ao criar documento do usuário:", error);
            }
          }
        } else {
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
      setModal({ isVisible: true, message: `Erro ao inicializar o aplicativo. Detalhes: ${error.message}`, type: 'info', onConfirm: () => {}, onCancel: () => {} });
    }
  }, [firebaseConfig, appId]);

  // Efeito 2: Pega os parâmetros da URL na primeira renderização
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialCharId = params.get('charId');
    const initialOwnerUid = params.get('ownerUid');
    setSelectedCharIdState(initialCharId);
    setOwnerUidState(initialOwnerUid);
  }, []);

  // Efeito 3: Carrega o papel do usuário (mestre/jogador)
  useEffect(() => {
    let unsubscribeRole = () => {};
    if (db && user && isAuthReady) {
      const userRoleDocRef = doc(db, `artifacts/${appId}/users/${user.uid}`);
      unsubscribeRole = onSnapshot(userRoleDocRef, (docSnap) => {
        setIsMaster(docSnap.exists() && docSnap.data().isMaster === true);
      }, (error) => {
        console.error("Erro ao carregar papel do usuário:", error);
        setIsMaster(false);
      });
    } else {
      setIsMaster(false);
    }
    return () => unsubscribeRole();
  }, [db, user, isAuthReady, appId]);
  
  // Efeito 4: Carrega a lista de personagens
  const fetchCharactersList = useCallback(async () => {
    if (!db || !user || !isAuthReady) return;
    setIsLoading(true);
    try {
      let allChars = [];
      if (isMaster) {
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
      } else {
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
      }
    } catch (error) {
      console.error("Erro ao carregar lista de personagens:", error);
      setModal({ isVisible: true, message: `Erro ao carregar lista de personagens: ${error.message}`, type: 'info', onConfirm: () => {}, onCancel: () => {} });
    } finally {
      setIsLoading(false);
    }
  }, [db, user, isAuthReady, isMaster, appId]);

  useEffect(() => {
    if (user && db && isAuthReady) {
      fetchCharactersList();
    }
  }, [user, db, isAuthReady, fetchCharactersList]);
  
  // Efeito 5: Listener em tempo real para o personagem SELECIONADO
  useEffect(() => {
    let unsubscribeCharacter = () => {};
    const currentSelectedCharacterId = selectedCharIdState;
    const currentOwnerUidFromUrl = ownerUidState;

    if (db && user && isAuthReady && currentSelectedCharacterId) {
      const loadCharacter = async () => {
        setIsLoading(true);
        let targetUid = currentOwnerUidFromUrl;

        if (!targetUid) {
          if (isMaster) {
            let foundOwnerUid = null;
            try {
              const usersSnapshot = await getDocs(collection(db, `artifacts/${appId}/users`));
              for (const userDoc of usersSnapshot.docs) {
                const charSnap = await getDoc(doc(db, `artifacts/${appId}/users/${userDoc.id}/characterSheets/${currentSelectedCharacterId}`));
                if (charSnap.exists()) {
                  foundOwnerUid = userDoc.id;
                  break;
                }
              }
            } catch (error) { console.error("Erro ao buscar ownerUid para mestre:", error); }
            
            if (foundOwnerUid) {
              targetUid = foundOwnerUid;
              setOwnerUidState(foundOwnerUid);
            } else {
              setCharacter(null);
              setSelectedCharIdState(null);
              setOwnerUidState(null);
              window.history.pushState({}, '', window.location.pathname);
              fetchCharactersList();
              setIsLoading(false);
              return;
            }
          } else {
            targetUid = user.uid;
            setOwnerUidState(user.uid);
          }
        }
        
        if (!targetUid) {
          setIsLoading(false);
          setCharacter(null);
          setSelectedCharIdState(null);
          setOwnerUidState(null);
          window.history.pushState({}, '', window.location.pathname);
          return;
        }

        const characterDocRef = doc(db, `artifacts/${appId}/users/${targetUid}/characterSheets/${currentSelectedCharacterId}`);
        unsubscribeCharacter = onSnapshot(characterDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.deleted) {
              setCharacter(null);
              setSelectedCharIdState(null);
              setOwnerUidState(null);
              window.history.pushState({}, '', window.location.pathname);
              fetchCharactersList();
              setModal({ isVisible: true, message: "A ficha selecionada foi excluída.", type: "info", onConfirm: () => {}, onCancel: () => {} });
              return;
            }
            // Bloco de Deserialização e Normalização de Dados...
            const deserializedData = { ...data };
            try {
              // ... (toda a sua lógica de JSON.parse e verificação de campos)
              deserializedData.mainAttributes = typeof deserializedData.mainAttributes === 'string' ? JSON.parse(deserializedData.mainAttributes) : deserializedData.mainAttributes;
              deserializedData.attributes = typeof deserializedData.attributes === 'string' ? JSON.parse(deserializedData.attributes) : deserializedData.attributes;
              const listsToNormalize = ['inventory', 'advantages', 'disadvantages', 'abilities', 'specializations', 'equippedItems'];
              listsToNormalize.forEach(listName => {
                  deserializedData[listName] = (typeof deserializedData[listName] === 'string' ? JSON.parse(deserializedData[listName]) : deserializedData[listName] || []).map(item => ({ ...item, isCollapsed: item.isCollapsed !== undefined ? item.isCollapsed : false }));
              });
              let historyData = deserializedData.history;
              if (typeof historyData === 'string') { try { historyData = JSON.parse(historyData); } catch (e) { historyData = [{ id: crypto.randomUUID(), type: 'text', value: historyData }]; } }
              deserializedData.history = Array.isArray(historyData) ? historyData.map(block => ({ ...block, isCollapsed: block.isCollapsed !== undefined ? block.isCollapsed : false })) : [];
              let notesData = deserializedData.notes;
              if (typeof notesData === 'string') { try { notesData = JSON.parse(notesData); } catch (e) { notesData = [{ id: crypto.randomUUID(), type: 'text', value: notesData }]; } }
              deserializedData.notes = Array.isArray(notesData) ? notesData.map(block => ({ ...block, isCollapsed: block.isCollapsed !== undefined ? block.isCollapsed : false })) : [];
            } catch (e) {
                console.error("Erro ao deserializar dados do Firestore:", e);
                setModal({ isVisible: true, message: `Erro ao carregar dados da ficha: ${e.message}. Os dados podem estar corrompidos.`, type: 'info', onConfirm: () => {}, onCancel: () => {} });
            }
            setCharacter(deserializedData);
          } else {
            setCharacter(null);
            setSelectedCharIdState(null);
            setOwnerUidState(null);
            window.history.pushState({}, '', window.location.pathname);
            fetchCharactersList();
          }
          setIsLoading(false);
        }, (error) => {
          console.error("Erro ao ouvir a ficha no Firestore:", error);
          setModal({ isVisible: true, message: `Erro ao carregar ficha do Firestore: ${error.message}`, type: 'info', onConfirm: () => {}, onCancel: () => {} });
          setIsLoading(false);
        });
      };
      loadCharacter();
    } else if (!currentSelectedCharacterId) {
      setCharacter(null);
    }
    return () => unsubscribeCharacter();
  }, [db, user, isAuthReady, selectedCharIdState, ownerUidState, appId, isMaster, fetchCharactersList]);

  // Efeito 6: Salva a ficha no Firestore (Auto-save)
  useEffect(() => {
    if (db && user && isAuthReady && character && selectedCharIdState) {
      const targetUidForSave = character.ownerUid || user.uid;
      if (user.uid !== targetUidForSave && !isMaster) return;

      const handler = setTimeout(() => {
        const saveCharacter = async () => {
          try {
            const characterDocRef = doc(db, `artifacts/${appId}/users/${targetUidForSave}/characterSheets/${selectedCharIdState}`);
            const dataToSave = { ...character };
            // Bloco de Serialização para salvar...
            dataToSave.mainAttributes = JSON.stringify(dataToSave.mainAttributes);
            dataToSave.attributes = JSON.stringify(dataToSave.attributes);
            dataToSave.inventory = JSON.stringify(dataToSave.inventory);
            dataToSave.wallet = JSON.stringify(dataToSave.wallet);
            dataToSave.advantages = JSON.stringify(dataToSave.advantages);
            dataToSave.disadvantages = JSON.stringify(dataToSave.disadvantages);
            dataToSave.abilities = JSON.stringify(dataToSave.abilities);
            dataToSave.specializations = JSON.stringify(dataToSave.specializations);
            dataToSave.equippedItems = JSON.stringify(dataToSave.equippedItems);
            dataToSave.history = JSON.stringify(dataToSave.history);
            dataToSave.notes = JSON.stringify(dataToSave.notes);
            delete dataToSave.deleted;

            await setDoc(characterDocRef, dataToSave, { merge: true });
          } catch (error) {
            console.error('Erro ao salvar ficha no Firestore automaticamente:', error);
          }
        };
        saveCharacter();
      }, 500);
      return () => clearTimeout(handler);
    }
  }, [character, db, user, isAuthReady, selectedCharIdState, appId, isMaster]);

  // ---------------------------------------------------------------------------------
  //  C. FUNÇÕES DE MANIPULAÇÃO (HANDLERS)
  // ---------------------------------------------------------------------------------

  // C.1. Autenticação e Navegação
  // =================================
  const handleGoogleSignIn = async () => {
    if (!auth) return;
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Erro no login com Google:", error);
      setModal({ isVisible: true, message: `Erro ao fazer login: ${error.message}`, type: 'info', onConfirm: () => {}, onCancel: () => {} });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!auth) return;
    setIsLoading(true);
    try {
      await signOut(auth);
      // O listener onAuthStateChanged já limpa os estados.
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      setModal({ isVisible: true, message: `Erro ao fazer logout: ${error.message}`, type: 'info', onConfirm: () => {}, onCancel: () => {} });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectCharacter = (charId, ownerUid) => {
    setSelectedCharIdState(charId);
    setOwnerUidState(ownerUid);
    window.history.pushState({}, '', `?charId=${charId}&ownerUid=${ownerUid}`);
    setViewingAllCharacters(false);
  };

  const handleBackToList = () => {
    setSelectedCharIdState(null);
    setOwnerUidState(null);
    window.history.pushState({}, '', window.location.pathname);
    setCharacter(null);
    fetchCharactersList();
  };

  // C.2. Ações CRUD de Personagem
  // =================================
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
            // Sua estrutura de dados de personagem novo...
            const newCharacterData = { /* ... */  name: name, ownerUid: user.uid, id: newCharId }; 
            const characterDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/characterSheets/${newCharId}`);
            // Serializa os dados antes de salvar
            const dataToSave = { ...newCharacterData };
            dataToSave.mainAttributes = JSON.stringify({}); // Exemplo
            dataToSave.attributes = JSON.stringify([]); // Exemplo
            // ... serializar todos os outros campos
            await setDoc(characterDocRef, dataToSave);
            
            setSelectedCharIdState(newCharId);
            setOwnerUidState(user.uid);
            window.history.pushState({}, '', `?charId=${newCharId}&ownerUid=${user.uid}`);
            fetchCharactersList();
          } catch (error) {
            console.error("Erro ao criar novo personagem:", error);
          } finally {
            setIsLoading(false);
            setModal({isVisible: false});
          }
        } else {
             setModal({isVisible: false});
        }
      },
      onCancel: () => setModal({isVisible: false}),
    });
  };

  const handleDeleteCharacter = (charId, charName, ownerUid) => {
    setModal({
      isVisible: true,
      message: `Tem certeza que deseja EXCLUIR permanentemente o personagem '${charName}'?`,
      type: 'confirm',
      onConfirm: async () => {
        if (!db || !user || (user.uid !== ownerUid && !isMaster)) return;
        setIsLoading(true);
        try {
          const characterDocRef = doc(db, `artifacts/${appId}/users/${ownerUid}/characterSheets/${charId}`);
          await deleteDoc(characterDocRef);
          handleBackToList(); // Reutiliza a função de voltar para a lista
        } catch (error) {
          console.error("Erro ao excluir personagem:", error);
        } finally {
          setIsLoading(false);
        }
      },
      onCancel: () => {},
    });
  };
  
  // C.3. Funções de Edição da Ficha (agrupadas)
  // ============================================

  // -- Funções Genéricas --
  const handleChange = (e) => {
    const { name, value } = e.target;
    const isNumeric = ['age', 'level', 'xp'].includes(name);
    setCharacter(prev => ({ ...prev, [name]: isNumeric ? parseInt(value, 10) || 0 : value }));
  };

  const toggleSection = (sectionKey) => {
    setCharacter(prev => (prev ? { ...prev, [sectionKey]: !prev[sectionKey] } : prev));
  };
  
  const toggleItemCollapsed = (listName, id) => {
    setCharacter(prevChar => ({
        ...prevChar,
        [listName]: (prevChar[listName] || []).map(item => 
            item.id === id ? { ...item, isCollapsed: !item.isCollapsed } : item
        ),
    }));
  };

  // -- Atributos --
  const handleAddAttribute = () => {
    setCharacter(prev => ({ ...prev, attributes: [...(prev.attributes || []), { id: crypto.randomUUID(), name: '', base: 0, perm: 0, cond: 0, arma: 0, total: 0 }] }));
  };
  const handleRemoveAttribute = (id) => {
    setCharacter(prev => ({ ...prev, attributes: prev.attributes.filter(attr => attr.id !== id) }));
  };
  const handleAttributeChange = (id, field, value) => {
    setCharacter(prev => {
        const newAttributes = prev.attributes.map(attr => {
            if (attr.id === id) {
                const updatedAttr = { ...attr, [field]: field === 'name' ? value : parseInt(value, 10) || 0 };
                updatedAttr.total = (updatedAttr.base || 0) + (updatedAttr.perm || 0) + (updatedAttr.cond || 0) + (updatedAttr.arma || 0);
                return updatedAttr;
            }
            return attr;
        });
        return { ...prev, attributes: newAttributes };
    });
  };

  // -- Inventário --
  const handleAddItem = () => { /* ... */ };
  const handleRemoveItem = (id) => { /* ... */ };
  const handleInventoryItemChange = (id, field, value) => { /* ... */ };
  
  // ... (aqui entrariam todas as outras funções 'handle' que você criou,
  // como handleZeniChange, handleAddPerk, addHistoryBlock, etc.
  // A estrutura é a mesma: agrupar por funcionalidade)


  // C.4. Funções de Importação/Exportação e Reset
  // ==================================================
  const handleExportJson = () => { /* ... */ };
  const handleImportJsonClick = () => { fileInputRef.current.click(); };
  const handleFileChange = (event) => { /* ... */ };
  const handleReset = () => { /* ... */ };


  // ---------------------------------------------------------------------------------
  //  D. LÓGICA DE RENDERIZAÇÃO E JSX
  // ---------------------------------------------------------------------------------
  
  // D.1. Lógica Condicional para Renderização
  // ===========================================
  if (!isAuthReady) {
    return (
        <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
            <div className="text-white text-xl font-bold">Inicializando...</div>
        </div>
    );
  }

  // D.2. Retorno Principal do Componente
  // ======================================
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 font-inter">
      <style>{` /* ... seus estilos ... */ `}</style>

      <div className="max-w-4xl mx-auto bg-gray-800 rounded-lg shadow-2xl p-6 md:p-8 border border-gray-700">
        <h1 className="text-4xl font-extrabold text-center text-purple-400 mb-8 tracking-wide">
          Ficha StoryCraft
        </h1>

        {/* --- Seção de Autenticação --- */}
        <section className="mb-8 p-4 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
            {/* JSX da autenticação vai aqui */}
        </section>

        {/* --- Conteúdo Principal (Lista ou Ficha) --- */}
        {user ? (
            selectedCharIdState && character ? (
                // Se um personagem está selecionado, mostra a ficha
                // AQUI É A MÁGICA: Passamos todos os dados e funções necessários
                // para o componente de exibição. Seu colaborador foca neste componente.
                <CharacterSheetDisplay
                    character={character}
                    user={user}
                    isMaster={isMaster}
                    onBackToList={handleBackToList}
                    // Passando todas as funções de manipulação como props
                    handlers={{
                        handleChange,
                        toggleSection,
                        toggleItemCollapsed,
                        addAttribute: handleAddAttribute,
                        removeAttribute: handleRemoveAttribute,
                        attributeChange: handleAttributeChange,
                        // ... todas as outras funções
                    }}
                />
            ) : (
                // Se não há personagem selecionado, mostra a lista
                <CharacterListDisplay
                    characters={charactersList}
                    isLoading={isLoading}
                    isMaster={isMaster}
                    viewingAllCharacters={viewingAllCharacters}
                    onSelectCharacter={handleSelectCharacter}
                    onCreateCharacter={handleCreateNewCharacter}
                    onDeleteCharacter={handleDeleteCharacter}
                    onFetchAll={fetchCharactersList}
                />
            )
        ) : (
            // Mensagem para usuário deslogado
            <p className="text-center text-gray-400 text-lg mt-8">
                Faça login para começar a criar e gerenciar suas fichas de personagem!
            </p>
        )}

        {/* --- Botões de Ação Globais (se aplicável) --- */}
        {user && character && (
            <div className="flex flex-wrap justify-center gap-4 mt-8">
                {/* Botões de Exportar, Importar, Resetar... */}
            </div>
        )}

      </div>

      {/* --- Elementos Globais (Modal e Loading) --- */}
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


// ===================================================================================
//  3. COMPONENTES DE EXIBIÇÃO (UI-FOCUSED)
//  Estes componentes recebem dados e funções via props e apenas renderizam o JSX.
//  É AQUI QUE SEU COLABORADOR DE UI VAI TRABALHAR!
// ===================================================================================

const CharacterListDisplay = ({ characters, isLoading, onSelectCharacter, onCreateCharacter, onDeleteCharacter, ...props }) => {
    // Todo o JSX que antes mostrava a lista de personagens
    // usa as props para chamar as funções, ex: onClick={onCreateCharacter}
    return (
        <section>
            <h2 className="text-2xl font-bold text-yellow-300 mb-4">Meus Personagens</h2>
            <button onClick={onCreateCharacter}>Criar Novo Personagem</button>
            {/* ... resto do JSX da lista ... */}
        </section>
    );
};

const CharacterSheetDisplay = ({ character, user, isMaster, onBackToList, handlers }) => {
    // Todo o GIGANTESCO JSX da ficha do personagem vai aqui.
    // Ele usa os 'handlers' para fazer as modificações, por exemplo:
    // onChange={handlers.handleChange}
    // onClick={handlers.addAttribute}
    return (
        <>
            <button onClick={onBackToList}>← Voltar para a Lista</button>
            
            {/* Seção Informações do Personagem */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl">
                 <h2 onClick={() => handlers.toggleSection('isCharacterInfoCollapsed')}>
                    Informações do Personagem
                 </h2>
                 {!character.isCharacterInfoCollapsed && (
                    <div>
                        <label>Nome:</label>
                        <input name="name" value={character.name} onChange={handlers.handleChange} />
                        {/* ... resto dos campos de informação ... */}
                    </div>
                 )}
            </section>

            {/* Seção Atributos */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl">
                 <h2 onClick={() => handlers.toggleSection('isAttributesCollapsed')}>
                    Atributos
                 </h2>
                 {!character.isAttributesCollapsed && (
                    <div>
                        {character.attributes.map(attr => (
                            <div key={attr.id}>
                                <input value={attr.name} onChange={(e) => handlers.attributeChange(attr.id, 'name', e.target.value)} />
                                {/* ... inputs para base, perm, etc. ... */}
                                <button onClick={() => handlers.removeAttribute(attr.id)}>X</button>
                            </div>
                        ))}
                        <button onClick={handlers.addAttribute}>+</button>
                    </div>
                 )}
            </section>

            {/* ... Todas as outras seções da ficha (Inventário, Habilidades, etc.) ... */}
        </>
    );
};


export default App;

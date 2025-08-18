import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, getDocs, getDoc, deleteDoc } from 'firebase/firestore';

// --- CONSTANTES & CONFIGURAÇÃO ---
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDfsK4K4vhOmSSGeVHOlLnJuNlHGNha4LU",
  authDomain: "storycraft-a5f7e.firebaseapp.com",
  projectId: "storycraft-a5f7e",
  storageBucket: "storycraft-a5f7e.firebaseapp.com",
  messagingSenderId: "727724875985",
  appId: "1:727724875985:web:97411448885c68c289e5f0",
  measurementId: "G-JH03Y2NZDK"
};
const APP_ID = FIREBASE_CONFIG.appId;

// --- FUNÇÕES UTILITÁRIAS & AUXILIARES ---

/**
 * Desserializa os dados de um personagem vindos do Firestore.
 * @param {object} data - Os dados brutos do documento do Firestore.
 * @returns {object} - O objeto de personagem totalmente hidratado.
 */
const deserializeCharacter = (data) => {
  const deserialized = {...data };

  const parseJsonField = (field, defaultValue =) => {
    if (typeof field === 'string') {
      try {
        return JSON.parse(field);
      } catch (e) {
        console.error("Erro ao fazer parse do campo JSON, retornando valor padrão:", e);
        return defaultValue;
      }
    }
    return field |

| defaultValue;
  };

  const ensureCollapsedState = (item) => ({...item, isCollapsed: item.isCollapsed?? false });

  deserialized.mainAttributes = parseJsonField(data.mainAttributes, { hp: { current: 0, max: 0 }, mp: { current: 0, max: 0 }, initiative: 0, fa: 0, fm: 0, fd: 0 });
  deserialized.attributes = parseJsonField(data.attributes,);
  deserialized.wallet = parseJsonField(data.wallet, { zeni: 0 });
  deserialized.inventory = parseJsonField(data.inventory,).map(ensureCollapsedState);
  deserialized.advantages = parseJsonField(data.advantages,).map(ensureCollapsedState);
  deserialized.disadvantages = parseJsonField(data.disadvantages,).map(ensureCollapsedState);
  deserialized.abilities = parseJsonField(data.abilities,).map(ensureCollapsedState);
  deserialized.specializations = parseJsonField(data.specializations,).map(ensureCollapsedState);
  deserialized.equippedItems = parseJsonField(data.equippedItems,).map(ensureCollapsedState);
  
  let historyData = parseJsonField(data.history,);
  if (typeof data.history === 'string' &&!Array.isArray(historyData)) {
      historyData =;
  }
  deserialized.history = historyData.map(ensureCollapsedState);

  let notesData = parseJsonField(data.notes,);
  if (typeof data.notes === 'string' &&!Array.isArray(notesData)) {
      notesData =;
  }
  deserialized.notes = notesData.map(ensureCollapsedState);
  
  const sectionCollapseKeys =;
  sectionCollapseKeys.forEach(key => {
    deserialized[key] = data[key]?? false;
  });

  deserialized.level = data.level?? 0;
  deserialized.xp = data.xp?? 100;
  deserialized.photoUrl = data.photoUrl |

| '';

  return deserialized;
};

/**
 * Serializa os campos de um personagem para strings JSON antes de salvar no Firestore.
 * @param {object} characterData - O objeto de personagem.
 * @returns {object} - Uma cópia do objeto de personagem pronta para ser salva.
 */
const serializeCharacterForSave = (characterData) => {
    const dataToSave = {...characterData };
    const fieldsToStringify = [
        'mainAttributes', 'attributes', 'inventory', 'wallet', 'advantages',
        'disadvantages', 'abilities', 'specializations', 'equippedItems', 'history', 'notes'
    ];

    fieldsToStringify.forEach(field => {
        if (dataToSave[field]) {
            dataToSave[field] = JSON.stringify(dataToSave[field]);
        }
    });
    
    delete dataToSave.deleted;
    delete dataToSave.basicAttributes;
    delete dataToSave.magicAttributes;

    return dataToSave;
};

// --- COMPONENTES DE UI REUTILIZÁVEIS ---

const CustomModal = ({ message, onConfirm, onCancel, type, onClose }) => {
  const [inputValue, setInputValue] = useState('');

  const handleConfirm = () => {
    type === 'prompt'? onConfirm(inputValue) : onConfirm();
    onClose();
  };

  const handleCancel = () => {
    onCancel();
    onClose();
  };

  const confirmButtonText = useMemo(() => {
    return type === 'confirm'? 'Confirmar' : 'OK';
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
              type === 'confirm'? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
            } text-white`}
          >
            {confirmButtonText}
          </button>
          {type!== 'info' && (
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


// --- CUSTOM REACT HOOKS (LÓGICA CENTRAL) ---

/**
 * Gerencia a autenticação Firebase, estado do usuário e papel (Mestre/Jogador).
 */
const useFirebaseAuth = (setModal) => {
  const [auth, setAuth] = useState(null);
  const = useState(null);
  const [user, setUser] = useState(null);
  const = useState(false);
  const [isMaster, setIsMaster] = useState(false);

  useEffect(() => {
    try {
      const app = initializeApp(FIREBASE_CONFIG);
      const authInstance = getAuth(app);
      const dbInstance = getFirestore(app);
      setAuth(authInstance);
      setDb(dbInstance);

      const unsubscribe = onAuthStateChanged(authInstance, async (currentUser) => {
        setUser(currentUser);
        setIsAuthReady(true);

        if (currentUser) {
          const userDocRef = doc(dbInstance, `artifacts/${APP_ID}/users/${currentUser.uid}`);
          const userDocSnap = await getDoc(userDocRef);
          if (!userDocSnap.exists()) {
            await setDoc(userDocRef, {
              isMaster: false,
              displayName: currentUser.displayName,
              email: currentUser.email
            });
          }
        } else {
          setIsMaster(false);
        }
      });
      return () => unsubscribe();
    } catch (error) {
      console.error("Erro ao inicializar Firebase:", error);
      setModal({ isVisible: true, message: `Erro ao inicializar: ${error.message}`, type: 'info' });
    }
  }, [setModal]);

  useEffect(() => {
    if (!db ||!user ||!isAuthReady) {
      setIsMaster(false);
      return;
    }
    const userRoleDocRef = doc(db, `artifacts/${APP_ID}/users/${user.uid}`);
    const unsubscribe = onSnapshot(userRoleDocRef, (docSnap) => {
      setIsMaster(docSnap.exists() && docSnap.data().isMaster === true);
    }, (error) => {
      console.error("Erro ao carregar papel do usuário:", error);
      setIsMaster(false);
    });
    return () => unsubscribe();
  },);

  const handleGoogleSignIn = async () => {
    if (!auth) return;
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Erro no login com Google:", error);
      setModal({ isVisible: true, message: `Erro de login: ${error.message}`, type: 'info' });
    }
  };

  const handleSignOut = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      setModal({ isVisible: true, message: `Erro de logout: ${error.message}`, type: 'info' });
    }
  };

  return { auth, db, user, isMaster, isAuthReady, handleGoogleSignIn, handleSignOut };
};

/**
 * Gerencia o carregamento e salvamento automático de um personagem no Firestore.
 */
const useCharacterPersistence = (db, user, isMaster, isAuthReady, selectedCharId, ownerUid, setModal) => {
  const [character, setCharacter] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!db ||!user ||!isAuthReady ||!selectedCharId) {
      setCharacter(null);
      return;
    }

    let unsubscribe = () => {};
    const loadCharacter = async () => {
      setIsLoading(true);
      try {
        const characterDocRef = doc(db, `artifacts/${APP_ID}/users/${ownerUid}/characterSheets/${selectedCharId}`);
        unsubscribe = onSnapshot(characterDocRef, (docSnap) => {
          if (docSnap.exists() &&!docSnap.data().deleted) {
            setCharacter(deserializeCharacter(docSnap.data()));
          } else {
            setCharacter(null);
          }
          setIsLoading(false);
        }, (error) => {
          console.error("Erro ao ouvir a ficha:", error);
          setModal({ isVisible: true, message: `Erro ao carregar ficha: ${error.message}`, type: 'info' });
          setIsLoading(false);
        });
      } catch (error) {
        console.error("Erro ao configurar listener:", error);
        setIsLoading(false);
      }
    };
    
    loadCharacter();
    return () => unsubscribe();
  },);

  useEffect(() => {
    if (!db ||!user ||!isAuthReady ||!character ||!selectedCharId) return;

    const targetUid = character.ownerUid |

| user.uid;
    if (user.uid!== targetUid &&!isMaster) return;

    const handler = setTimeout(async () => {
      try {
        const characterDocRef = doc(db, `artifacts/${APP_ID}/users/${targetUid}/characterSheets/${selectedCharId}`);
        const dataToSave = serializeCharacterForSave(character);
        await setDoc(characterDocRef, dataToSave, { merge: true });
      } catch (error) {
        console.error('Erro ao salvar ficha automaticamente:', error);
      }
    }, 500);

    return () => clearTimeout(handler);
  },);

  return { character, setCharacter, isLoading };
};

/**
 * Gerenciador genérico para operações em listas (adicionar, remover, atualizar, etc.).
 */
const useListManager = (setCharacter) => {
  const addItem = useCallback((listName, newItemTemplate) => {
    setCharacter(prev => ({
     ...prev,
      [listName]: [...(prev[listName] ||), newItemTemplate]
    }));
  }, [setCharacter]);

  const removeItem = useCallback((listName, itemId) => {
    setCharacter(prev => ({
     ...prev,
      [listName]: (prev[listName] ||).filter(item => item.id!== itemId)
    }));
  }, [setCharacter]);

  const updateItem = useCallback((listName, itemId, field, value) => {
    setCharacter(prev => ({
     ...prev,
      [listName]: (prev[listName] ||).map(item =>
        item.id === itemId? {...item, [field]: value } : item
      )
    }));
  }, [setCharacter]);

  const toggleItemCollapsed = useCallback((listName, itemId) => {
    setCharacter(prev => ({
     ...prev,
      [listName]: (prev[listName] ||).map(item =>
        item.id === itemId? {...item, isCollapsed:!item.isCollapsed } : item
      )
    }));
  }, [setCharacter]);
  
  const reorderList = useCallback((listName, dragIndex, dropIndex) => {
    setCharacter(prev => {
      const list = [...(prev[listName] ||)];
      const [draggedItem] = list.splice(dragIndex, 1);
      list.splice(dropIndex, 0, draggedItem);
      return {...prev, [listName]: list };
    });
  }, [setCharacter]);

  return { addItem, removeItem, updateItem, toggleItemCollapsed, reorderList };
};


// --- COMPONENTE PRINCIPAL DA APLICAÇÃO (App) ---
const App = () => {
  const = useState({ isVisible: false, message: '', type: 'info', onConfirm: () => {}, onCancel: () => {} });
  const setModal = useCallback((modalConfig) => {
    setModalState(prev => ({...prev, onConfirm: () => {}, onCancel: () => {},...modalConfig }));
  },);

  const { auth, db, user, isMaster, isAuthReady, handleGoogleSignIn, handleSignOut } = useFirebaseAuth(setModal);
  
  const = useState(null);
  const [ownerUid, setOwnerUid] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSelectedCharId(params.get('charId'));
    setOwnerUid(params.get('ownerUid'));
  },);

  const { character, setCharacter, isLoading: isCharacterLoading } = useCharacterPersistence(db, user, isMaster, isAuthReady, selectedCharId, ownerUid, setModal);
  const listManager = useListManager(setCharacter);
  
  const [charactersList, setCharactersList] = useState();
  const [isListLoading, setIsListLoading] = useState(false);
  const [viewingAllCharacters, setViewingAllCharacters] = useState(false);

  const fetchCharactersList = useCallback(async (viewAll = false) => {
    if (!db ||!user) return;
    setIsListLoading(true);
    try {
      let chars =;
      if (isMaster && viewAll) {
        const usersSnapshot = await getDocs(collection(db, `artifacts/${APP_ID}/users`));
        for (const userDoc of usersSnapshot.docs) {
          const charSnapshot = await getDocs(collection(db, `artifacts/${APP_ID}/users/${userDoc.id}/characterSheets`));
          charSnapshot.forEach(doc => {
            if (!doc.data().deleted) chars.push({ id: doc.id, ownerUid: userDoc.id,...doc.data() });
          });
        }
        setViewingAllCharacters(true);
      } else {
        const q = query(collection(db, `artifacts/${APP_ID}/users/${user.uid}/characterSheets`));
        const querySnapshot = await getDocs(q);
        chars = querySnapshot.docs.map(doc =>!doc.data().deleted? { id: doc.id, ownerUid: user.uid,...doc.data() } : null).filter(Boolean);
        setViewingAllCharacters(false);
      }
      setCharactersList(chars);
    } catch (error) {
      console.error("Erro ao carregar lista de personagens:", error);
      setModal({ isVisible: true, message: `Erro ao carregar personagens: ${error.message}`, type: 'info' });
    } finally {
      setIsListLoading(false);
    }
  }, [db, user, isMaster, setModal]);

  useEffect(() => {
    if (user && db && isAuthReady) {
      fetchCharactersList(viewingAllCharacters);
    }
  },);

  // --- Handlers ---

  const handleSelectCharacter = (charId, charOwnerUid) => {
    setSelectedCharId(charId);
    setOwnerUid(charOwnerUid);
    window.history.pushState({}, '', `?charId=${charId}&ownerUid=${charOwnerUid}`);
  };

  const handleBackToList = () => {
    setSelectedCharId(null);
    setOwnerUid(null);
    window.history.pushState({}, '', window.location.pathname);
    fetchCharactersList(viewingAllCharacters);
  };
  
  const handleCreateNewCharacter = () => {
    setModal({
      isVisible: true,
      message: 'Digite o nome do novo personagem:',
      type: 'prompt',
      onConfirm: async (name) => {
        if (name && db && user) {
          const newCharId = crypto.randomUUID();
          const newCharacterData = {
            id: newCharId, ownerUid: user.uid, name, photoUrl: '', age: '', height: '', gender: '', race: '', class: '', alignment: '',
            level: 0, xp: 100, mainAttributes: { hp: { current: 0, max: 0 }, mp: { current: 0, max: 0 }, initiative: 0, fa: 0, fm: 0, fd: 0 },
            attributes:, inventory:, wallet: { zeni: 0 }, advantages:, disadvantages:, abilities:, specializations:, equippedItems:, history:, notes:,
          };
          try {
            const characterDocRef = doc(db, `artifacts/${APP_ID}/users/${user.uid}/characterSheets/${newCharId}`);
            await setDoc(characterDocRef, serializeCharacterForSave(newCharacterData));
            handleSelectCharacter(newCharId, user.uid);
            fetchCharactersList();
          } catch (error) {
            setModal({ isVisible: true, message: `Erro ao criar: ${error.message}`, type: 'info' });
          }
        }
      }
    });
  };
  
  const handleDeleteCharacter = (charId, charName, charOwnerUid) => {
    setModal({
      isVisible: true,
      message: `Tem certeza que deseja EXCLUIR permanentemente '${charName}'?`,
      type: 'confirm',
      onConfirm: async () => {
        if (!db ||!user |

| (user.uid!== charOwnerUid &&!isMaster)) return;
        try {
          const characterDocRef = doc(db, `artifacts/${APP_ID}/users/${charOwnerUid}/characterSheets/${charId}`);
          await deleteDoc(characterDocRef);
          handleBackToList();
        } catch (error) {
          setModal({ isVisible: true, message: `Erro ao excluir: ${error.message}`, type: 'info' });
        }
      }
    });
  };
  
  const handleSimpleChange = (e) => {
    const { name, value } = e.target;
    const isNumeric = ['age', 'level', 'xp'].includes(name);
    setCharacter(prev => ({...prev, [name]: isNumeric? parseInt(value, 10) |

| 0 : value }));
  };

  const handleMainAttributeChange = (e, isSingleValue = false) => {
    const { name, value, dataset } = e.target;
    const parsedValue = parseInt(value, 10) |

| 0;
    
    setCharacter(prev => {
      const newMainAttributes = {...prev.mainAttributes };
      if (isSingleValue) {
        newMainAttributes[name] = parsedValue;
      } else {
        const attributeName = dataset.attribute;
        newMainAttributes[attributeName] = {...newMainAttributes[attributeName], [name]: parsedValue };
      }
      return {...prev, mainAttributes: newMainAttributes };
    });
  };
  
  const handleAttributeChange = (id, field, value) => {
    setCharacter(prev => {
        const newAttributes = prev.attributes.map(attr => {
            if (attr.id === id) {
                const updatedAttr = {...attr, [field]: field === 'name'? value : parseInt(value, 10) |

| 0 };
                updatedAttr.total = (updatedAttr.base |

| 0) + (updatedAttr.perm |
| 0) + (updatedAttr.cond |
| 0) + (updatedAttr.arma |
| 0);
                return updatedAttr;
            }
            return attr;
        });
        return {...prev, attributes: newAttributes };
    });
  };
  
  const [zeniAmount, setZeniAmount] = useState(0);
  const handleZeniOperation = (operation) => {
    setCharacter(prev => {
      const currentZeni = prev.wallet?.zeni |

| 0;
      const newZeni = operation === 'add'
      ? currentZeni + zeniAmount
        : Math.max(0, currentZeni - zeniAmount);
      return {...prev, wallet: {...prev.wallet, zeni: newZeni } };
    });
    setZeniAmount(0);
  };
  
  // --- Renderização (JSX) ---
  const isLoading = isAuthReady === false |

| isCharacterLoading |
| isListLoading;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 font-inter">
      <style>{`/* Estilos omitidos para brevidade */`}</style>
      <div className="max-w-4xl mx-auto bg-gray-800 rounded-lg shadow-2xl p-6 md:p-8 border border-gray-700">
        <h1 className="text-4xl font-extrabold text-center text-purple-400 mb-8 tracking-wide">Ficha StoryCraft</h1>
        
        <section className="mb-8 p-4 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
          {/* JSX para login/logout omitido */}
        </section>

        {user &&!selectedCharId && (
          <section>
            {/* JSX para lista de personagens omitido */}
          </section>
        )}

        {user && selectedCharId && character && (
          <>
            {/* JSX para a ficha do personagem omitido */}
            <button onClick={() => listManager.addItem('inventory', { id: crypto.randomUUID(), name: '', description: '', isCollapsed: false })}>
              Adicionar Item (Exemplo)
            </button>
          </>
        )}

        {modal.isVisible && <CustomModal {...modal} onClose={() => setModalState(p => ({...p, isVisible: false }))} />}
        {isLoading && <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><div className="text-white text-xl font-bold">Carregando...</div></div>}
      </div>
    </div>
  );
};

export default App;

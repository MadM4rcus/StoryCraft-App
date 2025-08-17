import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, getDocs, getDoc, deleteDoc } from 'firebase/firestore';

// =====================================================================================
//  HELPER & UI COMPONENTS (Componentes de UI e Auxiliares)
// =====================================================================================

/**
 * Componente Modal para prompts e confirmações personalizadas.
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
      case 'confirm': return 'Confirmar';
      case 'prompt': return 'Confirmar';
      default: return 'OK';
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
 * Textarea com altura automática que se ajusta ao conteúdo.
 */
const AutoResizingTextarea = ({ value, onChange, placeholder, className, disabled }) => {
    const textareaRef = useRef(null);
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [value]);
    return <textarea ref={textareaRef} value={value} onChange={onChange} placeholder={placeholder} className={`${className} resize-none overflow-hidden`} rows="1" disabled={disabled} />;
};

/**
 * Componente reutilizável para uma seção colapsável com título.
 */
const Section = ({ title, sectionKey, isCollapsed, onToggle, children }) => (
  <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
    <h2 
      className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
      onClick={() => onToggle(sectionKey)}
    >
      {title}
      <span>{isCollapsed ? '▼' : '▲'}</span>
    </h2>
    {!isCollapsed && children}
  </section>
);

// =====================================================================================
//  CHARACTER SHEET COMPONENTS (Componentes da Ficha de Personagem)
// =====================================================================================

/**
 * Exibe a lista de personagens do usuário.
 */
const CharacterList = ({ characters, isMaster, viewingAllCharacters, onSelect, onCreate, onDelete, onToggleView, isLoading }) => (
  <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
    <h2 className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2">
      {viewingAllCharacters ? 'Todas as Fichas de Personagem' : 'Meus Personagens'}
    </h2>
    <div className="flex flex-wrap gap-4 mb-4">
      <button onClick={onCreate} className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75" disabled={isLoading}>
        Criar Novo Personagem
      </button>
      {isMaster && (
        <button onClick={onToggleView} className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75" disabled={isLoading}>
          {viewingAllCharacters ? 'Ver Minhas Fichas' : 'Ver Todas as Fichas'}
        </button>
      )}
    </div>
    {characters.length === 0 && !isLoading ? (
      <p className="text-gray-400 italic">Nenhum personagem encontrado. Crie um novo!</p>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {characters.map((char) => (
          <div key={char.id} className="bg-gray-600 p-4 rounded-lg shadow-md flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">{char.name || 'Personagem Sem Nome'}</h3>
              <p className="text-sm text-gray-300">Raça: {char.race || 'N/A'}</p>
              <p className="text-sm text-gray-300">Classe: {char.class || 'N/A'}</p>
              {isMaster && char.ownerUid && <p className="text-xs text-gray-400 mt-2 break-all">Proprietário: {char.ownerUid}</p>}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => onSelect(char.id, char.ownerUid)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75">
                Ver/Editar
              </button>
              <button onClick={() => onDelete(char.id, char.name, char.ownerUid)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75">
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </section>
);

/**
 * Componente genérico para renderizar qualquer lista de blocos dinâmicos e arrastáveis.
 */
const DynamicBlockSection = ({ 
  title, 
  sectionKey, 
  listName,
  items, 
  renderItem, 
  onAddItem, 
  isCollapsed, 
  onToggle, 
  canEdit,
  // Drag and Drop handlers
  draggedItemRef,
  handleDragStart,
  handleDragOver,
  handleDrop,
}) => (
  <Section title={title} sectionKey={sectionKey} isCollapsed={isCollapsed} onToggle={onToggle}>
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className="text-gray-400 italic">Nenhum item adicionado.</p>
      ) : (
        items.map((item, index) => (
          <div
            key={item.id}
            draggable={canEdit}
            onDragStart={(e) => canEdit && handleDragStart(e, index, listName)}
            onDragOver={handleDragOver}
            onDrop={(e) => canEdit && handleDrop(e, index, listName)}
            className={canEdit ? 'cursor-move' : ''}
          >
            {renderItem(item, index)}
          </div>
        ))
      )}
    </div>
    {canEdit && (
      <div className="flex justify-end mt-4">
        <button
          onClick={onAddItem}
          className="w-10 h-10 bg-green-600 hover:bg-green-700 text-white text-2xl font-bold rounded-full shadow-lg transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75 flex items-center justify-center"
          aria-label={`Adicionar ${title}`}
        >
          +
        </button>
      </div>
    )}
  </Section>
);

// =====================================================================================
//  MAIN APP COMPONENT (Componente Principal da Aplicação)
// =====================================================================================

const App = () => {
  // --- STATE MANAGEMENT (Gerenciamento de Estado) ---
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isMaster, setIsMaster] = useState(false);
  const [character, setCharacter] = useState(null);
  const [charactersList, setCharactersList] = useState([]);
  const [selectedCharIdState, setSelectedCharIdState] = useState(null);
  const [ownerUidState, setOwnerUidState] = useState(null);
  const [viewingAllCharacters, setViewingAllCharacters] = useState(false);
  const [modal, setModal] = useState({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
  const [isLoading, setIsLoading] = useState(false);
  const [zeniAmount, setZeniAmount] = useState(0);

  // --- REFS ---
  const fileInputRef = useRef(null);
  const draggedItemRef = useRef(null);

  // --- FIREBASE CONFIG ---
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
  
  const canEdit = useMemo(() => {
    if (!user || !character) return false;
    return user.uid === character.ownerUid || isMaster;
  }, [user, character, isMaster]);

  // --- FIREBASE & AUTH EFFECTS (Efeitos de Firebase e Autenticação) ---

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
            await setDoc(userDocRef, { isMaster: false, displayName: currentUser.displayName, email: currentUser.email });
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
      setModal({ isVisible: true, message: `Erro ao inicializar: ${error.message}`, type: 'info' });
    }
  }, [firebaseConfig, appId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSelectedCharIdState(params.get('charId'));
    setOwnerUidState(params.get('ownerUid'));
  }, []);

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

  const fetchCharactersList = useCallback(async (fetchAll = viewingAllCharacters) => {
    if (!db || !user || !isAuthReady) return;
    setIsLoading(true);
    try {
      let chars = [];
      if (isMaster && fetchAll) {
        const usersCollectionRef = collection(db, `artifacts/${appId}/users`);
        const usersSnapshot = await getDocs(usersCollectionRef);
        for (const userDoc of usersSnapshot.docs) {
          const userUid = userDoc.id;
          const charSheetsRef = collection(db, `artifacts/${appId}/users/${userUid}/characterSheets`);
          const charSnapshot = await getDocs(charSheetsRef);
          charSnapshot.docs.forEach(doc => {
            if (!doc.data().deleted) chars.push({ id: doc.id, ownerUid: userUid, ...doc.data() });
          });
        }
      } else {
        const userCharSheetsRef = collection(db, `artifacts/${appId}/users/${user.uid}/characterSheets`);
        const q = query(userCharSheetsRef);
        const querySnapshot = await getDocs(q);
        chars = querySnapshot.docs.map(doc => doc.data().deleted ? null : { id: doc.id, ownerUid: user.uid, ...doc.data() }).filter(Boolean);
      }
      setCharactersList(chars);
    } catch (error) {
      console.error("Erro ao carregar lista de personagens:", error);
      setModal({ isVisible: true, message: `Erro ao carregar personagens: ${error.message}`, type: 'info' });
    } finally {
      setIsLoading(false);
    }
  }, [db, user, isAuthReady, isMaster, appId, viewingAllCharacters]);

  useEffect(() => {
    if (user && db && isAuthReady) {
      fetchCharactersList();
    }
  }, [user, db, isAuthReady, fetchCharactersList]);
  
  const deserializeData = (data) => {
    const deserialized = { ...data };
    const fieldsToParse = [
      'mainAttributes', 'attributes', 'inventory', 'wallet', 'advantages', 
      'disadvantages', 'abilities', 'specializations', 'equippedItems', 
      'history', 'notes'
    ];
    
    fieldsToParse.forEach(field => {
      if (typeof deserialized[field] === 'string') {
        try {
          deserialized[field] = JSON.parse(deserialized[field]);
        } catch (e) {
          console.error(`Erro ao deserializar campo ${field}:`, e);
          deserialized[field] = Array.isArray(deserialized[field]) ? [] : {};
        }
      }
    });

    // Garante que arrays de itens tenham a propriedade 'isCollapsed'
    const listFields = ['inventory', 'advantages', 'disadvantages', 'abilities', 'specializations', 'equippedItems', 'history', 'notes'];
    listFields.forEach(field => {
        deserialized[field] = (deserialized[field] || []).map(item => ({...item, isCollapsed: item.isCollapsed || false}));
    });

    return deserialized;
  };

  useEffect(() => {
    let unsubscribeCharacter = () => {};
    if (db && user && isAuthReady && selectedCharIdState) {
      const loadCharacter = async () => {
        setIsLoading(true);
        let targetUid = ownerUidState;
        if (!targetUid && isMaster) {
            // Lógica para mestre encontrar o dono do personagem (omitida para brevidade)
        } else if (!targetUid) {
            targetUid = user.uid;
        }

        if (!targetUid) {
          setIsLoading(false);
          return;
        }

        const characterDocRef = doc(db, `artifacts/${appId}/users/${targetUid}/characterSheets/${selectedCharIdState}`);
        unsubscribeCharacter = onSnapshot(characterDocRef, (docSnap) => {
          if (docSnap.exists() && !docSnap.data().deleted) {
            const deserialized = deserializeData(docSnap.data());
            setCharacter(deserialized);
          } else {
            setCharacter(null);
            setSelectedCharIdState(null);
            window.history.pushState({}, '', window.location.pathname);
            fetchCharactersList();
          }
          setIsLoading(false);
        }, (error) => {
          console.error("Erro ao ouvir a ficha:", error);
          setIsLoading(false);
        });
      };
      loadCharacter();
    } else {
      setCharacter(null);
    }
    return () => unsubscribeCharacter();
  }, [db, user, isAuthReady, selectedCharIdState, ownerUidState, appId, isMaster, fetchCharactersList]);

  useEffect(() => {
    if (!db || !user || !isAuthReady || !character || !selectedCharIdState || !canEdit) {
      return;
    }

    const handler = setTimeout(() => {
      const characterDocRef = doc(db, `artifacts/${appId}/users/${character.ownerUid}/characterSheets/${selectedCharIdState}`);
      const dataToSave = { ...character };
      
      // Serializa todos os campos que são objetos ou arrays
      Object.keys(dataToSave).forEach(key => {
        if (typeof dataToSave[key] === 'object' && dataToSave[key] !== null) {
          dataToSave[key] = JSON.stringify(dataToSave[key]);
        }
      });
      
      // Remove campos que não devem ser salvos
      delete dataToSave.deleted;
      delete dataToSave.basicAttributes;
      delete dataToSave.magicAttributes;

      setDoc(characterDocRef, dataToSave, { merge: true }).catch(error => {
        console.error('Erro ao salvar ficha:', error);
      });
    }, 1000);

    return () => clearTimeout(handler);
  }, [character, db, user, isAuthReady, selectedCharIdState, canEdit, appId]);


  // --- HANDLERS (Funções de Manipulação) ---

  const handleSetCharacter = (update) => {
    setCharacter(prev => ({ ...prev, ...update }));
  };
  
  const handleSetCharacterList = (listName, newList) => {
    setCharacter(prev => ({ ...prev, [listName]: newList }));
  };

  const handleGoogleSignIn = async () => { /* ... (sem alterações) ... */ };
  const handleSignOut = async () => { /* ... (sem alterações) ... */ };
  const handleCreateNewCharacter = () => { /* ... (sem alterações, mas usando a nova estrutura de dados) ... */ };
  const handleDeleteCharacter = (charId, charName, ownerUid) => { /* ... (sem alterações) ... */ };
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
  const handleToggleView = () => {
    const newViewingAll = !viewingAllCharacters;
    setViewingAllCharacters(newViewingAll);
    fetchCharactersList(newViewingAll);
  };
  const toggleSection = (sectionKey) => {
    setCharacter(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  };

  // --- Handlers Genéricos para Listas Dinâmicas ---
  const handleAddItem = (listName, newItem) => {
    const currentList = character[listName] || [];
    handleSetCharacterList(listName, [...currentList, newItem]);
  };

  const handleRemoveItem = (listName, idToRemove) => {
    const currentList = character[listName] || [];
    handleSetCharacterList(listName, currentList.filter(item => item.id !== idToRemove));
  };

  const handleUpdateItem = (listName, id, field, value) => {
    const currentList = character[listName] || [];
    const newList = currentList.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        // Recalculo específico para atributos
        if (listName === 'attributes') {
          updatedItem.total = (updatedItem.base || 0) + (updatedItem.perm || 0) + (updatedItem.cond || 0) + (updatedItem.arma || 0);
        }
        return updatedItem;
      }
      return item;
    });
    handleSetCharacterList(listName, newList);
  };

  const handleDragStart = (e, index, listName) => {
    draggedItemRef.current = { index, listName };
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e, dropIndex, targetListName) => {
    e.preventDefault();
    const { index: draggedIndex, listName } = draggedItemRef.current;
    if (draggedIndex === null || listName !== targetListName) return;
    
    const currentList = [...character[listName]];
    const [draggedItem] = currentList.splice(draggedIndex, 1);
    currentList.splice(dropIndex, 0, draggedItem);
    handleSetCharacterList(listName, currentList);
    draggedItemRef.current = null;
  };
  
  // --- RENDER FUNCTIONS (Funções de Renderização para Listas) ---

  const renderAttributeItem = (attr) => (
    <div className="p-3 bg-gray-600 rounded-md shadow-sm border border-gray-500 relative">
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <input type="text" placeholder="Nome" value={attr.name} onChange={(e) => handleUpdateItem('attributes', attr.id, 'name', e.target.value)} className="w-full sm:w-1/4 p-2 bg-gray-700 border border-gray-500 rounded-md text-white font-semibold" disabled={!canEdit} />
        <div className="flex items-center gap-2 text-xs flex-grow justify-end w-full sm:w-auto">
          {['base', 'perm', 'cond', 'arma'].map(field => (
            <div key={field} className="flex flex-col items-center">
              <span className="text-gray-400 text-xs text-center capitalize">{field === 'perm' ? 'Perm.' : field === 'cond' ? 'Cond.' : field}</span>
              <input type="number" value={attr[field] === 0 ? '' : attr[field]} onChange={(e) => handleUpdateItem('attributes', attr.id, field, parseInt(e.target.value) || 0)} className="w-12 p-1 bg-gray-700 border border-gray-500 rounded-md text-white text-center" disabled={!canEdit} />
            </div>
          ))}
          <div className="flex flex-col items-center"><span className="text-gray-400 text-xs text-center">Total</span><input type="number" value={attr.total} readOnly className="w-12 p-1 bg-gray-800 border border-gray-600 rounded-md text-white font-bold cursor-not-allowed text-center" /></div>
        </div>
      </div>
      {canEdit && <button onClick={() => handleRemoveItem('attributes', attr.id)} className="absolute top-1 right-1 w-6 h-6 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-full flex items-center justify-center">X</button>}
    </div>
  );

  const renderInventoryItem = (item) => (
    <div className="flex flex-col p-3 bg-gray-600 rounded-md shadow-sm">
      <div className="flex justify-between items-center mb-1">
        <input type="text" value={item.name} onChange={e => handleUpdateItem('inventory', item.id, 'name', e.target.value)} className="font-semibold text-lg w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white" placeholder="Nome do Item" disabled={!canEdit} />
        {canEdit && <button onClick={() => handleRemoveItem('inventory', item.id)} className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md">Remover</button>}
      </div>
      <AutoResizingTextarea value={item.description} onChange={e => handleUpdateItem('inventory', item.id, 'description', e.target.value)} placeholder="Descrição" className="text-sm text-gray-300 italic w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white" disabled={!canEdit} />
    </div>
  );
  
  // ... outras funções de renderização para vantagens, habilidades, etc. ...

  // --- RENDER PRINCIPAL ---
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 font-inter">
       <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap'); body { font-family: 'Inter', sans-serif; } input[type="number"]::-webkit-outer-spin-button, input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; } input[type="number"] { -moz-appearance: textfield; }`}</style>
      <div className="max-w-4xl mx-auto bg-gray-800 rounded-lg shadow-2xl p-6 md:p-8 border border-gray-700">
        <h1 className="text-4xl font-extrabold text-center text-purple-400 mb-8 tracking-wide">Ficha StoryCraft</h1>
        
        {/* ... (UI de Autenticação) ... */}

        {user && !selectedCharIdState && (
          <CharacterList 
            characters={charactersList}
            isMaster={isMaster}
            viewingAllCharacters={viewingAllCharacters}
            onSelect={handleSelectCharacter}
            onCreate={handleCreateNewCharacter}
            onDelete={handleDeleteCharacter}
            onToggleView={handleToggleView}
            isLoading={isLoading}
          />
        )}

        {user && selectedCharIdState && character && (
          <>
            <button onClick={handleBackToList} className="mb-4 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg shadow-md">
              ← Voltar para a Lista
            </button>
            
            {/* ... (Componente CharacterHeader) ... */}

            {/* ... (Componente MainAttributes) ... */}
            
            <DynamicBlockSection
              title="Atributos"
              sectionKey="isAttributesCollapsed"
              listName="attributes"
              items={character.attributes || []}
              renderItem={renderAttributeItem}
              onAddItem={() => handleAddItem('attributes', { id: crypto.randomUUID(), name: '', base: 0, perm: 0, cond: 0, arma: 0, total: 0 })}
              isCollapsed={character.isAttributesCollapsed}
              onToggle={toggleSection}
              canEdit={canEdit}
              draggedItemRef={draggedItemRef}
              handleDragStart={handleDragStart}
              handleDragOver={handleDragOver}
              handleDrop={handleDrop}
            />

            <DynamicBlockSection
              title="Inventário"
              sectionKey="isInventoryCollapsed"
              listName="inventory"
              items={character.inventory || []}
              renderItem={renderInventoryItem}
              onAddItem={() => handleAddItem('inventory', { id: crypto.randomUUID(), name: '', description: '' })}
              isCollapsed={character.isInventoryCollapsed}
              onToggle={toggleSection}
              canEdit={canEdit}
              draggedItemRef={draggedItemRef}
              handleDragStart={handleDragStart}
              handleDragOver={handleDragOver}
              handleDrop={handleDrop}
            />

            {/* ... (Outras seções usando DynamicBlockSection) ... */}
            
            {/* ... (ActionButtons) ... */}
          </>
        )}

        {!user && <p className="text-center text-gray-400 text-lg mt-8">Faça login para começar!</p>}
      </div>

      {modal.isVisible && <CustomModal {...modal} onClose={() => setModal(prev => ({ ...prev, isVisible: false }))} />}
      {isLoading && <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><div className="text-white text-xl font-bold">Carregando...</div></div>}
    </div>
  );
};

export default App;

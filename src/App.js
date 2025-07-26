import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, getDocs, deleteDoc } from 'firebase/firestore'; // Importado deleteDoc

// Componente Modal para prompts e confirmações personalizadas
const CustomModal = ({ message, onConfirm, onCancel, type, onClose }) => {
  const [inputValue, setInputValue] = useState('');

  const handleConfirm = () => {
    if (type === 'prompt') {
      onConfirm(inputValue);
      // IMPORTANTE: NÃO chame onClose() aqui para prompts. O componente pai (App)
      // gerenciará o fechamento/transição para prompts multi-passos.
    } else {
      onConfirm();
      onClose(); // Para tipos 'confirm' ou 'info', feche imediatamente.
    }
  };

  const handleCancel = () => {
    onCancel();
    onClose(); // Sempre feche ao cancelar.
  };

  // Determina o texto do botão de confirmação baseado no tipo de modal
  const confirmButtonText = useMemo(() => {
    switch (type) {
      case 'confirm':
        return 'Confirmar';
      case 'prompt':
        return 'Adicionar'; // Usado para adicionar itens/perks após prompt
      case 'info':
      default:
        return 'OK'; // Para mensagens informativas
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
            {confirmButtonText} {/* Usando o texto dinâmico */}
          </button>
          {type !== 'info' && ( // "Info" modals geralmente só precisam de um botão "OK"
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
    storageBucket: "storycraft-a5f7e.firebasestorage.app",
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
  const [isMaster, setIsMaster] = useState(false); // Estado para o papel de mestre

  // Estados para gerenciamento de personagens
  const [character, setCharacter] = useState(null);
  const [charactersList, setCharactersList] = useState([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState(null);
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

  // Ref para o input de arquivo para acioná-lo programaticamente
  const fileInputRef = useRef(null);

  // Mapeamento de atributos básicos para emojis
  const basicAttributeEmojis = {
    forca: '💪',
    destreza: '🏃‍♂️',
    inteligencia: '🧠',
    constituicao: '❤️‍�',
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
    terra: '🌍',
    luz: '🌟',
    trevas: '🌑',
    espirito: '🌀',
    outro: '🪄',
  };

  // Função auxiliar para renderizar texto com links de imagem
  const renderTextWithImages = (text) => {
    if (!text) return null;
    const parts = [];
    // Regex para encontrar URLs de imagem comuns
    const imageUrlRegex = /(https?:\/\/[^\s]+\.(?:png|jpe?g|gif|svg|webp|bmp|tiff|ico))/gi;
    let lastIndex = 0;
    let match;

    while ((match = imageUrlRegex.exec(text)) !== null) {
      const imageUrl = match[0];
      const startIndex = match.index;
      const endIndex = imageUrlRegex.lastIndex;

      // Adiciona texto antes da URL da imagem
      if (startIndex > lastIndex) {
        parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex, startIndex)}</span>);
      }

      // Adiciona a imagem com float e tamanho fixo de 100px
      const imgWidth = 100; // Largura fixa em 100px
      parts.push(
        <img
          key={`image-${startIndex}`}
          src={imageUrl}
          alt="Imagem da história"
          className={`float-left max-w-[${imgWidth}px] h-auto rounded-md shadow-md mr-4 mb-2`}
          onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/${imgWidth}x100/000000/FFFFFF?text=Erro`; }} // Placeholder dinâmico
        />
      );
      lastIndex = endIndex;
    }

    // Adiciona qualquer texto restante após a última URL da imagem
    if (lastIndex < text.length) {
      parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex)}</span>);
    }

    // Adiciona um clear div para garantir que o layout não seja quebrado por floats subsequentes
    parts.push(<div key="clear-float" className="clear-both"></div>);

    return <div className="whitespace-pre-wrap break-words">{parts}</div>;
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
          setSelectedCharacterId(null);
          setViewingAllCharacters(false);
          setIsMaster(false); // Limpa o status de mestre ao deslogar
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

  // Efeito para carregar o papel do usuário (mestre/jogador) do Firestore
  useEffect(() => {
    let unsubscribeRole = () => {};
    if (db && user && isAuthReady) {
      const userRoleDocRef = doc(db, `artifacts/${appId}/userRoles/${user.uid}`);
      unsubscribeRole = onSnapshot(userRoleDocRef, (docSnap) => {
        if (docSnap.exists() && docSnap.data().isMaster === true) {
          setIsMaster(true);
        } else {
          setIsMaster(false);
        }
      }, (error) => {
        console.error("Erro ao carregar papel do usuário:", error);
        setIsMaster(false); // Assume que não é mestre em caso de erro
      });
    } else {
      setIsMaster(false); // Não logado ou Firebase não pronto
    }
    return () => unsubscribeRole();
  }, [db, user, isAuthReady, appId]);


  // Função para carregar a lista de personagens
  const fetchCharactersList = useCallback(async () => {
    if (!db || !user || !isAuthReady) return;

    setIsLoading(true);
    try {
      let allChars = [];
      if (isMaster) {
        // Para o mestre, buscar em todas as subcoleções 'characterSheets' de todos os usuários
        const usersCollectionRef = collection(db, `artifacts/${appId}/users`);
        const usersSnapshot = await getDocs(usersCollectionRef);
        
        for (const userDoc of usersSnapshot.docs) {
          const userUid = userDoc.id;
          const userCharacterSheetsRef = collection(db, `artifacts/${appId}/users/${userUid}/characterSheets`);
          const charSnapshot = await getDocs(userCharacterSheetsRef);
          charSnapshot.docs.forEach(doc => {
            // Filtrar personagens com soft delete (se houver) e adicionar à lista
            if (!doc.data().deleted) { // Apenas adiciona se não estiver marcado como deletado
              allChars.push({ id: doc.id, ownerUid: userUid, ...doc.data() });
            }
          });
        }
        setCharactersList(allChars);
        setViewingAllCharacters(true); // Ativa a visualização de todas as fichas para o mestre
      } else {
        // Para o jogador, buscar apenas os seus próprios personagens
        const charactersCollectionRef = collection(db, `artifacts/${appId}/users/${user.uid}/characterSheets`);
        const q = query(charactersCollectionRef);
        const querySnapshot = await getDocs(q);
        const chars = querySnapshot.docs.map(doc => {
            if (!doc.data().deleted) { // Apenas adiciona se não estiver marcado como deletado
                return { id: doc.id, ownerUid: user.uid, ...doc.data() };
            }
            return null;
        }).filter(Boolean); // Filtra os nulos
        setCharactersList(chars);
        setViewingAllCharacters(false);
      }
      console.log("Lista de personagens carregada.");
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
      fetchCharactersList();
    }
  }, [user, db, isAuthReady, fetchCharactersList]);

  // Listener em tempo real para o personagem selecionado
  useEffect(() => {
    let unsubscribeCharacter = () => {};
    // Usamos um estado local para selectedCharacterId para evitar problemas de dependência circular
    // com o estado global.
    const currentSelectedCharacterId = selectedCharacterId; 

    if (db && user && isAuthReady && currentSelectedCharacterId) {
      // Encontra o personagem na lista para obter o ownerUid correto
      const charToLoad = charactersList.find(c => c.id === currentSelectedCharacterId);
      const targetUid = charToLoad ? charToLoad.ownerUid : user.uid; // Usa ownerUid se disponível, senão o próprio UID

      const characterDocRef = doc(db, `artifacts/${appId}/users/${targetUid}/characterSheets/${currentSelectedCharacterId}`);

      unsubscribeCharacter = onSnapshot(characterDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.deleted) { // Se a ficha foi deletada (soft delete), desseleciona
            setCharacter(null);
            setSelectedCharacterId(null);
            fetchCharactersList(); // Recarrega a lista para remover o item deletado
            setModal({ isVisible: true, message: "A ficha selecionada foi excluída.", type: "info", onConfirm: () => {}, onCancel: () => {} });
            return;
          }
          const deserializedData = { ...data };
          try {
            // Deserializa os campos que foram stringificados como JSON
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

          // Garante que todos os campos de array/objeto existam e sejam do tipo correto
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
          deserializedData.history = deserializedData.history || '';
          deserializedData.notes = deserializedData.notes || '';
          deserializedData.level = deserializedData.level !== undefined ? deserializedData.level : 0;
          deserializedData.xp = deserializedData.xp !== undefined ? deserializedData.xp : 100;

          setCharacter(deserializedData);
          console.log(`Ficha de '${deserializedData.name}' carregada do Firestore em tempo real.`);
        } else {
          console.log("Nenhuma ficha encontrada para o ID selecionado ou foi excluída.");
          setCharacter(null);
          setSelectedCharacterId(null);
          fetchCharactersList(); // Recarrega a lista para refletir a exclusão, se for o caso
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
    } else if (!currentSelectedCharacterId) {
      setCharacter(null);
    }
    return () => unsubscribeCharacter();
  }, [db, user, isAuthReady, selectedCharacterId, charactersList, appId, fetchCharactersList]);


  // Salva a ficha no Firestore
  useEffect(() => {
    if (db && user && isAuthReady && character && selectedCharacterId) {
      // O proprietário da ficha ou o mestre podem salvá-la
      const charToSaveOwnerUid = charactersList.find(c => c.id === selectedCharacterId)?.ownerUid;
      // Se não encontrou o proprietário, mas o usuário atual é o proprietário, usa o UID atual
      const targetUidForSave = charToSaveOwnerUid || user.uid; 

      if (user.uid !== targetUidForSave && !isMaster) { // Apenas o proprietário OU o mestre pode escrever
        console.warn("Tentativa de salvar ficha de outro usuário sem permissão de escrita.");
        return;
      }

      const characterDocRef = doc(db, `artifacts/${appId}/users/${targetUidForSave}/characterSheets/${selectedCharacterId}`);
      const saveCharacter = async () => {
        try {
          const dataToSave = { ...character };
          dataToSave.id = selectedCharacterId;
          dataToSave.ownerUid = targetUidForSave; // Garante que o ownerUid seja o do proprietário original

          // Stringify os objetos aninhados para Firestore
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
          
          // Remove o campo 'deleted' se ele existir, para evitar que ele seja salvo se não for mais necessário
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
  }, [character, db, user, isAuthReady, selectedCharacterId, charactersList, appId, isMaster]);


  // Lida com mudanças nos campos de texto simples
  const handleChange = (e) => {
    const { name, value } = e.target;
    // Converte para número se for um campo numérico específico
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

  // Lida com a adição de itens ao inventário
  const handleAddItem = () => {
    setModal({
      isVisible: true,
      message: 'Digite o nome do item:',
      type: 'prompt',
      onConfirm: (itemName) => {
        console.log("Modal de item confirmado. Nome:", itemName);
        if (itemName) {
          setModal({ // Abre o segundo prompt
            isVisible: true,
            message: 'Digite a descrição do item:',
            type: 'prompt',
            onConfirm: (itemDescription) => {
              console.log("Modal de descrição de item confirmado. Descrição:", itemDescription);
              setCharacter(prevChar => {
                const updatedInventory = [...(prevChar.inventory || []), { name: itemName, description: itemDescription }];
                console.log("Inventário atualizado:", updatedInventory);
                return { ...prevChar, inventory: updatedInventory };
              });
              setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} }); // Fecha o modal após o passo final
            },
            onCancel: () => {
              console.log("Adição de item cancelada na descrição.");
              setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} }); // Fecha o modal ao cancelar
            },
          });
        } else {
          console.log("Nome do item vazio. Adição cancelada.");
          setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} }); // Fecha o modal se o nome estiver vazio
        }
      },
      onCancel: () => {
        console.log("Adição de item cancelada no nome.");
        setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} }); // Fecha o modal ao cancelar
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
      console.log("Item removido do inventário:", updatedInventory);
      return { ...prevChar, inventory: updatedInventory };
    });
  };

  // Lida com a mudança de Zeni
  const handleZeniChange = (e) => {
    const value = parseInt(e.target.value, 10) || 0;
    setCharacter(prevChar => ({
      ...prevChar,
      wallet: { ...(prevChar.wallet || { zeni: 0 }), zeni: value },
    }));
  };

  // Lida com a adição de Vantagem/Desvantagem
  const handleAddPerk = (type) => {
    setModal({
      isVisible: true,
      message: `Digite o nome da ${type === 'advantages' ? 'Vantagem' : 'Desvantagem'}:`,
      type: 'prompt',
      onConfirm: (name) => {
        console.log(`Modal de ${type} confirmado. Nome:`, name);
        if (name) {
          setModal({ // Passo 2: Descrição
            isVisible: true,
            message: `Digite a descrição da ${name}:`,
            type: 'prompt',
            onConfirm: (description) => {
              console.log(`Modal de descrição de ${type} confirmado. Descrição:`, description);
              setModal({ // Passo 3: Valor
                isVisible: true,
                message: `Digite o valor da ${name}:`,
                type: 'prompt',
                onConfirm: (value) => {
                  console.log(`Modal de valor de ${type} confirmado. Valor:`, value);
                  setCharacter(prevChar => {
                    const updatedPerks = [...(prevChar[type] || []), { name, description, origin: { class: false, race: false, manual: false }, value: parseInt(value, 10) || 0 }];
                    console.log(`Lista de ${type} atualizada:`, updatedPerks);
                    return { ...prevChar, [type]: updatedPerks };
                  });
                  setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} }); // Fecha o modal após o passo final
                },
                onCancel: () => {
                  console.log(`Adição de ${type} cancelada no valor.`);
                  setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} }); // Fecha o modal ao cancelar
                },
              });
            },
            onCancel: () => {
              console.log(`Adição de ${type} cancelada na descrição.`);
              setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} }); // Fecha o modal ao cancelar
            },
          });
        } else {
          console.log(`Nome da ${type} vazio. Adição cancelada.`);
          setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} }); // Fecha o modal se o nome estiver vazio
        }
      },
      onCancel: () => {
        console.log(`Adição de ${type} cancelada no nome.`);
        setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} }); // Fecha o modal ao cancelar
      },
    });
  };

  // Lida com a edição de Vantagem/Desvantagem
  const handlePerkChange = (type, index, field, value) => {
    setCharacter(prevChar => {
      const updatedPerks = [...(prevChar[type] || [])];
      if (updatedPerks[index]) {
        if (field === 'value') {
          updatedPerks[index][field] = parseInt(value, 10) || 0;
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
      console.log(`${type} removida:`, updatedPerks);
      return { ...prevChar, [type]: updatedPerks };
    });
  };

  // Lida com a mudança de origem da Vantagem/Desvantagem
  const handlePerkOriginChange = (type, index, originType) => {
    setCharacter(prevChar => {
      const updatedPerks = [...(prevChar[type] || [])];
      if (updatedPerks[index]) { // Garante que o item existe antes de tentar modificar
        updatedPerks[index].origin[originType] = !updatedPerks[index].origin[originType];
      }
      console.log(`Origem de ${type} atualizada:`, updatedPerks);
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
        console.log("Modal de habilidade confirmado. Título:", title);
        if (title) {
          setModal({
            isVisible: true,
            message: `Digite a descrição da habilidade "${title}":`,
            type: 'prompt',
            onConfirm: (description) => {
              console.log("Modal de descrição de habilidade confirmado. Descrição:", description);
              setCharacter(prevChar => {
                const updatedAbilities = [...(prevChar.abilities || []), { title, description }];
                console.log("Habilidades atualizadas:", updatedAbilities);
                return { ...prevChar, abilities: updatedAbilities };
              });
              setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} }); // Fecha o modal após o passo final
            },
            onCancel: () => {
              console.log("Adição de habilidade cancelada na descrição.");
              setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} }); // Fecha o modal ao cancelar
            },
          });
        } else {
          console.log("Título da habilidade vazio. Adição cancelada.");
          setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} }); // Fecha o modal se o título estiver vazio
        }
      },
      onCancel: () => {
        console.log("Adição de habilidade cancelada no título.");
        setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} }); // Fecha o modal ao cancelar
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
      console.log("Habilidade removida:", updatedAbilities);
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
        console.log("Modal de especialização confirmado. Nome:", name);
        if (name) {
          setCharacter(prevChar => {
            const updatedSpecializations = [...(prevChar.specializations || []), { name, modifier: 0, bonus: 0 }];
            console.log("Especializações atualizadas:", updatedSpecializations);
            return { ...prevChar, specializations: updatedSpecializations };
          });
          setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} }); // Fecha o modal após o passo final
        } else {
          console.log("Nome da especialização vazio. Adição cancelada.");
          setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} }); // Fecha o modal se o nome estiver vazio
        }
      },
      onCancel: () => {
        console.log("Adição de especialização cancelada no nome.");
        setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} }); // Fecha o modal ao cancelar
      },
    });
  };

  // Lida com a remoção de Especialização
  const handleRemoveSpecialization = (indexToRemove) => {
    setCharacter(prevChar => {
      const updatedSpecializations = (prevChar.specializations || []).filter((_, index) => index !== indexToRemove);
      console.log("Especialização removida:", updatedSpecializations);
      return { ...prevChar, specializations: updatedSpecializations };
    });
  };

  // Lida com a mudança de nome, modificador ou bônus da Especialização
  const handleSpecializationChange = (index, field, value) => {
    setCharacter(prevChar => {
      const updatedSpecs = [...(prevChar.specializations || [])];
      if (updatedSpecs[index]) {
        if (field === 'name') {
          updatedSpecs[index][field] = value; // Atribui diretamente para o nome (string)
        } else {
          updatedSpecs[index][field] = parseInt(value, 10) || 0; // Converte para número para modificador/bônus
        }
      }
      console.log("Especialização alterada:", updatedSpecs);
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
        console.log("Modal de item equipado confirmado. Nome:", name);
        if (name) {
          setModal({
            isVisible: true,
            message: `Digite a descrição do item "${name}":`,
            type: 'prompt',
            onConfirm: (description) => {
              console.log("Modal de descrição de item equipado confirmado. Descrição:", description);
              setModal({
                isVisible: true,
                message: `Digite os atributos/efeitos do item "${name}" (ex: +5 Força, Dano Fogo):`,
                type: 'prompt',
                onConfirm: (attributes) => {
                  console.log("Modal de atributos de item equipado confirmado. Atributos:", attributes);
                  setCharacter(prevChar => {
                    const updatedEquippedItems = [...(prevChar.equippedItems || []), { name, description, attributes }];
                    console.log("Itens equipados atualizados:", updatedEquippedItems);
                    return { ...prevChar, equippedItems: updatedEquippedItems };
                  });
                  setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} }); // Fecha o modal após o passo final
                },
                onCancel: () => {
                  console.log("Adição de item equipado cancelada nos atributos.");
                  setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} }); // Fecha o modal ao cancelar
                },
              });
            },
            onCancel: () => {
              console.log("Adição de item equipado cancelada na descrição.");
              setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} }); // Fecha o modal ao cancelar
            },
          });
        } else {
          console.log("Nome do item equipado vazio. Adição cancelada.");
          setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} }); // Fecha o modal se o nome estiver vazio
        }
      },
      onCancel: () => {
        console.log("Adição de item equipado cancelada no nome.");
        setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} }); // Fecha o modal ao cancelar
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
      console.log("Item equipado removido:", updatedEquippedItems);
      return { ...prevChar, equippedItems: updatedEquippedItems };
    });
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
      message: 'Tem certeza que deseja resetar a ficha? Todos os dados serão perdidos. (Esta ação NÃO exclui a ficha do banco de dados)',
      type: 'confirm',
      onConfirm: () => {
        setCharacter({
          name: '', photoUrl: 'https://placehold.co/150x150/000000/FFFFFF?text=Foto', age: '', height: '', gender: '', race: '', class: '', alignment: '',
          level: 0, xp: 100, // Novos campos XP e Nível
          mainAttributes: { hp: { current: 0, max: 0 }, mp: { current: 0, max: 0 }, initiative: 0, fa: 0, fm: 0, fd: 0 }, // HP/MP iniciam em 0
          basicAttributes: { forca: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, destreza: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, inteligencia: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, constituicao: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, sabedoria: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, carisma: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, armadura: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, poderDeFogo: { base: 0, permBonus: 0, condBonus: 0, total: 0 } }, // Todos os básicos em 0
          magicAttributes: { fogo: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, agua: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, ar: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, terra: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, luz: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, trevas: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, espirito: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, outro: { base: 0, permBonus: 0, condBonus: 0, total: 0 } }, // Todos os mágicos em 0
          inventory: [], wallet: { zeni: 0 }, advantages: [], disadvantages: [], abilities: [], specializations: [], equippedItems: [], history: '', notes: '',
        });
        // Não reseta selectedCharacterId aqui, apenas o conteúdo da ficha
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
                // Garante que XP e Level sejam definidos ao importar, se não existirem
                const importedCharacterData = {
                  ...importedData,
                  id: newCharId,
                  ownerUid: user.uid,
                  xp: importedData.xp !== undefined ? importedData.xp : 100,
                  level: importedData.level !== undefined ? importedData.level : 0,
                  // Garante que HP/MP e atributos iniciem em 0 se não estiverem no JSON
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
                  // Garante que outros campos complexos sejam arrays vazios se ausentes no JSON
                  inventory: importedData.inventory || [],
                  wallet: importedData.wallet || { zeni: 0 },
                  advantages: importedData.advantages || [],
                  disadvantages: importedData.disadvantages || [],
                  abilities: importedData.abilities || [],
                  specializations: importedData.specializations || [],
                  equippedItems: importedData.equippedItems || [],
                  history: importedData.history || '',
                  notes: importedData.notes || '',
                };

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

                    await setDoc(characterDocRef, dataToSave);
                    setSelectedCharacterId(newCharId); // Define o personagem selecionado após a importação
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
              level: 0, xp: 100, // Novos campos XP e Nível com valores iniciais
              mainAttributes: { hp: { current: 0, max: 0 }, mp: { current: 0, max: 0 }, initiative: 0, fa: 0, fm: 0, fd: 0 },
              basicAttributes: { forca: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, destreza: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, inteligencia: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, constituicao: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, sabedoria: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, carisma: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, armadura: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, poderDeFogo: { base: 0, permBonus: 0, condBonus: 0, total: 0 } },
              magicAttributes: { fogo: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, agua: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, ar: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, terra: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, luz: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, trevas: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, espirito: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, outro: { base: 0, permBonus: 0, condBonus: 0, total: 0 } },
              inventory: [], wallet: { zeni: 0 }, advantages: [], disadvantages: [], abilities: [], specializations: [], equippedItems: [], history: '', notes: '',
            };

            // Define o personagem no estado local imediatamente
            setCharacter(newCharacterData);
            setSelectedCharacterId(newCharId);

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

            await setDoc(characterDocRef, dataToSave);
            fetchCharactersList(); // Recarrega a lista para garantir que o novo personagem apareça
            setModal({ isVisible: true, message: `Personagem '${name}' criado com sucesso!`, type: 'info', onConfirm: () => {}, onCancel: () => {} });
          } catch (error) {
            console.error("Erro ao criar novo personagem:", error);
            setModal({ isVisible: true, message: `Erro ao criar personagem: ${error.message}`, type: 'info', onConfirm: () => {}, onCancel: () => {} });
          } finally {
            setIsLoading(false);
          }
        } else {
          setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} }); // Fecha o modal se o nome estiver vazio
        }
      },
      onCancel: () => {
        setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} }); // Fecha o modal ao cancelar
      },
    });
  };

  // Função para selecionar um personagem da lista
  const handleSelectCharacter = (charId) => {
    setSelectedCharacterId(charId);
    setViewingAllCharacters(false);
  };

  // Função para voltar para a lista de personagens
  const handleBackToList = () => {
    setSelectedCharacterId(null);
    setCharacter(null);
    fetchCharactersList(); // Garante que a lista seja atualizada ao voltar
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
          await deleteDoc(characterDocRef); // Usa deleteDoc para remover permanentemente
          setSelectedCharacterId(null);
          setCharacter(null); // Limpa o personagem selecionado
          fetchCharactersList(); // Recarrega a lista para remover o item excluído
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
      setSelectedCharacterId(null);
      setViewingAllCharacters(false);
      setIsMaster(false); // Garante que o status de mestre seja limpo
      setModal({ isVisible: true, message: 'Você foi desconectado com sucesso.', type: 'info', onConfirm: () => {}, onCancel: () => {} });
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      setModal({ isVisible: true, message: `Erro ao fazer logout: ${error.message}`, type: 'info', onConfirm: () => {}, onCancel: () => {} });
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
          Ficha StoryCraft
        </h1>

        {/* Informações do Usuário (Firebase Authentication) */}
        <section className="mb-8 p-4 bg-gray-700 rounded-xl shadow-inner border border-gray-600 text-center">
          <h2 className="text-xl font-bold text-yellow-300 mb-2">Status do Usuário</h2>
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
        </section>

        {/* Se o usuário está logado e não há personagem selecionado, mostra a lista de personagens */}
        {user && !selectedCharacterId && (
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
                        onClick={() => handleSelectCharacter(char.id)}
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
        {user && selectedCharacterId && character && (
          <>
            <div className="mb-4">
              <button
                onClick={handleBackToList}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75"
              >
                ← Voltar para a Lista de Personagens
              </button>
            </div>

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
                    disabled={user.uid !== character.ownerUid && !isMaster}
                  />
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
                  {/* Novos campos de Nível e XP */}
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
                      disabled={user.uid !== character.ownerUid} // Jogador pode alterar HP atual
                    />
                    <span className="text-gray-300">/</span>
                    <input
                      type="number"
                      name="max"
                      data-attribute="hp"
                      value={character.mainAttributes.hp.max}
                      onChange={handleMainAttributeChange}
                      className="w-20 p-2 text-center bg-gray-700 border border-gray-500 rounded-md text-white text-xl font-bold"
                      disabled={!isMaster} // Apenas mestre pode alterar HP máximo
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
                      disabled={user.uid !== character.ownerUid} // Jogador pode alterar MP atual
                    />
                    <span className="text-gray-300">/</span>
                    <input
                      type="number"
                      name="max"
                      data-attribute="mp"
                      value={character.mainAttributes.mp.max}
                      onChange={handleMainAttributeChange}
                      className="w-20 p-2 text-center bg-gray-700 border border-gray-500 rounded-md text-white text-xl font-bold"
                      disabled={!isMaster} // Apenas mestre pode alterar MP máximo
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
                      disabled={user.uid !== character.ownerUid && !isMaster}
                    />
                  </div>
                ))}
                <p className="col-span-full text-sm text-gray-400 mt-2 text-center">
                  *A Iniciativa é baseada na Destreza ou Sabedoria (com custo de Mana para Sabedoria).
                </p>
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
                      <label className="capitalize text-lg font-medium text-gray-200 block mb-1">
                        {basicAttributeEmojis[key] || ''} {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: {/* Formata para exibir "Poder De Fogo" */}
                      </label>
                      <div className="flex justify-between items-start gap-2 text-sm"> {/* Ajustado para flex e items-start */}
                        <div className="flex flex-col items-center flex-1">
                          <span className="text-gray-400 text-xs text-center">Base</span>
                          <input type="number" value={attr.base} onChange={(e) => handleBasicAttributeChange('basicAttributes', key, 'base', e.target.value)} className="w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white" disabled={user.uid !== character.ownerUid && !isMaster} />
                        </div>
                        <div className="flex flex-col items-center flex-1">
                          <span className="text-gray-400 text-xs text-center">Bônus Perm.</span>
                          <input type="number" value={attr.permBonus} onChange={(e) => handleBasicAttributeChange('basicAttributes', key, 'permBonus', e.target.value)} className="w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white" disabled={user.uid !== character.ownerUid && !isMaster} />
                        </div>
                        <div className="flex flex-col items-center flex-1">
                          <span className="text-gray-400 text-xs text-center">Bônus Cond.</span>
                          <input type="number" value={attr.condBonus} onChange={(e) => handleBasicAttributeChange('basicAttributes', key, 'condBonus', e.target.value)} className="w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white" disabled={user.uid !== character.ownerUid && !isMaster} />
                        </div>
                        <div className="flex flex-col items-center flex-1">
                          <span className="text-gray-400 text-xs text-center">Total</span>
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
                      <label className="capitalize text-lg font-medium text-gray-200 block mb-1">
                        {magicAttributeEmojis[key] || ''} {key.charAt(0).toUpperCase() + key.slice(1)}: {/* Capitaliza a primeira letra para exibição */}
                      </label>
                      <div className="flex justify-between items-start gap-2 text-sm"> {/* Ajustado para flex e items-start */}
                        <div className="flex flex-col items-center flex-1">
                          <span className="text-gray-400 text-xs text-center">Base</span>
                          <input type="number" value={attr.base} onChange={(e) => handleBasicAttributeChange('magicAttributes', key, 'base', e.target.value)} className="w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white" disabled={user.uid !== character.ownerUid && !isMaster} />
                        </div>
                        <div className="flex flex-col items-center flex-1">
                          <span className="text-gray-400 text-xs text-center">Bônus Perm.</span>
                          <input type="number" value={attr.permBonus} onChange={(e) => handleBasicAttributeChange('magicAttributes', key, 'permBonus', e.target.value)} className="w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white" disabled={user.uid !== character.ownerUid && !isMaster} />
                        </div>
                        <div className="flex flex-col items-center flex-1">
                          <span className="text-gray-400 text-xs text-center">Bônus Cond.</span>
                          <input type="number" value={attr.condBonus} onChange={(e) => handleBasicAttributeChange('magicAttributes', key, 'condBonus', e.target.value)} className="w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white" disabled={user.uid !== character.ownerUid && !isMaster} />
                        </div>
                        <div className="flex flex-col items-center flex-1">
                          <span className="text-gray-400 text-xs text-center">Total</span>
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
                        disabled={user.uid !== character.ownerUid && !isMaster}
                      ></textarea>
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
                  disabled={user.uid !== character.ownerUid && !isMaster}
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
                              className="w-20 ml-2 p-1 bg-gray-700 border border-gray-500 rounded-md text-white text-center"
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
                              className="w-20 ml-2 p-1 bg-gray-700 border border-gray-500 rounded-md text-white text-center"
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
            </section>

            {/* Habilidades de Classe/Raça e Customizadas */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
              <h2 className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2">Habilidades (Classe, Raça, Customizadas)</h2>
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
                        disabled={user.uid !== character.ownerUid && !isMaster}
                      ></textarea>
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
                            className="w-16 p-1 bg-gray-700 border border-gray-500 rounded-md text-white"
                            disabled={user.uid !== character.ownerUid && !isMaster}
                          />
                        </label>
                        <label className="flex items-center gap-1">
                          Bônus:
                          <input
                            type="number"
                            value={spec.bonus}
                            onChange={(e) => handleSpecializationChange(index, 'bonus', e.target.value)}
                            className="w-16 p-1 bg-gray-700 border border-gray-500 rounded-md text-white"
                            disabled={user.uid !== character.ownerUid && !isMaster}
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
                disabled={user.uid !== character.ownerUid && !isMaster}
              ></textarea>
              {/* Área para exibir imagens da história */}
              <div className="mt-4 p-3 bg-gray-600 rounded-md border border-gray-500">
                <h3 className="text-lg font-semibold text-gray-300 mb-2">Visualização da História:</h3>
                {renderTextWithImages(character.history)}
              </div>

              <h2 className="text-2xl font-bold text-yellow-300 mb-4 mt-6 border-b-2 border-yellow-500 pb-2">Anotações</h2>
              <textarea
                name="notes"
                value={character.notes}
                onChange={handleLongTextChange}
                rows="6"
                className="w-full p-3 bg-gray-600 border border-gray-500 rounded-md focus:ring-purple-500 focus:border-purple-500 text-white resize-y"
                placeholder="Anotações diversas sobre o personagem, campanhas, NPCs, etc."
                disabled={user.uid !== character.ownerUid && !isMaster}
              ></textarea>
              {/* Área para exibir imagens das anotações */}
              <div className="mt-4 p-3 bg-gray-600 rounded-md border border-gray-500">
                <h3 className="text-lg font-semibold text-gray-300 mb-2">Visualização das Anotações:</h3>
                {renderTextWithImages(character.notes)}
              </div>
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

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
        <p className="text-white text-lg mb-4 text-center">{message}</p>
        {type === 'prompt' && (
          <input
            type="text"
            className="w-full p-2 mb-4 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:border-purple-500"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Digite aqui..."
          />
        )}
        <div className="flex justify-center space-x-4">
          <button
            onClick={handleConfirm}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition duration-200 ease-in-out transform hover:scale-105"
          >
            {confirmButtonText}
          </button>
          {type === 'confirm' && (
            <button
              onClick={handleCancel}
              className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition duration-200 ease-in-out transform hover:scale-105"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Configuração do Firebase
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ID do aplicativo (usado para isolar dados entre diferentes apps na mesma infraestrutura)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-rpg-app';

// Componente principal da aplicação
const App = () => {
  const [user, setUser] = useState(null);
  const [character, setCharacter] = useState(null);
  const [masterId, setMasterId] = useState('');
  const [isMaster, setIsMaster] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [modal, setModal] = useState({ isVisible: false, message: '', onConfirm: () => {}, onCancel: () => {}, type: 'info' });

  // Estados para o colapso das seções
  const [isCollapsedInformacoes, setIsCollapsedInformacoes] = useState(false);
  const [isCollapsedAtributos, setIsCollapsedAtributos] = useState(false);
  const [isCollapsedHabilidades, setIsCollapsedHabilidades] = useState(false);
  const [isCollapsedPericias, setIsCollapsedPericias] = useState(false);
  const [isCollapsedCombate, setIsCollapsedCombate] = useState(false);
  const [isCollapsedInventario, setIsCollapsedInventario] = useState(false);
  const [isCollapsedAnotacoes, setIsCollapsedAnotacoes] = useState(false);

  // NOVO: Estado para o colapso individual de itens (Habilidades, Perícias, Inventário)
  // Mapeia o ID do item para um booleano (true = colapsado, false = expandido)
  const [itemCollapsedStates, setItemCollapsedStates] = useState({});

  // Função para alternar o estado de colapso de um item individual
  const toggleItemCollapse = useCallback((itemId) => {
    setItemCollapsedStates(prevStates => ({
      ...prevStates,
      [itemId]: !prevStates[itemId]
    }));
  }, []);

  // Efeito para autenticação e carregamento inicial dos dados
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Tenta buscar o ID do mestre
        const masterDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'master');
        const masterDocSnap = await getDoc(masterDocRef);
        if (masterDocSnap.exists()) {
          const data = masterDocSnap.data();
          setMasterId(data.uid);
          setIsMaster(currentUser.uid === data.uid);
        } else {
          // Se não houver mestre, o primeiro usuário logado pode se tornar o mestre
          setMasterId(currentUser.uid);
          setIsMaster(true);
          await setDoc(masterDocRef, { uid: currentUser.uid });
        }
      } else {
        setUser(null);
        setCharacter(null);
        setMasterId('');
        setIsMaster(false);
      }
      setIsLoading(false);
    });

    // Tenta fazer login com o token inicial ou anonimamente
    const signIn = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Erro ao autenticar:", error);
        // Se a autenticação falhar, ainda definimos isLoading como false
        setIsLoading(false);
      }
    };

    signIn();

    return () => unsubscribeAuth();
  }, []);

  // Efeito para carregar e sincronizar a ficha do personagem
  useEffect(() => {
    if (!user || !db) {
      setCharacter(null);
      return;
    }

    const userId = user.uid;
    const characterDocRef = doc(db, 'artifacts', appId, 'users', userId, 'characterSheet', 'main');

    const unsubscribeSnapshot = onSnapshot(characterDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Desserializa habilidades, perícias e inventário se estiverem como string JSON
        const parsedData = {
          ...data,
          habilidades: data.habilidades ? JSON.parse(data.habilidades) : [],
          pericias: data.pericias ? JSON.parse(data.pericias) : [],
          inventario: data.inventario ? JSON.parse(data.inventario) : [],
          anotacoes: data.anotacoes || '', // Garante que anotações não seja undefined
        };
        setCharacter(parsedData);
      } else {
        // Se a ficha não existe, cria uma nova com valores padrão
        const newCharacter = {
          ownerUid: userId,
          nome: 'Novo Personagem',
          raca: '',
          classe: '',
          nivel: 1,
          antecedente: '',
          alinhamento: '',
          pontosVida: 10,
          pontosVidaMax: 10,
          pontosMana: 0,
          pontosManaMax: 0,
          forca: 10,
          destreza: 10,
          constituicao: 10,
          inteligencia: 10,
          sabedoria: 10,
          carisma: 10,
          habilidades: '[]', // Armazenado como string JSON
          pericias: '[]',   // Armazenado como string JSON
          inventario: '[]', // Armazenado como string JSON
          iniciativa: 0,
          defesa: 10,
          velocidade: 30,
          ataque: '',
          magias: '',
          anotacoes: '',
        };
        setDoc(characterDocRef, newCharacter)
          .then(() => {
            setCharacter({
              ...newCharacter,
              habilidades: [],
              pericias: [],
              inventario: [],
            });
          })
          .catch(error => console.error("Erro ao criar nova ficha:", error));
      }
    }, (error) => {
      console.error("Erro ao sincronizar ficha do personagem:", error);
    });

    return () => unsubscribeSnapshot();
  }, [user, db]);

  // Função para atualizar um campo da ficha
  const updateCharacterField = useCallback(async (field, value) => {
    if (!user || !character) return;

    const userId = user.uid;
    const characterDocRef = doc(db, 'artifacts', appId, 'users', userId, 'characterSheet', 'main');

    try {
      // Serializa habilidades, perícias e inventário de volta para string JSON antes de salvar
      const dataToUpdate = { [field]: value };
      if (field === 'habilidades') {
        dataToUpdate[field] = JSON.stringify(value);
      } else if (field === 'pericias') {
        dataToUpdate[field] = JSON.stringify(value);
      } else if (field === 'inventario') {
        dataToUpdate[field] = JSON.stringify(value);
      }

      await setDoc(characterDocRef, dataToUpdate, { merge: true });
    } catch (error) {
      console.error(`Erro ao atualizar campo ${field}:`, error);
    }
  }, [user, character, db]);

  // Funções de login e logout
  const handleLogin = async () => {
    setIsLoading(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      console.error("Erro ao fazer login com Google:", error);
      setModal({
        isVisible: true,
        message: `Erro ao fazer login: ${error.message}`,
        type: 'info',
        onConfirm: () => setModal({ ...modal, isVisible: false })
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await signOut(auth);
      setCharacter(null); // Limpa a ficha ao deslogar
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      setModal({
        isVisible: true,
        message: `Erro ao fazer logout: ${error.message}`,
        type: 'info',
        onConfirm: () => setModal({ ...modal, isVisible: false })
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Funções para adicionar e remover itens de listas (habilidades, perícias, inventário)
  const handleAddHabilidade = useCallback(() => {
    const newHabilidades = [...character.habilidades, { id: Date.now().toString(), nome: 'Nova Habilidade', descricao: '', valor: 0 }];
    updateCharacterField('habilidades', newHabilidades);
  }, [character, updateCharacterField]);

  const handleUpdateHabilidade = useCallback((id, field, value) => {
    const updatedHabilidades = character.habilidades.map(h =>
      h.id === id ? { ...h, [field]: value } : h
    );
    updateCharacterField('habilidades', updatedHabilidades);
  }, [character, updateCharacterField]);

  const handleRemoveHabilidade = useCallback((id) => {
    setModal({
      isVisible: true,
      message: 'Tem certeza que deseja remover esta habilidade?',
      type: 'confirm',
      onConfirm: () => {
        const filteredHabilidades = character.habilidades.filter(h => h.id !== id);
        updateCharacterField('habilidades', filteredHabilidades);
        setModal({ ...modal, isVisible: false });
      },
      onCancel: () => setModal({ ...modal, isVisible: false })
    });
  }, [character, updateCharacterField, modal]);

  const handleAddPericia = useCallback(() => {
    const newPericias = [...character.pericias, { id: Date.now().toString(), nome: 'Nova Perícia', descricao: '', valor: 0 }];
    updateCharacterField('pericias', newPericias);
  }, [character, updateCharacterField]);

  const handleUpdatePericia = useCallback((id, field, value) => {
    const updatedPericias = character.pericias.map(p =>
      p.id === id ? { ...p, [field]: value } : p
    );
    updateCharacterField('pericias', updatedPericias);
  }, [character, updateCharacterField]);

  const handleRemovePericia = useCallback((id) => {
    setModal({
      isVisible: true,
      message: 'Tem certeza que deseja remover esta perícia?',
      type: 'confirm',
      onConfirm: () => {
        const filteredPericias = character.pericias.filter(p => p.id !== id);
        updateCharacterField('pericias', filteredPericias);
        setModal({ ...modal, isVisible: false });
      },
      onCancel: () => setModal({ ...modal, isVisible: false })
    });
  }, [character, updateCharacterField, modal]);

  const handleAddInventarioItem = useCallback(() => {
    const newItem = { id: Date.now().toString(), nome: 'Novo Item', quantidade: 1, descricao: '' };
    const newInventario = [...character.inventario, newItem];
    updateCharacterField('inventario', newInventario);
  }, [character, updateCharacterField]);

  const handleUpdateInventarioItem = useCallback((id, field, value) => {
    const updatedInventario = character.inventario.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    );
    updateCharacterField('inventario', updatedInventario);
  }, [character, updateCharacterField]);

  const handleRemoveInventarioItem = useCallback((id) => {
    setModal({
      isVisible: true,
      message: 'Tem certeza que deseja remover este item do inventário?',
      type: 'confirm',
      onConfirm: () => {
        const filteredInventario = character.inventario.filter(item => item.id !== id);
        updateCharacterField('inventario', filteredInventario);
        setModal({ ...modal, isVisible: false });
      },
      onCancel: () => setModal({ ...modal, isVisible: false })
    });
  }, [character, updateCharacterField, modal]);

  // Função para importar ficha (JSON)
  const handleImportCharacter = useCallback(() => {
    setModal({
      isVisible: true,
      message: 'Cole o JSON da ficha aqui:',
      type: 'prompt',
      onConfirm: (jsonString) => {
        try {
          const importedCharacter = JSON.parse(jsonString);
          // Validação básica para garantir que é um objeto e tem ownerUid
          if (typeof importedCharacter === 'object' && importedCharacter !== null && importedCharacter.ownerUid) {
            // Garante que as listas são strings JSON para salvar no Firestore
            const characterToSave = {
              ...importedCharacter,
              habilidades: JSON.stringify(importedCharacter.habilidades || []),
              pericias: JSON.stringify(importedCharacter.pericias || []),
              inventario: JSON.stringify(importedCharacter.inventario || []),
              ownerUid: user.uid, // Garante que o novo dono seja o usuário logado
            };
            const characterDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'characterSheet', 'main');
            setDoc(characterDocRef, characterToSave)
              .then(() => {
                setModal({ isVisible: true, message: 'Ficha importada com sucesso!', type: 'info', onConfirm: () => setModal({ ...modal, isVisible: false }) });
              })
              .catch(error => {
                console.error("Erro ao salvar ficha importada:", error);
                setModal({ isVisible: true, message: `Erro ao importar ficha: ${error.message}`, type: 'info', onConfirm: () => setModal({ ...modal, isVisible: false }) });
              });
          } else {
            throw new Error("JSON inválido ou faltando 'ownerUid'.");
          }
        } catch (error) {
          console.error("Erro ao parsear JSON ou importar:", error);
          setModal({ isVisible: true, message: `Erro ao importar ficha: ${error.message}`, type: 'info', onConfirm: () => setModal({ ...modal, isVisible: false }) });
        }
      },
      onCancel: () => setModal({ ...modal, isVisible: false })
    });
  }, [user, db, modal]);

  // Função para exportar ficha (JSON)
  const handleExportCharacter = useCallback(() => {
    if (!character) {
      setModal({ isVisible: true, message: 'Nenhuma ficha para exportar.', type: 'info', onConfirm: () => setModal({ ...modal, isVisible: false }) });
      return;
    }
    // Cria uma cópia da ficha e garante que as listas são arrays para exportação
    const characterToExport = {
      ...character,
      habilidades: character.habilidades,
      pericias: character.pericias,
      inventario: character.inventario,
    };
    const jsonString = JSON.stringify(characterToExport, null, 2);
    // Copia para a área de transferência
    navigator.clipboard.writeText(jsonString)
      .then(() => {
        setModal({ isVisible: true, message: 'Ficha copiada para a área de transferência!', type: 'info', onConfirm: () => setModal({ ...modal, isVisible: false }) });
      })
      .catch(err => {
        console.error('Erro ao copiar para a área de transferência:', err);
        // Fallback para navegadores sem suporte a navigator.clipboard.writeText
        const textArea = document.createElement('textarea');
        textArea.value = jsonString;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
          setModal({ isVisible: true, message: 'Ficha copiada para a área de transferência!', type: 'info', onConfirm: () => setModal({ ...modal, isVisible: false }) });
        } catch (copyErr) {
          console.error('Erro ao copiar via execCommand:', copyErr);
          setModal({ isVisible: true, message: 'Não foi possível copiar automaticamente. Copie o texto abaixo manualmente:\n\n' + jsonString, type: 'info', onConfirm: () => setModal({ ...modal, isVisible: false }) });
        }
        document.body.removeChild(textArea);
      });
  }, [character, modal]);

  // Função para resetar a ficha
  const handleReset = useCallback(() => {
    setModal({
      isVisible: true,
      message: 'Tem certeza que deseja resetar a ficha? Todos os dados serão perdidos.',
      type: 'confirm',
      onConfirm: async () => {
        if (!user) return;
        setIsLoading(true);
        const userId = user.uid;
        const characterDocRef = doc(db, 'artifacts', appId, 'users', userId, 'characterSheet', 'main');
        try {
          await deleteDoc(characterDocRef);
          // O onSnapshot acima irá recriar a ficha com valores padrão
          setModal({ isVisible: true, message: 'Ficha resetada com sucesso!', type: 'info', onConfirm: () => setModal({ ...modal, isVisible: false }) });
        } catch (error) {
          console.error("Erro ao resetar ficha:", error);
          setModal({ isVisible: true, message: `Erro ao resetar ficha: ${error.message}`, type: 'info', onConfirm: () => setModal({ ...modal, isVisible: false }) });
        } finally {
          setIsLoading(false);
          setModal({ ...modal, isVisible: false }); // Fecha o modal de confirmação
        }
      },
      onCancel: () => setModal({ ...modal, isVisible: false })
    });
  }, [user, db, modal]);

  // Função para transferir a propriedade da ficha
  const handleTransferOwnership = useCallback(() => {
    setModal({
      isVisible: true,
      message: 'Digite o UID do usuário para quem você deseja transferir a ficha:',
      type: 'prompt',
      onConfirm: async (targetUid) => {
        if (!user || !character || !isMaster) {
          setModal({ isVisible: true, message: 'Operação não permitida.', type: 'info', onConfirm: () => setModal({ ...modal, isVisible: false }) });
          return;
        }

        if (!targetUid || typeof targetUid !== 'string' || targetUid.trim() === '') {
          setModal({ isVisible: true, message: 'UID inválido.', type: 'info', onConfirm: () => setModal({ ...modal, isVisible: false }) });
          return;
        }

        setIsLoading(true);
        try {
          // 1. Obter a ficha atual do proprietário
          const currentOwnerDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'characterSheet', 'main');
          const currentCharacterSnap = await getDoc(currentOwnerDocRef);

          if (!currentCharacterSnap.exists()) {
            setModal({ isVisible: true, message: 'Ficha atual não encontrada.', type: 'info', onConfirm: () => setModal({ ...modal, isVisible: false }) });
            setIsLoading(false);
            return;
          }

          const currentCharacterData = currentCharacterSnap.data();

          // 2. Criar uma cópia da ficha para o novo proprietário
          const newOwnerDocRef = doc(db, 'artifacts', appId, 'users', targetUid, 'characterSheet', 'main');
          await setDoc(newOwnerDocRef, { ...currentCharacterData, ownerUid: targetUid });

          // 3. (Opcional) Deletar a ficha do proprietário antigo, se desejado
          // await deleteDoc(currentOwnerDocRef); // Descomente se quiser que a ficha seja movida, não copiada

          setModal({ isVisible: true, message: `Ficha transferida para o UID: ${targetUid}`, type: 'info', onConfirm: () => setModal({ ...modal, isVisible: false }) });
        } catch (error) {
          console.error("Erro ao transferir propriedade:", error);
          setModal({ isVisible: true, message: `Erro ao transferir propriedade: ${error.message}`, type: 'info', onConfirm: () => setModal({ ...modal, isVisible: false }) });
        } finally {
          setIsLoading(false);
        }
      },
      onCancel: () => setModal({ ...modal, isVisible: false })
    });
  }, [user, character, isMaster, db, modal]);

  // Função para gerenciar fichas de outros usuários (apenas para o mestre)
  const handleManageOtherCharacters = useCallback(() => {
    if (!isMaster) {
      setModal({ isVisible: true, message: 'Apenas mestres podem gerenciar outras fichas.', type: 'info', onConfirm: () => setModal({ ...modal, isVisible: false }) });
      return;
    }

    setModal({
      isVisible: true,
      message: 'Digite o UID do jogador cuja ficha você deseja gerenciar:',
      type: 'prompt',
      onConfirm: async (targetUid) => {
        if (!targetUid || typeof targetUid !== 'string' || targetUid.trim() === '') {
          setModal({ isVisible: true, message: 'UID inválido.', type: 'info', onConfirm: () => setModal({ ...modal, isVisible: false }) });
          return;
        }

        setIsLoading(true);
        try {
          const targetCharacterDocRef = doc(db, 'artifacts', appId, 'users', targetUid, 'characterSheet', 'main');
          const targetCharacterSnap = await getDoc(targetCharacterDocRef);

          if (targetCharacterSnap.exists()) {
            const targetCharacterData = targetCharacterSnap.data();
            // Desserializa para uso no estado local
            const parsedData = {
              ...targetCharacterData,
              habilidades: targetCharacterData.habilidades ? JSON.parse(targetCharacterData.habilidades) : [],
              pericias: targetCharacterData.pericias ? JSON.parse(targetCharacterData.pericias) : [],
              inventario: targetCharacterData.inventario ? JSON.parse(targetCharacterData.inventario) : [],
            };
            setCharacter(parsedData); // Carrega a ficha do outro jogador
            setModal({ isVisible: true, message: `Ficha do UID ${targetUid} carregada.`, type: 'info', onConfirm: () => setModal({ ...modal, isVisible: false }) });
          } else {
            setModal({ isVisible: true, message: 'Ficha não encontrada para o UID fornecido.', type: 'info', onConfirm: () => setModal({ ...modal, isVisible: false }) });
          }
        } catch (error) {
          console.error("Erro ao carregar ficha de outro jogador:", error);
          setModal({ isVisible: true, message: `Erro ao carregar ficha: ${error.message}`, type: 'info', onConfirm: () => setModal({ ...modal, isVisible: false }) });
        } finally {
          setIsLoading(false);
        }
      },
      onCancel: () => setModal({ ...modal, isVisible: false })
    });
  }, [isMaster, db, modal]);

  // Função para salvar anotações
  const handleSaveAnotacoes = useCallback((e) => {
    updateCharacterField('anotacoes', e.target.value);
  }, [updateCharacterField]);

  // Componente de input genérico com Tailwind CSS
  const InputField = ({ label, type = 'text', value, onChange, disabled = false, className = '' }) => (
    <div className={`mb-4 ${className}`}>
      <label className="block text-gray-400 text-sm font-bold mb-2">{label}</label>
      <input
        type={type}
        className="shadow appearance-none border border-gray-600 rounded-lg w-full py-2 px-3 bg-gray-700 text-white leading-tight focus:outline-none focus:shadow-outline focus:border-purple-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );

  // Componente de Textarea genérico com Tailwind CSS
  const TextAreaField = ({ label, value, onChange, disabled = false, className = '' }) => (
    <div className={`mb-4 ${className}`}>
      <label className="block text-gray-400 text-sm font-bold mb-2">{label}</label>
      <textarea
        className="shadow appearance-none border border-gray-600 rounded-lg w-full py-2 px-3 bg-gray-700 text-white leading-tight focus:outline-none focus:shadow-outline focus:border-purple-500 h-32 resize-y"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-xl">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white font-inter p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto bg-gray-800 rounded-xl shadow-2xl p-6 sm:p-8 border border-gray-700">
        {/* Cabeçalho e Autenticação */}
        <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-700">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-purple-400">Ficha de Personagem RPG</h1>
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <span className="text-gray-300 text-sm hidden sm:block">Olá, {user.displayName || user.email || 'Aventureiro'}!</span>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                >
                  Sair
                </button>
              </>
            ) : (
              <button
                onClick={handleLogin}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75"
              >
                Entrar com Google
              </button>
            )}
          </div>
        </div>

        {/* Exibe o UID do usuário logado e o UID do mestre */}
        {user && (
          <div className="mb-6 bg-gray-700 p-4 rounded-lg shadow-inner">
            <p className="text-gray-300 text-sm break-all">Seu UID: <span className="font-mono text-purple-300">{user.uid}</span></p>
            <p className="text-gray-300 text-sm break-all">UID do Mestre: <span className="font-mono text-green-300">{masterId || 'Nenhum definido'}</span></p>
            {isMaster && <p className="text-green-400 font-semibold mt-2">Você é o Mestre!</p>}
            {character && <p className="text-gray-300 text-sm break-all">Dono da ficha atual: <span className="font-mono text-blue-300">{character.ownerUid}</span></p>}
          </div>
        )}

        {/* Formulário da Ficha de Personagem */}
        {user && character && (
          <>
            {/* Seção de Informações Básicas */}
            <div className="bg-gray-700 p-6 rounded-xl shadow-lg mb-6 border border-gray-600">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-purple-300">Informações Básicas</h2>
                <button
                  onClick={() => setIsCollapsedInformacoes(!isCollapsedInformacoes)}
                  className="text-gray-400 hover:text-white transition duration-200"
                  aria-label={isCollapsedInformacoes ? "Expandir informações" : "Colapsar informações"}
                >
                  {isCollapsedInformacoes ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path></svg>
                  )}
                </button>
              </div>
              {!isCollapsedInformacoes && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField label="Nome" value={character.nome} onChange={(val) => updateCharacterField('nome', val)} disabled={user.uid !== character.ownerUid && !isMaster} />
                  <InputField label="Raça" value={character.raca} onChange={(val) => updateCharacterField('raca', val)} disabled={user.uid !== character.ownerUid && !isMaster} />
                  <InputField label="Classe" value={character.classe} onChange={(val) => updateCharacterField('classe', val)} disabled={user.uid !== character.ownerUid && !isMaster} />
                  <InputField label="Nível" type="number" value={character.nivel} onChange={(val) => updateCharacterField('nivel', parseInt(val) || 0)} disabled={user.uid !== character.ownerUid && !isMaster} />
                  <InputField label="Antecedente" value={character.antecedente} onChange={(val) => updateCharacterField('antecedente', val)} disabled={user.uid !== character.ownerUid && !isMaster} />
                  <InputField label="Alinhamento" value={character.alinhamento} onChange={(val) => updateCharacterField('alinhamento', val)} disabled={user.uid !== character.ownerUid && !isMaster} />
                </div>
              )}
            </div>

            {/* Seção de Atributos */}
            <div className="bg-gray-700 p-6 rounded-xl shadow-lg mb-6 border border-gray-600">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-purple-300">Atributos</h2>
                <button
                  onClick={() => setIsCollapsedAtributos(!isCollapsedAtributos)}
                  className="text-gray-400 hover:text-white transition duration-200"
                  aria-label={isCollapsedAtributos ? "Expandir atributos" : "Colapsar atributos"}
                >
                  {isCollapsedAtributos ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path></svg>
                  )}
                </button>
              </div>
              {!isCollapsedAtributos && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  <InputField label="Força" type="number" value={character.forca} onChange={(val) => updateCharacterField('forca', parseInt(val) || 0)} disabled={user.uid !== character.ownerUid && !isMaster} />
                  <InputField label="Destreza" type="number" value={character.destreza} onChange={(val) => updateCharacterField('destreza', parseInt(val) || 0)} disabled={user.uid !== character.ownerUid && !isMaster} />
                  <InputField label="Constituição" type="number" value={character.constituicao} onChange={(val) => updateCharacterField('constituicao', parseInt(val) || 0)} disabled={user.uid !== character.ownerUid && !isMaster} />
                  <InputField label="Inteligência" type="number" value={character.inteligencia} onChange={(val) => updateCharacterField('inteligencia', parseInt(val) || 0)} disabled={user.uid !== character.ownerUid && !isMaster} />
                  <InputField label="Sabedoria" type="number" value={character.sabedoria} onChange={(val) => updateCharacterField('sabedoria', parseInt(val) || 0)} disabled={user.uid !== character.ownerUid && !isMaster} />
                  <InputField label="Carisma" type="number" value={character.carisma} onChange={(val) => updateCharacterField('carisma', parseInt(val) || 0)} disabled={user.uid !== character.ownerUid && !isMaster} />
                </div>
              )}
            </div>

            {/* Seção de Habilidades */}
            <div className="bg-gray-700 p-6 rounded-xl shadow-lg mb-6 border border-gray-600">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-purple-300">Habilidades</h2>
                <button
                  onClick={() => setIsCollapsedHabilidades(!isCollapsedHabilidades)}
                  className="text-gray-400 hover:text-white transition duration-200"
                  aria-label={isCollapsedHabilidades ? "Expandir habilidades" : "Colapsar habilidades"}
                >
                  {isCollapsedHabilidades ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path></svg>
                  )}
                </button>
              </div>
              {!isCollapsedHabilidades && (
                <>
                  {character.habilidades.map((habilidade, index) => (
                    // Adicionado um ID único para o item, fallback para index se id não existir (menos ideal)
                    <div key={habilidade.id || index} className="bg-gray-600 p-4 rounded-lg shadow-md mb-2 border border-gray-500">
                      <div className="flex justify-between items-center mb-2">
                        <InputField
                          label="Nome da Habilidade"
                          value={habilidade.nome}
                          onChange={(val) => handleUpdateHabilidade(habilidade.id, 'nome', val)}
                          disabled={user.uid !== character.ownerUid && !isMaster}
                          className="flex-grow mr-2"
                        />
                        <div className="flex items-center space-x-2">
                          {/* NOVO: Botão de colapso individual do item */}
                          <button
                            onClick={() => toggleItemCollapse(habilidade.id)}
                            className="text-gray-300 hover:text-white transition duration-200 p-1 rounded-full hover:bg-gray-500"
                            aria-label={itemCollapsedStates[habilidade.id] ? "Expandir habilidade" : "Colapsar habilidade"}
                          >
                            {itemCollapsedStates[habilidade.id] ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path></svg>
                            )}
                          </button>
                          <button
                            onClick={() => handleRemoveHabilidade(habilidade.id)}
                            className="text-red-400 hover:text-red-600 transition duration-200 p-1 rounded-full hover:bg-gray-500"
                            disabled={user.uid !== character.ownerUid && !isMaster}
                            aria-label="Remover habilidade"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                        </div>
                      </div>
                      {/* Conteúdo da habilidade colapsável individualmente */}
                      {!itemCollapsedStates[habilidade.id] && (
                        <>
                          <TextAreaField
                            label="Descrição"
                            value={habilidade.descricao}
                            onChange={(val) => handleUpdateHabilidade(habilidade.id, 'descricao', val)}
                            disabled={user.uid !== character.ownerUid && !isMaster}
                          />
                          <InputField
                            label="Valor"
                            type="number"
                            value={habilidade.valor}
                            onChange={(val) => handleUpdateHabilidade(habilidade.id, 'valor', parseInt(val) || 0)}
                            disabled={user.uid !== character.ownerUid && !isMaster}
                          />
                        </>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={handleAddHabilidade}
                    className="mt-4 px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                    disabled={user.uid !== character.ownerUid && !isMaster}
                  >
                    Adicionar Habilidade
                  </button>
                </>
              )}
            </div>

            {/* Seção de Perícias */}
            <div className="bg-gray-700 p-6 rounded-xl shadow-lg mb-6 border border-gray-600">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-purple-300">Perícias</h2>
                <button
                  onClick={() => setIsCollapsedPericias(!isCollapsedPericias)}
                  className="text-gray-400 hover:text-white transition duration-200"
                  aria-label={isCollapsedPericias ? "Expandir perícias" : "Colapsar perícias"}
                >
                  {isCollapsedPericias ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path></svg>
                  )}
                </button>
              </div>
              {!isCollapsedPericias && (
                <>
                  {character.pericias.map((pericia, index) => (
                    // Adicionado um ID único para o item, fallback para index se id não existir (menos ideal)
                    <div key={pericia.id || index} className="bg-gray-600 p-4 rounded-lg shadow-md mb-2 border border-gray-500">
                      <div className="flex justify-between items-center mb-2">
                        <InputField
                          label="Nome da Perícia"
                          value={pericia.nome}
                          onChange={(val) => handleUpdatePericia(pericia.id, 'nome', val)}
                          disabled={user.uid !== character.ownerUid && !isMaster}
                          className="flex-grow mr-2"
                        />
                        <div className="flex items-center space-x-2">
                          {/* NOVO: Botão de colapso individual do item */}
                          <button
                            onClick={() => toggleItemCollapse(pericia.id)}
                            className="text-gray-300 hover:text-white transition duration-200 p-1 rounded-full hover:bg-gray-500"
                            aria-label={itemCollapsedStates[pericia.id] ? "Expandir perícia" : "Colapsar perícia"}
                          >
                            {itemCollapsedStates[pericia.id] ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path></svg>
                            )}
                          </button>
                          <button
                            onClick={() => handleRemovePericia(pericia.id)}
                            className="text-red-400 hover:text-red-600 transition duration-200 p-1 rounded-full hover:bg-gray-500"
                            disabled={user.uid !== character.ownerUid && !isMaster}
                            aria-label="Remover perícia"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                        </div>
                      </div>
                      {/* Conteúdo da perícia colapsável individualmente */}
                      {!itemCollapsedStates[pericia.id] && (
                        <>
                          <TextAreaField
                            label="Descrição"
                            value={pericia.descricao}
                            onChange={(val) => handleUpdatePericia(pericia.id, 'descricao', val)}
                            disabled={user.uid !== character.ownerUid && !isMaster}
                          />
                          <InputField
                            label="Valor"
                            type="number"
                            value={pericia.valor}
                            onChange={(val) => handleUpdatePericia(pericia.id, 'valor', parseInt(val) || 0)}
                            disabled={user.uid !== character.ownerUid && !isMaster}
                          />
                        </>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={handleAddPericia}
                    className="mt-4 px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                    disabled={user.uid !== character.ownerUid && !isMaster}
                  >
                    Adicionar Perícia
                  </button>
                </>
              )}
            </div>

            {/* Seção de Combate */}
            <div className="bg-gray-700 p-6 rounded-xl shadow-lg mb-6 border border-gray-600">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-purple-300">Combate</h2>
                <button
                  onClick={() => setIsCollapsedCombate(!isCollapsedCombate)}
                  className="text-gray-400 hover:text-white transition duration-200"
                  aria-label={isCollapsedCombate ? "Expandir combate" : "Colapsar combate"}
                >
                  {isCollapsedCombate ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path></svg>
                  )}
                </button>
              </div>
              {!isCollapsedCombate && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField label="Pontos de Vida" type="number" value={character.pontosVida} onChange={(val) => updateCharacterField('pontosVida', parseInt(val) || 0)} disabled={user.uid !== character.ownerUid && !isMaster} />
                  <InputField label="PV Máx" type="number" value={character.pontosVidaMax} onChange={(val) => updateCharacterField('pontosVidaMax', parseInt(val) || 0)} disabled={user.uid !== character.ownerUid && !isMaster} />
                  <InputField label="Pontos de Mana" type="number" value={character.pontosMana} onChange={(val) => updateCharacterField('pontosMana', parseInt(val) || 0)} disabled={user.uid !== character.ownerUid && !isMaster} />
                  <InputField label="Mana Máx" type="number" value={character.pontosManaMax} onChange={(val) => updateCharacterField('pontosManaMax', parseInt(val) || 0)} disabled={user.uid !== character.ownerUid && !isMaster} />
                  <InputField label="Iniciativa" type="number" value={character.iniciativa} onChange={(val) => updateCharacterField('iniciativa', parseInt(val) || 0)} disabled={user.uid !== character.ownerUid && !isMaster} />
                  <InputField label="Defesa" type="number" value={character.defesa} onChange={(val) => updateCharacterField('defesa', parseInt(val) || 0)} disabled={user.uid !== character.ownerUid && !isMaster} />
                  <InputField label="Velocidade" type="number" value={character.velocidade} onChange={(val) => updateCharacterField('velocidade', parseInt(val) || 0)} disabled={user.uid !== character.ownerUid && !isMaster} />
                  <TextAreaField label="Ataque" value={character.ataque} onChange={(val) => updateCharacterField('ataque', val)} disabled={user.uid !== character.ownerUid && !isMaster} />
                  <TextAreaField label="Magias" value={character.magias} onChange={(val) => updateCharacterField('magias', val)} disabled={user.uid !== character.ownerUid && !isMaster} />
                </div>
              )}
            </div>

            {/* Seção de Inventário */}
            <div className="bg-gray-700 p-6 rounded-xl shadow-lg mb-6 border border-gray-600">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-purple-300">Inventário</h2>
                <button
                  onClick={() => setIsCollapsedInventario(!isCollapsedInventario)}
                  className="text-gray-400 hover:text-white transition duration-200"
                  aria-label={isCollapsedInventario ? "Expandir inventário" : "Colapsar inventário"}
                >
                  {isCollapsedInventario ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path></svg>
                  )}
                </button>
              </div>
              {!isCollapsedInventario && (
                <>
                  {character.inventario.map((item, index) => (
                    // Adicionado um ID único para o item, fallback para index se id não existir (menos ideal)
                    <div key={item.id || index} className="bg-gray-600 p-4 rounded-lg shadow-md mb-2 border border-gray-500">
                      <div className="flex justify-between items-center mb-2">
                        <InputField
                          label="Nome do Item"
                          value={item.nome}
                          onChange={(val) => handleUpdateInventarioItem(item.id, 'nome', val)}
                          disabled={user.uid !== character.ownerUid && !isMaster}
                          className="flex-grow mr-2"
                        />
                        <div className="flex items-center space-x-2">
                          {/* NOVO: Botão de colapso individual do item */}
                          <button
                            onClick={() => toggleItemCollapse(item.id)}
                            className="text-gray-300 hover:text-white transition duration-200 p-1 rounded-full hover:bg-gray-500"
                            aria-label={itemCollapsedStates[item.id] ? "Expandir item" : "Colapsar item"}
                          >
                            {itemCollapsedStates[item.id] ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path></svg>
                            )}
                          </button>
                          <button
                            onClick={() => handleRemoveInventarioItem(item.id)}
                            className="text-red-400 hover:text-red-600 transition duration-200 p-1 rounded-full hover:bg-gray-500"
                            disabled={user.uid !== character.ownerUid && !isMaster}
                            aria-label="Remover item"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                        </div>
                      </div>
                      {/* Conteúdo do item de inventário colapsável individualmente */}
                      {!itemCollapsedStates[item.id] && (
                        <>
                          <InputField
                            label="Quantidade"
                            type="number"
                            value={item.quantidade}
                            onChange={(val) => handleUpdateInventarioItem(item.id, 'quantidade', parseInt(val) || 0)}
                            disabled={user.uid !== character.ownerUid && !isMaster}
                          />
                          <TextAreaField
                            label="Descrição"
                            value={item.descricao}
                            onChange={(val) => handleUpdateInventarioItem(item.id, 'descricao', val)}
                            disabled={user.uid !== character.ownerUid && !isMaster}
                          />
                        </>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={handleAddInventarioItem}
                    className="mt-4 px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                    disabled={user.uid !== character.ownerUid && !isMaster}
                  >
                    Adicionar Item ao Inventário
                  </button>
                </>
              )}
            </div>

            {/* Seção de Anotações */}
            <div className="bg-gray-700 p-6 rounded-xl shadow-lg mb-6 border border-gray-600">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-purple-300">Anotações</h2>
                <button
                  onClick={() => setIsCollapsedAnotacoes(!isCollapsedAnotacoes)}
                  className="text-gray-400 hover:text-white transition duration-200"
                  aria-label={isCollapsedAnotacoes ? "Expandir anotações" : "Colapsar anotações"}
                >
                  {isCollapsedAnotacoes ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path></svg>
                  )}
                </button>
              </div>
              {!isCollapsedAnotacoes && (
                <TextAreaField
                  label="Suas Anotações"
                  value={character.anotacoes}
                  onChange={handleSaveAnotacoes}
                  disabled={user.uid !== character.ownerUid && !isMaster}
                />
              )}
            </div>

            {/* Botões de Ação */}
            <div className="flex flex-wrap justify-center gap-4 mt-8">
              {isMaster && (
                <button
                  onClick={handleManageOtherCharacters}
                  className="px-8 py-3 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-lg shadow-lg transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                  disabled={isLoading}
                >
                  Gerenciar Outras Fichas
                </button>
              )}
              {isMaster && (user.uid === character.ownerUid) && ( // Apenas o mestre que é o dono pode transferir
                <button
                  onClick={handleTransferOwnership}
                  className="px-8 py-3 bg-yellow-700 hover:bg-yellow-800 text-white font-bold rounded-lg shadow-lg transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-opacity-75"
                  disabled={isLoading}
                >
                  Transferir Propriedade
                </button>
              )}
              <button
                onClick={handleExportCharacter}
                className="px-8 py-3 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-lg shadow-lg transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75"
                disabled={isLoading || !user}
              >
                Exportar Ficha (JSON)
              </button>
              <button
                onClick={handleImportCharacter}
                className="px-8 py-3 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-lg shadow-lg transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75"
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
          <div className="text-white text-xl">Carregando...</div>
        </div>
      )}
    </div>
  );
};

export default App;

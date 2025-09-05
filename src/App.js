import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, getDocs, getDoc, deleteDoc } from 'firebase/firestore';

// ============================================================================
// --- Componentes Auxiliares ---
// ============================================================================

// Modal para Curar/Causar Dano
const ActionModal = ({ title, onConfirm, onClose }) => {
    const [amount, setAmount] = useState('');
    const [target, setTarget] = useState('HP');

    const handleConfirm = () => {
        const numericAmount = parseInt(amount, 10);
        if (!isNaN(numericAmount) && numericAmount > 0) {
            onConfirm(numericAmount, target);
            onClose();
        } else {
            // Em vez de alert, podemos mostrar um erro no modal no futuro
            console.error('Valor inválido inserido.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm border border-gray-700">
                <h3 className="text-xl text-yellow-300 font-bold mb-4 text-center">{title}</h3>
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full p-2 mb-4 bg-gray-700 border border-gray-600 rounded-md text-white text-center text-lg focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Valor"
                    autoFocus
                />
                <div className="flex justify-center gap-4 mb-6">
                    <label className="flex items-center gap-2 text-white">
                        <input type="radio" name="target" value="HP" checked={target === 'HP'} onChange={(e) => setTarget(e.target.value)} className="form-radio text-purple-500" />
                        HP
                    </label>
                    <label className="flex items-center gap-2 text-white">
                        <input type="radio" name="target" value="HP Temporário" checked={target === 'HP Temporário'} onChange={(e) => setTarget(e.target.value)} className="form-radio text-purple-500" />
                        HP Temp
                    </label>
                    <label className="flex items-center gap-2 text-white">
                        <input type="radio" name="target" value="MP" checked={target === 'MP'} onChange={(e) => setTarget(e.target.value)} className="form-radio text-purple-500" />
                        MP
                    </label>
                </div>
                <div className="flex justify-around gap-4">
                    <button onClick={handleConfirm} className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md">Confirmar</button>
                    <button onClick={onClose} className="px-5 py-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg shadow-md">Cancelar</button>
                </div>
            </div>
        </div>
    );
};

// Modal para Rolagem de Atributo
const RollAttributeModal = ({ attributeName, onConfirm, onClose }) => {
    const [dice, setDice] = useState('1d20');
    const [bonus, setBonus] = useState('');

    const handleConfirm = () => {
        onConfirm(dice, parseInt(bonus, 10) || 0);
        onClose();
    };
    
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleConfirm();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm border border-gray-700">
                <h3 className="text-xl text-yellow-300 font-bold mb-4 text-center">Rolar {attributeName}</h3>
                <div className="mb-4">
                    <label htmlFor="dice-input" className="block text-sm font-medium text-gray-300 mb-1">Dado:</label>
                    <input
                        id="dice-input"
                        type="text"
                        value={dice}
                        onChange={(e) => setDice(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white text-center text-lg focus:ring-purple-500 focus:border-purple-500"
                        placeholder="Ex: 1d20, 2d6"
                        autoFocus
                    />
                </div>
                <div className="mb-6">
                    <label htmlFor="bonus-input" className="block text-sm font-medium text-gray-300 mb-1">Bônus Adicional:</label>
                    <input
                        id="bonus-input"
                        type="number"
                        value={bonus}
                        onChange={(e) => setBonus(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white text-center text-lg focus:ring-purple-500 focus:border-purple-500"
                        placeholder="0"
                    />
                </div>
                <div className="flex justify-around gap-4">
                    <button onClick={handleConfirm} className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md">Confirmar</button>
                    <button onClick={onClose} className="px-5 py-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg shadow-md">Cancelar</button>
                </div>
            </div>
        </div>
    );
};


// Componente Modal para prompts e confirmações personalizadas
const CustomModal = ({ message, onConfirm, onCancel, type, onClose, showCopyButton, copyText }) => {
  const [inputValue, setInputValue] = useState('');
  const [copySuccess, setCopySuccess] = useState('');

  useEffect(() => {
    if (type === 'prompt') {
      const inputElement = document.getElementById('prompt-input');
      if (inputElement) {
        inputElement.focus();
      }
    }
  }, [type]);

  const handleConfirm = () => {
    if (type === 'prompt') {
      onConfirm(inputValue);
    } else {
      if (onConfirm) onConfirm();
      if (onClose) onClose();
    }
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    if (onClose) onClose();
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && type === 'prompt') {
        handleConfirm();
    }
  };

  const handleCopy = () => {
    const textArea = document.createElement("textarea");
    textArea.value = copyText;
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        setCopySuccess('Copiado!');
        setTimeout(() => setCopySuccess(''), 2000);
    } catch (err) {
        setCopySuccess('Falhou em copiar.');
    }
    document.body.removeChild(textArea);
  };

  const confirmButtonText = useMemo(() => {
    switch (type) {
      case 'confirm': return 'Confirmar';
      case 'prompt': return 'Confirmar';
      case 'info': default: return 'OK';
    }
  }, [type]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md border border-gray-700">
        <div className="text-lg text-gray-100 mb-4 text-center whitespace-pre-wrap">{message}</div>
        {showCopyButton && (
            <div className="my-4 p-2 bg-gray-900 rounded-md text-center">
                <p className="text-gray-400 text-sm mb-1">Comando para Discord/Roll20:</p>
                <code className="text-purple-300 break-words">{copyText}</code>
                <button onClick={handleCopy} className="ml-4 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-md">{copySuccess || 'Copiar'}</button>
            </div>
        )}
        {type === 'prompt' && (
          <input
            id="prompt-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full p-2 mb-4 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
            placeholder="Digite aqui..."
          />
        )}
        <div className="flex justify-around gap-4">
          <button
            onClick={handleConfirm}
            className={`px-5 py-2 rounded-lg font-bold shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-opacity-75 ${type === 'confirm' ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'} text-white`}
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

// ============================================================================
// --- Componentes Visuais (UI) ---
// ============================================================================

const FloatingNavMenu = () => (
  <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-40">
    <a href="#info" title="Voltar ao Topo" className="bg-gray-700 hover:bg-gray-600 text-white font-bold w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-lg transition-transform transform hover:scale-110 border-2 border-gray-500">
      ⬆️
    </a>
    <a href="#actions" title="Ações Rápidas" className="bg-gray-700 hover:bg-gray-600 text-white font-bold w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-lg transition-transform transform hover:scale-110 border-2 border-gray-500">
      ⚔️
    </a>
    <a href="#perks" title="Vantagens" className="bg-gray-700 hover:bg-gray-600 text-white font-bold w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-lg transition-transform transform hover:scale-110 border-2 border-gray-500">
      🌟
    </a>
    <a href="#skills" title="Habilidades" className="bg-gray-700 hover:bg-gray-600 text-white font-bold w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-lg transition-transform transform hover:scale-110 border-2 border-gray-500">
      ✨
    </a>
    <a href="#story" title="História" className="bg-gray-700 hover:bg-gray-600 text-white font-bold w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-lg transition-transform transform hover:scale-110 border-2 border-gray-500">
      📜
    </a>
    <a href="#notes" title="Anotações" className="bg-gray-700 hover:bg-gray-600 text-white font-bold w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-lg transition-transform transform hover:scale-110 border-2 border-gray-500">
      📝
    </a>
    <a href="#discord" title="Integração Discord" className="bg-gray-700 hover:bg-gray-600 text-white font-bold w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-lg transition-transform transform hover:scale-110 border-2 border-gray-500">
      💬
    </a>
  </div>
);

const UserStatusSection = ({ isAuthReady, user, isMaster, isLoading, handleSignOut, handleGoogleSignIn, toggleSection, isCollapsed }) => (
  <section className="mb-8 p-4 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
    <h2 className="text-xl font-bold text-yellow-300 mb-2 cursor-pointer flex justify-between items-center" onClick={() => toggleSection('isUserStatusCollapsed')}>
      Status do Usuário
      <span>{isCollapsed ? '▼' : '▲'}</span>
    </h2>
    {!isCollapsed && (
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
              <button onClick={handleSignOut} className="mt-4 px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75" disabled={isLoading}>
                Sair
              </button>
            </>
          ) : (
            <>
              <p className="text-lg text-gray-400 mb-4">Você não está logado.</p>
              <button onClick={handleGoogleSignIn} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75" disabled={isLoading}>
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
);

const CharacterList = ({ charactersList, isLoading, isMaster, viewingAllCharacters, user, handleCreateNewCharacter, handleImportJsonClick, setViewingAllCharacters, handleSelectCharacter, handleDeleteCharacter }) => (
  <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
    <h2 className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2">
      {viewingAllCharacters ? 'Todas as Fichas de Personagem' : 'Meus Personagens'}
    </h2>
    <div className="flex flex-wrap gap-4 mb-4">
      <button onClick={handleCreateNewCharacter} className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75" disabled={isLoading}>
        Criar Novo Personagem
      </button>
      <button onClick={handleImportJsonClick} className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75" disabled={isLoading}>
        Importar Ficha (JSON)
      </button>
      {isMaster && (
        <button onClick={() => setViewingAllCharacters(!viewingAllCharacters)} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75" disabled={isLoading}>
          {viewingAllCharacters ? 'Ver Minhas Fichas' : 'Ver Todas as Fichas'}
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
              {isMaster && char.ownerUid && <p className="text-xs text-gray-400 mt-2 break-all">Proprietário: {char.ownerUid}</p>}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => handleSelectCharacter(char.id, char.ownerUid)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75">
                Ver/Editar
              </button>
              {(user.uid === char.ownerUid || isMaster) && (
                <button onClick={() => handleDeleteCharacter(char.id, char.name, char.ownerUid)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75">
                  Excluir
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    )}
  </section>
);

const CharacterInfoSection = ({ character, user, isMaster, handleChange, handlePhotoUrlClick, toggleSection }) => (
    <section id="info" className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
        <h2 className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center" onClick={() => toggleSection('isCharacterInfoCollapsed')}>
            Informações do Personagem
            <span>{character.isCharacterInfoCollapsed ? '▼' : '▲'}</span>
        </h2>
        {!character.isCharacterInfoCollapsed && (
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-6">
                <div className="flex-shrink-0 relative">
                    {character.photoUrl ? (
                        <img src={character.photoUrl} alt="Foto do Personagem" className="w-[224px] h-[224px] object-cover rounded-full border-2 border-purple-500 cursor-pointer" onClick={handlePhotoUrlClick} onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/224x224/000000/FFFFFF?text=Foto'; }} />
                    ) : (
                        <div className="w-[224px] h-[224px] bg-gray-600 rounded-full border-2 border-purple-500 flex items-center justify-center text-6xl text-gray-400 cursor-pointer" onClick={handlePhotoUrlClick}>+</div>
                    )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 flex-grow w-full">
                    {['name', 'age', 'height', 'gender', 'race', 'class', 'alignment', 'level', 'xp'].map(field => (
                        <div key={field}>
                            <label htmlFor={field} className="block text-sm font-medium text-gray-300 mb-1 capitalize">{field}:</label>
                            <input
                                type={['age', 'level', 'xp'].includes(field) ? 'number' : 'text'}
                                id={field}
                                name={field}
                                value={character[field] === 0 ? '' : character[field]}
                                onChange={handleChange}
                                className="w-full p-2 bg-gray-600 border border-gray-500 rounded-md focus:ring-purple-500 focus:border-purple-500 text-white"
                                disabled={user.uid !== character.ownerUid && !isMaster}
                            />
                        </div>
                    ))}
                </div>
            </div>
        )}
    </section>
);

const MainAttributesSection = ({ character, user, isMaster, mainAttributeModifiers, dynamicAttributeModifiers, handleMainAttributeChange, handleSingleMainAttributeChange, toggleSection }) => {

    const dexterityValue = useMemo(() => {
        // AJUSTE: Procura por um atributo que contenha 'dex', 'des', ou 'agi'
        const searchTerms = ['dex', 'des', 'agi'];
        const dexterityAttr = character.attributes.find(attr => {
            if (!attr.name) return false;
            const lowerCaseName = attr.name.toLowerCase();
            return searchTerms.some(term => lowerCaseName.includes(term));
        });

        if (!dexterityAttr) return 0;

        // Usa o nome real do atributo encontrado para buscar modificadores temporários
        const tempValue = dynamicAttributeModifiers[dexterityAttr.name] || 0;
        return (dexterityAttr.base || 0) + (dexterityAttr.perm || 0) + tempValue + (dexterityAttr.arma || 0);
    }, [character.attributes, dynamicAttributeModifiers]);

    const initiativeTotal = dexterityValue + (mainAttributeModifiers['Iniciativa'] || 0);
    
    return (
        <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
            <h2 className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center" onClick={() => toggleSection('isMainAttributesCollapsed')}>
                Atributos Principais
                <span>{character.isMainAttributesCollapsed ? '▼' : '▲'}</span>
            </h2>
            {!character.isMainAttributesCollapsed && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* HP Unificado e Bloqueado */}
                    <div className="flex flex-col items-center p-2 bg-gray-600 rounded-md">
                         <label className="text-lg font-medium text-gray-300 mb-1 uppercase">HP</label>
                        <div className="flex items-center gap-1">
                            <input type="number" name="current" data-attribute="hp" value={character.mainAttributes.hp.current === 0 ? '' : character.mainAttributes.hp.current} onChange={handleMainAttributeChange} className="w-14 p-2 text-center bg-gray-700 border border-gray-500 rounded-md text-white text-xl font-bold" disabled={!isMaster} />
                            <span className="text-gray-300">/</span>
                            <input type="number" name="max" data-attribute="hp" value={character.mainAttributes.hp.max === 0 ? '' : character.mainAttributes.hp.max} onChange={handleMainAttributeChange} className="w-14 p-2 text-center bg-gray-700 border border-gray-500 rounded-md text-white text-xl font-bold" disabled={!isMaster} />
                             <span className="text-blue-400 font-bold text-xl ml-1">+</span>
                            <input type="number" name="temp" title="HP Temporário" data-attribute="hp" value={character.mainAttributes.hp.temp === 0 ? '' : character.mainAttributes.hp.temp} onChange={handleMainAttributeChange} className="w-14 p-2 text-center bg-gray-700 border border-blue-400 rounded-md text-blue-300 text-xl font-bold" disabled={!isMaster} />
                        </div>
                    </div>
                    {/* MP Bloqueado */}
                    <div className="flex flex-col items-center p-2 bg-gray-600 rounded-md">
                        <label className="text-lg font-medium text-gray-300 mb-1 uppercase">MP</label>
                        <div className="flex items-center gap-2">
                            <input type="number" name="current" data-attribute="mp" value={character.mainAttributes.mp.current === 0 ? '' : character.mainAttributes.mp.current} onChange={handleMainAttributeChange} className="w-14 p-2 text-center bg-gray-700 border border-gray-500 rounded-md text-white text-xl font-bold" disabled={!isMaster} />
                            <span className="text-gray-300">/</span>
                            <input type="number" name="max" data-attribute="mp" value={character.mainAttributes.mp.max === 0 ? '' : character.mainAttributes.mp.max} onChange={handleMainAttributeChange} className="w-14 p-2 text-center bg-gray-700 border border-gray-500 rounded-md text-white text-xl font-bold" disabled={!isMaster} />
                        </div>
                    </div>
                    
                    {/* Iniciativa Calculada */}
                    <div className="flex flex-col items-center p-2 bg-gray-600 rounded-md">
                        <label className="capitalize text-lg font-medium text-gray-300 mb-1">Iniciativa:</label>
                        <div className="flex items-center gap-2">
                            <span title="Valor base do atributo de agilidade/destreza" className="w-14 p-2 text-center bg-gray-800 border border-gray-600 rounded-md text-white text-xl font-bold cursor-not-allowed">{dexterityValue}</span>
                            <span className="text-gray-300">=</span>
                            <span className="w-14 p-2 text-center bg-gray-800 border border-gray-600 rounded-md text-white text-xl font-bold cursor-not-allowed">{initiativeTotal}</span>
                        </div>
                    </div>
                    
                    {/* Outros Atributos com totais calculados */}
                    {[
                        { key: 'fa', label: 'FA', modifierKey: 'FA' },
                        { key: 'fm', label: 'FM', modifierKey: 'FM' },
                        { key: 'fd', label: 'FD', modifierKey: 'FD' }
                    ].map(({ key, label, modifierKey }) => {
                        const baseValue = character.mainAttributes[key] || 0;
                        const modifier = mainAttributeModifiers[modifierKey] || 0;
                        const total = baseValue + modifier;
                        return (
                            <div key={key} className="flex flex-col items-center p-2 bg-gray-600 rounded-md">
                                <label htmlFor={key} className="capitalize text-lg font-medium text-gray-300 mb-1">{label}:</label>
                                <div className="flex items-center gap-2">
                                    <input type="number" id={key} name={key} value={baseValue === 0 ? '' : baseValue} onChange={handleSingleMainAttributeChange} className="w-14 p-2 text-center bg-gray-700 border border-gray-500 rounded-md text-white text-xl font-bold" disabled={user.uid !== character.ownerUid && !isMaster} />
                                    <span className="text-gray-300">=</span>
                                    <span className="w-14 p-2 text-center bg-gray-800 border border-gray-600 rounded-md text-white text-xl font-bold cursor-not-allowed">{total}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

const DiscordIntegrationSection = ({ webhookUrl, handleChange, isMaster, ownerUid, userUid, toggleSection, isCollapsed }) => (
    <section id="discord" className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
        <h2 className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center" onClick={() => toggleSection('isDiscordCollapsed')}>
            Integração com Discord
            <span>{isCollapsed ? '▼' : '▲'}</span>
        </h2>
        {!isCollapsed && (
            <div>
                <label htmlFor="discordWebhookUrl" className="block text-sm font-medium text-gray-300 mb-1">URL do Webhook do Canal:</label>
                <input
                    type="text"
                    id="discordWebhookUrl"
                    name="discordWebhookUrl"
                    value={webhookUrl}
                    onChange={handleChange}
                    className="w-full p-2 bg-gray-600 border border-gray-500 rounded-md focus:ring-purple-500 focus:border-purple-500 text-white"
                    placeholder="Cole a URL do Webhook do seu canal do  aqui"
                    disabled={userUid !== ownerUid && !isMaster}
                />
                <p className="text-xs text-gray-400 mt-2">
                    Com a URL do Webhook configurada, os comandos de rolagem serão enviados diretamente para o seu canal do Discord em vez de aparecerem num pop-up.
                </p>
            </div>
        )}
    </section>
);

const ActionsAndBuffsSection = ({ 
    character, user, isMaster, 
    handleAddBuff, handleRemoveBuff, handleBuffChange, handleToggleBuffActive, handleToggleBuffCollapsed, 
    handleOpenActionModal,
    allAttributes,
    handleAddFormulaAction, handleRemoveFormulaAction, handleFormulaActionChange,
    handleAddActionComponent, handleRemoveActionComponent, handleActionComponentChange,
    handleExecuteFormulaAction,
    handleToggleCustomActionCollapsed,
    toggleSection 
}) => {
    
    const collapsedBuffs = useMemo(() => (character.buffs || []).filter(b => b.isCollapsed), [character.buffs]);
    const expandedBuffs = useMemo(() => (character.buffs || []).filter(b => !b.isCollapsed), [character.buffs]);

    const collapsedActions = useMemo(() => (character.formulaActions || []).filter(a => a.isCollapsed), [character.formulaActions]);
    const expandedActions = useMemo(() => (character.formulaActions || []).filter(a => !a.isCollapsed), [character.formulaActions]);

    return (
        <section id="actions" className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
            <h2 className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center" onClick={() => toggleSection('isQuickActionsCollapsed')}>
                Ações e Buffs
                <span>{character.isQuickActionsCollapsed ? '▼' : '▲'}</span>
            </h2>
            {!character.isQuickActionsCollapsed && (
                <>
                    <div className="flex flex-wrap gap-4 mb-6 pb-4 border-b border-gray-600">
                        <button onClick={() => handleOpenActionModal('heal')} className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md">Curar</button>
                        <button onClick={() => handleOpenActionModal('damage')} className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-md">Receber Dano</button>
                    </div>

                    <div className="mb-6">
                        <h3 className="text-xl font-semibold text-purple-300 mb-2">Construtor de Ações Rápidas</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                            {collapsedActions.map(action => (
                                <div key={action.id} className="p-3 bg-gray-600 rounded-md shadow-sm border border-gray-500 flex justify-between items-center">
                                    <span className="font-semibold text-lg cursor-pointer text-white flex-grow" onClick={() => handleToggleCustomActionCollapsed(action.id)}>
                                        {action.name || 'Ação Sem Nome'}
                                    </span>
                                    <button onClick={(e) => { e.stopPropagation(); handleExecuteFormulaAction(action.id); }} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg whitespace-nowrap ml-4">Usar</button>
                                </div>
                            ))}
                        </div>
                        
                        <div className="space-y-4">
                            {expandedActions.map(action => (
                                <div key={action.id} className="p-4 bg-gray-600 rounded-md shadow-sm border border-gray-500 relative">
                                    <div className="flex justify-between items-center gap-2 mb-3">
                                        <span className="font-semibold text-lg cursor-pointer text-white flex-grow" onClick={() => handleToggleCustomActionCollapsed(action.id)}>
                                            {action.name || 'Ação Sem Nome'}
                                        </span>
                                        <button onClick={(e) => { e.stopPropagation(); handleExecuteFormulaAction(action.id); }} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg whitespace-nowrap">Usar</button>
                                         {(user.uid === character.ownerUid || isMaster) && (
                                            <button onClick={() => handleRemoveFormulaAction(action.id)} className="w-10 h-10 bg-red-600 text-white text-lg rounded-md flex items-center justify-center font-bold">X</button>
                                        )}
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-500 pt-3 mt-3">
                                        <div>
                                            <label className="text-sm font-medium text-gray-300 block mb-1">Nome da Ação:</label>
                                            <input
                                                type="text"
                                                placeholder="Nome da Ação"
                                                value={action.name}
                                                onChange={(e) => handleFormulaActionChange(action.id, 'name', e.target.value)}
                                                className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white font-semibold mb-3"
                                                disabled={user.uid !== character.ownerUid && !isMaster}
                                            />
                                            <label className="text-sm font-medium text-gray-300 block mb-2">Componentes da Fórmula:</label>
                                            <div className="space-y-2 mb-3">
                                                {(action.components || []).map(comp => (
                                                    <div key={comp.id} className="flex items-center gap-2">
                                                        {comp.type === 'dice' ? (
                                                            <input
                                                                type="text"
                                                                placeholder="1d6 ou 10"
                                                                value={comp.value}
                                                                onChange={(e) => handleActionComponentChange(action.id, comp.id, 'value', e.target.value)}
                                                                className="flex-grow p-1 bg-gray-700 border border-gray-500 rounded-md text-white"
                                                                disabled={user.uid !== character.ownerUid && !isMaster}
                                                            />
                                                        ) : (
                                                            <select
                                                                value={comp.value}
                                                                onChange={(e) => handleActionComponentChange(action.id, comp.id, 'value', e.target.value)}
                                                                className="flex-grow p-1 bg-gray-700 border border-gray-500 rounded-md text-white"
                                                                disabled={user.uid !== character.ownerUid && !isMaster}
                                                            >
                                                                <option value="">Selecione Atributo</option>
                                                                {allAttributes.map(attr => <option key={attr} value={attr}>{attr}</option>)}
                                                            </select>
                                                        )}
                                                        {(user.uid === character.ownerUid || isMaster) && (
                                                        <button onClick={() => handleRemoveActionComponent(action.id, comp.id)} className="w-6 h-6 bg-red-600 text-white text-xs rounded-full flex items-center justify-center font-bold flex-shrink-0">-</button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                             {(user.uid === character.ownerUid || isMaster) && (
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleAddActionComponent(action.id, 'dice')} className="px-2 py-1 text-xs bg-indigo-600 rounded-md">+ Dado/Nº</button>
                                                    <button onClick={() => handleAddActionComponent(action.id, 'attribute')} className="px-2 py-1 text-xs bg-indigo-600 rounded-md">+ Atributo</button>
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <label htmlFor={`multiplier-${action.id}`} className="text-sm font-medium text-gray-300 block mb-2">Multiplicador:</label>
                                             <input
                                                id={`multiplier-${action.id}`}
                                                type="number"
                                                value={action.multiplier === 1 ? '' : action.multiplier}
                                                onChange={(e) => handleFormulaActionChange(action.id, 'multiplier', e.target.value)}
                                                className="w-20 p-1 bg-gray-700 border border-gray-500 rounded-md text-white mb-3"
                                                placeholder="1"
                                                disabled={user.uid !== character.ownerUid && !isMaster}
                                            />
                                            <label htmlFor={`discordText-${action.id}`} className="text-sm font-medium text-gray-300 block mb-2">Descrição da Ação:</label>
                                            <AutoResizingTextarea
                                                id={`discordText-${action.id}`}
                                                placeholder="Descrição da ação para Discord/Roll20..."
                                                value={action.discordText}



                                                onChange={(e) => handleFormulaActionChange(action.id, 'discordText', e.target.value)}
                                                className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white text-sm"
                                                disabled={user.uid !== character.ownerUid && !isMaster}
                                            />
                                             <label className="text-sm font-medium text-gray-300 block mb-2 mt-3">Custo da Ação:</label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    placeholder="Custo"
                                                    value={action.costValue === 0 ? '' : action.costValue}
                                                    onChange={(e) => handleFormulaActionChange(action.id, 'costValue', e.target.value)}
                                                    className="w-20 p-1 bg-gray-700 border border-gray-500 rounded-md text-white"
                                                    disabled={user.uid !== character.ownerUid && !isMaster}
                                                />
                                                <select
                                                    value={action.costType}
                                                    onChange={(e) => handleFormulaActionChange(action.id, 'costType', e.target.value)}
                                                    className="p-1 bg-gray-700 border border-gray-500 rounded-md text-white"
                                                    disabled={user.uid !== character.ownerUid && !isMaster}
                                                >
                                                    <option value="">N/A</option>
                                                    <option value="HP">HP</option>
                                                    <option value="MP">MP</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {((character.formulaActions || []).length === 0) && (
                            <p className="text-gray-400 italic">Nenhuma ação rápida criada.</p>
                        )}
                        {(user.uid === character.ownerUid || isMaster) && (
                            <div className="flex justify-center mt-4">
                                <button onClick={handleAddFormulaAction} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md">+ Adicionar Ação Rápida</button>
                            </div>
                        )}
                    </div>

                    <div className="border-t border-gray-600 pt-6">
                        <h3 className="text-xl font-semibold text-purple-300 mb-2">Buffs Ativáveis</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                            {collapsedBuffs.map(buff => (
                                <div key={buff.id} className="p-3 bg-gray-600 rounded-md shadow-sm border border-gray-500 flex justify-between items-center">
                                    <span className="font-semibold text-lg cursor-pointer text-white flex-grow" onClick={() => handleToggleBuffCollapsed(buff.id)}>
                                        {buff.name || 'Buff Sem Nome'}
                                    </span>
                                    <div className="flex items-center gap-4 ml-4">
                                        <label className="flex items-center cursor-pointer">
                                            <div className="relative">
                                                <input type="checkbox" checked={buff.isActive} onChange={() => handleToggleBuffActive(buff.id)} className="sr-only" disabled={user.uid !== character.ownerUid && !isMaster}/>
                                                <div className={`block w-14 h-8 rounded-full ${buff.isActive ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                                                <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${buff.isActive ? 'transform translate-x-6' : ''}`}></div>
                                            </div>
                                        </label>
                                        {(user.uid === character.ownerUid || isMaster) && (
                                            <button onClick={() => handleRemoveBuff(buff.id)} className="w-8 h-8 bg-red-600 hover:bg-red-700 text-white text-lg font-bold rounded-full flex items-center justify-center flex-shrink-0" aria-label="Remover Buff">X</button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="space-y-3">
                            {expandedBuffs.map(buff => (
                                <div key={buff.id} className="p-3 bg-gray-600 rounded-md shadow-sm border border-gray-500">
                                    <div className="flex justify-between items-center">
                                        <span className="font-semibold text-lg cursor-pointer text-white flex-grow" onClick={() => handleToggleBuffCollapsed(buff.id)}>
                                            {buff.name || 'Buff Sem Nome'}
                                        </span>
                                        <div className="flex items-center gap-4 ml-4">
                                            <label className="flex items-center cursor-pointer">
                                                <div className="relative">
                                                    <input type="checkbox" checked={buff.isActive} onChange={() => handleToggleBuffActive(buff.id)} className="sr-only" disabled={user.uid !== character.ownerUid && !isMaster}/>
                                                    <div className={`block w-14 h-8 rounded-full ${buff.isActive ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                                                    <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${buff.isActive ? 'transform translate-x-6' : ''}`}></div>
                                                </div>
                                            </label>
                                            {(user.uid === character.ownerUid || isMaster) && (
                                                <button onClick={() => handleRemoveBuff(buff.id)} className="w-8 h-8 bg-red-600 hover:bg-red-700 text-white text-lg font-bold rounded-full flex items-center justify-center flex-shrink-0" aria-label="Remover Buff">X</button>
                                        )}
                                    </div>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-gray-500">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-center">
                                            <input
                                                type="text"
                                                placeholder="Nome do Buff"
                                                value={buff.name}
                                                onChange={(e) => handleBuffChange(buff.id, 'name', e.target.value)}
                                                className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white font-semibold"
                                                disabled={user.uid !== character.ownerUid && !isMaster}
                                            />
                                            <select
                                                value={buff.type}
                                                onChange={(e) => handleBuffChange(buff.id, 'type', e.target.value)}
                                                className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white"
                                                disabled={user.uid !== character.ownerUid && !isMaster}
                                            >
                                                <option value="attribute">Modificar Atributo</option>
                                                <option value="dice">Adicionar Dado/Número</option>
                                            </select>
                                            {buff.type === 'attribute' && (
                                                <select
                                                    value={buff.target}
                                                    onChange={(e) => handleBuffChange(buff.id, 'target', e.target.value)}
                                                    className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white"
                                                    disabled={user.uid !== character.ownerUid && !isMaster}
                                                >
                                                    <option value="">Selecione um Atributo</option>
                                                    {allAttributes.map(name => <option key={name} value={name}>{name}</option>)}
                                                </select>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2 items-center">
                                            {buff.type === 'attribute' ? (
                                                <input
                                                    type="number"
                                                    placeholder="Valor (+/-)"
                                                    value={buff.value === 0 ? '' : buff.value}
                                                    onChange={(e) => handleBuffChange(buff.id, 'value', e.target.value)}
                                                    className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white text-center"
                                                    disabled={user.uid !== character.ownerUid && !isMaster}
                                                />
                                            ) : (
                                                 <input
                                                    type="text"
                                                    placeholder="1d6 ou 6"
                                                    value={buff.value}
                                                    onChange={(e) => handleBuffChange(buff.id, 'value', e.target.value)}
                                                    className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white text-center"
                                                    disabled={user.uid !== character.ownerUid && !isMaster}
                                                />
                                            )}
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    placeholder="Custo"
                                                    value={buff.costValue === 0 ? '' : buff.costValue}
                                                    onChange={(e) => handleBuffChange(buff.id, 'costValue', e.target.value)}
                                                    className="w-16 p-2 bg-gray-700 border border-gray-500 rounded-md text-white"
                                                    disabled={user.uid !== character.ownerUid && !isMaster}
                                                />
                                                <select
                                                    value={buff.costType}
                                                    onChange={(e) => handleBuffChange(buff.id, 'costType', e.target.value)}
                                                    className="p-2 bg-gray-700 border border-gray-500 rounded-md text-white"
                                                    disabled={user.uid !== character.ownerUid && !isMaster}
                                                >
                                                    <option value="">N/A</option>
                                                    <option value="HP">HP</option>
                                                    <option value="MP">MP</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {(character.buffs || []).length === 0 && <p className="text-gray-400 italic">Nenhum buff criado.</p>}
                        {(user.uid === character.ownerUid || isMaster) && (
                            <div className="flex justify-center mt-4">
                                <button onClick={handleAddBuff} className="w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white text-2xl font-bold rounded-full shadow-lg transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 flex items-center justify-center" aria-label="Adicionar Buff">+</button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </section>
    );
};

const AttributesSection = ({ character, user, isMaster, dynamicAttributeModifiers, handleAddAttribute, handleRemoveAttribute, handleAttributeChange, handleDragStart, handleDragOver, handleDrop, toggleSection, handleToggleAttributeCollapsed, handleOpenRollModal }) => (
    <section id="attributes" className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
        <h2 className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center" onClick={() => toggleSection('isAttributesCollapsed')}>
            Atributos
            <span>{character.isAttributesCollapsed ? '▼' : '▲'}</span>
        </h2>
        {!character.isAttributesCollapsed && (
            <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(character.attributes || []).map((attr, index) => {
                        const tempValue = dynamicAttributeModifiers[attr.name] || 0;
                        const totalValue = (attr.base || 0) + (attr.perm || 0) + tempValue + (attr.arma || 0);
                        
                        if (attr.isCollapsed) {
                            return (
                                <div 
                                    key={attr.id} 
                                    className="p-3 bg-gray-600 rounded-md shadow-sm border border-gray-500 flex justify-between items-center cursor-pointer"
                                    onClick={() => handleToggleAttributeCollapsed(attr.id)}
                                >
                                    <span className="font-semibold text-lg text-white flex-grow">
                                        {attr.name || 'Atributo Sem Nome'} 
                                        <span className="ml-2 font-bold text-purple-300">
                                            {totalValue >= 0 ? '+' : ''}{totalValue}
                                        </span>
                                    </span>
                                    <button 
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            handleOpenRollModal(attr.id);
                                        }} 
                                        className="px-4 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg whitespace-nowrap ml-4 text-sm shadow-md"
                                    >
                                        Rolar
                                    </button>
                                </div>
                            );
                        }

                        return (
                            <div 
                                key={attr.id} 
                                className="p-3 bg-gray-600 rounded-md shadow-sm border border-gray-500 relative flex flex-col gap-3" 
                                draggable 
                                onDragStart={(e) => handleDragStart(e, index, 'attributes')} 
                                onDragOver={handleDragOver} 
                                onDrop={(e) => handleDrop(e, index, 'attributes')}
                            >
                                <div 
                                    className="flex items-center gap-2 cursor-pointer"
                                    onClick={() => handleToggleAttributeCollapsed(attr.id)}
                                >
                                    <input 
                                        type="text" 
                                        placeholder="Nome do Atributo" 
                                        value={attr.name} 
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => handleAttributeChange(attr.id, 'name', e.target.value)} 
                                        className="w-full flex-grow p-2 bg-gray-700 border border-gray-500 rounded-md text-white font-semibold cursor-text" 
                                        disabled={user.uid !== character.ownerUid && !isMaster} 
                                    />
                                    <span className="text-gray-400 text-xs whitespace-nowrap">Recolher ▲</span>
                                </div>
                                <div className="flex items-center gap-1 sm:gap-2 text-xs justify-end w-full" onClick={(e) => e.stopPropagation()}>
                                    {['base', 'perm', 'arma'].map(field => (
                                        <div key={field} className="flex flex-col items-center">
                                            <span className="text-gray-400 text-xs text-center capitalize">{field}</span>
                                            <input 
                                              type="number" 
                                              value={(attr[field] === 0 ? '' : attr[field])} 
                                              onChange={(e) => handleAttributeChange(attr.id, field, e.target.value)} 
                                              className={`w-12 p-1 border rounded-md text-white text-center bg-gray-700 border-gray-500`} 
                                              disabled={user.uid !== character.ownerUid && !isMaster}
                                            />
                                        </div>
                                    ))}
                                    <div className="flex flex-col items-center">
                                        <span className="text-gray-400 text-xs text-center capitalize">temp</span>
                                        <input 
                                          type="number" 
                                          value={(tempValue === 0 ? '' : tempValue)} 
                                          className={`w-12 p-1 border rounded-md text-white text-center bg-gray-800 border-gray-600 cursor-not-allowed`} 
                                          readOnly
                                        />
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <span className="text-gray-400 text-xs text-center">Total</span>
                                        <input type="number" value={totalValue === 0 ? '' : totalValue} readOnly className="w-12 p-1 bg-gray-800 border border-gray-600 rounded-md text-white font-bold cursor-not-allowed text-center" />
                                    </div>
                                </div>
                                {(user.uid === character.ownerUid || isMaster) && (
                                     <div className="flex justify-start pt-2 mt-2 border-t border-gray-500/50" onClick={(e) => e.stopPropagation()}>
                                        <button 
                                            onClick={() => handleRemoveAttribute(attr.id)} 
                                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-md transition duration-200 ease-in-out" 
                                            aria-label="Remover Atributo"
                                        >
                                            Remover
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                {(user.uid === character.ownerUid || isMaster) && (
                    <div className="flex justify-center mt-4">
                        <button onClick={handleAddAttribute} className="w-10 h-10 bg-green-600 hover:bg-green-700 text-white text-2xl font-bold rounded-full shadow-lg transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75 flex items-center justify-center" aria-label="Adicionar Atributo">+</button>
                    </div>
                )}
            </>
        )}
    </section>
);

const InventoryWalletSection = ({ character, user, isMaster, zeniAmount, handleZeniChange, handleAddZeni, handleRemoveZeni, handleAddItem, handleInventoryItemChange, handleRemoveItem, toggleItemCollapsed, toggleSection, handleShowOnDiscord }) => (
    <div id="inventory">
        <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
            <h2 className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center" onClick={() => toggleSection('isInventoryCollapsed')}>
                Inventário
                <span>{character.isInventoryCollapsed ? '▼' : '▲'}</span>
            </h2>
            {!character.isInventoryCollapsed && (
                <>
                    <ul className="space-y-2">
                        {(character.inventory || []).length === 0 ? (
                            <li className="text-gray-400 italic">Nenhum item no inventário.</li>
                        ) : (
                            character.inventory.map((item) => (
                                <li key={item.id} className="flex flex-col p-3 bg-gray-600 rounded-md shadow-sm">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-semibold text-lg w-full cursor-pointer text-white" onClick={() => toggleItemCollapsed('inventory', item.id)}>
                                            {item.name || 'Item Sem Nome'} {item.isCollapsed ? '...' : ''}
                                        </span>
                                        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                                            <button onClick={() => handleShowOn(item.name, item.description)} title="Mostrar no " className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-md whitespace-nowrap"></button>
                                            {(user.uid === character.ownerUid || isMaster) && (
                                                <button onClick={() => handleRemoveItem(item.id)} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md">Remover</button>
                                            )}
                                        </div>
                                    </div>
                                    {!item.isCollapsed && (
                                        <>
                                            <input type="text" value={item.name} onChange={(e) => handleInventoryItemChange(item.id, 'name', e.target.value)} className="font-semibold text-lg w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white mb-2" placeholder="Nome do Item" disabled={user.uid !== character.ownerUid && !isMaster} />
                                            <AutoResizingTextarea value={item.description} onChange={(e) => handleInventoryItemChange(item.id, 'description', e.target.value)} placeholder="Descrição do item" className="text-sm text-gray-300 italic w-full p-1 bg-gray-700 border border-gray-500 rounded-md text-white" disabled={user.uid !== character.ownerUid && !isMaster} />
                                        </>
                                    )}
                                </li>
                            ))
                        )}
                    </ul>
                    {(user.uid === character.ownerUid || isMaster) && (
                        <div className="flex justify-end mt-4">
                            <button onClick={handleAddItem} className="w-10 h-10 bg-green-600 hover:bg-green-700 text-white text-2xl font-bold rounded-full shadow-lg" aria-label="Adicionar Item">+</button>
                        </div>
                    )}
                </>
            )}
        </section>
        <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
            <h2 className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center" onClick={() => toggleSection('isWalletCollapsed')}>
                Zeni: {character.wallet?.zeni || 0}
                <span>{character.isWalletCollapsed ? '▼' : '▲'}</span>
            </h2>
            {!character.isWalletCollapsed && (
                <div className="flex items-center gap-2 w-full">
                    <input type="number" value={zeniAmount === 0 ? '' : zeniAmount} onChange={handleZeniChange} className="w-16 p-2 bg-gray-600 border border-gray-500 rounded-md text-white text-lg" placeholder="Valor" disabled={user.uid !== character.ownerUid && !isMaster} />
                    <button onClick={handleAddZeni} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg" disabled={user.uid !== character.ownerUid && !isMaster}>Adicionar</button>
                    <button onClick={handleRemoveZeni} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg" disabled={user.uid !== character.ownerUid && !isMaster}>Remover</button>
                </div>
            )}
        </section>
    </div>
);

const PerksSection = ({ character, user, isMaster, handleAddPerk, handleRemovePerk, handlePerkChange, handlePerkOriginChange, toggleItemCollapsed, toggleSection, handleShowOnDiscord }) => (
    <section id="perks" className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
        <h2 className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center" onClick={() => toggleSection('isPerksCollapsed')}>
            Vantagens e Desvantagens
            <span>{character.isPerksCollapsed ? '▼' : '▲'}</span>
        </h2>
        {!character.isPerksCollapsed && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {['advantages', 'disadvantages'].map(type => (
                    <div key={type}>
                        <h3 className="text-xl font-semibold text-purple-300 mb-3 border-b border-purple-500 pb-1 capitalize">{type === 'advantages' ? 'Vantagens' : 'Desvantagens'}</h3>
                        <ul className="space-y-2">
                            {(character[type] || []).length === 0 ? (
                                <li className="text-gray-400 italic">Nenhuma {type === 'advantages' ? 'vantagem' : 'desvantagem'}.</li>
                            ) : (
                                character[type].map(perk => (
                                    <li key={perk.id} className="flex flex-col p-3 bg-gray-600 rounded-md shadow-sm">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-semibold text-lg w-full cursor-pointer" onClick={() => toggleItemCollapsed(type, perk.id)}>
                                                {perk.name || `Sem Nome`} {perk.isCollapsed ? '...' : ''}
                                            </span>
                                            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                                                <button onClick={() => handleShowOnDiscord(perk.name, perk.description)} title="Mostrar no Discord" className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-md whitespace-nowrap">Discord</button>
                                                {(user.uid === character.ownerUid || isMaster) && (
                                                    <button onClick={() => handleRemovePerk(type, perk.id)} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md">Remover</button>
                                                )}
                                            </div>
                                        </div>
                                        {!perk.isCollapsed && (
                                            <>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <input type="text" value={perk.name} onChange={(e) => handlePerkChange(type, perk.id, 'name', e.target.value)} className="font-semibold text-lg flex-grow p-1 bg-gray-700 border border-gray-500 rounded-md" placeholder="Nome" disabled={user.uid !== character.ownerUid && !isMaster} />
                                                    <input type="number" value={perk.value === 0 ? '' : perk.value} onChange={(e) => handlePerkChange(type, perk.id, 'value', e.target.value)} className="w-12 p-1 bg-gray-700 border border-gray-500 rounded-md text-center" placeholder="Valor" disabled={user.uid !== character.ownerUid && !isMaster} />
                                                </div>
                                                <AutoResizingTextarea value={perk.description} onChange={(e) => handlePerkChange(type, perk.id, 'description', e.target.value)} placeholder="Descrição" className="text-sm text-gray-300 italic w-full p-1 bg-gray-700 border border-gray-500 rounded-md" disabled={user.uid !== character.ownerUid && !isMaster} />
                                                <div className="flex gap-3 text-sm text-gray-400 mt-2">
                                                    {['class', 'race', 'manual'].map(originType => (
                                                        <label key={originType} className="flex items-center gap-1">
                                                            <input type="checkbox" checked={perk.origin[originType]} onChange={() => handlePerkOriginChange(type, perk.id, originType)} className="form-checkbox text-purple-500 rounded" disabled={user.uid !== character.ownerUid && !isMaster} /> {originType.charAt(0).toUpperCase() + originType.slice(1)}
                                                        </label>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </li>
                                ))
                            )}
                        </ul>
                        {(user.uid === character.ownerUid || isMaster) && (
                            <div className="flex justify-end mt-4">
                                <button onClick={() => handleAddPerk(type)} className="w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white text-2xl font-bold rounded-full shadow-lg" aria-label={`Adicionar ${type}`}>+</button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        )}
    </section>
);

const SkillsSection = ({ character, user, isMaster, handleAddAbility, handleRemoveAbility, handleAbilityChange, handleAddSpecialization, handleRemoveSpecialization, handleSpecializationChange, handleAddEquippedItem, handleRemoveEquippedItem, handleEquippedItemChange, toggleItemCollapsed, toggleSection, handleShowOnDiscord }) => {
    return (
    <div id="skills">
        <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
            <h2 className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center" onClick={() => toggleSection('isAbilitiesCollapsed')}>
                Habilidades
                <span>{character.isAbilitiesCollapsed ? '▼' : '▲'}</span>
            </h2>
            {!character.isAbilitiesCollapsed && (
                <>
                    <div className="space-y-2">
                        {(character.abilities || []).map(ability => (
                            <div key={ability.id} className="flex flex-col p-3 bg-gray-600 rounded-md shadow-sm">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-semibold text-lg w-full cursor-pointer" onClick={() => toggleItemCollapsed('abilities', ability.id)}>
                                        {ability.title || 'Habilidade Sem Título'} {ability.isCollapsed ? '...' : ''}
                                    </span>
                                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                                        <button onClick={() => handleShowOnDiscord(ability.title, ability.description)} title="Mostrar no Discord" className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-md whitespace-nowrap">Discord</button>
                                        {(user.uid === character.ownerUid || isMaster) && (
                                            <button onClick={() => handleRemoveAbility(ability.id)} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md">Remover</button>
                                        )}
                                    </div>
                                </div>
                                {!ability.isCollapsed && (
                                    <>
                                        <input type="text" value={ability.title} onChange={(e) => handleAbilityChange(ability.id, 'title', e.target.value)} className="font-semibold text-lg w-full p-1 bg-gray-700 border border-gray-500 rounded-md mb-2" placeholder="Título" disabled={user.uid !== character.ownerUid && !isMaster} />
                                        <AutoResizingTextarea value={ability.description} onChange={(e) => handleAbilityChange(ability.id, 'description', e.target.value)} placeholder="Descrição" className="text-sm text-gray-300 italic w-full p-1 bg-gray-700 border border-gray-500 rounded-md" disabled={user.uid !== character.ownerUid && !isMaster} />
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                    {(user.uid === character.ownerUid || isMaster) && (
                        <div className="flex justify-end mt-4">
                            <button onClick={handleAddAbility} className="w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white text-2xl font-bold rounded-full shadow-lg" aria-label="Adicionar Habilidade">+</button>
                        </div>
                    )}
                </>
            )}
        </section>

        <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
            <h2 className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center" onClick={() => toggleSection('isSpecializationsCollapsed')}>
                Especializações (Perícias)
                <span>{character.isSpecializationsCollapsed ? '▼' : '▲'}</span>
            </h2>
            {!character.isSpecializationsCollapsed && (
                 <>
                    <div className="space-y-2">
                        {(character.specializations || []).map(spec => (
                            <div key={spec.id} className="flex flex-col p-3 bg-gray-600 rounded-md shadow-sm">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-semibold text-lg w-full cursor-pointer" onClick={() => toggleItemCollapsed('specializations', spec.id)}>
                                        {spec.name || 'Especialização Sem Nome'} {spec.isCollapsed ? '...' : ''}
                                    </span>
                                    {(user.uid === character.ownerUid || isMaster) && (
                                        <button onClick={() => handleRemoveSpecialization(spec.id)} className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md">Remover</button>
                                    )}
                                </div>
                                {!spec.isCollapsed && (
                                    <>
                                        <input type="text" value={spec.name} onChange={(e) => handleSpecializationChange(spec.id, 'name', e.target.value)} className="font-semibold text-lg w-full p-1 bg-gray-700 border border-gray-500 rounded-md mb-2" placeholder="Nome" disabled={user.uid !== character.ownerUid && !isMaster} />
                                        <div className="flex gap-4 text-sm">
                                            <label className="flex items-center gap-1">Mod: <input type="number" value={spec.modifier === 0 ? '' : spec.modifier} onChange={(e) => handleSpecializationChange(spec.id, 'modifier', e.target.value)} className="w-12 p-1 bg-gray-700 border border-gray-500 rounded-md" disabled={user.uid !== character.ownerUid && !isMaster} /></label>
                                            <label className="flex items-center gap-1">Bônus: <input type="number" value={spec.bonus === 0 ? '' : spec.bonus} onChange={(e) => handleSpecializationChange(spec.id, 'bonus', e.target.value)} className="w-12 p-1 bg-gray-700 border border-gray-500 rounded-md" disabled={user.uid !== character.ownerUid && !isMaster} /></label>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                    {(user.uid === character.ownerUid || isMaster) && (
                        <div className="flex justify-end mt-4">
                            <button onClick={handleAddSpecialization} className="w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white text-2xl font-bold rounded-full shadow-lg" aria-label="Adicionar Especialização">+</button>
                        </div>
                    )}
                </>
            )}
        </section>

        <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
            <h2 className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center" onClick={() => toggleSection('isEquippedItemsCollapsed')}>
                Itens Equipados
                <span>{character.isEquippedItemsCollapsed ? '▼' : '▲'}</span>
            </h2>
            {!character.isEquippedItemsCollapsed && (
                <>
                    <div className="space-y-2">
                        {(character.equippedItems || []).map(item => (
                            <div key={item.id} className="flex flex-col p-3 bg-gray-600 rounded-md shadow-sm">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-semibold text-lg w-full cursor-pointer" onClick={() => toggleItemCollapsed('equippedItems', item.id)}>
                                        {item.name || 'Item Sem Nome'} {item.isCollapsed ? '...' : ''}
                                    </span>
                                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                                        <button onClick={() => handleShowOnDiscord(item.name, item.description)} title="Mostrar no Discord" className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-md whitespace-nowrap">Discord</button>
                                        {(user.uid === character.ownerUid || isMaster) && (
                                            <button onClick={() => handleRemoveEquippedItem(item.id)} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md">Remover</button>
                                        )}
                                    </div>
                                </div>
                                {!item.isCollapsed && (
                                    <>
                                        <input type="text" value={item.name} onChange={(e) => handleEquippedItemChange(item.id, 'name', e.target.value)} className="font-semibold text-lg w-full p-1 bg-gray-700 border border-gray-500 rounded-md mb-2" placeholder="Nome" disabled={user.uid !== character.ownerUid && !isMaster} />
                                        <AutoResizingTextarea value={item.description} onChange={(e) => handleEquippedItemChange(item.id, 'description', e.target.value)} placeholder="Descrição" className="text-sm text-gray-300 italic w-full p-1 bg-gray-700 border border-gray-500 rounded-md mb-2" disabled={user.uid !== character.ownerUid && !isMaster} />
                                        <AutoResizingTextarea value={item.attributes} onChange={(e) => handleEquippedItemChange(item.id, 'attributes', e.target.value)} placeholder="Atributos/Efeitos" className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-sm" disabled={user.uid !== character.ownerUid && !isMaster} />
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                    {(user.uid === character.ownerUid || isMaster) && (
                        <div className="flex justify-end mt-4">
                            <button onClick={handleAddEquippedItem} className="w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white text-2xl font-bold rounded-full shadow-lg" aria-label="Adicionar Item Equipado">+</button>
                        </div>
                    )}
                </>
            )}
        </section>
    </div>
);
};

const StoryAndNotesSection = ({ character, user, isMaster, addHistoryBlock, removeHistoryBlock, updateHistoryBlock, addNoteBlock, removeNoteBlock, updateNoteBlock, handleDragStart, handleDragOver, handleDrop, toggleSection }) => {
    const truncateText = (text, maxLines = 2) => {
        if (!text) return '';
        const lines = text.split('\n');
        return lines.length <= maxLines ? text : lines.slice(0, maxLines).join('\n') + '...';
    };

    const renderBlock = (block, index, type, removeFunc, updateFunc) => (
        <div key={block.id} className="p-3 bg-gray-600 rounded-md shadow-sm border border-gray-500 relative" draggable onDragStart={(e) => handleDragStart(e, index, type)} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, index, type)}>
            {(user.uid === character.ownerUid || isMaster || type === 'notes') && (
                <button onClick={() => removeFunc(block.id)} className="absolute top-2 right-2 px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-full">X</button>
            )}
            {block.type === 'text' ? (
                block.isCollapsed ? (
                    <div className="cursor-pointer" onClick={() => updateFunc(block.id, 'isCollapsed', false)}>
                        <p className="text-lg font-semibold mb-1">Bloco de Texto</p>
                        <p className="text-sm italic text-gray-300">{truncateText(block.value)}</p>
                    </div>
                ) : (
                    <>
                        <AutoResizingTextarea value={block.value} onChange={(e) => updateFunc(block.id, 'value', e.target.value)} placeholder="Digite aqui..." className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md" disabled={type === 'history' && user.uid !== character.ownerUid && !isMaster} />
                        <button onClick={() => updateFunc(block.id, 'isCollapsed', true)} className="mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-xs font-bold rounded-md self-end">Ocultar</button>
                    </>
                )
            ) : ( 
                block.isCollapsed ? (
                    <div className="cursor-pointer text-center py-2" onClick={() => updateFunc(block.id, 'isCollapsed', false)}>
                        <p className="text-lg font-semibold">Mostrar Imagem</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center">
                        <img src={block.value} alt="Imagem da história" className="max-w-full h-auto rounded-md shadow-md" style={{ width: block.fitWidth ? '100%' : (block.width ? `${block.width}px` : 'auto'), height: block.fitWidth ? 'auto' : (block.height ? `${block.height}px` : 'auto'), objectFit: 'contain' }} onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/300x200/000000/FFFFFF?text=Erro'; }} />
                        {(user.uid === character.ownerUid || isMaster || type === 'notes') && (
                            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm">
                                <label><input type="checkbox" checked={block.fitWidth} onChange={(e) => updateFunc(block.id, 'fitWidth', e.target.checked)} className="form-checkbox text-purple-500 rounded" /> Ajustar à Largura</label>
                                {!block.fitWidth && (
                                    <>
                                        <label>Largura (px): <input type="number" value={block.width === 0 ? '' : block.width} onChange={(e) => updateFunc(block.id, 'width', e.target.value)} className="w-20 p-1 bg-gray-700 border rounded-md text-center" /></label>
                                        <label>Altura (px): <input type="number" value={block.height === 0 ? '' : block.height} onChange={(e) => updateFunc(block.id, 'height', e.target.value)} className="w-20 p-1 bg-gray-700 border rounded-md text-center" /></label>
                                    </>
                                )}
                            </div>
                        )}
                        <button onClick={() => updateFunc(block.id, 'isCollapsed', true)} className="mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-xs font-bold rounded-md self-end">Ocultar</button>
                    </div>
                )
            )}
        </div>
    );

    return (
        <div>
            <section id="story" className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
                <h2 className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center" onClick={() => toggleSection('isHistoryCollapsed')}>
                    História do Personagem
                    <span>{character.isHistoryCollapsed ? '▼' : '▲'}</span>
                </h2>
                {!character.isHistoryCollapsed && (
                    <>
                        <div className="space-y-4 mb-4">
                            {(character.history || []).length === 0 ? <p className="text-gray-400 italic">Nenhum bloco de história adicionado.</p> : character.history.map((block, index) => renderBlock(block, index, 'history', removeHistoryBlock, updateHistoryBlock))}
                        </div>
                        {(user.uid === character.ownerUid || isMaster) && (
                            <div className="flex flex-wrap gap-4 mt-4 justify-center">
                                <button onClick={() => addHistoryBlock('text')} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 font-bold rounded-lg">Adicionar Texto</button>
                                <button onClick={() => addHistoryBlock('image')} className="px-6 py-2 bg-purple-600 hover:bg-purple-700 font-bold rounded-lg">Adicionar Imagem</button>
                            </div>
                        )}
                    </>
                )}
            </section>
            <section id="notes" className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
                <h2 className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center" onClick={() => toggleSection('isNotesCollapsed')}>
                    Anotações
                    <span>{character.isNotesCollapsed ? '▼' : '▲'}</span>
                </h2>
                {!character.isNotesCollapsed && (
                    <>
                        <div className="space-y-4 mb-4">
                            {(character.notes || []).length === 0 ? <p className="text-gray-400 italic">Nenhum bloco de anotação adicionado.</p> : character.notes.map((block, index) => renderBlock(block, index, 'notes', removeNoteBlock, updateNoteBlock))}
                        </div>
                         <div className="flex flex-wrap gap-4 mt-4 justify-center">
                            <button onClick={() => addNoteBlock('text')} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 font-bold rounded-lg">Adicionar Texto</button>
                            <button onClick={() => addNoteBlock('image')} className="px-6 py-2 bg-purple-600 hover:bg-purple-700 font-bold rounded-lg">Adicionar Imagem</button>
                        </div>
                    </>
                )}
            </section>
        </div>
    );
};

const ActionButtons = ({ character, user, isMaster, isLoading, handleExportJson, handleImportJsonClick, handleReset }) => (
    <div className="flex flex-wrap justify-center gap-4 mt-8">
        <button onClick={handleExportJson} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-lg" disabled={isLoading || !user || !character}>
            Exportar Ficha (JSON)
        </button>
        <button onClick={handleImportJsonClick} className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-lg" disabled={isLoading || !user}>
            Importar Ficha (JSON)
        </button>
        <button onClick={handleReset} className="px-8 py-3 bg-red-700 hover:bg-red-800 text-white font-bold rounded-lg shadow-lg" disabled={isLoading || !user || (user.uid !== character.ownerUid && !isMaster)}>
            Resetar Ficha
        </button>
    </div>
);

// ============================================================================
// --- Componente Principal (Cérebro da Aplicação) ---
// ============================================================================

const initialCharState = {
  name: '', photoUrl: '', age: '', height: '', gender: '', race: '', class: '', alignment: '', level: 0, xp: 100,
  mainAttributes: { hp: { current: 0, max: 0, temp: 0 }, mp: { current: 0, max: 0 }, initiative: 0, fa: 0, fm: 0, fd: 0 },
  attributes: [], inventory: [], wallet: { zeni: 0 }, advantages: [], disadvantages: [], abilities: [],
  specializations: [], equippedItems: [], history: [], notes: [], buffs: [], formulaActions: [],
  discordWebhookUrl: '',
  isUserStatusCollapsed: false, isCharacterInfoCollapsed: false, isMainAttributesCollapsed: false,
  isAttributesCollapsed: false, isInventoryCollapsed: false, isWalletCollapsed: false, isPerksCollapsed: false,
  isAbilitiesCollapsed: false, isSpecializationsCollapsed: false, isEquippedItemsCollapsed: false,
  isHistoryCollapsed: false, isNotesCollapsed: false, isQuickActionsCollapsed: false, isDiscordCollapsed: false,
};

const App = () => {
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
  const [actionModal, setActionModal] = useState({ isVisible: false, type: '', title: '' });
  const [rollModal, setRollModal] = useState({ isVisible: false, attribute: null });
  const [isLoading, setIsLoading] = useState(false);
  const [zeniAmount, setZeniAmount] = useState(0);
  const fileInputRef = useRef(null);

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
          setViewingAllCharacters(false);
          setIsMaster(false);
        }
      });
      return () => unsubscribe();
    } catch (error) {
      console.error("Erro ao inicializar Firebase:", error);
      setModal({ isVisible: true, message: `Erro ao inicializar: ${error.message}`, type: 'info', onClose: () => setModal({ isVisible: false }) });
    }
  }, [firebaseConfig, appId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSelectedCharIdState(params.get('charId'));
    setOwnerUidState(params.get('ownerUid'));
  }, []);

  useEffect(() => {
    if (db && user && isAuthReady) {
      const userRoleDocRef = doc(db, `artifacts/${appId}/users/${user.uid}`);
      const unsubscribe = onSnapshot(userRoleDocRef, (docSnap) => {
        setIsMaster(docSnap.exists() && docSnap.data().isMaster === true);
      }, (error) => {
        console.error("Erro ao carregar papel do usuário:", error);
        setIsMaster(false);
      });
      return () => unsubscribe();
    } else {
      setIsMaster(false);
    }
  }, [db, user, isAuthReady, appId]);

  const fetchCharactersList = useCallback(async () => {
    if (!db || !user || !isAuthReady) return;
    setIsLoading(true);
    try {
      let allChars = [];
      if (isMaster && viewingAllCharacters) {
        const usersCollectionRef = collection(db, `artifacts/${appId}/users`);
        const usersSnapshot = await getDocs(usersCollectionRef);
        
        const promises = usersSnapshot.docs.map(async (userDoc) => {
          const userUid = userDoc.id;
          const userCharacterSheetsRef = collection(db, `artifacts/${appId}/users/${userUid}/characterSheets`);
          const charSnapshot = await getDocs(userCharacterSheetsRef);
          return charSnapshot.docs
            .filter(doc => !doc.data().deleted)
            .map(doc => ({ id: doc.id, ownerUid: userUid, ...doc.data() }));
        });

        const charactersByOwner = await Promise.all(promises);
        allChars = charactersByOwner.flat();

      } else {
        const charactersCollectionRef = collection(db, `artifacts/${appId}/users/${user.uid}/characterSheets`);
        const q = query(charactersCollectionRef);
        const querySnapshot = await getDocs(q);
        allChars = querySnapshot.docs
            .filter(doc => !doc.data().deleted)
            .map(doc => ({ id: doc.id, ownerUid: user.uid, ...doc.data() }));
      }
      setCharactersList(allChars);
    } catch (error) {
      console.error("Erro ao carregar lista de personagens:", error);
      setModal({ isVisible: true, message: `Erro ao carregar personagens: ${error.message}`, type: 'info', onClose: () => setModal({ isVisible: false }) });
    } finally {
      setIsLoading(false);
    }
  }, [db, user, isAuthReady, isMaster, appId, viewingAllCharacters]);

  useEffect(() => {
    if (user && db && isAuthReady) {
      fetchCharactersList();
    }
  }, [user, db, isAuthReady, viewingAllCharacters, fetchCharactersList]);

  useEffect(() => {
    if (!db || !user || !isAuthReady || !selectedCharIdState) {
        if (!selectedCharIdState) setCharacter(null);
        return;
    }

    const loadCharacter = async () => {
        setIsLoading(true);
        let targetUid = ownerUidState;

        if (!targetUid && isMaster) {
            const usersSnapshot = await getDocs(collection(db, `artifacts/${appId}/users`));
            for (const userDoc of usersSnapshot.docs) {
                const charSnap = await getDoc(doc(db, `artifacts/${appId}/users/${userDoc.id}/characterSheets/${selectedCharIdState}`));
                if (charSnap.exists()) {
                    targetUid = userDoc.id;
                    setOwnerUidState(targetUid);
                    break;
                }
            }
        } else if (!targetUid) {
            targetUid = user.uid;
            setOwnerUidState(user.uid);
        }
        
        if (!targetUid) {
            console.error("Não foi possível determinar o UID do proprietário.");
            setIsLoading(false);
            return;
        }

        const characterDocRef = doc(db, `artifacts/${appId}/users/${targetUid}/characterSheets/${selectedCharIdState}`);
        const unsubscribe = onSnapshot(characterDocRef, (docSnap) => {
            if (docSnap.exists() && !docSnap.data().deleted) {
                const data = docSnap.data();
                const deserializedData = { ...data };
                Object.keys(deserializedData).forEach(key => {
                    if (typeof deserializedData[key] === 'string') {
                        try {
                            const parsed = JSON.parse(deserializedData[key]);
                            deserializedData[key] = parsed;
                        } catch (e) { /* Ignora */ }
                    }
                });
                
                let fullCharacter = { ...initialCharState, ...deserializedData };
                
                // Garantir que novas propriedades existam nos dados antigos
                 if (fullCharacter.attributes && Array.isArray(fullCharacter.attributes)) {
                  fullCharacter.attributes = fullCharacter.attributes.map(attr => ({
                    ...attr,
                    isCollapsed: attr.isCollapsed === undefined ? true : attr.isCollapsed
                  }));
                }

                if (fullCharacter.formulaActions && Array.isArray(fullCharacter.formulaActions)) {
                  fullCharacter.formulaActions = fullCharacter.formulaActions.map(action => ({
                    ...action,
                    isCollapsed: action.isCollapsed === undefined ? true : action.isCollapsed
                  }));
                }

                setCharacter(fullCharacter);
            } else {
                setCharacter(null);
                setSelectedCharIdState(null);
                setOwnerUidState(null);
                fetchCharactersList();
            }
            setIsLoading(false);
        }, (error) => {
            console.error("Erro ao ouvir a ficha:", error);
            setIsLoading(false);
        });
        return unsubscribe;
    };

    let unsubscribePromise = loadCharacter();
    
    return () => {
        unsubscribePromise.then(unsubscribe => {
            if (unsubscribe) unsubscribe();
        });
    };
  }, [db, user, isAuthReady, selectedCharIdState, ownerUidState, appId, isMaster, fetchCharactersList]);

  useEffect(() => {
    if (!db || !user || !isAuthReady || !character || !selectedCharIdState) return;
    
    const targetUidForSave = character.ownerUid || user.uid;
    if (user.uid !== targetUidForSave && !isMaster) return;

    const handler = setTimeout(async () => {
      try {
        const characterDocRef = doc(db, `artifacts/${appId}/users/${targetUidForSave}/characterSheets/${selectedCharIdState}`);
        const dataToSave = { ...character };
        Object.keys(dataToSave).forEach(key => {
            if (typeof dataToSave[key] === 'object' && dataToSave[key] !== null) {
                dataToSave[key] = JSON.stringify(dataToSave[key]);
            }
        });
        await setDoc(characterDocRef, dataToSave, { merge: true });
      } catch (error) {
        console.error('Erro ao salvar ficha:', error);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [character, db, user, isAuthReady, selectedCharIdState, appId, isMaster]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const isNumeric = ['age', 'level', 'xp'].includes(name);
    setCharacter(prev => ({ ...prev, [name]: isNumeric ? parseInt(value, 10) || 0 : value }));
  };

  const handleMainAttributeChange = (e) => {
    const { name, value, dataset } = e.target;
    const attributeName = dataset.attribute;
    const parsedValue = parseInt(value, 10) || 0;
    setCharacter(prev => ({ ...prev, mainAttributes: { ...prev.mainAttributes, [attributeName]: { ...prev.mainAttributes[attributeName], [name]: parsedValue } } }));
  };
  
  const handleSingleMainAttributeChange = (e) => {
    const { name, value } = e.target;
    setCharacter(prev => ({ ...prev, mainAttributes: { ...prev.mainAttributes, [name]: parseInt(value, 10) || 0 } }));
  };

  const handleAddAttribute = () => setCharacter(prev => ({ ...prev, attributes: [...(prev.attributes || []), { id: crypto.randomUUID(), name: '', base: 0, perm: 0, temp: 0, arma: 0, isCollapsed: false }] }));
  const handleRemoveAttribute = (id) => setCharacter(prev => ({ ...prev, attributes: (prev.attributes || []).filter(attr => attr.id !== id) }));
  const handleAttributeChange = (id, field, value) => {
    setCharacter(prev => ({
      ...prev,
      attributes: (prev.attributes || []).map(attr => {
        if (attr.id === id) {
          return { ...attr, [field]: field === 'name' ? value : parseInt(value, 10) || 0 };
        }
        return attr;
      })
    }));
  };
   const handleToggleAttributeCollapsed = (id) => {
        setCharacter(prev => ({
            ...prev,
            attributes: (prev.attributes || []).map(attr =>
                attr.id === id ? { ...attr, isCollapsed: !attr.isCollapsed } : attr
            )
        }));
    };
  
  const toggleItemCollapsed = (listName, id) => setCharacter(prev => ({ ...prev, [listName]: (prev[listName] || []).map(item => item.id === id ? { ...item, isCollapsed: !item.isCollapsed } : item) }));
  const handleAddItem = () => setCharacter(prev => ({ ...prev, inventory: [...(prev.inventory || []), { id: crypto.randomUUID(), name: '', description: '', isCollapsed: true }] }));
  const handleInventoryItemChange = (id, field, value) => setCharacter(prev => ({ ...prev, inventory: (prev.inventory || []).map(item => item.id === id ? { ...item, [field]: value } : item) }));
  const handleRemoveItem = (id) => setCharacter(prev => ({ ...prev, inventory: (prev.inventory || []).filter(item => item.id !== id) }));
  
  const handleZeniChange = (e) => setZeniAmount(parseInt(e.target.value, 10) || 0);
  const handleAddZeni = () => { setCharacter(prev => ({ ...prev, wallet: { ...prev.wallet, zeni: ((prev.wallet || {}).zeni || 0) + zeniAmount } })); setZeniAmount(0); };
  const handleRemoveZeni = () => { setCharacter(prev => ({ ...prev, wallet: { ...prev.wallet, zeni: Math.max(0, ((prev.wallet || {}).zeni || 0) - zeniAmount) } })); setZeniAmount(0); };
  
  const handleAddPerk = (type) => setCharacter(prev => ({ ...prev, [type]: [...(prev[type] || []), { id: crypto.randomUUID(), name: '', description: '', origin: { class: false, race: false, manual: false }, value: 0, isCollapsed: false }] }));
  const handlePerkChange = (type, id, field, value) => setCharacter(prev => ({ ...prev, [type]: (prev[type] || []).map(p => p.id === id ? { ...p, [field]: field === 'value' ? parseInt(value, 10) || 0 : value } : p) }));
  const handleRemovePerk = (type, id) => setCharacter(prev => ({ ...prev, [type]: (prev[type] || []).filter(p => p.id !== id) }));
  const handlePerkOriginChange = (type, id, originType) => setCharacter(prev => ({ ...prev, [type]: (prev[type] || []).map(p => p.id === id ? { ...p, origin: { ...p.origin, [originType]: !p.origin[originType] } } : p) }));
  
  const handleAddAbility = () => setCharacter(prev => ({ ...prev, abilities: [...(prev.abilities || []), { id: crypto.randomUUID(), title: '', description: '', isCollapsed: false }] }));
  const handleAbilityChange = (id, field, value) => setCharacter(prev => ({ ...prev, abilities: (prev.abilities || []).map(a => a.id === id ? { ...a, [field]: value } : a) }));
  const handleRemoveAbility = (id) => setCharacter(prev => ({ ...prev, abilities: (prev.abilities || []).filter(a => a.id !== id) }));
  
  const handleAddSpecialization = () => setCharacter(prev => ({ ...prev, specializations: [...(prev.specializations || []), { id: crypto.randomUUID(), name: '', modifier: 0, bonus: 0, isCollapsed: false }] }));
  const handleSpecializationChange = (id, field, value) => setCharacter(prev => ({ ...prev, specializations: (prev.specializations || []).map(s => s.id === id ? { ...s, [field]: field === 'name' ? value : parseInt(value, 10) || 0 } : s) }));
  const handleRemoveSpecialization = (id) => setCharacter(prev => ({ ...prev, specializations: (prev.specializations || []).filter(s => s.id !== id) }));

  const handleAddEquippedItem = () => setCharacter(prev => ({ ...prev, equippedItems: [...(prev.equippedItems || []), { id: crypto.randomUUID(), name: '', description: '', attributes: '', isCollapsed: false }] }));
  const handleEquippedItemChange = (id, field, value) => setCharacter(prev => ({ ...prev, equippedItems: (prev.equippedItems || []).map(i => i.id === id ? { ...i, [field]: value } : i) }));
  const handleRemoveEquippedItem = (id) => setCharacter(prev => ({ ...prev, equippedItems: (prev.equippedItems || []).filter(i => i.id !== id) }));
  
  const addHistoryBlock = (type) => {
    const newBlock = type === 'text'
      ? { id: crypto.randomUUID(), type: 'text', value: '', isCollapsed: false }
      : { id: crypto.randomUUID(), type: 'image', value: '', width: '', height: '', fitWidth: true, isCollapsed: false };
    
    if (type === 'image') {
        setModal({ isVisible: true, message: 'Cole a URL da imagem:', type: 'prompt', onConfirm: (url) => {
            if(url) setCharacter(prev => ({ ...prev, history: [...(prev.history || []), { ...newBlock, value: url }] }));
            setModal({ isVisible: false });
        }, onCancel: () => setModal({ isVisible: false }) });
    } else {
        setCharacter(prev => ({ ...prev, history: [...(prev.history || []), newBlock] }));
    }
  };
  const updateHistoryBlock = (id, field, value) => setCharacter(prev => ({ ...prev, history: (prev.history || []).map(b => b.id === id ? { ...b, [field]: value } : b) }));
  const removeHistoryBlock = (id) => setCharacter(prev => ({ ...prev, history: (prev.history || []).filter(b => b.id !== id) }));
  
  const addNoteBlock = (type) => {
    const newBlock = type === 'text'
      ? { id: crypto.randomUUID(), type: 'text', value: '', isCollapsed: false }
      : { id: crypto.randomUUID(), type: 'image', value: '', width: '', height: '', fitWidth: true, isCollapsed: false };
    
    if (type === 'image') {
        setModal({ isVisible: true, message: 'Cole a URL da imagem:', type: 'prompt', onConfirm: (url) => {
            if(url) setCharacter(prev => ({ ...prev, notes: [...(prev.notes || []), { ...newBlock, value: url }] }));
            setModal({ isVisible: false });
        }, onCancel: () => setModal({ isVisible: false }) });
    } else {
        setCharacter(prev => ({ ...prev, notes: [...(prev.notes || []), newBlock] }));
    }
  };
  const updateNoteBlock = (id, field, value) => setCharacter(prev => ({ ...prev, notes: (prev.notes || []).map(b => b.id === id ? { ...b, [field]: value } : b) }));
  const removeNoteBlock = (id) => setCharacter(prev => ({ ...prev, notes: (prev.notes || []).filter(b => b.id !== id) }));

  const handleAddBuff = () => {
      const newBuff = {
          id: crypto.randomUUID(), name: '', type: 'attribute', target: '', value: 0, costValue: 0, costType: '', isActive: false, isCollapsed: false,
      };
      setCharacter(prev => ({ ...prev, buffs: [...(prev.buffs || []), newBuff] }));
  };
  const handleRemoveBuff = (id) => {
      setCharacter(prev => ({ ...prev, buffs: (prev.buffs || []).filter(b => b.id !== id) }));
  };
  const handleBuffChange = (id, field, value) => {
      setCharacter(prev => ({
          ...prev,
          buffs: (prev.buffs || []).map(buff => {
              if (buff.id === id) {
                  const updatedBuff = { ...buff };
                  updatedBuff[field] = value;
                  if (field === 'value') {
                      if (buff.type === 'attribute') {
                          updatedBuff.value = parseInt(value, 10) || 0;
                      }
                  }
                  if (field === 'costValue') {
                      updatedBuff.costValue = parseInt(value, 10) || 0;
                  }
                  if (field === 'type') {
                      updatedBuff.target = '';
                      updatedBuff.value = value === 'attribute' ? 0 : '';
                  }
                  return updatedBuff;
              }
              return buff;
          })
      }));
  };
  const handleToggleBuffActive = (id) => {
      setCharacter(prev => ({ ...prev, buffs: (prev.buffs || []).map(buff => buff.id === id ? { ...buff, isActive: !buff.isActive } : buff)}));
  };
  const handleToggleBuffCollapsed = (id) => {
      setCharacter(prev => ({ ...prev, buffs: (prev.buffs || []).map(buff => buff.id === id ? { ...buff, isCollapsed: !buff.isCollapsed } : buff)}));
  };
  
  const handleToggleCustomActionCollapsed = (id) => {
      setCharacter(prev => ({ ...prev, formulaActions: (prev.formulaActions || []).map(action => action.id === id ? { ...action, isCollapsed: !action.isCollapsed } : action)}));
  };

  const handleOpenActionModal = (type) => {
    const title = type === 'heal' ? 'Curar / Restaurar' : 'Receber Dano / Perder';
    setActionModal({ isVisible: true, type, title });
  };
  
  const handleConfirmAction = (amount, target) => {
    let message = '';
    const charName = character.name || 'Personagem';
  
    setCharacter(prev => {
        const newMain = { ...prev.mainAttributes };
        if (actionModal.type === 'heal') {
            switch(target) {
                case 'HP':
                    newMain.hp.current = Math.min(newMain.hp.max, newMain.hp.current + amount);
                    message = `${charName} recuperou ${amount} de HP.`;
                    break;
                case 'HP Temporário':
                    newMain.hp.temp = (newMain.hp.temp || 0) + amount;
                    message = `${charName} recebeu ${amount} de HP Temporário.`;
                    break;
                case 'MP':
                    newMain.mp.current = Math.min(newMain.mp.max, newMain.mp.current + amount);
                    message = `${charName} recuperou ${amount} de MP.`;
                    break;
                default: break;
            }
        } else { // damage
            switch(target) {
                case 'HP':
                    let remainingDamage = amount;
                    const damageToTemp = Math.min(remainingDamage, newMain.hp.temp || 0);
                    newMain.hp.temp -= damageToTemp;
                    remainingDamage -= damageToTemp;
                    if (remainingDamage > 0) {
                        newMain.hp.current -= remainingDamage;
                    }
                    message = `${charName} perdeu ${amount} de HP.`;
                    break;
                case 'HP Temporário':
                    newMain.hp.temp = Math.max(0, (newMain.hp.temp || 0) - amount);
                    message = `${charName} perdeu ${amount} de HP Temporário.`;
                    break;
                case 'MP':
                    newMain.mp.current = Math.max(0, newMain.mp.current - amount);
                    message = `${charName} perdeu ${amount} de MP.`;
                    break;
                default: break;
            }
        }
        return { ...prev, mainAttributes: newMain };
    });

    if (character.discordWebhookUrl) {
        fetch(character.discordWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    author: {
                        name: character.name || 'Personagem',
                        icon_url: character.photoUrl || 'https://placehold.co/64x64/7c3aed/FFFFFF?text=SC'
                    },
                    description: message,
                    color: actionModal.type === 'heal' ? 0x22c55e : 0xef4444
                }]
            })
        }).catch(e => console.error("Falha ao enviar para o Discord:", e));
    } else {
        setModal({ isVisible: true, message, type: 'info', onClose: () => setModal({isVisible: false}) });
    }
  };
  
  const allAttributes = useMemo(() => {
    const mainAttrs = ['Iniciativa', 'FA', 'FM', 'FD'];
    const dynamicAttrs = (character?.attributes || []).map(attr => attr.name).filter(Boolean);
    return [...mainAttrs, ...dynamicAttrs];
  }, [character?.attributes]);

  const handleAddFormulaAction = () => {
    const newAction = {
      id: crypto.randomUUID(),
      name: 'Nova Ação',
      components: [{ id: crypto.randomUUID(), type: 'dice', value: '1d6' }],
      multiplier: 1,
      discordText: 'Usa sua nova ação.',
      isCollapsed: false,
      costValue: 0,
      costType: '',
    };
    setCharacter(prev => ({ ...prev, formulaActions: [...(prev.formulaActions || []), newAction] }));
  };

  const handleRemoveFormulaAction = (actionId) => {
    setCharacter(prev => ({ ...prev, formulaActions: (prev.formulaActions || []).filter(a => a.id !== actionId) }));
  };
  
  const handleFormulaActionChange = (actionId, field, value) => {
    setCharacter(prev => ({
        ...prev,
        formulaActions: (prev.formulaActions || []).map(a => 
            a.id === actionId 
            ? { ...a, 
                [field]: 
                    field === 'multiplier' 
                    ? (parseInt(value, 10) || 1) 
                    : (field === 'costValue' ? (parseInt(value, 10) || 0) : value) 
              } 
            : a
        )
    }));
  };

  const handleAddActionComponent = (actionId, type) => {
    const newComponent = { id: crypto.randomUUID(), type, value: type === 'dice' ? '1d6' : '' };
    setCharacter(prev => ({
        ...prev,
        formulaActions: (prev.formulaActions || []).map(a => 
            a.id === actionId ? { ...a, components: [...(a.components || []), newComponent] } : a
        )
    }));
  };

  const handleRemoveActionComponent = (actionId, componentId) => {
     setCharacter(prev => ({
        ...prev,
        formulaActions: (prev.formulaActions || []).map(a => 
            a.id === actionId ? { ...a, components: (a.components || []).filter(c => c.id !== componentId) } : a
        )
    }));
  };

  const handleActionComponentChange = (actionId, componentId, field, value) => {
     setCharacter(prev => ({
        ...prev,
        formulaActions: (prev.formulaActions || []).map(a => 
            a.id === actionId 
            ? { ...a, components: (a.components || []).map(c => c.id === componentId ? { ...c, [field]: value } : c) } 
            : a
        )
    }));
  };
  
  const { mainAttributeModifiers, dynamicAttributeModifiers } = useMemo(() => {
    const mainMods = {};
    const dynamicMods = {};
    if (!character?.buffs) return { mainAttributeModifiers: mainMods, dynamicAttributeModifiers: dynamicMods };
    
    character.buffs.forEach(buff => {
        if (buff.isActive && buff.type === 'attribute' && buff.target) {
            const value = parseInt(buff.value, 10) || 0;
            if (['Iniciativa', 'FA', 'FM', 'FD'].includes(buff.target)) {
                mainMods[buff.target] = (mainMods[buff.target] || 0) + value;
            } else {
                dynamicMods[buff.target] = (dynamicMods[buff.target] || 0) + value;
            }
        }
    });
    return { mainAttributeModifiers: mainMods, dynamicAttributeModifiers: dynamicMods };
  }, [character?.buffs]);

  const handleOpenRollModal = (attributeId) => {
        const attribute = character.attributes.find(attr => attr.id === attributeId);
        if (attribute) {
            setRollModal({ isVisible: true, attribute: attribute });
        }
    };

    const handleConfirmAttributeRoll = async (dice, bonus) => {
        if (!rollModal.attribute) return;
        
        const attribute = rollModal.attribute;
        const tempValue = dynamicAttributeModifiers[attribute.name] || 0;
        const attributeTotal = (attribute.base || 0) + (attribute.perm || 0) + tempValue + (attribute.arma || 0);

        let diceResult = 0;
        let diceDetails = '';
        let rollFormulaForRoll20 = '';

        const match = dice.match(/(\d+)d(\d+)/i);
        if (match) {
            const numDice = parseInt(match[1], 10);
            const numSides = parseInt(match[2], 10);
            let rolls = [];
            for (let d = 0; d < numDice; d++) {
                const roll = Math.floor(Math.random() * numSides) + 1;
                rolls.push(roll === numSides ? `**${roll}**` : roll);
                diceResult += roll;
            }
            diceDetails = `${dice}(${rolls.join('+')})`;
            rollFormulaForRoll20 = dice;
        } else {
            diceResult = parseInt(dice, 10) || 0;
            diceDetails = `${diceResult}`;
            rollFormulaForRoll20 = `${diceResult}`;
        }
        
        const finalTotal = diceResult + attributeTotal + bonus;
        
        const details = [diceDetails, `${attribute.name}(${attributeTotal})`];
        if (bonus !== 0) {
            details.push(`Bônus(${bonus > 0 ? '+' : ''}${bonus})`);
        }
        
        const roll20Bonus = `+${attributeTotal}${bonus !== 0 ? (bonus > 0 ? `+${bonus}`: bonus) : ''}`;
        const roll20Command = `/r ${rollFormulaForRoll20}${roll20Bonus} Rolando ${attribute.name}`;

        if (character.discordWebhookUrl) {
            const embed = {
                author: {
                    name: character.name || 'Personagem',
                    icon_url: character.photoUrl || 'https://placehold.co/64x64/7c3aed/FFFFFF?text=SC'
                },
                title: `Rolagem de ${attribute.name}`,
                description: `**Resultado Final: ${finalTotal}**`,
                fields: [
                    { name: 'Detalhes', value: details.join(' + '), inline: false }
                ],
                color: 0x8b5cf6,
            };
            try {
                await fetch(character.discordWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ embeds: [embed] })
                });
            } catch (e) {
                setModal({ isVisible: true, message: `Falha ao enviar para o Discord: ${e.message}`, type: 'info', onClose: () => setModal({ isVisible: false }) });
            }
        } else {
             setModal({ 
                isVisible: true, 
                message: `Resultado: ${finalTotal}\n\nDetalhes: ${details.join(' + ')}`, 
                type: 'info', 
                onClose: () => setModal({ isVisible: false }),
                showCopyButton: true,
                copyText: roll20Command
            });
        }
        
        setRollModal({ isVisible: false, attribute: null });
    };

  const handleExecuteFormulaAction = async (actionId) => {
    const action = character.formulaActions.find(a => a.id === actionId);
    if (!action) return;

    try {
        const multiplier = action.multiplier || 1;
        let totalCost = { HP: 0, MP: 0 };
        let costDetails = [];

        if (action.costType && action.costValue > 0) {
            totalCost[action.costType] += action.costValue;
            costDetails.push(`Ação: ${action.costValue} ${action.costType}`);
        }

        const activeBuffs = (character.buffs || []).filter(b => b.isActive);
        const activeBuffNames = activeBuffs.map(b => b.name).filter(Boolean);

        activeBuffs.forEach(buff => {
            if(buff.costType && buff.costValue > 0) {
                const buffCost = buff.costValue * multiplier;
                totalCost[buff.costType] += buffCost;
                costDetails.push(`${buff.name}: ${buffCost} ${buff.costType}`);
            }
        });

        if (character.mainAttributes.hp.current < totalCost.HP || character.mainAttributes.mp.current < totalCost.MP) {
            setModal({ isVisible: true, message: `Custo de HP/MP insuficiente!\nNecessário: ${totalCost.HP > 0 ? `${totalCost.HP} HP` : ''} ${totalCost.MP > 0 ? `${totalCost.MP} MP` : ''}`, type: 'info', onClose: () => setModal({ isVisible: false }) });
            return;
        }

        let tempCharacter = { ...character };
        if(totalCost.HP > 0) tempCharacter.mainAttributes.hp.current -= totalCost.HP;
        if(totalCost.MP > 0) tempCharacter.mainAttributes.mp.current -= totalCost.MP;
        
        let rollFormulaForRoll20 = '';
        let totalResult = 0;
        let rollDetails = [];

        for (let i = 0; i < multiplier; i++) {
            for (const comp of action.components) {
                if (comp.type === 'dice') {
                    const match = comp.value.match(/(\d+)d(\d+)/i);
                    rollFormulaForRoll20 += `+${comp.value}`;
                    if (match) {
                        const numDice = parseInt(match[1], 10);
                        const numSides = parseInt(match[2], 10);
                        let rolls = [];
                        for (let d = 0; d < numDice; d++) {
                            const roll = Math.floor(Math.random() * numSides) + 1;
                            rolls.push(roll === numSides ? `**${roll}**` : roll);
                            totalResult += roll;
                        }
                        rollDetails.push(`${comp.value}(${rolls.join('+')})`);
                    } else {
                        const num = parseInt(comp.value, 10) || 0;
                        totalResult += num;
                        rollDetails.push(`${num}`);
                    }
                } else { // attribute
                    const attrName = comp.value;
                    let attrValue = 0;
                     if (['Iniciativa', 'FA', 'FM', 'FD'].includes(attrName)) {
                         attrValue = (tempCharacter.mainAttributes[attrName.toLowerCase()] || 0) + (mainAttributeModifiers[attrName] || 0);
                     } else {
                         const dynamicAttr = tempCharacter.attributes.find(a => a.name === attrName);
                         if(dynamicAttr) {
                            attrValue = (dynamicAttr.base || 0) + (dynamicAttr.perm || 0) + (dynamicAttr.arma || 0) + (dynamicAttributeModifiers[attrName] || 0);
                         }
                     }
                    totalResult += attrValue;
                    rollDetails.push(`${attrName}(${attrValue})`);
                    rollFormulaForRoll20 += `+${attrValue}`;
                }
            }
        }
        
        activeBuffs.forEach(buff => {
            if (buff.type === 'dice' && buff.value) {
                const match = buff.value.match(/(\d+)d(\d+)/i);
                rollFormulaForRoll20 += `+${buff.value}`;
                if (match) {
                    const numDice = parseInt(match[1], 10);
                    const numSides = parseInt(match[2], 10);
                    let rolls = [];
                    for (let d = 0; d < numDice; d++) {
                        const roll = Math.floor(Math.random() * numSides) + 1;
                        rolls.push(roll === numSides ? `**${roll}**` : roll);
                        totalResult += roll;
                    }
                    rollDetails.push(`${buff.name}(${rolls.join('+')})`);
                } else {
                    const num = parseInt(buff.value, 10) || 0;
                    totalResult += num;
                    rollDetails.push(`${buff.name}(${num})`);
                }
            }
        });
        
        setCharacter(tempCharacter);
        
        if (character.discordWebhookUrl) {
            const embed = {
                author: {
                    name: character.name || 'Personagem',
                    icon_url: character.photoUrl || 'https://placehold.co/64x64/7c3aed/FFFFFF?text=SC'
                },
                title: action.name || 'Ação Sem Nome',
                description: `${action.discordText || ''}\n\n**Resultado Final: ${totalResult}**`,
                fields: [
                    { name: 'Detalhes da Rolagem', value: rollDetails.join(' + '), inline: false }
                ],
                color: 0x8b5cf6, 
                footer: {}
            };

            if (activeBuffNames.length > 0) {
                embed.fields.push({
                    name: 'Buffs Ativos',
                    value: activeBuffNames.join(', '),
                    inline: false
                });
            }

            if(costDetails.length > 0) {
                embed.footer.text = `Custo Total: ${costDetails.join(' | ')}`;
            }

            try {
                await fetch(character.discordWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ embeds: [embed] })
                });
            } catch (e) {
                setModal({ isVisible: true, message: `Falha ao enviar para o Discord. Verifique a URL do Webhook.\n\nErro: ${e.message}`, type: 'info', onClose: () => setModal({ isVisible: false }) });
            }
        } else {
            const roll20Command = `/r ${rollFormulaForRoll20.substring(1)} ${action.discordText || ''}`;
            let resultMessage = `Resultado: ${totalResult}\n\nDetalhes: ${rollDetails.join(' + ')}`;
            
            if (activeBuffNames.length > 0) {
                resultMessage += `\n\n**Buffs Ativos:** ${activeBuffNames.join(', ')}`;
            }

            setModal({ 
                isVisible: true, 
                message: resultMessage, 
                type: 'info', 
                onClose: () => setModal({ isVisible: false }),
                showCopyButton: true,
                copyText: roll20Command
            });
        }

    } catch (error) {
       setModal({ isVisible: true, message: `Erro ao executar ação: ${error.message}`, type: 'info', onClose: () => setModal({ isVisible: false }) });
    }
  };


  const draggedItemRef = useRef(null);
  const handleDragStart = (e, index, listName) => { draggedItemRef.current = { index, listName }; e.dataTransfer.effectAllowed = "move"; };
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e, dropIndex, targetListName) => {
    e.preventDefault();
    const { index: draggedIndex, listName: draggedListName } = draggedItemRef.current;
    if (draggedIndex === null || draggedListName !== targetListName) return;
    setCharacter(prev => {
        const list = prev[targetListName] || [];
        const newList = [...list];
        const [reorderedItem] = newList.splice(draggedIndex, 1);
        newList.splice(dropIndex, 0, reorderedItem);
        return { ...prev, [targetListName]: newList };
    });
    draggedItemRef.current = null;
  };

  const handleReset = () => {
    setModal({ isVisible: true, message: 'Tem certeza que deseja resetar a ficha?', type: 'confirm', onConfirm: () => {
        setCharacter(prev => ({...initialCharState, id: prev.id, ownerUid: prev.ownerUid, name: prev.name }));
        setModal({ isVisible: false });
    }, onCancel: () => setModal({ isVisible: false }) });
  };

  const handleExportJson = () => {
    if (!character) return;
    const jsonString = JSON.stringify(character, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${character.name || 'ficha'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  
  const handleImportJsonClick = () => fileInputRef.current.click();

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!importedData.name || !importedData.mainAttributes) throw new Error("JSON inválido ou ficha incompatível.");
            
            setModal({
              isVisible: true,
              message: 'Um novo personagem será criado com os dados do arquivo. Deseja continuar?',
              type: 'confirm',
              onConfirm: async () => {
                setModal({ isVisible: false });
                setIsLoading(true);
                try {
                  const newCharId = crypto.randomUUID();
                  const newCharacterData = { ...initialCharState, ...importedData, id: newCharId, ownerUid: user.uid };
                  
                  const characterDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/characterSheets/${newCharId}`);
                  const dataToSave = { ...newCharacterData };
                  Object.keys(dataToSave).forEach(key => {
                      if (typeof dataToSave[key] === 'object' && dataToSave[key] !== null) {
                          dataToSave[key] = JSON.stringify(dataToSave[key]);
                      }
                  });
                  await setDoc(characterDocRef, dataToSave);
                  
                  handleSelectCharacter(newCharId, user.uid);
                  fetchCharactersList();
                } catch (error) {
                   setModal({ isVisible: true, message: `Erro ao importar: ${error.message}`, type: 'info', onClose: () => setModal({ isVisible: false }) });
                } finally {
                   setIsLoading(false);
                }
              },
              onCancel: () => setModal({ isVisible: false })
            });
        } catch (error) {
            setModal({ isVisible: true, message: `Erro ao ler arquivo: ${error.message}`, type: 'info', onClose: () => setModal({ isVisible: false }) });
        }
    };
    reader.readAsText(file);
    event.target.value = null;
  };

  const handleCreateNewCharacter = () => {
    setModal({
      isVisible: true,
      message: 'Nome do novo personagem:',
      type: 'prompt',
      onConfirm: async (name) => {
        setModal({ isVisible: false });
        if (!name) return;

        setIsLoading(true);
        try {
            const newCharId = crypto.randomUUID();
            const newCharacterData = { ...initialCharState, id: newCharId, ownerUid: user.uid, name };
            
            const characterDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/characterSheets/${newCharId}`);
            const dataToSave = { ...newCharacterData };
            Object.keys(dataToSave).forEach(key => {
                if (typeof dataToSave[key] === 'object' && dataToSave[key] !== null) {
                    dataToSave[key] = JSON.stringify(dataToSave[key]);
                }
            });
            await setDoc(characterDocRef, dataToSave);

            handleSelectCharacter(newCharId, user.uid);
            fetchCharactersList();
        } catch (error) {
            setModal({ isVisible: true, message: `Erro ao criar: ${error.message}`, type: 'info', onClose: () => setModal({ isVisible: false }) });
        } finally {
            setIsLoading(false);
        }
      },
      onCancel: () => {
        setModal({ isVisible: false });
      }
    });
  };

  const handleSelectCharacter = (charId, ownerUid) => {
    setSelectedCharIdState(charId);
    setOwnerUidState(ownerUid);
  };

  const handleBackToList = () => {
    setSelectedCharIdState(null);
    setOwnerUidState(null);
    setCharacter(null);
    fetchCharactersList();
  };

  const handleDeleteCharacter = (charId, charName, ownerUid) => {
    setModal({ isVisible: true, message: `Excluir permanentemente '${charName}'?`, type: 'confirm', onConfirm: async () => {
        setModal({ isVisible: false });
        if (!db || !user || (user.uid !== ownerUid && !isMaster)) return;
        setIsLoading(true);
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/users/${ownerUid}/characterSheets/${charId}`));
            handleBackToList();
        } catch (error) {
            setModal({ isVisible: true, message: `Erro ao excluir: ${error.message}`, type: 'info', onClose: () => setModal({ isVisible: false }) });
        } finally {
            setIsLoading(false);
        }
    }, onCancel: () => setModal({ isVisible: false }) });
  };

  const handleGoogleSignIn = async () => {
    if (!auth) return;
    setIsLoading(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      console.error("Erro no login:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!auth) return;
    await signOut(auth);
  };

  const toggleSection = (sectionKey) => setCharacter(prev => prev ? { ...prev, [sectionKey]: !prev[sectionKey] } : prev);
  
  const handlePhotoUrlClick = () => {
    if (!character || (user.uid !== character.ownerUid && !isMaster)) return;
    setModal({ isVisible: true, message: 'Insira a nova URL da imagem:', type: 'prompt', onConfirm: (newUrl) => {
        setCharacter(prev => ({ ...prev, photoUrl: newUrl }));
        setModal({ isVisible: false });
    }, onCancel: () => { setModal({ isVisible: false }); } });
  };
  
  const handleShowOnDiscord = async (title, description) => {
    if (!character) return;

    const embed = {
        author: {
            name: character.name || 'Personagem',
            icon_url: character.photoUrl || 'https://placehold.co/64x64/7c3aed/FFFFFF?text=SC'
        },
        title: title || "Sem Título",
        description: description || "Sem Descrição.",
        color: 0x7c3aed, // Roxo
    };

    if (character.discordWebhookUrl) {
        try {
            await fetch(character.discordWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ embeds: [embed] })
            });
        } catch (e) {
            console.error("Falha ao enviar para o Discord:", e);
            setModal({ isVisible: true, message: `Falha ao enviar para o Discord: ${e.message}`, type: 'info', onClose: () => setModal({ isVisible: false }) });
        }
    } else {
        const discordCommand = `**${title || "Sem Título"}**\n${description || "Sem Descrição."}`;
        setModal({
            isVisible: true,
            message: 'Copie e cole no Discord:',
            type: 'info',
            showCopyButton: true,
            copyText: discordCommand,
            onClose: () => setModal({ isVisible: false }),
        });
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 font-inter">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        html { scroll-behavior: smooth; }
        body { font-family: 'Inter', sans-serif; }
        input[type="number"]::-webkit-outer-spin-button, input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
      `}</style>
      
      <div className="max-w-4xl mx-auto bg-gray-800 rounded-lg shadow-2xl p-6 md:p-8 border border-gray-700">
        <h1 className="text-4xl font-extrabold text-center text-purple-400 mb-8 tracking-wide">Ficha StoryCraft</h1>

        <UserStatusSection 
            isAuthReady={isAuthReady}
            user={user}
            isMaster={isMaster}
            isLoading={isLoading}
            handleSignOut={handleSignOut}
            handleGoogleSignIn={handleGoogleSignIn}
            toggleSection={toggleSection}
            isCollapsed={character?.isUserStatusCollapsed}
        />

        {user && !selectedCharIdState && (
            <CharacterList 
                charactersList={charactersList}
                isLoading={isLoading}
                isMaster={isMaster}
                viewingAllCharacters={viewingAllCharacters}
                user={user}
                handleCreateNewCharacter={handleCreateNewCharacter}
                handleImportJsonClick={handleImportJsonClick}
                setViewingAllCharacters={setViewingAllCharacters}
                handleSelectCharacter={handleSelectCharacter}
                handleDeleteCharacter={handleDeleteCharacter}
            />
        )}

        {user && selectedCharIdState && character && (
            <>
                <FloatingNavMenu />
                <div className="mb-4">
                    <button onClick={handleBackToList} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg">← Voltar para a Lista</button>
                </div>

                <CharacterInfoSection character={character} user={user} isMaster={isMaster} handleChange={handleChange} handlePhotoUrlClick={handlePhotoUrlClick} toggleSection={toggleSection} />
                <MainAttributesSection character={character} user={user} isMaster={isMaster} mainAttributeModifiers={mainAttributeModifiers} dynamicAttributeModifiers={dynamicAttributeModifiers} handleMainAttributeChange={handleMainAttributeChange} handleSingleMainAttributeChange={handleSingleMainAttributeChange} toggleSection={toggleSection} />
                <ActionsAndBuffsSection 
                    character={character} user={user} isMaster={isMaster} 
                    handleAddBuff={handleAddBuff} handleRemoveBuff={handleRemoveBuff} handleBuffChange={handleBuffChange} 
                    handleToggleBuffActive={handleToggleBuffActive} handleToggleBuffCollapsed={handleToggleBuffCollapsed} 
                    handleOpenActionModal={handleOpenActionModal}
                    allAttributes={allAttributes}
                    handleAddFormulaAction={handleAddFormulaAction}
                    handleRemoveFormulaAction={handleRemoveFormulaAction}
                    handleFormulaActionChange={handleFormulaActionChange}
                    handleAddActionComponent={handleAddActionComponent}
                    handleRemoveActionComponent={handleRemoveActionComponent}
                    handleActionComponentChange={handleActionComponentChange}
                    handleExecuteFormulaAction={handleExecuteFormulaAction}
                    handleToggleCustomActionCollapsed={handleToggleCustomActionCollapsed}
                    toggleSection={toggleSection} 
                />
                <AttributesSection 
                  character={character} 
                  user={user} 
                  isMaster={isMaster} 
                  dynamicAttributeModifiers={dynamicAttributeModifiers} 
                  handleAddAttribute={handleAddAttribute} 
                  handleRemoveAttribute={handleRemoveAttribute} 
                  handleAttributeChange={handleAttributeChange} 
                  handleDragStart={handleDragStart} 
                  handleDragOver={handleDragOver} 
                  handleDrop={handleDrop} 
                  toggleSection={toggleSection}
                  handleToggleAttributeCollapsed={handleToggleAttributeCollapsed}
                  handleOpenRollModal={handleOpenRollModal}
                />
                <InventoryWalletSection character={character} user={user} isMaster={isMaster} zeniAmount={zeniAmount} handleZeniChange={handleZeniChange} handleAddZeni={handleAddZeni} handleRemoveZeni={handleRemoveZeni} handleAddItem={handleAddItem} handleInventoryItemChange={handleInventoryItemChange} handleRemoveItem={handleRemoveItem} toggleItemCollapsed={toggleItemCollapsed} toggleSection={toggleSection} handleShowOnDiscord={handleShowOnDiscord} />
                <PerksSection character={character} user={user} isMaster={isMaster} handleAddPerk={handleAddPerk} handleRemovePerk={handleRemovePerk} handlePerkChange={handlePerkChange} handlePerkOriginChange={handlePerkOriginChange} toggleItemCollapsed={toggleItemCollapsed} toggleSection={toggleSection} handleShowOnDiscord={handleShowOnDiscord} />
                <SkillsSection character={character} user={user} isMaster={isMaster} handleAddAbility={handleAddAbility} handleRemoveAbility={handleRemoveAbility} handleAbilityChange={handleAbilityChange} handleAddSpecialization={handleAddSpecialization} handleRemoveSpecialization={handleRemoveSpecialization} handleSpecializationChange={handleSpecializationChange} handleAddEquippedItem={handleAddEquippedItem} handleRemoveEquippedItem={handleRemoveEquippedItem} handleEquippedItemChange={handleEquippedItemChange} toggleItemCollapsed={toggleItemCollapsed} toggleSection={toggleSection} handleShowOnDiscord={handleShowOnDiscord} />
                <StoryAndNotesSection character={character} user={user} isMaster={isMaster} addHistoryBlock={addHistoryBlock} removeHistoryBlock={removeHistoryBlock} updateHistoryBlock={updateHistoryBlock} addNoteBlock={addNoteBlock} removeNoteBlock={removeNoteBlock} updateNoteBlock={updateNoteBlock} handleDragStart={handleDragStart} handleDragOver={handleDragOver} handleDrop={handleDrop} toggleSection={toggleSection} />
                <DiscordIntegrationSection
                  webhookUrl={character.discordWebhookUrl || ''}
                  handleChange={handleChange}
                  isMaster={isMaster}
                  ownerUid={character.ownerUid}
                  userUid={user.uid}
                  toggleSection={toggleSection}
                  isCollapsed={character.isDiscordCollapsed}
                />
                <ActionButtons character={character} user={user} isMaster={isMaster} isLoading={isLoading} handleExportJson={handleExportJson} handleImportJsonClick={handleImportJsonClick} handleReset={handleReset} />
            </>
        )}

        {!user && isAuthReady && (
            <p className="text-center text-gray-400 text-lg mt-8">Faça login para começar a criar e gerenciar suas fichas!</p>
        )}
      </div>

      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
      {modal.isVisible && <CustomModal {...modal} onClose={() => setModal({ ...modal, isVisible: false })} />}
      {actionModal.isVisible && <ActionModal title={actionModal.title} onConfirm={handleConfirmAction} onClose={() => setActionModal({ isVisible: false, type: '', title: '' })} />}
      {rollModal.isVisible && <RollAttributeModal attributeName={rollModal.attribute.name} onConfirm={handleConfirmAttributeRoll} onClose={() => setRollModal({ isVisible: false, attribute: null })} />}
      {isLoading && <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><div className="text-white text-xl font-bold">Carregando...</div></div>}
    </div>
  );
};

export default App;

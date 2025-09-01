import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, getDocs, getDoc, deleteDoc } from 'firebase/firestore';

// ============================================================================
// --- Componentes Auxiliares ---
// ============================================================================

// Componente Modal para prompts e confirmações personalizadas
const CustomModal = ({ message, onConfirm, onCancel, type, onClose }) => {
  const [inputValue, setInputValue] = useState('');

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
      onConfirm();
      onClose();
    }
  };

  const handleCancel = () => {
    onCancel();
    onClose();
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
        handleConfirm();
    }
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
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm border border-gray-700">
        <p className="text-lg text-gray-100 mb-4 text-center">{message}</p>
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
    <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
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

const MainAttributesSection = ({ character, user, isMaster, handleMainAttributeChange, handleSingleMainAttributeChange, toggleSection }) => (
    <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
        <h2 className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center" onClick={() => toggleSection('isMainAttributesCollapsed')}>
            Atributos Principais
            <span>{character.isMainAttributesCollapsed ? '▼' : '▲'}</span>
        </h2>
        {!character.isMainAttributesCollapsed && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {['hp', 'mp'].map(attr => (
                    <div key={attr} className="flex flex-col items-center p-2 bg-gray-600 rounded-md">
                        <label className="text-lg font-medium text-gray-300 mb-1 uppercase">{attr}:</label>
                        <div className="flex items-center gap-2">
                            <input type="number" name="current" data-attribute={attr} value={character.mainAttributes[attr].current === 0 ? '' : character.mainAttributes[attr].current} onChange={handleMainAttributeChange} className="w-14 p-2 text-center bg-gray-700 border border-gray-500 rounded-md text-white text-xl font-bold" disabled={user.uid !== character.ownerUid} />
                            <span className="text-gray-300">/</span>
                            <input type="number" name="max" data-attribute={attr} value={character.mainAttributes[attr].max === 0 ? '' : character.mainAttributes[attr].max} onChange={handleMainAttributeChange} className="w-14 p-2 text-center bg-gray-700 border border-gray-500 rounded-md text-white text-xl font-bold" disabled={!isMaster} />
                        </div>
                    </div>
                ))}
                {['initiative', 'fa', 'fm', 'fd'].map(attr => (
                    <div key={attr} className="flex flex-col items-center p-2 bg-gray-600 rounded-md">
                        <label htmlFor={attr} className="capitalize text-lg font-medium text-gray-300 mb-1">{attr === 'fa' ? 'FA' : attr === 'fm' ? 'FM' : attr === 'fd' ? 'FD' : 'Iniciativa'}:</label>
                        <input type="number" id={attr} name={attr} value={character.mainAttributes[attr] === 0 ? '' : character.mainAttributes[attr]} onChange={handleSingleMainAttributeChange} className="w-14 p-2 text-center bg-gray-700 border border-gray-500 rounded-md text-white text-xl font-bold" disabled={user.uid !== character.ownerUid && !isMaster} />
                    </div>
                ))}
            </div>
        )}
    </section>
);

const QuickActionsSection = ({ character, user, isMaster, handleAddBuff, handleRemoveBuff, handleBuffChange, handleToggleBuffActive, handleToggleBuffCollapsed, toggleSection }) => {
    const attributeNames = useMemo(() => (character.attributes || []).map(attr => attr.name).filter(Boolean), [character.attributes]);
    
    const collapsedBuffs = useMemo(() => (character.buffs || []).filter(b => b.isCollapsed), [character.buffs]);
    const expandedBuffs = useMemo(() => (character.buffs || []).filter(b => !b.isCollapsed), [character.buffs]);

    return (
        <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
            <h2 className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center" onClick={() => toggleSection('isQuickActionsCollapsed')}>
                Ações Rápidas e Buffs
                <span>{character.isQuickActionsCollapsed ? '▼' : '▲'}</span>
            </h2>
            {!character.isQuickActionsCollapsed && (
                <>
                    <div className="mb-4">
                        <h3 className="text-xl font-semibold text-purple-300 mb-2">Buffs Ativáveis</h3>
                        
                        {/* Grid para buffs minimizados */}
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

                        {/* Lista para buffs expandidos */}
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
                                                <option value="dice">Adicionar Valor/Dado</option>
                                            </select>
                                            {buff.type === 'attribute' ? (
                                                <select
                                                    value={buff.target}
                                                    onChange={(e) => handleBuffChange(buff.id, 'target', e.target.value)}
                                                    className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white"
                                                    disabled={user.uid !== character.ownerUid && !isMaster}
                                                >
                                                    <option value="">Selecione um Atributo</option>
                                                    {attributeNames.map(name => <option key={name} value={name}>{name}</option>)}
                                                </select>
                                            ) : (
                                                <input
                                                    type="text"
                                                    placeholder="+1d6"
                                                    value={buff.target}
                                                    onChange={(e) => handleBuffChange(buff.id, 'target', e.target.value)}
                                                    className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white"
                                                    disabled={user.uid !== character.ownerUid && !isMaster}
                                                />
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2 items-center">
                                             <input
                                                type="number"
                                                placeholder="Valor (+/-)"
                                                value={buff.value === 0 ? '' : buff.value}
                                                onChange={(e) => handleBuffChange(buff.id, 'value', e.target.value)}
                                                className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white text-center"
                                                disabled={user.uid !== character.ownerUid && !isMaster}
                                            />
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
                        
                        {(character.buffs || []).length === 0 && <p className="text-gray-400 italic">Nenhum buff criado. Adicione um para começar.</p>}
                    </div>

                    {(user.uid === character.ownerUid || isMaster) && (
                        <div className="flex justify-center mt-4">
                            <button onClick={handleAddBuff} className="w-10 h-10 bg-green-600 hover:bg-green-700 text-white text-2xl font-bold rounded-full shadow-lg transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75 flex items-center justify-center" aria-label="Adicionar Buff">+</button>
                        </div>
                    )}
                </>
            )}
        </section>
    );
};

const AttributesSection = ({ character, user, isMaster, handleAddAttribute, handleRemoveAttribute, handleAttributeChange, handleDragStart, handleDragOver, handleDrop, toggleSection }) => (
    <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
        <h2 className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center" onClick={() => toggleSection('isAttributesCollapsed')}>
            Atributos
            <span>{character.isAttributesCollapsed ? '▼' : '▲'}</span>
        </h2>
        {!character.isAttributesCollapsed && (
            <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(character.attributes || []).map((attr, index) => (
                        <div key={attr.id} className="p-3 bg-gray-600 rounded-md shadow-sm border border-gray-500 relative" draggable onDragStart={(e) => handleDragStart(e, index, 'attributes')} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, index, 'attributes')}>
                            <div className="flex flex-col sm:flex-row items-center gap-3">
                                <input type="text" placeholder="Nome do Atributo" value={attr.name} onChange={(e) => handleAttributeChange(attr.id, 'name', e.target.value)} className="w-full sm:w-1/4 p-2 bg-gray-700 border border-gray-500 rounded-md text-white font-semibold" disabled={user.uid !== character.ownerUid && !isMaster} />
                                <div className="flex items-center gap-2 text-xs flex-grow justify-end w-full sm:w-auto">
                                    {['base', 'perm', 'cond', 'arma'].map(field => (
                                        <div key={field} className="flex flex-col items-center">
                                            <span className="text-gray-400 text-xs text-center capitalize">{field === 'perm' ? 'Perm.' : field === 'cond' ? 'Cond.' : field}</span>
                                            <input type="number" value={attr[field] === 0 ? '' : attr[field]} onChange={(e) => handleAttributeChange(attr.id, field, e.target.value)} className="w-12 p-1 bg-gray-700 border border-gray-500 rounded-md text-white text-center" disabled={user.uid !== character.ownerUid && !isMaster} />
                                        </div>
                                    ))}
                                    <div className="flex flex-col items-center">
                                        <span className="text-gray-400 text-xs text-center">Total</span>
                                        <input type="number" value={attr.total === 0 ? '' : attr.total} readOnly className="w-12 p-1 bg-gray-800 border border-gray-600 rounded-md text-white font-bold cursor-not-allowed text-center" />
                                    </div>
                                </div>
                            </div>
                            {(user.uid === character.ownerUid || isMaster) && (
                                <button onClick={() => handleRemoveAttribute(attr.id)} className="absolute top-1 right-1 w-6 h-6 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-full flex items-center justify-center transition duration-200 ease-in-out" aria-label="Remover Atributo">X</button>
                            )}
                        </div>
                    ))}
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

const InventoryWalletSection = ({ character, user, isMaster, zeniAmount, handleZeniChange, handleAddZeni, handleRemoveZeni, handleAddItem, handleInventoryItemChange, handleRemoveItem, toggleItemCollapsed, toggleSection }) => (
    <>
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
                                        {(user.uid === character.ownerUid || isMaster) && (
                                            <button onClick={() => handleRemoveItem(item.id)} className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md">Remover</button>
                                        )}
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
    </>
);

const PerksSection = ({ character, user, isMaster, handleAddPerk, handleRemovePerk, handlePerkChange, handlePerkOriginChange, toggleItemCollapsed, toggleSection }) => (
    <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
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
                                            {(user.uid === character.ownerUid || isMaster) && (
                                                <button onClick={() => handleRemovePerk(type, perk.id)} className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md">Remover</button>
                                            )}
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

const SkillsSection = ({ character, user, isMaster, handleAddAbility, handleRemoveAbility, handleAbilityChange, handleAddSpecialization, handleRemoveSpecialization, handleSpecializationChange, handleAddEquippedItem, handleRemoveEquippedItem, handleEquippedItemChange, toggleItemCollapsed, toggleSection }) => (
    <>
        <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
            <h2 className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center" onClick={() => toggleSection('isAbilitiesCollapsed')}>
                Habilidades
                <span>{character.isAbilitiesCollapsed ? '▼' : '▲'}</span>
            </h2>
            {!character.isAbilitiesCollapsed && (
                <>
                    <ul className="space-y-2">
                        {(character.abilities || []).map(ability => (
                            <li key={ability.id} className="flex flex-col p-3 bg-gray-600 rounded-md shadow-sm">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-semibold text-lg w-full cursor-pointer" onClick={() => toggleItemCollapsed('abilities', ability.id)}>
                                        {ability.title || 'Habilidade Sem Título'} {ability.isCollapsed ? '...' : ''}
                                    </span>
                                    {(user.uid === character.ownerUid || isMaster) && (
                                        <button onClick={() => handleRemoveAbility(ability.id)} className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md">Remover</button>
                                    )}
                                </div>
                                {!ability.isCollapsed && (
                                    <>
                                        <input type="text" value={ability.title} onChange={(e) => handleAbilityChange(ability.id, 'title', e.target.value)} className="font-semibold text-lg w-full p-1 bg-gray-700 border border-gray-500 rounded-md mb-2" placeholder="Título" disabled={user.uid !== character.ownerUid && !isMaster} />
                                        <AutoResizingTextarea value={ability.description} onChange={(e) => handleAbilityChange(ability.id, 'description', e.target.value)} placeholder="Descrição" className="text-sm text-gray-300 italic w-full p-1 bg-gray-700 border border-gray-500 rounded-md" disabled={user.uid !== character.ownerUid && !isMaster} />
                                    </>
                                )}
                            </li>
                        ))}
                    </ul>
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
                    <ul className="space-y-2">
                        {(character.specializations || []).map(spec => (
                            <li key={spec.id} className="flex flex-col p-3 bg-gray-600 rounded-md shadow-sm">
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
                            </li>
                        ))}
                    </ul>
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
                    <ul className="space-y-2">
                        {(character.equippedItems || []).map(item => (
                            <li key={item.id} className="flex flex-col p-3 bg-gray-600 rounded-md shadow-sm">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-semibold text-lg w-full cursor-pointer" onClick={() => toggleItemCollapsed('equippedItems', item.id)}>
                                        {item.name || 'Item Sem Nome'} {item.isCollapsed ? '...' : ''}
                                    </span>
                                    {(user.uid === character.ownerUid || isMaster) && (
                                        <button onClick={() => handleRemoveEquippedItem(item.id)} className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md">Remover</button>
                                    )}
                                </div>
                                {!item.isCollapsed && (
                                    <>
                                        <input type="text" value={item.name} onChange={(e) => handleEquippedItemChange(item.id, 'name', e.target.value)} className="font-semibold text-lg w-full p-1 bg-gray-700 border border-gray-500 rounded-md mb-2" placeholder="Nome" disabled={user.uid !== character.ownerUid && !isMaster} />
                                        <AutoResizingTextarea value={item.description} onChange={(e) => handleEquippedItemChange(item.id, 'description', e.target.value)} placeholder="Descrição" className="text-sm text-gray-300 italic w-full p-1 bg-gray-700 border border-gray-500 rounded-md mb-2" disabled={user.uid !== character.ownerUid && !isMaster} />
                                        <AutoResizingTextarea value={item.attributes} onChange={(e) => handleEquippedItemChange(item.id, 'attributes', e.target.value)} placeholder="Atributos/Efeitos" className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-sm" disabled={user.uid !== character.ownerUid && !isMaster} />
                                    </>
                                )}
                            </li>
                        ))}
                    </ul>
                    {(user.uid === character.ownerUid || isMaster) && (
                        <div className="flex justify-end mt-4">
                            <button onClick={handleAddEquippedItem} className="w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white text-2xl font-bold rounded-full shadow-lg" aria-label="Adicionar Item Equipado">+</button>
                        </div>
                    )}
                </>
            )}
        </section>
    </>
);

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
        <>
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
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
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
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
        </>
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
  mainAttributes: { hp: { current: 0, max: 0 }, mp: { current: 0, max: 0 }, initiative: 0, fa: 0, fm: 0, fd: 0 },
  attributes: [], inventory: [], wallet: { zeni: 0 }, advantages: [], disadvantages: [], abilities: [],
  specializations: [], equippedItems: [], history: [], notes: [], buffs: [],
  isUserStatusCollapsed: false, isCharacterInfoCollapsed: false, isMainAttributesCollapsed: false,
  isAttributesCollapsed: false, isInventoryCollapsed: false, isWalletCollapsed: false, isPerksCollapsed: false,
  isAbilitiesCollapsed: false, isSpecializationsCollapsed: false, isEquippedItemsCollapsed: false,
  isHistoryCollapsed: false, isNotesCollapsed: false, isQuickActionsCollapsed: false,
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
      setModal({ isVisible: true, message: `Erro ao carregar personagens: ${error.message}`, type: 'info' });
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
                
                deserializedData.mainAttributes = deserializedData.mainAttributes || initialCharState.mainAttributes;
                deserializedData.attributes = deserializedData.attributes || [];
                deserializedData.inventory = deserializedData.inventory || [];
                deserializedData.wallet = deserializedData.wallet || { zeni: 0 };
                deserializedData.advantages = deserializedData.advantages || [];
                deserializedData.disadvantages = deserializedData.disadvantages || [];
                deserializedData.abilities = deserializedData.abilities || [];
                deserializedData.specializations = deserializedData.specializations || [];
                deserializedData.equippedItems = deserializedData.equippedItems || [];
                deserializedData.history = deserializedData.history || [];
                deserializedData.notes = deserializedData.notes || [];
                deserializedData.buffs = deserializedData.buffs || [];
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

  const handleAddAttribute = () => setCharacter(prev => ({ ...prev, attributes: [...(prev.attributes || []), { id: crypto.randomUUID(), name: '', base: 0, perm: 0, cond: 0, arma: 0, total: 0 }] }));
  const handleRemoveAttribute = (id) => setCharacter(prev => ({ ...prev, attributes: (prev.attributes || []).filter(attr => attr.id !== id) }));
  const handleAttributeChange = (id, field, value) => {
    setCharacter(prev => ({
      ...prev,
      attributes: (prev.attributes || []).map(attr => {
        if (attr.id === id) {
          const updatedAttr = { ...attr, [field]: field === 'name' ? value : parseInt(value, 10) || 0 };
          updatedAttr.total = (updatedAttr.base || 0) + (updatedAttr.perm || 0) + (updatedAttr.cond || 0) + (updatedAttr.arma || 0);
          return updatedAttr;
        }
        return attr;
      })
    }));
  };
  
  const toggleItemCollapsed = (listName, id) => setCharacter(prev => ({ ...prev, [listName]: (prev[listName] || []).map(item => item.id === id ? { ...item, isCollapsed: !item.isCollapsed } : item) }));
  const handleAddItem = () => setCharacter(prev => ({ ...prev, inventory: [...(prev.inventory || []), { id: crypto.randomUUID(), name: '', description: '', isCollapsed: false }] }));
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
                  const updatedBuff = { ...buff, [field]: ['value', 'costValue'].includes(field) ? parseInt(value, 10) || 0 : value };
                  if (field === 'type') {
                      updatedBuff.target = '';
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
    }, onCancel: () => {} });
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
                   setModal({ isVisible: true, message: `Erro ao importar: ${error.message}`, type: 'info' });
                } finally {
                   setIsLoading(false);
                }
              },
              onCancel: () => setModal({ isVisible: false })
            });
        } catch (error) {
            setModal({ isVisible: true, message: `Erro ao ler arquivo: ${error.message}`, type: 'info' });
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
            setModal({ isVisible: true, message: `Erro ao criar: ${error.message}`, type: 'info' });
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
    window.history.pushState({}, '', `?charId=${charId}&ownerUid=${ownerUid}`);
  };

  const handleBackToList = () => {
    setSelectedCharIdState(null);
    setOwnerUidState(null);
    window.history.pushState({}, '', window.location.pathname);
    setCharacter(null);
    fetchCharactersList();
  };

  const handleDeleteCharacter = (charId, charName, ownerUid) => {
    setModal({ isVisible: true, message: `Excluir permanentemente '${charName}'?`, type: 'confirm', onConfirm: async () => {
        if (!db || !user || (user.uid !== ownerUid && !isMaster)) return;
        setIsLoading(true);
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/users/${ownerUid}/characterSheets/${charId}`));
            handleBackToList();
        } catch (error) {
            setModal({ isVisible: true, message: `Erro ao excluir: ${error.message}`, type: 'info' });
        } finally {
            setIsLoading(false);
        }
    }, onCancel: () => {} });
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

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 font-inter">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap'); body { font-family: 'Inter', sans-serif; } input[type="number"]::-webkit-outer-spin-button, input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; } input[type="number"] { -moz-appearance: textfield; }`}</style>
      
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
                <div className="mb-4">
                    <button onClick={handleBackToList} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg">← Voltar para a Lista</button>
                </div>

                <CharacterInfoSection character={character} user={user} isMaster={isMaster} handleChange={handleChange} handlePhotoUrlClick={handlePhotoUrlClick} toggleSection={toggleSection} />
                <MainAttributesSection character={character} user={user} isMaster={isMaster} handleMainAttributeChange={handleMainAttributeChange} handleSingleMainAttributeChange={handleSingleMainAttributeChange} toggleSection={toggleSection} />
                <QuickActionsSection character={character} user={user} isMaster={isMaster} handleAddBuff={handleAddBuff} handleRemoveBuff={handleRemoveBuff} handleBuffChange={handleBuffChange} handleToggleBuffActive={handleToggleBuffActive} handleToggleBuffCollapsed={handleToggleBuffCollapsed} toggleSection={toggleSection} />
                <AttributesSection character={character} user={user} isMaster={isMaster} handleAddAttribute={handleAddAttribute} handleRemoveAttribute={handleRemoveAttribute} handleAttributeChange={handleAttributeChange} handleDragStart={handleDragStart} handleDragOver={handleDragOver} handleDrop={handleDrop} toggleSection={toggleSection} />
                <InventoryWalletSection character={character} user={user} isMaster={isMaster} zeniAmount={zeniAmount} handleZeniChange={handleZeniChange} handleAddZeni={handleAddZeni} handleRemoveZeni={handleRemoveZeni} handleAddItem={handleAddItem} handleInventoryItemChange={handleInventoryItemChange} handleRemoveItem={handleRemoveItem} toggleItemCollapsed={toggleItemCollapsed} toggleSection={toggleSection} />
                <PerksSection character={character} user={user} isMaster={isMaster} handleAddPerk={handleAddPerk} handleRemovePerk={handleRemovePerk} handlePerkChange={handlePerkChange} handlePerkOriginChange={handlePerkOriginChange} toggleItemCollapsed={toggleItemCollapsed} toggleSection={toggleSection} />
                <SkillsSection character={character} user={user} isMaster={isMaster} handleAddAbility={handleAddAbility} handleRemoveAbility={handleRemoveAbility} handleAbilityChange={handleAbilityChange} handleAddSpecialization={handleAddSpecialization} handleRemoveSpecialization={handleRemoveSpecialization} handleSpecializationChange={handleSpecializationChange} handleAddEquippedItem={handleAddEquippedItem} handleRemoveEquippedItem={handleRemoveEquippedItem} handleEquippedItemChange={handleEquippedItemChange} toggleItemCollapsed={toggleItemCollapsed} toggleSection={toggleSection} />
                <StoryAndNotesSection character={character} user={user} isMaster={isMaster} addHistoryBlock={addHistoryBlock} removeHistoryBlock={removeHistoryBlock} updateHistoryBlock={updateHistoryBlock} addNoteBlock={addNoteBlock} removeNoteBlock={removeNoteBlock} updateNoteBlock={updateNoteBlock} handleDragStart={handleDragStart} handleDragOver={handleDragOver} handleDrop={handleDrop} toggleSection={toggleSection} />
                
                <ActionButtons character={character} user={user} isMaster={isMaster} isLoading={isLoading} handleExportJson={handleExportJson} handleImportJsonClick={handleImportJsonClick} handleReset={handleReset} />
            </>
        )}

        {!user && isAuthReady && (
            <p className="text-center text-gray-400 text-lg mt-8">Faça login para começar a criar e gerenciar suas fichas!</p>
        )}
      </div>

      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
      {modal.isVisible && <CustomModal message={modal.message} onConfirm={modal.onConfirm} onCancel={modal.onCancel} type={modal.type} onClose={() => setModal({ ...modal, isVisible: false })} />}
      {isLoading && <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><div className="text-white text-xl font-bold">Carregando...</div></div>}
    </div>
  );
};

export default App;

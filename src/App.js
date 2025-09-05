import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, getDocs, getDoc, deleteDoc } from 'firebase/firestore';

// ============================================================================
// --- ESTADO INICIAL E CONSTANTES ---
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

// ============================================================================
// --- HOOKS CUSTOMIZADOS (LÓGICA CENTRAL) ---
// ============================================================================

/**
 * Hook "Motor de Ações": Lida com toda a lógica de cálculo de atributos,
 * modificadores de buffs e execução de ações de fórmula.
 */
const useActionEngine = (character) => {
    
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

    const dexterityValue = useMemo(() => {
        const searchTerms = ['dex', 'des', 'agi'];
        const dexterityAttr = (character?.attributes || []).find(attr => {
            if (!attr.name) return false;
            const lowerCaseName = attr.name.toLowerCase();
            return searchTerms.some(term => lowerCaseName.includes(term));
        });

        if (!dexterityAttr) return 0;
        const tempValue = dynamicAttributeModifiers[dexterityAttr.name] || 0;
        return (dexterityAttr.base || 0) + (dexterityAttr.perm || 0) + tempValue + (dexterityAttr.arma || 0);
    }, [character?.attributes, dynamicAttributeModifiers]);

    const initiativeTotal = dexterityValue + (mainAttributeModifiers['Iniciativa'] || 0);

    const allAttributes = useMemo(() => {
        const mainAttrs = ['Iniciativa', 'FA', 'FM', 'FD'];
        const dynamicAttrs = (character?.attributes || []).map(attr => attr.name).filter(Boolean);
        return [...mainAttrs, ...dynamicAttrs];
    }, [character?.attributes]);

    const calculateTotalCost = (action, activeBuffs, multiplier) => {
        let totalCost = { HP: 0, MP: 0 };
        let costDetails = [];
        if (action.costType && action.costValue > 0) {
            totalCost[action.costType] += action.costValue;
            costDetails.push(`Ação: ${action.costValue} ${action.costType}`);
        }
        activeBuffs.forEach(buff => {
            if (buff.costType && buff.costValue > 0) {
                const buffCost = buff.costValue * multiplier;
                totalCost[buff.costType] += buffCost;
                costDetails.push(`${buff.name}: ${buffCost} ${buff.costType}`);
            }
        });
        return { totalCost, costDetails };
    };

    const processRolls = (action, activeBuffs, updatedCharacter, multiplier) => {
        let totalResult = 0;
        let rollDetails = [];
        let rollFormulaForRoll20 = '';

        for (let i = 0; i < multiplier; i++) {
            for (const comp of (action.components || [])) {
                if (comp.type === 'dice') {
                    const match = String(comp.value).match(/(\d+)d(\d+)/i);
                    rollFormulaForRoll20 += `+${comp.value}`;
                    if (match) {
                        const numDice = parseInt(match[1], 10), numSides = parseInt(match[2], 10);
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
                        attrValue = (updatedCharacter.mainAttributes[attrName.toLowerCase()] || 0) + (mainAttributeModifiers[attrName] || 0);
                    } else {
                        const dynamicAttr = updatedCharacter.attributes.find(a => a.name === attrName);
                        if (dynamicAttr) attrValue = (dynamicAttr.base || 0) + (dynamicAttr.perm || 0) + (dynamicAttr.arma || 0) + (dynamicAttributeModifiers[attrName] || 0);
                    }
                    totalResult += attrValue;
                    rollDetails.push(`${attrName}(${attrValue})`);
                    rollFormulaForRoll20 += `+${attrValue}`;
                }
            }
        }
        activeBuffs.forEach(buff => {
            if (buff.type === 'dice' && buff.value) {
                const match = String(buff.value).match(/(\d+)d(\d+)/i);
                rollFormulaForRoll20 += `+${buff.value}`;
                if (match) {
                    const numDice = parseInt(match[1], 10), numSides = parseInt(match[2], 10);
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
        return { totalResult, rollDetails, rollFormulaForRoll20: rollFormulaForRoll20.substring(1) };
    };

    const executeFormulaAction = useCallback((actionId) => {
        const action = character.formulaActions.find(a => a.id === actionId);
        if (!action) return { error: 'Ação não encontrada.' };

        const activeBuffs = (character.buffs || []).filter(b => b.isActive);
        const multiplier = action.multiplier || 1;

        const { totalCost, costDetails } = calculateTotalCost(action, activeBuffs, multiplier);

        if (character.mainAttributes.hp.current < totalCost.HP || character.mainAttributes.mp.current < totalCost.MP) {
            return { error: `Custo de HP/MP insuficiente!\nNecessário: ${totalCost.HP > 0 ? `${totalCost.HP} HP` : ''} ${totalCost.MP > 0 ? `${totalCost.MP} MP` : ''}` };
        }

        let updatedCharacter = JSON.parse(JSON.stringify(character)); // Deep copy
        if (totalCost.HP > 0) updatedCharacter.mainAttributes.hp.current -= totalCost.HP;
        if (totalCost.MP > 0) updatedCharacter.mainAttributes.mp.current -= totalCost.MP;

        const { totalResult, rollDetails, rollFormulaForRoll20 } = processRolls(action, activeBuffs, updatedCharacter, multiplier);
        
        return {
            updatedCharacter,
            rollDetails,
            totalResult,
            activeBuffNames: activeBuffs.map(b => b.name).filter(Boolean),
            costDetails,
            roll20Command: `/r ${rollFormulaForRoll20} ${action.discordText || ''}`,
            action,
        };
    }, [character, mainAttributeModifiers, dynamicAttributeModifiers]);

    return {
        mainAttributeModifiers,
        dynamicAttributeModifiers,
        allAttributes,
        dexterityValue,
        initiativeTotal,
        executeFormulaAction,
    };
};

/**
 * Hook "Gerenciador de Personagem": Gerencia o estado da ficha e as
 * ações do usuário (adicionar, remover, editar itens, etc.).
 */
const useCharacterManager = (initialCharacter = null) => {
  const [character, setCharacter] = useState(initialCharacter);
  const [zeniAmount, setZeniAmount] = useState(0);

  const actionEngine = useActionEngine(character);

  useEffect(() => { setCharacter(initialCharacter); }, [initialCharacter]);
  
  const handleAddItemToList = useCallback((listName, newItem) => setCharacter(prev => ({ ...prev, [listName]: [...(prev[listName] || []), newItem] })), []);
  const handleRemoveItemFromList = useCallback((listName, itemId) => setCharacter(prev => ({ ...prev, [listName]: (prev[listName] || []).filter(item => item.id !== itemId) })), []);
  const handleUpdateItemInList = useCallback((listName, itemId, field, value) => setCharacter(prev => ({ ...prev, [listName]: (prev[listName] || []).map(item => item.id === itemId ? { ...item, [field]: value } : item) })), []);
  
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    const isNumeric = ['age', 'level', 'xp'].includes(name);
    setCharacter(prev => ({ ...prev, [name]: isNumeric ? parseInt(value, 10) || 0 : value }));
  }, []);

  const handleMainAttributeChange = useCallback((e) => {
    const { name, value, dataset } = e.target;
    const attributeName = dataset.attribute;
    const parsedValue = parseInt(value, 10) || 0;
    setCharacter(prev => ({ ...prev, mainAttributes: { ...prev.mainAttributes, [attributeName]: { ...prev.mainAttributes[attributeName], [name]: parsedValue } } }));
  }, []);

  const handleSingleMainAttributeChange = useCallback((e) => {
    const { name, value } = e.target;
    setCharacter(prev => ({ ...prev, mainAttributes: { ...prev.mainAttributes, [name]: parseInt(value, 10) || 0 } }));
  }, []);

  const handleAddAttribute = useCallback(() => handleAddItemToList('attributes', { id: crypto.randomUUID(), name: '', base: 0, perm: 0, temp: 0, arma: 0 }), [handleAddItemToList]);
  const handleRemoveAttribute = useCallback((id) => handleRemoveItemFromList('attributes', id), [handleRemoveItemFromList]);
  const handleAttributeChange = useCallback((id, field, value) => handleUpdateItemInList('attributes', id, field, field === 'name' ? value : parseInt(value, 10) || 0), [handleUpdateItemInList]);
  
  const handleAddItem = useCallback(() => handleAddItemToList('inventory', { id: crypto.randomUUID(), name: '', description: '', isCollapsed: true }), [handleAddItemToList]);
  const handleRemoveItem = useCallback((id) => handleRemoveItemFromList('inventory', id), [handleRemoveItemFromList]);
  const handleInventoryItemChange = useCallback((id, field, value) => handleUpdateItemInList('inventory', id, field, value), [handleUpdateItemInList]);
  
  const handleZeniChange = useCallback((e) => setZeniAmount(parseInt(e.target.value, 10) || 0), []);
  const handleAddZeni = useCallback(() => { setCharacter(prev => ({ ...prev, wallet: { ...prev.wallet, zeni: ((prev.wallet || {}).zeni || 0) + zeniAmount } })); setZeniAmount(0); }, [zeniAmount]);
  const handleRemoveZeni = useCallback(() => { setCharacter(prev => ({ ...prev, wallet: { ...prev.wallet, zeni: Math.max(0, ((prev.wallet || {}).zeni || 0) - zeniAmount) } })); setZeniAmount(0); }, [zeniAmount]);
  
  const handleAddPerk = useCallback((type) => handleAddItemToList(type, { id: crypto.randomUUID(), name: '', description: '', origin: { class: false, race: false, manual: false }, value: 0, isCollapsed: false }), [handleAddItemToList]);
  const handleRemovePerk = useCallback((type, id) => handleRemoveItemFromList(type, id), [handleRemoveItemFromList]);
  const handlePerkChange = useCallback((type, id, field, value) => handleUpdateItemInList(type, id, field, field === 'value' ? parseInt(value, 10) || 0 : value), [handleUpdateItemInList]);
  const handlePerkOriginChange = useCallback((type, id, originType) => {
    const perk = (character?.[type] || []).find(p => p.id === id);
    if (perk) handleUpdateItemInList(type, id, 'origin', { ...perk.origin, [originType]: !perk.origin[originType] });
  }, [character, handleUpdateItemInList]);

  const handleAddAbility = useCallback(() => handleAddItemToList('abilities', { id: crypto.randomUUID(), title: '', description: '', isCollapsed: false }), [handleAddItemToList]);
  const handleRemoveAbility = useCallback((id) => handleRemoveItemFromList('abilities', id), [handleRemoveItemFromList]);
  const handleAbilityChange = useCallback((id, field, value) => handleUpdateItemInList('abilities', id, field, value), [handleUpdateItemInList]);
  
  const handleAddSpecialization = useCallback(() => handleAddItemToList('specializations', { id: crypto.randomUUID(), name: '', modifier: 0, bonus: 0, isCollapsed: false }), [handleAddItemToList]);
  const handleRemoveSpecialization = useCallback((id) => handleRemoveItemFromList('specializations', id), [handleRemoveItemFromList]);
  const handleSpecializationChange = useCallback((id, field, value) => handleUpdateItemInList('specializations', id, field, field === 'name' ? value : parseInt(value, 10) || 0), [handleUpdateItemInList]);

  const handleAddEquippedItem = useCallback(() => handleAddItemToList('equippedItems', { id: crypto.randomUUID(), name: '', description: '', attributes: '', isCollapsed: false }), [handleAddItemToList]);
  const handleRemoveEquippedItem = useCallback((id) => handleRemoveItemFromList('equippedItems', id), [handleRemoveItemFromList]);
  const handleEquippedItemChange = useCallback((id, field, value) => handleUpdateItemInList('equippedItems', id, field, value), [handleUpdateItemInList]);
  
  const addHistoryBlock = useCallback((type, url = '') => handleAddItemToList('history', type === 'text' ? { id: crypto.randomUUID(), type: 'text', value: '', isCollapsed: false } : { id: crypto.randomUUID(), type: 'image', value: url, width: '', height: '', fitWidth: true, isCollapsed: false }), [handleAddItemToList]);
  const removeHistoryBlock = useCallback((id) => handleRemoveItemFromList('history', id), [handleRemoveItemFromList]);
  const updateHistoryBlock = useCallback((id, field, value) => handleUpdateItemInList('history', id, field, value), [handleUpdateItemInList]);
  
  const addNoteBlock = useCallback((type, url = '') => handleAddItemToList('notes', type === 'text' ? { id: crypto.randomUUID(), type: 'text', value: '', isCollapsed: false } : { id: crypto.randomUUID(), type: 'image', value: url, width: '', height: '', fitWidth: true, isCollapsed: false }), [handleAddItemToList]);
  const removeNoteBlock = useCallback((id) => handleRemoveItemFromList('notes', id), [handleRemoveItemFromList]);
  const updateNoteBlock = useCallback((id, field, value) => handleUpdateItemInList('notes', id, field, value), [handleUpdateItemInList]);

  const handleAddBuff = useCallback(() => handleAddItemToList('buffs', { id: crypto.randomUUID(), name: '', type: 'attribute', target: '', value: 0, costValue: 0, costType: '', isActive: false, isCollapsed: false }), [handleAddItemToList]);
  const handleRemoveBuff = useCallback((id) => handleRemoveItemFromList('buffs', id), [handleRemoveItemFromList]);
  const handleToggleBuffActive = useCallback((id) => {
    const buff = (character?.buffs || []).find(b => b.id === id);
    if (buff) handleUpdateItemInList('buffs', id, 'isActive', !buff.isActive);
  }, [character, handleUpdateItemInList]);
  const handleToggleBuffCollapsed = useCallback((id) => {
    const buff = (character?.buffs || []).find(b => b.id === id);
    if (buff) handleUpdateItemInList('buffs', id, 'isCollapsed', !buff.isCollapsed);
  }, [character, handleUpdateItemInList]);
  const handleBuffChange = useCallback((id, field, value) => {
    handleUpdateItemInList('buffs', id, field, value);
    if (field === 'type') {
      handleUpdateItemInList('buffs', id, 'target', '');
      handleUpdateItemInList('buffs', id, 'value', value === 'attribute' ? 0 : '');
    }
  }, [handleUpdateItemInList]);
  
  const handleAddFormulaAction = useCallback(() => handleAddItemToList('formulaActions', { id: crypto.randomUUID(), name: 'Nova Ação', components: [{ id: crypto.randomUUID(), type: 'dice', value: '1d6' }], multiplier: 1, discordText: 'Usa sua nova ação.', isCollapsed: false, costValue: 0, costType: '' }), [handleAddItemToList]);
  const handleRemoveFormulaAction = useCallback((actionId) => handleRemoveItemFromList('formulaActions', actionId), [handleRemoveItemFromList]);
  const handleFormulaActionChange = useCallback((actionId, field, value) => handleUpdateItemInList('formulaActions', actionId, field, ['multiplier', 'costValue'].includes(field) ? (parseInt(value, 10) || (field === 'multiplier' ? 1 : 0)) : value), [handleUpdateItemInList]);
  const handleAddActionComponent = useCallback((actionId, type) => {
    const action = (character?.formulaActions || []).find(a => a.id === actionId);
    if (action) handleUpdateItemInList('formulaActions', actionId, 'components', [...(action.components || []), { id: crypto.randomUUID(), type, value: type === 'dice' ? '1d6' : '' }]);
  }, [character, handleUpdateItemInList]);
  const handleRemoveActionComponent = useCallback((actionId, componentId) => {
    const action = (character?.formulaActions || []).find(a => a.id === actionId);
    if (action) handleUpdateItemInList('formulaActions', actionId, 'components', (action.components || []).filter(c => c.id !== componentId));
  }, [character, handleUpdateItemInList]);
  const handleActionComponentChange = useCallback((actionId, componentId, field, value) => {
    const action = (character?.formulaActions || []).find(a => a.id === actionId);
    if (action) handleUpdateItemInList('formulaActions', actionId, 'components', (action.components || []).map(c => c.id === componentId ? { ...c, [field]: value } : c));
  }, [character, handleUpdateItemInList]);

  const toggleItemCollapsed = useCallback((listName, id) => {
    const item = (character?.[listName] || []).find(i => i.id === id);
    if (item) handleUpdateItemInList(listName, id, 'isCollapsed', !item.isCollapsed);
  }, [character, handleUpdateItemInList]);
  
  const handleToggleCustomActionCollapsed = useCallback((id) => toggleItemCollapsed('formulaActions', id), [toggleItemCollapsed]);
  const handleReset = useCallback(() => setCharacter(prev => ({ ...initialCharState, id: prev.id, ownerUid: prev.ownerUid, name: prev.name })), []);
  const toggleSection = useCallback((sectionKey) => setCharacter(prev => prev ? { ...prev, [sectionKey]: !prev[sectionKey] } : prev), []);
  const handleConfirmAction = useCallback((amount, target, type) => {
    let message = '';
    const charName = character.name || 'Personagem';
  
    setCharacter(prev => {
        const newMain = { ...prev.mainAttributes };
        if (type === 'heal') {
            switch(target) {
                case 'HP': newMain.hp.current = Math.min(newMain.hp.max, newMain.hp.current + amount); message = `${charName} recuperou ${amount} de HP.`; break;
                case 'HP Temporário': newMain.hp.temp = (newMain.hp.temp || 0) + amount; message = `${charName} recebeu ${amount} de HP Temporário.`; break;
                case 'MP': newMain.mp.current = Math.min(newMain.mp.max, newMain.mp.current + amount); message = `${charName} recuperou ${amount} de MP.`; break;
                default: break;
            }
        } else { // damage
            switch(target) {
                case 'HP':
                    let remainingDamage = amount;
                    const damageToTemp = Math.min(remainingDamage, newMain.hp.temp || 0);
                    newMain.hp.temp -= damageToTemp;
                    remainingDamage -= damageToTemp;
                    if (remainingDamage > 0) newMain.hp.current -= remainingDamage;
                    message = `${charName} perdeu ${amount} de HP.`;
                    break;
                case 'HP Temporário': newMain.hp.temp = Math.max(0, (newMain.hp.temp || 0) - amount); message = `${charName} perdeu ${amount} de HP Temporário.`; break;
                case 'MP': newMain.mp.current = Math.max(0, newMain.mp.current - amount); message = `${charName} perdeu ${amount} de MP.`; break;
                default: break;
            }
        }
        return { ...prev, mainAttributes: newMain };
    });
    return message;
  }, [character?.name]);
  
  return {
    character, setCharacter, zeniAmount, actionEngine,
    handleChange, handleMainAttributeChange, handleSingleMainAttributeChange, handleAddAttribute,
    handleRemoveAttribute, handleAttributeChange, toggleItemCollapsed, handleAddItem, handleInventoryItemChange,
    handleRemoveItem, handleZeniChange, handleAddZeni, handleRemoveZeni, handleAddPerk, handlePerkChange,
    handleRemovePerk, handlePerkOriginChange, handleAddAbility, handleAbilityChange, handleRemoveAbility,
    handleAddSpecialization, handleSpecializationChange, handleRemoveSpecialization, handleAddEquippedItem,
    handleEquippedItemChange, handleRemoveEquippedItem, addHistoryBlock, updateHistoryBlock, removeHistoryBlock,
    addNoteBlock, updateNoteBlock, removeNoteBlock, handleAddBuff, handleRemoveBuff, handleBuffChange,
    handleToggleBuffActive, handleToggleBuffCollapsed, handleToggleCustomActionCollapsed, handleAddFormulaAction,
    handleRemoveFormulaAction, handleFormulaActionChange, handleAddActionComponent, handleRemoveActionComponent,
    handleActionComponentChange, handleReset, toggleSection, handleConfirmAction
  };
};

// ============================================================================
// --- COMPONENTES DE UI (VISUAL) ---
// ============================================================================

const ActionModal = React.memo(({ title, onConfirm, onClose, type }) => {
    const [amount, setAmount] = useState('');
    const [target, setTarget] = useState('HP');

    const handleConfirm = () => {
        const numericAmount = parseInt(amount, 10);
        if (!isNaN(numericAmount) && numericAmount > 0) {
            onConfirm(numericAmount, target, type);
            onClose();
        } else {
            // No alert, maybe a visual feedback? For now, nothing.
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm border border-gray-700">
                <h3 className="text-xl text-yellow-300 font-bold mb-4 text-center">{title}</h3>
                <input
                    type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                    className="w-full p-2 mb-4 bg-gray-700 border border-gray-600 rounded-md text-white text-center text-lg"
                    placeholder="Valor" autoFocus
                />
                <div className="flex justify-center gap-4 mb-6">
                    <label className="flex items-center gap-2 text-white"><input type="radio" name="target" value="HP" checked={target === 'HP'} onChange={(e) => setTarget(e.target.value)} className="form-radio text-purple-500" /> HP</label>
                    <label className="flex items-center gap-2 text-white"><input type="radio" name="target" value="HP Temporário" checked={target === 'HP Temporário'} onChange={(e) => setTarget(e.target.value)} className="form-radio text-purple-500" /> HP Temp</label>
                    <label className="flex items-center gap-2 text-white"><input type="radio" name="target" value="MP" checked={target === 'MP'} onChange={(e) => setTarget(e.target.value)} className="form-radio text-purple-500" /> MP</label>
                </div>
                <div className="flex justify-around gap-4">
                    <button onClick={handleConfirm} className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md">Confirmar</button>
                    <button onClick={onClose} className="px-5 py-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg shadow-md">Cancelar</button>
                </div>
            </div>
        </div>
    );
});

const CustomModal = React.memo(({ message, onConfirm, onCancel, type, onClose, showCopyButton, copyText }) => {
  const [inputValue, setInputValue] = useState('');
  const [copySuccess, setCopySuccess] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (type === 'prompt' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [type]);

  const handleConfirm = () => {
    if (type === 'prompt') onConfirm(inputValue);
    else if (onConfirm) onConfirm();
    if (onClose) onClose();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    if (onClose) onClose();
  };
  
  const handleKeyDown = (e) => { if (e.key === 'Enter' && type === 'prompt') handleConfirm(); };

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
        setCopySuccess('Falhou.');
    }
    document.body.removeChild(textArea);
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
            ref={inputRef} type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown}
            className="w-full p-2 mb-4 bg-gray-700 border border-gray-600 rounded-md text-white" placeholder="Digite aqui..."
          />
        )}
        <div className="flex justify-around gap-4">
          <button onClick={handleConfirm} className={`px-5 py-2 rounded-lg font-bold shadow-md ${type === 'confirm' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white`}>
            {confirmButtonText}
          </button>
          {type !== 'info' && <button onClick={handleCancel} className="px-5 py-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg shadow-md">Cancelar</button>}
        </div>
      </div>
    </div>
  );
});

const AutoResizingTextarea = ({ value, onChange, placeholder, className, disabled }) => {
    const textareaRef = useRef(null);
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [value]);
    return <textarea ref={textareaRef} value={value} onChange={onChange} placeholder={placeholder} className={`${className} resize-none overflow-hidden`} rows="1" disabled={disabled}/>
};

const FloatingNavMenu = React.memo(() => (
  <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-40">
    <a href="#info" title="Topo" className="bg-gray-700 hover:bg-gray-600 text-white font-bold w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-lg">⬆️</a>
    <a href="#actions" title="Ações" className="bg-gray-700 hover:bg-gray-600 text-white font-bold w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-lg">⚔️</a>
    <a href="#perks" title="Vantagens" className="bg-gray-700 hover:bg-gray-600 text-white font-bold w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-lg">🌟</a>
    <a href="#skills" title="Habilidades" className="bg-gray-700 hover:bg-gray-600 text-white font-bold w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-lg">✨</a>
    <a href="#story" title="História" className="bg-gray-700 hover:bg-gray-600 text-white font-bold w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-lg">📜</a>
    <a href="#notes" title="Anotações" className="bg-gray-700 hover:bg-gray-600 text-white font-bold w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-lg">📝</a>
    <a href="#discord" title="Discord" className="bg-gray-700 hover:bg-gray-600 text-white font-bold w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-lg">💬</a>
  </div>
));

const UserStatusSection = React.memo(({ isAuthReady, user, isMaster, isLoading, handleSignOut, handleGoogleSignIn, isCollapsed, toggleSection }) => { /* ... */ });
const CharacterList = React.memo(({ charactersList, isLoading, isMaster, viewingAllCharacters, user, handleCreateNewCharacter, handleImportJsonClick, setViewingAllCharacters, handleSelectCharacter, handleDeleteCharacter }) => { /* ... */ });
const CharacterInfoSection = React.memo(({ character, user, isMaster, handleChange, handlePhotoUrlClick, toggleSection }) => { /* ... */ });
const MainAttributesSection = React.memo(({ character, user, isMaster, mainAttributeModifiers, dexterityValue, initiativeTotal, handleMainAttributeChange, handleSingleMainAttributeChange, toggleSection }) => { /* ... */ });
const DiscordIntegrationSection = React.memo(({ webhookUrl, handleChange, isMaster, ownerUid, userUid, toggleSection, isCollapsed }) => { /* ... */ });
const ActionsAndBuffsSection = React.memo(({ character, user, isMaster, handleAddBuff, handleRemoveBuff, handleBuffChange, handleToggleBuffActive, handleToggleBuffCollapsed, handleOpenActionModal, allAttributes, handleAddFormulaAction, handleRemoveFormulaAction, handleFormulaActionChange, handleAddActionComponent, handleRemoveActionComponent, handleActionComponentChange, handleExecuteFormulaAction, handleToggleCustomActionCollapsed, toggleSection }) => { /* ... */ });
const AttributesSection = React.memo(({ character, user, isMaster, dynamicAttributeModifiers, handleAddAttribute, handleRemoveAttribute, handleAttributeChange, handleDragStart, handleDragOver, handleDrop, toggleSection }) => { /* ... */ });
const InventoryWalletSection = React.memo(({ character, user, isMaster, zeniAmount, handleZeniChange, handleAddZeni, handleRemoveZeni, handleAddItem, handleInventoryItemChange, handleRemoveItem, toggleItemCollapsed, toggleSection }) => { /* ... */ });
const PerksSection = React.memo(({ character, user, isMaster, handleAddPerk, handleRemovePerk, handlePerkChange, handlePerkOriginChange, toggleItemCollapsed, toggleSection }) => { /* ... */ });
const SkillsSection = React.memo(({ character, user, isMaster, handleAddAbility, handleRemoveAbility, handleAbilityChange, handleAddSpecialization, handleRemoveSpecialization, handleSpecializationChange, handleAddEquippedItem, handleRemoveEquippedItem, handleEquippedItemChange, toggleItemCollapsed, toggleSection }) => { /* ... */ });
const StoryAndNotesSection = React.memo(({ character, user, isMaster, addHistoryBlock, removeHistoryBlock, updateHistoryBlock, addNoteBlock, removeNoteBlock, updateNoteBlock, handleDragStart, handleDragOver, handleDrop, toggleSection }) => { /* ... */ });
const ActionButtons = React.memo(({ character, user, isMaster, isLoading, handleExportJson, handleImportJsonClick, handleReset }) => { /* ... */ });


// ============================================================================
// --- COMPONENTE PRINCIPAL (Onde tudo se junta) ---
// ============================================================================
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
  const [charactersList, setCharactersList] = useState([]);
  const [selectedCharId, setSelectedCharId] = useState(null);
  const [ownerUid, setOwnerUid] = useState(null);
  const [viewingAllCharacters, setViewingAllCharacters] = useState(false);
  const [modal, setModal] = useState({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
  const [actionModal, setActionModal] = useState({ isVisible: false, type: '', title: '' });
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);
  
  const [loadedCharacter, setLoadedCharacter] = useState(null);
  const charManager = useCharacterManager(loadedCharacter);
  const { character, setCharacter, actionEngine } = charManager;

  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig);
      setAuth(getAuth(app));
      setDb(getFirestore(app));
    } catch (error) {
      console.error("Erro ao inicializar Firebase:", error);
      setModal({ isVisible: true, message: `Erro ao inicializar: ${error.message}`, type: 'info' });
    }
  }, [firebaseConfig]);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      if (!currentUser) {
        setLoadedCharacter(null);
        setCharactersList([]);
        setSelectedCharId(null);
        setOwnerUid(null);
        setIsMaster(false);
      }
    });
    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    if (!db || !user || !isAuthReady) return;
    const unsub = onSnapshot(doc(db, `artifacts/${appId}/users/${user.uid}`), (docSnap) => {
        setIsMaster(docSnap.exists() && docSnap.data().isMaster === true);
    });
    return () => unsub();
  }, [db, user, isAuthReady, appId]);

  const fetchCharactersList = useCallback(async () => {
    // ... (código da função permanece o mesmo)
  }, [db, user, isAuthReady, isMaster, appId, viewingAllCharacters]);

  useEffect(() => {
    if (user && db && isAuthReady) {
      fetchCharactersList();
    }
  }, [user, db, isAuthReady, viewingAllCharacters, fetchCharactersList]);
  
  useEffect(() => {
    if (!db || !user || !isAuthReady || !selectedCharId) {
        if (!selectedCharId) setLoadedCharacter(null);
        return;
    }
    const targetUid = ownerUid || user.uid;
    const unsub = onSnapshot(doc(db, `artifacts/${appId}/users/${targetUid}/characterSheets/${selectedCharId}`), (docSnap) => {
        if (docSnap.exists() && !docSnap.data().deleted) {
            const data = docSnap.data();
            const deserializedData = { ...data };
            Object.keys(deserializedData).forEach(key => {
                if (typeof deserializedData[key] === 'string') {
                    try { deserializedData[key] = JSON.parse(deserializedData[key]); } catch (e) { /* Ignora */ }
                }
            });
            setLoadedCharacter({ ...initialCharState, ...deserializedData });
        } else {
            setLoadedCharacter(null);
            setSelectedCharId(null);
            setOwnerUid(null);
            fetchCharactersList();
        }
    });
    return () => unsub();
  }, [db, user, isAuthReady, selectedCharId, ownerUid, appId, fetchCharactersList]);

  useEffect(() => {
    if (!db || !user || !isAuthReady || !character || !selectedCharId) return;
    const targetUid = character.ownerUid || user.uid;
    if (user.uid !== targetUid && !isMaster) return;

    const handler = setTimeout(async () => {
      try {
        const dataToSave = { ...character };
        Object.keys(dataToSave).forEach(key => {
            if (typeof dataToSave[key] === 'object' && dataToSave[key] !== null) {
                dataToSave[key] = JSON.stringify(dataToSave[key]);
            }
        });
        await setDoc(doc(db, `artifacts/${appId}/users/${targetUid}/characterSheets/${selectedCharId}`), dataToSave, { merge: true });
      } catch (error) { console.error('Erro ao salvar ficha:', error); }
    }, 500);
    return () => clearTimeout(handler);
  }, [character, db, user, isAuthReady, selectedCharId, appId, isMaster]);

  const handleExecuteActionWithSideEffects = useCallback(async (actionId) => {
    // ... (código da função permanece o mesmo)
  }, [character, actionEngine, setCharacter]);

  // ... (outros handlers globais como handleGoogleSignIn, handleDeleteCharacter, etc.)

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 font-inter">
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap'); html { scroll-behavior: smooth; }`}</style>
        <div className="max-w-4xl mx-auto bg-gray-800 rounded-lg shadow-2xl p-6 md:p-8 border border-gray-700">
            <h1 className="text-4xl font-extrabold text-center text-purple-400 mb-8 tracking-wide">Ficha StoryCraft</h1>
            <UserStatusSection isAuthReady={isAuthReady} user={user} isMaster={isMaster} isLoading={isLoading} handleSignOut={() => signOut(auth)} handleGoogleSignIn={() => signInWithPopup(auth, new GoogleAuthProvider())} toggleSection={charManager.toggleSection} isCollapsed={character?.isUserStatusCollapsed} />
            
            {user && !selectedCharId && <CharacterList {...{charactersList, isLoading, isMaster, viewingAllCharacters, user, setViewingAllCharacters, handleSelectCharacter: setSelectedCharId}} />}
            
            {user && selectedCharId && character && (
                <>
                    <FloatingNavMenu />
                    <div className="mb-4"><button onClick={() => setSelectedCharId(null)} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg">← Voltar para a Lista</button></div>
                    
                    <CharacterInfoSection character={character} user={user} isMaster={isMaster} handleChange={charManager.handleChange} handlePhotoUrlClick={() => {}} toggleSection={charManager.toggleSection} />
                    <MainAttributesSection character={character} user={user} isMaster={isMaster} {...charManager} mainAttributeModifiers={actionEngine.mainAttributeModifiers} dexterityValue={actionEngine.dexterityValue} initiativeTotal={actionEngine.initiativeTotal} />
                    <ActionsAndBuffsSection character={character} user={user} isMaster={isMaster} {...charManager} allAttributes={actionEngine.allAttributes} handleExecuteFormulaAction={handleExecuteActionWithSideEffects} handleOpenActionModal={(type) => setActionModal({isVisible: true, type, title: type === 'heal' ? 'Curar' : 'Dano'})} />
                    <AttributesSection character={character} user={user} isMaster={isMaster} {...charManager} dynamicAttributeModifiers={actionEngine.dynamicAttributeModifiers} />
                    <InventoryWalletSection character={character} user={user} isMaster={isMaster} {...charManager} />
                    <PerksSection character={character} user={user} isMaster={isMaster} {...charManager} />
                    <SkillsSection character={character} user={user} isMaster={isMaster} {...charManager} />
                    <StoryAndNotesSection character={character} user={user} isMaster={isMaster} {...charManager} />
                    <DiscordIntegrationSection webhookUrl={character.discordWebhookUrl} handleChange={charManager.handleChange} isMaster={isMaster} ownerUid={character.ownerUid} userUid={user.uid} toggleSection={charManager.toggleSection} isCollapsed={character.isDiscordCollapsed} />
                    <ActionButtons character={character} user={user} isMaster={isMaster} isLoading={isLoading} handleExportJson={()=>{}} handleImportJsonClick={() => fileInputRef.current.click()} handleReset={charManager.handleReset} />
                </>
            )}

            {!user && isAuthReady && <p className="text-center text-gray-400 text-lg mt-8">Faça login para começar!</p>}
        </div>
        <input type="file" ref={fileInputRef} onChange={() => {}} accept=".json" className="hidden" />
        {modal.isVisible && <CustomModal {...modal} onClose={() => setModal(prev => ({ ...prev, isVisible: false }))} />}
        {actionModal.isVisible && <ActionModal {...actionModal} onConfirm={charManager.handleConfirmAction} onClose={() => setActionModal({ isVisible: false })} />}
        {isLoading && <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><div className="text-white text-xl">Carregando...</div></div>}
    </div>
  );
};

export default App;

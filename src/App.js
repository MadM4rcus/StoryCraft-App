import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, getDocs, deleteDoc } from 'firebase/firestore';

// Custom Modal component for personalized prompts and confirmations
const CustomModal = ({ message, onConfirm, onCancel, type, onClose }) => {
  const [inputValue, setInputValue] = useState('');

  const handleConfirm = () => {
    if (type === 'prompt') {
      onConfirm(inputValue);
      // IMPORTANT: Do NOT call onClose() here for prompts. The parent component (App)
      // will manage closing/transition for multi-step prompts.
    } else {
      onConfirm();
      onClose(); // For 'confirm' or 'info' types, close immediately.
    }
  };

  const handleCancel = () => {
    onCancel();
    onClose(); // Always close on cancel.
  };

  // Determines the confirmation button text based on the modal type
  const confirmButtonText = useMemo(() => {
    switch (type) {
      case 'confirm':
        return 'Confirmar';
      case 'prompt':
        return 'Adicionar'; // Used to add items/perks after prompt
      case 'info':
      default:
        return 'OK'; // For informational messages
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
            {confirmButtonText} {/* Using dynamic text */}
          </button>
          {type !== 'info' && ( // "Info" modals usually only need an "OK" button
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

// Main application component
const App = () => {
  // Firebase configuration
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

  // Firebase states
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isMaster, setIsMaster] = useState(false); // Master role state

  // Character management states
  const [character, setCharacter] = useState(null);
  const [charactersList, setCharactersList] = useState([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState(null);
  const [viewingAllCharacters, setViewingAllCharacters] = useState(false);

  // Modal visibility and content state
  const [modal, setModal] = useState({
    isVisible: false,
    message: '',
    type: '',
    onConfirm: () => {},
    onCancel: () => {},
  });

  // Loading indicator state
  const [isLoading, setIsLoading] = useState(false);

  // Zeni amount to be added/removed
  const [zeniAmount, setZeniAmount] = useState(0);

  // Ref for file input to trigger it programmatically
  const fileInputRef = useRef(null);

  // States to control section collapse
  const [isUserStatusCollapsed, setIsUserStatusCollapsed] = useState(false); // New state for User Status
  const [isCharacterInfoCollapsed, setIsCharacterInfoCollapsed] = useState(false); // New state for Character Info
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

  // Mapping of basic attributes to emojis
  const basicAttributeEmojis = {
    forca: '💪',
    destreza: '🏃‍♂️',
    inteligencia: '🧠',
    constituicao: '❤️‍',
    sabedoria: '🧘‍♂️',
    carisma: '🎭',
    armadura: '�',
    poderDeFogo: '🎯',
  };

  // Mapping of magic attributes to emojis and their Portuguese names
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

  // Initializes Firebase and sets up authentication listener
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
          setIsMaster(false);
        }
      });
      return () => unsubscribe();
    } catch (error) {
      console.error("Error initializing Firebase:", error);
      setModal({
        isVisible: true,
        message: `Error initializing the app. Check Firebase configuration. Details: ${error.message}`,
        type: 'info',
        onConfirm: () => {},
        onCancel: () => {},
      });
    }
  }, [firebaseConfig]);

  // Effect to load user role (master/player) from Firestore
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
        console.error("Error loading user role:", error);
        setIsMaster(false);
      });
    } else {
      setIsMaster(false);
    }
    return () => unsubscribeRole();
  }, [db, user, isAuthReady, appId]);

  // Function to load the list of characters
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
      console.log("Character list loaded.");
    } catch (error) {
      console.error("Error loading character list:", error);
      setModal({
        isVisible: true,
        message: `Error loading character list: ${error.message}`,
        type: 'info',
        onConfirm: () => {},
        onCancel: () => {},
      });
    } finally {
      setIsLoading(false);
    }
  }, [db, user, isAuthReady, isMaster, appId]);

  // Loads the character list when user, db or isAuthReady change
  useEffect(() => {
    if (user && db && isAuthReady) {
      fetchCharactersList();
    }
  }, [user, db, isAuthReady, fetchCharactersList]);

  // Real-time listener for the selected character
  useEffect(() => {
    let unsubscribeCharacter = () => {};
    if (db && user && isAuthReady && selectedCharacterId) {
      const charToLoad = charactersList.find(c => c.id === selectedCharacterId);
      const targetUid = charToLoad ? charToLoad.ownerUid : user.uid;

      const characterDocRef = doc(db, `artifacts/${appId}/users/${targetUid}/characterSheets/${selectedCharacterId}`);

      unsubscribeCharacter = onSnapshot(characterDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.deleted) {
            setCharacter(null);
            setSelectedCharacterId(null);
            fetchCharactersList();
            setModal({ isVisible: true, message: "The selected sheet has been deleted.", type: "info", onConfirm: () => {}, onCancel: () => {} });
            return;
          }
          const deserializedData = { ...data };
          try {
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
            
            // Deserializes the 'history' field to the new array structure
            let historyData = deserializedData.history;
            if (typeof historyData === 'string') {
              try {
                // Tries to parse if it's a JSON string
                historyData = JSON.parse(historyData);
              } catch (parseError) {
                // If it's a string but not a valid JSON (old format), converts to a text block
                historyData = [{ id: crypto.randomUUID(), type: 'text', value: historyData }];
              }
            }
            deserializedData.history = Array.isArray(historyData) ? historyData : []; // Ensures it's an array

            // Ensures image fields exist and have default values
            deserializedData.history = deserializedData.history.map(block => {
              if (block.type === 'image') {
                return {
                  ...block,
                  width: block.width !== undefined ? block.width : '',
                  height: block.height !== undefined ? block.height : '',
                  fitWidth: block.fitWidth !== undefined ? block.fitWidth : true,
                };
              }
              return block;
            });

          } catch (e) {
            console.error("Error deserializing Firestore data:", e);
            setModal({
              isVisible: true,
              message: `Error loading sheet data: ${e.message}. Data might be corrupted.`,
              type: 'info',
              onConfirm: () => {},
              onCancel: () => {},
            });
          }

          // Ensures all array/object fields exist and are of the correct type
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

          setCharacter(deserializedData);
          console.log(`Sheet for '${deserializedData.name}' loaded from Firestore in real-time.`);
        } else {
          console.log("No sheet found for the selected ID or it was deleted.");
          setCharacter(null);
          setSelectedCharacterId(null);
          fetchCharactersList();
        }
      }, (error) => {
        console.error("Error listening to sheet in Firestore:", error);
        setModal({
          isVisible: true,
          message: `Error loading sheet from Firestore: ${error.message}`,
          type: 'info',
          onConfirm: () => {},
          onCancel: () => {},
        });
      });
    } else if (!selectedCharacterId) {
      setCharacter(null);
    }
    return () => unsubscribeCharacter();
  }, [db, user, isAuthReady, selectedCharacterId, charactersList, appId, fetchCharactersList]);

  // Saves the sheet to Firestore
  useEffect(() => {
    if (db && user && isAuthReady && character && selectedCharacterId) {
      const charToSaveOwnerUid = charactersList.find(c => c.id === selectedCharacterId)?.ownerUid;
      const targetUidForSave = charToSaveOwnerUid || user.uid; 

      if (user.uid !== targetUidForSave && !isMaster) {
        console.warn("Attempt to save another user's sheet without write permission.");
        return;
      }

      const characterDocRef = doc(db, `artifacts/${appId}/users/${targetUidForSave}/characterSheets/${selectedCharacterId}`);
      const saveCharacter = async () => {
        try {
          const dataToSave = { ...character };
          dataToSave.id = selectedCharacterId;
          dataToSave.ownerUid = targetUidForSave;

          // Stringify nested objects for Firestore
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
          dataToSave.history = JSON.stringify(dataToSave.history); // Serializes the 'history' field
          
          if ('deleted' in dataToSave) {
            delete dataToSave.deleted;
          }

          await setDoc(characterDocRef, dataToSave, { merge: true });
          console.log(`Sheet for '${character.name}' automatically saved to Firestore.`);
        } catch (error) {
          console.error('Error saving sheet to Firestore automatically:', error);
        }
      };
      const handler = setTimeout(() => {
        saveCharacter();
      }, 500);

      return () => clearTimeout(handler);
    }
  }, [character, db, user, isAuthReady, selectedCharacterId, charactersList, appId, isMaster]);

  // Handles changes in simple text fields
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

  // Handles changes in main attributes (HP, MP, Initiative, FA, FM, FD)
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

  // Handles changes in main attributes that are just a number (Initiative, FA, FM, FD)
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

  // Handles changes in basic and magic attributes (Base Value, Permanent Bonus, Conditional Bonus)
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

  // Handles adding items to inventory
  const handleAddItem = () => {
    setModal({
      isVisible: true,
      message: 'Enter item name:',
      type: 'prompt',
      onConfirm: (itemName) => {
        if (itemName) {
          setModal({
            isVisible: true,
            message: 'Enter item description:',
            type: 'prompt',
            onConfirm: (itemDescription) => {
              setCharacter(prevChar => {
                const updatedInventory = [...(prevChar.inventory || []), { name: itemName, description: itemDescription }];
                return { ...prevChar, inventory: updatedInventory };
              });
              setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
            },
            onCancel: () => {
              setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
            },
          });
        } else {
          setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
        }
      },
      onCancel: () => {
        setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
      },
    });
  };

  // Handles editing items in inventory
  const handleInventoryItemChange = (index, field, value) => {
    setCharacter(prevChar => {
      const updatedInventory = [...(prevChar.inventory || [])];
      if (updatedInventory[index]) {
        updatedInventory[index][field] = value;
      }
      return { ...prevChar, inventory: updatedInventory };
    });
  };

  // Handles removing items from inventory
  const handleRemoveItem = (indexToRemove) => {
    setCharacter(prevChar => {
      const updatedInventory = (prevChar.inventory || []).filter((_, index) => index !== indexToRemove);
      return { ...prevChar, inventory: updatedInventory };
    });
  };

  // Handles Zeni change
  const handleZeniChange = (e) => {
    setZeniAmount(parseInt(e.target.value, 10) || 0);
  };

  // Handles adding Zeni
  const handleAddZeni = () => {
    setCharacter(prevChar => ({
      ...prevChar,
      wallet: { ...(prevChar.wallet || { zeni: 0 }), zeni: (prevChar.wallet.zeni || 0) + zeniAmount },
    }));
    setZeniAmount(0);
  };

  // Handles removing Zeni
  const handleRemoveZeni = () => {
    setCharacter(prevChar => ({
      ...prevChar,
      wallet: { ...(prevChar.wallet || { zeni: 0 }), zeni: Math.max(0, (prevChar.wallet.zeni || 0) - zeniAmount) },
    }));
    setZeniAmount(0);
  };

  // Handles adding Advantage/Disadvantage
  const handleAddPerk = (type) => {
    setModal({
      isVisible: true,
      message: `Enter the name of the ${type === 'advantages' ? 'Advantage' : 'Disadvantage'}:`,
      type: 'prompt',
      onConfirm: (name) => {
        if (name) {
          setModal({
            isVisible: true,
            message: `Enter the description of ${name}:`,
            type: 'prompt',
            onConfirm: (description) => {
              setModal({
                isVisible: true,
                message: `Enter the value of ${name}:`,
                type: 'prompt',
                onConfirm: (value) => {
                  setCharacter(prevChar => {
                    const updatedPerks = [...(prevChar[type] || []), { name: name, description: description, origin: { class: false, race: false, manual: false }, value: parseInt(value, 10) || 0 }];
                    return { ...prevChar, [type]: updatedPerks };
                  });
                  setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
                },
                onCancel: () => {
                  setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
                },
              });
            },
            onCancel: () => {
              setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
            },
          });
        } else {
          setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
        }
      },
      onCancel: () => {
        setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
      },
    });
  };

  // Handles editing Advantage/Disadvantage
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

  // Handles removing Advantage/Disadvantage
  const handleRemovePerk = (type, indexToRemove) => {
    setCharacter(prevChar => {
      const updatedPerks = (prevChar[type] || []).filter((_, index) => index !== indexToRemove);
      return { ...prevChar, [type]: updatedPerks };
    });
  };

  // Handles changing Advantage/Disadvantage origin
  const handlePerkOriginChange = (type, index, originType) => {
    setCharacter(prevChar => {
      const updatedPerks = [...(prevChar[type] || [])];
      if (updatedPerks[index]) {
        updatedPerks[index].origin[originType] = !updatedPerks[index].origin[originType];
      }
      return { ...prevChar, [type]: updatedPerks };
    });
  };

  // Handles adding Ability (Class/Race/Custom)
  const handleAddAbility = () => {
    setModal({
      isVisible: true,
      message: 'Enter Ability title:',
      type: 'prompt',
      onConfirm: (title) => {
        if (title) {
          setModal({
            isVisible: true,
            message: `Enter description for ability "${title}":`,
            type: 'prompt',
            onConfirm: (description) => {
              setCharacter(prevChar => {
                const updatedAbilities = [...(prevChar.abilities || []), { title: title, description: description }];
                return { ...prevChar, abilities: updatedAbilities };
              });
              setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
            },
            onCancel: () => {
              setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
            },
          });
        } else {
          setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
        }
      },
      onCancel: () => {
        setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
      },
    });
  };

  // Handles editing Ability
  const handleAbilityChange = (index, field, value) => {
    setCharacter(prevChar => {
      const updatedAbilities = [...(prevChar.abilities || [])];
      if (updatedAbilities[index]) {
        updatedAbilities[index][field] = value;
      }
      return { ...prevChar, abilities: updatedAbilities };
    });
  };

  // Handles removing Ability
  const handleRemoveAbility = (indexToRemove) => {
    setCharacter(prevChar => {
      const updatedAbilities = (prevChar.abilities || []).filter((_, index) => index !== indexToRemove);
      return { ...prevChar, abilities: updatedAbilities };
    });
  };

  // Handles adding Specialization
  const handleAddSpecialization = () => {
    setModal({
      isVisible: true,
      message: 'Enter Specialization name:',
      type: 'prompt',
      onConfirm: (name) => {
        if (name) {
          setCharacter(prevChar => {
            const updatedSpecializations = [...(prevChar.specializations || []), { name: name, modifier: 0, bonus: 0 }];
            return { ...prevChar, specializations: updatedSpecializations };
          });
          setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
        } else {
          setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
        }
      },
      onCancel: () => {
        setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
      },
    });
  };

  // Handles removing Specialization
  const handleRemoveSpecialization = (indexToRemove) => {
    setCharacter(prevChar => {
      const updatedSpecializations = (prevChar.specializations || []).filter((_, index) => index !== indexToRemove);
      return { ...prevChar, specializations: updatedSpecializations };
    });
  };

  // Handles changing Specialization name, modifier, or bonus
  const handleSpecializationChange = (index, field, value) => {
    setCharacter(prevChar => {
      const updatedSpecs = [...(prevChar.specializations || [])];
      if (updatedSpecs[index]) {
        if (field === 'name') {
          updatedSpecs[index][field] = value;
        } else {
          updatedSpecs[index][field] = parseInt(value, 10) || 0;
        }
      }
      return { ...prevChar, specializations: updatedSpecs };
    });
  };

  // Handles adding Equipped Item
  const handleAddEquippedItem = () => {
    setModal({
      isVisible: true,
      message: 'Enter Equipped Item name:',
      type: 'prompt',
      onConfirm: (name) => {
        if (name) {
          setModal({
            isVisible: true,
            message: `Enter description for item "${name}":`,
            type: 'prompt',
            onConfirm: (description) => {
              setModal({
                isVisible: true,
                message: `Enter attributes/effects for item "${name}" (e.g., +5 Strength, Fire Damage):`,
                type: 'prompt',
                onConfirm: (attributes) => {
                  setCharacter(prevChar => {
                    const updatedEquippedItems = [...(prevChar.equippedItems || []), { name: name, description: description, attributes: attributes }];
                    return { ...prevChar, equippedItems: updatedEquippedItems };
                  });
                  setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
                },
                onCancel: () => {
                  setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
                },
              });
            },
            onCancel: () => {
              setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
            },
          });
        } else {
          setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
        }
      },
      onCancel: () => {
        setModal({ isVisible: false, message: '', type: '', onConfirm: () => {}, onCancel: () => {} });
      },
    });
  };

  // Handles editing Equipped Item
  const handleEquippedItemChange = (index, field, value) => {
    setCharacter(prevChar => {
      const updatedEquippedItems = [...(prevChar.equippedItems || [])];
      if (updatedEquippedItems[index]) {
        updatedEquippedItems[index][field] = value;
      }
      return { ...prevChar, equippedItems: updatedEquippedItems };
    });
  };

  // Handles removing Equipped Item
  const handleRemoveEquippedItem = (indexToRemove) => {
    setCharacter(prevChar => {
      const updatedEquippedItems = (prevChar.equippedItems || []).filter((_, index) => index !== indexToRemove);
      return { ...prevChar, equippedItems: updatedEquippedItems };
    });
  };

  // Handles text changes for Notes
  const handleNotesChange = (e) => {
    const { name, value } = e.target;
    setCharacter(prevChar => ({
      ...prevChar,
      [name]: value,
    }));
  };

  // Functions for the new Modular History section
  const addHistoryBlock = (type) => {
    if (type === 'text') {
      setCharacter(prevChar => ({
        ...prevChar,
        history: [...(prevChar.history || []), { id: crypto.randomUUID(), type: 'text', value: '' }],
      }));
    } else if (type === 'image') {
      setModal({
        isVisible: true,
        message: 'Paste image URL:',
        type: 'prompt',
        onConfirm: (url) => {
          if (url) {
            setCharacter(prevChar => ({
              ...prevChar,
              history: [...(prevChar.history || []), { id: crypto.randomUUID(), type: 'image', value: url, width: '', height: '', fitWidth: true }],
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

  // Updates a specific field of a history block
  const updateHistoryBlock = (id, field, value) => {
    setCharacter(prevChar => ({
      ...prevChar,
      history: (prevChar.history || []).map(block => {
        if (block.id === id) {
          if (block.type === 'image' && (field === 'width' || field === 'height')) {
            // Ensures width/height are numbers or empty string
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

  // Functions for Drag-and-Drop in History
  const draggedItemRef = useRef(null);

  const handleDragStart = (e, index) => {
    draggedItemRef.current = index;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", e.target); // Required for Firefox
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // Allows drop
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    const draggedItemIndex = draggedItemRef.current;
    
    if (draggedItemIndex === null || draggedItemIndex === dropIndex) {
        draggedItemRef.current = null; // Reset
        return;
    }

    const newHistory = [...character.history];
    const [reorderedItem] = newHistory.splice(draggedItemIndex, 1);
    newHistory.splice(dropIndex, 0, reorderedItem);

    setCharacter(prevChar => ({
        ...prevChar,
        history: newHistory
    }));
    draggedItemRef.current = null; // Reset after drop
  };

  // Function to reset the character sheet to default values using the custom modal
  const handleReset = () => {
    setModal({
      isVisible: true,
      message: 'Are you sure you want to reset the sheet? All data will be lost. (This action does NOT delete the sheet from the database)',
      type: 'confirm',
      onConfirm: () => {
        setCharacter({
          name: '', photoUrl: 'https://placehold.co/150x150/000000/FFFFFF?text=Foto', age: '', height: '', gender: '', race: '', class: '', alignment: '',
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

  // Function to export character data as JSON
  const handleExportJson = () => {
    if (!character) {
      setModal({ isVisible: true, message: 'No character selected for export.', type: 'info', onConfirm: () => {}, onCancel: () => {} });
      return;
    }
    const jsonString = JSON.stringify(character, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${character.name || 'rpg_sheet'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Function to trigger file input for JSON import
  const handleImportJsonClick = () => {
    fileInputRef.current.click();
  };

  // Function to handle JSON file import
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
              message: 'Are you sure you want to import this sheet? Current data will be replaced and a new character will be created.',
              type: 'confirm',
              onConfirm: async () => {
                const newCharId = crypto.randomUUID();
                const importedCharacterData = {
                  ...importedData,
                  id: newCharId,
                  ownerUid: user.uid,
                  xp: importedData.xp !== undefined ? importedData.xp : 100,
                  level: importedData.level !== undefined ? importedData.level : 0,
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
                  notes: importedData.notes || '',
                };

                importedCharacterData.history = importedCharacterData.history.map(block => {
                  if (block.type === 'image') {
                    return {
                      ...block,
                      width: block.width !== undefined ? block.width : '',
                      height: block.height !== undefined ? block.height : '',
                      fitWidth: block.fitWidth !== undefined ? block.fitWidth : true,
                    };
                  }
                  return block;
                });

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
                    setSelectedCharacterId(newCharId);
                    fetchCharactersList();
                    setModal({ isVisible: true, message: `Character '${importedData.name}' imported and saved successfully!`, type: 'info', onConfirm: () => {}, onCancel: () => {} });
                } catch (error) {
                    console.error("Error saving imported sheet:", error);
                    setModal({ isVisible: true, message: `Error saving imported sheet: ${error.message}`, type: 'info', onConfirm: () => {}, onCancel: () => {} });
                }
              },
              onCancel: () => {},
            });
          } else {
            setModal({
              isVisible: true,
              message: 'The selected JSON file does not appear to be a valid character sheet.',
              type: 'info',
              onConfirm: () => {},
              onCancel: () => {},
            });
          }
        } catch (error) {
          setModal({
            isVisible: true,
            message: 'Error reading JSON file. Make sure it is a valid JSON.',
            type: 'info',
            onConfirm: () => {},
            onCancel: () => {},
          });
          console.error('Error parsing JSON file:', error);
        }
      };
      reader.readAsText(file);
    }
  };

  // Function to create a new character
  const handleCreateNewCharacter = () => {
    setModal({
      isVisible: true,
      message: 'Enter the name of the new character:',
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
              level: 0, xp: 100,
              mainAttributes: { hp: { current: 0, max: 0 }, mp: { current: 0, max: 0 }, initiative: 0, fa: 0, fm: 0, fd: 0 },
              basicAttributes: { forca: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, destreza: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, inteligencia: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, constituicao: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, sabedoria: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, carisma: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, armadura: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, poderDeFogo: { base: 0, permBonus: 0, condBonus: 0, total: 0 } },
              magicAttributes: { fogo: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, agua: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, ar: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, terra: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, luz: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, trevas: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, espirito: { base: 0, permBonus: 0, condBonus: 0, total: 0 }, outro: { base: 0, permBonus: 0, condBonus: 0, total: 0 } },
              inventory: [], wallet: { zeni: 0 }, advantages: [], disadvantages: [], abilities: [], specializations: [], equippedItems: [], history: [], notes: '',
            };

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
            dataToSave.history = JSON.stringify(dataToSave.history);

            await setDoc(characterDocRef, dataToSave);
            fetchCharactersList();
            setModal({ isVisible: true, message: `Character '${name}' created successfully!`, type: 'info', onConfirm: () => {}, onCancel: () => {} });
          } catch (error) {
            console.error("Error creating new character:", error);
            setModal({ isVisible: true, message: `Error creating character: ${error.message}`, type: 'info', onConfirm: () => {}, onCancel: () => {} });
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

  // Function to select a character from the list
  const handleSelectCharacter = (charId) => {
    setSelectedCharacterId(charId);
    setViewingAllCharacters(false);
  };

  // Function to go back to the character list
  const handleBackToList = () => {
    setSelectedCharacterId(null);
    setCharacter(null);
    fetchCharactersList();
  };

  // Function to delete a character (changed to deleteDoc)
  const handleDeleteCharacter = (charId, charName, ownerUid) => {
    setModal({
      isVisible: true,
      message: `Are you sure you want to PERMANENTLY DELETE character '${charName}'? This action is irreversible.`,
      type: 'confirm',
      onConfirm: async () => {
        if (!db || !user) return;
        if (user.uid !== ownerUid && !isMaster) {
          setModal({ isVisible: true, message: 'You do not have permission to delete this character.', type: 'info', onConfirm: () => {}, onCancel: () => {} });
          return;
        }
        setIsLoading(true);
        try {
          const characterDocRef = doc(db, `artifacts/${appId}/users/${ownerUid}/characterSheets/${charId}`);
          await deleteDoc(characterDocRef);
          setSelectedCharacterId(null);
          setCharacter(null);
          fetchCharactersList();
          setModal({ isVisible: true, message: `Character '${charName}' permanently deleted successfully!`, type: 'info', onConfirm: () => {}, onCancel: () => {} });
        } catch (error) {
          console.error("Error deleting character:", error);
          setModal({ isVisible: true, message: `Error deleting character: ${error.message}`, type: 'info', onConfirm: () => {}, onCancel: () => {} });
        } finally {
          setIsLoading(false);
        }
      },
      onCancel: () => {},
    });
  };

  // --- Google Authentication Functions ---
  const handleGoogleSignIn = async () => {
    if (!auth) {
      setModal({ isVisible: true, message: 'Firebase Auth not initialized.', type: 'info', onConfirm: () => {}, onCancel: () => {} });
      return;
    }
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setModal({ isVisible: true, message: 'Google login successful!', type: 'info', onConfirm: () => {}, onCancel: () => {} });
    } catch (error) {
      console.error("Error in Google login:", error);
      let errorMessage = "Error logging in with Google.";
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = "Login canceled by user.";
      } else if (error.code === 'auth/cancelled-popup-request') {
        errorMessage = "Login popup request already in progress. Please try again.";
      } else {
        errorMessage += ` Details: ${error.message}`;
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
      setIsMaster(false);
      setModal({ isVisible: true, message: 'You have been successfully disconnected.', type: 'info', onConfirm: () => {}, onCancel: () => {} });
    } catch (error) {
      console.error("Error logging out:", error);
      setModal({ isVisible: true, message: `Error logging out: ${error.message}`, type: 'info', onConfirm: () => {}, onCancel: () => {} });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to toggle section collapse state
  const toggleSection = (setter) => setter(prev => !prev);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 font-inter">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
          body {
            font-family: 'Inter', sans-serif;
          }

          /* Hides spin buttons for WebKit browsers (Chrome, Safari) */
          input[type="number"]::-webkit-outer-spin-button,
          input[type="number"]::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }

          /* Hides spin buttons for Firefox */
          input[type="number"] {
            -moz-appearance: textfield;
          }
        `}
      </style>
      <div className="max-w-4xl mx-auto bg-gray-800 rounded-lg shadow-2xl p-6 md:p-8 border border-gray-700">
        <h1 className="text-4xl font-extrabold text-center text-purple-400 mb-8 tracking-wide">
          Ficha StoryCraft
        </h1>

        {/* User Status Information (Firebase Authentication) */}
        <section className="mb-8 p-4 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
          <h2 
            className="text-xl font-bold text-yellow-300 mb-2 cursor-pointer flex justify-between items-center"
            onClick={() => toggleSection(setIsUserStatusCollapsed)}
          >
            Status do Usuário
            <span>{isUserStatusCollapsed ? '▼' : '▲'}</span>
          </h2>
          {!isUserStatusCollapsed && (
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

        {/* If user is logged in and no character is selected, show character list */}
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

        {/* If a character is selected, show the sheet */}
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

            {/* Character Information */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection(setIsCharacterInfoCollapsed)}
              >
                Informações do Personagem
                <span>{isCharacterInfoCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isCharacterInfoCollapsed && (
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

            {/* Main Attributes */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection(setIsMainAttributesCollapsed)}
              >
                Atributos Principais
                <span>{isMainAttributesCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isMainAttributesCollapsed && (
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
                  {/* Initiative, FA, FM, FD */}
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

            {/* Basic Attributes */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection(setIsBasicAttributesCollapsed)}
              >
                Atributos Básicos
                <span>{isBasicAttributesCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isBasicAttributesCollapsed && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Physical Attributes */}
                  <div>
                    <h3 className="text-xl font-semibold text-purple-300 mb-3 border-b border-purple-500 pb-1">Físicos</h3>
                    <div className="grid grid-cols-1 gap-2">
                      {Object.entries(character.basicAttributes).map(([key, attr]) => (
                        <div key={key} className="p-2 bg-gray-600 rounded-md">
                          <div className="flex items-center gap-2 text-xs justify-between">
                            <label className="capitalize text-base font-medium text-gray-200 flex-shrink-0">
                              {basicAttributeEmojis[key] || ''} {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                            </label>
                            <div className="flex items-center gap-2 text-xs flex-grow justify-end">
                              <div className="flex flex-col items-center">
                                <span className="text-gray-400 text-xs text-center">Base</span>
                                <input type="number" value={attr.base === 0 ? '' : attr.base} onChange={(e) => handleBasicAttributeChange('basicAttributes', key, 'base', e.target.value)} className="w-10 p-1 bg-gray-700 border border-gray-500 rounded-md text-white text-center" disabled={user.uid !== character.ownerUid && !isMaster} />
                              </div>
                              <div className="flex flex-col items-center">
                                <span className="text-gray-400 text-xs text-center">Perm.</span>
                                <input type="number" value={attr.permBonus === 0 ? '' : attr.permBonus} onChange={(e) => handleBasicAttributeChange('basicAttributes', key, 'permBonus', e.target.value)} className="w-10 p-1 bg-gray-700 border border-gray-500 rounded-md text-white text-center" disabled={user.uid !== character.ownerUid && !isMaster} />
                              </div>
                              <div className="flex flex-col items-center">
                                <span className="text-gray-400 text-xs text-center">Cond.</span>
                                <input type="number" value={attr.condBonus === 0 ? '' : attr.condBonus} onChange={(e) => handleBasicAttributeChange('basicAttributes', key, 'condBonus', e.target.value)} className="w-10 p-1 bg-gray-700 border border-gray-500 rounded-md text-white text-center" disabled={user.uid !== character.ownerUid && !isMaster} />
                              </div>
                              <div className="flex flex-col items-center">
                                <span className="text-gray-400 text-xs text-center">Total</span>
                                <input type="number" value={attr.total === 0 ? '' : attr.total} readOnly className="w-10 p-1 bg-gray-700 border border-gray-500 rounded-md text-white font-bold cursor-not-allowed text-center" />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Magic Attributes */}
                  <div>
                    <h3 className="text-xl font-semibold text-purple-300 mb-3 border-b border-purple-500 pb-1">Mágicos</h3>
                    <div className="grid grid-cols-1 gap-2">
                      {Object.entries(character.magicAttributes).map(([key, attr]) => (
                        <div key={key} className="p-2 bg-gray-600 rounded-md">
                          <div className="flex items-center gap-2 text-xs justify-between">
                            <label className="capitalize text-base font-medium text-gray-200 flex-shrink-0">
                              {magicAttributeEmojis[key] || ''} {key.charAt(0).toUpperCase() + key.slice(1)}:
                            </label>
                            <div className="flex items-center gap-2 text-xs flex-grow justify-end">
                              <div className="flex flex-col items-center">
                                <span className="text-gray-400 text-xs text-center">Base</span>
                                <input type="number" value={attr.base === 0 ? '' : attr.base} onChange={(e) => handleBasicAttributeChange('magicAttributes', key, 'base', e.target.value)} className="w-10 p-1 bg-gray-700 border border-gray-500 rounded-md text-white text-center" disabled={user.uid !== character.ownerUid && !isMaster} />
                              </div>
                              <div className="flex flex-col items-center">
                                <span className="text-gray-400 text-xs text-center">Perm.</span>
                                <input type="number" value={attr.permBonus === 0 ? '' : attr.permBonus} onChange={(e) => handleBasicAttributeChange('magicAttributes', key, 'permBonus', e.target.value)} className="w-10 p-1 bg-gray-700 border border-gray-500 rounded-md text-white text-center" disabled={user.uid !== character.ownerUid && !isMaster} />
                              </div>
                              <div className="flex flex-col items-center">
                                <span className="text-gray-400 text-xs text-center">Cond.</span>
                                <input type="number" value={attr.condBonus === 0 ? '' : attr.condBonus} onChange={(e) => handleBasicAttributeChange('magicAttributes', key, 'condBonus', e.target.value)} className="w-10 p-1 bg-gray-700 border border-gray-500 rounded-md text-white text-center" disabled={user.uid !== character.ownerUid && !isMaster} />
                              </div>
                              <div className="flex flex-col items-center">
                                <span className="text-gray-400 text-xs text-center">Total</span>
                                <input type="number" value={attr.total === 0 ? '' : attr.total} readOnly className="w-10 p-1 bg-gray-700 border border-gray-500 rounded-md text-white font-bold cursor-not-allowed text-center" />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Inventory */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection(setIsInventoryCollapsed)}
              >
                Inventário
                <span>{isInventoryCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isInventoryCollapsed && (
                <>
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
                            placeholder="Descrição do item"
                            disabled={user.uid !== character.ownerUid && !isMaster}
                          ></textarea>
                        </li>
                      ))
                    )}
                  </ul>
                </>
              )}
            </section>

            {/* Wallet */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection(setIsWalletCollapsed)}
              >
                Zeni: {character.wallet.zeni === 0 ? '' : character.wallet.zeni}
                <span>{isWalletCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isWalletCollapsed && (
                <div className="flex items-center gap-2 w-full">
                  <input
                    type="number"
                    value={zeniAmount === 0 ? '' : zeniAmount}
                    onChange={handleZeniChange}
                    className="w-16 p-2 bg-gray-600 border border-gray-500 rounded-md focus:ring-purple-500 focus:border-purple-500 text-white text-lg"
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

            {/* Advantages and Disadvantages */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection(setIsPerksCollapsed)}
              >
                Vantagens e Desvantagens
                <span>{isPerksCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isPerksCollapsed && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Advantages */}
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
                                value={perk.value === 0 ? '' : perk.value}
                                onChange={(e) => handlePerkChange('advantages', index, 'value', e.target.value)}
                                className="w-10 ml-2 p-1 bg-gray-700 border border-gray-500 rounded-md text-white text-center"
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
                              placeholder="Descrição da vantagem"
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

                  {/* Disadvantages */}
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
                                value={perk.value === 0 ? '' : perk.value}
                                onChange={(e) => handlePerkChange('disadvantages', index, 'value', e.target.value)}
                                className="w-10 ml-2 p-1 bg-gray-700 border border-gray-500 rounded-md text-white text-center"
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
                              placeholder="Descrição da desvantagem"
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
              )}
            </section>

            {/* Class/Race and Custom Abilities */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection(setIsAbilitiesCollapsed)}
              >
                Habilidades (Classe, Raça, Customizadas)
                <span>{isAbilitiesCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isAbilitiesCollapsed && (
                <>
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
                            placeholder="Descrição da habilidade"
                            disabled={user.uid !== character.ownerUid && !isMaster}
                          ></textarea>
                        </li>
                      ))
                    )}
                  </ul>
                </>
              )}
            </section>

            {/* Specializations (Skills) */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection(setIsSpecializationsCollapsed)}
              >
                Especializações (Perícias)
                <span>{isSpecializationsCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isSpecializationsCollapsed && (
                <>
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
                                value={spec.modifier === 0 ? '' : spec.modifier}
                                onChange={(e) => handleSpecializationChange(index, 'modifier', e.target.value)}
                                className="w-8 p-1 bg-gray-700 border border-gray-500 rounded-md text-white"
                                disabled={user.uid !== character.ownerUid && !isMaster}
                              />
                            </label>
                            <label className="flex items-center gap-1">
                              Bônus:
                              <input
                                type="number"
                                value={spec.bonus === 0 ? '' : spec.bonus}
                                onChange={(e) => handleSpecializationChange(index, 'bonus', e.target.value)}
                                className="w-8 p-1 bg-gray-700 border border-gray-500 rounded-md text-white"
                                disabled={user.uid !== character.ownerUid && !isMaster}
                              />
                            </label>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </>
              )}
            </section>

            {/* Equipped Items */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection(setIsEquippedItemsCollapsed)}
              >
                Itens Equipados
                <span>{isEquippedItemsCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isEquippedItemsCollapsed && (
                <>
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
                </>
              )}
            </section>

            {/* Character History */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection(setIsHistoryCollapsed)}
              >
                História do Personagem
                <span>{isHistoryCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isHistoryCollapsed && (
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
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={(e) => handleDragOver(e)}
                          onDrop={(e) => handleDrop(e, index)}
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
                            <textarea
                              value={block.value}
                              onChange={(e) => updateHistoryBlock(block.id, 'value', e.target.value)}
                              rows="4"
                              className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white resize-y"
                              placeholder="Digite seu texto aqui..."
                              disabled={user.uid !== character.ownerUid && !isMaster}
                            ></textarea>
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
                            </div>
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

            {/* Notes */}
            <section className="mb-8 p-6 bg-gray-700 rounded-xl shadow-inner border border-gray-600">
              <h2 
                className="text-2xl font-bold text-yellow-300 mb-4 mt-6 border-b-2 border-yellow-500 pb-2 cursor-pointer flex justify-between items-center"
                onClick={() => toggleSection(setIsNotesCollapsed)}
              >
                Anotações
                <span>{isNotesCollapsed ? '▼' : '▲'}</span>
              </h2>
              {!isNotesCollapsed && (
                <textarea
                  name="notes"
                  value={character.notes}
                  onChange={handleNotesChange}
                  rows="6"
                  className="w-full p-3 bg-gray-600 border border-gray-500 rounded-md focus:ring-purple-500 focus:border-purple-500 text-white resize-y"
                  placeholder="Anotações diversas sobre o personagem, campanhas, NPCs, etc."
                  disabled={user.uid !== character.ownerUid && !isMaster}
                ></textarea>
              )}
            </section>

            {/* Action Buttons */}
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

        {/* Message if not logged in */}
        {!user && (
          <p className="text-center text-gray-400 text-lg mt-8">
            Faça login para começar a criar e gerenciar suas fichas de personagem!
          </p>
        )}
      </div>

      {/* Custom Modal */}
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

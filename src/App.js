import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, getDocs, getDoc, deleteDoc } from 'firebase/firestore'; // Added deleteDoc

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

  // Determines the confirmation button text based on the modal type
  const confirmButtonText = useMemo(() => {
    switch (type) {
      case 'confirm':
        return 'Confirmar';
      case 'prompt':
        return 'Confirmar'; // Changed to "Confirmar" for generic prompts
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

// Helper component for auto-resizing textarea
// It adjusts the textarea height based on its scrollHeight (content)
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


// Main application component
const App = () => {
  // Firebase configuration
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

  // Firebase states
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isMaster, setIsMaster] = useState(false);

  // Character management states
  const [character, setCharacter] = useState(null);
  const [charactersList, setCharactersList] = useState([]);
  
  // New states for selected character ID and owner UID
  const [selectedCharIdState, setSelectedCharIdState] = useState(null);
  const [ownerUidState, setOwnerUidState] = useState(null);

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

  // Zeni amount to add/remove state
  const [zeniAmount, setZeniAmount] = useState(0);

  // Ref for file input to trigger it programmatically
  const fileInputRef = useRef(null);

  // Section collapse states (for main sections)
  const [isUserStatusCollapsed, setIsUserStatusCollapsed] = useState(false);
  const [isCharacterInfoCollapsed, setIsCharacterInfoCollapsed] = useState(false);
  const [isMainAttributesCollapsed, setIsMainAttributesCollapsed] = useState(false);
  const [isBasicAttributesCollapsed, setIsBasicAttributesCollapsed] = useState(false);
  const [isMagicAttributesCollapsed, setIsMagicAttributesCollapsed] = useState(false); // New for Magic Attributes
  const [isWalletCollapsed, setIsWalletCollapsed] = useState(false);
  const [isInventoryCollapsed, setIsInventoryCollapsed] = useState(false); // New for Inventory
  const [isAdvantagesCollapsed, setIsAdvantagesCollapsed] = useState(false); // New for Advantages
  const [isDisadvantagesCollapsed, setIsDisadvantagesCollapsed] = useState(false); // New for Disadvantages
  const [isAbilitiesCollapsed, setIsAbilitiesCollapsed] = useState(false); // New for Abilities
  const [isSpecializationsCollapsed, setIsSpecializationsCollapsed] = useState(false); // New for Specializations
  const [isEquippedItemsCollapsed, setIsEquippedItemsCollapsed] = useState(false); // New for Equipped Items
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false);
  const [isNotesCollapsed, setIsNotesCollapsed] = useState(false);

  // State for "Back to Top" button visibility
  const [showBackToTopButton, setShowBackToTopButton] = useState(false);

  // Mapping of basic attributes to emojis
  const basicAttributeEmojis = {
    forca: '💪',
    destreza: '🏃‍♂️',
    inteligencia: '🧠',
    constituicao: '❤️‍🩹',
    sabedoria: '🧘‍♂️',
    carisma: '🎭',
    armadura: '🦴',
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
          // Clear selectedCharIdState and ownerUidState on logout
          setSelectedCharIdState(null);
          setOwnerUidState(null);
          window.history.pushState({}, '', window.location.pathname);
          setIsMaster(false);
        }
      });
      return () => unsubscribe();
    } catch (error) {
      console.error("Error initializing Firebase:", error);
      setModal({
        isVisible: true,
        message: `Error initializing the application. Check Firebase configuration. Details: ${error.message}`,
        type: 'info',
        onConfirm: () => {},
        onCancel: () => {},
      });
    }
  }, [firebaseConfig]);

  // Effect to initialize selectedCharIdState and ownerUidState from URL on first render
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialCharId = params.get('charId');
    const initialOwnerUid = params.get('ownerUid');
    setSelectedCharIdState(initialCharId);
    setOwnerUidState(initialOwnerUid);
  }, []); // Runs only once on initial load

  // Effect to load user role (master/player) from Firestore
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
        console.error("Error loading user role:", error);
        setIsMaster(false);
      });
    } else {
      setIsMaster(false);
    }
    return () => unsubscribeRole();
  }, [db, user, isAuthReady, appId]);

  // Function to fetch the list of characters
  const fetchCharactersList = useCallback(async () => {
    if (!db || !user || !isAuthReady) {
      console.log("fetchCharactersList: DB, user, or authentication not ready.");
      return;
    }

    setIsLoading(true);
    try {
      let allChars = [];
      if (isMaster) {
        console.log("fetchCharactersList: Master mode, fetching all characters (including soft-deleted).");
        const usersCollectionRef = collection(db, `artifacts/${appId}/users`);
        const usersSnapshot = await getDocs(usersCollectionRef);
        
        for (const userDoc of usersSnapshot.docs) {
          const userUid = userDoc.id;
          const userCharacterSheetsRef = collection(db, `artifacts/${appId}/users/${userUid}/characterSheets`);
          const charSnapshot = await getDocs(userCharacterSheetsRef);
          charSnapshot.docs.forEach(doc => {
            allChars.push({ id: doc.id, ownerUid: userUid, ...doc.data() });
          });
        }
        setCharactersList(allChars);
        console.log("fetchCharactersList: All characters loaded for master.", allChars);
      } else {
        console.log("fetchCharactersList: Player mode, fetching own characters (excluding soft-deleted).");
        const charactersCollectionRef = collection(db, `artifacts/${appId}/users/${user.uid}/characterSheets`);
        const q = query(charactersCollectionRef);
        const querySnapshot = await getDocs(q);
        const chars = querySnapshot.docs.map(doc => {
            if (!doc.data().deleted) { // Only show non-deleted for players
                return { id: doc.id, ownerUid: user.uid, ...doc.data() };
            }
            return null;
        }).filter(Boolean);
        setCharactersList(chars);
        console.log("fetchCharactersList: Player's characters loaded.", chars);
      }
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

  // Loads the list of characters when user, db or isAuthReady change
  useEffect(() => {
    if (user && db && isAuthReady) {
      console.log("useEffect (fetchCharactersList trigger): User, DB, Auth ready.");
      fetchCharactersList();
    }
  }, [user, db, isAuthReady, fetchCharactersList]);

  // Real-time listener for the selected character
  useEffect(() => {
    let unsubscribeCharacter = () => {};
    const currentSelectedCharacterId = selectedCharIdState; // Using the state
    const currentOwnerUidFromUrl = ownerUidState; // Using the state
    console.log('useEffect (character load) triggered. selectedCharacterId:', currentSelectedCharacterId, 'ownerUidFromUrl:', currentOwnerUidFromUrl, 'isMaster:', isMaster, 'user:', user?.uid);

    if (db && user && isAuthReady && currentSelectedCharacterId) {
      const loadCharacter = async () => {
        setIsLoading(true);
        let targetUid = currentOwnerUidFromUrl; // Prioritize ownerUid from state

        if (!targetUid) { // If ownerUid is not in state (e.g., direct access or old link)
          if (isMaster) {
            console.log('Master mode, ownerUid not in state. Searching for ownerUid for character:', currentSelectedCharacterId);
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
              console.error("Error searching for ownerUid for master:", error);
            }
            
            if (foundOwnerUid) {
              targetUid = foundOwnerUid;
              setOwnerUidState(foundOwnerUid); // Update ownerUid state
            } else {
              console.warn(`Character with ID ${currentSelectedCharacterId} not found in any user collection for master. It might have been deleted or is still syncing.`);
              setCharacter(null);
              setSelectedCharIdState(null); // Clear state
              setOwnerUidState(null); // Clear state
              window.history.pushState({}, '', window.location.pathname);
              fetchCharactersList();
              setIsLoading(false);
              return;
            }
          } else {
            // For players, if ownerUid is not in state, it should be their own UID
            targetUid = user.uid;
            setOwnerUidState(user.uid); // Update ownerUid state
            console.log('Player mode, ownerUid not in state. Using user.uid by default:', targetUid);
          }
        } else {
          console.log('OwnerUid found in state:', targetUid);
        }

        // If targetUid is still null/undefined after all checks, something is wrong.
        if (!targetUid) {
          console.error('Could not determine targetUid for character loading.');
          setIsLoading(false);
          setCharacter(null);
          setSelectedCharIdState(null); // Clear state
          setOwnerUidState(null); // Clear state
          window.history.pushState({}, '', window.location.pathname);
          return;
        }

        const characterDocRef = doc(db, `artifacts/${appId}/users/${targetUid}/characterSheets/${currentSelectedCharacterId}`);
        console.log('Setting up onSnapshot for characterDocRef:', characterDocRef.path);

        unsubscribeCharacter = onSnapshot(characterDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            // Players should not see soft-deleted sheets
            if (data.deleted && !isMaster) {
              console.log('Character found, but marked as deleted and user is not master.');
              setCharacter(null);
              setSelectedCharIdState(null); // Clear state
              setOwnerUidState(null); // Clear state
              window.history.pushState({}, '', window.location.pathname);
              fetchCharactersList();
              setModal({ isVisible: true, message: "The selected sheet has been deleted.", type: "info", onConfirm: () => {}, onCancel: () => {} });
              return;
            }
            const deserializedData = { ...data };
            try {
              deserializedData.mainAttributes = typeof deserializedData.mainAttributes === 'string' ? JSON.parse(deserializedData.mainAttributes) : deserializedData.mainAttributes;
              deserializedData.basicAttributes = typeof deserializedData.basicAttributes === 'string' ? JSON.parse(deserializedData.basicAttributes) : deserializedData.basicAttributes;
              deserializedData.magicAttributes = typeof deserializedData.magicAttributes === 'string' ? JSON.parse(deserializedData.magicAttributes) : deserializedData.magicAttributes;
              
              // Deserialization and addition of isCollapsed for all lists
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

            } catch (e) {
              console.error("Error deserializing data from Firestore:", e);
              setModal({
                isVisible: true,
                message: `Error loading sheet data: ${e.message}. Data may be corrupted.`,
                type: 'info',
                onConfirm: () => {},
                onCancel: () => {},
              });
            }

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
            deserializedData.photoUrl = deserializedData.photoUrl || ''; // Ensures photoUrl is empty string if not present

            setCharacter(deserializedData);
            console.log(`Character sheet for '${deserializedData.name}' loaded from Firestore in real-time.`);
          } else {
            console.log("No sheet found for the selected ID or it was deleted.");
            setCharacter(null);
            setSelectedCharIdState(null); // Clear state
            setOwnerUidState(null); // Clear state
            window.history.pushState({}, '', window.location.pathname);
            fetchCharactersList();
          }
          setIsLoading(false);
        }, (error) => {
          console.error("Error listening to sheet in Firestore:", error);
          setModal({
            isVisible: true,
            message: `Error loading sheet from Firestore: ${error.message}`,
            type: 'info',
            onConfirm: () => {},
            onCancel: () => {},
          });
          setIsLoading(false);
        });
      };
      loadCharacter();
    } else if (!currentSelectedCharacterId) {
      console.log('No character ID selected, clearing character state.');
      setCharacter(null);
    }
    return () => {
      console.log('Cleaning up character onSnapshot listener.');
      unsubscribeCharacter();
    };
  }, [db, user, isAuthReady, selectedCharIdState, ownerUidState, appId, isMaster, fetchCharactersList]); // Dependencies updated

  // Saves the sheet to Firestore
  useEffect(() => {
    if (db && user && isAuthReady && character && selectedCharIdState) { // Using the state
      const targetUidForSave = character.ownerUid || user.uid; 

      if (user.uid !== targetUidForSave && !isMaster) {
        console.warn("Attempting to save another user's sheet without write permission.");
        return;
      }

      const characterDocRef = doc(db, `artifacts/${appId}/users/${targetUidForSave}/characterSheets/${selectedCharIdState}`); // Using the state
      const saveCharacter = async () => {
        try {
          const dataToSave = { ...character };
          dataToSave.id = selectedCharIdState; // Using the state
          dataToSave.ownerUid = targetUidForSave;

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
          
          // Do NOT remove the 'deleted' flag here. It should persist if it was set.
          // if ('deleted' in dataToSave) {
          //   delete dataToSave.deleted;
          // }

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
  }, [character, db, user, isAuthReady, selectedCharIdState, appId, isMaster]); // Dependencies updated

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

  // Generic function to toggle the collapsed state of an item in a list
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

  // Generic function to toggle the collapsed state of a main section
  const toggleSectionCollapsed = (sectionStateSetter, currentState) => {
    sectionStateSetter(!currentState);
  };

  // Handles adding items to inventory (without pop-up)
  const handleAddItem = () => {
    setCharacter(prevChar => {
      const updatedInventory = [...(prevChar.inventory || []), { id: crypto.randomUUID(), name: '', description: '', isCollapsed: false }];
      return { ...prevChar, inventory: updatedInventory };
    });
  };

  // Handles editing items in inventory
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

  // Handles removing items from inventory
  const handleRemoveItem = (idToRemove) => {
    setCharacter(prevChar => {
      const updatedInventory = (prevChar.inventory || []).filter(item => item.id !== idToRemove);
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

  // Handles adding Advantage/Disadvantage (without pop-up for name/description)
  const handleAddPerk = (type) => {
    setCharacter(prevChar => {
      const updatedPerks = [...(prevChar[type] || []), { id: crypto.randomUUID(), name: '', description: '', origin: { class: false, race: false, manual: false }, value: 0, isCollapsed: false }];
      return { ...prevChar, [type]: updatedPerks };
    });
  };

  // Handles editing Advantage/Disadvantage
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

  // Handles removing Advantage/Disadvantage
  const handleRemovePerk = (type, idToRemove) => {
    setCharacter(prevChar => {
      const updatedPerks = (prevChar[type] || []).filter(perk => perk.id !== idToRemove);
      return { ...prevChar, [type]: updatedPerks };
    });
  };

  // Handles Advantage/Disadvantage origin change
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

  // Handles adding Ability (Class/Race/Custom) (without pop-up)
  const handleAddAbility = () => {
    setCharacter(prevChar => {
      const updatedAbilities = [...(prevChar.abilities || []), { id: crypto.randomUUID(), title: '', description: '', isCollapsed: false }];
      return { ...prevChar, abilities: updatedAbilities };
    });
  };

  // Handles editing Ability
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

  // Handles removing Ability
  const handleRemoveAbility = (idToRemove) => {
    setCharacter(prevChar => {
      const updatedAbilities = (prevChar.abilities || []).filter(ability => ability.id !== idToRemove);
      return { ...prevChar, abilities: updatedAbilities };
    });
  };

  // Handles adding Specialization (without pop-up)
  const handleAddSpecialization = () => {
    setCharacter(prevChar => {
      const updatedSpecializations = [...(prevChar.specializations || []), { id: crypto.randomUUID(), title: '', description: '', isCollapsed: false }];
      return { ...prevChar, specializations: updatedSpecializations };
    });
  };

  // Handles editing Specialization
  const handleSpecializationChange = (id, field, value) => {
    setCharacter(prevChar => {
      const updatedSpecializations = [...(prevChar.specializations || [])];
      const specializationIndex = updatedSpecializations.findIndex(spec => spec.id === id);
      if (specializationIndex !== -1) {
        updatedSpecializations[specializationIndex][field] = value;
      }
      return { ...prevChar, specializations: updatedSpecializations };
    });
  };

  // Handles removing Specialization
  const handleRemoveSpecialization = (idToRemove) => {
    setCharacter(prevChar => {
      const updatedSpecializations = (prevChar.specializations || []).filter(spec => spec.id !== idToRemove);
      return { ...prevChar, specializations: updatedSpecializations };
    });
  };

  // Handles adding Equipped Item (without pop-up)
  const handleAddEquippedItem = () => {
    setCharacter(prevChar => {
      const updatedEquippedItems = [...(prevChar.equippedItems || []), { id: crypto.randomUUID(), name: '', description: '', isCollapsed: false }];
      return { ...prevChar, equippedItems: updatedEquippedItems };
    });
  };

  // Handles editing Equipped Item
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

  // Handles removing Equipped Item
  const handleRemoveEquippedItem = (idToRemove) => {
    setCharacter(prevChar => {
      const updatedEquippedItems = (prevChar.equippedItems || []).filter(item => item.id !== idToRemove);
      return { ...prevChar, equippedItems: updatedEquippedItems };
    });
  };

  // Handles adding a new history block
  const handleAddHistoryBlock = (type) => {
    setCharacter(prevChar => {
      const updatedHistory = [...(prevChar.history || [])];
      updatedHistory.push({ id: crypto.randomUUID(), type: type, value: '', isCollapsed: false });
      return { ...prevChar, history: updatedHistory };
    });
  };

  // Handles editing a history block
  const handleHistoryBlockChange = (id, value) => {
    setCharacter(prevChar => {
      const updatedHistory = [...(prevChar.history || [])];
      const blockIndex = updatedHistory.findIndex(block => block.id === id);
      if (blockIndex !== -1) {
        updatedHistory[blockIndex].value = value;
      }
      return { ...prevChar, history: updatedHistory };
    });
  };

  // Handles removing a history block
  const handleRemoveHistoryBlock = (idToRemove) => {
    setCharacter(prevChar => {
      const updatedHistory = (prevChar.history || []).filter(block => block.id !== idToRemove);
      return { ...prevChar, history: updatedHistory };
    });
  };

  // Handles photo upload
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCharacter(prevChar => ({
          ...prevChar,
          photoUrl: reader.result,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Triggers the hidden file input
  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  // Authentication functions
  const handleGoogleSignIn = async () => {
    if (!auth) return;
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error during Google sign-in:", error);
      setModal({
        isVisible: true,
        message: `Error during Google sign-in: ${error.message}`,
        type: 'info',
        onConfirm: () => {},
        onCancel: () => {},
      });
    }
  };

  const handleSignOut = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      setCharacter(null);
      setSelectedCharIdState(null);
      setOwnerUidState(null);
      window.history.pushState({}, '', window.location.pathname);
      setIsMaster(false);
    } catch (error) {
      console.error("Error during sign-out:", error);
      setModal({
        isVisible: true,
        message: `Error during sign-out: ${error.message}`,
        type: 'info',
        onConfirm: () => {},
        onCancel: () => {},
      });
    }
  };

  // Character creation/selection functions
  const handleCreateCharacter = async () => {
    if (!db || !user) return;

    setModal({
      isVisible: true,
      message: "Digite o nome do novo personagem:",
      type: "prompt",
      onConfirm: async (name) => {
        if (!name.trim()) {
          setModal({ isVisible: true, message: "O nome do personagem não pode ser vazio.", type: "info", onConfirm: () => {}, onCancel: () => {} });
          return;
        }
        setIsLoading(true);
        try {
          const newCharId = crypto.randomUUID();
          const newCharacterData = {
            id: newCharId,
            ownerUid: user.uid,
            name: name,
            race: '',
            age: 0,
            level: 1,
            xp: 0,
            photoUrl: '',
            mainAttributes: { hp: { current: 10, max: 10 }, mp: { current: 5, max: 5 }, initiative: 0, fa: 0, fm: 0, fd: 0 },
            basicAttributes: {
              forca: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
              destreza: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
              inteligencia: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
              constituicao: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
              sabedoria: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
              carisma: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
              armadura: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
              poderDeFogo: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
            },
            magicAttributes: {
              fogo: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
              agua: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
              ar: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
              terra: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
              luz: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
              trevas: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
              espirito: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
              outro: { base: 0, permBonus: 0, condBonus: 0, total: 0 },
            },
            inventory: [],
            wallet: { zeni: 0 },
            advantages: [],
            disadvantages: [],
            abilities: [],
            specializations: [],
            equippedItems: [],
            history: [],
            notes: '',
          };

          // Serialize complex objects before saving
          const serializedData = { ...newCharacterData };
          serializedData.mainAttributes = JSON.stringify(serializedData.mainAttributes);
          serializedData.basicAttributes = JSON.stringify(serializedData.basicAttributes);
          serializedData.magicAttributes = JSON.stringify(serializedData.magicAttributes);
          serializedData.inventory = JSON.stringify(serializedData.inventory);
          serializedData.wallet = JSON.stringify(serializedData.wallet);
          serializedData.advantages = JSON.stringify(serializedData.advantages);
          serializedData.disadvantages = JSON.stringify(serializedData.disadvantages);
          serializedData.abilities = JSON.stringify(serializedData.abilities);
          serializedData.specializations = JSON.stringify(serializedData.specializations);
          serializedData.equippedItems = JSON.stringify(serializedData.equippedItems);
          serializedData.history = JSON.stringify(serializedData.history);

          await setDoc(doc(db, `artifacts/${appId}/users/${user.uid}/characterSheets/${newCharId}`), serializedData);
          setSelectedCharIdState(newCharId);
          setOwnerUidState(user.uid);
          window.history.pushState({}, '', `?charId=${newCharId}&ownerUid=${user.uid}`);
          await fetchCharactersList(); // Refresh the list
          setModal({ isVisible: true, message: "Personagem criado com sucesso!", type: "info", onConfirm: () => {}, onCancel: () => {} });
        } catch (error) {
          console.error("Error creating character:", error);
          setModal({
            isVisible: true,
            message: `Erro ao criar personagem: ${error.message}`,
            type: 'info',
            onConfirm: () => {},
            onCancel: () => {},
          });
        } finally {
          setIsLoading(false);
        }
      },
      onCancel: () => {},
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
    fetchCharactersList(); // Refresh list to ensure it's up-to-date
  };

  // Soft delete function (marks as deleted)
  const handleSoftDeleteCharacter = (charId, ownerUid) => {
    setModal({
      isVisible: true,
      message: "Tem certeza que deseja marcar esta ficha como deletada? Ela não aparecerá mais na sua lista, mas poderá ser vista por mestres e restaurada.",
      type: "confirm",
      onConfirm: async () => {
        if (!db || !user) return;
        setIsLoading(true);
        try {
          const charRef = doc(db, `artifacts/${appId}/users/${ownerUid}/characterSheets/${charId}`);
          await setDoc(charRef, { deleted: true }, { merge: true });
          setModal({ isVisible: true, message: "Ficha de personagem marcada como deletada.", type: "info", onConfirm: () => {}, onCancel: () => {} });
          handleBackToList(); // Go back to list after deletion
        } catch (error) {
          console.error("Error soft deleting character:", error);
          setModal({
            isVisible: true,
            message: `Erro ao marcar personagem como deletado: ${error.message}`,
            type: 'info',
            onConfirm: () => {},
            onCancel: () => {},
          });
        } finally {
          setIsLoading(false);
        }
      },
      onCancel: () => {},
    });
  };

  // Permanent delete function (only for masters)
  const handlePermanentDeleteCharacter = (charId, ownerUid) => {
    setModal({
      isVisible: true,
      message: "ATENÇÃO: Você tem certeza que deseja EXCLUIR PERMANENTEMENTE esta ficha? Esta ação é IRREVERSÍVEL e a ficha não poderá ser recuperada.",
      type: "confirm",
      onConfirm: async () => {
        if (!db || !user || !isMaster) return; // Only masters can perform this
        setIsLoading(true);
        try {
          const charRef = doc(db, `artifacts/${appId}/users/${ownerUid}/characterSheets/${charId}`);
          await deleteDoc(charRef);
          setModal({ isVisible: true, message: "Ficha de personagem excluída permanentemente.", type: "info", onConfirm: () => {}, onCancel: () => {} });
          handleBackToList(); // Go back to list after deletion
        } catch (error) {
          console.error("Error permanently deleting character:", error);
          setModal({
            isVisible: true,
            message: `Erro ao excluir personagem permanentemente: ${error.message}`,
            type: 'info',
            onConfirm: () => {},
            onCancel: () => {},
          });
        } finally {
          setIsLoading(false);
        }
      },
      onCancel: () => {},
    });
  };

  // Function to restore a soft-deleted character (only for masters)
  const handleRestoreCharacter = async (charId, ownerUid) => {
    setModal({
      isVisible: true,
      message: "Tem certeza que deseja restaurar esta ficha de personagem?",
      type: "confirm",
      onConfirm: async () => {
        if (!db || !user || !isMaster) return;
        setIsLoading(true);
        try {
          const charRef = doc(db, `artifacts/${appId}/users/${ownerUid}/characterSheets/${charId}`);
          await setDoc(charRef, { deleted: false }, { merge: true });
          setModal({ isVisible: true, message: "Ficha de personagem restaurada com sucesso!", type: "info", onConfirm: () => {}, onCancel: () => {} });
          fetchCharactersList(); // Refresh the list
        } catch (error) {
          console.error("Error restoring character:", error);
          setModal({
            isVisible: true,
            message: `Erro ao restaurar personagem: ${error.message}`,
            type: 'info',
            onConfirm: () => {},
            onCancel: () => {},
          });
        } finally {
          setIsLoading(false);
        }
      },
      onCancel: () => {},
    });
  };

  const handleSetMasterRole = async () => {
    if (!db || !user) return;
    setModal({
      isVisible: true,
      message: "Você deseja se tornar um Mestre? Isso lhe dará acesso a todas as fichas de personagens. Esta ação pode ser desfeita.",
      type: "confirm",
      onConfirm: async () => {
        try {
          await setDoc(doc(db, `artifacts/${appId}/users/${user.uid}`), { isMaster: true }, { merge: true });
          setIsMaster(true);
          setModal({ isVisible: true, message: "Você é agora um Mestre!", type: "info", onConfirm: () => {}, onCancel: () => {} });
          fetchCharactersList(); // Re-fetch characters as master
        } catch (error) {
          console.error("Error setting master role:", error);
          setModal({
            isVisible: true,
            message: `Erro ao definir papel de Mestre: ${error.message}`,
            type: 'info',
            onConfirm: () => {},
            onCancel: () => {},
          });
        }
      },
      onCancel: () => {},
    });
  };

  const handleUnsetMasterRole = async () => {
    if (!db || !user) return;
    setModal({
      isVisible: true,
      message: "Você deseja deixar de ser um Mestre? Você só verá suas próprias fichas de personagem.",
      type: "confirm",
      onConfirm: async () => {
        try {
          await setDoc(doc(db, `artifacts/${appId}/users/${user.uid}`), { isMaster: false }, { merge: true });
          setIsMaster(false);
          setModal({ isVisible: true, message: "Você não é mais um Mestre.", type: "info", onConfirm: () => {}, onCancel: () => {} });
          fetchCharactersList(); // Re-fetch characters as player
        } catch (error) {
          console.error("Error unsetting master role:", error);
          setModal({
            isVisible: true,
            message: `Erro ao remover papel de Mestre: ${error.message}`,
            type: 'info',
            onConfirm: () => {},
            onCancel: () => {},
          });
        }
      },
      onCancel: () => {},
    });
  };

  // Scroll to top functionality
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // Effect to show/hide "Back to Top" button based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) { // Show button after scrolling down 300px
        setShowBackToTopButton(true);
      } else {
        setShowBackToTopButton(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);


  // Conditional rendering based on authentication and character selection
  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-gray-100">
        <div className="text-xl">Carregando autenticação...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-gray-100 p-4">
        <h1 className="text-4xl font-bold mb-8 text-purple-400">Bem-vindo ao StoryCraft</h1>
        <p className="text-lg mb-6 text-center">Faça login para gerenciar suas fichas de personagem.</p>
        <button
          onClick={handleGoogleSignIn}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg flex items-center space-x-2 transition duration-300 ease-in-out transform hover:scale-105"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.24 10.27c-.07-.57-.11-1.15-.11-1.73 0-1.85.64-3.44 1.73-4.53L12 2.05C9.55 4.03 8 7.03 8 10.27c0 3.24 1.55 6.24 4 8.22l1.97-1.97C12.88 15.71 12.24 14.12 12.24 12.27c0-.57.04-1.15.11-1.73z" fill="#EA4335"/><path d="M22 12.00c0-.85-.07-1.68-.2-2.49H12v4.61h6.63c-.3 1.52-1.18 2.82-2.46 3.73l1.97 1.97c1.4-1.29 2.5-3.08 2.96-5.08z" fill="#4285F4"/><path d="M12 20c3.24 0 5.95-2.13 6.94-5.08l-1.97-1.97c-.92 1.28-2.22 2.16-3.73 2.46V20z" fill="#34A853"/><path d="M4 12c0 1.68.45 3.25 1.25 4.61L7.22 18.58C5.24 16.13 4 13.24 4 10.27h3.96c.07.57.11 1.15.11 1.73z" fill="#FBBC05"/>
          </svg>
          <span>Entrar com Google</span>
        </button>
        {modal.isVisible && <CustomModal {...modal} onClose={() => setModal({ ...modal, isVisible: false })} />}
      </div>
    );
  }

  // Display character list if no character is selected
  if (!selectedCharIdState || !character) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 p-4 sm:p-6 lg:p-8 font-inter">
        <div className="max-w-4xl mx-auto bg-gray-800 rounded-lg shadow-lg p-6 sm:p-8 border border-gray-700">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 border-b border-gray-700 pb-4">
            <h1 className="text-3xl font-bold text-purple-400 mb-4 sm:mb-0">Minhas Fichas de Personagem</h1>
            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
              <button
                onClick={handleCreateCharacter}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75 w-full sm:w-auto"
              >
                Criar Nova Ficha
              </button>
              <button
                onClick={handleSignOut}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75 w-full sm:w-auto"
              >
                Sair ({user.displayName || user.email})
              </button>
            </div>
          </div>

          <div className="mb-6 text-center text-gray-300">
            <p className="text-lg">
              Bem-vindo, <span className="font-semibold text-purple-300">{user.displayName || user.email}</span>!
            </p>
            <p className="text-sm mt-1">Seu ID de Usuário: <span className="font-mono text-gray-400 break-all">{user.uid}</span></p>
            {isMaster ? (
              <button onClick={handleUnsetMasterRole} className="mt-3 text-sm text-blue-400 hover:text-blue-300 transition duration-200 ease-in-out">
                Você é um Mestre (Clique para deixar de ser)
              </button>
            ) : (
              <button onClick={handleSetMasterRole} className="mt-3 text-sm text-blue-400 hover:text-blue-300 transition duration-200 ease-in-out">
                Tornar-se Mestre
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="text-center text-xl text-purple-300">Carregando fichas...</div>
          ) : charactersList.length === 0 ? (
            <p className="text-center text-gray-400 text-lg">Nenhuma ficha de personagem encontrada. Crie uma nova para começar!</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {charactersList.map((char) => (
                <div
                  key={char.id}
                  className={`bg-gray-700 rounded-lg p-5 shadow-md border border-gray-600 flex flex-col justify-between transition duration-200 ease-in-out transform hover:scale-[1.02] ${char.deleted ? 'opacity-50 border-red-500' : ''}`}
                >
                  <div>
                    <h3 className="text-xl font-semibold text-purple-300 mb-2">{char.name} {char.deleted && <span className="text-red-400 text-sm">(Deletada)</span>}</h3>
                    <p className="text-gray-300 text-sm mb-1">Raça: {char.race || 'N/A'}</p>
                    <p className="text-gray-300 text-sm mb-1">Nível: {char.level}</p>
                    <p className="text-gray-400 text-xs break-all">ID da Ficha: {char.id}</p>
                    {isMaster && char.ownerUid && char.ownerUid !== user.uid && (
                      <p className="text-gray-400 text-xs break-all mt-1">Proprietário: {char.ownerUid}</p>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 mt-4">
                    <button
                      onClick={() => handleSelectCharacter(char.id, char.ownerUid)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 w-full sm:w-auto"
                    >
                      Abrir Ficha
                    </button>
                    {char.deleted ? (
                      isMaster && ( // Only master can restore
                        <button
                          onClick={() => handleRestoreCharacter(char.id, char.ownerUid)}
                          className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-opacity-75 w-full sm:w-auto"
                        >
                          Restaurar
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => handleSoftDeleteCharacter(char.id, char.ownerUid)}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75 w-full sm:w-auto"
                      >
                        Deletar (Soft)
                      </button>
                    )}
                    {isMaster && (
                      <button
                        onClick={() => handlePermanentDeleteCharacter(char.id, char.ownerUid)}
                        className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-75 w-full sm:w-auto"
                      >
                        Deletar (Perm.)
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {modal.isVisible && <CustomModal {...modal} onClose={() => setModal({ ...modal, isVisible: false })} />}
      </div>
    );
  }

  // Main character sheet view
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 sm:p-6 lg:p-8 font-inter relative">
      <div className="max-w-5xl mx-auto bg-gray-800 rounded-lg shadow-lg p-6 sm:p-8 border border-gray-700">
        {/* Header and Navigation */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 border-b border-gray-700 pb-4">
          <h1 className="text-3xl font-bold text-purple-400 mb-4 sm:mb-0">{character.name || 'Novo Personagem'}</h1>
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
            <button
              onClick={handleBackToList}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 w-full sm:w-auto"
            >
              Voltar para a Lista
            </button>
            {/* Soft delete button for players and masters */}
            {(user.uid === character.ownerUid || isMaster) && !character.deleted && (
              <button
                onClick={() => handleSoftDeleteCharacter(character.id, character.ownerUid)}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75 w-full sm:w-auto"
              >
                Deletar Ficha (Soft)
              </button>
            )}
            {/* Restore button for masters if soft-deleted */}
            {isMaster && character.deleted && (
              <button
                onClick={() => handleRestoreCharacter(character.id, character.ownerUid)}
                className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-opacity-75 w-full sm:w-auto"
              >
                Restaurar Ficha
              </button>
            )}
            {/* Permanent delete button only for masters */}
            {isMaster && (
              <button
                onClick={() => handlePermanentDeleteCharacter(character.id, character.ownerUid)}
                className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-75 w-full sm:w-auto"
              >
                Deletar Ficha (Perm.)
              </button>
            )}
          </div>
        </div>

        {/* User Status Section */}
        <div className="mb-8 p-4 bg-gray-700 rounded-lg shadow-md border border-gray-600">
          <button
            onClick={() => toggleSectionCollapsed(setIsUserStatusCollapsed, isUserStatusCollapsed)}
            className="w-full text-left text-xl font-semibold text-purple-300 flex justify-between items-center pb-2 border-b border-gray-600 mb-4"
          >
            Status do Usuário
            <span className="text-gray-400">{isUserStatusCollapsed ? '▼' : '▲'}</span>
          </button>
          {!isUserStatusCollapsed && (
            <div className="text-center text-gray-300">
              <p className="text-lg">
                Logado como: <span className="font-semibold text-purple-300">{user.displayName || user.email}</span>
              </p>
              <p className="text-sm mt-1">Seu ID de Usuário: <span className="font-mono text-gray-400 break-all">{user.uid}</span></p>
              {isMaster ? (
                <p className="text-sm mt-1 text-blue-400">Você é um Mestre.</p>
              ) : (
                <p className="text-sm mt-1 text-gray-400">Você é um Jogador.</p>
              )}
              {character.ownerUid && character.ownerUid !== user.uid && (
                <p className="text-sm mt-1 text-yellow-400">Esta ficha pertence a: <span className="font-mono break-all">{character.ownerUid}</span></p>
              )}
            </div>
          )}
        </div>

        {/* Character Info Section */}
        <div className="mb-8 p-4 bg-gray-700 rounded-lg shadow-md border border-gray-600">
          <button
            onClick={() => toggleSectionCollapsed(setIsCharacterInfoCollapsed, isCharacterInfoCollapsed)}
            className="w-full text-left text-xl font-semibold text-purple-300 flex justify-between items-center pb-2 border-b border-gray-600 mb-4"
          >
            Informações do Personagem
            <span className="text-gray-400">{isCharacterInfoCollapsed ? '▼' : '▲'}</span>
          </button>
          {!isCharacterInfoCollapsed && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div className="md:col-span-1 flex flex-col items-center">
                <div className="w-32 h-32 bg-gray-600 rounded-full overflow-hidden flex items-center justify-center border-2 border-purple-400 mb-3">
                  {character.photoUrl ? (
                    <img src={character.photoUrl} alt="Personagem" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-5xl text-gray-400">👤</span>
                  )}
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  className="hidden"
                  accept="image/*"
                  disabled={user.uid !== character.ownerUid && !isMaster}
                />
                <button
                  onClick={triggerFileInput}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-sm py-2 px-4 rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75"
                  disabled={user.uid !== character.ownerUid && !isMaster}
                >
                  {character.photoUrl ? 'Mudar Foto' : 'Adicionar Foto'}
                </button>
              </div>

              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-300">Nome</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={character.name}
                    onChange={handleChange}
                    className="mt-1 block w-full p-2 bg-gray-600 border border-gray-500 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                    disabled={user.uid !== character.ownerUid && !isMaster}
                  />
                </div>
                <div>
                  <label htmlFor="race" className="block text-sm font-medium text-gray-300">Raça</label>
                  <input
                    type="text"
                    id="race"
                    name="race"
                    value={character.race}
                    onChange={handleChange}
                    className="mt-1 block w-full p-2 bg-gray-600 border border-gray-500 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                    disabled={user.uid !== character.ownerUid && !isMaster}
                  />
                </div>
                <div>
                  <label htmlFor="age" className="block text-sm font-medium text-gray-300">Idade</label>
                  <input
                    type="number"
                    id="age"
                    name="age"
                    value={character.age}
                    onChange={handleChange}
                    className="mt-1 block w-full p-2 bg-gray-600 border border-gray-500 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                    disabled={user.uid !== character.ownerUid && !isMaster}
                  />
                </div>
                <div>
                  <label htmlFor="level" className="block text-sm font-medium text-gray-300">Nível</label>
                  <input
                    type="number"
                    id="level"
                    name="level"
                    value={character.level}
                    onChange={handleChange}
                    className="mt-1 block w-full p-2 bg-gray-600 border border-gray-500 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                    disabled={user.uid !== character.ownerUid && !isMaster}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="xp" className="block text-sm font-medium text-gray-300">Experiência (XP)</label>
                  <input
                    type="number"
                    id="xp"
                    name="xp"
                    value={character.xp}
                    onChange={handleChange}
                    className="mt-1 block w-full p-2 bg-gray-600 border border-gray-500 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                    disabled={user.uid !== character.ownerUid && !isMaster}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main Attributes Section */}
        <div className="mb-8 p-4 bg-gray-700 rounded-lg shadow-md border border-gray-600">
          <button
            onClick={() => toggleSectionCollapsed(setIsMainAttributesCollapsed, isMainAttributesCollapsed)}
            className="w-full text-left text-xl font-semibold text-purple-300 flex justify-between items-center pb-2 border-b border-gray-600 mb-4"
          >
            Atributos Principais
            <span className="text-gray-400">{isMainAttributesCollapsed ? '▼' : '▲'}</span>
          </button>
          {!isMainAttributesCollapsed && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* HP */}
              <div className="bg-gray-600 p-4 rounded-md shadow-inner border border-gray-500">
                <label className="block text-sm font-medium text-gray-300 mb-2">HP (Vida)</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    name="current"
                    data-attribute="hp"
                    value={character.mainAttributes.hp.current}
                    onChange={handleMainAttributeChange}
                    className="w-1/2 p-2 bg-gray-700 border border-gray-500 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                    disabled={user.uid !== character.ownerUid && !isMaster}
                  />
                  <span className="text-gray-300">/</span>
                  <input
                    type="number"
                    name="max"
                    data-attribute="hp"
                    value={character.mainAttributes.hp.max}
                    onChange={handleMainAttributeChange}
                    className="w-1/2 p-2 bg-gray-700 border border-gray-500 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                    disabled={user.uid !== character.ownerUid && !isMaster}
                  />
                </div>
              </div>

              {/* MP */}
              <div className="bg-gray-600 p-4 rounded-md shadow-inner border border-gray-500">
                <label className="block text-sm font-medium text-gray-300 mb-2">MP (Magia)</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    name="current"
                    data-attribute="mp"
                    value={character.mainAttributes.mp.current}
                    onChange={handleMainAttributeChange}
                    className="w-1/2 p-2 bg-gray-700 border border-gray-500 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                    disabled={user.uid !== character.ownerUid && !isMaster}
                  />
                  <span className="text-gray-300">/</span>
                  <input
                    type="number"
                    name="max"
                    data-attribute="mp"
                    value={character.mainAttributes.mp.max}
                    onChange={handleMainAttributeChange}
                    className="w-1/2 p-2 bg-gray-700 border border-gray-500 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                    disabled={user.uid !== character.ownerUid && !isMaster}
                  />
                </div>
              </div>

              {/* Initiative */}
              <div className="bg-gray-600 p-4 rounded-md shadow-inner border border-gray-500">
                <label htmlFor="initiative" className="block text-sm font-medium text-gray-300 mb-2">Iniciativa</label>
                <input
                  type="number"
                  id="initiative"
                  name="initiative"
                  value={character.mainAttributes.initiative}
                  onChange={handleSingleMainAttributeChange}
                  className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                  disabled={user.uid !== character.ownerUid && !isMaster}
                />
              </div>

              {/* FA */}
              <div className="bg-gray-600 p-4 rounded-md shadow-inner border border-gray-500">
                <label htmlFor="fa" className="block text-sm font-medium text-gray-300 mb-2">FA (Força de Ataque)</label>
                <input
                  type="number"
                  id="fa"
                  name="fa"
                  value={character.mainAttributes.fa}
                  onChange={handleSingleMainAttributeChange}
                  className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                  disabled={user.uid !== character.ownerUid && !isMaster}
                />
              </div>

              {/* FM */}
              <div className="bg-gray-600 p-4 rounded-md shadow-inner border border-gray-500">
                <label htmlFor="fm" className="block text-sm font-medium text-gray-300 mb-2">FM (Força Mágica)</label>
                <input
                  type="number"
                  id="fm"
                  name="fm"
                  value={character.mainAttributes.fm}
                  onChange={handleSingleMainAttributeChange}
                  className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                  disabled={user.uid !== character.ownerUid && !isMaster}
                />
              </div>

              {/* FD */}
              <div className="bg-gray-600 p-4 rounded-md shadow-inner border border-gray-500">
                <label htmlFor="fd" className="block text-sm font-medium text-gray-300 mb-2">FD (Força de Defesa)</label>
                <input
                  type="number"
                  id="fd"
                  name="fd"
                  value={character.mainAttributes.fd}
                  onChange={handleSingleMainAttributeChange}
                  className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                  disabled={user.uid !== character.ownerUid && !isMaster}
                />
              </div>
            </div>
          )}
        </div>

        {/* Basic Attributes Section */}
        <div className="mb-8 p-4 bg-gray-700 rounded-lg shadow-md border border-gray-600">
          <button
            onClick={() => toggleSectionCollapsed(setIsBasicAttributesCollapsed, isBasicAttributesCollapsed)}
            className="w-full text-left text-xl font-semibold text-purple-300 flex justify-between items-center pb-2 border-b border-gray-600 mb-4"
          >
            Atributos Básicos
            <span className="text-gray-400">{isBasicAttributesCollapsed ? '▼' : '▲'}</span>
          </button>
          {!isBasicAttributesCollapsed && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {Object.keys(character.basicAttributes).map(attrKey => (
                <div key={attrKey} className="bg-gray-600 p-4 rounded-md shadow-inner border border-gray-500">
                  <h3 className="text-lg font-medium text-gray-200 mb-2 capitalize flex items-center">
                    {basicAttributeEmojis[attrKey]} {attrKey.replace(/([A-Z])/g, ' $1').trim()}
                  </h3>
                  <div className="grid grid-cols-3 gap-2 text-sm text-gray-400 mb-2">
                    <span>Base</span>
                    <span>Perm.</span>
                    <span>Cond.</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      value={character.basicAttributes[attrKey].base}
                      onChange={(e) => handleBasicAttributeChange('basicAttributes', attrKey, 'base', e.target.value)}
                      className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                      disabled={user.uid !== character.ownerUid && !isMaster}
                    />
                    <input
                      type="number"
                      value={character.basicAttributes[attrKey].permBonus}
                      onChange={(e) => handleBasicAttributeChange('basicAttributes', attrKey, 'permBonus', e.target.value)}
                      className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                      disabled={user.uid !== character.ownerUid && !isMaster}
                    />
                    <input
                      type="number"
                      value={character.basicAttributes[attrKey].condBonus}
                      onChange={(e) => handleBasicAttributeChange('basicAttributes', attrKey, 'condBonus', e.target.value)}
                      className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                      disabled={user.uid !== character.ownerUid && !isMaster}
                    />
                  </div>
                  <div className="mt-3 text-right text-lg font-bold text-purple-300">
                    Total: {character.basicAttributes[attrKey].total}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Magic Attributes Section */}
        <div className="mb-8 p-4 bg-gray-700 rounded-lg shadow-md border border-gray-600">
          <button
            onClick={() => toggleSectionCollapsed(setIsMagicAttributesCollapsed, isMagicAttributesCollapsed)}
            className="w-full text-left text-xl font-semibold text-purple-300 flex justify-between items-center pb-2 border-b border-gray-600 mb-4"
          >
            Atributos Mágicos
            <span className="text-gray-400">{isMagicAttributesCollapsed ? '▼' : '▲'}</span>
          </button>
          {!isMagicAttributesCollapsed && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {Object.keys(character.magicAttributes).map(attrKey => (
                <div key={attrKey} className="bg-gray-600 p-4 rounded-md shadow-inner border border-gray-500">
                  <h3 className="text-lg font-medium text-gray-200 mb-2 capitalize flex items-center">
                    {magicAttributeEmojis[attrKey]} {attrKey.replace(/([A-Z])/g, ' $1').trim()}
                  </h3>
                  <div className="grid grid-cols-3 gap-2 text-sm text-gray-400 mb-2">
                    <span>Base</span>
                    <span>Perm.</span>
                    <span>Cond.</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      value={character.magicAttributes[attrKey].base}
                      onChange={(e) => handleBasicAttributeChange('magicAttributes', attrKey, 'base', e.target.value)}
                      className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                      disabled={user.uid !== character.ownerUid && !isMaster}
                    />
                    <input
                      type="number"
                      value={character.magicAttributes[attrKey].permBonus}
                      onChange={(e) => handleBasicAttributeChange('magicAttributes', attrKey, 'permBonus', e.target.value)}
                      className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                      disabled={user.uid !== character.ownerUid && !isMaster}
                    />
                    <input
                      type="number"
                      value={character.magicAttributes[attrKey].condBonus}
                      onChange={(e) => handleBasicAttributeChange('magicAttributes', attrKey, 'condBonus', e.target.value)}
                      className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                      disabled={user.uid !== character.ownerUid && !isMaster}
                    />
                  </div>
                  <div className="mt-3 text-right text-lg font-bold text-purple-300">
                    Total: {character.magicAttributes[attrKey].total}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Wallet Section */}
        <div className="mb-8 p-4 bg-gray-700 rounded-lg shadow-md border border-gray-600">
          <button
            onClick={() => toggleSectionCollapsed(setIsWalletCollapsed, isWalletCollapsed)}
            className="w-full text-left text-xl font-semibold text-purple-300 flex justify-between items-center pb-2 border-b border-gray-600 mb-4"
          >
            Carteira
            <span className="text-gray-400">{isWalletCollapsed ? '▼' : '▲'}</span>
          </button>
          {!isWalletCollapsed && (
            <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4">
              <div className="flex-1 text-center sm:text-left">
                <p className="text-2xl font-bold text-green-400">Zeni: {character.wallet.zeni}</p>
              </div>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
                <input
                  type="number"
                  value={zeniAmount}
                  onChange={handleZeniChange}
                  placeholder="Quantidade"
                  className="p-2 bg-gray-600 border border-gray-500 rounded-md text-white w-full sm:w-32 focus:ring-purple-500 focus:border-purple-500"
                  disabled={user.uid !== character.ownerUid && !isMaster}
                />
                <button
                  onClick={handleAddZeni}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75 w-full sm:w-auto"
                  disabled={user.uid !== character.ownerUid && !isMaster}
                >
                  Adicionar
                </button>
                <button
                  onClick={handleRemoveZeni}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75 w-full sm:w-auto"
                  disabled={user.uid !== character.ownerUid && !isMaster}
                >
                  Remover
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Inventory Section */}
        <div className="mb-8 p-4 bg-gray-700 rounded-lg shadow-md border border-gray-600">
          <button
            onClick={() => toggleSectionCollapsed(setIsInventoryCollapsed, isInventoryCollapsed)}
            className="w-full text-left text-xl font-semibold text-purple-300 flex justify-between items-center pb-2 border-b border-gray-600 mb-4"
          >
            Inventário
            <span className="text-gray-400">{isInventoryCollapsed ? '▼' : '▲'}</span>
          </button>
          {!isInventoryCollapsed && (
            <>
              <div className="flex justify-center mb-4">
                <button
                  onClick={handleAddItem}
                  className="w-8 h-8 bg-green-600 hover:bg-green-700 text-white font-bold rounded-full flex items-center justify-center shadow-md transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                  disabled={user.uid !== character.ownerUid && !isMaster}
                  title="Adicionar Item"
                >
                  +
                </button>
              </div>
              {character.inventory.length === 0 ? (
                <p className="text-center text-gray-400">Nenhum item no inventário.</p>
              ) : (
                <div className="space-y-4">
                  {character.inventory.map(item => (
                    <div key={item.id} className="bg-gray-600 p-4 rounded-md shadow-inner border border-gray-500">
                      <div className="flex justify-between items-center mb-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleInventoryItemChange(item.id, 'name', e.target.value)}
                          placeholder="Nome do Item"
                          className="flex-grow p-2 bg-gray-700 border border-gray-500 rounded-md text-white mr-2 focus:ring-purple-500 focus:border-purple-500"
                          disabled={user.uid !== character.ownerUid && !isMaster}
                        />
                        <div className="flex space-x-2">
                            <button
                                onClick={() => toggleItemCollapsed('inventory', item.id)}
                                className="w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full flex items-center justify-center shadow-md transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                                title={item.isCollapsed ? 'Expandir' : 'Colapsar'}
                            >
                                {item.isCollapsed ? '▼' : '▲'}
                            </button>
                            <button
                                onClick={() => handleRemoveItem(item.id)}
                                className="w-8 h-8 bg-red-600 hover:bg-red-700 text-white font-bold rounded-full flex items-center justify-center shadow-md transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                                disabled={user.uid !== character.ownerUid && !isMaster}
                                title="Remover Item"
                            >
                                -
                            </button>
                        </div>
                      </div>
                      {!item.isCollapsed && (
                        <AutoResizingTextarea
                          value={item.description}
                          onChange={(e) => handleInventoryItemChange(item.id, 'description', e.target.value)}
                          placeholder="Descrição do Item..."
                          className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                          disabled={user.uid !== character.ownerUid && !isMaster}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-center mt-4">
                <button
                  onClick={handleAddItem}
                  className="w-8 h-8 bg-green-600 hover:bg-green-700 text-white font-bold rounded-full flex items-center justify-center shadow-md transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                  disabled={user.uid !== character.ownerUid && !isMaster}
                  title="Adicionar Item"
                >
                  +
                </button>
              </div>
            </>
          )}
        </div>

        {/* Advantages Section */}
        <div className="mb-8 p-4 bg-gray-700 rounded-lg shadow-md border border-gray-600">
          <button
            onClick={() => toggleSectionCollapsed(setIsAdvantagesCollapsed, isAdvantagesCollapsed)}
            className="w-full text-left text-xl font-semibold text-purple-300 flex justify-between items-center pb-2 border-b border-gray-600 mb-4"
          >
            Vantagens
            <span className="text-gray-400">{isAdvantagesCollapsed ? '▼' : '▲'}</span>
          </button>
          {!isAdvantagesCollapsed && (
            <>
              <div className="flex justify-center mb-4">
                <button
                  onClick={() => handleAddPerk('advantages')}
                  className="w-8 h-8 bg-green-600 hover:bg-green-700 text-white font-bold rounded-full flex items-center justify-center shadow-md transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                  disabled={user.uid !== character.ownerUid && !isMaster}
                  title="Adicionar Vantagem"
                >
                  +
                </button>
              </div>
              {character.advantages.length === 0 ? (
                <p className="text-center text-gray-400">Nenhuma vantagem.</p>
              ) : (
                <div className="space-y-4">
                  {character.advantages.map(perk => (
                    <div key={perk.id} className="bg-gray-600 p-4 rounded-md shadow-inner border border-gray-500">
                      <div className="flex justify-between items-center mb-2">
                        <input
                          type="text"
                          value={perk.name}
                          onChange={(e) => handlePerkChange('advantages', perk.id, 'name', e.target.value)}
                          placeholder="Nome da Vantagem"
                          className="flex-grow p-2 bg-gray-700 border border-gray-500 rounded-md text-white mr-2 focus:ring-purple-500 focus:border-purple-500"
                          disabled={user.uid !== character.ownerUid && !isMaster}
                        />
                        <div className="flex space-x-2">
                            <button
                                onClick={() => toggleItemCollapsed('advantages', perk.id)}
                                className="w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full flex items-center justify-center shadow-md transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                                title={perk.isCollapsed ? 'Expandir' : 'Colapsar'}
                            >
                                {perk.isCollapsed ? '▼' : '▲'}
                            </button>
                            <button
                                onClick={() => handleRemovePerk('advantages', perk.id)}
                                className="w-8 h-8 bg-red-600 hover:bg-red-700 text-white font-bold rounded-full flex items-center justify-center shadow-md transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                                disabled={user.uid !== character.ownerUid && !isMaster}
                                title="Remover Vantagem"
                            >
                                -
                            </button>
                        </div>
                      </div>
                      {!perk.isCollapsed && (
                        <>
                          <AutoResizingTextarea
                            value={perk.description}
                            onChange={(e) => handlePerkChange('advantages', perk.id, 'description', e.target.value)}
                            placeholder="Descrição da Vantagem..."
                            className="w-full p-2 mb-2 bg-gray-700 border border-gray-500 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                            disabled={user.uid !== character.ownerUid && !isMaster}
                          />
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-gray-300">Valor:</label>
                            <input
                              type="number"
                              value={perk.value}
                              onChange={(e) => handlePerkChange('advantages', perk.id, 'value', e.target.value)}
                              className="w-20 p-1 bg-gray-700 border border-gray-500 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                              disabled={user.uid !== character.ownerUid && !isMaster}
                            />
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-300">
                            <span>Origem:</span>
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={perk.origin.class}
                                onChange={() => handlePerkOriginChange('advantages', perk.id, 'class')}
                                className="form-checkbox h-4 w-4 text-purple-600 rounded border-gray-500 focus:ring-purple-500"
                                disabled={user.uid !== character.ownerUid && !isMaster}
                              />
                              <span className="ml-1">Classe</span>
                            </label>
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={perk.origin.race}
                                onChange={() => handlePerkOriginChange('advantages', perk.id, 'race')}
                                className="form-checkbox h-4 w-4 text-purple-600 rounded border-gray-500 focus:ring-purple-500"
                                disabled={user.uid !== character.ownerUid && !isMaster}
                              />
                              <span className="ml-1">Raça</span>
                            </label>
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={perk.origin.manual}
                                onChange={() => handlePerkOriginChange('advantages', perk.id, 'manual')}
                                className="form-checkbox h-4 w-4 text-purple-600 rounded border-gray-500 focus:ring-purple-500"
                                disabled={user.uid !== character.ownerUid && !isMaster}
                              />
                              <span className="ml-1">Manual</span>
                            </label>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-center mt-4">
                <button
                  onClick={() => handleAddPerk('advantages')}
                  className="w-8 h-8 bg-green-600 hover:bg-green-700 text-white font-bold rounded-full flex items-center justify-center shadow-md transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                  disabled={user.uid !== character.ownerUid && !isMaster}
                  title="Adicionar Vantagem"
                >
                  +
                </button>
              </div>
            </>
          )}
        </div>

        {/* Disadvantages Section */}
        <div className="mb-8 p-4 bg-gray-700 rounded-lg shadow-md border border-gray-600">
          <button
            onClick={() => toggleSectionCollapsed(setIsDisadvantagesCollapsed, isDisadvantagesCollapsed)}
            className="w-full text-left text-xl font-semibold text-purple-300 flex justify-between items-center pb-2 border-b border-gray-600 mb-4"
          >
            Desvantagens
            <span className="text-gray-400">{isDisadvantagesCollapsed ? '▼' : '▲'}</span>
          </button>
          {!isDisadvantagesCollapsed && (
            <>
              <div className="flex justify-center mb-4">
                <button
                  onClick={() => handleAddPerk('disadvantages')}
                  className="w-8 h-8 bg-green-600 hover:bg-green-700 text-white font-bold rounded-full flex items-center justify-center shadow-md transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                  disabled={user.uid !== character.ownerUid && !isMaster}
                  title="Adicionar Desvantagem"
                >
                  +
                </button>
              </div>
              {character.disadvantages.length === 0 ? (
                <p className="text-center text-gray-400">Nenhuma desvantagem.</p>
              ) : (
                <div className="space-y-4">
                  {character.disadvantages.map(perk => (
                    <div key={perk.id} className="bg-gray-600 p-4 rounded-md shadow-inner border border-gray-500">
                      <div className="flex justify-between items-center mb-2">
                        <input
                          type="text"
                          value={perk.name}
                          onChange={(e) => handlePerkChange('disadvantages', perk.id, 'name', e.target.value)}
                          placeholder="Nome da Desvantagem"
                          className="flex-grow p-2 bg-gray-700 border border-gray-500 rounded-md text-white mr-2 focus:ring-purple-500 focus:border-purple-500"
                          disabled={user.uid !== character.ownerUid && !isMaster}
                        />
                        <div className="flex space-x-2">
                            <button
                                onClick={() => toggleItemCollapsed('disadvantages', perk.id)}
                                className="w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full flex items-center justify-center shadow-md transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                                title={perk.isCollapsed ? 'Expandir' : 'Colapsar'}
                            >
                                {perk.isCollapsed ? '▼' : '▲'}
                            </button>
                            <button
                                onClick={() => handleRemovePerk('disadvantages', perk.id)}
                                className="w-8 h-8 bg-red-600 hover:bg-red-700 text-white font-bold rounded-full flex items-center justify-center shadow-md transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                                disabled={user.uid !== character.ownerUid && !isMaster}
                                title="Remover Desvantagem"
                            >
                                -
                            </button>
                        </div>
                      </div>
                      {!perk.isCollapsed && (
                        <>
                          <AutoResizingTextarea
                            value={perk.description}
                            onChange={(e) => handlePerkChange('disadvantages', perk.id, 'description', e.target.value)}
                            placeholder="Descrição da Desvantagem..."
                            className="w-full p-2 mb-2 bg-gray-700 border border-gray-500 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                            disabled={user.uid !== character.ownerUid && !isMaster}
                          />
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-gray-300">Valor:</label>
                            <input
                              type="number"
                              value={perk.value}
                              onChange={(e) => handlePerkChange('disadvantages', perk.id, 'value', e.target.value)}
                              className="w-20 p-1 bg-gray-700 border border-gray-500 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                              disabled={user.uid !== character.ownerUid && !isMaster}
                            />
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-300">
                            <span>Origem:</span>
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={perk.origin.class}
                                onChange={() => handlePerkOriginChange('disadvantages', perk.id, 'class')}
                                className="form-checkbox h-4 w-4 text-purple-600 rounded border-gray-500 focus:ring-purple-500"
                                disabled={user.uid !== character.ownerUid && !isMaster}
                              />
                              <span className="ml-1">Classe</span>
                            </label>
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={perk.origin.race}
                                onChange={() => handlePerkOriginChange('disadvantages', perk.id, 'race')}
                                className="form-checkbox h-4 w-4 text-purple-600 rounded border-gray-500 focus:ring-purple-500"
                                disabled={user.uid !== character.ownerUid && !isMaster}
                              />
                              <span className="ml-1">Raça</span>
                            </label>
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={perk.origin.manual}
                                onChange={() => handlePerkOriginChange('disadvantages', perk.id, 'manual')}
                                className="form-checkbox h-4 w-4 text-purple-600 rounded border-gray-500 focus:ring-purple-500"
                                disabled={user.uid !== character.ownerUid && !isMaster}
                              />
                              <span className="ml-1">Manual</span>
                            </label>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-center mt-4">
                <button
                  onClick={() => handleAddPerk('disadvantages')}
                  className="w-8 h-8 bg-green-600 hover:bg-green-700 text-white font-bold rounded-full flex items-center justify-center shadow-md transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                  disabled={user.uid !== character.ownerUid && !isMaster}
                  title="Adicionar Desvantagem"
                >
                  +
                </button>
              </div>
            </>
          )}
        </div>

        {/* Abilities Section */}
        <div className="mb-8 p-4 bg-gray-700 rounded-lg shadow-md border border-gray-600">
          <button
            onClick={() => toggleSectionCollapsed(setIsAbilitiesCollapsed, isAbilitiesCollapsed)}
            className="w-full text-left text-xl font-semibold text-purple-300 flex justify-between items-center pb-2 border-b border-gray-600 mb-4"
          >
            Habilidades
            <span className="text-gray-400">{isAbilitiesCollapsed ? '▼' : '▲'}</span>
          </button>
          {!isAbilitiesCollapsed && (
            <>
              <div className="flex justify-center mb-4">
                <button
                  onClick={handleAddAbility}
                  className="w-8 h-8 bg-green-600 hover:bg-green-700 text-white font-bold rounded-full flex items-center justify-center shadow-md transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                  disabled={user.uid !== character.ownerUid && !isMaster}
                  title="Adicionar Habilidade"
                >
                  +
                </button>
              </div>
              {character.abilities.length === 0 ? (
                <p className="text-center text-gray-400">Nenhuma habilidade.</p>
              ) : (
                <div className="space-y-4">
                  {character.abilities.map(ability => (
                    <div key={ability.id} className="bg-gray-600 p-4 rounded-md shadow-inner border border-gray-500">
                      <div className="flex justify-between items-center mb-2">
                        <input
                          type="text"
                          value={ability.title}
                          onChange={(e) => handleAbilityChange(ability.id, 'title', e.target.value)}
                          placeholder="Título da Habilidade"
                          className="flex-grow p-2 bg-gray-700 border border-gray-500 rounded-md text-white mr-2 focus:ring-purple-500 focus:border-purple-500"
                          disabled={user.uid !== character.ownerUid && !isMaster}
                        />
                        <div className="flex space-x-2">
                            <button
                                onClick={() => toggleItemCollapsed('abilities', ability.id)}
                                className="w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full flex items-center justify-center shadow-md transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                                title={ability.isCollapsed ? 'Expandir' : 'Colapsar'}
                            >
                                {ability.isCollapsed ? '▼' : '▲'}
                            </button>
                            <button
                                onClick={() => handleRemoveAbility(ability.id)}
                                className="w-8 h-8 bg-red-600 hover:bg-red-700 text-white font-bold rounded-full flex items-center justify-center shadow-md transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                                disabled={user.uid !== character.ownerUid && !isMaster}
                                title="Remover Habilidade"
                            >
                                -
                            </button>
                        </div>
                      </div>
                      {!ability.isCollapsed && (
                        <AutoResizingTextarea
                          value={ability.description}
                          onChange={(e) => handleAbilityChange(ability.id, 'description', e.target.value)}
                          placeholder="Descrição da Habilidade..."
                          className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                          disabled={user.uid !== character.ownerUid && !isMaster}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-center mt-4">
                <button
                  onClick={handleAddAbility}
                  className="w-8 h-8 bg-green-600 hover:bg-green-700 text-white font-bold rounded-full flex items-center justify-center shadow-md transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                  disabled={user.uid !== character.ownerUid && !isMaster}
                  title="Adicionar Habilidade"
                >
                  +
                </button>
              </div>
            </>
          )}
        </div>

        {/* Specializations Section */}
        <div className="mb-8 p-4 bg-gray-700 rounded-lg shadow-md border border-gray-600">
          <button
            onClick={() => toggleSectionCollapsed(setIsSpecializationsCollapsed, isSpecializationsCollapsed)}
            className="w-full text-left text-xl font-semibold text-purple-300 flex justify-between items-center pb-2 border-b border-gray-600 mb-4"
          >
            Especializações
            <span className="text-gray-400">{isSpecializationsCollapsed ? '▼' : '▲'}</span>
          </button>
          {!isSpecializationsCollapsed && (
            <>
              <div className="flex justify-center mb-4">
                <button
                  onClick={handleAddSpecialization}
                  className="w-8 h-8 bg-green-600 hover:bg-green-700 text-white font-bold rounded-full flex items-center justify-center shadow-md transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                  disabled={user.uid !== character.ownerUid && !isMaster}
                  title="Adicionar Especialização"
                >
                  +
                </button>
              </div>
              {character.specializations.length === 0 ? (
                <p className="text-center text-gray-400">Nenhuma especialização.</p>
              ) : (
                <div className="space-y-4">
                  {character.specializations.map(spec => (
                    <div key={spec.id} className="bg-gray-600 p-4 rounded-md shadow-inner border border-gray-500">
                      <div className="flex justify-between items-center mb-2">
                        <input
                          type="text"
                          value={spec.title}
                          onChange={(e) => handleSpecializationChange(spec.id, 'title', e.target.value)}
                          placeholder="Título da Especialização"
                          className="flex-grow p-2 bg-gray-700 border border-gray-500 rounded-md text-white mr-2 focus:ring-purple-500 focus:border-purple-500"
                          disabled={user.uid !== character.ownerUid && !isMaster}
                        />
                        <div className="flex space-x-2">
                            <button
                                onClick={() => toggleItemCollapsed('specializations', spec.id)}
                                className="w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full flex items-center justify-center shadow-md transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                                title={spec.isCollapsed ? 'Expandir' : 'Colapsar'}
                            >
                                {spec.isCollapsed ? '▼' : '▲'}
                            </button>
                            <button
                                onClick={() => handleRemoveSpecialization(spec.id)}
                                className="w-8 h-8 bg-red-600 hover:bg-red-700 text-white font-bold rounded-full flex items-center justify-center shadow-md transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                                disabled={user.uid !== character.ownerUid && !isMaster}
                                title="Remover Especialização"
                            >
                                -
                            </button>
                        </div>
                      </div>
                      {!spec.isCollapsed && (
                        <AutoResizingTextarea
                          value={spec.description}
                          onChange={(e) => handleSpecializationChange(spec.id, 'description', e.target.value)}
                          placeholder="Descrição da Especialização..."
                          className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                          disabled={user.uid !== character.ownerUid && !isMaster}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-center mt-4">
                <button
                  onClick={handleAddSpecialization}
                  className="w-8 h-8 bg-green-600 hover:bg-green-700 text-white font-bold rounded-full flex items-center justify-center shadow-md transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                  disabled={user.uid !== character.ownerUid && !isMaster}
                  title="Adicionar Especialização"
                >
                  +
                </button>
              </div>
            </>
          )}
        </div>

        {/* Equipped Items Section */}
        <div className="mb-8 p-4 bg-gray-700 rounded-lg shadow-md border border-gray-600">
          <button
            onClick={() => toggleSectionCollapsed(setIsEquippedItemsCollapsed, isEquippedItemsCollapsed)}
            className="w-full text-left text-xl font-semibold text-purple-300 flex justify-between items-center pb-2 border-b border-gray-600 mb-4"
          >
            Itens Equipados
            <span className="text-gray-400">{isEquippedItemsCollapsed ? '▼' : '▲'}</span>
          </button>
          {!isEquippedItemsCollapsed && (
            <>
              <div className="flex justify-center mb-4">
                <button
                  onClick={handleAddEquippedItem}
                  className="w-8 h-8 bg-green-600 hover:bg-green-700 text-white font-bold rounded-full flex items-center justify-center shadow-md transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                  disabled={user.uid !== character.ownerUid && !isMaster}
                  title="Adicionar Item Equipado"
                >
                  +
                </button>
              </div>
              {character.equippedItems.length === 0 ? (
                <p className="text-center text-gray-400">Nenhum item equipado.</p>
              ) : (
                <div className="space-y-4">
                  {character.equippedItems.map(item => (
                    <div key={item.id} className="bg-gray-600 p-4 rounded-md shadow-inner border border-gray-500">
                      <div className="flex justify-between items-center mb-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleEquippedItemChange(item.id, 'name', e.target.value)}
                          placeholder="Nome do Item Equipado"
                          className="flex-grow p-2 bg-gray-700 border border-gray-500 rounded-md text-white mr-2 focus:ring-purple-500 focus:border-purple-500"
                          disabled={user.uid !== character.ownerUid && !isMaster}
                        />
                        <div className="flex space-x-2">
                            <button
                                onClick={() => toggleItemCollapsed('equippedItems', item.id)}
                                className="w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full flex items-center justify-center shadow-md transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                                title={item.isCollapsed ? 'Expandir' : 'Colapsar'}
                            >
                                {item.isCollapsed ? '▼' : '▲'}
                            </button>
                            <button
                                onClick={() => handleRemoveEquippedItem(item.id)}
                                className="w-8 h-8 bg-red-600 hover:bg-red-700 text-white font-bold rounded-full flex items-center justify-center shadow-md transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                                disabled={user.uid !== character.ownerUid && !isMaster}
                                title="Remover Item Equipado"
                            >
                                -
                            </button>
                        </div>
                      </div>
                      {!item.isCollapsed && (
                        <AutoResizingTextarea
                          value={item.description}
                          onChange={(e) => handleEquippedItemChange(item.id, 'description', e.target.value)}
                          placeholder="Descrição do Item Equipado..."
                          className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                          disabled={user.uid !== character.ownerUid && !isMaster}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-center mt-4">
                <button
                  onClick={handleAddEquippedItem}
                  className="w-8 h-8 bg-green-600 hover:bg-green-700 text-white font-bold rounded-full flex items-center justify-center shadow-md transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                  disabled={user.uid !== character.ownerUid && !isMaster}
                  title="Adicionar Item Equipado"
                >
                  +
                </button>
              </div>
            </>
          )}
        </div>

        {/* History Section */}
        <div className="mb-8 p-4 bg-gray-700 rounded-lg shadow-md border border-gray-600">
          <button
            onClick={() => toggleSectionCollapsed(setIsHistoryCollapsed, isHistoryCollapsed)}
            className="w-full text-left text-xl font-semibold text-purple-300 flex justify-between items-center pb-2 border-b border-gray-600 mb-4"
          >
            História
            <span className="text-gray-400">{isHistoryCollapsed ? '▼' : '▲'}</span>
          </button>
          {!isHistoryCollapsed && (
            <>
              <div className="flex justify-center space-x-2 mb-4">
                <button
                  onClick={() => handleAddHistoryBlock('text')}
                  className="w-8 h-8 bg-green-600 hover:bg-green-700 text-white font-bold rounded-full flex items-center justify-center shadow-md transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                  disabled={user.uid !== character.ownerUid && !isMaster}
                  title="Adicionar Bloco de Texto"
                >
                  +
                </button>
              </div>
              {character.history.length === 0 ? (
                <p className="text-center text-gray-400">Nenhum bloco de história.</p>
              ) : (
                <div className="space-y-4">
                  {character.history.map(block => (
                    <div key={block.id} className="bg-gray-600 p-4 rounded-md shadow-inner border border-gray-500">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-300 capitalize">{block.type === 'text' ? 'Bloco de Texto' : 'Tipo Desconhecido'}</span>
                        <div className="flex space-x-2">
                            <button
                                onClick={() => toggleItemCollapsed('history', block.id)}
                                className="w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full flex items-center justify-center shadow-md transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                                title={block.isCollapsed ? 'Expandir' : 'Colapsar'}
                            >
                                {block.isCollapsed ? '▼' : '▲'}
                            </button>
                            <button
                                onClick={() => handleRemoveHistoryBlock(block.id)}
                                className="w-8 h-8 bg-red-600 hover:bg-red-700 text-white font-bold rounded-full flex items-center justify-center shadow-md transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                                disabled={user.uid !== character.ownerUid && !isMaster}
                                title="Remover Bloco"
                            >
                                -
                            </button>
                        </div>
                      </div>
                      {!block.isCollapsed && (
                        <AutoResizingTextarea
                          value={block.value}
                          onChange={(e) => handleHistoryBlockChange(block.id, e.target.value)}
                          placeholder="Escreva a história aqui..."
                          className="w-full p-2 bg-gray-700 border border-gray-500 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                          disabled={user.uid !== character.ownerUid && !isMaster}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-center space-x-2 mt-4">
                <button
                  onClick={() => handleAddHistoryBlock('text')}
                  className="w-8 h-8 bg-green-600 hover:bg-green-700 text-white font-bold rounded-full flex items-center justify-center shadow-md transition duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                  disabled={user.uid !== character.ownerUid && !isMaster}
                  title="Adicionar Bloco de Texto"
                >
                  +
                </button>
              </div>
            </>
          )}
        </div>

        {/* Notes Section */}
        <div className="mb-8 p-4 bg-gray-700 rounded-lg shadow-md border border-gray-600">
          <button
            onClick={() => toggleSectionCollapsed(setIsNotesCollapsed, isNotesCollapsed)}
            className="w-full text-left text-xl font-semibold text-purple-300 flex justify-between items-center pb-2 border-b border-gray-600 mb-4"
          >
            Notas
            <span className="text-gray-400">{isNotesCollapsed ? '▼' : '▲'}</span>
          </button>
          {!isNotesCollapsed && (
            <AutoResizingTextarea
              value={character.notes}
              onChange={handleChange}
              name="notes"
              placeholder="Adicione suas notas e detalhes aqui..."
              className="w-full p-2 bg-gray-600 border border-gray-500 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
              disabled={user.uid !== character.ownerUid && !isMaster}
            />
          )}
        </div>
      </div>

      {/* Back to Top Button */}
      {showBackToTopButton && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75 z-40"
          title="Voltar ao Topo"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path>
          </svg>
        </button>
      )}

      {modal.isVisible && <CustomModal {...modal} onClose={() => setModal({ ...modal, isVisible: false })} />}
    </div>
  );
};

export default App;

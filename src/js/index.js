    // --- 0 IMPORTS ---
import { db, auth } from './firebase-config.js';
import { ADMIN_CONFIG } from './config.js';
import { 
    collection, addDoc, getDocs, getDoc, query, where, deleteDoc, doc, updateDoc, orderBy, serverTimestamp, setDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";



// --- BIBLE VERSE LOGIC ---
    const fetchRandomBibleVerse = async () => {
    const verseText = document.getElementById('verse-text');
    const verseRef = document.getElementById('verse-reference');
    const url = "https://bible-api.com/data/web/random/PSA,GEN,MAT,MRK,LUK,JHN";

    try {
        const response = await fetch(url);
        const data = await response.json();

        // Looking at your "Pretty-print" image:
        // The data is inside data.random_verse
        if (data && data.random_verse) {
            const v = data.random_verse;
            
            // KEY FIX: Change 'book_name' to 'book' based on your image
            const bookName = v.book || "Bible"; 
            const chapter = v.chapter || "";
            const verseNum = v.verse || "";
            const text = v.text || "";

            verseText.innerText = text.trim();
            verseRef.innerText = `- ${bookName} ${chapter}:${verseNum}`;
        }
        } catch (error) {
            console.error("Bible Error:", error);
            verseRef.innerText = "- Psalms 23:1";
        }
    };

    // GLOVAL VARIABLES FOR ALARMS ---
let playedAlarms = new Set();
let lastTriggeredMinute = "";
let nextMatchTime = null;
let dropZone;
let oneHourAlertSent = false;
let exactMatchDate = null;
    


document.addEventListener("DOMContentLoaded", () => {

    // 1. SELECTORS
    const taskInput = document.getElementById("input-box");
    const addTaskBtn = document.getElementById("add-task-btn");
    const taskList = document.getElementById("task-list");
    const progressBar = document.getElementById("progress");
    const progressNumbers = document.getElementById("numbers");
    const medInput = document.getElementById("med-input-box");
    const medTimeInput = document.getElementById("med-time-box");
    const dailyMedList = document.getElementById("daily-med-list");
    const dailyAlarmList = document.getElementById("daily-alarm-list");
    const emptyImag = document.querySelector(".empty-imag");
    const groceryArea = document.getElementById("grocery-note");
    const cloud = document.getElementById("cloud-sync-popup");
    const logoutBtn = document.getElementById("logout-btn");
    const selectors = document.querySelectorAll('.player-selector');
    const playBtn = document.getElementById('play-audio');
    const pauseBtn = document.getElementById('pause-audio');
    const stopBtn = document.getElementById('stop-audio');
    const playerVolume = document.getElementById('player-volume');
    const saveBillBtn = document.getElementById('save-bill-btn');
    const addAlarmBtn = document.getElementById("add-alarm-btn");
    const addMedBtn = document.getElementById("add-med-alarm-btn");
    const alarmInput = document.getElementById("alarm-input-box");
    const alarmTimeInput = document.getElementById("alarm-time-box");
    dropZone = document.getElementById('drop-zone');
    let palmeirasAnthem = document.getElementById('anthem-audio');

    let currentAudio = null;
    let activeSelector = null;
    let nextMatchTime = null;
    let exactMatchDate = null;  
    let oneHourAlertSent = false;

    // --- 1.0 CORE UTILITIES ---
    // 1.1. DROPZONE
    if (dropZone) {
    // 1. You MUST prevent default on ALL FOUR of these events
    // If you miss even one, Chrome will open the image in a new tab.
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation(); // Stops the event from bubbling up to Chrome
        }, false);
    });

    // 1.1.2. Visual feedback
    dropZone.addEventListener('dragover', () => {
        dropZone.classList.add('drag-active'); // Add a CSS class for a glow effect
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-active');
    });

    // 1.1.3. The Actual Capture
    dropZone.addEventListener('drop', (e) => {
        dropZone.classList.remove('drag-active');
        
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files && files.length > 0) {
            Array.from(files).forEach(file => {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    
                    // ADD 'async' HERE!
                    reader.onload = async (event) => {
                        // 1. Wait for the image to shrink
                        const tinyImage = await resizeImage(event.target.result);

                        console.log("Original size:", event.target.result.length);
                        console.log("New compressed size:", tinyImage.length);

                        // 2. IMPORTANT: Pass 'tinyImage' (not event.target.result) 
                        // to the UI and the Firebase saver
                        createDreamThumbnail(tinyImage);
                        saveDreamsToFirebase(); 
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    });

}

    // 1.2 AUDIO UNLOCK
    const unlockAudio = () => {
        const audios = [
            document.getElementById('med-alarm-sound'),
            document.getElementById('daily-alarm-sound'),
            document.getElementById('check-sound')
            
        ];
        audios.forEach(a => {
            if (a) {
                a.play().then(() => { a.pause(); a.currentTime = 0; }).catch(() => {});
            }
        });
        // Remove listener after first click to save memory
        document.removeEventListener('click', unlockAudio);
    };
    document.addEventListener('click', unlockAudio);
 
    // 1.2.1 CHECK AUDIO
    const playCheckSound = () => {
    const popSound = document.getElementById("check-sound");
    if (!popSound) return;

    popSound.volume = 0.5; 

    popSound.currentTime = 0;
    popSound.play().catch(() => {});
    };

    // 1.3 CONFETTI  
    const fireConfetti = () => {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#A9E8E8', '#00b09b', '#ffffff'] });
    };

    // 1.4 UPDATE PROGRESS  
        const updateProgress = () => {
        const tasks = taskList.querySelectorAll("li");
        const completedTasks = taskList.querySelectorAll("li.completed");
        const total = tasks.length;
        const completed = completedTasks.length;
        const progress = total ? (completed / total) * 100 : 0;
        if (progressBar) progressBar.style.width = `${progress}%`;
        if (progressNumbers) progressNumbers.innerText = `${completed} / ${total}`;
        if (total > 0 && completed === total) fireConfetti();
    };

    // 1.5 EMPTY STATE TOGGLE
    const toggleEmptyState = () => {
        if (emptyImag && taskList) {
            emptyImag.style.display = taskList.children.length === 0 ? "block" : "none";
        }
    };

    // 1.6 RESET PLAYER
    const resetPlayer = () => {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
        }
        selectors.forEach(s => s.classList.remove('selected', 'playing'));
        currentAudio = null;
        activeSelector = null;
    };

    // 1.7 VOLUME PERSISTENCE
    function initVolumes() {
    // List all your slider IDs here
    const sliderIds = ['kitchen-volume', 'player-volume', 'reminder-volume-slider', 'med-volume-slider'];
    

    sliderIds.forEach(id => {
        const sliderEl = document.getElementById(id);
        
        if (sliderEl) {
            // 1. Load from localStorage
            const savedValue = localStorage.getItem(id);
            
            if (savedValue !== null) {
                sliderEl.value = savedValue;
                // Force any linked audio objects to update immediately
                sliderEl.dispatchEvent(new Event('input'));
                console.log(`Restored ${id} to ${savedValue}`);
            }

            // 2. Save on every movement
            sliderEl.addEventListener('input', (e) => {
                localStorage.setItem(id, e.target.value);
                });
            } else {
                console.warn(`Could not find slider with ID: ${id}`);
            }
        });
    }
    document.addEventListener('DOMContentLoaded', initVolumes);
    setTimeout(initVolumes, 500);

    //  1.8 DAILY ALARM CHECK/RESET 
    const checkDailyReset = async () => {
    const user = auth.currentUser;
     if (!user) return;

    const today = new Date().toLocaleDateString('en-GB'); // "08/04/2026"
    const lastReset = localStorage.getItem('last_med_reset');

        if (lastReset !== today) {
            console.log("New day detected! Resetting meds...");

            try {
                const q = query(collection(db, "daily_meds_alarms"), where("userId", "==", user.uid));
                const querySnapshot = await getDocs(q);

                const batchPromises = querySnapshot.docs.map(docSnap => {
                    // Clear the local backup for this med too
                    localStorage.removeItem(`med_status_${docSnap.id}`);
                    // Update Firebase
                    return updateDoc(doc(db, "daily_meds_alarms", docSnap.id), { completed: false });
                });

                await Promise.all(batchPromises);
                localStorage.setItem('last_med_reset', today);
                
                // Reload UI
                loadMedsFromFirebase();
            } catch (err) {
                console.error("Reset failed:", err);
            }
        }
    };


    // --- 2. THE BOUNCER (AUTH % LOADERS) ---
    onAuthStateChanged(auth,async (user) => {
        const palmeirasSection = document.getElementById('palmeiras-tracker');

    if (user) {
        document.body.style.display = "block";

        // --- 🐷 EXCLUSIVE PALMEIRA SECTION FOR ME!---
        if (user.email && user.email.toLowerCase() === ADMIN_CONFIG.email) {
        if (palmeirasSection) palmeirasSection.style.display = "block";
        await loadPalmeirasFixtures();
            } else {
        if (palmeirasSection) palmeirasSection.style.display = "none";
        }
        
        await checkDailyReset();

        

        // Friendly Welcome Toast
        Toastify({
            text: `Welcome 🏠, ${user.displayName || user.email.split('@')[0]}! 👋🏻`,
            duration: 4000,
            gravity: "top", 
            position: "center",
            style: {
                background: "linear-gradient(to right, #A9E8E8, #00b09b)",
                color: "#13131a",
                borderRadius: "15px",
                fontWeight: "bold"
            }
        }).showToast();

        // Load all data
        loadTasksFromFirebase();
        loadMedsFromFirebase();
        loadNotesFromFirebase();
        loadGroceriesFromFirebase();
        loadBillsFromFirebase();
        loadMedsFromFirebase();
        loadAlarmsFromFirebase();
        checkCabinetSupplies(); 
        fetchRandomBibleVerse();
        await loadDreamsFromFirebase();
        
        const currentBills = await loadBillsFromFirebase(); 
        if (currentBills) {
            await checkAndProcessInstallments(currentBills);
            
        }

    } else {
        window.location.replace('login.html');
    }
});


    // --- 3. LOGOUT LOGIC ---
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            try {
                await signOut(auth);
                localStorage.clear();
                window.location.replace('login.html?logout=true');
            } catch (error) {
                console.error("Logout failed:", error);
            }
        });
    }

    
    // --- 4. GROCERY ---
        //  4.1 GROCERY SAVE LOGIC 
    const saveGroceriesToFirebase = async () => {
    const user = auth.currentUser;
    if (!user || !groceryArea) return;

    try {
        await setDoc(doc(db, "groceries", `${user.uid}_list`), {
            content: groceryArea.value,
            userId: user.uid,
            last_updated: serverTimestamp()
        });

        if (cloud) {
            cloud.classList.add("show");
            setTimeout(() => cloud.classList.remove("show"), 1500);
        }
    } catch (err) {
        console.error("Grocery sync failed:", err);
    }
    };

    //typoing listener
    if (groceryArea) {
    let groceryTimeout;
    groceryArea.addEventListener("input", () => {
        clearTimeout(groceryTimeout);
        // Waits 1 second after you stop typing to save
        groceryTimeout = setTimeout(saveGroceriesToFirebase, 1000);
    });
    }

    //  4.2 GROCERY LOAD LOGIC (no delete since we save as user types, not individual items)
    const loadGroceriesFromFirebase = async () => {
        const user = auth.currentUser;
        if (!user || !groceryArea) return;
        try {
            const docRef = doc(db, "groceries", `${user.uid}_list`);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                groceryArea.value = docSnap.data().content;
            }
        } catch (err) {
            console.error("Error loading groceries:", err);
        }
    };

    const groceryNote = document.getElementById('grocery-note');

    // 4.3  ADD "-" NO GROCERIES
    function processGroceryLines() {
        const cursorPosition = groceryNote.selectionStart; // Save where the user is typing
        const originalText = groceryNote.value;
        
        // Split by newline
        let lines = originalText.split('\n');
        
        let formattedLines = lines.map(line => {
            // Skip empty lines or lines that already have a bullet
            if (line.trim() === "" || line.trim().startsWith('-') || line.trim().startsWith('•')) {
                return line;
            }
            // Add the dash to the start of the line
            return `- ${line}`;
        });

        const newText = formattedLines.join('\n');

        if (originalText !== newText) {
            groceryNote.value = newText;
            
            // This prevents the cursor from jumping to the end of the textarea
            // We add +2 to account for the "- " we just inserted
            groceryNote.setSelectionRange(cursorPosition + 2, cursorPosition + 2);
        }
        
        saveToCloud(); 
    }
 
    // 4.3.1 TRIGGER ON ENTER KEY
    groceryNote.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            // Run the formatting slightly AFTER the enter key registers -> 10s
            setTimeout(processGroceryLines, 10);
        }
    });

    // 4.3.2 TRIGGER "-" ON PASTE 
    groceryNote.addEventListener('paste', () => {
        setTimeout(processGroceryLines, 10);
    });

    // 4.3.3 TRIGGER ON "IDLE" (When you stop typing for 2 seconds)
    let syncDebounce;
    groceryNote.addEventListener('input', () => {
        clearTimeout(syncDebounce);
        syncDebounce = setTimeout(processGroceryLines, 2000);
    });

    // --- 6. TASKS ---
    //  6.1 TASK ADD LOGIC 
    const addTask = (text, completed = false, saveToDB = true) => {
        const taskText = text || taskInput.value.trim();
        if (!taskText) return;

        const li = document.createElement("li");
        if (completed) li.classList.add("completed");

        li.innerHTML = `
            <input type="checkbox" class="checkbox" ${completed ? "checked" : ""}/>
            <strong>${taskText}</strong>
            <div class="task-buttons">
                <button class="edit-btn"><i class="fa-solid fa-pen"></i></button>
                <button class="delete-btn"><i class="fa-solid fa-trash"></i></button>
            </div>`;

        const checkbox = li.querySelector(".checkbox");
        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                const popSound = document.getElementById("check-sound");
                if (popSound) {
                    popSound.currentTime = 0;
                    popSound.play().catch(() => {});
                }
            }
            li.classList.toggle("completed", checkbox.checked);
            updateProgress();
            syncTaskToFirebase(taskText, checkbox.checked);
        });

        li.querySelector(".delete-btn").addEventListener("click", () => {
            li.remove();
            updateProgress();
            deleteTaskFromFirebase(taskText);
            toggleEmptyState();
        });

        li.querySelector(".edit-btn").addEventListener("click", () => {
            if (!checkbox.checked) {
                taskInput.value = taskText;
                li.remove();
                deleteTaskFromFirebase(taskText);
                updateProgress();
                toggleEmptyState();
            }
        });

        taskList.appendChild(li);
        if (saveToDB) saveTaskToFirebase(taskText);
        taskInput.value = "";
        updateProgress();
        toggleEmptyState();
    };

    //  6.2 TASK SAVE FIREBASE 
    const saveTaskToFirebase = async (taskText) => {
        const user = auth.currentUser;
        if (!user) return;
        await addDoc(collection(db, "tasks"), {
            text: taskText,
            completed: false,
            userId: user.uid,
            createdAt: serverTimestamp()
        });
    };

    //  6.3 TASK LOAD FIREBASE 
    const loadTasksFromFirebase = async () => {
        const user = auth.currentUser;
        if (!user) return;
        const q = query(collection(db, "tasks"), where("userId", "==", user.uid), orderBy("createdAt", "asc"));
        const querySnapshot = await getDocs(q);
        taskList.innerHTML = ""; 
        querySnapshot.forEach((doc) => {
            const task = doc.data();
            addTask(task.text, task.completed, false);
        });
        updateProgress();
        toggleEmptyState();
    };

    //  6.4 TASK SYNC FIREBASE 
    const syncTaskToFirebase = async (taskText, isCompleted) => {
        const user = auth.currentUser;
        const q = query(collection(db, "tasks"), where("text", "==", taskText), where("userId", "==", user.uid));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(async (taskDoc) => {
            await updateDoc(doc(db, "tasks", taskDoc.id), { completed: isCompleted });
        });
    };

    //  6.5 TASK DELETE FIREBASE 
    const deleteTaskFromFirebase = async (taskText) => {
        if (!taskText) return;

        const user = auth.currentUser;
        const q = query(collection(db, "tasks"), where("text", "==", taskText), where("userId", "==", user.uid));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(async (taskDoc) => {
            await deleteDoc(doc(db, "tasks", taskDoc.id));
        });
    };
    
    // --- 7. DAILY MEDS LOGIC ---
    //  7.1 RENDER MED UI
    const renderMedInUI = (med) => {
        const li = document.createElement("li");
        
        if (med.completed) {
            li.classList.add("completed");
        }

        li.innerHTML = `
            <input type="checkbox" class="med-check" ${med.completed ? "checked" : ""}/>
                    <strong class="med-name">${med.name}</strong>
                    <span class="med-time">${med.time}</span>
            <div class="item-main">        
                    <button class="delete-med-btn"><i class="fa-solid fa-trash"></i></button>
            </div>`;
            
        
        
        const checkbox = li.querySelector(".med-check");
        checkbox.addEventListener("change", async (e) => {
            const isDone = e.target.checked;
            
            if (isDone) playCheckSound('med');
            
            li.classList.toggle("completed", isDone);
            
            await syncMedsToFirebase(med.name, isDone);
        });

        // Delete Med
        li.querySelector(".delete-med-btn").addEventListener("click", async () => {
            li.remove();
            await deleteMedsFromFirebase(med.id);
        });

        dailyMedList.appendChild(li);
    };

    // 7.2 SAVE MED TO FIREBASE
    const saveMedToFirebase = async (name, time) => {
        const user = auth.currentUser;
        if (!user) return;
        try {
            await addDoc(collection(db, "daily_meds_alarms"), {
                name, time, completed: false, userId: user.uid, createdAt: serverTimestamp()
            });
            loadMedsFromFirebase();
        } catch (err) { console.error("Error saving med:", err); }
    };

    // 7.3 LOAD MEDS FROM FIREBASE
    const loadMedsFromFirebase = async () => {
        const user = auth.currentUser;
        if (!user || !dailyMedList) return;

        try {
            const q = query(collection(db, "daily_meds_alarms"), where("userId", "==", user.uid));
            const querySnapshot = await getDocs(q);
            
            // 1. Convert snapshot to an array so we can sort it
            const medsArray = [];
            querySnapshot.forEach((doc) => {
                medsArray.push({ id: doc.id, ...doc.data() });
            });

            // 2. Sort the array by the 'time' string (e.g., "08:00" comes before "22:00")
            medsArray.sort((a, b) => {
                const timeA = a.time || "";
                const timeB = b.time || "";
                return timeA.localeCompare(timeB);
            });

            // 3. Clear and Render the sorted list
            dailyMedList.innerHTML = ""; 
            medsArray.forEach((med) => renderMedInUI(med));

        } catch (err) {
            console.error("Error loading/sorting meds:", err);
        }
    };

    // 7.4 SYNC MEDS (Checkbox Status)
    const syncMedsToFirebase = async (medName, isCompleted) => {
    // CRITICAL GUARD: Stop if medName is missing
    if (!medName) {
        
        return;
    }

    const user = auth.currentUser;
    if (!user) return;

        try {
    // We find the med by its name (text) and the current user
    const q = query(
                collection(db, "daily_meds_alarms"), 
                where("name", "==", medName), 
                where("userId", "==", user.uid)
            );
            
        const querySnapshot = await getDocs(q);
            
            querySnapshot.forEach(async (medDoc) => {
                await updateDoc(doc(db, "daily_meds_alarms", medDoc.id), { 
                    completed: isCompleted 
                });
            });
            
            console.log(`Synced ${medName} to Firebase: ${isCompleted}`);
        } catch (error) {
            console.error("Sync failed:", error);
        }
    };

    // 7.5 DELETE MEDS
    const deleteMedsFromFirebase = async (medId) => {
        try {
            await deleteDoc(doc(db, "daily_meds_alarms", medId));
        } catch (err) { console.error("Delete Med Error:", err); }
    };

    // --- BUTTON LISTENERS ---
    //  7.6 MED BUTTON LISTENERS 
    if (addMedBtn) {
        addMedBtn.addEventListener("click", (e) => {
            e.preventDefault();
            const name = medInput.value.trim();
            const time = medTimeInput.value;
            if (name && time) {
                saveMedToFirebase(name, time);
                medInput.value = "";
                medTimeInput.value = "";
            }
        });
    }

    // --- 8. MED CABINET SUPPLIES ---
    // 8.1 CHECK SUPPLIES
    const checkCabinetSupplies = async () => {

        if (!auth || !auth.currentUser) {
        console.warn("Firebase Auth not ready yet. Skipping check.");
        return; 
    }

        const user = auth.currentUser;
    if (!user) return;

    const attentionDiv = document.getElementById("attention-div");
    
    const dailyList = document.getElementById("low-supply-daily");
    const nonDailyList = document.getElementById("low-supply-nondaily");

    try {
        const q = query(collection(db, "med_cabinet"), where("userId", "==", user.uid));
        const querySnapshot = await getDocs(q);
        
        // Arrays DAILY / NONDAILY
        let dailyLow = [];
        let nonDailyLow = [];

        querySnapshot.forEach((doc) => {
            const med = doc.data();
            const supply = Number(med.months_supply); 

            // Check if stock is low (1 month or less)
            if (supply <= 1) {
                const itemData = { 
                    name: med.name, 
                    count: supply 
                };

                // Split by type (Assuming you save 'daily' or 'nondaily' in Firebase)
                if (med.type === "daily") {
                    dailyLow.push(itemData);
                } else {
                    nonDailyLow.push(itemData);
                }
            }
        });

        // 8.1.1. HIDE IF NO LOW MED
        if (dailyLow.length === 0 && nonDailyLow.length === 0) {
            if (attentionDiv) attentionDiv.style.display = "none";
            return;
        }

        // 8.1.2. SHOW AND RESET LISTS
        if (attentionDiv) attentionDiv.style.display = "block";
        dailyList.innerHTML = "";
        nonDailyList.innerHTML = "";

        // 8.1.3.  FILL DAILY SECTYION
        if (dailyLow.length > 0) {
            document.getElementById("daily-warnings").style.display = "block";
            dailyLow.forEach(item => {
                const li = document.createElement("li");
                li.innerHTML = `<strong>${item.name}</strong>: <span>${item.count === 0 ? 'Empty' : '1 month left'}</span>`;
                dailyList.appendChild(li);
            });
        } else {
            document.getElementById("daily-warnings").style.display = "none";
        }

        // 8.1.4. FILL NON DAILY SECTION
        if (nonDailyLow.length > 0) {
            document.getElementById("nondaily-warnings").style.display = "block";
            nonDailyLow.forEach(item => {
                const li = document.createElement("li");
                li.innerHTML = `<strong>${item.name}</strong>: <span>${item.count === 0 ? 'Empty' : '1 month left'}</span>`;
                nonDailyList.appendChild(li);
            });
        } else {
            document.getElementById("nondaily-warnings").style.display = "none";
        }

    } catch (err) {
        console.error("Cabinet check error:", err);
    }
    };

    // --- 9. DAILY ALARMS LOGIC ---

    // 9.1 RENDER ALARM UI
    const renderAlarmInUI = (alarm) => {
    const li = document.createElement("li");
    li.className = "routine-item daily-alarm";
    li.innerHTML = `
        <div class="item-main">
            <div class="item-info">
                <strong class="alarm-name">${alarm.name}</strong>
                <span class="alarm-time">${alarm.time}</span>
            </div>
        </div>
        <div class="alarm-controls">
            <button class="delete-alarm-btn"><i class="fa-solid fa-trash"></i></button>
        </div>`;

        li.querySelector(".delete-alarm-btn").addEventListener("click", () => {
            li.remove();
            updateProgress();
            deleteAlarmFromFirebase(alarm.id);
            
        });

        dailyAlarmList.appendChild(li);
    };

    // 9.2 SAVE ALARM TO FIREBASE
    const saveAlarmToFirebase = async (name, time) => {
        const user = auth.currentUser;
        if (!user) return;
        try {
            await addDoc(collection(db, "daily_alarms"), {
                name, time, userId: user.uid, createdAt: serverTimestamp()
            });
            loadAlarmsFromFirebase();
        } catch (err) { console.error("Error saving alarm:", err); }
    };

    // 9.3 LOAD ALARMS FROM FIREBASE
    const loadAlarmsFromFirebase = async () => {
        const user = auth.currentUser;
        if (!user || !dailyAlarmList) return;
        const q = query(collection(db, "daily_alarms"), where("userId", "==", user.uid));
        const querySnapshot = await getDocs(q);
        dailyAlarmList.innerHTML = ""; 
        querySnapshot.forEach((doc) => renderAlarmInUI({ id: doc.id, ...doc.data() }));
    };

    // 9.4 DELETE ALARMS
    const deleteAlarmFromFirebase = async (alarmId) => {
        try {
            await deleteDoc(doc(db, "daily_alarms", alarmId));
        } catch (err) { console.error("Delete Alarm Error:", err); }
    };

    // --- BUTTON LISTENERS ---
    // 9.5 DAILY ALARM BUTTON LISTENERS 
    if (addAlarmBtn) {
        addAlarmBtn.addEventListener("click", (e) => {
            e.preventDefault();
            const name = alarmInput.value.trim();
            const time = alarmTimeInput.value;
            if (name && time) {
                saveAlarmToFirebase(name, time);
                alarmInput.value = "";
                alarmTimeInput.value = "";
            }
        });
    }

    // --- 10. NOTES ---
    // 10.1 NOTE SYNC FIREBASE
    const syncNoteToFirebase = async (noteId, text) => {
        const user = auth.currentUser;
        if (!user) return;
        await setDoc(doc(db, "notes", `${user.uid}_${noteId}`), {
            note_id: noteId,
            content: text,
            userId: user.uid,
            last_updated: serverTimestamp()
        });
    };

    // 10.2 NOTES LOAD FIREBASE 
    const loadNotesFromFirebase = async () => {
        const user = auth.currentUser;
        if (!user) return;
        const q = query(collection(db, "notes"), where("userId", "==", user.uid));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const noteArea = document.getElementById(data.note_id);
            if (noteArea) noteArea.value = data.content;
        });
    };

    // 10.3 NOTES SAVE-SYNC LIVE FIREBASE 
    document.querySelectorAll(".notes textarea").forEach(noteArea => {
        let timeout;
        noteArea.addEventListener("input", (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => syncNoteToFirebase(noteArea.id, e.target.value), 1000);
        });
    });


    // --- 11. BILLS SYSTEM LOGIC ---
    // 12.1 SAVE BILL
    const saveBillToFirebase = async (billData) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
        await addDoc(collection(db, "bills"), {
            ...billData,
            userId: user.uid,
            createdAt: serverTimestamp()
        });
        
        // FIXED: String quotes and object keys
        Toastify({ 
            text: "Bill added! 💸", 
            gravity: "top", 
            position: "center", 
            duration: 3000, 
            style: { background: "#00b09b", borderRadius: "12px" } 
        }).showToast();
        
        loadBillsFromFirebase();
    } catch (err) {
        console.error("Error saving bill:", err);
    }
    };

    // 12.2 LOAD BILLS
    const loadBillsFromFirebase = async () => {
        const user = auth.currentUser;
        if (!user) return;
        const billList = document.getElementById('bill-list');
        const totalDisplay = document.getElementById('monthly-total-display');
        
        const q = query(collection(db, "bills"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        billList.innerHTML = "";
        let monthlyTotal = 0;
        let nextBill = null;
        let minDays = Infinity;
        const allBills = []; 

        querySnapshot.forEach((docSnap) => {
            const bill = { id: docSnap.id, ...docSnap.data() };
            allBills.push(bill);

            monthlyTotal += parseFloat(bill.amount) || 0;
        
            const daysLeft = calculateDaysLeft(bill.due);
            if (daysLeft >= 0 && daysLeft < minDays) {  
                minDays = daysLeft;
                nextBill = bill;
            }

            renderBillInUI(bill);
        });

        if (totalDisplay) totalDisplay.innerText = `£ ${monthlyTotal.toFixed(2)}`;
        updateNextPaymentUI(nextBill, minDays);
        
        return allBills;
    };

    // 12.3 DELETE BILL
    const deleteBillFromFirebase = async (id) => {
        await deleteDoc(doc(db, "bills", id));
        loadBillsFromFirebase();
    };

    // 12.4 RENDER BILL UI    
    const renderBillInUI = (bill) => {
    const list = document.getElementById('bill-list');
    const li = document.createElement('li');
    li.className = 'bill-item';

    const daysLeft = calculateDaysLeft(bill.due);
    const isDueSoon = daysLeft <= 0;

    let instInfo = "";
    let isCompleted = false;

    if (bill.frequency === 'installment') {
        const remaining = parseInt(bill.totalInst) - parseInt(bill.paidInst);
        if (remaining <= 0) {
            isCompleted = true;
            li.classList.add('completed-bill');
            instInfo = `<span class="completed-badge">🎉 Paid</span>`;
        } else if (remaining <= 2) {
            instInfo = `<span class="inst-warning">⚠️ ${remaining} Inst. left</span>`;
        } else {
            instInfo = `<small>${bill.paidInst}/${bill.totalInst}</small>`;
        }
    }

    const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    };

    li.innerHTML = `
    <div class="bill-main">
        <span class="bill-cat-icon">${getCategoryIcon(bill.category)}</span>
        <div class="bill-text">
            <strong style="${isCompleted ? 'text-decoration: line-through' : ''}">${bill.name}</strong>
            <div class="bill-meta">${instInfo}</div> 
        </div>
        
        <div class="bill-right-side" style="text-align: right; margin-right: 10px;">
            <b style="display: block;">£ ${parseFloat(bill.amount).toFixed(2)}</b>
            <small class="bill-date-display" style="font-size: 0.7rem; opacity: 0.7;">
                ${bill.due ? formatDate(bill.due) : 'No date'}
            </small>
        </div>

        <button class="delete-bill-btn" data-id="${bill.id}" title="Remove Bill">
            <i class="fa-solid fa-trash"></i>
        </button>
    </div>
`;

    li.querySelector('.delete-bill-btn').addEventListener('click', () => {
        if (isCompleted || confirm("Delete this bill?")) deleteBillFromFirebase(bill.id);
    });

    list.appendChild(li);
    };

    // 12.5  BILL BUTTON ADD 
    if (saveBillBtn) {
        saveBillBtn.addEventListener('click', async () => {
            const labelInput = document.getElementById('bill-label'); 
            const amountInput = document.getElementById('bill-amount'); 
            const freqInput = document.getElementById('bill-frequency');
            const catInput = document.getElementById('bill-category');
            const dueInput = document.getElementById('bill-due-date'); 
            const totalInstInput = document.getElementById('inst-total'); 
            const currentInstInput = document.getElementById('current-inst');
            const cleanValue = amountInput.value.replace(/\./g, "");
            const finalAmount = parseInt(cleanValue) || 0;

            const enteredAmount = parseFloat(amountInput.value);
            
            if (amountInput) {
                amountInput.addEventListener('input', (e) => {
                    // Apply the 7-digit limit and dots live
                    e.target.value = formatThousandsInput(e.target.value);
                });
            }

            if (enteredAmount < 0 || enteredAmount > 999999) {
                Toastify({ 
                    text: "Amount must be between 0 and 999,999! 🛑",
                    gravity: "top",
                    position: "center",
                    style: { background: "#ff5f6d" } 
                }).showToast();
                return; // Stops the function here
            }
            // 1. Validation
            if (!labelInput.value || !amountInput.value) {
                Toastify({ 
                    text: "Please enter a Name and Price! ⚠️",
                    gravity: "top",
                    position: "center",
                    style: { background: "#ff5f6d" } 
                }).showToast();
                return;
            }

            //add the . after 3 numbers
            const formatThousandsInput = (value) => {
            let digits = value.replace(/\D/g, "");

            if (digits.length > 7) {
                digits = digits.slice(0, 7);
            }

            return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        };

            // 2. Data Preparation
            const billData = {
                name: labelInput.value,
                amount: finalAmount,
                frequency: freqInput.value,
                category: catInput.value || "Other",
                due: dueInput.value,
                paidInst: parseInt(currentInstInput.value) || 0,
                totalInst: parseInt(totalInstInput.value) || 0
            };

            // 3. Save to Firebase
            await saveBillToFirebase(billData);
            
            // --- 4. THE CLEANING CREW ---
            // Clear text and number inputs
            labelInput.value = "";
            amountInput.value = "";
            dueInput.value = "";
            currentInstInput.value = "";
            totalInstInput.value = "";

            // Reset dropdowns to the first option (placeholder)
            freqInput.selectedIndex = 0;
            catInput.selectedIndex = 0;

            // Hide the installment configuration div again (since it's now back to 'monthly')
            const configDiv = document.getElementById('inst-config');
            if (configDiv) configDiv.style.display = 'none';

            // Put the cursor back in the first box so you can type the next bill immediately
            labelInput.focus();
        });
    }

    // 12.6 HELPER: Calculate days between today and due date
    const calculateDaysLeft = (dateString) => {
        if (!dateString) return 0;
        const dueDate = new Date(dateString + 'T00:00:00');
        const today = new Date();
        today.setHours(0,0,0,0);
        const diffTime = dueDate - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    // 12.7 HELPER: Update the top "Next Payment" card
        const updateNextPaymentUI = (bill, days) => {
        const label = document.getElementById('next-bill-label');
        const count = document.getElementById('days-left');
        
        if (bill && label && count) {
            label.innerText = bill.name;
            
            if (days <= 0) {
                count.innerHTML = `<span class="due-panic">TODAY!</span>`;
            } else {
                count.innerText = `${days} ${days === 1 ? 'day' : 'days'}`;
            }
        }
    };
            //'Food': '<i class="fa-solid fa-utensils"></i>',
            //'Subs': '<i class="fa-solid fa-play"></i>'

    // 12.8 HELPER: Map category names to icons
    const getCategoryIcon = (cat) => {
        const icons = {
            'Rent': '🏠',
            'Insurance': '🛡️',
            'Phone': '📱',
            'Car': '🚗',
            'Credit card': '💳',
            'Bank': '🏦',
            'Investments': '💷',
            'Food': '🍴',
            'Electricity': '⚡',
            'Water': '💧',
            'Subscription': '📺',
            'Internet': '🛜',
            'Pet': '🐕‍🦺',
            'Medical': '🩺',
            'Emergency': '💥',
            'Shopping': '👜',
            'Hobbies': '🎮',
            'Travel': '🛬',
            'Other': '🌴'
            
        };
        return icons[cat] || '📄';
    };  

    // 12.9 CHECK INSTALLMENTS
        const checkAndProcessInstallments = async (bills) => {
        const today = new Date();
        const currentMY = `${today.getMonth()}-${today.getFullYear()}`;
        if (localStorage.getItem('last_installment_check') !== currentMY) {
            for (const bill of bills) {
                if (bill.frequency === 'installment') {
                    const curr = parseInt(bill.paidInst);
                    const total = parseInt(bill.totalInst);
                    if (curr < total) {
                        await updateDoc(doc(db, "bills", bill.id), { paidInst: curr + 1 });
                    }
                }
            }
            localStorage.setItem('last_installment_check', currentMY);
            loadBillsFromFirebase();
        }
    };

    // --- 13. DREAMS & SHOPPING BOARD ---

    //"stringify" the image
    //  13.1 LOAD DREAMS BOARD
    async function loadDreamsFromFirebase() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const docSnap = await getDoc(doc(db, "dreams", `${user.uid}_dreams`));
        if (docSnap.exists()) {
            const data = docSnap.data();
            const placeholder = document.querySelector('.drop-placeholder');
            if (placeholder) placeholder.style.display = 'none';

            // Clear current images to avoid duplicates
            document.querySelectorAll('.dream-image').forEach(img => img.remove());

            data.imageUrls.forEach(base64 => {
                createDreamThumbnail(base64);
            });
        }
    } catch (error) {
        console.error("Load Dreams Error:", error);
    }
}
  

    // --- 14. UTILITIES (Clock, Palmeiras) ---
    //  14.1 PALMEIRAS FIXTURES LOGIC 
    async function loadPalmeirasFixtures() {
    const listElement = document.getElementById('fixtures-list');
    const countdownEl = document.getElementById("next-match-countdown");
    
    const url = "https://www.thesportsdb.com/api/v1/json/123/eventsnext.php?id=134465";
    

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!data.events || data.events.length === 0) {
            if (listElement) listElement.innerHTML = '<p>Nenhum jogo encontrado.</p>';
            return;
        }

        const user = auth.currentUser;
        
        if (user && user.email.toLowerCase() === ADMIN_CONFIG.email) {
            const todayStr = new Date().toISOString().split('T')[0]; 
            
            const isMatchToday = data.events.some(match => match.dateEvent === todayStr);

            if (isMatchToday) {
                triggerMatchDayMood();
            }
        }

        if (listElement) listElement.innerHTML = ''; 

        const now = new Date();
        // NEXT MATCH COUNTDOWN
        const futureMatches = data.events.map(match => ({
            name: match.strEvent,
            time: new Date(`${match.dateEvent}T${match.strTime || '00:00:00'}`),
            id: match.idEvent
        })).filter(m => m.time > now);

        if (futureMatches.length > 0) {
            nextMatchTime = futureMatches[0]; 
            //exact EH PARA O AVISA ANTES DE 1HORA DE JOGO
            exactMatchDate = futureMatches[0].time;
        }

        data.events.slice(0, 3).forEach(match => {
            const dateObj = new Date(match.dateEvent + 'T' + (match.strTime || '00:00:00'));
            const dateStr = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            const timeStr = match.strTime ? match.strTime.substring(0, 5) : "TBD";

            listElement.innerHTML += `
                <div class="match-card">
                    <div>
                        <strong style="display: block;">${match.strEvent}</strong>
                        <span style="font-size: 0.8em; color: #665;">${match.strLeague}</span>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-weight: bold; color: #006437;">${dateStr}</span><br>
                        <small>${timeStr}</small>
                    </div>
                </div>`;
        });

    } catch (error) {
        console.error("Palmeiras Fetch Error:", error);
    }
    }

    // 14.1.2 DIA DE JOGO HINO!
    function triggerMatchDayMood() {
    // Check if it's already playing to avoid overlapping audio
    if (!palmeirasAnthem.paused) return;

    palmeirasAnthem.volume = 0.2;
    palmeirasAnthem.loop = true;
    
    palmeirasAnthem.play().catch(err => {
        console.log("Autoplay blocked. Waiting for user interaction to play anthem.");
    });

    Toastify({
        text: "⚽ HOJE TEM PALMEIRAS! 🐷\n(Clique para parar o hino)",
        duration: -1, // Stays until you click the 'X'
        close: true,
        gravity: "top",
        position: "center",
        style: {
            background: "linear-gradient(to right, #006437, #004d2a)",
            color: "#ffffff",
            borderRadius: "15px",
            fontWeight: "bold",
            textAlign: "center"
        },
        callback: () => {
            
            palmeirasAnthem.pause();
            palmeirasAnthem.currentTime = 0;
        }
    }).showToast();
    }

    // 14.1.3 GIFS PORCO!
    const spawnPalmeirasCelebration = (count = 38) => {
    
    const palmeirasGifs = [
    "/gifs_palmeiras/pig1.gif",
    "/gifs_palmeiras/pig2.gif",
    "/gifs_palmeiras/pig3.gif",
    "/gifs_palmeiras/pig4.gif",
    "/gifs_palmeiras/pig5.gif",
    "/gifs_palmeiras/pig6.gif",
    "/gifs_palmeiras/pig7.gif",
    "/gifs_palmeiras/pig8.gif",
    "/gifs_palmeiras/pig9.gif",
    "/gifs_palmeiras/pig10.gif",
    "/gifs_palmeiras/pig11.gif",
    "/gifs_palmeiras/pig12.gif",
    "/gifs_palmeiras/pig13.gif",
    "/gifs_palmeiras/pig14.gif",
    "/gifs_palmeiras/pig15.gif",
    "/gifs_palmeiras/pig16.gif",
    "/gifs_palmeiras/pig17.gif",
    "/gifs_palmeiras/pig18.gif",
    "/gifs_palmeiras/pig19.gif",
    "/gifs_palmeiras/pig20.gif"
    ];

    for (let i = 0; i < count; i++) {
        const gif = document.createElement('img');
        const randomSource = palmeirasGifs[Math.floor(Math.random() * palmeirasGifs.length)];
        
        gif.src = randomSource;
        gif.className = 'stray-tenor-wrapper'; 
        
        // Random Position
        const x = Math.random() * (window.innerWidth - 150);
        const y = Math.random() * (window.innerHeight - 150);
        
        gif.style.left = `${x}px`;
        gif.style.top = `${y}px`;
        gif.style.width = "150px"; // Ensure size
        gif.style.position = "fixed";
        gif.style.zIndex = "9999";

        document.body.appendChild(gif);

        // Cleanup: Remove after 20 seconds
        setTimeout(() => {
            gif.style.transition = 'opacity 1s';
            gif.style.opacity = '0';
            setTimeout(() => gif.remove(), 1000);
        }, 20000);
    }
    };

    //14.1.4 ONE HOUR TOAST ANTES DO JOGO
    const checkOneHourToGame = () => {
    if (!auth.currentUser || auth.currentUser.email.toLowerCase() !== ADMIN_CONFIG.email) return;
    // Only run if we have a match loaded
    if (!nextMatchTime || oneHourAlertSent) return;

    if (!exactMatchDate || oneHourAlertSent) return;

    const now = new Date();
    //MILLISECONDS DIFFERENCE
    const timeDiff = nextMatchTime - now;
     
    // We check if the game is between 59 and 60 minutes away.
                                    //1hour
    if (timeDiff > 0 && timeDiff <= 3600000) {
        oneHourAlertSent = true; // Prevents duplicate toasts
        spawnPalmeirasCelebration(36);

        if (palmeirasAnthem) {
            palmeirasAnthem.currentTime = 0; // Start from the beginning
            palmeirasAnthem.volume = 0.2;  
            palmeirasAnthem.loop = true;
            palmeirasAnthem.play().catch(err => console.log("Audio waiting for click..."));
        }
        
        Toastify({
            text: "🔥 FALTA 1 HORA! O Verdão entra em campo logo mais! 🐷",
            duration: 180000, // Show for 10 seconds
            gravity: "top",
            position: "center",
            style: {
                background: "linear-gradient(to right, #006437, #1d9b5e)",
                color: "#ffffff",
                borderRadius: "15px",
                fontWeight: "bold",
                border: "2px solid #ffffff"
            },
            callback: () => {
                
                if (palmeirasAnthem) {
                    palmeirasAnthem.pause();
                    palmeirasAnthem.currentTime = 0;
                }
            }
        }).showToast();
        
        
    }
    };
    setInterval(checkOneHourToGame, 60000);


    // 14.2 UPDATE CLOCK 
    const updateClock = () => {
        const countdownEl = document.getElementById("next-match-countdown");
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        const hourEl = document.getElementById("hour");
        const minEl = document.getElementById("minutes");
        const secEl = document.getElementById("seconds");

        if (hourEl) hourEl.innerText = String(now.getHours()).padStart(2, '0');
        if (minEl) minEl.innerText = String(now.getMinutes()).padStart(2, '0');
        if (secEl) secEl.innerText = String(now.getSeconds()).padStart(2, '0');

        if (countdownEl && nextMatchTime) {
    const now = new Date();
    const diff = nextMatchTime.time - now;

    if (diff > 0) {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);

        countdownEl.innerHTML = `
            <div style="font-size: 0.7em; text-transform: uppercase; opacity: 0.8;">Jogo do Porco em...</div>
            <div style="font-size: 1.2rem; color: white; font-weight: bold;">
                🐷 ${hours}h ${mins}m ${secs}s
            </div>
        `;
        } else {
            countdownEl.innerHTML = "⚽ <strong style='color: #006437;'>JOGO EM ANDAMENTO!</strong>";
        }
    }
        setTimeout(updateClock, 1000);
    };

    setInterval(() => {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const savedMinute = localStorage.getItem("lastAlarm");

        if (currentTime !== lastTriggeredMinute && currentTime !== savedMinute) {
            
    // 14.3 CHECKBBOX DAILY MEDS 
            document.querySelectorAll("#daily-med-list li").forEach(li => {
                const isAlreadyTaken = li.classList.contains("completed"); // Check the UI state
                const t = li.querySelector(".med-time")?.textContent.replace(/[^\d:]/g, '').trim();
                
                // ONLY play if the time matches AND it hasn't been checked yet
                if (t === currentTime && !isAlreadyTaken) {
                    playAlarmSound(li.querySelector("strong").textContent, 'med');
                    lastTriggeredMinute = currentTime;
                    localStorage.setItem("lastAlarm", currentTime);
                }
            });

    // 14.4 CHECKBOX DAILY ALARMS ---
            document.querySelectorAll("#daily-alarm-list li").forEach(li => {
                const t = li.querySelector(".alarm-time")?.textContent.replace(/[^\d:]/g, '').trim();
                if (t === currentTime) {
                    playAlarmSound(li.querySelector("strong").textContent, 'daily');
                    lastTriggeredMinute = currentTime;
                    localStorage.setItem("lastAlarm", currentTime);
                }
            });
        }
    }, 1000); // Checks every 30 seconds

    
    // 14.5 TOASTY TOP ALARM 
    const playAlarmSound = (name, type) => {
    const sounds = {
        'med': 'med-alarm-sound',
        'daily': 'daily-alarm-sound',
        'kitchen-timer': 'kitchen-timer-sound'
    };

    const soundId = sounds[type] || 'daily-alarm-sound';
    const alarmAudio = document.getElementById(soundId); // Use alarmAudio consistently

    if (alarmAudio) {
        const sliderId = (type === 'med') ? 'med-volume-slider' : 'reminder-volume-slider';
        const slider = document.getElementById(sliderId);
        
        alarmAudio.volume = slider ? parseFloat(slider.value) : 0.8;
        alarmAudio.loop = true;
        alarmAudio.play().catch(e => console.error("Playback blocked:", e));
    }

    const colors = {
        'med': 'linear-gradient(to right, #00b09b, #96c93d)',
        'daily': 'linear-gradient(to right, #f9c74f, #f3722c)',
        'kitchen-timer': 'linear-gradient(to right, #4facfe, #00f2fe)'
    };

    Toastify({
        text: `⏰ ${type.toUpperCase()}: ${name}`,
        duration: -1, 
        close: true,
        gravity: "top",
        position: "center",
        style: { 
            background: colors[type] || colors['daily'],
            borderRadius: "12px",
            fontWeight: "bold"
        },
        
        callback: () => { 
            if (alarmAudio) { 
                alarmAudio.pause(); 
                alarmAudio.currentTime = 0; 
                console.log("Alarm stopped by user.");
            } 
        }
    }).showToast();
};

    // 15. --- MEDIA PLAYER ---
    
    // 15.1. SELECTING A TRACK (play & select)
    selectors.forEach(img => {
        img.addEventListener('click', () => {
            const soundId = img.dataset.sound;
            if (!soundId) return; // Prevent 404
            const clickedAudio = document.getElementById(`audio-${soundId}`);

            if (activeSelector === img && !clickedAudio.paused) {
                resetPlayer();
                return;
            }

            resetPlayer();
            img.classList.add('selected', 'playing');
            clickedAudio.volume = playerVolume.value;
            clickedAudio.play().catch(e => console.error("Audio failed", e));
            currentAudio = clickedAudio;
            activeSelector = img;
        });
    });

    if (playBtn) playBtn.addEventListener('click', () => { if (currentAudio) { currentAudio.play(); activeSelector.classList.add('playing'); } });
    if (pauseBtn) pauseBtn.addEventListener('click', () => { if (currentAudio) { currentAudio.pause(); activeSelector.classList.remove('playing'); } });
    if (stopBtn) stopBtn.addEventListener('click', resetPlayer);
    if (playerVolume) playerVolume.addEventListener('input', (e) => { if (currentAudio) currentAudio.volume = e.target.value; });

    
    
    // --- 16 KITCHEN TIMER ---
    let kitchenTimer;
    let totalSeconds = 0;
    let isKitchenRunning = false;

    // Elements
    const chickenIdle = document.getElementById('chicken-idle');
    const chickenCooking = document.getElementById('chicken-cooking');
    const chickenReady = document.getElementById('chicken-ready');
    const hrDisplay = document.getElementById('hourInput');
    const minDisplay = document.getElementById('minInput');
    const secDisplay = document.getElementById('secDisplay');
    const playTimerBtn = document.getElementById('playTimerBtn');
    const runningControls = document.getElementById('runningControls');
    const pauseTimerBtn = document.getElementById('pauseTimerBtn');
    const resetTimerBtn = document.getElementById('resetTimerBtn');
    const kitchenVolume = document.getElementById('kitchen-volume'); 

    
    const processSound = new Audio('./src/audio/alarm-kitchen.mp3');
    const finishSound = new Audio('./src/audio/alarm-food-ready.mp3');
    processSound.loop = true;

    // 16.1 UI
    function updateUI() {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        if (hrDisplay) hrDisplay.textContent = h.toString().padStart(2, '0');
        if (minDisplay) minDisplay.textContent = m.toString().padStart(2, '0');
        if (secDisplay) secDisplay.textContent = s.toString().padStart(2, '0');
    }

    // 16.2 ADD TIME
    function addTime(seconds) {
        if (isKitchenRunning) {
            Toastify({ 
                text: "Can't add time while cooking! 🍳", 
                gravity: "top", 
                position: "center", 
                duration: 3000, 
                style: { background: "#fe3564", borderRadius: "12px" } 
            }).showToast();
            return;
        }
        totalSeconds += seconds;
        updateUI();
    }

    // 16.3 START TIMER
    function startTimer() {
        const speech = document.getElementById('chicken-speech');
        if (speech) {
        speech.style.display = 'none';
        }

        if (totalSeconds <= 0) {
        
        Toastify({
            text: "Add some time first! 🐥",
            duration: 2000,
            gravity: "top", 
            position: "center",
            style: { background: "#fe3564", borderRadius: "12px"  }
        }).showToast();
        return; 
        }

        const timerSection = document.querySelector('.kitchen-timer');
        timerSection.classList.add('running');

        

        isKitchenRunning = true;
        
        // UI Swap
        playTimerBtn.style.display = 'none';
        runningControls.style.display = 'flex';

        // Visuals
        chickenIdle.style.display = 'none';
        chickenReady.style.display = 'none';
        chickenCooking.style.display = 'block';

        // Audio
        const vol = kitchenVolume ? kitchenVolume.value : 0.3;
        processSound.volume = vol;
        
        processSound.play();

        kitchenTimer = setInterval(() => {
            if (totalSeconds > 0) {
                totalSeconds--;
                updateUI();
            } else {
                finishTimer();
            }
        }, 1000);
    }

    //16.4 PAUSE TIMER
    function pauseTimer() {
        document.querySelector('.kitchen-timer').classList.remove('running');

        clearInterval(kitchenTimer);
        isKitchenRunning = false;

        processSound.pause();
        playTimerBtn.style.display = 'block';
        runningControls.style.display = 'none';

        const speech = document.getElementById('chicken-speech');
        if (speech) {
        // ONLY show the pause message if there is still time left.
        // If totalSeconds is 0, it means the timer finished naturally!
        if (totalSeconds > 0) {
            speech.innerText = "Mama needs a rest too! 🌽 TIMER IS PAUSED!!!";
            speech.style.display = 'block';
         }
        }
        
    }

    // 16.5 FINISH TIMER
    function finishTimer() {
    clearInterval(kitchenTimer);
    isKitchenRunning = false;
    processSound.pause();
    processSound.currentTime = 0;

    const timerSection = document.querySelector('.kitchen-timer');
    // 1. Swap classes: stop border chicks, start the reunion to mama
    timerSection.classList.remove('running');
    timerSection.classList.add('finished');

    // 2. Visual swap: Show Momma FIRST so createStrayChicks can find her position
    chickenCooking.style.display = 'none';
    chickenReady.style.display = 'block';

    const speech = document.getElementById('chicken-speech');
    if (speech) {
        speech.innerText = "Food is ready kids! 🐣";
        speech.style.display = 'block';
    }

    // 3. Audio
    finishSound.volume = kitchenVolume ? kitchenVolume.value : 0.5;
    finishSound.play();

    // 4. Trigger the babies from across the page
    createStrayChicks();

    // 5. THE RESET: Wait 5 seconds (enough for the 3s animation + 2s of sitting there)
    setTimeout(() => {
        Toastify({
            text: "🍳 Your food is ready! 😋",
            duration: -1, 
            close: true,
            gravity: "top",
            position: "center",
            stopOnFocus: true, 
            style: {
                background: "linear-gradient(to right, #ff5f6d, #ffc371)",
                color: "#ffffff",
                borderRadius: "15px",
                fontWeight: "bold",
                fontSize: "1.2rem",
                boxShadow: "0 4px 15px rgba(255, 95, 109, 0.4)"
            },
            callback: () => {
                finishSound.pause();
                finishSound.currentTime = 0;
            }
        }).showToast();
    }, 3500); 

    // 5. Auto-Reset Visuals (Wait a bit longer to clean up)
    setTimeout(() => {
        if (!isKitchenRunning) {
            chickenReady.style.display = 'none';
            chickenIdle.style.display = 'block';
            timerSection.classList.remove('finished');
            document.querySelectorAll('.stray-chick').forEach(el => el.remove());

            const speech = document.getElementById('chicken-speech');
            if (speech) {
                speech.style.display = 'none';
                speech.innerText = ""; // Clear the text
            }
        }
    }, 6000); 

    playTimerBtn.style.display = 'block';
    runningControls.style.display = 'none';
}

    // 16.6 RESET TIMER
    function resetTimer() {
        const timerSection = document.querySelector('.kitchen-timer');
        timerSection.classList.remove('running');
        timerSection.classList.remove('finished');

        clearInterval(kitchenTimer);
        isKitchenRunning = false;
        totalSeconds = 0;
        updateUI();

        processSound.pause();
        processSound.currentTime = 0;

        chickenCooking.style.display = 'none';
        chickenReady.style.display = 'none';
        chickenIdle.style.display = 'block';

        playTimerBtn.style.display = 'block';
        runningControls.style.display = 'none';

        const speech = document.getElementById('chicken-speech');
        if (speech) {
        speech.style.display = 'none';
        speech.innerText = ""; 
        }
    }

    // 16.7 STRAYS CHICKS
    function createStrayChicks() {
    const sheets = [
        'Chicken_Sprite_Sheet.png',
        'Chicken_Sprite_Sheet_Black.png',
        'Chicken_Sprite_Sheet_Dark_Brown.png',
        'Chicken_Sprite_Sheet_Light_Brown.png'
    ];

    const chickenImage = document.getElementById('chicken-ready');
    if (!chickenImage) return; 
    
    const rect = chickenImage.getBoundingClientRect();
    const targetX = rect.left + (rect.width / 2);
    const targetY = rect.top + (rect.height / 2); 

    for (let i = 0; i < 12; i++) {
        const stray = document.createElement('div');
        stray.className = 'chick stray-chick'; 
        
        const randomSheet = sheets[Math.floor(Math.random() * sheets.length)];
        stray.style.backgroundImage = `url('./src/img/${randomSheet}')`;
        stray.style.position = 'fixed';
        stray.style.zIndex = '9999'; 
        
        const side = Math.floor(Math.random() * 4);
        let startX, startY;

        if (side === 0) { startX = Math.random() * window.innerWidth; startY = -50; } 
        else if (side === 1) { startX = window.innerWidth + 50; startY = Math.random() * window.innerHeight; } 
        else if (side === 2) { startX = Math.random() * window.innerWidth; startY = window.innerHeight + 50; } 
        else { startX = -50; startY = Math.random() * window.innerHeight; } 

        stray.style.left = startX + 'px';
        stray.style.top = startY + 'px';

        // --- DIRECTION LOGIC ---
        // If startX is less than targetX, chick is moving RIGHT (facing right = scaleX(1))
        // If startX is greater than targetX, chick is moving LEFT (facing left = scaleX(-1))
        const isFacingLeft = startX > targetX;
        const flip = isFacingLeft ? 'scaleX(1)' : 'scaleX(-1)';

        document.body.appendChild(stray);

        // --- ANIMATION START ---
        stray.animate([
            { 
                left: startX + 'px', 
                top: startY + 'px', 
                // Combine the scale (size) and the flip (direction)
                transform: `scale(1.2) ${flip}` 
            },
            { 
                left: targetX + 'px', 
                top: targetY + 'px', 
                transform: `scale(0.3) ${flip}`, 
                opacity: 0 
            }
        ], {
            duration: 2500 + (Math.random() * 1500), 
            easing: 'ease-out'
        }).onfinish = () => stray.remove(); 
    }
}
    

    // 17 --- Listeners ---
    if (playTimerBtn) playTimerBtn.addEventListener('click', startTimer);
    if (pauseTimerBtn) pauseTimerBtn.addEventListener('click', pauseTimer);
    if (resetTimerBtn) resetTimerBtn.addEventListener('click', resetTimer);

    const add30s = document.getElementById('add-30sec');
    if (add30s) add30s.onclick = () => addTime(30);

    const add1 = document.getElementById('add-1min');
    if (add1) add1.onclick = () => addTime(60);

    const add5 = document.getElementById('add-5min');
    if (add5) add5.onclick = () => addTime(300);

    const add30 = document.getElementById('add-30min');
    if (add30) add30.onclick = () => addTime(1800);

    if (kitchenVolume) {
        kitchenVolume.addEventListener('input', (e) => {
            const v = e.target.value;
            processSound.volume = v;
            finishSound.volume = v;
        });
    }

        // Med Alarm Slider -> Med Sound
    document.getElementById('med-volume-slider')?.addEventListener('input', (e) => {
        const audio = document.getElementById('med-alarm-sound');
        if (audio) {
        // Value is 0.1 to 1, no division needed
        audio.volume = parseFloat(e.target.value);
    }
        
    });

    // Reminder Alarm Slider -> Daily Alarm Sound
    document.getElementById('reminder-volume-slider')?.addEventListener('input', (e) => {
        const audio = document.getElementById('daily-alarm-sound');
        if (audio) {
        audio.volume = parseFloat(e.target.value);
    }
        
    });

    // Relax Player Slider -> Background Music
    if (playerVolume) {
        playerVolume.addEventListener('input', (e) => {
            if (currentAudio) currentAudio.volume = e.target.value;
        });
    }


    //DESABILITANDO O RIGHT CLICK NAS IMAGENS -> TEM UM LADO PRO Q EH COLOCAR UM GHOST LAYER
    //O GHOST EH UMA DIV TRASNPARENTE 
    document.addEventListener('contextmenu', function(e) {
    if (e.target.tagName === 'IMG') {
        e.preventDefault();
    }
    }, false);



    // 18. --- Initialize ---
    updateClock();
    initVolumes();


    addTaskBtn.addEventListener("click", (e) => { e.preventDefault(); addTask(); });

    // Category Button Selection logic
    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
    });

    // 12. Page Transition handling
    document.querySelectorAll('a[href$=".html"]').forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const container = document.querySelector('.container') || document.querySelector('.med-container');
            if (container) container.classList.add("page-exit");
            setTimeout(() => { window.location.href = link.href; }, 300);
        });
    });
});

// --- DREAM THUMBNAIL
    function createDreamThumbnail(src) {
    if (!dropZone) return;
    
    const img = document.createElement('img');
    img.src = src;
    img.className = 'dream-image';
    
    const randomTilt = Math.floor(Math.random() * 16 - 8) + 'deg';
    img.style.setProperty('--twist', randomTilt);
    
    img.onclick = () => {
        if(confirm("Achieved this dream? (Remove it)")) {
            img.remove();
            saveDreamsToFirebase(); 
        }
    };
    
    dropZone.appendChild(img);
    }

    /// --- async SAVE DREAMS BOARD TO DATABASE ---
    async function saveDreamsToFirebase() {
    const user = auth.currentUser;
    if (!user) return;

    const allImages = document.querySelectorAll('.dream-image');
    const imageStrings = Array.from(allImages).map(img => img.src);

    try {
        // This uses 'db' from your config - No more "Params not set"
        await setDoc(doc(db, "dreams", `${user.uid}_dreams`), {
            imageUrls: imageStrings,
            userId: user.uid,
            last_updated: serverTimestamp()
        });
        console.log("Dreams synced! ☁️");
    } catch (error) {
        console.error("Dream Sync Error:", error);
    }
}

// LOAD DREAM BOARD FROM DATABASE (Run this when page opens)
    async function loadDreamsFromFirebase() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const docRef = doc(db, "dreams", `${user.uid}_dreams`);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            const placeholder = document.querySelector('.drop-placeholder');
            if (placeholder) placeholder.style.display = 'none';

            // Clear current images
            document.querySelectorAll('.dream-image').forEach(img => img.remove());

            data.imageUrls.forEach(base64 => {
                createDreamThumbnail(base64);
            });
        }
    } catch (error) {
        console.error("Load Dreams Error:", error);
    }
}

// 4. DREAM BOARD ->>> Image Resizer (To stay under 1MB limit)
function resizeImage(base64Str, maxWidth = 400) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ratio = maxWidth / img.width;
            canvas.width = maxWidth;
            canvas.height = img.height * ratio;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
    });
}



document.getElementById('bill-frequency').addEventListener('change', (e) => {
    const config = document.getElementById('inst-config');
    config.style.display = e.target.value === 'installment' ? 'flex' : 'none';
});

window.addEventListener("dragover", function(e) {
    e.preventDefault();
}, false);

window.addEventListener("drop", function(e) {
    e.preventDefault();
}, false);
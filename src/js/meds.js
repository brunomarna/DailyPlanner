import { db, auth } from './firebase-config.js';
import { 
    collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
    const medsInput = document.getElementById("input-meds");
    const addMedsBtn = document.getElementById("add-meds-btn");
    const medsList = document.getElementById("task-list-meds");
    const emptyImag = document.querySelector(".empty-imag");

    //SELECT PRA ESCOLHER SE EH DAILY OU NAO
    const medTypeSelect = document.getElementById("med-type");

     // Procura qualquer link pra chamar a acao de transicao
        const transitionLinks = document.querySelectorAll('a[href$=".html"]');

        transitionLinks.forEach(link => {
            link.addEventListener("click", (e) => {
                e.preventDefault(); // Stop the immediate jump
                const targetUrl = link.href;

                // Add the exit animation class to the body
                document.body.classList.add("page-exit");

                // Wait for the animation to finish (300ms matches the CSS)
                setTimeout(() => {
                    window.location.href = targetUrl;
                }, 300);
            });
        });



    // --- FIREBASE SYNC FUNCTIONS ---
    const saveMedToFirebase = async (name, months, type) => {
        const user = auth.currentUser;
        if (!user) return;
        try {
            await addDoc(collection(db, "med_cabinet"), {
                name: name,
                months_supply: months,
                type: type, // 'daily' or 'nondaily'
                userId: user.uid,
                createdAt: serverTimestamp()
            });
        } catch (e) { console.error("Error saving:", e); }
    };

    const updateMonthsInFirebase = async (name, newValue) => {
        const user = auth.currentUser;
        if (!user) return;
        const q = query(collection(db, "med_cabinet"), where("name", "==", name), where("userId", "==", user.uid));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(async (taskDoc) => {
            await updateDoc(doc(db, "med_cabinet", taskDoc.id), {
                months_supply: newValue
            });
        });
    };

    const deleteMedFromFirebase = async (name) => {
        const user = auth.currentUser;
        if (!user) return;
        const q = query(collection(db, "med_cabinet"), where("name", "==", name), where("userId", "==", user.uid));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(async (taskDoc) => {
            await deleteDoc(doc(db, "med_cabinet", taskDoc.id));
        });
    };

    const loadCabinet = async () => {
    const user = auth.currentUser;
    if (!user) return;

    // Ensure this query also uses the UID filter
    const q = query(
        collection(db, "med_cabinet"), 
        where("userId", "==", user.uid), 
        orderBy("createdAt", "asc")
    );

    const querySnapshot = await getDocs(q);
    medsList.innerHTML = ""; 
    
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        addMedsUI(data.name, data.months_supply, false, data.type);
    });
    toggleEmptyState();
};

    // --- UI LOGIC ---

    const toggleEmptyState = () => {
        if (emptyImag) {
            emptyImag.style.display = medsList.children.length === 0 ? "block" : "none";
        }
    };

    const addMedsUI = (text, months = 0, saveToDB = true, type = null) => {
        const medsText = text || (medsInput ? medsInput.value.trim() : "");
        if (!medsText) return;

        const medType = type || (medTypeSelect ? medTypeSelect.value : "nondaily");

        const li = document.createElement("li");
        li.classList.add("med-item");
        let counterValue = months;
        const displayValue = (val) => val < 10 ? "0" + val : val;

        const typeBadge = medType === 'daily' ? '💊' : '📦';

        li.innerHTML = `
            <div class="med-info">
                <small class="type-badge">${typeBadge}</small>
                <strong class="med-name">${medsText}</strong>
            </div>
            <div class="med-controls">
                <span class="minus">-</span>
                <span class="counter">${displayValue(counterValue)}</span>
                <span class="plus">+</span>
                <a> months</a>
            </div>
            <div class="task-buttons">
                <button class="delete-btn"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;

        const medsCounter = li.querySelector(".counter");
        const nameLabel = li.querySelector(".med-name");

        //QUANDO O REMEDIO CHEGAR A 0 ELE RISCA O NOME
        const updateVisuals = (val) => {
        // Safety check: only run if nameLabel actually exists
        if (!nameLabel) return; 

        if (val === 0) {
            li.classList.add("out-of-stock");
            nameLabel.style.textDecoration = "line-through";
            nameLabel.style.opacity = "0.5";
        } else {
            li.classList.remove("out-of-stock");
            nameLabel.style.textDecoration = "none";
            nameLabel.style.opacity = "1";
        }
     };

        updateVisuals(counterValue);

        li.querySelector(".plus").addEventListener("click", () => {
            counterValue++;
            medsCounter.textContent = displayValue(counterValue);
            updateMonthsInFirebase(medsText, counterValue);
        });

        li.querySelector(".minus").addEventListener("click", () => {
            if (counterValue > 0) {
                counterValue--;
                medsCounter.textContent = displayValue(counterValue);
                updateMonthsInFirebase(medsText, counterValue);
            }
        });

        li.querySelector(".delete-btn").addEventListener("click", () => {
            li.remove();
            deleteMedFromFirebase(medsText);
            toggleEmptyState();
        });

        medsList.appendChild(li);
        if (saveToDB) saveMedToFirebase(medsText, counterValue, medType);
        
        if (medsInput) medsInput.value = "";
        toggleEmptyState();
    };

    // --- INITIALIZATION ---

    onAuthStateChanged(auth, (user) => {
        if (user) {
            loadCabinet();
        }
    });

    addMedsBtn.addEventListener("click", (e) => {
        e.preventDefault();
        addMedsUI();
    });
});
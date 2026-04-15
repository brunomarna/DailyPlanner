import { auth } from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut,
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- 1. THE BOUNCER & REDIRECT CHECK ---
// auth.js - THE LOGIN BOUNCER

onAuthStateChanged(auth, (user) => {
    const urlParams = new URLSearchParams(window.location.search);
    const isLoggingOut = urlParams.get('logout');
    const errorReason = urlParams.get('error');

    // NEW: Show toast if kicked out from Dashboard
    if (errorReason === 'session_expired') {
        Toastify({
            text: "⚠️ Session expired. Please log in again.",
            duration: 4000,
            gravity: "top",
            position: "center",
            style: { 
                background: "linear-gradient(to right, #ff5f6d, #ffc371)", 
                borderRadius: "12px",
                fontWeight: "bold" 
            }
        }).showToast();
        // Clean URL so the toast doesn't keep popping on refresh
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (user && !isLoggingOut) {
        console.log("Bouncer: User detected, moving to Dashboard...");
        window.location.assign('index.html'); 
    }
});

// --- 2. SELECTORS ---
const authForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const authBtn = document.getElementById('auth-btn');
const authTitle = document.getElementById('auth-title');
const toggleBtn = document.getElementById('toggle-auth');
const togglePassword = document.getElementById('togglePassword');
const forgotLink = document.getElementById('forgot-password');

// --- 3. INITIAL STATE ---
let isLogin = true;

// --- 4. PASSWORD VISIBILITY ---
if (togglePassword && passwordInput) {
    togglePassword.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        togglePassword.classList.toggle('fa-eye-slash');
        togglePassword.classList.toggle('fa-eye');
    });
}

// --- 5. TOGGLE UI (Login vs Sign Up) ---
if (toggleBtn && authTitle && authBtn) {
    toggleBtn.addEventListener('click', () => {
        isLogin = !isLogin; 
        authTitle.innerText = isLogin ? "Welcome Home 🏠" : "Join the Family 👪";
        const btnText = authBtn.querySelector('.btn-text');
        if (btnText) btnText.innerText = isLogin ? "Enter Room" : "Create Account";
        toggleBtn.innerText = isLogin ? "Sign Up" : "Login";
        if (forgotLink) forgotLink.style.display = isLogin ? "block" : "none";
    });
}

// --- 6. FORGOT PASSWORD ---
if (forgotLink) {
    forgotLink.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();
        if (!email) {
            Toastify({ text: "📧 Enter email first!", duration: 3000, style: { background: "#ffc371" } }).showToast();
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            Toastify({ text: "Reset link sent! Check your inbox 📬", duration: 5000, style: { background: "#00b09b" } }).showToast();
        } catch (error) { 
            Toastify({ text: "Error: " + error.message, duration: 4000, style: { background: "#ff5f6d" } }).showToast();
        }
    });
}

// --- 7. THE ACTION ---
if (authForm) {
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rememberMe = document.getElementById('remember-me')?.checked || false;

        authBtn.classList.add('btn-loading');
        authBtn.disabled = true;

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        try {
            const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
            await setPersistence(auth, persistence);

            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
            
            window.location.assign('index.html');

        } catch (error) {
            authBtn.classList.remove('btn-loading');
            authBtn.disabled = false;
            
            console.error("Auth Error Code:", error.code);
            // --- FRIENDLY ERROR HANDLING ---
            let friendlyMessage = "An unexpected error occurred. Please try again.";

            switch (error.code) {
                case 'auth/email-already-in-use':
                    friendlyMessage = "🚫 This email is already registered. Try logging in!";
                    break;
                case 'auth/invalid-email':
                    friendlyMessage = "📧 That email address doesn't look right.";
                    break;
                case 'auth/weak-password':
                    friendlyMessage = "🔒 Password is too weak. Try at least 6 characters.";
                    break;
                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                    friendlyMessage = "🔑 Incorrect email or password.";
                    break;
                case 'auth/user-not-found':
                    friendlyMessage = "🔍 No account found with this email.";
                    break;
                case 'auth/too-many-requests':
                    friendlyMessage = "⏳ Too many attempts. Please try again later.";
                    break;
                default:
                    friendlyMessage = error.message; // Fallback to the default Firebase message
            }

            Toastify({
                text: friendlyMessage,
                duration: 5000,
                gravity: "top",
                position: "center",
                close: true,
                style: { 
                    background: "linear-gradient(to right, #ff5f6d, #ff3b4d)", 
                    borderRadius: "12px",
                    fontWeight: "bold",
                    boxShadow: "0 4px 15px rgba(255, 95, 109, 0.3)"
                }
            }).showToast();
        }
    });
}

// Firebase client setup. Replace with your project config.
const firebaseConfig = {
  apiKey: "AIzaSyCD4KrJMN8o8rxAqAf6qOmMYaLTpgsW2Tg",
  authDomain: "dashboard-project-173a5.firebaseapp.com",
  projectId: "dashboard-project-173a5",
  storageBucket: "dashboard-project-173a5.firebasestorage.app",
  messagingSenderId: "9790859100",
  appId: "1:9790859100:web:accabbd8cddc3d7b0e0399",
};

let firebaseApp = null;

function initFirebase() {
  if (!window.firebase || !window.firebase.initializeApp) return null;
  if (!firebaseApp) {
    firebaseApp = window.firebase.initializeApp(firebaseConfig);
  }
  return firebaseApp;
}

window.initFirebase = initFirebase;

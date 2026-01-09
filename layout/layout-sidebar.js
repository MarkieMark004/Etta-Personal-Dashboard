function renderSidebar(activePage) {
  const mount = document.getElementById("sidebarMount");
  if (!mount) return;

  const isCalendar = activePage === "calendar";
  const isNotebook = activePage === "notebook";

  const dashboardHref = isCalendar || isNotebook ? "../index.html" : "index.html";
  const calendarHref = isCalendar || isNotebook ? "../html/calendar.html" : "html/calendar.html";
  const notebookHref = isCalendar || isNotebook ? "../html/notebook.html" : "html/notebook.html";

  mount.innerHTML = `
    <div class="profile">
      <div class="avatar-wrap">
        <img class="avatar" src="${isCalendar || isNotebook ? "../Images/profile.jpg" : "Images/profile.jpg"}" alt="Profile picture" />
      </div>
      <div class="welcome">
        <div class="welcome-title">Welcome Markie!</div>
      </div>
    </div>

    <button
      class="sidebar-toggle"
      type="button"
      aria-expanded="false"
      aria-controls="sidebarNav"
    >
      <span>Menu</span>
      <span class="toggle-ico" aria-hidden="true"></span>
    </button>

    <div class="nav-title">Navigation</div>

    <nav class="nav" id="sidebarNav">
      <a class="nav-link" href="${dashboardHref}" data-page="dashboard">
        <span class="nav-ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" class="nav-ico-svg">
            <path
              d="M8 3h8v2h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2V3zm2 2h4V4h-4v1z"
              fill="currentColor"
            />
          </svg>
        </span>
        <span>Dashboard</span>
      </a>

      <a class="nav-link" href="${calendarHref}" data-page="calendar">
        <span class="nav-ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" class="nav-ico-svg">
            <path
              d="M7 2v2H5a2 2 0 0 0-2 2v2h18V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zM3 10v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V10zm4 3h3v3H7zm4 0h3v3h-3zm4 0h3v3h-3z"
              fill="currentColor"
            />
          </svg>
        </span>
        <span>Calendar</span>
      </a>

      <a class="nav-link" href="${notebookHref}" data-page="notebook">
        <span class="nav-ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" class="nav-ico-svg">
            <path
              d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2 4h7v2H8zm0 4h7v2H8zm0 4h5v2H8z"
              fill="currentColor"
            />
          </svg>
        </span>
        <span>Notebook</span>
      </a>

      <button class="nav-link nav-signout" type="button">
        <span class="nav-ico" aria-hidden="true">⎋</span>
        <span>Sign out</span>
      </button>
    </nav>

    <div class="sidebar-footer">
      <button class="btn subtle signout-btn" id="sidebarSignOut" type="button">
        Sign out
      </button>
    </div>
  `;

  const links = mount.querySelectorAll(".nav-link");
  links.forEach((link) => {
    link.classList.toggle("active", link.dataset.page === activePage);
  });

  const signOutHandler = async () => {
    try {
      if (window.initFirebase && window.firebase?.auth) {
        window.initFirebase();
        await window.firebase.auth().signOut();
      }
      sessionStorage.removeItem("etta-auth");
    } finally {
      const loginHref = isCalendar || isNotebook ? "../login.html" : "login.html";
      window.location.href = loginHref;
    }
  };

  const signOutBtn = mount.querySelector("#sidebarSignOut");
  if (signOutBtn) {
    signOutBtn.addEventListener("click", signOutHandler);
  }

  const signOutNav = mount.querySelector(".nav-signout");
  if (signOutNav) {
    signOutNav.addEventListener("click", signOutHandler);
  }
}

window.renderSidebar = renderSidebar;

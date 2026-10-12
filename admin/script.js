
const loginView = document.getElementById("login-view");
const dashboardView = document.getElementById("dashboard-view");
const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");
const projectForm = document.getElementById("project-form");
const projectStatus = document.getElementById("project-status");
const projectList = document.getElementById("project-list");

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });

  const result = await response.json();

  if (!response.ok) {
    if (response.status === 401 && url !== "/api/admin/login") {
      showLogin();
    }
    throw new Error(result.message || "Terjadi kesalahan.");
  }

  return result;
}

function showLogin() {
  loginView.hidden = false;
  dashboardView.hidden = true;
}

function showDashboard(username) {
  loginView.hidden = true;
  dashboardView.hidden = false;
  document.getElementById("admin-name").textContent = username;
  loadProjects();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector('button[type="submit"]');
  button.disabled = true;
  loginStatus.textContent = "Memeriksa login...";

  try {
    const result = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({
        username: document.getElementById("username").value,
        password: document.getElementById("password").value
      })
    });

    loginForm.reset();
    loginStatus.textContent = "";
    showDashboard(result.username);
  } catch (error) {
    loginStatus.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

document.getElementById("logout-button").addEventListener("click", async () => {
  try {
    await api("/api/admin/logout", { method: "POST" });
    showLogin();
    loginStatus.textContent = "Lu sudah logout.";
  } catch (error) {
    alert(error.message);
  }
});

async function loadProjects() {
  projectList.replaceChildren();

  try {
    const result = await api("/api/projects");
    document.getElementById("project-count").textContent = result.total;

    if (!result.data.length) {
      projectList.textContent = "Belum ada project. Tambahkan project pertama lu!";
      return;
    }

    result.data.forEach((project) => {
      const item = document.createElement("article");
      item.className = "project-item";

      const title = document.createElement("h3");
      title.textContent = project.title;

      const description = document.createElement("p");
      description.textContent = project.description;

      const tech = document.createElement("p");
      tech.className = "muted";
      tech.textContent = project.technologies || "Teknologi belum diisi";

      item.append(title, description, tech);

      if (project.project_url) {
        const link = document.createElement("a");
        link.href = project.project_url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Buka project ↗";
        item.append(link);
      }

      const actions = document.createElement("div");
      actions.className = "project-actions";

      const editButton = document.createElement("button");
      editButton.textContent = "Edit";
      editButton.addEventListener("click", () => editProject(project));

      const deleteButton = document.createElement("button");
      deleteButton.textContent = "Hapus";
      deleteButton.className = "delete-button";
      deleteButton.addEventListener("click", () => deleteProject(project.id));

      actions.append(editButton, deleteButton);
      item.append(actions);
      projectList.append(item);
    });
  } catch (error) {
    projectStatus.textContent = error.message;
  }
}

function editProject(project) {
  document.getElementById("project-id").value = project.id;
  document.getElementById("title").value = project.title;
  document.getElementById("description").value = project.description;
  document.getElementById("technologies").value = project.technologies || "";
  document.getElementById("project-url").value = project.project_url || "";

  document.getElementById("form-heading").textContent = "Edit Project";
  document.getElementById("save-button").textContent = "Simpan Perubahan";
  document.getElementById("cancel-button").hidden = false;
  projectForm.scrollIntoView({ behavior: "smooth" });
}

function resetProjectForm() {
  projectForm.reset();
  document.getElementById("project-id").value = "";
  document.getElementById("form-heading").textContent = "Tambah Project";
  document.getElementById("save-button").textContent = "Simpan Project";
  document.getElementById("cancel-button").hidden = true;
}

document.getElementById("cancel-button").addEventListener("click", resetProjectForm);

projectForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const id = document.getElementById("project-id").value;
  const button = document.getElementById("save-button");
  button.disabled = true;
  projectStatus.textContent = "Menyimpan project...";

  const payload = {
    title: document.getElementById("title").value,
    description: document.getElementById("description").value,
    technologies: document.getElementById("technologies").value,
    project_url: document.getElementById("project-url").value
  };

  try {
    const result = await api(
      id ? `/api/admin/projects/${id}` : "/api/admin/projects",
      {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payload)
      }
    );

    projectStatus.textContent = result.message;
    resetProjectForm();
    await loadProjects();
  } catch (error) {
    projectStatus.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

async function deleteProject(id) {
  if (!confirm("Yakin mau menghapus project ini?")) return;

  try {
    const result = await api(`/api/admin/projects/${id}`, {
      method: "DELETE"
    });

    projectStatus.textContent = result.message;
    await loadProjects();
  } catch (error) {
    projectStatus.textContent = error.message;
  }
}

async function checkLogin() {
  try {
    const result = await api("/api/admin/me");
    showDashboard(result.username);
  } catch {
    showLogin();
  }
}

checkLogin();

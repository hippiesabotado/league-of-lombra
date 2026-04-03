const LOCAL_PLAYERS_KEY = "league-of-lombra-local-players-v1";

const state = {
  buildMode: "random",
  format: 5,
  players: [],
  matches: [],
  selectedPlayerIds: new Set(),
  leftTeam: [],
  rightTeam: [],
  winnerSide: null,
  adminOpen: false,
  searchTerm: ""
};

const els = {
  matchFormat: document.getElementById("matchFormat"),
  buildModeGroup: document.getElementById("buildModeGroup"),
  playerSearch: document.getElementById("playerSearch"),
  newPlayerBtn: document.getElementById("newPlayerBtn"),
  playersList: document.getElementById("playersList"),
  playersEmptyState: document.getElementById("playersEmptyState"),
  leftTeamList: document.getElementById("leftTeamList"),
  rightTeamList: document.getElementById("rightTeamList"),
  leftTeamName: document.getElementById("leftTeamName"),
  rightTeamName: document.getElementById("rightTeamName"),
  leftWinBtn: document.getElementById("leftWinBtn"),
  rightWinBtn: document.getElementById("rightWinBtn"),
  winnerPreview: document.getElementById("winnerPreview"),
  generateTeamsBtn: document.getElementById("generateTeamsBtn"),
  resetTeamsBtn: document.getElementById("resetTeamsBtn"),
  historyList: document.getElementById("historyList"),
  adminToggleBtn: document.getElementById("adminToggleBtn"),
  adminPanel: document.getElementById("adminPanel"),
  playerModal: document.getElementById("playerModal"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  cancelModalBtn: document.getElementById("cancelModalBtn"),
  savePlayerBtn: document.getElementById("savePlayerBtn"),
  playerLolName: document.getElementById("playerLolName"),
  playerNickname: document.getElementById("playerNickname")
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();
  await loadData();
  updateModeUI();
  renderPlayers();
  renderTeams();
  renderHistory();
  updateWinnerPreview();
}

function bindEvents() {
  els.matchFormat.addEventListener("change", () => {
    state.format = Number(els.matchFormat.value);
    clearCurrentMatch();
    renderPlayers();
    renderTeams();
  });

  els.buildModeGroup.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-mode]");
    if (!btn) return;

    state.buildMode = btn.dataset.mode;
    state.selectedPlayerIds.clear();
    clearCurrentMatch();
    updateModeUI();
    renderPlayers();
    renderTeams();
  });

  els.playerSearch.addEventListener("input", () => {
    state.searchTerm = els.playerSearch.value.trim().toLowerCase();
    renderPlayers();
  });

  els.newPlayerBtn.addEventListener("click", openPlayerModal);
  els.closeModalBtn.addEventListener("click", closePlayerModal);
  els.cancelModalBtn.addEventListener("click", closePlayerModal);

  els.playerModal.addEventListener("click", (event) => {
    if (event.target.dataset.closeModal === "true") {
      closePlayerModal();
    }
  });

  els.savePlayerBtn.addEventListener("click", saveNewPlayer);

  els.generateTeamsBtn.addEventListener("click", () => {
    if (state.buildMode === "random") {
      generateRandomTeams();
    } else {
      validateManualTeams();
    }
  });

  els.resetTeamsBtn.addEventListener("click", () => {
    clearCurrentMatch();
    renderPlayers();
    renderTeams();
  });

  els.leftWinBtn.addEventListener("click", () => {
    state.winnerSide = "left";
    updateWinnerPreview();
    updateWinnerButtons();
  });

  els.rightWinBtn.addEventListener("click", () => {
    state.winnerSide = "right";
    updateWinnerPreview();
    updateWinnerButtons();
  });

  els.leftTeamName.addEventListener("input", () => {
    updateWinnerPreview();
  });

  els.rightTeamName.addEventListener("input", () => {
    updateWinnerPreview();
  });

  els.adminToggleBtn.addEventListener("click", () => {
    state.adminOpen = !state.adminOpen;
    els.adminPanel.classList.toggle("hidden", !state.adminOpen);
    els.adminToggleBtn.textContent = state.adminOpen ? "Fechar" : "Entrar";
  });
}

async function loadData() {
  const [repoPlayers, repoMatches] = await Promise.all([
    loadJson("data/players.json", []),
    loadJson("data/matches.json", [])
  ]);

  const localPlayers = loadLocalPlayers();

  state.players = mergePlayers(repoPlayers, localPlayers);
  state.matches = Array.isArray(repoMatches) ? repoMatches : [];
}

async function loadJson(path, fallback) {
  try {
    const response = await fetch(`${path}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Falha ao carregar ${path}`);
    }
    return await response.json();
  } catch (error) {
    console.warn(error);
    return fallback;
  }
}

function loadLocalPlayers() {
  try {
    const raw = localStorage.getItem(LOCAL_PLAYERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Não foi possível ler players locais.", error);
    return [];
  }
}

function persistLocalPlayers() {
  const localPlayers = state.players.filter((player) => player.source === "local");
  localStorage.setItem(LOCAL_PLAYERS_KEY, JSON.stringify(localPlayers));
}

function mergePlayers(repoPlayers, localPlayers) {
  const mergedMap = new Map();

  [...repoPlayers, ...localPlayers].forEach((player, index) => {
    const normalized = normalizePlayer(player, index);
    const key = getPlayerIdentityKey(normalized);

    if (!mergedMap.has(key)) {
      mergedMap.set(key, normalized);
    }
  });

  return [...mergedMap.values()];
}

function normalizePlayer(player, index) {
  const lolName =
    player?.lolName ||
    player?.name ||
    player?.nick ||
    player?.summoner ||
    `Player ${index + 1}`;

  const nickname =
    player?.nickname ||
    player?.vulgo ||
    player?.alias ||
    "";

  return {
    id: player?.id || createPlayerId(lolName, nickname),
    lolName: String(lolName).trim(),
    nickname: String(nickname || "").trim(),
    source: player?.source || "repo"
  };
}

function createPlayerId(lolName, nickname) {
  const base = `${lolName}-${nickname}`.trim().toLowerCase();
  return `player-${base.replace(/[^a-z0-9]+/g, "-")}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function getPlayerIdentityKey(player) {
  return `${player.lolName}`.trim().toLowerCase() + "::" + `${player.nickname || ""}`.trim().toLowerCase();
}

function updateModeUI() {
  const buttons = [...els.buildModeGroup.querySelectorAll("[data-mode]")];
  buttons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.buildMode);
  });

  els.generateTeamsBtn.textContent =
    state.buildMode === "random" ? "Sortear times" : "Validar confronto";
}

function renderPlayers() {
  const filteredPlayers = state.players.filter((player) => {
    const text = `${player.lolName} ${player.nickname}`.toLowerCase();
    return text.includes(state.searchTerm);
  });

  els.playersList.innerHTML = "";

  if (filteredPlayers.length === 0) {
    els.playersEmptyState.classList.remove("hidden");
    return;
  }

  els.playersEmptyState.classList.add("hidden");

  filteredPlayers.forEach((player) => {
    const chip = document.createElement("article");
    chip.className = "player-chip";

    const alreadyInLeft = state.leftTeam.some((item) => item.id === player.id);
    const alreadyInRight = state.rightTeam.some((item) => item.id === player.id);
    const currentSide = alreadyInLeft ? "left" : alreadyInRight ? "right" : null;

    if (state.buildMode === "random") {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = state.selectedPlayerIds.has(player.id);

      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          state.selectedPlayerIds.add(player.id);
        } else {
          state.selectedPlayerIds.delete(player.id);
        }
      });

      chip.appendChild(checkbox);
    } else {
      const modeWrap = document.createElement("div");
      modeWrap.style.display = "flex";
      modeWrap.style.flexDirection = "column";
      modeWrap.style.gap = "8px";
      modeWrap.style.minWidth = "110px";

      const leftBtn = document.createElement("button");
      leftBtn.type = "button";
      leftBtn.className = "secondary-button";
      leftBtn.textContent = "← Esquerda";
      leftBtn.style.padding = "8px 10px";
      leftBtn.style.fontSize = "0.85rem";

      const rightBtn = document.createElement("button");
      rightBtn.type = "button";
      rightBtn.className = "secondary-button";
      rightBtn.textContent = "Direita →";
      rightBtn.style.padding = "8px 10px";
      rightBtn.style.fontSize = "0.85rem";

      leftBtn.addEventListener("click", () => {
        assignPlayerToTeam(player.id, "left");
      });

      rightBtn.addEventListener("click", () => {
        assignPlayerToTeam(player.id, "right");
      });

      if (currentSide === "left") {
        leftBtn.style.borderColor = "rgba(120, 194, 146, 0.36)";
      }

      if (currentSide === "right") {
        rightBtn.style.borderColor = "rgba(120, 194, 146, 0.36)";
      }

      modeWrap.appendChild(leftBtn);
      modeWrap.appendChild(rightBtn);
      chip.appendChild(modeWrap);
    }

    const textWrap = document.createElement("div");
    textWrap.className = "player-text";

    const nameEl = document.createElement("div");
    nameEl.className = "player-name";
    nameEl.textContent = player.lolName;

    const nicknameEl = document.createElement("div");
    nicknameEl.className = "player-nickname";
    nicknameEl.textContent = player.nickname ? `vulgo: ${player.nickname}` : "vulgo: —";

    textWrap.appendChild(nameEl);
    textWrap.appendChild(nicknameEl);

    if (state.buildMode === "manual" && currentSide) {
      const statusEl = document.createElement("div");
      statusEl.className = "player-nickname";
      statusEl.textContent = currentSide === "left" ? "no time esquerdo" : "no time direito";
      statusEl.style.color = "#78c292";
      textWrap.appendChild(statusEl);
    }

    chip.appendChild(textWrap);
    els.playersList.appendChild(chip);
  });
}

function assignPlayerToTeam(playerId, side) {
  const player = state.players.find((item) => item.id === playerId);
  if (!player) return;

  const leftHasPlayer = state.leftTeam.some((item) => item.id === playerId);
  const rightHasPlayer = state.rightTeam.some((item) => item.id === playerId);

  if (side === "left") {
    if (!leftHasPlayer && state.leftTeam.length >= state.format) {
      alert(`O time esquerdo já chegou no limite do formato ${state.format}x${state.format}.`);
      return;
    }

    state.rightTeam = state.rightTeam.filter((item) => item.id !== playerId);

    if (!leftHasPlayer) {
      state.leftTeam.push(player);
    }
  }

  if (side === "right") {
    if (!rightHasPlayer && state.rightTeam.length >= state.format) {
      alert(`O time direito já chegou no limite do formato ${state.format}x${state.format}.`);
      return;
    }

    state.leftTeam = state.leftTeam.filter((item) => item.id !== playerId);

    if (!rightHasPlayer) {
      state.rightTeam.push(player);
    }
  }

  state.winnerSide = null;
  renderPlayers();
  renderTeams();
}

function generateRandomTeams() {
  const neededPlayers = state.format * 2;
  const selectedPlayers = state.players.filter((player) =>
    state.selectedPlayerIds.has(player.id)
  );

  if (selectedPlayers.length !== neededPlayers) {
    alert(`Para ${state.format}x${state.format}, seleciona exatamente ${neededPlayers} jogadores.`);
    return;
  }

  const shuffled = shuffleArray([...selectedPlayers]);
  state.leftTeam = shuffled.slice(0, state.format);
  state.rightTeam = shuffled.slice(state.format, neededPlayers);
  state.winnerSide = null;

  renderPlayers();
  renderTeams();
}

function validateManualTeams() {
  if (state.leftTeam.length !== state.format || state.rightTeam.length !== state.format) {
    alert(`No modo manual, cada lado precisa ter exatamente ${state.format} jogadores.`);
    return;
  }

  alert("Confronto manual validado.");
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function renderTeams() {
  renderSingleTeam(els.leftTeamList, state.leftTeam, "Nenhum jogador neste time ainda.");
  renderSingleTeam(els.rightTeamList, state.rightTeam, "Nenhum jogador neste time ainda.");
  updateWinnerPreview();
  updateWinnerButtons();
}

function renderSingleTeam(container, teamPlayers, emptyText) {
  container.innerHTML = "";

  if (teamPlayers.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }

  teamPlayers.forEach((player) => {
    const item = document.createElement("div");
    item.className = "team-player";

    const nameEl = document.createElement("div");
    nameEl.className = "player-name";
    nameEl.textContent = player.lolName;

    const nicknameEl = document.createElement("div");
    nicknameEl.className = "player-nickname";
    nicknameEl.textContent = player.nickname ? `vulgo: ${player.nickname}` : "vulgo: —";

    item.appendChild(nameEl);
    item.appendChild(nicknameEl);
    container.appendChild(item);
  });
}

function updateWinnerPreview() {
  const winnerName =
    state.winnerSide === "left"
      ? getSafeTeamName("left")
      : state.winnerSide === "right"
      ? getSafeTeamName("right")
      : "";

  els.winnerPreview.value = winnerName || "";
  els.winnerPreview.placeholder = winnerName ? "" : "Ainda não definido";
}

function updateWinnerButtons() {
  const leftActive = state.winnerSide === "left";
  const rightActive = state.winnerSide === "right";

  els.leftWinBtn.style.borderColor = leftActive ? "rgba(120, 194, 146, 0.40)" : "";
  els.leftWinBtn.style.background = leftActive ? "rgba(120, 194, 146, 0.18)" : "";

  els.rightWinBtn.style.borderColor = rightActive ? "rgba(120, 194, 146, 0.40)" : "";
  els.rightWinBtn.style.background = rightActive ? "rgba(120, 194, 146, 0.18)" : "";
}

function getSafeTeamName(side) {
  if (side === "left") {
    return els.leftTeamName.value.trim() || "Time 1";
  }
  return els.rightTeamName.value.trim() || "Time 2";
}

function clearCurrentMatch() {
  state.leftTeam = [];
  state.rightTeam = [];
  state.winnerSide = null;
  els.leftTeamName.value = "Time 1";
  els.rightTeamName.value = "Time 2";
  updateWinnerPreview();
  updateWinnerButtons();
}

function openPlayerModal() {
  els.playerModal.classList.remove("hidden");
  els.playerLolName.focus();
}

function closePlayerModal() {
  els.playerModal.classList.add("hidden");
  els.playerLolName.value = "";
  els.playerNickname.value = "";
}

function saveNewPlayer() {
  const lolName = els.playerLolName.value.trim();
  const nickname = els.playerNickname.value.trim();

  if (!lolName) {
    alert("Coloca pelo menos o nome no LoL.");
    return;
  }

  const duplicate = state.players.some(
    (player) =>
      player.lolName.trim().toLowerCase() === lolName.toLowerCase() &&
      (player.nickname || "").trim().toLowerCase() === nickname.toLowerCase()
  );

  if (duplicate) {
    alert("Esse player já está cadastrado.");
    return;
  }

  const newPlayer = {
    id: createPlayerId(lolName, nickname),
    lolName,
    nickname,
    source: "local"
  };

  state.players.push(newPlayer);
  persistLocalPlayers();
  renderPlayers();
  closePlayerModal();

  alert("Player salvo neste navegador. Depois, se quiser deixar oficial no site público, a gente coloca no players.json.");
}

function renderHistory() {
  els.historyList.innerHTML = "";

  if (!Array.isArray(state.matches) || state.matches.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Nenhuma partida registrada ainda.";
    els.historyList.appendChild(empty);
    return;
  }

  state.matches
    .slice()
    .reverse()
    .forEach((match, index) => {
      const card = document.createElement("article");
      card.className = "history-card";

      const top = document.createElement("div");
      top.className = "history-top";

      const titleWrap = document.createElement("div");

      const title = document.createElement("h3");
      title.className = "history-title";
      title.textContent = `${match.leftTeamName || "Time 1"} vs ${match.rightTeamName || "Time 2"}`;

      const meta = document.createElement("p");
      meta.className = "history-meta";
      meta.textContent = `${match.date || "Sem data"} • ${match.mode || "Desordem (Personalizada)"}`;

      titleWrap.appendChild(title);
      titleWrap.appendChild(meta);

      const winner = document.createElement("div");
      winner.className = "history-winner";
      winner.textContent = `Vencedor: ${match.winner || "Não definido"}`;

      top.appendChild(titleWrap);
      top.appendChild(winner);

      const teams = document.createElement("div");
      teams.className = "history-teams";

      teams.appendChild(
        createHistoryTeamBox(match.leftTeamName || "Time 1", match.leftPlayers || [])
      );

      teams.appendChild(
        createHistoryTeamBox(match.rightTeamName || "Time 2", match.rightPlayers || [])
      );

      card.appendChild(top);
      card.appendChild(teams);

      if (match.mainPrint) {
        const image = document.createElement("img");
        image.className = "history-image";
        image.src = match.mainPrint;
        image.alt = `Print da partida ${index + 1}`;
        image.loading = "lazy";
        card.appendChild(image);
      }

      if (Array.isArray(match.extraAttachments) && match.extraAttachments.length > 0) {
        const attachmentsWrap = document.createElement("div");
        attachmentsWrap.className = "history-notes";

        const attachmentTitle = document.createElement("strong");
        attachmentTitle.textContent = "Anexos extras:";
        attachmentsWrap.appendChild(attachmentTitle);

        const list = document.createElement("ul");
        list.style.marginTop = "10px";
        list.style.paddingLeft = "20px";

        match.extraAttachments.forEach((file) => {
          const li = document.createElement("li");
          const link = document.createElement("a");
          link.href = file;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = file;
          link.style.color = "#9fdab4";
          li.appendChild(link);
          list.appendChild(li);
        });

        attachmentsWrap.appendChild(list);
        card.appendChild(attachmentsWrap);
      }

      if (match.notes) {
        const notes = document.createElement("div");
        notes.className = "history-notes";
        notes.textContent = match.notes;
        card.appendChild(notes);
      }

      els.historyList.appendChild(card);
    });
}

function createHistoryTeamBox(teamName, players) {
  const box = document.createElement("div");
  box.className = "history-team-box";

  const title = document.createElement("h4");
  title.textContent = teamName;

  const list = document.createElement("ul");

  const normalizedPlayers = Array.isArray(players) ? players : [];

  if (normalizedPlayers.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Sem jogadores registrados.";
    list.appendChild(li);
  } else {
    normalizedPlayers.forEach((player) => {
      const li = document.createElement("li");

      if (typeof player === "string") {
        li.textContent = player;
      } else {
        const base = player.lolName || player.name || "Player";
        const nickname = player.nickname || player.vulgo || "";
        li.textContent = nickname ? `${base} (vulgo: ${nickname})` : base;
      }

      list.appendChild(li);
    });
  }

  box.appendChild(title);
  box.appendChild(list);

  return box;
}

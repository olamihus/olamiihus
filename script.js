(() => {
  const palette = ["#f43f5e", "#fb923c", "#facc15", "#22c55e", "#3b82f6", "#a855f7"];
  const floodDelay = 55;
  const POINT_MULTIPLIER = 10;
  const tutorialMessages = [
    "Tap the highlighted color to expand your territory.",
    "Great! Follow the highlight again to keep growing.",
    "Nice! Fewer moves mean more points—finish the board!"
  ];

  // UI references
  const boardEl = document.getElementById("board");
  const moveCountEl = document.getElementById("moveCount");
  const moveLimitEl = document.getElementById("moveLimit");
  const levelDisplay = document.getElementById("levelDisplay");
  const pointsTotalEl = document.getElementById("pointsTotal");
  const buttonsEl = document.getElementById("colorButtons");
  const resetBtn = document.getElementById("resetBtn");
  const newGameBtn = document.getElementById("newGameBtn");
  const overlay = document.getElementById("levelOverlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayMessage = document.getElementById("overlayMessage");
  const overlayBtn = document.getElementById("overlayBtn");
  const tutorial = document.getElementById("tutorial");
  const tutorialText = document.getElementById("tutorialText");
  const tutorialBtn = document.getElementById("tutorialBtn");
  const skipTutorialBtn = document.getElementById("skipTutorialBtn");
  const soundToggle = document.getElementById("soundToggle");
  const themeSelect = document.getElementById("themeSelect");
  const drawerToggle = document.getElementById("drawerToggle");
  const drawer = document.getElementById("drawer");
  const drawerClose = document.getElementById("drawerClose");
  const drawerBackdrop = document.getElementById("drawerBackdrop");
  const drawerLevel = document.getElementById("drawerLevel");
  const drawerPoints = document.getElementById("drawerPoints");
  const particlesEl = document.getElementById("particles");
  const winSound = document.getElementById("winSound");
  const moveSound = document.getElementById("moveSound");
  const fillSound = document.getElementById("fillSound");
  const loseSound = document.getElementById("loseSound");
// Background music
const bgMusic = document.getElementById("bgMusic");
let bgMusicEnabled = localStorage.getItem("bgMusicEnabled") !== "off";
bgMusic.loop = true;
bgMusic.volume = 0.35;

// Autoplay fix (browser won't play until user interacts)
window.addEventListener("click", function enableBG() {
  if (bgMusicEnabled) {
    bgMusic.play().catch(() => {});
  }
  window.removeEventListener("click", enableBG);
});

  let currentLevel = 1;
  let grid = [];
  let activeColor = "";
  let moveCount = 0;
  let animating = false;
  let tutorialDismissed = false;
  let moveLimit = 0;
  let totalPoints = Number(localStorage.getItem("fillerPoints") || 0);
  let soundEnabled = localStorage.getItem("fillerSound") !== "off";
  let activeTheme = localStorage.getItem("fillerTheme") || "light";
  let tutorialCompleted = localStorage.getItem("fillerTutorialComplete") === "true";
  let tutorialActive = false;
  let tutorialStep = 0;
  let tutorialHintColor = null;
  let tutorialAwaitingMove = false;
  let autoAdvanceId = null;

  const soundMap = {
    move: moveSound,
    fill: fillSound,
    win: winSound,
    lose: loseSound
  };

  const addTapListener = (element, handler) => {
    if (!element) return;
    element.addEventListener("click", event => {
      if (element.dataset.touchActive === "true") {
        element.dataset.touchActive = "false";
        return;
      }
      handler(event);
    });
    element.addEventListener(
      "touchstart",
      event => {
        element.dataset.touchActive = "true";
        event.preventDefault();
        handler(event);
        setTimeout(() => {
          element.dataset.touchActive = "false";
        }, 0);
      },
      { passive: false }
    );
  };

  const init = () => {
    buildButtons();
    addTapListener(resetBtn, () => loadLevel(currentLevel, true));
    addTapListener(newGameBtn, handleNewGame);
    addTapListener(drawerToggle, () => setDrawerState(!(drawerToggle.getAttribute("aria-expanded") === "true")));
    addTapListener(drawerClose, () => setDrawerState(false));
    addTapListener(drawerBackdrop, () => setDrawerState(false));
    addTapListener(overlayBtn, handleOverlayConfirm);
    addTapListener(tutorialBtn, handleTutorialButton);
    addTapListener(skipTutorialBtn, handleSkipTutorial);
    addTapListener(soundToggle, () => {
        toggleSound();             // handles move/fill/win/lose effects
        toggleBackgroundMusic();   // handles your me.mp3
      });
      
    themeSelect.addEventListener("change", event => applyTheme(event.target.value));
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") setDrawerState(false);
    });
    updatePointsDisplay();
    applyTheme(activeTheme);
    updateSoundButton();
    const savedLevel = Math.max(1, Number(localStorage.getItem("fillerLevel")) || 1);
    loadLevel(savedLevel);
  };

  const handleOverlayConfirm = () => {
    hideOverlay();
    if (autoAdvanceId) {
      clearTimeout(autoAdvanceId);
      autoAdvanceId = null;
    }
    const action = overlay.dataset.action;
    if (action === "next") {
      loadLevel(currentLevel + 1);
    } else if (action === "restart") {
      loadLevel(1);
    } else {
      loadLevel(currentLevel, true);
    }
  };

  const getSizeForLevel = level => 4 + Math.floor((level - 1) / 2);

  const calculateMoves = (size, level) => {
    const base = size * 1.55 + palette.length * 0.5;
    const generosity = Math.max(0, 6 - level * 0.15);
    const rampPenalty = Math.log(level + 1) * 0.9;
    return Math.max(Math.round(base + generosity - rampPenalty), size);
  };

  const loadLevel = (level, isReset = false) => {
    currentLevel = level;
    localStorage.setItem("fillerLevel", String(currentLevel));
    const size = getSizeForLevel(level);
    moveLimit = calculateMoves(size, level);
    moveCount = 0;
    moveCountEl.textContent = moveCount.toString();
    moveLimitEl.textContent = moveLimit.toString();
    levelDisplay.textContent = level.toString();
    updateDrawerSummary();
    boardEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    boardEl.style.gap = `${size >= 14 ? 2 : size >= 10 ? 3 : 4}px`;
    boardEl.style.padding = `${size >= 14 ? 4 : 8}px`;
    boardEl.innerHTML = "";
    tutorialHintColor = null;
    tutorialAwaitingMove = false;
    clearHints();

    grid = Array.from({ length: size }, (_, r) =>
      Array.from({ length: size }, (_, c) => {
        const color = palette[Math.floor(Math.random() * palette.length)];
        const tile = document.createElement("div");
        tile.className = "tile";
        tile.style.backgroundColor = color;
        tile.dataset.row = r;
        tile.dataset.col = c;
        boardEl.appendChild(tile);
        return { color, el: tile };
      })
    );

    activeColor = grid[0][0].color;
    highlightButtons();
    animateGridIn();

    const guidedTutorialNeeded = currentLevel === 1 && !tutorialCompleted;
    const genericTutorialAllowed = currentLevel <= 2;
    if (guidedTutorialNeeded) {
      startGuidedTutorial(size, moveLimit);
    } else if (genericTutorialAllowed) {
      tutorialActive = false;
      tutorialDismissed = false;
      updateTutorialCopy(size, moveLimit, level);
      showTutorial();
    } else {
      tutorialActive = false;
      tutorialDismissed = true;
      hideTutorial();
    }

    if (isReset) hideOverlay();
    updateDrawerSummary();
  };

  const buildButtons = () => {
    buttonsEl.innerHTML = "";
    palette.forEach(color => {
      const btn = document.createElement("button");
      btn.className = "color-btn";
      btn.style.backgroundColor = color;
      btn.dataset.color = color;
      addTapListener(btn, () => handleColorPick(color));
      buttonsEl.appendChild(btn);
    });
  };

  const highlightButtons = () => {
    [...buttonsEl.children].forEach(btn => {
      btn.classList.toggle("active", btn.dataset.color === activeColor);
    });
  };

  const animateGridIn = () => {
    [...boardEl.children].forEach((tile, index) => {
      tile.style.animationDelay = `${(index % 8) * 30}ms`;
    });
  };

  const handleColorPick = color => {
    if (animating || color === activeColor || moveCount >= moveLimit) return;
    if (!tutorialDismissed && !tutorialActive) {
      tutorialDismissed = true;
      hideTutorial();
    }
    tutorialAwaitingMove = tutorialActive;
    playSound("move");
    floodFill(color);
  };

  const adjacent = (r, c, size) =>
    [
      [r + 1, c],
      [r - 1, c],
      [r, c + 1],
      [r, c - 1]
    ].filter(([nr, nc]) => nr >= 0 && nr < size && nc >= 0 && nc < size);

  const floodFill = newColor => {
    const size = grid.length;
    const oldColor = activeColor;
    if (newColor === oldColor) return;

    animating = true;
    moveCount += 1;
    moveCountEl.textContent = moveCount.toString();

    const visited = new Set();
    const queue = [[0, 0, 0]];
    const steps = [];

    while (queue.length) {
      const [r, c, depth] = queue.shift();
      const key = `${r}-${c}`;
      if (visited.has(key)) continue;
      visited.add(key);

      if (!steps[depth]) steps[depth] = [];
      steps[depth].push([r, c]);

      for (const [nr, nc] of adjacent(r, c, size)) {
        const neighborKey = `${nr}-${nc}`;
        if (visited.has(neighborKey)) continue;
        const neighborColor = grid[nr][nc].color;
        if (neighborColor === oldColor || neighborColor === newColor) {
          queue.push([nr, nc, depth + 1]);
        }
      }
    }

    activeColor = newColor;
    highlightButtons();

    steps.forEach((tiles, idx) => {
      setTimeout(() => {
        tiles.forEach(([r, c]) => {
          const cell = grid[r][c];
          cell.color = newColor;
          cell.el.style.backgroundColor = newColor;
          cell.el.classList.add("flooding");
          setTimeout(() => cell.el.classList.remove("flooding"), 260);
        });
        if (tiles.length) playSound("fill");
        if (idx === steps.length - 1) {
          animating = false;
          handleTutorialAdvanceIfNeeded();
          checkState();
        }
      }, idx * floodDelay);
    });
  };

  const handleTutorialAdvanceIfNeeded = () => {
    if (!tutorialActive || !tutorialAwaitingMove) return;
    tutorialAwaitingMove = false;
    tutorialStep += 1;
    if (tutorialStep >= tutorialMessages.length) {
      endGuidedTutorial(false);
      return;
    }
    tutorialDismissed = false;
    tutorialText.textContent = tutorialMessages[tutorialStep];
    clearHints();
    showTutorial();
  };

  const checkState = () => {
    const victory = grid.every(row => row.every(cell => cell.color === activeColor));
    if (victory) {
      const levelPoints = Math.max(moveLimit - moveCount, 0) * POINT_MULTIPLIER;
      awardPoints(levelPoints);
      celebrateWin();
      const message = `Level ${currentLevel} complete! +${levelPoints} pts`;
      showOverlay("Level Clear!", message, "next", { autoAdvance: true, delay: 2200 });
      if (currentLevel <= 2 && !tutorialCompleted) {
        tutorialCompleted = true;
        localStorage.setItem("fillerTutorialComplete", "true");
        endGuidedTutorial(false);
      }
      return;
    }

    if (moveCount >= moveLimit) {
      playSound("lose");
      showOverlay("Game Over", "No moves left. Try the level again!", "retry");
    }
  };

  const awardPoints = amount => {
    totalPoints += amount;
    localStorage.setItem("fillerPoints", String(totalPoints));
    updatePointsDisplay();
  };

  const updatePointsDisplay = () => {
    const formatted = totalPoints.toLocaleString();
    pointsTotalEl.textContent = formatted;
    drawerPoints.textContent = formatted;
  };

  const celebrateWin = () => {
    playSound("win");
    grid.flat().forEach((cell, index) => {
      setTimeout(() => {
        cell.el.style.animation = "pulse 350ms ease";
        cell.el.classList.add("flash");
        setTimeout(() => cell.el.classList.remove("flash"), 450);
        setTimeout(() => (cell.el.style.animation = ""), 350);
      }, index * 6);
    });
    spawnParticles(activeColor);
  };

  const spawnParticles = color => {
    const particles = 14;
    for (let i = 0; i < particles; i++) {
      const spark = document.createElement("span");
      spark.className = "spark";
      spark.style.backgroundColor = color;
      spark.style.left = "50%";
      spark.style.top = "50%";
      spark.style.setProperty("--dx", `${(Math.random() - 0.5) * 200}px`);
      spark.style.setProperty("--dy", `${(Math.random() - 0.5) * 200}px`);
      particlesEl.appendChild(spark);
      setTimeout(() => spark.remove(), 700);
    }
  };

  const showOverlay = (title, message, action, options = {}) => {
    overlayTitle.textContent = title;
    overlayMessage.textContent = message;
    overlay.dataset.action = action;
    overlay.classList.remove("hidden");
    if (autoAdvanceId) {
      clearTimeout(autoAdvanceId);
      autoAdvanceId = null;
    }
    if (options.autoAdvance) {
      autoAdvanceId = setTimeout(() => {
        autoAdvanceId = null;
        handleOverlayConfirm();
      }, options.delay || 2000);
    }
  };

  const hideOverlay = () => {
    overlay.classList.add("hidden");
  };

  const updateTutorialCopy = (size, moves, level) => {
    tutorialText.textContent = `Level ${level}: Flood the ${size}×${size} board from the top-left tile. Tap colors to absorb matching neighbors and finish within ${moves} moves. Boards grow as you advance—keep flooding!`;
  };

  const showTutorial = () => {
    tutorial.classList.remove("hidden");
  };

  const hideTutorial = () => {
    tutorial.classList.add("hidden");
  };

  const startGuidedTutorial = (size, moves) => {
    tutorialActive = true;
    tutorialStep = 0;
    tutorialAwaitingMove = false;
    tutorialDismissed = false;
    tutorialText.textContent = `Level 1 (${size}×${size}): ${tutorialMessages[0]}`;
    showTutorial();
  };

  const handleTutorialButton = () => {
    tutorialDismissed = true;
    hideTutorial();
    if (tutorialActive) {
      highlightSuggestedColor();
    }
  };

  const handleSkipTutorial = () => {
    if (tutorialActive) {
      endGuidedTutorial(true);
    } else {
      tutorialDismissed = true;
      hideTutorial();
    }
  };

  const endGuidedTutorial = skip => {
    tutorialActive = false;
    tutorialAwaitingMove = false;
    clearHints();
    hideTutorial();
    tutorialDismissed = true;
    if (skip) {
      tutorialCompleted = true;
      localStorage.setItem("fillerTutorialComplete", "true");
    }
  };

  const highlightSuggestedColor = () => {
    tutorialHintColor = getSuggestedColor();
    clearHints();
    if (!tutorialHintColor) return;
    [...buttonsEl.children].forEach(btn => {
      if (btn.dataset.color === tutorialHintColor) {
        btn.classList.add("hint");
      }
    });
  };

  const clearHints = () => {
    [...buttonsEl.children].forEach(btn => btn.classList.remove("hint"));
  };

  const getSuggestedColor = () => {
    const size = grid.length;
    const visited = new Set();
    const queue = [[0, 0]];
    const territory = [];

    while (queue.length) {
      const [r, c] = queue.pop();
      const key = `${r}-${c}`;
      if (visited.has(key)) continue;
      visited.add(key);
      territory.push([r, c]);
      for (const [nr, nc] of adjacent(r, c, size)) {
        if (grid[nr][nc].color === activeColor) queue.push([nr, nc]);
      }
    }

    const counts = {};
    territory.forEach(([r, c]) => {
      for (const [nr, nc] of adjacent(r, c, size)) {
        const color = grid[nr][nc].color;
        if (color !== activeColor) counts[color] = (counts[color] || 0) + 1;
      }
    });

    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  };

  const playSound = type => {
    if (!soundEnabled) return;
    const audio = soundMap[type];
    if (!audio) return;
    try {
      audio.currentTime = 0;
      audio.play();
    } catch {
      /* ignore autoplay issues */
    }
  };

  const toggleSound = () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem("fillerSound", soundEnabled ? "on" : "off");
    updateSoundButton();
  };
  const toggleBackgroundMusic = () => {
    bgMusicEnabled = !bgMusicEnabled;
    localStorage.setItem("bgMusicEnabled", bgMusicEnabled ? "on" : "off");
  
    if (bgMusicEnabled) {
      bgMusic.play().catch(() => {});
    } else {
      bgMusic.pause();
    }
  };
  

  const updateSoundButton = () => {
    soundToggle.textContent = soundEnabled ? "🔊 Sound" : "🔇 Muted";
    soundToggle.setAttribute("aria-pressed", soundEnabled ? "false" : "true");
  };

  const applyTheme = theme => {
    document.body.classList.remove("theme-light", "theme-dark", "theme-colorful");
    document.body.classList.add(`theme-${theme}`);
    activeTheme = theme;
    themeSelect.value = theme;
    localStorage.setItem("fillerTheme", theme);
  };

  const setDrawerState = open => {
    drawer.classList.toggle("open", open);
    drawerBackdrop.classList.toggle("hidden", !open);
    drawerToggle.setAttribute("aria-expanded", open ? "true" : "false");
    drawer.setAttribute("aria-hidden", open ? "false" : "true");
    document.body.classList.toggle("drawer-open", open);
  };

  const updateDrawerSummary = () => {
    if (drawerLevel) drawerLevel.textContent = currentLevel.toString();
    if (drawerPoints) drawerPoints.textContent = totalPoints.toLocaleString();
  };

  const handleNewGame = () => {
    totalPoints = 0;
    localStorage.setItem("fillerPoints", "0");
    localStorage.setItem("fillerLevel", "1");
    updatePointsDisplay();
    setDrawerState(false);
    loadLevel(1, true);
  };

  window.addEventListener("DOMContentLoaded", init);
})();

// Enhanced Farcaster & Base Mini App Integration
const initMiniApp = () => {
  // Base Mini App SDK
  if (window.EmbedSDK) {
    window.EmbedSDK.init();
    console.log('Base Mini App SDK initialized');
  }
  
  // Farcaster Frame Integration
  if (window.FarcasterFrameSdk) {
    try {
      FarcasterFrameSdk.actions.ready();
      console.log('Farcaster Frame ready');
      
      // Handle frame actions if needed
      FarcasterFrameSdk.actions.on('action', (event) => {
        console.log('Frame action received:', event);
      });
    } catch (error) {
      console.log('Farcaster Frame SDK not available');
    }
  }
  
  // Warpcast specific detection
  if (window.ethereum && window.ethereum.isMiniApp) {
    console.log('Running in Warpcast Mini App');
  }
};

// Update the DOMContentLoaded event
window.addEventListener("DOMContentLoaded", () => {
  init();
  initMiniApp();
});

// Handle mobile viewport for embedded apps
if (window.self !== window.top) {
  // We're in an iframe (embedded in Farcaster/Base)
  document.body.classList.add('embedded');
  
  // Adjust viewport for embedded experience
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
  }
}

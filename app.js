const player = document.querySelector("#episode-player");
const videoFrame = document.querySelector(".video-frame");
const liveProgress = document.querySelector("#live-progress");
const progressPlayhead = document.querySelector("#progress-playhead");
const progressCurrent = document.querySelector("#progress-current");
const progressDuration = document.querySelector("#progress-duration");
const emptyState = document.querySelector("#empty-state");
const episodeKicker = document.querySelector("#episode-kicker");
const episodeTitle = document.querySelector("#episode-title");
const episodeStart = document.querySelector("#episode-start");
const fullscreenEpisodeKicker = document.querySelector("#fullscreen-episode-kicker");
const fullscreenEpisodeTitle = document.querySelector("#fullscreen-episode-title");
const progressFill = document.querySelector("#progress-fill");
const muteButton = document.querySelector("#mute-button");
const volumeSlider = document.querySelector("#volume-slider");
const fullscreenButton = document.querySelector("#fullscreen-button");
const watchTime = document.querySelector("#watch-time");
const episodesWatched = document.querySelector("#episodes-watched");
const viewerCount = document.querySelector("#viewer-count");

let schedule = [];
let totalDuration = 0;
let activeIndex = -1;
let activeOffset = 0;
let sessionStartedAt = Date.now();
let completedEpisodeCount = 0;

init();
bindControls();
bindControlVisibility();
bindProgressHover();
bindKeyboardShortcuts();

async function init() {
  try {
    const response = await fetch("episodes.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Schedule failed to load: ${response.status}`);

    const data = await response.json();
    episodeKicker.textContent = "Loading Episode Metadata...";

    const episodes = await hydrateEpisodeDurations(normalizeSchedule(data.episodes || []));
    schedule = shuffleEpisodes(episodes.filter((episode) => episode.duration > 0));
    totalDuration = schedule.reduce((total, episode) => total + episode.duration, 0);

    if (!schedule.length || totalDuration <= 0) {
      showEmptyState();
      return;
    }

    syncToBroadcast();
    updateSessionStats();
    setInterval(syncToBroadcast, 1000);
    setInterval(updateSessionStats, 1000);
  } catch (error) {
    console.error(error);
    showEmptyState("Could Not Load episodes.json");
  }
}

function normalizeSchedule(episodes) {
  return episodes
    .map((episode, index) => ({
      id: episode.id || `episode-${index + 1}`,
      title: episode.title || "Untitled Episode",
      season: Number(episode.season) || 1,
      episode: Number(episode.episode) || index + 1,
      duration: Number(episode.durationSeconds) || 0,
      file: episode.file || "",
    }))
    .filter((episode) => episode.file);
}

async function hydrateEpisodeDurations(episodes) {
  return Promise.all(
    episodes.map(async (episode) => {
      if (episode.duration > 0) return episode;

      return {
        ...episode,
        duration: await readVideoDuration(episode.file),
      };
    }),
  );
}

function readVideoDuration(file) {
  return new Promise((resolve) => {
    const video = document.createElement("video");

    video.preload = "metadata";
    video.src = file;

    video.addEventListener(
      "loadedmetadata",
      () => {
        resolve(Number.isFinite(video.duration) ? Math.ceil(video.duration) : 0);
        video.removeAttribute("src");
        video.load();
      },
      { once: true },
    );

    video.addEventListener(
      "error",
      () => {
        console.warn(`Could not read duration for ${file}`);
        resolve(0);
      },
      { once: true },
    );
  });
}

function shuffleEpisodes(episodes) {
  const shuffled = [...episodes];
  let seed = getDailySeed();

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const swapIndex = seed % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function getDailySeed() {
  const now = new Date();
  const dateKey = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;

  return [...dateKey].reduce((seed, char) => seed + char.charCodeAt(0), 0);
}

function syncToBroadcast() {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const positionInLoop = nowSeconds % totalDuration;
  const { episode, index, offset } = findEpisode(positionInLoop);

  if (!episode) {
    showEmptyState();
    return;
  }

  activeOffset = offset;

  if (index !== activeIndex) {
    if (activeIndex !== -1) completedEpisodeCount += 1;
    activeIndex = index;
    player.src = episode.file;
    updateEpisodeDetails(episode, nowSeconds - offset);
  }

  if (Math.abs(player.currentTime - offset) > 1.5) {
    player.currentTime = offset;
  }

  updateProgress(offset, episode.duration);

  if (player.paused) {
    player.play().catch(() => {
      episodeKicker.textContent = "Tap The Video Once To Start Autoplay";
    });
  }
}

function findEpisode(positionInLoop) {
  let elapsed = 0;

  for (let index = 0; index < schedule.length; index += 1) {
    const episode = schedule[index];
    const nextElapsed = elapsed + episode.duration;

    if (positionInLoop < nextElapsed) {
      return { episode, index, offset: positionInLoop - elapsed };
    }

    elapsed = nextElapsed;
  }

  return { episode: schedule[0], index: 0, offset: 0 };
}

function updateProgress(offset, duration) {
  const percent = Math.min((offset / duration) * 100, 100);

  progressFill.style.width = `${percent}%`;
  progressPlayhead.style.left = `${percent}%`;
  progressCurrent.textContent = formatMediaTime(offset);
  progressDuration.textContent = formatMediaTime(duration);
}

function updateEpisodeDetails(episode, startTimestamp) {
  const episodeLabel = `Season ${episode.season} - Episode ${episode.episode}`;

  episodeKicker.textContent = episodeLabel;
  episodeTitle.textContent = episode.title;
  fullscreenEpisodeKicker.textContent = episodeLabel;
  fullscreenEpisodeTitle.textContent = episode.title;
  episodeStart.textContent = new Date(startTimestamp * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  viewerCount.textContent = formatViewerCount(getViewerCount());
  emptyState.hidden = true;
}

function showEmptyState(message = "No episodes loaded") {
  episodeKicker.textContent = "Episodes Unavailable";
  episodeTitle.textContent = message;
  emptyState.hidden = false;
  viewerCount.textContent = "0 Others";
}

function updateSessionStats() {
  const elapsedSeconds = Math.floor((Date.now() - sessionStartedAt) / 1000);

  watchTime.textContent = formatElapsedTime(elapsedSeconds);
  episodesWatched.textContent = String(completedEpisodeCount);
  viewerCount.textContent = formatViewerCount(getViewerCount());
}

function getViewerCount() {
  const fiveMinuteBlock = Math.floor(Date.now() / 1000 / 300);
  const seed = (fiveMinuteBlock * 1103515245 + 12345) >>> 0;

  return 18 + (seed % 74);
}

function formatViewerCount(count) {
  return `${count} Others`;
}

function formatElapsedTime(totalSeconds) {
  if (totalSeconds < 60) return `${totalSeconds} ${totalSeconds === 1 ? "Second" : "Seconds"}`;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatMediaTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function bindControlVisibility() {
  let hideControlsTimer;

  const showControls = () => {
    videoFrame.classList.add("is-controls-visible");
    window.clearTimeout(hideControlsTimer);
    hideControlsTimer = window.setTimeout(() => {
      if (!document.fullscreenElement && videoFrame.querySelector(":focus-within")) return;
      videoFrame.classList.remove("is-controls-visible");
      progressPlayhead.classList.remove("is-hovered");
    }, 1000);
  };

  videoFrame.addEventListener("mouseenter", showControls);
  videoFrame.addEventListener("mousemove", showControls);
  videoFrame.addEventListener("mouseleave", () => {
    window.clearTimeout(hideControlsTimer);
    videoFrame.classList.remove("is-controls-visible");
    progressPlayhead.classList.remove("is-hovered");
  });
  videoFrame.addEventListener("focusin", () => videoFrame.classList.add("is-controls-visible"));
  videoFrame.addEventListener("focusout", () => {
    if (!videoFrame.matches(":hover")) videoFrame.classList.remove("is-controls-visible");
  });
  document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement === videoFrame) {
      videoFrame.classList.add("is-fullscreen");
      showControls();
      return;
    }

    videoFrame.classList.remove("is-fullscreen");
    videoFrame.classList.remove("is-controls-visible");
    progressPlayhead.classList.remove("is-hovered");
  });
}

function bindProgressHover() {
  liveProgress.addEventListener("mousemove", (event) => {
    const playheadBox = progressPlayhead.getBoundingClientRect();
    const playheadCenterX = playheadBox.left + playheadBox.width / 2;
    const isNearPlayhead = Math.abs(event.clientX - playheadCenterX) <= 18;

    progressPlayhead.classList.toggle("is-hovered", isNearPlayhead);
  });

  liveProgress.addEventListener("mouseleave", () => {
    progressPlayhead.classList.remove("is-hovered");
  });
}

function bindKeyboardShortcuts() {
  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    const isTyping =
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement;

    if (isTyping && event.target !== volumeSlider) return;

    if (key === "m") {
      event.preventDefault();
      toggleMute();
    }

    if (key === "f") {
      event.preventDefault();
      toggleFullscreen();
    }

    if (key === "arrowup") {
      event.preventDefault();
      adjustVolume(0.05);
    }

    if (key === "arrowdown") {
      event.preventDefault();
      adjustVolume(-0.05);
    }
  });
}

function adjustVolume(delta) {
  const nextVolume = Math.min(1, Math.max(0, Math.round((player.volume + delta) * 100) / 100));

  player.volume = nextVolume;
  player.muted = nextVolume === 0;
  volumeSlider.value = String(nextVolume);
  updateMuteButton();
}

function toggleMute() {
  player.muted = !player.muted;

  if (!player.muted && player.volume === 0) {
    player.volume = 0.7;
    volumeSlider.value = String(player.volume);
  }

  updateMuteButton();
}
function bindControls() {
  muteButton.addEventListener("click", toggleMute);

  volumeSlider.addEventListener("input", () => {
    player.volume = Number(volumeSlider.value);
    player.muted = player.volume === 0;
    updateMuteButton();
  });

  fullscreenButton.addEventListener("click", toggleFullscreen);

  player.addEventListener("volumechange", updateMuteButton);
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
    return;
  }

  document.querySelector(".video-frame").requestFullscreen();
  fullscreenButton.blur();
}

function updateMuteButton() {
  const isMuted = player.muted || player.volume === 0;
  const icon = getVolumeIcon();

  muteButton.textContent = icon;
  muteButton.title = isMuted ? "Unmute" : "Mute";
  muteButton.setAttribute("aria-label", isMuted ? "Unmute" : "Mute");
}

function getVolumeIcon() {
  if (player.muted || player.volume === 0) return "🔇";
  if (player.volume < 0.34) return "🔈";
  if (player.volume < 0.67) return "🔉";
  return "🔊";
}

player.addEventListener("pause", () => {
  if (schedule.length) syncToBroadcast();
});

player.addEventListener("seeking", () => {
  if (schedule.length) syncToBroadcast();
});














